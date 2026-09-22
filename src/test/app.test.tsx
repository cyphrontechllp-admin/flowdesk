import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, describe, expect, it } from "vitest";
import App from "../App";
import { setLatency } from "../api/client";
import { AppProvider } from "../state/app";
import { ToastProvider } from "../state/toast";

beforeAll(() => setLatency(0));

function renderApp(route = "/") {
  window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

async function signIn(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: /enter flowdesk/i }));
  await screen.findByRole("heading", { name: /escalations before handoff/i });
}

describe("FlowDesk app", () => {
  it("redirects signed-out visitors to login and validates the form", async () => {
    const user = userEvent.setup();
    renderApp("/reports");
    const email = await screen.findByLabelText("Email");
    await user.clear(email);
    await user.type(email, "nope");
    await user.click(screen.getByRole("button", { name: /enter flowdesk/i }));
    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
  });

  it("signs in, opens a handoff, and only closes it with a note", async () => {
    const user = userEvent.setup();
    renderApp("/");
    await signIn(user);

    await user.click(await screen.findByRole("link", { name: /FD-1047/ }));
    const packet = await screen.findByRole("article");
    expect(within(packet).getByRole("heading", { name: /Revenue export added/ })).toBeInTheDocument();

    await user.click(within(packet).getByRole("button", { name: /close handoff/i }));
    expect(await within(packet).findByText(/add a resolution note/i)).toBeInTheDocument();

    await user.type(within(packet).getByLabelText("Note"), "Estimate approved by client");
    await user.click(within(packet).getByRole("button", { name: /close handoff/i }));
    await waitFor(() => expect(within(screen.getByRole("article")).getByRole("button", { name: /reopen handoff/i })).toBeInTheDocument());
  });

  it("logs a new request from intake and lands on it", async () => {
    const user = userEvent.setup();
    renderApp("/");
    await signIn(user);

    await user.click(screen.getAllByRole("link", { name: "Intake" })[0]!);
    await user.click(await screen.findByRole("button", { name: /add to board/i }));
    expect(await screen.findByText("Enter the client or account name.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Client"), "Acme Corp");
    await user.type(screen.getByLabelText("Request details"), "Renewal payment failed for the account");
    expect(screen.getByText(/Billing queue/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /add to board/i }));

    const packet = await screen.findByRole("article");
    expect(within(packet).getByText("FD-1060")).toBeInTheDocument();
    expect(within(packet).getAllByText(/Acme Corp/).length).toBeGreaterThan(0);
  });

  it("returns to the deep link after signing in", async () => {
    const user = userEvent.setup();
    renderApp("/workspace/FD-1047");
    await user.click(await screen.findByRole("button", { name: /enter flowdesk/i }));
    expect(await screen.findByRole("heading", { name: /Revenue export added/ })).toBeInTheDocument();
  });

  it("keeps every character when typing quickly into search", async () => {
    const user = userEvent.setup({ delay: null });
    renderApp("/");
    await signIn(user);
    const box = await screen.findByRole("searchbox", { name: /search handoffs/i });
    await user.type(box, "harbor");
    expect(box).toHaveValue("harbor");
    await waitFor(() => expect(screen.getAllByRole("link", { name: /FD-/ })).toHaveLength(1));
  });

  it("opens intake even when saved settings are damaged", async () => {
    localStorage.setItem("flowdesk.settings.v1", JSON.stringify({ team: [], routing: { risk: { owner: "x", keywords: null }, approval: null }, slaHours: {} }));
    localStorage.setItem("flowdesk.session.v1", JSON.stringify({ name: "T", email: "t@t.co", workspace: "W" }));
    renderApp("/intake");
    expect(await screen.findByRole("heading", { name: /log a client signal/i })).toBeInTheDocument();
    expect(screen.getByText(/Where this will land/i)).toBeInTheDocument();
  });

  it("shows a friendly page for unknown routes", async () => {
    renderApp("/does-not-exist");
    expect(await screen.findByRole("heading", { name: /does not exist/i })).toBeInTheDocument();
  });
});
