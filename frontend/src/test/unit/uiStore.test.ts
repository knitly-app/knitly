import { describe, it, expect, beforeEach } from "bun:test";
import { useUIStore } from "../../stores/ui";

const reset = () =>
  useUIStore.setState({
    editingPostId: null,
    showCreatePost: false,
    initialMedia: null,
    searchMode: "people",
  });

describe("useUIStore", () => {
  beforeEach(reset);

  it("sets and clears the editing post id", () => {
    useUIStore.getState().setEditingPost("p1");
    expect(useUIStore.getState().editingPostId).toBe("p1");
    useUIStore.getState().setEditingPost(null);
    expect(useUIStore.getState().editingPostId).toBeNull();
  });

  it("opens create post without media", () => {
    useUIStore.getState().openCreatePost();
    expect(useUIStore.getState().showCreatePost).toBe(true);
    expect(useUIStore.getState().initialMedia).toBeNull();
  });

  it("opens create post with pre-attached media", () => {
    const media = { url: "/x.png", type: "image" as const };
    useUIStore.getState().openCreatePost({ media });
    expect(useUIStore.getState().initialMedia).toEqual(media);
  });

  it("closes create post and resets media", () => {
    useUIStore.getState().openCreatePost({ media: { url: "/x.png", type: "image" } });
    useUIStore.getState().closeCreatePost();
    expect(useUIStore.getState().showCreatePost).toBe(false);
    expect(useUIStore.getState().initialMedia).toBeNull();
  });

  it("switches search mode", () => {
    useUIStore.getState().setSearchMode("posts");
    expect(useUIStore.getState().searchMode).toBe("posts");
  });
});
