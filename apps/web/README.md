# Web lane

The Conquest frame follows `brand-assets/design-system/README.md`. Its tokens are imported directly in `app/layout.tsx`; `app/globals.css` implements the component treatments with local fonts (licenses in `public/fonts/`). Conference palette variables are scoped to `.dungeon-surface`, leaving the white/black/blue frame unchanged.

From the repository root:

```sh
NEXT_PUBLIC_FAKE_API=1 npm run dev:web
npm test
npm run typecheck
npm run lint
NEXT_PUBLIC_FAKE_API=1 npm run build -w apps/web
```

Pass `NEXT_PUBLIC_FAKE_API` explicitly: Next reads app-directory env files, so the root `.env` alone is not a reliable switch for web. Public environment variables are fixed at build time for production.

W.1 provides the landing page, all planned route shells, a shared typed API client, loading/retry/error states, and memory-only fixtures (12 talks, three attendees). Signup, actions, organizer editors, and recap interactions are previews until their later build steps. W.1 does not implement XP rules.

Demo routes use `conf-demo`, `att-jane`, `talk-1`, and `spk-ada`. The fake transport is a per-browser-session singleton; responses are cloned and a full reload resets edits. Create and retrieve conference/attendee data through the same schemas as the HTTP transport. Do not call `fetch` directly from pages.

In live mode, the client uses relative `/api/game/*` and `/api/search/*` routes. Keep the existing Next rewrites and health/readiness routes. Store the signed-up attendee ID under `conquest:<conference-id>:attendee` in localStorage.

The theme studio addition is specified under W.5a; it needs a Game lane contract update before a saved theme editor can be integrated.
