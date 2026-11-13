# Use shadcn components (folded into `migrate-to-shadcn.md`)

This note's two asks are now part of the migration spec:

1. **Adopt the shadcn primitives** — see
   [`migrate-to-shadcn.md`](./migrate-to-shadcn.md) §5 for the component audit and
   §8 for the phased plan.
2. **Move all forms to React Hook Form** — already done. Every form uses
   `react-hook-form` + `zod` + `@hookform/resolvers` with the `Field` primitives;
   no `FormField` migration is planned (see `migrate-to-shadcn.md` §4).

Do not add requirements here; update the migration spec instead.
