import React, { useMemo, useState } from 'react';
import { Activity, Plus } from 'lucide-react';
import { useQAVault } from '../store/QAVaultContext';

export const ActivitiesView: React.FC = () => {
  const { state, searchQuery, setQuickActivityOpen } = useQAVault();
  const [typeFilter, setTypeFilter] = useState<string>('All');

  const filteredActivities = useMemo(() => {
    return state.activities.filter((act) => {
      if (typeFilter !== 'All' && act.targetType !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          act.actor.toLowerCase().includes(q) ||
          act.action.toLowerCase().includes(q) ||
          act.targetTitle.toLowerCase().includes(q) ||
          act.targetType.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [state.activities, typeFilter, searchQuery]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Activities</h1>
          <p className="mt-1 text-sm text-slate-500">
            Audit log of QA actions, state changes, document edits, and restorations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-teal-600 focus:outline-none"
          >
            <option value="All">All Activity Types</option>
            <option value="Task">Task</option>
            <option value="Bug">Bug</option>
            <option value="User Story">User Story</option>
            <option value="Test Case">Test Case</option>
            <option value="Document">Document</option>
            <option value="Sprint">Sprint</option>
            <option value="User">User</option>
            <option value="Note">Note</option>
          </select>

          <button
            type="button"
            onClick={() => setQuickActivityOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700"
          >
            <Plus className="w-4 h-4" />
            Log Activity
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
        {filteredActivities.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            No activity logs match the current filter.
          </div>
        ) : (
          filteredActivities.map((act) => (
            <div key={act.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 shrink-0">
                  <Activity className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-slate-800">
                    <span className="font-semibold text-slate-900">{act.actor}</span>{' '}
                    <span className="text-slate-600">{act.action}</span>{' '}
                    <span className="font-medium text-slate-900">{act.targetTitle}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{act.targetType}</p>
                </div>
              </div>
              <span className="font-mono text-xs text-slate-400 tabular-nums whitespace-nowrap shrink-0">
                {new Date(act.timestamp).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
