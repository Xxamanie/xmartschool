import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';

interface CreateClassFormProps {
  onSubmit: (className: string) => Promise<void>;
  onCancel: () => void;
  existingClasses: string[];
}

export const CreateClassForm: React.FC<CreateClassFormProps> = ({ 
  onSubmit, 
  onCancel, 
  existingClasses 
}) => {
  const [className, setClassName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim()) return;
    
    setLoading(true);
    try {
      await onSubmit(className);
      setClassName('');
    } finally {
      setLoading(false);
    }
  };

  const isDuplicate = existingClasses.some(
    c => c.toLowerCase() === className.trim().toLowerCase()
  );

  return (
    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Class Name *
        </label>
        <input
          type="text"
          required
          value={className}
          onChange={(e) => setClassName(e.target.value)}
          placeholder="e.g., Grade 7A, JHS 1B, Form 4 Science"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        {className.trim() && isDuplicate && (
          <p className="mt-1 text-xs text-red-600">
            This class already exists
          </p>
        )}
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Examples:</h4>
        <div className="space-y-1 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
            <span>Grade 7A, Grade 8B (Primary/Elementary)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
            <span>JHS 1A, JHS 2B (Junior High)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
            <span>Form 3 Science, Form 5 Arts (Senior High)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
            <span>Nursery 2, KG 1B (Early Years)</span>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors shadow-sm disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !className.trim() || isDuplicate}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
        >
          <Plus size={16} />
          {loading ? 'Creating...' : 'Create Class'}
        </button>
      </div>
    </form>
  );
};
