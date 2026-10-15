# Rollcfluence HQ

*Roll up. Stay clean.*

One private app on your Mac that runs the business: finding and contacting customers, analysing their automations, proof reports, clients and money, and keeping an eye on itself. It is built one module at a time; this README grows with each one.

**Built so far:** Module 0 (core, backups, System page) and Module 1 (Outreach), in the Oxblood design. Coming next: Email & Inbox, Health Check, Clients & reports, Money, Today & Weekly review.

## Start it (Mac)

1. Install **Node.js LTS** from <https://nodejs.org> (version 22.13 or newer; 24 recommended). The launcher checks this and opens the download page if needed.
2. Put the `rollcfluence-hq` folder somewhere permanent: a folder in your home folder such as `~/Rollcfluence` (Finder → Go → Home). Avoid Desktop and Documents if they sync to iCloud, and avoid Dropbox or Google Drive folders: those would copy your data to the cloud.
3. Double-click **`Start HQ.command`**.
   - First time only: macOS may block it. Right-click → **Open** → **Open**.
   - The first start installs and builds (1–2 minutes, needs internet once). Later starts take seconds.
4. Your browser opens at <http://localhost:3900>.
5. To stop, close the Terminal window. Nothing keeps running in the background.

## Outreach (Module 1)

- **Leads:** add, edit and import your tracker as CSV (`name, email, handle/link, platform, what they do, notes`). Export CSV saves everything back, including the next action.
- **Next action** for each lead, computed like your tracker: Message them → Wait for reply → Send follow-up (once, after 3 days) → Run the 5-question interview → Offer the free health check / Ask what would make it a yes / Thank them and close.
- **Messages:** pick one of the 7 templates. Sending is blocked while any `{placeholder}` is unfilled or the lead's first line is empty. **Copy & open** puts the message on your clipboard and opens the profile (Instagram/LinkedIn/X) or your mail app; you send it yourself, then click **Mark sent**. HQ never logs into or automates Instagram, LinkedIn or X.
- **Interview:** the 5 questions (plus "Do clients ask you to prove what your AI did?") with answer boxes. **Save** writes Replied, Pain confirmed and Would pay back to the lead.
- **Verdict:** PASS when pain confirmed ≥ 5 and would pay ≥ 2; KEEP GOING while fewer than 40 people are messaged; otherwise FAIL ("change the angle, don't build more"). Targets are editable under Verdict & targets.
- **Deleting** a lead moves it to **Recently deleted**, where one click brings it back.
- **Delete forever** (only from Recently deleted, with a confirm step) is for erasure requests: it removes the person and their message history, replaces their name in the activity log with "[deleted person]", and rebuilds the database file so nothing can be recovered from it. Only their email address or handle stays, on the do-not-contact list, so they are never contacted again. Backups made before that drop them as they rotate out (14 days).
- **Do not contact** works for email addresses and Instagram/LinkedIn/X handles. Importing a CSV skips anyone on that list, so an old file can't bring back someone who opted out.

## Faster: keyboard

| Keys | Does |
|---|---|
| ⌘K or / | Search leads, pages and actions |
| g then t / o / y / , | Today / Outreach / System / Settings |
| n | Add a lead |
| ? | Show all shortcuts |
| Esc | Close a panel |

Animations respect macOS **Reduce motion** (System Settings → Accessibility → Display). The moving background pauses when the tab is hidden.

## Look and feel

The Oxblood design: warm near-black, bone-white type and deep blood red kept for what matters, set in Fraunces, Geist and Geist Mono. The fonts ship inside the app, so nothing is fetched from the internet. Colours, fonts and every animated component, with sources and licences, are listed in [COMPONENTS.md](COMPONENTS.md).

## Backups and restore

- HQ makes a backup **every time it starts** and **once a day** while it's open, and keeps the **newest 14** in `data/backups/`.
- **System → Back up now** makes one whenever you like.
- **Restore:** System → Backups → **Restore…** next to the backup you want → type `RESTORE` → confirm. Before restoring, HQ saves your current data as a **"pre-restore"** backup, so you can undo a restore the same way.
- **Export everything:** System → **Download all (JSON)**, plus one CSV per kind of data. Good for keeping your own copy.
- To be extra safe, copy the `data/` folder to a USB stick or iCloud Drive now and then.

## The System page

Green, amber or red for: the data store (can it read and write?), the age of the last backup, the email connection (once set up), free disk space, the last error in the error log, plus the app version and commit. Every amber or red line tells you what to do in plain English.

Errors are written to `data/logs/errors.log`. The file rotates at 1 MB and keeps 3 old copies. Passwords, tokens and App-Password-shaped text are removed before anything is written.

## Privacy and security

- Runs only on your Mac (`127.0.0.1`). No cloud database, no analytics, no telemetry (Next.js telemetry is switched off in the launcher and in every npm script). Fonts are bundled, so the page makes no outside requests at all.
- All data lives in `data/hq.sqlite` in this folder. `data/` and `.env.local` are git-ignored and never committed.
- The app refuses requests from other websites and from other addresses (a guard checks the Host and Origin of every request). The page itself may only talk to this local app (Content-Security-Policy `connect-src 'self'`).
- Deleted data is overwritten in the database file (SQLite `secure_delete`), and **Delete forever** rebuilds the file, so erased people can't be recovered from it.
- The only outside connection, once the Email module is added, will be your own mail server.

**Set up your Mac once** (this is what actually protects the data on disk):

1. **FileVault on:** System Settings → Privacy & Security → FileVault. Everything on the disk, including `data/`, is encrypted, so a lost or stolen Mac that is switched off gives nothing away.
2. **A login password and a quick lock:** System Settings → Lock Screen → require a password immediately after the screen saver starts or the display turns off. This protects the Mac while it is on.
3. **Your own copy of the backups:** copy the `data/backups/` folder now and then to an encrypted USB stick (Finder → right-click the drive → Encrypt; a new stick may first need erasing as APFS in Disk Utility) or to iCloud Drive with Advanced Data Protection turned on.
4. **Email (when Module 2 arrives):** turn on 2-Step Verification in your Google account and use an App Password, which you can cancel at any time.

**If someone asks you to erase their data (GDPR):** Outreach → find them → Delete → Recently deleted → **Delete forever**. Tell them it is done; their details leave older backups within 14 days.

## Who can see it

**Today: only you.** HQ runs on your Mac and its data never leaves it. Keep the code private too: on GitHub open the repository → **Settings** → **General** → **Danger Zone** → **Change visibility** → **Make private**. `data/` and `.env.local` are never committed, so the code holds no leads, messages or passwords either way.

**Later: opening it to more people.** HQ is built for one person on purpose. When you have a team or want clients to log in, these are the steps, in order (none are built yet):

1. **Invite helpers to the code:** repository → Settings → Collaborators. They can read and change the code; your data stays on your Mac.
2. **Move the data to a hosted database:** write a second storage class next to `core/sqliteRepo.ts` that implements the same `Repository` interface (`core/repo.ts`), for example on Postgres. No module has to change, because every module talks only to that interface.
3. **Add sign-in and roles:** owner, team member and read-only. The activity log already records every action; it would then also record who did it.
4. **Host it behind HTTPS** with the database provider's own backups, and keep the export button.
5. **Client logins** (on the Later list) come last: a read-only page where each client sees only their own reports.

Once other people's data lives on a server, you become responsible for it: sign data processing agreements with clients, publish a privacy policy, and give everyone their own account rather than a shared password.

## For developers

```bash
npm install
npm run typecheck
npm test           # Node 22.13+ (uses node:sqlite and the built-in test runner)
npm run build && npm start
```

- `core/repo.ts`: the one storage interface (today SQLite via `node:sqlite`, in `core/sqliteRepo.ts`).
- `core/backup.ts`: snapshots (`VACUUM INTO`), the keep-14 rule, and the safe restore order.
- `core/systemChecks.ts`: pure green/amber/red rules. `core/errorLog.ts`: rotating, redacting error log.
- `.github/workflows/ci.yml`: typecheck, tests and build on GitHub when you push this folder as its own repository.

## Later (not built on purpose)

Live webhooks from client automations · Stripe billing · AI-written first lines (would need a paid API key) · client logins · a "Verified" badge · budgets / kill switch (Guard) · mobile app · marketplace.
