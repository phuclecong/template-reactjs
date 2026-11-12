# Feature: Date and datetime pickers for Task Due dates

## Summary

Replace the native date inputs used for Task Due dates with two shared design-system components: a single date-and-time picker and a date range picker. Move the Task Due date from a date-only string to a UTC instant so it can carry a time and be displayed in the user's local timezone. Add range presets, free-text date entry, upper-bound-only filtering, locale-aware table display, a global Storybook theme toolbar, Storybook interaction tests, and mobile-specific picker behavior.

## Background

All Due date fields currently rely on the browser's built-in date input (`<Input type="date" />`). Rendering and behavior differ between browsers, the control cannot be styled to match the design system, and calendar, keyboard, and clearing affordances differ across platforms. The app also stores Due dates as date-only strings, so Tasks cannot carry a time, display cannot be timezone-aware, and the Task table shows raw ISO dates instead of localized ones.

## Goals

- Provide a single, consistent date and datetime selection experience on every supported browser.
- Match the look and feel of the existing design system and theming (light/dark mode).
- Improve usability and accessibility for date and time entry.
- Make Due dates unambiguous across timezones while displaying them in the user's local timezone.
- Replace the separate Due from and Due to fields with one range filter that supports presets and one-sided bounds.
- Make the pickers reviewable and testable through Storybook, including interaction tests.

## Requirements

### Single date-and-time picker

1. Replace every single-date `<Input type="date" />` usage with the picker: the Due date field in the create/edit Task dialog and the bulk set-due-date control.
2. The trigger displays the selected Due date and time in a human-readable, locale-aware format, and a placeholder when no value is set.
3. The popover contains a calendar with month/year dropdown captions, a time control, and a free-text date/time entry field.
4. Picking a date preserves the currently selected time. A value created from empty defaults to 00:00 in the user's local timezone.
5. Free-text entry accepts a typed date and time, parsed with the project's date library in the selected Locale (date-fns `P p`). Values outside `min`/`max` are rejected. Invalid text shows an inline error and does not emit a value.
6. Changes apply immediately. The popover stays open after a date pick so the user can adjust the time, and closes on `Done`, `Esc`, or an outside click. Clicking the selected day does nothing; clearing is explicit.
7. The component emits a UTC instant (ISO 8601 with `Z`) through `onChange`; empty is `""`/`undefined` at call-site boundaries.
8. `min` and `max` are UTC instants, inclusive. The calendar's year dropdown bounds derive from `min`/`max` when provided; the default month is the selected value (else today), clamped into those bounds.
9. The picker preserves `value`, `onChange`, `onOpenChange`, `name`, `min`, `max`, `disabled`, `required`, `id`, `onBlur`, locale, a `labels` object (Clear, Done, Time, typed-entry label/hint/error), and validation state. `name` renders a hidden input carrying the UTC instant. `onOpenChange` lets a call site that keeps a local draft, such as the bulk action, reset it when the picker closes.
10. The component exposes an accessible name via `label`/`aria-label`, announces the selected value, and supports keyboard-only operation: focusable trigger, arrow-key calendar navigation, `Enter`/`Space` to select, `Esc` to close, and keyboard access to the time and typed-entry controls.
11. Existing form validation messages and error states continue to render alongside the picker.
12. The component renders correctly in light and dark themes and respects the project's design tokens.

The bulk set-due-date control applies every valid change immediately, keeps the popover open so the time can be adjusted, and resets when the popover closes. The separate Clear due date action is unchanged.

### Date range picker

13. Replace the separate Due from and Due to fields with one date range picker.
14. The range picker supports three modes: `Between` (default), `From` (lower bound only), and `Until` (upper bound only), so To-only filtering is available from the UI. Mode is user-selected; there is no `defaultMode` prop.
15. `Between` mode offers presets: Today, Last 7 days, and This month, plus a custom range.
16. The range popover shows two consecutive months on wide viewports and one month on narrow or touch viewports.
17. Range filtering is date-granular: the pickers select calendar dates only, with no time component.
18. The trigger displays the selected range, the single bound, or the placeholder in a locale-aware format.
19. A translated `Clear` action resets both bounds. `Esc` closes without clearing.
20. The range picker emits `{ from: string; to: string }` date-only strings, where either bound may be empty. It exposes accessible-name, disabled, locale, and validation props, but no hidden named input because it is filter UI rather than a form field.

### Due date model and API

21. The Task Due date changes from a date-only string to a UTC instant. The API contract, zod schema, MSW seeds and handlers, filters, smoke tests, form types, and payloads are updated to match.
22. The field keeps the name `dueDate` across the API and types; the glossary definition changes to describe a datetime stored as a UTC instant.
23. Existing stored date-only values are treated as local midnight on read and written back as UTC instants on save.
24. Sorting and range filtering compare UTC instants. Display uses the browser's local timezone; there is no timezone selector.
25. The date and time display format is locale-aware and follows the selected Locale. There is no user-configurable format setting.

### Filters and URL

26. The Due from and Due to URL keys (`dueFrom`, `dueTo`) remain date-only strings, so bookmarked and shared filtered views keep working.
27. A From bound maps to the start of the selected local day, and a To bound maps to the end of the selected local day, each converted to a UTC instant for the API query.
28. The Clear filters action resets both Due date bounds.

### Table display

29. The Task table's Due date column displays the UTC instant in the user's local timezone using the locale-aware date and time format instead of raw ISO.
30. The column width adjusts to fit the formatted value.

### Storybook and testing

31. Storybook has a global theme toolbar that toggles light and dark using the design system's `.dark` class.
32. Stories cover single, range, min/max, disabled, error, typed entry, time selection, presets, one-sided bounds, dark mode, and both supported Locales.
33. Stories include `play` functions for selection, clearing, keyboard navigation, time selection, range selection, presets, and one-sided bounds.
34. The project runs Storybook interaction tests through `@storybook/test-runner` locally and in CI.
35. Unit tests cover the pickers' public props and the UTC-instant conversion, including the local-day boundaries used by range filters.
36. End-to-end tests cover creating and editing a Task with a Due date and time, bulk due-date updates, and range filtering.

### Mobile and browser behavior

37. On narrow or touch viewports the pickers open in a sheet instead of a popover and show one calendar month.
38. On desktop the pickers use a popover; the range picker shows two months.
39. No native date input is used. Time entry uses the platform time control where available and falls back to typed HH:mm input.
40. The pickers behave consistently in Chrome, Firefox, and Safari, including focus return and dismissal.

## Acceptance Criteria

- [ ] No remaining `<Input type="date" />` usages exist in the codebase.
- [ ] Task Due dates are stored, validated, and submitted as UTC instants; existing date-only data migrates as specified.
- [ ] Dates and times can be selected with the mouse and with the keyboard alone.
- [ ] Free-text date and time entry parses valid input and rejects invalid input with an inline error.
- [ ] The range picker supports Between, From, and Until, plus the three presets, and resets cleanly.
- [ ] The Task table shows locale-aware date and time values instead of raw ISO.
- [ ] `min`/`max`/`disabled` and validation error states behave correctly.
- [ ] Pickers render correctly in light and dark mode, and the Storybook theme toolbar toggles them.
- [ ] Storybook play functions and `@storybook/test-runner` pass locally and in CI.
- [ ] Unit and end-to-end tests cover selection, time, clearing, disabled, range, presets, one-sided bounds, and Locale behavior.
- [ ] The pickers use a sheet on narrow/touch viewports and a popover on desktop.

## Storybook

Stories live next to the components (`DatePicker.stories.tsx`, `DateRangePicker.stories.tsx`) and use the project's existing Storybook setup (`@storybook/react-vite`, CSF 3, autodocs).

Single picker:

- `Default` — empty state showing the placeholder.
- `WithValue` — a pre-selected UTC instant rendered in the locale-aware date and time format.
- `WithTime` — selecting a date and adjusting the time.
- `TypedEntry` — valid and invalid free-text input.
- `WithMinMax` — restricted instant range, verifying out-of-range dates are disabled.
- `Disabled` — non-interactive trigger.
- `WithLabel` — accessible name wired via `label`/`aria-label`.
- `WithError` — validation error message rendered alongside the component.
- `DarkMode` — verifies design tokens via the global theme toolbar.
- `VietnameseLocale` — datetime formatting in Vietnamese.

Range picker:

- `Empty`, `FullRange`, `FromOnly`, `UntilOnly`, `Presets`, `Disabled`, `DarkMode`, `VietnameseLocale`.
- Arg types for `value`, `onChange`, `name`, `min`, `max`, `disabled`, and `label`/`aria-label` so stories can be driven from the controls panel.

Interaction tests:

- `play` functions cover selection, clearing, keyboard navigation, time selection, typed entry, range selection, presets, and one-sided bounds.
- `@storybook/test-runner` executes the stories locally and in CI.

## Out of Scope

- Notification or reminder scheduling for Due dates.
- Recurring Due dates.
- External calendar synchronization.
- A per-user timezone selector; the browser's timezone is used for display and day boundaries.
- User-configurable date or time display formats.
- Times in the Due from/Due to range filter; range filtering stays date-granular.
- Date ranges in the Task dialog or bulk action; those set a single datetime.
- Multi-timezone display of one Task.
- Browser-specific picker implementations beyond the responsive sheet and the native time control fallback.

## Technical Notes

- Add the required shadcn/ui primitives (`popover`, `calendar`, `sheet`, `button`) if not already present, using the existing Base UI (`@base-ui/react`) configuration.
- Use the project's date library (e.g. `date-fns`) for parsing, formatting, day boundaries, and the calendar locale.
- Replace usage incrementally: build the pickers and their stories first, then migrate call sites, then the API/model.
- Add the matching Storybook stories alongside each component so they are reviewable before call-site migration.
- Coordinate the API contract change with the generated types and the MSW smoke tests; run the API and web test suites together.
- See ADR 0007 for the UTC-instant Due date decision and its migration consequences.
