/**
 * IT12 / US-IT12-15 — DSGVO-Pflicht-Footer für Marketing-Mails.
 *
 * Plain-Text-only (Mail-Format-Vorgabe IT12). Wird vom Server an JEDE
 * Marketing-Mail (auch Test-Send) angehängt — Frontend kann den Footer
 * NICHT überschreiben.
 *
 * Variante 3 (UWG §7 Abs. 3 / Bestandskunden-Sonderregel):
 *   - Kein Opt-In-Modell, aber
 *   - Pflicht-Hinweis im Footer,
 *   - Pflicht-Unsubscribe-Link (HMAC-Token, stateless),
 *   - Impressums-Link.
 *
 * Architektur-Verweis: ARCHITECTURE_IT12.md §R.5.
 */

const FOOTER_TEMPLATE = `--
Sie erhalten diese E-Mail, weil Sie Kunde bei Bärenstark Hausservice
sind. Wenn Sie keine weiteren Marketing-Mails von uns erhalten möchten,
melden Sie sich hier ab: {unsubscribeUrl}

Bärenstark Hausservice · Tom Siefert · Darmstadt · Impressum: {baseUrl}/impressum`;

export interface FooterContext {
  unsubscribeUrl: string;
  baseUrl: string;
}

/**
 * Hängt den DSGVO-Footer an einen Plain-Text-Body an. Zwei Leerzeilen
 * Trennung damit der Footer optisch abgesetzt bleibt.
 */
export function appendMarketingFooter(body: string, ctx: FooterContext): string {
  const footer = FOOTER_TEMPLATE.replace('{unsubscribeUrl}', ctx.unsubscribeUrl).replace(
    '{baseUrl}',
    ctx.baseUrl,
  );
  // Zwei Leerzeilen vor dem `--`-Trenner, sodass auch bei Body ohne
  // abschließendes \n der Footer sauber abgesetzt steht.
  const trimmed = body.replace(/\s+$/u, '');
  return `${trimmed}\n\n${footer}\n`;
}

/**
 * Substituiert `{{firstName}}` (und nur dieses) im Body. Andere `{{…}}`-
 * Tokens bleiben bewusst unverändert — wir wollen kein Templating-DSL,
 * das bei Fehlern stillschweigend Lücken lässt.
 */
export function applyMarketingTemplate(body: string, vars: { firstName?: string }): string {
  const firstName = (vars.firstName ?? '').trim();
  // Wenn firstName fehlt, fallback auf neutrale Anrede.
  const safe = firstName.length > 0 ? firstName : 'liebe Kundin / lieber Kunde';
  return body.replace(/\{\{\s*firstName\s*\}\}/g, safe);
}

export const MARKETING_FOOTER_TEMPLATE = FOOTER_TEMPLATE;
