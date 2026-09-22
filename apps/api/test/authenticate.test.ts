import type { FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";
import { requireAdminRole } from "../src/plugins/authenticate.js";
import { ForbiddenError, UnauthorizedError } from "../src/lib/errors.js";

/**
 * requireAdminRole was previously referenced by a comment ("see
 * requireAdminRole") that pointed at a function which didn't exist — caught
 * by an audit against the original AUTH-01/ADM-01 acceptance criteria, not
 * by any test, because nothing exercised the "admin without permission"
 * path. These tests exist specifically so that gap can't recur silently.
 */
describe("requireAdminRole", () => {
  function fakeRequest(adminAuth?: { adminId: string; role: "platform_admin" | "support"; sessionVersion: number }) {
    return { adminAuth } as unknown as FastifyRequest;
  }
  const fakeReply = {} as FastifyReply;

  it("allows a role that's in the permitted list", async () => {
    const guard = requireAdminRole("platform_admin", "support");
    const request = fakeRequest({ adminId: "a1", role: "support", sessionVersion: 0 });
    await expect(guard(request, fakeReply)).resolves.toBeUndefined();
  });

  it("rejects a role that's NOT in the permitted list, with 403 — not a silent no-op", async () => {
    const guard = requireAdminRole("platform_admin");
    const request = fakeRequest({ adminId: "a1", role: "support", sessionVersion: 0 });

    await expect(guard(request, fakeReply)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(guard(request, fakeReply)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects if requireAdminAuth never ran (no request.adminAuth) — a wiring bug, not silently allowed", async () => {
    const guard = requireAdminRole("platform_admin", "support");
    await expect(guard(fakeRequest(undefined), fakeReply)).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
