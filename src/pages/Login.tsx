import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useApp } from "../state/app";
import { useDocumentTitle } from "../lib/theme";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  useDocumentTitle("Sign in");
  const { phase, signIn } = useApp();
  const location = useLocation();
  const [errors, setErrors] = useState<{ email?: string; workspace?: string }>({});
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: string } | null)?.from;
  const destination = from && from !== "/login" ? from : "/workspace";

  if (phase !== "signed-out" && phase !== "booting") return <Navigate to={destination} replace />;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const workspace = String(data.get("workspace") ?? "").trim();
    const next = {
      email: EMAIL.test(email) ? undefined : "Enter a valid email address.",
      workspace: workspace ? undefined : "Enter a workspace name.",
    };
    setErrors(next);
    if (next.email || next.workspace) return;

    setBusy(true);
    try {
      // Once the session exists, the <Navigate> above sends the user on to their destination.
      await signIn({ email, workspace });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <section className="login__panel" aria-labelledby="login-title">
        <div className="brand brand--static">
          <img src="/favicon.svg" alt="" width="34" height="34" />
          <span>
            <strong>FlowDesk</strong>
            <small>Service operations</small>
          </span>
        </div>
        <p className="eyebrow">Workspace entry</p>
        <h1 id="login-title">Open the handoff console</h1>
        <p className="login__lead">Review queues, route ownership, and close service handoffs from one operating workspace.</p>

        <form onSubmit={onSubmit} noValidate className="form">
          <label className="field">
            <span id="email-label">Email</span>
            <input name="email" aria-labelledby="email-label" type="email" defaultValue="ops@flowdesk.local" autoComplete="email" aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} />
            {errors.email ? <em id="email-error" className="field__error">{errors.email}</em> : null}
          </label>
          <label className="field">
            <span id="workspace-label">Workspace</span>
            <input name="workspace" aria-labelledby="workspace-label" type="text" defaultValue="FlowDesk Ops" autoComplete="organization" aria-invalid={!!errors.workspace} aria-describedby={errors.workspace ? "workspace-error" : undefined} />
            {errors.workspace ? <em id="workspace-error" className="field__error">{errors.workspace}</em> : null}
          </label>
          <button className="button button--primary button--block" type="submit" disabled={busy}>
            {busy ? "Opening workspace…" : "Enter FlowDesk"}
          </button>
          <p className="hint">Demo build: there is no password and no account is created. Your data stays in this browser.</p>
        </form>
      </section>

      <aside className="login__aside" aria-label="What FlowDesk does">
        <p className="eyebrow">Built for handoffs</p>
        <h2>Nothing slips between teams</h2>
        <ul>
          <li><strong>Route</strong><span>Requests land with the right owner and a clear deadline.</span></li>
          <li><strong>Decide</strong><span>Approvals and billing holds wait in one visible queue.</span></li>
          <li><strong>Close</strong><span>Every handoff ends with a note the account team can trust.</span></li>
        </ul>
      </aside>
    </main>
  );
}
