/**
 * DOM rendering helpers. Centralizes HTML escaping so no user-supplied
 * string is ever interpolated into innerHTML without being escaped.
 */

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape a string for safe interpolation into HTML. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPE_MAP[char] ?? char);
}

/** Format an epoch timestamp into a localized date string. */
export function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Render a star rating as accessible star glyphs.
 * `filled` stars are solid; the rest are outline. Returns an HTML string.
 */
export function ratingStars(rating: number): string {
  let html = '<span class="stars" role="img" aria-label="' + rating + ' out of 5 stars">';
  for (let i = 1; i <= 5; i += 1) {
    const filled = i <= rating;
    html +=
      '<span class="star ' +
      (filled ? 'star--filled' : 'star--empty') +
      '" aria-hidden="true">' +
      (filled ? '★' : '☆') +
      '</span>';
  }
  html += '</span>';
  return html;
}
