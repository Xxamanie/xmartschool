
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { api } from '../../services/api';
import { Assessment, Student, Subject, ResultData, ExamQuestion, ActiveExam, UserRole, SchoolClassItem, TeacherAssignment } from '../../types';
import apiClient from '../../src/utils/api';
import { useAuth } from '../../context/AuthContext';
import { ToastContainer } from '../../components/Toast';
import { useToast } from '../../src/utils/useToast';
import { 
  Save, 
  FileSpreadsheet, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Settings, 
  X,
  Monitor,
  Globe,
  Clock,
  Link as LinkIcon,
  Wifi,
  Play,
  Square,
  RefreshCw,
  Copy,
  Plus,
  Trash2,
  BrainCircuit,
  Wand2,
  PenTool,
  LayoutList,
  Eraser,
  Send,
  ChevronDown,
  RotateCcw,
  Library,
  ArrowRight,
  CheckSquare,
  Search,
  Filter,
  BookOpen,
  Layers,
  CalendarDays,
  ChevronRight,
} from 'lucide-react';

interface ExamSection {
  name: string;
  timeSpent: string;
  status: 'completed' | 'in-progress' | 'pending';
}

export interface ExamStat {
  status: 'not-started' | 'in-progress' | 'submitted';
  progress: number;
  score?: number;
  startTime?: string;
  sections?: ExamSection[];
}

interface CAColumn {
  id: string;
  label: string;
  maxScore: number;
}

interface GradeThreshold {
  grade: string;
  minPercentage: number;
}

const DEFAULT_GRADING_SCALE: GradeThreshold[] = [
  { grade: 'A+', minPercentage: 90 },
  { grade: 'A', minPercentage: 80 },
  { grade: 'B', minPercentage: 70 },
  { grade: 'C', minPercentage: 60 },
  { grade: 'D', minPercentage: 50 },
  { grade: 'F', minPercentage: 0 },
];

export function useAssessmentsModel() {

  const { isImpersonating, user } = useAuth();
  const { toasts, toast, dismiss } = useToast();

  // Inline confirm/prompt state (replaces window.confirm and window.prompt)
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [newCAName, setNewCAName] = useState('');
  const [showCANameModal, setShowCANameModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [teachers, setTeachers] = useState<Record<string, string>>({}); // Map ID to Name for Admin context
  const [classMasters, setClassMasters] = useState<Record<string, string>>({}); // grade → teacherId
  const [teacherAssignments, setTeacherAssignments] = useState<TeacherAssignment[]>([]);

  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('Term 1');
  const [selectedClass, setSelectedClass] = useState('');
  const [schoolClasses, setSchoolClasses] = useState<SchoolClassItem[]>([]);

  // Form master detection (derived from classMasters)
  const formMasterGrade = useMemo(
    () =>
      user?.role === UserRole.TEACHER
        ? (Object.entries(classMasters).find(([, tid]) => tid === user.id)?.[0] ?? null)
        : null,
    [classMasters, user],
  );
  const isFormMaster = !!formMasterGrade;

  // Classes this teacher is allowed to access:
  //   - their form class (if form master)
  //   - every class they have a TeacherAssignment for
  // Admins and super-admins see the full list.
  const accessibleClasses = useMemo(() => {
    if (user?.role !== UserRole.TEACHER) return schoolClasses;
    const ids = new Set<string>();
    if (formMasterGrade) {
      const fc = schoolClasses.find(c => c.name === formMasterGrade);
      if (fc) ids.add(fc.id);
    }
    teacherAssignments.forEach(a => ids.add(a.schoolClassId));
    return schoolClasses.filter(c => ids.has(c.id));
  }, [schoolClasses, formMasterGrade, teacherAssignments, user?.role]);

  // Subjects visible for the currently-selected class:
  //   - All subjects  → when no class selected, or when admin, or when the selected class IS the form class
  //   - Assigned only → when a different class is selected (subject-teacher context)
  const visibleSubjects = useMemo(() => {
    if (user?.role !== UserRole.TEACHER || !selectedClass) return subjects;
    const selectedClassName = schoolClasses.find(c => c.id === selectedClass)?.name;
    if (isFormMaster && selectedClassName === formMasterGrade) return subjects; // form class → all subjects
    // Subject-teacher class → only subjects assigned for this class
    const assignedIds = new Set(
      teacherAssignments.filter(a => a.schoolClassId === selectedClass).map(a => a.subjectId),
    );
    return subjects.filter(s => assignedIds.has(s.id));
  }, [subjects, selectedClass, schoolClasses, isFormMaster, formMasterGrade, teacherAssignments, user?.role]);
  // Which accordion step is open: 'term' | 'class' | 'subject' | null (all collapsed once all chosen)
  const [openAccordion, setOpenAccordion] = useState<'term' | 'class' | 'subject'>('term');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [modifiedRows, setModifiedRows] = useState<Set<string>>(new Set());

  // Filter State
  const [studentSearch, setStudentSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('All');

  // Dynamic CA Columns State
  const [caColumns, setCaColumns] = useState<CAColumn[]>([
    { id: 'ca1', label: '1st CA', maxScore: 10 },
    { id: 'ca2', label: '2nd CA', maxScore: 10 },
    { id: 'ca3', label: '3rd CA', maxScore: 10 },
  ]);

  // Configuration State
  const [config, setConfig] = useState({
    examMax: 70,
    passMark: 50
  });
  
  const [gradingScale, setGradingScale] = useState<GradeThreshold[]>(DEFAULT_GRADING_SCALE);
  const [showSettings, setShowSettings] = useState(false);

  // Modes: Gradebook | Exams
  const [mode, setMode] = useState<'manual' | 'builder'>('manual');
  // Sub-mode inside Exams tab: builder | proctor
  const [examSubMode, setExamSubMode] = useState<'builder' | 'proctor'>('builder');
  
  // Exam Management State
  const [allExams, setAllExams] = useState<ActiveExam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [examStats, setExamStats] = useState<Record<string, ExamStat>>({});
  const intervalRef = useRef<any>(null);

  // Exam Builder State
  const [builderQuestions, setBuilderQuestions] = useState<ExamQuestion[]>([]);
  const [builderConfig, setBuilderConfig] = useState<{
    topic: string;
    count: number;
    type: 'multiple-choice' | 'true-false' | 'short-answer' | 'essay';
    difficulty: 'easy' | 'medium' | 'hard';
  }>({
    topic: '',
    count: 5,
    type: 'multiple-choice',
    difficulty: 'medium'
  });
  const [isGenerating, setIsGenerating] = useState(false);


  // Tooltip State
  const [hoveredStudent, setHoveredStudent] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  // Computed Max Total
  const maxTotal = caColumns.reduce((sum, col) => sum + col.maxScore, 0) + config.examMax;

  // Helper to lookup student details efficiently
  const studentMap = useMemo(() => {
      return students.reduce((acc, s) => {
          acc[s.id] = s;
          return acc;
      }, {} as Record<string, Student>);
  }, [students]);

  // Load initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // For teachers: load class masters AND teacher assignments first so we
        // can decide subject scope and accessible classes before rendering.
        let mastersData: Record<string, string> = {};
        let assignmentsData: TeacherAssignment[] = [];
        if (user?.role === UserRole.TEACHER) {
          const [mastersRes, assignmentsRes] = await Promise.all([
            api.getClassMasters(),
            api.getTeacherAssignments(user.id),
          ]);
          if (mastersRes.ok) {
            mastersData = mastersRes.data;
            setClassMasters(mastersData);
          }
          if (assignmentsRes.ok) {
            assignmentsData = assignmentsRes.data;
            setTeacherAssignments(assignmentsData);
          }
        }

        // Determine if this teacher is a form master BEFORE subject filtering
        const thisFormMasterGrade = user?.role === UserRole.TEACHER
          ? (Object.entries(mastersData).find(([, tid]) => tid === user.id)?.[0] ?? null)
          : null;

        const [studentsRes, subjectsRes, examRes] = await Promise.all([
          api.getStudents(),
          api.getSubjects(),
          api.getExams()
        ]);

        if (studentsRes.ok) setStudents(studentsRes.data);

        // Subject scope:
        // - Admin / Super admin: all subjects
        // - Form master: ALL subjects (they compile marks across every subject for their class)
        // - Regular teacher: subjects they are assigned to teach (via TeacherAssignment)
        let filteredSubjects = subjectsRes.data;
        if (user?.role === UserRole.TEACHER && !thisFormMasterGrade) {
          const assignedSubjectIds = new Set(assignmentsData.map(a => a.subjectId));
          filteredSubjects = subjectsRes.data.filter(s => assignedSubjectIds.has(s.id));
        }

        // If Admin, fetch users to map teacher IDs to names for display
        if (user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN) {
            const usersRes = await api.getAllUsers();
            if (usersRes.ok) {
                const tMap: Record<string, string> = {};
                usersRes.data.forEach(u => {
                    if (u.role === UserRole.TEACHER) tMap[u.id] = u.name;
                });
                setTeachers(tMap);
            }
        }

        if (subjectsRes.ok) {
          setSubjects(filteredSubjects);
          // Don't auto-select a subject — let the teacher pick via the accordion
        }

        // Load school classes for the class accordion
        const schoolId = user?.schoolId;
        if (schoolId) {
          const classRes = await api.getSchoolClasses(schoolId);
          if (classRes.ok) setSchoolClasses(classRes.data);
        }

        if (examRes.ok && examRes.data.length > 0) {
           let exams = examRes.data;
           if (user?.role === UserRole.TEACHER) {
             exams = exams.filter(e => e.teacherId === user.id);
           }
           setAllExams(exams);
           if (exams.length > 0) {
              const activeOne = exams.find(e => e.status === 'active') || exams[0];
              setSelectedExamId(activeOne.id);
              setBuilderQuestions(activeOne.questions);
              setBuilderConfig(prev => ({ ...prev, topic: activeOne.title }));
           }
        }
      } catch (error) {
        console.error('Failed to fetch initial data', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  // When the accessible class list is ready, pre-select for teachers:
  //   1. Form master → pre-select their form class
  //   2. Regular subject teacher → pre-select their first assigned class
  useEffect(() => {
    if (user?.role !== UserRole.TEACHER || accessibleClasses.length === 0 || selectedClass) return;

    if (formMasterGrade) {
      const fc = accessibleClasses.find(c => c.name === formMasterGrade);
      if (fc) { setSelectedClass(fc.id); setOpenAccordion('subject'); }
    } else if (accessibleClasses.length > 0) {
      setSelectedClass(accessibleClasses[0].id);
      setOpenAccordion('subject');
    }
  }, [user?.role, accessibleClasses, formMasterGrade, selectedClass]);

  // When the selected class changes, clear the subject selection if it is no
  // longer in the visible subjects list for the new class context.
  useEffect(() => {
    if (!selectedSubject) return;
    if (!visibleSubjects.some(s => s.id === selectedSubject)) {
      setSelectedSubject('');
    }
  }, [selectedClass]); // intentionally depends only on class change

  // Poll for exam stats when in Exams > Proctoring sub-mode
  useEffect(() => {
    if (mode === 'builder' && examSubMode === 'proctor' && selectedExamId) {
        updateStats();
        intervalRef.current = setInterval(updateStats, 3000);
    } else {
        if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [mode, examSubMode, selectedExamId]);

  const updateStats = async () => {
      if (!selectedExamId) return;
      
      // Retrieve real session data from API
      const res = await api.getExamSessions(selectedExamId);
      
      if (res.ok) {
          const sessionMap: Record<string, ExamStat> = {};
          
          res.data.forEach(session => {
              sessionMap[session.studentId] = {
                  status: session.status,
                  progress: session.progress,
                  score: session.score,
                  startTime: session.startTime ? new Date(session.startTime).toLocaleTimeString() : undefined,
                  // No detailed sections in this simplified version
                  sections: []
              };
          });
          
          setExamStats(sessionMap);
      }
  };

  // Get current selected exam object
  const currentExam = allExams.find(e => e.id === selectedExamId);

  const handleExamSelectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const id = e.target.value;
      
      // Safe switching for Builder Mode
      if (mode === 'builder' && selectedExamId === 'new' && builderQuestions.length > 0) {
          setConfirmDialog({
            message: 'You have unsaved questions in the current new exam. Switching will discard them. Continue?',
            onConfirm: () => {
              setSelectedExamId(id);
              const exam = allExams.find(ex => ex.id === id);
              if (exam) {
                setBuilderQuestions(exam.questions);
                setBuilderConfig(prev => ({ ...prev, topic: exam.title }));
                setExamStats({});
              } else if (id === 'new') {
                setBuilderQuestions([]);
                setBuilderConfig(prev => ({ ...prev, topic: '' }));
                setExamStats({});
              }
            }
          });
          return;
      }

      setSelectedExamId(id);
      const exam = allExams.find(ex => ex.id === id);
      if (exam) {
          setBuilderQuestions(exam.questions);
          setBuilderConfig(prev => ({ ...prev, topic: exam.title }));
          // Reset stats when changing exam
          setExamStats({});
      } else if (id === 'new') {
          setBuilderQuestions([]);
          setBuilderConfig(prev => ({ ...prev, topic: '' }));
          setExamStats({});
      }
  };

  // Load assessments when selection changes
  useEffect(() => {
    if (!selectedSubject || !selectedTerm) return;
    
    setModifiedRows(new Set());

    const fetchAssessments = async () => {
      setLoading(true);
      try {
        // Pass classId so the backend can apply the correct role-based access
        // (form master vs subject teacher) for the exact class being viewed.
        const res = await api.getAssessments(selectedSubject, selectedTerm, undefined, selectedClass || undefined);
        if (res.ok) {
          // Frontend: further narrow to students enrolled in the subject
          const eligibleStudents = students.filter(s => {
            const inClass = !selectedClass || s.grade === schoolClasses.find(c => c.id === selectedClass)?.name;
            const offersSubject = !s.enrolledSubjects?.length || s.enrolledSubjects.includes(selectedSubject);
            return inClass && offersSubject;
          });

          const mergedData: Assessment[] = eligibleStudents.map(student => {
            const existing = res.data.find(a => a.studentId === student.id);
            if (existing) return existing;
            return {
              id: `temp-${student.id}`,
              studentId: student.id,
              studentName: student.name,
              subjectId: selectedSubject,
              term: selectedTerm,
              ca1: 0, ca2: 0, ca3: 0, exam: 0
            };
          });
          setAssessments(mergedData);
        }
      } catch (error) {
        console.error('Failed to fetch assessments', error);
      } finally {
        setLoading(false);
      }
    };

    if (students.length > 0) fetchAssessments();
  }, [selectedSubject, selectedTerm, selectedClass, students]);

  const handleScoreChange = (id: string, field: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    let maxLimit = 100;
    if (field === 'exam') {
      maxLimit = config.examMax;
    } else {
      const col = caColumns.find(c => c.id === field);
      if (col) maxLimit = col.maxScore;
    }

    if (numValue > maxLimit) return;

    setAssessments(prev => prev.map(a => {
      if (a.id === id) {
        return { ...a, [field]: numValue };
      }
      return a;
    }));

    setModifiedRows(prev => {
        const next = new Set(prev);
        next.add(id);
        return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await api.saveAssessments(assessments);
      if (res.ok) {
        setSaveMessage({ type: 'success', text: 'Grades saved successfully!' });
        setModifiedRows(new Set());
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        throw new Error('Save failed');
      }
    } catch (error) {
      setSaveMessage({ type: 'error', text: 'Failed to save grades. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setConfirmDialog({
      message: 'Are you sure you want to publish these results? This will update the main Results sheet.',
      onConfirm: async () => {
        setPublishing(true);
        setSaveMessage(null);
        try {
          const subject = subjects.find(s => s.id === selectedSubject);
          const resultsToPublish: ResultData[] = assessments.map(a => {
            const total = calculateTotal(a);
            const grade = calculateGrade(total);
            const details: any = { exam: a.exam };
            caColumns.forEach(col => { details[col.id] = (a as any)[col.id]; });
            return {
              id: `res-${a.studentId}-${selectedSubject}`,
              studentName: a.studentName,
              studentId: a.studentId,
              subjectName: subject?.name || 'Unknown Subject',
              average: total,
              grade,
              status: 'Published',
              remarks: '',
              details
            };
          });
          const res = await api.publishResults(resultsToPublish);
          if (res.ok) {
            setSaveMessage({ type: 'success', text: 'Results published to Report Sheets!' });
            setTimeout(() => setSaveMessage(null), 4000);
          }
        } catch (error) {
          setSaveMessage({ type: 'error', text: 'Failed to publish results.' });
        } finally {
          setPublishing(false);
        }
      }
    });
  };

  const handleSyncScores = () => {
    setAssessments(prev => prev.map(a => {
      const stat = examStats[a.studentId];
      if (stat && stat.status === 'submitted' && stat.score !== undefined) {
        return { ...a, exam: stat.score };
      }
      return a;
    }));
    setSaveMessage({ type: 'success', text: 'Online exam scores synced to gradebook!' });
    setTimeout(() => setSaveMessage(null), 3000);
  };
  
  const handleResetExam = async (studentId: string) => {
    if (!selectedExamId) return;
    setConfirmDialog({
      message: 'GOD MODE: Reset this student\'s exam? This will wipe their previous score and allow a retake. Only use for undue submission cases.',
      onConfirm: async () => {
        try {
          await api.resetStudentExam(selectedExamId, studentId);
          setExamStats(prev => ({
            ...prev,
            [studentId]: { status: 'not-started', progress: 0, score: undefined, startTime: undefined }
          }));
          setSaveMessage({ type: 'success', text: 'Exam reset successfully.' });
          setTimeout(() => setSaveMessage(null), 3000);
        } catch (e) {
          setSaveMessage({ type: 'error', text: 'Failed to reset exam.' });
        }
      }
    });
  };

  const calculateTotal = (a: Assessment) => {
    const caTotal = caColumns.reduce((sum, col) => {
      const val = (a as any)[col.id];
      return sum + (typeof val === 'number' ? val : 0);
    }, 0);
    return caTotal + (a.exam || 0);
  };

  const calculateGrade = (total: number) => {
    if (maxTotal === 0) return '-';
    const percentage = (total / maxTotal) * 100;
    const sortedScale = [...gradingScale].sort((a, b) => b.minPercentage - a.minPercentage);
    const match = sortedScale.find(t => percentage >= t.minPercentage);
    return match ? match.grade : 'F';
  };

  const exportToCSV = () => {
    const caHeaders = caColumns.map(c => `${c.label} (${c.maxScore})`).join(',');
    const headers = [`Student Name`, caHeaders, `Exam (${config.examMax})`, `Total (${maxTotal})`, `Pass/Fail`, `Grade`];
    const rows = filteredAssessments.map(a => {
      const total = calculateTotal(a);
      const caValues = caColumns.map(c => (a as any)[c.id] || 0).join(',');
      return [
        a.studentName,
        caValues,
        a.exam,
        total,
        total >= config.passMark ? 'Pass' : 'Fail',
        calculateGrade(total)
      ];
    });
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Assessments_${selectedTerm}_${selectedSubject}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddCA = () => {
    const nextNum = caColumns.length + 1;
    setNewCAName(`CA ${nextNum}`);
    setShowCANameModal(true);
  };

  const confirmAddCA = () => {
    if (newCAName.trim()) {
      const newId = `ca_${Date.now()}`;
      setCaColumns([...caColumns, { id: newId, label: newCAName.trim(), maxScore: 10 }]);
    }
    setShowCANameModal(false);
    setNewCAName('');
  };

  const deleteCAColumn = (id: string) => {
    setConfirmDialog({
      message: 'Are you sure you want to delete this column?',
      onConfirm: () => setCaColumns(caColumns.filter(c => c.id !== id))
    });
  };

  // --- Exam Builder Logic ---

  const handleGenerateQuestions = async () => {
    if (!builderConfig.topic) {
      toast.warning('Please enter a topic to generate questions.');
      return;
    }
    setIsGenerating(true);

    try {
      const response = await apiClient.post('/ai/generate-questions', {
        topic: builderConfig.topic,
        type: builderConfig.type,
        difficulty: builderConfig.difficulty,
        count: builderConfig.count,
      });

      const generated: any[] = response.data?.data ?? response.data;
      
      const newQuestions: ExamQuestion[] = generated.map((q: any) => ({
        id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        type: builderConfig.type,
        text: q.text,
        options: q.options || [],
        correctAnswer: q.correctAnswer,
        points: q.points || (builderConfig.type === 'essay' ? 10 : 2)
      }));

      setBuilderQuestions(prev => [...prev, ...newQuestions]);
      setSaveMessage({ type: 'success', text: `Generated ${newQuestions.length} questions successfully!` });
      setTimeout(() => setSaveMessage(null), 3000);

    } catch (error) {
      console.error('AI Generation Error:', error);
      toast.error('Failed to generate questions. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddManualQuestion = () => {
    const newQuestion: ExamQuestion = {
      id: `manual-${Date.now()}`,
      type: builderConfig.type,
      text: '',
      options: builderConfig.type === 'multiple-choice' ? ['', '', '', ''] : [],
      correctAnswer: '',
      points: builderConfig.type === 'essay' ? 10 : 2
    };
    setBuilderQuestions([...builderQuestions, newQuestion]);
  };

  const updateQuestion = (id: string, updates: Partial<ExamQuestion>) => {
    setBuilderQuestions(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const deleteQuestion = (id: string) => {
    setBuilderQuestions(prev => prev.filter(q => q.id !== id));
  };

  // Saves the exam to the database/mock store
  const saveExamData = async () => {
    const examId = selectedExamId === 'new' ? undefined : selectedExamId;
    // Pass current user ID as teacherId for ownership
    return await api.updateExamQuestions(builderQuestions, builderConfig.topic || 'Untitled Exam', examId, user?.id);
  }

  const handleSaveExam = async () => {
    if (builderQuestions.length === 0) {
      toast.warning('Please add at least one question.');
      return;
    }
    try {
      const res = await saveExamData();
      if (res.ok) {
          setSaveMessage({ type: 'success', text: `Exam "${builderConfig.topic || 'Untitled'}" saved to Exam Bank!` });
          if (selectedExamId === 'new') {
             setAllExams(prev => [...prev, res.data]);
             setSelectedExamId(res.data.id);
          } else {
             setAllExams(prev => prev.map(e => e.id === res.data.id ? res.data : e));
          }
          setTimeout(() => setSaveMessage(null), 2500);
      }
    } catch (e) {
      setSaveMessage({ type: 'error', text: "Failed to save exam." });
    }
  };

  const handleSaveAndActivate = async () => {
    if (builderQuestions.length === 0) {
        toast.warning('Please add at least one question.');
        return;
    }
    try {
        // 1. Save content first
        const res = await saveExamData();
        if (res.ok) {
            // 2. Activate immediately
            await api.setExamStatus(res.data.id, 'active');
            
            // Update Local State
            const updatedExam = { ...res.data, status: 'active' as const };
            if (selectedExamId === 'new') {
                setAllExams(prev => [...prev, updatedExam]);
                setSelectedExamId(updatedExam.id);
            } else {
                setAllExams(prev => prev.map(e => e.id === updatedExam.id ? updatedExam : e));
            }

            setSaveMessage({ type: 'success', text: `Exam Saved & Activated! Students can now access it.` });
            setTimeout(() => setSaveMessage(null), 4000);
        }
    } catch (e) {
        setSaveMessage({ type: 'error', text: "Failed to save and activate." });
    }
  };

  const handleClearExam = () => {
    if (builderQuestions.length > 0) {
      setConfirmDialog({
        message: 'Are you sure you want to clear all questions? This cannot be undone.',
        onConfirm: () => setBuilderQuestions([])
      });
    }
  };
  
  const handleStartExam = async () => {
      if (!currentExam) return;
      await api.setExamStatus(currentExam.id, 'active');
      setAllExams(prev => prev.map(e => e.id === currentExam.id ? { ...e, status: 'active' } : e));
  };

  const handleEndExam = async () => {
      if (!currentExam) return;
      await api.setExamStatus(currentExam.id, 'ended');
      setAllExams(prev => prev.map(e => e.id === currentExam.id ? { ...e, status: 'ended' } : e));
  };

  // --- Event Handlers for Tooltips ---
  const handleMouseEnter = (e: React.MouseEvent, studentId: string) => {
    setHoveredStudent(studentId);
    setCursorPos({ x: e.clientX + 20, y: e.clientY + 20 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    setCursorPos({ x: e.clientX + 20, y: e.clientY + 20 });
  };

  const handleMouseLeave = () => {
    setHoveredStudent(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in-progress': return 'bg-blue-100 text-blue-700';
      case 'submitted': return 'bg-green-100 text-green-700';
      case 'not-started': return 'bg-gray-100 text-gray-500';
      default: return 'bg-gray-100 text-gray-500';
    }
  };

  const filteredAssessments = useMemo(() => {
      if (studentSearch === '' && gradeFilter === 'All') return assessments;

      return assessments.filter(a => {
          const student = studentMap[a.studentId];
          if (!student) return false;

          const matchesSearch = student.name.toLowerCase().includes(studentSearch.toLowerCase());
          const matchesGrade = gradeFilter === 'All' || student.grade === gradeFilter;
          
          return matchesSearch && matchesGrade;
      });
  }, [assessments, studentSearch, gradeFilter, studentMap]);

  
return { mode, setOpenAccordion, openAccordion, selectedTerm, modifiedRows, setConfirmDialog, setSelectedTerm, selectedClass, schoolClasses, accessibleClasses, user, isFormMaster, setSelectedClass, formMasterGrade, selectedSubject, subjects, visibleSubjects, setSelectedSubject, filteredAssessments, handleAddCA, exportToCSV, handleSave, saving, handlePublish, publishing, caColumns, config, maxTotal, loading, calculateTotal, calculateGrade, studentMap, handleScoreChange, examSubMode, currentExam, handleEndExam, handleStartExam, examStats, students, isImpersonating, handleMouseEnter, handleMouseMove, handleMouseLeave, getStatusColor, handleResetExam, builderConfig, setBuilderConfig, handleGenerateQuestions, isGenerating, setShowImportModal, handleAddManualQuestion, builderQuestions, handleClearExam, handleSaveExam, handleSaveAndActivate, saveMessage, deleteQuestion, updateQuestion, toasts, dismiss, confirmDialog, showCANameModal, newCAName, setNewCAName, confirmAddCA, setShowCANameModal, setMode, setShowSettings, setExamSubMode, selectedExamId, handleExamSelectionChange, allExams, handleSyncScores, showSettings, setCaColumns, deleteCAColumn, setConfig, gradingScale, setGradingScale };
}
export type AssessmentsModel = ReturnType<typeof useAssessmentsModel>;
