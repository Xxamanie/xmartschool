import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { 
  Download, Search, FileText, TrendingUp, Award, CheckCircle2, Wand2, Loader2,
  ArrowUpDown, ArrowUp, ArrowDown, Printer, X, GraduationCap, Camera, Calendar, Users, Eye
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { ToastContainer } from '../components/Toast';
import { useToast } from '../src/utils/useToast';
import { api } from '../services/api';
import { ResultData, School, Student, UserRole, Subject } from '../types';
import { useAuth } from '../context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';

const GRADE_DISTRIBUTION_COLORS: Record<string, string> = {
  'A+': '#22c55e',
  'A': '#4ade80',
  'B': '#60a5fa',
  'C': '#fbbf24',
  'D': '#f97316',
  'F': '#ef4444',
};

const REPORT_COLORS = {
  primary: '#059669',
  dark: '#065F46',
  accent: '#ECFDF5',
  background: '#FFFFFF',
  paper: '#FAFAFA',
  border: '#D1D5DB',
  text: '#111827',
  muted: '#6B7280',
};

const getGradeTextClass = (grade: string) => {
  if (grade.startsWith('A')) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (grade.startsWith('B')) return 'text-blue-700 bg-blue-50 border-blue-200';
  if (grade.startsWith('C') || grade.startsWith('D') || grade.startsWith('E')) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-red-700 bg-red-50 border-red-200';
};

const formatPosition = (position?: number) => {
  if (!position) return 'N/A';
  const mod10 = position % 10;
  const mod100 = position % 100;
  if (mod10 === 1 && mod100 !== 11) return `${position}st`;
  if (mod10 === 2 && mod100 !== 12) return `${position}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${position}rd`;
  return `${position}th`;
};

// Extended types for dynamic assessment
interface AssessmentColumn {
  id: string;
  label: string;
  type: 'ca' | 'exam' | 'project' | 'assignment' | 'test';
  maxScore: number;
  weight: number;
  order: number;
}

interface SubjectScore {
  subjectId: string;
  subjectName: string;
  scores: Record<string, number>;
  total: number;
  grade: string;
  remark: string;
}

interface DynamicResultData extends ResultData {
  studentPhoto?: string;
  admissionNo?: string;
  classPopulation?: number;
  position?: number;

  session?: string;
  term?: string;
  assessmentConfig?: AssessmentColumn[];
  subjects?: SubjectScore[];
  attendance?: {
    present: number;
    total: number;
  };
  principalRemark?: string;
  nextTermBegins?: string;
}


// Grading System Utility
class GradingSystem {
  static calculateGrade(total: number, maxTotal: number, schoolType: string = 'nigeria'): { grade: string; remark: string } {
    const percentage = (total / maxTotal) * 100;
    
    const gradingScales: Record<string, Array<{ min: number; grade: string; remark: string }>> = {
      nigeria: [
        { min: 70, grade: 'A', remark: 'Excellent' },
        { min: 60, grade: 'B', remark: 'Very Good' },
        { min: 50, grade: 'C', remark: 'Good' },
        { min: 45, grade: 'D', remark: 'Average' },
        { min: 40, grade: 'E', remark: 'Pass' },
        { min: 0, grade: 'F', remark: 'Fail' }
      ],
      british: [
        { min: 90, grade: 'A*', remark: 'Outstanding' },
        { min: 80, grade: 'A', remark: 'Excellent' },
        { min: 70, grade: 'B', remark: 'Very Good' },
        { min: 60, grade: 'C', remark: 'Good' },
        { min: 50, grade: 'D', remark: 'Satisfactory' },
        { min: 40, grade: 'E', remark: 'Pass' },
        { min: 0, grade: 'F', remark: 'Fail' }
      ],
      american: [
        { min: 90, grade: 'A', remark: 'Excellent' },
        { min: 80, grade: 'B', remark: 'Good' },
        { min: 70, grade: 'C', remark: 'Average' },
        { min: 60, grade: 'D', remark: 'Below Average' },
        { min: 0, grade: 'F', remark: 'Fail' }
      ]
    };
    
    const scale = gradingScales[schoolType] || gradingScales.nigeria;
    const result = scale.find(s => percentage >= s.min);
    return { grade: result?.grade || 'F', remark: result?.remark || 'Fail' };
  }
}

export const Results: React.FC = () => {
  const { user } = useAuth();
  const { toasts, toast, dismiss } = useToast();
  const [results, setResults] = useState<DynamicResultData[]>([]);
  const [allSchools, setAllSchools] = useState<School[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [attendanceSummaries, setAttendanceSummaries] = useState<Record<string, { present: number; total: number }>>({});
  const [loading, setLoading] = useState(true);
  const [loadingRemarkId, setLoadingRemarkId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Report Card State
  const [selectedReportCards, setSelectedReportCards] = useState<DynamicResultData[]>([]);
  const [showReportSelector, setShowReportSelector] = useState(false);
  const [selectedTermFilter, setSelectedTermFilter] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('');
  
  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'studentName',
    direction: 'asc'
  });

  // Virtual Scroll State
  const [scrollTop, setScrollTop] = useState(0);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const rowHeight = 64;
  const tableHeight = 600;

  // Dynamic assessment columns (default if not provided)
  const defaultAssessmentColumns: AssessmentColumn[] = [
    { id: 'ca1', label: '1st CA', type: 'ca', maxScore: 20, weight: 20, order: 1 },
    { id: 'ca2', label: '2nd CA', type: 'ca', maxScore: 20, weight: 20, order: 2 },
    { id: 'ca3', label: '3rd CA', type: 'ca', maxScore: 20, weight: 20, order: 3 },
    { id: 'exam', label: 'Exam', type: 'exam', maxScore: 60, weight: 60, order: 4 }
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resResults, resSchools, resStudents, resSubjects] = await Promise.all([
            api.getResults(),
            api.getSchools(),
            api.getStudents(),
            api.getSubjects()
        ]);

        if (resResults.ok) {
          const transformedResults = resResults.data.map((result: any) => ({
            ...result,
            admissionNo: result.admissionNo || result.studentId,
            session: result.session || '2025/2026',
            term: result.term || 'First Term',
            verificationToken: result.verificationToken || `SS-${new Date().getFullYear()}-${String(result.id).slice(-6).toUpperCase()}`,
            position: result.position || undefined,
            classPopulation: result.classPopulation || undefined,
            assessmentConfig: defaultAssessmentColumns,
            subjects: result.subjects || [{
              subjectId: result.subjectId || '001',
              subjectName: result.subjectName || 'General Studies',
              scores: {
                ca1: result.details?.ca1 || 0,
                ca2: result.details?.ca2 || 0,
                ca3: result.details?.ca3 || 0,
                exam: result.details?.exam || 0
              },
              total: result.average || 0,
              grade: result.grade || 'F',
              remark: result.remarks || 'No remark'
            }],
            principalRemark: result.principalRemark || 'Result reviewed and approved for official school use.'
          }));
          setResults(transformedResults);

          // Fetch real attendance for all unique students
          const uniqueStudentIds = [...new Set(resResults.data.map((r: any) => r.studentId as string))];
          if (uniqueStudentIds.length > 0) {
            const attRes = await api.getAttendanceSummaries(uniqueStudentIds);
            if (attRes.ok) setAttendanceSummaries(attRes.data);
          }
        }
        if (resSchools.ok) setAllSchools(resSchools.data);
        if (resStudents.ok) setAllStudents(resStudents.data);
        if (resSubjects.ok) setAllSubjects(resSubjects.data);

      } catch (error) {
        console.error("Failed to fetch data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleGenerateRemark = async (result: DynamicResultData) => {
    setLoadingRemarkId(result.id);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const prompt = `Generate a concise (max 15 words), professional, and encouraging report card remark for a high school student named ${result.studentName} who scored an average of ${result.average}%. The grade is ${result.grade}.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const remark = response.text;
      
      setResults(prev => prev.map(r => r.id === result.id ? { ...r, remarks: remark } : r));
    } catch (error) {
      console.error("Failed to generate remark", error);
      toast.error("Failed to generate remark. Please try again.");
    } finally {
      setLoadingRemarkId(null);
    }
  };

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Get assessment columns from first result or use default
  const assessmentColumns = useMemo(() => {
    if (results.length > 0 && results[0].assessmentConfig) {
      return results[0].assessmentConfig;
    }
    return defaultAssessmentColumns;
  }, [results]);

  const filteredAndSortedResults = useMemo(() => {
    let filtered = results;

    if (user?.role === UserRole.TEACHER) {
        const mySubjectNames = new Set(allSubjects.filter(s => s.teacherId === user.id).map(s => s.name));
        filtered = filtered.filter(r => mySubjectNames.has(r.subjectName || ''));
    }

    filtered = filtered.filter(r => 
      r.studentName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (r.admissionNo && r.admissionNo.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return filtered.sort((a, b) => {
      let aVal: any = a[sortConfig.key as keyof DynamicResultData];
      let bVal: any = b[sortConfig.key as keyof DynamicResultData];

      if (sortConfig.key === 'average') {
        aVal = a.average;
        bVal = b.average;
      } else if (sortConfig.key === 'studentName') {
        aVal = a.studentName;
        bVal = b.studentName;
      }

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [results, searchTerm, sortConfig, user, allSubjects]);

  const availableTerms = useMemo(() => {
    return Array.from(new Set(results.map((result) => result.term).filter(Boolean) as string[])).sort();
  }, [results]);

  const availableClasses = useMemo(() => {
    const studentIdsForTerm = selectedTermFilter
      ? new Set(results.filter((result) => result.term === selectedTermFilter).map((result) => result.studentId))
      : null;

    return Array.from(
      new Set(
        allStudents
          .filter((student) => !studentIdsForTerm || studentIdsForTerm.has(student.id))
          .map((student) => student.grade)
          .filter(Boolean),
      ),
    ).sort();
  }, [allStudents, results, selectedTermFilter]);

  const gradeDist = useMemo(() => {
    const dist: Record<string, number> = { 'A+': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0 };
    filteredAndSortedResults.forEach(r => {
      if (dist[r.grade] !== undefined) dist[r.grade]++;
      else dist['F']++; 
    });
    return Object.keys(dist).map(key => ({
      name: key,
      value: dist[key],
      color: GRADE_DISTRIBUTION_COLORS[key] || '#cccccc'
    }));
  }, [filteredAndSortedResults]);

  const passFailData = useMemo(() => {
    let pass = 0;
    let fail = 0;
    filteredAndSortedResults.forEach(r => {
      if (r.grade === 'F') fail++;
      else pass++;
    });
    return [
      { name: 'Pass', value: pass, color: '#22c55e' },
      { name: 'Fail', value: fail, color: '#ef4444' }
    ];
  }, [filteredAndSortedResults]);

  const classAverage = filteredAndSortedResults.length > 0 
    ? (filteredAndSortedResults.reduce((acc, r) => acc + r.average, 0) / filteredAndSortedResults.length).toFixed(1) 
    : '0.0';
    
  const passRate = filteredAndSortedResults.length > 0
    ? ((passFailData[0].value / filteredAndSortedResults.length) * 100).toFixed(0)
    : '0';

  const topStudent = filteredAndSortedResults.length > 0
    ? filteredAndSortedResults.reduce((prev, current) => (prev.average > current.average) ? prev : current)
    : null;

  // Virtual Scroll Calculation
  const totalItems = filteredAndSortedResults.length;
  const startIndex = Math.floor(scrollTop / rowHeight);
  const visibleNodeCount = Math.ceil(tableHeight / rowHeight) + 4;
  const endIndex = Math.min(totalItems, startIndex + visibleNodeCount);
  const visibleData = filteredAndSortedResults.slice(startIndex, endIndex);
  const paddingTop = startIndex * rowHeight;
  const paddingBottom = (totalItems - endIndex) * rowHeight;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
  };

  const handlePrint = () => {
    window.print();
  };

  const openReportSelector = () => {
    setSelectedTermFilter('');
    setSelectedClassFilter('');
    setShowReportSelector(true);
  };

  const buildStudentReportCard = (studentId: string, term: string): DynamicResultData | null => {
    const matchingResults = results.filter((result) => result.studentId === studentId && result.term === term);
    if (matchingResults.length === 0) return null;

    const student = allStudents.find((entry) => entry.id === studentId);
    const school = student ? allSchools.find((entry) => entry.id === student.schoolId) : null;
    const gradingSystem = school?.gradingSystem || 'nigeria';
    const sortedMatches = [...matchingResults].sort((a, b) => (a.subjectName || '').localeCompare(b.subjectName || ''));
    const subjects = sortedMatches.flatMap((result) => result.subjects && result.subjects.length > 0
        ? result.subjects
        : [{
          subjectId: result.id,
          subjectName: result.subjectName || 'General Studies',
          scores: {
            ca1: result.details?.ca1 || 0,
            ca2: result.details?.ca2 || 0,
            ca3: result.details?.ca3 || 0,
            exam: result.details?.exam || 0,
          },
          total: result.average || 0,
          grade: result.grade || 'F',
          remark: result.remarks || 'No remark',
        }]);

    const totalAverage = subjects.length > 0
      ? subjects.reduce((sum, subject) => sum + subject.total, 0) / subjects.length
      : sortedMatches[0].average;
    const overallGrade = GradingSystem.calculateGrade(totalAverage, 100, gradingSystem);
    // Collect all classmates (same grade, same term, with results)
    const classmateIds = student
      ? Array.from(new Set(results
          .filter((result) => result.term === term)
          .filter((result) => {
            const resultStudent = allStudents.find((entry) => entry.id === result.studentId);
            return resultStudent?.grade === student.grade;
          })
          .map((result) => result.studentId)))
      : [];

    // Compute position by ranking classmates' averages descending
    const classmateAverages = classmateIds.map((id) => {
      const classmateResults = results.filter((r) => r.studentId === id && r.term === term);
      const avg = classmateResults.length > 0
        ? classmateResults.reduce((sum, r) => sum + (r.average || 0), 0) / classmateResults.length
        : 0;
      return { studentId: id, avg };
    });
    classmateAverages.sort((a, b) => b.avg - a.avg);
    const computedPosition = classmateAverages.findIndex((c) => c.studentId === studentId) + 1;

    // Real attendance from fetched summaries
    const attSummary = attendanceSummaries[studentId];
    const attendanceData = attSummary && attSummary.total > 0
      ? { present: attSummary.present, total: attSummary.total }
      : (sortedMatches.find((r) => r.attendance)?.attendance ?? { present: 0, total: 0 });

    return {
      ...sortedMatches[0],
      studentName: student?.name || sortedMatches[0].studentName,
      admissionNo: sortedMatches[0].admissionNo || student?.accessCode || sortedMatches[0].studentId,
      term,
      session: sortedMatches[0].session || '2025/2026',
      subjects,
      average: Number(totalAverage.toFixed(1)),
      grade: overallGrade.grade,
      remarks: sortedMatches.find((result) => result.remarks)?.remarks || sortedMatches[0].remarks,
      principalRemark: sortedMatches.find((result) => result.principalRemark)?.principalRemark || sortedMatches[0].principalRemark,
      attendance: attendanceData,
      classPopulation: classmateIds.length || sortedMatches[0].classPopulation || undefined,
      position: computedPosition > 0 ? computedPosition : sortedMatches[0].position,
      verificationToken: sortedMatches[0].verificationToken || `SS-${new Date().getFullYear()}-${sortedMatches[0].id.slice(-6).toUpperCase()}`,
    };
  };

  const handleViewSelectedStudentResult = () => {
    if (!selectedTermFilter || !selectedClassFilter) return;

    const matchingStudents = allStudents
      .filter((student) => student.grade === selectedClassFilter)
      .filter((student) => results.some((result) => result.studentId === student.id && result.term === selectedTermFilter))
      .filter((student) => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return true;
        return student.name.toLowerCase().includes(term) || (student.accessCode || '').toLowerCase().includes(term);
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const reports = matchingStudents
      .map((student) => buildStudentReportCard(student.id, selectedTermFilter))
      .filter((report): report is DynamicResultData => report !== null);

    if (reports.length === 0) {
      toast.error('No report cards found for the selected term and class.');
      return;
    }

    setSelectedReportCards(reports);
    setShowReportSelector(false);
  };

  const getSchoolForReport = (report: DynamicResultData): School | null => {
    const student = allStudents.find((entry) => entry.id === report.studentId);

    if (student?.schoolId) {
      return allSchools.find((school) => school.id === student.schoolId) || null;
    }
    if (user?.schoolId) {
      return allSchools.find((school) => school.id === user.schoolId) || null;
    }

    return allSchools.find((school) => school.status === 'Active') || null;
  };

  const renderReportCard = (report: DynamicResultData, index: number) => {
    const reportSchool = getSchoolForReport(report);
    const studentRecord = allStudents.find((student) => student.id === report.studentId);
    const classStudentCount = studentRecord ? allStudents.filter((student) => student.grade === studentRecord.grade).length : 0;
    const reportClassPopulation = report.classPopulation || classStudentCount || undefined;
    const reportPosition = report.position;
    const verificationId = report.verificationToken || `SS-${new Date().getFullYear()}-${report.id.slice(-6).toUpperCase()}`;
    const reportThemeColor = reportSchool?.themeColor || REPORT_COLORS.primary;
    const reportGradingSystem = reportSchool?.gradingSystem || 'nigeria';

    return (
      <div key={`${report.id}-${index}`} className={index > 0 ? 'mt-8 print:mt-0 print:pt-6' : ''}>
        <div className="border border-gray-300">
          <div className="px-8 py-6 border-b border-gray-300">
            <div className="flex items-start gap-5">
              <div className="w-20 h-20 border border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                {reportSchool?.logoUrl ? (
                  <img src={reportSchool.logoUrl} alt={reportSchool.name} className="w-full h-full object-contain" />
                ) : (
                  <GraduationCap size={28} style={{ color: reportThemeColor }} />
                )}
              </div>
              <div className="flex-1">
                <h1 className="text-[24px] leading-tight font-bold uppercase tracking-[0.08em]">
                  {reportSchool?.name || 'Smart School Academy'}
                </h1>
                <p className="mt-1 text-sm text-gray-700">
                  {reportSchool?.address || 'School Address'}
                  {reportSchool?.contact ? ` • ${reportSchool.contact}` : ''}
                </p>
                <p className="mt-1 text-sm italic text-gray-500">
                  Motto: {reportSchool?.motto || 'Knowledge & Excellence'}
                </p>
              </div>
            </div>
            <div className="mt-5 h-px" style={{ backgroundColor: reportThemeColor }} />
            <div className="pt-4 text-center">
              <h2 className="text-[18px] font-semibold uppercase tracking-[0.24em]">Report Sheet</h2>
              <p className="mt-2 text-sm uppercase tracking-[0.16em] text-gray-600">
                {report.term || 'Term'} • {report.session || 'Session'}
              </p>
            </div>
          </div>

          <div className="px-8 py-6 border-b border-gray-300">
            <div className="grid grid-cols-1 md:grid-cols-[140px_minmax(0,1fr)] gap-5">
              <div className="border border-gray-300 bg-gray-50 h-[160px] flex items-center justify-center overflow-hidden">
                {report.studentPhoto ? (
                  <img src={report.studentPhoto} alt={report.studentName} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center text-gray-400">
                    <Camera size={28} className="mx-auto mb-2" />
                    <span className="text-xs tracking-[0.2em] uppercase">Photo</span>
                  </div>
                )}
              </div>
              <div className="border border-gray-300 bg-white">
                <div className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em]" style={{ backgroundColor: REPORT_COLORS.accent, color: REPORT_COLORS.dark }}>
                  Student Profile
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 px-4 py-4 text-sm">
                  <div><span className="font-semibold text-gray-500">Name:</span> {report.studentName}</div>
                  <div><span className="font-semibold text-gray-500">Adm No:</span> {report.admissionNo || report.studentId}</div>
                  <div><span className="font-semibold text-gray-500">Class:</span> {studentRecord?.grade || 'N/A'}</div>
                  <div><span className="font-semibold text-gray-500">Gender:</span> {studentRecord?.gender || 'N/A'}</div>
                  <div><span className="font-semibold text-gray-500">Session:</span> {report.session || 'N/A'}</div>
                  <div><span className="font-semibold text-gray-500">Term:</span> {report.term || 'N/A'}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-8 py-6 border-b border-gray-300">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em]">Result Table</h3>
              <span className="text-xs uppercase tracking-[0.16em] text-gray-500">
                Grading System: {reportGradingSystem}
              </span>
            </div>
            <table className="w-full text-sm border border-gray-300">
              <thead style={{ backgroundColor: REPORT_COLORS.paper }}>
                <tr>
                  <th className="border border-gray-300 px-3 py-3 text-left font-semibold">Subject</th>
                  {assessmentColumns.sort((a, b) => a.order - b.order).map((col) => (
                    <th key={col.id} className="border border-gray-300 px-3 py-3 text-center font-semibold">
                      {col.label.replace('1st ', '').replace('2nd ', '').replace('3rd ', '')}
                    </th>
                  ))}
                  <th className="border border-gray-300 px-3 py-3 text-center font-semibold">Total</th>
                  <th className="border border-gray-300 px-3 py-3 text-center font-semibold">Grade</th>
                  <th className="border border-gray-300 px-3 py-3 text-left font-semibold">Remark</th>
                </tr>
              </thead>
              <tbody>
                {(report.subjects || []).map((sub, rowIndex) => (
                  <tr key={sub.subjectId} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                    <td className="border border-gray-300 px-3 py-3 font-medium">{sub.subjectName}</td>
                    {assessmentColumns.sort((a, b) => a.order - b.order).map((col) => (
                      <td key={col.id} className="border border-gray-300 px-3 py-3 text-center">
                        {sub.scores?.[col.id] ?? '-'}
                      </td>
                    ))}
                    <td className="border border-gray-300 px-3 py-3 text-center font-semibold">{sub.total}</td>
                    <td className="border border-gray-300 px-3 py-3 text-center">
                      <span className={`inline-flex min-w-10 items-center justify-center rounded px-2 py-1 text-xs font-semibold border ${getGradeTextClass(sub.grade)}`}>
                        {sub.grade}
                      </span>
                    </td>
                    <td className="border border-gray-300 px-3 py-3">{sub.remark}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-8 py-6 border-b border-gray-300">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] mb-3">Academic Summary</h3>
            <div className="border border-gray-300">
              <div className="grid grid-cols-2 md:grid-cols-4 text-sm">
                <div className="px-4 py-4 border-b md:border-b-0 md:border-r border-gray-300">
                  <p className="text-gray-500 uppercase text-[11px] tracking-[0.16em]">Average Score</p>
                  <p className="mt-2 text-lg font-semibold">{report.average.toFixed(1)}%</p>
                </div>
                <div className="px-4 py-4 border-b md:border-b-0 md:border-r border-gray-300">
                  <p className="text-gray-500 uppercase text-[11px] tracking-[0.16em]">Position</p>
                  <p className="mt-2 text-lg font-semibold">
                    {reportPosition ? `${formatPosition(reportPosition)}${reportClassPopulation ? ` of ${reportClassPopulation}` : ''}` : 'N/A'}
                  </p>
                </div>
                <div className="px-4 py-4 border-r border-gray-300">
                  <p className="text-gray-500 uppercase text-[11px] tracking-[0.16em]">Attendance</p>
                  <p className="mt-2 text-lg font-semibold">
                    {report.attendance?.present || 0} / {report.attendance?.total || 0}
                  </p>
                </div>
                <div className="px-4 py-4">
                  <p className="text-gray-500 uppercase text-[11px] tracking-[0.16em]">Result Status</p>
                  <p className="mt-2 text-lg font-semibold capitalize">{report.status}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="px-8 py-6 border-b border-gray-300">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] mb-4">Comments</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <p className="text-sm font-semibold mb-2">Teacher&apos;s Remark</p>
                <div className="border-t border-gray-300 pt-3 min-h-[84px] text-sm leading-6">
                  {report.remarks || 'No teacher remark available.'}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold mb-2">Principal&apos;s Remark</p>
                <div className="border-t border-gray-300 pt-3 min-h-[84px] text-sm leading-6">
                  {report.principalRemark || 'No principal remark available.'}
                </div>
              </div>
            </div>
          </div>

          <div className="px-8 py-6 border-b border-gray-300">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] mb-4">Authentication</h3>
            <div className="grid grid-cols-1 md:grid-cols-[120px_minmax(0,1fr)] gap-5 items-center">
              <div className="border border-gray-300 p-3 bg-white flex items-center justify-center">
                <QRCodeSVG value={`https://verify.smartschool.ng/${verificationId}`} size={90} />
              </div>
              <div className="space-y-2 text-sm">
                <p><span className="font-semibold text-gray-500">Verification ID:</span> {verificationId}</p>
                <p><span className="font-semibold text-gray-500">Verify Online:</span> verify.smartschool.ng/{verificationId}</p>
                <p><span className="font-semibold text-gray-500">Result Status:</span> VERIFIED</p>
              </div>
            </div>
          </div>

          <div className="px-8 py-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] mb-4">Signatures / Stamp</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              <div>
                <div className="h-16 border-b border-gray-400 flex items-end justify-center pb-2">
                  {reportSchool?.principalSignatureUrl ? (
                    <img src={reportSchool.principalSignatureUrl} alt="Principal signature" className="max-h-12 object-contain" />
                  ) : null}
                </div>
                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-gray-500">Principal Signature</p>
                <p className="mt-1 text-sm font-medium">{reportSchool?.principalName || 'Principal'}</p>
              </div>
              <div className="flex items-center justify-center">
                <div className="w-28 h-28 border border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden">
                  {reportSchool?.schoolStampUrl ? (
                    <img src={reportSchool.schoolStampUrl} alt="School stamp" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-xs uppercase tracking-[0.2em] text-gray-400">Stamp</span>
                  )}
                </div>
              </div>
              <div>
                <div className="h-16 border-b border-gray-400"></div>
                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-gray-500">Date</p>
                <p className="mt-1 text-sm font-medium">{new Date().toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #report-card-modal, #report-card-modal * {
            visibility: visible;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #report-card-modal {
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            z-index: 9999;
            background: white;
            padding: 0;
            margin: 0;
            overflow: visible;
          }
          .no-print {
            display: none !important;
          }
          button {
            display: none !important;
          }
        }
      `}</style>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Academic Results</h1>
          <p className="text-gray-500">Analyze performance and publish termly reports.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <Download size={16} />
            Export CSV
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">
            <FileText size={16} />
            Publish All
          </button>
        </div>
      </div>

      {loading ? (
         <div className="h-64 flex items-center justify-center">
            <Loader2 size={32} className="animate-spin text-primary-600" />
         </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Class Average</p>
                  <h3 className="text-2xl font-bold text-gray-900">{classAverage}%</h3>
                  <p className="text-xs text-green-600 font-medium flex items-center mt-1">
                    <TrendingUp size={12} className="mr-1" /> Updated just now
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-50 text-green-600 rounded-lg">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Pass Rate</p>
                  <h3 className="text-2xl font-bold text-gray-900">{passRate}%</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {passFailData[0].value} passed / {passFailData[1].value} failed
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-50 text-yellow-600 rounded-lg">
                  <Award size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Top Performer</p>
                  <h3 className="text-xl font-bold text-gray-900">{topStudent?.studentName || '-'}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {topStudent ? `${topStudent.average.toFixed(1)}% Average` : 'No data'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-6">Grade Distribution</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gradeDist}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280' }} allowDecimals={false} />
                    <Tooltip 
                      cursor={{ fill: '#F3F4F6' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {gradeDist.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col">
              <h3 className="text-lg font-bold text-gray-900 mb-6">Pass vs Fail Ratio</h3>
              <div className="h-64 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={passFailData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {passFailData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <span className="block text-3xl font-bold text-gray-900">{passRate}%</span>
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Pass Rate</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-center gap-6 mt-4">
                 {passFailData.map((entry) => (
                   <div key={entry.name} className="flex items-center gap-2">
                     <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></span>
                     <span className="text-sm text-gray-600 font-medium">{entry.name}</span>
                   </div>
                 ))}
              </div>
            </div>
          </div>

          {/* Results Table with Dynamic Columns */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
               <div>
                 <h3 className="text-lg font-bold text-gray-900">View Student Results</h3>
                 <p className="text-sm text-gray-500 mt-1">Use the selector popup to open a student report card without cluttering the table.</p>
               </div>
               <div className="flex items-center gap-3">
                  <div className="relative w-64">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <Search size={16} />
                    </div>
                    <input 
                      type="text" 
                      placeholder="Search students..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={openReportSelector}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
                  >
                    <Eye size={16} />
                    View Student Results
                  </button>
               </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div 
                  ref={tableContainerRef} 
                  className="overflow-y-auto overflow-x-auto relative" 
                  style={{ height: tableHeight }}
                  onScroll={handleScroll}
              >
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('studentName')}>
                        <div className="flex items-center gap-1">
                          Student
                          {sortConfig.key === 'studentName' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                        </div>
                      </th>
                      {assessmentColumns.sort((a,b) => a.order - b.order).map(col => (
                        <th key={col.id} className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {col.label}
                        </th>
                      ))}
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => handleSort('average')}>
                        <div className="flex items-center justify-center gap-1">
                          Total
                          {sortConfig.key === 'average' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => handleSort('grade')}>
                        <div className="flex items-center justify-center gap-1">
                          Grade
                          {sortConfig.key === 'grade' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">Remarks</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paddingTop > 0 && (
                      <tr><td colSpan={assessmentColumns.length + 6} style={{ height: paddingTop }}></td></tr>
                    )}
                    
                    {visibleData.length > 0 ? (
                      visibleData.map((result) => (
                        <tr key={result.id} className="hover:bg-gray-50 transition-colors h-[64px]">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              {result.studentPhoto ? (
                                <img src={result.studentPhoto} alt="" className="w-8 h-8 rounded-full object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-white flex items-center justify-center text-xs font-bold">
                                  {result.studentName.charAt(0)}
                                </div>
                              )}
                              <div>
                                <div className="text-sm font-medium text-gray-900">{result.studentName}</div>
                                <div className="text-xs text-gray-500">{result.admissionNo || result.studentId}</div>
                              </div>
                            </div>
                          </td>
                          
                          {assessmentColumns.sort((a,b) => a.order - b.order).map(col => {
                            const score = result.subjects?.[0]?.scores[col.id];
                            return (
                              <td key={col.id} className="px-3 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                                {score !== undefined ? score : '-'}
                              </td>
                            );
                          })}
                          
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="text-sm font-bold text-gray-900">{result.average.toFixed(1)}%</span>
                          </td>
                          
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                              result.grade === 'F' ? 'bg-red-100 text-red-800' :
                              result.grade === 'A' || result.grade === 'A+' ? 'bg-green-100 text-green-800' :
                              result.grade === 'B' ? 'bg-blue-100 text-blue-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {result.grade}
                            </span>
                          </td>
                          
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                               result.status === 'Published' ? 'bg-green-50 text-green-700 border border-green-200' :
                               result.status === 'withheld' ? 'bg-red-50 text-red-700 border border-red-200' :
                               'bg-gray-100 text-gray-700 border border-gray-200'
                            }`}>
                              {result.status}
                            </span>
                          </td>
                          
                          <td className="px-6 py-4 text-sm text-gray-500">
                            <div className="flex items-start gap-2">
                              <p className="italic flex-1 min-w-[200px] truncate max-w-[250px]" title={result.remarks || ''}>
                                 {result.remarks || <span className="text-gray-300 not-italic">No remarks yet.</span>}
                              </p>
                              <button 
                                 onClick={() => handleGenerateRemark(result)}
                                 disabled={loadingRemarkId === result.id}
                                 className="text-purple-600 hover:bg-purple-50 p-1.5 rounded-lg transition-colors flex-shrink-0"
                                 title="Generate AI Remark"
                              >
                                 {loadingRemarkId === result.id ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                              </button>
                            </div>
                          </td>
                          
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button 
                                onClick={() => {
                                  setSelectedTermFilter(result.term || '');
                                  setSelectedClassFilter(allStudents.find((student) => student.id === result.studentId)?.grade || '');
                                  setShowReportSelector(true);
                                }}
                                className="text-primary-600 hover:text-primary-900 inline-flex items-center gap-1"
                            >
                                <Eye size={16} />
                                Select
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={assessmentColumns.length + 6} className="px-6 py-8 text-center text-gray-500">
                          No results found.
                        </td>
                      </tr>
                    )}

                    {paddingBottom > 0 && (
                      <tr><td colSpan={assessmentColumns.length + 6} style={{ height: paddingBottom }}></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="text-xs text-gray-500 text-right px-2">
                Displaying {visibleData.length} of {filteredAndSortedResults.length} records
            </div>
          </div>
        </>
      )}

      {showReportSelector && (
        <div
          className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowReportSelector(false)}
        >
          <div
            className="w-full max-w-xl bg-white rounded-2xl border border-gray-200 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-gray-200 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">View Student Results</h3>
                <p className="text-sm text-gray-500 mt-1">Select a term, class, and student to reveal the report card.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowReportSelector(false)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Term Selector</label>
                <select
                  value={selectedTermFilter}
                  onChange={(e) => {
                    setSelectedTermFilter(e.target.value);
                    setSelectedClassFilter('');
                  }}
                  className="block w-full border border-gray-300 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select term</option>
                  {availableTerms.map((term) => (
                    <option key={term} value={term}>{term}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Class Selector</label>
                <select
                  value={selectedClassFilter}
                  onChange={(e) => setSelectedClassFilter(e.target.value)}
                  className="block w-full border border-gray-300 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  disabled={!selectedTermFilter}
                >
                  <option value="">Select class</option>
                  {availableClasses.map((grade) => (
                    <option key={grade} value={grade}>{grade}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3 bg-gray-50 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setShowReportSelector(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleViewSelectedStudentResult}
                disabled={!selectedTermFilter || !selectedClassFilter}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Eye size={16} />
                View Results
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Card Modal */}
      {selectedReportCards.length > 0 && (
        <div
          id="report-card-modal"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto print:bg-white print:p-0"
          onClick={() => setSelectedReportCards([])}
        >
          <div
            className="bg-white w-full max-w-[980px] relative shadow-2xl print:shadow-none print:w-full print:min-h-0"
            onClick={(e) => e.stopPropagation()}
          >
            <style>{`
              @media print {
                body * { visibility: hidden; }
                #report-card-modal, #report-card-modal * {
                  visibility: visible;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                #report-card-modal {
                  position: absolute;
                  inset: 0;
                  width: 100%;
                  height: auto;
                  margin: 0;
                  padding: 0;
                  background: white;
                }
                .no-print { display: none !important; }
              }
            `}</style>

            <div className="absolute top-4 right-4 flex gap-2 no-print z-20">
              <button
                onClick={handlePrint}
                className="px-4 py-2 text-sm rounded border border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
              >
                Print
              </button>
              <button
                onClick={() => setSelectedReportCards([])}
                className="px-3 py-2 text-sm rounded border border-gray-300 bg-gray-50 hover:bg-gray-100"
              >
                Close
              </button>
            </div>

            <div className="min-h-full p-8 md:p-10" style={{ backgroundColor: REPORT_COLORS.background, color: REPORT_COLORS.text }}>
              <div className="space-y-8">
                {selectedReportCards.map((report, index) => renderReportCard(report, index))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


