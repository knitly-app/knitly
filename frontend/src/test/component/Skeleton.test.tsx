import { describe, it, expect } from "bun:test";
import { render } from "@testing-library/preact";
import {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonImage,
  PostCardSkeleton,
  ProfileCardSkeleton,
  ProfileHeaderSkeleton,
  NotificationSkeleton,
  CommentSkeleton,
  AdminTableSkeleton,
} from "../../components/Skeleton";

describe("Skeleton", () => {
  it("renders with animate-pulse and bg-gray-200", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("animate-pulse");
    expect(el.className).toContain("bg-gray-200");
  });

  it("appends custom className", () => {
    const { container } = render(<Skeleton className="extra" />);
    expect((container.firstElementChild as HTMLElement).className).toContain("extra");
  });
});

describe("SkeletonText", () => {
  it("defaults to md width", () => {
    const { container } = render(<SkeletonText />);
    expect((container.firstElementChild as HTMLElement).className).toContain("w-32");
  });

  it("applies sm width", () => {
    const { container } = render(<SkeletonText width="sm" />);
    expect((container.firstElementChild as HTMLElement).className).toContain("w-16");
  });

  it("applies lg width", () => {
    const { container } = render(<SkeletonText width="lg" />);
    expect((container.firstElementChild as HTMLElement).className).toContain("w-48");
  });

  it("applies full width", () => {
    const { container } = render(<SkeletonText width="full" />);
    expect((container.firstElementChild as HTMLElement).className).toContain("w-full");
  });
});

describe("SkeletonAvatar", () => {
  it("defaults to md size", () => {
    const { container } = render(<SkeletonAvatar />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("w-12");
    expect(el.className).toContain("h-12");
  });

  it("applies sm size", () => {
    const { container } = render(<SkeletonAvatar size="sm" />);
    expect((container.firstElementChild as HTMLElement).className).toContain("w-8");
  });

  it("applies lg size", () => {
    const { container } = render(<SkeletonAvatar size="lg" />);
    expect((container.firstElementChild as HTMLElement).className).toContain("w-14");
  });

  it("includes rounded-full", () => {
    const { container } = render(<SkeletonAvatar />);
    expect((container.firstElementChild as HTMLElement).className).toContain("rounded-full");
  });
});

describe("SkeletonImage", () => {
  it("defaults to video aspect ratio", () => {
    const { container } = render(<SkeletonImage />);
    expect((container.firstElementChild as HTMLElement).className).toContain("aspect-video");
  });

  it("applies square aspect ratio", () => {
    const { container } = render(<SkeletonImage aspectRatio="square" />);
    expect((container.firstElementChild as HTMLElement).className).toContain("aspect-square");
  });

  it("applies wide aspect ratio", () => {
    const { container } = render(<SkeletonImage aspectRatio="wide" />);
    expect((container.firstElementChild as HTMLElement).className).toContain("aspect-[2/1]");
  });
});

describe("PostCardSkeleton", () => {
  it("renders without media by default", () => {
    const { container } = render(<PostCardSkeleton />);
    expect(container.firstElementChild).toBeInTheDocument();
    // No aspect-video image element when showMedia is false
    const aspectVideo = container.querySelector(".aspect-video");
    expect(aspectVideo).toBeNull();
  });

  it("renders media skeleton when showMedia is true", () => {
    const { container } = render(<PostCardSkeleton showMedia />);
    expect(container.querySelector(".aspect-video")).toBeInTheDocument();
  });
});

describe("ProfileCardSkeleton", () => {
  it("renders", () => {
    const { container } = render(<ProfileCardSkeleton />);
    expect(container.firstElementChild).toBeInTheDocument();
  });
});

describe("ProfileHeaderSkeleton", () => {
  it("renders", () => {
    const { container } = render(<ProfileHeaderSkeleton />);
    expect(container.firstElementChild).toBeInTheDocument();
  });
});

describe("NotificationSkeleton", () => {
  it("renders", () => {
    const { container } = render(<NotificationSkeleton />);
    expect(container.firstElementChild).toBeInTheDocument();
  });
});

describe("CommentSkeleton", () => {
  it("renders", () => {
    const { container } = render(<CommentSkeleton />);
    expect(container.firstElementChild).toBeInTheDocument();
  });
});

describe("AdminTableSkeleton", () => {
  it("renders 5 rows by default", () => {
    const { container } = render(<AdminTableSkeleton />);
    const rows = container.querySelectorAll(".border-b");
    expect(rows.length).toBe(5);
  });

  it("renders custom count of rows", () => {
    const { container } = render(<AdminTableSkeleton count={3} />);
    const rows = container.querySelectorAll(".border-b");
    expect(rows.length).toBe(3);
  });

  it("renders 1 row when count is 1", () => {
    const { container } = render(<AdminTableSkeleton count={1} />);
    const rows = container.querySelectorAll(".border-b");
    expect(rows.length).toBe(1);
  });
});
