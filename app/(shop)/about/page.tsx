import Link from "next/link";

export const metadata = { title: "About MUKRA" };

export default function AboutPage() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs tracking-[0.3em] text-primary uppercase">Where Magic Meets Style</p>
      <h1 className="mt-4 text-4xl font-bold">About MUKRA</h1>
      <p className="mt-6 leading-8 text-muted-foreground">
        MUKRA brings premium kids fashion to Bangladesh. Explore clothing and accessories for your
        little ones, with sizes and product details to help you choose.
      </p>
      <Link href="/shop" className="mt-8 inline-block text-primary underline underline-offset-4">
        Explore the collection
      </Link>
    </section>
  );
}
