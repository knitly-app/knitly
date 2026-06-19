import { describe, it, expect } from "bun:test";
import { render } from "@testing-library/preact";
import { Spinner } from "../../components/Spinner";

describe("Spinner", () => {
  it("renders a spinning element with default md size", () => {
    const { container } = render(<Spinner />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toBeInTheDocument();
    expect(el.className).toContain("w-8");
    expect(el.className).toContain("animate-spin");
  });

  it("applies sm size classes", () => {
    const { container } = render(<Spinner size="sm" />);
    expect((container.firstElementChild as HTMLElement).className).toContain("w-6");
  });

  it("applies lg size classes", () => {
    const { container } = render(<Spinner size="lg" />);
    expect((container.firstElementChild as HTMLElement).className).toContain("w-10");
  });
});
