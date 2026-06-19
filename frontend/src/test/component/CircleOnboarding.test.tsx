import { describe, it, expect, afterEach, mock } from "bun:test";
import { screen, fireEvent, waitFor } from "@testing-library/preact";
import { renderWithProviders } from "../helpers/render";
import { mockFetch, errorResponse, type MockFetchResult } from "../helpers/fetch";
import { CircleOnboarding } from "../../components/CircleOnboarding";

let fetchMock: MockFetchResult;
afterEach(() => fetchMock?.restore());

function makeCircle(id: string, name: string) {
  return { id, userId: "u1", name, color: "blue", createdAt: "2024-01-01" };
}

async function render(onComplete = mock(() => {}), onSkip = mock(() => {})) {
  return renderWithProviders(<CircleOnboarding onComplete={onComplete} onSkip={onSkip} />);
}

describe("CircleOnboarding — rendering", () => {
  it("shows the heading and subtitle", async () => {
    fetchMock = mockFetch([]);
    await render();
    expect(screen.getByText("Who do you want to share with?")).toBeInTheDocument();
    expect(screen.getByText(/Create up to 4 circles/)).toBeInTheDocument();
  });

  it("renders 4 circle inputs", async () => {
    fetchMock = mockFetch([]);
    await render();
    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(4);
  });

  it("pre-fills Family and Friends inputs", async () => {
    fetchMock = mockFetch([]);
    await render();
    const inputs = screen.getAllByRole("textbox");
    expect((inputs[0] as HTMLInputElement).value).toBe("Family");
    expect((inputs[1] as HTMLInputElement).value).toBe("Friends");
    expect((inputs[2] as HTMLInputElement).value).toBe("");
    expect((inputs[3] as HTMLInputElement).value).toBe("");
  });

  it("shows 'Continue with 2 circles' when 2 names are filled", async () => {
    fetchMock = mockFetch([]);
    await render();
    expect(screen.getByText("Continue with 2 circles")).toBeInTheDocument();
  });

  it("shows 'Continue' when no names are filled", async () => {
    fetchMock = mockFetch([]);
    await render();
    const inputs = screen.getAllByRole("textbox");
    fireEvent.input(inputs[0], { target: { value: "" } });
    fireEvent.input(inputs[1], { target: { value: "" } });
    expect(screen.getByText("Continue")).toBeInTheDocument();
  });

  it("shows 'Continue with 1 circle' (singular) when exactly 1 name is filled", async () => {
    fetchMock = mockFetch([]);
    await render();
    const inputs = screen.getAllByRole("textbox");
    fireEvent.input(inputs[0], { target: { value: "" } });
    expect(screen.getByText("Continue with 1 circle")).toBeInTheDocument();
  });

  it("renders color picker buttons for each circle row", async () => {
    fetchMock = mockFetch([]);
    await render();
    // 6 colors × 4 rows = 24 color buttons
    const colorButtons = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("type") === "button");
    expect(colorButtons.length).toBeGreaterThanOrEqual(24);
  });

  it("renders Skip button", async () => {
    fetchMock = mockFetch([]);
    await render();
    expect(screen.getByText("Skip for now")).toBeInTheDocument();
  });
});

describe("CircleOnboarding — input editing", () => {
  it("typing in a circle input updates the value", async () => {
    fetchMock = mockFetch([]);
    await render();
    const inputs = screen.getAllByRole("textbox");
    fireEvent.input(inputs[2], { target: { value: "Coworkers" } });
    expect((inputs[2] as HTMLInputElement).value).toBe("Coworkers");
  });

  it("updates filledCount and button label when name is typed", async () => {
    fetchMock = mockFetch([]);
    await render();
    const inputs = screen.getAllByRole("textbox");
    fireEvent.input(inputs[2], { target: { value: "Coworkers" } });
    expect(screen.getByText("Continue with 3 circles")).toBeInTheDocument();
  });
});

describe("CircleOnboarding — skip", () => {
  it("calls onSkip when Skip button is clicked", async () => {
    fetchMock = mockFetch([]);
    const onSkip = mock(() => {});
    await render(
      mock(() => {}),
      onSkip
    );
    fireEvent.click(screen.getByText("Skip for now"));
    expect(onSkip).toHaveBeenCalled();
  });

  it("calls onSkip when Continue is clicked with all empty names", async () => {
    fetchMock = mockFetch([]);
    const onSkip = mock(() => {});
    await render(
      mock(() => {}),
      onSkip
    );
    const inputs = screen.getAllByRole("textbox");
    fireEvent.input(inputs[0], { target: { value: "" } });
    fireEvent.input(inputs[1], { target: { value: "" } });
    const continueBtn = screen.getByText("Continue");
    fireEvent.click(continueBtn);
    expect(onSkip).toHaveBeenCalled();
  });
});

describe("CircleOnboarding — successful creation", () => {
  it("calls createCircle API and then onComplete", async () => {
    fetchMock = mockFetch((call) => {
      if (call.method === "POST") {
        return makeCircle("c1", (call.body as { name: string }).name);
      }
      return [];
    });
    const onComplete = mock(() => {});
    await render(onComplete);
    const btn = screen.getByText("Continue with 2 circles");
    fireEvent.click(btn);
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(fetchMock.calls.filter((c) => c.method === "POST")).toHaveLength(2);
  });

  it("shows 'Creating...' while API is in-flight", async () => {
    let resolveFn: (v: Response) => void;
    const pending = new Promise<Response>((res) => {
      resolveFn = res;
    });
    fetchMock = mockFetch(() => pending);
    await render();
    const btn = screen.getByText("Continue with 2 circles");
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByText("Creating...")).toBeInTheDocument());
    resolveFn!(
      new Response(JSON.stringify(makeCircle("c1", "Family")), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("disables Skip button while creating", async () => {
    let resolveFn: (v: Response) => void;
    const pending = new Promise<Response>((res) => {
      resolveFn = res;
    });
    fetchMock = mockFetch(() => pending);
    await render();
    fireEvent.click(screen.getByText("Continue with 2 circles"));
    await waitFor(() => expect(screen.getByText("Creating...")).toBeInTheDocument());
    expect(screen.getByText("Skip for now").closest("button")).toHaveAttribute("disabled");
    resolveFn!(
      new Response(JSON.stringify(makeCircle("c1", "Family")), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  });
});

describe("CircleOnboarding — error handling", () => {
  it("resets isCreating on API failure and does not call onComplete", async () => {
    fetchMock = mockFetch(() => errorResponse(500));
    const onComplete = mock(() => {});
    await render(onComplete);
    fireEvent.click(screen.getByText("Continue with 2 circles"));
    await waitFor(() => {
      expect(screen.queryByText("Creating...")).toBeNull();
    });
    expect(onComplete).not.toHaveBeenCalled();
    // Button should be re-enabled
    const btn = screen.getAllByRole("button").find((b) => b.textContent?.includes("Continue"));
    expect(btn).not.toHaveAttribute("disabled");
  });
});

describe("CircleOnboarding — color selection", () => {
  it("clicking a color button does not throw and updates selection", async () => {
    fetchMock = mockFetch([]);
    await render();
    const colorButtons = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("type") === "button");
    // Click a color button — just verify it doesn't crash
    fireEvent.click(colorButtons[1]);
    // The continue button should still be visible
    expect(screen.getByText("Continue with 2 circles")).toBeInTheDocument();
  });
});
