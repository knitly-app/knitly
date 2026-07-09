import { describe, it, expect, afterEach } from "bun:test";
import { screen, fireEvent, waitFor } from "@testing-library/preact";
import { renderWithProviders, makeQueryClient } from "../helpers/render";
import { mockFetch, type MockFetchResult } from "../helpers/fetch";
import { CircleManager } from "../../components/CircleManager";
import { queryKeys } from "../../api/queryKeys";
import type { Circle, CircleWithMembers } from "../../api/endpoints";

let fetchMock: MockFetchResult;
afterEach(() => fetchMock?.restore());

function makeCircle(id: string, name: string, color = "blue", memberCount = 0): Circle {
  return { id, userId: "u1", name, color, createdAt: "2024-01-01", memberCount };
}

function makeCircleWithMembers(
  id: string,
  name: string,
  members: CircleWithMembers["members"] = []
): CircleWithMembers {
  return { id, userId: "u1", name, color: "blue", createdAt: "2024-01-01", members };
}

/** Click the main toggle row for a named circle (not the pencil, not Create) */
function clickCircleRow(name: string) {
  const rowBtn = screen
    .getAllByRole("button")
    .find((b) => b.textContent?.includes(name) && !b.textContent?.includes("Create"));
  if (!rowBtn) throw new Error(`Circle row "${name}" not found`);
  fireEvent.click(rowBtn);
}

/** Find and click the pencil (edit) button for a circle item */
function clickPencilBtn() {
  const svgBtns = screen.getAllByRole("button").filter((b) => b.querySelector("svg"));
  const editBtn = svgBtns.find(
    (b) => !b.textContent?.includes("Family") && !b.textContent?.includes("Create")
  );
  if (!editBtn) throw new Error("Pencil edit button not found");
  fireEvent.click(editBtn);
}

describe("CircleManager — empty state", () => {
  it("shows 'No circles yet' when list is empty", async () => {
    fetchMock = mockFetch([]);
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.circles.all(), []);
    await renderWithProviders(<CircleManager />, { queryClient: qc });
    expect(screen.getByText(/No circles yet/)).toBeInTheDocument();
  });

  it("shows Create Circle button", async () => {
    fetchMock = mockFetch([]);
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.circles.all(), []);
    await renderWithProviders(<CircleManager />, { queryClient: qc });
    expect(screen.getByText("Create Circle")).toBeInTheDocument();
  });
});

describe("CircleManager — circle list", () => {
  it("renders a circle by name", async () => {
    fetchMock = mockFetch([makeCircle("c1", "Family")]);
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.circles.all(), [makeCircle("c1", "Family")]);
    await renderWithProviders(<CircleManager />, { queryClient: qc });
    expect(screen.getByText("Family")).toBeInTheDocument();
  });

  it("renders member count", async () => {
    fetchMock = mockFetch([]);
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.circles.all(), [makeCircle("c1", "Family", "blue", 3)]);
    await renderWithProviders(<CircleManager />, { queryClient: qc });
    expect(screen.getByText("3 members")).toBeInTheDocument();
  });

  it("renders multiple circles", async () => {
    fetchMock = mockFetch([]);
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.circles.all(), [
      makeCircle("c1", "Family"),
      makeCircle("c2", "Friends", "green"),
    ]);
    await renderWithProviders(<CircleManager />, { queryClient: qc });
    expect(screen.getByText("Family")).toBeInTheDocument();
    expect(screen.getByText("Friends")).toBeInTheDocument();
  });
});

describe("CircleManager — create form", () => {
  it("clicking Create Circle shows the form", async () => {
    fetchMock = mockFetch([]);
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.circles.all(), []);
    await renderWithProviders(<CircleManager />, { queryClient: qc });
    fireEvent.click(screen.getByText("Create Circle"));
    expect(screen.getByPlaceholderText(/Family, Close Friends/)).toBeInTheDocument();
  });

  it("Create Circle submit button is disabled when name is empty", async () => {
    fetchMock = mockFetch([]);
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.circles.all(), []);
    await renderWithProviders(<CircleManager />, { queryClient: qc });
    fireEvent.click(screen.getByText("Create Circle"));
    const disabledBtn = screen
      .getAllByRole("button")
      .find((b) => b.textContent === "Create Circle" && b.hasAttribute("disabled"));
    expect(disabledBtn).toBeDefined();
  });

  it("Cancel in create form hides the form", async () => {
    fetchMock = mockFetch([]);
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.circles.all(), []);
    await renderWithProviders(<CircleManager />, { queryClient: qc });
    fireEvent.click(screen.getByText("Create Circle"));
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByPlaceholderText(/Family, Close Friends/)).toBeNull();
  });

  it("submitting create form calls POST /api/circles", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.circles.all(), []);
    fetchMock = mockFetch((call) => {
      if (call.method === "POST" && call.url.includes("/circles")) {
        return makeCircle("c99", "Coworkers");
      }
      return [];
    });
    await renderWithProviders(<CircleManager />, { queryClient: qc });
    fireEvent.click(screen.getByText("Create Circle"));
    const input = screen.getByPlaceholderText(/Family, Close Friends/);
    fireEvent.input(input, { target: { value: "Coworkers" } });
    const submitBtn = screen
      .getAllByRole("button")
      .find((b) => b.textContent === "Create Circle" && !b.hasAttribute("disabled"))!;
    fireEvent.click(submitBtn);
    await waitFor(() => {
      const postCall = fetchMock.calls.find(
        (c) => c.method === "POST" && c.url.includes("/circles")
      );
      expect(postCall).toBeDefined();
      expect(postCall?.body).toMatchObject({ name: "Coworkers", color: "blue" });
    });
  });

  it("selecting a color in create form updates selection without crash", async () => {
    fetchMock = mockFetch([]);
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.circles.all(), []);
    await renderWithProviders(<CircleManager />, { queryClient: qc });
    fireEvent.click(screen.getByText("Create Circle"));
    const colorBtns = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("type") === "button" && b.className.includes("rounded-full"));
    fireEvent.click(colorBtns[1]);
    expect(screen.getByPlaceholderText(/Family, Close Friends/)).toBeInTheDocument();
  });
});

describe("CircleManager — circle toggle / expand", () => {
  it("clicking a circle row expands it to show CircleDetails", async () => {
    const qc = makeQueryClient();
    const circle = makeCircle("c1", "Family");
    qc.setQueryData(queryKeys.circles.all(), [circle]);
    qc.setQueryData(queryKeys.circles.detail("c1"), makeCircleWithMembers("c1", "Family"));
    fetchMock = mockFetch(() => makeCircleWithMembers("c1", "Family"));
    await renderWithProviders(<CircleManager />, { queryClient: qc });
    clickCircleRow("Family");
    await waitFor(() => expect(screen.getByText("Add Members")).toBeInTheDocument());
  });

  it("clicking the same circle row again collapses it", async () => {
    const qc = makeQueryClient();
    const circle = makeCircle("c1", "Family");
    qc.setQueryData(queryKeys.circles.all(), [circle]);
    qc.setQueryData(queryKeys.circles.detail("c1"), makeCircleWithMembers("c1", "Family"));
    fetchMock = mockFetch(() => makeCircleWithMembers("c1", "Family"));
    await renderWithProviders(<CircleManager />, { queryClient: qc });
    clickCircleRow("Family");
    await waitFor(() => expect(screen.getByText("Add Members")).toBeInTheDocument());
    clickCircleRow("Family");
    await waitFor(() => expect(screen.queryByText("Add Members")).toBeNull());
  });

  it("shows spinner while circle detail is loading", async () => {
    const qc = makeQueryClient();
    const circle = makeCircle("c1", "Family");
    qc.setQueryData(queryKeys.circles.all(), [circle]);
    // Do NOT seed the detail — let the fetch be pending so isLoading = true
    let resolveDetail: ((v: unknown) => void) | null = null;
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/circles/c1"))
        return new Promise((r) => {
          resolveDetail = r;
        });
      return [circle];
    });
    await renderWithProviders(<CircleManager />, { queryClient: qc });
    clickCircleRow("Family");
    // The spinner (Spinner component) should be visible before the detail resolves
    await waitFor(() => {
      const spinners = document.querySelectorAll(".animate-spin");
      expect(spinners.length).toBeGreaterThan(0);
    });
    // Resolve to avoid dangling promise
    resolveDetail?.(makeCircleWithMembers("c1", "Family"));
  });
});

describe("CircleManager — edit circle", () => {
  it("clicking the pencil button shows the edit form", async () => {
    const qc = makeQueryClient();
    const circle = makeCircle("c1", "Family");
    qc.setQueryData(queryKeys.circles.all(), [circle]);
    fetchMock = mockFetch([circle]);
    await renderWithProviders(<CircleManager />, { queryClient: qc });
    clickPencilBtn();
    await waitFor(() => expect(screen.getByText("Save")).toBeInTheDocument());
  });

  it("cancel edit restores original view", async () => {
    const qc = makeQueryClient();
    const circle = makeCircle("c1", "Family");
    qc.setQueryData(queryKeys.circles.all(), [circle]);
    fetchMock = mockFetch([circle]);
    await renderWithProviders(<CircleManager />, { queryClient: qc });
    clickPencilBtn();
    await waitFor(() => expect(screen.getByText("Save")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Cancel"));
    await waitFor(() => expect(screen.queryByText("Save")).toBeNull());
    expect(screen.getByText("Family")).toBeInTheDocument();
  });

  it("save edit calls PATCH /api/circles/:id", async () => {
    const qc = makeQueryClient();
    const circle = makeCircle("c1", "Family");
    qc.setQueryData(queryKeys.circles.all(), [circle]);
    fetchMock = mockFetch((call) => {
      if (call.method === "PATCH") return { ...circle, name: "Updated" };
      return [circle];
    });
    await renderWithProviders(<CircleManager />, { queryClient: qc });
    clickPencilBtn();
    await waitFor(() => expect(screen.getByText("Save")).toBeInTheDocument());
    const editInput = screen
      .getAllByRole("textbox")
      .find((i) => (i as HTMLInputElement).value === "Family")!;
    fireEvent.input(editInput, { target: { value: "Updated" } });
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => {
      const patchCall = fetchMock.calls.find((c) => c.method === "PATCH");
      expect(patchCall).toBeDefined();
    });
  });

  it("save is disabled when edit name is empty", async () => {
    const qc = makeQueryClient();
    const circle = makeCircle("c1", "Family");
    qc.setQueryData(queryKeys.circles.all(), [circle]);
    fetchMock = mockFetch([circle]);
    await renderWithProviders(<CircleManager />, { queryClient: qc });
    clickPencilBtn();
    await waitFor(() => expect(screen.getByText("Save")).toBeInTheDocument());
    const editInput = screen
      .getAllByRole("textbox")
      .find((i) => (i as HTMLInputElement).value === "Family")!;
    fireEvent.input(editInput, { target: { value: "" } });
    const saveBtn = screen.getByText("Save").closest("button")!;
    expect(saveBtn).toHaveAttribute("disabled");
  });

  it("selecting a color in edit form does not crash", async () => {
    const qc = makeQueryClient();
    const circle = makeCircle("c1", "Family");
    qc.setQueryData(queryKeys.circles.all(), [circle]);
    fetchMock = mockFetch([circle]);
    await renderWithProviders(<CircleManager />, { queryClient: qc });
    clickPencilBtn();
    await waitFor(() => expect(screen.getByText("Save")).toBeInTheDocument());
    const colorBtns = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("type") === "button" && b.className.includes("rounded-full"));
    fireEvent.click(colorBtns[0]);
    expect(screen.getByText("Save")).toBeInTheDocument();
  });
});

describe("CircleManager — delete circle", () => {
  it("clicking Delete Circle button in expanded details shows confirm modal message", async () => {
    const qc = makeQueryClient();
    const circle = makeCircle("c1", "Family");
    qc.setQueryData(queryKeys.circles.all(), [circle]);
    qc.setQueryData(queryKeys.circles.detail("c1"), makeCircleWithMembers("c1", "Family"));
    fetchMock = mockFetch((call) => {
      if (call.url.includes("/circles/c1") && call.method === "GET")
        return makeCircleWithMembers("c1", "Family");
      return [circle];
    });
    await renderWithProviders(<CircleManager />, { queryClient: qc });
    clickCircleRow("Family");
    await waitFor(() => expect(screen.getByText("Delete Circle")).toBeInTheDocument());
    // Click the "Delete Circle" button in CircleDetails
    const deleteCircleBtn = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.trim() === "Delete Circle");
    fireEvent.click(deleteCircleBtn!);
    // Modal message text appears
    await waitFor(() =>
      expect(screen.getByText(/This will remove the circle/)).toBeInTheDocument()
    );
  });

  it("confirming delete calls DELETE /api/circles/:id", async () => {
    const qc = makeQueryClient();
    const circle = makeCircle("c1", "Family");
    qc.setQueryData(queryKeys.circles.all(), [circle]);
    qc.setQueryData(queryKeys.circles.detail("c1"), makeCircleWithMembers("c1", "Family"));
    fetchMock = mockFetch((call) => {
      if (call.url.includes("/circles/c1") && call.method === "GET")
        return makeCircleWithMembers("c1", "Family");
      if (call.method === "DELETE") return {};
      return [circle];
    });
    await renderWithProviders(<CircleManager />, { queryClient: qc });
    clickCircleRow("Family");
    await waitFor(() => expect(screen.getByText("Delete Circle")).toBeInTheDocument());
    const deleteCircleBtn = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.trim() === "Delete Circle");
    fireEvent.click(deleteCircleBtn!);
    await waitFor(() =>
      expect(screen.getByText(/This will remove the circle/)).toBeInTheDocument()
    );
    const confirmDeleteBtn = screen.getAllByRole("button").find((b) => b.textContent === "Delete");
    fireEvent.click(confirmDeleteBtn!);
    await waitFor(() => {
      const deleteCall = fetchMock.calls.find((c) => c.method === "DELETE");
      expect(deleteCall).toBeDefined();
    });
  });

  it("cancelling delete dialog does not call DELETE", async () => {
    const qc = makeQueryClient();
    const circle = makeCircle("c1", "Family");
    qc.setQueryData(queryKeys.circles.all(), [circle]);
    qc.setQueryData(queryKeys.circles.detail("c1"), makeCircleWithMembers("c1", "Family"));
    fetchMock = mockFetch((call) => {
      if (call.url.includes("/circles/c1") && call.method === "GET")
        return makeCircleWithMembers("c1", "Family");
      return [circle];
    });
    await renderWithProviders(<CircleManager />, { queryClient: qc });
    clickCircleRow("Family");
    await waitFor(() => expect(screen.getByText("Delete Circle")).toBeInTheDocument());
    const deleteCircleBtn = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.trim() === "Delete Circle");
    fireEvent.click(deleteCircleBtn!);
    await waitFor(() =>
      expect(screen.getByText(/This will remove the circle/)).toBeInTheDocument()
    );
    const cancelBtn = screen.getAllByRole("button").find((b) => b.textContent === "Cancel");
    fireEvent.click(cancelBtn!);
    expect(fetchMock.calls.filter((c) => c.method === "DELETE")).toHaveLength(0);
  });
});

describe("CircleManager — members", () => {
  it("shows existing members in expanded circle", async () => {
    const qc = makeQueryClient();
    const circle = makeCircle("c1", "Family", "blue", 1);
    const circleWithMembers = makeCircleWithMembers("c1", "Family", [
      { id: "u2", username: "alice", displayName: "Alice", joinedAt: "2024-01-01" },
    ]);
    qc.setQueryData(queryKeys.circles.all(), [circle]);
    qc.setQueryData(queryKeys.circles.detail("c1"), circleWithMembers);
    fetchMock = mockFetch(circleWithMembers);
    await renderWithProviders(<CircleManager />, { queryClient: qc });
    clickCircleRow("Family");
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
  });

  it("shows user search results when 2+ characters are typed", async () => {
    const qc = makeQueryClient();
    const circle = makeCircle("c1", "Family");
    const circleDetail = makeCircleWithMembers("c1", "Family");
    const userBob = { id: "u3", username: "bob", displayName: "Bob", createdAt: "2024-01-01" };
    qc.setQueryData(queryKeys.circles.all(), [circle]);
    qc.setQueryData(queryKeys.circles.detail("c1"), circleDetail);
    qc.setQueryData(queryKeys.users.all(), [userBob]);
    fetchMock = mockFetch((call) => {
      if (call.url.includes("/circles/c1")) return circleDetail;
      if (call.url === "/api/users") return [userBob];
      return [circle];
    });
    await renderWithProviders(<CircleManager />, { queryClient: qc });
    clickCircleRow("Family");
    await waitFor(() => expect(screen.getByPlaceholderText("Search users...")).toBeInTheDocument());
    fireEvent.input(screen.getByPlaceholderText("Search users..."), { target: { value: "bo" } });
    await waitFor(() => expect(screen.getByText("Bob")).toBeInTheDocument());
  });

  it("shows 'No users found' when search has no matches", async () => {
    const qc = makeQueryClient();
    const circle = makeCircle("c1", "Family");
    const circleDetail = makeCircleWithMembers("c1", "Family");
    qc.setQueryData(queryKeys.circles.all(), [circle]);
    qc.setQueryData(queryKeys.circles.detail("c1"), circleDetail);
    qc.setQueryData(queryKeys.users.all(), []);
    fetchMock = mockFetch((call) => {
      if (call.url.includes("/circles/c1")) return circleDetail;
      return [];
    });
    await renderWithProviders(<CircleManager />, { queryClient: qc });
    clickCircleRow("Family");
    await waitFor(() => expect(screen.getByPlaceholderText("Search users...")).toBeInTheDocument());
    fireEvent.input(screen.getByPlaceholderText("Search users..."), { target: { value: "zz" } });
    await waitFor(() => expect(screen.getByText("No users found")).toBeInTheDocument());
  });

  it("clicking a user in search results calls POST /api/circles/:id/members", async () => {
    const qc = makeQueryClient();
    const circle = makeCircle("c1", "Family");
    const circleDetail = makeCircleWithMembers("c1", "Family");
    const userBob = { id: "u3", username: "bob", displayName: "Bob", createdAt: "2024-01-01" };
    qc.setQueryData(queryKeys.circles.all(), [circle]);
    qc.setQueryData(queryKeys.circles.detail("c1"), circleDetail);
    qc.setQueryData(queryKeys.users.all(), [userBob]);
    fetchMock = mockFetch((call) => {
      if (call.url.includes("/circles/c1") && call.method === "GET") return circleDetail;
      if (call.method === "POST" && call.url.includes("/members"))
        return { success: true, added: 1 };
      return [circle];
    });
    await renderWithProviders(<CircleManager />, { queryClient: qc });
    clickCircleRow("Family");
    await waitFor(() => expect(screen.getByPlaceholderText("Search users...")).toBeInTheDocument());
    fireEvent.input(screen.getByPlaceholderText("Search users..."), { target: { value: "bo" } });
    await waitFor(() => expect(screen.getByText("Bob")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Bob"));
    await waitFor(() => {
      const memberCall = fetchMock.calls.find(
        (c) => c.method === "POST" && c.url.includes("/members")
      );
      expect(memberCall).toBeDefined();
    });
  });

  it("clicking remove member button calls DELETE /api/circles/:id/members/:userId", async () => {
    const qc = makeQueryClient();
    const circle = makeCircle("c1", "Family", "blue", 1);
    const circleDetail = makeCircleWithMembers("c1", "Family", [
      { id: "u2", username: "alice", displayName: "Alice", joinedAt: "2024-01-01" },
    ]);
    qc.setQueryData(queryKeys.circles.all(), [circle]);
    qc.setQueryData(queryKeys.circles.detail("c1"), circleDetail);
    fetchMock = mockFetch((call) => {
      if (call.url.includes("/circles/c1") && call.method === "GET") return circleDetail;
      if (call.method === "DELETE" && call.url.includes("/members")) return {};
      return [circle];
    });
    await renderWithProviders(<CircleManager />, { queryClient: qc });
    clickCircleRow("Family");
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    fireEvent.click(screen.getByTitle("Remove member"));
    await waitFor(() => {
      const deleteCall = fetchMock.calls.find(
        (c) => c.method === "DELETE" && c.url.includes("/members")
      );
      expect(deleteCall).toBeDefined();
    });
  });
});
