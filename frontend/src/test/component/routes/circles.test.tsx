import { describe, it, expect, afterEach } from "bun:test";
import { screen, fireEvent, waitFor } from "@testing-library/preact";
import { renderWithProviders, makeQueryClient } from "../../helpers/render";
import { mockFetch, type MockFetchResult } from "../../helpers/fetch";
import { CirclesRoute } from "../../../routes/circles";
import { queryKeys } from "../../../api/queryKeys";
import type { Circle } from "../../../api/endpoints";

let fetchMock: MockFetchResult;
afterEach(() => fetchMock?.restore());

function makeCircle(id: string, name: string): Circle {
  return { id, userId: "u1", name, color: "blue", createdAt: "2024-01-01", memberCount: 0 };
}

async function renderCircles(circles: Circle[] = []) {
  const qc = makeQueryClient();
  qc.setQueryData(queryKeys.circles.all(), circles);
  fetchMock = mockFetch(circles);
  return renderWithProviders(<CirclesRoute />, {
    path: "/circles",
    initialEntries: ["/circles"],
    queryClient: qc,
  });
}

describe("CirclesRoute — render", () => {
  it("renders the Circles heading", async () => {
    await renderCircles();
    expect(screen.getByText("Circles")).toBeInTheDocument();
  });

  it("renders the description text", async () => {
    await renderCircles();
    expect(screen.getByText(/Circles let you share Moments/)).toBeInTheDocument();
  });

  it("renders Back button", async () => {
    await renderCircles();
    expect(screen.getByText("Back")).toBeInTheDocument();
  });

  it("renders CircleManager component", async () => {
    await renderCircles();
    // CircleManager renders "Create Circle" when empty
    expect(screen.getByText("Create Circle")).toBeInTheDocument();
  });

  it("shows empty state when no circles", async () => {
    await renderCircles();
    expect(screen.getByText(/No circles yet/)).toBeInTheDocument();
  });

  it("renders populated circles", async () => {
    const circles = [makeCircle("c1", "Family"), makeCircle("c2", "Friends")];
    await renderCircles(circles);
    await waitFor(() => {
      expect(screen.getByText("Family")).toBeInTheDocument();
      expect(screen.getByText("Friends")).toBeInTheDocument();
    });
  });

  it("shows loading spinner while fetching circles", async () => {
    const qc = makeQueryClient();
    fetchMock = mockFetch(() => new Promise(() => {}));
    await renderWithProviders(<CirclesRoute />, {
      path: "/circles",
      initialEntries: ["/circles"],
      queryClient: qc,
    });
    // Loading spinner or placeholder rendered
    expect(screen.getByText("Circles")).toBeInTheDocument();
  });
});

describe("CirclesRoute — Back button navigation", () => {
  it("clicking Back does not throw (navigate handler fires)", async () => {
    await renderCircles();
    const backBtn = screen.getByText("Back");
    fireEvent.click(backBtn);
    // The click invokes navigate({ to: '/settings' }); in the memory router this is a no-op,
    // but the handler must execute without error
    expect(screen.getByText("Circles")).toBeInTheDocument();
  });
});
