#!/usr/bin/env node
/**
 * Asks for your email login and saves it to .env.local (readable only by you, never committed).
 * The password is typed hidden and is never printed.
 */
import { createInterface } from "node:readline";
import { writeFileSync, existsSync, readFileSync, chmodSync } from "node:fs";

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY });
// While muted (password entry), nothing you type is echoed to the screen.
let muted = false;
const write = rl._writeToOutput?.bind(rl);
if (write) rl._writeToOutput = (s) => { if (!muted || s.includes("\n")) write(muted ? "\n" : s); };
const input = rl[Symbol.asyncIterator]();
const ask = async (q) => {
  process.stdout.write(q);
  const r = await input.next();
  return (r.value ?? "").trim();
};
const askHidden = async (q) => {
  process.stdout.write(q);
  muted = true;
  const r = await input.next();
  muted = false;
  if (!process.stdin.isTTY) process.stdout.write("\n");
  return (r.value ?? "").replace(/\s+/g, "");
};

console.log("\nEmail setup for Outreach Inbox");
console.log("------------------------------");
console.log("For Gmail you need an App Password (16 letters). See README.md, section 'Create your Gmail App Password'.\n");

if (existsSync(".env.local") && /MAIL_USER=/.test(readFileSync(".env.local", "utf8"))) {
  const again = await ask("An email account is already set up. Replace it? (y/N) ");
  if (!/^y/i.test(again)) {
    rl.close();
    process.exit(0);
  }
}

const user = await ask("Your email address: ");
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(user)) {
  console.log("That doesn't look like an email address. Nothing was saved.");
  rl.close();
  process.exit(1);
}
const name = (await ask("Your name for the From line [Ilko]: ")) || "Ilko";
const gmail = /@(gmail|googlemail)\.com$/i.test(user);
let lines = [`MAIL_USER=${user}`, `MAIL_FROM_NAME=${name}`];
if (!gmail) {
  console.log("\nNot a Gmail address: enter your provider's server settings (ask your provider or check their help pages).");
  lines.push(`SMTP_HOST=${await ask("SMTP host (e.g. smtp.example.com): ")}`);
  lines.push(`SMTP_PORT=${(await ask("SMTP port [465]: ")) || "465"}`);
  lines.push(`IMAP_HOST=${await ask("IMAP host (e.g. imap.example.com): ")}`);
  lines.push(`IMAP_PORT=${(await ask("IMAP port [993]: ")) || "993"}`);
}
const pass = await askHidden(gmail ? "Gmail App Password (16 letters, spaces are fine): " : "Password or app password: ");
rl.close();
if (!pass) {
  console.log("No password entered. Nothing was saved.");
  process.exit(1);
}
lines.push(`MAIL_APP_PASSWORD="${pass.replace(/"/g, "")}"`);
writeFileSync(".env.local", "# Outreach Inbox email login. Private: never share or commit this file.\n" + lines.join("\n") + "\n", { mode: 0o600 });
chmodSync(".env.local", 0o600);
console.log("\nSaved to .env.local (only your user account can read it).");
console.log("Next: open the app, go to Settings and press 'Test connection'.\n");
