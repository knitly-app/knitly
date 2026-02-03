import { create } from "zustand";

interface LightboxImage {
  url: string;
  alt?: string;
}

interface LightboxState {
  isOpen: boolean;
  images: LightboxImage[];
  currentIndex: number;
  open: (images: LightboxImage[], startIndex?: number) => void;
  close: () => void;
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
}

export const useLightbox = create<LightboxState>((set, get) => ({
  isOpen: false,
  images: [],
  currentIndex: 0,

  open: (images, startIndex = 0) => {
    set({ isOpen: true, images, currentIndex: startIndex });
  },

  close: () => {
    set({ isOpen: false });
  },

  next: () => {
    const { currentIndex, images } = get();
    if (currentIndex < images.length - 1) {
      set({ currentIndex: currentIndex + 1 });
    }
  },

  prev: () => {
    const { currentIndex } = get();
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1 });
    }
  },

  goTo: (index) => {
    const { images } = get();
    if (index >= 0 && index < images.length) {
      set({ currentIndex: index });
    }
  },
}));
