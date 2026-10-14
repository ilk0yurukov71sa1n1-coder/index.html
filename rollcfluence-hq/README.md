# Rollcfluence HQ

*Roll up. Stay clean.*

One private app on your Mac that runs the business: finding and contacting customers, analysing their automations, proof reports, clients and money, and keeping an eye on itself. It is built one module at a time; this README grows with each one.

**Built so far:** Module 0 (core, backups, System page) and Module 1 (Outreach), with the new Rollcfluence look. Coming next: Email & Inbox, Health Check, Clients & reports, Money, Today & Weekly review.

## Start it (Mac)

1. Install **Node.js LTS** from <https://nodejs.org> (version 22.13 or newer; 24 recommended). The launcher checks this and opens the download page if needed.
2. Put the `rollcfluence-hq` folder somewhere permanent, e.g. Documents.
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

## Faster: keyboard

| Keys | Does |
|---|---|
| ⌘K or / | Search leads, pages and actions |
| g then t / o / y / , | Today / Outreach / System / Settings |
| n | Add a lead |
| ? | Show all shortcuts |
| Esc | Close a panel |

Animations respect macOS **Reduce motion** (System Settings → Accessibility → Display). The moving background pauses when the tab is hidden.

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
