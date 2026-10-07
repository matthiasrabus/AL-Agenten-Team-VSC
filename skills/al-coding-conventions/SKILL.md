---
name: al-coding-conventions
description: 'Coding conventions for Business Central AL production code: CRS naming and file names, object ID reservation, translations (Comment DEU=...), AL Translation Center, page property DRYness, permission sets, and idiomatic AL patterns (interfaces, blobs, Get guard, SIFT keys, JSON, vendor API schema verification). Use when: writing or refactoring AL objects, adding captions/tooltips/labels, creating pages, naming objects, registering permissions, GREEN/REFACTOR implementation.'
---

# AL coding conventions

Used by the AL TDD Implementer (modes `green`, `refactor`) and as a reference for the Documentation Writer.

## Object IDs — always via AL Object Ninja
- Reserve the ID of EVERY new object (table, page, codeunit, enum, interface, report, query, permissionset, ...) with `ninjaNextId`. Never hardcode or guess. If Ninja is unavailable, STOP and flag it (or, when the orchestrator accepts it, take the next free ID within `idRanges` from `app.json` and log that it was not reserved).
- No ID reservation for control add-ins, interfaces' numeric IDs, table fields or enum values.
- Release the ID of a deleted new object with `ninjaUnassignId`.

## Naming and files
- Prefix/suffix and file pattern come from the workspace's CRS settings (`CRS.ObjectNamePrefix`, `CRS.ObjectNameSuffix`, `CRS.FileNamePattern`, `CRS.AlSubFolderName`) in the `.code-workspace` or `.vscode/settings.json`. Apply the affixes to every object name; never assume a prefix.
- Object names ≤ 30 characters. File names follow `CRS.FileNamePattern` (commonly `<ObjectNameShort>.<ObjectTypeShortPascalCase>.al`; with `CRS.RemovePrefixFromFilename`/`RemoveSuffixFromFilename` the affix is stripped). Files go under the feature folder in `CRS.AlSubFolderName` (typically `src/`). One object per file.

## Translations — non-negotiable
- Every user-facing `Caption`, `ToolTip` and enum value caption MUST carry a developer note for the project's target language: `Comment = 'DEU="..."'` (correct language code). Prefer real enums over inline `OptionCaption`.
- After changing captions/labels run the AL Translation Center: `al_translation_center_validate` (fix malformed `Comment` in the `.al` source, never in the `.g.xlf`), then `al_translation_center_translate`. Confirm new units land as `state="translated"` in `*.<target>.xlf`. Never hand-edit `*.g.xlf`.
- Mark internal, non-user-facing labels `Locked = true`.
- Check `git status` after translation runs (see skill `al-build-publish-pipeline`).

## Page property DRYness
- Set `ApplicationArea` ONCE at page level; re-declare it on a control only if it must differ.
- Do not repeat a field's `Caption`/`ToolTip` on a page control when the table field already defines the identical one. Only set them on the control when the wording must differ, and add only page-specific properties (`Visible`, `Editable`, `Style`) the table field cannot express.

## Permissions
Register every new object in the app's permission set(s): find the existing `*.PermissionSet.al` and add tabledata/table/codeunit/page/enum entries as applicable.

## AL patterns to prefer
- Decouple via `interface` objects with dispatch by codeunit ID; mock implementations for tests.
- Large payloads in `Blob` fields with `Get*/Set*` text helpers; skip `CalcFields` on temporary records (it wipes the in-buffer blob).
- **`Record.Get(...)` guard:** `if not Rec.Get(...) then Error(...)` suppresses the platform's own error. When a generic "does not exist" failure is an acceptable dead end, call `Rec.Get(...)` bare so the platform raises its standard error including the key values (no custom `Error()`/Label to translate). Wrap in `if not ... then Error(...)` only when the custom message adds value (remediation hint, different severity) or you must branch/continue.
- SIFT keys belong on a secondary key, never the primary (AA0222).
- Build JSON with `JsonObject`/`JsonArray`/`JsonToken`, not string concatenation.
- Contextual pages get `UsageCategory = None`; mark promoted-only actions correctly.
- AL does NOT short-circuit `and`/`or`: nest `if`s so cheap conditions gate DB-accessing calls.
- **Never blind-trust a vendor API's documented JSON schema.** Before finalizing a field-name mapping for a third-party HTTP API, verify names against a REAL captured response (the app's own request/response audit table, or a live sample from the user). `GetText(key, true)` on a wrong key fails silently with an empty string — this already caused a production bug.

## Bundled scaffold skills
If `02-design.md` names a bundled skill for an object/pattern (`bc-job-queue`, `bc-setup-table-generator`, `bc-api-page-generator`, `bc-approval-workflow-generator`, `bc-isolated-storage-generator`, `bc-attachments-generator`, `bc-business-events-generator`, `bc-report-selection-generator`, `bc-telemetry-generator`, `bc-install-codeunit-generator`, `bc-upgrade-codeunit-generator`, `bc-field-propagation`, `bc-number-series-generator`, `bc-api-query-generator`, `bc-cds-page-generator`, `bc-pricing-refactor`, `bc-reports`), read its `SKILL.md` (workspace `.github/skills/<name>/` or user-level `~/.copilot/skills/<name>/`) before writing that object and follow its scaffold. For test codeunits also check `bc-test-codeunit-generator` for handler/Library-Assert conventions.
