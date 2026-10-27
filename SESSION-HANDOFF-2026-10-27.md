# Handoff — 27 Oct 2026: Google sign-in

Written for whoever picks this repo up on another machine, and for the next
Claude session in that folder. The durable project record stays in `CLAUDE.md`;
this file is only what a **pull cannot give you** plus what happened today.

Delete this file once the work below is finished. It is a note, not documentation.

---

## 1. Get the code

```
git clone https://github.com/dpakkaushikdev/DanceOS.git
cd DanceOS
```

The repo is `dpakkaushikdev/DanceOS`, branch `main`, and it **auto-deploys to
production on every push** through Vercel (`dpakkaushikdev/danceos` →
https://danceos-sigma.vercel.app). There is no staging branch. Treat a push as a
deploy.

⚠ If you clone into a folder that already holds an older copy, check
`git remote -v` first. The old account's repo is `dpakkaushik/dancestudio` and
nothing may be pushed there. On the machine this was written from, the remotes
are `origin` → DanceOS and `old-origin` → the retired one.

### ⚠ Pushing will probably fail the first time, and the error names the wrong thing

The global gitconfig routes github.com credentials through the **GitHub CLI**:

```
credential.https://github.com.helper = !'C:\Program Files\GitHub CLI\gh.exe' auth git-credential
```

and `gh auth status` reports it logged in as **`dpakkaushik`**, the retired
account. Setting `credential.https://github.com.username` to `dpakkaushikdev`
does not help — the helper ignores it, and git then asks for a password it has
no way to get. In a non-interactive shell that surfaces as
`could not read Password for 'https://dpakkaushikdev@github.com'`, which reads
like a missing password rather than the wrong account. Windows Credential
Manager is empty for the new account too, despite an older note saying a token
was stored there.

What works, and what this session's push actually used: the token already in
`.env.local` as **`NEW_GITHUB_TOKEN`** (a `github_pat_` fine-grained token,
verified as `dpakkaushikdev` with push rights on DanceOS). Push with a one-off
authenticated URL so nothing is written to disk:

```bash
TOKEN=$(grep -m1 '^NEW_GITHUB_TOKEN=' .env.local | cut -d= -f2- | tr -d '\r\n" ')
git push "https://x-access-token:${TOKEN}@github.com/dpakkaushikdev/DanceOS.git" main:main
```

Never put that token in a remote URL you save, and never commit it. The better
long-term fix is `gh auth login` as `dpakkaushikdev` on the new machine, which
makes a plain `git push` work again.

## 2. Carry these across by hand — they are NOT in git

| File | Why it is not committed | Where to get it |
|---|---|---|
| `.env.local` | every secret the app has | copy from the old machine privately (USB, not email, not the repo) |
| `android/android.keystore` | signs the Android app; losing control of it means anyone can ship updates | only on the PC that built v1.1.0 (Sep) and v1.2.0 (27 Oct): `C:\Users\Admin\Downloads\dancestudio\danceos-android\android.keystore`, and since 27 Oct also copied into that PC's clone at `android/` (gitignored) |
| `android/keystore-credentials.txt` | its password | same folder |

`.env.local.example` **is** committed and documents every key by name, so use it
as the checklist when copying. Nothing in it holds a value.

## 3. Install and run

There is no `pnpm` on PATH on the old machine, and a plain `npm install` crashes
on the pnpm-shaped `node_modules`. Use:

```
corepack pnpm@10 install      # dependencies
npm run dev                   # the app on :3000
npm run typecheck             # tsc --noEmit
npm run lint
npm run build
npm run guard:leftovers       # no test rows left in the live DB
npm run audit:reads
```

Node 24 and npm 11 are what this was built and verified on. ⚠ Node 25 (the
keystore PC) ships no `corepack` at all — `npx -y pnpm@10 install` does the same
job there.

⚠ If `npm run typecheck` reports syntax errors inside
`.next/dev/types/routes.d.ts`, that is a stale generated file, not your code.
`rm -rf .next` and run it again. Running `next build` while `next dev` is live
wedges the same directory.

## 4. What this session changed

Full detail is the top block of `CLAUDE.md`, "GOOGLE IS THE ONLY DOOR". In short:

* **Google is the only visible way into the app.** The welcome screen is one
  button. The two old ones went to the email and password screens.
* **Those password screens still answer on their own addresses and are simply
  unlinked.** This is deliberate and must not be "tidied up": 57 files mint
  their sessions through `admin/generate_link` — 5 e2e specs, 21 shoots, 29 RLS
  proofs, the seeder and the email auth proof. Turning the Supabase **Email
  provider** off returns `email_provider_disabled` and kills all of them at
  once, exactly as the already-disabled Phone provider kills `rls-proof-classes`
  and two `paid-webhook` tests.
* New files: `app/auth/callback/route.ts`, `features/auth/components/GoogleButton.tsx`,
  `features/auth/server-actions/google.ts`, `lib/auth/googleAvatar.ts`,
  `lib/auth/googleIdentity.ts`, `repositories/avatars.ts`.
* Earlier in the same session, the account move was finished off: remotes
  renamed, and the retired host `dancestudio-orcin.vercel.app` removed from
  `.env.local.example` and four scripts.

## 5. Console state — already done, do not redo

**Google Cloud**, in the project the breadcrumb calls *Maps Platform Demo
Project*:

* OAuth client, type Web application. Its one authorized redirect URI is
  `https://gfpxbmanxkmhmrzfbqqw.supabase.co/auth/v1/callback`.
* Consent screen published, In production, External. Scopes `openid`,
  `userinfo.email`, `userinfo.profile` — all non-sensitive, so the 100-user cap
  does not apply and no "unverified app" screen appears.
* Authorized domains: `danceos-sigma.vercel.app` **alone**. ⚠ `supabase.co` is
  refused with "must be a top private domain", because Supabase has it on the
  Public Suffix List exactly as Vercel does with `vercel.app`. It is not needed.

**Supabase**, project `gfpxbmanxkmhmrzfbqqw`:

* Authentication → Providers → Google: on, with the client ID and secret.
* Authentication → Providers → Email: **on, and must stay on** (see §4).
* Authentication → URL Configuration:

```
Site URL:       https://danceos-sigma.vercel.app
Redirect URLs:  https://danceos-sigma.vercel.app/**
                http://localhost:3000/**
                http://localhost:3100/**
```

⚠ **That last block is the whole game, and getting it wrong looks like a code
bug.** Before those entries existed, Google authenticated the person correctly
and they landed on the *password* screen of the live site, while the local dev
server logged zero requests to `/auth/callback`. Supabase had discarded the
return address and fallen back to its default, which pointed at `/auth/confirm`
— the emailed-link route — which correctly refused a code it cannot exchange.
If you add a new origin (a preview URL, another port), add it here or sign-in
will fail in exactly that misleading way.

⚠ And do not trust `GET /auth/v1/authorize?provider=google&redirect_to=…` as a
check. It answers 302 to Google for **any** address, including a bogus one. It
validates on the way back.

## 6. Still open

1. ~~**Rebuild the Android APK**~~ — ✅ DONE 27 Oct 2026 on the keystore PC:
   `android/danceos-1.2.0.apk` and `.aab` (versionCode 3), signed with the
   **same** key (`19:F2:A9:B2:…`, checked with `apksigner verify --print-certs`
   against the live `assetlinks.json`), the new DosMark on the launcher. The
   gotchas met on the way are in the top block of `CLAUDE.md`. ⚠ Not yet
   installed on a phone — see 6.
2. **Move the OAuth client out of the Maps demo project** before real users
   arrive. A demo project is a poor home for production login, and the Maps key
   in it already has no billing and has blown its quota repeatedly. Moving it
   later means a new client ID, re-pasting into Supabase, and a window where
   sign-in is broken.
3. ~~**Regenerate the app icons.**~~ — ✅ DONE 27 Oct 2026 (`9e29fcf`):
   `scripts/icons/make-icons.js` draws `DosMark`'s colours now and the four
   PNGs were re-cut from it; 1.2.0 carries them.
4. **Re-register the Cashfree webhook** on
   `https://danceos-sigma.vercel.app/api/webhooks/cashfree`. It is still
   registered against the old host.
5. **Sign in once with `deepak@eeetaxi.com`** (Google Workspace) and the other
   Gmail accounts. Only `deepakkaushik8919@gmail.com` has actually been through
   the flow, so identity linking for pre-existing accounts is unproven.
6. **Google OAuth inside the TWA** is untested. Chrome Custom Tabs should pass
   where an embedded WebView is refused, but nobody has run it on a phone.
   The APK to run it with is `android/danceos-1.2.0.apk` (27 Oct 2026): it
   must install over 1.1.0 without an uninstall, open full screen with no
   address bar, and complete Continue with Google.
