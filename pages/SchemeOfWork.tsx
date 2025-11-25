import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  FileText,
  X,
  CheckCircle2,
  Download,
  Eye,
  Clock,
} from 'lucide-react';
import { api } from '../services/api';
import { SchemeSubmission, Subject, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';

export const SchemeOfWork: React.FC = () => {
  const { user } = useAuth();
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [history, setHistory] = useState<SchemeSubmission[]>([]);
  
  // Form State
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('Term 1');
  
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load history
        const historyRes = await api.getSchemes();
        if (historyRes.ok) {
          setHistory(historyRes.data);
        }

        // Load Subjects for dropdown
        const subjectsRes = await api.getSubjects();
        if (subjectsRes.ok && subjectsRes.data.length > 0) {
          let subs = subjectsRes.data;
          if (user?.role === UserRole.TEACHER) {
             subs = subs.filter(s => s.teacherId === user.id);
          }
          setSubjects(subs);
          // Default to first subject
          if (subs.length > 0) {
             setSelectedSubject(subs[0].name);
          }
        }
      } catch (error) {
        console.error("Failed to load data", error);
      }
    };

    loadData();
  }, [user]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    // Basic validation
    if (
      file.type === 'application/pdf' ||
      file.type.includes('word') ||
      file.type.includes('excel') ||
      file.type.includes('sheet')
    ) {
      setFile(file);
      setSuccess(false);
    } else {
      alert('Please upload a PDF, Word, or Excel document.');
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedSubject) return;
    setUploading(true);
    try {
      await api.uploadScheme(file, { term: selectedTerm, year: '2024', subject: selectedSubject });
      setSuccess(true);
      
      // Create a new local submission entry to update UI immediately
      const newSubmission: SchemeSubmission = {
        id: Math.random().toString(36).substring(2, 9),
        subjectName: selectedSubject,
        term: selectedTerm,
        uploadDate: new Date().toISOString().split('T')[0],
        status: 'Pending',
        fileName: file.name,
      };
      
      setHistory((prev) => [newSubmission, ...prev]);
      setFile(null);
    } catch (e) {
      console.error(e);
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    setSuccess(false);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved':
        return 'bg-green-100 text-green-800';
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'Rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Upload Section */}
        <div className="w-full md:w-2/3 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Upload Scheme of Work
            </h1>
            <p className="text-gray-500 text-sm">
              Submit your termly plans for administrative review.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Subject
                  </label>
                  <select 
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="block w-full pl-3 pr-8 py-2 text-sm border border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 rounded-lg"
                    disabled={uploading}
                  >
                    {subjects.length > 0 ? (
                      subjects.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))
                    ) : (
                      <option disabled>Loading subjects...</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Term
                  </label>
                  <select 
                    value={selectedTerm}
                    onChange={(e) => setSelectedTerm(e.target.value)}
                    className="block w-full pl-3 pr-8 py-2 text-sm border border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 rounded-lg"
                    disabled={uploading}
                  >
                    <option value="Term 1">Term 1</option>
                    <option value="Term 2">Term 2</option>
                    <option value="Term 3">Term 3</option>
                  </select>
                </div>
              </div>

              <div
                className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
                  dragActive
                    ? 'border-primary-500 bg-primary-50'
                    : file
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  ref={inputRef}
                  type="file"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  onChange={handleChange}
                  accept=".pdf,.doc,.docx,.xls,.xlsx"
                  disabled={uploading}
                />

                <div className="flex flex-col items-center justify-center pointer-events-none">
                  {file ? (
                    <>
                      <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">
                        <FileText size={20} />
                      </div>
                      <p className="text-sm font-medium text-gray-900">
                        {file.name}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-2">
                        <Upload size={20} />
                      </div>
                      <p className="text-sm text-gray-500">
                        <span className="text-primary-600 font-medium">
                          Click to upload
                        </span>{' '}
                        or drag and drop
                      </p>
                    </>
                  )}
                </div>
              </div>

              {file && (
                <div className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-200">
                  <span className="text-xs text-gray-700 truncate max-w-[200px]">
                    {file.name}
                  </span>
                  <button
                    onClick={removeFile}
                    type="button"
                    className="text-gray-400 hover:text-red-500"
                    disabled={uploading}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={handleUpload}
                disabled={!file || uploading}
                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white transition-all ${
                  !file || uploading
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-primary-600 hover:bg-primary-700'
                }`}
              >
                {uploading ? 'Uploading...' : 'Submit Scheme'}
              </button>
            </form>
            {success && (
              <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm flex items-center gap-2">
                <CheckCircle2 size={16} /> Upload successful!
              </div>
            )}
          </div>
        </div>

        {/* History Section (Side on Desktop) */}
        <div className="w-full md:w-1/3 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Recent Submissions
            </h2>
            <p className="text-gray-500 text-xs">Track status of your uploads</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-200 max-h-[500px] overflow-y-auto">
              {history.length > 0 ? (
                history.map((item) => (
                  <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${getStatusColor(
                          item.status
                        )}`}
                      >
                        {item.status}
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock size={10} /> {item.uploadDate}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      {item.subjectName}
                    </h3>
                    <p className="text-xs text-gray-500 mb-2">{item.term}</p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-gray-400 truncate max-w-[100px]">
                        {item.fileName}
                      </span>
                      <div className="flex gap-2">
                        <button className="text-gray-400 hover:text-primary-600">
                          <Eye size={14} />
                        </button>
                        <button className="text-gray-400 hover:text-primary-600">
                          <Download size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500 text-sm">
                  No history available
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};