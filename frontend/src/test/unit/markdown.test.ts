import { describe, it, expect } from "bun:test";
import { renderMarkdown } from "../../utils/markdown";

describe("renderMarkdown", () => {
  it("returns empty string for empty input", () => {
    expect(renderMarkdown("")).toBe("");
  });

  it("returns empty string for falsy input", () => {
    expect(renderMarkdown(null as unknown as string)).toBe("");
    expect(renderMarkdown(undefined as unknown as string)).toBe("");
  });

  it("passes plain text through unchanged", () => {
    expect(renderMarkdown("hello world")).toBe("hello world");
  });

  it("renders bold with **", () => {
    expect(renderMarkdown("**bold**")).toBe("<strong>bold</strong>");
  });

  it("renders bold inline with surrounding text", () => {
    expect(renderMarkdown("say **hello** now")).toBe("say <strong>hello</strong> now");
  });

  it("renders multiple bold spans", () => {
    expect(renderMarkdown("**a** and **b**")).toBe("<strong>a</strong> and <strong>b</strong>");
  });

  it("renders italic with single *", () => {
    expect(renderMarkdown("*italic*")).toBe("<em>italic</em>");
  });

  it("renders italic inline with surrounding text", () => {
    expect(renderMarkdown("say *hello* now")).toBe("say <em>hello</em> now");
  });

  it("renders multiple italic spans", () => {
    expect(renderMarkdown("*a* and *b*")).toBe("<em>a</em> and <em>b</em>");
  });

  it("does not render ** as italic", () => {
    const result = renderMarkdown("**bold**");
    expect(result).not.toContain("<em>");
    expect(result).toContain("<strong>");
  });

  it("renders bold and italic together", () => {
    expect(renderMarkdown("**bold** and *italic*")).toBe(
      "<strong>bold</strong> and <em>italic</em>"
    );
  });

  it("renders @mention as a link", () => {
    expect(renderMarkdown("@alice")).toBe(
      '<a href="/profile/@alice" class="mention text-accent-500 hover:underline">@alice</a>'
    );
  });

  it("renders @mention embedded in text", () => {
    const result = renderMarkdown("hello @bob how are you");
    expect(result).toContain('<a href="/profile/@bob"');
    expect(result).toContain("@bob</a>");
  });

  it("renders multiple @mentions", () => {
    const result = renderMarkdown("@alice and @bob");
    expect(result).toContain("/profile/@alice");
    expect(result).toContain("/profile/@bob");
  });

  it("renders bold, italic, and mention together", () => {
    const result = renderMarkdown("**hi** *there* @carol");
    expect(result).toContain("<strong>hi</strong>");
    expect(result).toContain("<em>there</em>");
    expect(result).toContain("/profile/@carol");
  });
});
