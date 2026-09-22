import { Link } from "react-router-dom";
import { useDocumentTitle } from "../lib/theme";

export default function NotFound() {
  useDocumentTitle("Page not found");
  return (
    <main className="fatal">
      <p className="eyebrow">404</p>
      <h1>That page does not exist</h1>
      <p>The link may be out of date. Head back to the workspace.</p>
      <Link className="button button--primary" to="/workspace">
        Open workspace
      </Link>
    </main>
  );
}
