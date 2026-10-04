import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

interface ProductPageProps {
  /** Next 15 passes route params as a promise. */
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { id } = await params;

  return {
    title: "Product",
    description: `Product detail scaffold for “${id}”.`,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;

  return (
    <PagePlaceholder
      eyebrow="Product detail"
      title="Product"
      description={`Gallery, variant picker and add-to-bag land next. This route resolves the dynamic segment “${id}” and will hydrate from the real data source.`}
      path={`app/(shop)/product/[id]/page.tsx · /product/${id}`}
    />
  );
}
