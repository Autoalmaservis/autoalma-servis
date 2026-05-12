'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

const PRIORITY_ICON  = { red: '🔴', yellow: '🟡', green: '🟢' };
const PRIORITY_LABEL = { red: 'Naliehavé', yellow: 'Stredné', green: 'Nízka priorita' };
const PRIORITY_BORDER = { red: 'border-red-900/60', yellow: 'border-yellow-900/60', green: 'border-green-900/60' };
const PRIORITY_HEADER = { red: 'text-red-400', yellow: 'text-yellow-400', green: 'text-green-400' };

export default function TodoPage() {
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState('');
  const [newPriority, setNewPriority] = useState('red');
  const [addingTodo, setAddingTodo] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchTodos = async () => {
    const { data } = await supabase.from('todos').select('*').order('created_at', { ascending: true });
    setTodos(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchTodos();
    const channel = supabase.channel('todos-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, fetchTodos)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const addTodo = async () => {
    if (!newTodo.trim()) return;
    await supabase.from('todos').insert([{ text: newTodo.trim(), priority: newPriority, done: false }]);
    setNewTodo('');
    setAddingTodo(false);
  };

  const toggleTodo = async (todo) => {
    await supabase.from('todos').update({ done: !todo.done }).eq('id', todo.id);
  };

  const deleteTodo = async (id) => {
    await supabase.from('todos').delete().eq('id', id);
  };

  const undoneTodos = todos.filter(t => !t.done);

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-zinc-600 font-black uppercase text-xs tracking-widest animate-pulse">Načítavam...</div>;

  return (
    <div className="p-8 bg-black min-h-screen text-white font-sans">

      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none">
            To-Do <span className="text-red-600">Zoznam</span>
          </h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2 italic">{undoneTodos.length} nevybavených úloh</p>
        </div>
        <button
          onClick={() => setAddingTodo(true)}
          className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-red-600/20"
        >
          + Pridať úlohu
        </button>
      </div>

      {/* FORMULÁR PRIDANIA */}
      {addingTodo && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-6 mb-8 space-y-4">
          <input
            autoFocus
            value={newTodo}
            onChange={e => setNewTodo(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTodo()}
            placeholder="Čo treba vyriešiť alebo vybaviť..."
            className="w-full bg-black border border-zinc-800 rounded-2xl px-5 py-4 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 font-bold"
          />
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">Priorita:</p>
            <div className="flex gap-2">
              {['red', 'yellow', 'green'].map(p => (
                <button key={p} onClick={() => setNewPriority(p)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all border ${newPriority === p ? 'border-zinc-500 bg-zinc-700 text-white scale-105' : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700'}`}>
                  {PRIORITY_ICON[p]} {PRIORITY_LABEL[p]}
                </button>
              ))}
            </div>
            <div className="ml-auto flex gap-2">
              <button onClick={() => { setAddingTodo(false); setNewTodo(''); }} className="px-4 py-2 rounded-xl text-xs font-black text-zinc-600 hover:text-white transition-all border border-zinc-800 hover:border-zinc-700">Zrušiť</button>
              <button onClick={addTodo} className="px-6 py-2 rounded-xl text-xs font-black bg-red-600 hover:bg-red-500 text-white transition-all">Pridať</button>
            </div>
          </div>
        </div>
      )}

      {/* TRI STĹPCE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {['red', 'yellow', 'green'].map(priority => {
          const columnTodos = todos.filter(t => t.priority === priority && !t.done);
          return (
            <div key={priority} className={`bg-zinc-900/40 border ${PRIORITY_BORDER[priority]} rounded-[2rem] overflow-hidden`}>
              <div className="px-6 py-4 border-b border-zinc-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{PRIORITY_ICON[priority]}</span>
                  <span className={`text-[11px] font-black uppercase tracking-widest ${PRIORITY_HEADER[priority]}`}>{PRIORITY_LABEL[priority]}</span>
                </div>
                {columnTodos.length > 0 && (
                  <span className="text-[10px] font-black bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-md">{columnTodos.length}</span>
                )}
              </div>
              <div className="p-4 space-y-3 min-h-[150px]">
                {columnTodos.length === 0 && (
                  <p className="text-center text-zinc-700 text-[10px] font-black uppercase tracking-widest pt-8 italic">Prázdne</p>
                )}
                {columnTodos.map(todo => (
                  <div key={todo.id} className="bg-black border border-zinc-800 hover:border-zinc-600 rounded-2xl p-4 group transition-all">
                    <div className="flex items-start gap-3">
                      <p className="flex-1 text-sm font-bold text-white leading-snug">{todo.text}</p>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => toggleTodo(todo)} title="Označiť ako vybavené" className="w-7 h-7 rounded-xl bg-green-900/40 hover:bg-green-800/60 flex items-center justify-center text-green-500 text-xs transition-all">✓</button>
                        <button onClick={() => deleteTodo(todo.id)} title="Vymazať" className="w-7 h-7 rounded-xl bg-zinc-900 hover:bg-red-900/40 flex items-center justify-center text-zinc-600 hover:text-red-500 text-xs transition-all">✕</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* VYBAVENÉ */}
      {todos.some(t => t.done) && (
        <div className="border-t border-zinc-900 pt-8">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700 mb-4">✓ Vybavené</p>
          <div className="space-y-2">
            {todos.filter(t => t.done).map(todo => (
              <div key={todo.id} className="flex items-center gap-4 px-5 py-3 bg-zinc-900/30 border border-zinc-900 rounded-2xl group opacity-40 hover:opacity-70 transition-all">
                <span className="text-sm">{PRIORITY_ICON[todo.priority]}</span>
                <p className="flex-1 text-sm font-bold text-zinc-500 line-through">{todo.text}</p>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => toggleTodo(todo)} title="Obnoviť" className="text-[10px] font-black text-zinc-600 hover:text-white transition-all px-3 py-1.5 rounded-xl hover:bg-zinc-800">↩ Obnoviť</button>
                  <button onClick={() => deleteTodo(todo.id)} className="text-[10px] font-black text-zinc-700 hover:text-red-500 transition-all px-3 py-1.5 rounded-xl hover:bg-zinc-900">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
