import { describe, it, expect, beforeEach } from "bun:test";
import { useLightbox } from "../../stores/lightbox";

const images = [
  { url: "/a.jpg", alt: "A" },
  { url: "/b.jpg", alt: "B" },
  { url: "/c.jpg", alt: "C" },
];

const reset = () =>
  useLightbox.setState({
    isOpen: false,
    images: [],
    currentIndex: 0,
  });

describe("useLightbox", () => {
  beforeEach(reset);

  describe("open", () => {
    it("opens with images and defaults to index 0", () => {
      useLightbox.getState().open(images);
      const s = useLightbox.getState();
      expect(s.isOpen).toBe(true);
      expect(s.images).toEqual(images);
      expect(s.currentIndex).toBe(0);
    });

    it("opens at a specified startIndex", () => {
      useLightbox.getState().open(images, 2);
      expect(useLightbox.getState().currentIndex).toBe(2);
    });

    it("opens with a single image", () => {
      useLightbox.getState().open([images[0]]);
      expect(useLightbox.getState().images).toHaveLength(1);
      expect(useLightbox.getState().isOpen).toBe(true);
    });
  });

  describe("close", () => {
    it("sets isOpen to false", () => {
      useLightbox.getState().open(images);
      useLightbox.getState().close();
      expect(useLightbox.getState().isOpen).toBe(false);
    });

    it("preserves images and currentIndex after close", () => {
      useLightbox.getState().open(images, 1);
      useLightbox.getState().close();
      expect(useLightbox.getState().currentIndex).toBe(1);
      expect(useLightbox.getState().images).toEqual(images);
    });
  });

  describe("next", () => {
    it("advances currentIndex by 1", () => {
      useLightbox.getState().open(images, 0);
      useLightbox.getState().next();
      expect(useLightbox.getState().currentIndex).toBe(1);
    });

    it("does not advance past the last image", () => {
      useLightbox.getState().open(images, 2);
      useLightbox.getState().next();
      expect(useLightbox.getState().currentIndex).toBe(2);
    });

    it("stops at last index when already at end (boundary)", () => {
      useLightbox.getState().open([images[0]]);
      useLightbox.getState().next();
      expect(useLightbox.getState().currentIndex).toBe(0);
    });
  });

  describe("prev", () => {
    it("decrements currentIndex by 1", () => {
      useLightbox.getState().open(images, 2);
      useLightbox.getState().prev();
      expect(useLightbox.getState().currentIndex).toBe(1);
    });

    it("does not go below index 0", () => {
      useLightbox.getState().open(images, 0);
      useLightbox.getState().prev();
      expect(useLightbox.getState().currentIndex).toBe(0);
    });
  });

  describe("goTo", () => {
    it("sets currentIndex to the given index", () => {
      useLightbox.getState().open(images);
      useLightbox.getState().goTo(2);
      expect(useLightbox.getState().currentIndex).toBe(2);
    });

    it("ignores negative index", () => {
      useLightbox.getState().open(images, 1);
      useLightbox.getState().goTo(-1);
      expect(useLightbox.getState().currentIndex).toBe(1);
    });

    it("ignores index equal to images.length", () => {
      useLightbox.getState().open(images, 1);
      useLightbox.getState().goTo(images.length);
      expect(useLightbox.getState().currentIndex).toBe(1);
    });

    it("ignores index beyond images.length", () => {
      useLightbox.getState().open(images, 1);
      useLightbox.getState().goTo(99);
      expect(useLightbox.getState().currentIndex).toBe(1);
    });

    it("goes to index 0 from a non-zero position", () => {
      useLightbox.getState().open(images, 2);
      useLightbox.getState().goTo(0);
      expect(useLightbox.getState().currentIndex).toBe(0);
    });
  });
});
