import { appendFileSync, existsSync, mkdirSync, renameSync, statSync, readFileSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";

/** Values from the environment that must never be written anywhere. */
export function secretValues(env: Record<string, string | undefined> = process.env): string[] {
  return Object.entries(env)
    .filter(([k, v]) => v && v.length >= 6 && /(PASS|SECRET|TOKEN|KEY|AUTH)/i.test(k))
    .map(([, v]) => v!)
    .flatMap((v) => [v, v.replace(/\s+/g, "")]);
}

/** Removes secrets and secret-looking text before anything is logged. */
export function redact(text: string, secrets: string[] = []): string {
  let out = text;
  for (const s of [...new Set(secrets)].sort((a, b) => b.length - a.length)) {
    if (s.length >= 6) out = out.split(s).join("[redacted]");
  }
  return out
    .replace(/((?:pass(?:word)?|secret|token|api[_-]?key|authorization)\s*[=:]\s*)("[^"]*"|'[^']*'|\S+)/gi, "$1[redacted]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/g, "Bearer [redacted]")
    .replace(/\b[a-z]{4} [a-z]{4} [a-z]{4} [a-z]{4}\b/g, "[redacted]") // Google App Password format
    .replace(/\b(sk|pk|rk)_(live|test)_[A-Za-z0-9]{8,}/g, "[redacted]");
}

export interface LoggedError {
  at: string;
  where: string;
  message: string;
}

/** Error log in a local file. Rotates at maxBytes, keeping `keep` old files. */
export class ErrorLog {
  readonly file: string;
  private maxBytes: number;
  private keep: number;
  constructor(file: string, opts: { maxBytes?: number; keep?: number } = {}) {
    this.file = file;
    this.maxBytes = opts.maxBytes ?? 1_000_000;
    this.keep = opts.keep ?? 3;
  }

  write(where: string, err: unknown, now = new Date()): LoggedError {
    const raw = err instanceof Error ? `${err.message}${err.stack ? "\n" + err.stack.split("\n").slice(1, 6).join("\n") : ""}` : String(err);
    const entry: LoggedError = { at: now.toISOString(), where, message: redact(raw, secretValues()) };
    if (!existsSync(dirname(this.file))) mkdirSync(dirname(this.file), { recursive: true });
    if (existsSync(this.file) && statSync(this.file).size >= this.maxBytes) this.rotate();
    appendFileSync(this.file, JSON.stringify(entry) + "\n", { mode: 0o600 });
    return entry;
  }

  private rotate() {
    const last = `${this.file}.${this.keep}`;
    if (existsSync(last)) unlinkSync(last);
    for (let i = this.keep - 1; i >= 1; i--) if (existsSync(`${this.file}.${i}`)) renameSync(`${this.file}.${i}`, `${this.file}.${i + 1}`);
    renameSync(this.file, `${this.file}.1`);
  }

  last(): LoggedError | null {
    if (!existsSync(this.file)) return null;
    const lines = readFileSync(this.file, "utf8").trim().split("\n").filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        return JSON.parse(lines[i]!) as LoggedError;
      } catch {
        // skip a damaged line
      }
    }
    return null;
  }
}
