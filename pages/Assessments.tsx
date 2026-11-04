import React from 'react';
import { useAssessmentsModel } from './assessments/useAssessmentsModel';
import { AssessmentsControls } from './assessments/AssessmentsControls';
import { GradebookView } from './assessments/GradebookView';
import { ExamBuilderView } from './assessments/ExamBuilderView';
import { ProctoringView } from './assessments/ProctoringView';

export const Assessments: React.FC = () => {
  const model = useAssessmentsModel();
  const { mode, examSubMode } = model;
  return <div className="space-y-6 relative">
    <AssessmentsControls model={model} />
    {mode === 'manual' && <GradebookView model={model} />}
    {mode === 'builder' && examSubMode === 'proctor' && <ProctoringView model={model} />}
    {mode === 'builder' && examSubMode !== 'proctor' && <ExamBuilderView model={model} />}
  </div>;
};
