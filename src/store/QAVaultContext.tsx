import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type {
  ActivityLog,
  NavSection,
  QADocument,
  QAVaultDatabaseState,
  Sprint,
  WorkItem,
  WorkItemType,
} from '../types/qa';

interface SessionUser {
  id: string;
  username: string;
  name: string;
  email: string;
  role: 'Admin' | 'Manager';
  initials: string;
  avatarColor: string;
}

interface WorkItemModalRequest {
  open: boolean;
  mode: 'create' | 'edit';
  initialType?: WorkItemType;
  parentId?: number | null;
  defaultIterationPath?: string;
  item?: WorkItem | null;
}

interface QAVaultContextValue {
  state: QAVaultDatabaseState;
  loading: boolean;
  activeNav: NavSection;
  setActiveNav: (nav: NavSection) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  currentUser: SessionUser | null;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  addUser: (payload: {
    name: string;
    username: string;
    email: string;
    password: string;
    role: 'Admin' | 'Manager';
  }) => Promise<{ ok: boolean; error?: string }>;
  deleteUser: (id: string) => Promise<{ ok: boolean; error?: string }>;
  createWorkItem: (item: Partial<WorkItem>) => Promise<WorkItem | null>;
  updateWorkItem: (id: number, updates: Partial<WorkItem>) => Promise<void>;
  softDeleteWorkItem: (id: number) => Promise<void>;
  createSprint: (sprint: Partial<Sprint>) => Promise<void>;
  uploadDocument: (doc: Partial<QADocument>) => Promise<QADocument | null>;
  updateDocument: (id: string, updates: Partial<QADocument>) => Promise<void>;
  softDeleteDocument: (id: string) => Promise<void>;
  createNote: (title: string, content: string) => Promise<void>;
  softDeleteNote: (id: string) => Promise<void>;
  logActivity: (action: string, targetType: ActivityLog['targetType'], targetTitle: string) => Promise<void>;
  restoreItem: (kind: 'workItem' | 'document' | 'note', id: string | number) => Promise<void>;
  purgeItem: (kind: 'workItem' | 'document' | 'note', id: string | number) => Promise<void>;
  emptyRecycleBin: () => Promise<void>;
  workItemModal: WorkItemModalRequest;
  openCreateWorkItem: (opts?: {
    type?: WorkItemType;
    parentId?: number | null;
    iterationPath?: string;
  }) => void;
  openEditWorkItem: (item: WorkItem) => void;
  closeWorkItemModal: () => void;
  quickNoteOpen: boolean;
  setQuickNoteOpen: (v: boolean) => void;
  quickActivityOpen: boolean;
  setQuickActivityOpen: (v: boolean) => void;
}

const SESSION_KEY = 'qa_vault_session_user_v2';

const emptyState: QAVaultDatabaseState = {
  users: [],
  sprints: [],
  workItems: [],
  documents: [],
  activities: [],
  notes: [],
  nextWorkItemId: 1,
};

const defaultAdminUser: SessionUser = {
  id: 'usr-admin',
  username: 'Admin',
  name: 'Admin',
  email: 'admin@qavault.local',
  role: 'Admin',
  initials: 'AD',
  avatarColor: '#0F172A',
};

const QAVaultContext = createContext<QAVaultContextValue | null>(null);

export const QAVaultProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<QAVaultDatabaseState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [activeNav, setActiveNav] = useState<NavSection>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);
  const [quickActivityOpen, setQuickActivityOpen] = useState(false);

  const [currentUser, setCurrentUser] = useState<SessionUser | null>(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) return JSON.parse(saved) as SessionUser;
    } catch {
      // ignore
    }
    return defaultAdminUser;
  });

  const [workItemModal, setWorkItemModal] = useState<WorkItemModalRequest>({
    open: false,
    mode: 'create',
  });

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = (await res.json()) as QAVaultDatabaseState;
        setState(data);
      }
    } catch (err) {
      console.error('Failed to fetch QA Vault state:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const actorName = currentUser?.name || 'Admin';

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error || 'Authentication failed.' };
      }
      setCurrentUser(data.user);
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
      } catch {
        // ignore
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error during sign in.' };
    }
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  }, []);

  const addUser = useCallback(
    async (payload: { name: string; username: string; email: string; password: string; role: 'Admin' | 'Manager' }) => {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          actorName,
          actorRole: currentUser?.role,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error || 'Failed to add user.' };
      }
      if (data.state) setState(data.state);
      return { ok: true };
    },
    [actorName, currentUser?.role]
  );

  const deleteUser = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorName, actorRole: currentUser?.role }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error || 'Failed to delete user.' };
      }
      if (data.state) setState(data.state);
      return { ok: true };
    },
    [actorName, currentUser?.role]
  );

  const createWorkItem = useCallback(
    async (item: Partial<WorkItem>): Promise<WorkItem | null> => {
      const res = await fetch('/api/work-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item, actorName }),
      });
      const data = await res.json();
      if (res.ok && data.state) {
        setState(data.state);
        return data.workItem as WorkItem;
      }
      return null;
    },
    [actorName]
  );

  const updateWorkItem = useCallback(
    async (id: number, updates: Partial<WorkItem>) => {
      const res = await fetch(`/api/work-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates, actorName }),
      });
      const data = await res.json();
      if (res.ok && data.state) {
        setState(data.state);
      }
    },
    [actorName]
  );

  const softDeleteWorkItem = useCallback(
    async (id: number) => {
      const res = await fetch(`/api/work-items/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorName }),
      });
      const data = await res.json();
      if (res.ok && data.state) {
        setState(data.state);
      }
    },
    [actorName]
  );

  const createSprint = useCallback(
    async (sprint: Partial<Sprint>) => {
      const res = await fetch('/api/sprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sprint, actorName }),
      });
      const data = await res.json();
      if (res.ok && data.state) {
        setState(data.state);
      }
    },
    [actorName]
  );

  const uploadDocument = useCallback(
    async (doc: Partial<QADocument>): Promise<QADocument | null> => {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc, actorName }),
      });
      const data = await res.json();
      if (res.ok && data.state) {
        setState(data.state);
        return data.document as QADocument;
      }
      return null;
    },
    [actorName]
  );

  const updateDocument = useCallback(
    async (id: string, updates: Partial<QADocument>) => {
      const res = await fetch(`/api/documents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates, actorName }),
      });
      const data = await res.json();
      if (res.ok && data.state) {
        setState(data.state);
      }
    },
    [actorName]
  );

  const softDeleteDocument = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorName }),
      });
      const data = await res.json();
      if (res.ok && data.state) {
        setState(data.state);
      }
    },
    [actorName]
  );

  const createNote = useCallback(
    async (title: string, content: string) => {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, actorName }),
      });
      const data = await res.json();
      if (res.ok && data.state) {
        setState(data.state);
      }
    },
    [actorName]
  );

  const softDeleteNote = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/notes/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorName }),
      });
      const data = await res.json();
      if (res.ok && data.state) {
        setState(data.state);
      }
    },
    [actorName]
  );

  const logActivity = useCallback(
    async (action: string, targetType: ActivityLog['targetType'], targetTitle: string) => {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorName, action, targetType, targetTitle }),
      });
      const data = await res.json();
      if (res.ok && data.state) {
        setState(data.state);
      }
    },
    [actorName]
  );

  const restoreItem = useCallback(
    async (kind: 'workItem' | 'document' | 'note', id: string | number) => {
      const res = await fetch('/api/recycle-bin/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, id, actorName }),
      });
      const data = await res.json();
      if (res.ok && data.state) {
        setState(data.state);
      }
    },
    [actorName]
  );

  const purgeItem = useCallback(
    async (kind: 'workItem' | 'document' | 'note', id: string | number) => {
      const res = await fetch('/api/recycle-bin/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, id, actorName }),
      });
      const data = await res.json();
      if (res.ok && data.state) {
        setState(data.state);
      }
    },
    [actorName]
  );

  const emptyRecycleBin = useCallback(async () => {
    const res = await fetch('/api/recycle-bin/empty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorName }),
    });
    const data = await res.json();
    if (res.ok && data.state) {
      setState(data.state);
    }
  }, [actorName]);

  const openCreateWorkItem = useCallback(
    (opts?: { type?: WorkItemType; parentId?: number | null; iterationPath?: string }) => {
      setWorkItemModal({
        open: true,
        mode: 'create',
        initialType: opts?.type || 'Task',
        parentId: opts?.parentId ?? null,
        defaultIterationPath: opts?.iterationPath || state.sprints[0]?.iterationPath || 'Backlog',
        item: null,
      });
    },
    [state.sprints]
  );

  const openEditWorkItem = useCallback((item: WorkItem) => {
    setWorkItemModal({
      open: true,
      mode: 'edit',
      item,
    });
  }, []);

  const closeWorkItemModal = useCallback(() => {
    setWorkItemModal((prev) => ({ ...prev, open: false }));
  }, []);

  const value = useMemo<QAVaultContextValue>(
    () => ({
      state,
      loading,
      activeNav,
      setActiveNav,
      searchQuery,
      setSearchQuery,
      currentUser,
      login,
      logout,
      addUser,
      deleteUser,
      createWorkItem,
      updateWorkItem,
      softDeleteWorkItem,
      createSprint,
      uploadDocument,
      updateDocument,
      softDeleteDocument,
      createNote,
      softDeleteNote,
      logActivity,
      restoreItem,
      purgeItem,
      emptyRecycleBin,
      workItemModal,
      openCreateWorkItem,
      openEditWorkItem,
      closeWorkItemModal,
      quickNoteOpen,
      setQuickNoteOpen,
      quickActivityOpen,
      setQuickActivityOpen,
    }),
    [
      state,
      loading,
      activeNav,
      searchQuery,
      currentUser,
      login,
      logout,
      addUser,
      deleteUser,
      createWorkItem,
      updateWorkItem,
      softDeleteWorkItem,
      createSprint,
      uploadDocument,
      updateDocument,
      softDeleteDocument,
      createNote,
      softDeleteNote,
      logActivity,
      restoreItem,
      purgeItem,
      emptyRecycleBin,
      workItemModal,
      openCreateWorkItem,
      openEditWorkItem,
      closeWorkItemModal,
      quickNoteOpen,
      quickActivityOpen,
    ]
  );

  return <QAVaultContext.Provider value={value}>{children}</QAVaultContext.Provider>;
};

export function useQAVault() {
  const ctx = useContext(QAVaultContext);
  if (!ctx) throw new Error('useQAVault must be used inside QAVaultProvider');
  return ctx;
}
