# AL Agenten-Team (VS Code)

Agent Plugin für GitHub Copilot in VS Code: ein Team von Agenten, das eine Business-Central-AL-Anforderung von der Analyse bis zum Pull Request führt. Zu jedem Feature entsteht ein schriftliches Dossier (`docs/features/<US>-<slug>/`), nach jeder Phase fragt der Orchestrator nach "go / anpassen / stopp".

## Agenten

| Agent                    | Aufgabe                                                                           | Artefakt                   |
| ------------------------ | --------------------------------------------------------------------------------- | -------------------------- |
| AL Orchestrator          | Einstiegspunkt, steuert Phasen und Gates, hält `00-overview.md`                   | `00-overview.md`           |
| AL Requirements Analyst  | Anforderung schärfen, Ist-Analyse im Code                                         | `01-requirements.md`       |
| AL Solution Architect    | Technisches Design (Objekte, Events, Datenmodell, Übersetzungen)                  | `02-design.md`             |
| AL Test Planner          | Testplan (GIVEN/WHEN/THEN, Seams, Ausführungsvoraussetzungen)                     | `03-test-plan.md`          |
| AL TDD Implementer       | Test-first in drei getrennten Modi `red`, `green`, `refactor`                     | `04-implementation-log.md` |
| AL Documentation Writer  | Anwenderdokumentation, Release Note, Testliste                                    | `05-user-documentation.md` |
| AL Quality Reviewer      | Review mit BCQuality und AL Performance Analyzer                                  | `06-quality-review.md`     |
| AL Delivery              | Branch, Commits, Squash, Push und Azure-DevOps-PR (`branch`, `commit`, `deliver`) | `07-delivery.md`           |
| AL Container Provisioner | BC-Sandbox-Container über COSMO Alpaca prüfen, starten, anlegen                   | -                          |

Ablauf: Requirements, Design, Test Plan, Implementierung (RED, GREEN, optional Refactor), Dokumentation, Quality Review, Delivery. Zwei Gates werden nie übersprungen: vor der Implementierung und vor dem Push/PR.

## Skills

Detailregeln liegen in Skills und werden von den Agenten erst an der passenden Stelle gelesen. Das hält die Agent-Dateien klein. Rollen, Modi, Ausgabe-Templates und die harten Sicherheitsregeln (kein Push im `commit`-Modus, die zwei Gates) bleiben in den Agent-Dateien.

| Skill                        | Inhalt                                                                             | Genutzt von                           |
| ---------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------- |
| `al-test-conventions`        | Testdesign, Testbudget, False-RED-Klassifikation, Handler, Runner, Setup-Pitfalls  | Test Planner, TDD Implementer (`red`) |
| `al-coding-conventions`      | CRS-Namen, Object Ninja, Übersetzungen, Page-DRYness, AL-Patterns                  | TDD Implementer (`green`, `refactor`) |
| `al-build-publish-pipeline`  | Build, Analyzer, Fallbacks, Publish-Reihenfolge, Sandbox-Probleme, BC < 28         | TDD Implementer                       |
| `al-test-debugging-playbook` | Hartnäckige Testfehler, Recherche vor Trial-and-Error, Rundenbudget, Regressionen  | TDD Implementer, Orchestrator         |
| `al-design-heuristics`       | Symbole prüfen, No.-Series-Umleitung, Schlüsselkollision, Event-Contracts          | Solution Architect, Quality Reviewer  |
| `al-feature-addendum`        | Folgeänderung an ausgeliefertem Feature, Branch-Wiederverwendung, Proportionalität | Orchestrator                          |
| `al-delivery-deliver`        | Zielbranch prüfen, Squash, Multi-Repo, PR und Auto-Complete                        | Delivery (`deliver`)                  |
| `feature-pr-workflow`        | Branch-Namen, Git-Identität, PR-Erstellung                                         | Delivery                              |

## Hooks (Preview)

Ein Skript ([scripts/al-hook.cjs](scripts/al-hook.cjs), benötigt Node.js) erzwingt Regeln, die vorher nur als Prompt-Text standen. Zwei Stellen definieren die Hooks:

- **Plugin-weit** in [com.github.copilot/hooks/hooks.json](com.github.copilot/hooks/hooks.json): gilt für alle Agenten und Sitzungen, solange das Plugin aktiv ist.
- **Pro Agent** im Frontmatter (`hooks:`) der Agent-Datei: läuft nur, solange dieser Agent aktiv ist (auch als Unter-Agent).

Die Hooks gelten nur für den lokalen Harness, nicht für Copilot-CLI- oder Cloud-Sitzungen, und brauchen `chat.useHooks` und einen vertrauenswürdigen Workspace.

| Wo                                    | Hook           | Wirkung                                                                                                                                                    |
| ------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hooks.json` (alle)                   | `PreToolUse`   | `git push` fragt immer nach, Force-Push und `--no-verify` werden blockiert, `git add *.app` ebenfalls                                                      |
| `hooks.json` (Unter-Agenten)          | `SubagentStop` | Requirements, Architect, Test Planner, Doc Writer und Quality Reviewer: Artefakt (`01`, `02`, `03`, `05`, `06`) muss existieren und die Pflichtabschnitte enthalten. TDD Implementer: der GREEN-Abschnitt braucht Evidenz, und im geänderten AL-Code darf kein `Assert.IsTrue(true` stehen. Der Agent wird über `agent_type` erkannt |
| AL Delivery                           | `PreToolUse`   | zusätzlich: `az`-CLI blockiert, pauschales `git add` und `reset --hard` fragen nach, keine `.al`-Bearbeitung                                               |
| AL Orchestrator                       | `PreToolUse`   | darf nur `00-overview.md` bearbeiten, kein schreibendes Git                                                                                                |
| AL Quality Reviewer                   | `PreToolUse`   | kein `fix_al_file`/`fix_al_workspace`, nur `06-quality-review.md` bearbeiten                                                                               |
| AL Container Provisioner              | `PreToolUse`   | nur `launch.json` bearbeiten, kein schreibendes Git, kein `docker run`                                                                                     |

Der Stop-Check blockiert pro Beendigung höchstens einmal (`stop_hook_active`). Das Skript läuft bei internen Fehlern ohne Blockade weiter. Entscheidungen stehen in `%TEMP%\al-agent-team-hooks.log`. Mit der Umgebungsvariable `AL_HOOK_DEBUG=1` wird jeder Aufruf protokolliert, so lassen sich echte Tool-Namen und Eingaben prüfen.

## Installation

1. In den VS-Code-Einstellungen `chat.plugins.enabled` aktivieren.
2. Befehlspalette: **Chat: Install Plugin From Source**, Repo-URL `https://github.com/matthiasrabus/AL-Agenten-Team-VSC` eingeben.
   Alternativ lokal klonen und in den Einstellungen eintragen:
   ```jsonc
   "chat.pluginLocations": { "C:\\Pfad\\zu\\AL-Agenten-Team-VSC": true }
   ```
3. Prüfen: Chat, Zahnrad, Plugins. Danach im Agent-Auswahlmenü **AL Orchestrator** wählen.

Wenn dieselben Agenten schon als Benutzer-Agenten unter `%APPDATA%\Code\User\prompts` liegen, erscheinen sie doppelt. Eine der beiden Quellen deaktivieren.

## Benutzung

Dem **AL Orchestrator** die Anforderung oder die Work-Item-Nummer nennen. Er legt das Dossier an, erzeugt den Feature-Branch und ruft die anderen Agenten als Unter-Agenten auf. Jede Phase endet mit einer Zusammenfassung, den offenen Entscheidungen samt Vorschlag und der Frage nach "go / anpassen / stopp".

## Voraussetzungen

Die Agenten nutzen Werkzeuge, die dieses Plugin **nicht** mitbringt:

- **AL Language Extension** (`al_build`, `al_publish`, `al_downloadsymbols`, `al_symbolsearch`, Translation Center)
- **AL Tool** (`al`, NuGet-Paket `Microsoft.Dynamics.BusinessCentral.Development.Tools`, `dotnet tool install --global ...`) als Compile-Fallback außerhalb des Workspaces; `al runtests` und `--errorlogdirectory` gibt es erst ab BC 28
- **AL Object ID Ninja** (Objekt-IDs reservieren)
- **COSMO Alpaca** (Container-Werkzeuge, nur für den Container Provisioner)
- **Azure DevOps MCP** (`microsoft/azure-devops-mcp`) für Work Items und Pull Requests
- **BCQuality** (Agent-Plugin) und der **AL Performance Analyzer** (MCP `al-performance`) für den Quality Reviewer
- Optional: die `bc-*`-Skills der AL Copilot Skills Collection (VS-Code-Erweiterung von Fernando Artigas Alfonso, MIT-Lizenz). Sie sind **nicht** im Plugin enthalten, die Agenten nennen sie nur, wenn sie installiert sind.

## Enthaltene Skills

| Skill                 | Zweck                                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `feature-pr-workflow` | Feature-Branch, Commit unter der korrekten Git-Identität, Push und Azure-DevOps-PR mit wählbarem Zielbranch und Auto-Complete (vom AL Delivery genutzt) |

Das Skill enthält Beispiele mit B.i.Team-Organisation, Projekt und Repo-Namen. Für andere Teams die Standardwerte im Skill anpassen.

## Bekannte Einschränkungen

- **Tests ausführen:** Auf BC unter Version 28 steht `runTests` oft nicht zur Verfügung. Dann führt der Anwender den AL Test Tool selbst aus, und die Agenten liefern pro Test eine RED/GREEN-Erwartung. Die COSMO-Alpaca-Erweiterung (v1.29.0) hat kein Werkzeug zum Ausführen von Tests und deployt keine lokale `.app`.
- **Nur VS Code:** Die Agenten verwenden VS-Code-spezifische Werkzeuge und Frontmatter-Felder. Für die Copilot CLI wäre eine eigene, schlankere Fassung nötig. Zudem sind `al-tdd-implementer` und `al-orchestrator` länger als die Grenze von 30.000 Zeichen, die GitHub für Agenten nennt.
- **Work-Item-Nummern** in den Agenten (z. B. "US 54428", "Bug 52511") sind Lernbeispiele aus echten Features.

## Aktualisieren

Version in `plugin.json` erhöhen, pushen, dann in VS Code **Extensions: Check for Extension Updates** ausführen.
