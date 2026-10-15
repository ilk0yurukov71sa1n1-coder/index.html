/**
 * Writes big-sample-200k.csv (about 200,000 fictional runs) for testing large imports.
 * Usage: npm run make-big-file
 */
import { writeFileSync } from "node:fs";
import { generateSample, toCSV } from "../lib/sample.ts";

const { table } = generateSample({ days: 2060 });
writeFileSync("big-sample-200k.csv", toCSV(table));
console.log(`Wrote big-sample-200k.csv with ${table.rows.length.toLocaleString("en-GB")} rows`);
