import React, { useState, useEffect } from 'react';
import { Student, SchoolClassItem } from '../types';
import { Save, Plus } from 'lucide-react';
import { useClickSound } from '../src/utils/useClickSound';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PhotoUpload } from './PhotoUpload';

interface StudentFormProps {
  student?: Student | null;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}

export const StudentForm: React.FC<StudentFormProps> = ({ student, onSubmit, onCancel }) => {
  const { playSound } = useClickSound();
  const { user } = useAuth();
  const [schoolClasses, setSchoolClasses] = useState<SchoolClassItem[]>([]);
  const [addingClass, setAddingClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [classAdding, setClassAdding] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    gender: 'Male' as 'Male' | 'Female',
    grade: '',
    status: 'Active' as 'Active' | 'Inactive' | 'Suspended',
    gpa: 0.0,
    attendance: 100,
    schoolId: '',
    avatar: '',
  });

  useEffect(() => {
    if (user?.schoolId) {
      api.getSchoolClasses(user.schoolId).then((res) => {
        if (res.ok) setSchoolClasses(res.data);
      });
    }
  }, [user?.schoolId]);

  useEffect(() => {
    if (student) {
      setFormData({
        name: student.name,
        gender: student.gender,
        grade: student.grade,
        status: student.status,
        gpa: student.gpa,
        attendance: student.attendance,
        schoolId: student.schoolId,
        avatar: student.avatar || '',
      });
    }
  }, [student]);

  const handleAddClass = async () => {
    if (!newClassName.trim() || !user?.schoolId) return;
    setClassAdding(true);
    try {
      const res = await api.addClassToSchool(user.schoolId, newClassName.trim());
      if (res.ok) {
        const updated = await api.getSchoolClasses(user.schoolId);
        if (updated.ok) {
          setSchoolClasses(updated.data);
          setFormData((prev) => ({ ...prev, grade: newClassName.trim() }));
        }
        setNewClassName('');
        setAddingClass(false);
      }
    } finally {
      setClassAdding(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(formData);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">

      {/* Photo */}
      <PhotoUpload
        label="Student Photo"
        name={formData.name || 'Student'}
        value={formData.avatar}
        onChange={(dataUrl) => handleChange('avatar', dataUrl)}
      />

      {/* Name */}
      <div>
        <label htmlFor="student-name" className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
        <input
          id="student-name" name="name"
          type="text"
          required
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
          placeholder="Enter student's full name"
        />
      </div>

      {/* Gender */}
      <div>
        <label htmlFor="student-gender" className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
        <select
          id="student-gender" name="gender"
          required
          value={formData.gender}
          onChange={(e) => handleChange('gender', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
        >
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
      </div>

      {/* Grade / Class */}
      <div>
        <label htmlFor="student-grade" className="block text-sm font-medium text-gray-700 mb-1">Grade / Class *</label>
        {addingClass ? (
          <div className="flex gap-2">
            <input
              id="new-class-name" name="new-class-name"
              autoFocus
              type="text"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleAddClass(); }
                if (e.key === 'Escape') setAddingClass(false);
              }}
              placeholder="e.g. JSS 1A"
              className="flex-1 px-3 py-2 border border-primary-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
            <button
              type="button"
              onClick={handleAddClass}
              disabled={classAdding || !newClassName.trim()}
              className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50"
            >
              {classAdding ? '...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setAddingClass(false)}
              className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <select
              id="student-grade" name="grade"
              required
              value={formData.grade}
              onChange={(e) => handleChange('grade', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            >
              <option value="" disabled>Select class / grade</option>
              {schoolClasses.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
              {formData.grade && !schoolClasses.some((c) => c.name === formData.grade) && (
                <option value={formData.grade}>{formData.grade}</option>
              )}
            </select>
            <button
              type="button"
              onClick={() => setAddingClass(true)}
              className="flex-shrink-0 flex items-center gap-1 px-3 py-2 bg-gray-100 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
              title="Add new class"
            >
              <Plus size={14} /> New
            </button>
          </div>
        )}
      </div>

      {/* Status */}
      <div>
        <label htmlFor="student-status" className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
        <select
          id="student-status" name="status"
          required
          value={formData.status}
          onChange={(e) => handleChange('status', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
        >
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Suspended">Suspended</option>
        </select>
      </div>

      {/* GPA + Attendance */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="student-gpa" className="block text-sm font-medium text-gray-700 mb-1">GPA</label>
          <input
            id="student-gpa" name="gpa"
            type="number"
            step="0.1"
            min="0"
            max="4"
            value={formData.gpa}
            onChange={(e) => handleChange('gpa', parseFloat(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
          />
        </div>
        <div>
          <label htmlFor="student-attendance" className="block text-sm font-medium text-gray-700 mb-1">Attendance (%)</label>
          <input
            id="student-attendance" name="attendance"
            type="number"
            min="0"
            max="100"
            value={formData.attendance}
            onChange={(e) => handleChange('attendance', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end gap-2">
        <button
          type="button"
          onClick={() => { playSound(); onCancel(); }}
          disabled={loading}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors shadow-sm disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          onClick={playSound}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
        >
          <Save size={16} />
          {loading ? 'Saving…' : (student ? 'Update' : 'Add') + ' Student'}
        </button>
      </div>
    </form>
  );
};
