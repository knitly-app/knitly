import { describe, it, expect } from "bun:test";
import { render, screen, fireEvent } from "@testing-library/preact";
import { CirclePills } from "../../components/CirclePills";

const circles = [
  { id: "c1", name: "Friends", color: "blue" },
  { id: "c2", name: "Work", color: "green" },
];

describe("CirclePills", () => {
  it("renders the All button and each circle pill", () => {
    render(<CirclePills circles={circles} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Friends")).toBeInTheDocument();
    expect(screen.getByText("Work")).toBeInTheDocument();
  });

  it("highlights All button when selectedId is null", () => {
    render(<CirclePills circles={circles} selectedId={null} onSelect={() => {}} />);
    const allBtn = screen.getByText("All").closest("button") as HTMLButtonElement;
    expect(allBtn.className).toContain("bg-accent-500");
  });

  it("highlights the selected circle pill", () => {
    render(<CirclePills circles={circles} selectedId="c1" onSelect={() => {}} />);
    const friendsBtn = screen.getByText("Friends").closest("button") as HTMLButtonElement;
    expect(friendsBtn.className).toContain("bg-gray-800");
  });

  it("All button does not have active style when a circle is selected", () => {
    render(<CirclePills circles={circles} selectedId="c1" onSelect={() => {}} />);
    const allBtn = screen.getByText("All").closest("button") as HTMLButtonElement;
    expect(allBtn.className).not.toContain("bg-accent-500");
  });

  it("calls onSelect with null when All is clicked", () => {
    let selected: string | null = "c1";
    render(
      <CirclePills
        circles={circles}
        selectedId={selected}
        onSelect={(id) => {
          selected = id;
        }}
      />
    );
    fireEvent.click(screen.getByText("All"));
    expect(selected).toBeNull();
  });

  it("calls onSelect with circle id when a pill is clicked", () => {
    let selected: string | null = null;
    render(
      <CirclePills
        circles={circles}
        selectedId={selected}
        onSelect={(id) => {
          selected = id;
        }}
      />
    );
    fireEvent.click(screen.getByText("Work"));
    expect(selected).toBe("c2");
  });

  it("shows Add button when showAdd is true and circles < 4", () => {
    render(
      <CirclePills
        circles={circles}
        selectedId={null}
        onSelect={() => {}}
        showAdd
        onAdd={() => {}}
      />
    );
    expect(screen.getByText("Add")).toBeInTheDocument();
  });

  it("hides Add button when circles.length >= 4", () => {
    const fourCircles = [
      { id: "c1", name: "A", color: "blue" },
      { id: "c2", name: "B", color: "green" },
      { id: "c3", name: "C", color: "red" },
      { id: "c4", name: "D", color: "pink" },
    ];
    render(
      <CirclePills
        circles={fourCircles}
        selectedId={null}
        onSelect={() => {}}
        showAdd
        onAdd={() => {}}
      />
    );
    expect(screen.queryByText("Add")).toBeNull();
  });

  it("hides Add button when showAdd is false", () => {
    render(
      <CirclePills
        circles={circles}
        selectedId={null}
        onSelect={() => {}}
        showAdd={false}
        onAdd={() => {}}
      />
    );
    expect(screen.queryByText("Add")).toBeNull();
  });

  it("hides Add button when onAdd is not provided", () => {
    render(<CirclePills circles={circles} selectedId={null} onSelect={() => {}} showAdd />);
    expect(screen.queryByText("Add")).toBeNull();
  });

  it("calls onAdd when Add button is clicked", () => {
    let called = false;
    render(
      <CirclePills
        circles={circles}
        selectedId={null}
        onSelect={() => {}}
        showAdd
        onAdd={() => {
          called = true;
        }}
      />
    );
    fireEvent.click(screen.getByText("Add"));
    expect(called).toBe(true);
  });

  it("uses fallback dot color for unknown color", () => {
    const unknownColorCircles = [{ id: "c1", name: "Mystery", color: "neon" }];
    render(<CirclePills circles={unknownColorCircles} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText("Mystery")).toBeInTheDocument();
    const btn = screen.getByText("Mystery").closest("button") as HTMLButtonElement;
    const dot = btn.querySelector("span") as HTMLElement;
    expect(dot.className).toContain("bg-gray-400");
  });
});
