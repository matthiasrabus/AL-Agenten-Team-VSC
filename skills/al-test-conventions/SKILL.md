---
name: al-test-conventions
description: 'Conventions and pitfalls for Business Central AL test codeunits: planning and writing tests, RED classification (genuine vs. false RED), handlers, setup singletons, subscribers on test-data inserts, test runners and sessions, SingleInstance mocks, test budget, Code vs Text. Use when: planning AL tests, writing failing tests (TDD red mode), reviewing a test plan, test fails for an unrelated reason, false RED, handler functions, StartSession in tests, Test Tool runner.'
---

# AL test conventions

Shared by the AL Test Planner (plan the rules in) and the AL TDD Implementer (apply them). Each extra test is another potential false-RED round the user has to run when the agent cannot run tests itself, so keep the suite small and the environment prerequisites explicit.

## Test design

- Target `Subtype = Test` codeunits; IDs come from the **test** app's `idRanges` (reserved via AL Object Ninja at implementation time).
- Use interface-based mocks (no real HTTP). Use `temporary` records only where the code under test operates on the passed record. When production reads REAL tables (`Get`, `SetRange/FindSet`), plan REAL (non-temporary) records with consistent keys plus cleanup, and list every prerequisite setup/singleton record the code reads. Functional test codeunits need `TestPermissions = Disabled;`.
- Prefer the project's in-repo mock/seam pattern over external test libraries that are not in the test symbols. If production hardcodes a dependency (e.g. a handler codeunit ID), add a seam (single-instance override / interface + mock) so the mock can be injected.
- A `SingleInstance` mock/seam shares state across ALL tests in a run. Give it a full `Reset()` (every configured field + counters) and call it at the START of `Initialize()` in EVERY consuming test codeunit, including pre-existing ones. Verify order-independence by running the suite in more than one ordering/selection before claiming GREEN.
- Every scenario asserts real, observable behavior (state/field/record/error) — never a trivial always-true check (`Assert.IsTrue(true, ...)`). If a scenario seems un-testable, build the seam/data or flag it; do not fake coverage.
- Each scenario is one test method with a self-describing name. **The `[Test]` body contains ONLY calls to descriptively-named helper procedures** (`CreateNormalSalesOrderWithLine(...)`, `PostSalesHeaderAsShipmentAndInvoice(...)`, `AssertInvoiceUsesNoSeries(...)`) under `// [GIVEN] / [WHEN] / [THEN]` — no inline field assignment, `Validate`/`Modify`/`Get`/`SetRange`/`FindFirst`. Apply this retroactively to existing violating tests you touch. A guarded `Initialize()` called first in every test holds one-time environment setup (e.g. ensure a setup singleton exists), NOT per-test fixture data.
- Cover: happy path, boundaries, error/negative cases, permission gates. To assert an isolated **Modify** right use the explicit Modify permission, not `Rec.WritePermission` (that is Insert+Modify+Delete combined).
- Map every acceptance criterion to at least one test.
- `asserterror` always with `ExpectedError` text (a bare `asserterror` also passes on the wrong error). Assert a platform-raised error on a language-independent piece (a key value), not on localized text.

## Test budget — fewer, sharper tests

Size the suite to the production diff: one to two tests per production touchpoint plus one per distinct data-migration rule, not one per input permutation. No separate tests for inputs the code treats identically (pick a representative or loop inside one test). Add a "pin" (unchanged behavior) test only where the change could plausibly break it. State the total count in the plan with a one-line justification against the number of touchpoints. If a plan looks oversized for the diff (e.g. 35+ tests for ~6 small touchpoints), flag it and implement the trimmed set only after the orchestrator/planner agrees.

## Special scenario classes

- **Multi-scope/cross-tenant batch:** if a procedure processes a batch AND is reachable from a cross-customer/multi-tenant/multi-environment surface, plan at least one scenario whose working set spans TWO scopes sharing a non-globally-unique key (App ID, external entity ID, a document No. that repeats per company). Single-scope test data can never catch a dedup state keyed by that field alone.
- **Accumulator vs. auto-clearing subscriber:** a `SingleInstance` accumulator that an existing event subscriber clears at the end of a production flow is always empty after a full-flow test. For intermediate-state assertions call the internal test seam directly; reserve full-flow scenarios for end-state assertions (values + accumulator empty again). State per scenario which approach it uses and why.
- **Event/error-contract tests (multi-app flows):** error inside a subscriber (per unit of work, collected, run continues), the after-event raised even after errors, answers of several subscribers OR-combined.
- **Report/RDLC rendering and other UI-only paths default to a manual check** (list as M-items in the coverage matrix). Plan an automated test only if a robust, non-rendering seam exists. If a first attempt fails with a generic platform error and the cause is not obvious, demote it to a documented manual check immediately.
- **Experiments needing a real session** (does a filter reach a background session?) are NOT tests — use a plain startable codeunit (`OnRun` + `Message` verdict) via a `launch.json` configuration with `startupObjectType: Codeunit` (`test/.vscode` is usually gitignored) and delete it afterwards.

## Execution prerequisites belong in the plan

State explicitly: (a) the **test runner** each test needs — anything that starts a session (`StartSession`/background worker) needs `TestIsolation = Disabled` (`Test Runner - Isol. Disabled`); the runner is chosen per SUITE in the AL Test Tool, not per codeunit, and the isolating default runner rejects such tests; (b) the **container composition** per suite (e.g. app A tests must run WITHOUT app B because they stub it, app B tests need A + B + dependencies — possibly two containers) and the publish order (dependency first, test app last); (c) **subscribers that fire on the test-data inserts**.

## Writing the tests (TDD `red`)

- Before writing new tests, check sibling test codeunits for an existing `Initialize()`/`EnsureXSetupExists()` convention (a setup singleton some pre-existing subscriber unconditionally requires before ANY record of a type can be inserted) and reuse it from the start.
- **Derive handlers from the code, never copy them from sibling tests.** Before adding `[HandlerFunctions]` (`ConfirmHandler`/`MessageHandler`/`PageHandler`/...), grep the app and the standard flow for where the dialog is raised and confirm the WHEN-step reaches it (a "select the texts" confirm that fires only on release/post is NOT raised on line creation, conversion, import or `Validate(Quantity)`). A declared-but-never-invoked handler fails the test only when its body otherwise passes, so it hides behind assertion failures on genuine-RED tests and surfaces later as a false RED.
- **Check the standard validation chain before the first run** for any `Validate` on a field with a `TableRelation` or dependent setup (e.g. `Bin Code` → Bin Content → location `Bin Mandatory`): read the real trigger/relation from the base symbols and create the master data up front.
- **Check subscribers on the tables your test data inserts into — in ALL apps of the container.** Grep every app in scope (this repo, dependency repos, base app via symbols) for `EventSubscriber` on `Database::<Table>` `OnAfterInsertEvent`/`OnBeforeInsertEvent`/`OnAfterModifyEvent` for each inserted table (Item, Work Center, Production Order, ...) and verify what each needs at runtime. Real case (Bug 52511): an `Item.OnAfterInsert` subscriber called the Workflow Management; the container's Workflow Event library lacked the app's event, so 7 of 9 tests were false REDs in one run. Fix: an idempotent `Workflow Event Handling.CreateEventsLibrary()` in `Initialize()`.
- **`Code` vs `Text`:** a `Code[N]` value is upper-cased. Compare `Code` against a `Code` variable or an upper-case literal, never a mixed-case `Text` literal.

## Confirming RED fails for the right reason

A failing test is useful RED only if it fails BECAUSE the production behavior does not exist yet.

- **Genuine RED:** a compile error naming the not-yet-created field/procedure/object from the design, or a runtime assertion mismatch directly about the behavior under test.
- **False RED (fix it in RED, never carry it into GREEN):** missing setup/config singleton required by an unrelated pre-existing subscriber, unhandled UI popup (`Message`/`Confirm`/`StrMenu`), permission error, reservation/business-validation error from unrelated standard logic, wrong/incomplete test-data helper.
- **Mental check per failing test:** "If I implement ONLY the designed production change, would this exact failure disappear?" Yes → genuine RED. No → false RED; fix the test setup/helper first (reusing existing app conventions), then re-run.
- In the log, state for each test the exact failure and why it is the RIGHT reason (e.g. "compile error: field 'X' does not exist yet", or "assertion mismatch on the behavior under test, all preconditions verified present").
- Test companies commonly carry pre-existing subscribers requiring a setup singleton/default No. Series/master data, and standard flows with side effects (auto-reservation, confirmation dialogs). Reuse a sibling test's setup pattern instead of discovering the gap one user test run at a time.

## Claims need assertions

Never write "empirically confirmed" for a behavioral property unless a test assertion checks that exact property. Passing unrelated tests are not evidence (e.g. "the standard No. Series is unaffected" needs a test that reads and asserts that series' own counter). If you cannot write that test yet, say the claim is unverified.
