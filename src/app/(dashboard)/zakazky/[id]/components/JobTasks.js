'use client';
import { useState } from 'react';
import { supabase } from '@/app/lib/supabase';

export default function JobTasks({ tasks, jobId, onRefresh }) {
  const [newTaskText, setNewTaskText] = useState('');

  const addTask = async (e) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    const { error } = await supabase.from('job_tasks').insert([{ job_id: jobId, task_description: newTaskText, is_completed: false }]);
    if (!error) { setNewTaskText(''); onRefresh(); }
  };

  const toggleTaskStatus = async (taskId, currentStatus) => {
    const newStatus = !currentStatus;
    await supabase.from('job_tasks').update({ is_completed: newStatus }).eq('id', taskId);
    onRefresh();
  };

  const deleteTask = async (taskId) => {
    const { error } = await supabase.from('job_tasks').delete().eq('id', taskId);
    if (!error) onRefresh();
  };

  return (
    <div className="space-y-4 font-bold">
      <div className="flex justify-between items-end">
        <h2 className="text-blue-500 font-black uppercase text-[10px] tracking-[0.3em] italic">1. Priebeh prác (Checklist)</h2>
        <span className="text-[9px] font-black text-zinc-500 uppercase">{tasks.filter(t => t.is_completed === true).length} / {tasks.length} HOTOVO</span>
      </div>
      <div className="bg-black/30 p-6 rounded-3xl border border-zinc-800 space-y-3 min-h-[140px]">
        {tasks.map((task) => {
          const done = task.is_completed === true;
          return (
            <div key={task.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${done ? 'bg-green-600/10 border-green-600 text-green-500 shadow-[0_0_15px_rgba(22,163,74,0.1)]' : 'bg-red-600/5 border-red-600/40 text-red-500 shadow-[0_0_10px_rgba(220,38,38,0.05)]'}`}>
              <div className="flex items-center gap-4 cursor-pointer flex-grow no-print" onClick={() => toggleTaskStatus(task.id, task.is_completed)}>
                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${done ? 'bg-green-600 border-green-600 shadow-lg shadow-green-900/40' : 'bg-transparent border-red-600'}`}>
                  {done ? <span className="text-white text-xs font-black">✓</span> : <span className="text-red-600 text-[10px] font-black uppercase tracking-tighter">X</span>}
                </div>
                <span className={`text-sm font-black uppercase tracking-tight italic ${done ? 'line-through opacity-50' : ''}`}>{task.task_description}</span>
              </div>
              <button onClick={() => deleteTask(task.id)} className="no-print text-zinc-800 hover:text-red-600 px-3 transition-colors text-lg font-bold">✕</button>
            </div>
          );
        })}
        <form onSubmit={addTask} className="flex gap-2 mt-4 no-print">
          <input type="text" value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} placeholder="+ Pridať ďalšiu úlohu..." className="flex-grow bg-black border border-zinc-800 p-3 rounded-xl text-[10px] font-bold uppercase outline-none focus:border-blue-600 transition-all font-black italic tracking-widest" />
          <button type="submit" className="bg-zinc-800 px-4 rounded-xl hover:bg-blue-600 transition-all font-black text-lg">+</button>
        </form>
      </div>
    </div>
  );
}
