import { describe, it, expect, mock } from "bun:test";
import { screen, fireEvent } from "@testing-library/preact";
import { renderWithProviders } from "../../helpers/render";
import { ChatInput } from "../../../components/Chat/ChatInput";

describe("ChatInput — rendering", () => {
  it("renders a textarea with placeholder", async () => {
    await renderWithProviders(<ChatInput onSend={() => {}} />);
    expect(screen.getByPlaceholderText("Type a message...")).toBeInTheDocument();
  });

  it("renders a send button", async () => {
    await renderWithProviders(<ChatInput onSend={() => {}} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("send button is disabled initially (empty input)", async () => {
    await renderWithProviders(<ChatInput onSend={() => {}} />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("disables textarea when disabled prop is true", async () => {
    await renderWithProviders(<ChatInput onSend={() => {}} disabled />);
    expect(screen.getByPlaceholderText("Type a message...")).toBeDisabled();
  });

  it("disables send button when disabled prop is true", async () => {
    await renderWithProviders(<ChatInput onSend={() => {}} disabled />);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});

describe("ChatInput — typing", () => {
  it("enables send button after typing text", async () => {
    await renderWithProviders(<ChatInput onSend={() => {}} />);
    const textarea = screen.getByPlaceholderText("Type a message...");
    fireEvent.input(textarea, { target: { value: "hello" } });
    expect(screen.getByRole("button")).not.toBeDisabled();
  });

  it("shows character count when text is entered", async () => {
    await renderWithProviders(<ChatInput onSend={() => {}} />);
    const textarea = screen.getByPlaceholderText("Type a message...");
    fireEvent.input(textarea, { target: { value: "hello" } });
    expect(screen.getByText("495")).toBeInTheDocument();
  });

  it("shows negative count and disables button when over 500 chars", async () => {
    await renderWithProviders(<ChatInput onSend={() => {}} />);
    const textarea = screen.getByPlaceholderText("Type a message...");
    const longText = "a".repeat(501);
    fireEvent.input(textarea, { target: { value: longText } });
    expect(screen.getByText("-1")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("does not show char count when input is empty", async () => {
    await renderWithProviders(<ChatInput onSend={() => {}} />);
    expect(screen.queryByText("500")).toBeNull();
  });
});

describe("ChatInput — sending", () => {
  it("calls onSend with trimmed content when button is clicked", async () => {
    const onSend = mock(() => {});
    await renderWithProviders(<ChatInput onSend={onSend} />);
    const textarea = screen.getByPlaceholderText("Type a message...");
    fireEvent.input(textarea, { target: { value: "  hello  " } });
    fireEvent.click(screen.getByRole("button"));
    expect(onSend).toHaveBeenCalledWith("hello");
  });

  it("clears input after sending", async () => {
    await renderWithProviders(<ChatInput onSend={() => {}} />);
    const textarea = screen.getByPlaceholderText("Type a message...");
    fireEvent.input(textarea, { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button"));
    // After send the count indicator disappears — textarea is empty
    expect(screen.queryByText("495")).toBeNull();
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("calls onSend when Enter is pressed without Shift", async () => {
    const onSend = mock(() => {});
    await renderWithProviders(<ChatInput onSend={onSend} />);
    const textarea = screen.getByPlaceholderText("Type a message...");
    fireEvent.input(textarea, { target: { value: "enter send" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(onSend).toHaveBeenCalledWith("enter send");
  });

  it("does not call onSend when Shift+Enter is pressed", async () => {
    const onSend = mock(() => {});
    await renderWithProviders(<ChatInput onSend={onSend} />);
    const textarea = screen.getByPlaceholderText("Type a message...");
    fireEvent.input(textarea, { target: { value: "newline" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("does not call onSend when input is whitespace only", async () => {
    const onSend = mock(() => {});
    await renderWithProviders(<ChatInput onSend={onSend} />);
    const textarea = screen.getByPlaceholderText("Type a message...");
    fireEvent.input(textarea, { target: { value: "   " } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("does not call onSend when disabled even if Enter is pressed", async () => {
    const onSend = mock(() => {});
    await renderWithProviders(<ChatInput onSend={onSend} disabled />);
    const textarea = screen.getByPlaceholderText("Type a message...");
    fireEvent.input(textarea, { target: { value: "blocked" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(onSend).not.toHaveBeenCalled();
  });
});
