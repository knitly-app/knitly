import { describe, it, expect } from "bun:test";
import { render, screen, fireEvent, waitFor } from "@testing-library/preact";
import { ConfirmProvider, useConfirm, type ConfirmOptions } from "../../components/ConfirmModal";

function ConfirmConsumer({
  options,
  onResult,
}: {
  options: ConfirmOptions;
  onResult: (r: boolean) => void;
}) {
  const confirm = useConfirm();
  const handleClick = () => {
    void confirm(options).then(onResult);
  };
  return (
    <button data-testid="trigger" onClick={handleClick}>
      open
    </button>
  );
}

function setup(options: ConfirmOptions, onResult: (r: boolean) => void) {
  return render(
    <ConfirmProvider>
      <ConfirmConsumer options={options} onResult={onResult} />
    </ConfirmProvider>
  );
}

describe("ConfirmProvider / useConfirm", () => {
  describe("modal content", () => {
    it("renders default title (heading) and message", () => {
      setup({ message: "Are you sure?" }, () => {});
      fireEvent.click(screen.getByTestId("trigger"));
      expect(screen.getByRole("heading", { name: "Confirm" })).toBeInTheDocument();
      expect(screen.getByText("Are you sure?")).toBeInTheDocument();
    });

    it("renders custom title", () => {
      setup({ title: "Delete item", message: "This is permanent." }, () => {});
      fireEvent.click(screen.getByTestId("trigger"));
      expect(screen.getByRole("heading", { name: "Delete item" })).toBeInTheDocument();
    });

    it("renders custom confirmText and cancelText", () => {
      setup({ message: "Proceed?", confirmText: "Yes", cancelText: "No" }, () => {});
      fireEvent.click(screen.getByTestId("trigger"));
      expect(screen.getByRole("button", { name: "Yes" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "No" })).toBeInTheDocument();
    });

    it("renders default Cancel and Confirm button labels", () => {
      setup({ message: "Default labels" }, () => {});
      fireEvent.click(screen.getByTestId("trigger"));
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    });
  });

  describe("resolution", () => {
    it("resolves true when confirm button is clicked", async () => {
      const results: boolean[] = [];
      setup({ message: "Confirm?" }, (r) => results.push(r));
      fireEvent.click(screen.getByTestId("trigger"));
      fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
      await waitFor(() => expect(results).toEqual([true]));
    });

    it("resolves false when cancel button is clicked", async () => {
      const results: boolean[] = [];
      setup({ message: "Cancel?" }, (r) => results.push(r));
      fireEvent.click(screen.getByTestId("trigger"));
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(results).toEqual([false]));
    });

    it("resolves false when backdrop is clicked", async () => {
      const results: boolean[] = [];
      setup({ message: "Backdrop?" }, (r) => results.push(r));
      fireEvent.click(screen.getByTestId("trigger"));

      const modal = screen.getByText("Backdrop?").closest(".relative")!;
      const backdrop = modal.previousElementSibling as HTMLElement;
      fireEvent.click(backdrop);

      await waitFor(() => expect(results).toEqual([false]));
    });

    it("closes the modal after confirmation", async () => {
      setup({ message: "Will it close?" }, () => {});
      fireEvent.click(screen.getByTestId("trigger"));
      expect(screen.getByText("Will it close?")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
      await waitFor(() => {
        expect(screen.queryByText("Will it close?")).not.toBeInTheDocument();
      });
    });

    it("closes the modal after cancellation", async () => {
      setup({ message: "Will it close on cancel?" }, () => {});
      fireEvent.click(screen.getByTestId("trigger"));
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      await waitFor(() => {
        expect(screen.queryByText("Will it close on cancel?")).not.toBeInTheDocument();
      });
    });
  });

  describe("outside-provider error", () => {
    it("throws when useConfirm is called outside ConfirmProvider", () => {
      function BadConsumer() {
        useConfirm();
        return <div />;
      }
      expect(() => render(<BadConsumer />)).toThrow(
        "useConfirm must be used within ConfirmProvider"
      );
    });
  });
});
