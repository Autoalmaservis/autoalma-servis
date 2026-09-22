// Jednoduchý strop požiadaviek na IP pre verejné API routes (bez prihlásenia).
// Na Vercel beží per serverless inštancia, takže to nie je plnohodnotná ochrana —
// zastaví ale bežný spam a skripty, ktoré by pálili SMTP / AI kredit.
// Rovnaký vzor ako v /api/public-booking.

const BUCKETS = new Map();

export function getClientIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null
  );
}

/**
 * @param {string} scope   názov route (aby mala každá vlastný limit)
 * @param {string|null} ip
 * @param {number} max     max požiadaviek v okne
 * @param {number} windowMs dĺžka okna
 * @returns {boolean} true = prekročené
 */
export function isRateLimited(scope, ip, max, windowMs) {
  if (!ip) return false;
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const hits = (BUCKETS.get(key) || []).filter((t) => now - t < windowMs);
  hits.push(now);
  BUCKETS.set(key, hits);
  if (BUCKETS.size > 5000) BUCKETS.clear();
  return hits.length > max;
}

export function rateLimitResponse() {
  return Response.json(
    { error: 'Príliš veľa žiadostí. Skúste to prosím o chvíľu.' },
    { status: 429 }
  );
}
