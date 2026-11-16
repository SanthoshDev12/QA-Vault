import React, { useMemo, useState } from 'react';
import { CalendarDays, Columns3, List, Plus, Trash2, X } from 'lucide-react';
import { useQAVault } from '../store/QAVaultContext';
import type { WorkItemState, WorkItemType } from '../types/qa';
import { getStateDotColor, getStateTextColor, WorkItemIcon } from './WorkItemIcon';

const SPRINT_STATES: WorkItemState[] = ['New', 'Active', 'Resolved', 'Closed', 'Passed', 'Failed'];
const BOARD_COLUMNS: WorkItemState[] = ['New', 'Active', 'Resolved', 'Closed'];

export const SprintView: React.FC = () => {
  const {
    state,
    searchQuery,
    openCreateWorkItem,
    openEditWorkItem,
    updateWorkItem,
    softDeleteWorkItem,
    createSprint,
  } = useQAVault();

  const [selectedSprintId, setSelectedSprintId] = useState<string>(
    () => state.sprints.find((s) => s.status === 'Active')?.id || state.sprints[0]?.id || ''
  );
  const [viewMode, setViewMode] = useState<'backlog' | 'board'>('backlog');
  const [typeFilter, setTypeFilter] = useState<'All' | WorkItemType>('All');
  const [newSprintOpen, setNewSprintOpen] = useState(false);

  const [sprintName, setSprintName] = useState('');
  const [sprintPath, setSprintPath] = useState('');
  const [sprintStart, setSprintStart] = useState(new Date().toISOString().slice(0, 10));
  const [sprintEnd, setSprintEnd] = useState(
    new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  );
  const [sprintGoal, setSprintGoal] = useState('');

  const activeSprint = useMemo(
    () => state.sprints.find((s) => s.id === selectedSprintId) || state.sprints[0] || null,
    [state.sprints, selectedSprintId]
  );

  const sprintItems = useMemo(() => {
    return state.workItems
      .filter((item) => {
        if (item.isDeleted) return false;
        if (activeSprint && item.iterationPath !== activeSprint.iterationPath) return false;
        if (typeFilter !== 'All' && item.type !== typeFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            item.title.toLowerCase().includes(q) ||
            String(item.id).includes(q) ||
            item.assignedToName.toLowerCase().includes(q) ||
            item.areaPath.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => a.id - b.id);
  }, [state.workItems, activeSprint, typeFilter, searchQuery]);

  const handleCreateSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sprintName.trim()) return;
    await createSprint({
      name: sprintName.trim(),
      iterationPath: sprintPath.trim() || sprintName.trim(),
      startDate: sprintStart,
      endDate: sprintEnd,
      status: 'Planned',
      goal: sprintGoal.trim(),
    });
    setSprintName('');
    setSprintPath('');
    setSprintGoal('');
    setNewSprintOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sprint</h1>
            {activeSprint && (
              <span className="text-xs font-medium text-slate-500 tabular-nums">
                {activeSprint.startDate} to {activeSprint.endDate} · {activeSprint.status}
              </span>
            )}
          </div>
          {activeSprint?.goal && (
            <p className="mt-1 text-sm text-slate-500">{activeSprint.goal}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={activeSprint?.id || ''}
            onChange={(e) => setSelectedSprintId(e.target.value)}
            aria-label="Select sprint"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-teal-600 focus:outline-none"
          >
            {state.sprints.length === 0 ? (
              <option value="">No Sprints Created</option>
            ) : (
              state.sprints.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name} · {sp.iterationPath}
                </option>
              ))
            )}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'All' | WorkItemType)}
            aria-label="Filter by work item type"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-teal-600 focus:outline-none"
          >
            <option value="All">All Types</option>
            <option value="User Story">User Story</option>
            <option value="Task">Task</option>
            <option value="Bug">Bug</option>
            <option value="Test Case">Test Case</option>
          </select>

          <div className="flex items-center rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setViewMode('backlog')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === 'backlog'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Sprint Backlog
            </button>
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === 'board'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Columns3 className="w-3.5 h-3.5" />
              Taskboard
            </button>
          </div>

          <button
            type="button"
            onClick={() => setNewSprintOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            New Sprint
          </button>

          <button
            type="button"
            onClick={() =>
              openCreateWorkItem({
                type: 'Task',
                iterationPath: activeSprint?.iterationPath || 'Backlog',
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add to Sprint
          </button>
        </div>
      </div>

      {/* Sprint Backlog View (matching sprintbacklogs_8dd26cf0.png) */}
      {viewMode === 'backlog' ? (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 pl-5 pr-3">ID</th>
                  <th className="py-3 px-3">Title</th>
                  <th className="py-3 px-3">Assigned To</th>
                  <th className="py-3 px-3">State</th>
                  <th className="py-3 px-3">Area Path</th>
                  <th className="py-3 px-3">Tags</th>
                  <th className="py-3 pl-3 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {sprintItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">
                      No work items assigned to {activeSprint?.name || 'this sprint'} yet.
                    </td>
                  </tr>
                ) : (
                  sprintItems.map((item) => {
                    const assignedUser = state.users.find(
                      (u) => u.id === item.assignedToId || u.name === item.assignedToName
                    );
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 pl-5 pr-3 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                          {item.id}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <WorkItemIcon type={item.type} className="w-4 h-4" />
                            <button
                              type="button"
                              onClick={() => openEditWorkItem(item)}
                              className="text-left text-sm font-medium text-slate-900 hover:text-teal-700 hover:underline"
                            >
                              {item.title}
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span
                              className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white shrink-0"
                              style={{ backgroundColor: assignedUser?.avatarColor || '#64748b' }}
                            >
                              {assignedUser?.initials ||
                                item.assignedToName.slice(0, 2).toUpperCase()}
                            </span>
                            <select
                              value={item.assignedToId || ''}
                              aria-label={`Assign ${item.title}`}
                              onChange={(e) => {
                                const u = state.users.find((usr) => usr.id === e.target.value);
                                updateWorkItem(item.id, {
                                  assignedToId: u ? u.id : null,
                                  assignedToName: u ? u.name : 'Unassigned',
                                });
                              }}
                              className="bg-transparent text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"
                            >
                              <option value="">Unassigned</option>
                              {state.users.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full ${getStateDotColor(item.state)}`} />
                            <select
                              value={item.state}
                              aria-label={`State for ${item.title}`}
                              onChange={(e) =>
                                updateWorkItem(item.id, { state: e.target.value as WorkItemState })
                              }
                              className={`bg-transparent text-xs font-medium focus:outline-none cursor-pointer ${getStateTextColor(
                                item.state
                              )}`}
                            >
                              {SPRINT_STATES.map((s) => (
                                <option key={s} value={s} className="text-slate-900">
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-600 whitespace-nowrap">
                          {item.areaPath}
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-500 whitespace-nowrap">
                          {item.tags.length > 0 ? item.tags.join(' · ') : '—'}
                        </td>
                        <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => softDeleteWorkItem(item.id)}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            title="Move to Recycle Bin"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Sprint Taskboard View */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {BOARD_COLUMNS.map((col) => {
            const colItems = sprintItems.filter((w) =>
              col === 'Closed'
                ? w.state === 'Closed' || w.state === 'Passed'
                : col === 'Resolved'
                ? w.state === 'Resolved' || w.state === 'Failed'
                : w.state === col
            );
            return (
              <div key={col} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${getStateDotColor(col)}`} />
                    <h3 className="text-xs font-semibold text-slate-800">{col}</h3>
                  </div>
                  <span className="font-mono text-xs text-slate-500 tabular-nums">{colItems.length}</span>
                </div>

                <div className="space-y-2.5">
                  {colItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-slate-300"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                          <WorkItemIcon type={item.type} className="w-3.5 h-3.5" />
                          #{item.id}
                        </span>
                        <span>{item.priority}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => openEditWorkItem(item)}
                        className="mt-1.5 block text-left text-xs font-semibold text-slate-900 hover:text-teal-700"
                      >
                        {item.title}
                      </button>
                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                        <span>{item.assignedToName}</span>
                        <select
                          value={item.state}
                          onChange={(e) =>
                            updateWorkItem(item.id, { state: e.target.value as WorkItemState })
                          }
                          className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer"
                        >
                          {SPRINT_STATES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Sprint Modal */}
      {newSprintOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">Create New Sprint</h2>
              <button
                type="button"
                onClick={() => setNewSprintOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSprint} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Sprint Name</label>
                <input
                  type="text"
                  required
                  value={sprintName}
                  onChange={(e) => setSprintName(e.target.value)}
                  placeholder="Sprint 16"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Iteration Path</label>
                <input
                  type="text"
                  value={sprintPath}
                  onChange={(e) => setSprintPath(e.target.value)}
                  placeholder="UAT - Tulliam / Sprint 16"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={sprintStart}
                    onChange={(e) => setSprintStart(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">End Date</label>
                  <input
                    type="date"
                    value={sprintEnd}
                    onChange={(e) => setSprintEnd(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Sprint Goal</label>
                <textarea
                  rows={2}
                  value={sprintGoal}
                  onChange={(e) => setSprintGoal(e.target.value)}
                  placeholder="Key QA deliverables for this sprint..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewSprintOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700"
                >
                  Create Sprint
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
