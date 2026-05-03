# GO / NO-GO (Pilot Release)

## Objective
Consolidate the final software-only release checks for pilot rollout.

## Mandatory gates
- [x] Backend automated tests pass (`npm test`).
- [x] Frontend unit tests pass (`npm --prefix frontend test`).
- [x] Frontend E2E suite is configured and discoverable (`npm --prefix frontend run test:e2e -- --list`).
- [x] Functional checklist exists (`FUNCTIONAL_ACCEPTANCE.md`).
- [x] Production checklist exists (`PRODUCTION_CHECKLIST.md`).
- [x] Operational playbook exists (`PLAYBOOK_OPERACIONAL.md`).

## Decision
- **GO for pilot** when all mandatory gates are checked.
- **NO-GO for pilot** if any mandatory gate is unchecked.

## Notes
- This decision document excludes hardware/peripheral integration scope.
