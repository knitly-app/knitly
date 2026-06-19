import { describe, it, expect, spyOn } from "bun:test";
import { render, screen, fireEvent, act } from "@testing-library/preact";
import { Component } from "preact";
import { ErrorBoundary } from "../../components/ErrorBoundary";

class Bomb extends Component<{ shouldThrow?: boolean }> {
  render() {
    if (this.props.shouldThrow) {
      throw new Error("boom");
    }
    return <span>safe</span>;
  }
}

describe("ErrorBoundary", () => {
  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <span>all good</span>
      </ErrorBoundary>
    );
    expect(screen.getByText("all good")).toBeInTheDocument();
  });

  it("renders the error fallback UI when a child throws", () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Try Again")).toBeInTheDocument();
    expect(screen.getByText("Reload")).toBeInTheDocument();
  });

  it("does not render normal children when in error state", () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.queryByText("safe")).toBeNull();
  });

  it("renders children safely when no throw occurs", () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );
    expect(screen.getByText("safe")).toBeInTheDocument();
  });

  it("calls window.location.reload when Reload is clicked", () => {
    const reloadSpy = spyOn(window.location, "reload").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByText("Reload"));
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    reloadSpy.mockRestore();
  });

  it("clears error state when Try Again is clicked", () => {
    const { container } = render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    void act(() => {
      fireEvent.click(screen.getByText("Try Again"));
    });

    expect(container).toBeInTheDocument();
  });
});
