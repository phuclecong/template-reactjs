# Client-side data fetching via Refine hooks

Pages fetch data client-side through Refine hooks (`useList`/`useTable`) inside client components. Chosen over any server-side data model because the core surface — a table with live debounced search — is inherently client-side, and an authenticated dashboard with minimal SEO gains nothing from server-rendering a window of a paginated list. In a Vite SPA there is no server/client component split, so every component is a client component by default and the mock (or real backend) is reached over HTTP at runtime, never during a server render.
