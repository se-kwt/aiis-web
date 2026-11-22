# Decap CMS login (Netlify Identity + Git Gateway)

Editors log in to `/admin/` on GitHub Pages with an **email and password** (no
GitHub account). This Netlify site only provides:

- **Netlify Identity** – the user accounts and login (`/.netlify/identity`)
- **Git Gateway** – commits editors' changes to the repo using a token that
  Netlify holds (`/.netlify/git`)

`src/admin/config.yml` points Decap at both with absolute URLs, and
`src/admin/index.html` loads the Identity widget so invite and
password-reset links work.

> Git Gateway is deprecated by Netlify: existing setups keep working and
> security fixes ship, but functional bugs will not be fixed. If it ever
> breaks, the fallback is the GitHub login proxy in `functions/` (see
> "Fallback" below).

## One-time setup (Netlify dashboard, site `aiis-cms-auth`)

The site must be linked to `se-kwt/se-kwt.github.io`.

1. **Project configuration → Identity → Enable Identity.**
2. **Registration preferences → Invite only.** (Otherwise anyone can sign up.)
3. **Services → Git Gateway → Enable Git Gateway.** Choose GitHub and use the
   default token (or a personal access token with `repo` scope for a bot
   account). Set the roles field empty unless you want role restrictions.
4. **Identity → Invite users**: enter each editor's email. They get an email,
   click the link, set a password, and land in `/admin/`.

## Notes

- `branch: main` in `config.yml` is the branch editors commit to. Each save
  goes straight to `main` and triggers a GitHub Pages rebuild.
- `index.html` here forwards invite/recovery links to
  `https://se-kwt.github.io/admin/`. After the custom-domain cutover, update
  that URL. The Identity/Gateway URLs in `src/admin/index.html` and
  `config.yml` point at the Netlify site, so they stay as they are.
- Identity emails link to this site's URL, so keep the Netlify site name
  `aiis-cms-auth` (or update all three places if it changes).

## Fallback: GitHub login proxy

`functions/auth.mjs` and `functions/callback.mjs` (logic in `lib/oauth.mjs`,
tests: `npm run test:oauth`) are a GitHub OAuth proxy. They are unused now but
kept. To switch back, set `backend: {name: github, repo: se-kwt/se-kwt.github.io,
branch: main, base_url: https://aiis-cms-auth.netlify.app}` in `config.yml`;
editors then need GitHub accounts with write access. It needs the
`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` and `ALLOWED_ORIGINS` env vars.
