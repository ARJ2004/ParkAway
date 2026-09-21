import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App.js";
import { clearSession } from "../src/session.js";

function renderApp(initialEntries: string[] = ["/"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function mockJsonResponse(body: unknown, ok = true, status = ok ? 200 : 400) {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe("Driver onboarding flow", () => {
  beforeEach(() => {
    clearSession();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("phone entry -> OTP request -> OTP screen shows the entered number", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValueOnce(mockJsonResponse({ status: "sent" }));

    renderApp(["/"]);

    await user.type(screen.getByLabelText(/mobile number/i), "9876543210");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(await screen.findByText(/enter the code/i)).toBeInTheDocument();
    expect(screen.getByText(/9876543210/)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/v1/auth/otp/request",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ phone: "9876543210" }) })
    );
  });

  it("a new user completing OTP verification lands on the skippable onboarding wizard, not straight to home", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockJsonResponse({ status: "sent" }))
      .mockResolvedValueOnce(
        mockJsonResponse({
          accessToken: "access-token",
          refreshToken: "refresh-token",
          expiresIn: 900,
          isNewUser: true,
          userId: "user-1",
        })
      );

    renderApp(["/"]);
    await user.type(screen.getByLabelText(/mobile number/i), "9876543210");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await screen.findByText(/enter the code/i);
    const digitInputs = screen.getAllByRole("textbox");
    for (let i = 0; i < 6; i++) {
      await user.type(digitInputs[i], String((i + 1) % 10));
    }
    await user.click(screen.getByRole("button", { name: /verify/i }));

    expect(await screen.findByText(/tell us about you/i)).toBeInTheDocument();
    // Both the profile and vehicle steps must offer an equally first-class Skip.
    expect(screen.getByRole("button", { name: /skip/i })).toBeInTheDocument();
  });

  it("an existing user (isNewUser: false) skips the wizard entirely and lands on home", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockJsonResponse({ status: "sent" }))
      .mockResolvedValueOnce(
        mockJsonResponse({
          accessToken: "access-token",
          refreshToken: "refresh-token",
          expiresIn: 900,
          isNewUser: false,
          userId: "user-1",
        })
      )
      .mockResolvedValueOnce(
        mockJsonResponse({
          id: "user-1",
          phone: "+919876543210",
          name: "Test Driver",
          email: null,
          photoUrl: null,
          commPrefs: null,
          status: "active",
          onboardingWizardCompletedAt: null,
        })
      );

    renderApp(["/"]);
    await user.type(screen.getByLabelText(/mobile number/i), "9876543210");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await screen.findByText(/enter the code/i);
    const digitInputs = screen.getAllByRole("textbox");
    for (let i = 0; i < 6; i++) {
      await user.type(digitInputs[i], String((i + 1) % 10));
    }
    await user.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() => expect(screen.getByText(/welcome back, test driver/i)).toBeInTheDocument());
    expect(screen.queryByText(/tell us about you/i)).not.toBeInTheDocument();
  });

  it("shows a specific message (not a generic error) for an incorrect OTP", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockJsonResponse({ status: "sent" }))
      .mockResolvedValueOnce(
        mockJsonResponse({ error: { code: "OTP_INCORRECT", message: "Incorrect OTP — 4 attempt(s) remaining" } }, false, 401)
      );

    renderApp(["/"]);
    await user.type(screen.getByLabelText(/mobile number/i), "9876543210");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await screen.findByText(/enter the code/i);
    const digitInputs = screen.getAllByRole("textbox");
    for (let i = 0; i < 6; i++) {
      await user.type(digitInputs[i], "9");
    }
    await user.click(screen.getByRole("button", { name: /verify/i }));

    expect(await screen.findByText(/4 attempt\(s\) remaining/i)).toBeInTheDocument();
  });
});
