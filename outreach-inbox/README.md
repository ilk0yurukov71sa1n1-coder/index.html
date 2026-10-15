# Outreach Inbox, by Rollcfluence

*Roll up. Stay clean.*

A private outreach tracker that runs on your Mac and replaces the Excel sheet. Add leads and send personalised emails from your own account. Replies show up live. Instagram, LinkedIn and X messages are prepared for you to send yourself.

## Two ways to use it

- **Live web version (nothing to install):** open your private Outreach Inbox page on claude.ai. It sends from the Gmail account connected to your claude.ai account (Settings → Connectors → Gmail) and saves your leads in the page's own private store, which only you can read. Replies are checked every 2 minutes while the page is open; only the lead's own reply counts, not messages you add to the thread yourself. Same rules as below: dry-run first, daily cap, sending hours, one follow-up, opt-outs.
- **Mac app (this folder):** runs fully on your Mac with a Gmail App Password. Follow the steps below.

The two versions keep separate data. Use Export CSV / Import CSV to move leads between them.

## 1. Install Node.js (one time)

Open Terminal and type `node -v`. If it prints `v22` or higher, you're done. Otherwise download the **LTS** installer from <https://nodejs.org> and run it. The launcher also checks this and opens the download page if needed.

## 2. Create your Gmail App Password (one time, about 3 minutes)

Gmail doesn't let apps use your normal password. Instead you create a separate 16-letter **App Password**, which you can cancel at any time.

1. Go to <https://myaccount.google.com/security>.
2. Under **How you sign in to Google**, turn on **2-Step Verification** if it isn't on already. Google requires this for App Passwords.
3. Go to <https://myaccount.google.com/apppasswords> (or search "App passwords" in your Google Account).
4. Type a name such as `Outreach Inbox` and press **Create**.
5. Google shows a 16-letter code like `abcd efgh ijkl mnop`. Copy it. You'll only see it once, but you can always make a new one.
6. In Gmail, check that IMAP is on: **Settings → See all settings → Forwarding and POP/IMAP → Enable IMAP → Save**.

To revoke access later, delete the App Password on that same page.

**Other providers:** use your normal SMTP/IMAP details. The setup asks for host and port when the address isn't Gmail.

## 3. Start the app from Finder

1. Put the `outreach-inbox` folder anywhere, e.g. in Documents.
2. Double-click **`Start Outreach Inbox.command`**.
   - The first time, macOS may say it's from an unidentified developer. Right-click the file, choose **Open**, then **Open** again.
   - The first start installs and builds the app (1–2 minutes, needs internet once). It then asks **"Set up email now?"**: enter your Gmail address and paste the App Password. Nothing you type is shown on screen.
3. Your browser opens at <http://localhost:3838>.
4. Go to **Settings**, enter your own email address and press **Test connection**.
5. To stop, close the Terminal window. Nothing keeps running in the background.

You can redo the email setup any time: in Terminal, `cd` into the folder and run `npm run setup-email`.

## Safe by default

- **Dry-run is ON** until you switch it off in Settings. In dry-run every email goes only to your own address with `[TEST]` in the subject.
- **Daily cap:** 10 emails by default, never more than 30.
- **Sending hours:** only 09:00–19:00 Sofia time.
- **At least 3 minutes between emails.** The top bar shows *Sent today: x / cap*.
- **Personalised or nothing:** a message can't be sent while any `{placeholder}` is unfilled or the lead's first line is empty.
- **Every email ends with** your name, Rollcfluence, and "Reply 'no thanks' and I won't email again."
- **One follow-up per lead, at most.** It comes due 3 days after the first email if there's no reply, and waits in **Inbox → Follow-ups** for you to approve or cancel. A reply cancels it.
- **Suppression list:** a reply containing "no thanks", "unsubscribe" or "stop", or your clicking **Do not contact**, means that address is never emailed again.
- **Instagram, LinkedIn and X are never automated.** The app copies your message and opens the profile; you send it yourself and click **Mark sent**. The app doesn't log in, scrape or send DMs, because automated DMs break those sites' rules and get accounts banned.

## Your first real test (2 minutes)

1. Settings: dry-run on, your own address filled in, **Test connection** passes.
2. Leads → **Add lead** (any name and email, plus a first line) → **Send test to my inbox**.
3. In Gmail, reply to the `[TEST]` email.
4. Inbox → **Check now** (or wait up to 2 minutes). Your reply appears and the lead shows **Replied = Y**.
5. When you're happy, Settings → **Turn off dry-run**.

## Privacy

- Runs only on your Mac (`127.0.0.1`). No cloud database, no analytics, no accounts.
- The only outside connection is to your own mail server, to send emails and read replies.
- Leads and history are stored in `data/outreach.json`, written safely with a backup at `data/outreach.json.bak`.
- Your password lives only in `.env.local`, readable only by your user account. It's never shown in the app, never logged, never sent to the browser, and git ignores it.
- The app refuses requests from other websites, and the page can't connect anywhere except this local app.

## Look and feel

The Oxblood design shared with Rollcfluence HQ: warm near-black, bone-white type, deep blood red for what matters, set in Fraunces, Geist and Geist Mono. The fonts ship inside the app, so nothing is fetched from the internet. Animations switch off when macOS **Reduce motion** is on. Sources and licences: [COMPONENTS.md](COMPONENTS.md).

## Import from your Excel tracker

Save your sheet as CSV with these columns: `name, email, handle/link, platform, what they do, notes`. Optional: `company, first line`. Then go to Leads → **Import CSV**. **Export CSV** saves everything back, including the next action.

## The 14-day verdict

- **PASS** when pain confirmed ≥ 5 **and** would pay ≥ 2.
- **KEEP GOING** while fewer than 40 people are messaged.
- Otherwise **FAIL**: change the angle, don't build more.

You can change these targets in Settings.

## Later

- **Google sign-in (OAuth)** instead of an App Password is a possible future option. It isn't needed for v1.

## For developers

```bash
npm run typecheck
npm test            # unit tests (Node 22.6+)
npm run build && npm start
```

- `lib/rules.ts`: caps, quiet hours, follow-ups, suppression, reply matching, verdict
- `lib/templates.ts`: templates and placeholder blocking
- `lib/engine.ts`: sending, replies and follow-ups (shared by the app and the preview)
- `lib/server/`: Gmail/SMTP/IMAP, the inbox check and the request guard
