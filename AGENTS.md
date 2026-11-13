<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Git workflow

- Create a local Git commit after a logical feature, self-contained implementation, verified bug fix, or completed refactor reaches a stable milestone. Do not commit every small edit.
- Before committing, inspect `git status` and the complete diff; stage only files related to the task. Exclude unrelated user changes, secrets, credentials, `.env` files, generated files, and build output.
- Run relevant tests and quality checks before committing. Do not commit broken or untested work to save time.
- Use concise, natural commit messages, with conventional prefixes where appropriate (for example, `fix: prevent duplicate trip requests`). Use imperative, specific wording; avoid generic or AI-attributed messages.
- Create normal commits only. Never amend previous commits unless explicitly requested, and never force-push or push to a remote without explicit approval.
