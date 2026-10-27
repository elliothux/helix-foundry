import { createContext, useContext, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, setAdminToken } from "./api";
import { Button } from "./kit/Button";
import { Dialog } from "./kit/Dialog";

const AdminContext = createContext<{
  unlocked: boolean;
  required: boolean | undefined;
  error: string | undefined;
  requestAccess: (next: () => void) => Promise<void>;
}>({
  unlocked: false,
  required: undefined,
  error: undefined,
  requestAccess: async () => {},
});

export const useAdminAccess = () => useContext(AdminContext);

export function AdminAccessProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const policy = useQuery({
    queryKey: ["admin-policy"],
    queryFn: () => api<{ required: boolean }>("/admin"),
    retry: false,
  });
  const [unlocked, setUnlocked] = useState(false);
  const [next, setNext] = useState<() => void>();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  function close() {
    setNext(undefined);
    setToken("");
    setError("");
  }
  async function requestAccess(proceed: () => void) {
    const result = policy.data ?? (await policy.refetch()).data;
    if (result && (!result.required || unlocked)) {
      proceed();
      return;
    }
    setError(result ? "" : "Could not check admin access. Please try again.");
    setNext(() => proceed);
  }
  return (
    <AdminContext.Provider
      value={{
        unlocked,
        required: policy.data?.required,
        error: policy.error?.message,
        requestAccess,
      }}
    >
      {children}
      {next && (
        <Dialog
          title="Admin access"
          description="Enter the admin token to open Settings. Access resets when this tab reloads."
          size="sm"
          onClose={close}
        >
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setPending(true);
              setError("");
              try {
                await api("/admin/verify", { token });
                setAdminToken(token);
                setToken("");
                setUnlocked(true);
                await client.invalidateQueries({ queryKey: ["me"] });
                const proceed = next;
                close();
                proceed();
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Could not verify token",
                );
              } finally {
                setPending(false);
              }
            }}
          >
            <label>
              Admin Token
              <input
                data-autofocus
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={token}
                maxLength={4096}
                required
                onChange={(event) => setToken(event.target.value)}
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <div className="hf-dialog-foot">
              <Button type="button" onClick={close}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                pending={pending}
                disabled={!token || pending}
              >
                Unlock settings
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </AdminContext.Provider>
  );
}

export function AdminSettingsGate({ children }: { children: ReactNode }) {
  const admin = useAdminAccess();
  if (admin.error)
    return <p role="alert">Could not check admin access. Reload to retry.</p>;
  if (admin.required === undefined) return <p>Checking admin access…</p>;
  if (!admin.required || admin.unlocked) return children;
  return (
    <section className="reading-width">
      <h1>Settings</h1>
      <p>Admin access is required.</p>
      <Button onClick={() => void admin.requestAccess(() => {})}>
        Unlock settings
      </Button>
    </section>
  );
}
