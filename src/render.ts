const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPE_MAP[char] ?? char);
}

export function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function ratingStars(rating: number): string {
  let html = `<span class="stars" role="img" aria-label="${rating} out of 5 stars">`;
  for (let i = 1; i <= 5; i += 1) {
    const filled = i <= rating;
    html += `<span class="star ${filled ? 'star--filled' : 'star--empty'}" aria-hidden="true">${filled ? '★' : '☆'}</span>`;
  }
  return html + '</span>';
}
