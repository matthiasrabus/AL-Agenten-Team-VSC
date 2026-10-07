---
name: al-feature-addendum
description: 'Orchestrator procedures for follow-up changes to an already-delivered AL feature: reusing the dossier with Addendum phases, branch reuse/restore decision, and the proportionality checkpoint for repeated test-fix rounds (test-suite size, container availability, manual checks at delivery, gate-log style, tool-availability retry cap). Use when: user extends a feature whose PR is already merged, addendum, follow-up change on an existing dossier, repeated failing test rounds, deciding whether to descope a test.'
---

# Follow-up/addendum requests and proportionality (Orchestrator)

## Addendum to an already-delivered feature
Applies when the dossier already has a completed `07-delivery.md` entry (PR merged/completed).
- Reuse the SAME dossier folder and append clearly labeled Addendum sub-phases (`1b`/`2b`/..., `## Addendum (<date>): <title>` in each artifact). Do not start a new dossier.
- **The branch decision is NOT a safe autonomous default.** Before invoking AL Delivery in `branch` mode, check (or have it check) whether the ORIGINAL feature branch still exists or was restored by the user. Do not let an automated "work autonomously" gate response create a new, differently named branch for what is a continuation (this happened in US 54088 and needed manual correction after the user said "STOP"). If in doubt, ask explicitly.
- Treat the addendum as a fresh mini-pipeline with its own gates; do not assume the original design's open questions still apply. New fields/conditions need their own AS-IS verification (`al_downloadsymbols`/`al_symbolsearch`).

## Proportionality checkpoint for repeated test-fix rounds
Real-test-run-driven debugging (implementer fixes → commit → user runs the AL Test Tool → reports next error) costs a full user round trip per round. Apply proactively:
- If the SAME scenario needed 3+ consecutive rounds without green, treat it as a proportionality decision. Check whether `02-design.md`/`03-test-plan.md` flagged it as lower-priority ("ideally", "if feasible") on top of a requirement already proven separately; if so, offer to descope it (documented, with rationale). See also skill `al-test-debugging-playbook`.
- At Intake or before the Implementation gate, ask (or check repo memory) whether a live, reachable BC container/test environment exists. If not, say GREEN will mean "compile-verified" until the user runs the AL Test Tool; this decides whether to batch several likely fixes into one implementer round or debug one issue at a time.
- **Test-suite size check at the Test-Plan gate:** compare planned test count with production touchpoints and flag a disproportionate suite (e.g. 37 tests for ~6 small guard changes in US 54428, 3–4 of 6 test runs avoidable) with a recommendation to trim to representatives and manual checks.
- **Delivery gate:** list outstanding manual checks and deployment prerequisites explicitly (a demoted report test, a data upgrade that only runs on a version change) so the user's "go" is informed.
- Keep gate-log entries factual and short (3–5 sentences or bullets); detail belongs in the phase artifact.
- **Tool-availability retry cap:** if the TDD Implementer reports a tool (e.g. `runTests`) confirmed unavailable (directly and via `tool_search`), do not re-invoke it a third time hoping availability changed. On the second confirmation ask the user to run the step manually (AL Test Tool). Suggest a VS Code "Reload Window" once.
