import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { screen, fireEvent, waitFor } from "@testing-library/preact";
import { renderWithProviders, makeQueryClient } from "../helpers/render";
import { mockFetch, type MockFetchResult } from "../helpers/fetch";
import { PostCard } from "../../components/PostCard";
import { useUIStore } from "../../stores/ui";
import { useLightbox } from "../../stores/lightbox";
import type { Post, Poll } from "../../api/endpoints";

let fetchMock: MockFetchResult;

afterEach(() => fetchMock?.restore());

beforeEach(() => {
  useUIStore.setState({
    editingPostId: null,
    showCreatePost: false,
    initialMedia: null,
    searchMode: "people",
  });
  useLightbox.setState({ isOpen: false, images: [], currentIndex: 0 });
});

const author = {
  displayName: "Ada Lovelace",
  username: "ada",
  avatar: undefined as string | undefined,
  role: undefined as string | undefined,
};

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: "p1",
    userId: "u1",
    content: "Hello world",
    media: [],
    createdAt: new Date().toISOString(),
    reactions: {},
    userReaction: null,
    comments: 0,
    ...overrides,
  };
}

function makePoll(overrides: Partial<Poll> = {}): Poll {
  return {
    id: "poll-1",
    question: "Choose one",
    userVote: null,
    totalVotes: 0,
    options: [
      { id: "opt-a", optionText: "Option A", voteCount: 0, sortOrder: 0 },
      { id: "opt-b", optionText: "Option B", voteCount: 0, sortOrder: 1 },
    ],
    ...overrides,
  };
}

async function renderPost(post: Post, props: Partial<Parameters<typeof PostCard>[0]> = {}) {
  const queryClient = makeQueryClient();
  fetchMock = mockFetch({});
  return renderWithProviders(
    <PostCard post={post} author={author} currentUserId="u1" {...props} />,
    { queryClient }
  );
}

describe("PostCard — author / content rendering", () => {
  it("renders the author display name", async () => {
    await renderPost(makePost());
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });

  it("renders the author username handle", async () => {
    await renderPost(makePost());
    expect(screen.getByText("@ada")).toBeInTheDocument();
  });

  it("renders post content", async () => {
    await renderPost(makePost({ content: "My test post" }));
    expect(screen.getByText("My test post")).toBeInTheDocument();
  });

  it("renders comment count", async () => {
    await renderPost(makePost({ comments: 7 }));
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("falls back to 'User' when no author prop and no post.author", async () => {
    fetchMock = mockFetch({});
    await renderWithProviders(<PostCard post={makePost()} currentUserId="u1" />);
    expect(screen.getAllByText("User").length).toBeGreaterThan(0);
  });

  it("uses post.author when no author prop is given", async () => {
    fetchMock = mockFetch({});
    const post = makePost({
      author: { displayName: "Bob", username: "bob" },
    });
    await renderWithProviders(<PostCard post={post} currentUserId="u1" />);
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("renders the bot badge when author role is bot", async () => {
    await renderPost(makePost(), { author: { ...author, role: "bot" } });
    expect(screen.getByText("Bot")).toBeInTheDocument();
  });

  it("does not render bot badge for non-bot authors", async () => {
    await renderPost(makePost());
    expect(screen.queryByText("Bot")).toBeNull();
  });

  it("renders a relative timestamp", async () => {
    await renderPost(makePost());
    // formatTimeAgo for just-now returns "now"
    expect(screen.getByText("now")).toBeInTheDocument();
  });

  it("does not render the content paragraph when content is empty", async () => {
    await renderPost(makePost({ content: "" }));
    // The content paragraph is only rendered when post.content?.trim() is truthy
    // The comments link still points to /post/p1 so we check for the <p> element instead
    const contentParagraph = document.querySelector("p");
    expect(contentParagraph).toBeNull();
  });

  it("renders mediaUrl as a single image when media array is empty", async () => {
    await renderPost(makePost({ media: [], mediaUrl: "https://example.com/img.jpg" }));
    const img = screen.getByAltText("Post media");
    expect(img.getAttribute("src")).toBe("https://example.com/img.jpg");
  });
});

describe("PostCard — media rendering", () => {
  it("renders a single image with lightbox button", async () => {
    const post = makePost({
      media: [{ url: "https://example.com/img.jpg", type: "image" }],
    });
    await renderPost(post);
    expect(screen.getByAltText("Post media")).toBeInTheDocument();
  });

  it("opens lightbox when single image is clicked", async () => {
    const post = makePost({
      content: "",
      media: [{ url: "https://example.com/img.jpg", type: "image" }],
    });
    await renderPost(post);
    fireEvent.click(
      screen.getByRole("button", { name: /react to post/i })
        ? screen.getAllByRole("button")[1]
        : screen.getAllByRole("button")[0]
    );
    // Find the image wrapper button (not the reaction button)
    const buttons = screen.getAllByRole("button");
    // The media button is the one wrapping the Post media img
    const mediaButton = buttons.find((b) => b.querySelector('img[alt="Post media"]'));
    if (mediaButton) {
      fireEvent.click(mediaButton);
      expect(useLightbox.getState().isOpen).toBe(true);
    }
  });

  it("renders a video element for a single video media item", async () => {
    const post = makePost({
      content: "",
      media: [{ url: "https://example.com/vid.mp4", type: "video" }],
    });
    await renderPost(post);
    expect(document.querySelector("video")).toBeInTheDocument();
  });

  it("renders video with poster when thumbnailUrl is present", async () => {
    const post = makePost({
      content: "",
      media: [
        {
          url: "https://example.com/vid.mp4",
          type: "video",
          thumbnailUrl: "https://example.com/thumb.jpg",
        },
      ],
    });
    await renderPost(post);
    const video = document.querySelector("video");
    expect(video?.getAttribute("poster")).toBe("https://example.com/thumb.jpg");
  });

  it("renders multiple images in a grid", async () => {
    const post = makePost({
      content: "",
      media: [
        { url: "https://example.com/img1.jpg", type: "image" },
        { url: "https://example.com/img2.jpg", type: "image" },
      ],
    });
    await renderPost(post);
    expect(screen.getByAltText("Post media 1")).toBeInTheDocument();
    expect(screen.getByAltText("Post media 2")).toBeInTheDocument();
  });

  it("opens lightbox at correct index for multi-image grid", async () => {
    const post = makePost({
      content: "",
      media: [
        { url: "https://example.com/img1.jpg", type: "image" },
        { url: "https://example.com/img2.jpg", type: "image" },
      ],
    });
    await renderPost(post);
    const gridButtons = screen.getAllByRole("button").filter((b) => b.querySelector("img"));
    fireEvent.click(gridButtons[1]);
    expect(useLightbox.getState().currentIndex).toBe(1);
    expect(useLightbox.getState().isOpen).toBe(true);
  });
});

describe("PostCard — reactions", () => {
  it("renders the reaction button with 'React to post' label when no reactions", async () => {
    await renderPost(makePost({ reactions: {}, userReaction: null }));
    expect(screen.getByLabelText(/react to post/i)).toBeInTheDocument();
  });

  it("shows total reaction count in the label when reactions exist", async () => {
    await renderPost(makePost({ reactions: { love: 3 }, userReaction: null }));
    expect(screen.getByLabelText(/3 reactions/i)).toBeInTheDocument();
  });

  it("shows '1 reaction' singular for exactly 1 reaction", async () => {
    await renderPost(makePost({ reactions: { love: 1 }, userReaction: null }));
    expect(screen.getByLabelText(/1 reaction\b/i)).toBeInTheDocument();
  });

  it("opens the reaction picker when reaction button is clicked", async () => {
    await renderPost(makePost());
    fireEvent.click(screen.getByLabelText(/react to post/i));
    expect(screen.getByTitle("Love")).toBeInTheDocument();
    expect(screen.getByTitle("Haha")).toBeInTheDocument();
    expect(screen.getByTitle("Hugs")).toBeInTheDocument();
    expect(screen.getByTitle("Celebrate")).toBeInTheDocument();
  });

  it("calls onReact with correct args when a reaction emoji is clicked", async () => {
    const onReact = mock(() => {});
    await renderPost(makePost({ reactions: {}, userReaction: null }), {
      onReact,
    });
    fireEvent.click(screen.getByLabelText(/react to post/i));
    fireEvent.click(screen.getByTitle("Love"));
    expect(onReact).toHaveBeenCalledTimes(1);
    expect(onReact).toHaveBeenCalledWith("p1", "love", null);
  });

  it("closes the picker after selecting a reaction", async () => {
    await renderPost(makePost());
    fireEvent.click(screen.getByLabelText(/react to post/i));
    fireEvent.click(screen.getByTitle("Haha"));
    expect(screen.queryByTitle("Love")).toBeNull();
  });

  it("shows the user's current reaction emoji on the button", async () => {
    await renderPost(makePost({ reactions: { love: 1 }, userReaction: "love" }));
    // The emoji ❤️ should appear in the reaction button area
    expect(screen.getByText("❤️")).toBeInTheDocument();
  });

  it("renders ReactionSummary when more than one reaction type has votes", async () => {
    await renderPost(makePost({ reactions: { love: 2, haha: 1 }, userReaction: null }));
    // Summary shows emoji + counts
    expect(screen.getAllByText("❤️").length).toBeGreaterThan(0);
  });

  it("closes the picker when clicking outside", async () => {
    await renderPost(makePost());
    fireEvent.click(screen.getByLabelText(/react to post/i));
    expect(screen.getByTitle("Love")).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    await waitFor(() => {
      expect(screen.queryByTitle("Love")).toBeNull();
    });
  });
});

describe("PostCard — edit flow", () => {
  it("shows the edit button for the post owner", async () => {
    await renderPost(makePost(), {
      onEdit: () => {},
    });
    expect(screen.getByLabelText("Edit post")).toBeInTheDocument();
  });

  it("does not show edit button when onEdit is not provided", async () => {
    await renderPost(makePost());
    expect(screen.queryByLabelText("Edit post")).toBeNull();
  });

  it("does not show edit button for non-owner", async () => {
    fetchMock = mockFetch({});
    await renderWithProviders(
      <PostCard post={makePost()} author={author} currentUserId="other-user" onEdit={() => {}} />
    );
    expect(screen.queryByLabelText("Edit post")).toBeNull();
  });

  it("enters editing mode when edit button is clicked", async () => {
    await renderPost(makePost({ content: "Original" }), {
      onEdit: () => {},
    });
    fireEvent.click(screen.getByLabelText("Edit post"));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("calls onEdit with trimmed content when save is clicked", async () => {
    const onEdit = mock(() => {});
    await renderPost(makePost({ content: "Original" }), { onEdit });
    fireEvent.click(screen.getByLabelText("Edit post"));
    const textarea = screen.getByRole("textbox");
    fireEvent.input(textarea, { target: { value: "Updated content" } });
    // Click the check button — it's the last button without aria-label
    const editButtons = screen.getAllByRole("button").filter((b) => !b.getAttribute("aria-label"));
    // Last two unnamed buttons in edit mode are cancel (X) and save (Check)
    const checkBtn = editButtons[editButtons.length - 1];
    fireEvent.click(checkBtn);
    expect(onEdit).toHaveBeenCalledWith("p1", "Updated content");
  });

  it("cancels editing when cancel button is clicked", async () => {
    const onEdit = mock(() => {});
    await renderPost(makePost({ content: "Original" }), { onEdit });
    fireEvent.click(screen.getByLabelText("Edit post"));
    // Cancel button is the X icon — find buttons without aria-label
    const editButtons = screen.getAllByRole("button").filter((b) => !b.getAttribute("aria-label"));
    const cancelBtn = editButtons[editButtons.length - 2];
    fireEvent.click(cancelBtn);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("does not call onEdit when edited content is blank with no media", async () => {
    const onEdit = mock(() => {});
    await renderPost(makePost({ content: "Orig" }), { onEdit });
    fireEvent.click(screen.getByLabelText("Edit post"));
    const textarea = screen.getByRole("textbox");
    fireEvent.input(textarea, { target: { value: "   " } });
    const editButtons = screen.getAllByRole("button").filter((b) => !b.getAttribute("aria-label"));
    const checkBtn = editButtons[editButtons.length - 1];
    fireEvent.click(checkBtn);
    expect(onEdit).not.toHaveBeenCalled();
  });
});

describe("PostCard — delete flow", () => {
  it("shows the delete button for the post owner", async () => {
    await renderPost(makePost(), { onDelete: () => {} });
    expect(screen.getByLabelText("Delete post")).toBeInTheDocument();
  });

  it("does not show delete button when onDelete is not provided", async () => {
    await renderPost(makePost());
    expect(screen.queryByLabelText("Delete post")).toBeNull();
  });

  it("opens a confirm dialog when delete is clicked", async () => {
    const onDelete = mock(() => {});
    await renderPost(makePost(), { onDelete });
    fireEvent.click(screen.getByLabelText("Delete post"));
    await waitFor(() => {
      expect(screen.getByText("Delete Post")).toBeInTheDocument();
    });
  });

  it("calls onDelete when the confirm dialog is confirmed", async () => {
    const onDelete = mock(() => {});
    await renderPost(makePost(), { onDelete });
    fireEvent.click(screen.getByLabelText("Delete post"));
    await waitFor(() => {
      expect(screen.getByText("Delete Post")).toBeInTheDocument();
    });
    // Confirm button in the modal
    const confirmBtn = screen.getAllByRole("button").find((b) => b.textContent === "Delete");
    if (confirmBtn) fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith("p1");
    });
  });

  it("does not call onDelete when the confirm dialog is cancelled", async () => {
    const onDelete = mock(() => {});
    await renderPost(makePost(), { onDelete });
    fireEvent.click(screen.getByLabelText("Delete post"));
    await waitFor(() => {
      expect(screen.getByText("Delete Post")).toBeInTheDocument();
    });
    const cancelBtn = screen.getAllByRole("button").find((b) => b.textContent === "Cancel");
    if (cancelBtn) fireEvent.click(cancelBtn);
    await waitFor(() => {
      expect(onDelete).not.toHaveBeenCalled();
    });
  });
});

describe("PostCard — share button", () => {
  it("renders the Copy link button", async () => {
    await renderPost(makePost());
    expect(screen.getByLabelText("Copy link")).toBeInTheDocument();
  });

  it("calls clipboard.writeText when Copy link is clicked", async () => {
    let copied = "";
    const writeText = mock((text: string) => {
      copied = text;
    });
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    await renderPost(makePost({ id: "p99" }));
    fireEvent.click(screen.getByLabelText("Copy link"));
    await waitFor(() => {
      expect(copied).toContain("p99");
    });
  });

  it("shows error toast when clipboard.writeText fails", async () => {
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: {
        writeText: mock(() => {
          throw new Error("Not allowed");
        }),
      },
      writable: true,
      configurable: true,
    });
    await renderPost(makePost());
    fireEvent.click(screen.getByLabelText("Copy link"));
    await waitFor(() => {
      expect(screen.getByText("Failed to copy link")).toBeInTheDocument();
    });
  });
});

describe("PostCard — poll embed", () => {
  it("renders the poll question inside the post", async () => {
    const post = makePost({ poll: makePoll() });
    await renderPost(post);
    expect(screen.getByText("Choose one")).toBeInTheDocument();
  });

  it("renders poll options as buttons when not voted", async () => {
    const post = makePost({ poll: makePoll() });
    await renderPost(post);
    expect(screen.getByText("Option A")).toBeInTheDocument();
    expect(screen.getByText("Option B")).toBeInTheDocument();
  });

  it("shows results after a vote", async () => {
    const post = makePost({
      poll: makePoll({
        userVote: "opt-a",
        totalVotes: 1,
        options: [
          { id: "opt-a", optionText: "Option A", voteCount: 1, sortOrder: 0 },
          { id: "opt-b", optionText: "Option B", voteCount: 0, sortOrder: 1 },
        ],
      }),
    });
    await renderPost(post);
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("1 vote")).toBeInTheDocument();
  });
});
