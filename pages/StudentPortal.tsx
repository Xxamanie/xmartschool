
import React, { useEffect, useState, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ResultData, ActiveExam, School } from '../types';
import { FileCheck, Award, Calendar, Timer, ArrowRight, CheckCircle, BookOpen, ChevronRight, X, Ghost } from 'lucide-react';

export const StudentPortal: React.FC = () => {
  const { user } = useAuth();
  const [results, setResults] = useState<ResultData[]>([]);
  const [availableExams, setAvailableExams] = useState<ActiveExam[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Exam Taking State
  const [activeExam, setActiveExam] = useState<ActiveExam | null>(null); // The exam currently being taken
  const [isTakingExam, setIsTakingExam] = useState(false);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [score, setScore] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0); // Seconds

  // Refs for Intervals and State Access in Closures
  const progressSyncRef = useRef<any>(null);
  const answersRef = useRef(answers);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<any>(null);

  // Keep answers ref synced for the interval
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    const fetchMyData = async () => {
        if (!user?.id) return;
        try {
            const [resResults, resExams, resSchools] = await Promise.all([
                api.getResults(user.id),
                api.getAvailableExams(),
                api.getSchools()
            ]);
            
            if (resResults.ok) {
                setResults(resResults.data.filter(r => r.status === 'Published'));
            }
            if (resExams.ok) {
                setAvailableExams(resExams.data);
            }
            if (resSchools.ok && user.schoolId) {
                const foundSchool = resSchools.data.find(s => s.id === user.schoolId);
                setSchool(foundSchool || null);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
    fetchMyData();
  }, [user?.id, user?.schoolId]);

  // Prevent accidental close/refresh during exam
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isTakingExam && !examSubmitted) {
        e.preventDefault();
        e.returnValue = ''; // Chrome requires returnValue to be set
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isTakingExam, examSubmitted]);

  // Exam Timer & Progress Sync
  useEffect(() => {
    if (isTakingExam && timeLeft > 0 && !examSubmitted) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
      
      // Sync progress every 5 seconds
      if (!progressSyncRef.current && activeExam && user) {
         progressSyncRef.current = setInterval(() => {
            const totalQuestions = activeExam.questions.length;
            const currentAnswers = answersRef.current; // Use Ref to get fresh state
            const answeredCount = Object.keys(currentAnswers).length;
            const progress = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;
            api.updateExamSessionProgress(activeExam.id, user.id, progress, currentAnswers);
         }, 5000);
      }

      return () => {
          clearInterval(timer);
          if (progressSyncRef.current) {
              clearInterval(progressSyncRef.current);
              progressSyncRef.current = null;
          }
      };
    } else if (timeLeft === 0 && isTakingExam && !examSubmitted) {
       handleSubmitExam(); // Auto submit
    }
  }, [isTakingExam, timeLeft, examSubmitted, activeExam, user]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const calculateGPA = () => {
    if (results.length === 0) return 0;
    const total = results.reduce((acc, r) => acc + (r.average / 20), 0); 
    return (total / results.length).toFixed(2);
  };

  const handleSelectExam = async (exam: ActiveExam) => {
      if (!user) return;
      
      // Start session on backend
      const res = await api.startExamSession(exam.id, user.id);
      
      if (res.ok) {
          const session = res.data;
          
          // Resume Logic: Restore answers if any
          if (session.answers && Object.keys(session.answers).length > 0) {
              setAnswers(session.answers);
          } else {
              setAnswers({});
          }

          // Resume Logic: Calculate remaining time
          if (session.startTime && session.status === 'in-progress') {
              const start = new Date(session.startTime).getTime();
              const now = new Date().getTime();
              const elapsedSeconds = Math.floor((now - start) / 1000);
              const totalSeconds = exam.duration * 60;
              const remaining = totalSeconds - elapsedSeconds;
              
              if (remaining <= 0) {
                  // Exam should have ended
                  alert("Your exam time has expired.");
                  setTimeLeft(0);
                  // Optionally force submit here
              } else {
                  setTimeLeft(remaining);
              }
          } else {
              setTimeLeft(exam.duration * 60);
          }
      }
      
      setActiveExam(exam);
      setScore(null);
      setExamSubmitted(false);
      setIsTakingExam(true);

      // Start camera proctoring
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }

        frameIntervalRef.current = setInterval(async () => {
          if (!videoRef.current || !streamRef.current) return;
          const video = videoRef.current;
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 320;
          canvas.height = video.videoHeight || 240;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          await api.uploadProctorFrame(exam.id, user.id, dataUrl);
        }, 8000);
      } catch (err) {
        console.error('Camera access denied', err);
      }
  };

  const handleAnswerChange = (questionId: string, value: string) => {
      setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmitExam = async () => {
      if (!activeExam || !user) return;
      
      // Clear Sync Interval immediately
      if (progressSyncRef.current) {
          clearInterval(progressSyncRef.current);
          progressSyncRef.current = null;
      }

      // Simple Grading Logic
      let totalScore = 0;
      
      activeExam.questions.forEach(q => {
          const userAnswer = answers[q.id];
          // Case insensitive check for text answers
          if (userAnswer && userAnswer.toLowerCase().trim() === q.correctAnswer.toLowerCase().trim()) {
              totalScore += q.points;
          }
      });
      
      setScore(totalScore);
      setExamSubmitted(true);
      
      // Submit to API
      await api.submitExam(user.id, answers, totalScore);
  };

  const handleExitExam = () => {
      setIsTakingExam(false);
      setExamSubmitted(false);
      setActiveExam(null);
      // Refresh to show updated results
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      window.location.reload();
  };

  if (isTakingExam && activeExam) {
      return (
        <div className="max-w-4xl mx-auto py-6">
            {/* Exam Header */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6 sticky top-4 z-10 flex justify-between items-center">
               <div>
                   <h2 className="text-xl font-bold text-gray-900">{activeExam.title}</h2>
                   <p className="text-gray-500 text-sm">Answer all questions.</p>
               </div>
               <div className={`px-4 py-2 rounded-lg font-mono font-bold text-lg flex items-center gap-2 ${timeLeft < 300 ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                   <Timer size={20} />
                   {formatTime(timeLeft)}
               </div>
            </div>

            {examSubmitted ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center animate-in fade-in zoom-in duration-300">
                   <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
                       <CheckCircle size={40} />
                   </div>
                   <h2 className="text-3xl font-bold text-gray-900 mb-2">Exam Submitted!</h2>
                   <p className="text-gray-500 mb-8">Your responses have been recorded successfully.</p>
                   
                   <div className="bg-gray-50 p-6 rounded-xl max-w-md mx-auto mb-8">
                       <p className="text-sm text-gray-500 uppercase tracking-wider font-bold mb-1">Provisional Score</p>
                       <p className="text-4xl font-bold text-primary-600">{score} <span className="text-lg text-gray-400">/ {activeExam.questions.reduce((a,b) => a+b.points, 0)}</span></p>
                   </div>
                   
                   <button 
                      onClick={handleExitExam}
                      className="px-8 py-3 bg-gray-900 text-white rounded-lg font-bold hover:bg-gray-800 transition-colors"
                   >
                       Return to Dashboard
                   </button>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="bg-gray-900 text-white rounded-lg p-4 flex items-center gap-4">
                        <div className="w-32 h-24 bg-black rounded-md overflow-hidden border border-gray-700">
                            <video ref={videoRef} className="w-full h-full object-cover" muted />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Camera Proctoring Active</p>
                          <p className="text-xs text-gray-300">Live preview and periodic snapshots every 8s.</p>
                        </div>
                    </div>

                    {activeExam.questions.map((q, idx) => (
                        <div key={q.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <div className="flex gap-4">
                                <span className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-bold text-gray-600">
                                    {idx + 1}
                                </span>
                                <div className="flex-1">
                                    <p className="text-lg font-medium text-gray-900 mb-4">{q.text}</p>
                                    
                                    {/* Render Input based on Type */}
                                    {(q.type === 'multiple-choice') && (
                                        <div className="space-y-3">
                                            {q.options?.map(opt => (
                                                <label key={opt} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${answers[q.id] === opt ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${answers[q.id] === opt ? 'border-primary-600' : 'border-gray-300'}`}>
                                                        {answers[q.id] === opt && <div className="w-3 h-3 rounded-full bg-primary-600"></div>}
                                                    </div>
                                                    <input 
                                                       type="radio" 
                                                       name={q.id} 
                                                       value={opt} 
                                                       checked={answers[q.id] === opt}
                                                       onChange={() => handleAnswerChange(q.id, opt)}
                                                       className="hidden"
                                                    />
                                                    <span className="text-gray-700">{opt}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}

                                    {(q.type === 'true-false') && (
                                         <div className="flex gap-4">
                                            {['True', 'False'].map(opt => (
                                                <label key={opt} className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${answers[q.id] === opt ? 'border-primary-500 bg-primary-50 font-bold text-primary-700' : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`}>
                                                    <input 
                                                       type="radio" 
                                                       name={q.id} 
                                                       value={opt} 
                                                       checked={answers[q.id] === opt}
                                                       onChange={() => handleAnswerChange(q.id, opt)}
                                                       className="hidden"
                                                    />
                                                    <span>{opt}</span>
                                                </label>
                                            ))}
                                         </div>
                                    )}

                                    {(q.type === 'short-answer' || q.type === 'essay') && (
                                        <textarea 
                                            value={answers[q.id] || ''}
                                            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                            placeholder="Type your answer here..."
                                            rows={q.type === 'essay' ? 5 : 2}
                                        />
                                    )}
                                </div>
                                <div className="text-xs font-bold text-gray-400 whitespace-nowrap mt-1">{q.points} PTS</div>
                            </div>
                        </div>
                    ))}

                    <div className="flex justify-end py-6">
                        <button 
                           onClick={handleSubmitExam}
                           className="px-8 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20 flex items-center gap-2"
                        >
                            Submit Assessment
                            <ArrowRight size={20} />
                        </button>
                    </div>
                </div>
            )}
        </div>
      );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
       {/* Global Print Styles */}
       <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #student-report-card, #student-report-card * {
            visibility: visible;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #student-report-card {
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

       {/* Student Profile Header */}
       <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-primary-600 to-indigo-700 p-8 text-white">
             <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4">
                   <img src={user?.avatar} alt="Student" className="w-20 h-20 rounded-full border-4 border-white/30" />
                   <div>
                      <h1 className="text-2xl font-bold">{user?.name}</h1>
                      <p className="text-indigo-100">Class of 2024 • Grade 10</p>
                   </div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 min-w-[150px] text-center">
                   <p className="text-xs uppercase tracking-wider font-semibold text-indigo-200">Current GPA</p>
                   <p className="text-3xl font-bold">{calculateGPA()}</p>
                </div>
             </div>
          </div>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-gray-100">
             <div className="flex items-center gap-3 py-2">
                <div className="p-2 bg-green-50 text-green-600 rounded-lg"><Award size={20} /></div>
                <div>
                   <p className="text-xs text-gray-500 uppercase font-semibold">Attendance</p>
                   <p className="text-lg font-bold text-gray-900">98%</p>
                </div>
             </div>
             <div className="flex items-center gap-3 py-2 md:pl-6">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><FileCheck size={20} /></div>
                <div>
                   <p className="text-xs text-gray-500 uppercase font-semibold">Subjects</p>
                   <p className="text-lg font-bold text-gray-900">{results.length} Enrolled</p>
                </div>
             </div>
             <div className="flex items-center gap-3 py-2 md:pl-6">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Calendar size={20} /></div>
                <div>
                   <p className="text-xs text-gray-500 uppercase font-semibold">Current Term</p>
                   <p className="text-lg font-bold text-gray-900">Term 1, 2024</p>
                </div>
             </div>
          </div>
       </div>

       {/* Available Assessments Section */}
       <div>
           <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
               <BookOpen className="text-primary-600" />
               Available Assessments
           </h2>
           
           {availableExams.length > 0 ? (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {availableExams.map(exam => (
                       <div key={exam.id} className="bg-white rounded-xl shadow-sm border border-indigo-100 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                           <div className="h-2 bg-indigo-500 w-full"></div>
                           <div className="p-6 flex-1 flex flex-col">
                               <div className="flex justify-between items-start mb-4">
                                   <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                                       <Timer size={24} />
                                   </div>
                                   <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded uppercase">
                                       Active
                                   </span>
                               </div>
                               <h3 className="text-lg font-bold text-gray-900 mb-2">{exam.title}</h3>
                               <p className="text-gray-500 text-sm mb-6 flex-1">
                                   Duration: {exam.duration} Minutes <br/>
                                   Questions: {exam.questions.length}
                               </p>
                               <button 
                                   onClick={() => handleSelectExam(exam)}
                                   className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                               >
                                   Start Exam <ChevronRight size={16} />
                               </button>
                           </div>
                       </div>
                   ))}
               </div>
           ) : (
               <div className="bg-gray-50 rounded-xl border border-gray-200 p-8 text-center text-gray-500">
                   <div className="mx-auto w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                       <Ghost size={24} className="text-gray-400" />
                   </div>
                   <h3 className="text-lg font-medium text-gray-900">No Active Exams</h3>
                   <p>You have no pending assessments at this time.</p>
               </div>
           )}
       </div>
    </div>
  );
};
