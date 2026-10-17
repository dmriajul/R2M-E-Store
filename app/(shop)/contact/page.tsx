import Link from "next/link";
import { STORE } from "@/lib/config";

export const metadata = { title: "Contact MUKRA" };

export default function ContactPage() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-bold">Contact MUKRA</h1>
      <p className="mt-6 leading-8 text-muted-foreground">
        Need help with sizing, delivery, or an order? Email our team and include your order number
        if you have one. Never send your password or payment PIN.
      </p>
      <a
        href={`mailto:${STORE.supportEmail}`}
        className="mt-6 inline-block text-primary underline underline-offset-4"
      >
        {STORE.supportEmail}
      </a>
      <div className="mt-8 flex flex-wrap gap-6 text-primary">
        <Link href="/faq">FAQ</Link>
        <Link href="/dashboard/orders">My orders</Link>
        <Link href="/returns">Returns &amp; exchanges</Link>
      </div>
    </section>
  );
}
