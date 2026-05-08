# MVP Scope

This file is the live source of truth for MVP scope.

Contract source of truth: `packages/shared/task-contracts.ts` (`CONTRACT_VERSION = "v1"`).
PR/integration gate checklist: `docs/ACCEPTANCE_CRITERIA.md`.

## Problem Statement

Small teams need a simple way to track tasks in one place without complex setup.
The MVP must let users create, view, update, and complete tasks reliably through a
single web interface backed by a working API.

## Target Users

- Small student/project teams (3-10 people)
- Users who need fast task capture and status tracking
- Teams working in short cycles and presenting progress demos

## MVP Features (Must Have)

1. Task list page that shows all tasks with status.
2. Create task flow with required fields:
   - title (required)
   - description (optional)
   - assignee (optional)
   - due date (optional)
3. Update task status:
   - `todo`
   - `in_progress`
   - `done`
4. Edit task details (title/description/assignee/due date).
5. Delete task.
6. Basic filtering by status on the web UI.
7. API + frontend integration using shared contracts in `packages/shared/`.

## Non-Goals (Out of Scope)

- Authentication/authorization
- Notifications (email, push, SMS)
- File attachments
- Real-time collaboration/websockets
- Advanced analytics/reporting

## Acceptance Criteria

- [ ] User can create a task from UI and see it appear immediately in the list.
- [ ] User can move a task from `todo` to `in_progress` to `done`.
- [ ] User can edit and delete a task without page-breaking errors.
- [ ] Status filter works for all three statuses.
- [ ] Frontend and backend use shared task types from `packages/shared/`.
- [ ] API returns consistent error shape for invalid input and missing task.
- [ ] End-to-end happy path is documented and manually testable in under 5 minutes.
- [ ] MVP is demo-ready locally for all team members.

## Core User Flow (Demo Path)

1. Open app and view task list.
2. Create one new task with title and optional details.
3. Change status from `todo` -> `in_progress` -> `done`.
4. Edit the task title.
5. Filter by `done` and verify the task appears.
6. Delete the task and verify it is removed.

## API Contract Expectations (MVP)

Minimum endpoints:

- `GET /tasks` - list tasks
- `POST /tasks` - create task
- `PATCH /tasks/:id` - update task
- `DELETE /tasks/:id` - delete task

Minimum task shape:

- `id: string`
- `title: string`
- `description?: string`
- `assignee?: string`
- `dueDate?: string` (ISO date)
- `status: "todo" | "in_progress" | "done"`
- `createdAt: string` (ISO datetime)
- `updatedAt: string` (ISO datetime)

Error response shape:

- `error.code: string`
- `error.message: string`
- `error.details?: unknown`

## Milestones and Ownership

- **William (Frontend)**
  - Build task list UI and forms
  - Implement status filter and task editing interactions
  - Wire web app to shared contracts
- **Philippe (Backend)**
  - Implement task CRUD endpoints
  - Add validation and consistent error responses
  - Keep API aligned with shared contracts
- **Rojel (Integration/QA)**
  - Finalize shared contract definitions in `packages/shared/`
  - Verify end-to-end integration and smoke tests
  - Maintain MVP checklist and demo readiness

## Open Questions

- Should due date include time or date-only for MVP?
- Persist data in-memory only or lightweight local DB for demo stability?
- Do we need pagination, or is full list acceptable for MVP?

