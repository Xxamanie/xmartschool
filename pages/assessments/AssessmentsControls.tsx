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
export function AssessmentsControls({ model }: { model: AssessmentsModel }) {
 const { toasts, dismiss, confirmDialog, setConfirmDialog, showCANameModal, newCAName, setNewCAName, confirmAddCA, setShowCANameModal, isFormMaster, formMasterGrade, setMode, mode, user, setShowSettings, setExamSubMode, examSubMode, selectedExamId, handleExamSelectionChange, allExams, handleSyncScores, showSettings, caColumns, setCaColumns, deleteCAColumn, handleAddCA, config, setConfig, maxTotal, gradingScale, setGradingScale, setOpenAccordion, openAccordion, selectedTerm, modifiedRows, setSelectedTerm, selectedClass, schoolClasses, accessibleClasses, setSelectedClass, selectedSubject, subjects, visibleSubjects, setSelectedSubject, filteredAssessments, exportToCSV, handleSave, saving, handlePublish, publishing, loading, calculateTotal, calculateGrade, studentMap, handleScoreChange, currentExam, handleEndExam, handleStartExam, examStats, students, isImpersonating, handleMouseEnter, handleMouseMove, handleMouseLeave, getStatusColor, handleResetExam, builderConfig, setBuilderConfig, handleGenerateQuestions, isGenerating, setShowImportModal, handleAddManualQuestion, builderQuestions, handleClearExam, handleSaveExam, handleSaveAndActivate, saveMessage, deleteQuestion, updateQuestion } = model;
 return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      {/* Confirm Dialog Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl">
            <div className="p-6">
              <p className="text-sm text-gray-700">{confirmDialog.message}</p>
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end gap-2">
              <button onClick={() => setConfirmDialog(null)} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
                Cancel
              </button>
              <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-bold hover:bg-primary-700 transition-colors">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add CA Column Name Modal */}
      {showCANameModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl">
            <div className="p-6">
              <h3 className="text-sm font-bold text-gray-900 mb-3">New CA Column Name</h3>
              <input
                id="ca-column-name" name="ca-column-name"
                type="text"
                value={newCAName}
                onChange={(e) => setNewCAName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && confirmAddCA()}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="e.g. Mid-Term CA"
                autoFocus
              />
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end gap-2">
              <button onClick={() => setShowCANameModal(false)} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
                Cancel
              </button>
              <button onClick={confirmAddCA} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-bold hover:bg-primary-700 transition-colors">
                Add Column
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">Assessments</h1>
            {isFormMaster && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full border border-amber-200">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                Form Teacher · {formMasterGrade}
              </span>
            )}
          </div>
          <p className="text-gray-500 mt-0.5">
            {isFormMaster
              ? `Viewing all subjects for your class: ${formMasterGrade}`
              : 'Manage continuous assessments, examinations, and question banks.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto items-start sm:items-center flex-wrap">
          {/* Mode tabs */}
          <div className="bg-gray-100 p-1 rounded-lg flex items-center self-start sm:self-auto shrink-0">
            <button
              onClick={() => setMode('manual')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${mode === 'manual' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <FileSpreadsheet size={16} />
              Gradebook
            </button>
            <button
              onClick={() => setMode('builder')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${mode === 'builder' ? 'bg-white shadow text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <BrainCircuit size={16} />
              Exams
            </button>
          </div>

          {/* Gradebook: Settings shortcut — admin only (configures marking scheme) */}
          {mode === 'manual' && (user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN) && (
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shrink-0"
              title="Assessment settings"
            >
              <Settings size={15} className="text-gray-600" /> Settings
            </button>
          )}

          {/* Exams: sub-mode toggle + exam selector + sync */}
          {mode === 'builder' && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="bg-gray-100 p-1 rounded-lg flex items-center shrink-0">
                <button
                  onClick={() => setExamSubMode('builder')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${examSubMode === 'builder' ? 'bg-white shadow text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <PenTool size={15} /> Builder
                </button>
                <button
                  onClick={() => setExamSubMode('proctor')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${examSubMode === 'proctor' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Monitor size={15} /> Proctor
                </button>
              </div>
              <select
                id="exam-select" name="exam-select"
                value={selectedExamId}
                onChange={handleExamSelectionChange}
                className="block pl-3 pr-8 py-1.5 text-sm border border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 rounded-lg min-w-[200px] max-w-xs"
              >
                <option value="" disabled>Select Exam</option>
                <option value="new">+ Create New Exam</option>
                {allExams.map(e => (
                  <option key={e.id} value={e.id}>{e.title} ({e.status})</option>
                ))}
              </select>
              {examSubMode === 'proctor' && (
                <button
                  onClick={handleSyncScores}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors whitespace-nowrap shrink-0"
                >
                  <RefreshCw size={15} /> Sync Scores
                </button>
              )}
            </div>
          )}
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
                        <label htmlFor={`ca-max-${col.id}`} className="block text-xs font-medium text-gray-700 mb-1">{col.label}</label>
                        <input
                          id={`ca-max-${col.id}`} name={`ca-max-${col.id}`}
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
                    <label htmlFor="exam-max-score" className="block text-xs font-medium text-gray-700 mb-1">Exam Max Score</label>
                    <input
                      id="exam-max-score" name="exam-max-score"
                      type="number"
                      value={config.examMax}
                      onChange={(e) => setConfig({...config, examMax: parseInt(e.target.value) || 0})}
                      className="block w-full border border-gray-300 rounded-lg p-2.5 focus:ring-primary-500 focus:border-primary-500 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="pass-mark" className="block text-xs font-medium text-gray-700 mb-1">Pass Mark (Score)</label>
                    <div className="flex items-center gap-2">
                      <input
                        id="pass-mark" name="pass-mark"
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
                          id={`grade-letter-${index}`} name={`grade-letter-${index}`}
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
                             id={`grade-min-pct-${index}`} name={`grade-min-pct-${index}`}
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

      {/* Online and Builder modes are handled below... */}
      
    </>
  );
}
