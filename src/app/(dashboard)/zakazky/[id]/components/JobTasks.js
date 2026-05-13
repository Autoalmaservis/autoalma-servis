'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

export default function JobTasks({ jobId, onRefresh }) {
  const [tasks, setTasks] = useState([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [confirmTaskId, setConfirmTaskId] = useState(null);

  const fetchTasks = async () => {
    const { data } = await supabase
      .from('job_tasks')
      .select('id, task_description, is_completed')
      .eq('job_id', jobId)
      .eq('is_completed', false)
      .order('created_at', { ascending: true });
    if (data) setTasks(data);
  };

  useEffect(() => {
    fetchTasks();
    const sub = supabase
      .channel(`job-tasks-local-${jobId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_tasks', filter: `job_id=eq.${jobId}` }, fetchTasks)
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, [jobId]);

  const addTask = async (e) => {
    e.preventDefault();
    const text = newTaskText.trim();
    if (!text) return;
    const tempId = `temp-${Date.now()}`;
    setTasks(prev => [...prev, { id: tempId, task_description: text, is_completed: false }]);
    setNewTaskText('');
    const { data } = await supabase
      .from('job_tasks')
      .insert([{ job_id: jobId, task_description: text, is_completed: false }])
      .select('id, task_description, is_completed')
      .single();
    if (data) {
      setTasks(prev => prev.map(t => t.id === tempId ? data : t));
      onRefresh?.();
    }
  };

  const confirmDone = async (taskId) => {
    setConfirmTaskId(null);
    setTasks(prev => prev.filter(t => t.id !== taskId));
    await supabase.from('job_tasks').update({ is_completed: true }).eq('id', taskId);
    onRefresh?.();
  };

  const deleteTask = async (taskId) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    await supabase.from('job_tasks').delete().eq('id', taskId);
    onRefresh?.();
  };

  const total = tasks.length;

  return (
    <div className="space-y-4 font-bold">
      <div className="flex justify-between items-end">
        <h2 className="text-blue-500 font-black uppercase text-[10px] tracking-[0.3em] italic">1. Priebeh prác (Checklist)</h2>
        <span className="text-[9px] font-black text-zinc-500 uppercase">{total} zostatok</span>
      </div>
      <div className="bg-black/30 p-6 rounded-3xl border border-zinc-800 space-y-3 min-h-[140px]">
        {tasks.map((task) => {
          const isTemp = String(task.id).startsWith('temp-');
          const isConfirming = confirmTaskId === task.id;

          if (isConfirming) {
            return (
              <div key={task.id} className="p-4 rounded-2xl border border-green-600 bg-green-600/10 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-green-400">Máš túto úlohu hotovú?</p>
                <p className="text-sm font-black uppercase italic text-white">{task.task_description}</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => confirmDone(task.id)}
                    className="flex-1 bg-green-600 hover:bg-green-500 text-white font-black py-3 rounded-xl uppercase text-[10px] tracking-widest transition-all"
                  >
                    ✓ Áno
                  </button>
                  <button
                    onClick={() => setConfirmTaskId(null)}
                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white font-black py-3 rounded-xl uppercase text-[10px] tracking-widest transition-all"
                  >
                    Nie
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={task.id} className={`flex items-center justify-between p-4 rounded-2xl border border-red-600/30 bg-red-600/5 transition-all ${isTemp ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-4 flex-grow">
                <button
                  type="button"
                  disabled={isTemp}
                  onClick={() => setConfirmTaskId(task.id)}
                  className="no-print w-7 h-7 rounded-xl border-2 border-zinc-600 hover:border-green-500 hover:bg-green-600/20 flex items-center justify-center transition-all shrink-0 cursor-pointer disabled:opacity-30 disabled:cursor-default"
                >
                  <span className="text-zinc-500 text-xs font-black">✓</span>
                </button>
                <span className="text-sm font-black uppercase tracking-tight italic text-red-400">
                  {task.task_description}
                </span>
              </div>
              <button
                onClick={() => deleteTask(task.id)}
                className="no-print text-zinc-800 hover:text-red-600 px-3 transition-colors text-lg font-bold shrink-0"
              >
                ✕
              </button>
            </div>
          );
        })}

        {tasks.length === 0 && (
          <p className="text-center text-zinc-700 font-black uppercase text-[10px] tracking-widest italic py-4">Všetky úlohy splnené</p>
        )}

        <form onSubmit={addTask} className="flex gap-2 mt-4 no-print">
          <input
            type="text"
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            placeholder="+ Pridať ďalšiu úlohu..."
            className="flex-grow bg-black border border-zinc-800 p-3 rounded-xl text-[10px] font-bold uppercase outline-none focus:border-blue-600 transition-all italic tracking-widest"
          />
          <button type="submit" className="bg-zinc-800 px-4 rounded-xl hover:bg-blue-600 transition-all font-black text-lg">+</button>
        </form>
      </div>
    </div>
  );
}
