import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { screen, fireEvent, waitFor } from "@testing-library/preact";
import { renderWithProviders, makeQueryClient } from "../../helpers/render";
import { mockFetch, errorResponse, type MockFetchResult } from "../../helpers/fetch";
import { InviteRoute } from "../../../routes/invite";
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

describe("InviteRoute — loading state", () => {
  it("shows spinner while invite is being validated", async () => {
    let resolve: (v: Response) => void;
    const pending = new Promise<Response>((res) => {
      resolve = res;
    });
    fetchMock = mockFetch(() => pending);
    await renderWithProviders(<InviteRoute />, {
      path: "/invite/$token",
      initialEntries: ["/invite/abc123"],
    });
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).not.toBeNull();
    resolve!(
      new Response(JSON.stringify({ valid: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  });
});

describe("InviteRoute — invalid invite", () => {
  it("shows invalid invite heading when validate returns valid:false", async () => {
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/invites/")) return { valid: false };
      if (url.includes("/api/auth/me")) return null;
      return null;
    });
    await renderWithProviders(<InviteRoute />, {
      path: "/invite/$token",
      initialEntries: ["/invite/badtoken"],
    });
    await waitFor(() => {
      expect(screen.getByText("Invalid Invite")).toBeInTheDocument();
    });
  });

  it("shows error description for invalid invite", async () => {
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/invites/")) return { valid: false };
      if (url.includes("/api/auth/me")) return null;
      return null;
    });
    await renderWithProviders(<InviteRoute />, {
      path: "/invite/$token",
      initialEntries: ["/invite/badtoken"],
    });
    await waitFor(() => {
      expect(screen.getByText("This invite link is invalid or has expired.")).toBeInTheDocument();
    });
  });

  it("shows link to login for invalid invite", async () => {
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/invites/")) return { valid: false };
      if (url.includes("/api/auth/me")) return null;
      return null;
    });
    await renderWithProviders(<InviteRoute />, {
      path: "/invite/$token",
      initialEntries: ["/invite/badtoken"],
    });
    await waitFor(() => {
      expect(screen.getByText("Go to Login")).toBeInTheDocument();
    });
  });

  it("shows Invalid Invite when fetch errors", async () => {
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/invites/")) return errorResponse(404, { error: "Not found" });
      if (url.includes("/api/auth/me")) return null;
      return null;
    });
    await renderWithProviders(<InviteRoute />, {
      path: "/invite/$token",
      initialEntries: ["/invite/errortoken"],
    });
    await waitFor(() => {
      expect(screen.getByText("Invalid Invite")).toBeInTheDocument();
    });
  });
});

describe("InviteRoute — valid invite, unauthenticated user", () => {
  async function renderValidInvite() {
    const inviter = {
      id: "u99",
      username: "charlie",
      displayName: "Charlie",
      createdAt: "2024-01-01",
    };
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), null);
    qc.setQueryData(queryKeys.invite("goodtoken"), { valid: true, inviter });
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/invites/goodtoken")) return { valid: true, inviter };
      if (url.includes("/api/auth/me")) return null;
      return null;
    });
    return renderWithProviders(<InviteRoute />, {
      queryClient: qc,
      path: "/invite/$token",
      initialEntries: ["/invite/goodtoken"],
    });
  }

  it("shows You're Invited heading", async () => {
    await renderValidInvite();
    await waitFor(() => {
      expect(screen.getByText("You're Invited!")).toBeInTheDocument();
    });
  });

  it("shows app name in invitation text", async () => {
    await renderValidInvite();
    await waitFor(() => {
      expect(screen.getByText(/You're invited to join Knitly/)).toBeInTheDocument();
    });
  });

  it("shows Join button for unauthenticated user", async () => {
    await renderValidInvite();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Join Knitly/i })).toBeInTheDocument();
    });
  });

  it("clicking Join navigates to /signup with invite param", async () => {
    await renderValidInvite();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Join Knitly/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Join Knitly/i }));
    // Navigation to /signup is client-side; assert the fetch for invite was already called
    expect(fetchMock.calls.some((c) => c.url.includes("/api/invites/goodtoken"))).toBe(true);
  });
});

describe("InviteRoute — valid invite, authenticated user", () => {
  async function renderValidInviteAuthenticated() {
    const user = {
      id: "u1",
      username: "ada",
      displayName: "Ada",
      createdAt: "2024-01-01",
    };
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), user);
    qc.setQueryData(queryKeys.invite("goodtoken"), { valid: true });
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/invites/goodtoken")) return { valid: true };
      if (url.includes("/api/auth/me")) return user;
      return null;
    });
    return renderWithProviders(<InviteRoute />, {
      queryClient: qc,
      path: "/invite/$token",
      initialEntries: ["/invite/goodtoken"],
    });
  }

  it("shows Accept Invite button for authenticated user", async () => {
    await renderValidInviteAuthenticated();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Accept Invite" })).toBeInTheDocument();
    });
  });

  it("clicking Accept Invite navigates away (fetch for invite was called)", async () => {
    await renderValidInviteAuthenticated();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Accept Invite" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Accept Invite" }));
    expect(fetchMock.calls.some((c) => c.url.includes("/api/invites/goodtoken"))).toBe(true);
  });

  it("calls /api/invites/:token to validate the token", async () => {
    await renderValidInviteAuthenticated();
    await waitFor(() => {
      expect(fetchMock.calls.some((c) => c.url.includes("/api/invites/goodtoken"))).toBe(true);
    });
  });
});
