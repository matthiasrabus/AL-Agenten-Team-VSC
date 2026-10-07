---
name: al-test-debugging-playbook
description: 'Playbook for AL test failures that are not obvious: stuck on a hard bug, regressions, known-complex Business Central subsystems (Fixed Asset disposal, VAT/General Posting Setup), research before trial-and-error, round budget and proportionality checkpoint for repeated user test runs. Use when: a test keeps failing after one or two fixes, chasing a regression, a test scenario needs many setup prerequisites, deciding whether to descope a test.'
---

# AL test debugging playbook

## Stuck on a non-obvious failure
Do not guess repeatedly. If the bundled `bc-al-bug-fix` skill is installed (`~/.copilot/skills/bc-al-bug-fix/SKILL.md`), check its symptom→root-cause mapping first (FlowFields, SetLoadFields truncation, event subscriber ordering, trigger gaps, permission errors, posting validation) before writing the fix.

## Research before trial-and-error on a known-complex subsystem
Some standard flows have a long documented prerequisite chain, e.g. posting a Fixed Asset disposal via a sales line (Depreciation Book → FA Posting Group on the FA → FA Posting Group on the FA Depreciation Book link → G/L Integration flags → Acquisition Cost already posted), or VAT/General Posting Setup combinations for a new G/L Account/Item/Resource. If your test data touches such an area and you cannot name the FULL chain up front, do ONE research pass BEFORE the first live test: `tool_search` for `microsoft_docs_search`/`microsoft_docs_fetch`, or grep this codebase for a working example of the same document flow. Real evidence from a live run still drives the fix (never fabricate the chain from memory), but front-load the research so you can propose 2–3 setup steps at once instead of one. Each round costs a full user test-execution cycle, not just your tool calls.

## Round budget / proportionality
If a SINGLE test scenario needed 3 or more consecutive real-test-run-driven fix rounds without reaching green, stop and flag a proportionality decision in your report (implementer → orchestrator; orchestrator → user). State: how many rounds, what was tried, whether design/test-plan already marked the scenario lower-priority ("ideally"/"if feasible"), and whether descoping it (documented, with rationale, rest of the suite green) is reasonable. Do not silently attempt a 4th, 5th, 6th fix. The orchestrator/user decides.

## Regressions ("the bug is still there")
- Do not re-run the same design→implement cycle blind. First gather LIVE evidence: real error logs, audit/log tables (e.g. API request/response log), a captured payload.
- A narrow, well-evidenced bugfix MAY skip Requirements/Design/Test-Plan and go to the TDD Implementer with the evidence in its prompt, if the skipped phases and the evidence are recorded in the `00-overview.md` gate log. Quality Review and Delivery gates still apply in full.
- Reuse the existing dossier folder unless the bug is clearly unrelated.
