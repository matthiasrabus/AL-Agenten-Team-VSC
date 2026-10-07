---
name: al-design-heuristics
description: 'Design and review heuristics for Business Central AL that tools do not catch: verifying standard/dependency object shapes (symbols, compile-oracle), vendor API schemas, redirecting an input instead of overwriting a computed output (No. Series gaps), cross-scope key collision in dedup collections, no short-circuit in AL, event contracts between apps, late override of shared resources. Use when: designing an AL solution, writing 02-design.md, reviewing an AL diff for must-fix issues, extending standard events, building batch procedures with Dictionary/List state, overriding No. Series or counters.'
---

# AL design and review heuristics

Used by the AL Solution Architect (design time) and the AL Quality Reviewer (review time).

## Verify standard/dependency object shapes — do not just flag risk
When a decision depends on the exact signature/existence of a standard or dependency event/procedure/field, confirm it yourself: `al_downloadsymbols` (refresh), then `al_symbolsearch`/`al_symbolrelations`. If inconclusive, use the compile-oracle: write a tiny scratch codeunit referencing the candidate field/event/signature and compile with `al_build`/`al_getdiagnostics` (or `al workspace compile <folder>` via terminal; `alc.exe` only if the AL Tool is missing). A clean compile is proof; AL0118/AL0132/AL0280/AL0282 is disproof. Delete the scratch file. Only list something as an unverified open risk if all avenues fail this session. (A design once shipped twice with a non-existent extensibility point, costing the implementer a full RED/GREEN cycle each time.)

## External API contracts
Never assert a vendor doc's example JSON as ground truth for field-name mapping. If the app logs raw request/response payloads (an API Operation/audit table), the design MUST require the implementer to verify field names against a real captured response of that exact endpoint. Without a real sample, list the assumed schema as an explicit open risk.

## Redirect an input instead of overwriting a computed output
When a design must change a value that standard logic computes from shared/sequential state (No. Series number, counter, lock-guarded sequence), look FIRST for a native override-input the base app reads before computing its default (e.g. Sales Header "Posting No."/"Posting No. Series"). Overwriting the output after standard logic consumed the resource usually leaves an invisible side effect (a wasted number in the series' "Last No. Used") even though the final value looks right. If no override-input exists and you must overwrite, name this risk in "Risks & alternatives" and require a test asserting the shared resource's own counter/state is unaffected.

**Review side:** if a diff overrides a value AFTER standard logic already drew it from a shared sequential resource, and the log/PR claims "no side effect"/"empirically confirmed" without a test asserting that counter/state, treat it as **must-fix**: require the test, or a native override-input design.

## Cross-scope key collision in dedup/uniqueness state
If a shared procedure builds in-memory dedup state (`Dictionary`/`List`/`Set` of "already covered/seen" rows) and is — or could become — reachable from BOTH a single-scope entry point (one customer/tenant/environment per page) AND a cross-scope one (cross-customer overview, bulk action over an unrestricted selection), the key MUST be the row's full composite business key (e.g. `Customer No./Tenant ID/Environment Name/App ID`, or `RecordId`), never a field only unique within one scope (global App ID, document No., external entity ID). Name the exact composite key in the design.

**Review side (direct code analysis; BCQuality and AL Performance Analyzer do not flag it):** for any new/changed such collection, trace every caller (including pre-existing cross-customer/bulk pages reusing an older single-scope procedure). A single-field key that is unique only within one scope is a **must-fix**. If every test builds only a single-scope working set, that corroborates the gap was never exercised.

## AL does NOT short-circuit `and`/`or`
Every operand is evaluated. For a condition including a DB-accessing call (`Item.Get`, `FindSet`, `CalcFields`, a wrapper), use NESTED `if`s so cheap conditions gate the expensive one. Never chain it into one `and` expression and never claim "bounded cost" for such a chain (caught only in review once: a per-Quantity-validation `Item.Get` in a hot path).

## Event contracts between apps (checklist)
When another app answers or extends a flow through events, specify: (1) the error boundary per unit of work — `Codeunit.Run` rolls back the subscriber's DB writes, a `TryFunction` does not; say which traps which step and how errors are collected without stopping the batch; (2) which events are ALWAYS raised (an after-event must fire even when units failed); (3) how answers of several subscribers combine (OR for skip/created/waiting flags — a subscriber never overwrites or resets another's answer); (4) where `Commit()` sits and that no HTTP/file-service call happens inside an open write transaction; (5) a `local` event publisher is subscribable from other apps but can only be raised from its own object — an `internal` raise wrapper is needed when a runner codeunit raises it; (6) behavior when only one of the two apps is deployed, deployment order, dependency version handling; (7) cleanup and duplicate-avoidance when several files/records are produced before a later step can fail. If the apps live in different repos or branches differ (`release/Test` vs `main`), say so — delivery changes (one PR per repo, order, dependency).
