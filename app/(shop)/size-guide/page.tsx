import Link from "next/link";

export const metadata = { title: "Size Guide | MUKRA" };

export default function SizeGuidePage() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-bold">Size guide</h1>
      <p className="mt-6 leading-8 text-muted-foreground">
        Check the available sizes on each product page. Age ranges are a guide, not a guaranteed
        fit. Measure your child&apos;s height, chest, waist, and hip, then compare any measurements
        listed for the item.
      </p>
      <p className="mt-4 leading-8 text-muted-foreground">
        If the item has no measurement chart, ask our team before ordering. Include the product name
        and your child&apos;s measurements so we can help.
      </p>
      <Link href="/contact" className="mt-8 inline-block text-primary underline underline-offset-4">
        Ask for sizing help
      </Link>
    </section>
  );
}
