import React from 'react';
import { BookOpen, Bug, CheckSquare, FlaskConical } from 'lucide-react';
import type { WorkItemType } from '../types/qa';

export const WorkItemIcon: React.FC<{ type: WorkItemType; className?: string }> = ({
  type,
  className = 'w-4 h-4',
}) => {
  switch (type) {
    case 'User Story':
      return <BookOpen className={`${className} text-sky-600 shrink-0`} aria-hidden="true" />;
    case 'Task':
      return <CheckSquare className={`${className} text-amber-600 shrink-0`} aria-hidden="true" />;
    case 'Bug':
      return <Bug className={`${className} text-rose-600 shrink-0`} aria-hidden="true" />;
    case 'Test Case':
      return <FlaskConical className={`${className} text-violet-600 shrink-0`} aria-hidden="true" />;
  }
};

export function getStateDotColor(state: string): string {
  switch (state) {
    case 'Active':
      return 'bg-sky-600';
    case 'Resolved':
    case 'Passed':
    case 'Closed':
      return 'bg-emerald-600';
    case 'Failed':
      return 'bg-rose-600';
    default:
      return 'bg-slate-400';
  }
}

export function getStateTextColor(state: string): string {
  switch (state) {
    case 'Active':
      return 'text-sky-700';
    case 'Resolved':
    case 'Passed':
    case 'Closed':
      return 'text-emerald-700';
    case 'Failed':
      return 'text-rose-700';
    default:
      return 'text-slate-600';
  }
}
