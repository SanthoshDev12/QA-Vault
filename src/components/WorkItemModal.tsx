import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useQAVault } from '../store/QAVaultContext';
import type { ValueArea, WorkItemPriority, WorkItemState, WorkItemType } from '../types/qa';
import { WorkItemIcon } from './WorkItemIcon';

const WORK_TYPES: WorkItemType[] = ['Task', 'Bug', 'User Story', 'Test Case'];
const STATES: WorkItemState[] = ['New', 'Active', 'Resolved', 'Closed', 'Passed', 'Failed'];
const PRIORITIES: WorkItemPriority[] = ['Low', 'Medium', 'High', 'Critical'];
const VALUE_AREAS: ValueArea[] = ['Business', 'Architectural', 'QA'];

export const WorkItemModal: React.FC = () => {
  const { workItemModal, closeWorkItemModal, createWorkItem, updateWorkItem, state } = useQAVault();
  const { open, mode, item } = workItemModal;

  const [type, setType] = useState<WorkItemType>('Task');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [itemState, setItemState] = useState<WorkItemState>('New');
  const [priority, setPriority] = useState<WorkItemPriority>('Medium');
  const [severity, setSeverity] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
  const [storyPoints, setStoryPoints] = useState<string>('');
  const [valueArea, setValueArea] = useState<ValueArea>('Business');
  const [iterationPath, setIterationPath] = useState('UAT - Tulliam');
  const [areaPath, setAreaPath] = useState('UAT - Tulliam');
  const [assignedToId, setAssignedToId] = useState<string>('');
  const [parentId, setParentId] = useState<string>('');
  const [tagsText, setTagsText] = useState('');
  const [testSteps, setTestSteps] = useState('');
  const [expectedResult, setExpectedResult] = useState('');
  const [reproSteps, setReproSteps] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && item) {
      setType(item.type);
      setTitle(item.title);
      setDescription(item.description);
      setItemState(item.state);
      setPriority(item.priority);
      setSeverity(item.severity || 'Medium');
      setStoryPoints(item.storyPoints !== null ? String(item.storyPoints) : '');
      setValueArea(item.valueArea);
      setIterationPath(item.iterationPath);
      setAreaPath(item.areaPath);
      setAssignedToId(item.assignedToId || '');
      setParentId(item.parentId !== null ? String(item.parentId) : '');
      setTagsText(item.tags.join(', '));
      setTestSteps(item.testSteps || '');
      setExpectedResult(item.expectedResult || '');
      setReproSteps(item.reproSteps || '');
    } else {
      const t = workItemModal.initialType || 'Task';
      setType(t);
      setTitle('');
      setDescription('');
      setItemState('New');
      setPriority('Medium');
      setSeverity('Medium');
      setStoryPoints(t === 'User Story' ? '3' : '');
      setValueArea(t === 'Test Case' ? 'QA' : 'Business');
      setIterationPath(workItemModal.defaultIterationPath || state.sprints[0]?.iterationPath || 'Backlog');
      setAreaPath(workItemModal.defaultIterationPath || state.sprints[0]?.iterationPath || 'QA Vault');
      setAssignedToId(state.users[0]?.id || '');
      setParentId(workItemModal.parentId ? String(workItemModal.parentId) : '');
      setTagsText('');
      setTestSteps('');
      setExpectedResult('');
      setReproSteps('');
    }
  }, [open, mode, item, workItemModal, state.users]);

  if (!open) return null;

  const userStories = state.workItems.filter((w) => !w.isDeleted && w.type === 'User Story' && w.id !== item?.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    const assignedUser = state.users.find((u) => u.id === assignedToId);
    const tags = tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      type,
      title: title.trim(),
      description: description.trim(),
      state: itemState,
      priority,
      severity: type === 'Bug' ? severity : undefined,
      storyPoints: storyPoints.trim() ? Number(storyPoints) : null,
      valueArea,
      iterationPath: iterationPath.trim() || 'UAT - Tulliam',
      areaPath: areaPath.trim() || 'UAT - Tulliam',
      assignedToId: assignedUser ? assignedUser.id : null,
      assignedToName: assignedUser ? assignedUser.name : 'Unassigned',
      parentId: parentId ? Number(parentId) : null,
      tags,
      testSteps: type === 'Test Case' ? testSteps : undefined,
      expectedResult: type === 'Test Case' ? expectedResult : undefined,
      reproSteps: type === 'Bug' ? reproSteps : undefined,
    };

    try {
      if (mode === 'edit' && item) {
        await updateWorkItem(item.id, payload);
      } else {
        await createWorkItem(payload);
      }
      closeWorkItemModal();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[1px]">
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <WorkItemIcon type={type} className="w-5 h-5" />
            <h2 className="text-base font-semibold text-slate-900">
              {mode === 'edit' && item ? `Edit ${item.type} #${item.id}` : `New ${type}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={closeWorkItemModal}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto px-6 py-5 space-y-4">
          {/* Type selector */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Work Item Type</label>
            <div className="grid grid-cols-4 gap-2">
              {WORK_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                    type === t
                      ? 'border-teal-600 bg-teal-50 text-teal-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <WorkItemIcon type={t} className="w-3.5 h-3.5" />
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Enter ${type.toLowerCase()} title...`}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
            />
          </div>

          {/* Row: State, Assigned To, Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">State</label>
              <select
                value={itemState}
                onChange={(e) => setItemState(e.target.value as WorkItemState)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              >
                {STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Assigned To</label>
              <select
                value={assignedToId}
                onChange={(e) => setAssignedToId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              >
                <option value="">Unassigned</option>
                {state.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as WorkItemPriority)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row: Iteration Path, Area Path, Value Area, Story Points */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Iteration Path</label>
              <select
                value={iterationPath}
                onChange={(e) => setIterationPath(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              >
                {state.sprints.map((sp) => (
                  <option key={sp.id} value={sp.iterationPath}>
                    {sp.iterationPath}
                  </option>
                ))}
                <option value="Backlog">Backlog</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Area Path</label>
              <input
                type="text"
                value={areaPath}
                onChange={(e) => setAreaPath(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Value Area</label>
              <select
                value={valueArea}
                onChange={(e) => setValueArea(e.target.value as ValueArea)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              >
                {VALUE_AREAS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Story Points</label>
              <input
                type="number"
                min={0}
                max={100}
                value={storyPoints}
                onChange={(e) => setStoryPoints(e.target.value)}
                placeholder="-"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>
          </div>

          {type !== 'User Story' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Parent User Story (Backlog Hierarchy)</label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              >
                <option value="">None (Top-level item)</option>
                {userStories.map((us) => (
                  <option key={us.id} value={us.id}>
                    #{us.id} - {us.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Acceptance criteria or technical details..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
            />
          </div>

          {type === 'Test Case' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Test Steps</label>
                <textarea
                  rows={3}
                  value={testSteps}
                  onChange={(e) => setTestSteps(e.target.value)}
                  placeholder="1. Open page&#10;2. Click action..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Expected Result</label>
                <textarea
                  rows={3}
                  value={expectedResult}
                  onChange={(e) => setExpectedResult(e.target.value)}
                  placeholder="Expected validation outcome..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                />
              </div>
            </div>
          )}

          {type === 'Bug' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Bug Severity</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as 'Low' | 'Medium' | 'High' | 'Critical')}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Reproduction Steps</label>
                <textarea
                  rows={2}
                  value={reproSteps}
                  onChange={(e) => setReproSteps(e.target.value)}
                  placeholder="Steps to reproduce defect..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tags (comma separated)</label>
            <input
              type="text"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="UAT, Regression, Security"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={closeWorkItemModal}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : mode === 'edit' ? 'Save Changes' : `Create ${type}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
