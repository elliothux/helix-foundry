import { afterEach, beforeEach, expect, it } from "vitest";
import { createApp } from "../apps/api/src/app.js";
import { config } from "../apps/api/src/config.js";
import { MemoryStore, transaction } from "../apps/api/src/store.js";
import { WorkspaceSettingsSchema } from "../packages/shared/src/index.js";

let store: MemoryStore,
  app: Awaited<ReturnType<typeof createApp>>,
  scope: string;
const defaults = { ...config.workspaceDefaults };
beforeEach(async () => {
  store = new MemoryStore();
  app = await createApp(store);
  await app.ready();
  const me = (await app.inject("/api/v1/me")).json();
  scope = me.workspaces[0].id;
});
afterEach(async () => {
  config.workspaceDefaults = { ...defaults };
  await app.close();
});

it("uses deployment defaults until workspace settings are saved, then persists overrides", async () => {
  config.workspaceDefaults = {
    brandName: "",
    dailyTokens: 75000,
    ontologyGraphMaxEntities: 24,
  };
  const url = `/api/v1/workspaces/${scope}/settings`;
  expect((await app.inject(url)).json()).toEqual(config.workspaceDefaults);
  const workspace = (await store.get(scope, "workspace"))!;
  const saved = { brandName: "", dailyTokens: 0, ontologyGraphMaxEntities: 0 };
  const response = await app.inject({ method: "PUT", url, payload: saved });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual(saved);
  expect((await store.get(scope, "workspace"))?.data).toMatchObject({
    ...workspace.data,
    settings: saved,
  });
  config.workspaceDefaults = {
    brandName: "",
    dailyTokens: 1000,
    ontologyGraphMaxEntities: 16,
  };
  expect((await app.inject(url)).json()).toEqual(saved);
});

it("rejects invalid limits without changing the workspace", async () => {
  const url = `/api/v1/workspaces/${scope}/settings`;
  for (const field of ["dailyTokens", "ontologyGraphMaxEntities"]) {
    for (const value of [-1, 1.5, null, "unlimited"]) {
      const response = await app.inject({
        method: "PUT",
        url,
        payload: {
          dailyTokens: 0,
          ontologyGraphMaxEntities: 32,
          [field]: value,
        },
      });
      expect(response.statusCode).toBe(400);
    }
  }
  expect((await store.get(scope, "workspace"))?.data.settings).toBeUndefined();
  expect(
    WorkspaceSettingsSchema.parse({ dailyTokens: 100_000_000 }).dailyTokens,
  ).toBe(100_000_000);
});

it("allows editors to read settings but reserves changes for the owner", async () => {
  const me = (await app.inject("/api/v1/me")).json();
  await transaction(store, "global", async (tx) => {
    const member = (await tx.get(`${me.user.id}:${scope}`))!;
    tx.update(member, { ...member.data, role: "editor" });
  });
  const url = `/api/v1/workspaces/${scope}/settings`;
  expect((await app.inject(url)).statusCode).toBe(200);
  expect(
    (
      await app.inject({
        method: "PUT",
        url,
        payload: {
          dailyTokens: 0,
          ontologyGraphMaxEntities: 0,
        },
      })
    ).statusCode,
  ).toBe(403);
});

it("saves a trimmed brand per workspace and restores the default with blank input", async () => {
  const url = `/api/v1/workspaces/${scope}/settings`;
  const other = (
    await app.inject({
      method: "POST",
      url: "/api/v1/workspaces",
      payload: { name: "Other" },
    })
  ).json();
  for (const [input, expected] of [
    ["  澄岳能源  ", "澄岳能源"],
    ["   ", ""],
    ["", ""],
  ]) {
    const response = await app.inject({
      method: "PUT",
      url,
      payload: {
        brandName: input,
        dailyTokens: 1000,
        ontologyGraphMaxEntities: 24,
      },
    });
    expect(response.statusCode).toBe(200);
    expect((await app.inject(url)).json()).toEqual({
      brandName: expected,
      dailyTokens: 1000,
      ontologyGraphMaxEntities: 24,
    });
    expect(
      (await app.inject(`/api/v1/workspaces/${other.id}/settings`)).json()
        .brandName,
    ).toBe("");
  }
});

it("rejects invalid brand names without saving settings", async () => {
  const url = `/api/v1/workspaces/${scope}/settings`;
  for (const brandName of ["x".repeat(81), null, 123]) {
    const response = await app.inject({
      method: "PUT",
      url,
      payload: { brandName },
    });
    expect(response.statusCode).toBe(400);
  }
  expect((await store.get(scope, "workspace"))?.data.settings).toBeUndefined();
});
