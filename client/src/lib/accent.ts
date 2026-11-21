import type { Accent } from './api-types';

// Accent colours (03 §7), in the order Settings shows them. Plum is the default.
export const ACCENTS: Record<Accent, { name: string; accent: string; soft: string }> = {
  black: { name: 'Black', accent: '#161616', soft: '#EEEEEA' },
  sage: { name: 'Sage', accent: '#55705A', soft: '#E7EDE6' },
  blue: { name: 'Dusty blue', accent: '#4A6683', soft: '#E5EAF0' },
  clay: { name: 'Clay', accent: '#9A5A3B', soft: '#F3E8E1' },
  plum: { name: 'Plum', accent: '#6A4566', soft: '#EFE7EE' },
};

// Everything coloured with the accent reads these two CSS variables, so this recolours the app at once.
// The browser's toolbar colour (theme-color) follows too.
export function applyAccent(accent: Accent) {
  const colours = ACCENTS[accent] ?? ACCENTS.plum;
  const root = document.documentElement.style;
  root.setProperty('--accent', colours.accent);
  root.setProperty('--accent-soft', colours.soft);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colours.accent);
}
