# Template React.js

A reusable starter for an authenticated dashboard. "Task" and "User" are the canonical example entities used to demonstrate the full stack: a contract-first API, a mocked backend, role-based access control, i18n, and performance patterns.

## Language

**Task**:
A unit of work tracked in the application: a title, an optional description, a lifecycle status, an optional priority, an assignee, and an optional due date.
_Avoid_: Item, job, ticket

**User**:
A person with an account in the application. Every User holds a Role.
_Avoid_: Account, member

**Role**:
A named level of access — `admin` or `member` — that determines what a User may do.
_Avoid_: Permission group, level

**Assignee**:
The User responsible for a Task.
_Avoid_: Owner

**Assign**:
To set a Task's Assignee to a chosen User, or clear it so the Task is unassigned.
_Avoid_: Claim, reassign

**Due date**:
The date and time by which a Task should be completed, stored as a UTC instant and displayed in the user's local timezone. Optional; a Task without one has no due date.
_Avoid_: Deadline

**Status**:
The lifecycle state of a Task: `todo`, `in-progress`, `done`, or `blocked`.
_Avoid_: State, phase

**Priority**:
The relative urgency of a Task: `low`, `medium`, or `high`.
_Avoid_: Severity, importance

**Bulk action**:
A single change applied to many Tasks at once, setting their Status, Priority, Assignee, or Due date.
_Avoid_: Batch update, mass edit

**Locale**:
A language and region pair (e.g. `en`, `vi`) used to translate the interface and format currency.
_Avoid_: Language, region

**Public route**:
A route the app serves without a signed-in User: Login and Register.
_Avoid_: Anonymous route, open page, guest route

**Protected route**:
A route served only to a signed-in User: the dashboard and its pages.
_Avoid_: Private route, auth route, secure route

### Discoverability

**Page metadata**:
The title, description, canonical URL, and social-preview tags that describe a route to search engines and link-preview tools.
_Avoid_: Meta tags, head tags, SEO tags

**Crawl policy**:
Whether a route may appear in search results: indexable, or excluded.
_Avoid_: Indexing rules, robots rules

**Site URL**:
The canonical absolute origin under which the app is published. Every absolute URL the app publishes derives from it.
_Avoid_: Base URL, host, domain

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
