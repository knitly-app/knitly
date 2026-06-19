import { describe, it, expect } from "bun:test";
import { screen } from "@testing-library/preact";
import { renderWithProviders } from "../../helpers/render";
import { ChatMessage } from "../../../components/Chat/ChatMessage";
import type { ChatMessage as ChatMessageType } from "../../../api/endpoints";

function makeMessage(overrides: Partial<ChatMessageType> = {}): ChatMessageType {
  return {
    id: "m1",
    userId: "u1",
    username: "ada",
    displayName: "Ada Lovelace",
    content: "Hello world",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("ChatMessage — content and identity", () => {
  it("renders the display name", async () => {
    await renderWithProviders(<ChatMessage message={makeMessage()} isOwn={false} />);
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });

  it("renders the username handle", async () => {
    await renderWithProviders(<ChatMessage message={makeMessage()} isOwn={false} />);
    expect(screen.getByText("@ada")).toBeInTheDocument();
  });

  it("renders the message content", async () => {
    await renderWithProviders(
      <ChatMessage message={makeMessage({ content: "Test message" })} isOwn={false} />
    );
    expect(screen.getByText("Test message")).toBeInTheDocument();
  });

  it("renders 'just now' for a very recent message", async () => {
    await renderWithProviders(<ChatMessage message={makeMessage()} isOwn={false} />);
    expect(screen.getByText("just now")).toBeInTheDocument();
  });

  it("renders minutes ago for messages under an hour old", async () => {
    const createdAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    await renderWithProviders(<ChatMessage message={makeMessage({ createdAt })} isOwn={false} />);
    expect(screen.getByText("5m ago")).toBeInTheDocument();
  });

  it("renders hours ago for messages under a day old", async () => {
    const createdAt = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    await renderWithProviders(<ChatMessage message={makeMessage({ createdAt })} isOwn={false} />);
    expect(screen.getByText("3h ago")).toBeInTheDocument();
  });

  it("renders a locale date string for messages older than a day", async () => {
    const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const createdAt = old.toISOString();
    await renderWithProviders(<ChatMessage message={makeMessage({ createdAt })} isOwn={false} />);
    expect(screen.getByText(old.toLocaleDateString())).toBeInTheDocument();
  });
});

describe("ChatMessage — avatar", () => {
  it("renders an img when avatar is provided", async () => {
    const msg = makeMessage({ avatar: "https://example.com/avatar.jpg" });
    await renderWithProviders(<ChatMessage message={msg} isOwn={false} />);
    const img = screen.getByAltText("Ada Lovelace");
    expect(img.getAttribute("src")).toBe("https://example.com/avatar.jpg");
  });

  it("renders initials fallback when no avatar", async () => {
    await renderWithProviders(<ChatMessage message={makeMessage()} isOwn={false} />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("renders '?' when displayName is empty", async () => {
    const msg = makeMessage({ displayName: "" });
    await renderWithProviders(<ChatMessage message={msg} isOwn={false} />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });
});

describe("ChatMessage — bot badge", () => {
  it("shows bot badge when role is bot", async () => {
    await renderWithProviders(<ChatMessage message={makeMessage({ role: "bot" })} isOwn={false} />);
    expect(screen.getByText("Bot")).toBeInTheDocument();
  });

  it("does not show bot badge for non-bot messages", async () => {
    await renderWithProviders(<ChatMessage message={makeMessage()} isOwn={false} />);
    expect(screen.queryByText("Bot")).toBeNull();
  });

  it("does not show bot badge for member role", async () => {
    await renderWithProviders(
      <ChatMessage message={makeMessage({ role: "member" })} isOwn={false} />
    );
    expect(screen.queryByText("Bot")).toBeNull();
  });
});

describe("ChatMessage — own vs other", () => {
  it("applies flex-row-reverse for own messages", async () => {
    const { container } = await renderWithProviders(
      <ChatMessage message={makeMessage()} isOwn={true} />
    );
    const outerDiv = container.firstElementChild as HTMLElement;
    expect(outerDiv?.className).toContain("flex-row-reverse");
  });

  it("does not apply flex-row-reverse for other messages", async () => {
    const { container } = await renderWithProviders(
      <ChatMessage message={makeMessage()} isOwn={false} />
    );
    const outerDiv = container.firstElementChild as HTMLElement;
    expect(outerDiv?.className).not.toContain("flex-row-reverse");
  });
});
