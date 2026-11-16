import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Minus, Plus, Trash2 } from 'lucide-react';
import { useQAVault } from '../store/QAVaultContext';
import type { WorkItem, WorkItemState, WorkItemType } from '../types/qa';
import { getStateDotColor, getStateTextColor, WorkItemIcon } from './WorkItemIcon';

const ALL_STATES: WorkItemState[] = ['New', 'Active', 'Resolved', 'Closed', 'Passed', 'Failed'];

export const BacklogsView: React.FC = () => {
  const {
    state,
    searchQuery,
    openCreateWorkItem,
    openEditWorkItem,
    updateWorkItem,
    softDeleteWorkItem,
  } = useQAVault();

  const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({});
  const [filterType, setFilterType] = useState<'All' | WorkItemType>('All');
  const [filterIteration, setFilterIteration] = useState<string>('All');

  const activeItems = useMemo(() => {
    return state.workItems
      .filter((item) => {
        if (item.isDeleted) return false;
        if (filterIteration !== 'All' && item.iterationPath !== filterIteration) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            item.title.toLowerCase().includes(q) ||
            String(item.id).includes(q) ||
            item.tags.some((t) => t.toLowerCase().includes(q)) ||
            item.iterationPath.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => a.order - b.order);
  }, [state.workItems, filterIteration, searchQuery]);

  // Top-level backlog items (User Stories or standalone items without parent)
  const topLevelItems = useMemo(() => {
    const parents = activeItems.filter((item) => item.parentId === null);
    if (filterType === 'All') return parents;
    return activeItems.filter((item) => item.type === filterType);
  }, [activeItems, filterType]);

  const childrenMap = useMemo(() => {
    const map = new Map<number, WorkItem[]>();
    for (const item of activeItems) {
      if (item.parentId !== null) {
        const list = map.get(item.parentId) || [];
        list.push(item);
        map.set(item.parentId, list);
      }
    }
    return map;
  }, [activeItems]);

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    const next: Record<number, boolean> = {};
    topLevelItems.forEach((item) => {
      next[item.id] = true;
    });
    setExpandedIds(next);
  };

  const collapseAll = () => {
    setExpandedIds({});
  };

  const renderRow = (item: WorkItem, index: number, isChild = false) => {
    const children = childrenMap.get(item.id) || [];
    const isExpanded = !!expandedIds[item.id];

    return (
      <React.Fragment key={item.id}>
        <tr className={`border-b border-slate-100 hover:bg-slate-50/80 transition-colors ${isChild ? 'bg-slate-50/40' : 'bg-white'}`}>
          {/* + / - Expand & Quick Add Child */}
          <td className="py-2.5 pl-4 pr-2 whitespace-nowrap w-24">
            <div className="flex items-center gap-1">
              {!isChild && (
                <button
                  type="button"
                  onClick={() => openCreateWorkItem({ type: 'Task', parentId: item.id, iterationPath: item.iterationPath })}
                  className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:border-teal-600 hover:text-teal-700"
                  title="Add child Task / Bug / Test Case"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
              {!isChild && children.length > 0 ? (
                <button
                  type="button"
                  onClick={() => toggleExpand(item.id)}
                  className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                  title={isExpanded ? 'Collapse child items' : 'Expand child items'}
                >
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              ) : (
                <span className="inline-block w-6" />
              )}
            </div>
          </td>

          {/* Order */}
          <td className="py-2.5 px-3 text-xs text-slate-500 tabular-nums whitespace-nowrap">
            {isChild ? '' : index + 1}
          </td>

          {/* Work Item Type */}
          <td className="py-2.5 px-3 text-xs font-medium text-slate-700 whitespace-nowrap">
            {item.type}
          </td>

          {/* Title */}
          <td className="py-2.5 px-3 min-w-[260px]">
            <div className={`flex items-center gap-2 ${isChild ? 'pl-6' : ''}`}>
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

          {/* State */}
          <td className="py-2.5 px-3 whitespace-nowrap">
            <div className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${getStateDotColor(item.state)}`} />
              <select
                value={item.state}
                aria-label={`State for ${item.title}`}
                onChange={(e) => updateWorkItem(item.id, { state: e.target.value as WorkItemState })}
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

          {/* Story Points */}
          <td className="py-2.5 px-3 text-xs text-slate-600 tabular-nums whitespace-nowrap">
            {item.storyPoints !== null ? item.storyPoints : '—'}
          </td>

          {/* Value Area */}
          <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">{item.valueArea}</td>

          {/* Iteration Path */}
          <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">{item.iterationPath}</td>

          {/* Tags */}
          <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">
            {item.tags.length > 0 ? item.tags.join(' · ') : '—'}
          </td>

          {/* Actions */}
          <td className="py-2.5 pl-3 pr-4 text-right whitespace-nowrap">
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

        {!isChild &&
          filterType === 'All' &&
          isExpanded &&
          children.map((child, cIdx) => renderRow(child, cIdx, true))}
      </React.Fragment>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Backlogs</h1>
          <p className="mt-1 text-sm text-slate-500">
            Prioritize user stories, break down tasks, track bugs, and link test cases.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-slate-200 bg-white">
            <button
              type="button"
              onClick={expandAll}
              className="flex items-center gap-1 border-r border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              title="Expand all"
            >
              <Plus className="w-3.5 h-3.5" />
              Expand
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              title="Collapse all"
            >
              <Minus className="w-3.5 h-3.5" />
              Collapse
            </button>
          </div>

          <select
            value={filterIteration}
            onChange={(e) => setFilterIteration(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-teal-600 focus:outline-none"
          >
            <option value="All">All Iterations</option>
            {state.sprints.map((sp) => (
              <option key={sp.id} value={sp.iterationPath}>
                {sp.iterationPath}
              </option>
            ))}
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'All' | WorkItemType)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-teal-600 focus:outline-none"
          >
            <option value="All">Hierarchy View</option>
            <option value="User Story">User Stories</option>
            <option value="Task">Tasks</option>
            <option value="Bug">Bugs</option>
            <option value="Test Case">Test Cases</option>
          </select>

          <button
            type="button"
            onClick={() => openCreateWorkItem({ type: 'User Story' })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            New Work Item
          </button>
        </div>
      </div>

      {/* Azure DevOps-inspired Clean Backlog Grid */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <th className="py-3 pl-4 pr-2">
                  <div className="flex items-center gap-1">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-300 bg-white text-slate-600">
                      +
                    </span>
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-300 bg-white text-slate-600">
                      -
                    </span>
                  </div>
                </th>
                <th className="py-3 px-3">Order</th>
                <th className="py-3 px-3">Work Item Type</th>
                <th className="py-3 px-3">Title</th>
                <th className="py-3 px-3">State</th>
                <th className="py-3 px-3">Story Points</th>
                <th className="py-3 px-3">Value Area</th>
                <th className="py-3 px-3">Iteration Path</th>
                <th className="py-3 px-3">Tags</th>
                <th className="py-3 pl-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {topLevelItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-sm text-slate-500">
                    No backlog items found. Click &ldquo;New Work Item&rdquo; to add a User Story, Task, Bug, or Test Case.
                  </td>
                </tr>
              ) : (
                topLevelItems.map((item, idx) => renderRow(item, idx, false))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
