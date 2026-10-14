/**
 * The one storage interface every module uses. Today it is SQLite (node:sqlite);
 * swapping storage later means writing another class that implements this.
 */

export interface HqEvent {
  id: number;
  /** ISO time */
  at: string;
  /** e.g. "lead.added", "email.sent", "backup.created", "settings.changed" */
  type: string;
  /** One plain-English line for the activity list. */
  summary: string;
  data: Record<string, unknown> | null;
}

export interface NewEvent {
  type: string;
  summary: string;
  data?: Record<string, unknown> | null;
  at?: string;
}

export interface Repository {
  /** One record, or null. */
  get<T>(collection: string, id: string): T | null;
  /** All records in a collection, oldest first. */
  list<T>(collection: string): T[];
  put<T>(collection: string, id: string, value: T): void;
  remove(collection: string, id: string): boolean;
  collections(): string[];
  /** Runs fn atomically: all writes inside succeed together or none do. */
  transaction<R>(fn: () => R): R;
  appendEvent(e: NewEvent): HqEvent;
  events(opts?: { limit?: number; type?: string; since?: string }): HqEvent[];
  /** Quick self-test: can we write, read back and delete? */
  probe(): { ok: true } | { ok: false; error: string };
  /** Consistent snapshot of everything into a new file. */
  snapshotTo(file: string): void;
  close(): void;
}
