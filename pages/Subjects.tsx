import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, Clock, MapPin, Users, MoreVertical, Plus, X, Check, Search, LayoutGrid, CheckCircle2, Tag, UserCheck } from 'lucide-react';
import { api } from '../services/api';
import { Subject, UserRole, User } from '../types';
import { useAuth } from '../context/AuthContext';

// Nigerian Secondary School Curriculum
const NIGERIAN_SUBJECTS: Record<string, string[]> = {
    "General Core (Compulsory)": [
        "Mathematics",
        "English Language",
        "Civic Education",
        "Trade / Entrepreneurship Subject"
    ],
    "Senior Secondary - Science": [
        "Physics",
        "Chemistry",
        "Biology",
        "Further Mathematics",
        "Health Science",
        "Agricultural Science",
        "Physical Education",
        "Computer Studies (ICT)"
    ],
    "Senior Secondary - Humanities (Arts)": [
        "Literature-in-English",
        "Government",
        "Christian Religious Studies (CRS)",
        "Islamic Religious Studies (IRS)",
        "History",
        "Visual Arts",
        "Music",
        "French",
        "Hausa",
        "Igbo",
        "Yoruba"
    ],
    "Senior Secondary - Commercial": [
        "Economics",
        "Commerce",
        "Financial Accounting",
        "Insurance",
        "Office Practice",
        "Book Keeping",
        "Store Management"
    ],
    "Senior Secondary - Technology": [
        "Technical Drawing",
        "Basic Electricity",
        "Electronics",
        "Auto Mechanics",
        "Building Construction",
        "Woodwork",
        "Home Management",
        "Food and Nutrition",
        "Clothing and Textiles"
    ],
    "Junior Secondary (JSS 1-3)": [
        "Basic Science",
        "Basic Technology",
        "Social Studies",
        "Business Studies",
        "Cultural and Creative Arts (CCA)",
        "French Language",
        "Home Economics",
        "Computer Studies",
        "Physical and Health Education"
    ]
};

export const Subjects: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [teacherMap, setTeacherMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("General Core (Compulsory)");
  const [selectedForEnrollment, setSelectedForEnrollment] = useState<Set<string>>(new Set());
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;

  const fetchData = async () => {
    setLoading(true);
    try {
      const [subjectsRes, usersRes] = await Promise.all([
          api.getSubjects(user?.role === UserRole.SUPER_ADMIN ? undefined : user?.schoolId),
          api.getAllUsers()
      ]);

      if (subjectsRes.ok) {
        // Filter subjects based on user role
        let filteredSubjects = subjectsRes.data;
        if (user?.role === UserRole.TEACHER) {
          // Teachers only see subjects assigned to them
          filteredSubjects = subjectsRes.data.filter(subject => subject.teacherId === user.id);
        }
        setSubjects(filteredSubjects);
      }

      if (usersRes.ok) {
          const tMap: Record<string, string> = {};
          usersRes.data.forEach(u => tMap[u.id] = u.name);
          setTeacherMap(tMap);
          // Filter specifically for teachers for the dropdown
          setTeachers(usersRes.data.filter(u => u.role === UserRole.TEACHER));
      }
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  useEffect(() => {
    const quick = searchParams.get('quick');
    if (!quick) return;
    if (quick === 'enroll-subjects' && isAdmin) {
      setShowEnrollModal(true);
    }
    const next = new URLSearchParams(searchParams);
    next.delete('quick');
    setSearchParams(next, { replace: true });
  }, [isAdmin, searchParams, setSearchParams]);

  const handleToggleSelect = (subjectName: string) => {
      const newSet = new Set(selectedForEnrollment);
      if (newSet.has(subjectName)) {
          newSet.delete(subjectName);
      } else {
          newSet.add(subjectName);
      }
      setSelectedForEnrollment(newSet);
  };

  const handleEnrollSubjects = async () => {
      setEnrollLoading(true);
      try {
          const teacherToAssign: string | undefined = selectedTeacherId || user?.id;

          const promises = Array.from(selectedForEnrollment).map((name: string) => 
              api.createSubject({ name, teacherId: teacherToAssign })
          );
          await Promise.all(promises);
          
          await fetchData();
          setShowEnrollModal(false);
          setSelectedForEnrollment(new Set());
          setSelectedTeacherId("");
          alert('Subjects enrolled successfully!');
      } catch (e) {
          console.error("Failed to enroll subjects", e);
          alert(`Error enrolling subjects: ${(e as any)?.message || 'Unknown error'}`);
      } finally {
          setEnrollLoading(false);
      }
  };

  // Helper to check if subject is already enrolled in the school
  const isEnrolled = (name: string) => {
      return subjects.some(s => s.name.toLowerCase() === name.toLowerCase());
  };

  // Helper to get category for a subject
  const getSubjectCategory = (name: string) => {
      for (const [category, list] of Object.entries(NIGERIAN_SUBJECTS)) {
          if (list.includes(name)) return category;
      }
      return "Elective / Other";
  };

  const themeColors = [
    { 
      main: 'bg-blue-50', 
      text: 'text-blue-700', 
      border: 'border-blue-200', 
      icon: 'text-blue-600',
      bar: 'bg-blue-500' 
    },
    { 
      main: 'bg-purple-50', 
      text: 'text-purple-700', 
      border: 'border-purple-200', 
      icon: 'text-purple-600',
      bar: 'bg-purple-500' 
    },
    { 
      main: 'bg-emerald-50', 
      text: 'text-emerald-700', 
      border: 'border-emerald-200', 
      icon: 'text-emerald-600',
      bar: 'bg-emerald-500' 
    },
    { 
      main: 'bg-orange-50', 
      text: 'text-orange-700', 
      border: 'border-orange-200', 
      icon: 'text-orange-600', 
      bar: 'bg-orange-500' 
    },
  ];

  if (user?.role && !isAdmin) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h1>
        <p className="text-gray-500 mb-6">Only admins can manage the subject catalog.</p>
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subjects</h1>
          <p className="text-gray-500">
            Manage your school's subject curriculum and assignments.
          </p>
        </div>
        {isAdmin && (
            <button 
                onClick={() => setShowEnrollModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
            >
                <Plus size={16} />
                Enroll New Subject
            </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 bg-gray-200 rounded-xl animate-pulse"
            ></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects.length > 0 ? (
            subjects.map((subject, index) => {
              const theme = themeColors[index % themeColors.length];
              const category = getSubjectCategory(subject.name);
              const instructorName = teacherMap[subject.teacherId] || 'Unassigned';
              
              return (
                <div
                  key={subject.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group"
                >
                  <div className={`h-1.5 w-full ${theme.bar}`}></div>
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className={`p-3 rounded-lg ${theme.main} ${theme.text}`}>
                        <BookOpen size={24} />
                      </div>
                      <button className="text-gray-400 hover:text-gray-600">
                        <MoreVertical size={20} />
                      </button>
                    </div>

                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      {subject.name}
                    </h3>
                    
                    <div className="flex items-center gap-2 mb-4">
                        <Tag size={12} className="text-gray-400" />
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate" title={category}>
                            {category}
                        </p>
                    </div>

                    <div className="space-y-3 border-t border-gray-50 pt-3">
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <UserCheck size={16} className="text-gray-400" />
                        <span className="font-medium text-gray-700 truncate" title={instructorName}>{instructorName}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <Clock size={16} className="text-gray-400" />
                        {subject.schedule}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <MapPin size={16} className="text-gray-400" />
                        {subject.room}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <Users size={16} className="text-gray-400" />
                        32 Students
                      </div>
                    </div>
                  </div>
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                    <div className="flex -space-x-2">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600"
                        >
                          {String.fromCharCode(64 + i)}
                        </div>
                      ))}
                      <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-500">
                        +
                      </div>
                    </div>
                    <button className="text-sm font-medium text-primary-600 hover:text-primary-700">
                      Manage
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
             <div className="col-span-full flex flex-col items-center justify-center p-12 bg-white border border-gray-200 rounded-xl text-gray-500">
                <BookOpen size={48} className="mb-4 text-gray-300" />
                <p className="text-lg font-medium text-gray-900">No subjects enrolled</p>
                <p className="text-sm mt-1">Use the "Enroll New Subject" button to add subjects from the Nigerian curriculum.</p>
             </div>
          )}
        </div>
      )}

      {/* Enroll Subjects Modal */}
      {showEnrollModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200">
             <div className="bg-white w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                 {/* Modal Header */}
                 <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                     <div>
                         <h2 className="text-xl font-bold text-gray-900">Course Catalog</h2>
                         <p className="text-sm text-gray-500">Select subjects from the standard Nigerian curriculum to enroll.</p>
                     </div>
                     <button 
                        onClick={() => setShowEnrollModal(false)}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
                     >
                         <X size={24} />
                     </button>
                 </div>

                 <div className="flex flex-1 overflow-hidden">
                     {/* Sidebar Categories */}
                     <div className="w-64 bg-gray-50 border-r border-gray-200 overflow-y-auto">
                         <div className="p-4 space-y-1">
                             {Object.keys(NIGERIAN_SUBJECTS).map((category) => (
                                 <button
                                    key={category}
                                    onClick={() => setSelectedCategory(category)}
                                    className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${selectedCategory === category ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`}
                                 >
                                     {category}
                                 </button>
                             ))}
                         </div>
                     </div>

                     {/* Main Content Area */}
                     <div className="flex-1 flex flex-col bg-white">
                         {/* Search Bar */}
                         <div className="p-4 border-b border-gray-100">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                <input 
                                    type="text"
                                    placeholder="Search specific subject..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                />
                            </div>
                         </div>

                         {/* Subject Grid */}
                         <div className="flex-1 p-6 overflow-y-auto">
                             <h3 className="text-lg font-bold text-gray-800 mb-4">{searchTerm ? 'Search Results' : selectedCategory}</h3>
                             
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                 {(searchTerm 
                                    ? Object.keys(NIGERIAN_SUBJECTS).reduce((acc: string[], key: string) => acc.concat(NIGERIAN_SUBJECTS[key]), [] as string[]).filter(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
                                    : NIGERIAN_SUBJECTS[selectedCategory]
                                 ).map((subject) => {
                                     const enrolled = isEnrolled(subject);
                                     const selected = selectedForEnrollment.has(subject);
                                     
                                     return (
                                         <button
                                            key={subject}
                                            onClick={() => !enrolled && handleToggleSelect(subject)}
                                            disabled={enrolled}
                                            className={`
                                                relative flex items-center justify-between p-4 rounded-xl border text-left transition-all
                                                ${enrolled 
                                                    ? 'bg-gray-50 border-gray-200 opacity-60 cursor-default' 
                                                    : selected 
                                                        ? 'bg-primary-50 border-primary-500 ring-1 ring-primary-500' 
                                                        : 'bg-white border-gray-200 hover:border-primary-300 hover:shadow-sm'
                                                }
                                            `}
                                         >
                                             <span className={`font-medium ${enrolled ? 'text-gray-500' : 'text-gray-900'}`}>
                                                 {subject}
                                             </span>
                                             
                                             {enrolled ? (
                                                 <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                                                     <CheckCircle2 size={12} /> Enrolled
                                                 </span>
                                             ) : (
                                                 <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selected ? 'bg-primary-600 border-primary-600 text-white' : 'border-gray-300'}`}>
                                                     {selected && <Check size={12} />}
                                                 </div>
                                             )}
                                         </button>
                                     );
                                 })}
                             </div>
                         </div>
                     </div>
                 </div>

                 {/* Modal Footer */}
                 <div className="p-4 border-t border-gray-200 bg-white flex justify-between items-center">
                     <div className="flex items-center gap-6">
                         <div className="text-sm text-gray-600">
                             <span className="font-bold text-gray-900">{selectedForEnrollment.size}</span> subjects selected
                         </div>

                         {/* Teacher Selection for Batch Enrollment */}
                         {selectedForEnrollment.size > 0 && (
                            <div className="flex items-center gap-2 border-l border-gray-300 pl-6">
                                <label className="text-xs font-bold text-gray-500 uppercase">Assign Teacher:</label>
                                <div className="relative">
                                    <select
                                        value={selectedTeacherId}
                                        onChange={(e) => setSelectedTeacherId(e.target.value)}
                                        className="appearance-none bg-gray-50 border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full pl-3 pr-8 py-2 font-medium"
                                    >
                                        <option value="">-- Assign to Myself --</option>
                                        {teachers.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                    </div>
                                </div>
                            </div>
                         )}
                     </div>

                     <div className="flex gap-3">
                         <button 
                            onClick={() => setShowEnrollModal(false)}
                            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                         >
                             Cancel
                         </button>
                         <button 
                            onClick={handleEnrollSubjects}
                            disabled={selectedForEnrollment.size === 0 || enrollLoading}
                            className="px-6 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                         >
                             {enrollLoading ? 'Enrolling...' : 'Confirm Enrollment'}
                             <LayoutGrid size={18} />
                         </button>
                     </div>
                 </div>
             </div>
          </div>
      )}
    </div>
  );
};
