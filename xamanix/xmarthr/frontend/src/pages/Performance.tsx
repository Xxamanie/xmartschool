import { useEffect, useState } from 'react';
import { get, post, patch, errorMessage } from '../lib/api';
import { PageHeader, Spinner, EmptyState, StatusBadge, Modal } from '../components/ui';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import type { ReviewCycle, Review, Goal, Employee } from '../lib/types';

const Stars = ({ n }: { n: number }) => <span className="text-amber-500">{'★'.repeat(n)}<span className="text-slate-200">{'★'.repeat(Math.max(0, 5 - n))}</span></span>;

export default function Performance() {
  const toast = useToast();
  const { user } = useAuth();
  const isManager = user ? ['OWNER', 'HR_ADMIN', 'MANAGER'].includes(user.role) : false;

  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myReviews, setMyReviews] = useState<Review[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const [editReview, setEditReview] = useState<Review | null>(null);
  const [reviewForm, setReviewForm] = useState({ overallRating: 3, strengths: '', improvements: '', comments: '' });
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalForm, setGoalForm] = useState({ title: '', description: '', dueDate: '' });

  const load = () => {
    const calls: Promise<unknown>[] = [];
    if (user?.employeeId) {
      calls.push(get<Review[]>('/performance/reviews/me').then(setMyReviews).catch(() => {}));
      calls.push(get<Goal[]>('/performance/goals/me').then(setGoals).catch(() => {}));
    }
    if (isManager) {
      calls.push(get<ReviewCycle[]>('/performance/cycles').then(setCycles).catch(() => {}));
      calls.push(get<Review[]>('/performance/reviews').then(setReviews).catch(() => {}));
      calls.push(get<Employee[]>('/employees').then(setEmployees).catch(() => {}));
    }
    Promise.all(calls).finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openEdit = (r: Review) => {
    setEditReview(r);
    setReviewForm({ overallRating: r.overallRating || 3, strengths: r.strengths ?? '', improvements: r.improvements ?? '', comments: r.comments ?? '' });
  };
  const saveReview = async (submit: boolean) => {
    if (!editReview) return;
    try {
      await patch(`/performance/reviews/${editReview.id}`, { ...reviewForm, status: submit ? 'Submitted' : 'Draft' });
      toast.push('success', submit ? 'Review submitted' : 'Draft saved');
      setEditReview(null);
      load();
    } catch (e) { toast.push('error', errorMessage(e)); }
  };

  const createCycleReview = async (cycleId: string, employeeId: string) => {
    try { await post('/performance/reviews', { cycleId, employeeId }); toast.push('success', 'Review created'); load(); }
    catch (e) { toast.push('error', errorMessage(e)); }
  };

  const addGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await post('/performance/goals/me', { title: goalForm.title, description: goalForm.description || undefined, dueDate: goalForm.dueDate || undefined }); toast.push('success', 'Goal added'); setGoalOpen(false); setGoalForm({ title: '', description: '', dueDate: '' }); load(); }
    catch (err) { toast.push('error', errorMessage(err)); }
  };
  const advanceGoal = async (g: Goal) => {
    const next = g.status === 'Open' ? 'InProgress' : g.status === 'InProgress' ? 'Done' : g.status;
    if (next === g.status) return;
    try { await patch(`/performance/goals/${g.id}`, { status: next }); load(); } catch (e) { toast.push('error', errorMessage(e)); }
  };

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Performance" subtitle={isManager ? 'Review cycles, reviews and goals' : 'Your reviews and goals'} />

      {/* My goals — everyone with a profile */}
      {user?.employeeId && (
        <div className="card overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="font-semibold text-slate-700">My goals</span>
            <button className="text-sm text-brand-700 hover:underline" onClick={() => setGoalOpen(true)}>+ Add goal</button>
          </div>
          {goals.length === 0 ? <EmptyState message="No goals yet." /> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {goals.map((g) => (
                <li key={g.id} className="px-4 py-3 flex items-center justify-between">
                  <div><div className="font-medium text-slate-800">{g.title}</div>{g.description && <div className="text-xs text-slate-400">{g.description}</div>}</div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={g.status} />
                    {g.status !== 'Done' && g.status !== 'Cancelled' && <button className="text-xs text-brand-700 hover:underline" onClick={() => advanceGoal(g)}>{g.status === 'Open' ? 'Start' : 'Complete'}</button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* My reviews */}
      {user?.employeeId && (
        <div className="card overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700">My reviews</div>
          {myReviews.length === 0 ? <EmptyState message="No reviews yet." /> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {myReviews.map((r) => (
                <li key={r.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800">{r.cycle?.name}</span>
                    <span className="flex items-center gap-2">{r.status === 'Submitted' && <Stars n={r.overallRating} />}<StatusBadge status={r.status} /></span>
                  </div>
                  {r.status === 'Submitted' && (r.strengths || r.improvements) && (
                    <div className="text-xs text-slate-500 mt-1">{r.strengths && <span><b>Strengths:</b> {r.strengths} </span>}{r.improvements && <span>· <b>Improve:</b> {r.improvements}</span>}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Manager: cycles + reviews */}
      {isManager && (
        <>
          <div className="card overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700">Review cycles</div>
            {cycles.length === 0 ? <EmptyState message="No cycles yet." /> : (
              <ul className="divide-y divide-slate-100 text-sm">
                {cycles.map((c) => (
                  <li key={c.id} className="px-4 py-3 flex items-center justify-between">
                    <span className="font-medium text-slate-800">{c.name} <span className="text-xs text-slate-400">{c._count?.reviews ?? 0} reviews</span></span>
                    <span className="flex items-center gap-2">
                      <StatusBadge status={c.status} />
                      <select className="input max-w-[12rem]" defaultValue="" onChange={(e) => { if (e.target.value) createCycleReview(c.id, e.target.value); e.currentTarget.value = ''; }}>
                        <option value="">+ Add review for…</option>
                        {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>)}
                      </select>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700">Reviews</div>
            {reviews.length === 0 ? <EmptyState message="No reviews yet." /> : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-left"><tr><th className="px-4 py-2 font-medium">Employee</th><th className="px-4 py-2 font-medium">Cycle</th><th className="px-4 py-2 font-medium">Rating</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium text-right">Action</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {reviews.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2 font-medium text-slate-800">{r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—'}</td>
                      <td className="px-4 py-2 text-slate-600">{r.cycle?.name}</td>
                      <td className="px-4 py-2">{r.overallRating ? <Stars n={r.overallRating} /> : '—'}</td>
                      <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-2 text-right"><button className="text-brand-700 hover:underline" onClick={() => openEdit(r)}>{r.status === 'Submitted' ? 'View' : 'Fill in'}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      <Modal open={!!editReview} onClose={() => setEditReview(null)} title={editReview?.employee ? `Review — ${editReview.employee.firstName} ${editReview.employee.lastName}` : 'Review'}>
        <div className="space-y-4">
          <div>
            <label className="label">Overall rating</label>
            <select className="input" value={reviewForm.overallRating} onChange={(e) => setReviewForm({ ...reviewForm, overallRating: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} / 5</option>)}
            </select>
          </div>
          <div><label className="label">Strengths</label><textarea className="input" rows={2} value={reviewForm.strengths} onChange={(e) => setReviewForm({ ...reviewForm, strengths: e.target.value })} /></div>
          <div><label className="label">Areas to improve</label><textarea className="input" rows={2} value={reviewForm.improvements} onChange={(e) => setReviewForm({ ...reviewForm, improvements: e.target.value })} /></div>
          <div><label className="label">Comments</label><textarea className="input" rows={2} value={reviewForm.comments} onChange={(e) => setReviewForm({ ...reviewForm, comments: e.target.value })} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={() => saveReview(false)}>Save draft</button>
            <button className="btn-primary" onClick={() => saveReview(true)}>Submit</button>
          </div>
        </div>
      </Modal>

      <Modal open={goalOpen} onClose={() => setGoalOpen(false)} title="Add goal">
        <form onSubmit={addGoal} className="space-y-4">
          <div><label className="label">Title</label><input className="input" value={goalForm.title} onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })} required /></div>
          <div><label className="label">Description</label><input className="input" value={goalForm.description} onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })} /></div>
          <div><label className="label">Due date</label><input type="date" className="input" value={goalForm.dueDate} onChange={(e) => setGoalForm({ ...goalForm, dueDate: e.target.value })} /></div>
          <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-ghost" onClick={() => setGoalOpen(false)}>Cancel</button><button type="submit" className="btn-primary">Add goal</button></div>
        </form>
      </Modal>
    </>
  );
}
