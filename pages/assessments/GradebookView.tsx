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
import type { AssessmentsModel } from './useAssessmentsModel';

export function GradebookView({ model }: { model: AssessmentsModel }) {
 const { mode, setOpenAccordion, openAccordion, selectedTerm, modifiedRows, setConfirmDialog, setSelectedTerm, selectedClass, schoolClasses, accessibleClasses, user, isFormMaster, setSelectedClass, formMasterGrade, selectedSubject, subjects, visibleSubjects, setSelectedSubject, filteredAssessments, handleAddCA, exportToCSV, handleSave, saving, handlePublish, publishing, caColumns, config, maxTotal, loading, calculateTotal, calculateGrade, studentMap, handleScoreChange } = model;
 return (
        <div className="space-y-4">
          {/* ── Context Accordion: Term → Class → Subject ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

            {/* Step 1 — Term */}
            <div className="border-b border-gray-100">
              <button
                onClick={() => setOpenAccordion(openAccordion === 'term' ? 'term' : 'term')}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    selectedTerm ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>1</div>
                  <div className="text-left">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Step 1 — Term</p>
                    <p className="text-sm font-bold text-gray-800">{selectedTerm || 'Select a term'}</p>
                  </div>
                </div>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${openAccordion === 'term' ? 'rotate-180' : ''}`} />
              </button>
              {openAccordion === 'term' && (
                <div className="px-5 pb-4 flex flex-wrap gap-2">
                  {['Term 1', 'Term 2', 'Term 3'].map(t => (
                    <button
                      key={t}
                      onClick={() => {
                        if (modifiedRows.size > 0) {
                          setConfirmDialog({ message: 'You have unsaved changes. Switching term will discard them.', onConfirm: () => { setSelectedTerm(t); setOpenAccordion('class'); } });
                        } else {
                          setSelectedTerm(t);
                          setOpenAccordion('class');
                        }
                      }}
                      className={`px-5 py-2.5 rounded-lg text-sm font-semibold border transition-all ${
                        selectedTerm === t
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-primary-400'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Step 2 — Class */}
            <div className="border-b border-gray-100">
              <button
                onClick={() => setOpenAccordion('class')}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    selectedClass ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>2</div>
                  <div className="text-left">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Step 2 — Class</p>
                    <p className="text-sm font-bold text-gray-800">
                      {selectedClass ? schoolClasses.find(c => c.id === selectedClass)?.name : 'Select a class'}
                    </p>
                  </div>
                </div>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${openAccordion === 'class' ? 'rotate-180' : ''}`} />
              </button>
              {openAccordion === 'class' && (
                <div className="px-5 pb-4">
                  {accessibleClasses.length === 0 ? (
                    <p className="text-sm text-gray-400">
                      {user?.role === UserRole.TEACHER
                        ? 'No classes assigned yet. Ask an admin to assign you to a class.'
                        : 'No classes created yet. Go to Classes to add some.'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {user?.role === UserRole.TEACHER && isFormMaster && (
                        <p className="text-xs text-gray-400 mb-1">
                          Your form class is pre-selected. You may also switch to other classes you teach.
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {/* "All Classes" only for admins */}
                        {user?.role !== UserRole.TEACHER && (
                          <button
                            onClick={() => { setSelectedClass(''); setOpenAccordion('subject'); }}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                              selectedClass === ''
                                ? 'bg-primary-600 text-white border-primary-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-primary-400'
                            }`}
                          >
                            All Classes
                          </button>
                        )}
                        {accessibleClasses.map(cls => {
                          const isFormClass = cls.name === formMasterGrade;
                          return (
                            <button
                              key={cls.id}
                              onClick={() => { setSelectedClass(cls.id); setOpenAccordion('subject'); }}
                              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all flex items-center gap-1.5 ${
                                selectedClass === cls.id
                                  ? 'bg-primary-600 text-white border-primary-600'
                                  : 'bg-white text-gray-700 border-gray-300 hover:border-primary-400'
                              }`}
                            >
                              {cls.name}
                              {isFormClass && (
                                <span className={`text-[10px] font-medium ${selectedClass === cls.id ? 'text-primary-200' : 'text-amber-600'}`}>
                                  · Form
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 3 — Subject */}
            <div>
              <button
                onClick={() => setOpenAccordion('subject')}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    selectedSubject ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>3</div>
                  <div className="text-left">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Step 3 — Subject</p>
                    <p className="text-sm font-bold text-gray-800">
                      {selectedSubject ? subjects.find(s => s.id === selectedSubject)?.name : 'Select a subject'}
                    </p>
                  </div>
                </div>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${openAccordion === 'subject' ? 'rotate-180' : ''}`} />
              </button>
              {openAccordion === 'subject' && (
                <div className="px-5 pb-4">
                  {visibleSubjects.length === 0 ? (
                    <p className="text-sm text-gray-400">
                      {selectedClass
                        ? 'No subjects available for this class. Select your form class to see all subjects.'
                        : 'No subjects enrolled. Go to Subjects to enroll some first.'}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {visibleSubjects.map(sub => (
                        <button
                          key={sub.id}
                          onClick={() => {
                            const change = () => { setSelectedSubject(sub.id); setOpenAccordion('subject'); };
                            if (modifiedRows.size > 0) {
                              setConfirmDialog({ message: 'You have unsaved changes. Switching subject will discard them.', onConfirm: change });
                            } else {
                              change();
                            }
                          }}
                          className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                            selectedSubject === sub.id
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-primary-400'
                          }`}
                        >
                          {sub.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Context summary bar + actions */}
          {selectedSubject && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-primary-50 border border-primary-200 rounded-xl px-5 py-3">
              <div className="flex items-center gap-2 text-sm text-primary-800 font-medium flex-wrap">
                <CalendarDays size={15} />
                <span>{selectedTerm}</span>
                <ChevronRight size={14} className="text-primary-400" />
                <Layers size={15} />
                <span>{selectedClass ? schoolClasses.find(c => c.id === selectedClass)?.name : 'All Classes'}</span>
                <ChevronRight size={14} className="text-primary-400" />
                <BookOpen size={15} />
                <span>{visibleSubjects.find(s => s.id === selectedSubject)?.name ?? subjects.find(s => s.id === selectedSubject)?.name}</span>
                <span className="ml-2 text-xs text-primary-600 bg-primary-100 px-2 py-0.5 rounded-full">
                  {filteredAssessments.length} student{filteredAssessments.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddCA}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-primary-300 text-primary-700 rounded-lg text-xs font-semibold hover:bg-primary-50"
                >
                  <Plus size={13} /> Add CA
                </button>
                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-primary-300 text-primary-700 rounded-lg text-xs font-semibold hover:bg-primary-50"
                >
                  <FileSpreadsheet size={13} /> Export
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || modifiedRows.size === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-primary-300 text-primary-700 rounded-lg text-xs font-semibold hover:bg-primary-50 disabled:opacity-40"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  {modifiedRows.size > 0 ? `Save (${modifiedRows.size})` : 'Saved'}
                </button>
                {/* Publish is admin-only — teachers can record scores but only admins finalise */}
                {(user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN) && (
                  <button
                    onClick={handlePublish}
                    disabled={publishing}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-semibold hover:bg-primary-700 disabled:opacity-50"
                  >
                    {publishing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                    Publish Results
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Gradebook table */}
          {selectedSubject ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-48">Student</th>
                      {caColumns.map(col => (
                        <th key={col.id} className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          <div className="flex flex-col items-center gap-0.5">
                            <span>{col.label}</span>
                            <span className="text-gray-400 font-normal normal-case">/{col.maxScore}</span>
                          </div>
                        </th>
                      ))}
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        <div className="flex flex-col items-center gap-0.5">
                          <span>Exam</span>
                          <span className="text-gray-400 font-normal normal-case">/{config.examMax}</span>
                        </div>
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider bg-primary-50 text-primary-700">
                        Total/{maxTotal}
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-100">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {loading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i}>
                          <td colSpan={caColumns.length + 4} className="px-5 py-3">
                            <div className="h-4 bg-gray-100 rounded animate-pulse" />
                          </td>
                        </tr>
                      ))
                    ) : filteredAssessments.length > 0 ? (
                      filteredAssessments.map((assessment) => {
                        const total = calculateTotal(assessment);
                        const grade = calculateGrade(total);
                        const isPassing = total >= config.passMark;
                        const isModified = modifiedRows.has(assessment.id);
                        const pct = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;

                        return (
                          <tr key={assessment.id} className={`transition-colors ${isModified ? 'bg-amber-50' : 'hover:bg-gray-50'}`}>
                            <td className="px-5 py-2.5 whitespace-nowrap relative">
                              {isModified && <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400 rounded-r" />}
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold text-gray-900">{assessment.studentName}</span>
                                <span className="text-xs text-gray-400">{studentMap[assessment.studentId]?.grade || ''}</span>
                              </div>
                            </td>
                            {caColumns.map(col => (
                              <td key={col.id} className="px-2 py-2">
                                <input
                                  id={`score-${assessment.id}-${col.id}`} name={`score-${assessment.id}-${col.id}`}
                                  type="number" min="0" max={col.maxScore}
                                  value={(assessment as any)[col.id] ?? ''}
                                  onChange={(e) => handleScoreChange(assessment.id, col.id, e.target.value)}
                                  className="w-16 text-center py-1.5 px-1 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400 outline-none transition-all"
                                />
                              </td>
                            ))}
                            <td className="px-2 py-2">
                              <input
                                id={`score-${assessment.id}-exam`} name={`score-${assessment.id}-exam`}
                                type="number" min="0" max={config.examMax}
                                value={assessment.exam || ''}
                                onChange={(e) => handleScoreChange(assessment.id, 'exam', e.target.value)}
                                className="w-16 text-center py-1.5 px-1 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary-400 focus:border-primary-400 outline-none transition-all"
                              />
                            </td>
                            {/* Live total with mini progress bar */}
                            <td className="px-3 py-2 bg-primary-50">
                              <div className="flex flex-col items-center gap-1">
                                <span className={`text-sm font-bold ${isPassing ? 'text-primary-700' : 'text-red-600'}`}>{total}</span>
                                <div className="w-14 bg-gray-200 rounded-full h-1.5">
                                  <div
                                    className={`h-1.5 rounded-full transition-all duration-300 ${isPassing ? 'bg-primary-500' : 'bg-red-400'}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-gray-400">{pct}%</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center bg-gray-50">
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                                grade === 'F' ? 'bg-red-100 text-red-700' :
                                grade.startsWith('A') ? 'bg-green-100 text-green-700' :
                                grade === 'B' ? 'bg-blue-100 text-blue-700' :
                                grade === 'C' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-200 text-gray-700'
                              }`}>{grade}</span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={caColumns.length + 4} className="px-5 py-12 text-center text-gray-400 text-sm">
                          No students found for this class and subject combination.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 bg-white border border-dashed border-gray-300 rounded-xl text-gray-400">
              <FileSpreadsheet size={40} className="mb-3 text-gray-300" />
              <p className="font-medium text-gray-600">Complete the steps above to load the gradebook</p>
              <p className="text-sm mt-1">Select a term, class, and subject to begin entering scores.</p>
            </div>
          )}
        </div>
      );
}
