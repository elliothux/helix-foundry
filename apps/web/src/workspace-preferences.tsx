import type { ReactNode } from "react";
import { BrandContext } from "./brand";
import { useQuery } from "@tanstack/react-query";
import type { WorkspaceSettings } from "../../../packages/shared/src";
import { api } from "./api";
import { useAction, useWorkspace } from "./ui";

export function useWorkspaceSettings() {
  const { id } = useWorkspace();
  return useQuery({
    queryKey: [id, "settings"],
    queryFn: () => api<WorkspaceSettings>(`/workspaces/${id}/settings`),
  });
}

export function WorkspaceBrand({ children }: { children: ReactNode }) {
  const settings = useWorkspaceSettings();
  return (
    <BrandContext.Provider value={settings.data?.brandName ?? ""}>
      {children}
    </BrandContext.Provider>
  );
}

export function WorkspacePreferences() {
  const { id, role } = useWorkspace(),
    action = useAction(),
    settings = useWorkspaceSettings();
  if (settings.isPending) return <p>Loading workspace settings…</p>;
  if (settings.error) return <p role="alert">{settings.error.message}</p>;
  return (
    <section className="panel settings-panel reading-width">
      <form
        key={JSON.stringify(settings.data)}
        className="pad"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void action.run(
            () =>
              api(
                `/workspaces/${id}/settings`,
                {
                  brandName: String(form.get("brandName") ?? ""),
                  dailyTokens: Number(form.get("dailyTokens")),
                  ontologyGraphMaxEntities: Number(
                    form.get("ontologyGraphMaxEntities"),
                  ),
                },
                "PUT",
              ),
            "Workspace settings saved",
          );
        }}
      >
        <fieldset
          className="plain-fieldset"
          disabled={role !== "owner" || action.pending}
        >
          <legend>Limits & display</legend>
          <label>
            Brand name
            <input
              name="brandName"
              maxLength={80}
              defaultValue={settings.data.brandName}
              placeholder="Helix Foundry"
              aria-describedby="brand-name-help"
            />
          </label>
          <p id="brand-name-help" className="muted">
            Used in navigation and browser tab titles for this workspace. Leave
            blank to use Helix Foundry.
          </p>
          <label>
            Daily AI token limit
            <input
              type="number"
              name="dailyTokens"
              min={0}
              step={1}
              required
              defaultValue={settings.data.dailyTokens}
              aria-describedby="daily-token-help"
            />
          </label>
          <p id="daily-token-help" className="muted">
            0 means unlimited. Chat and background AI share this limit per UTC
            day. Usage is still recorded and your API provider bills actual use.
          </p>
          <label>
            Ontology graph entity threshold
            <input
              type="number"
              name="ontologyGraphMaxEntities"
              min={0}
              step={1}
              required
              defaultValue={settings.data.ontologyGraphMaxEntities}
              aria-describedby="ontology-graph-help"
            />
          </label>
          <p id="ontology-graph-help" className="muted">
            Above this count, entity cards replace the full graph. 0 disables
            the count threshold; large graphs take longer to lay out. Narrow
            windows still use cards with a compact relationship map.
          </p>
          <button className="button" disabled={action.pending}>
            Save workspace settings
          </button>
        </fieldset>
      </form>
    </section>
  );
}
