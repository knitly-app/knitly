import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { screen, fireEvent, waitFor } from "@testing-library/preact";
import { renderWithProviders } from "../helpers/render";
import { mockFetch, jsonResponse, errorResponse, type MockFetchResult } from "../helpers/fetch";
import { CustomizeTab } from "../../components/CustomizeTab";
import { useAppSettings } from "../../hooks/useAppSettings";
import { DEFAULT_APP_SETTINGS, LOGO_ICON_NAMES } from "../../constants/settings";

let fetchMock: MockFetchResult;
afterEach(() => fetchMock?.restore());

beforeEach(() => {
  useAppSettings.setState({
    appName: DEFAULT_APP_SETTINGS.appName,
    logoIcon: DEFAULT_APP_SETTINGS.logoIcon,
    circlesEnabled: DEFAULT_APP_SETTINGS.circlesEnabled,
    isLoaded: true,
    isFetching: false,
    isSaving: false,
    error: null,
  });
});

async function renderTab() {
  return renderWithProviders(<CustomizeTab />);
}

describe("CustomizeTab — rendering", () => {
  it("renders the Customize heading", async () => {
    fetchMock = mockFetch({});
    await renderTab();
    expect(screen.getByText("Customize")).toBeInTheDocument();
  });

  it("renders the Application Name input with default value", async () => {
    fetchMock = mockFetch({});
    await renderTab();
    const input = screen.getByRole("textbox");
    expect(input.value).toBe("Knitly");
  });

  it("renders the Save Changes button (initially disabled — no unsaved changes)", async () => {
    fetchMock = mockFetch({});
    await renderTab();
    const btn = screen.getByText("Save Changes").closest("button");
    expect(btn).toHaveAttribute("disabled");
  });

  it("does not render Reset button when there are no changes", async () => {
    fetchMock = mockFetch({});
    await renderTab();
    expect(screen.queryByText("Reset")).toBeNull();
  });

  it("renders icon picker buttons", async () => {
    fetchMock = mockFetch({});
    await renderTab();
    const zapBtn = screen.getByTitle("Zap");
    expect(zapBtn).toBeInTheDocument();
  });

  it("renders all logo icon buttons", async () => {
    fetchMock = mockFetch({});
    await renderTab();
    expect(screen.getAllByRole("button", { hidden: false }).length).toBeGreaterThanOrEqual(
      LOGO_ICON_NAMES.length
    );
  });
});

describe("CustomizeTab — app name changes", () => {
  it("enables Save and shows Reset after changing app name", async () => {
    fetchMock = mockFetch({});
    await renderTab();
    const input = screen.getByRole("textbox");
    fireEvent.input(input, { target: { value: "MyApp" } });
    const saveBtn = screen.getByText("Save Changes").closest("button")!;
    expect(saveBtn).not.toHaveAttribute("disabled");
    expect(screen.getByText("Reset")).toBeInTheDocument();
  });

  it("Reset button restores original app name", async () => {
    fetchMock = mockFetch({});
    await renderTab();
    const input = screen.getByRole("textbox");
    fireEvent.input(input, { target: { value: "MyApp" } });
    fireEvent.click(screen.getByText("Reset"));
    expect((input as HTMLInputElement).value).toBe("Knitly");
    expect(screen.queryByText("Reset")).toBeNull();
  });

  it("disables Save when name is reverted to original", async () => {
    fetchMock = mockFetch({});
    await renderTab();
    const input = screen.getByRole("textbox");
    fireEvent.input(input, { target: { value: "Changed" } });
    fireEvent.input(input, { target: { value: "Knitly" } });
    const saveBtn = screen.getByText("Save Changes").closest("button")!;
    expect(saveBtn).toHaveAttribute("disabled");
  });
});

describe("CustomizeTab — logo icon picker", () => {
  it("clicking a different icon enables Save", async () => {
    fetchMock = mockFetch({});
    await renderTab();
    // Click "Rocket" icon
    fireEvent.click(screen.getByTitle("Rocket"));
    const saveBtn = screen.getByText("Save Changes").closest("button")!;
    expect(saveBtn).not.toHaveAttribute("disabled");
  });

  it("clicking a selected icon again does not change selection state (still same icon)", async () => {
    fetchMock = mockFetch({});
    await renderTab();
    fireEvent.click(screen.getByTitle("Zap"));
    const saveBtn = screen.getByText("Save Changes").closest("button")!;
    // Clicking the already-selected icon — no change expected
    expect(saveBtn).toHaveAttribute("disabled");
  });
});

describe("CustomizeTab — circles toggle", () => {
  it("renders the circles switch as enabled by default", async () => {
    await renderTab();
    const toggle = screen.getByRole("switch", { name: "Enable circles" });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("Enabled")).toBeInTheDocument();
  });

  it("toggling circles enables Save and PUTs circlesEnabled false", async () => {
    fetchMock = mockFetch(
      jsonResponse({ appName: "Knitly", logoIcon: "Zap", circlesEnabled: false })
    );
    await renderTab();
    fireEvent.click(screen.getByRole("switch", { name: "Enable circles" }));
    expect(screen.getByText("Disabled")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Save Changes"));
    await waitFor(() => {
      const putCall = fetchMock.calls.find((c) => c.method === "PUT");
      expect(putCall?.body).toMatchObject({ circlesEnabled: false });
    });
  });
});

describe("CustomizeTab — save success", () => {
  it("calls PUT /api/settings with updated values", async () => {
    fetchMock = mockFetch(jsonResponse({ appName: "MyApp", logoIcon: "Rocket" }));
    await renderTab();
    const input = screen.getByRole("textbox");
    fireEvent.input(input, { target: { value: "MyApp" } });
    fireEvent.click(screen.getByTitle("Rocket"));
    fireEvent.click(screen.getByText("Save Changes"));
    await waitFor(() => {
      const putCall = fetchMock.calls.find((c) => c.method === "PUT");
      expect(putCall).toBeDefined();
      expect(putCall?.body).toMatchObject({ appName: "MyApp", logoIcon: "Rocket" });
    });
  });

  it("shows 'Saved' with check icon after successful save", async () => {
    fetchMock = mockFetch(jsonResponse({ appName: "MyApp", logoIcon: "Zap" }));
    await renderTab();
    const input = screen.getByRole("textbox");
    fireEvent.input(input, { target: { value: "MyApp" } });
    fireEvent.click(screen.getByText("Save Changes"));
    await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument());
  });
});

describe("CustomizeTab — save error", () => {
  it("shows error message when save fails", async () => {
    fetchMock = mockFetch(errorResponse(500, { error: "DB error" }));
    await renderTab();
    const input = screen.getByRole("textbox");
    fireEvent.input(input, { target: { value: "Fail" } });
    fireEvent.click(screen.getByText("Save Changes"));
    await waitFor(() =>
      expect(screen.getByText("Failed to save. Please try again.")).toBeInTheDocument()
    );
  });

  it("error message disappears after reset", async () => {
    fetchMock = mockFetch(errorResponse(500));
    await renderTab();
    const input = screen.getByRole("textbox");
    fireEvent.input(input, { target: { value: "Fail" } });
    fireEvent.click(screen.getByText("Save Changes"));
    await waitFor(() =>
      expect(screen.getByText("Failed to save. Please try again.")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText("Reset"));
    expect(screen.queryByText("Failed to save. Please try again.")).toBeNull();
  });
});

describe("CustomizeTab — disabled states", () => {
  it("Save is disabled while isFetching", async () => {
    fetchMock = mockFetch({});
    useAppSettings.setState({ isFetching: true });
    await renderWithProviders(<CustomizeTab />);
    const input = screen.getByRole("textbox");
    fireEvent.input(input, { target: { value: "Changed" } });
    const saveBtn = screen.getByText("Save Changes").closest("button")!;
    expect(saveBtn).toHaveAttribute("disabled");
  });
});
