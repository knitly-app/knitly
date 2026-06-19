import { describe, it, expect, beforeEach, afterEach, vi } from "bun:test";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/preact";
import { ToastProvider, useToast } from "../../components/Toast";

function ToastConsumer({ action }: { action: (t: ReturnType<typeof useToast>) => void }) {
  const toast = useToast();
  return (
    <button onClick={() => action(toast)} data-testid="trigger">
      trigger
    </button>
  );
}

function renderToast(action: (t: ReturnType<typeof useToast>) => void) {
  return render(
    <ToastProvider>
      <ToastConsumer action={action} />
    </ToastProvider>
  );
}

describe("ToastProvider / useToast", () => {
  describe("toast types", () => {
    it("shows an info toast via toast()", () => {
      renderToast((t) => t.toast("Hello info"));
      fireEvent.click(screen.getByTestId("trigger"));
      expect(screen.getByText("Hello info")).toBeInTheDocument();
    });

    it("shows a success toast via success()", () => {
      renderToast((t) => t.success("It worked"));
      fireEvent.click(screen.getByTestId("trigger"));
      expect(screen.getByText("It worked")).toBeInTheDocument();
    });

    it("shows an error toast via error()", () => {
      renderToast((t) => t.error("Something broke"));
      fireEvent.click(screen.getByTestId("trigger"));
      expect(screen.getByText("Something broke")).toBeInTheDocument();
    });

    it("shows a toast with explicit success type via toast(msg, 'success')", () => {
      renderToast((t) => t.toast("Explicit success", "success"));
      fireEvent.click(screen.getByTestId("trigger"));
      expect(screen.getByText("Explicit success")).toBeInTheDocument();
    });

    it("shows a toast with explicit error type via toast(msg, 'error')", () => {
      renderToast((t) => t.toast("Explicit error", "error"));
      fireEvent.click(screen.getByTestId("trigger"));
      expect(screen.getByText("Explicit error")).toBeInTheDocument();
    });
  });

  describe("auto-dismiss", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("auto-dismisses after 3 seconds", async () => {
      renderToast((t) => t.toast("Auto dismiss me"));
      fireEvent.click(screen.getByTestId("trigger"));
      expect(screen.getByText("Auto dismiss me")).toBeInTheDocument();

      await act(() => {
        vi.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(screen.queryByText("Auto dismiss me")).not.toBeInTheDocument();
      });
    });
  });

  describe("manual close", () => {
    it("removes the toast when the close button is clicked", async () => {
      renderToast((t) => t.toast("Closeable"));
      fireEvent.click(screen.getByTestId("trigger"));
      expect(screen.getByText("Closeable")).toBeInTheDocument();

      const buttons = screen.getAllByRole("button");
      const closeButton = buttons.find((b) => b !== screen.getByTestId("trigger"))!;
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText("Closeable")).not.toBeInTheDocument();
      });
    });
  });

  describe("multiple toasts", () => {
    it("renders multiple toasts at once", () => {
      function MultiTrigger() {
        const toast = useToast();
        return (
          <>
            <button onClick={() => toast.success("First")} data-testid="btn1">
              1
            </button>
            <button onClick={() => toast.error("Second")} data-testid="btn2">
              2
            </button>
          </>
        );
      }
      render(
        <ToastProvider>
          <MultiTrigger />
        </ToastProvider>
      );
      fireEvent.click(screen.getByTestId("btn1"));
      fireEvent.click(screen.getByTestId("btn2"));
      expect(screen.getByText("First")).toBeInTheDocument();
      expect(screen.getByText("Second")).toBeInTheDocument();
    });
  });

  describe("outside-provider error", () => {
    it("throws when useToast is called outside ToastProvider", () => {
      function BadConsumer() {
        useToast();
        return <div />;
      }
      expect(() => render(<BadConsumer />)).toThrow("useToast must be used within ToastProvider");
    });
  });
});
