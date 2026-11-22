# Decap CMS GitHub OAuth proxy

Two small Netlify Functions (`/auth`, `/callback`) that let Decap CMS, served
from GitHub Pages, log editors in with GitHub. Logic lives in
`lib/oauth.mjs`; run its tests with `npm run test:oauth`.

## One-time setup

1. **GitHub OAuth App** (GitHub → Settings → Developer settings → OAuth Apps → New):
   - Homepage URL: `https://se-kwt.github.io`
   - Authorization callback URL: `https://<your-netlify-site>.netlify.app/callback`
   - Generate a client secret.
2. **Netlify site** from this repo (the `netlify.toml` at the root makes it
   functions-only; no build command). Add environment variables:
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
   - `ALLOWED_ORIGINS` = `https://se-kwt.github.io` (add `,https://aiiskwt.com`
     after the custom domain cutover)
   - optional `OAUTH_SCOPE` (default `repo`)
3. In `src/admin/config.yml` set `backend.base_url` to the Netlify site URL,
   then merge to `main` so GitHub Pages redeploys.

Editors need write access to `se-kwt/se-kwt.github.io` on GitHub.

## Security notes

- `state` is random per login and checked against an HttpOnly cookie (CSRF).
- The token is only `postMessage`d to an origin listed in `ALLOWED_ORIGINS`.
- Responses are `Cache-Control: no-store`.
