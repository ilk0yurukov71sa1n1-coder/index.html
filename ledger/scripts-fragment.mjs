// Turns dist/index.html into the fragment the artifact host expects
// (it adds its own doctype, html, head and body).
import { readFileSync, writeFileSync } from "node:fs";
const html = readFileSync("dist/index.html", "utf8");
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const title = head.match(/<title>[\s\S]*?<\/title>/)[0];
const styles = head.match(/<style[\s\S]*?<\/style>/g) ?? [];
const scripts = head.match(/<script[\s\S]*?<\/script>/g) ?? [];
const out = [title, '<meta name="claude:viewport-fit-sides" content="cover">', ...styles, body.replace(/<script[^>]*src="\/src\/main.tsx"[^>]*><\/script>/, ""), ...scripts].join("\n");
writeFileSync(process.argv[2] ?? "dist/ledger.html", out);
console.log("fragment", out.length, "bytes");
