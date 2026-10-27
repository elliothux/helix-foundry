import { afterEach, beforeEach, expect, it } from "vitest";
import { createApp } from "../apps/api/src/app.js";
import { config } from "../apps/api/src/config.js";
import { MemoryStore } from "../apps/api/src/store.js";

const original = config.adminToken;
let app: Awaited<ReturnType<typeof createApp>>;
let scope: string;
const token = "fixture-admin-token-not-for-production";
const headers = { "x-foundry-admin-token": token };
beforeEach(async () => {
  config.adminToken = token;
  app = await createApp(new MemoryStore());
  const me = (await app.inject("/api/v1/me")).json();
  scope = me.workspaces[0].id;
});
afterEach(async () => {
  await app.close();
  config.adminToken = original;
});

it("keeps visitors read-only and protects settings and token management server-side", async () => {
  const me = (await app.inject("/api/v1/me")).json();
  expect(me.workspaces[0].role).toBe("viewer");
  expect((await app.inject("/api/v1/admin")).json()).toEqual({
    required: true,
  });
  for (const path of ["tokens", "provider/pull"]) {
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/api/v1/workspaces/${scope}/${path}`,
          payload: {},
        })
      ).statusCode,
    ).toBe(403);
  }
  const url = `/api/v1/workspaces/${scope}/settings`;
  const payload = {
    brandName: "Demo",
    dailyTokens: 0,
    ontologyGraphMaxEntities: 32,
  };
  expect((await app.inject({ method: "PUT", url, payload })).statusCode).toBe(
    403,
  );
  expect(
    (
      await app.inject({
        method: "PUT",
        url,
        payload,
        headers: { "x-foundry-admin-token": "wrong" },
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (await app.inject({ method: "PUT", url, payload, headers })).statusCode,
  ).toBe(200);
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/v1/workspaces",
        payload: { name: "Forbidden" },
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (await app.inject({ url: "/api/v1/me", headers })).json().workspaces[0]
      .role,
  ).toBe("owner");
});

it("verification checks the token without granting a persistent session", async () => {
  const url = "/api/v1/admin/verify";
  expect(
    (await app.inject({ method: "POST", url, payload: { token: "wrong" } }))
      .statusCode,
  ).toBe(401);
  const valid = await app.inject({ method: "POST", url, payload: { token } });
  expect(valid.statusCode).toBe(200);
  expect(valid.headers["set-cookie"]).toBeUndefined();
  expect((await app.inject("/api/v1/me")).json().workspaces[0].role).toBe(
    "viewer",
  );
});

it("keeps existing local mode when the environment token is unset", async () => {
  config.adminToken = "";
  expect((await app.inject("/api/v1/admin")).json()).toEqual({
    required: false,
  });
  expect((await app.inject("/api/v1/me")).json().workspaces[0].role).toBe(
    "owner",
  );
});

it("does not let an admin header elevate an explicitly read-only API token", async () => {
  const issued = await app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${scope}/tokens`,
    headers,
    payload: { name: "Read only", readOnly: true },
  });
  expect(issued.statusCode).toBe(200);
  const response = await app.inject({
    method: "PUT",
    url: `/api/v1/workspaces/${scope}/settings`,
    headers: { ...headers, authorization: `Bearer ${issued.json().token}` },
    payload: {
      brandName: "Forbidden",
      dailyTokens: 0,
      ontologyGraphMaxEntities: 32,
    },
  });
  expect(response.statusCode).toBe(403);
});

it("limits repeated verification attempts", async () => {
  for (let i = 0; i < 10; i++)
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/admin/verify",
          payload: { token: "wrong" },
        })
      ).statusCode,
    ).toBe(401);
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/v1/admin/verify",
        payload: { token: "wrong" },
      })
    ).statusCode,
  ).toBe(429);
});
