import { describe, it, expect, afterEach, mock } from "bun:test";
import { screen, fireEvent, waitFor } from "@testing-library/preact";
import { renderWithProviders, makeQueryClient } from "../helpers/render";
import { mockFetch, jsonResponse, type MockFetchResult } from "../helpers/fetch";
import {
  MentionAutocomplete,
  type MentionAutocompleteHandle,
} from "../../components/MentionAutocomplete";
import { queryKeys } from "../../api/queryKeys";
import { useRef } from "preact/hooks";
import type { User } from "../../api/endpoints";

let fetchMock: MockFetchResult;
afterEach(() => fetchMock?.restore());

const alice: User = {
  id: "u1",
  username: "alice",
  displayName: "Alice Smith",
  createdAt: "2024-01-01",
};
const bob: User = {
  id: "u2",
  username: "bob",
  displayName: "Bob Jones",
  createdAt: "2024-01-01",
};

function makeProps(overrides: Partial<Parameters<typeof MentionAutocomplete>[0]> = {}) {
  return {
    query: "ali",
    visible: true,
    position: { top: 100, left: 50 },
    onSelect: mock(() => {}),
    onClose: mock(() => {}),
    ...overrides,
  };
}

describe("MentionAutocomplete — visibility", () => {
  it("renders nothing when not visible", async () => {
    fetchMock = mockFetch([]);
    const props = makeProps({ visible: false });
    await renderWithProviders(<MentionAutocomplete {...props} />);
    expect(screen.queryByText("Type 2+ characters...")).toBeNull();
  });

  it("shows 'Type 2+ characters...' when visible with short query", async () => {
    fetchMock = mockFetch([]);
    const props = makeProps({ query: "a", visible: true });
    await renderWithProviders(<MentionAutocomplete {...props} />);
    expect(screen.getByText("Type 2+ characters...")).toBeInTheDocument();
  });

  it("shows 'Searching...' while loading", async () => {
    let resolve: (v: Response) => void;
    const pending = new Promise<Response>((res) => {
      resolve = res;
    });
    fetchMock = mockFetch(() => pending);
    const props = makeProps({ query: "ali" });
    await renderWithProviders(<MentionAutocomplete {...props} />);
    expect(screen.getByText("Searching...")).toBeInTheDocument();
    resolve!(jsonResponse([]));
  });

  it("shows 'No users found' when results are empty", async () => {
    fetchMock = mockFetch([]);
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.search.mentions("ali"), []);
    const props = makeProps({ query: "ali" });
    await renderWithProviders(<MentionAutocomplete {...props} />, { queryClient: qc });
    expect(screen.getByText("No users found")).toBeInTheDocument();
  });

  it("renders user rows when results exist", async () => {
    fetchMock = mockFetch([alice, bob]);
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.search.mentions("ali"), [alice, bob]);
    const props = makeProps({ query: "ali" });
    await renderWithProviders(<MentionAutocomplete {...props} />, { queryClient: qc });
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
  });
});

describe("MentionAutocomplete — selection", () => {
  it("calls onSelect with username and displayName when a user row is clicked", async () => {
    const onSelect = mock(() => {});
    fetchMock = mockFetch([alice]);
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.search.mentions("ali"), [alice]);
    const props = makeProps({ query: "ali", onSelect });
    await renderWithProviders(<MentionAutocomplete {...props} />, { queryClient: qc });
    fireEvent.click(screen.getByText("Alice Smith"));
    expect(onSelect).toHaveBeenCalledWith("alice", "Alice Smith");
  });

  it("highlights the first user row by default", async () => {
    fetchMock = mockFetch([alice, bob]);
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.search.mentions("ali"), [alice, bob]);
    const props = makeProps({ query: "ali" });
    await renderWithProviders(<MentionAutocomplete {...props} />, { queryClient: qc });
    const buttons = screen.getAllByRole("button");
    expect(buttons[0].className).toContain("bg-accent-50");
  });

  it("updates hover highlight on mouseenter", async () => {
    fetchMock = mockFetch([alice, bob]);
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.search.mentions("ali"), [alice, bob]);
    const props = makeProps({ query: "ali" });
    await renderWithProviders(<MentionAutocomplete {...props} />, { queryClient: qc });
    const buttons = screen.getAllByRole("button");
    fireEvent.mouseEnter(buttons[1]);
    expect(buttons[1].className).toContain("bg-accent-50");
  });
});

describe("MentionAutocomplete — keyboard navigation via imperative handle", () => {
  function MountedWrapper(
    props: Parameters<typeof MentionAutocomplete>[0] & { onKeyResult?: (r: boolean) => void }
  ) {
    const ref = useRef<MentionAutocompleteHandle>(null);

    return (
      <div>
        <button
          id="trigger"
          onKeyDown={(e: KeyboardEvent) => {
            if (ref.current) {
              const result = ref.current.handleKeyDown(e);
              props.onKeyResult?.(result);
            }
          }}
        />
        <MentionAutocomplete ref={ref} {...props} />
      </div>
    );
  }

  it("ArrowDown moves selection to next user", async () => {
    fetchMock = mockFetch([alice, bob]);
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.search.mentions("ali"), [alice, bob]);
    const onSelect = mock(() => {});
    await renderWithProviders(
      <MountedWrapper
        query="ali"
        visible={true}
        position={{ top: 0, left: 0 }}
        onSelect={onSelect}
        onClose={mock(() => {})}
      />,
      { queryClient: qc }
    );
    await waitFor(() => expect(screen.getByText("Bob Jones")).toBeInTheDocument());
    const trigger = document.getElementById("trigger")!;
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    await waitFor(() => {
      const buttons = screen.getAllByRole("button").filter((b) => b.textContent?.includes("Bob"));
      expect(buttons[0].className).toContain("bg-accent-50");
    });
  });

  it("ArrowUp wraps to last user", async () => {
    fetchMock = mockFetch([alice, bob]);
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.search.mentions("ali"), [alice, bob]);
    const onSelect = mock(() => {});
    await renderWithProviders(
      <MountedWrapper
        query="ali"
        visible={true}
        position={{ top: 0, left: 0 }}
        onSelect={onSelect}
        onClose={mock(() => {})}
      />,
      { queryClient: qc }
    );
    await waitFor(() => expect(screen.getByText("Bob Jones")).toBeInTheDocument());
    const trigger = document.getElementById("trigger")!;
    fireEvent.keyDown(trigger, { key: "ArrowUp" });
    await waitFor(() => {
      const buttons = screen.getAllByRole("button").filter((b) => b.textContent?.includes("Bob"));
      expect(buttons[0].className).toContain("bg-accent-50");
    });
  });

  it("Enter selects the currently highlighted user", async () => {
    fetchMock = mockFetch([alice, bob]);
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.search.mentions("ali"), [alice, bob]);
    const onSelect = mock(() => {});
    await renderWithProviders(
      <MountedWrapper
        query="ali"
        visible={true}
        position={{ top: 0, left: 0 }}
        onSelect={onSelect}
        onClose={mock(() => {})}
      />,
      { queryClient: qc }
    );
    await waitFor(() => expect(screen.getByText("Alice Smith")).toBeInTheDocument());
    const trigger = document.getElementById("trigger")!;
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("alice", "Alice Smith");
  });

  it("Escape calls onClose", async () => {
    fetchMock = mockFetch([alice, bob]);
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.search.mentions("ali"), [alice, bob]);
    const onClose = mock(() => {});
    await renderWithProviders(
      <MountedWrapper
        query="ali"
        visible={true}
        position={{ top: 0, left: 0 }}
        onSelect={mock(() => {})}
        onClose={onClose}
      />,
      { queryClient: qc }
    );
    await waitFor(() => expect(screen.getByText("Alice Smith")).toBeInTheDocument());
    const trigger = document.getElementById("trigger")!;
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("Escape when no users found calls onClose", async () => {
    fetchMock = mockFetch([]);
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.search.mentions("xyz"), []);
    const onClose = mock(() => {});
    await renderWithProviders(
      <MountedWrapper
        query="xyz"
        visible={true}
        position={{ top: 0, left: 0 }}
        onSelect={mock(() => {})}
        onClose={onClose}
      />,
      { queryClient: qc }
    );
    await waitFor(() => expect(screen.getByText("No users found")).toBeInTheDocument());
    const trigger = document.getElementById("trigger")!;
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("returns false for non-handled keys when users exist", async () => {
    fetchMock = mockFetch([alice]);
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.search.mentions("ali"), [alice]);
    const onKeyResult = mock((_r: boolean) => {});
    await renderWithProviders(
      <MountedWrapper
        query="ali"
        visible={true}
        position={{ top: 0, left: 0 }}
        onSelect={mock(() => {})}
        onClose={mock(() => {})}
        onKeyResult={onKeyResult}
      />,
      { queryClient: qc }
    );
    await waitFor(() => expect(screen.getByText("Alice Smith")).toBeInTheDocument());
    const trigger = document.getElementById("trigger")!;
    fireEvent.keyDown(trigger, { key: "Tab" });
    expect(onKeyResult).toHaveBeenCalledWith(false);
  });

  it("returns false for non-escape keys when no users found", async () => {
    fetchMock = mockFetch([]);
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.search.mentions("xyz"), []);
    const onKeyResult = mock((_r: boolean) => {});
    await renderWithProviders(
      <MountedWrapper
        query="xyz"
        visible={true}
        position={{ top: 0, left: 0 }}
        onSelect={mock(() => {})}
        onClose={mock(() => {})}
        onKeyResult={onKeyResult}
      />,
      { queryClient: qc }
    );
    await waitFor(() => expect(screen.getByText("No users found")).toBeInTheDocument());
    const trigger = document.getElementById("trigger")!;
    fireEvent.keyDown(trigger, { key: "a" });
    expect(onKeyResult).toHaveBeenCalledWith(false);
  });

  it("returns false when not visible", async () => {
    fetchMock = mockFetch([]);
    const onKeyResult = mock((_r: boolean) => {});
    await renderWithProviders(
      <MountedWrapper
        query="ali"
        visible={false}
        position={{ top: 0, left: 0 }}
        onSelect={mock(() => {})}
        onClose={mock(() => {})}
        onKeyResult={onKeyResult}
      />
    );
    const trigger = document.getElementById("trigger")!;
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(onKeyResult).toHaveBeenCalledWith(false);
  });

  it("resets selectedIndex to 0 when query changes to a new value", async () => {
    // Seed data for "bob" query (single result)
    fetchMock = mockFetch([bob]);
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.search.mentions("bob"), [bob]);
    const onSelect = mock(() => {});
    // Render fresh with query="bob" — selectedIndex always starts at 0
    await renderWithProviders(
      <MountedWrapper
        query="bob"
        visible={true}
        position={{ top: 0, left: 0 }}
        onSelect={onSelect}
        onClose={mock(() => {})}
      />,
      { queryClient: qc }
    );
    await waitFor(() => expect(screen.getByText("Bob Jones")).toBeInTheDocument());
    // Enter should select index 0 = bob
    const trigger = document.getElementById("trigger")!;
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("bob", "Bob Jones");
  });
});
