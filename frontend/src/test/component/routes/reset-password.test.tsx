import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { screen, fireEvent, waitFor } from "@testing-library/preact";
import { renderWithProviders, makeQueryClient } from "../../helpers/render";
import { mockFetch, errorResponse, type MockFetchResult } from "../../helpers/fetch";
import { ResetPasswordRoute } from "../../../routes/reset-password";
import { useAppSettings } from "../../../hooks/useAppSettings";
import { queryKeys } from "../../../api/queryKeys";

let fetchMock: MockFetchResult;
afterEach(() => fetchMock?.restore());

beforeEach(() => {
  useAppSettings.setState({
    appName: "Knitly",
    logoIcon: "Zap",
    isLoaded: true,
    isFetching: false,
    isSaving: false,
    error: null,
  });
});

describe("ResetPasswordRoute — missing token", () => {
  it("shows no token message when token is absent", async () => {
    fetchMock = mockFetch(null);
    await renderWithProviders(<ResetPasswordRoute />, {
      path: "/reset-password",
      initialEntries: ["/reset-password"],
    });
    expect(screen.getByText("No reset token provided.")).toBeInTheDocument();
  });

  it("shows back to login link when token is absent", async () => {
    fetchMock = mockFetch(null);
    await renderWithProviders(<ResetPasswordRoute />, {
      path: "/reset-password",
      initialEntries: ["/reset-password"],
    });
    expect(screen.getByText("Back to login")).toBeInTheDocument();
  });
});

describe("ResetPasswordRoute — loading state", () => {
  it("shows validating message while token is being checked", async () => {
    let resolve: (v: Response) => void;
    const pending = new Promise<Response>((res) => {
      resolve = res;
    });
    fetchMock = mockFetch(() => pending);
    await renderWithProviders(<ResetPasswordRoute />, {
      path: "/reset-password",
      initialEntries: ["/reset-password?token=abc123"],
    });
    expect(screen.getByText("Validating reset link...")).toBeInTheDocument();
    resolve!(new Response(JSON.stringify({ valid: true }), { status: 200 }));
  });
});

describe("ResetPasswordRoute — invalid token", () => {
  it("shows invalid message for unknown reason", async () => {
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/auth/reset-password/")) return { valid: false, reason: "invalid" };
      return null;
    });
    await renderWithProviders(<ResetPasswordRoute />, {
      path: "/reset-password",
      initialEntries: ["/reset-password?token=badtoken"],
    });
    await waitFor(() => {
      expect(
        screen.getByText("This reset link is invalid or has already been used.")
      ).toBeInTheDocument();
    });
  });

  it("shows expired message for expired token", async () => {
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/auth/reset-password/")) return { valid: false, reason: "expired" };
      return null;
    });
    await renderWithProviders(<ResetPasswordRoute />, {
      path: "/reset-password",
      initialEntries: ["/reset-password?token=expiredtoken"],
    });
    await waitFor(() => {
      expect(screen.getByText("This reset link has expired.")).toBeInTheDocument();
    });
  });

  it("shows disabled message for disabled account", async () => {
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/auth/reset-password/")) return { valid: false, reason: "disabled" };
      return null;
    });
    await renderWithProviders(<ResetPasswordRoute />, {
      path: "/reset-password",
      initialEntries: ["/reset-password?token=disabledtoken"],
    });
    await waitFor(() => {
      expect(screen.getByText("This account has been disabled.")).toBeInTheDocument();
    });
  });

  it("falls back to invalid message when reason is not in map", async () => {
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/auth/reset-password/")) return { valid: false };
      return null;
    });
    await renderWithProviders(<ResetPasswordRoute />, {
      path: "/reset-password",
      initialEntries: ["/reset-password?token=unknowntoken"],
    });
    await waitFor(() => {
      expect(
        screen.getByText("This reset link is invalid or has already been used.")
      ).toBeInTheDocument();
    });
  });
});

describe("ResetPasswordRoute — valid token", () => {
  async function renderWithValidToken(displayName?: string) {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.resetToken("validtoken"), {
      valid: true,
      displayName: displayName ?? undefined,
    });
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/auth/reset-password/"))
        return { valid: true, displayName: displayName ?? null };
      if (url.includes("/api/auth/reset-password") && !url.includes("/api/auth/reset-password/"))
        return { success: true };
      return null;
    });
    return renderWithProviders(<ResetPasswordRoute />, {
      queryClient: qc,
      path: "/reset-password",
      initialEntries: ["/reset-password?token=validtoken"],
    });
  }

  it("renders password fields when token is valid", async () => {
    await renderWithValidToken("Ada");
    expect(screen.getByPlaceholderText("At least 8 characters")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Re-enter your password")).toBeInTheDocument();
  });

  it("renders displayName in subtitle when present", async () => {
    await renderWithValidToken("Ada Lovelace");
    expect(screen.getByText("Set a new password for Ada Lovelace")).toBeInTheDocument();
  });

  it("renders subtitle without name when displayName is absent", async () => {
    await renderWithValidToken();
    expect(screen.getByText("Set a new password")).toBeInTheDocument();
  });

  it("shows password too short warning", async () => {
    await renderWithValidToken("Ada");
    fireEvent.input(screen.getByPlaceholderText("At least 8 characters"), {
      target: { value: "short" },
    });
    expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
  });

  it("shows passwords do not match warning", async () => {
    await renderWithValidToken("Ada");
    fireEvent.input(screen.getByPlaceholderText("At least 8 characters"), {
      target: { value: "password123" },
    });
    fireEvent.input(screen.getByPlaceholderText("Re-enter your password"), {
      target: { value: "different!" },
    });
    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
  });

  it("submit button disabled when passwords do not match", async () => {
    await renderWithValidToken("Ada");
    fireEvent.input(screen.getByPlaceholderText("At least 8 characters"), {
      target: { value: "password123" },
    });
    fireEvent.input(screen.getByPlaceholderText("Re-enter your password"), {
      target: { value: "different!" },
    });
    const btn = screen.getByRole("button", { name: "Reset Password" });
    expect(btn.disabled).toBe(true);
  });

  it("calls /api/auth/reset-password on submit with matching passwords", async () => {
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/auth/reset-password/validtoken"))
        return { valid: true, displayName: "Ada" };
      if (url.includes("/api/auth/reset-password")) return { success: true };
      return null;
    });
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.resetToken("validtoken"), {
      valid: true,
      displayName: "Ada",
    });
    await renderWithProviders(<ResetPasswordRoute />, {
      queryClient: qc,
      path: "/reset-password",
      initialEntries: ["/reset-password?token=validtoken"],
    });

    fireEvent.input(screen.getByPlaceholderText("At least 8 characters"), {
      target: { value: "newpassword1" },
    });
    fireEvent.input(screen.getByPlaceholderText("Re-enter your password"), {
      target: { value: "newpassword1" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Reset Password" }).closest("form")!);

    await waitFor(() => {
      const resetCall = fetchMock.calls.find(
        (c) => c.url.includes("/api/auth/reset-password") && c.method === "POST"
      );
      expect(resetCall).toBeDefined();
      expect(resetCall?.body).toMatchObject({ token: "validtoken", password: "newpassword1" });
    });
  });

  it("shows success message after password reset", async () => {
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/auth/reset-password/validtoken"))
        return { valid: true, displayName: "Ada" };
      if (url.includes("/api/auth/reset-password")) return { success: true };
      return null;
    });
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.resetToken("validtoken"), {
      valid: true,
      displayName: "Ada",
    });
    await renderWithProviders(<ResetPasswordRoute />, {
      queryClient: qc,
      path: "/reset-password",
      initialEntries: ["/reset-password?token=validtoken"],
    });

    fireEvent.input(screen.getByPlaceholderText("At least 8 characters"), {
      target: { value: "newpassword1" },
    });
    fireEvent.input(screen.getByPlaceholderText("Re-enter your password"), {
      target: { value: "newpassword1" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Reset Password" }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("Your password has been reset successfully.")).toBeInTheDocument();
    });
  });

  it("shows error when reset mutation fails", async () => {
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/auth/reset-password/validtoken"))
        return { valid: true, displayName: "Ada" };
      if (url.includes("/api/auth/reset-password")) return errorResponse(400, { error: "Failed" });
      return null;
    });
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.resetToken("validtoken"), {
      valid: true,
      displayName: "Ada",
    });
    await renderWithProviders(<ResetPasswordRoute />, {
      queryClient: qc,
      path: "/reset-password",
      initialEntries: ["/reset-password?token=validtoken"],
    });

    fireEvent.input(screen.getByPlaceholderText("At least 8 characters"), {
      target: { value: "newpassword1" },
    });
    fireEvent.input(screen.getByPlaceholderText("Re-enter your password"), {
      target: { value: "newpassword1" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Reset Password" }).closest("form")!);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to reset password. The link may have expired.")
      ).toBeInTheDocument();
    });
  });
});
