import type { Accent } from './api-types';

// Accent colours (03 §7). Plum is the default.
export const ACCENTS: Record<Accent, { accent: string; soft: string }> = {
  black: { accent: '#161616', soft: '#EEEEEA' },
  sage: { accent: '#55705A', soft: '#E7EDE6' },
  blue: { accent: '#4A6683', soft: '#E5EAF0' },
  clay: { accent: '#9A5A3B', soft: '#F3E8E1' },
  plum: { accent: '#6A4566', soft: '#EFE7EE' },
};

export function applyAccent(accent: Accent) {
  const colours = ACCENTS[accent] ?? ACCENTS.plum;
  const root = document.documentElement.style;
  root.setProperty('--accent', colours.accent);
  root.setProperty('--accent-soft', colours.soft);
}
