"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { useLanguageStore } from "@/store/useLanguageStore";

const CONSENT_KEY = "ll_cookie_consent";

type ConsentChoice = "all" | "essential";

export function CookieConsent() {
  const language = useLanguageStore((state) => state.language);
  const reducedMotion = usePrefersReducedMotion();
  const [visible, setVisible] = useState(false);
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      try {
        await useLanguageStore.persist.rehydrate();
      } catch (error) {
        console.error("Unable to restore the saved language preference.", error);
      }

      if (!active) return;

      try {
        const consent = window.localStorage.getItem(CONSENT_KEY);
        setVisible(consent !== "all" && consent !== "essential");
      } catch (error) {
        console.error("Unable to read cookie consent from local storage.", error);
        setStorageError(true);
        setVisible(true);
      }
    };

    void initialize();
    return () => {
      active = false;
    };
  }, []);

  const saveConsent = (choice: ConsentChoice) => {
    try {
      window.localStorage.setItem(CONSENT_KEY, choice);
      setStorageError(false);
      setVisible(false);
    } catch (error) {
      console.error("Unable to save cookie consent to local storage.", error);
      setStorageError(true);
    }
  };

  const isBengali = language === "bn";

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          aria-label={isBengali ? "কুকি সম্মতি" : "Cookie consent"}
          aria-live="polite"
          initial={{ opacity: 0, y: reducedMotion ? 0 : 32 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reducedMotion ? 0 : 32 }}
          transition={{ duration: reducedMotion ? 0.15 : 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-4 bottom-4 z-[60] mx-auto max-w-3xl rounded-xl border p-4 text-[#F9FAFB] shadow-[0_18px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur-md sm:bottom-6 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-5"
          style={{
            background: "rgba(11,18,36,0.95)",
            borderColor: "rgba(212,175,55,0.15)",
          }}
        >
          <div className="min-w-0">
            <p className="text-sm leading-relaxed text-[#F9FAFB]/90">
              {isBengali ? (
                <>
                  আমরা আপনার অভিজ্ঞতা উন্নত করতে কুকিজ ব্যবহার করি। চালিয়ে গেলে আপনি আমাদের{" "}
                  <Link
                    href="/privacy"
                    className="font-medium text-[#D4AF37] underline underline-offset-4 hover:text-[#F9FAFB] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4AF37]"
                  >
                    গোপনীয়তা নীতি
                  </Link>
                  তে সম্মত হচ্ছেন।
                </>
              ) : (
                <>
                  We use cookies to improve your experience. By continuing, you agree to our{" "}
                  <Link
                    href="/privacy"
                    className="font-medium text-[#D4AF37] underline underline-offset-4 hover:text-[#F9FAFB] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4AF37]"
                  >
                    Privacy Policy
                  </Link>
                  .
                </>
              )}
            </p>
            {storageError && (
              <p role="alert" className="mt-2 text-xs text-[#F9FAFB]/80">
                {isBengali
                  ? "আপনার পছন্দ সংরক্ষণ করা যায়নি। ব্রাউজার স্টোরেজ চালু করে আবার চেষ্টা করুন।"
                  : "Your choice could not be saved. Please enable browser storage and try again."}
              </p>
            )}
          </div>

          <div className="mt-4 flex shrink-0 flex-col gap-2 sm:mt-0 sm:flex-row">
            <button
              type="button"
              onClick={() => saveConsent("all")}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#D4AF37] px-5 text-sm font-semibold text-[#050816] transition-colors hover:bg-[#e2c45b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4AF37]"
            >
              {isBengali ? "সব গ্রহণ করুন" : "Accept All"}
            </button>
            <button
              type="button"
              onClick={() => saveConsent("essential")}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#D4AF37]/40 bg-transparent px-5 text-sm font-semibold text-[#F9FAFB] transition-colors hover:border-[#D4AF37] hover:text-[#D4AF37] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4AF37]"
            >
              {isBengali ? "শুধু প্রয়োজনীয়" : "Essential Only"}
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
