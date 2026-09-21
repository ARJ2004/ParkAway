import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App.js";
import { clearSession } from "../src/session.js";

function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function mockJsonResponse(body: unknown, ok = true, status = ok ? 200 : 400) {
  return { ok, status, json: async () => body } as Response;
}

describe("Admin login + user search", () => {
  beforeEach(() => {
    clearSession();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a generic error on invalid credentials — never reveals whether the email exists", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse({ error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } }, false, 401)
    );

    renderApp();
    await user.type(screen.getByLabelText(/email/i), "someone@parkaway.local");
    await user.type(screen.getByLabelText(/password/i), "wrong");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
  });

  it("support role sees masked PII in search results", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        mockJsonResponse({ accessToken: "a", refreshToken: "r", expiresIn: 900, adminId: "admin-1", role: "support" })
      )
      .mockResolvedValueOnce(
        mockJsonResponse({
          users: [
            {
              id: "user-1",
              phone: "+91 98******01",
              name: "Test Driver",
              email: "d*****@e******.com",
              status: "active",
              createdAt: new Date().toISOString(),
            },
          ],
        })
      );

    renderApp();
    await user.type(screen.getByLabelText(/email/i), "support@parkaway.local");
    await user.type(screen.getByLabelText(/password/i), "correctpassword");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await screen.findByPlaceholderText(/search by phone/i);
    expect(screen.getByText(/support/i)).toBeInTheDocument(); // role tag in the nav

    await user.type(screen.getByPlaceholderText(/search by phone/i), "9876500001");
    await user.click(screen.getByRole("button", { name: /^search$/i }));

    expect(await screen.findByText("+91 98******01")).toBeInTheDocument();
    expect(screen.getByText("d*****@e******.com")).toBeInTheDocument();
  });

  it("suspend requires a reason before the confirm button is enabled", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        mockJsonResponse({ accessToken: "a", refreshToken: "r", expiresIn: 900, adminId: "admin-1", role: "platform_admin" })
      )
      .mockResolvedValueOnce(
        mockJsonResponse({
          users: [
            {
              id: "user-1",
              phone: "+919876500001",
              name: "Test Driver",
              email: "driver@example.com",
              status: "active",
              createdAt: new Date().toISOString(),
            },
          ],
        })
      );

    renderApp();
    await user.type(screen.getByLabelText(/email/i), "admin@parkaway.local");
    await user.type(screen.getByLabelText(/password/i), "correctpassword");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await user.type(await screen.findByPlaceholderText(/search by phone/i), "9876500001");
    await user.click(screen.getByRole("button", { name: /^search$/i }));

    const row = await screen.findByText("+919876500001");
    await user.click(row);

    await user.click(screen.getByRole("button", { name: /suspend user/i }));

    const dialog = screen.getByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: /confirm/i });
    expect(confirmButton).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/reason/i), "Testing suspend flow");
    await waitFor(() => expect(confirmButton).toBeEnabled());
  });
});
