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

export function ExamBuilderView({ model }: { model: AssessmentsModel }) {
 const { mode, builderConfig, setBuilderConfig, handleGenerateQuestions, isGenerating, setShowImportModal, handleAddManualQuestion, builderQuestions, handleClearExam, handleSaveExam, handleSaveAndActivate, saveMessage, deleteQuestion, updateQuestion } = model;
 return (
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
                  <label htmlFor="builder-topic" className="block text-xs font-medium text-gray-700 mb-1">Context / Topic</label>
                  <div className="flex flex-col gap-2">
                    <textarea
                      id="builder-topic" name="builder-topic"
                      value={builderConfig.topic}
                      onChange={(e) => setBuilderConfig({...builderConfig, topic: e.target.value})}
                      placeholder="e.g. Photosynthesis, World War II, Calculus Derivatives..."
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-purple-500 focus:border-purple-500 min-h-[80px] resize-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="builder-q-type" className="block text-xs font-medium text-gray-700 mb-1">Question Type</label>
                    <select
                      id="builder-q-type" name="builder-q-type"
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
                    <label htmlFor="builder-difficulty" className="block text-xs font-medium text-gray-700 mb-1">Difficulty</label>
                    <select
                      id="builder-difficulty" name="builder-difficulty"
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
                  <label htmlFor="builder-q-count" className="block text-xs font-medium text-gray-700 mb-1">Number of Questions</label>
                  <input
                    id="builder-q-count" name="builder-q-count"
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
                             id={`q-text-${question.id}`} name={`q-text-${question.id}`}
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
                                  id={`q-${question.id}-opt-${optIndex}`} name={`q-${question.id}-opt-${optIndex}`}
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
                               id={`q-answer-${question.id}`} name={`q-answer-${question.id}`}
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
                                id={`q-points-${question.id}`} name={`q-points-${question.id}`}
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
      );
}
