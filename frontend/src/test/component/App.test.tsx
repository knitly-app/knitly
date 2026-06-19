import { describe, it, expect, afterEach, beforeEach } from "bun:test";
import { screen } from "@testing-library/preact";
import { App } from "../../App";
import { useUIStore } from "../../stores/ui";
import { renderWithProviders } from "../helpers/render";
import { mockFetch, type MockFetchResult } from "../helpers/fetch";

let fetchMock: MockFetchResult;

beforeEach(() => {
  useUIStore.setState({ showCreatePost: false, initialMedia: null });
});
afterEach(() => fetchMock?.restore());

describe("App", () => {
  it("shows navigation on a non-public route", async () => {
    fetchMock = mockFetch({});
    await renderWithProviders(<App />, { path: "/", initialEntries: ["/"] });
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("hides navigation on a public route", async () => {
    fetchMock = mockFetch({});
    await renderWithProviders(<App />, { path: "/login", initialEntries: ["/login"] });
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("renders the create-post modal when the UI store opens it", async () => {
    fetchMock = mockFetch({});
    useUIStore.setState({ showCreatePost: true });
    await renderWithProviders(<App />, { path: "/login", initialEntries: ["/login"] });
    expect(screen.getByText("New Moment")).toBeInTheDocument();
  });
});
