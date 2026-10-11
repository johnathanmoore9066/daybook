import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { BlobPreconditionFailedError, del, get, put } from "@vercel/blob";
import { config } from "./config";
import { EMPTY_STATE, type State } from "./types";

// All dashboard data lives in one small JSON document. A single reader on a personal
// dashboard makes that cheaper and simpler than a database, and etags guard against the
// email bridge and the UI writing at the same moment.

const PREFIX = "daybook";
const STATE_PATH = `${PREFIX}/state.json`;

export class ConflictError extends Error {}
export class StorageNotConfiguredError extends Error {}

export type StoredFile = { stream: ReadableStream<Uint8Array>; contentType: string; size: number };

interface Backend {
  kind: "blob" | "local";
  read(): Promise<{ state: unknown; etag: string | null }>;
  write(json: string, etag: string | null): Promise<void>;
  putFile(name: string, bytes: Uint8Array, contentType: string): Promise<void>;
  getFile(name: string): Promise<StoredFile | null>;
  deleteFiles(names: string[]): Promise<void>;
}

const blobBackend: Backend = {
  kind: "blob",
  async read() {
    const result = await get(STATE_PATH, { access: config.blobAccess, useCache: false });
    if (!result || result.statusCode !== 200) return { state: null, etag: null };
    return { state: await new Response(result.stream).json(), etag: result.blob.etag };
  },
  async write(json, etag) {
    try {
      await put(STATE_PATH, json, {
        access: config.blobAccess,
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: etag !== null,
        ifMatch: etag ?? undefined,
        cacheControlMaxAge: 60,
      });
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError) throw new ConflictError("State changed during write");
      // A first write with allowOverwrite: false fails if another writer created the file first.
      if (etag === null && error instanceof Error && /exists/i.test(error.message)) {
        throw new ConflictError("State created during write");
      }
      throw error;
    }
  },
  async putFile(name, bytes, contentType) {
    await put(`${PREFIX}/${name}`, Buffer.from(bytes), {
      access: config.blobAccess,
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  },
  async getFile(name) {
    const result = await get(`${PREFIX}/${name}`, { access: config.blobAccess });
    if (!result || result.statusCode !== 200) return null;
    return { stream: result.stream, contentType: result.blob.contentType, size: result.blob.size };
  },
  async deleteFiles(names) {
    if (names.length) await del(names.map((n) => `${PREFIX}/${n}`));
  },
};

const LOCAL_ROOT = path.join(process.cwd(), ".data");

const localBackend: Backend = {
  kind: "local",
  async read() {
    const file = path.join(LOCAL_ROOT, "state.json");
    try {
      const [text, info] = await Promise.all([readFile(file, "utf8"), stat(file)]);
      return { state: JSON.parse(text), etag: String(info.mtimeMs) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { state: null, etag: null };
      throw error;
    }
  },
  async write(json, etag) {
    const file = path.join(LOCAL_ROOT, "state.json");
    await mkdir(LOCAL_ROOT, { recursive: true });
    const current = await stat(file).then(
      (s) => String(s.mtimeMs),
      () => null,
    );
    if (current !== etag) throw new ConflictError("State changed during write");
    const temp = `${file}.${process.pid}.tmp`;
    await writeFile(temp, json);
    await rename(temp, file);
  },
  async putFile(name, bytes) {
    const file = path.join(LOCAL_ROOT, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
  },
  async getFile(name) {
    const file = path.join(LOCAL_ROOT, name);
    try {
      const bytes = await readFile(file);
      return {
        stream: new Response(bytes).body!,
        contentType: name.endsWith(".pdf") ? "application/pdf" : "application/octet-stream",
        size: bytes.length,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  },
  async deleteFiles(names) {
    await Promise.all(names.map((n) => rm(path.join(LOCAL_ROOT, n), { force: true })));
  },
};

export function storageKind(): "blob" | "local" | "missing" {
  if (config.blobToken) return "blob";
  return config.onVercel ? "missing" : "local";
}

function backend(): Backend {
  const kind = storageKind();
  if (kind === "missing") {
    throw new StorageNotConfiguredError(
      "No storage is connected. Add a Vercel Blob store to this project so BLOB_READ_WRITE_TOKEN is set.",
    );
  }
  return kind === "blob" ? blobBackend : localBackend;
}

function normalize(raw: unknown): State {
  const data = (raw && typeof raw === "object" ? raw : {}) as Partial<State>;
  return {
    version: 1,
    shifts: data.shifts ?? [],
    daysOff: data.daysOff ?? [],
    reminders: data.reminders ?? [],
    feedDone: data.feedDone ?? [],
    reports: data.reports ?? [],
  };
}

export async function readState(): Promise<State> {
  const { state } = await backend().read();
  return state ? normalize(state) : structuredClone(EMPTY_STATE);
}

/** Read-modify-write with optimistic concurrency. `mutate` may run more than once on conflict. */
export async function updateState<T>(mutate: (draft: State) => T): Promise<T> {
  const store = backend();
  for (let attempt = 1; ; attempt++) {
    const { state, etag } = await store.read();
    const draft = normalize(state);
    const result = mutate(draft);
    try {
      await store.write(JSON.stringify(draft), etag);
      return result;
    } catch (error) {
      if (!(error instanceof ConflictError) || attempt >= 4) throw error;
    }
  }
}

export const files = {
  put: (name: string, bytes: Uint8Array, contentType: string) => backend().putFile(name, bytes, contentType),
  get: (name: string) => backend().getFile(name),
  delete: (names: string[]) => backend().deleteFiles(names),
};

export const reportFileName = (id: string) => `reports/${id}.pdf`;
