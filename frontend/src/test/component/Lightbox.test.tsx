import { describe, it, expect, beforeEach } from "bun:test";
import { render, screen, fireEvent, act } from "@testing-library/preact";
import { Lightbox } from "../../components/Lightbox";
import { useLightbox } from "../../stores/lightbox";

const singleImage = [{ url: "https://example.com/img1.jpg", alt: "First image" }];
const multiImages = [
  { url: "https://example.com/img1.jpg", alt: "First image" },
  { url: "https://example.com/img2.jpg", alt: "Second image" },
  { url: "https://example.com/img3.jpg", alt: "Third image" },
];

beforeEach(() => {
  useLightbox.setState({ isOpen: false, images: [], currentIndex: 0 });
});

async function openLightbox(images = singleImage, startIndex = 0) {
  await act(() => {
    useLightbox.getState().open(images, startIndex);
  });
}

describe("Lightbox", () => {
  describe("closed state", () => {
    it("renders nothing when closed", () => {
      render(<Lightbox />);
      expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    });
  });

  describe("open state — single image", () => {
    it("renders the image when open", async () => {
      render(<Lightbox />);
      await openLightbox();
      expect(screen.getByAltText("First image")).toBeInTheDocument();
    });

    it("shows no prev/next buttons for a single image", async () => {
      render(<Lightbox />);
      await openLightbox();
      expect(screen.queryByRole("button", { name: "Previous image" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Next image" })).not.toBeInTheDocument();
    });

    it("shows no image counter for a single image", async () => {
      render(<Lightbox />);
      await openLightbox();
      expect(screen.queryByText(/1 \/ 1/)).not.toBeInTheDocument();
    });

    it("renders image with fallback alt when alt is undefined", async () => {
      render(<Lightbox />);
      await act(() => {
        useLightbox.getState().open([{ url: "https://example.com/noalt.jpg" }]);
      });
      expect(screen.getByAltText("Image")).toBeInTheDocument();
    });

    it("clicking the image itself does not close the lightbox (stopPropagation)", async () => {
      render(<Lightbox />);
      await openLightbox();
      const img = screen.getByAltText("First image");
      fireEvent.click(img);
      expect(useLightbox.getState().isOpen).toBe(true);
    });
  });

  describe("open state — multiple images", () => {
    it("shows the image counter", async () => {
      render(<Lightbox />);
      await openLightbox(multiImages, 0);
      expect(screen.getByText("1 / 3")).toBeInTheDocument();
    });

    it("shows next button but not prev on the first image", async () => {
      render(<Lightbox />);
      await openLightbox(multiImages, 0);
      expect(screen.queryByRole("button", { name: "Previous image" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Next image" })).toBeInTheDocument();
    });

    it("shows both prev and next on a middle image", async () => {
      render(<Lightbox />);
      await openLightbox(multiImages, 1);
      expect(screen.getByRole("button", { name: "Previous image" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Next image" })).toBeInTheDocument();
    });

    it("shows prev but not next on the last image", async () => {
      render(<Lightbox />);
      await openLightbox(multiImages, 2);
      expect(screen.getByRole("button", { name: "Previous image" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Next image" })).not.toBeInTheDocument();
    });

    it("renders thumbnail dots", async () => {
      render(<Lightbox />);
      await openLightbox(multiImages, 0);
      expect(screen.getByRole("button", { name: "Go to image 1" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Go to image 2" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Go to image 3" })).toBeInTheDocument();
    });
  });

  describe("close button", () => {
    it("closes the lightbox when close button is clicked", async () => {
      render(<Lightbox />);
      await openLightbox();
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      expect(useLightbox.getState().isOpen).toBe(false);
      expect(screen.queryByAltText("First image")).not.toBeInTheDocument();
    });
  });

  describe("navigation controls", () => {
    it("advances to the next image via next button", async () => {
      render(<Lightbox />);
      await openLightbox(multiImages, 0);
      fireEvent.click(screen.getByRole("button", { name: "Next image" }));
      expect(useLightbox.getState().currentIndex).toBe(1);
      expect(screen.getByText("2 / 3")).toBeInTheDocument();
    });

    it("goes back to the previous image via prev button", async () => {
      render(<Lightbox />);
      await openLightbox(multiImages, 1);
      fireEvent.click(screen.getByRole("button", { name: "Previous image" }));
      expect(useLightbox.getState().currentIndex).toBe(0);
      expect(screen.getByText("1 / 3")).toBeInTheDocument();
    });

    it("jumps to a specific image via thumbnail dot", async () => {
      render(<Lightbox />);
      await openLightbox(multiImages, 0);
      fireEvent.click(screen.getByRole("button", { name: "Go to image 3" }));
      expect(useLightbox.getState().currentIndex).toBe(2);
    });
  });

  describe("keyboard handlers", () => {
    it("closes on Escape key", async () => {
      render(<Lightbox />);
      await openLightbox();
      fireEvent.keyDown(document, { key: "Escape" });
      expect(useLightbox.getState().isOpen).toBe(false);
    });

    it("navigates to next on ArrowRight", async () => {
      render(<Lightbox />);
      await openLightbox(multiImages, 0);
      fireEvent.keyDown(document, { key: "ArrowRight" });
      expect(useLightbox.getState().currentIndex).toBe(1);
    });

    it("navigates to prev on ArrowLeft", async () => {
      render(<Lightbox />);
      await openLightbox(multiImages, 1);
      fireEvent.keyDown(document, { key: "ArrowLeft" });
      expect(useLightbox.getState().currentIndex).toBe(0);
    });

    it("removes the keydown listener when lightbox closes (cleanup runs)", async () => {
      render(<Lightbox />);
      await openLightbox();
      await act(() => {
        useLightbox.getState().close();
      });
      fireEvent.keyDown(document, { key: "ArrowRight" });
      expect(useLightbox.getState().currentIndex).toBe(0);
    });
  });

  describe("backdrop click", () => {
    it("closes when backdrop (container) is clicked directly", async () => {
      render(<Lightbox />);
      await openLightbox();

      const backdrop = document.body.querySelector(
        ".fixed.inset-0.z-50.bg-black\\/95"
      ) as HTMLElement;
      expect(backdrop).not.toBeNull();

      fireEvent.click(backdrop, { bubbles: true, target: backdrop });
      expect(useLightbox.getState().isOpen).toBe(false);
    });
  });

  describe("touch swipe", () => {
    it("swipes left to go to next image", async () => {
      render(<Lightbox />);
      await openLightbox(multiImages, 0);

      const backdrop = document.body.querySelector(
        ".fixed.inset-0.z-50.bg-black\\/95"
      ) as HTMLElement;

      fireEvent.touchStart(backdrop, { touches: [{ clientX: 200 }] });
      fireEvent.touchEnd(backdrop, { changedTouches: [{ clientX: 100 }] });

      expect(useLightbox.getState().currentIndex).toBe(1);
    });

    it("swipes right to go to prev image", async () => {
      render(<Lightbox />);
      await openLightbox(multiImages, 1);

      const backdrop = document.body.querySelector(
        ".fixed.inset-0.z-50.bg-black\\/95"
      ) as HTMLElement;

      fireEvent.touchStart(backdrop, { touches: [{ clientX: 100 }] });
      fireEvent.touchEnd(backdrop, { changedTouches: [{ clientX: 200 }] });

      expect(useLightbox.getState().currentIndex).toBe(0);
    });

    it("ignores swipes below the threshold", async () => {
      render(<Lightbox />);
      await openLightbox(multiImages, 0);

      const backdrop = document.body.querySelector(
        ".fixed.inset-0.z-50.bg-black\\/95"
      ) as HTMLElement;

      fireEvent.touchStart(backdrop, { touches: [{ clientX: 100 }] });
      fireEvent.touchEnd(backdrop, { changedTouches: [{ clientX: 120 }] });

      expect(useLightbox.getState().currentIndex).toBe(0);
    });

    it("ignores touchEnd when no touchStart was recorded", async () => {
      render(<Lightbox />);
      await openLightbox(multiImages, 0);

      const backdrop = document.body.querySelector(
        ".fixed.inset-0.z-50.bg-black\\/95"
      ) as HTMLElement;

      fireEvent.touchEnd(backdrop, { changedTouches: [{ clientX: 100 }] });

      expect(useLightbox.getState().currentIndex).toBe(0);
    });
  });
});
