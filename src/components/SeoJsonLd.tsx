/** Server-only JSON-LD script tags (safe: data is built from app code, not user input). */
export default function SeoJsonLd({ data }: { data: object[] }) {
  return (
    <>
      {data.map((obj, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(obj) }}
        />
      ))}
    </>
  );
}
