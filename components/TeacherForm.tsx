import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { Save, Mail, Phone, Briefcase } from 'lucide-react';
import { useClickSound } from '../src/utils/useClickSound';
import { PhotoUpload } from './PhotoUpload';

interface TeacherFormProps {
  teacher?: User | null;
  onSubmit: (teacherData: Partial<User>) => void;
  onCancel: () => void;
}

type TeacherFormState = {
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  gender: User['gender'] | '';
  bio: string;
  schoolId: string;
  avatar: string;
};

export const TeacherForm: React.FC<TeacherFormProps> = ({ teacher, onSubmit, onCancel }) => {
  const { playSound } = useClickSound();

  const [formData, setFormData] = useState<TeacherFormState>({
    name: teacher?.name || '',
    email: teacher?.email || '',
    phone: teacher?.phone || '',
    role: teacher?.role || UserRole.TEACHER,
    gender: teacher?.gender || '',
    bio: teacher?.bio || '',
    schoolId: teacher?.schoolId || '',
    avatar: teacher?.avatar || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Invalid email format';
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit({
        ...formData,
        gender: formData.gender || undefined,
        avatar: formData.avatar || undefined,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">

      {/* Photo */}
      <PhotoUpload
        label="Teacher Photo"
        name={formData.name || 'Teacher'}
        value={formData.avatar}
        onChange={(dataUrl) => setFormData((prev) => ({ ...prev, avatar: dataUrl }))}
      />

      {/* Name */}
      <div>
        <label htmlFor="teacher-name" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
        <input
          id="teacher-name" name="name"
          type="text"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent block w-full ${
            errors.name ? 'border-red-300' : 'border-gray-300'
          }`}
          placeholder="Enter teacher's full name"
        />
        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
      </div>

      {/* Email */}
      <div>
        <label htmlFor="teacher-email" className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <Mail size={15} />
          </span>
          <input
            id="teacher-email" name="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            className={`pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent block w-full ${
              errors.email ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="teacher@school.edu"
          />
        </div>
        {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="teacher-phone" className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <Phone size={15} />
          </span>
          <input
            id="teacher-phone" name="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            className={`pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent block w-full ${
              errors.phone ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="+2348001234567"
          />
        </div>
        {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
      </div>

      {/* Role */}
      <div>
        <label htmlFor="teacher-role" className="block text-sm font-medium text-gray-700 mb-1">Role</label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <Briefcase size={15} />
          </span>
          <select
            id="teacher-role" name="role"
            value={formData.role}
            onChange={(e) => handleChange('role', e.target.value)}
            className="pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent block w-full appearance-none"
          >
            <option value={UserRole.TEACHER}>Teacher</option>
            <option value={UserRole.ADMIN}>Administrator</option>
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </div>
      </div>

      {/* Gender */}
      <div>
        <label htmlFor="teacher-gender" className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
        <select
          id="teacher-gender" name="gender"
          value={formData.gender}
          onChange={(e) => handleChange('gender', e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent block w-full"
        >
          <option value="">Select Gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
      </div>

      {/* Bio */}
      <div>
        <label htmlFor="teacher-bio" className="block text-sm font-medium text-gray-700 mb-1">Bio (Optional)</label>
        <textarea
          id="teacher-bio" name="bio"
          value={formData.bio}
          onChange={(e) => handleChange('bio', e.target.value)}
          rows={3}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent block w-full resize-none"
          placeholder="Brief description about the teacher…"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={() => { playSound(); onCancel(); }}
          className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
        >
          Cancel
        </button>
        <button
          type="submit"
          onClick={playSound}
          className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          <Save size={16} />
          {teacher ? 'Update Teacher' : 'Add Teacher'}
        </button>
      </div>
    </form>
  );
};

export default TeacherForm;
