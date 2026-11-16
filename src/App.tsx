import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  CalendarRange,
  FileText,
  Layers,
  LayoutDashboard,
  Menu,
  NotebookPen,
  Plus,
  Search,
  Settings,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import { ActivitiesView } from './components/ActivitiesView';
import { BacklogsView } from './components/BacklogsView';
import { DashboardView } from './components/DashboardView';
import { DocumentsView } from './components/DocumentsView';
import { QuickActivityModal, QuickNoteModal } from './components/QuickModals';
import { RecycleBinView } from './components/RecycleBinView';
import { SettingsView } from './components/SettingsView';
import { SprintView } from './components/SprintView';
import { WorkItemModal } from './components/WorkItemModal';
import { QAVaultProvider, useQAVault } from './store/QAVaultContext';
import type { NavSection } from './types/qa';

const QAVaultShell: React.FC = () => {
  const {
    state,
    activeNav,
    setActiveNav,
    searchQuery,
    setSearchQuery,
    currentUser,
    openCreateWorkItem,
    setQuickActivityOpen,
    setQuickNoteOpen,
  } = useQAVault();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const recycleCount = useMemo(() => {
    return (
      state.workItems.filter((w) => w.isDeleted).length +
      state.documents.filter((d) => d.isDeleted).length +
      state.notes.filter((n) => n.isDeleted).length
    );
  }, [state.workItems, state.documents, state.notes]);

  const navItems: Array<{
    id: NavSection;
    label: string;
    icon: React.ReactNode;
    badge?: number;
    hasAddButton?: boolean;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'backlogs', label: 'Backlogs', icon: <Layers className="w-4 h-4" />, hasAddButton: true },
    { id: 'sprint', label: 'Sprint', icon: <CalendarRange className="w-4 h-4" /> },
    { id: 'activities', label: 'Activities', icon: <Activity className="w-4 h-4" /> },
    { id: 'documents', label: 'Documents', icon: <FileText className="w-4 h-4" /> },
    { id: 'recycle-bin', label: 'Recycle Bin', icon: <Trash2 className="w-4 h-4" />, badge: recycleCount },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  const handleNavClick = (id: NavSection) => {
    setActiveNav(id);
    setMobileMenuOpen(false);
  };

  const SidebarContent = (
    <div className="flex h-full flex-col bg-slate-950 text-slate-200 select-none">
      {/* Brand Header: QA Vault */}
      <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-white">
            <Shield className="w-4 h-4" />
          </div>
          <span className="font-display text-base font-bold tracking-tight text-white whitespace-nowrap">
            QA Vault
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden rounded p-1 text-slate-400 hover:text-white"
          aria-label="Close navigation"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = activeNav === item.id;
          return (
            <div key={item.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`flex flex-1 items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  {item.icon}
                  <span>{item.label}</span>
                </span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span
                    className={`font-mono text-xs tabular-nums ${
                      isActive ? 'text-teal-50' : 'text-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>

              {item.hasAddButton && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveNav('backlogs');
                    openCreateWorkItem({ type: 'User Story' });
                  }}
                  title="Add to Backlogs"
                  className="flex h-9 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:border-teal-500 hover:text-white shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </nav>

      {/* Quick Actions (Minimalist, only kept actions) */}
      <div className="border-t border-slate-800/80 px-3 py-4 space-y-1">
        <div className="flex items-center justify-between px-3 pb-1.5">
          <span className="text-xs font-semibold text-slate-400">Quick Actions</span>
          <button
            type="button"
            onClick={() => openCreateWorkItem({ type: 'Task' })}
            className="text-slate-400 hover:text-white"
            title="New Work Item"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => openCreateWorkItem({ type: 'Task' })}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-900 hover:text-white transition-colors"
        >
          <Plus className="w-3.5 h-3.5 text-teal-400" />
          <span>New Work Item</span>
        </button>

        <button
          type="button"
          onClick={() => setQuickActivityOpen(true)}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-900 hover:text-white transition-colors"
        >
          <Activity className="w-3.5 h-3.5 text-slate-400" />
          <span>Log Activity</span>
        </button>

        <button
          type="button"
          onClick={() => setQuickNoteOpen(true)}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-900 hover:text-white transition-colors"
        >
          <NotebookPen className="w-3.5 h-3.5 text-slate-400" />
          <span>Add Note</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-slate-200">
        <div className="sticky top-0 h-screen">{SidebarContent}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="w-64 h-full">{SidebarContent}</div>
          <div
            className="flex-1 bg-slate-950/40"
            onClick={() => setMobileMenuOpen(false)}
          />
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Minimalist Top Bar (Search + Quick Create + User Profile; removed Phone, Bell, Mail) */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                ref={searchRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks, bugs, stories, documents..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-12 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none"
              />
              <span className="pointer-events-none hidden sm:inline-block absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                ⌘K
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => openCreateWorkItem({ type: 'Task' })}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 text-xs font-semibold text-white hover:bg-teal-700 whitespace-nowrap"
              title="Create Task, Bug, User Story, or Test Case"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Create</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveNav('settings')}
              className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 hover:bg-slate-50"
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white shrink-0"
                style={{ backgroundColor: currentUser?.avatarColor || '#64748b' }}
              >
                {currentUser?.initials || 'GS'}
              </span>
              <div className="hidden sm:block text-left leading-tight">
                <p className="text-xs font-semibold text-slate-900 whitespace-nowrap">
                  {currentUser ? currentUser.name : 'Sign In'}
                </p>
                <p className="text-[11px] text-slate-500 whitespace-nowrap">
                  {currentUser ? currentUser.role : 'Guest'}
                </p>
              </div>
            </button>
          </div>
        </header>

        {/* Active Page Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {activeNav === 'dashboard' && <DashboardView />}
          {activeNav === 'backlogs' && <BacklogsView />}
          {activeNav === 'sprint' && <SprintView />}
          {activeNav === 'activities' && <ActivitiesView />}
          {activeNav === 'documents' && <DocumentsView />}
          {activeNav === 'recycle-bin' && <RecycleBinView />}
          {activeNav === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Global Modals */}
      <WorkItemModal />
      <QuickNoteModal />
      <QuickActivityModal />
    </div>
  );
};

export default function App() {
  return (
    <QAVaultProvider>
      <QAVaultShell />
    </QAVaultProvider>
  );
}
