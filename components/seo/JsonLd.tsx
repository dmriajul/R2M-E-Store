/**
 * Renders a JSON-LD block.
 *
 * Server component on purpose: structured data should be in the initial HTML,
 * and JSON.stringify of a static object is safe to inline (no user input ever
 * reaches these builders).
 */
export function JsonLd({ data, id }: { data: unknown; id?: string }) {
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
