// Peppol BIS Billing 3.0 (UBL BIS3) XML generator
// Standard: urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0

const UNIT_CODES = {
  'hod': 'HUR', 'h': 'HUR',
  'ks': 'C62',
  'l': 'LTR', 'L': 'LTR', 'ltr': 'LTR',
  'km': 'KMT',
  'set': 'SET',
  'm': 'MTR',
  'kg': 'KGM',
  'bal': 'PK',
};

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(iso) {
  if (!iso) return new Date().toISOString().split('T')[0];
  return new Date(iso).toISOString().split('T')[0];
}

function fmtAmt(n) {
  return Number(n ?? 0).toFixed(2);
}

function cleanDic(dic) {
  return String(dic ?? '').replace(/^SK/i, '');
}

function paymentCode(method) {
  if (!method) return '30';
  const m = method.toLowerCase();
  if (m.includes('hotovos')) return '10';
  if (m.includes('kart')) return '48';
  return '30';
}

function unitCode(unit) {
  return UNIT_CODES[unit] || 'C62';
}

/**
 * Builds Peppol BIS 3.0 UBL XML from an invoice record.
 * @param {object} invoice - row from the `invoices` table
 * @param {object} [supplierAddr] - { address, zip, city } from business_settings (optional, used for structured address)
 * @returns {string} UBL XML string
 */
export function buildUblXml(invoice, supplierAddr) {
  const s = invoice.supplier_details || {};
  const c = invoice.company_details || {};
  const p = invoice.payment_info || {};
  const noVat = p.no_vat === true;

  const taxCat = noVat ? 'Z' : 'S';
  const taxPct = noVat ? '0' : '23';

  const supplierDic = cleanDic(s.dic || '2023194316');
  const customerDic = cleanDic(c.dic || '');

  const supplierStreet = supplierAddr?.address || '';
  const supplierZip   = supplierAddr?.zip    || '';
  const supplierCity  = supplierAddr?.city   || '';

  const lineItems = (invoice.items_json || []).filter(
    item => Number(item.quantity ?? 0) !== 0 && Number(item.unit_price ?? 0) !== 0
  );

  const taxableAmount = fmtAmt(invoice.subtotal_amount);
  const taxAmount     = fmtAmt(invoice.tax_amount);
  const totalAmount   = fmtAmt(invoice.total_amount);

  const carNote = invoice.car_details
    ? `${invoice.car_details.plate || ''} ${invoice.car_details.brand || ''}`.trim()
    : '';

  const lines = lineItems.map((item, idx) => {
    const lineAmt = fmtAmt(Number(item.quantity) * Number(item.unit_price));
    return `  <cac:InvoiceLine>
    <cbc:ID>${idx + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${unitCode(item.unit)}">${Number(item.quantity)}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">${lineAmt}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${esc(item.name)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${taxCat}</cbc:ID>
        <cbc:Percent>${taxPct}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="EUR">${fmtAmt(item.unit_price)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${esc(invoice.invoice_number)}</cbc:ID>
  <cbc:IssueDate>${fmtDate(p.issue_date || invoice.created_at)}</cbc:IssueDate>
  <cbc:DueDate>${fmtDate(p.due_date)}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>${carNote ? `
  <cbc:Note>Vozidlo: ${esc(carNote)}</cbc:Note>` : ''}

  <cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:EndpointID schemeID="0245">${supplierDic}</cbc:EndpointID>
      <cac:PartyName><cbc:Name>${esc(s.company_name || 'AutoAlma Servis s.r.o.')}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${esc(supplierStreet)}</cbc:StreetName>
        <cbc:PostalZone>${esc(supplierZip)}</cbc:PostalZone>
        <cbc:CityName>${esc(supplierCity)}</cbc:CityName>
        <cac:Country><cbc:IdentificationCode>SK</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(s.ic_dph || 'SK2023194316')}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(s.company_name || 'AutoAlma Servis s.r.o.')}</cbc:RegistrationName>
        <cbc:CompanyID>${esc(s.ico || '46044876')}</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>

  <cac:AccountingCustomerParty>
    <cac:Party>
      <cbc:EndpointID schemeID="0245">${customerDic}</cbc:EndpointID>
      <cac:PartyName><cbc:Name>${esc(c.company_name || invoice.customer_name)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${esc(c.address || '')}</cbc:StreetName>
        <cbc:PostalZone>${esc(c.zip || '')}</cbc:PostalZone>
        <cbc:CityName>${esc(c.city || '')}</cbc:CityName>
        <cac:Country><cbc:IdentificationCode>SK</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>${(c.ic_dph || c.dic) ? `
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(c.ic_dph || ('SK' + customerDic))}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>` : ''}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(c.company_name || invoice.customer_name)}</cbc:RegistrationName>
        <cbc:CompanyID>${esc(c.ico || '')}</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>

  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>${paymentCode(p.payment_method)}</cbc:PaymentMeansCode>
    <cbc:PaymentDueDate>${fmtDate(p.due_date)}</cbc:PaymentDueDate>${s.bank_account ? `
    <cac:PayeeFinancialAccount>
      <cbc:ID>${esc(s.bank_account)}</cbc:ID>
    </cac:PayeeFinancialAccount>` : ''}
  </cac:PaymentMeans>

  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">${taxAmount}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">${taxableAmount}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">${taxAmount}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${taxCat}</cbc:ID>
        <cbc:Percent>${taxPct}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>

  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">${taxableAmount}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">${taxableAmount}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">${totalAmount}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">${totalAmount}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>

${lines}
</Invoice>`;
}
