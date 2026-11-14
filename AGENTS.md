## Agent skills

### Issue tracker

Issues live in GitHub (`github.com/<your-org>/template-reactjs`), driven by the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical roles: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Final step: do not auto commit or push code to git

Keep generated commit message but do not commit or push code automatically, I need to have a final review.
