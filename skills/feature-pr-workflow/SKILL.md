---
name: feature-pr-workflow
description: 'Automates feature branch creation, commit under the correct git identity, push, and Azure DevOps PR creation (with configurable target branch and auto-complete). Use when: committing work, creating PR, shipping feature, linking user stories, automating git workflow.'
argument-hint: 'Optional: PR title or user story number'
---

# Feature Branch & PR Workflow

Automates the complete workflow from feature branch creation to Azure DevOps pull request with auto-complete and work item linking.

## When to Use

- User wants to commit and create a PR
- User says "commit", "PR", "ship it", "merge to main"
- User mentions linking user stories or work items
- User wants to automate the branch → commit → PR flow

## Workflow Steps

### 1. Check Current Branch

```powershell
git branch --show-current
```

- If on `main` or `master`: Proceed to create feature branch
- If already on a feature branch: Ask user if they want to continue with current branch or switch

### 2. Check Git Identity

Commits must be authored under the actual user's name, not a shared/generic alias (e.g. "BiBO Developer").

```powershell
git config user.name
git config user.email
```

- If the name looks like a generic/shared alias (e.g. matches the machine's default account name, or is a placeholder like "BiBO Developer"), ask the user for their real name and email using `vscode_askQuestions`.
- Set it **locally for this repository only** (do not overwrite global config unless the user explicitly asks):
  ```powershell
  git config user.name "<Real Name>"
  git config user.email "<real.email@domain>"
  ```
- If the configured identity already looks like a real person's name, skip this step.

### 3. Create Feature Branch (if needed)

Ask the user for a branch name using `vscode_askQuestions`:
- Suggest pattern: `Feature/<ShortName>` (e.g., `Feature/AddApiLogging`)
- Create and checkout - **always from the default branch (`master`/`main`) as base, never from a release branch and never from the current branch**; the PR target chosen later (step 7) may be a release branch without changing the base:
  ```powershell
  git fetch origin
  git checkout -b <branch-name> origin/<default-branch>
  ```

### 4. Stage Files for Commit

Show current git status:
```powershell
git status --short
```

Ask user which files to EXCLUDE from commit (if any) using `vscode_askQuestions`:
- Present common exclusions as options:
  - `*.app` files
  - `BCQuality*` files
  - `.alpackages/`
  - Custom patterns (allow freeform input)

Stage files:
```powershell
# If no exclusions:
git add .

# If exclusions exist, stage everything then unstage exclusions:
git add .
git reset <excluded-pattern>
```

### 5. Commit Changes

Ask user for commit message using `vscode_askQuestions`:
- Suggest structured format:
  ```
  <Summary line>
  
  - <Detail 1>
  - <Detail 2>
  
  Related: US <number>
  ```

Commit:
```powershell
git commit -m "<message>"
```

### 6. Push Branch

```powershell
git push -u origin <branch-name>
```

### 7. Ask for Target Branch

Ask the user which branch the PR should target, using `vscode_askQuestions`:
- Options: `main`/`master` (the repo's default branch) and `release/*` or other active branches (e.g. list branches via `git branch -r` if helpful)
- Store the answer as `<target-branch>` — it drives whether the source branch gets deleted (see step 9)
- The target does NOT change the branch's base: the branch stays based on `master`/`main` even when the target is a release branch. If the branch was started from the release branch by mistake, do not push it - repair it first (see skill `al-delivery-deliver`, section "Base vs. target").

### 8. Create Azure DevOps Pull Request

Use `mcp_azuredevops_m_repo_pull_request_write` with `action: create`:

Required parameters:
- `project`: Extract from workspace (usually "BiBO" for this workspace)
- `repository`: Extract from git remote or app.json
- `sourceRefName`: `refs/heads/<branch-name>`
- `targetRefName`: `refs/heads/<target-branch>` (from step 7)
- `title`: Use commit summary or ask user
- `description`: Include "Closes US <number>" if work items provided

### 9. Set Auto-Complete

**⚠️ Known Issue**: The Azure DevOps MCP tool may not support setting auto-complete directly.

**Attempt to set auto-complete:**
Use `mcp_azuredevops_m_repo_pull_request_write` with `action: update`:

Parameters (all at top level, not nested):
- `project`: Project name
- `repositoryId`: Repository name or ID
- `pullRequestId`: From previous create response
- `title`: Original PR title (required for update, even if unchanged)
- `mergeStrategy`: "Squash"
- `deleteSourceBranch`: **only `true` if `<target-branch>` (step 7) is `main` or `master`**. If the target is any other branch (e.g. a release branch or another feature branch), set `deleteSourceBranch: false` so the development branch is preserved.
- `transitionWorkItems`: true

**Verify auto-complete was set:**
After the update call, use `mcp_azuredevops_m_repo_pull_request` with `action: get` to retrieve the PR details.
- Check if the response contains `completionOptions` or `autoCompleteSetBy` fields
- If these fields are missing or null, auto-complete was NOT set

**Fallback - Manual Instructions:**
If auto-complete is not set automatically, provide clear instructions:
```
⚠️ Auto-Complete konnte nicht automatisch gesetzt werden.

Bitte manuell im PR setzen:
1. Öffne: <PR-URL>
2. Klicke "Set auto-complete"
3. Wähle: Merge strategy "Squash" + "Delete source branch" (nur wenn Zielbranch main/master ist, sonst Haken NICHT setzen)
```

### 10. Link Work Items

Ask user for work item numbers using `vscode_askQuestions`:
- Format: "US 52342" or "52342" or comma-separated "52342, 52343"
- Allow empty (skip if no work items)

For each work item, use `mcp_azuredevops_m_wit_work_item_link_write`:
- Link type: "Related"
- Source: Work item ID
- Target: PR artifact URL

### 11. Report Success

Provide user with:
- **PR URL**: Construct from response: `https://dev.azure.com/<organization>/<project>/_git/<repository>/pullrequest/<pullRequestId>`
  - Extract organization from git remote URL or use known value (e.g., "biteam")
  - Use project, repository, and pullRequestId from create response
- **Linked work items**: List work item IDs that were linked
- **Auto-complete status**: 
  - ✅ If `completionOptions` exists in PR response: "Auto-Complete aktiviert (Squash + Branch löschen)" wenn Zielbranch main/master war, sonst "Auto-Complete aktiviert (Squash, Branch bleibt erhalten)"
  - ⚠️ If `completionOptions` is missing/null: "Auto-Complete konnte nicht automatisch gesetzt werden - bitte manuell setzen"
- **Next steps**: 
  - If auto-complete is set: "Warte auf Build und Reviewer"
  - If auto-complete failed: "Öffne den PR und setze Auto-Complete manuell"

**Example output (success, target = main):**
```
✅ Pull Request erfolgreich erstellt!

PR #26157: https://dev.azure.com/biteam/BiBO/_git/UpdateService/pullrequest/26157
- Ziel-Branch: main
- User Story: US 52342 verlinkt
- Auto-Complete: ✅ Aktiviert (Squash + Branch löschen)

Nächste Schritte: Warte auf Build und Reviewer
```

**Example output (success, target ≠ main/master):**
```
✅ Pull Request erfolgreich erstellt!

PR #26161: https://dev.azure.com/biteam/BiBO/_git/UpdateService/pullrequest/26161
- Ziel-Branch: release/24.0
- User Story: US 52342 verlinkt
- Auto-Complete: ✅ Aktiviert (Squash, Branch bleibt erhalten)

Nächste Schritte: Warte auf Build und Reviewer
```

**Example output (auto-complete failed):**
```
✅ Pull Request erfolgreich erstellt!

PR #26157: https://dev.azure.com/biteam/BiBO/_git/UpdateService/pullrequest/26157
- User Story: US 52342 verlinkt
- Auto-Complete: ⚠️ Konnte nicht automatisch gesetzt werden

Bitte manuell im PR setzen:
1. Öffne den Link oben
2. Klicke "Set auto-complete"
3. Wähle: Merge strategy "Squash" + "Delete source branch"
```

## Error Handling

- **Uncommitted changes on main**: Guide user through workflow
- **Merge conflicts**: Tell user to resolve manually
- **PR creation fails**: Check Azure DevOps permissions
- **Work item not found**: Verify work item ID and project

## Tools Required

- `run_in_terminal` (PowerShell, mode: sync)
- `vscode_askQuestions`
- `mcp_azuredevops_m_repo_pull_request_write`
- `mcp_azuredevops_m_wit_work_item_link_write`
- `grep_search` or `read_file` (to extract project/repo info)

## Example Invocation

```
User: "Commit alles und erstelle einen PR für US 52342"