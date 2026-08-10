# Remocn component decisions

Catalog reviewed from `https://remocn.dev/llms-components.txt` on 2026-08-10.

| Scene | Role | Component decision | Docs URL | Tier | Natural length | Dependencies | Content source |
| --- | --- | --- | --- | --- | ---: | --- | --- |
| Hook | Presentation | Custom lineage reveal; rejected `kinetic-center-build` because its re-centering competes with the interrupted-lineage idea | https://remocn.dev/docs/typography/kinetic-center-build | Custom | 60f reference | Remotion | `SCRIPT.md`, approved logo |
| Problem | Explanation | Custom incident-fragment contrast; no catalog component improves the evidence | None | Custom | State-driven | Remotion | `README.md`, `src/core/recall.ts` |
| Impact | Evidence | Custom evidence frame with restrained drift; evaluated `drift` but kept callouts outside the moving screenshot for crisp type | https://remocn.dev/docs/layout/drift | Custom | 90f reference | Remotion | Real landing screenshot |
| Govern | Evidence | Custom two-state evidence frame | None | Custom | State-driven | Remotion | Real closure-ready and guarded-close screenshots |
| Receipt | Evidence | Custom two-state evidence frame | None | Custom | State-driven | Remotion | Real trusted-match and mismatch screenshots |
| DataHub | Evidence | Custom terminal ledger populated only from retained JSON | None | Custom | State-driven | Remotion | `.evidence/live-gate.json` |
| Close | Presentation | Custom proof ledger and brand lockup | None | Custom | State-driven | Remotion | Public URLs, CI, license |

Global transition decision: `focus-pull` was evaluated from `https://remocn.dev/docs/transitions/focus-pull`. It was rejected because its 46-frame blur compromises fine receipt text. The edit uses Remotion's documented neutral 24-frame fade. No Remocn source or dependency is copied into the project.
