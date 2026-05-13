import { encode, PaymentOptions, CurrencyCode } from 'bysquare/pay';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { iban, amount, variableSymbol, beneficiaryName, paymentNote } = await req.json();

    if (!iban || !amount || !beneficiaryName) {
      return NextResponse.json({ error: 'Chýbajú povinné polia' }, { status: 400 });
    }

    const cleanIban = iban.replace(/\s/g, '').toUpperCase();
    const parsedAmount = parseFloat(amount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'Neplatná suma' }, { status: 400 });
    }

    const qrValue = encode({
      payments: [{
        type: PaymentOptions.PaymentOrder,
        amount: parsedAmount,
        currencyCode: CurrencyCode.EUR,
        variableSymbol: variableSymbol ? String(variableSymbol).replace(/\D/g, '').substring(0, 10) : undefined,
        paymentNote: paymentNote || undefined,
        beneficiary: { name: beneficiaryName.substring(0, 70) },
        bankAccounts: [{ iban: cleanIban }],
      }],
    });

    return NextResponse.json({ qrValue });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
