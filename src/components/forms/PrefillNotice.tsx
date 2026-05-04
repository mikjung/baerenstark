'use client';

/**
 * PrefillNotice — Dezenter Hinweis über vorausgefüllten Form-Sections
 * (IT12-S08, ux-spec-iteration-12.md §1.4 + §3.8.3).
 *
 * Kommuniziert: „Diese Daten kommen aus deinem Profil und können angepasst
 * werden, ohne das Profil zu ändern."
 */

import Link from 'next/link';

interface PrefillNoticeProps {
  /** `'all'` = alle Felder gefüllt, `'partial'` = nur einige Felder gefüllt. */
  variant?: 'all' | 'partial';
  profileLink?: string;
  className?: string;
}

const COPY: Record<'all' | 'partial', string> = {
  all: 'Aus Ihrem Profil übernommen. Sie können die Angaben für diese Anfrage anpassen — Ihr Profil wird dadurch nicht verändert.',
  partial:
    'Einige Daten aus Ihrem Profil übernommen. Bitte ergänzen Sie die fehlenden Felder. Ihr Profil wird dadurch nicht verändert.',
};

export function PrefillNotice({
  variant = 'all',
  profileLink = '/konto/profil',
  className = '',
}: PrefillNoticeProps) {
  return (
    <div
      role="note"
      className={[
        'flex items-start gap-2 rounded-md bg-baerenstark-cream/60 px-3 py-2',
        'text-sm text-baerenstark-bark/70',
        className,
      ].join(' ')}
    >
      <span aria-hidden="true" className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-baerenstark-wood/20 text-xs">
        ℹ
      </span>
      <span>
        {COPY[variant]}{' '}
        <Link
          href={profileLink}
          className="font-medium text-baerenstark-wood underline-offset-2 hover:underline"
        >
          Profil ansehen
        </Link>
      </span>
    </div>
  );
}
