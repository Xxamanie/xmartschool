import { useEffect, useState } from 'react';
import { get, patch, errorMessage } from '../lib/api';
import { PageHeader, Spinner, EmptyState, StatusBadge } from '../components/ui';
import { useToast } from '../components/Toast';
import type { HousekeepingTask } from '../lib/types';

const NEXT: Record<string, HousekeepingTask['status'] | undefined> = {
  Pending: 'InProgress',
  InProgress: 'Done',
};

export default function Housekeeping() {
  const toast = useToast();
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    get<HousekeepingTask[]>('/housekeeping/tasks')
      .then(setTasks)
      .catch((e) => toast.push('error', errorMessage(e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const advance = async (task: HousekeepingTask) => {
    const next = NEXT[task.status];
    if (!next) return;
    try {
      await patch(`/housekeeping/tasks/${task.id}`, { status: next });
      toast.push('success', `Task ${next === 'Done' ? 'completed' : 'started'}`);
      load();
    } catch (e) {
      toast.push('error', errorMessage(e));
    }
  };

  if (loading) return <Spinner />;

  const active = tasks.filter((t) => t.status !== 'Done' && t.status !== 'Inspected');
  const done = tasks.filter((t) => t.status === 'Done' || t.status === 'Inspected');

  return (
    <>
      <PageHeader title="Housekeeping" subtitle={`${active.length} active tasks`} />

      <div className="card overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700">Active</div>
        {active.length === 0 ? <EmptyState message="All rooms are clean. Nothing pending." /> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Room</th>
                <th className="px-4 py-3 font-medium">Task</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {active.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{t.room?.number ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{t.type}</td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <button className="btn-primary" onClick={() => advance(t)}>
                      {t.status === 'Pending' ? 'Start' : 'Mark done'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700">Completed today</div>
        {done.length === 0 ? <EmptyState message="No completed tasks yet." /> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {done.map((t) => (
              <li key={t.id} className="px-4 py-3 flex justify-between">
                <span className="text-slate-700">Room {t.room?.number ?? '—'} · {t.type}</span>
                <StatusBadge status={t.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
