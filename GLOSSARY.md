# Template React.js

A reusable starter for an authenticated dashboard. "Task" and "User" are the canonical example entities used to demonstrate the full stack: a contract-first API, a mocked backend, role-based access control, i18n, and performance patterns.

## Language

**Dashboard**:
The authenticated area of the application: every page a signed-in User can reach, framed by one persistent navigation shell.
_Avoid_: Admin panel, back office

**Task**:
A unit of work tracked in the application: a title, an optional description, a lifecycle status, an optional priority, an assignee, and an optional due date.
_Avoid_: Item, job, ticket

**User**:
A person with an account in the application. Every User holds a Role.
_Avoid_: Account, member

**Role**:
A named, described grouping of access that a User holds; `admin` and `member` are the seeded Roles. Renaming a Role does not change which Users hold it.
_Avoid_: Permission group, access level, level

**Role status**:
The lifecycle state of a Role: `active` or `inactive`.
_Avoid_: Role state, enabled/disabled

**System Role**:
A seeded Role the application depends on — `admin` or `member`. A System Role cannot be deleted or deactivated.
_Avoid_: Built-in role, default role

**Administrator**:
A User who holds the admin System Role.
_Avoid_: Admin user, superuser

**Assignee**:
The User responsible for a Task.
_Avoid_: Owner

**Assign**:
To set a Task's Assignee to a chosen User, or clear it so the Task is unassigned.
_Avoid_: Claim, reassign

**Due date**:
The date and time by which a Task should be completed, stored as a UTC instant and displayed in the user's local timezone. Optional; a Task without one has no due date.
_Avoid_: Deadline

**Task status**:
The lifecycle state of a Task: `todo`, `in-progress`, `done`, or `blocked`.
_Avoid_: Status, state, phase

**Priority**:
The relative urgency of a Task: `low`, `medium`, or `high`.
_Avoid_: Severity, importance

**Bulk action**:
A single user action that applies a change to many records at once.
_Avoid_: Batch update, mass edit

**Locale**:
A language and region pair (e.g. `en`, `vi`) used to translate the interface and format currency.
_Avoid_: Language, region

### Observability

**Analytics session**:
An anonymous, per-tab identity that groups observability entries from one browsing session. It is not the authenticated session and is never linked to a User.
_Avoid_: Session, user session, tracking id

**Business event**:
A record that a user completed a domain action, emitted for product analysis rather than for a durable audit trail.
_Avoid_: Analytics event, telemetry event, audit entry

**Audit log**:
A durable record of who changed what in the application, kept for accountability.
_Avoid_: Activity log, history
