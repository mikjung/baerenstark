/**
 * Hardcoded Kontaktdaten von Bärenstark Hausservice.
 * Single Source of Truth für UI-Anzeige.
 *
 * Note (IT11): `phoneDisplay` enthält ein non-breaking-space (U+00A0)
 * zwischen Vorwahl und Rufnummer (Spec US-IT11 / Microcopy + A11y), damit der
 * Browser die Nummer in keinem Layout in zwei Zeilen umbricht.
 * `phoneTel` ist E.164-formatiert für `tel:`-Links.
 */
export const CONTACT = {
  ownerName: 'Tom Siefert',
  phoneDisplay: '0157 74787512',
  phoneTel: '+4915774787512', // E.164 für tel:-Link
  email: 'hausservice-baerenstark@outlook.com',
  region: 'Darmstadt und Umgebung',
} as const;
