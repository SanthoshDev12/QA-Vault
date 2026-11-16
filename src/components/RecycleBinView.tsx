import React, { useMemo, useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { useQAVault } from '../store/QAVaultContext';

type BinFilter = 'all' | 'workItem' | 'document' | 'note';

export const RecycleBinView: React.FC = () => {
  const { state, searchQuery, restoreItem, purgeItem, emptyRecycleBin, currentUser } = useQAVault();
  const [filter, setFilter] = useState<BinFilter>('all');
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const deletedRows = useMemo(() => {
    const wi = state.workItems
      .filter((w) => w.isDeleted)
      .map((w) => ({
        kind: 'workItem' as const,
        id: w.id,
        category: w.type,
        title: `#${w.id} · ${w.title}`,
        deletedBy: w.deletedBy || 'Unknown',
        deletedAt: w.deletedAt || w.updatedAt,
      }));
    const docs = state.documents
      .filter((d) => d.isDeleted)
      .map((d) => ({
        kind: 'document' as const,
        id: d.id,
        category: `Document (${d.docType.toUpperCase()})`,
        title: d.name,
        deletedBy: d.deletedBy || 'Unknown',
        deletedAt: d.deletedAt || d.updatedAt,
      }));
    const notes = state.notes
      .filter((n) => n.isDeleted)
      .map((n) => ({
        kind: 'note' as const,
        id: n.id,
        category: 'QA Note',
        title: n.title,
        deletedBy: n.deletedBy || 'Unknown',
        deletedAt: n.deletedAt || n.updatedAt,
      }));

    return [...wi, ...docs, ...notes]
      .filter((row) => {
        if (filter !== 'all' && row.kind !== filter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return row.title.toLowerCase().includes(q) || row.category.toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
  }, [state.workItems, state.documents, state.notes, filter, searchQuery]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Recycle Bin</h1>
          <p className="mt-1 text-sm text-slate-500">
            Recover soft-deleted tasks, bugs, user stories, test cases, documents, and notes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {([
              { id: 'all', label: 'All' },
              { id: 'workItem', label: 'Work Items' },
              { id: 'document', label: 'Documents' },
              { id: 'note', label: 'Notes' },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  filter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {deletedRows.length > 0 && currentUser?.role === 'Admin' && (
            confirmEmpty ? (
              <div className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs">
                <span className="font-medium text-rose-800">Permanently empty bin?</span>
                <button
                  type="button"
                  onClick={async () => {
                    await emptyRecycleBin();
                    setConfirmEmpty(false);
                  }}
                  className="font-semibold text-rose-700 hover:underline"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmEmpty(false)}
                  className="text-slate-600 hover:underline"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmEmpty(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Empty Bin
              </button>
            )
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {deletedRows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Trash2 className="mx-auto w-7 h-7 text-slate-300" />
            <p className="mt-2 text-sm font-medium text-slate-700">Recycle Bin is empty</p>
            <p className="mt-1 text-xs text-slate-500">
              Any deleted Task, Bug, User Story, Test Case, Document, or Note will appear here for restoration.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 pl-5 pr-3">Item</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Deleted By</th>
                  <th className="py-3 px-3">Deleted Time</th>
                  <th className="py-3 pl-3 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {deletedRows.map((row) => (
                  <tr key={`${row.kind}-${row.id}`} className="hover:bg-slate-50/80">
                    <td className="py-3 pl-5 pr-3 font-medium text-slate-900">{row.title}</td>
                    <td className="py-3 px-3 text-xs text-slate-600">{row.category}</td>
                    <td className="py-3 px-3 text-xs text-slate-600">{row.deletedBy}</td>
                    <td className="py-3 px-3 font-mono text-xs text-slate-500 tabular-nums">
                      {new Date(row.deletedAt).toLocaleString()}
                    </td>
                    <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => restoreItem(row.kind, row.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Restore
                        </button>
                        <button
                          type="button"
                          onClick={() => purgeItem(row.kind, row.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                        >
                          Delete Forever
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
