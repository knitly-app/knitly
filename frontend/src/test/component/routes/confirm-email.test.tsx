import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { screen, waitFor } from "@testing-library/preact";
import { renderWithProviders, makeQueryClient } from "../../helpers/render";
import { mockFetch, errorResponse, type MockFetchResult } from "../../helpers/fetch";
import { ConfirmEmailRoute } from "../../../routes/confirm-email";
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

describe("ConfirmEmailRoute — missing token", () => {
  it("shows no token message when token is absent", async () => {
    fetchMock = mockFetch(null);
    await renderWithProviders(<ConfirmEmailRoute />, {
      path: "/confirm-email",
      initialEntries: ["/confirm-email"],
    });
    expect(screen.getByText("No confirmation token provided.")).toBeInTheDocument();
  });

  it("shows back to settings link when token is absent", async () => {
    fetchMock = mockFetch(null);
    await renderWithProviders(<ConfirmEmailRoute />, {
      path: "/confirm-email",
      initialEntries: ["/confirm-email"],
    });
    expect(screen.getByText("Back to settings")).toBeInTheDocument();
  });
});

describe("ConfirmEmailRoute — loading state", () => {
  it("shows confirming message while fetch is pending", async () => {
    let resolve: (v: Response) => void;
    const pending = new Promise<Response>((res) => {
      resolve = res;
    });
    fetchMock = mockFetch(() => pending);
    await renderWithProviders(<ConfirmEmailRoute />, {
      path: "/confirm-email",
      initialEntries: ["/confirm-email?token=mytoken"],
    });
    expect(screen.getByText("Confirming your email...")).toBeInTheDocument();
    resolve!(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  });
});

describe("ConfirmEmailRoute — success state", () => {
  it("shows success message when token is valid", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.confirmEmail("goodtoken"), { success: true });
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/auth/confirm-email/")) return { success: true };
      return null;
    });
    await renderWithProviders(<ConfirmEmailRoute />, {
      queryClient: qc,
      path: "/confirm-email",
      initialEntries: ["/confirm-email?token=goodtoken"],
    });
    await waitFor(() => {
      expect(screen.getByText("Email updated successfully!")).toBeInTheDocument();
    });
  });

  it("shows back to settings button on success", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.confirmEmail("goodtoken"), { success: true });
    fetchMock = mockFetch({ success: true });
    await renderWithProviders(<ConfirmEmailRoute />, {
      queryClient: qc,
      path: "/confirm-email",
      initialEntries: ["/confirm-email?token=goodtoken"],
    });
    await waitFor(() => {
      expect(screen.getByText("Back to Settings")).toBeInTheDocument();
    });
  });
});

describe("ConfirmEmailRoute — error state", () => {
  it("shows error message when token is invalid", async () => {
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/auth/confirm-email/"))
        return errorResponse(400, { error: "Invalid token" });
      return null;
    });
    await renderWithProviders(<ConfirmEmailRoute />, {
      path: "/confirm-email",
      initialEntries: ["/confirm-email?token=badtoken"],
    });
    await waitFor(() => {
      expect(screen.getByText("Invalid or expired confirmation link.")).toBeInTheDocument();
    });
  });

  it("shows back to settings link on error", async () => {
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/auth/confirm-email/"))
        return errorResponse(400, { error: "Invalid token" });
      return null;
    });
    await renderWithProviders(<ConfirmEmailRoute />, {
      path: "/confirm-email",
      initialEntries: ["/confirm-email?token=badtoken"],
    });
    await waitFor(() => {
      expect(screen.getByText("Back to settings")).toBeInTheDocument();
    });
  });

  it("calls the confirm-email endpoint with the token", async () => {
    fetchMock = mockFetch({ success: true });
    await renderWithProviders(<ConfirmEmailRoute />, {
      path: "/confirm-email",
      initialEntries: ["/confirm-email?token=mytoken"],
    });
    await waitFor(() => {
      const call = fetchMock.calls.find((c) => c.url.includes("/api/auth/confirm-email/mytoken"));
      expect(call).toBeDefined();
    });
  });
});
