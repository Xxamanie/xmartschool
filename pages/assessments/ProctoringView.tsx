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
import type { AssessmentsModel, ExamStat } from './useAssessmentsModel';

export function ProctoringView({ model }: { model: AssessmentsModel }) {
 const { mode, examSubMode, currentExam, handleEndExam, handleStartExam, examStats, students, isImpersonating, handleMouseEnter, handleMouseMove, handleMouseLeave, getStatusColor, handleResetExam } = model;
 return (
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
      );
}
