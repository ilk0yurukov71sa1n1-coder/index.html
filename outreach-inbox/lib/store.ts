import { mkdir, readFile, rename, writeFile, copyFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Store } from "./types.ts";
import { emptyStore } from "./defaults.ts";

export { emptyStore };

/** Local JSON file store. Writes are atomic (temp file + rename) and serialised; the previous version is kept as .bak. */
export class JsonStore {
  private queue: Promise<unknown> = Promise.resolve();
  readonly path: string;
  constructor(path: string) {
    this.path = path;
  }

  async read(): Promise<Store> {
    let text: string;
    try {
      text = await readFile(this.path, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return emptyStore();
      throw e;
    }
    const data = JSON.parse(text) as Partial<Store>;
    const base = emptyStore();
    return {
      ...base,
      ...data,
      settings: { ...base.settings, ...data.settings, targets: { ...base.settings.targets, ...data.settings?.targets } },
      templates: data.templates?.length ? data.templates : base.templates,
    };
  }

  private async write(store: Store): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, JSON.stringify(store, null, 2), { encoding: "utf8", mode: 0o600 });
    await copyFile(this.path, `${this.path}.bak`).catch(() => undefined);
    await rename(tmp, this.path);
  }

  /** Read-modify-write, one at a time, so two requests can never overwrite each other. */
  update<T>(fn: (s: Store) => T | Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const s = await this.read();
      const result = await fn(s);
      await this.write(s);
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }
}
