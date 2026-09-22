import { Component, type ErrorInfo, type ReactNode } from "react";
import { clearAllLocalData } from "../api/client";

// A stale tab after a new deploy (or dev-server restart) can no longer fetch its lazy page chunks.
const STALE_CHUNK = /dynamically imported module|Loading chunk|Importing a module script failed|error loading dynamically/i;
const RELOAD_FLAG = "flowdesk.chunk-reload";

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; detail: string }> {
  state = { failed: false, detail: "" };

  static getDerivedStateFromError(error: unknown) {
    return { failed: true, detail: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // A real deployment would forward this to error monitoring.
    console.error("FlowDesk crashed", error, info.componentStack);
    if (STALE_CHUNK.test(error.message)) {
      try {
        // Once per 10 seconds, so a genuinely broken deploy cannot cause a reload loop.
        const last = Number(sessionStorage.getItem(RELOAD_FLAG) ?? 0);
        if (Date.now() - last > 10_000) {
          sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
          window.location.reload();
        }
      } catch {
        /* fall back to the manual reload button */
      }
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="fatal" role="alert">
        <h1>Something went wrong</h1>
        <p>FlowDesk hit an unexpected error. Reloading usually fixes it. If it keeps happening, the data saved in this browser may be damaged: clear it and start again from the demo data.</p>
        <p className="fatal__detail">{this.state.detail}</p>
        <div className="action-row">
          <button className="button button--primary" type="button" onClick={() => window.location.reload()}>
            Reload FlowDesk
          </button>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => {
              clearAllLocalData();
              window.location.assign("/login");
            }}
          >
            Clear saved data
          </button>
        </div>
      </main>
    );
  }
}
