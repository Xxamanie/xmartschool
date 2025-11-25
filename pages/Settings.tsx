import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Save, User, Lock, Bell, Shield, CheckCircle2, AlertCircle } from 'lucide-react';

export const Settings: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications'>('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '+1 (555) 000-0000',
    bio: user?.bio || 'Passionate educator dedicated to student success.',
  });

  const handleSave = async () => {
    if (!user) return;
    setIsLoading(true);
    setSuccessMessage('');
    setErrorMessage('');
    
    try {
        const res = await api.updateUserProfile(user.id, {
            name: profile.name,
            phone: profile.phone,
            bio: profile.bio
        });

        if (res.ok) {
            updateUser(res.data); // Update context immediately
            setSuccessMessage('Settings updated successfully!');
            setTimeout(() => setSuccessMessage(''), 3000);
        } else {
            setErrorMessage(res.message || 'Failed to update profile');
        }
    } catch (e) {
        setErrorMessage('An unexpected error occurred.');
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500">Manage your account preferences and profile information.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[600px]">
        {/* Sidebar */}
        <div className="w-full md:w-64 bg-gray-50 border-b md:border-b-0 md:border-r border-gray-200 p-4">
           <nav className="space-y-1">
              <button
                onClick={() => setActiveTab('profile')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'profile' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                 <User size={18} />
                 Profile
              </button>
              <button
                onClick={() => setActiveTab('security')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'security' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                 <Lock size={18} />
                 Security
              </button>
              <button
                onClick={() => setActiveTab('notifications')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'notifications' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                 <Bell size={18} />
                 Notifications
              </button>
           </nav>
        </div>

        {/* Content */}
        <div className="flex-1 p-8">
           {activeTab === 'profile' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                 <div className="flex items-center gap-6 mb-8">
                    <img src={user?.avatar} alt="Profile" className="w-24 h-24 rounded-full border-4 border-gray-100 shadow-sm object-cover" />
                    <div>
                       <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                          Change Avatar
                       </button>
                       <p className="text-xs text-gray-500 mt-2">JPG, GIF or PNG. Max size of 800K</p>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                       <input 
                         type="text" 
                         value={profile.name}
                         onChange={(e) => setProfile({...profile, name: e.target.value})}
                         className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                       />
                    </div>
                    <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                       <input 
                         type="email" 
                         value={profile.email}
                         disabled
                         className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-gray-100 text-gray-500 cursor-not-allowed"
                       />
                    </div>
                    <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                       <input 
                         type="tel" 
                         value={profile.phone}
                         onChange={(e) => setProfile({...profile, phone: e.target.value})}
                         className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                       />
                    </div>
                    <div className="md:col-span-2">
                       <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                       <textarea 
                         rows={4}
                         value={profile.bio}
                         onChange={(e) => setProfile({...profile, bio: e.target.value})}
                         className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                       />
                    </div>
                 </div>
              </div>
           )}

           {activeTab === 'security' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                 <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 text-amber-800 text-sm">
                    <Shield size={20} className="flex-shrink-0" />
                    <p>For security reasons, major account changes may require email verification.</p>
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

            {activeTab === 'notifications' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="space-y-4">
                        {['Email me when a student submits an exam', 'Email me daily summary reports', 'Notify me about system maintenance'].map((label, i) => (
                            <label key={i} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                                <input type="checkbox" defaultChecked={i === 0} className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500" />
                                <span className="text-sm text-gray-700">{label}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

           <div className="mt-8 pt-6 border-t border-gray-200 flex items-center justify-end gap-4">
              {errorMessage && (
                  <div className="text-red-600 text-sm flex items-center gap-2 animate-in fade-in">
                      <AlertCircle size={16} /> {errorMessage}
                  </div>
              )}
              {successMessage && (
                  <div className="text-green-600 text-sm flex items-center gap-2 animate-in fade-in">
                      <CheckCircle2 size={16} /> {successMessage}
                  </div>
              )}
              <button 
                onClick={handleSave}
                disabled={isLoading}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-70"
              >
                 {isLoading ? 'Saving...' : <><Save size={16} /> Save Changes</>}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};