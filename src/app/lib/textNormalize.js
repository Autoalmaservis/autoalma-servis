// Normalizácia údajov o zákazníkovi — používa sa v UI aj v API routes,
// aby "ján novák", "JÁN NOVÁK" a "Ján Novák" skončili v databáze rovnako.

// Prvé písmeno každého slova (aj po pomlčke) veľké, zvyšok ponechaný.
// "ján novák" → "Ján Novák", "anna-mária" → "Anna-Mária", "McDonald" ostáva.
// Celé slovo VEĽKÝMI sa prepíše na tvar s veľkým začiatkom ("NOVÁK" → "Novák").
export function capitalizeName(value) {
  return (value || '')
    .toString()
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(word => word
      .split('-')
      .map(part => {
        if (!part) return part;
        const rest = part.slice(1);
        const isAllCaps = part.length > 1 && part === part.toUpperCase();
        return part.charAt(0).toUpperCase() + (isAllCaps ? rest.toLowerCase() : rest);
      })
      .join('-'))
    .join(' ');
}

export function normalizeEmail(value) {
  return (value || '').toString().trim().toLowerCase();
}

export function normalizePhone(value) {
  return (value || '').toString().trim().replace(/\s+/g, ' ');
}
