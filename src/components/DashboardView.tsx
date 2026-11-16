import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Bug,
  CheckSquare,
  FlaskConical,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useQAVault } from '../store/QAVaultContext';
import type { WorkItemState, WorkItemType } from '../types/qa';
import { getStateDotColor, getStateTextColor, WorkItemIcon } from './WorkItemIcon';

const ALL_STATES: WorkItemState[] = ['New', 'Active', 'Resolved', 'Closed', 'Passed', 'Failed'];

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export const DashboardView: React.FC = () => {
  const {
    state,
    currentUser,
    searchQuery,
    setActiveNav,
    openCreateWorkItem,
    openEditWorkItem,
    updateWorkItem,
    softDeleteWorkItem,
    softDeleteNote,
    restoreItem,
    setQuickNoteOpen,
  } = useQAVault();

  const [typeFilter, setTypeFilter] = useState<'All' | WorkItemType>('All');
  const [sprintFilter, setSprintFilter] = useState<string>('All');

  const activeItems = useMemo(() => {
    return state.workItems.filter((item) => {
      if (item.isDeleted) return false;
      if (sprintFilter !== 'All' && item.iterationPath !== sprintFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          item.title.toLowerCase().includes(q) ||
          String(item.id).includes(q) ||
          item.assignedToName.toLowerCase().includes(q) ||
          item.type.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [state.workItems, sprintFilter, searchQuery]);

  const tasks = useMemo(() => activeItems.filter((w) => w.type === 'Task'), [activeItems]);
  const bugs = useMemo(() => activeItems.filter((w) => w.type === 'Bug'), [activeItems]);
  const stories = useMemo(() => activeItems.filter((w) => w.type === 'User Story'), [activeItems]);
  const testCases = useMemo(() => activeItems.filter((w) => w.type === 'Test Case'), [activeItems]);

  const tasksOpen = tasks.filter((t) => t.state === 'New' || t.state === 'Active').length;
  const tasksDone = tasks.filter((t) => t.state === 'Closed' || t.state === 'Resolved').length;

  const bugsOpen = bugs.filter((b) => b.state === 'New' || b.state === 'Active').length;
  const bugsCritical = bugs.filter((b) => b.severity === 'Critical' || b.severity === 'High').length;

  const storyPointsTotal = stories.reduce((sum, s) => sum + (s.storyPoints || 0), 0);
  const storiesActive = stories.filter((s) => s.state === 'Active').length;

  const testCasesPassed = testCases.filter((tc) => tc.state === 'Passed').length;
  const testCasesFailed = testCases.filter((tc) => tc.state === 'Failed').length;
  const testPassRate = testCases.length > 0 ? Math.round((testCasesPassed / testCases.length) * 100) : 0;

  const filteredQueue = useMemo(() => {
    const list = typeFilter === 'All' ? activeItems : activeItems.filter((w) => w.type === typeFilter);
    return [...list].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [activeItems, typeFilter]);

  const deletedEntries = useMemo(() => {
    const wi = state.workItems
      .filter((w) => w.isDeleted)
      .map((w) => ({
        kind: 'workItem' as const,
        id: w.id,
        label: `${w.type} #${w.id}`,
        title: w.title,
        deletedAt: w.deletedAt || w.updatedAt,
      }));
    const docs = state.documents
      .filter((d) => d.isDeleted)
      .map((d) => ({
        kind: 'document' as const,
        id: d.id,
        label: `Document (${d.docType.toUpperCase()})`,
        title: d.name,
        deletedAt: d.deletedAt || d.updatedAt,
      }));
    const notes = state.notes
      .filter((n) => n.isDeleted)
      .map((n) => ({
        kind: 'note' as const,
        id: n.id,
        label: 'QA Note',
        title: n.title,
        deletedAt: n.deletedAt || n.updatedAt,
      }));
    return [...wi, ...docs, ...notes].sort(
      (a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()
    );
  }, [state.workItems, state.documents, state.notes]);

  const activeNotes = useMemo(() => state.notes.filter((n) => !n.isDeleted), [state.notes]);

  const ringRadius = 22;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (testPassRate / 100) * ringCircumference;

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Welcome back, {currentUser?.name || 'Admin'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            QA Vault overview across tasks, bugs, user stories, and test cases.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {state.sprints.length > 0 && (
            <select
              value={sprintFilter}
              onChange={(e) => setSprintFilter(e.target.value)}
              aria-label="Filter dashboard by iteration path"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-teal-600 focus:outline-none"
            >
              <option value="All">All Iterations</option>
              {state.sprints.map((sp) => (
                <option key={sp.id} value={sp.iterationPath}>
                  {sp.name} ({sp.iterationPath})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* 4 KPI Cards: TASK, BUG, USER STORY, TEST CASES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* 1. TASK */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                <CheckSquare className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Task</p>
                <p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {tasks.length}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => openCreateWorkItem({ type: 'Task' })}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              title="Add Task"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 tabular-nums">
            <span>
              {tasksOpen} open · {tasksDone} done
            </span>
            <button
              type="button"
              onClick={() => openCreateWorkItem({ type: 'Task' })}
              className="font-medium text-sky-700 hover:underline"
            >
              + Task
            </button>
          </div>
        </div>

        {/* 2. BUG */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                <Bug className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Bug</p>
                <p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {bugs.length}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => openCreateWorkItem({ type: 'Bug' })}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              title="Report Bug"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 tabular-nums">
            <span>
              {bugsOpen} open · {bugsCritical} high/critical
            </span>
            <button
              type="button"
              onClick={() => openCreateWorkItem({ type: 'Bug' })}
              className="font-medium text-rose-700 hover:underline"
            >
              + Bug
            </button>
          </div>
        </div>

        {/* 3. USER STORY */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">User Story</p>
                <p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {stories.length}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => openCreateWorkItem({ type: 'User Story' })}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              title="Add User Story"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 tabular-nums">
            <span>
              {storiesActive} active · {storyPointsTotal} pts
            </span>
            <button
              type="button"
              onClick={() => setActiveNav('backlogs')}
              className="font-medium text-teal-700 hover:underline"
            >
              View Backlogs
            </button>
          </div>
        </div>

        {/* 4. TEST CASES */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <FlaskConical className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Test Cases</p>
                <p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {testCases.length}
                </p>
              </div>
            </div>

            <div className="relative flex h-12 w-12 items-center justify-center">
              <svg className="h-12 w-12 -rotate-90" viewBox="0 0 52 52">
                <circle
                  cx="26"
                  cy="26"
                  r={ringRadius}
                  fill="none"
                  stroke="#f1f5f9"
                  strokeWidth="4.5"
                />
                <circle
                  cx="26"
                  cy="26"
                  r={ringRadius}
                  fill="none"
                  stroke="#0d9488"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                />
              </svg>
              <span className="absolute text-[11px] font-semibold text-slate-800 tabular-nums">
                {testPassRate}%
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 tabular-nums">
            <span>
              {testCasesPassed} passed · {testCasesFailed} failed
            </span>
            <button
              type="button"
              onClick={() => openCreateWorkItem({ type: 'Test Case' })}
              className="font-medium text-violet-700 hover:underline"
            >
              + Test Case
            </button>
          </div>
        </div>
      </div>

      {/* Main Clean 2-Column Minimalist Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2/3: Work Items Queue */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Work Items</h2>
              <p className="text-xs text-slate-500">Tasks, bugs, user stories, and test cases</p>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              {(['All', 'Task', 'Bug', 'User Story', 'Test Case'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    typeFilter === t
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {filteredQueue.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-medium text-slate-700">No work items yet</p>
              <p className="mt-1 text-xs text-slate-500">
                Create your first Task, Bug, User Story, or Test Case to get started.
              </p>
              <button
                type="button"
                onClick={() => openCreateWorkItem({ type: typeFilter === 'All' ? 'Task' : typeFilter })}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-teal-700"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Work Item
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-medium text-slate-500">
                    <th className="py-2.5 pl-5 pr-3">ID</th>
                    <th className="py-2.5 px-3">Title</th>
                    <th className="py-2.5 px-3">Assigned To</th>
                    <th className="py-2.5 px-3">State</th>
                    <th className="py-2.5 px-3 text-right">Updated</th>
                    <th className="py-2.5 pl-3 pr-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredQueue.slice(0, 10).map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 pl-5 pr-3 font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                        {item.id}
                      </td>
                      <td className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={() => openEditWorkItem(item)}
                          className="flex items-center gap-2 text-left font-medium text-slate-900 hover:text-teal-700"
                        >
                          <WorkItemIcon type={item.type} className="w-4 h-4" />
                          <span className="line-clamp-1">{item.title}</span>
                        </button>
                        <div className="mt-0.5 pl-6 text-xs text-slate-500">
                          {item.type} · {item.iterationPath}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">
                        {item.assignedToName}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${getStateDotColor(item.state)}`} />
                          <select
                            value={item.state}
                            aria-label={`Change state for ${item.title}`}
                            onChange={(e) =>
                              updateWorkItem(item.id, { state: e.target.value as WorkItemState })
                            }
                            className={`bg-transparent text-xs font-medium focus:outline-none cursor-pointer ${getStateTextColor(
                              item.state
                            )}`}
                          >
                            {ALL_STATES.map((s) => (
                              <option key={s} value={s} className="text-slate-900">
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-xs text-slate-400 tabular-nums whitespace-nowrap">
                        {formatTimestamp(item.updatedAt)}
                      </td>
                      <td className="py-2.5 pl-3 pr-5 text-right whitespace-nowrap">
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right 1/3: Recycle Bin Summary Card + QA Notes */}
        <div className="space-y-6">
          {/* Recycle Bin Card on Dashboard */}
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-900">Recycle Bin</h2>
                <span className="font-mono text-xs text-slate-500 tabular-nums">
                  ({deletedEntries.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveNav('recycle-bin')}
                className="text-xs font-medium text-teal-700 hover:underline whitespace-nowrap"
              >
                Open Bin
              </button>
            </div>

            {deletedEntries.length === 0 ? (
              <div className="px-5 py-6 text-center text-xs text-slate-500">
                Recycle Bin is empty. Deleted items can be restored from here.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {deletedEntries.slice(0, 4).map((entry) => (
                  <div
                    key={`${entry.kind}-${entry.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-slate-800">{entry.title}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {entry.label} · {formatTimestamp(entry.deletedAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => restoreItem(entry.kind, entry.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 shrink-0"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* QA Notes Card */}
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">QA Notes</h2>
              <button
                type="button"
                onClick={() => setQuickNoteOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Note
              </button>
            </div>

            {activeNotes.length === 0 ? (
              <div className="px-5 py-6 text-center text-xs text-slate-500">
                No notes yet. Use Add Note to capture QA observations.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {activeNotes.slice(0, 4).map((note) => (
                  <div key={note.id} className="flex items-start justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900">{note.title}</p>
                      <p className="mt-1 text-xs text-slate-600 line-clamp-2">{note.content}</p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {note.author} · {formatTimestamp(note.createdAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => softDeleteNote(note.id)}
                      className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 shrink-0"
                      title="Move Note to Recycle Bin"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
