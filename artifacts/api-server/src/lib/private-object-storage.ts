import { Storage } from "@google-cloud/storage";
import type { Readable } from "node:stream";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export type PrivateObjectStorageAdapter = {
  save(path: string, body: Buffer, contentType: string): Promise<void>;
  createReadStream(path: string): Readable;
};

let testAdapter: PrivateObjectStorageAdapter | null = null;

/** Test-only seam: tests never contact App Storage. */
export function setPrivateObjectStorageForTests(
  adapter: PrivateObjectStorageAdapter | null,
): void {
  testAdapter = adapter;
}

function parsePath(path: string): { bucket: string; object: string } {
  const parts = path.replace(/^\/+/, "").split("/");
  if (parts.length < 2 || !parts[0]) {
    throw new Error("PRIVATE_OBJECT_DIR no está configurado correctamente.");
  }
  return { bucket: parts[0], object: parts.slice(1).join("/") };
}

export function privateObjectPath(randomId: string): string {
  const base = process.env.PRIVATE_OBJECT_DIR;
  if (!base) throw new Error("PRIVATE_OBJECT_DIR no está configurado.");
  return `${base.replace(/\/$/, "")}/ine/${randomId}`;
}

export async function savePrivateObject(
  path: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  if (testAdapter) {
    await testAdapter.save(path, body, contentType);
    return;
  }
  const { bucket, object } = parsePath(path);
  await storage.bucket(bucket).file(object).save(body, {
    resumable: false,
    metadata: { contentType, cacheControl: "private, no-store" },
  });
}

export function createPrivateReadStream(path: string) {
  if (testAdapter) return testAdapter.createReadStream(path);
  const { bucket, object } = parsePath(path);
  return storage.bucket(bucket).file(object).createReadStream();
}