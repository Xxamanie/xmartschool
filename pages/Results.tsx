import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  Download, 
  Search, 
  FileText, 
  TrendingUp, 
  Award, 
  CheckCircle2, 
  Wand2, 
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Printer,
  X,
  GraduationCap
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { api } from '../services/api';
import { ResultData, School, Student, UserRole, Subject } from '../types';
import { useAuth } from '../context/AuthContext';

const GRADE_DISTRIBUTION_COLORS: Record<string, string> = {
  'A+': '#22c55e',
  'A': '#4ade80',
  'B': '#60a5fa',
  'C': '#fbbf24',
  'D': '#f97316',
  'F': '#ef4444',
};

export const Results: React.FC = () => {
  const { user } = useAuth();
  const [results, setResults] = useState<ResultData[]>([]);
  const [allSchools, setAllSchools] = useState<School[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRemarkId, setLoadingRemarkId] = useState<string | null>(null);
  const [bulkGeneratingRemarks, setBulkGeneratingRemarks] = useState(false);
  const [publishingAll, setPublishingAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  const aiEnabled = !!geminiApiKey;
  const logAIActivity = async (payload: {
    action: string;
    status: 'success' | 'failed' | 'fallback';
    metadata?: Record<string, unknown>;
  }) => {
    try {
      await api.logAIActivity({
        action: payload.action,
        scope: 'results',
        status: payload.status,
        actorId: user?.id,
        actorRole: user?.role,
        schoolId: user?.schoolId,
        metadata: payload.metadata,
      });
    } catch (error) {
      console.error('Failed to log AI activity', error);
    }
  };
  
  // Report Card State
  const [selectedResult, setSelectedResult] = useState<ResultData | null>(null);
  
  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'studentName',
    direction: 'asc'
  });

  // Virtual Scroll State
  const [scrollTop, setScrollTop] = useState(0);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const rowHeight = 64; // Estimated height for table row
  const tableHeight = 600; // Fixed height for virtual container

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resResults, resSchools, resStudents, resSubjects] = await Promise.all([
            api.getResults(),
            api.getSchools(),
            api.getStudents(), // Fetch students to link to schools
            api.getSubjects()
        ]);

        if (resResults.ok) setResults(resResults.data);
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

  const buildFallbackRemark = (result: ResultData): string => {
    if (result.average >= 85) return 'Outstanding consistency and mastery. Keep stretching for excellence.';
    if (result.average >= 70) return 'Strong performance with good discipline. Push for deeper mastery.';
    if (result.average >= 50) return 'Fair progress. Focus revision and consistency will lift results.';
    return 'Needs urgent support and structured practice. Improvement is achievable with daily effort.';
  };

  const generateRemarkText = async (result: ResultData): Promise<string> => {
    if (!aiEnabled) return buildFallbackRemark(result);

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const prompt = `Generate a concise (max 15 words), professional, and encouraging report card remark for a high school student named ${result.studentName} who scored an average of ${result.average}%. The grade is ${result.grade}.`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || buildFallbackRemark(result);
  };

  const handleGenerateRemark = async (result: ResultData) => {
    setLoadingRemarkId(result.id);
    try {
      const remark = await generateRemarkText(result);
      setResults(prev => prev.map(r => r.id === result.id ? { ...r, remarks: remark } : r));
      await logAIActivity({
        action: 'generate_single_remark',
        status: aiEnabled ? 'success' : 'fallback',
        metadata: {
          resultId: result.id,
          studentId: result.studentId,
          subjectName: result.subjectName || '',
          grade: result.grade,
        },
      });
    } catch (error) {
      console.error("Failed to generate remark", error);
      await logAIActivity({
        action: 'generate_single_remark',
        status: 'failed',
        metadata: {
          resultId: result.id,
          studentId: result.studentId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      alert("Failed to generate remark. Please try again.");
    } finally {
      setLoadingRemarkId(null);
    }
  };

  const handleGenerateMissingRemarks = async () => {
    const targets = filteredAndSortedResults.filter(r => !r.remarks || !r.remarks.trim());
    if (targets.length === 0) {
      alert('All visible results already have remarks.');
      return;
    }
    setBulkGeneratingRemarks(true);
    try {
      const updates: Record<string, string> = {};
      for (const item of targets.slice(0, 100)) {
        updates[item.id] = await generateRemarkText(item);
      }
      setResults(prev => prev.map(r => updates[r.id] ? { ...r, remarks: updates[r.id] } : r));
      await logAIActivity({
        action: 'generate_bulk_remarks',
        status: aiEnabled ? 'success' : 'fallback',
        metadata: {
          generatedCount: Object.keys(updates).length,
          visibleCount: filteredAndSortedResults.length,
        },
      });
    } catch (error) {
      console.error('Bulk AI remark generation failed', error);
      await logAIActivity({
        action: 'generate_bulk_remarks',
        status: 'failed',
        metadata: {
          visibleCount: filteredAndSortedResults.length,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      alert('Bulk remark generation failed. Please retry.');
    } finally {
      setBulkGeneratingRemarks(false);
    }
  };

  const handlePublishAll = async () => {
    if (!window.confirm('Publish all currently visible results?')) return;
    setPublishingAll(true);
    try {
      const res = await api.publishResults(filteredAndSortedResults);
      if (!res.ok) throw new Error(res.message || 'Publish failed');
      setResults(prev => prev.map(r =>
        filteredAndSortedResults.some(v => v.id === r.id) ? { ...r, status: 'Published' } : r
      ));
      await logAIActivity({
        action: 'publish_visible_results',
        status: 'success',
        metadata: {
          publishedCount: filteredAndSortedResults.length,
        },
      });
      alert('Results published successfully.');
    } catch (error) {
      console.error('Publish all failed', error);
      await logAIActivity({
        action: 'publish_visible_results',
        status: 'failed',
        metadata: {
          attemptedCount: filteredAndSortedResults.length,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      alert('Failed to publish results.');
    } finally {
      setPublishingAll(false);
    }
  };

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const filteredAndSortedResults = useMemo(() => {
    let filtered = results;

    // Teacher Access Control: Only show results for subjects they teach
    if (user?.role === UserRole.TEACHER) {
        const mySubjectNames = new Set(allSubjects.filter(s => s.teacherId === user.id).map(s => s.name));
        filtered = filtered.filter(r => mySubjectNames.has(r.subjectName || ''));
    }

    filtered = filtered.filter(r => 
      r.studentName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      r.studentId.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return filtered.sort((a, b) => {
      let aVal: any = a[sortConfig.key as keyof ResultData];
      let bVal: any = b[sortConfig.key as keyof ResultData];

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [results, searchTerm, sortConfig, user, allSubjects]);

  // Stats Calculation
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
  const visibleNodeCount = Math.ceil(tableHeight / rowHeight) + 4; // Add buffer
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

  // Determine school context for the selected result
  const getSchoolForReport = (): School | null => {
    if (!selectedResult) return null;
    
    // First try to find the student
    const student = allStudents.find(s => s.id === selectedResult.studentId);
    
    if (student && student.schoolId) {
      // If we found the student, use their school ID
      return allSchools.find(s => s.id === student.schoolId) || null;
    } else if (user?.schoolId) {
       // Fallback to user's school ID if student not found (e.g., old data)
       return allSchools.find(s => s.id === user.schoolId) || null;
    }
    
    // Final fallback - return first active school or null
    return allSchools.find(s => s.status === 'Active') || null;
  };

  const reportSchool = getSchoolForReport();
  const studentRecord = selectedResult ? allStudents.find(s => s.id === selectedResult.studentId) : null;
  const classStudentCount = studentRecord ? allStudents.filter(s => s.grade === studentRecord.grade).length : 0;

  return (
    <div className="space-y-8">
      {/* Global Print Styles */}
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
        }
      `}</style>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Academic Results</h1>
          <p className="text-gray-500">Analyze performance and publish termly reports.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleGenerateMissingRemarks}
            disabled={bulkGeneratingRemarks}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-70"
            title="Generate remarks for rows with missing remarks"
          >
            {bulkGeneratingRemarks ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
            {bulkGeneratingRemarks ? 'Generating...' : 'Auto-Generate Remarks'}
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <Download size={16} />
            Export CSV
          </button>
          <button
            onClick={handlePublishAll}
            disabled={publishingAll}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-70"
          >
            {publishingAll ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
            {publishingAll ? 'Publishing...' : 'Publish Visible'}
          </button>
        </div>
      </div>

      <div className={`rounded-xl border p-4 text-sm flex items-center justify-between ${aiEnabled ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
        <div className="flex items-center gap-2">
          <Wand2 size={16} />
          <span className="font-medium">{aiEnabled ? 'AI automation online' : 'AI fallback mode'}</span>
          <span className="opacity-80">
            {aiEnabled ? 'Gemini-powered remarks and automation are active.' : 'Set VITE_GEMINI_API_KEY to enable advanced AI generation.'}
          </span>
        </div>
        {!aiEnabled && (
          <span className="text-xs font-semibold px-2 py-1 bg-white/70 rounded border border-amber-300">Template Remarks Enabled</span>
        )}
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

          {/* Results Table with Virtual Scroll & Sorting */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
               <h3 className="text-lg font-bold text-gray-900">Student Report Cards</h3>
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
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                        onClick={() => handleSort('studentName')}
                      >
                         <div className="flex items-center gap-1">
                             Student
                             {sortConfig.key === 'studentName' && (
                                 sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                             )}
                             {sortConfig.key !== 'studentName' && <ArrowUpDown size={14} className="opacity-0 group-hover:opacity-50" />}
                         </div>
                      </th>
                      {/* Detail Columns for Assessment Breakdown */}
                      <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">1st CA</th>
                      <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">2nd CA</th>
                      <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">3rd CA</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Exam</th>
                      
                      <th 
                        className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                        onClick={() => handleSort('average')}
                      >
                         <div className="flex items-center justify-center gap-1">
                             Total
                             {sortConfig.key === 'average' && (
                                 sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                             )}
                             {sortConfig.key !== 'average' && <ArrowUpDown size={14} className="opacity-0 group-hover:opacity-50" />}
                         </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                        onClick={() => handleSort('grade')}
                      >
                         <div className="flex items-center justify-center gap-1">
                             Grade
                             {sortConfig.key === 'grade' && (
                                 sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                             )}
                             {sortConfig.key !== 'grade' && <ArrowUpDown size={14} className="opacity-0 group-hover:opacity-50" />}
                         </div>
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">Remarks</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {/* Top Spacer for Virtualization */}
                    {paddingTop > 0 && (
                      <tr>
                        <td colSpan={10} style={{ height: paddingTop }}></td>
                      </tr>
                    )}
                    
                    {visibleData.length > 0 ? (
                      visibleData.map((result) => (
                        <tr key={result.id} className="hover:bg-gray-50 transition-colors h-[64px]">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-8 w-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold mr-3">
                                {result.studentName.charAt(0)}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">{result.studentName}</div>
                                <div className="text-xs text-gray-500">{result.studentId}</div>
                              </div>
                            </div>
                          </td>
                          
                          {/* Assessment Breakdown */}
                          <td className="px-2 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                             {result.details?.ca1 ?? '-'}
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                             {result.details?.ca2 ?? '-'}
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                             {result.details?.ca3 ?? '-'}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                             {result.details?.exam ?? '-'}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="text-sm font-bold text-gray-900">{result.average.toFixed(1)}%</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                              result.grade === 'F' ? 'bg-red-100 text-red-800' :
                              result.grade.startsWith('A') ? 'bg-green-100 text-green-800' :
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
                                onClick={() => setSelectedResult(result)}
                                className="text-primary-600 hover:text-primary-900 hover:underline flex items-center justify-end gap-1"
                            >
                                View
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                       <tr>
                          <td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                             No results found.
                          </td>
                       </tr>
                    )}

                    {/* Bottom Spacer for Virtualization */}
                    {paddingBottom > 0 && (
                      <tr>
                        <td colSpan={10} style={{ height: paddingBottom }}></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="text-xs text-gray-500 text-right px-2">
                Displaying {visibleData.length} of {filteredAndSortedResults.length} records (Virtual Scroll Active)
            </div>
          </div>
        </>
      )}

      {/* Report Card Modal */}
      {selectedResult && (
        <div 
            id="report-card-modal" 
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setSelectedResult(null)}
        >
           <div 
              className="bg-white w-full max-w-4xl min-h-[800px] relative shadow-2xl flex flex-col" 
              onClick={(e) => e.stopPropagation()}
           >
               {/* Watermark */}
               <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
                   <GraduationCap size={400} />
               </div>

               {/* Print Controls (Hidden in Print) */}
               <div className="absolute top-4 right-4 flex gap-2 no-print">
                  <button 
                     onClick={handlePrint}
                     className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors shadow-lg"
                  >
                     <Printer size={18} />
                     Print Report
                  </button>
                  <button 
                     onClick={() => setSelectedResult(null)}
                     className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                     <X size={20} />
                  </button>
               </div>

               {/* Report Card Content */}
               <div className="p-12 h-full flex flex-col flex-1">
                   
                   {/* Header / Letterhead */}
                   <div className="text-center border-b-4 border-double border-gray-900 pb-6 mb-8">
                       <div className="flex justify-center mb-4">
                           {reportSchool?.logoUrl ? (
                              <img src={reportSchool.logoUrl} alt="School Logo" className="w-24 h-24 object-contain" />
                           ) : (
                              <div className="w-24 h-24 bg-gray-900 text-white rounded-full flex items-center justify-center">
                                <GraduationCap size={48} />
                              </div>
                           )}
                       </div>
                       <h1 className="text-4xl font-bold text-gray-900 serif uppercase tracking-wide mb-2">
                           {reportSchool ? reportSchool.name : 'Smart School Academy'}
                       </h1>
                       <p className="text-gray-600 font-medium text-sm uppercase tracking-widest mb-1">
                           {reportSchool?.motto || reportSchool?.region || 'Excellence in Education'}
                       </p>
                       <p className="text-gray-500 text-xs">
                           {reportSchool?.address || 'Official Semester Result Sheet'}
                       </p>
                       {reportSchool?.contact && (
                         <p className="text-gray-500 text-xs">Contact: {reportSchool.contact}</p>
                       )}
                   </div>

                   {/* Student Info Grid */}
                   <div className="bg-white border-2 border-gray-900 p-6 mb-8">
                           <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                               <div>
                                   <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Student Name</p>
                                   <p className="text-lg font-bold text-gray-900 border-b border-gray-300 pb-1">{selectedResult.studentName}</p>
                               </div>
                               <div>
                                   <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Student ID</p>
                                   <p className="text-lg font-mono text-gray-900 border-b border-gray-300 pb-1">{selectedResult.studentId}</p>
                               </div>
                               <div>
                                   <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Class</p>
                                   <p className="text-lg text-gray-900 border-b border-gray-300 pb-1">{studentRecord?.grade || 'N/A'}</p>
                               </div>
                               <div>
                                   <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Sex</p>
                                   <p className="text-lg text-gray-900 border-b border-gray-300 pb-1 capitalize">{studentRecord?.gender || 'N/A'}</p>
                               </div>
                               <div>
                                   <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Academic Session</p>
                                   <p className="text-lg text-gray-900 border-b border-gray-300 pb-1">2023 / 2024</p>
                               </div>
                               <div>
                                   <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Term</p>
                                   <p className="text-lg text-gray-900 border-b border-gray-300 pb-1">{selectedResult.term || 'Term 1'}</p>
                               </div>
                           </div>
                   </div>

                   {/* Scores Table */}
                   <div className="mb-8 flex-1">
                       <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2 border-l-4 border-gray-900 pl-3">
                           Performance Details
                       </h3>
                       <table className="w-full border-collapse border border-gray-900 text-sm">
                           <thead>
                               <tr className="bg-gray-900 text-white">
                                   <th className="border border-gray-900 px-4 py-3 text-left w-1/3">Subject</th>
                                   <th className="border border-gray-900 px-2 py-3 text-center w-16">1st CA</th>
                                   <th className="border border-gray-900 px-2 py-3 text-center w-16">2nd CA</th>
                                   <th className="border border-gray-900 px-2 py-3 text-center w-16">3rd CA</th>
                                   <th className="border border-gray-900 px-3 py-3 text-center w-20">EXAM</th>
                                   <th className="border border-gray-900 px-3 py-3 text-center font-bold w-20 bg-gray-800">TOTAL</th>
                                   <th className="border border-gray-900 px-3 py-3 text-center font-bold w-20">GRADE</th>
                               </tr>
                           </thead>
                           <tbody>
                               <tr>
                                   <td className="border border-gray-900 px-4 py-4 font-bold text-gray-900">
                                       {selectedResult.subjectName || 'Mathematics'}
                                   </td>
                                   <td className="border border-gray-900 px-2 py-4 text-center text-gray-700">
                                       {selectedResult.details?.ca1 ?? '-'}
                                   </td>
                                   <td className="border border-gray-900 px-2 py-4 text-center text-gray-700">
                                       {selectedResult.details?.ca2 ?? '-'}
                                   </td>
                                   <td className="border border-gray-900 px-2 py-4 text-center text-gray-700">
                                       {selectedResult.details?.ca3 ?? '-'}
                                   </td>
                                   <td className="border border-gray-900 px-3 py-4 text-center text-gray-700 font-medium">
                                       {selectedResult.details?.exam || '-'}
                                   </td>
                                   <td className="border border-gray-900 px-3 py-4 text-center font-bold text-gray-900 bg-gray-50">
                                       {selectedResult.average}
                                   </td>
                                   <td className="border border-gray-900 px-3 py-4 text-center font-bold">
                                       <span className={`inline-block w-8 h-8 leading-8 rounded-full text-white ${
                                            selectedResult.grade === 'A+' || selectedResult.grade === 'A' ? 'bg-green-600' :
                                            selectedResult.grade === 'B' ? 'bg-blue-600' :
                                            selectedResult.grade === 'F' ? 'bg-red-600' : 'bg-yellow-500'
                                       }`} style={{printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact'}}>
                                           {selectedResult.grade}
                                       </span>
                                   </td>
                               </tr>
                               {/* Empty rows filler for aesthetics */}
                               {[1,2,3].map(i => (
                                   <tr key={i} className="h-12">
                                       <td className="border border-gray-900 px-4 py-2 bg-gray-50/30"></td>
                                       <td className="border border-gray-900 px-2 py-2 bg-gray-50/30"></td>
                                       <td className="border border-gray-900 px-2 py-2 bg-gray-50/30"></td>
                                       <td className="border border-gray-900 px-2 py-2 bg-gray-50/30"></td>
                                       <td className="border border-gray-900 px-3 py-2 bg-gray-50/30"></td>
                                       <td className="border border-gray-900 px-3 py-2 bg-gray-50/30"></td>
                                       <td className="border border-gray-900 px-3 py-2 bg-gray-50/30"></td>
                                   </tr>
                               ))}
                           </tbody>
                       </table>
                   </div>

                   {/* Remarks & Footer */}
                   <div className="grid grid-cols-2 gap-12 mt-auto">
                       <div className="space-y-4">
                           <div>
                             <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">Teacher's Remarks</h3>
                             <div className="border-2 border-gray-900 p-4 h-20 italic text-gray-700 bg-gray-50">
                               {selectedResult.remarks || 'Pending teacher remarks.'}
                             </div>
                           </div>
                           <div>
                             <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">Class Statistics</h3>
                             <div className="border-2 border-gray-900 p-4 bg-gray-50 text-sm text-gray-800 flex justify-between">
                               <span>Total Students: {classStudentCount || 'N/A'}</span>
                               <span>Position: -</span>
                             </div>
                           </div>
                       </div>
                       <div className="flex flex-col justify-end">
                           <div className="flex justify-between items-end mb-2">
                               <div className="text-center w-32">
                                   <div className="border-b-2 border-gray-900 mb-1 pb-2 font-serif text-lg">
                                       {reportSchool?.adminName ? reportSchool.adminName.split(' ').pop() : 'Principal'}
                                   </div>
                                   <p className="text-[10px] uppercase font-bold tracking-wider text-gray-900">Principal Signature</p>
                               </div>
                               <div className="text-center w-32">
                                   <div className="border-b-2 border-gray-900 mb-1 pb-2">
                                       {new Date().toLocaleDateString()}
                                   </div>
                                   <p className="text-[10px] uppercase font-bold tracking-wider text-gray-900">Date</p>
                               </div>
                           </div>
                       </div>
                   </div>
                   
                   <div className="mt-8 text-center text-[10px] text-gray-400 border-t border-gray-100 pt-4">
                       Generated by SmartSchool Management System • This document is valid without a physical seal.
                   </div>
               </div>
           </div>
        </div>
      )}
    </div>
  );
};
