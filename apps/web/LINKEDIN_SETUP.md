# LinkedIn sign-in

Conquest can import an attendee's name and profile photo through LinkedIn's OpenID Connect sign-in. The attendee signs in on LinkedIn and approves `openid profile` access. Email and posting permissions are not requested. Manual signup remains available.

## Activate locally

1. Create or select an app at https://www.linkedin.com/developers/apps. Complete the app information the portal requires.
2. In **Products**, request **Sign In with LinkedIn using OpenID Connect**. Wait until that product is enabled and the Auth tab lists `openid` and `profile` permissions.
3. In **Auth**, register the callback URL exactly: `http://localhost:3000/api/auth/linkedin/callback` for local development if the portal accepts local HTTP. For HTTPS development or production, use `https://<your-app-host>/api/auth/linkedin/callback`. LinkedIn's authentication guide specifies HTTPS callbacks; if it rejects local HTTP, use an HTTPS development tunnel and open Conquest through that same HTTPS origin before starting sign-in.
4. Copy `apps/web/.env.example` to `apps/web/.env.local` if no local file exists. Set `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` from the app's Auth tab. Set `LINKEDIN_REDIRECT_URI` to the registered callback URL. Generate `LINKEDIN_COOKIE_SECRET` with the command in the example (at least 32 characters). Never paste secrets into chat or commit them.
5. Restart `npm run dev:web` from the repository root. Open `/c/conf-demo/join` on the configured origin. **Continue with LinkedIn** becomes available when all four settings are valid.

The local env file is ignored by Git. A local file may already have been prepared with a random cookie secret; fill in the two LinkedIn credentials without replacing that secret.

## What to expect

- Click Continue with LinkedIn, consent, and return to the same conference's signup.
- Name and photo are imported. Details typed before leaving are restored from this tab's sessionStorage when it is available. An edited name is preserved.
- Optionally enter the LinkedIn profile link separately. LinkedIn's OIDC response provides no public profile URL, headline, or about text. These are never inferred from the member ID or scraped. Signing in can continue without a pasted link, matching the updated Game contract.
- Photos are fetched server-side only from LinkedIn's HTTPS image CDN, without redirects, and cropped/compressed to a 256×256 JPEG below 40 KB. If the photo is unavailable, the attendee can upload one or use class art.
- Continue choosing a character/goals and create the attendee using the existing Game API.

This is optional LinkedIn authentication for profile import. Existing attendee IDs and authorization behavior are unchanged; it does not turn organizer pages or game routes into protected accounts. Character stylization is a separate feature.

## Implementation

- `GET /api/auth/linkedin/start?conference=<id>` starts authorization with a random state and an encrypted, ten-minute, HttpOnly transaction cookie. This is the confidential authorization-code flow; no nonce is requested because the observed LinkedIn tokens do not echo it.
- `GET /api/auth/linkedin/callback` validates state, exchanges the code server-side using the client secret, validates the ID token's RS256 signature, issuer, audience, expiry and authorized client, and checks the userinfo subject matches the token. Provider tokens are not persisted. Old in-flight requests from the nonce-based implementation must restart sign-in rather than bypassing their original nonce check.
- `GET /api/auth/linkedin/profile?conference=<id>` reads the encrypted, ten-minute import cookie and returns the name and prepared photo for the correct conference. The client only calls this after a completed sign-in. Cookies and responses are private; responses use `Cache-Control: no-store`.
- Production cookies use Secure when the configured callback is HTTPS. Callback URLs are fixed in server configuration; the request Host header never chooses the return origin. Rotating the cookie secret invalidates outstanding sign-ins and imports.
- No personal fields, authorization codes, or provider tokens are logged by this implementation. Next's development request logs exclude these auth routes. Ensure infrastructure HTTP access logs and browser telemetry also redact callback query strings and exclude the auth/import endpoints from body capture.

For production, the Web lane's runtime environment needs the same four server-only settings. This change does not edit deployment manifests or deploy anything.

## Verification

`npx vitest run apps/web/src/lib/linkedin-server.test.ts apps/web/src/components/linkedin-signup.test.tsx apps/web/src/components/signup.test.tsx`

Tests use locally signed tokens, mocked provider responses, and synthetic images. They never contact LinkedIn. A real consent round trip must be verified once developer-app credentials and the product permission are available.

Official references: [LinkedIn OpenID Connect](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2), [authorization code flow](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow).

Issuer compatibility: LinkedIn's [live discovery document](https://www.linkedin.com/oauth/.well-known/openid-configuration), checked 2026-11-09, publishes `https://www.linkedin.com/oauth` as its issuer. The written integration guide still illustrates `https://www.linkedin.com`. Token validation requires the live issuer value exactly. Safe server diagnostics record only fixed failure stages, allowlisted codes/statuses and JWT claim names; no claim values, credentials, authorization codes, tokens or provider descriptions are logged.
