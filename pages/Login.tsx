import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Loader2, Lock, Mail, KeyRound, Building2, UserCircle2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

const CAPABILITIES = [
  "Unified School Management",
  "Real-time Exam Proctoring",
  "AI-Powered Report Remarks",
  "Instant Result Computation",
  "Global Student Database",
  "Seamless Curriculum Planning"
];

export const Login: React.FC = () => {
  const { login, loginStudent, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'staff' | 'student'>('staff');

  // Animation State
  const [currentCapability, setCurrentCapability] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  // Staff Form State
  const [email, setEmail] = useState('alex.j@smartschool.edu');
  const [password, setPassword] = useState('password');

  // Student Form State
  const [schoolCode, setSchoolCode] = useState('SPR-001');
  const [studentCode, setStudentCode] = useState('STU-2024-001');

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentCapability((prev) => (prev + 1) % CAPABILITIES.length);
        setIsVisible(true);
      }, 500);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError('Invalid credentials. Please try again.');
    }
  };

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await loginStudent(schoolCode, studentCode);
      navigate('/student-portal');
    } catch (err: any) {
      setError(err.message || 'Invalid School Code or Access Code.');
    }
  };

  return (
    <div className="min-h-screen bg-black flex relative overflow-hidden">
      {/* Background Decoration for Left Side */}
      <div className="absolute top-0 left-0 w-full lg:w-2/3 h-full overflow-hidden z-0 pointer-events-none">
         <div className="absolute top-[10%] left-[10%] w-[60%] h-[60%] rounded-full bg-indigo-900/20 blur-[120px]"></div>
         <div className="absolute bottom-[10%] right-[20%] w-[40%] h-[40%] rounded-full bg-purple-900/20 blur-[100px]"></div>
      </div>

      {/* Left Section - Capabilities & Info */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-16 relative z-10">
         {/* Logo Area */}
         <div className="flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="w-12 h-12 bg-white/10 backdrop-blur-md border border-white/10 rounded-xl flex items-center justify-center text-white shadow-2xl">
               <GraduationCap size={28} />
            </div>
            <div className="flex flex-col">
                <span className="text-2xl font-bold text-white tracking-tight">SmartSchool</span>
                <span className="text-xs text-gray-400 tracking-widest uppercase font-semibold">Enterprise Edition</span>
            </div>
         </div>

         {/* Main Text Area */}
         <div className="max-w-2xl">
            <h1 className="text-5xl xl:text-6xl font-bold text-white leading-tight mb-8 animate-in fade-in slide-in-from-left-4 duration-700 delay-100">
               The Future of <br/>
               <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                 Education Management
               </span>
            </h1>
            
            <div className="h-32 mb-8"> {/* Increased height for bold text */}
                <p className={`text-3xl xl:text-4xl font-bold text-white leading-tight transition-all duration-500 transform ${isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95 blur-sm'}`}>
                   {CAPABILITIES[currentCapability]}
                </p>
            </div>
            
            {/* Progress bar for the capability cycle */}
            <div className="flex gap-2">
                {CAPABILITIES.map((_, idx) => (
                    <div key={idx} className={`h-1 rounded-full transition-all duration-500 ${idx === currentCapability ? 'w-12 bg-indigo-500' : 'w-2 bg-gray-800'}`}></div>
                ))}
            </div>
         </div>

         {/* Contact Info at Bottom Left */}
         <div className="border-t border-white/10 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3">Contact Information</p>
            <div className="flex flex-col gap-1.5 text-sm text-gray-500 font-mono">
               <p className="flex items-center gap-2 hover:text-gray-300 transition-colors cursor-default">
                 <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                 admin@smartschool.edu
               </p>
               <p className="hover:text-gray-300 transition-colors cursor-default">+1 (555) 123-4567</p>
               <p className="text-xs text-gray-600 mt-2">© 2024 SmartSchool Systems Inc.</p>
            </div>
         </div>
      </div>

      {/* Right Section - Login Panel */}
      <div className="w-full lg:w-[520px] xl:w-[600px] bg-white h-full min-h-screen flex flex-col justify-center p-8 md:p-16 shadow-2xl z-20 relative overflow-y-auto">
         {/* Mobile Logo (visible only on small screens) */}
         <div className="lg:hidden mb-8 flex items-center justify-center">
             <div className="w-12 h-12 bg-primary-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-primary-600/20">
                <GraduationCap size={24} />
             </div>
         </div>

         <div className="max-w-sm mx-auto w-full">
             <div className="mb-10">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h2>
                <p className="text-gray-500">Please enter your details to sign in.</p>
             </div>

             {/* Tabs */}
            <div className="flex p-1 bg-gray-100 rounded-xl mb-8">
                <button
                    onClick={() => { setActiveTab('staff'); setError(''); }}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all shadow-sm ${
                    activeTab === 'staff' ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-700 shadow-none'
                    }`}
                >
                    Staff / Admin
                </button>
                <button
                    onClick={() => { setActiveTab('student'); setError(''); }}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all shadow-sm ${
                    activeTab === 'student' ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-700 shadow-none'
                    }`}
                >
                    Student Portal
                </button>
            </div>

            {/* Forms */}
            {activeTab === 'staff' ? (
                /* Staff Login Form */
                <form onSubmit={handleStaffLogin} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Email Address
                    </label>
                    <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary-500 transition-colors">
                        <Mail size={18} />
                    </div>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all bg-gray-50 focus:bg-white"
                        placeholder="name@school.edu"
                    />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Password
                    </label>
                    <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary-500 transition-colors">
                        <Lock size={18} />
                    </div>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all bg-gray-50 focus:bg-white"
                        placeholder="••••••••"
                    />
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <label className="flex items-center cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        <span className="ml-2 text-sm text-gray-500">Remember me</span>
                    </label>
                    <a href="#" className="text-sm font-medium text-primary-600 hover:text-primary-700">
                    Forgot password?
                    </a>
                </div>

                {error && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2">
                         <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                         {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-primary-600/20 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-70 transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                    {isLoading ? <Loader2 size={18} className="animate-spin mr-2" /> : null}
                    Sign In
                </button>
                
                <div className="mt-6 text-center">
                    <p className="text-xs text-gray-400 mb-3 uppercase tracking-wider font-semibold">Demo Accounts</p>
                    <div className="flex gap-2 justify-center flex-wrap">
                        <button type="button" onClick={() => setEmail('creator@smartschool.edu')} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200 transition-colors">Creator</button>
                        <button type="button" onClick={() => setEmail('admin@smartschool.edu')} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200 transition-colors">Admin</button>
                        <button type="button" onClick={() => setEmail('alex.j@smartschool.edu')} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200 transition-colors">Teacher</button>
                    </div>
                </div>
                </form>
            ) : (
                /* Student Portal Login Form */
                <form onSubmit={handleStudentLogin} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    School Code
                    </label>
                    <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-purple-500 transition-colors">
                        <Building2 size={18} />
                    </div>
                    <input
                        type="text"
                        value={schoolCode}
                        onChange={(e) => setSchoolCode(e.target.value)}
                        className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all bg-gray-50 focus:bg-white font-mono"
                        placeholder="e.g. SCH-001"
                    />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Student Access Code
                    </label>
                    <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-purple-500 transition-colors">
                        <KeyRound size={18} />
                    </div>
                    <input
                        type="text"
                        value={studentCode}
                        onChange={(e) => setStudentCode(e.target.value)}
                        className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all bg-gray-50 focus:bg-white font-mono"
                        placeholder="e.g. STU-2024-X92"
                    />
                    </div>
                </div>

                {error && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2">
                         <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                         {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-purple-600/20 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                    {isLoading ? <Loader2 size={18} className="animate-spin mr-2" /> : null}
                    Check Results
                </button>
                
                <div className="mt-6 text-center">
                    <p className="text-xs text-gray-400 mb-3 uppercase tracking-wider font-semibold">Demo Access</p>
                    <div className="flex gap-2 justify-center flex-wrap">
                        <button type="button" onClick={() => { setSchoolCode('SPR-001'); setStudentCode('STU-2024-001'); }} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200 transition-colors">Emma (SPR-001)</button>
                    </div>
                </div>
                </form>
            )}

            <div className="mt-12 flex justify-center space-x-4 text-xs text-gray-400">
                <a href="#" className="hover:text-gray-600 transition-colors">Privacy Policy</a>
                <span>•</span>
                <a href="#" className="hover:text-gray-600 transition-colors">Terms of Service</a>
                <span>•</span>
                <a href="#" className="hover:text-gray-600 transition-colors">Help Center</a>
            </div>
         </div>
      </div>
    </div>
  );
};