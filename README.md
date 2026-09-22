# FlowDesk

Escalation routing workspace for service operations: intake, decision packets, reports and routing rules.
This is a front-end application. All data is mocked and stored in the browser's `localStorage`.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # typecheck + tests + production build
npm run build      # outputs dist/
npm run preview    # serve dist/ locally
```

Sign in with any email address and workspace name. There is no password and no account is created.

## Stack

React 19, TypeScript (strict), React Router, Vite, Vitest + Testing Library. Hand-written CSS with light and dark themes and no UI or chart libraries.

## Structure

```
src/
  domain/   Pure logic and types: triage rules, request transitions, metrics, CSV, seed data (unit tested)
  api/      client.ts is the mock backend (localStorage + simulated latency)
  state/    AppProvider (session, requests, settings, mutations) and toasts
  pages/    Login, Workspace, Intake, Reports, Settings, NotFound
  components/  Shell, DecisionPacket, small UI pieces
  styles/   app.css (tokens, light/dark, responsive)
```

## Adding a real backend

`src/api/client.ts` is the only file that knows data lives in `localStorage`. Every function is async and
returns the same shapes the UI already consumes, so a backend means replacing its bodies with HTTP calls:

| Mock call | Suggested endpoint |
| --- | --- |
| `getSession` / `signIn` / `signOut` | `GET /session`, `POST /session`, `DELETE /session` |
| `listRequests` / `createRequest` | `GET /requests`, `POST /requests` |
| `assignOwner`, `changePriority`, `addNote`, `resolve`, `reopen` | `PATCH /requests/:id` or one action route each |
| `getSettings` / `saveSettings` | `GET /settings`, `PUT /settings` |

`src/domain/transitions.ts` and `triage.ts` hold the business rules today. When the server takes over,
move them there and keep `triage` for the live suggestion on the Intake page. Authentication is also mocked:
replace `signIn` with a real flow before exposing customer data.

## Deploy

`firebase.json` serves `dist/` as a single-page app with a strict Content-Security-Policy, HSTS, no-index
headers and long-lived caching for hashed assets:

```bash
npm run build
firebase deploy --only hosting
```

Any static host works if it rewrites unknown paths to `/index.html`. The app is marked `noindex`
(meta tag, `robots.txt`, header) because it is a demo workspace.

## Known limits

- Data lives per browser. Clearing site data, or using another browser, starts from the seed data.
- Notifications settings are stored but nothing is sent.
- Triage is rule-based (keywords and request type), not a language model.
