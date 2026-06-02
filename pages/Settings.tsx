import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  Save, User, Lock, Bell, Shield, CheckCircle2, AlertCircle,
  Building2, Calendar, Plus, Trash2, Star, Palette,
} from 'lucide-react';
import { School, SchoolTerm, UserRole } from '../types';

export const Settings: React.FC = () => {
  const { user, updateUser, effectiveSchoolId } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;

  type Tab = 'profile' | 'security' | 'notifications' | 'school' | 'terms';
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const flash = (msg: string, type: 'success' | 'error') => {
    if (type === 'success') { setSuccessMessage(msg); setErrorMessage(''); }
    else { setErrorMessage(msg); setSuccessMessage(''); }
    setTimeout(() => { setSuccessMessage(''); setErrorMessage(''); }, 3500);
  };

  // ── Profile ───────────────────────────────────────────────────────────────
  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    bio: user?.bio || '',
  });

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await api.updateUserProfile(user.id, {
        name: profile.name,
        phone: profile.phone,
        bio: profile.bio,
      });
      if (res.ok) { updateUser(res.data); flash('Profile saved.', 'success'); }
      else flash(res.message || 'Failed to save.', 'error');
    } catch { flash('Unexpected error.', 'error'); }
    finally { setIsLoading(false); }
  };

  // ── School Branding ───────────────────────────────────────────────────────
  const [school, setSchool] = useState<School | null>(null);
  const [branding, setBranding] = useState<{
    name: string; motto: string; address: string; contact: string; logoUrl: string;
    adminName: string; principalName: string; principalSignatureUrl: string;
    schoolStampUrl: string; themeColor: string;
    gradingSystem: 'nigeria' | 'british' | 'american';
  }>({
    name: '',
    motto: '',
    address: '',
    contact: '',
    logoUrl: '',
    adminName: '',
    principalName: '',
    principalSignatureUrl: '',
    schoolStampUrl: '',
    themeColor: '#059669',
    gradingSystem: 'nigeria',
  });

  useEffect(() => {
    if (!isAdmin || !effectiveSchoolId) return;
    api.getSchools().then((res) => {
      if (!res.ok) return;
      const s = res.data.find((sc) => sc.id === effectiveSchoolId) || res.data[0] || null;
      if (s) {
        setSchool(s);
        setBranding({
          name: s.name || '',
          motto: s.motto || '',
          address: s.address || '',
          contact: s.contact || '',
          logoUrl: s.logoUrl || '',
          adminName: s.adminName || '',
          principalName: s.principalName || '',
          principalSignatureUrl: s.principalSignatureUrl || '',
          schoolStampUrl: s.schoolStampUrl || '',
          themeColor: s.themeColor || '#059669',
          gradingSystem: (s.gradingSystem as 'nigeria' | 'british' | 'american') || 'nigeria',
        });
      }
    });
  }, [isAdmin, effectiveSchoolId]);

  const handleSaveBranding = async () => {
    if (!school) return;
    setIsLoading(true);
    try {
      const res = await api.updateSchoolBranding(school.id, branding);
      if (res.ok) flash('School profile saved.', 'success');
      else flash(res.message || 'Failed to save.', 'error');
    } catch { flash('Unexpected error.', 'error'); }
    finally { setIsLoading(false); }
  };

  // ── Academic Terms ────────────────────────────────────────────────────────
  const [terms, setTerms] = useState<SchoolTerm[]>([]);
  const [termsLoading, setTermsLoading] = useState(false);
  const [showTermForm, setShowTermForm] = useState(false);
  const [termForm, setTermForm] = useState({
    name: '',
    session: '',
    term: 'first' as 'first' | 'second' | 'third',
    startDate: '',
    endDate: '',
    isCurrent: false,
  });

  const loadTerms = async () => {
    if (!effectiveSchoolId) return;
    setTermsLoading(true);
    const res = await api.getTerms(effectiveSchoolId);
    if (res.ok) setTerms(res.data);
    setTermsLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'terms') loadTerms();
  }, [activeTab, effectiveSchoolId]);

  const handleCreateTerm = async () => {
    if (!effectiveSchoolId || !termForm.name || !termForm.session || !termForm.startDate || !termForm.endDate) {
      flash('Fill in all term fields.', 'error'); return;
    }
    setIsLoading(true);
    try {
      const res = await api.createTerm({ ...termForm, schoolId: effectiveSchoolId });
      if (res.ok) {
        flash('Term created.', 'success');
        setShowTermForm(false);
        setTermForm({ name: '', session: '', term: 'first', startDate: '', endDate: '', isCurrent: false });
        loadTerms();
      } else flash(res.message || 'Failed to create term.', 'error');
    } catch { flash('Unexpected error.', 'error'); }
    finally { setIsLoading(false); }
  };

  const handleSetCurrentTerm = async (termId: string) => {
    const res = await api.setCurrentTerm(termId);
    if (res.ok) { flash('Current term updated.', 'success'); loadTerms(); }
    else flash(res.message || 'Failed.', 'error');
  };

  const handleDeleteTerm = async (termId: string) => {
    const res = await api.deleteTerm(termId);
    if (res.ok) { flash('Term deleted.', 'success'); loadTerms(); }
    else flash(res.message || 'Failed.', 'error');
  };

  // ── Shared action footer ──────────────────────────────────────────────────
  const showSaveButton = activeTab === 'profile' || activeTab === 'school';
  const handleSave = activeTab === 'school' ? handleSaveBranding : handleSaveProfile;

  const tabs = [
    { id: 'profile' as Tab, label: 'Profile', icon: User },
    { id: 'security' as Tab, label: 'Security', icon: Lock },
    { id: 'notifications' as Tab, label: 'Notifications', icon: Bell },
    ...(isAdmin ? [{ id: 'school' as Tab, label: 'School', icon: Building2 }] : []),
    ...(isAdmin ? [{ id: 'terms' as Tab, label: 'Terms', icon: Calendar }] : []),
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500">Manage your account, school profile, and academic terms.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[600px]">
        {/* Sidebar */}
        <div className="w-full md:w-64 bg-gray-50 border-b md:border-b-0 md:border-r border-gray-200 p-4">
          <nav className="space-y-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === id ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 p-8 overflow-y-auto">

          {/* ── Profile Tab ── */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="flex items-center gap-6 mb-8">
                <img src={user?.avatar} alt="Profile" className="w-24 h-24 rounded-full border-4 border-gray-100 shadow-sm object-cover" />
                <div>
                  <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    Change Avatar
                  </button>
                  <p className="text-xs text-gray-500 mt-2">JPG, GIF or PNG. Max 800K</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input type="text" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input type="email" value={profile.email} disabled
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-gray-100 text-gray-500 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                  <textarea rows={4} value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none" />
                </div>
              </div>
            </div>
          )}

          {/* ── Security Tab ── */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 text-amber-800 text-sm">
                <Shield size={20} className="flex-shrink-0" />
                <p>Major account changes may require email verification.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                  <input type="password" className="w-full max-w-md border border-gray-300 rounded-lg p-2.5 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                  <input type="password" className="w-full max-w-md border border-gray-300 rounded-lg p-2.5 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                  <input type="password" className="w-full max-w-md border border-gray-300 rounded-lg p-2.5 text-sm" />
                </div>
              </div>
            </div>
          )}

          {/* ── Notifications Tab ── */}
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              {['Email me when a student submits an exam', 'Email me daily summary reports', 'Notify me about system maintenance'].map((label, i) => (
                <label key={i} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" defaultChecked={i === 0} className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500" />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          )}

          {/* ── School Branding Tab ── */}
          {activeTab === 'school' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">School Name</label>
                  <input type="text" value={branding.name} onChange={(e) => setBranding({ ...branding, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Admin Name</label>
                  <input type="text" value={branding.adminName} onChange={(e) => setBranding({ ...branding, adminName: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Principal Name</label>
                  <input type="text" value={branding.principalName} onChange={(e) => setBranding({ ...branding, principalName: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
                  <input type="text" value={branding.contact} onChange={(e) => setBranding({ ...branding, contact: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input type="text" value={branding.address} onChange={(e) => setBranding({ ...branding, address: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">School Motto</label>
                  <input type="text" value={branding.motto} onChange={(e) => setBranding({ ...branding, motto: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                  <input type="url" value={branding.logoUrl} onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Principal Signature URL</label>
                  <input type="url" value={branding.principalSignatureUrl} onChange={(e) => setBranding({ ...branding, principalSignatureUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">School Stamp URL</label>
                  <input type="url" value={branding.schoolStampUrl} onChange={(e) => setBranding({ ...branding, schoolStampUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <Palette size={14} /> Theme Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={branding.themeColor}
                      onChange={(e) => setBranding({ ...branding, themeColor: e.target.value })}
                      className="h-10 w-14 rounded border border-gray-300 cursor-pointer" />
                    <input type="text" value={branding.themeColor}
                      onChange={(e) => setBranding({ ...branding, themeColor: e.target.value })}
                      className="w-32 border border-gray-300 rounded-lg p-2.5 text-sm font-mono" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Grading System</label>
                  <select value={branding.gradingSystem} onChange={(e) => setBranding({ ...branding, gradingSystem: e.target.value as 'nigeria' | 'british' | 'american' })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                    <option value="nigeria">Nigerian (A1–F9)</option>
                    <option value="british">British (A*–F)</option>
                    <option value="american">American (A–F)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ── Academic Terms Tab ── */}
          {activeTab === 'terms' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">Academic Terms</h3>
                <button
                  onClick={() => setShowTermForm((v) => !v)}
                  className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
                >
                  <Plus size={15} /> New Term
                </button>
              </div>

              {showTermForm && (
                <div className="border border-gray-200 rounded-xl p-5 bg-gray-50 space-y-4">
                  <h4 className="text-sm font-semibold text-gray-800">Create Term</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Display Name</label>
                      <input type="text" placeholder="First Term 2024/2025" value={termForm.name}
                        onChange={(e) => setTermForm({ ...termForm, name: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Session</label>
                      <input type="text" placeholder="2024/2025" value={termForm.session}
                        onChange={(e) => setTermForm({ ...termForm, session: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Term</label>
                      <select value={termForm.term} onChange={(e) => setTermForm({ ...termForm, term: e.target.value as any })}
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm">
                        <option value="first">First</option>
                        <option value="second">Second</option>
                        <option value="third">Third</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                      <input type="date" value={termForm.startDate}
                        onChange={(e) => setTermForm({ ...termForm, startDate: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                      <input type="date" value={termForm.endDate}
                        onChange={(e) => setTermForm({ ...termForm, endDate: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm" />
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <input type="checkbox" id="isCurrent" checked={termForm.isCurrent}
                        onChange={(e) => setTermForm({ ...termForm, isCurrent: e.target.checked })}
                        className="w-4 h-4 text-primary-600 rounded border-gray-300" />
                      <label htmlFor="isCurrent" className="text-sm text-gray-700">Set as current term</label>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={handleCreateTerm} disabled={isLoading}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-60">
                      {isLoading ? 'Creating…' : 'Create Term'}
                    </button>
                    <button onClick={() => setShowTermForm(false)}
                      className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {termsLoading && <div className="py-8 text-center text-sm text-gray-400">Loading terms…</div>}
              {!termsLoading && terms.length === 0 && (
                <div className="py-8 text-center text-sm text-gray-400">No terms created yet. Create your first academic term above.</div>
              )}

              <div className="space-y-3">
                {terms.map((t) => (
                  <div key={t.id} className={`flex items-center justify-between p-4 rounded-xl border ${t.isCurrent ? 'border-primary-200 bg-primary-50' : 'border-gray-200 bg-white'}`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                        {t.isCurrent && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-primary-100 text-primary-700 rounded-full">
                            <Star size={9} /> Current
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(t.startDate).toLocaleDateString()} – {new Date(t.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!t.isCurrent && (
                        <button onClick={() => handleSetCurrentTerm(t.id)}
                          className="text-xs text-primary-600 hover:text-primary-800 font-medium px-2 py-1 rounded border border-primary-200 hover:bg-primary-50">
                          Set Current
                        </button>
                      )}
                      <button onClick={() => handleDeleteTerm(t.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Save / Feedback Footer ── */}
          {showSaveButton && (
            <div className="mt-8 pt-6 border-t border-gray-200 flex items-center justify-end gap-4">
              {errorMessage && (
                <div className="text-red-600 text-sm flex items-center gap-2">
                  <AlertCircle size={16} /> {errorMessage}
                </div>
              )}
              {successMessage && (
                <div className="text-green-600 text-sm flex items-center gap-2">
                  <CheckCircle2 size={16} /> {successMessage}
                </div>
              )}
              <button onClick={handleSave} disabled={isLoading}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-70">
                {isLoading ? 'Saving…' : <><Save size={16} /> Save Changes</>}
              </button>
            </div>
          )}

          {activeTab === 'terms' && (errorMessage || successMessage) && (
            <div className="mt-4">
              {errorMessage && (
                <div className="text-red-600 text-sm flex items-center gap-2">
                  <AlertCircle size={16} /> {errorMessage}
                </div>
              )}
              {successMessage && (
                <div className="text-green-600 text-sm flex items-center gap-2">
                  <CheckCircle2 size={16} /> {successMessage}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
