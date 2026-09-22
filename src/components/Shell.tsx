import { useEffect, useRef, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { useApp } from "../state/app";
import { Skeleton } from "./ui";

const NAV = [
  { to: "/workspace", label: "Workspace", glyph: "W" },
  { to: "/intake", label: "Intake", glyph: "I" },
  { to: "/reports", label: "Reports", glyph: "R" },
  { to: "/settings", label: "Settings", glyph: "S" },
];

/** Gate for every signed-in route. */
export function RequireAuth() {
  const { phase } = useApp();
  const location = useLocation();
  if (phase === "booting") return <div className="splash" role="status">Loading FlowDesk…</div>;
  if (phase === "signed-out") return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Shell />;
}

function Shell() {
  const { session, phase, error, reload, signOut } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const main = useRef<HTMLElement>(null);
  const section = location.pathname.split("/")[1];
  const firstRender = useRef(true);

  // Close the drawer on navigation and Escape.
  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Move focus to the page when the section changes, so keyboard and screen-reader users land on the new content.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    main.current?.focus({ preventScroll: true });
  }, [section]);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="shell">
        <aside className={`sidebar${menuOpen ? " is-open" : ""}`}>
          <div className="sidebar__top">
            <NavLink className="brand" to="/workspace" aria-label="FlowDesk workspace">
              <img src="/favicon.svg" alt="" width="34" height="34" />
              <span>
                <strong>FlowDesk</strong>
                <small>{session?.workspace ?? "Service operations"}</small>
              </span>
            </NavLink>
            <button
              className="menu-toggle"
              type="button"
              aria-expanded={menuOpen}
              aria-controls="product-nav"
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>

          <nav className="side-nav" id="product-nav" aria-label="Product">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to}>
                <span aria-hidden="true">{item.glyph}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="account">
            <span className="avatar" aria-hidden="true">
              {(session?.name ?? "?").slice(0, 2).toUpperCase()}
            </span>
            <div>
              <strong>{session?.name}</strong>
              <small>{session?.email}</small>
              <button type="button" className="link-button" onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
            <p className="account__demo">Demo build. Data is stored in this browser only.</p>
          </div>
        </aside>

        <main id="main" ref={main} tabIndex={-1} className="main">
          {phase === "loading" ? (
            <div className="page">
              <Skeleton rows={6} />
            </div>
          ) : phase === "error" ? (
            <div className="page">
              <div className="empty" role="alert">
                <strong>We could not load the workspace</strong>
                <p>{error}</p>
                <button className="button button--primary" type="button" onClick={() => void reload()}>
                  Try again
                </button>
              </div>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </>
  );
}
