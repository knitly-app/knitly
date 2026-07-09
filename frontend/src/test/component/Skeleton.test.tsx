import { describe, it, expect } from "bun:test";
import { render } from "@testing-library/preact";
import { AdminTableSkeleton } from "../../components/Skeleton";

describe("AdminTableSkeleton", () => {
  // AdminRoute renders this while users are loading; admin.test.tsx has no
  // loading case, so this is the lone render-smoke test for the component.
  it("renders without throwing", () => {
    const { container } = render(<AdminTableSkeleton />);
    expect(container.firstElementChild).toBeInTheDocument();
  });
});
