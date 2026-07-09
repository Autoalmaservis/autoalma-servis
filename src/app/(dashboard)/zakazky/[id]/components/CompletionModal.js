'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { fetchWithAuth } from '@/app/lib/apiHelpers';

export default function CompletionModal({ zakazka, items = [], employees = [], onClose, onComplete }) {
  const [completeChannel, setCompleteChannel] = useState('sms');
  const [completeMsg, setCompleteMsg] = useState('');
  const [completeSubject, setCompleteSubject] = useState('');
  const [completeSendMsg, setCompleteSendMsg] = useState(true);
  const [completeTemplates, setCompleteTemplates] = useState([]);
  const [scheduleNext, setScheduleNext] = useState(false);
  const [nextType, setNextType] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [nextNote, setNextNote] = useState('');
  const [completeSaving, setCompleteSaving] = useState(false);
  const [hoursConfirmed, setHoursConfirmed] = useState(false);
  const [existingScheduled, setExistingScheduled] = useState([]);
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [reminderChannel, setReminderChannel] = useState('sms');
  const [reminderMsg, setReminderMsg] = useState('');
  const [reminderSubject, setReminderSubject] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('09:00');
  const [reminderSaving, setReminderSaving] = useState(false);
  const [company, setCompany] = useState({ name: 'AutoAlma Servis', phone: '0940 449 449', email: 'autoalma@autoalma.sk' });

  useEffect(() => {
    const plate = zakazka.plate_number || '';
    const name = zakazka.customer_name || 'klient';
    Promise.all([
      supabase.from('sms_templates').select('*').order('label'),
      supabase.from('scheduled_sms').select('*').eq('plate_number', plate).eq('status', 'pending').order('scheduled_for', { ascending: true }),
      supabase.from('business_settings').select('id, value').in('id', ['company_name', 'company_phone', 'company_email']),
    ]).then(([tplRes, schedRes, settRes]) => {
      setCompleteTemplates(tplRes.data || []);
      setExistingScheduled(schedRes.data || []);
      if (settRes.data) {
        const get = (key, fb) => settRes.data.find(r => r.id === key)?.value || fb;
        const co = {
          name:  get('company_name',  'AutoAlma Servis'),
          phone: get('company_phone', '0940 449 449'),
          email: get('company_email', 'autoalma@autoalma.sk'),
        };
        setCompany(co);
        setCompleteMsg(`Dobry den p. ${name}, Vase vozidlo ${plate} je pripravene na vyzdvihnutie. Tesime sa na Vas! ${co.name}, tel: ${co.phone}.`);
      } else {
        setCompleteMsg(`Dobry den p. ${name}, Vase vozidlo ${plate} je pripravene na vyzdvihnutie. Tesime sa na Vas! AutoAlma servis, tel: 0940 449 449.`);
      }
    });
    setCompleteSubject(`Vaše vozidlo ${plate} je pripravené na vyzdvihnutie`);
  }, []);

  const addReminderToScheduled = async () => {
    if (!reminderMsg.trim() || !reminderDate) return;
    setReminderSaving(true);
    const { data, error } = await supabase.from('scheduled_sms').insert([{
      customer_phone: reminderChannel === 'sms' ? (zakazka.customer_phone || null) : null,
      customer_email: reminderChannel === 'email' ? (zakazka.customer_email || null) : null,
      customer_name: zakazka.customer_name,
      plate_number: zakazka.plate_number,
      message: reminderMsg,
      subject: reminderChannel === 'email' ? reminderSubject : null,
      type: reminderChannel,
      scheduled_for: new Date(`${reminderDate}T${reminderTime}:00`).toISOString(),
      status: 'pending',
    }]).select().single();
    if (!error && data) {
      setExistingScheduled(prev => [...prev, data]);
      setShowAddReminder(false);
      setReminderMsg(''); setReminderSubject(''); setReminderDate(''); setReminderTime('09:00');
    }
    setReminderSaving(false);
  };

  const cancelReminder = async (remId) => {
    await supabase.from('scheduled_sms').delete().eq('id', remId);
    setExistingScheduled(prev => prev.filter(r => r.id !== remId));
  };

  const [editableHours, setEditableHours] = useState([]);

  useEffect(() => {
    const map = {};
    (items || []).forEach(item => {
      const splits = item.mechanic_splits;
      if (splits && splits.length > 0) {
        splits.forEach(split => {
          const h = Number(split.hours) || 0;
          if (!h || !split.worker_id) return;
          if (!map[split.worker_id]) {
            const emp = (employees || []).find(e => e.id === split.worker_id);
            map[split.worker_id] = { worker_id: split.worker_id, name: emp?.name || 'Neznámy', color: emp?.color || '#888', computed: 0 };
          }
          map[split.worker_id].computed += h;
        });
      } else if (item.worker_id) {
        let h = 0;
        if (item.type === 'Práca') h = Number(item.quantity) || 0;
        else if (item.type === 'Úkon') h = (Number(item.mechanic_hours) || 0) * (Number(item.quantity) || 1);
        if (!h) return;
        if (!map[item.worker_id]) {
          const emp = (employees || []).find(e => e.id === item.worker_id);
          map[item.worker_id] = { worker_id: item.worker_id, name: emp?.name || 'Neznámy', color: emp?.color || '#888', computed: 0 };
        }
        map[item.worker_id].computed += h;
      }
    });
    setEditableHours(Object.values(map).sort((a, b) => b.computed - a.computed).map(r => ({ ...r, hours: String(r.computed.toFixed(2)) })));
  }, [items, employees]);

  const unallocatedItems = (items || []).filter(item => {
    if (item.type !== 'Práca' && item.type !== 'Úkon') return false;
    const totalH = item.type === 'Práca' ? (Number(item.quantity) || 0) : ((Number(item.mechanic_hours) || 0) * (Number(item.quantity) || 1));
    if (!totalH) return false;
    const splits = item.mechanic_splits;
    if (splits && splits.length > 0) {
      const assigned = splits.reduce((s, sp) => s + (Number(sp.hours) || 0), 0);
      return Math.abs(totalH - assigned) > 0.05;
    }
    return !item.worker_id;
  });

  const totalHoursAll = editableHours.reduce((s, r) => s + (Number(r.hours) || 0), 0);
  const hasManualEdit = editableHours.some(r => Math.abs(Number(r.hours) - r.computed) > 0.001);

  const totalWorkHours = items.filter(i => i.type === 'Práca').reduce((a, i) => a + Number(i.quantity), 0);
  const hoursBalanced = unallocatedItems.length === 0;

  const handleCompleteWithActions = async () => {
    if (!hoursBalanced && !hoursConfirmed) { setHoursConfirmed(true); return; }
    setCompleteSaving(true);
    try {
      if (editableHours.length > 0) {
        const finalSplits = editableHours.filter(r => Number(r.hours) > 0).map(r => ({
          employee_id: r.worker_id,
          name: r.name,
          hours: Number(r.hours) || 0,
        }));
        await supabase.from('job_tickets').update({ mechanic_splits: finalSplits }).eq('id', zakazka.id);
      } else if (zakazka.assigned_worker_id) {
        const emp = employees.find(e => e.id === zakazka.assigned_worker_id);
        if (emp) {
          await supabase.from('job_tickets').update({ mechanic_splits: [{ employee_id: emp.id, name: emp.name, hours: totalWorkHours }] }).eq('id', zakazka.id);
        }
      }
      if (completeSendMsg && completeMsg.trim()) {
        if (completeChannel === 'sms' && zakazka.customer_phone) {
          const doSend = confirm(`Odoslať SMS zákazníkovi ${zakazka.customer_name} (${zakazka.customer_phone})?`);
          if (doSend) {
            await fetchWithAuth('/api/send-sms', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ phone: zakazka.customer_phone, message: completeMsg }),
            });
            await supabase.from('scheduled_sms').insert([{
              customer_phone: zakazka.customer_phone,
              customer_name: zakazka.customer_name,
              plate_number: zakazka.plate_number,
              message: completeMsg,
              type: 'sms',
              scheduled_for: new Date().toISOString(),
              status: 'sent',
              user_id: zakazka.customer_id || null,
            }]);
          }
          if (zakazka.customer_id) {
            await supabase.from('notifications').insert([{
              user_id: zakazka.customer_id,
              title: '✅ Auto je pripravené',
              content: completeMsg,
              is_read: false,
              type: 'success',
            }]);
          }
        } else if (completeChannel === 'email' && zakazka.customer_email) {
          await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: zakazka.customer_email, subject: completeSubject, message: completeMsg }),
          });
          await supabase.from('scheduled_sms').insert([{
            customer_email: zakazka.customer_email,
            customer_name: zakazka.customer_name,
            plate_number: zakazka.plate_number,
            message: completeMsg,
            subject: completeSubject,
            type: 'email',
            scheduled_for: new Date().toISOString(),
            status: 'sent',
          }]);
          if (zakazka.customer_id) {
            await supabase.from('notifications').insert([{
              user_id: zakazka.customer_id,
              title: '✅ Auto je pripravené',
              content: completeMsg,
              is_read: false,
              type: 'success',
            }]);
          }
        }
      }
      if (scheduleNext && nextType && nextDate) {
        await supabase.from('calendar_events').insert([{
          title: nextType,
          plate_number: zakazka.plate_number,
          customer_name: zakazka.customer_name,
          start_datetime: `${nextDate}T08:00:00`,
          end_datetime: `${nextDate}T09:00:00`,
          issue_description: nextNote || nextType,
          customer_phone: zakazka.customer_phone || null,
          customer_email: zakazka.customer_email || null,
          status: 'Naplánované',
          is_confirmed: true,
          is_blocked: false,
        }]);
      }
      await onComplete();
      onClose();
    } catch (err) {
      alert('Chyba: ' + err.message);
    } finally {
      setCompleteSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4 no-print font-bold overflow-y-auto">
      <div className="bg-zinc-950 border border-zinc-800 rounded-[3rem] w-full max-w-3xl shadow-2xl my-auto">

        {/* Header */}
        <div className="p-8 border-b border-zinc-800 flex justify-between items-center">
          <div>
            <p className="text-[10px] text-green-500 font-black uppercase tracking-[0.4em] mb-1">Zákazka dokončená</p>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white">
              Informovať zákazníka <span className="text-green-500">+ naplánovať</span>
            </h2>
            <p className="text-zinc-500 text-xs font-bold mt-1">
              {zakazka.plate_number} · {zakazka.customer_name}
            </p>
          </div>
          <button onClick={onClose} className="bg-zinc-900 hover:bg-white hover:text-black p-3 rounded-full transition-all text-lg font-black">✕</button>
        </div>

        <div className="p-8 space-y-8">

          {/* === SEKCIA 1: SPRÁVA ZÁKAZNÍKOVI === */}
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Správa zákazníkovi</h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={completeSendMsg} onChange={e => setCompleteSendMsg(e.target.checked)} className="w-4 h-4 accent-green-500" />
                <span className="text-[10px] font-black uppercase text-zinc-400">Odoslať správu</span>
              </label>
            </div>

            {completeSendMsg && (
              <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                {/* Channel toggle */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setCompleteChannel('sms');
                      setCompleteMsg(`Dobry den p. ${zakazka.customer_name || 'klient'}, Vase vozidlo ${zakazka.plate_number || ''} je pripravene na vyzdvihnutie. Tesime sa na Vas! ${company.name}, tel: ${company.phone}.`);
                    }}
                    className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${completeChannel === 'sms' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-black border-zinc-700 text-zinc-500 hover:text-white'}`}
                  >
                    📱 SMS {zakazka.customer_phone ? `· ${zakazka.customer_phone}` : '· (chýba číslo)'}
                  </button>
                  <button
                    onClick={() => {
                      setCompleteChannel('email');
                      setCompleteMsg(`Dobrý deň, ${zakazka.customer_name || 'vážený zákazník'}.\n\nVaše vozidlo ${zakazka.plate_number} – ${zakazka.car_brand_model || ''} je pripravené na vyzdvihnutie.\n\nTešíme sa na Vás!\n\n${company.name}\nTel: ${company.phone} | ${company.email}`);
                    }}
                    className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${completeChannel === 'email' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-black border-zinc-700 text-zinc-500 hover:text-white'}`}
                  >
                    ✉️ Email {zakazka.customer_email ? `· ${zakazka.customer_email}` : '· (chýba email)'}
                  </button>
                </div>

                {/* Template picker */}
                {completeTemplates.filter(t => (t.type || 'sms') === completeChannel).length > 0 && (
                  <select
                    onChange={e => {
                      const t = completeTemplates.find(t => t.id.toString() === e.target.value);
                      if (t) { setCompleteMsg(t.content); if (t.subject) setCompleteSubject(t.subject); }
                    }}
                    className="w-full bg-black border border-zinc-700 p-3 rounded-xl text-white font-black text-[10px] uppercase outline-none focus:border-red-500"
                    defaultValue=""
                  >
                    <option value="">— Vybrať šablónu —</option>
                    {completeTemplates.filter(t => (t.type || 'sms') === completeChannel).map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                )}

                {/* Subject (email only) */}
                {completeChannel === 'email' && (
                  <input type="text" value={completeSubject} onChange={e => setCompleteSubject(e.target.value)}
                    placeholder="Predmet emailu"
                    className="w-full bg-black border border-zinc-700 p-4 rounded-2xl text-white font-bold outline-none focus:border-purple-500" />
                )}

                {/* Message */}
                <textarea
                  value={completeMsg}
                  onChange={e => setCompleteMsg(e.target.value)}
                  rows={completeChannel === 'email' ? 6 : 3}
                  className="w-full bg-black border border-zinc-700 p-4 rounded-2xl text-white font-bold outline-none focus:border-green-500 resize-none text-sm"
                />
                {!zakazka.customer_phone && completeChannel === 'sms' && (
                  <p className="text-amber-500 text-[10px] font-black uppercase tracking-widest">⚠️ Zákazník nemá zadané telefónne číslo</p>
                )}
                {!zakazka.customer_email && completeChannel === 'email' && (
                  <p className="text-amber-500 text-[10px] font-black uppercase tracking-widest">⚠️ Zákazník nemá zadaný email</p>
                )}
              </div>
            )}
          </div>

          {/* === SEKCIA 2: ĎALŠÍ SERVIS === */}
          <div className="border-t border-zinc-800 pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Naplánovať ďalší servis</h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={scheduleNext} onChange={e => setScheduleNext(e.target.checked)} className="w-4 h-4 accent-green-500" />
                <span className="text-[10px] font-black uppercase text-zinc-400">Pridať do kalendára</span>
              </label>
            </div>

            {scheduleNext && (
              <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                {/* Typ servisu */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {['STK / EK', 'Olej servis', 'Výmena pneumatík', 'Klimatizácia', 'Brzdová kvapalina', 'Vlastný servis'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setNextType(type)}
                      className={`py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all border text-center ${nextType === type ? 'bg-green-600/20 border-green-500 text-green-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-white'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                {nextType === 'Vlastný servis' && (
                  <input type="text" value={nextNote} onChange={e => setNextNote(e.target.value)}
                    placeholder="Popis servisu..."
                    className="w-full bg-black border border-zinc-700 p-4 rounded-2xl text-white font-bold outline-none focus:border-green-500" />
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Dátum servisu</label>
                    <input
                      type="date"
                      value={nextDate}
                      onChange={e => setNextDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full bg-black border border-zinc-700 p-4 rounded-2xl text-white font-bold outline-none focus:border-green-500"
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Poznámka</label>
                    <input type="text" value={nextNote} onChange={e => setNextNote(e.target.value)}
                      placeholder="Napr. každé 2 roky..."
                      className="w-full bg-black border border-zinc-700 p-4 rounded-2xl text-white font-bold outline-none focus:border-green-500" />
                  </div>
                </div>

                {nextType && nextDate && (
                  <div className="bg-green-600/10 border border-green-600/30 rounded-2xl p-4">
                    <p className="text-green-400 text-[10px] font-black uppercase tracking-widest">
                      ✅ Vytvorí sa udalosť v kalendári: <span className="text-white">{nextType}</span> · {new Date(nextDate + 'T12:00:00').toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' })} · {zakazka.plate_number}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* === SEKCIA 3: NAPLÁNOVANÉ UPOZORNENIA === */}
          <div className="border-t border-zinc-800 pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                Naplánované správy
                {existingScheduled.length > 0 && (
                  <span className="ml-2 bg-blue-600/20 text-blue-400 border border-blue-600/30 text-[8px] font-black px-2 py-0.5 rounded-lg">{existingScheduled.length}</span>
                )}
              </h3>
              <button
                onClick={() => setShowAddReminder(p => !p)}
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-all px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800"
              >
                {showAddReminder ? '✕ Zrušiť' : '+ Pridať upozornenie'}
              </button>
            </div>

            {/* Zoznam existujúcich */}
            {existingScheduled.length > 0 && (
              <div className="space-y-2">
                {existingScheduled.map(r => (
                  <div key={r.id} className="flex items-start gap-3 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
                    <span className={`text-[8px] font-black px-2 py-1 rounded shrink-0 mt-0.5 ${(!r.type || r.type === 'sms' || r.type === 'one-time') ? 'bg-blue-600/20 text-blue-400' : 'bg-purple-600/20 text-purple-400'}`}>
                      {(!r.type || r.type === 'sms' || r.type === 'one-time') ? '📱 SMS' : '✉️ Email'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black text-amber-400 uppercase mb-0.5">
                        📅 {new Date(r.scheduled_for).toLocaleString('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {r.subject && <p className="text-purple-300 text-[9px] font-bold mb-0.5">Predmet: {r.subject}</p>}
                      <p className="text-zinc-400 text-xs font-bold truncate">{r.message}</p>
                    </div>
                    <button onClick={() => cancelReminder(r.id)} className="shrink-0 w-7 h-7 flex items-center justify-center bg-red-600/10 hover:bg-red-600 border border-red-600/30 text-red-500 hover:text-white rounded-xl transition-all font-black text-xs">✕</button>
                  </div>
                ))}
              </div>
            )}

            {existingScheduled.length === 0 && !showAddReminder && (
              <p className="text-zinc-700 text-[10px] font-black uppercase tracking-widest text-center py-2">Žiadne naplánované správy pre {zakazka.plate_number}</p>
            )}

            {/* Formulár pridania nového upozornenia */}
            {showAddReminder && (
              <div className="bg-zinc-900/40 border border-zinc-700 rounded-2xl p-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
                {/* Channel toggle */}
                <div className="flex gap-2">
                  <button onClick={() => setReminderChannel('sms')}
                    className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${reminderChannel === 'sms' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-black border-zinc-700 text-zinc-500 hover:text-white'}`}>
                    📱 SMS
                  </button>
                  <button onClick={() => setReminderChannel('email')}
                    className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${reminderChannel === 'email' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-black border-zinc-700 text-zinc-500 hover:text-white'}`}>
                    ✉️ Email
                  </button>
                </div>

                {/* Template picker */}
                {completeTemplates.filter(t => (t.type || 'sms') === reminderChannel).length > 0 && (
                  <select onChange={e => { const t = completeTemplates.find(t => t.id.toString() === e.target.value); if (t) { setReminderMsg(t.content); if (t.subject) setReminderSubject(t.subject); } }}
                    className="w-full bg-black border border-zinc-700 p-3 rounded-xl text-white font-black text-[10px] uppercase outline-none focus:border-red-500" defaultValue="">
                    <option value="">— Vybrať šablónu —</option>
                    {completeTemplates.filter(t => (t.type || 'sms') === reminderChannel).map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                )}

                {reminderChannel === 'email' && (
                  <input type="text" placeholder="Predmet emailu" value={reminderSubject} onChange={e => setReminderSubject(e.target.value)}
                    className="w-full bg-black border border-zinc-700 p-3 rounded-xl text-white font-bold outline-none focus:border-purple-500" />
                )}

                <textarea placeholder="Text správy / upozornenia..." value={reminderMsg} onChange={e => setReminderMsg(e.target.value)} rows={3}
                  className="w-full bg-black border border-zinc-700 p-3 rounded-xl text-white font-bold outline-none focus:border-blue-500 resize-none text-sm" />

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">Dátum odoslania</label>
                    <input type="date" value={reminderDate} onChange={e => setReminderDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full bg-black border border-zinc-700 p-3 rounded-xl text-white font-bold outline-none focus:border-blue-500"
                      style={{ colorScheme: 'dark' }} />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">Čas</label>
                    <input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)}
                      className="w-full bg-black border border-zinc-700 p-3 rounded-xl text-white font-bold outline-none focus:border-blue-500" />
                  </div>
                </div>

                <button onClick={addReminderToScheduled} disabled={reminderSaving || !reminderMsg.trim() || !reminderDate}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-all">
                  {reminderSaving ? 'Ukladám...' : '📅 Naplánovať správu'}
                </button>
              </div>
            )}
          </div>

        </div>

        {/* === SEKCIA: HODINY MECHANIKOV === */}
        <div className="border-t border-zinc-800 pt-6 mx-8 mb-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-yellow-400">Hodiny mechanikov</h3>
            <span className="text-[10px] font-black text-zinc-500">Spolu: <span className="text-white">{totalHoursAll.toFixed(2)} hod</span></span>
          </div>

          {unallocatedItems.length > 0 && (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-3 space-y-1">
              <p className="text-orange-400 text-[9px] font-black uppercase tracking-widest">⚠ Položky s nepriradenými hodinami:</p>
              {unallocatedItems.map(item => (
                <p key={item.id} className="text-orange-300 text-[9px] font-bold">· {item.name}</p>
              ))}
            </div>
          )}

          {editableHours.length > 0 ? (
            <div className="space-y-2">
              {editableHours.map((row, idx) => (
                <div key={row.worker_id} className="flex items-center gap-3 bg-zinc-900/60 border border-zinc-800 rounded-2xl px-4 py-3">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                  <span className="flex-1 text-sm font-black uppercase italic">{row.name}</span>
                  <span className="text-zinc-600 text-[8px] font-black">({row.computed.toFixed(2)}h)</span>
                  <input
                    type="number" min="0" step="0.25"
                    value={row.hours}
                    onChange={e => setEditableHours(prev => prev.map((r, i) => i === idx ? { ...r, hours: e.target.value } : r))}
                    onFocus={e => e.target.select()}
                    className="w-20 bg-black border border-yellow-600/40 p-2 rounded-xl text-white text-sm font-black text-center outline-none focus:border-yellow-500"
                  />
                  <span className="text-zinc-500 text-[9px] font-black">hod</span>
                </div>
              ))}
              {hasManualEdit && (
                <p className="text-yellow-500 text-[9px] font-black uppercase tracking-widest">Hodiny boli manuálne upravené</p>
              )}
            </div>
          ) : (
            <p className="text-zinc-600 text-[9px] font-black uppercase tracking-widest">Žiadne hodiny — priraďte mechanikov k položkám zákazky</p>
          )}

          {hoursConfirmed && !hoursBalanced && (
            <div className="bg-orange-500/10 border border-orange-500/40 rounded-2xl p-4">
              <p className="text-orange-400 font-black text-[10px] uppercase tracking-widest">
                ⚠ Niektoré položky nemajú priradených mechanikov. Naozaj uzavrieť?
              </p>
            </div>
          )}
        </div>

        {/* Akčné tlačidlá */}
        <div className="p-8 border-t border-zinc-800 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 py-4 rounded-2xl text-zinc-500 font-black uppercase text-[10px] tracking-widest hover:text-white transition-all border border-zinc-800 hover:border-zinc-600"
          >
            Zrušiť
          </button>
          <button
            onClick={handleCompleteWithActions}
            disabled={completeSaving || (scheduleNext && (!nextType || !nextDate))}
            className={`flex-[3] py-5 disabled:opacity-40 text-white font-black uppercase text-[11px] tracking-[0.3em] rounded-2xl transition-all shadow-xl flex items-center justify-center gap-3 ${hoursConfirmed && !hoursBalanced ? 'bg-orange-600 hover:bg-orange-500 shadow-orange-900/30' : 'bg-green-600 hover:bg-green-500 shadow-green-900/30'}`}
          >
            {completeSaving ? (
              <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> Ukladám...</span>
            ) : hoursConfirmed && !hoursBalanced ? (
              <>⚠ Uzavrieť napriek nesprávnym hodinám</>
            ) : (
              <>✅ {completeSendMsg ? 'Odoslať správu + ' : ''}Označiť ako dokončené</>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
