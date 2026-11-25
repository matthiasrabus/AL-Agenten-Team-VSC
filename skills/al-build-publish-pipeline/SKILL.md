---
name: al-build-publish-pipeline
description: 'Build, publish and test-run mechanics for Business Central AL projects: al_build vs get_errors, analyzer warnings, AL Tool / alc.exe fallbacks, multi-repo folders outside the workspace, publish order, sandbox unreachable (401/503), recreated serverInstance, BC < 28 without agent-side runTests, git side effects after builds. Use when: building or publishing AL apps, running AL tests, al_build fails (PACKAGE_CREATION_FAILED), al_publish fails, sandbox down, handing test execution to the user.'
---

# AL build, publish and test pipeline

Used by the AL TDD Implementer in modes `green` and `refactor`.

## Build and analyzers

- Build with `al_build` (`scope=all` for cross-project changes, `scope=current` for one project); inspect with `al_getdiagnostics`. `al_build` (the real compiler) is authoritative for analyzer warnings. `get_errors` (language server) does NOT reliably surface CodeCop warnings — never claim "0 warnings" based on it alone.
- Resolve ALL warnings of the analyzers configured in the workspace (`al.codeAnalyzers` / `al.ruleSetPath`, typically CodeCop, UICop, PerTenantExtensionCop, LinterCop). Document unavoidable suppressions with `#pragma warning disable <id>` plus a one-line reason.
- A freshly created file reporting "object is missing" despite being valid is a stale language-server index — re-save via an edit to trigger reindex, then rebuild.
- When `al_build` fails with `PACKAGE_CREATION_FAILED` or its `success` is not trustworthy, fall back to the AL Tool (`al workspace compile`, with `--analyzers` for the configured cops; `alc.exe` as documented in repo memory (`testing.md`) only if the AL Tool is not installed), run the analyzers on the touched files, and say in the log which tool produced the build evidence.
- **Check `git status` after EVERY build/translation run and revert unrelated side effects.** Known: building an app that embeds layouts rewrites binary files (e.g. a `*.docx` report layout) — `git checkout -- <file>`; the AL Translation Center tool can rewrite unrelated language files (`<note/>` → `<note></note>` in other-language xlf) and drop units — revert those and keep only your lines (the target-language xlf diff must be exactly your new units).
- **Multi-repo / non-workspace folders:** `al_build` and Object Ninja only accept folders open in the workspace. For a second app in another repo use the AL Tool (`al workspace compile` over the involved project folders resolves the dependency order itself; `alc.exe` with that project's `.alpackages` only if the AL Tool is missing). Copy the freshly built dependency `.app` over the old package of the same app id there — an old symbol package gives bogus AL0280/AL0185 errors. Say in the log that IDs were next-free from the app's range and NOT reserved via Ninja; ask the orchestrator to have the user open the folder if reservation matters.
- To verify a standard/dependency object's real shape use `al_downloadsymbols` then `al_symbolsearch`/`al_symbolrelations`; never decompile a dependency `.app` through a terminal.

## Publish and test

- Order: `al_build` app, `al_build` test, `al_publish` app, `al_publish` test, then run the tests from the terminal with `al runtests` (section below). **Do NOT call the `runTests` tool**: on-prem `UserPassword` targets it hung for up to an hour right after a successful publish while the server was idle, and a hung tool call cannot be cancelled by the agent. On a cosmo-alpaca SaaS sandbox `al_publish` works with cached credentials.
- **Republish the APP before the TEST app after ANY app-object change** — the test build resolves the app dependency symbol from the server; a stale server app yields `AL0185 "Codeunit X is missing"`.
- **Self-service publish→test is only reliably available on BC 28+.** On BC < 28 workspaces agent-side `runTests` has been unavailable in practice (check `app.json` "application"/"platform" and repo memory first). Then hand test execution to the user: ask them to run the AL Test Tool in VS Code and paste back the pass/fail table plus error/call-stack, and say so explicitly instead of silently retrying a broken pipeline. In every RED/GREEN hand-over state per test: expected PASS/FAIL with the exact assertion, which container, which runner, publish order (dependency first, test app last).
- No reachable container at all (connection refused, unknown host, no launch.json target) is a provisioning gap, not a BC-version limit: ask the orchestrator to run **AL Container Provisioner** (you cannot invoke it).
- If a publish needs interactive auth you cannot supply, stop and hand only that step to the user.
- **Sandbox unreachable (HTTP 503/connection errors):** do NOT poll or retry in a loop and do NOT fabricate a test result — report the exact status/error and stop until the user or orchestrator confirms it is back.
- **A recreated sandbox often gets a new `serverInstance` name** (host usually stays). Before any retry after "recreated"/"try again", re-read `.vscode/launch.json`; if the instance changed, say so.
- Diagnosing usability: **401** on an endpoint (e.g. `/dev/packages`) means the BC service is up and wants credentials — attempt `al_publish`; **503** on the server root means it is not serving yet, whatever a single sub-path returned. Name exactly which endpoints you checked and what each returned.
- Sessions/runners: a test that starts a session cannot run under the Test Tool's default runner `Test Runner - Isol. Codeunit`; see skill `al-test-conventions`.
- If `al runtests` cannot run (no credential file, `UserNotAuthenticatedException`, server unreachable), do not keep retrying; hand test execution to the user once (AL Test Tool) and say why.

## Running tests from the terminal (`al runtests`)

`al runtests` (AL Tool, same `launch.json` connection settings as VS Code via `--project <test-app-folder>`) fails fast instead of prompting, so it never blocks. For `UserPassword` targets the credentials come from environment variables that are filled from a DPAPI-protected credential file which the USER creates once in their own terminal (`Get-Credential | Export-Clixml "$env:USERPROFILE\.bc-test-cred.xml"`). The agent never sees, asks for, prints or logs the password.

```powershell
$c = Import-Clixml "$env:USERPROFILE\.bc-test-cred.xml"; $env:BC_SERVER_USERNAME = $c.UserName; $env:BC_SERVER_PASSWORD = $c.GetNetworkCredential().Password
try { al runtests <codeunitId> --project <test-app-folder> [--testmethods <m1> <m2>] } finally { Remove-Item Env:BC_SERVER_USERNAME, Env:BC_SERVER_PASSWORD -ErrorAction SilentlyContinue }
```

- Several codeunits in one connection: `--testgroups <file.json>` (`[{"codeunitId": 5000002, "testMethods": []}]`). Default output is structured JSON with per-method results; `--raw` prints the server log and a text summary.
- ALWAYS run it via the terminal tool with a `timeout` (about 180000 ms). If it times out or needs input, STOP and report the exact command and message; do not poll or re-run in a loop.
- No credential file (`Test-Path "$env:USERPROFILE\.bc-test-cred.xml"` is false) → do not try other ways to authenticate; hand test execution to the user (AL Test Tool) and tell them how to create the file.
- Tests that pass here must also be treated as the same evidence as an AL Test Tool run; paste the per-method result lines.

## Evidence rule

NEVER report GREEN without evidence: paste the actual `al_build` summary and the verbatim per-method pass/fail results from `al runtests` (or the user's AL Test Tool table). Do not claim a build/test passed that you did not run.
