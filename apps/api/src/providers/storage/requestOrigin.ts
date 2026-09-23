import { AsyncLocalStorage } from "node:async_hooks";
import type { FastifyInstance } from "fastify";

/**
 * The mock storage provider's URLs must resolve for whichever host the
 * client actually used to reach the API — `localhost` for a browser on the
 * same machine, the dev machine's LAN IP for a phone/emulator (the same
 * distinction `EXPO_PUBLIC_API_URL` already has to get right — see
 * apps/driver-mobile/.env.example). A single hardcoded `STORAGE_MOCK_BASE_URL`
 * silently breaks for every OTHER kind of client (this is exactly the bug a
 * device-testing pass caught: photos loaded fine on driver-web but were
 * unreachable `localhost` URLs on a phone).
 *
 * Deriving it from the current request's own `Host` header instead —
 * threaded via `AsyncLocalStorage` rather than adding a `request` parameter
 * to every storage-touching service function — makes it correct
 * automatically for any client, with no per-environment configuration to
 * remember or get out of sync. Dev/mock-only: production's `S3StorageProvider`
 * returns real absolute S3/CloudFront URLs that need none of this.
 */
const requestOriginStorage = new AsyncLocalStorage<string>();

export function registerRequestOriginTracking(app: FastifyInstance): void {
  app.addHook("onRequest", async (request) => {
    const protocol = request.protocol;
    const host = request.headers.host ?? request.hostname;
    requestOriginStorage.enterWith(`${protocol}://${host}`);
  });
}

/** Falls back to `STORAGE_MOCK_BASE_URL`'s origin only when called outside a request (e.g. a script) — never during normal request handling. */
export function getCurrentRequestOrigin(): string | undefined {
  return requestOriginStorage.getStore();
}
