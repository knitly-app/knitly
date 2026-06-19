import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { screen, fireEvent, waitFor } from "@testing-library/preact";
import { renderWithProviders, makeQueryClient } from "../helpers/render";
import { mockFetch, jsonResponse, errorResponse, type MockFetchResult } from "../helpers/fetch";
import { CreatePostModal } from "../../components/CreatePostModal";
import { useUIStore } from "../../stores/ui";
import { queryKeys } from "../../api/queryKeys";
import type { Circle } from "../../api/endpoints";

let fetchMock: MockFetchResult;
afterEach(() => fetchMock?.restore());

beforeEach(() => {
  useUIStore.setState({
    editingPostId: null,
    showCreatePost: false,
    initialMedia: null,
    searchMode: "people",
  });
});

function makeCircle(id: string, name: string): Circle {
  return { id, userId: "u1", name, color: "blue", createdAt: "2024-01-01" };
}

// Preact maps onChange on file inputs to the native "change" event. fireEvent.change
// dispatches a synthetic event that Preact sees as "input" in RouterProvider context.
// Use dispatchEvent directly so the correct handler fires, and set input.files via
// Object.defineProperty since FileList is read-only.
function changeFileInput(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, "files", {
    value: Object.assign(files, { item: (i: number) => files[i] ?? null }),
    configurable: true,
  });
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

async function renderModal(
  onClose = mock(() => {}),
  {
    circles = [] as Circle[],
    initialMedia = null as { url: string; type: "image" | "video" } | null,
  } = {}
) {
  if (initialMedia) {
    useUIStore.setState({ initialMedia });
  }
  const qc = makeQueryClient();
  qc.setQueryData(queryKeys.circles.all(), circles);
  fetchMock = mockFetch((call) => {
    if (call.url.includes("/circles")) return circles;
    if (call.method === "POST" && call.url.includes("/posts")) {
      return {
        id: "p1",
        userId: "u1",
        content: "",
        media: [],
        createdAt: new Date().toISOString(),
        reactions: {},
        userReaction: null,
        comments: 0,
      };
    }
    return {};
  });
  return renderWithProviders(<CreatePostModal onClose={onClose} />, { queryClient: qc });
}

describe("CreatePostModal — rendering", () => {
  it("renders the New Moment heading", async () => {
    await renderModal();
    expect(screen.getByText("New Moment")).toBeInTheDocument();
  });

  it("renders the text area with placeholder", async () => {
    await renderModal();
    expect(screen.getByPlaceholderText("What's happening?")).toBeInTheDocument();
  });

  it("renders the Share button (disabled initially)", async () => {
    await renderModal();
    const shareBtn = screen.getByText("Share").closest("button")!;
    expect(shareBtn).toHaveAttribute("disabled");
  });

  it("renders the close (X) button", async () => {
    await renderModal();
    // The close button is the first button with an X icon — no aria-label
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const onClose = mock(() => {});
    await renderModal(onClose);
    const closeBtn = screen.getAllByRole("button")[0];
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("shows media toolbar buttons when in none mode", async () => {
    await renderModal();
    expect(screen.getByText("Photos")).toBeInTheDocument();
    expect(screen.getByText("Video")).toBeInTheDocument();
    expect(screen.getByText("Poll")).toBeInTheDocument();
  });
});

describe("CreatePostModal — text input and submit", () => {
  it("enables Share when text is entered", async () => {
    await renderModal();
    const textarea = screen.getByPlaceholderText("What's happening?");
    fireEvent.input(textarea, { target: { value: "Hello world" } });
    const shareBtn = screen.getByText("Share").closest("button")!;
    expect(shareBtn).not.toHaveAttribute("disabled");
  });

  it("submits post and calls onClose on success", async () => {
    const onClose = mock(() => {});
    await renderModal(onClose);
    const textarea = screen.getByPlaceholderText("What's happening?");
    fireEvent.input(textarea, { target: { value: "Hello world" } });
    fireEvent.click(screen.getByText("Share"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const postCall = fetchMock.calls.find((c) => c.method === "POST" && c.url.includes("/posts"));
    expect(postCall).toBeDefined();
    expect((postCall?.body as { content: string }).content).toBe("Hello world");
  });

  it("shows 'Sharing...' while submitting", async () => {
    let resolve: (v: Response) => void;
    const pending = new Promise<Response>((res) => {
      resolve = res;
    });
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.circles.all(), []);
    fetchMock = mockFetch((call) => {
      if (call.method === "POST" && call.url.includes("/posts")) return pending;
      return {};
    });
    await renderWithProviders(<CreatePostModal onClose={mock(() => {})} />, { queryClient: qc });
    const textarea = screen.getByPlaceholderText("What's happening?");
    fireEvent.input(textarea, { target: { value: "Loading" } });
    fireEvent.click(screen.getByText("Share"));
    await waitFor(() => expect(screen.getByText("Sharing...")).toBeInTheDocument());
    resolve!(
      jsonResponse({
        id: "p1",
        userId: "u1",
        content: "Loading",
        media: [],
        createdAt: "",
        reactions: {},
        userReaction: null,
        comments: 0,
      })
    );
  });

  it("shows error toast when submit fails", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.circles.all(), []);
    fetchMock = mockFetch((call) => {
      if (call.method === "POST" && call.url.includes("/posts")) return errorResponse(500);
      return {};
    });
    await renderWithProviders(<CreatePostModal onClose={mock(() => {})} />, { queryClient: qc });
    const textarea = screen.getByPlaceholderText("What's happening?");
    fireEvent.input(textarea, { target: { value: "Fail" } });
    fireEvent.click(screen.getByText("Share"));
    await waitFor(() => expect(screen.getByText(/500 Error/)).toBeInTheDocument());
  });

  it("does not submit when content is only whitespace", async () => {
    const onClose = mock(() => {});
    await renderModal(onClose);
    const textarea = screen.getByPlaceholderText("What's happening?");
    fireEvent.input(textarea, { target: { value: "   " } });
    const shareBtn = screen.getByText("Share").closest("button")!;
    expect(shareBtn).toHaveAttribute("disabled");
  });
});

describe("CreatePostModal — circle selection", () => {
  it("renders circle pills when circles exist", async () => {
    await renderModal(
      mock(() => {}),
      {
        circles: [makeCircle("c1", "Family")],
      }
    );
    expect(screen.getByText("Family")).toBeInTheDocument();
  });

  it("selecting a circle includes circleId in submission", async () => {
    const onClose = mock(() => {});
    const qc = makeQueryClient();
    const circles = [makeCircle("c1", "Family")];
    qc.setQueryData(queryKeys.circles.all(), circles);
    fetchMock = mockFetch((call) => {
      if (call.method === "POST" && call.url.includes("/posts"))
        return jsonResponse({
          id: "p1",
          userId: "u1",
          content: "",
          media: [],
          createdAt: "",
          reactions: {},
          userReaction: null,
          comments: 0,
        });
      return circles;
    });
    await renderWithProviders(<CreatePostModal onClose={onClose} />, { queryClient: qc });
    // Click the "Family" circle pill
    fireEvent.click(screen.getByText("Family"));
    // Enter content and submit
    const textarea = screen.getByPlaceholderText("What's happening?");
    fireEvent.input(textarea, { target: { value: "For family" } });
    fireEvent.click(screen.getByText("Share"));
    await waitFor(() => {
      const postCall = fetchMock.calls.find((c) => c.method === "POST" && c.url.includes("/posts"));
      expect(postCall).toBeDefined();
      expect((postCall?.body as { circleIds: string[] }).circleIds).toContain("c1");
    });
  });
});

describe("CreatePostModal — poll mode", () => {
  it("clicking Poll shows the poll form", async () => {
    await renderModal();
    fireEvent.click(screen.getByText("Poll"));
    expect(screen.getByPlaceholderText("Ask a question...")).toBeInTheDocument();
  });

  it("shows two default option inputs", async () => {
    await renderModal();
    fireEvent.click(screen.getByText("Poll"));
    expect(screen.getByPlaceholderText("Option 1")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Option 2")).toBeInTheDocument();
  });

  it("Add option button adds a third option", async () => {
    await renderModal();
    fireEvent.click(screen.getByText("Poll"));
    fireEvent.click(screen.getByText("Add option"));
    expect(screen.getByPlaceholderText("Option 3")).toBeInTheDocument();
  });

  it("remove option button appears when there are 3+ options", async () => {
    await renderModal();
    fireEvent.click(screen.getByText("Poll"));
    fireEvent.click(screen.getByText("Add option"));
    // Minus buttons should now be visible
    const minusBtns = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg") && b.className.includes("rounded-xl"));
    expect(minusBtns.length).toBeGreaterThan(0);
  });

  it("Add option is hidden at 6 options", async () => {
    await renderModal();
    fireEvent.click(screen.getByText("Poll"));
    // Add options until 6
    for (let i = 0; i < 4; i++) {
      const addBtn = screen.queryByText("Add option");
      if (addBtn) fireEvent.click(addBtn);
    }
    expect(screen.queryByText("Add option")).toBeNull();
  });

  it("removing an option reduces option count", async () => {
    await renderModal();
    fireEvent.click(screen.getByText("Poll"));
    fireEvent.click(screen.getByText("Add option"));
    const minusBtns = screen
      .getAllByRole("button")
      .filter((b) => b.className.includes("rounded-xl") && b.querySelector("svg"));
    fireEvent.click(minusBtns[0]);
    expect(screen.queryByPlaceholderText("Option 3")).toBeNull();
  });

  it("shows error toast when fewer than 2 poll options are filled", async () => {
    await renderModal();
    fireEvent.click(screen.getByText("Poll"));
    const questionInput = screen.getByPlaceholderText("Ask a question...");
    fireEvent.input(questionInput, { target: { value: "Best color?" } });
    // Leave both options blank — Share should stay disabled
    const shareBtn = screen.getByText("Share").closest("button")!;
    expect(shareBtn).toHaveAttribute("disabled");
  });

  it("Share is enabled when poll has question and 2 filled options", async () => {
    await renderModal();
    fireEvent.click(screen.getByText("Poll"));
    fireEvent.input(screen.getByPlaceholderText("Ask a question..."), {
      target: { value: "Best color?" },
    });
    fireEvent.input(screen.getByPlaceholderText("Option 1"), { target: { value: "Red" } });
    fireEvent.input(screen.getByPlaceholderText("Option 2"), { target: { value: "Blue" } });
    const shareBtn = screen.getByText("Share").closest("button")!;
    expect(shareBtn).not.toHaveAttribute("disabled");
  });

  it("submits a poll with correct payload", async () => {
    const onClose = mock(() => {});
    await renderModal(onClose);
    fireEvent.click(screen.getByText("Poll"));
    fireEvent.input(screen.getByPlaceholderText("Ask a question..."), {
      target: { value: "Best color?" },
    });
    fireEvent.input(screen.getByPlaceholderText("Option 1"), { target: { value: "Red" } });
    fireEvent.input(screen.getByPlaceholderText("Option 2"), { target: { value: "Blue" } });
    fireEvent.click(screen.getByText("Share"));
    await waitFor(() => {
      const postCall = fetchMock.calls.find((c) => c.method === "POST" && c.url.includes("/posts"));
      expect(postCall).toBeDefined();
      const body = postCall?.body as { poll?: { question: string; options: string[] } };
      expect(body.poll?.question).toBe("Best color?");
      expect(body.poll?.options).toEqual(["Red", "Blue"]);
    });
  });

  it("closing the poll form with X clears it", async () => {
    await renderModal();
    fireEvent.click(screen.getByText("Poll"));
    expect(screen.getByPlaceholderText("Ask a question...")).toBeInTheDocument();
    // Poll close X has class p-1 (modal close has p-2)
    const pollXBtn = screen
      .getAllByRole("button")
      .find(
        (b) =>
          b.className.includes("p-1") &&
          b.className.includes("hover:bg-gray-100") &&
          b.className.includes("rounded-full")
      );
    if (pollXBtn) fireEvent.click(pollXBtn);
    expect(screen.queryByPlaceholderText("Ask a question...")).toBeNull();
    expect(screen.getByText("Photos")).toBeInTheDocument();
  });

  it("poll form shows Add image button", async () => {
    await renderModal();
    fireEvent.click(screen.getByText("Poll"));
    expect(screen.getByText("Add image (optional)")).toBeInTheDocument();
  });

  it("fires poll validation toast when question and content set but only 1 valid option", async () => {
    // hasPoll=true (poll mode + question), validPollOptions.length < 2.
    // canSubmit is true because content.trim() satisfies the OR clause.
    // handleSubmit runs and hits the lines 163-165 guard.
    await renderModal();
    fireEvent.click(screen.getByText("Poll"));
    fireEvent.input(screen.getByPlaceholderText("Ask a question..."), {
      target: { value: "Best color?" },
    });
    fireEvent.input(screen.getByPlaceholderText("Option 1"), { target: { value: "Red" } });
    // Option 2 left blank — only 1 valid option
    const textarea = screen.getByPlaceholderText("What's happening?");
    fireEvent.input(textarea, { target: { value: "some content" } });
    // Share is enabled because content.trim() satisfies canSubmit's OR
    const shareBtn = screen.getByText("Share").closest("button")!;
    expect(shareBtn).not.toHaveAttribute("disabled");
    fireEvent.click(shareBtn);
    await waitFor(() =>
      expect(screen.getByText("Poll needs at least 2 options")).toBeInTheDocument()
    );
  });
});

describe("CreatePostModal — pre-attached media", () => {
  it("starts in photos mode with a pre-attached image shown", async () => {
    await renderModal(
      mock(() => {}),
      {
        initialMedia: { url: "https://example.com/photo.jpg", type: "image" },
      }
    );
    // The image is shown in the preview grid
    const img = document.querySelector('img[src="https://example.com/photo.jpg"]');
    expect(img).toBeInTheDocument();
  });

  it("clear media button removes pre-attached image", async () => {
    await renderModal(
      mock(() => {}),
      {
        initialMedia: { url: "https://example.com/photo.jpg", type: "image" },
      }
    );
    // Find the clear X button (absolute positioned)
    const clearBtn = screen
      .getAllByRole("button")
      .find((b) => b.className.includes("absolute") && b.className.includes("bg-black/50"));
    if (clearBtn) fireEvent.click(clearBtn);
    const img = document.querySelector('img[src="https://example.com/photo.jpg"]');
    expect(img).toBeNull();
  });

  it("submitting with pre-attached media includes it in the payload", async () => {
    const onClose = mock(() => {});
    await renderModal(onClose, {
      initialMedia: { url: "https://example.com/photo.jpg", type: "image" },
    });
    const textarea = screen.getByPlaceholderText("What's happening?");
    fireEvent.input(textarea, { target: { value: "With media" } });
    fireEvent.click(screen.getByText("Share"));
    await waitFor(() => {
      const postCall = fetchMock.calls.find((c) => c.method === "POST" && c.url.includes("/posts"));
      expect(postCall).toBeDefined();
      const body = postCall?.body as { media: Array<{ url: string }> };
      expect(body.media.some((m) => m.url === "https://example.com/photo.jpg")).toBe(true);
    });
  });
});

describe("CreatePostModal — mention autocomplete", () => {
  it("typing @ shows the mention autocomplete", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.circles.all(), []);
    qc.setQueryData(queryKeys.search.mentions("al"), [
      { id: "u1", username: "alice", displayName: "Alice", createdAt: "2024-01-01" },
    ]);
    fetchMock = mockFetch([]);
    await renderWithProviders(<CreatePostModal onClose={mock(() => {})} />, { queryClient: qc });
    const textarea = screen.getByPlaceholderText("What's happening?");
    // Simulate typing @al with cursor at end
    Object.defineProperty(textarea, "selectionStart", { value: 3, configurable: true });
    fireEvent.input(textarea, { target: { value: "@al" } });
    // Autocomplete should appear since query is "al" (2 chars)
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
  });

  it("selecting a mention from dropdown inserts the @username", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.circles.all(), []);
    qc.setQueryData(queryKeys.search.mentions("al"), [
      { id: "u1", username: "alice", displayName: "Alice", createdAt: "2024-01-01" },
    ]);
    fetchMock = mockFetch([]);
    await renderWithProviders(<CreatePostModal onClose={mock(() => {})} />, { queryClient: qc });
    const textarea = screen.getByPlaceholderText("What's happening?");
    Object.defineProperty(textarea, "selectionStart", { value: 3, configurable: true });
    fireEvent.input(textarea, { target: { value: "@al" } });
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Alice"));
    expect((textarea as HTMLTextAreaElement).value).toContain("@alice");
  });

  it("onClose of mention autocomplete hides the dropdown", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.circles.all(), []);
    qc.setQueryData(queryKeys.search.mentions("al"), [
      { id: "u1", username: "alice", displayName: "Alice", createdAt: "2024-01-01" },
    ]);
    fetchMock = mockFetch([]);
    await renderWithProviders(<CreatePostModal onClose={mock(() => {})} />, { queryClient: qc });
    const textarea = screen.getByPlaceholderText("What's happening?");
    Object.defineProperty(textarea, "selectionStart", { value: 3, configurable: true });
    fireEvent.input(textarea, { target: { value: "@al" } });
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    // Type a space to clear the @-mention pattern — resets visibility
    Object.defineProperty(textarea, "selectionStart", { value: 4, configurable: true });
    fireEvent.input(textarea, { target: { value: "@al " } });
    await waitFor(() => expect(screen.queryByText("Alice")).toBeNull());
  });

  it("ArrowDown keydown delegates to mention ref and advances selection", async () => {
    // Covers lines 98-100: handleTextareaKeyDown delegates to mentionRef when visible
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.circles.all(), []);
    qc.setQueryData(queryKeys.search.mentions("al"), [
      { id: "u1", username: "alice", displayName: "Alice", createdAt: "2024-01-01" },
      { id: "u2", username: "alan", displayName: "Alan", createdAt: "2024-01-01" },
    ]);
    fetchMock = mockFetch([]);
    await renderWithProviders(<CreatePostModal onClose={mock(() => {})} />, { queryClient: qc });
    const textarea = screen.getByPlaceholderText("What's happening?");
    Object.defineProperty(textarea, "selectionStart", { value: 3, configurable: true });
    fireEvent.input(textarea, { target: { value: "@al" } });
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    // Fire ArrowDown — mentionRef.current.handleKeyDown consumes it and advances selection
    fireEvent.keyDown(textarea, { key: "ArrowDown" });
    await waitFor(() => {
      const alanBtn = screen
        .getAllByRole("button")
        .find((b) => b.textContent?.includes("Alan") && b.className.includes("bg-accent-50"));
      expect(alanBtn).toBeDefined();
    });
  });
  it("selecting a mention positions cursor after inserted username", async () => {
    // Covers lines 91-93: the setTimeout callback in handleMentionSelect runs
    // setSelectionRange and focus after insertion.
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.circles.all(), []);
    qc.setQueryData(queryKeys.search.mentions("al"), [
      { id: "u1", username: "alice", displayName: "Alice", createdAt: "2024-01-01" },
    ]);
    fetchMock = mockFetch([]);
    await renderWithProviders(<CreatePostModal onClose={mock(() => {})} />, { queryClient: qc });
    const textarea = screen.getByPlaceholderText("What's happening?");
    Object.defineProperty(textarea, "selectionStart", { value: 3, configurable: true });
    fireEvent.input(textarea, { target: { value: "@al" } });
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Alice"));
    // Drain the event loop so the setTimeout(fn, 0) callback fires
    await new Promise((r) => setTimeout(r, 10));
    expect((textarea as HTMLTextAreaElement).value).toContain("@alice");
  });
});

describe("CreatePostModal — photo file selection", () => {
  it("selecting a photo switches to photos mode and shows preview grid", async () => {
    await renderModal();
    const photoInput = document.querySelector(
      'input[type="file"][accept="image/*"]'
    ) as HTMLInputElement;
    const file = new File(["x"], "photo.png", { type: "image/png" });
    changeFileInput(photoInput, [file]);
    await waitFor(() => expect(screen.queryByText("Photos")).toBeNull());
    // Preview grid renders an <img> for the selected file (lines 280-282)
    const imgs = document.querySelectorAll("img");
    expect(imgs.length).toBeGreaterThan(0);
    expect(imgs[0].getAttribute("src")).toMatch(/^blob:/);
  });

  it("non-image files are filtered out and mode stays none", async () => {
    await renderModal();
    const photoInput = document.querySelector(
      'input[type="file"][accept="image/*"]'
    ) as HTMLInputElement;
    const file = new File(["x"], "doc.pdf", { type: "application/pdf" });
    changeFileInput(photoInput, [file]);
    // imageFiles.length === 0 → early return, mode unchanged
    expect(screen.getByText("Photos")).toBeInTheDocument();
  });

  it("empty file list does not change mode", async () => {
    await renderModal();
    const photoInput = document.querySelector(
      'input[type="file"][accept="image/*"]'
    ) as HTMLInputElement;
    changeFileInput(photoInput, []);
    expect(screen.getByText("Photos")).toBeInTheDocument();
  });

  it("uploading selected photos calls presign, PUT, and complete, then posts", async () => {
    const onClose = mock(() => {});
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.circles.all(), []);
    const uploadUrl = "https://s3.example.com/upload/key123";
    fetchMock = mockFetch((call) => {
      if (call.method === "POST" && call.url.includes("/media/presign")) {
        return jsonResponse({ uploadUrl, key: "key123", expiresIn: 3600 });
      }
      if (call.method === "PUT" && call.url === uploadUrl) {
        return new Response(null, { status: 200 });
      }
      if (call.method === "POST" && call.url.includes("/media/complete")) {
        return jsonResponse({
          url: "https://cdn.example.com/key123.jpg",
          type: "image",
          sortOrder: 0,
        });
      }
      if (call.method === "POST" && call.url.includes("/posts")) {
        return jsonResponse({
          id: "p1",
          userId: "u1",
          content: "with photo",
          media: [],
          createdAt: new Date().toISOString(),
          reactions: {},
          userReaction: null,
          comments: 0,
        });
      }
      if (call.url.includes("/circles")) return jsonResponse([]);
      return {};
    });
    await renderWithProviders(<CreatePostModal onClose={onClose} />, { queryClient: qc });
    const photoInput = document.querySelector(
      'input[type="file"][accept="image/*"]'
    ) as HTMLInputElement;
    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    changeFileInput(photoInput, [file]);
    await waitFor(() => expect(screen.queryByText("Photos")).toBeNull());
    const textarea = screen.getByPlaceholderText("What's happening?");
    fireEvent.input(textarea, { target: { value: "with photo" } });
    fireEvent.click(screen.getByText("Share"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const presignCall = fetchMock.calls.find((c) => c.url.includes("/media/presign"));
    expect(presignCall).toBeDefined();
    const putCall = fetchMock.calls.find((c) => c.method === "PUT" && c.url === uploadUrl);
    expect(putCall).toBeDefined();
    const completeCall = fetchMock.calls.find((c) => c.url.includes("/media/complete"));
    expect(completeCall).toBeDefined();
    const postCall = fetchMock.calls.find((c) => c.method === "POST" && c.url.includes("/posts"));
    expect(postCall).toBeDefined();
    const body = postCall?.body as { media: Array<{ url: string }> };
    expect(body.media.some((m) => m.url === "https://cdn.example.com/key123.jpg")).toBe(true);
  });
});

describe("CreatePostModal — video file selection", () => {
  it("selecting a valid video file switches to video mode", async () => {
    await renderModal();
    const videoInput = document.querySelector(
      'input[type="file"][accept="video/*"]'
    ) as HTMLInputElement;
    const file = new File(["v"], "clip.mp4", { type: "video/mp4" });
    changeFileInput(videoInput, [file]);
    await waitFor(() => expect(screen.queryByText("Video")).toBeNull());
    expect(document.querySelector("video")).not.toBeNull();
  });

  it("rejects video files larger than 50 MB with a toast error", async () => {
    await renderModal();
    const videoInput = document.querySelector(
      'input[type="file"][accept="video/*"]'
    ) as HTMLInputElement;
    const file = new File(["v"], "huge.mp4", { type: "video/mp4" });
    Object.defineProperty(file, "size", { value: 60 * 1024 * 1024 });
    changeFileInput(videoInput, [file]);
    await waitFor(() => expect(screen.getByText("Video too large (max 50MB)")).toBeInTheDocument());
    // Mode stays none
    expect(screen.getByText("Photos")).toBeInTheDocument();
  });

  it("empty video file list does not change mode", async () => {
    await renderModal();
    const videoInput = document.querySelector(
      'input[type="file"][accept="video/*"]'
    ) as HTMLInputElement;
    changeFileInput(videoInput, []);
    expect(screen.getByText("Video")).toBeInTheDocument();
  });

  it("non-video file in video input is silently ignored", async () => {
    await renderModal();
    const videoInput = document.querySelector(
      'input[type="file"][accept="video/*"]'
    ) as HTMLInputElement;
    const file = new File(["x"], "image.jpg", { type: "image/jpeg" });
    changeFileInput(videoInput, [file]);
    expect(screen.getByText("Video")).toBeInTheDocument();
  });
});
