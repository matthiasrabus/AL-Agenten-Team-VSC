---
name: al-delivery-deliver
description: 'Details for the final delivery of an AL feature: verify the exact remote target branch, squash all phase commits into one, handle a diverged base with a worktree, multi-repo features (one PR per repo), push, create the Azure DevOps PR via MCP, verify auto-complete, and write the delivery log. Use when: AL Delivery runs in deliver mode, squashing commits before a PR, target branch name or case is unclear, feature spans several repos, setting auto-complete.'
---

# AL Delivery — `deliver` mode details

Complements the `feature-pr-workflow` skill (branch naming, git identity, PR creation).

## Prerequisites
Build is green and analyzer warnings resolved (check `04-implementation-log.md`, re-run diagnostics if needed); translations in sync (`*.<target>.xlf` units `state="translated"`); a work-item/user-story number is available (ask if missing). If build/tests are not green, stop and hand back to the TDD Implementer.

## Verify the target branch BEFORE squashing (Bug 52511)
Run `git fetch`, then `git ls-remote --heads origin '<target>*'`. Branch names are case-sensitive on the remote (user said `release/test`, real branch `release/Test`; another repo had no release branch, target was `main`). Then compare `git log <branch-base>..origin/<target>`.

- **Target contains commits the feature branch never had:** the merge-base squash would pull foreign commits into the PR. Do NOT reset to a merge-base. Create a NEW branch from `origin/<target>` (e.g. `<feature-branch>-<target-slug>`), apply the feature's full diff as ONE commit (`git diff <branch-base>..HEAD` of our paths, or `merge --squash`), stop and report on conflicts, leave the original branch untouched and recoverable. Use a temporary `git worktree` when the user's working tree holds unrelated WIP; remove it afterwards. Sanity-check `git diff --stat origin/<target>...` shows only this feature's files.
- **Normal case:** squash as below.

## Squash all feature-branch commits into ONE before pushing
Per-phase commits exist only for traceability during development; only ONE final commit reaches the remote/PR.
1. Working tree clean, on the feature branch.
2. `git merge-base HEAD <target-branch>`.
3. `git reset --soft <merge-base>` (changes stay staged).
4. ONE new commit with a comprehensive conventional message (e.g. `feat(US <n>): <feature title>`) and a body listing key phases/highlights (design decision, what was implemented, notable fixes) — do not reuse the first phase commit's message.
5. Sanity-check nothing was lost: compare file lists/line counts of the squashed diff against `04-implementation-log.md`'s object inventory.
Only squash in `deliver` mode, never mid-development. If genuine merge commits from the target are mixed into the feature branch, stop and ask instead of flattening silently.

## Multi-repo features
Run `deliver` once per repo with its own target branch, one PR per repo. State merge order and dependency (dependency app first; the dependency version in the dependent app's `app.json` is raised at release, not in the feature) in each PR description. The dossier lives in one repo — dossier commits go there only; record the other repo's hashes/PR in the delivery log. A PR number cannot be written into the commit that creates it; if the user wants PR numbers in the dossier, that is one additional normal-push commit — offer it, do not do it unasked.

## Push and pull request
- `git push -u origin <feature-branch>` (first push; plain push is safe since `commit` mode never pushed intermediate history). Never `--no-verify`, never force-push published branches.
- Create the PR from feature branch to target, link the work item, set auto-complete — with the **azure-devops MCP** only (load via `tool_search` if deferred), never the `az` CLI. Reference the dossier in the PR description and link the MD artifacts.
- **Verify auto-complete by reading the PR back** (the update response must contain `completionOptions`/`autoCompleteSetBy`) before writing "on". If missing, record "requested — NOT confirmed, set manually in the PR" and tell the user. Write unconfirmed items as "to verify".

## Delivery log
Append a `deliver` entry to the dossier's delivery log (PR URL or "see Azure DevOps", work item link, auto-complete status, target branch) and update `00-overview.md`. Do NOT record hashes of pre-squash commits or placeholders like "see git log" — those commits no longer exist; refer to the PR by branch name.
