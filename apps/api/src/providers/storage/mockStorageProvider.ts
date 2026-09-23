import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { env } from "../../env.js";
import { getCurrentRequestOrigin } from "./requestOrigin.js";
import type { PresignedUpload, StorageClass, StorageProvider } from "./types.js";

/**
 * The current request's own origin when available (correct for any client —
 * see requestOrigin.ts), falling back to `STORAGE_MOCK_BASE_URL`'s configured
 * origin only when called outside a request lifecycle.
 */
function mockStorageBaseUrl(): string {
  const requestOrigin = getCurrentRequestOrigin();
  return requestOrigin ? `${requestOrigin}/mock-storage` : env.STORAGE_MOCK_BASE_URL;
}

/**
 * Doesn't talk to S3 — writes to a local directory and serves it back over
 * plain (unsigned) dev routes instead. Real presign/expiry/ownership
 * enforcement in the calling services still runs against this the same as
 * it would against S3 (tech-stack.md §8), so the flow being tested is
 * realistic except for actual cloud storage.
 *
 * Structurally blocked from running in production: see the boot guard in
 * env.ts, which refuses to start the process at all if STORAGE_PROVIDER=mock
 * while NODE_ENV=production.
 */
export class MockStorageProvider implements StorageProvider {
  async getUploadUrl(storageClass: StorageClass, key: string, contentType: string): Promise<PresignedUpload> {
    return {
      uploadUrl: `${mockStorageBaseUrl()}/upload/${storageClass}/${key}`,
      requiredHeaders: { "Content-Type": contentType },
      expiresIn: env.PRESIGNED_UPLOAD_TTL_SECONDS,
    };
  }

  async getDownloadUrl(storageClass: StorageClass, key: string, _ttlSeconds: number): Promise<string> {
    return `${mockStorageBaseUrl()}/download/${storageClass}/${key}`;
  }

  publicUrl(key: string): string {
    return `${mockStorageBaseUrl()}/public/${key}`;
  }

  async delete(storageClass: StorageClass, key: string): Promise<void> {
    await rm(resolveMockPath(storageClass, key), { force: true });
  }
}

function resolveMockPath(storageClass: StorageClass, key: string): string {
  // Reject any key that could escape STORAGE_MOCK_DIR via `..` segments —
  // keys are always server-generated (see lib/storageKey.ts), but this is a
  // dev filesystem write path and cheap to keep honest regardless.
  const safeKey = key.split("/").filter((segment) => segment !== "" && segment !== "." && segment !== "..").join("/");
  return path.resolve(process.cwd(), env.STORAGE_MOCK_DIR, storageClass, safeKey);
}

/**
 * Dev-only routes backing the mock provider's presigned URLs: an actual PUT
 * writes bytes to disk, and GET reads them back — so the presign → PUT →
 * complete path (and a deliberately-failing PUT, per Divya's QA plan §4.3)
 * is exercised for real rather than stubbed out. Registered from app.ts only
 * when STORAGE_PROVIDER=mock.
 */
export async function registerMockStorageRoutes(app: FastifyInstance): Promise<void> {
  // Only route family in the app that accepts a non-JSON body — public/private
  // S3 uploads never pass through Fastify in real deployments (rule 8); this
  // exists purely so local dev/CI can simulate that PUT without real S3.
  app.addContentTypeParser("*", { parseAs: "buffer" }, (_req, body, done) => done(null, body));

  app.put<{ Params: { storageClass: string; "*": string } }>(
    "/mock-storage/upload/:storageClass/*",
    async (request, reply) => {
      const { storageClass } = request.params;
      const key = request.params["*"];
      if (storageClass !== "public" && storageClass !== "private") {
        return reply.code(400).send({ error: { code: "INVALID_STORAGE_CLASS", message: "storageClass must be public or private" } });
      }
      const filePath = resolveMockPath(storageClass, key);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, request.body as Buffer);
      return reply.code(200).send({ ok: true });
    }
  );

  for (const storageClass of ["public", "private"] as const) {
    app.get<{ Params: { "*": string } }>(`/mock-storage/${storageClass === "public" ? "public" : "download/private"}/*`, async (request, reply) => {
      const key = request.params["*"];
      try {
        const data = await readFile(resolveMockPath(storageClass, key));
        return reply.code(200).send(data);
      } catch {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Object not found" } });
      }
    });
  }

  app.get<{ Params: { "*": string } }>("/mock-storage/download/public/*", async (request, reply) => {
    const key = request.params["*"];
    try {
      const data = await readFile(resolveMockPath("public", key));
      return reply.code(200).send(data);
    } catch {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Object not found" } });
    }
  });
}
