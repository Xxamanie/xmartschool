import React from 'react';
import { GraduationCap, Loader2 } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message = 'Loading...' 
}) => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg">
            <GraduationCap size={32} />
          </div>
        </div>
        
        <div className="flex items-center justify-center gap-3 mb-4">
          <Loader2 size={20} className="animate-spin text-indigo-600" />
          <span className="text-lg font-medium text-gray-700">{message}</span>
        </div>
        
        <div className="text-sm text-gray-500">
          SmartSchool Enterprise Edition
        </div>
      </div>
    </div>
  );
};