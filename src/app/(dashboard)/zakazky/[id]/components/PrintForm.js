export default function PrintForm({ zakazka, items, tasks, myCompany, subtotal, tax, total }) {
  return (
    <div className="zakazka-print-area">

      {/* HLAVIČKA */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15pt' }}>
        <tbody><tr>
          <td width="50%" valign="top">
            <img src={myCompany.logo_url || "/autoalma logo.png"} alt="Logo" style={{ width: '100px', height: 'auto', marginBottom: '10pt' }} />
            <div style={{ fontSize: '8.5pt', color: '#000', lineHeight: '1.4' }}>
              <p style={{ margin: '0', color: '#666', fontWeight: '900' }}>DODÁVATEĽ:</p>
              <p style={{ margin: '0' }}><strong>{myCompany.name}</strong></p>
              <p style={{ margin: '0' }}>{myCompany.address}</p>
              <p style={{ margin: '0' }}>{myCompany.zip} {myCompany.city}</p>
              <p style={{ margin: '3pt 0 0 0' }}>IČO: {myCompany.ico} | DIČ: {myCompany.dic}</p>
              <p style={{ margin: '0' }}>{myCompany.phone} | {myCompany.email}</p>
              {myCompany.web && <p style={{ margin: '0' }}>{myCompany.web}</p>}
            </div>
          </td>
          <td width="50%" valign="top" align="right">
            <h2 style={{ fontSize: '16pt', color: '#dc2626', margin: '0' }}>Servisný príkaz</h2>
            <p style={{ fontSize: '22pt', color: '#000', fontWeight: '900', margin: '2pt 0' }}>{zakazka.job_number || `#${zakazka.id.slice(0,8)}`}</p>
            <p style={{ margin: '0', color: '#000', fontSize: '9pt' }}>Dátum príjmu: <strong>{new Date(zakazka.created_at).toLocaleDateString('sk-SK')}</strong></p>
            <p style={{ margin: '2pt 0 0 0', fontSize: '9pt', color: '#000' }}>Stav: <strong style={{ color: zakazka.status === 'Dokončené' ? '#16a34a' : '#d97706' }}>{zakazka.status}</strong></p>
          </td>
        </tr></tbody>
      </table>

      {/* ADRESY */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15pt' }}>
        <tbody><tr>
          <td width="50%" style={{ border: '1pt solid #000', padding: '8pt' }} valign="top">
            <p style={{ margin: '0 0 3pt 0', fontSize: '8pt', color: '#666', fontWeight: '900' }}>ODBERATEĽ / ZÁKAZNÍK:</p>
            <p style={{ margin: '0', fontSize: '11pt', color: '#000', fontWeight: '900' }}>{zakazka.company_name || zakazka.customer_name}</p>
            <p style={{ margin: '0', fontSize: '9pt', color: '#000' }}>{zakazka.address || zakazka.customer_address || ''}</p>
            <p style={{ margin: '0', fontSize: '9pt', color: '#000' }}>{zakazka.zip || ''} {zakazka.city || ''}</p>
            {(zakazka.ico || zakazka.dic) && (
              <p style={{ margin: '3pt 0 0 0', fontSize: '8pt', color: '#000' }}>IČO: {zakazka.ico || '---'} | DIČ: {zakazka.dic || '---'}</p>
            )}
            <p style={{ margin: '3pt 0 0 0', fontSize: '8pt', color: '#000' }}>Tel: {zakazka.customer_phone || '---'}</p>
          </td>
          <td width="50%" style={{ border: '1pt solid #000', padding: '8pt' }} valign="top">
            <p style={{ margin: '0 0 3pt 0', fontSize: '8pt', color: '#666', fontWeight: '900' }}>VOZIDLO:</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3pt' }}>
              <span style={{ border: '1.5pt solid #000', padding: '1pt 4pt', fontWeight: '900', fontSize: '11pt', color: '#000' }}>{zakazka.plate_number || '---'}</span>
              <span style={{ fontSize: '10pt', fontWeight: '900', color: '#000' }}>{zakazka.car_brand_model || '---'}</span>
            </div>
            <p style={{ margin: '0', fontSize: '8pt', color: '#000' }}>VIN: {zakazka.vin_number || '---'}</p>
            <p style={{ margin: '0', fontSize: '8pt', color: '#000' }}>Rok: {zakazka.year_produced || '---'} | {zakazka.engine_volume ? zakazka.engine_volume + ' cm³' : '---'} | {zakazka.engine_power ? zakazka.engine_power + ' kW' : '---'} | {zakazka.fuel_type || '---'}</p>
            <p style={{ margin: '0', fontSize: '8pt', color: '#000' }}>KM: {zakazka.mileage != null && zakazka.mileage !== '' ? Number(zakazka.mileage).toLocaleString('sk-SK') + ' km' : '---'} | Mechanik: {zakazka.technician_name || '---'}</p>
          </td>
        </tr></tbody>
      </table>

      {/* ZÁVADY */}
      {zakazka.complaints && (
        <div style={{ border: '1pt solid #000', padding: '8pt', marginBottom: '12pt' }}>
          <p style={{ margin: '0 0 4pt 0', fontSize: '8pt', color: '#dc2626', fontWeight: '900' }}>ZISTENÉ ZÁVADY / POŽIADAVKY ZÁKAZNÍKA:</p>
          <p style={{ margin: '0', fontSize: '8.5pt', color: '#000', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{zakazka.complaints}</p>
        </div>
      )}

      {/* CHECKLIST ÚKONOV */}
      {tasks.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12pt' }}>
          <thead>
            <tr style={{ background: '#f4f4f5' }}>
              <th style={{ border: '1pt solid #000', padding: '4pt 6pt', fontSize: '8pt', fontWeight: '900', textAlign: 'left' }}>SERVISNÉ ÚKONY — CHECKLIST</th>
              <th style={{ border: '1pt solid #000', padding: '4pt', fontSize: '8pt', fontWeight: '900', textAlign: 'center', width: '60pt' }}>STAV</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td style={{ border: '0.5pt solid #eee', padding: '4pt 6pt', fontSize: '8.5pt', color: '#000' }}>{task.task_description}</td>
                <td style={{ border: '0.5pt solid #eee', padding: '4pt', textAlign: 'center', fontSize: '8pt', fontWeight: '900', color: task.is_completed ? '#16a34a' : '#dc2626' }}>
                  {task.is_completed ? '✓ HOTOVO' : '○ ČAKÁ'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* MATERIÁL A PRÁCE */}
      {items.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8pt' }}>
          <thead>
            <tr style={{ background: '#f4f4f5' }}>
              <th style={{ border: '1pt solid #000', padding: '4pt 6pt', fontSize: '8pt', fontWeight: '900', textAlign: 'left' }}>MATERIÁL A SERVISNÉ PRÁCE</th>
              <th style={{ border: '1pt solid #000', padding: '4pt', fontSize: '8pt', fontWeight: '900', textAlign: 'center', width: '40pt' }}>MNŽ.</th>
              <th style={{ border: '1pt solid #000', padding: '4pt', fontSize: '8pt', fontWeight: '900', textAlign: 'right', width: '55pt' }}>CENA/J</th>
              <th style={{ border: '1pt solid #000', padding: '4pt', fontSize: '8pt', fontWeight: '900', textAlign: 'right', width: '60pt' }}>SPOLU</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td style={{ border: '0.5pt solid #eee', padding: '3pt 6pt', fontSize: '8.5pt', color: '#000' }}>
                  <span style={{ fontSize: '7pt', color: item.type === 'Práca' ? '#2563eb' : '#ea580c', fontWeight: '900' }}>[{item.type.toUpperCase()}]</span>{' '}{item.name}
                </td>
                <td style={{ border: '0.5pt solid #eee', padding: '3pt', textAlign: 'center', fontSize: '8.5pt', color: '#000' }}>{item.quantity} {item.unit}</td>
                <td style={{ border: '0.5pt solid #eee', padding: '3pt', textAlign: 'right', fontSize: '8.5pt', color: '#000' }}>{parseFloat(item.unit_price).toFixed(2)} €</td>
                <td style={{ border: '0.5pt solid #eee', padding: '3pt', textAlign: 'right', fontWeight: '900', fontSize: '8.5pt', color: '#000' }}>{(item.quantity * item.unit_price).toFixed(2)} €</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* SUMÁR */}
      {items.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10pt' }}>
          <tbody><tr>
            <td></td>
            <td width="200pt" style={{ border: '1.5pt solid #000', padding: '8pt' }}>
              <table width="100%" style={{ borderCollapse: 'collapse' }}>
                <tbody>
                  <tr style={{ fontSize: '9pt', color: '#000' }}>
                    <td style={{ paddingBottom: '2pt' }}>Základ dane:</td>
                    <td align="right">{subtotal.toFixed(2)} €</td>
                  </tr>
                  <tr style={{ fontSize: '9pt', color: '#000', borderBottom: '1pt solid #000' }}>
                    <td style={{ paddingBottom: '2pt' }}>DPH (23%):</td>
                    <td align="right">{tax.toFixed(2)} €</td>
                  </tr>
                  <tr>
                    <td style={{ paddingTop: '5pt', fontWeight: '900', fontSize: '11pt', color: '#dc2626' }}>CELKOM:</td>
                    <td align="right" style={{ paddingTop: '5pt', fontWeight: '900', fontSize: '16pt' }}>{total.toFixed(2)} €</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr></tbody>
        </table>
      )}

      {/* SPACER — podpisy na spodok */}
      <div className="print-spacer" />

      {/* PODPISY */}
      <div className="print-signature-area">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody><tr>
            <td width="45%" style={{ borderTop: '1pt solid #000', textAlign: 'center', paddingTop: '5pt', fontSize: '8pt', color: '#000' }}>PODPIS PREVZAL (ZÁKAZNÍK)</td>
            <td width="10%"></td>
            <td width="45%" style={{ borderTop: '1pt solid #000', textAlign: 'center', paddingTop: '5pt', fontSize: '8pt', color: '#000' }}>PEČIATKA A PODPIS SERVISU</td>
          </tr></tbody>
        </table>
      </div>

    </div>
  );
}
