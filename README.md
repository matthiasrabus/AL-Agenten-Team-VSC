# AL Agenten-Team (VS Code)

Agent Plugin für GitHub Copilot in VS Code: ein Team von Agenten, das eine Business-Central-AL-Anforderung von der Analyse bis zum Pull Request führt. Zu jedem Feature entsteht ein schriftliches Dossier (`docs/features/<US>-<slug>/`), nach jeder Phase fragt der Orchestrator nach "go / anpassen / stopp".

## Agenten

| Agent | Aufgabe | Artefakt |
|---|---|---|
| AL Orchestrator | Einstiegspunkt, steuert Phasen und Gates, hält `00-overview.md` | `00-overview.md` |
| AL Requirements Analyst | Anforderung schärfen, Ist-Analyse im Code | `01-requirements.md` |
| AL Solution Architect | Technisches Design (Objekte, Events, Datenmodell, Übersetzungen) | `02-design.md` |
| AL Test Planner | Testplan (GIVEN/WHEN/THEN, Seams, Ausführungsvoraussetzungen) | `03-test-plan.md` |
| AL TDD Implementer | Test-first in drei getrennten Modi `red`, `green`, `refactor` | `04-implementation-log.md` |
| AL Documentation Writer | Anwenderdokumentation, Release Note, Testliste | `05-user-documentation.md` |
| AL Quality Reviewer | Review mit BCQuality und AL Performance Analyzer | `06-quality-review.md` |
| AL Delivery | Branch, Commits, Squash, Push und Azure-DevOps-PR (`branch`, `commit`, `deliver`) | `07-delivery.md` |
| AL Container Provisioner | BC-Sandbox-Container über COSMO Alpaca prüfen, starten, anlegen | - |

Ablauf: Requirements, Design, Test Plan, Implementierung (RED, GREEN, optional Refactor), Dokumentation, Quality Review, Delivery. Zwei Gates werden nie übersprungen: vor der Implementierung und vor dem Push/PR.

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

| Skill | Zweck |
|---|---|
| `feature-pr-workflow` | Feature-Branch, Commit unter der korrekten Git-Identität, Push und Azure-DevOps-PR mit wählbarem Zielbranch und Auto-Complete (vom AL Delivery genutzt) |

Das Skill enthält Beispiele mit B.i.Team-Organisation, Projekt und Repo-Namen. Für andere Teams die Standardwerte im Skill anpassen.

## Bekannte Einschränkungen

- **Tests ausführen:** Auf BC unter Version 28 steht `runTests` oft nicht zur Verfügung. Dann führt der Anwender den AL Test Tool selbst aus, und die Agenten liefern pro Test eine RED/GREEN-Erwartung. Die COSMO-Alpaca-Erweiterung (v1.29.0) hat kein Werkzeug zum Ausführen von Tests und deployt keine lokale `.app`.
- **Nur VS Code:** Die Agenten verwenden VS-Code-spezifische Werkzeuge und Frontmatter-Felder. Für die Copilot CLI wäre eine eigene, schlankere Fassung nötig. Zudem sind `al-tdd-implementer` und `al-orchestrator` länger als die Grenze von 30.000 Zeichen, die GitHub für Agenten nennt.
- **Work-Item-Nummern** in den Agenten (z. B. "US 54428", "Bug 52511") sind Lernbeispiele aus echten Features.

## Aktualisieren

Version in `plugin.json` erhöhen, pushen, dann in VS Code **Extensions: Check for Extension Updates** ausführen.
