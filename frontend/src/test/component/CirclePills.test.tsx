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
});
