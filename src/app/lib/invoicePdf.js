// Shared PDF builder — used in faktury list (bulk export) and invoice detail (email)

const sk = s => (s || '')
  .replace(/[áÁ]/g, m => m === 'á' ? 'a' : 'A')
  .replace(/[čČ]/g, m => m === 'č' ? 'c' : 'C')
  .replace(/[ďĎ]/g, m => m === 'ď' ? 'd' : 'D')
  .replace(/[éÉ]/g, m => m === 'é' ? 'e' : 'E')
  .replace(/[íÍ]/g, m => m === 'í' ? 'i' : 'I')
  .replace(/[ĺĹ]/g, m => m === 'ĺ' ? 'l' : 'L')
  .replace(/[ľĽ]/g, m => m === 'ľ' ? 'l' : 'L')
  .replace(/[ňŇ]/g, m => m === 'ň' ? 'n' : 'N')
  .replace(/[óÓ]/g, m => m === 'ó' ? 'o' : 'O')
  .replace(/[ôÔ]/g, m => m === 'ô' ? 'o' : 'O')
  .replace(/[ŕŔ]/g, m => m === 'ŕ' ? 'r' : 'R')
  .replace(/[šŠ]/g, m => m === 'š' ? 's' : 'S')
  .replace(/[ťŤ]/g, m => m === 'ť' ? 't' : 'T')
  .replace(/[úÚ]/g, m => m === 'ú' ? 'u' : 'U')
  .replace(/[ýÝ]/g, m => m === 'ý' ? 'y' : 'Y')
  .replace(/[žŽ]/g, m => m === 'ž' ? 'z' : 'Z');

export { sk };

export function buildInvoicePDF(jsPDF, autoTable, inv, company) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  const W = 210, L = 15, R = 195, UW = 180;
  const RED = [220, 38, 38], BLACK = [0, 0, 0], GRAY = [120, 120, 120];
  let y = 18;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...RED);
  doc.text(sk(company.name || 'AutoAlma Servis'), L, y);

  doc.setTextColor(...BLACK);
  doc.setFontSize(9);
  doc.text(inv.is_official ? 'FAKTURA' : 'SERVISNY ZAZNAM', R, y, { align: 'right' });

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text(sk(`${company.address || ''}, ${company.zip || ''} ${company.city || ''}`.trim()), L, y);
  doc.text(sk(`ICO: ${company.ico || '---'} | DIC: ${company.dic || '---'}`), L, y + 4);
  if (company.phone || company.email) {
    doc.text(sk(`${company.phone || ''}${company.phone && company.email ? ' | ' : ''}${company.email || ''}`), L, y + 8);
  }

  doc.setTextColor(...BLACK);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(String(inv.invoice_number), R, y + 3, { align: 'right' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Datum: ${new Date(inv.created_at).toLocaleDateString('sk-SK')}`, R, y + 9, { align: 'right' });

  y += 16;

  doc.setDrawColor(...RED);
  doc.setLineWidth(0.8);
  doc.line(L, y, R, y);
  y += 7;

  const boxH = 27, boxW = (UW - 6) / 2;

  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.3);
  doc.rect(L, y, boxW, boxH);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GRAY);
  doc.text('ODBERATEL:', L + 3, y + 5);
  doc.setTextColor(...BLACK);
  doc.setFontSize(9.5);
  doc.text(sk((inv.company_details?.company_name || inv.customer_name || '').substring(0, 32)), L + 3, y + 11);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  if (inv.company_details?.address) doc.text(sk(inv.company_details.address), L + 3, y + 17);
  const custCity = sk(`${inv.company_details?.zip || ''} ${inv.company_details?.city || ''}`.trim());
  if (custCity) doc.text(custCity, L + 3, y + 21);
  if (inv.company_details?.ico) {
    doc.setFontSize(7);
    doc.text(`ICO: ${inv.company_details.ico}${inv.company_details?.dic ? ' | DIC: ' + inv.company_details.dic : ''}`, L + 3, y + 26);
  }

  const bx2 = L + boxW + 6;
  doc.rect(bx2, y, boxW, boxH);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GRAY);
  doc.text('VOZIDLO:', bx2 + 3, y + 5);
  doc.setTextColor(...BLACK);
  const plate = sk(inv.car_details?.plate || inv.car_details?.plate_number || '---');
  const brand = sk(inv.car_details?.brand || inv.car_details?.brand_model || '');
  doc.setFontSize(11);
  doc.text(plate, bx2 + 3, y + 11);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  if (brand) doc.text(brand, bx2 + 3, y + 17);
  doc.setFontSize(7);
  if (inv.car_details?.vin) doc.text(`VIN: ${sk(inv.car_details.vin)}`, bx2 + 3, y + 22);
  const km = inv.car_details?.mileage;
  if (km != null && km !== '') doc.text(`KM: ${Number(km).toLocaleString('sk-SK')} km`, bx2 + 3, y + 26);

  y += boxH + 8;

  const rows = (inv.items_json || []).map(item => [
    sk(item.name || ''),
    `${item.quantity} ${sk(item.unit || '')}`,
    `${parseFloat(item.unit_price || 0).toFixed(2)} EUR`,
    `${(parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0)).toFixed(2)} EUR`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Polozka / Ukon', 'Mnozstvo', 'Cena / J.', 'Spolu bez DPH']],
    body: rows,
    margin: { left: L, right: W - R },
    styles: { fontSize: 8, font: 'helvetica', textColor: BLACK, cellPadding: 2.5 },
    headStyles: { fillColor: [244, 244, 245], textColor: BLACK, fontStyle: 'bold', fontSize: 7.5, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 93 },
      1: { cellWidth: 27, halign: 'center' },
      2: { cellWidth: 28, halign: 'right' },
      3: { cellWidth: 30, halign: 'right' },
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    theme: 'striped',
  });

  y = doc.lastAutoTable.finalY + 6;

  const sub = typeof inv.subtotal_amount === 'number' ? inv.subtotal_amount : inv.total_amount / 1.23;
  const tax = typeof inv.tax_amount === 'number' ? inv.tax_amount : inv.total_amount - sub;
  const totX = R - 62;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BLACK);
  doc.text('Zaklad dane:', totX, y);
  doc.text(`${sub.toFixed(2)} EUR`, R, y, { align: 'right' });
  y += 5;
  doc.text('DPH (23%):', totX, y);
  doc.text(`${tax.toFixed(2)} EUR`, R, y, { align: 'right' });
  y += 2;
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.3);
  doc.line(totX - 5, y, R, y);
  y += 5;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...RED);
  doc.text('CELKOM:', totX, y);
  doc.setTextColor(...BLACK);
  doc.text(`${inv.total_amount.toFixed(2)} EUR`, R, y, { align: 'right' });
  y += 10;

  if (company.bank) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...RED);
    doc.text('PLATOBNE UDAJE:', L, y);
    y += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BLACK);
    doc.text(`IBAN: ${company.bank}`, L, y);
    y += 4;
    doc.text(`VS: ${String(inv.invoice_number).replace(/\D/g, '')}`, L, y);
    y += 4;
    const due = inv.payment_info?.due_date
      ? new Date(inv.payment_info.due_date).toLocaleDateString('sk-SK')
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('sk-SK');
    doc.text(`Splatnost: ${due}`, L, y);
    y += 10;
  }

  const sigY = Math.max(y + 5, 262);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BLACK);
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.3);
  doc.line(L, sigY, L + 70, sigY);
  doc.text('PODPIS PREVZAL (ZAKAZNIK)', L, sigY + 4);
  doc.line(R - 70, sigY, R, sigY);
  doc.text('PECIATKA A PODPIS SERVISU', R - 70, sigY + 4);

  return doc;
}
