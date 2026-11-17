## Agent skills

### Issue tracker

Issues live in GitHub (`github.com/<your-org>/template-reactjs`), driven by the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical roles: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Commit messages and PR descriptions

Write the commit message or PR description, then stop. Always:

- Never add `Co-Authored-By: Claude Code <noreply@anthropic.com>`.
- Never add `Generated with Claude Code`.
- Never commit or push on your own — leave the changes uncommitted for the human to review.

### Hooks

Use existing Refine core hooks instead of writing custom ones.

1. Search `docs/refine-doc/core/src/hooks/index.ts` for a hook matching the behavior you need.
2. Confirm its usage in `docs/refine-doc/docs/` before implementing.
3. Write a custom hook only when no Refine hook covers the behavior, and note in your summary why none fit.
