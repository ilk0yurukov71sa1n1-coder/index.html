import * as React from "react";
import type { Entry, Settings } from "./tax";

/* Thin typed view of the artifact runtime (window.claude.use). Everything is
   optional: outside the Claude viewer the page still renders, read-only. */
type Snap = { id: string; exists: boolean; data(): Record<string, unknown> | undefined };
type QSnap = { docs: Snap[] };
type DocRef = { set(d: object): Promise<void>; delete(): Promise<void> };
type ColRef = { doc(id?: string): DocRef & { id: string }; onSnapshot(n: (s: QSnap) => void, e?: (err: { code: string }) => void): () => void };
type DB = { collection(p: string): ColRef };
type Assets = { upload(b: Blob, o?: { type?: string }): Promise<{ id: string; url: string; sizeBytes: number; contentType: string }>; delete(id: string): Promise<{ deleted: boolean }> };
type User = { id(): Promise<string | null> };
type Downloads = { save(r: { filename: string; data: string | Blob }): Promise<unknown> };
type Runtime = { use(name: string): Promise<unknown> };

const rt = () => (window as unknown as { claude?: Runtime }).claude;

export const DEFAULT_SETTINGS: Settings = { startDate: "2026-11-01", sickness: false };

export type Status = "loading" | "ready" | "readonly";

export function useLedger() {
  const [status, setStatus] = React.useState<Status>("loading");
  const [entries, setEntries] = React.useState<Entry[]>([]);
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const api = React.useRef<{ col: ColRef | null; assets: Assets | null; downloads: Downloads | null }>({ col: null, assets: null, downloads: null });

  React.useEffect(() => {
    let off: (() => void) | undefined, dead = false;
    (async () => {
      const c = rt();
      if (!c?.use) { setStatus("readonly"); return; }
      const [user, db, assets, downloads] = (await Promise.all(["user", "db", "assets", "downloads"].map((n) => c.use(n).catch(() => null)))) as [User | null, DB | null, Assets | null, Downloads | null];
      const uid = user ? await user.id().catch(() => null) : null;
      if (dead) return;
      api.current.assets = assets;
      api.current.downloads = downloads;
      if (!db || !uid) { setStatus("readonly"); return; }
      // Each person's records live in their own private subtree.
      const col = db.collection("data/users/" + uid);
      api.current.col = col;
      off = col.onSnapshot(
        (snap) => {
          const list: Entry[] = [];
          let s: Settings | null = null;
          for (const d of snap.docs) {
            const body = d.data();
            if (!body) continue;
            if (d.id === "settings") s = body as unknown as Settings;
            else list.push({ ...(body as unknown as Entry), id: d.id });
          }
          list.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
          setEntries(list);
          setSettings(s);
          setStatus("ready");
        },
        (e) => { setError(e.code === "revoked" ? null : "Връзката с базата прекъсна. Презареди страницата."); setStatus("readonly"); },
      );
    })();
    return () => { dead = true; off?.(); };
  }, []);

  const save = React.useCallback(async (e: Omit<Entry, "id"> & { id?: string }) => {
    const col = api.current.col;
    if (!col) throw new Error("Няма връзка с базата.");
    const ref = e.id ? col.doc(e.id) : col.doc();
    const { id: _drop, ...body } = e;
    void _drop;
    await ref.set(JSON.parse(JSON.stringify({ ...body, createdAt: body.createdAt ?? new Date().toISOString() })));
  }, []);

  const remove = React.useCallback(async (e: Entry) => {
    const col = api.current.col;
    if (!col) return;
    await col.doc(e.id).delete();
    for (const d of e.docs ?? []) await api.current.assets?.delete(d.id).catch(() => null);
  }, []);

  const saveSettings = React.useCallback(async (s: Settings) => {
    const col = api.current.col;
    if (!col) throw new Error("Няма връзка с базата.");
    await col.doc("settings").set({ ...s });
  }, []);

  const upload = React.useCallback(async (f: File) => {
    const a = api.current.assets;
    if (!a) throw new Error("Качването на файлове не е налично тук.");
    const type = f.type || (/\.pdf$/i.test(f.name) ? "application/pdf" : /\.png$/i.test(f.name) ? "image/png" : /\.jpe?g$/i.test(f.name) ? "image/jpeg" : "");
    try {
      const r = await a.upload(f, type ? { type } : undefined);
      return { id: r.id, name: f.name, type: r.contentType, size: r.sizeBytes };
    } catch (err) {
      const code = (err as { code?: string }).code;
      throw new Error(
        code === "too_large" ? `${f.name} е над 20 MB.` :
        code === "unsupported_type" ? `${f.name}: качи PDF, JPG, PNG или WEBP.` :
        code === "quota_or_state" ? "Мястото за файлове е запълнено." :
        `${f.name} не се качи. Опитай пак.`,
      );
    }
  }, []);

  const download = React.useCallback(async (filename: string, data: string) => {
    const d = api.current.downloads;
    if (!d) throw new Error("Изтеглянето не е налично тук.");
    await d.save({ filename, data });
  }, []);

  return { status, entries, settings: settings ?? DEFAULT_SETTINGS, hasSettings: !!settings, error, save, remove, saveSettings, upload, download, canUpload: () => !!api.current.assets, canDownload: () => !!api.current.downloads };
}

export const blobUrl = (id: string) => "/_blob/" + id;
