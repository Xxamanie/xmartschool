import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { supabaseAuthService } from '../src/services/supabaseAuthService';
import {
  Save, User, Lock, Bell, Shield, CheckCircle2, AlertCircle,
  Building2, Calendar, Plus, Trash2, Star, Palette, Eye, EyeOff, ClipboardList,
} from 'lucide-react';
import { School, SchoolTerm, UserRole } from '../types';

export const Settings: React.FC = () => {
  const { user, updateUser, effectiveSchoolId } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;

  type Tab = 'profile' | 'security' | 'notifications' | 'school' | 'terms' | 'audit';
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
    if (activeTab === 'audit') loadAuditLogs();
  }, [activeTab, effectiveSchoolId]);

  // ── Audit Logs ────────────────────────────────────────────────────────────
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const loadAuditLogs = async () => {
    if (!effectiveSchoolId) return;
    setAuditLoading(true);
    const res = await api.getAuditLogs(effectiveSchoolId, 200);
    if (res.ok) setAuditLogs(res.data);
    setAuditLoading(false);
  };

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

  // ── Notification Preferences ─────────────────────────────────────────────
  const NOTIF_PREFS_KEY = `notif_prefs_${user?.id ?? 'anon'}`;

  const defaultPrefs = {
    examSubmission: true,
    resultsPublished: true,
    paymentReceived: false,
    newAnnouncement: true,
    dailySummary: false,
    systemMaintenance: false,
  };

  type NotifPrefs = typeof defaultPrefs;

  const loadPrefs = (): NotifPrefs => {
    try {
      const stored = localStorage.getItem(NOTIF_PREFS_KEY);
      return stored ? { ...defaultPrefs, ...JSON.parse(stored) } : defaultPrefs;
    } catch { return defaultPrefs; }
  };

  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(loadPrefs);
  const [notifSaved, setNotifSaved] = useState(false);

  const handleSaveNotifPrefs = () => {
    localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(notifPrefs));
    setNotifSaved(true);
    setTimeout(() => setNotifSaved(false), 2500);
  };

  const NOTIF_OPTIONS: { key: keyof NotifPrefs; label: string; desc: string }[] = [
    { key: 'examSubmission', label: 'Exam submitted', desc: 'In-app alert when a student submits an exam' },
    { key: 'resultsPublished', label: 'Results published', desc: 'Notify me when academic results are published' },
    { key: 'paymentReceived', label: 'Payment recorded', desc: 'Alert when a fee payment is recorded for any student' },
    { key: 'newAnnouncement', label: 'New announcement', desc: 'Show in-app banner when a new announcement is posted' },
    { key: 'dailySummary', label: 'Daily summary', desc: 'Receive a daily summary of school activity' },
    { key: 'systemMaintenance', label: 'System maintenance', desc: 'Alerts about planned maintenance windows' },
  ];

  // ── Security / Password change ────────────────────────────────────────────
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwVisible, setPwVisible] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!pwForm.next || pwForm.next !== pwForm.confirm) {
      flash('New passwords do not match.', 'error'); return;
    }
    if (pwForm.next.length < 8) {
      flash('Password must be at least 8 characters.', 'error'); return;
    }
    setPwLoading(true);
    try {
      // Try Supabase first (production), then fall back to backend (demo mode)
      if (supabaseAuthService.isConfigured()) {
        await supabaseAuthService.updatePassword(pwForm.next);
        flash('Password updated via Supabase.', 'success');
      } else {
        const res = await api.changePassword(pwForm.current, pwForm.next);
        if (res.ok) flash('Password changed successfully.', 'success');
        else flash(res.message || 'Failed to change password.', 'error');
      }
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (e: any) {
      flash(e.message || 'Failed to change password.', 'error');
    } finally {
      setPwLoading(false);
    }
  };

  // ── Shared action footer ──────────────────────────────────────────────────
  const showSaveButton = activeTab === 'profile' || activeTab === 'school';
  // security and notifications have their own inline save controls
  const handleSave = activeTab === 'school' ? handleSaveBranding : handleSaveProfile;

  const tabs = [
    { id: 'profile' as Tab, label: 'Profile', icon: User },
    { id: 'security' as Tab, label: 'Security', icon: Lock },
    { id: 'notifications' as Tab, label: 'Notifications', icon: Bell },
    ...(isAdmin ? [{ id: 'school' as Tab, label: 'School', icon: Building2 }] : []),
    ...(isAdmin ? [{ id: 'terms' as Tab, label: 'Terms', icon: Calendar }] : []),
    ...(isAdmin ? [{ id: 'audit' as Tab, label: 'Activity Log', icon: ClipboardList }] : []),
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
                  <label htmlFor="profile-name" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input id="profile-name" name="name" type="text" autoComplete="name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                </div>
                <div>
                  <label htmlFor="profile-email" className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input id="profile-email" name="email" type="email" autoComplete="email" value={profile.email} disabled
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-gray-100 text-gray-500 cursor-not-allowed" />
                </div>
                <div>
                  <label htmlFor="profile-phone" className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input id="profile-phone" name="tel" type="tel" autoComplete="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="profile-bio" className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                  <textarea id="profile-bio" name="bio" rows={4} value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none" />
                </div>
              </div>
            </div>
          )}

          {/* ── Security Tab ── */}
          {activeTab === 'security' && (
            <div className="space-y-6 max-w-md">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 text-amber-800 text-sm">
                <Shield size={20} className="flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Change Password</p>
                  <p className="mt-0.5 text-amber-700">Password must be at least 8 characters. You will remain logged in after changing.</p>
                </div>
              </div>

              {!supabaseAuthService.isConfigured() && (
                <div>
                  <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                  <div className="relative">
                    <input
                      id="current-password"
                      name="current-password"
                      type={pwVisible ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={pwForm.current}
                      onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-2.5 pr-10 text-sm focus:ring-2 focus:ring-primary-500"
                      placeholder="Your current password"
                    />
                    <button type="button" onClick={() => setPwVisible(v => !v)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                      {pwVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  id="new-password"
                  name="new-password"
                  type={pwVisible ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={pwForm.next}
                  onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500"
                  placeholder="At least 8 characters"
                />
                {pwForm.next.length > 0 && (
                  <div className="mt-1.5 flex gap-1">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className={`h-1 flex-1 rounded-full ${
                        pwForm.next.length >= (i + 1) * 3
                          ? i < 2 ? 'bg-red-400' : i === 2 ? 'bg-amber-400' : 'bg-emerald-500'
                          : 'bg-gray-200'
                      }`} />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type={pwVisible ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                  className={`w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 ${
                    pwForm.confirm && pwForm.confirm !== pwForm.next ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Repeat new password"
                />
                {pwForm.confirm && pwForm.confirm !== pwForm.next && (
                  <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                )}
              </div>

              {(errorMessage || successMessage) && (
                <div className={`text-sm flex items-center gap-2 ${errorMessage ? 'text-red-600' : 'text-green-600'}`}>
                  {errorMessage ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
                  {errorMessage || successMessage}
                </div>
              )}

              <button
                onClick={handleChangePassword}
                disabled={pwLoading || !pwForm.next || !pwForm.confirm}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-60"
              >
                {pwLoading ? 'Saving…' : <><Lock size={15} /> Update Password</>}
              </button>
            </div>
          )}

          {/* ── Notifications Tab ── */}
          {activeTab === 'notifications' && (
            <div className="space-y-6 max-w-lg">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">In-App Notification Preferences</h3>
                <p className="text-xs text-gray-500 mb-4">
                  Choose which events trigger a notification for you. Preferences are saved locally on this device.
                </p>
                <div className="space-y-2">
                  {NOTIF_OPTIONS.map(({ key, label, desc }) => (
                    <label
                      key={key}
                      className={`flex items-start gap-3 p-3.5 border rounded-xl cursor-pointer transition-colors ${
                        notifPrefs[key]
                          ? 'border-primary-200 bg-primary-50/40'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        id={`notif-${key}`}
                        name={`notif-${key}`}
                        type="checkbox"
                        checked={notifPrefs[key]}
                        onChange={(e) => setNotifPrefs(p => ({ ...p, [key]: e.target.checked }))}
                        className="mt-0.5 w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500 flex-shrink-0"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-800 leading-none">{label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSaveNotifPrefs}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
                >
                  <Save size={15} /> Save Preferences
                </button>
                {notifSaved && (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                    <CheckCircle2 size={15} /> Saved
                  </span>
                )}
              </div>

              <div className="border-t border-gray-200 pt-4 text-xs text-gray-400">
                Email and SMS delivery are not yet configured. These preferences control in-app alerts only.
              </div>
            </div>
          )}

          {/* ── School Branding Tab ── */}
          {activeTab === 'school' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">School Name</label>
                  <input id="school-name" name="school-name" type="text" value={branding.name} onChange={(e) => setBranding({ ...branding, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Admin Name</label>
                  <input id="admin-name" name="admin-name" type="text" value={branding.adminName} onChange={(e) => setBranding({ ...branding, adminName: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Principal Name</label>
                  <input id="principal-name" name="principal-name" type="text" value={branding.principalName} onChange={(e) => setBranding({ ...branding, principalName: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
                  <input id="school-contact" name="school-contact" type="text" value={branding.contact} onChange={(e) => setBranding({ ...branding, contact: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input id="school-address" name="school-address" type="text" value={branding.address} onChange={(e) => setBranding({ ...branding, address: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">School Motto</label>
                  <input id="school-motto" name="school-motto" type="text" value={branding.motto} onChange={(e) => setBranding({ ...branding, motto: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                  <input id="logo-url" name="logo-url" type="url" value={branding.logoUrl} onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Principal Signature URL</label>
                  <input id="signature-url" name="signature-url" type="url" value={branding.principalSignatureUrl} onChange={(e) => setBranding({ ...branding, principalSignatureUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">School Stamp URL</label>
                  <input id="stamp-url" name="stamp-url" type="url" value={branding.schoolStampUrl} onChange={(e) => setBranding({ ...branding, schoolStampUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <Palette size={14} /> Theme Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input id="theme-color-picker" name="theme-color-picker" type="color" value={branding.themeColor}
                      onChange={(e) => setBranding({ ...branding, themeColor: e.target.value })}
                      className="h-10 w-14 rounded border border-gray-300 cursor-pointer" />
                    <input id="theme-color-text" name="theme-color-text" type="text" value={branding.themeColor}
                      onChange={(e) => setBranding({ ...branding, themeColor: e.target.value })}
                      className="w-32 border border-gray-300 rounded-lg p-2.5 text-sm font-mono" />
                  </div>
                </div>
                <div>
                  <label htmlFor="grading-system" className="block text-sm font-medium text-gray-700 mb-1">Grading System</label>
                  <select id="grading-system" name="grading-system" value={branding.gradingSystem} onChange={(e) => setBranding({ ...branding, gradingSystem: e.target.value as 'nigeria' | 'british' | 'american' })}
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
                      <label htmlFor="term-name" className="block text-xs font-medium text-gray-600 mb-1">Display Name</label>
                      <input id="term-name" name="term-name" type="text" placeholder="First Term 2024/2025" value={termForm.name}
                        onChange={(e) => setTermForm({ ...termForm, name: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm" />
                    </div>
                    <div>
                      <label htmlFor="term-session" className="block text-xs font-medium text-gray-600 mb-1">Session</label>
                      <input id="term-session" name="term-session" type="text" placeholder="2024/2025" value={termForm.session}
                        onChange={(e) => setTermForm({ ...termForm, session: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm" />
                    </div>
                    <div>
                      <label htmlFor="term-period" className="block text-xs font-medium text-gray-600 mb-1">Term</label>
                      <select id="term-period" name="term-period" value={termForm.term} onChange={(e) => setTermForm({ ...termForm, term: e.target.value as any })}
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm">
                        <option value="first">First</option>
                        <option value="second">Second</option>
                        <option value="third">Third</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="term-start" className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                      <input id="term-start" name="term-start" type="date" value={termForm.startDate}
                        onChange={(e) => setTermForm({ ...termForm, startDate: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm" />
                    </div>
                    <div>
                      <label htmlFor="term-end" className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                      <input id="term-end" name="term-end" type="date" value={termForm.endDate}
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

          {/* ── Activity Log Tab ── */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">Activity Log</h3>
                <button onClick={loadAuditLogs} disabled={auditLoading}
                  className="text-xs text-primary-600 hover:text-primary-800 font-medium px-3 py-1.5 border border-primary-200 rounded-lg hover:bg-primary-50 disabled:opacity-50">
                  {auditLoading ? 'Loading…' : 'Refresh'}
                </button>
              </div>

              {auditLoading && <div className="py-8 text-center text-sm text-gray-400">Loading activity log…</div>}
              {!auditLoading && auditLogs.length === 0 && (
                <div className="py-8 text-center text-sm text-gray-400">No activity recorded yet.</div>
              )}

              {!auditLoading && auditLogs.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 text-left">Time</th>
                        <th className="px-4 py-3 text-left">Actor</th>
                        <th className="px-4 py-3 text-left">Action</th>
                        <th className="px-4 py-3 text-left">Target</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {auditLogs.map((log: any, i: number) => (
                        <tr key={log.id ?? i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-800">
                            {log.actorName ?? log.actorId ?? '—'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                            {log.targetName ?? log.targetId ?? log.details ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
