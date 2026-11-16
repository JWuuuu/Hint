# Hint

Hint is a tarot and astrology app for iPhone. The interface is a React app
built with Vite and packaged into a native shell with Capacitor
(`com.mydailyhint.app`). It talks to a Node/Express API backed by PostgreSQL.

For the current Tarot, Read My Hint, and mascot v3.2 checkpoint, start with
[the Windows handoff](HANDOFF_WINDOWS.md). The full download includes all saved
animation versions and backup archives.

The iPhone app needs three things from this repository: the frontend bundle,
the API service, and the database migrations. Everything else supports
building, testing, or documenting those.

## Repository layout

| Path | What it is |
| --- | --- |
| `artifacts/hint` | The app. React source in `src/`, bundled assets in `public/`, native projects in `ios/` and `android/`, browser tests in `e2e/`, release checks in `scripts/`. |
| `artifacts/api-server` | Node/Express API. Owns provider calls, database writes, and anything that needs a secret. |
| `lib/api-spec`, `lib/api-zod`, `lib/api-client-react` | OpenAPI contract, validators, and the generated client the app uses. |
| `lib/db` | Drizzle schema, database client, and numbered SQL migrations. |
| `docs/` | Setup, architecture, and deployment guides. Older notes are in `docs/archive/`. |
| `artifacts/hint/docs` | Dated design, QA, and release evidence for the app. |
| `.github/workflows` | Verification (`quality.yml`), unsigned iOS candidate build (`ios-candidate.yml`), Android debug build (`android-debug.yml`), and manual web publish (`deploy-pages.yml`). |
| `render.yaml` | Blueprint for the API service and its PostgreSQL database. |
| `vercel.json` | Web hosting config that serves the frontend build and proxies `/api/*` to the API. |

The packages stay in one pnpm workspace so the app, the API, and the shared
contract cannot drift apart. Do not split or delete the `lib` packages without
replacing the imports that depend on them.

## Requirements

- Node.js 24 (see `.node-version`) and pnpm 11.5.0 (see `packageManager` in `package.json`)
- PostgreSQL for anything that saves profiles, history, or daily pulls
- Xcode for iPhone builds; Android Studio for Android builds

## Run it locally

```bash
pnpm install
cp .env.example .env    # then fill in the values; never commit this file

# Terminal 1: API on http://localhost:5050
# The migration runner does not read .env, so pass a local database URL explicitly.
DATABASE_URL=postgresql://user:password@localhost:5432/hint_dev pnpm --filter @workspace/db run migrate
pnpm run dev:api

# Terminal 2: app in the browser on http://localhost:5173
pnpm run dev:web
```

The development server proxies `/api/*` to `API_PROXY_TARGET`
(default `http://localhost:5050`). Full details are in
[docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md).

## Build the iPhone app

Native WebViews cannot use the development proxy, so the mobile build needs
real public URLs. Create `artifacts/hint/.env.mobile` from
`artifacts/hint/.env.mobile.example`; the build stops if the example values are
left in place.

```bash
pnpm run mobile:build    # validate mobile config, then build the bundle
pnpm run mobile:sync     # build, then copy the bundle into ios/ and android/
pnpm run mobile:ios      # build, sync, and open the Xcode project
```

Release checks:

```bash
pnpm --filter @workspace/hint run check:ios:source    # static project checks
pnpm --filter @workspace/hint run mobile:ios:check    # build, sync, and compile for the simulator
```

Signing, device archives, and TestFlight uploads are separate release steps.
No workflow in this repository can publish the app. See
[docs/MOBILE_APP_TRANSFER.md](docs/MOBILE_APP_TRANSFER.md) and
[artifacts/hint/docs/tarot-ios-release-checklist.md](artifacts/hint/docs/tarot-ios-release-checklist.md).

## Test

```bash
pnpm run typecheck
pnpm --filter @workspace/hint exec vitest run          # app unit and component tests
pnpm --filter @workspace/api-server test               # API tests and Node provenance checks
pnpm --filter @workspace/db run migrate:check          # pending or changed migrations (needs DATABASE_URL)

# Browser tests run in WebKit at iPhone sizes against a production build
pnpm run build:web
pnpm --filter @workspace/hint exec playwright test --config playwright.production.config.ts
```

`.github/workflows/quality.yml` runs the same checks against a disposable
PostgreSQL service on every pull request and on pushes to `main`.

## Services

- **API and database.** `render.yaml` defines `mydailyhint-api` and
  `mydailyhint-db`. Each deploy runs the numbered migrations in
  `lib/db/migrations` before the API starts, and the health check is
  `/api/readyz`. Never use schema push against an existing database; see
  [lib/db/migrations/README.md](lib/db/migrations/README.md).
- **Server boundary for the beta.** See
  [artifacts/api-server/docs/testflight-access.md](artifacts/api-server/docs/testflight-access.md).
- **Web surface.** The same frontend build can also be published as a website.
  Shared receipt and invitation links are built from `VITE_HINT_PUBLIC_URL`,
  so they need a public host. The config lives in `vercel.json` and
  `.github/workflows/deploy-pages.yml`; the guides are in
  [docs/deploy/](docs/deploy/).

## More documentation

- [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md): environment variables and local setup
- [docs/FRONTEND_BACKEND.md](docs/FRONTEND_BACKEND.md): package boundaries
- [docs/MOBILE_APP_TRANSFER.md](docs/MOBILE_APP_TRANSFER.md): Capacitor setup notes
- [docs/TAROT_ROOM_SPEC.md](docs/TAROT_ROOM_SPEC.md): Tarot Room product spec
- [docs/testflight-coverage.md](docs/testflight-coverage.md): test coverage inventory
- [HANDOFF_WINDOWS.md](HANDOFF_WINDOWS.md): Windows checkpoint and backup archives

## Contributing

Follow [AGENTS.md](AGENTS.md) for commit identity, branch naming, and the
active repository link.
