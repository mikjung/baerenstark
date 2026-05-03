/**
 * JsonLd — `<script type="application/ld+json">`-Wrapper für strukturierte
 * Daten (US-IT6-04).
 *
 * Server-Component. Wird von Pages und Layout aufgerufen.
 */

interface Props {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
}

export function JsonLd({ data }: Props) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify ist sicher: kein User-Input, nur Backend-Daten +
      // statische Struktur. Wir injizieren keine HTML-Tags.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
