# Automation Health Check, by Rollcfluence

*Roll up. Stay clean.*

Drop in your automation run history (n8n, Make, Zapier or any CSV/JSON export). You'll see how reliable your automations are, which ones are failing silently, what that costs, and you can print a one-page client report.

## Privacy

**Your file never leaves this computer.** It is read and analysed inside your browser tab. There are no uploads, no database, no accounts and no analytics. Nothing is saved: close the tab and the data is gone. The app runs only on `127.0.0.1` (your own Mac). Its Content-Security-Policy (`connect-src 'self'`) stops the page from sending data to any other server.

## Start it from Finder (Mac)

1. Install **Node.js LTS** from <https://nodejs.org> (one time only).
2. Put this `automation-health-check` folder wherever you like, e.g. in Documents.
3. Double-click **`Start Health Check.command`**.
   - The first time, macOS may say it is from an unidentified developer. Right-click the file, choose **Open**, then **Open** again. You only need to do this once.
   - The first start installs and builds the app (about 1–2 minutes, needs internet once to download packages). Later starts take a few seconds.
4. Your browser opens at <http://localhost:3737>.
5. To stop it, close the Terminal window (or press Ctrl+C). Nothing keeps running in the background.

## Run it from Terminal

```bash
npm install
npm run build
npm start          # http://localhost:3737
```

## Using it

1. **Import:** drop a CSV or JSON file, or press **Load sample data** (fictional, about 3,000 runs).
2. **Match columns:** pick which columns hold the workflow name, start time and status. Optional columns: duration, end time, output items, cost and error. The app remembers your choice until you close the tab. You can also choose which status values count as success.
3. **Dashboard:** risk score, success rate, silent failures, wasted money and hours, a 30-day trend, top problems and a table for each workflow. Open **How we calculate this** to see every formula.
4. **Client report:** press **Save as PDF**. It uses your browser's print dialog and fits on one page.

## For developers

```bash
npm run typecheck   # TypeScript strict
npm test            # unit tests (Node 22.6+)
npm run make-big-file  # writes big-sample-200k.csv for load testing
```

- `lib/analyze.ts`: all calculations (pure functions, unit-tested)
- `lib/parse.ts`: CSV/JSON parsing, column guessing, dates, statuses
- `lib/sample.ts`: deterministic sample data with planted silent failures
- `lib/analysis.worker.ts`: parsing and analysis run in a Web Worker, so large files never freeze the page
- `components/`: screens. Charts are plain SVG; there are no UI or chart libraries.
