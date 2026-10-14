# Rollcfluence HQ

*Roll up. Stay clean.*

One private app on your Mac that runs the business: finding and contacting customers, analysing their automations, proof reports, clients and money, and keeping an eye on itself. It is built one module at a time; this README grows with each one.

**Built so far:** Module 0 (core, backups, System page). Coming next: Outreach, Email & Inbox, Health Check, Clients & reports, Money, Today & Weekly review.

## Start it (Mac)

1. Install **Node.js LTS** from <https://nodejs.org> (version 22.13 or newer; 24 recommended). The launcher checks this and opens the download page if needed.
2. Put the `rollcfluence-hq` folder somewhere permanent, e.g. Documents.
3. Double-click **`Start HQ.command`**.
   - First time only: macOS may block it. Right-click → **Open** → **Open**.
   - The first start installs and builds (1–2 minutes, needs internet once). Later starts take seconds.
4. Your browser opens at <http://localhost:3900>.
5. To stop, close the Terminal window. Nothing keeps running in the background.

## Backups and restore

- HQ makes a backup **every time it starts** and **once a day** while it's open, and keeps the **newest 14** in `data/backups/`.
- **System → Back up now** makes one whenever you like.
- **Restore:** System → Backups → **Restore…** next to the backup you want → type `RESTORE` → confirm. Before restoring, HQ saves your current data as a **"pre-restore"** backup, so you can undo a restore the same way.
- **Export everything:** System → **Download all (JSON)**, plus one CSV per kind of data. Good for keeping your own copy.
- To be extra safe, copy the `data/` folder to a USB stick or iCloud Drive now and then.

## The System page

Green, amber or red for: the data store (can it read and write?), the age of the last backup, the email connection (once set up), free disk space, the last error in the error log, plus the app version and commit. Every amber or red line tells you what to do in plain English.

Errors are written to `data/logs/errors.log`. The file rotates at 1 MB and keeps 3 old copies. Passwords, tokens and App-Password-shaped text are removed before anything is written.

## Privacy

- Runs only on your Mac (`127.0.0.1`). No cloud database, no analytics, no telemetry (Next.js telemetry is switched off in the launcher).
- All data lives in `data/hq.sqlite` in this folder. `data/` and `.env.local` are git-ignored and never committed.
- The app refuses requests from other websites. The page itself may only talk to this local app (Content-Security-Policy `connect-src 'self'`).
- The only outside connection, once the Email module is added, will be your own mail server.

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
