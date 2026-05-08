# Acceptance Criteria Checklist

Use this checklist for pull requests and integration sign-off.

## Contract Alignment

- [ ] Frontend imports types from `packages/shared/task-contracts.ts` (no duplicated local task types).
- [ ] Backend request/response payloads match `packages/shared/task-contracts.ts`.
- [ ] API exposes a health endpoint with `contractVersion` equal to `CONTRACT_VERSION`.
- [ ] Any contract change includes coordinated frontend and backend updates in the same PR or linked PRs.

## Functional Criteria

- [ ] User can create a task from the UI.
- [ ] User can view created tasks in the list.
- [ ] User can update task status across `todo`, `in_progress`, and `done`.
- [ ] User can edit and delete a task without UI crash.
- [ ] Status filter returns only matching items.

## Error Handling

- [ ] Validation failures return `ErrorResponse` shape with `error.code` and `error.message`.
- [ ] Missing task (`id` not found) returns consistent `ErrorResponse`.
- [ ] Frontend shows clear user-facing message on API errors.

## Demo Readiness

- [ ] Core user flow in `docs/MVP.md` runs end-to-end in under 5 minutes.
- [ ] No blocking bug on task create/edit/status/delete flow.
- [ ] README setup steps are enough for a teammate to run locally.
