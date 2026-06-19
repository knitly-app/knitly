import { describe, it, expect } from "bun:test";
import { render } from "@testing-library/preact";
import { MediaGridSkeleton } from "../../components/MediaGridSkeleton";

describe("MediaGridSkeleton", () => {
  it("renders a grid with 9 skeleton cells", () => {
    const { container } = render(<MediaGridSkeleton />);
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.className).toContain("grid");
    expect(grid.children.length).toBe(9);
  });

  it("each cell has animate-pulse and aspect-square", () => {
    const { container } = render(<MediaGridSkeleton />);
    const cells = container.querySelectorAll(".aspect-square");
    expect(cells.length).toBe(9);
    cells.forEach((cell) => {
      expect((cell as HTMLElement).className).toContain("animate-pulse");
    });
  });
});
