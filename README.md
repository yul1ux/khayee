# Khayee

Khayee is a request-based outdoor trip marketplace for Myanmar, launching in
Mandalay. Adventurers can discover trips and request to join; organizers
publish trips for review before they become public.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The application includes
account registration, trip discovery and search, join requests, organizer
onboarding and trip management, notifications, reporting, and admin moderation.
Supabase credentials and Auth redirect settings are required for live
workflows.

## Project structure

- `src/app/`: Next.js App Router routes and global styles.
- `src/components/marketplace/`: reusable homepage sections.
- `src/types/`: shared TypeScript models.
- `docs/database/`: database architecture and Supabase migration guidance.
- `docs/production-readiness.md`: deployment requirements, security boundaries,
  migration reconciliation, and remaining live verification.
- `supabase/migrations/`: versioned PostgreSQL schema migrations.

Read [the database README](./docs/database/README.md) before changing database
objects or applying migrations. Each environment needs a privately provisioned
trip image bucket. The baseline migration defines the documented object
policies; inspect the target environment before deployment.

## Validation

```bash
npm run lint
npm test
npx tsc --noEmit
npm run build
```

Do not expose a Supabase `service_role` key in browser code or commit secrets.
