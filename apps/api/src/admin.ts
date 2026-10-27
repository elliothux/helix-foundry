import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "./config.js";
import { assert, digest } from "./security.js";

function matches(value: unknown) {
  return (
    typeof value === "string" &&
    !!config.adminToken &&
    timingSafeEqual(
      Buffer.from(digest(value)),
      Buffer.from(digest(config.adminToken)),
    )
  );
}

export function isAdminRequest(req: { headers: Record<string, unknown> }) {
  return !config.adminToken || matches(req.headers["x-foundry-admin-token"]);
}

export function registerAdmin(app: FastifyInstance) {
  app.get("/api/v1/admin", async () => ({ required: !!config.adminToken }));
  app.post(
    "/api/v1/admin/verify",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (req) => {
      const { token } = z
        .object({ token: z.string().min(1).max(4096) })
        .parse(req.body);
      assert(config.adminToken, "Admin token is not configured", 503);
      assert(matches(token), "Invalid admin token", 401);
      return { ok: true };
    },
  );
}
