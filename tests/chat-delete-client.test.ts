import { afterEach, expect, it, vi } from "vitest";
import { api, setAdminToken } from "../apps/web/src/api.js";
import { deleteChat } from "../apps/web/src/areas/analyst/chat-data.js";

afterEach(() => {
  setAdminToken("");
  vi.unstubAllGlobals();
});

it("sends the unlocked admin token when deleting a chat, without an empty JSON body", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
    Response.json({ ok: true }),
  );
  vi.stubGlobal("fetch", fetch);
  setAdminToken("test-admin-token");
  await deleteChat("workspace", "chat/id");
  expect(fetch).toHaveBeenCalledWith(
    "/api/v1/workspaces/workspace/threads/chat%2Fid",
    expect.objectContaining({
      method: "DELETE",
      credentials: "same-origin",
      headers: { "x-foundry-admin-token": "test-admin-token" },
      body: undefined,
    }),
  );
});

it("clears admin credentials on lock and surfaces deletion errors", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
    Response.json({ error: "Read-only access" }, { status: 403 }),
  );
  vi.stubGlobal("fetch", fetch);
  setAdminToken("test-admin-token");
  setAdminToken("");
  await expect(deleteChat("workspace", "chat")).rejects.toThrow("Read-only access");
  expect(fetch.mock.calls[0][1]?.headers).toEqual({});
});

it("still labels JSON request bodies as JSON", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
    Response.json({ ok: true }),
  );
  vi.stubGlobal("fetch", fetch);
  await api("/example", { name: "value" });
  expect(fetch.mock.calls[0][1]).toMatchObject({
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "value" }),
  });
});
