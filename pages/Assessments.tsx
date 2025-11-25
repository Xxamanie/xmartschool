
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { api } from '../services/api';
import { Assessment, Student, Subject, ResultData, ExamQuestion, ActiveExam, UserRole } from '../types';
import { GoogleGenAI, Type } from "@google/genai";
import { useAuth } from '../context/AuthContext';
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
  Filter
} from 'lucide-react';

interface ExamSection {
  name: string;
  timeSpent: string;
  status: 'completed' | 'in-progress' | 'pending';
}

interface ExamStat {
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

export const Assessments: React.FC = () => {
  const { isImpersonating, user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [teachers, setTeachers] = useState<Record<string, string>>({}); // Map ID to Name for Admin context
  
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('Term 1');
  
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

  // Modes: Manual Entry, Online Exam Proctoring, Exam Builder
  const [mode, setMode] = useState<'manual' | 'online' | 'builder'>('manual');
  
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

  // Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSourceExamId, setImportSourceExamId] = useState('');
  const [questionsToImport, setQuestionsToImport] = useState<string[]>([]);

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
        const [studentsRes, subjectsRes, examRes] = await Promise.all([
          api.getStudents(),
          api.getSubjects(),
          api.getExams()
        ]);

        if (studentsRes.ok) setStudents(studentsRes.data);
        
        // If Admin, fetch users to map teacher IDs to names
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

        if (subjectsRes.ok && subjectsRes.data.length > 0) {
          let subs = subjectsRes.data;
          // Filter for Teachers (Admins see all)
          if (user?.role === UserRole.TEACHER) {
             subs = subs.filter(s => s.teacherId === user.id);
          }
          setSubjects(subs);
          if (subs.length > 0) {
             setSelectedSubject(subs[0].id);
          } else {
             setSelectedSubject('');
          }
        }
        
        if (examRes.ok && examRes.data.length > 0) {
           let exams = examRes.data;
           // Filter exams for teachers so they only manage their own
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

  // Poll for exam stats updates when in Online mode and an exam is selected
  useEffect(() => {
    if (mode === 'online' && selectedExamId) {
        // Initial load
        updateStats();
        
        // Set interval
        intervalRef.current = setInterval(() => {
           updateStats();
        }, 3000); // Update every 3 seconds
    } else {
        if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [mode, selectedExamId]);

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
          if (!window.confirm("You have unsaved questions in the current new exam. Switching will discard them. Continue?")) {
              return;
          }
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
    if (!selectedSubject) return;
    
    setModifiedRows(new Set()); // Clear modifications on context switch

    const fetchAssessments = async () => {
      setLoading(true);
      try {
        const res = await api.getAssessments(selectedSubject, selectedTerm);
        if (res.ok) {
          // Merge with students to ensure every student has a row
          const mergedData: Assessment[] = students.map(student => {
            const existing = res.data.find(a => a.studentId === student.id);
            if (existing) return existing;
            
            // Create empty record for student
            return {
              id: `temp-${student.id}`,
              studentId: student.id,
              studentName: student.name,
              subjectId: selectedSubject,
              term: selectedTerm,
              ca1: 0,
              ca2: 0,
              ca3: 0,
              exam: 0
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

    if (students.length > 0) {
      fetchAssessments();
    }
  }, [selectedSubject, selectedTerm, students]);

  // NEW: Handle safe navigation for dropdowns
  const handleSubjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
     const newValue = e.target.value;
     if (modifiedRows.size > 0) {
         if(!window.confirm("You have unsaved changes. Switching subjects will discard them.")) {
             return;
         }
     }
     setSelectedSubject(newValue);
  };

  const handleTermChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
     const newValue = e.target.value;
     if (modifiedRows.size > 0) {
         if(!window.confirm("You have unsaved changes. Switching terms will discard them.")) {
             return;
         }
     }
     setSelectedTerm(newValue);
  };

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
    if (window.confirm('Are you sure you want to publish these results? This will update the main Results sheet.')) {
      setPublishing(true);
      setSaveMessage(null);
      try {
        const subject = subjects.find(s => s.id === selectedSubject);
        
        const resultsToPublish: ResultData[] = assessments.map(a => {
            const total = calculateTotal(a);
            const grade = calculateGrade(total);
            
            // Capture details
            const details: any = { exam: a.exam };
            caColumns.forEach(col => {
               details[col.id] = (a as any)[col.id];
            });

            return {
                id: `res-${a.studentId}-${selectedSubject}`, // Unique ID per subject per student
                studentName: a.studentName,
                studentId: a.studentId,
                subjectName: subject?.name || 'Unknown Subject',
                average: total,
                grade: grade,
                status: 'Published',
                remarks: '',
                details: details
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
    if (window.confirm('GOD MODE ACTION: Are you sure you want to reset this student\'s exam?\n\nThis action is intended for UNDUE SUBMISSION cases only. It will wipe the previous score and allow the student to retake the exam immediately.')) {
        try {
            await api.resetStudentExam(selectedExamId, studentId);
            
            // Update local state
            setExamStats(prev => ({
                ...prev,
                [studentId]: {
                    status: 'not-started',
                    progress: 0,
                    score: undefined,
                    startTime: undefined
                }
            }));
            setSaveMessage({ type: 'success', text: 'Exam reset successfully.' });
            setTimeout(() => setSaveMessage(null), 3000);
        } catch (e) {
            setSaveMessage({ type: 'error', text: 'Failed to reset exam.' });
        }
    }
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
    const defaultName = `CA ${nextNum}`;
    const name = window.prompt("Enter a name for the new Continuous Assessment (CA):", defaultName);
    if (name) {
      const newId = `ca_${Date.now()}`; 
      setCaColumns([...caColumns, { id: newId, label: name, maxScore: 10 }]);
    }
  };

  const deleteCAColumn = (id: string) => {
    if (window.confirm('Are you sure you want to delete this column?')) {
        setCaColumns(caColumns.filter(c => c.id !== id));
    }
  };

  // --- Exam Builder Logic ---

  const handleGenerateQuestions = async () => {
    if (!builderConfig.topic) {
      alert('Please enter a topic to generate questions.');
      return;
    }
    setIsGenerating(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      let formatInstructions = "";
      if (builderConfig.type === 'multiple-choice') {
        formatInstructions = "Format: Multiple Choice. Provide exactly 4 distinct options for each question. The 'correctAnswer' must be one of the options.";
      } else if (builderConfig.type === 'true-false') {
        formatInstructions = "Format: True/False. The 'correctAnswer' must be exactly 'True' or 'False'. The 'options' array must be empty [].";
      } else if (builderConfig.type === 'short-answer') {
        formatInstructions = "Format: Short Answer. Provide a concise correct answer. The 'options' array must be empty [].";
      } else if (builderConfig.type === 'essay') {
         formatInstructions = "Format: Essay. Provide key grading points as the 'correctAnswer'. The 'options' array must be empty [].";
      }

      const prompt = `Create ${builderConfig.count} ${builderConfig.difficulty} level questions about "${builderConfig.topic}". ${formatInstructions}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction: "You are an expert educational assessment specialist. Generate high-quality exam questions suitable for high school students. Ensure strict adherence to the requested JSON schema and question type constraints.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING, description: "The question stem" },
                options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of options for MCQs (empty for others)" },
                correctAnswer: { type: Type.STRING, description: "The correct answer or grading key" },
                points: { type: Type.NUMBER, description: "Suggested score value" }
              },
              required: ["text", "options", "correctAnswer", "points"]
            }
          }
        }
      });

      let generatedText = response.text;
      if (!generatedText) throw new Error("No content generated");
      
      // Robust JSON extraction
      const jsonMatch = generatedText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
          generatedText = jsonMatch[0];
      } else {
          generatedText = generatedText.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "");
      }
      
      const generated = JSON.parse(generatedText);
      
      const newQuestions: ExamQuestion[] = generated.map((q: any) => ({
        id: `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
      alert('Failed to generate questions. Please try again.');
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
      alert("Please add at least one question.");
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
        alert("Please add at least one question.");
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

  const handleImportQuestions = () => {
      if (!importSourceExamId) return;
      const sourceExam = allExams.find(e => e.id === importSourceExamId);
      if (!sourceExam) return;

      const questionsToAdd = sourceExam.questions
          .filter(q => questionsToImport.includes(q.id))
          .map(q => ({...q, id: `imp-${Date.now()}-${Math.random().toString(36).substr(2,5)}`})); // Clone with new IDs

      setBuilderQuestions(prev => [...prev, ...questionsToAdd]);
      setShowImportModal(false);
      setQuestionsToImport([]);
      setSaveMessage({ type: 'success', text: `Imported ${questionsToAdd.length} questions successfully.` });
      setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleClearExam = () => {
    if (builderQuestions.length > 0) {
      if (window.confirm('Are you sure you want to clear all questions? This cannot be undone.')) {
        setBuilderQuestions([]);
      }
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

  // Helper to get current teacher name for display
  const currentSubjectData = subjects.find(s => s.id === selectedSubject);
  const currentTeacherName = currentSubjectData ? teachers[currentSubjectData.teacherId] : null;

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

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assessments</h1>
          <p className="text-gray-500">Manage continuous assessments, examinations, and question banks.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
          <div className="bg-gray-100 p-1 rounded-lg flex items-center self-start sm:self-auto">
            <button
              onClick={() => setMode('manual')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${mode === 'manual' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <FileSpreadsheet size={16} />
              Gradebook
            </button>
            <button
              onClick={() => setMode('online')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${mode === 'online' ? 'bg-white shadow text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Monitor size={16} />
              Proctoring
            </button>
            <button
              onClick={() => setMode('builder')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${mode === 'builder' ? 'bg-white shadow text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <BrainCircuit size={16} />
              Exam Builder
            </button>
          </div>
          
          {/* Mode specific actions */}
          {(mode === 'online' || mode === 'builder') && (
              <div className="flex items-center gap-2">
                  <select 
                    value={selectedExamId}
                    onChange={handleExamSelectionChange}
                    className="block pl-3 pr-8 py-1.5 text-sm border border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 rounded-lg max-w-[200px]"
                  >
                      <option value="" disabled>Select Exam</option>
                      {mode === 'builder' && <option value="new">+ Create New Exam</option>}
                      {allExams.map(e => (
                          <option key={e.id} value={e.id}>{e.title} ({e.status})</option>
                      ))}
                  </select>
              </div>
          )}

          <div className="h-8 w-px bg-gray-200 hidden sm:block"></div>
          
          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 items-center">
             {mode === 'manual' && (
               <button
                  onClick={handleAddCA}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors whitespace-nowrap"
               >
                  <Plus size={16} />
                  Add CA
               </button>
             )}
             {mode !== 'builder' && (
               <button 
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap"
              >
                <Settings size={16} className="text-gray-600" />
                Settings
              </button>
             )}
            {mode === 'manual' && (
              <>
                <button 
                  onClick={exportToCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  <FileSpreadsheet size={16} className="text-green-600" />
                  Export Excel
                </button>
                <button 
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-70 whitespace-nowrap"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save
                </button>
                <button 
                  onClick={handlePublish}
                  disabled={publishing}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-70 whitespace-nowrap"
                  title="Publish grades to the Results page"
                >
                  {publishing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Publish Results
                </button>
              </>
            )}
             {mode === 'online' && (
               <button 
                  onClick={handleSyncScores}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors whitespace-nowrap"
                >
                  <RefreshCw size={16} />
                  Sync Scores
                </button>
            )}
          </div>
        </div>
      </div>

      {/* Settings Modal (Existing) */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 m-4 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Assessment Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-6">
              {/* ... (Previous settings code remains same) ... */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">Continuous Assessments (Max Scores)</h3>
                <div className="grid grid-cols-1 gap-3">
                  {caColumns.map(col => (
                    <div key={col.id} className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 mb-1">{col.label}</label>
                        <input 
                          type="number" 
                          value={col.maxScore}
                          onChange={(e) => {
                            const newMax = parseInt(e.target.value) || 0;
                            setCaColumns(cols => cols.map(c => c.id === col.id ? {...c, maxScore: newMax} : c));
                          }}
                          className="block w-full border border-gray-300 rounded-lg p-2.5 focus:ring-primary-500 focus:border-primary-500 text-sm"
                        />
                      </div>
                      <button 
                         onClick={() => deleteCAColumn(col.id)}
                         className="p-2.5 text-red-500 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition-colors"
                         title="Remove this column"
                      >
                         <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={handleAddCA}
                  className="mt-3 flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
                >
                  <Plus size={14} />
                  Add another CA type
                </button>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Examination & Passing</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Exam Max Score</label>
                    <input 
                      type="number" 
                      value={config.examMax}
                      onChange={(e) => setConfig({...config, examMax: parseInt(e.target.value) || 0})}
                      className="block w-full border border-gray-300 rounded-lg p-2.5 focus:ring-primary-500 focus:border-primary-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Pass Mark (Score)</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        value={config.passMark}
                        onChange={(e) => setConfig({...config, passMark: parseInt(e.target.value) || 0})}
                        className="block w-full border border-gray-300 rounded-lg p-2.5 focus:ring-primary-500 focus:border-primary-500 text-sm"
                      />
                      <span className="text-gray-500 text-sm font-medium">/ {maxTotal}</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Current Total Obtainable Score: <span className="font-bold text-gray-900">{maxTotal}</span>
                </p>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Grading Scale (Min %)</h3>
                <div className="space-y-2">
                  {gradingScale.map((threshold, index) => (
                     <div key={index} className="flex items-center gap-3">
                        <input 
                          type="text" 
                          value={threshold.grade}
                          onChange={(e) => {
                             const newScale = [...gradingScale];
                             newScale[index].grade = e.target.value;
                             setGradingScale(newScale);
                          }}
                          className="w-16 border border-gray-300 rounded-lg p-2 text-sm text-center font-medium"
                        />
                        <span className="text-gray-500 text-sm">≥</span>
                        <div className="relative flex-1">
                           <input 
                             type="number" 
                             value={threshold.minPercentage}
                             onChange={(e) => {
                                const newScale = [...gradingScale];
                                newScale[index].minPercentage = Number(e.target.value);
                                setGradingScale(newScale); 
                             }}
                             className="w-full border border-gray-300 rounded-lg p-2 text-sm pr-8"
                           />
                           <span className="absolute right-3 top-2 text-gray-500 text-xs">%</span>
                        </div>
                     </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-4 gap-3 border-t border-gray-200">
                 <button 
                   onClick={() => setShowSettings(false)}
                   className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
                 >
                   Done
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {mode === 'manual' && (
        /* Spreadsheet Table */
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                    Student Name
                  </th>
                  {caColumns.map(col => (
                    <th key={col.id} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                      {col.label} <span className="text-gray-400">({col.maxScore})</span>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Exam <span className="text-gray-400">({config.examMax})</span>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24 bg-gray-100">
                    Total <span className="text-gray-400">({maxTotal})</span>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24 bg-gray-100">
                    Pass/Fail
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24 bg-gray-100" title="Grade based on total score percentage">
                    Grade
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={caColumns.length + 5} className="px-6 py-4">
                        <div className="h-4 bg-gray-100 rounded animate-pulse"></div>
                      </td>
                    </tr>
                  ))
                ) : filteredAssessments.length > 0 ? (
                  filteredAssessments.map((assessment) => {
                    const total = calculateTotal(assessment);
                    const grade = calculateGrade(total);
                    const isPassing = total >= config.passMark;
                    const isModified = modifiedRows.has(assessment.id);
                    
                    return (
                      <tr key={assessment.id} className={`transition-colors ${isModified ? 'bg-amber-50/50' : 'hover:bg-gray-50'}`}>
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900 relative">
                          {isModified && (
                              <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-amber-400 rounded-r"></div>
                          )}
                          <div className="flex flex-col">
                             <span>{assessment.studentName}</span>
                             <span className="text-xs text-gray-400 font-normal">{studentMap[assessment.studentId]?.grade || 'Unknown Grade'}</span>
                          </div>
                        </td>
                        {caColumns.map(col => (
                          <td key={col.id} className="px-2 py-2">
                            <input
                              type="number"
                              min="0"
                              max={col.maxScore}
                              value={(assessment as any)[col.id] ?? ''}
                              onChange={(e) => handleScoreChange(assessment.id, col.id, e.target.value)}
                              className="w-full text-center p-1 border border-gray-200 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                            />
                          </td>
                        ))}
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min="0"
                            max={config.examMax}
                            value={assessment.exam || ''}
                            onChange={(e) => handleScoreChange(assessment.id, 'exam', e.target.value)}
                            className="w-full text-center p-1 border border-gray-200 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all font-medium"
                          />
                        </td>
                        <td className={`px-4 py-3 text-center text-sm font-bold bg-gray-50 ${!isPassing ? 'text-red-600' : 'text-gray-900'}`}>
                          {total}
                        </td>
                        <td className="px-4 py-3 text-center bg-gray-50">
                          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium ${
                            isPassing ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {isPassing ? 'Pass' : 'Fail'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center bg-gray-50">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                            grade === 'F' ? 'bg-red-100 text-red-800' :
                            grade.startsWith('A') ? 'bg-green-100 text-green-800' :
                            grade === 'B' ? 'bg-blue-100 text-blue-800' :
                            grade === 'C' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-200 text-gray-800'
                          }`}>
                            {grade}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={caColumns.length + 5} className="px-6 py-12 text-center text-gray-500">
                      {selectedSubject ? 'No students found matching criteria.' : 'Select a subject and term to view assessments.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Online and Builder modes are handled below... */}
      {mode === 'online' && (
        /* Online Exam Mode */
        <div className="space-y-6 animate-in fade-in duration-300">
          {currentExam ? (
            <>
              {/* Exam Control Panel */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-lg font-bold text-gray-900">{currentExam.title}</h2>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${
                          currentExam.status === 'active' ? 'bg-green-100 text-green-800' : 
                          currentExam.status === 'ended' ? 'bg-gray-100 text-gray-800' : 
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {currentExam.status === 'active' && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>}
                          {currentExam.status === 'active' ? 'Live' : currentExam.status === 'ended' ? 'Completed' : 'Scheduled'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <Clock size={16} />
                          <span>Duration: {currentExam.duration} mins</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Globe size={16} />
                          <span>Access Code: <span className="font-mono text-gray-900 font-medium">EXAM-{currentExam.id.slice(-4).toUpperCase()}</span></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                       {currentExam.status === 'active' ? (
                         <button 
                           onClick={handleEndExam}
                           className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-lg text-sm font-medium transition-colors"
                         >
                           <Square size={16} fill="currentColor" />
                           End Exam
                         </button>
                       ) : (
                         <button 
                           onClick={handleStartExam}
                           disabled={currentExam.status === 'ended'}
                           className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                         >
                           <Play size={16} fill="currentColor" />
                           Start Exam
                         </button>
                       )}
                    </div>
                 </div>
              </div>

              {/* Live Dashboard */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Stats Cards */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Active Students</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {(Object.values(examStats) as ExamStat[]).filter(s => s.status === 'in-progress').length}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                    <Wifi size={20} />
                  </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Submitted</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {(Object.values(examStats) as ExamStat[]).filter(s => s.status === 'submitted').length} / {students.length}
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 text-green-600 rounded-lg">
                    <CheckCircle2 size={20} />
                  </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Avg. Score (Real-time)</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {(() => {
                        const scores = (Object.values(examStats) as ExamStat[]).filter(s => s.score !== undefined).map(s => s.score!);
                        if (scores.length === 0) return '-';
                        return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
                      })()} <span className="text-sm text-gray-400 font-normal">/ {currentExam.questions.reduce((a,b) => a+b.points, 0)}</span>
                    </p>
                  </div>
                  <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
                    <Monitor size={20} />
                  </div>
                </div>
              </div>

              {/* Student List */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                  <h3 className="font-semibold text-gray-900">Student Proctoring</h3>
                  <div className="text-sm text-gray-500">
                    Auto-refreshing live data
                  </div>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Started At</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score (Auto)</th>
                      {isImpersonating && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {students.map(student => {
                      const stat: ExamStat = examStats[student.id] || { status: 'not-started', progress: 0 };
                      return (
                        <tr 
                          key={student.id} 
                          className="hover:bg-gray-50 cursor-default transition-colors"
                          onMouseEnter={(e) => handleMouseEnter(e, student.id)}
                          onMouseMove={handleMouseMove}
                          onMouseLeave={handleMouseLeave}
                        >
                          <td className="px-6 py-4 whitespace-nowrap font-medium text-sm text-gray-900">{student.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(stat.status)}`}>
                              {stat.status.replace('-', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="w-full max-w-xs bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full transition-all duration-500 ${stat.status === 'submitted' ? 'bg-green-500' : 'bg-blue-500'}`} 
                                style={{ width: `${stat.progress}%` }}
                              ></div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {stat.startTime || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                            {stat.score !== undefined ? stat.score : '-'}
                          </td>
                          {isImpersonating && (
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                {stat.status === 'submitted' && (
                                    <button 
                                        onClick={() => handleResetExam(student.id)}
                                        className="group flex items-center justify-end gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-md hover:bg-amber-200 border border-amber-200 transition-all shadow-sm ml-auto"
                                        title="God Mode: Reset submission (Undue Submission)"
                                    >
                                        <RotateCcw size={14} className="group-hover:-rotate-180 transition-transform duration-500" />
                                        <span className="text-xs font-bold uppercase tracking-wider">Reset</span>
                                    </button>
                                )}
                              </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
             <div className="flex flex-col items-center justify-center p-12 bg-white border border-gray-200 rounded-xl text-gray-500">
                <p className="font-medium text-lg">No exam selected.</p>
                <p className="text-sm">Please select an exam from the dropdown above to view proctoring status.</p>
             </div>
          )}
        </div>
      )}
      
      {mode === 'builder' && (
         /* Exam Builder Mode */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          {/* Left Sidebar: Configuration */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <BrainCircuit size={20} className="text-purple-600" />
                Exam Configuration
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Context / Topic</label>
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={builderConfig.topic}
                      onChange={(e) => setBuilderConfig({...builderConfig, topic: e.target.value})}
                      placeholder="e.g. Photosynthesis, World War II, Calculus Derivatives..."
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-purple-500 focus:border-purple-500 min-h-[80px] resize-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Question Type</label>
                    <select
                      value={builderConfig.type}
                      onChange={(e) => setBuilderConfig({...builderConfig, type: e.target.value as any})}
                      className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-purple-500 focus:border-purple-500"
                    >
                      <option value="multiple-choice">Multiple Choice</option>
                      <option value="true-false">True / False</option>
                      <option value="short-answer">Short Answer</option>
                      <option value="essay">Essay</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Difficulty</label>
                    <select
                      value={builderConfig.difficulty}
                      onChange={(e) => setBuilderConfig({...builderConfig, difficulty: e.target.value as any})}
                      className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-purple-500 focus:border-purple-500"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Number of Questions</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={builderConfig.count}
                    onChange={(e) => setBuilderConfig({...builderConfig, count: parseInt(e.target.value) || 1})}
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>

                <button
                  onClick={handleGenerateQuestions}
                  disabled={isGenerating}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-70 hover:scale-[1.02]"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Generating Questions...
                    </>
                  ) : (
                    <>
                      <Wand2 size={18} />
                      Generate with AI
                    </>
                  )}
                </button>
                
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-2 bg-white text-xs text-gray-500">or</span>
                  </div>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                        title="Reuse questions from other exams"
                    >
                        <Library size={16} />
                        Import
                    </button>
                    <button
                        onClick={handleAddManualQuestion}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                    >
                        <PenTool size={16} />
                        Manual
                    </button>
                </div>
              </div>
            </div>
            
            {builderQuestions.length > 0 && (
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                 <div className="flex justify-between items-center mb-4">
                    <span className="text-sm font-medium text-gray-500">Total Questions: {builderQuestions.length}</span>
                    <span className="text-sm font-bold text-gray-900">Total Points: {builderQuestions.reduce((acc, q) => acc + q.points, 0)}</span>
                 </div>
                 <div className="space-y-3 w-full">
                    <div className="flex gap-2">
                        <button 
                            onClick={handleClearExam}
                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                        >
                            <Eraser size={16} />
                            Clear
                        </button>
                        <button 
                            onClick={handleSaveExam}
                            className="flex-[2] flex items-center justify-center gap-2 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors"
                            title="Save to the Exam Bank"
                        >
                            <Save size={16} />
                            Save to Bank
                        </button>
                    </div>
                    
                    <button 
                        onClick={handleSaveAndActivate}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-bold shadow-md hover:shadow-lg transition-all hover:scale-[1.01]"
                        title="Save and immediately publish for students"
                    >
                        <CheckSquare size={18} />
                        Save & Activate Exam Now
                    </button>
                    <p className="text-[10px] text-center text-gray-500">
                        Activated exams are immediately available in the Online Proctoring tab. Correct answers are saved for auto-marking.
                    </p>
                 </div>
                 {saveMessage && (
                    <p className={`mt-3 text-xs text-center font-medium animate-in fade-in slide-in-from-top-2 ${saveMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                       {saveMessage.text}
                    </p>
                 )}
              </div>
            )}
          </div>

          {/* Right Side: Question List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-between items-center">
               <h3 className="text-lg font-bold text-gray-900">Exam Questions</h3>
               {/* Redundant dropdowns removed */}
            </div>

            {builderQuestions.length === 0 ? (
              <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-12 text-center flex flex-col items-center justify-center text-gray-500">
                 <LayoutList size={48} className="mb-4 text-gray-400" />
                 <p className="text-lg font-medium text-gray-900">No questions yet</p>
                 <p className="text-sm mt-1">Use the configuration panel to generate questions with AI, import from bank, or add manually.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {builderQuestions.map((question, index) => (
                  <div key={question.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 relative group hover:border-purple-200 transition-colors">
                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => deleteQuestion(question.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                        title="Delete Question"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="flex gap-4">
                      <span className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-bold text-gray-600">
                        {index + 1}
                      </span>
                      
                      <div className="flex-1 space-y-3">
                        {/* Question Text */}
                        <div className="flex gap-2 items-start">
                           <textarea
                             value={question.text}
                             onChange={(e) => updateQuestion(question.id, { text: e.target.value })}
                             className="w-full border-none p-0 text-base font-medium text-gray-900 focus:ring-0 resize-none bg-transparent placeholder-gray-400"
                             placeholder="Enter question text here..."
                             rows={2}
                           />
                        </div>

                        {/* Options / Answer Area */}
                        {question.type === 'multiple-choice' && (
                          <div className="space-y-2 pl-1">
                            {question.options?.map((option, optIndex) => (
                              <div key={optIndex} className="flex items-center gap-3">
                                <div 
                                   className={`w-4 h-4 rounded-full border flex items-center justify-center cursor-pointer ${question.correctAnswer === option && option !== '' ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}
                                   onClick={() => updateQuestion(question.id, { correctAnswer: option })}
                                >
                                   {question.correctAnswer === option && option !== '' && <div className="w-2 h-2 rounded-full bg-green-500" />}
                                </div>
                                <input
                                  type="text"
                                  value={option}
                                  onChange={(e) => {
                                    const newOptions = [...(question.options || [])];
                                    newOptions[optIndex] = e.target.value;
                                    // If this was the correct answer, update that too
                                    let updates: any = { options: newOptions };
                                    if (question.correctAnswer === option) {
                                        updates.correctAnswer = e.target.value;
                                    }
                                    updateQuestion(question.id, updates);
                                  }}
                                  className={`flex-1 border-b border-gray-200 py-1 text-sm focus:outline-none focus:border-purple-500 ${question.correctAnswer === option && option !== '' ? 'text-green-700 font-medium' : 'text-gray-600'}`}
                                  placeholder={`Option ${optIndex + 1}`}
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {question.type === 'true-false' && (
                          <div className="flex gap-4 mt-2">
                             {['True', 'False'].map(opt => (
                               <label key={opt} className="flex items-center gap-2 cursor-pointer">
                                 <input 
                                   type="radio" 
                                   name={`q-${question.id}`}
                                   checked={question.correctAnswer === opt}
                                   onChange={() => updateQuestion(question.id, { correctAnswer: opt })}
                                   className="text-purple-600 focus:ring-purple-500"
                                 />
                                 <span className="text-sm text-gray-700">{opt}</span>
                               </label>
                             ))}
                          </div>
                        )}
                        
                        {(question.type === 'short-answer' || question.type === 'essay') && (
                           <div className="mt-2">
                             <input 
                               type="text"
                               value={question.correctAnswer}
                               onChange={(e) => updateQuestion(question.id, { correctAnswer: e.target.value })}
                               className="w-full border border-gray-200 rounded-lg p-2 text-sm text-gray-600 bg-white"
                               placeholder="Enter sample correct answer / keywords..."
                             />
                           </div>
                        )}

                        {/* Footer: Points & Tag */}
                        <div className="flex items-center gap-4 mt-2 pt-2 border-t border-gray-50">
                           <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Points</span>
                              <input 
                                type="number"
                                min="0"
                                value={question.points}
                                onChange={(e) => updateQuestion(question.id, { points: parseInt(e.target.value) || 0 })}
                                className="w-16 border border-gray-200 rounded-md py-1 px-2 text-xs text-center"
                              />
                           </div>
                           <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] uppercase font-bold">
                             {question.type.replace('-', ' ')}
                           </span>
                           {question.correctAnswer && (
                               <span className="flex items-center gap-1 text-[10px] text-green-600 font-medium ml-auto">
                                   <CheckCircle2 size={12} />
                                   Answer Key Set
                               </span>
                           )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
