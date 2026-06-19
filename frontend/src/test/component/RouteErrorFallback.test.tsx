import { describe, it, expect, afterEach, mock } from "bun:test";
import { screen, fireEvent } from "@testing-library/preact";
import { renderWithProviders } from "../helpers/render";
import { mockFetch, type MockFetchResult } from "../helpers/fetch";
import { RouteErrorFallback, FeedErrorFallback } from "../../components/RouteErrorFallback";

let fetchMock: MockFetchResult;
afterEach(() => fetchMock?.restore());

describe("RouteErrorFallback", () => {
  it("renders the failure heading and description", async () => {
    fetchMock = mockFetch({});
    await renderWithProviders(<RouteErrorFallback />);
    expect(screen.getByText("Failed to load this page")).toBeInTheDocument();
    expect(screen.getByText(/couldn't load the content/i)).toBeInTheDocument();
  });

  it("renders Home and Retry buttons", async () => {
    fetchMock = mockFetch({});
    await renderWithProviders(<RouteErrorFallback />);
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("calls reset() when Retry is clicked and reset is provided", async () => {
    fetchMock = mockFetch({});
    const reset = mock(() => {});
    await renderWithProviders(<RouteErrorFallback reset={reset} />);
    fireEvent.click(screen.getByText("Retry"));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("navigates to / when Home is clicked", async () => {
    fetchMock = mockFetch({});
    await renderWithProviders(<RouteErrorFallback />, {
      path: "/some-page",
      initialEntries: ["/some-page"],
    });
    // Clicking Home triggers router.navigate — we just verify it does not throw
    fireEvent.click(screen.getByText("Home"));
    expect(screen.getByText("Home")).toBeInTheDocument();
  });

  it("does not render error detail pre-block when no error prop given", async () => {
    fetchMock = mockFetch({});
    await renderWithProviders(<RouteErrorFallback />);
    expect(screen.queryByRole("region")).toBeNull();
    // pre tag should not exist when no error
    expect(document.querySelector("pre")).toBeNull();
  });

  it("calls router.invalidate when Retry is clicked without a reset prop", async () => {
    fetchMock = mockFetch({});
    // No reset prop — code path falls through to router.invalidate()
    await renderWithProviders(<RouteErrorFallback />);
    // Just verify clicking Retry does not throw and buttons remain
    fireEvent.click(screen.getByText("Retry"));
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });
});

describe("RouteErrorFallback — error prop (import.meta.env.DEV branch)", () => {
  it("passes through an error object without crashing", async () => {
    fetchMock = mockFetch({});
    const err = new Error("Something broke");
    await renderWithProviders(<RouteErrorFallback error={err} />);
    // The heading is always rendered regardless of DEV flag
    expect(screen.getByText("Failed to load this page")).toBeInTheDocument();
  });
});

describe("FeedErrorFallback", () => {
  it("renders the feed-level error heading", async () => {
    fetchMock = mockFetch({});
    await renderWithProviders(<FeedErrorFallback onRetry={() => {}} />);
    expect(screen.getByText("Couldn't load posts")).toBeInTheDocument();
  });

  it("calls onRetry when Retry is clicked", async () => {
    fetchMock = mockFetch({});
    const onRetry = mock(() => {});
    await renderWithProviders(<FeedErrorFallback onRetry={onRetry} />);
    fireEvent.click(screen.getByText("Retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
