# friend-likes

A tiny aggregator that pulls each friend's YouTube "Liked videos" once a day
and shows them as a single shared feed. For 5–10 close friends.

The site is fully static (GitHub Pages + JSON). A small Cloudflare Worker
handles per-friend OAuth renewal in-browser so nobody has to copy-paste
refresh tokens or babysit weekly chores.

```
GitHub Pages          Cloudflare Worker             GitHub
┌─────────────┐       ┌────────────────────┐       ┌─────────────────┐
│  index.html │──/me─▶│ session check      │       │                 │
│  script.js  │       │                    │       │                 │
│             │       │ /start /callback   │──API─▶│ Secrets (PUT)   │
│             │──◀────│  Google OAuth      │       │ Contents (PUT)  │
└─────────────┘       │  → write secret    │       │ Workflows (POST)│
       │              │  → trigger workflow│       └─────────────────┘
       │              └────────────────────┘                │
       │                                                     │
       │           ┌─────────────────────────────────────────┘
       │           ▼
       │     ┌──────────────────────┐
       └────▶│ data/videos.json     │  ←  daily GitHub Actions
             │ data/status.json     │     fetches each friend's likes
             └──────────────────────┘
```

---

## What a friend sees

1. Opens the site URL.
2. **First visit**: a centered "Continue with Google" modal. One click → Google
   sign-in popup → popup closes → site fades in.
3. **Daily visits while access is fresh**: just the feed, no friction.
4. **Within 3 days of expiry**: a dismissible amber banner at the top.
5. **Within 1 day of expiry**: a blocking modal — they sign in once and
   they're back to fresh for another week.

That's the entire UX. No tokens are ever copy-pasted. No admin involvement
after initial setup.

---

## Directory layout

```
friend-likes/
├── index.html  styles.css  script.js   # the static site
├── data/
│   ├── users.json        # who is in the group
│   ├── videos.json       # generated daily by Actions
│   ├── status.json       # tokenIssuedAt per user, written by the Worker
│   └── config.json       # workerOrigin (the only site-side env)
├── scripts/
│   └── fetch_youtube.py  # the daily aggregator
├── worker/
│   ├── src/index.js      # Cloudflare Worker (renewal flow)
│   ├── wrangler.toml
│   └── package.json
├── .github/workflows/update.yml
├── requirements.txt
├── .gitignore
└── README.md
```

---

## Setup — admin (one-time, ~30 minutes total)

You'll do this once and then never again. Friends just click "Sign in".

### 1. Repo

1. Create a new GitHub repo. Public is fine — the URL is unguessable, and
   the page is `noindex`. If you want stronger privacy, use a private repo
   on a paid plan with private Pages.
2. Copy this directory's contents into the repo and push.
3. Edit `data/users.json` with real friends. `id` must be lowercase letters /
   digits / underscores — it becomes part of an env var name.

   ```json
   [
     { "id": "riki", "name": "Riki" },
     { "id": "yuji", "name": "Yuji" }
   ]
   ```

### 2. Google Cloud project

1. <https://console.cloud.google.com/> → new project.
2. **Enable YouTube Data API v3**: APIs & Services → Library → search → Enable.
3. **OAuth consent screen** (APIs & Services → OAuth consent screen):
   - User Type: **External**
   - App name / support email / developer contact: yours
   - Scopes: add `https://www.googleapis.com/auth/youtube.readonly`
   - **Test users**: add every friend's Google email + your own (max 100)
   - Publishing status: **leave as Testing**. (See [refresh token expiry](#refresh-token-expiry) — the Worker UI handles this for you.)
4. **Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URIs: leave empty for now — you'll add the Worker URL after step 4.
5. Note the **Client ID** and **Client Secret**.

### 3. GitHub fine-grained PAT

The Worker will use this PAT to write secrets and trigger workflows.

1. <https://github.com/settings/tokens?type=beta> → "Generate new token (fine-grained)"
2. Resource owner: you (or the org that owns the repo)
3. Repository access: **Only select repositories** → pick this repo
4. Repository permissions:
   - **Actions: Read and write** (to dispatch workflows)
   - **Secrets: Read and write** (to update USER_*_REFRESH_TOKEN)
   - **Contents: Read and write** (to update `data/status.json`)
5. Set expiration as far out as you can (1 year max for fine-grained PATs).
   You'll need to rotate it eventually — calendar reminder.
6. Generate, copy the token (`github_pat_...`).

### 4. Cloudflare Worker

1. Install wrangler if you don't have it: `npm install -g wrangler`
2. `cd worker && npm install`
3. `wrangler login` — links wrangler to your Cloudflare account (free signup if needed).
4. Edit `worker/wrangler.toml`:
   - `GITHUB_REPO` — `your-username/friend-likes`
   - `SITE_ORIGIN` — `https://<owner>.github.io/<repo>` (or your custom domain)
   - `WORKER_ORIGIN` — placeholder for now; you'll get the real URL after first deploy
   - `USER_EMAIL_MAP` — JSON: `{"riki@gmail.com": "riki", "yuji@gmail.com": "yuji"}`
   - `USERS_JSON` — mirror of `data/users.json`
5. Deploy: `wrangler deploy`. Wrangler prints the worker URL, e.g.
   `https://friend-likes-renew.your-subdomain.workers.dev`.
6. Copy that URL back into `wrangler.toml` as `WORKER_ORIGIN`, then run
   `wrangler deploy` again so the worker knows its own origin.
7. Set Worker secrets:

   ```bash
   wrangler secret put GOOGLE_CLIENT_ID
   wrangler secret put GOOGLE_CLIENT_SECRET
   wrangler secret put GITHUB_TOKEN          # the PAT from step 3
   wrangler secret put COOKIE_SECRET         # any long random string
   ```

   For `COOKIE_SECRET`, paste output of `openssl rand -hex 32`.

8. Go back to Google Cloud → Credentials → your Web client → Authorized
   redirect URIs → add `https://<your-worker>.workers.dev/callback`. Save.

### 5. Site config

Edit `data/config.json`:

```json
{ "workerOrigin": "https://friend-likes-renew.your-subdomain.workers.dev" }
```

Commit + push.

### 6. GitHub Secrets

Repo → Settings → Secrets and variables → Actions. Add:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

(Per-user `USER_*_REFRESH_TOKEN` secrets are created automatically by the
Worker when each friend first signs in. You don't need to add them yourself.)

### 7. Workflow env block

Open `.github/workflows/update.yml`. Under "Fetch liked videos", make sure
there's one `USER_<ID>_REFRESH_TOKEN: ${{ secrets.USER_<ID>_REFRESH_TOKEN }}`
line per friend. (This is the only place that needs editing when a friend
joins or leaves — see [Adding/removing friends](#addingremoving-friends).)

### 8. GitHub Pages

Repo → Settings → Pages.
- Source: **Deploy from a branch**, branch: `main`, folder: `/ (root)`.

The site is now live at `https://<owner>.github.io/<repo>/`.

### 9. First sign-in (you)

Open the site. The welcome modal appears. Click "Continue with Google",
sign in with your own account. The Worker creates `USER_<YOUR_ID>_REFRESH_TOKEN`
in GitHub Secrets, updates `data/status.json`, and triggers the daily
workflow so your videos appear within a minute.

Done. From here on, friends just open the URL.

---

## For new joiners (send to friends)

You'll need: a Google account that the admin already added to the OAuth
"test users" list, and 30 seconds.

1. Open the site URL the admin shared with you.
2. Click "Continue with Google".
3. Sign in with the Google account you use for YouTube.
4. The popup closes itself. Done.

You'll be prompted to sign in again about once a week (Google's policy for
small unverified apps — see below). Same one-click flow each time.

To leave the group: revoke access at
<https://myaccount.google.com/permissions>. Your videos stop updating
within 24 hours, and the admin removes your entry from the user list at
their convenience.

---

## Adding / removing friends

**Adding** (admin):

1. Add the friend's `{ "id": "<id>", "name": "<Name>" }` to `data/users.json`.
2. Add `"<email>": "<id>"` to `USER_EMAIL_MAP` in `worker/wrangler.toml`.
3. Add the same `{id, name}` entry to `USERS_JSON` in `worker/wrangler.toml`.
4. Add a line to `.github/workflows/update.yml`'s env block:

   ```yaml
   USER_NEWPERSON_REFRESH_TOKEN: ${{ secrets.USER_NEWPERSON_REFRESH_TOKEN }}
   ```

5. Add the friend's Google email under Google Cloud → OAuth consent screen → Test users.
6. `cd worker && wrangler deploy`
7. Commit + push the JSON / YAML changes.
8. Send them the site URL.

**Removing** (admin):

1. Remove their entry from `data/users.json`.
2. Remove their email from `USER_EMAIL_MAP` and `USERS_JSON` in `wrangler.toml`. `wrangler deploy`.
3. Remove their line from the workflow env block.
4. Optional: delete the `USER_<ID>_REFRESH_TOKEN` secret in repo settings.
5. Their next-day workflow run will drop them from any video's `likedBy`. Videos that nobody else liked are deleted.

The friend can also self-revoke at <https://myaccount.google.com/permissions>
without going through the admin — their refresh token is invalidated immediately.

---

## How the data flows

`data/videos.json` (written by Actions, daily):

```json
{
  "videoId": "dQw4w9WgXcQ",
  "title": "...",
  "channel": "...",
  "publishedAt": "2009-10-24T19:57:34Z",
  "thumbnail": "https://i.ytimg.com/vi/.../hqdefault.jpg",
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "likedBy": ["riki", "yuji"],
  "likedAt": "2026-05-07T06:00:00Z"
}
```

`data/status.json` (written by Worker on each renewal):

```json
{
  "users": {
    "riki": { "tokenIssuedAt": "2026-05-07T06:12:34Z" }
  },
  "updatedAt": "2026-05-07T06:12:34Z"
}
```

The site computes "days until expiry" as
`7 − (now − tokenIssuedAt)` for the signed-in viewer (and for others,
informationally).

The YouTube API doesn't expose actual like-timestamps, so `likedAt` is
"now" the first time we observe a like, staggered by 1 second per item
within a single fetch to preserve YouTube's most-recent-first order.

---

## Refresh token expiry

`youtube.readonly` is a "sensitive" scope. While the OAuth consent screen
is in **Testing**, refresh tokens expire after **7 days**. Verifying for
production takes 4–6 weeks of bureaucracy and isn't worth it for a small
group.

The Worker turns this from a chore into invisible infrastructure: each
friend just signs in again once a week, takes ~5 seconds, no copy-paste,
no admin involvement. The site gates on it.

If a friend doesn't visit for a few weeks, their entries simply don't
update. Their videos stay in the feed but no new ones come in until they
sign in again.

---

## Privacy

- **GitHub Pages is public by default.** The page is `noindex,nofollow`,
  but anyone with the URL can read the feed. For stronger privacy, use a
  private repo on a paid plan with private Pages, or self-host.
- **The Worker enforces sign-in to access `/me`**, so the Worker won't
  identify random visitors. But it does not gate the static JSON files
  themselves — those are served by GitHub Pages directly. So the JSON is
  effectively as public as the URL.
- **Refresh tokens are sensitive.** They live only in GitHub Secrets
  (encrypted at rest, never echoed in workflow logs) and in transit
  through the Worker (TLS only, never logged).
- **Email allowlist.** The Worker only accepts sign-ins from emails listed
  in `USER_EMAIL_MAP`. Random Google accounts get a polite "not authorized"
  page.
- **Data minimization.** Stored per-video: id, title, channel name,
  thumbnail, who liked it. No emails, no Google profile info, no watch
  history.
- **Self-service revoke.** Any friend can immediately invalidate their
  token at <https://myaccount.google.com/permissions>.

---

## API quota and rate limits

- **YouTube Data API daily quota: 10,000 units** by default.
  - `videos.list?myRating=like` = **1 unit / request**, ≤50 results / page.
  - Script paginates up to `MAX_PAGES=20` (1000 videos cap).
  - 10 friends × 20 pages = ~200 units / day. Effectively unbounded headroom.
- **Token endpoint** isn't on the YouTube quota; one call per friend per run.
- **GitHub API rate limits**: with a fine-grained PAT, 5,000 requests/hour.
  The Worker uses ~3 requests per renewal. Not a concern.
- **Cloudflare Worker free tier**: 100,000 requests/day. Not a concern.
- **GitHub Pages**: ~1 GB repo / 100 GB monthly bandwidth, 10 builds/hour.
  Not a concern.

You can lower `MAX_PAGES` (env var on the Action) if you want each fetch
to be faster.

---

## Local testing

The site:

```bash
# project root
python -m http.server 8000
# then open http://localhost:8000
```

Note: cross-origin fetch to a real Worker requires the site origin to be
in the Worker's `SITE_ORIGIN` env var, plus matching CORS — it's easier
to test the Worker via wrangler dev:

```bash
cd worker
wrangler dev   # http://localhost:8787
```

For the local site to talk to local worker, temporarily set
`workerOrigin` in `data/config.json` to `http://localhost:8787` and add
`http://localhost:8787/callback` to your Google client's authorized
redirect URIs.

The fetch script:

```bash
export GOOGLE_CLIENT_ID=...
export GOOGLE_CLIENT_SECRET=...
export USER_RIKI_REFRESH_TOKEN=...   # your own token
python scripts/fetch_youtube.py
```

`data/videos.json` is rewritten in place. `git diff` shows what changed.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Modal stuck on "サインイン中…" | Popup blocked. The site falls back to full-page redirect — let it. |
| "あなたの Google アカウントは招待されていません" | Email not in `USER_EMAIL_MAP`. Admin: edit `wrangler.toml`, run `wrangler deploy`, ask friend to retry. |
| "Google が refresh token を返しませんでした" | Google reused a prior consent. The friend should revoke at <https://myaccount.google.com/permissions> and try again. The Worker uses `prompt=consent` so this is rare. |
| Workflow logs `error: <id>: token refresh failed (400) invalid_grant` | That friend's token expired or was revoked. They just need to open the site and sign in. |
| Site shows feed but no banner appears even though token old | `data/status.json` not yet populated (no renewal observed). The next sign-in will set it. |
| `ERR_CONNECTION_REFUSED` calling Worker | `workerOrigin` in `data/config.json` doesn't match the deployed Worker URL. |
| GitHub Action fails with "permission denied" on push | The `permissions: contents: write` block in the workflow is required. It's in the template — don't remove it. |
| Worker logs `put secret 422` | The PAT lacks Secrets:write on this repo, or the secret name has invalid characters. |

---

## Why this stack

- **Static site + JSON** — git diff is the audit log; rollback = `git revert`.
- **Daily Actions** — one cron, free for public repos, runs in ~30 seconds.
- **Cloudflare Worker** — single small file, free tier, takes the OAuth-renewal pain out of the friends' lives without introducing a real backend or a database.
- **No framework** — easier to read in 2 years than React-of-the-week.

If the group ever outgrows this (50+ friends, hourly updates, search,
notifications), graduate to a real backend. Until then, fewer moving
parts wins.
