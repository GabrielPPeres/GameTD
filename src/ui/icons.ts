/** Ícones SVG inline (sem dependências, nítidos em qualquer DPI). */
const svg = (body: string, vb = '0 0 24 24') =>
  `<svg viewBox="${vb}" width="1em" height="1em" aria-hidden="true">${body}</svg>`;

export const ICON = {
  heart: svg('<path fill="#ff4757" stroke="#8e1f20" stroke-width="1.5" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.2 0 3.6 1.2 4.3 2.4.7-1.2 2.1-2.4 4.3-2.4 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/>'),
  coin: svg('<circle cx="12" cy="12" r="9.5" fill="#feca57" stroke="#b8860b" stroke-width="2"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="#e1a32a" stroke-width="1.6"/><path d="M12 8.5v7" stroke="#b8860b" stroke-width="2" stroke-linecap="round"/>'),
  flag: svg('<path d="M5 21V4" stroke="#dfe6e9" stroke-width="2.2" stroke-linecap="round"/><path fill="#ee5253" d="M6 4h12l-3 4 3 4H6z"/>'),
  pause: svg('<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/>'),
  play: svg('<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>'),
  fast: svg('<path d="M3 5v14l9-7zM12 5v14l9-7z" fill="currentColor"/>'),
  gear: svg('<path fill="currentColor" d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.7 7.7 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.7 7.7 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1c.5.4 1.1.7 1.7 1l.4 2.6h4l.4-2.6c.6-.3 1.2-.6 1.7-1l2.5 1 2-3.5zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/>'),
  auto: svg('<path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'),
  skull: svg('<path fill="currentColor" d="M12 2C7 2 3.5 5.6 3.5 10.2c0 2.7 1.2 4.6 3 5.8V19a1 1 0 0 0 1 1h1v-2h1.5v2h4v-2H15.5v2h1a1 1 0 0 0 1-1v-3c1.8-1.2 3-3.1 3-5.8C20.5 5.6 17 2 12 2zM8.5 13a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm7 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/>'),
  eye: svg('<path fill="none" stroke="currentColor" stroke-width="2" d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3" fill="currentColor"/>'),
  star: svg('<path fill="currentColor" d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/>'),
} as const;
