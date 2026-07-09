import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { screen, fireEvent, waitFor } from "@testing-library/preact";
import { renderWithProviders, makeQueryClient } from "../../helpers/render";
import { mockFetch, type MockFetchResult } from "../../helpers/fetch";
import { MembersRoute } from "../../../routes/members";
import { useUIStore } from "../../../stores/ui";
import { queryKeys } from "../../../api/queryKeys";
import type { User } from "../../../api/endpoints";

let fetchMock: MockFetchResult;
afterEach(() => fetchMock?.restore());

beforeEach(() => {
  useUIStore.setState({
    editingPostId: null,
    showCreatePost: false,
    initialMedia: null,
    searchMode: "people",
  });
});

function makeMember(overrides: Partial<User> = {}): User {
  return {
    id: "u1",
    username: "ada",
    displayName: "Ada Lovelace",
    createdAt: "2024-01-01",
    ...overrides,
  };
}

async function renderMembers(members: User[] | null = null, error = false) {
  const qc = makeQueryClient();

  if (members !== null && !error) {
    qc.setQueryData(queryKeys.members(), members);
  }

  fetchMock = mockFetch(({ url }: { url: string }) => {
    if (url.includes("/api/users") && !url.includes("/api/users/")) {
      if (error)
        return new Response(JSON.stringify({ error: "fail" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      return members ?? [];
    }
    if (url.includes("/api/auth/me")) return null;
    return null;
  });

  return renderWithProviders(<MembersRoute />, { path: "/members", queryClient: qc });
}

describe("MembersRoute — heading", () => {
  it("renders the Members heading", async () => {
    await renderMembers([]);
    await waitFor(() => expect(screen.getByText("Members")).toBeInTheDocument());
  });

  it("shows total count as 0 when empty", async () => {
    await renderMembers([]);
    await waitFor(() => expect(screen.getByText("0 total")).toBeInTheDocument());
  });

  it("shows correct total count", async () => {
    const members = [makeMember(), makeMember({ id: "u2", username: "bob", displayName: "Bob" })];
    await renderMembers(members);
    await waitFor(() => expect(screen.getByText("2 total")).toBeInTheDocument());
  });
});

describe("MembersRoute — search input", () => {
  it("renders the search input", async () => {
    await renderMembers([]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search members...")).toBeInTheDocument();
    });
  });
});

describe("MembersRoute — loading state", () => {
  it("shows skeleton cards while loading", async () => {
    const qc = makeQueryClient();
    fetchMock = mockFetch(() => new Promise(() => {}));
    await renderWithProviders(<MembersRoute />, { path: "/members", queryClient: qc });
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe("MembersRoute — error state", () => {
  it("shows error message when members fails to load", async () => {
    const qc = makeQueryClient();
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/users"))
        return new Response(JSON.stringify({ error: "fail" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      if (url.includes("/api/auth/me")) return null;
      return null;
    });
    await renderWithProviders(<MembersRoute />, { path: "/members", queryClient: qc });
    await waitFor(() => {
      expect(screen.getByText("Failed to load members")).toBeInTheDocument();
    });
  });
});

describe("MembersRoute — empty state", () => {
  it("shows no members found when list is empty", async () => {
    await renderMembers([]);
    await waitFor(() => expect(screen.getByText("No members found")).toBeInTheDocument());
  });
});

describe("MembersRoute — populated", () => {
  it("renders multiple member cards", async () => {
    const members = [
      makeMember({ id: "u1", username: "ada", displayName: "Ada" }),
      makeMember({ id: "u2", username: "bob", displayName: "Bob" }),
    ];
    await renderMembers(members);
    await waitFor(() => {
      expect(screen.getByText("Ada")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });
  });
});

describe("MembersRoute — search filtering", () => {
  it("filters members by display name", async () => {
    const members = [
      makeMember({ id: "u1", username: "ada", displayName: "Ada Lovelace" }),
      makeMember({ id: "u2", username: "bob", displayName: "Bob Smith" }),
    ];
    await renderMembers(members);
    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeInTheDocument());

    const input = screen.getByPlaceholderText("Search members...");
    fireEvent.input(input, { target: { value: "ada" } });

    await waitFor(() => {
      expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
      expect(screen.queryByText("Bob Smith")).toBeNull();
    });
  });

  it("filters members by username", async () => {
    const members = [
      makeMember({ id: "u1", username: "ada", displayName: "Ada Lovelace" }),
      makeMember({ id: "u2", username: "bob", displayName: "Bob Smith" }),
    ];
    await renderMembers(members);
    await waitFor(() => expect(screen.getByText("Bob Smith")).toBeInTheDocument());

    const input = screen.getByPlaceholderText("Search members...");
    fireEvent.input(input, { target: { value: "bob" } });

    await waitFor(() => {
      expect(screen.getByText("Bob Smith")).toBeInTheDocument();
      expect(screen.queryByText("Ada Lovelace")).toBeNull();
    });
  });

  it("shows all members when search is cleared", async () => {
    const members = [
      makeMember({ id: "u1", username: "ada", displayName: "Ada Lovelace" }),
      makeMember({ id: "u2", username: "bob", displayName: "Bob Smith" }),
    ];
    await renderMembers(members);
    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeInTheDocument());

    const input = screen.getByPlaceholderText("Search members...");
    fireEvent.input(input, { target: { value: "ada" } });
    await waitFor(() => expect(screen.queryByText("Bob Smith")).toBeNull());

    fireEvent.input(input, { target: { value: "" } });
    await waitFor(() => {
      expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
      expect(screen.getByText("Bob Smith")).toBeInTheDocument();
    });
  });

  it("shows no members found when filter matches nobody", async () => {
    const members = [makeMember({ displayName: "Ada Lovelace" })];
    await renderMembers(members);
    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeInTheDocument());

    const input = screen.getByPlaceholderText("Search members...");
    fireEvent.input(input, { target: { value: "zzznomatch" } });

    await waitFor(() => {
      expect(screen.getByText("No members found")).toBeInTheDocument();
    });
  });

  it("is case-insensitive in filter", async () => {
    const members = [makeMember({ displayName: "Ada Lovelace", username: "ada" })];
    await renderMembers(members);
    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeInTheDocument());

    const input = screen.getByPlaceholderText("Search members...");
    fireEvent.input(input, { target: { value: "ADA" } });

    await waitFor(() => {
      expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    });
  });
});
