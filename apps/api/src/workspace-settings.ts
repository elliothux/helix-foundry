import { WorkspaceSettingsSchema } from "../../../packages/shared/src/index.js";
import { config } from "./config.js";
import { assert } from "./security.js";
import type { Store } from "./store.js";

export async function workspaceSettings(store: Store, scope: string) {
  const workspace = await store.get(scope, "workspace");
  assert(workspace, "Workspace not found", 404);
  return WorkspaceSettingsSchema.parse({
    ...config.workspaceDefaults,
    ...workspace.data.settings,
  });
}
