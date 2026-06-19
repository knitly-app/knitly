import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { screen, fireEvent, waitFor } from "@testing-library/preact";
import { renderWithProviders, makeQueryClient } from "../helpers/render";
import { mockFetch, type MockFetchResult } from "../helpers/fetch";
import { Navigation } from "../../components/Navigation";
import { useUIStore } from "../../stores/ui";
import { useAppSettings } from "../../hooks/useAppSettings";
import { queryKeys } from "../../api/queryKeys";

let fetchMock: MockFetchResult;

afterEach(() => fetchMock?.restore());

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

type NavUser = {
  id: string;
  username: string;
  displayName: string;
  createdAt: string;
  role?: "admin" | "moderator" | "member" | "bot";
};

type NavNotification = {
  id: string;
  type: "reaction" | "comment" | "follow" | "invite";
  fromUserId: string;
  fromUsername: string;
  fromDisplayName: string;
  postId?: string;
  read: boolean;
  createdAt: string;
};

function makeUser(overrides: Partial<NavUser> = {}): NavUser {
  return {
    id: "u1",
    username: "ada",
    displayName: "Ada Lovelace",
    createdAt: "2024-01-01",
    ...overrides,
  };
}

function makeNotification(read: boolean): NavNotification {
  return {
    id: "n1",
    type: "reaction",
    fromUserId: "u2",
    fromUsername: "bob",
    fromDisplayName: "Bob",
    postId: "p1",
    read,
    createdAt: "2024-01-01",
  };
}

async function renderNav(
  user: NavUser | null = null,
  notifications: NavNotification[] = [],
  chatOnline = 0,
  opts: { path?: string; initialEntries?: string[] } = {}
) {
  const queryClient = makeQueryClient();
  queryClient.setQueryData(queryKeys.auth.me(), user);
  queryClient.setQueryData(queryKeys.notifications(), notifications);
  queryClient.setQueryData(queryKeys.chat.status(), { online: chatOnline });

  fetchMock = mockFetch(({ url }: { url: string }) => {
    if (url.includes("/api/auth/me")) return user;
    if (url.includes("/api/notifications")) return notifications;
    if (url.includes("/api/chat/status")) return { online: chatOnline };
    return {};
  });

  return renderWithProviders(<Navigation />, { queryClient, ...opts });
}

describe("Navigation — basic structure", () => {
  it("renders the mobile New Moment button", async () => {
    await renderNav(makeUser());
    expect(screen.getAllByLabelText("New Moment").length).toBeGreaterThan(0);
  });

  it("renders the app name in the desktop sidebar", async () => {
    await renderNav(makeUser());
    expect(screen.getByText("Knitly")).toBeInTheDocument();
  });

  it("renders the mobile More button", async () => {
    await renderNav(makeUser());
    expect(screen.getByLabelText("More")).toBeInTheDocument();
  });

  it("renders settings link in desktop sidebar", async () => {
    await renderNav(makeUser());
    expect(screen.getAllByText("Settings").length).toBeGreaterThan(0);
  });
});

describe("Navigation — admin link visibility", () => {
  it("does not show Admin link for a regular member", async () => {
    await renderNav(makeUser({ role: "member" }));
    expect(screen.queryByText("Admin")).toBeNull();
  });

  it("shows Admin link for admin user", async () => {
    await renderNav(makeUser({ role: "admin" }));
    expect(screen.getAllByText("Admin").length).toBeGreaterThan(0);
  });

  it("shows Admin link in the More sheet for admin user", async () => {
    await renderNav(makeUser({ role: "admin" }));
    const sheetGrid = document.querySelector(".grid.grid-cols-3");
    expect(sheetGrid?.textContent).toContain("Admin");
  });

  it("does not show Admin in More sheet for non-admin", async () => {
    await renderNav(makeUser({ role: "member" }));
    const sheetGrid = document.querySelector(".grid.grid-cols-3");
    expect(sheetGrid?.textContent).not.toContain("Admin");
  });
});

describe("Navigation — unread notification badge", () => {
  it("does not render a notification badge when all notifications are read", async () => {
    await renderNav(makeUser(), [makeNotification(true)]);
    const dots = document.querySelectorAll("span.absolute.bg-accent-500.rounded-full");
    expect(dots.length).toBe(0);
  });

  it("renders notification badges when there are unread notifications", async () => {
    await renderNav(makeUser(), [makeNotification(false)]);
    await waitFor(() => {
      const dots = document.querySelectorAll("span.rounded-full");
      expect(dots.length).toBeGreaterThan(0);
    });
  });
});

describe("Navigation — chat online badge", () => {
  it("does not show chat badge when chatOnline is 0", async () => {
    await renderNav(makeUser(), [], 0);
    const greenDots = document.querySelectorAll(".bg-green-500.rounded-full");
    expect(greenDots.length).toBe(0);
  });

  it("shows a green chat badge when chatOnline > 0", async () => {
    await renderNav(makeUser(), [], 3);
    const greenDots = document.querySelectorAll(".bg-green-500.rounded-full");
    expect(greenDots.length).toBeGreaterThan(0);
  });

  it("shows the online count label in desktop nav when chatOnline > 0", async () => {
    await renderNav(makeUser(), [], 5);
    expect(screen.getByText("5")).toBeInTheDocument();
  });
});

describe("Navigation — New Moment button", () => {
  it("opens the create post modal when the mobile button is clicked", async () => {
    await renderNav(makeUser());
    fireEvent.click(screen.getAllByLabelText("New Moment")[0]);
    expect(useUIStore.getState().showCreatePost).toBe(true);
  });

  it("opens the create post modal when the desktop sidebar button is clicked", async () => {
    await renderNav(makeUser());
    const desktopBtn = document.querySelector("aside button");
    expect(desktopBtn).not.toBeNull();
    if (desktopBtn) {
      fireEvent.click(desktopBtn);
      expect(useUIStore.getState().showCreatePost).toBe(true);
    }
  });
});

describe("Navigation — mobile More sheet open/close", () => {
  function getOverlay() {
    return document.querySelector(".md\\:hidden.fixed.inset-0");
  }

  it("sheet overlay becomes interactive when More is clicked", async () => {
    await renderNav(makeUser());
    fireEvent.click(screen.getByLabelText("More"));
    const overlay = getOverlay();
    expect(overlay?.className).toContain("pointer-events-auto");
  });

  it("sheet overlay returns to non-interactive when Close is clicked", async () => {
    await renderNav(makeUser());
    fireEvent.click(screen.getByLabelText("More"));
    fireEvent.click(screen.getByLabelText("Close"));
    const overlay = getOverlay();
    expect(overlay?.className).toContain("pointer-events-none");
  });

  it("closes More sheet when backdrop is clicked", async () => {
    await renderNav(makeUser());
    fireEvent.click(screen.getByLabelText("More"));
    const overlay = getOverlay();
    if (overlay) fireEvent.click(overlay);
    expect(overlay?.className).toContain("pointer-events-none");
  });

  it("clicking inner sheet panel does not close the sheet", async () => {
    await renderNav(makeUser());
    fireEvent.click(screen.getByLabelText("More"));
    const sheetPanel = document.querySelector(
      ".absolute.bottom-0.left-0.right-0.bg-white.rounded-t-3xl"
    );
    if (sheetPanel) fireEvent.click(sheetPanel);
    const overlay = getOverlay();
    expect(overlay?.className).toContain("pointer-events-auto");
  });

  it("sheet grid contains Profile, Members, Settings links for regular user", async () => {
    await renderNav(makeUser());
    const sheetGrid = document.querySelector(".grid.grid-cols-3");
    expect(sheetGrid?.textContent).toContain("Profile");
    expect(sheetGrid?.textContent).toContain("Members");
    expect(sheetGrid?.textContent).toContain("Settings");
  });

  it("sheet grid renders the correct number of links for a regular user", async () => {
    await renderNav(makeUser({ role: "member" }));
    const sheetLinks = document.querySelectorAll(".grid.grid-cols-3 a");
    // Profile, Members, Ext Demo (custom), Settings = 4 links
    expect(sheetLinks.length).toBe(4);
  });

  it("sheet grid renders an extra Admin link for admin users", async () => {
    await renderNav(makeUser({ role: "admin" }));
    const sheetLinks = document.querySelectorAll(".grid.grid-cols-3 a");
    // Profile, Members, Admin, Ext Demo (custom), Settings = 5 links
    expect(sheetLinks.length).toBe(5);
  });
});

describe("Navigation — active route highlighting", () => {
  it("marks home link active when on /", async () => {
    await renderNav(makeUser(), [], 0, {
      path: "/",
      initialEntries: ["/"],
    });
    const homeLinks = document.querySelectorAll('a[href="/"]');
    expect(homeLinks.length).toBeGreaterThan(0);
    const activeLink = Array.from(homeLinks).find((a) => a.className.includes("text-accent"));
    expect(activeLink).toBeTruthy();
  });

  it("does not mark home link active when on /notifications", async () => {
    await renderNav(makeUser(), [], 0, {
      path: "/notifications",
      initialEntries: ["/notifications"],
    });
    const homeLinks = document.querySelectorAll('a[href="/"]');
    const activeHomeLinks = Array.from(homeLinks).filter(
      (a) => a.className.includes("text-accent-500") || a.className.includes("text-accent-600")
    );
    expect(activeHomeLinks.length).toBe(0);
  });

  it("marks /chat link active when on /chat route", async () => {
    await renderNav(makeUser(), [], 0, {
      path: "/chat",
      initialEntries: ["/chat"],
    });
    const chatLinks = document.querySelectorAll('a[href="/chat"]');
    const activeLink = Array.from(chatLinks).find((a) => a.className.includes("text-accent"));
    expect(activeLink).toBeTruthy();
  });

  it("marks /notifications link active when on /notifications route", async () => {
    await renderNav(makeUser(), [], 0, {
      path: "/notifications",
      initialEntries: ["/notifications"],
    });
    const notifLinks = document.querySelectorAll('a[href="/notifications"]');
    const activeLink = Array.from(notifLinks).find((a) => a.className.includes("text-accent"));
    expect(activeLink).toBeTruthy();
  });

  it("marks /members link active when on /members route", async () => {
    await renderNav(makeUser(), [], 0, {
      path: "/members",
      initialEntries: ["/members"],
    });
    const links = document.querySelectorAll('a[href="/members"]');
    const activeLink = Array.from(links).find((a) => a.className.includes("text-accent"));
    expect(activeLink).toBeTruthy();
  });

  it("marks /admin link active when on /admin route for admin user", async () => {
    await renderNav(makeUser({ role: "admin" }), [], 0, {
      path: "/admin",
      initialEntries: ["/admin"],
    });
    const links = document.querySelectorAll('a[href="/admin"]');
    const activeLink = Array.from(links).find(
      (a) => a.className.includes("text-accent") || a.className.includes("bg-accent")
    );
    expect(activeLink).toBeTruthy();
  });
});

describe("Navigation — no user logged in", () => {
  it("renders without crashing when user is null", async () => {
    await renderNav(null);
    expect(screen.getByLabelText("More")).toBeInTheDocument();
  });

  it("does not show Admin link when no user", async () => {
    await renderNav(null);
    expect(screen.queryByText("Admin")).toBeNull();
  });
});

describe("Navigation — custom nav (Tools section)", () => {
  it("renders the Tools section divider in the desktop sidebar", async () => {
    await renderNav(makeUser());
    const sidebar = document.querySelector("aside");
    expect(sidebar?.textContent).toContain("Tools");
  });

  it("renders the Ext Demo link in the desktop sidebar", async () => {
    await renderNav(makeUser());
    const sidebar = document.querySelector("aside");
    const extDemoLinks = sidebar?.querySelectorAll('a[href="/ext-demo"]');
    expect(extDemoLinks?.length).toBeGreaterThan(0);
  });

  it("renders the Ext Demo label text in the desktop sidebar", async () => {
    await renderNav(makeUser());
    const sidebar = document.querySelector("aside");
    expect(sidebar?.textContent).toContain("Ext Demo");
  });

  it("applies active styling to the Ext Demo link when on /ext-demo route", async () => {
    await renderNav(makeUser(), [], 0, {
      path: "/ext-demo",
      initialEntries: ["/ext-demo"],
    });
    const sidebar = document.querySelector("aside");
    const extDemoLink = sidebar?.querySelector('a[href="/ext-demo"]');
    expect(extDemoLink?.className).toContain("bg-accent-50");
    expect(extDemoLink?.className).toContain("text-accent-600");
  });

  it("applies inactive styling to Ext Demo link when not on /ext-demo route", async () => {
    await renderNav(makeUser(), [], 0, {
      path: "/",
      initialEntries: ["/"],
    });
    const sidebar = document.querySelector("aside");
    const extDemoLink = sidebar?.querySelector('a[href="/ext-demo"]');
    expect(extDemoLink?.className).toContain("text-gray-400");
  });

  it("renders the Ext Demo item in the More sheet", async () => {
    await renderNav(makeUser());
    const sheetGrid = document.querySelector(".grid.grid-cols-3");
    expect(sheetGrid?.textContent).toContain("Ext Demo");
  });
});
