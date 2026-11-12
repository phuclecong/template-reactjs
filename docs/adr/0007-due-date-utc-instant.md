# Task Due date is a UTC instant

**Status**: accepted

Task Due dates are stored as UTC instants (ISO 8601 with `Z`) and rendered in the user's local timezone, rather than as date-only strings or local datetimes. Chosen because Tasks must carry a time and the value must be unambiguous across timezones; a local datetime cannot be converted reliably when the viewer's timezone differs from the author's, and a date-only value cannot carry a time at all.

## Considered Options

- **Date-only strings** (the original picker plan): cannot carry a time and gives date filters no timezone semantics. Rejected.
- **Local datetime without a zone**: simple, but ambiguous across timezones and cannot support timezone conversion. Rejected.
- **UTC instant**: unambiguous storage, local display, lexicographic sorting. Accepted at the cost of an API contract migration and local-day-boundary logic for date filters.

## Consequences

- `dueDate` changes from a date-only string to a `date-time` in the OpenAPI contract, zod schemas, MSW seeds and handlers, filters, smoke tests, form types, and payloads.
- Existing date-only values are interpreted as local midnight on read and written back as UTC instants on save.
- Date-granularity filters convert the selected local day boundaries to UTC before querying.
- Display and table formatting convert back to the user's local timezone; there is no timezone selector.
- The glossary's definition of Due date changes from a date to a datetime.
