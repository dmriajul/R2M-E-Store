import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PageTransition } from "@/components/providers/PageTransition";
import { BackToTop } from "@/components/ui/BackToTop";

/**
 * Storefront chrome. Everything shoppers browse — home, shop, product,
 * checkout — lives inside this group and gets the navbar + footer.
 */
export default function ShopGroupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Navbar />
      <main id="main-content" className="relative z-10 flex-1">
        <PageTransition>{children}</PageTransition>
      </main>
      <Footer />
      <BackToTop />
    </>
  );
}
