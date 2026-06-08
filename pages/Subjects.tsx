import React, { useEffect, useState, useRef } from 'react';
import { BookOpen, Clock, MapPin, Users, Plus, X, Check, Search, LayoutGrid, CheckCircle2, Tag, UserCheck, ChevronDown, Pencil, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { Subject, UserRole, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../src/utils/useToast';

// Full Nigerian National Curriculum (Primary–SSS)
const NIGERIAN_SUBJECTS: Record<string, string[]> = {
  "Primary 1–3 (Core)": [
    "English Studies",
    "Mathematics",
    "Basic Science",
    "Physical & Health Education",
    "Nigerian History",
    "Social & Citizenship Studies",
    "Cultural & Creative Arts (CCA)",
    "Pre-vocational Studies",
  ],
  "Primary 1–3 (Nigerian Language — Choose One)": ["Hausa", "Yoruba", "Igbo"],
  "Primary 1–3 (Religious — Choose One)": ["Christian Religious Studies (CRS)", "Islamic Studies (IS)"],
  "Primary 1–3 (Optional)": ["Arabic Language", "French"],
  "Primary 4–6 (Core)": [
    "English Studies",
    "Mathematics",
    "Basic Science & Technology",
    "Physical & Health Education",
    "Basic Digital Literacy",
    "Nigerian History",
    "Social & Citizenship Studies",
    "Cultural & Creative Arts (CCA)",
  ],
  "Primary 4–6 (Nigerian Language — Choose One)": ["Hausa", "Yoruba", "Igbo"],
  "Primary 4–6 (Religious — Choose One)": ["Christian Religious Studies (CRS)", "Islamic Studies (IS)"],
  "Primary 4–6 (Trade — Choose One)": [
    "Solar Photovoltaic Installation and Maintenance",
    "Fashion Design and Garment Making",
    "Livestock Farming",
    "Beauty and Cosmetology",
    "Computer Hardware and GSM Repairs",
    "Horticulture and Crop Production",
  ],
  "Primary 4–6 (Optional)": ["French", "Arabic Language"],
  "Junior Secondary — Core": [
    "English Studies",
    "Mathematics",
    "Intermediate Science",
    "Physical & Health Education",
    "Digital Technologies",
    "Nigerian History",
    "Social & Citizenship Studies",
    "Cultural & Creative Arts (CCA)",
  ],
  "Junior Secondary — Nigerian Language (Choose One)": ["Hausa", "Yoruba", "Igbo"],
  "Junior Secondary — Religious (Choose One)": ["Christian Religious Studies (CRS)", "Islamic Studies (IS)"],
  "Junior Secondary — Trade (Choose One)": [
    "Solar Photovoltaic Installation and Maintenance",
    "Fashion Design and Garment Making",
    "Livestock Farming",
    "Beauty and Cosmetology",
    "Computer Hardware and GSM Repairs",
    "Horticulture and Crop Production",
  ],
  "Junior Secondary — Optional": ["French", "Arabic Language"],
  "Senior Secondary — Core & Compulsory": [
    "English Language",
    "General Mathematics",
    "Citizenship and Heritage Studies",
    "Digital Technologies",
  ],
  "Senior Secondary — Science": [
    "Biology", "Chemistry", "Physics", "Agriculture", "Further Mathematics",
    "Physical Education", "Health Education", "Food & Nutrition", "Geography", "Technical Drawing",
  ],
  "Senior Secondary — Humanities": [
    "Nigerian History", "Government", "Christian Religious Studies (CRS)", "Islamic Studies (IS)",
    "Hausa", "Igbo", "Yoruba", "French", "Arabic", "Visual Arts", "Music",
    "English Literature", "Home Management", "Catering Craft",
  ],
  "Senior Secondary — Business": ["Accounting", "Commerce", "Marketing", "Economics"],
  "Senior Secondary — Core Trade (Choose One)": [
    "Solar PV Installation and Maintenance",
    "Fashion Design and Garment Making",
    "Livestock Farming",
    "Beauty and Cosmetology",
    "Computer Hardware and GSM Repairs",
    "Horticulture and Crop Production",
  ],
};

// Accordion groups for the sidebar
const SIDEBAR_GROUPS: { label: string; color: string; categories: string[] }[] = [
  {
    label: 'Primary 1–3',
    color: 'text-emerald-700',
    categories: [
      'Primary 1–3 (Core)',
      'Primary 1–3 (Nigerian Language — Choose One)',
      'Primary 1–3 (Religious — Choose One)',
      'Primary 1–3 (Optional)',
    ],
  },
  {
    label: 'Primary 4–6',
    color: 'text-blue-700',
    categories: [
      'Primary 4–6 (Core)',
      'Primary 4–6 (Nigerian Language — Choose One)',
      'Primary 4–6 (Religious — Choose One)',
      'Primary 4–6 (Trade — Choose One)',
      'Primary 4–6 (Optional)',
    ],
  },
  {
    label: 'Junior Secondary',
    color: 'text-orange-700',
    categories: [
      'Junior Secondary — Core',
      'Junior Secondary — Nigerian Language (Choose One)',
      'Junior Secondary — Religious (Choose One)',
      'Junior Secondary — Trade (Choose One)',
      'Junior Secondary — Optional',
    ],
  },
  {
    label: 'Senior Secondary',
    color: 'text-purple-700',
    categories: [
      'Senior Secondary — Core & Compulsory',
      'Senior Secondary — Science',
      'Senior Secondary — Humanities',
      'Senior Secondary — Business',
      'Senior Secondary — Core Trade (Choose One)',
    ],
  },
];

// Strip the level prefix to get a short label for the sidebar item
const shortLabel = (category: string): string => {
  return category
    .replace(/^Primary 1[–-]3\s*/i, '')
    .replace(/^Primary 4[–-]6\s*/i, '')
    .replace(/^Junior Secondary\s*[—-]\s*/i, '')
    .replace(/^Senior Secondary\s*[—-]\s*/i, '');
};

export const Subjects: React.FC = () => {
  const { user } = useAuth();
  const { toasts, toast, dismiss } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [teacherMap, setTeacherMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("Primary 1–3 (Core)");
  const [selectedForEnrollment, setSelectedForEnrollment] = useState<Set<string>>(new Set());
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(SIDEBAR_GROUPS.map(g => g.label)));
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editForm, setEditForm] = useState({ name: '', teacherId: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [deletingSubjectId, setDeletingSubjectId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;

  const fetchData = async () => {
    setLoading(true);
    try {
      const [subjectsRes, usersRes] = await Promise.all([
          api.getSubjects(),
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
          toast.success('Subjects enrolled successfully!');
      } catch (e) {
          console.error("Failed to enroll subjects", e);
          toast.error(`Error enrolling subjects: ${(e as any)?.message || 'Unknown error'}`);
      } finally {
          setEnrollLoading(false);
      }
  };

  const openEdit = (subject: Subject) => {
    setEditingSubject(subject);
    setEditForm({ name: subject.name, teacherId: subject.teacherId || '' });
    setOpenMenuId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingSubject) return;
    setEditSaving(true);
    const res = await api.updateSubject(editingSubject.id, {
      name: editForm.name.trim() || undefined,
      teacherId: editForm.teacherId || undefined,
    });
    setEditSaving(false);
    if (res.ok) {
      setSubjects(prev => prev.map(s => s.id === editingSubject.id ? res.data : s));
      setEditingSubject(null);
      toast.success('Subject updated.');
    } else {
      toast.error(res.message || 'Failed to update subject');
    }
  };

  const handleDeleteSubject = async (subjectId: string) => {
    if (!window.confirm('Remove this subject from your school? This cannot be undone.')) return;
    setDeletingSubjectId(subjectId);
    setOpenMenuId(null);
    const res = await api.deleteSubject(subjectId);
    setDeletingSubjectId(null);
    if (res.ok) {
      setSubjects(prev => prev.filter(s => s.id !== subjectId));
      toast.success('Subject removed.');
    } else {
      toast.error(res.message || 'Failed to remove subject');
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

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
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
                      {isAdmin && (
                        <div className="relative" ref={openMenuId === subject.id ? menuRef : null}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === subject.id ? null : subject.id); }}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            ···
                          </button>
                          {openMenuId === subject.id && (
                            <div className="absolute right-0 top-8 z-20 w-36 bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-sm">
                              <button
                                onClick={() => openEdit(subject)}
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700"
                              >
                                <Pencil size={13} /> Edit
                              </button>
                              <button
                                onClick={() => handleDeleteSubject(subject.id)}
                                disabled={deletingSubjectId === subject.id}
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 text-red-600 disabled:opacity-50"
                              >
                                <Trash2 size={13} /> Remove
                              </button>
                            </div>
                          )}
                        </div>
                      )}
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

      {/* Edit Subject Modal */}
      {editingSubject && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">Edit Subject</h3>
              <button onClick={() => setEditingSubject(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label htmlFor="edit-subject-name" className="block text-xs font-medium text-gray-600 mb-1">Subject Name</label>
                <input
                  id="edit-subject-name" name="edit-subject-name"
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label htmlFor="edit-subject-teacher" className="block text-xs font-medium text-gray-600 mb-1">Assigned Teacher</label>
                <select
                  id="edit-subject-teacher" name="edit-subject-teacher"
                  value={editForm.teacherId}
                  onChange={e => setEditForm(f => ({ ...f, teacherId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Unassigned</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSaveEdit}
                disabled={editSaving || !editForm.name.trim()}
                className="flex-1 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-60"
              >
                {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
              <button onClick={() => setEditingSubject(null)}
                className="flex-1 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
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
                     {/* Accordion Sidebar */}
                     <div className="w-72 bg-gray-50 border-r border-gray-200 overflow-y-auto flex-shrink-0">
                       <div className="p-3 space-y-1">
                         {SIDEBAR_GROUPS.map((group) => (
                           <div key={group.label}>
                             <button
                               onClick={() => toggleGroup(group.label)}
                               className="w-full flex items-center justify-between px-3 py-2 rounded-lg font-bold text-xs uppercase tracking-wider text-gray-500 hover:bg-gray-100 transition-colors"
                             >
                               <span className={group.color}>{group.label}</span>
                               <ChevronDown
                                 size={14}
                                 className={`transition-transform text-gray-400 ${openGroups.has(group.label) ? 'rotate-180' : ''}`}
                               />
                             </button>
                             {openGroups.has(group.label) && (
                               <div className="ml-2 mt-0.5 space-y-0.5">
                                 {group.categories.map((category) => {
                                   const enrolledCount = NIGERIAN_SUBJECTS[category].filter(isEnrolled).length;
                                   const total = NIGERIAN_SUBJECTS[category].length;
                                   return (
                                     <button
                                       key={category}
                                       onClick={() => setSelectedCategory(category)}
                                       className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between gap-2 ${
                                         selectedCategory === category
                                           ? 'bg-primary-100 text-primary-700'
                                           : 'text-gray-600 hover:bg-gray-100'
                                       }`}
                                     >
                                       <span className="leading-snug">{shortLabel(category)}</span>
                                       {enrolledCount > 0 && (
                                         <span className="flex-shrink-0 text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                                           {enrolledCount}/{total}
                                         </span>
                                       )}
                                     </button>
                                   );
                                 })}
                               </div>
                             )}
                           </div>
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
                                    id="subject-search" name="subject-search"
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
                                <label htmlFor="batch-assign-teacher" className="text-xs font-bold text-gray-500 uppercase">Assign Teacher:</label>
                                <div className="relative">
                                    <select
                                        id="batch-assign-teacher" name="batch-assign-teacher"
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