import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { screen, fireEvent, waitFor } from "@testing-library/preact";
import { renderWithProviders } from "../../helpers/render";
import { mockFetch, type MockFetchResult } from "../../helpers/fetch";
import { LoginRoute } from "../../../routes/login";
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

describe("LoginRoute", () => {
  it("renders the app name heading", async () => {
    fetchMock = mockFetch(null);
    await renderWithProviders(<LoginRoute />, { path: "/login" });
    expect(screen.getAllByText("Knitly").length).toBeGreaterThan(0);
  });

  it("renders email and password inputs", async () => {
    fetchMock = mockFetch(null);
    await renderWithProviders(<LoginRoute />, { path: "/login" });
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter your password")).toBeInTheDocument();
  });

  it("renders the Sign In button", async () => {
    fetchMock = mockFetch(null);
    await renderWithProviders(<LoginRoute />, { path: "/login" });
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
  });

  it("renders the forgot password link", async () => {
    fetchMock = mockFetch(null);
    await renderWithProviders(<LoginRoute />, { path: "/login" });
    expect(screen.getByText("Forgot password?")).toBeInTheDocument();
  });

  it("updates email field on input", async () => {
    fetchMock = mockFetch(null);
    await renderWithProviders(<LoginRoute />, { path: "/login" });
    const emailInput = screen.getByPlaceholderText("you@example.com");
    fireEvent.input(emailInput, { target: { value: "test@example.com" } });
    expect(emailInput.value).toBe("test@example.com");
  });

  it("updates password field on input", async () => {
    fetchMock = mockFetch(null);
    await renderWithProviders(<LoginRoute />, { path: "/login" });
    const passwordInput = screen.getByPlaceholderText("Enter your password");
    fireEvent.input(passwordInput, { target: { value: "secret123" } });
    expect(passwordInput.value).toBe("secret123");
  });

  it("submits the form and calls /api/auth/login", async () => {
    const user = {
      id: "u1",
      username: "ada",
      displayName: "Ada",
      createdAt: "2024-01-01",
    };
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/auth/login")) return user;
      if (url.includes("/api/auth/me")) return user;
      return null;
    });
    await renderWithProviders(<LoginRoute />, { path: "/login" });

    fireEvent.input(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.input(screen.getByPlaceholderText("Enter your password"), {
      target: { value: "password123" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Sign In" }).closest("form")!);

    await waitFor(() => {
      const loginCall = fetchMock.calls.find((c) => c.url.includes("/api/auth/login"));
      expect(loginCall).toBeDefined();
      expect(loginCall?.body).toMatchObject({ email: "ada@example.com", password: "password123" });
    });
  });

  it("shows error message when login fails", async () => {
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/auth/login"))
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      if (url.includes("/api/auth/me"))
        return new Response(JSON.stringify(null), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      return null;
    });
    await renderWithProviders(<LoginRoute />, { path: "/login" });

    fireEvent.input(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "bad@example.com" },
    });
    fireEvent.input(screen.getByPlaceholderText("Enter your password"), {
      target: { value: "wrongpass" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Sign In" }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("Invalid email or password")).toBeInTheDocument();
    });
  });

  it("shows invite-only notice", async () => {
    fetchMock = mockFetch(null);
    await renderWithProviders(<LoginRoute />, { path: "/login" });
    expect(screen.getByText(/invite-only/i)).toBeInTheDocument();
  });
});
