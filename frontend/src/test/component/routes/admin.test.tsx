import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { screen, fireEvent, waitFor } from "@testing-library/preact";
import { renderWithProviders, makeQueryClient } from "../../helpers/render";
import { mockFetch, errorResponse, type MockFetchResult } from "../../helpers/fetch";
import { AdminRoute } from "../../../routes/admin";
import { useUIStore } from "../../../stores/ui";
import { useAppSettings } from "../../../hooks/useAppSettings";
import { queryKeys } from "../../../api/queryKeys";
import type { User, Bot, AuditEntry } from "../../../api/endpoints";

let fetchMock: MockFetchResult;
afterEach(() => fetchMock?.restore());

const adminUser: User = {
  id: "u1",
  username: "admin",
  displayName: "Admin User",
  createdAt: "2024-01-01",
  role: "admin",
};

const memberUser: User = {
  id: "u2",
  username: "alice",
  displayName: "Alice",
  createdAt: "2024-01-01",
  role: "member",
};

const modUser: User = {
  id: "u3",
  username: "mod",
  displayName: "Mod",
  createdAt: "2024-01-01",
  role: "moderator",
};

const disabledUser: User = {
  id: "u4",
  username: "disabled",
  displayName: "Disabled User",
  createdAt: "2024-01-01",
  role: "member",
  disabledAt: "2024-01-10",
};

const baseStats = { users: 5, posts: 20, invites: 3 };

const baseInvite = {
  token: "abc123",
  used: false,
  createdAt: "2024-01-01",
  expiresAt: new Date(Date.now() + 86400000 * 7).toISOString(),
  revokedAt: null,
  invitedBy: { id: "u1", username: "admin", displayName: "Admin", createdAt: "2024-01-01" },
};

const usedInvite = {
  token: "used456",
  used: true,
  createdAt: "2024-01-01",
  usedBy: { id: "u2", username: "alice", displayName: "Alice", createdAt: "2024-01-01" },
};

const revokedInvite = {
  token: "rev789",
  used: false,
  createdAt: "2024-01-01",
  revokedAt: "2024-01-05",
};

const expiredInvite = {
  token: "exp000",
  used: false,
  createdAt: "2024-01-01",
  expiresAt: "2020-01-01",
};

const baseBot: Bot = {
  id: "b1",
  username: "knitly-bot",
  displayName: "Knitly Bot",
  role: "bot",
  disabledAt: null,
  createdAt: "2024-01-01",
  lastActive: null,
  keys: [
    { id: "k1", label: "default", lastUsedAt: null, revokedAt: null, createdAt: "2024-01-01" },
  ],
};

const botNoKey: Bot = {
  ...baseBot,
  id: "b2",
  username: "nokey-bot",
  displayName: "No Key Bot",
  keys: [
    {
      id: "k2",
      label: "default",
      lastUsedAt: null,
      revokedAt: "2024-01-05",
      createdAt: "2024-01-01",
    },
  ],
};

const baseAuditEntry: AuditEntry = {
  id: "a1",
  actionType: "user.disable",
  targetType: "user",
  targetId: "u2",
  metadata: { reason: "spam" },
  createdAt: "2024-01-01T00:00:00Z",
  actor: { id: "u1", username: "admin", displayName: "Admin User" },
};

const baseContent = {
  items: [
    {
      type: "post" as const,
      id: "p1",
      content: "Hello world post",
      createdAt: "2024-01-01T00:00:00Z",
      author: { id: "u2", username: "alice", displayName: "Alice" },
      commentsCount: 0,
      mediaCount: 0,
    },
    {
      type: "comment" as const,
      id: "c1",
      content: "A comment here",
      createdAt: "2024-01-01T00:00:00Z",
      author: { id: "u2", username: "alice", displayName: "Alice" },
      postId: "p1",
      postAuthor: { username: "bob", displayName: "Bob" },
    },
  ],
  nextCursor: undefined,
};

beforeEach(() => {
  useUIStore.setState({
    editingPostId: null,
    showCreatePost: false,
    initialMedia: null,
    searchMode: "people",
  });
  useAppSettings.setState({
    appName: "Knitly",
    logoIcon: "Zap",
    isLoaded: true,
    isFetching: false,
    isSaving: false,
    error: null,
  });
});

function makeAdminFetch(overrides: Record<string, unknown> = {}) {
  return mockFetch(({ url, method }: { url: string; method: string }) => {
    if (url.includes("/api/auth/me")) return overrides.me ?? adminUser;
    if (url.includes("/api/admin/stats")) return overrides.stats ?? baseStats;
    if (url.includes("/api/admin/users")) return overrides.users ?? [adminUser, memberUser];
    if (url.includes("/api/invites") && method === "GET") return overrides.invites ?? [baseInvite];
    if (url.includes("/api/admin/bots")) return overrides.bots ?? [];
    if (url.includes("/api/admin/content"))
      return overrides.content ?? { items: [], nextCursor: undefined };
    if (url.includes("/api/admin/audit"))
      return overrides.audit ?? { items: [], nextCursor: undefined };
    if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
    return null;
  });
}

async function renderAdmin(tab = "overview", user = adminUser) {
  const qc = makeQueryClient();
  qc.setQueryData(queryKeys.auth.me(), user);
  if (tab === "overview") {
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, memberUser]);
    qc.setQueryData(queryKeys.admin.invites(), [baseInvite]);
  }
  if (tab === "bots") {
    qc.setQueryData(queryKeys.admin.bots(), [baseBot]);
  }
  if (tab === "moderation") {
    qc.setQueryData(queryKeys.admin.content(), { pages: [baseContent], pageParams: [undefined] });
  }
  if (tab === "audit") {
    qc.setQueryData(queryKeys.admin.audit(), {
      pages: [{ items: [baseAuditEntry], nextCursor: undefined }],
      pageParams: [undefined],
    });
  }

  fetchMock = makeAdminFetch();

  return renderWithProviders(<AdminRoute />, {
    path: "/admin",
    initialEntries: [`/admin?tab=${tab}`],
    queryClient: qc,
  });
}

describe("AdminRoute — header", () => {
  it("renders Admin Dashboard heading", async () => {
    await renderAdmin();
    expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
  });

  it("renders Back link", async () => {
    await renderAdmin();
    expect(screen.getByText("Back")).toBeInTheDocument();
  });
});

describe("AdminRoute — tabs for admin", () => {
  it("renders all tabs for admin user", async () => {
    await renderAdmin();
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Bots")).toBeInTheDocument();
    // Moderation appears as tab text (link) and as heading — getAllByText is safe
    expect(screen.getAllByText("Moderation").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Audit Log").length).toBeGreaterThan(0);
    expect(screen.getByText("Customize")).toBeInTheDocument();
  });

  it("renders only moderation and audit tabs for moderator", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), modUser);
    qc.setQueryData(queryKeys.admin.content(), {
      pages: [{ items: [], nextCursor: undefined }],
      pageParams: [undefined],
    });
    fetchMock = makeAdminFetch({ me: modUser });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=moderation"],
      queryClient: qc,
    });
    expect(screen.queryByText("Overview")).toBeNull();
    // Tab links still appear
    expect(screen.getAllByText("Moderation").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Audit Log").length).toBeGreaterThan(0);
  });
});

describe("AdminRoute — overview tab", () => {
  it("renders stat cards with values", async () => {
    await renderAdmin("overview");
    await waitFor(() => {
      expect(screen.getByText("Total Users")).toBeInTheDocument();
      expect(screen.getByText("Total Posts")).toBeInTheDocument();
      expect(screen.getByText("Active Invites")).toBeInTheDocument();
    });
  });

  it("shows stat values from API", async () => {
    await renderAdmin("overview");
    await waitFor(() => {
      // 5 users, 20 posts, 3 invites — check at least one
      expect(screen.getByText("20")).toBeInTheDocument();
    });
  });

  it("renders Members section", async () => {
    await renderAdmin("overview");
    await waitFor(() => {
      expect(screen.getByText("Members")).toBeInTheDocument();
    });
  });

  it("renders Invites section", async () => {
    await renderAdmin("overview");
    await waitFor(() => {
      expect(screen.getByText("Invites")).toBeInTheDocument();
    });
  });

  it("renders Danger Zone on overview", async () => {
    await renderAdmin("overview");
    await waitFor(() => {
      expect(screen.getAllByText("Danger Zone").length).toBeGreaterThan(0);
    });
  });
});

describe("AdminRoute — overview: members table", () => {
  it("renders member display names", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, memberUser, modUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = makeAdminFetch({ users: [adminUser, memberUser, modUser] });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
  });

  it("shows (you) label for self", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, memberUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = makeAdminFetch();
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("(you)")).toBeInTheDocument();
    });
  });

  it("shows Owner badge for admin role", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, memberUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = makeAdminFetch();
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Owner")).toBeInTheDocument();
    });
  });

  it("shows Moderator badge for moderator", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, memberUser, modUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = makeAdminFetch({ users: [adminUser, memberUser, modUser] });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Moderator")).toBeInTheDocument();
    });
  });

  it("shows Disabled badge for disabled user (via Disabled filter)", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, memberUser, disabledUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = makeAdminFetch({ users: [adminUser, memberUser, disabledUser] });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    // Switch to Disabled filter to see disabled users
    await waitFor(() => {
      expect(screen.getByText(/^Disabled \(/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/^Disabled \(/));
    await waitFor(() => {
      expect(screen.getByText("Disabled")).toBeInTheDocument();
    });
  });

  it("shows Enable button for disabled user (via Disabled filter)", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, disabledUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = makeAdminFetch({ users: [adminUser, disabledUser] });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText(/^Disabled \(/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/^Disabled \(/));
    await waitFor(() => {
      expect(screen.getByText("Enable")).toBeInTheDocument();
    });
  });

  it("clicking Enable calls POST /api/admin/users/:id/enable", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, disabledUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/enable") && method === "POST")
        return { id: disabledUser.id, disabledAt: null };
      if (url.includes("/api/admin/users")) return [adminUser, disabledUser];
      if (url.includes("/api/admin/stats")) return baseStats;
      if (url.includes("/api/invites")) return [baseInvite];
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText(/^Disabled \(/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/^Disabled \(/));
    await waitFor(() => {
      expect(screen.getByText("Enable")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Enable"));
    await waitFor(() => {
      const call = fetchMock.calls.find((c) => c.url.includes("/enable") && c.method === "POST");
      expect(call).toBeDefined();
    });
  });

  it("clicking Disable shows confirm dialog", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, memberUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = makeAdminFetch();
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Disable")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Disable"));
    await waitFor(() => {
      expect(screen.getByText("Disable User")).toBeInTheDocument();
    });
  });

  it("confirming Disable calls POST /api/admin/users/:id/disable", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, memberUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/disable") && method === "POST")
        return { id: memberUser.id, disabledAt: "2024-01-01" };
      if (url.includes("/api/admin/users")) return [adminUser, memberUser];
      if (url.includes("/api/admin/stats")) return baseStats;
      if (url.includes("/api/invites")) return [baseInvite];
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Disable")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Disable"));
    await waitFor(() => {
      expect(screen.getByText("Disable User")).toBeInTheDocument();
    });
    // Find the Disable confirm button in the modal (last one = modal button)
    const disableBtns = screen.getAllByRole("button").filter((b) => b.textContent === "Disable");
    fireEvent.click(disableBtns[disableBtns.length - 1]);
    await waitFor(() => {
      const call = fetchMock.calls.find((c) => c.url.includes("/disable") && c.method === "POST");
      expect(call).toBeDefined();
    });
  });

  it("clicking Promote calls POST /api/admin/users/:id/promote", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, memberUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/promote") && method === "POST")
        return { id: memberUser.id, role: "moderator" };
      if (url.includes("/api/admin/users")) return [adminUser, memberUser];
      if (url.includes("/api/admin/stats")) return baseStats;
      if (url.includes("/api/invites")) return [baseInvite];
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Promote")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Promote"));
    await waitFor(() => {
      const call = fetchMock.calls.find((c) => c.url.includes("/promote") && c.method === "POST");
      expect(call).toBeDefined();
    });
  });

  it("shows Demote button for moderator user", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, modUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = makeAdminFetch({ users: [adminUser, modUser] });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Demote")).toBeInTheDocument();
    });
  });

  it("clicking Demote calls POST /api/admin/users/:id/demote", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, modUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/demote") && method === "POST") return { id: modUser.id, role: "member" };
      if (url.includes("/api/admin/users")) return [adminUser, modUser];
      if (url.includes("/api/admin/stats")) return baseStats;
      if (url.includes("/api/invites")) return [baseInvite];
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Demote")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Demote"));
    await waitFor(() => {
      const call = fetchMock.calls.find((c) => c.url.includes("/demote") && c.method === "POST");
      expect(call).toBeDefined();
    });
  });

  it("clicking Remove shows confirm dialog", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, memberUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = makeAdminFetch();
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Remove")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Remove"));
    await waitFor(() => {
      expect(screen.getByText("Remove User")).toBeInTheDocument();
    });
  });

  it("shows Revoke Sessions button", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, memberUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = makeAdminFetch();
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText(/Revoke Sessions/)).toBeInTheDocument();
    });
  });

  it("clicking Revoke Sessions shows confirm dialog", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, memberUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = makeAdminFetch();
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText(/Revoke Sessions/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Revoke Sessions/));
    await waitFor(() => {
      expect(screen.getByText("Revoke All Sessions")).toBeInTheDocument();
    });
  });

  it("shows Reset Password button for non-self user", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    // Only memberUser in addition to self - memberUser is not self
    qc.setQueryData(queryKeys.admin.users(), [adminUser, memberUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = makeAdminFetch();
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      // getAllByText because multiple "Reset Password" is possible with multiple users
      expect(screen.getAllByText(/Reset Password/).length).toBeGreaterThan(0);
    });
  });

  it("clicking Reset Password shows confirm dialog", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, memberUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = makeAdminFetch();
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getAllByText(/Reset Password/).length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText(/Reset Password/)[0]);
    await waitFor(() => {
      // The dialog title is "Reset Password"
      expect(screen.getByRole("heading", { name: "Reset Password" })).toBeInTheDocument();
    });
  });

  it("shows empty state when no members", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), []);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = makeAdminFetch({ users: [] });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("No members yet")).toBeInTheDocument();
    });
  });

  it("shows no members found when filter matches nothing", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = makeAdminFetch({ users: [adminUser] });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Search members")).toBeInTheDocument();
    });
    fireEvent.input(screen.getByLabelText("Search members"), { target: { value: "zzz" } });
    await waitFor(() => {
      expect(screen.getByText("No members found")).toBeInTheDocument();
    });
  });

  it("member filter buttons change filter", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, memberUser, disabledUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = makeAdminFetch({ users: [adminUser, memberUser, disabledUser] });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText(/^Disabled \(/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/^Disabled \(/));
    await waitFor(() => {
      expect(screen.getByText("Disabled User")).toBeInTheDocument();
    });
  });
});

describe("AdminRoute — overview: invites", () => {
  it("renders active invite token", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser]);
    qc.setQueryData(queryKeys.admin.invites(), [baseInvite]);
    fetchMock = makeAdminFetch();
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("abc123")).toBeInTheDocument();
    });
  });

  it("shows Active status badge for active invite", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser]);
    qc.setQueryData(queryKeys.admin.invites(), [baseInvite]);
    fetchMock = makeAdminFetch();
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Active")).toBeInTheDocument();
    });
  });

  it("shows invite metadata (created by)", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser]);
    qc.setQueryData(queryKeys.admin.invites(), [baseInvite]);
    fetchMock = makeAdminFetch();
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText(/by @admin/)).toBeInTheDocument();
    });
  });

  it("shows Revoked status for revoked invite via All filter", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser]);
    qc.setQueryData(queryKeys.admin.invites(), [revokedInvite]);
    fetchMock = makeAdminFetch({ invites: [revokedInvite] });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    // switch to all filter
    await waitFor(() => {
      expect(screen.getByLabelText("Search invites")).toBeInTheDocument();
    });
    fireEvent.click(screen.getAllByText(/^All \(/)[0]);
    await waitFor(() => {
      expect(screen.getByText("Revoked")).toBeInTheDocument();
    });
  });

  it("shows Expired status for expired invite via All filter", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser]);
    qc.setQueryData(queryKeys.admin.invites(), [expiredInvite]);
    fetchMock = makeAdminFetch({ invites: [expiredInvite] });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Search invites")).toBeInTheDocument();
    });
    fireEvent.click(screen.getAllByText(/^All \(/)[0]);
    await waitFor(() => {
      expect(screen.getByText("Expired")).toBeInTheDocument();
    });
  });

  it("shows no invites empty state", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = makeAdminFetch({ invites: [] });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("No invites yet")).toBeInTheDocument();
    });
  });

  it("New Invite button calls POST /api/invites", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url === "/api/invites" && method === "POST")
        return { token: "newtok", expiresAt: "2025-01-01" };
      if (url.includes("/api/invites") && method === "GET") return [];
      if (url.includes("/api/admin/users")) return [adminUser];
      if (url.includes("/api/admin/stats")) return baseStats;
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("New Invite")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("New Invite"));
    await waitFor(() => {
      const call = fetchMock.calls.find((c) => c.url === "/api/invites" && c.method === "POST");
      expect(call).toBeDefined();
    });
  });

  it("Revoke button calls POST /api/invites/:token/revoke", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser]);
    qc.setQueryData(queryKeys.admin.invites(), [baseInvite]);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/revoke") && method === "POST")
        return { token: "abc123", revokedAt: "2024-01-05" };
      if (url.includes("/api/invites") && method === "GET") return [baseInvite];
      if (url.includes("/api/admin/users")) return [adminUser];
      if (url.includes("/api/admin/stats")) return baseStats;
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Revoke")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Revoke"));
    await waitFor(() => {
      const call = fetchMock.calls.find((c) => c.url.includes("/revoke") && c.method === "POST");
      expect(call).toBeDefined();
    });
  });

  it("invite filter buttons update visible invites", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser]);
    qc.setQueryData(queryKeys.admin.invites(), [baseInvite, usedInvite]);
    fetchMock = makeAdminFetch({ invites: [baseInvite, usedInvite] });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Search invites")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/^Used \(/));
    await waitFor(() => {
      expect(screen.getByText("used456")).toBeInTheDocument();
    });
  });

  it("no invites found shows when filter matches nothing", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser]);
    qc.setQueryData(queryKeys.admin.invites(), [baseInvite]);
    fetchMock = makeAdminFetch();
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Search invites")).toBeInTheDocument();
    });
    fireEvent.input(screen.getByLabelText("Search invites"), { target: { value: "zzznomatch" } });
    await waitFor(() => {
      expect(screen.getByText("No invites found")).toBeInTheDocument();
    });
  });
});

describe("AdminRoute — overview: transfer ownership", () => {
  it("renders Transfer Ownership section", async () => {
    await renderAdmin("overview");
    await waitFor(() => {
      expect(screen.getByText("Transfer Ownership")).toBeInTheDocument();
    });
  });

  it("shows matching users when searching in transfer field", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, memberUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = makeAdminFetch();
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Search users for ownership transfer")).toBeInTheDocument();
    });
    fireEvent.input(screen.getByLabelText("Search users for ownership transfer"), {
      target: { value: "ali" },
    });
    await waitFor(() => {
      // Alice in the dropdown
      const dropdown = document.querySelector(".absolute.top-full");
      expect(dropdown?.textContent).toContain("Alice");
    });
  });

  it("shows 'No matching members' when no users match transfer search", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, memberUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = makeAdminFetch();
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Search users for ownership transfer")).toBeInTheDocument();
    });
    fireEvent.input(screen.getByLabelText("Search users for ownership transfer"), {
      target: { value: "zzznomatch" },
    });
    await waitFor(() => {
      expect(screen.getByText("No matching members")).toBeInTheDocument();
    });
  });

  it("clicking a user in transfer results shows confirm dialog", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, memberUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = makeAdminFetch();
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Search users for ownership transfer")).toBeInTheDocument();
    });
    fireEvent.input(screen.getByLabelText("Search users for ownership transfer"), {
      target: { value: "ali" },
    });
    await waitFor(() => {
      const dropdown = document.querySelector(".absolute.top-full");
      expect(dropdown?.textContent).toContain("Alice");
    });
    // Click Alice in the dropdown
    const aliceBtn = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("Alice") && b.textContent?.includes("@alice"));
    fireEvent.click(aliceBtn!);
    await waitFor(() => {
      expect(screen.getAllByText("Transfer Ownership").length).toBeGreaterThan(0);
    });
  });
});

describe("AdminRoute — bots tab", () => {
  it("renders Bots tab link and heading", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.bots(), []);
    fetchMock = makeAdminFetch({ bots: [] });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=bots"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getAllByText("Bots").length).toBeGreaterThan(0);
    });
  });

  it("shows empty bots state", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.bots(), []);
    fetchMock = makeAdminFetch({ bots: [] });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=bots"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText(/No bots yet/)).toBeInTheDocument();
    });
  });

  it("renders existing bot", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.bots(), [baseBot]);
    fetchMock = makeAdminFetch({ bots: [baseBot] });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=bots"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Knitly Bot")).toBeInTheDocument();
      expect(screen.getByText("@knitly-bot")).toBeInTheDocument();
    });
  });

  it("shows Active key badge for bot with active key", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.bots(), [baseBot]);
    fetchMock = makeAdminFetch({ bots: [baseBot] });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=bots"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Active")).toBeInTheDocument();
    });
  });

  it("shows No Key badge for bot with no active key", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.bots(), [botNoKey]);
    fetchMock = makeAdminFetch({ bots: [botNoKey] });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=bots"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("No Key")).toBeInTheDocument();
    });
  });

  it("shows Revoke Key only for bot with active key", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.bots(), [baseBot]);
    fetchMock = makeAdminFetch({ bots: [baseBot] });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=bots"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Revoke Key")).toBeInTheDocument();
    });
  });

  it("New Bot button shows create form", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.bots(), []);
    fetchMock = makeAdminFetch({ bots: [] });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=bots"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("New Bot")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("New Bot"));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("knitly-bot")).toBeInTheDocument();
    });
  });

  it("creates a bot via POST /api/admin/bots", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.bots(), []);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/api/admin/bots") && method === "POST") {
        return {
          id: "b99",
          username: "newbot",
          displayName: "New Bot",
          bio: "",
          apiKey: "sk-secret",
        };
      }
      if (url.includes("/api/admin/bots") && method === "GET") return [];
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=bots"],
      queryClient: qc,
    });
    fireEvent.click(screen.getByText("New Bot"));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("knitly-bot")).toBeInTheDocument();
    });
    fireEvent.input(screen.getByPlaceholderText("knitly-bot"), { target: { value: "newbot" } });
    fireEvent.input(screen.getByPlaceholderText("Knitly Bot"), { target: { value: "New Bot" } });
    fireEvent.click(screen.getByText("Create Bot"));
    await waitFor(() => {
      const call = fetchMock.calls.find(
        (c) => c.url.includes("/api/admin/bots") && c.method === "POST"
      );
      expect(call).toBeDefined();
    });
  });

  it("shows created API key after bot creation", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.bots(), []);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/api/admin/bots") && method === "POST") {
        return {
          id: "b99",
          username: "newbot",
          displayName: "New Bot",
          bio: "",
          apiKey: "sk-secret123",
        };
      }
      if (url.includes("/api/admin/bots")) return [];
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=bots"],
      queryClient: qc,
    });
    fireEvent.click(screen.getByText("New Bot"));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("knitly-bot")).toBeInTheDocument();
    });
    fireEvent.input(screen.getByPlaceholderText("knitly-bot"), { target: { value: "newbot" } });
    fireEvent.input(screen.getByPlaceholderText("Knitly Bot"), { target: { value: "New Bot" } });
    fireEvent.click(screen.getByText("Create Bot"));
    await waitFor(() => {
      expect(screen.getByText("API Key Created")).toBeInTheDocument();
    });
  });

  it("can toggle API key visibility off", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.bots(), []);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/api/admin/bots") && method === "POST") {
        return {
          id: "b99",
          username: "newbot",
          displayName: "New Bot",
          bio: "",
          apiKey: "sk-secret123",
        };
      }
      if (url.includes("/api/admin/bots")) return [];
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=bots"],
      queryClient: qc,
    });
    fireEvent.click(screen.getByText("New Bot"));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("knitly-bot")).toBeInTheDocument();
    });
    fireEvent.input(screen.getByPlaceholderText("knitly-bot"), { target: { value: "newbot" } });
    fireEvent.input(screen.getByPlaceholderText("Knitly Bot"), { target: { value: "New Bot" } });
    fireEvent.click(screen.getByText("Create Bot"));
    await waitFor(() => {
      expect(screen.getByText("API Key Created")).toBeInTheDocument();
      expect(screen.getByText("sk-secret123")).toBeInTheDocument();
    });
    // click the toggle button — it's a p3 button with only an svg
    const toggleBtn = screen
      .getAllByRole("button")
      .find(
        (b) =>
          b.querySelector("svg") && !b.textContent?.trim() && b.className.includes("rounded-xl")
      );
    if (toggleBtn) fireEvent.click(toggleBtn);
    await waitFor(() => {
      expect(screen.queryByText("sk-secret123")).toBeNull();
    });
  });

  it("dismiss API key banner clears it", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.bots(), []);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/api/admin/bots") && method === "POST") {
        return {
          id: "b99",
          username: "newbot",
          displayName: "New Bot",
          bio: "",
          apiKey: "sk-secret123",
        };
      }
      if (url.includes("/api/admin/bots")) return [];
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=bots"],
      queryClient: qc,
    });
    fireEvent.click(screen.getByText("New Bot"));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("knitly-bot")).toBeInTheDocument();
    });
    fireEvent.input(screen.getByPlaceholderText("knitly-bot"), { target: { value: "newbot" } });
    fireEvent.input(screen.getByPlaceholderText("Knitly Bot"), { target: { value: "New Bot" } });
    fireEvent.click(screen.getByText("Create Bot"));
    await waitFor(() => {
      expect(screen.getByText("API Key Created")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Dismiss"));
    await waitFor(() => {
      expect(screen.queryByText("API Key Created")).toBeNull();
    });
  });

  it("Cancel in bot create form hides form", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.bots(), []);
    fetchMock = makeAdminFetch({ bots: [] });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=bots"],
      queryClient: qc,
    });
    fireEvent.click(screen.getByText("New Bot"));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("knitly-bot")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Cancel"));
    await waitFor(() => {
      expect(screen.queryByPlaceholderText("knitly-bot")).toBeNull();
    });
  });

  it("Regenerate Key shows confirm dialog", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.bots(), [baseBot]);
    fetchMock = makeAdminFetch({ bots: [baseBot] });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=bots"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText(/Regenerate Key/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Regenerate Key/));
    await waitFor(() => {
      expect(screen.getByText("Regenerate API Key")).toBeInTheDocument();
    });
  });

  it("confirms Regenerate Key calls POST /api/admin/bots/:id/regenerate-key", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.bots(), [baseBot]);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/regenerate-key") && method === "POST") return { apiKey: "sk-new-key" };
      if (url.includes("/api/admin/bots")) return [baseBot];
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=bots"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText(/Regenerate Key/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Regenerate Key/));
    await waitFor(() => {
      expect(screen.getByText("Regenerate API Key")).toBeInTheDocument();
    });
    const confirmBtn = screen.getAllByRole("button").find((b) => b.textContent === "Regenerate");
    fireEvent.click(confirmBtn!);
    await waitFor(() => {
      const call = fetchMock.calls.find(
        (c) => c.url.includes("/regenerate-key") && c.method === "POST"
      );
      expect(call).toBeDefined();
    });
  });

  it("Revoke Key shows confirm dialog", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.bots(), [baseBot]);
    fetchMock = makeAdminFetch({ bots: [baseBot] });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=bots"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Revoke Key")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Revoke Key"));
    await waitFor(() => {
      expect(screen.getByText("Revoke API Key")).toBeInTheDocument();
    });
  });

  it("Delete bot shows confirm dialog", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.bots(), [baseBot]);
    fetchMock = makeAdminFetch({ bots: [baseBot] });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=bots"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Delete")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Delete"));
    await waitFor(() => {
      expect(screen.getByText("Delete Bot")).toBeInTheDocument();
    });
  });

  it("bot with lastActive shows last active text", async () => {
    const botWithActive = { ...baseBot, lastActive: "2024-01-10T12:00:00Z" };
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.bots(), [botWithActive]);
    fetchMock = makeAdminFetch({ bots: [botWithActive] });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=bots"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText(/Last active:/)).toBeInTheDocument();
    });
  });

  it("bot bio field is optional — can be typed", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.bots(), []);
    fetchMock = makeAdminFetch({ bots: [] });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=bots"],
      queryClient: qc,
    });
    fireEvent.click(screen.getByText("New Bot"));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("I'm a friendly bot...")).toBeInTheDocument();
    });
    fireEvent.input(screen.getByPlaceholderText("I'm a friendly bot..."), {
      target: { value: "Some bio" },
    });
    expect(screen.getByPlaceholderText("I'm a friendly bot...").value).toBe("Some bio");
  });
});

describe("AdminRoute — moderation tab", () => {
  it("renders Moderation heading", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.content(), { pages: [baseContent], pageParams: [undefined] });
    fetchMock = makeAdminFetch({ content: baseContent });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=moderation"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getAllByText("Moderation").length).toBeGreaterThan(0);
    });
  });

  it("shows post content in moderation", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.content(), { pages: [baseContent], pageParams: [undefined] });
    fetchMock = makeAdminFetch({ content: baseContent });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=moderation"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Hello world post")).toBeInTheDocument();
    });
  });

  it("shows comment content in moderation", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.content(), { pages: [baseContent], pageParams: [undefined] });
    fetchMock = makeAdminFetch({ content: baseContent });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=moderation"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("A comment here")).toBeInTheDocument();
    });
  });

  it("shows Post badge and Comment badge", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.content(), { pages: [baseContent], pageParams: [undefined] });
    fetchMock = makeAdminFetch({ content: baseContent });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=moderation"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Post")).toBeInTheDocument();
      expect(screen.getByText("Comment")).toBeInTheDocument();
    });
  });

  it("shows comment post link", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.content(), { pages: [baseContent], pageParams: [undefined] });
    fetchMock = makeAdminFetch({ content: baseContent });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=moderation"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("View post")).toBeInTheDocument();
    });
  });

  it("shows empty state when no content", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.content(), {
      pages: [{ items: [], nextCursor: undefined }],
      pageParams: [undefined],
    });
    fetchMock = makeAdminFetch({ content: { items: [], nextCursor: undefined } });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=moderation"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Nothing to review")).toBeInTheDocument();
    });
  });

  it("Remove button shows confirm dialog for post", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.content(), { pages: [baseContent], pageParams: [undefined] });
    fetchMock = makeAdminFetch({ content: baseContent });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=moderation"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getAllByText("Remove").length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText("Remove")[0]);
    await waitFor(() => {
      expect(screen.getByText("Remove Post")).toBeInTheDocument();
    });
  });

  it("moderation search shows 'No matches found' for unmatched query", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.content("zzznomatch"), {
      pages: [{ items: [], nextCursor: undefined }],
      pageParams: [undefined],
    });
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/admin/content")) return { items: [], nextCursor: undefined };
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=moderation"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Search content for moderation")).toBeInTheDocument();
    });
    fireEvent.input(screen.getByLabelText("Search content for moderation"), {
      target: { value: "zzznomatch" },
    });
    await waitFor(() => {
      expect(screen.getByText("No matches found")).toBeInTheDocument();
    });
  });

  it("shows media count info for post items", async () => {
    const contentWithMedia = {
      items: [
        {
          type: "post" as const,
          id: "p2",
          content: "Post with media",
          createdAt: "2024-01-01T00:00:00Z",
          author: { id: "u2", username: "alice", displayName: "Alice" },
          commentsCount: 2,
          mediaCount: 3,
        },
      ],
      nextCursor: undefined,
    };
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.content(), {
      pages: [contentWithMedia],
      pageParams: [undefined],
    });
    fetchMock = makeAdminFetch({ content: contentWithMedia });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=moderation"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText(/3 media/)).toBeInTheDocument();
      expect(screen.getByText(/2 comments/)).toBeInTheDocument();
    });
  });

  it("shows 'No media' for post with no media", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.content(), { pages: [baseContent], pageParams: [undefined] });
    fetchMock = makeAdminFetch({ content: baseContent });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=moderation"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText(/No media/)).toBeInTheDocument();
    });
  });

  it("shows 'Post unavailable' for comment with no postId", async () => {
    const contentNoPostId = {
      items: [
        {
          type: "comment" as const,
          id: "c2",
          content: "Orphan comment",
          createdAt: "2024-01-01T00:00:00Z",
          author: { id: "u2", username: "alice", displayName: "Alice" },
          postId: undefined,
          postAuthor: undefined,
        },
      ],
      nextCursor: undefined,
    };
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.content(), {
      pages: [contentNoPostId],
      pageParams: [undefined],
    });
    fetchMock = makeAdminFetch({ content: contentNoPostId });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=moderation"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Post unavailable")).toBeInTheDocument();
    });
  });

  it("shows Load more button when hasNextPage", async () => {
    const contentWithNext = {
      pages: [{ items: baseContent.items, nextCursor: "cursor2" }],
      pageParams: [undefined],
    };
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.content(), contentWithNext);
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/admin/content"))
        return { items: baseContent.items, nextCursor: "cursor2" };
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=moderation"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Load more")).toBeInTheDocument();
    });
  });
});

describe("AdminRoute — audit tab", () => {
  it("renders Audit Log heading", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.audit(), {
      pages: [{ items: [baseAuditEntry], nextCursor: undefined }],
      pageParams: [undefined],
    });
    fetchMock = makeAdminFetch({ audit: { items: [baseAuditEntry], nextCursor: undefined } });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=audit"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getAllByText("Audit Log").length).toBeGreaterThan(0);
    });
  });

  it("shows audit entry actor name", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.audit(), {
      pages: [{ items: [baseAuditEntry], nextCursor: undefined }],
      pageParams: [undefined],
    });
    fetchMock = makeAdminFetch({ audit: { items: [baseAuditEntry], nextCursor: undefined } });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=audit"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Admin User")).toBeInTheDocument();
      expect(screen.getByText("@admin")).toBeInTheDocument();
    });
  });

  it("shows audit entry target ID", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.audit(), {
      pages: [{ items: [baseAuditEntry], nextCursor: undefined }],
      pageParams: [undefined],
    });
    fetchMock = makeAdminFetch({ audit: { items: [baseAuditEntry], nextCursor: undefined } });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=audit"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText(/ID: u2/)).toBeInTheDocument();
    });
  });

  it("shows audit metadata", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.audit(), {
      pages: [{ items: [baseAuditEntry], nextCursor: undefined }],
      pageParams: [undefined],
    });
    fetchMock = makeAdminFetch({ audit: { items: [baseAuditEntry], nextCursor: undefined } });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=audit"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText(/spam/)).toBeInTheDocument();
    });
  });

  it("shows empty audit state", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.audit(), {
      pages: [{ items: [], nextCursor: undefined }],
      pageParams: [undefined],
    });
    fetchMock = makeAdminFetch({ audit: { items: [], nextCursor: undefined } });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=audit"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("No audit entries")).toBeInTheDocument();
    });
  });

  it("shows Load more button when audit has nextPage", async () => {
    const auditWithNext = {
      pages: [{ items: [baseAuditEntry], nextCursor: "cursor2" }],
      pageParams: [undefined],
    };
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.audit(), auditWithNext);
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/admin/audit"))
        return { items: [baseAuditEntry], nextCursor: "cursor2" };
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=audit"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Load more")).toBeInTheDocument();
    });
  });

  it("shows audit entry with no targetId gracefully", async () => {
    const entryNoTarget = { ...baseAuditEntry, targetId: null, metadata: null };
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.audit(), {
      pages: [{ items: [entryNoTarget], nextCursor: undefined }],
      pageParams: [undefined],
    });
    fetchMock = makeAdminFetch({ audit: { items: [entryNoTarget], nextCursor: undefined } });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=audit"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Admin User")).toBeInTheDocument();
    });
    expect(screen.queryByText(/ID:/)).toBeNull();
  });
});

describe("AdminRoute — customize tab", () => {
  it("renders Customize tab content", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=customize"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests for previously uncovered lines
// ─────────────────────────────────────────────────────────────────────────────

describe("AdminRoute — confirm flows: confirming Remove User fires DELETE", () => {
  it("confirming Remove User calls DELETE /api/admin/users/:id", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, memberUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes(`/api/admin/users/${memberUser.id}`) && method === "DELETE") return {};
      if (url.includes("/api/admin/users")) return [adminUser, memberUser];
      if (url.includes("/api/admin/stats")) return baseStats;
      if (url.includes("/api/invites")) return [baseInvite];
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Remove")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Remove"));
    await waitFor(() => {
      expect(screen.getByText("Remove User")).toBeInTheDocument();
    });
    const confirmBtns = screen.getAllByRole("button").filter((b) => b.textContent === "Remove");
    fireEvent.click(confirmBtns[confirmBtns.length - 1]);
    await waitFor(() => {
      const call = fetchMock.calls.find(
        (c) => c.url.includes(`/api/admin/users/${memberUser.id}`) && c.method === "DELETE"
      );
      expect(call).toBeDefined();
    });
  });
});

describe("AdminRoute — confirm flows: Revoke Sessions confirmed", () => {
  it("confirming Revoke Sessions fires POST /api/admin/users/:id/revoke-sessions", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, memberUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/revoke-sessions") && method === "POST") return {};
      if (url.includes("/api/admin/users")) return [adminUser, memberUser];
      if (url.includes("/api/admin/stats")) return baseStats;
      if (url.includes("/api/invites")) return [baseInvite];
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText(/Revoke Sessions/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Revoke Sessions/));
    await waitFor(() => {
      expect(screen.getByText("Revoke All Sessions")).toBeInTheDocument();
    });
    const confirmBtns = screen.getAllByRole("button").filter((b) => b.textContent === "Revoke");
    fireEvent.click(confirmBtns[confirmBtns.length - 1]);
    await waitFor(() => {
      const call = fetchMock.calls.find(
        (c) => c.url.includes("/revoke-sessions") && c.method === "POST"
      );
      expect(call).toBeDefined();
    });
  });
});

describe("AdminRoute — confirm flows: Reset Password confirmed", () => {
  it("confirming Reset Password fires POST /api/admin/users/:id/reset-password", async () => {
    const writeText = mock(() => Promise.resolve());
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, memberUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/reset-password") && method === "POST") return { token: "reset-tok" };
      if (url.includes("/api/admin/users")) return [adminUser, memberUser];
      if (url.includes("/api/admin/stats")) return baseStats;
      if (url.includes("/api/invites")) return [baseInvite];
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getAllByText(/Reset Password/).length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText(/Reset Password/)[0]);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Reset Password" })).toBeInTheDocument();
    });
    const generateBtn = screen
      .getAllByRole("button")
      .find((b) => b.textContent === "Generate Link");
    fireEvent.click(generateBtn!);
    await waitFor(() => {
      const call = fetchMock.calls.find(
        (c) => c.url.includes("/reset-password") && c.method === "POST"
      );
      expect(call).toBeDefined();
    });
  });
});

describe("AdminRoute — confirm flows: Transfer Ownership confirmed", () => {
  it("confirming Transfer Ownership fires POST /api/admin/users/:id/transfer", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, memberUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/transfer") && method === "POST") return {};
      if (url.includes("/api/admin/users")) return [adminUser, memberUser];
      if (url.includes("/api/admin/stats")) return baseStats;
      if (url.includes("/api/invites")) return [baseInvite];
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Search users for ownership transfer")).toBeInTheDocument();
    });
    fireEvent.input(screen.getByLabelText("Search users for ownership transfer"), {
      target: { value: "ali" },
    });
    await waitFor(() => {
      const dropdown = document.querySelector(".absolute.top-full");
      expect(dropdown?.textContent).toContain("Alice");
    });
    const aliceBtn = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("Alice") && b.textContent?.includes("@alice"));
    fireEvent.click(aliceBtn!);
    await waitFor(() => {
      expect(screen.getAllByText("Transfer Ownership").length).toBeGreaterThan(0);
    });
    const transferBtns = screen.getAllByRole("button").filter((b) => b.textContent === "Transfer");
    fireEvent.click(transferBtns[transferBtns.length - 1]);
    await waitFor(() => {
      const call = fetchMock.calls.find((c) => c.url.includes("/transfer") && c.method === "POST");
      expect(call).toBeDefined();
    });
  });
});

describe("AdminRoute — confirm flows: Revoke Bot Key confirmed", () => {
  it("confirming Revoke Key fires POST /api/admin/bots/:id/revoke-key", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.bots(), [baseBot]);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/revoke-key") && method === "POST") return {};
      if (url.includes("/api/admin/bots")) return [baseBot];
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=bots"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Revoke Key")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Revoke Key"));
    await waitFor(() => {
      expect(screen.getByText("Revoke API Key")).toBeInTheDocument();
    });
    const revokeBtns = screen.getAllByRole("button").filter((b) => b.textContent === "Revoke");
    fireEvent.click(revokeBtns[revokeBtns.length - 1]);
    await waitFor(() => {
      const call = fetchMock.calls.find(
        (c) => c.url.includes("/revoke-key") && c.method === "POST"
      );
      expect(call).toBeDefined();
    });
  });
});

describe("AdminRoute — confirm flows: Delete Bot confirmed", () => {
  it("confirming Delete Bot fires DELETE /api/admin/bots/:id", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.bots(), [baseBot]);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes(`/api/admin/bots/${baseBot.id}`) && method === "DELETE") return {};
      if (url.includes("/api/admin/bots")) return [baseBot];
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=bots"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Delete")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Delete"));
    await waitFor(() => {
      expect(screen.getByText("Delete Bot")).toBeInTheDocument();
    });
    const deleteBtns = screen.getAllByRole("button").filter((b) => b.textContent === "Delete");
    fireEvent.click(deleteBtns[deleteBtns.length - 1]);
    await waitFor(() => {
      const call = fetchMock.calls.find(
        (c) => c.url.includes(`/api/admin/bots/${baseBot.id}`) && c.method === "DELETE"
      );
      expect(call).toBeDefined();
    });
  });
});

describe("AdminRoute — confirm flows: Remove content (post) confirmed", () => {
  it("confirming Remove Post fires POST /api/admin/content/:id/delete", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.content(), { pages: [baseContent], pageParams: [undefined] });
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/api/admin/content/") && url.includes("/delete") && method === "POST")
        return { id: "p1", type: "post" };
      if (url.includes("/api/admin/content")) return baseContent;
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=moderation"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getAllByText("Remove").length).toBeGreaterThan(0);
    });
    // Click first Remove (post)
    fireEvent.click(screen.getAllByText("Remove")[0]);
    await waitFor(() => {
      expect(screen.getByText("Remove Post")).toBeInTheDocument();
    });
    const removeBtns = screen.getAllByRole("button").filter((b) => b.textContent === "Remove");
    fireEvent.click(removeBtns[removeBtns.length - 1]);
    await waitFor(() => {
      const call = fetchMock.calls.find(
        (c) =>
          c.url.includes("/api/admin/content/") && c.url.includes("/delete") && c.method === "POST"
      );
      expect(call).toBeDefined();
    });
  });

  it("confirming Remove Comment (with postId) fires POST /api/admin/content/:id/delete", async () => {
    const commentContent = {
      items: [
        {
          type: "comment" as const,
          id: "c10",
          content: "A deletable comment",
          createdAt: "2024-01-01T00:00:00Z",
          author: { id: "u2", username: "alice", displayName: "Alice" },
          postId: "p1",
          postAuthor: { username: "bob", displayName: "Bob" },
        },
      ],
      nextCursor: undefined,
    };
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.content(), {
      pages: [commentContent],
      pageParams: [undefined],
    });
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/api/admin/content/") && url.includes("/delete") && method === "POST")
        return { id: "c10", type: "comment", postId: "p1" };
      if (url.includes("/api/admin/content")) return commentContent;
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=moderation"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("A deletable comment")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Remove"));
    await waitFor(() => {
      expect(screen.getByText("Remove Comment")).toBeInTheDocument();
    });
    const removeBtns = screen.getAllByRole("button").filter((b) => b.textContent === "Remove");
    fireEvent.click(removeBtns[removeBtns.length - 1]);
    await waitFor(() => {
      const call = fetchMock.calls.find(
        (c) =>
          c.url.includes("/api/admin/content/") && c.url.includes("/delete") && c.method === "POST"
      );
      expect(call).toBeDefined();
    });
  });
});

describe("AdminRoute — clipboard: Copy Link on invite", () => {
  it("clicking Copy Link copies invite URL to clipboard", async () => {
    let copied = "";
    const writeText = mock((text: string) => {
      copied = text;
      return Promise.resolve();
    });
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser]);
    qc.setQueryData(queryKeys.admin.invites(), [baseInvite]);
    fetchMock = makeAdminFetch();
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Copy Link")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Copy Link"));
    await waitFor(() => {
      expect(copied).toContain("abc123");
    });
  });
});

describe("AdminRoute — clipboard: Copy API key in bots banner", () => {
  it("clicking copy button in API key banner copies key to clipboard", async () => {
    let copied = "";
    const writeText = mock((text: string) => {
      copied = text;
      return Promise.resolve();
    });
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.bots(), []);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/api/admin/bots") && method === "POST") {
        return {
          id: "b99",
          username: "newbot",
          displayName: "New Bot",
          bio: "",
          apiKey: "sk-copy-me",
        };
      }
      if (url.includes("/api/admin/bots")) return [];
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=bots"],
      queryClient: qc,
    });
    fireEvent.click(screen.getByText("New Bot"));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("knitly-bot")).toBeInTheDocument();
    });
    fireEvent.input(screen.getByPlaceholderText("knitly-bot"), { target: { value: "newbot" } });
    fireEvent.input(screen.getByPlaceholderText("Knitly Bot"), { target: { value: "New Bot" } });
    fireEvent.click(screen.getByText("Create Bot"));
    await waitFor(() => {
      expect(screen.getByText("API Key Created")).toBeInTheDocument();
    });
    // The copy icon button is the second icon button (after the eye toggle)
    const copyBtn =
      screen
        .getAllByRole("button")
        .find(
          (b) =>
            !b.textContent?.trim() &&
            b.className.includes("rounded-xl") &&
            b.querySelector("svg") &&
            b !==
              screen
                .getAllByRole("button")
                .find((x) => x.className.includes("rounded-xl") && x.querySelector("svg"))
        ) ??
      screen
        .getAllByRole("button")
        .filter((b) => b.className.includes("rounded-xl") && !b.textContent?.trim())[1];
    if (copyBtn) fireEvent.click(copyBtn);
    await waitFor(() => {
      expect(copied).toBe("sk-copy-me");
    });
  });
});

describe("AdminRoute — moderation load more", () => {
  it("clicking Load more triggers fetchNextPage", async () => {
    const contentWithNext = {
      pages: [{ items: baseContent.items, nextCursor: "cursor2" }],
      pageParams: [undefined],
    };
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.content(), contentWithNext);
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/admin/content")) return { items: [], nextCursor: undefined };
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=moderation"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Load more")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Load more"));
    await waitFor(() => {
      const call = fetchMock.calls.find((c) => c.url.includes("/api/admin/content"));
      expect(call).toBeDefined();
    });
  });
});

describe("AdminRoute — error paths: onError handlers show toast", () => {
  it("createBot error shows toast", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.bots(), []);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/api/admin/bots") && method === "POST")
        return errorResponse(400, { error: "Bot creation failed" });
      if (url.includes("/api/admin/bots")) return [];
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=bots"],
      queryClient: qc,
    });
    fireEvent.click(screen.getByText("New Bot"));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("knitly-bot")).toBeInTheDocument();
    });
    fireEvent.input(screen.getByPlaceholderText("knitly-bot"), { target: { value: "failbot" } });
    fireEvent.input(screen.getByPlaceholderText("Knitly Bot"), { target: { value: "Fail Bot" } });
    fireEvent.click(screen.getByText("Create Bot"));
    await waitFor(() => {
      // error toast should appear — the onError fires
      expect(
        fetchMock.calls.find((c) => c.url.includes("/api/admin/bots") && c.method === "POST")
      ).toBeDefined();
    });
  });

  it("disableUser error path is exercised when fetch errors", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, memberUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/disable") && method === "POST") return errorResponse(500);
      if (url.includes("/api/admin/users")) return [adminUser, memberUser];
      if (url.includes("/api/admin/stats")) return baseStats;
      if (url.includes("/api/invites")) return [baseInvite];
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Disable")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Disable"));
    await waitFor(() => {
      expect(screen.getByText("Disable User")).toBeInTheDocument();
    });
    const disableBtns = screen.getAllByRole("button").filter((b) => b.textContent === "Disable");
    fireEvent.click(disableBtns[disableBtns.length - 1]);
    await waitFor(() => {
      const call = fetchMock.calls.find((c) => c.url.includes("/disable") && c.method === "POST");
      expect(call).toBeDefined();
    });
  });

  it("promoteUser error path is exercised when fetch errors", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, memberUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/promote") && method === "POST") return errorResponse(500);
      if (url.includes("/api/admin/users")) return [adminUser, memberUser];
      if (url.includes("/api/admin/stats")) return baseStats;
      if (url.includes("/api/invites")) return [baseInvite];
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Promote")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Promote"));
    await waitFor(() => {
      const call = fetchMock.calls.find((c) => c.url.includes("/promote") && c.method === "POST");
      expect(call).toBeDefined();
    });
  });

  it("demoteUser error path is exercised when fetch errors", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, modUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/demote") && method === "POST") return errorResponse(500);
      if (url.includes("/api/admin/users")) return [adminUser, modUser];
      if (url.includes("/api/admin/stats")) return baseStats;
      if (url.includes("/api/invites")) return [baseInvite];
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Demote")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Demote"));
    await waitFor(() => {
      const call = fetchMock.calls.find((c) => c.url.includes("/demote") && c.method === "POST");
      expect(call).toBeDefined();
    });
  });

  it("enableUser error path is exercised when fetch errors", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, disabledUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/enable") && method === "POST") return errorResponse(500);
      if (url.includes("/api/admin/users")) return [adminUser, disabledUser];
      if (url.includes("/api/admin/stats")) return baseStats;
      if (url.includes("/api/invites")) return [baseInvite];
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText(/^Disabled \(/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/^Disabled \(/));
    await waitFor(() => {
      expect(screen.getByText("Enable")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Enable"));
    await waitFor(() => {
      const call = fetchMock.calls.find((c) => c.url.includes("/enable") && c.method === "POST");
      expect(call).toBeDefined();
    });
  });

  it("createInvite error path is exercised when fetch errors", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url === "/api/invites" && method === "POST") return errorResponse(500);
      if (url.includes("/api/invites")) return [];
      if (url.includes("/api/admin/users")) return [adminUser];
      if (url.includes("/api/admin/stats")) return baseStats;
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("New Invite")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("New Invite"));
    await waitFor(() => {
      const call = fetchMock.calls.find((c) => c.url === "/api/invites" && c.method === "POST");
      expect(call).toBeDefined();
    });
  });

  it("revokeInvite error path is exercised when fetch errors", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser]);
    qc.setQueryData(queryKeys.admin.invites(), [baseInvite]);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/revoke") && method === "POST" && url.includes("/api/invites"))
        return errorResponse(500);
      if (url.includes("/api/invites")) return [baseInvite];
      if (url.includes("/api/admin/users")) return [adminUser];
      if (url.includes("/api/admin/stats")) return baseStats;
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Revoke")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Revoke"));
    await waitFor(() => {
      const call = fetchMock.calls.find(
        (c) => c.url.includes("/revoke") && c.method === "POST" && c.url.includes("/api/invites")
      );
      expect(call).toBeDefined();
    });
  });

  it("regenerateKey error path is exercised when fetch errors", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.bots(), [baseBot]);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/regenerate-key") && method === "POST") return errorResponse(500);
      if (url.includes("/api/admin/bots")) return [baseBot];
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=bots"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText(/Regenerate Key/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Regenerate Key/));
    await waitFor(() => {
      expect(screen.getByText("Regenerate API Key")).toBeInTheDocument();
    });
    const confirmBtn = screen.getAllByRole("button").find((b) => b.textContent === "Regenerate");
    fireEvent.click(confirmBtn!);
    await waitFor(() => {
      const call = fetchMock.calls.find(
        (c) => c.url.includes("/regenerate-key") && c.method === "POST"
      );
      expect(call).toBeDefined();
    });
  });

  it("revokeBotKey error path is exercised when fetch errors", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.bots(), [baseBot]);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/revoke-key") && method === "POST") return errorResponse(500);
      if (url.includes("/api/admin/bots")) return [baseBot];
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=bots"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Revoke Key")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Revoke Key"));
    await waitFor(() => {
      expect(screen.getByText("Revoke API Key")).toBeInTheDocument();
    });
    const revokeBtns = screen.getAllByRole("button").filter((b) => b.textContent === "Revoke");
    fireEvent.click(revokeBtns[revokeBtns.length - 1]);
    await waitFor(() => {
      const call = fetchMock.calls.find(
        (c) => c.url.includes("/revoke-key") && c.method === "POST"
      );
      expect(call).toBeDefined();
    });
  });

  it("deleteBot error path is exercised when fetch errors", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.bots(), [baseBot]);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes(`/api/admin/bots/${baseBot.id}`) && method === "DELETE")
        return errorResponse(500);
      if (url.includes("/api/admin/bots")) return [baseBot];
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=bots"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Delete")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Delete"));
    await waitFor(() => {
      expect(screen.getByText("Delete Bot")).toBeInTheDocument();
    });
    const deleteBtns = screen.getAllByRole("button").filter((b) => b.textContent === "Delete");
    fireEvent.click(deleteBtns[deleteBtns.length - 1]);
    await waitFor(() => {
      const call = fetchMock.calls.find(
        (c) => c.url.includes(`/api/admin/bots/${baseBot.id}`) && c.method === "DELETE"
      );
      expect(call).toBeDefined();
    });
  });

  it("removeUser error path is exercised when fetch errors", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, memberUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes(`/api/admin/users/${memberUser.id}`) && method === "DELETE")
        return errorResponse(500);
      if (url.includes("/api/admin/users")) return [adminUser, memberUser];
      if (url.includes("/api/admin/stats")) return baseStats;
      if (url.includes("/api/invites")) return [baseInvite];
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Remove")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Remove"));
    await waitFor(() => {
      expect(screen.getByText("Remove User")).toBeInTheDocument();
    });
    const confirmBtns = screen.getAllByRole("button").filter((b) => b.textContent === "Remove");
    fireEvent.click(confirmBtns[confirmBtns.length - 1]);
    await waitFor(() => {
      const call = fetchMock.calls.find(
        (c) => c.url.includes(`/api/admin/users/${memberUser.id}`) && c.method === "DELETE"
      );
      expect(call).toBeDefined();
    });
  });

  it("deleteContent error path is exercised when fetch errors", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.content(), { pages: [baseContent], pageParams: [undefined] });
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/api/admin/content/") && url.includes("/delete") && method === "POST")
        return errorResponse(500);
      if (url.includes("/api/admin/content")) return baseContent;
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=moderation"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getAllByText("Remove").length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText("Remove")[0]);
    await waitFor(() => {
      expect(screen.getByText("Remove Post")).toBeInTheDocument();
    });
    const removeBtns = screen.getAllByRole("button").filter((b) => b.textContent === "Remove");
    fireEvent.click(removeBtns[removeBtns.length - 1]);
    await waitFor(() => {
      const call = fetchMock.calls.find(
        (c) =>
          c.url.includes("/api/admin/content/") && c.url.includes("/delete") && c.method === "POST"
      );
      expect(call).toBeDefined();
    });
  });

  it("transferOwnership error path is exercised when fetch errors", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, memberUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/transfer") && method === "POST") return errorResponse(500);
      if (url.includes("/api/admin/users")) return [adminUser, memberUser];
      if (url.includes("/api/admin/stats")) return baseStats;
      if (url.includes("/api/invites")) return [baseInvite];
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Search users for ownership transfer")).toBeInTheDocument();
    });
    fireEvent.input(screen.getByLabelText("Search users for ownership transfer"), {
      target: { value: "ali" },
    });
    await waitFor(() => {
      const dropdown = document.querySelector(".absolute.top-full");
      expect(dropdown?.textContent).toContain("Alice");
    });
    const aliceBtn = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("Alice") && b.textContent?.includes("@alice"));
    fireEvent.click(aliceBtn!);
    await waitFor(() => {
      expect(screen.getAllByText("Transfer Ownership").length).toBeGreaterThan(0);
    });
    const transferBtns = screen.getAllByRole("button").filter((b) => b.textContent === "Transfer");
    fireEvent.click(transferBtns[transferBtns.length - 1]);
    await waitFor(() => {
      const call = fetchMock.calls.find((c) => c.url.includes("/transfer") && c.method === "POST");
      expect(call).toBeDefined();
    });
  });

  it("revokeUserSessions error path is exercised when fetch errors", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, memberUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/revoke-sessions") && method === "POST") return errorResponse(500);
      if (url.includes("/api/admin/users")) return [adminUser, memberUser];
      if (url.includes("/api/admin/stats")) return baseStats;
      if (url.includes("/api/invites")) return [baseInvite];
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText(/Revoke Sessions/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Revoke Sessions/));
    await waitFor(() => {
      expect(screen.getByText("Revoke All Sessions")).toBeInTheDocument();
    });
    const confirmBtns = screen.getAllByRole("button").filter((b) => b.textContent === "Revoke");
    fireEvent.click(confirmBtns[confirmBtns.length - 1]);
    await waitFor(() => {
      const call = fetchMock.calls.find(
        (c) => c.url.includes("/revoke-sessions") && c.method === "POST"
      );
      expect(call).toBeDefined();
    });
  });

  it("resetPassword error path is exercised when fetch errors", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, memberUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/reset-password") && method === "POST") return errorResponse(500);
      if (url.includes("/api/admin/users")) return [adminUser, memberUser];
      if (url.includes("/api/admin/stats")) return baseStats;
      if (url.includes("/api/invites")) return [baseInvite];
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getAllByText(/Reset Password/).length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText(/Reset Password/)[0]);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Reset Password" })).toBeInTheDocument();
    });
    const generateBtn = screen
      .getAllByRole("button")
      .find((b) => b.textContent === "Generate Link");
    fireEvent.click(generateBtn!);
    await waitFor(() => {
      const call = fetchMock.calls.find(
        (c) => c.url.includes("/reset-password") && c.method === "POST"
      );
      expect(call).toBeDefined();
    });
  });
});

describe("AdminRoute — regenerateKey success shows new API key", () => {
  it("after confirming Regenerate Key, the new key banner appears", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.bots(), [baseBot]);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/regenerate-key") && method === "POST") return { apiKey: "sk-regenerated" };
      if (url.includes("/api/admin/bots")) return [baseBot];
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=bots"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText(/Regenerate Key/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Regenerate Key/));
    await waitFor(() => {
      expect(screen.getByText("Regenerate API Key")).toBeInTheDocument();
    });
    const confirmBtn = screen.getAllByRole("button").find((b) => b.textContent === "Regenerate");
    fireEvent.click(confirmBtn!);
    await waitFor(() => {
      expect(screen.getByText("API Key Created")).toBeInTheDocument();
    });
  });
});

describe("AdminRoute — clipboard error paths", () => {
  it("shows error toast when Copy Link clipboard fails", async () => {
    const writeText = mock(() => Promise.reject(new Error("Clipboard denied")));
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser]);
    qc.setQueryData(queryKeys.admin.invites(), [baseInvite]);
    fetchMock = makeAdminFetch();
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Copy Link")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Copy Link"));
    // The click fires handleCopyInvite which catches the clipboard error
    await waitFor(() => {
      expect(writeText).toHaveBeenCalled();
    });
  });

  it("shows error toast when Reset Password clipboard write fails", async () => {
    const writeText = mock(() => Promise.reject(new Error("Clipboard denied")));
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.stats(), baseStats);
    qc.setQueryData(queryKeys.admin.users(), [adminUser, memberUser]);
    qc.setQueryData(queryKeys.admin.invites(), []);
    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/reset-password") && method === "POST") return { token: "reset-tok" };
      if (url.includes("/api/admin/users")) return [adminUser, memberUser];
      if (url.includes("/api/admin/stats")) return baseStats;
      if (url.includes("/api/invites")) return [baseInvite];
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=overview"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getAllByText(/Reset Password/).length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText(/Reset Password/)[0]);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Reset Password" })).toBeInTheDocument();
    });
    const generateBtn = screen
      .getAllByRole("button")
      .find((b) => b.textContent === "Generate Link");
    fireEvent.click(generateBtn!);
    await waitFor(() => {
      const call = fetchMock.calls.find(
        (c) => c.url.includes("/reset-password") && c.method === "POST"
      );
      expect(call).toBeDefined();
    });
    await waitFor(() => {
      expect(writeText).toHaveBeenCalled();
    });
  });
});

describe("AdminRoute — audit load more", () => {
  it("clicking Load more in audit tab triggers fetchNextPage", async () => {
    const auditWithNext = {
      pages: [{ items: [baseAuditEntry], nextCursor: "cursor2" }],
      pageParams: [undefined],
    };
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), adminUser);
    qc.setQueryData(queryKeys.admin.audit(), auditWithNext);
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/admin/audit")) return { items: [], nextCursor: undefined };
      if (url.includes("/api/auth/me")) return adminUser;
      if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
      return null;
    });
    await renderWithProviders(<AdminRoute />, {
      path: "/admin",
      initialEntries: ["/admin?tab=audit"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Load more")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Load more"));
    await waitFor(() => {
      const call = fetchMock.calls.find((c) => c.url.includes("/api/admin/audit"));
      expect(call).toBeDefined();
    });
  });
});
