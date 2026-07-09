import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { screen, fireEvent } from "@testing-library/preact";
import { renderWithProviders } from "../helpers/render";
import { mockFetch, type MockFetchResult } from "../helpers/fetch";
import { MediaGrid } from "../../components/MediaGrid";
import { useLightbox } from "../../stores/lightbox";
import type { Post, MediaItem } from "../../api/endpoints";

function makePost(id: string, media: MediaItem[]): Post {
  return {
    id,
    userId: "u1",
    content: "Test post",
    media,
    createdAt: "2024-01-01",
    reactions: {},
    userReaction: null,
    comments: 0,
  };
}

const imageItem: MediaItem = { url: "https://example.com/img.jpg", type: "image" };
const image2Item: MediaItem = { url: "https://example.com/img2.jpg", type: "image" };
const videoItem: MediaItem = {
  url: "https://example.com/vid.mp4",
  thumbnailUrl: "https://example.com/thumb.jpg",
  type: "video",
};
const videoNoThumb: MediaItem = { url: "https://example.com/vid2.mp4", type: "video" };

let fetchMock: MockFetchResult;
afterEach(() => fetchMock?.restore());

beforeEach(() => {
  useLightbox.setState({ isOpen: false, images: [], currentIndex: 0 });
});

describe("MediaGrid", () => {
  describe("empty state", () => {
    it("renders nothing when posts have no media", async () => {
      fetchMock = mockFetch({});
      const post = makePost("p1", []);
      await renderWithProviders(<MediaGrid posts={[post]} />);
      expect(screen.queryByRole("button")).toBeNull();
    });

    it("renders nothing when posts array is empty", async () => {
      fetchMock = mockFetch({});
      await renderWithProviders(<MediaGrid posts={[]} />);
      expect(screen.queryByRole("button")).toBeNull();
    });
  });

  describe("single image", () => {
    it("renders an image item", async () => {
      fetchMock = mockFetch({});
      const post = makePost("p1", [imageItem]);
      await renderWithProviders(<MediaGrid posts={[post]} />);
      expect(screen.getByAltText("Media 1")).toBeInTheDocument();
      expect(screen.getByAltText("Media 1").getAttribute("src")).toBe(imageItem.url);
    });

    it("opens the lightbox when an image is clicked", async () => {
      fetchMock = mockFetch({});
      const post = makePost("p1", [imageItem]);
      await renderWithProviders(<MediaGrid posts={[post]} />);

      fireEvent.click(screen.getByRole("button"));
      expect(useLightbox.getState().isOpen).toBe(true);
      expect(useLightbox.getState().images).toEqual([{ url: imageItem.url, alt: "Post media" }]);
      expect(useLightbox.getState().currentIndex).toBe(0);
    });
  });

  describe("multiple images", () => {
    it("renders all image items", async () => {
      fetchMock = mockFetch({});
      const post = makePost("p1", [imageItem, image2Item]);
      await renderWithProviders(<MediaGrid posts={[post]} />);
      expect(screen.getByAltText("Media 1")).toBeInTheDocument();
      expect(screen.getByAltText("Media 2")).toBeInTheDocument();
    });

    it("opens lightbox at the correct index when second image is clicked", async () => {
      fetchMock = mockFetch({});
      const post = makePost("p1", [imageItem, image2Item]);
      await renderWithProviders(<MediaGrid posts={[post]} />);

      const buttons = screen.getAllByRole("button");
      fireEvent.click(buttons[1]);

      expect(useLightbox.getState().currentIndex).toBe(1);
      expect(useLightbox.getState().images).toHaveLength(2);
    });
  });

  describe("video item", () => {
    it("renders the thumbnail for a video item", async () => {
      fetchMock = mockFetch({});
      const post = makePost("p1", [videoItem]);
      await renderWithProviders(<MediaGrid posts={[post]} />);
      const img = screen.getByAltText("Media 1");
      expect(img.getAttribute("src")).toBe(videoItem.thumbnailUrl);
    });

    it("falls back to video url when no thumbnailUrl", async () => {
      fetchMock = mockFetch({});
      const post = makePost("p1", [videoNoThumb]);
      await renderWithProviders(<MediaGrid posts={[post]} />);
      const img = screen.getByAltText("Media 1");
      expect(img.getAttribute("src")).toBe(videoNoThumb.url);
    });

    it("shows a play icon overlay for video items", async () => {
      fetchMock = mockFetch({});
      const post = makePost("p1", [videoItem]);
      await renderWithProviders(<MediaGrid posts={[post]} />);
      const btn = screen.getByRole("button");
      expect(btn.querySelector("svg")).toBeInTheDocument();
    });

    it("does not open lightbox when a video is clicked", async () => {
      fetchMock = mockFetch({});
      const post = makePost("p1", [videoItem]);
      await renderWithProviders(<MediaGrid posts={[post]} />, {
        path: "/",
        initialEntries: ["/"],
      });

      fireEvent.click(screen.getByRole("button"));
      expect(useLightbox.getState().isOpen).toBe(false);
    });
  });

  describe("mixed media", () => {
    it("renders both image and video items from the same post", async () => {
      fetchMock = mockFetch({});
      const post = makePost("p1", [imageItem, videoItem]);
      await renderWithProviders(<MediaGrid posts={[post]} />);
      expect(screen.getByAltText("Media 1")).toBeInTheDocument();
      expect(screen.getByAltText("Media 2")).toBeInTheDocument();
    });

    it("opens lightbox for the image only, skipping video in the images array", async () => {
      fetchMock = mockFetch({});
      const post = makePost("p1", [videoItem, imageItem]);
      await renderWithProviders(<MediaGrid posts={[post]} />);

      const buttons = screen.getAllByRole("button");
      fireEvent.click(buttons[1]);

      expect(useLightbox.getState().isOpen).toBe(true);
      expect(useLightbox.getState().images).toEqual([{ url: imageItem.url, alt: "Post media" }]);
    });
  });

  describe("multiple posts", () => {
    it("flattens media from multiple posts", async () => {
      fetchMock = mockFetch({});
      const post1 = makePost("p1", [imageItem]);
      const post2 = makePost("p2", [image2Item]);
      await renderWithProviders(<MediaGrid posts={[post1, post2]} />);
      expect(screen.getByAltText("Media 1")).toBeInTheDocument();
      expect(screen.getByAltText("Media 2")).toBeInTheDocument();
    });
  });
});
