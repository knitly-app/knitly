import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { screen, fireEvent, waitFor } from "@testing-library/preact";
import { renderWithProviders } from "../../helpers/render";
import { mockFetch, type MockFetchResult } from "../../helpers/fetch";
import { SignupRoute } from "../../../routes/signup";
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
  localStorage.clear();
});

describe("SignupRoute — no invite param", () => {
  it("renders nothing when invite param is absent", async () => {
    fetchMock = mockFetch(null);
    await renderWithProviders(<SignupRoute />, {
      path: "/signup",
      initialEntries: ["/signup"],
    });
    expect(screen.queryByText("Create Account")).toBeNull();
    expect(screen.queryByText("Join your private social network")).toBeNull();
  });
});

describe("SignupRoute — with invite param", () => {
  it("renders the signup form when invite param is present", async () => {
    fetchMock = mockFetch(null);
    await renderWithProviders(<SignupRoute />, {
      path: "/signup",
      initialEntries: ["/signup?invite=abc123"],
    });
    expect(screen.getByRole("button", { name: "Create Account" })).toBeInTheDocument();
  });

  it("renders all form fields", async () => {
    fetchMock = mockFetch(null);
    await renderWithProviders(<SignupRoute />, {
      path: "/signup",
      initialEntries: ["/signup?invite=abc123"],
    });
    expect(screen.getByPlaceholderText("Your Name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("username")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Choose a strong password")).toBeInTheDocument();
  });

  it("renders the app name", async () => {
    fetchMock = mockFetch(null);
    await renderWithProviders(<SignupRoute />, {
      path: "/signup",
      initialEntries: ["/signup?invite=abc123"],
    });
    expect(screen.getAllByText("Knitly").length).toBeGreaterThan(0);
  });

  it("renders a link to sign in", async () => {
    fetchMock = mockFetch(null);
    await renderWithProviders(<SignupRoute />, {
      path: "/signup",
      initialEntries: ["/signup?invite=abc123"],
    });
    expect(screen.getByText("Sign in")).toBeInTheDocument();
  });

  it("fills in form fields", async () => {
    fetchMock = mockFetch(null);
    await renderWithProviders(<SignupRoute />, {
      path: "/signup",
      initialEntries: ["/signup?invite=abc123"],
    });

    const displayNameInput = screen.getByPlaceholderText("Your Name");
    const usernameInput = screen.getByPlaceholderText("username");
    const emailInput = screen.getByPlaceholderText("you@example.com");
    const passwordInput = screen.getByPlaceholderText("Choose a strong password");

    fireEvent.input(displayNameInput, { target: { value: "Ada Lovelace" } });
    fireEvent.input(usernameInput, { target: { value: "ada" } });
    fireEvent.input(emailInput, { target: { value: "ada@example.com" } });
    fireEvent.input(passwordInput, { target: { value: "password123" } });

    expect(displayNameInput.value).toBe("Ada Lovelace");
    expect(usernameInput.value).toBe("ada");
    expect(emailInput.value).toBe("ada@example.com");
    expect(passwordInput.value).toBe("password123");
  });

  it("submits form and calls /api/auth/signup with invite token", async () => {
    const user = {
      id: "u1",
      username: "ada",
      displayName: "Ada Lovelace",
      createdAt: "2024-01-01",
    };
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/auth/signup")) return user;
      if (url.includes("/api/auth/me")) return user;
      if (url.includes("/api/circles")) return [];
      return null;
    });
    await renderWithProviders(<SignupRoute />, {
      path: "/signup",
      initialEntries: ["/signup?invite=mytoken"],
    });

    fireEvent.input(screen.getByPlaceholderText("Your Name"), {
      target: { value: "Ada Lovelace" },
    });
    fireEvent.input(screen.getByPlaceholderText("username"), { target: { value: "ada" } });
    fireEvent.input(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.input(screen.getByPlaceholderText("Choose a strong password"), {
      target: { value: "password123" },
    });

    fireEvent.submit(screen.getByRole("button", { name: "Create Account" }).closest("form")!);

    await waitFor(() => {
      const signupCall = fetchMock.calls.find((c) => c.url.includes("/api/auth/signup"));
      expect(signupCall).toBeDefined();
      expect(signupCall?.body).toMatchObject({
        email: "ada@example.com",
        username: "ada",
        displayName: "Ada Lovelace",
        inviteToken: "mytoken",
      });
    });
  });

  it("shows error message when signup fails", async () => {
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/auth/signup"))
        return new Response(JSON.stringify({ error: "Username taken" }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        });
      if (url.includes("/api/auth/me"))
        return new Response(JSON.stringify(null), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      return null;
    });
    await renderWithProviders(<SignupRoute />, {
      path: "/signup",
      initialEntries: ["/signup?invite=abc123"],
    });

    fireEvent.input(screen.getByPlaceholderText("Your Name"), { target: { value: "Ada" } });
    fireEvent.input(screen.getByPlaceholderText("username"), { target: { value: "ada" } });
    fireEvent.input(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.input(screen.getByPlaceholderText("Choose a strong password"), {
      target: { value: "password123" },
    });

    fireEvent.submit(screen.getByRole("button", { name: "Create Account" }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("Failed to create account. Please try again.")).toBeInTheDocument();
    });
  });

  it("shows onboarding after successful signup", async () => {
    const user = {
      id: "u1",
      username: "ada",
      displayName: "Ada",
      createdAt: "2024-01-01",
    };
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/auth/signup")) return user;
      if (url.includes("/api/auth/me")) return user;
      if (url.includes("/api/circles")) return [];
      return null;
    });
    await renderWithProviders(<SignupRoute />, {
      path: "/signup",
      initialEntries: ["/signup?invite=mytoken"],
    });

    fireEvent.input(screen.getByPlaceholderText("Your Name"), { target: { value: "Ada" } });
    fireEvent.input(screen.getByPlaceholderText("username"), { target: { value: "ada" } });
    fireEvent.input(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.input(screen.getByPlaceholderText("Choose a strong password"), {
      target: { value: "password123" },
    });

    fireEvent.submit(screen.getByRole("button", { name: "Create Account" }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("Who do you want to share with?")).toBeInTheDocument();
    });
  });
});

describe("SignupRoute — handleOnboardingComplete", () => {
  async function goToOnboarding() {
    const user = { id: "u1", username: "ada", displayName: "Ada", createdAt: "2024-01-01" };
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/auth/signup")) return user;
      if (url.includes("/api/auth/me")) return user;
      if (url.includes("/api/circles")) return [];
      return null;
    });
    await renderWithProviders(<SignupRoute />, {
      path: "/signup",
      initialEntries: ["/signup?invite=mytoken"],
    });
    fireEvent.input(screen.getByPlaceholderText("Your Name"), { target: { value: "Ada" } });
    fireEvent.input(screen.getByPlaceholderText("username"), { target: { value: "ada" } });
    fireEvent.input(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.input(screen.getByPlaceholderText("Choose a strong password"), {
      target: { value: "password123" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Create Account" }).closest("form")!);
    await waitFor(() =>
      expect(screen.getByText("Who do you want to share with?")).toBeInTheDocument()
    );
  }

  it("sets knitly_onboarding_complete in localStorage when Skip is clicked (onSkip path)", async () => {
    // onSkip={handleOnboardingComplete} → Skip button directly calls handleOnboardingComplete
    await goToOnboarding();
    fireEvent.click(screen.getByText("Skip for now"));
    await waitFor(() => {
      expect(localStorage.getItem("knitly_onboarding_complete")).toBe("true");
    });
  });

  it("sets knitly_onboarding_complete after creating default circles (onComplete path)", async () => {
    // CircleOnboarding DEFAULT_CIRCLES pre-fills "Family" and "Friends".
    // Clicking "Continue with 2 circles" POSTs /api/circles twice then calls onComplete.
    await goToOnboarding();

    // The "Continue with 2 circles" button is shown because Family + Friends are pre-filled
    await waitFor(() => expect(screen.getByText(/Continue with 2 circles/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Continue with 2 circles/));

    await waitFor(() => {
      const circleCall = fetchMock.calls.find((c) => c.url.includes("/api/circles"));
      expect(circleCall).toBeDefined();
    });

    await waitFor(() => {
      expect(localStorage.getItem("knitly_onboarding_complete")).toBe("true");
    });
  });
});
