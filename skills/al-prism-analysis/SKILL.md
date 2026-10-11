---
name: al-prism-analysis
description: "How AL agents use the Prism for AL MCP server (whole-solution code graph) instead of grep: who references / writes to / calls X, which user actions reach a procedure, can it reach a Commit, which event publishers are reachable, base-app source lookup. Use when: AS-IS analysis, event/extension-point design, finding subscribers on a table, Commit/side-effect review, reading standard BC source. Includes tool-per-question table, call rules, license and fallback behavior."
---

# Prism for AL (MCP) — graph analysis for AL agents

Prism indexes the whole solution (workspace apps plus dependency packages, including Base Application source) and answers structural questions deterministically. Text search misses usages through `Rec`, record variables, `with` blocks, extensions, events and interfaces, and matches same-named members of other objects. It is **read-only**; it does not build, publish or test (use the `al_*` tools for that).

## Availability — never a hard dependency
- Tools come from the VS Code extension `statical.prism-al` (server label "Prism for AL"). They may be deferred: load them with one `tool_search` (query `Prism for AL find_symbols`).
- The server needs a **named-user license**. If a call fails with a license/feature error or the tools do not exist in this session, say so once in the dossier artifact ("Prism unavailable: <reason>") and fall back to `search`/`al_symbolsearch`/`al_symbolrelations`. Never block the pipeline on Prism and never present a text-search result as graph-complete.
- First call: `list_modules`. Confirm the apps you expect are present (e.g. both the `app` and the `test` app in a multi-root workspace). If one is missing, treat Prism answers about it as incomplete.

## Call rules
- Every tool takes `{ "request": { ... } }`; flat keys are rejected. Read the tool's inputSchema before the first call and again after a validation failure. Pattern parameters are RE2 regexes (case-insensitive, unanchored); `find_symbols` requires `queryRegex`.
- Use enum values only as listed in the tool description or resource `mcp://tools/input-enumerations`; omit a filter instead of guessing.
- Never build or edit a Prism Path. Take `prismPathUri` from `find_symbols`, `location_to_prism_path`, `node_ids_to_prism_paths` or a `find_*` tool with `includePrismPaths=true` and pass it verbatim. NodeIds are valid only until the next `reload_workspace`.
- After editing AL files call `reload_workspace` before trusting the graph again.
- Failures carry a `code`. `workspace_reloading` / `graph_service_loading` (permanent=false): wait `retryAfterSeconds` and retry, do not fall back to grep. `permanent=true`: change the call.
- Guides ship as resources: `mcp://tools/guide/workflows` (read before multi-step analysis), `mcp://tools/guide/{section}`, `mcp://vocabulary`.

## Which tool answers which question
| Question | Tool |
|---|---|
| Find an object/member by name (all modules incl. packages) | `find_symbols` |
| Where is this field/procedure/enum value/event used, and how (assign, transfer, parameter) | `find_references` |
| Who inserts/modifies/deletes/reads table X (RIMD), transitively | `find_rimd`, `find_reachability_set` |
| Can this procedure reach a `Commit`; via which path | `find_commits`, `find_shortest_path` |
| Which page actions/reports lead to this procedure | `find_user_actions` |
| What does this call / who calls this, transitively (incl. events, interfaces) | `find_flows` |
| Which event publishers are reachable from here; where is an event raised and subscribed | `find_event_publishers` |
| Object with all its extensions merged; list of extensions | `search_object_outline`, `find_extensions` |
| Read source of a workspace or base-app object/procedure | `object_to_source`, `get_source_code` |
| Dependencies between objects, modules, namespaces | `find_object_dependencies`, `get_module_graph`, `find_namespace_dependencies` |

Prefer one graph question (`find_reachability_set`, `find_rimd`) over many grep rounds; the server filters and returns only the answer.

## Per role
- **Requirements Analyst** — AS-IS: `find_references` / `find_user_actions` / `find_extensions` for every object the requirement touches; cite the returned objects, not guessed files.
- **Solution Architect** — before fixing an extension point: `find_event_publishers` / `find_flows` to see what the standard flow raises and which subscribers (all apps) already exist; `find_commits` for Commit/transaction boundaries; `object_to_source` to verify the exact signature of a standard event or procedure (a compile of a scratch file stays the final oracle for the exact signature).
- **TDD Implementer** — mode `red`: `find_references` on every table the tests insert into, to find subscribers in ALL apps that can cause a false RED (Setup singletons, workflow events). After AL edits in `green`/`refactor`, `reload_workspace` before further graph queries.
- **Quality Reviewer** — for changed procedures: `find_commits` (new Commit reach), `find_rimd` (unexpected table writes), `find_references` on changed signatures/fields to trace callers (cross-scope dedup-key and shared-resource checks in `al-design-heuristics`). Label these findings `Prism`.

## Reporting
Name the tool and the key parameters for each claim that rests on Prism, and include the `prismPathUri` for flow/commit/user-action results so the human can open the same node in Prism. State when a result is partial (module missing from `list_modules`, tool unavailable, fallback used).
