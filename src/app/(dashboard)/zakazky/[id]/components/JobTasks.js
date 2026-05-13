'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

export default function JobTasks({ tasks, jobId, onRefresh }) {
  const [newTaskText, setNewTaskText] = useState('');
  const [localTasks, setLocalTasks] = useState(tasks);
  const [confirmTaskId, setConfirmTaskId] = useState(null);

  useEffect(() => {
    setLocalTasks(prev => {
      const realIds = new Set(tasks.map(t => t.id));
      const temps = prev.filter(t => String(t.id).startsWith('temp-') && !realIds.has(t.id));
      return [...tasks, ...temps];
    });
  }, [tasks]);

  const addTask = async (e) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    const tempTask = { id: `temp-${Date.now()}`, job_id: jobId, task_description: newTaskText, is_completed: false };
    setLocalTasks(prev => [...prev, tempTask]);
    setNewTaskText('');
    const { error } = await supabase.from('job_tasks').insert([{ job_id: jobId, task_description: tempTask.task_description, is_completed: false }]);
    if (!error) { onRefresh(); }
  };

  const confirmDone = async (taskId) => {
    setConfirmTaskId(null);
    setLocalTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_completed: true } : t));
    await supabase.from('job_tasks').update({ is_completed: true }).eq('id', taskId);
    onRefresh();
  };

  const deleteTask = async (taskId) => {
    setLocalTasks(prev => prev.filter(t => t.id !== taskId));
    const { error } = await supabase.from('job_tasks').delete().eq('id', taskId);
    if (!error) onRefresh();
  };

  return (
    <div className="space-y-4 font-bold">
      <div className="flex justify-between items-end">
        <h2 className="text-blue-500 font-black uppercase text-[10px] tracking-[0.3em] italic">1. Priebeh prác (Checklist)</h2>
        <span className="text-[9px] font-black text-zinc-500 uppercase">{localTasks.filter(t => t.is_completed === true).length} / {localTasks.length} HOTOVO</span>
      </div>
      <div className="bg-black/30 p-6 rounded-3xl border border-zinc-800 space-y-3 min-h-[140px]">
        {localTasks.map((task) => {
          const done = task.is_completed === true;
          const isTemp = String(task.id).startsWith('temp-');
          const isConfirming = confirmTaskId === task.id;

          if (isConfirming) {
            return (
              <div key={task.id} className="flex flex-col gap-3 p-4 rounded-2xl border border-green-600 bg-green-600/10 shadow-[0_0_15px_rgba(22,163,74,0.15)]">
                <span className="text-green-300 text-xs font-black uppercase italic tracking-tight">
                  Máš túto úlohu hotovú?
                </span>
                <span className="text-white text-sm font-black uppercase italic tracking-tight">
                  {task.task_description}
                </span>
                <div className="flex gap-3">
                  <button
                    onClick={() => confirmDone(task.id)}
                    className="flex-1 bg-green-600 hover:bg-green-500 text-white font-black py-2.5 rounded-xl uppercase text-[10px] tracking-widest transition-all shadow-lg"
                  >
                    ✓ Áno, hotovo
                  </button>
                  <button
                    onClick={() => setConfirmTaskId(null)}
                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white font-black py-2.5 rounded-xl uppercase text-[10px] tracking-widest transition-all"
                  >
                    Nie
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={task.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${done ? 'bg-green-600/10 border-green-600/40 text-green-500' : 'bg-red-600/5 border-red-600/30 text-red-400'} ${isTemp ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-4 flex-grow">
                <button
                  type="button"
                  onClick={() => !done && !isTemp && setConfirmTaskId(task.id)}
                  className={`no-print w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all shrink-0 ${done ? 'bg-green-600 border-green-600 cursor-default' : 'bg-transparent border-red-600 hover:border-green-500 hover:bg-green-600/20 cursor-pointer'}`}
                >
                  {done
                    ? <span className="text-white text-xs font-black">✓</span>
                    : <span className="text-zinc-600 text-xs font-black">✓</span>
                  }
                </button>
                <span className={`text-sm font-black uppercase tracking-tight italic ${done ? 'line-through opacity-50' : ''}`}>
                  {task.task_description}
                </span>
              </div>
              {!done && (
                <button onClick={() => deleteTask(task.id)} className="no-print text-zinc-800 hover:text-red-600 px-3 transition-colors text-lg font-bold shrink-0">✕</button>
              )}
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
