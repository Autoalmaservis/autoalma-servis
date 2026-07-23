import { compress } from 'lzma1';
import QRCode from 'qrcode';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

async function isAuthenticated(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return false;
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: { user } } = await sb.auth.getUser(token);
  return !!user;
}

// CRC32 lookup table (IEEE 802.3 polynomial)
const CRC32_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (const b of bytes) crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ b) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// PAY by square base32hex alphabet (SBA spec)
const B32_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUV';

function base32encode(input) {
  let buf = 0, bits = 0, out = '';
  for (const byte of input) {
    buf = (buf << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += B32_CHARS[(buf >> bits) & 0x1F];
    }
  }
  if (bits > 0) out += B32_CHARS[(buf << (5 - bits)) & 0x1F];
  return out;
}

/**
 * PAY by square v1.0.0 (SBA 2013) — priamy encode bez beneficiary bloku.
 * Verzia 1.0.0 = version nibble 0x00 vo header, VÚB ju plne podporuje.
 */
function encodePayBySquare100(iban, amount, vs, note, beneficiaryName) {
  const tab = '\t';
  // Tab-separated fields per PAY by square v1.0.0 spec (Table 15)
  const fields = [
    '',            // invoiceId
    '1',           // paymentsCount
    '1',           // type: PaymentOrder
    amount,        // amount (decimal, "." separator)
    'EUR',         // currencyCode
    '',            // paymentDueDate
    vs || '',      // variableSymbol (max 10 digits)
    '',            // constantSymbol
    '',            // specificSymbol
    '',            // originatorsReferenceInformation
    note || '',    // paymentNote
    '1',           // bankAccountsCount
    iban,          // IBAN
    '',            // BIC
    beneficiaryName || '',  // beneficiaryName
    '',            // beneficiaryAddressLine1
    '',            // beneficiaryAddressLine2
    '0',           // standingOrderExt
    '0',           // directDebitExt
  ];
  const payload = fields.join(tab);
  const payloadBytes = new TextEncoder().encode(payload);

  // Prepend 4-byte CRC32 (little-endian)
  const checksum = crc32(payloadBytes);
  const checksumBytes = new Uint8Array(4);
  new DataView(checksumBytes.buffer).setUint32(0, checksum, true);
  const withCrc = new Uint8Array(checksumBytes.length + payloadBytes.length);
  withCrc.set(checksumBytes);
  withCrc.set(payloadBytes, 4);

  // LZMA compress (lzma1 default = dict size 2^17, compatible with by square)
  const compressed = compress(withCrc);
  const lzmaBody = compressed.subarray(13); // skip 13-byte LZMA header

  // 2-byte by square header: [BySqType=0 | Version=0] [DocType=0 | Reserved=0]
  // Version 0x00 = PAY by square v1.0.0
  const header = new Uint8Array([0x00, 0x00]);

  // 2-byte payload length (uncompressed, little-endian)
  const lenBytes = new Uint8Array(2);
  new DataView(lenBytes.buffer).setUint16(0, withCrc.byteLength, true);

  const output = new Uint8Array(header.length + lenBytes.length + lzmaBody.length);
  output.set(header);
  output.set(lenBytes, 2);
  output.set(lzmaBody, 4);

  return base32encode(output);
}

export async function POST(req) {
  if (!await isAuthenticated(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { iban, amount, variableSymbol, beneficiaryName, paymentNote } = await req.json();

    if (!iban || !amount) {
      return NextResponse.json({ error: 'Chýba IBAN alebo suma' }, { status: 400 });
    }

    const cleanIban = iban.replace(/\s/g, '').toUpperCase();
    const parsedAmount = Math.round(parseFloat(amount) * 100) / 100;

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'Neplatná suma' }, { status: 400 });
    }

    const cleanVS = variableSymbol ? String(variableSymbol).replace(/\D/g, '').substring(0, 10) : '';
    const cleanNote = paymentNote ? paymentNote.normalize('NFD').replace(/[̀-ͯ]/g, '') : '';

    const cleanBeneficiary = beneficiaryName ? beneficiaryName.normalize('NFD').replace(/[̀-ͯ]/g, '').substring(0, 70) : '';

    const bySquareStr = encodePayBySquare100(cleanIban, parsedAmount.toString(), cleanVS, cleanNote, cleanBeneficiary);

    const pngDataUrl = await QRCode.toDataURL(bySquareStr, {
      errorCorrectionLevel: 'L',
      mode: 'byte',
      width: 300,
      margin: 2,
    });

    return NextResponse.json({ qrDataUrl: pngDataUrl });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
