import { requireAdmin } from '@/app/lib/apiAuth';
import { posliUvitaciEmail } from '@/app/lib/welcomeEmail';

// Iba admin — e-mail z firemnej adresy s vlastným "nastavte si heslo" odkazom = phishing,
// keby ho mohol volať ktokoľvek prihlásený (audit 2026-09). Volá kalendár, klienti, príjem.
// Zákazník, ktorý sa registruje sám, ide cez /api/registracia-dokoncit.
export async function POST(request) {
  if (!await requireAdmin(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { email, name, createdByAdmin, setPasswordUrl, booking } = body;
  if (!email) return Response.json({ error: 'Chýba e-mail' }, { status: 400 });

  const vysledok = await posliUvitaciEmail({ email, name, createdByAdmin, setPasswordUrl, booking });
  return Response.json(vysledok);
}
