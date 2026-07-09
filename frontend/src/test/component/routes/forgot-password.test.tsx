import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { screen, fireEvent, waitFor } from "@testing-library/preact";
import { renderWithProviders } from "../../helpers/render";
import { mockFetch, errorResponse, type MockFetchResult } from "../../helpers/fetch";
import { ForgotPasswordRoute } from "../../../routes/forgot-password";
import { useAppSettings } from "../../../hooks/useAppSettings";

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

describe("ForgotPasswordRoute", () => {
  it("renders the email input and submit button", async () => {
    fetchMock = mockFetch(null);
    await renderWithProviders(<ForgotPasswordRoute />, { path: "/forgot-password" });
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send Reset Link" })).toBeInTheDocument();
  });

  it("renders the Reset your password subtitle", async () => {
    fetchMock = mockFetch(null);
    await renderWithProviders(<ForgotPasswordRoute />, { path: "/forgot-password" });
    expect(screen.getByText("Reset your password")).toBeInTheDocument();
  });

  it("renders back to login link", async () => {
    fetchMock = mockFetch(null);
    await renderWithProviders(<ForgotPasswordRoute />, { path: "/forgot-password" });
    expect(screen.getByText("Back to login")).toBeInTheDocument();
  });

  it("submit button is disabled when email is empty", async () => {
    fetchMock = mockFetch(null);
    await renderWithProviders(<ForgotPasswordRoute />, { path: "/forgot-password" });
    const btn = screen.getByRole("button", { name: "Send Reset Link" });
    expect(btn.disabled).toBe(true);
  });

  it("submit button is enabled when email is entered", async () => {
    fetchMock = mockFetch(null);
    await renderWithProviders(<ForgotPasswordRoute />, { path: "/forgot-password" });
    fireEvent.input(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "user@example.com" },
    });
    const btn = screen.getByRole("button", { name: "Send Reset Link" });
    expect(btn.disabled).toBe(false);
  });

  it("calls /api/auth/forgot-password on submit", async () => {
    fetchMock = mockFetch({ success: true });
    await renderWithProviders(<ForgotPasswordRoute />, { path: "/forgot-password" });
    fireEvent.input(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "user@example.com" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Send Reset Link" }).closest("form")!);
    await waitFor(() => {
      const call = fetchMock.calls.find((c) => c.url.includes("/api/auth/forgot-password"));
      expect(call).toBeDefined();
      expect(call?.body).toMatchObject({ email: "user@example.com" });
    });
  });

  it("shows success state after submission", async () => {
    fetchMock = mockFetch({ success: true });
    await renderWithProviders(<ForgotPasswordRoute />, { path: "/forgot-password" });
    fireEvent.input(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "user@example.com" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Send Reset Link" }).closest("form")!);
    await waitFor(() => {
      expect(screen.getByText(/If an account exists with that email/)).toBeInTheDocument();
    });
  });

  it("shows error message when request rate-limited", async () => {
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/auth/forgot-password"))
        return errorResponse(429, { error: "Too many requests" });
      return null;
    });
    await renderWithProviders(<ForgotPasswordRoute />, { path: "/forgot-password" });
    fireEvent.input(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "user@example.com" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Send Reset Link" }).closest("form")!);
    await waitFor(() => {
      expect(screen.getByText("Too many requests. Please try again later.")).toBeInTheDocument();
    });
  });
});
