import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Language = "en" | "bn";

interface LanguageState {
  language: Language;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
}

const initialState: Language = "en";

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: initialState,

      toggleLanguage: () =>
        set((state) => ({
          language: state.language === "en" ? "bn" : "en",
        })),

      setLanguage: (lang) => set({ language: lang }),
    }),
    {
      name: "little-luxe-language",
      partialize: (state) => ({ language: state.language }),
      skipHydration: true,
    },
  ),
);
