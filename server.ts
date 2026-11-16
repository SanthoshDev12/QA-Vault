import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import type {
  ActivityLog,
  QADocument,
  QANote,
  QAUser,
  QAVaultDatabaseState,
  Sprint,
  WorkItem,
} from './src/types/qa.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '.qavault-data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function createCleanSeedState(): QAVaultDatabaseState {
  const now = new Date().toISOString();

  const users: QAUser[] = [
    {
      id: 'usr-admin',
      username: 'Admin',
      name: 'Admin',
      email: 'admin@qavault.local',
      password: 'QA_VAULT@123',
      role: 'Admin',
      initials: 'AD',
      avatarColor: '#0F172A',
      createdAt: now,
    },
  ];

  return {
    users,
    sprints: [],
    workItems: [],
    documents: [],
    activities: [],
    notes: [],
    nextWorkItemId: 1,
  };
}

let dbCache: QAVaultDatabaseState | null = null;

function ensureDb(): QAVaultDatabaseState {
  if (dbCache) return dbCache;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      dbCache = JSON.parse(raw) as QAVaultDatabaseState;
      return dbCache;
    } catch {
      // fall through to re-seed
    }
  }
  dbCache = createCleanSeedState();
  saveDb(dbCache);
  return dbCache;
}

function saveDb(state: QAVaultDatabaseState) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

function sanitizeUsers(users: QAUser[]): Omit<QAUser, 'password'>[] {
  return users.map(({ password: _pw, ...rest }) => rest);
}

function sanitizeState(state: QAVaultDatabaseState) {
  return {
    ...state,
    users: sanitizeUsers(state.users),
  };
}

function addActivity(
  state: QAVaultDatabaseState,
  actor: string,
  action: string,
  targetType: ActivityLog['targetType'],
  targetTitle: string
) {
  const entry: ActivityLog = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    actor,
    action,
    targetType,
    targetTitle,
    timestamp: new Date().toISOString(),
  };
  state.activities.unshift(entry);
  if (state.activities.length > 200) {
    state.activities = state.activities.slice(0, 200);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // Get full workspace state
  app.get('/api/state', (_req, res) => {
    const state = ensureDb();
    res.json(sanitizeState(state));
  });

  // Login
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }
    const state = ensureDb();
    const matched = state.users.find(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password
    );
    if (!matched) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }
    addActivity(state, matched.name, 'signed in to QA Vault', 'User', `${matched.name} (${matched.role})`);
    saveDb(state);
    const { password: _pw, ...safeUser } = matched;
    res.json({ user: safeUser });
  });

  // Add User (Admin only)
  app.post('/api/users', (req, res) => {
    const { name, username, email, password, role, actorName, actorRole } = req.body as {
      name?: string;
      username?: string;
      email?: string;
      password?: string;
      role?: 'Admin' | 'Manager';
      actorName?: string;
      actorRole?: string;
    };
    if (actorRole !== 'Admin') {
      return res.status(403).json({ error: 'Only Admin users can add new users.' });
    }
    if (!name?.trim() || !username?.trim() || !password?.trim() || !role) {
      return res.status(400).json({ error: 'Name, username, password, and role are required.' });
    }
    const state = ensureDb();
    const exists = state.users.some((u) => u.username.toLowerCase() === username.trim().toLowerCase());
    if (exists) {
      return res.status(409).json({ error: 'A user with this username already exists.' });
    }
    const parts = name.trim().split(/\s+/);
    const initials =
      parts.length >= 2
        ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
        : name.trim().slice(0, 2).toUpperCase();
    const palette = ['#0D9488', '#0284C7', '#7C3AED', '#D97706', '#059669', '#334155'];
    const avatarColor = palette[state.users.length % palette.length];

    const newUser: QAUser = {
      id: `usr-${Date.now()}`,
      username: username.trim(),
      name: name.trim(),
      email: (email || `${username.trim()}@qavault.local`).trim(),
      password,
      role: role === 'Manager' ? 'Manager' : 'Admin',
      initials,
      avatarColor,
      createdAt: new Date().toISOString(),
    };
    state.users.push(newUser);
    addActivity(state, actorName || 'Admin', `added ${newUser.role} user`, 'User', `${newUser.name} (@${newUser.username})`);
    saveDb(state);
    const { password: _pw, ...safeUser } = newUser;
    res.status(201).json({ user: safeUser, state: sanitizeState(state) });
  });

  // Delete User (Admin only, cannot delete root Admin)
  app.delete('/api/users/:id', (req, res) => {
    const { actorName, actorRole } = req.body as { actorName?: string; actorRole?: string };
    if (actorRole !== 'Admin') {
      return res.status(403).json({ error: 'Only Admin users can remove users.' });
    }
    const state = ensureDb();
    if (req.params.id === 'usr-admin') {
      return res.status(400).json({ error: 'Default Admin account cannot be removed.' });
    }
    const target = state.users.find((u) => u.id === req.params.id);
    if (!target) {
      return res.status(404).json({ error: 'User not found.' });
    }
    state.users = state.users.filter((u) => u.id !== req.params.id);
    addActivity(state, actorName || 'Admin', 'removed user account', 'User', target.name);
    saveDb(state);
    res.json({ state: sanitizeState(state) });
  });

  // Create Work Item
  app.post('/api/work-items', (req, res) => {
    const { item, actorName } = req.body as { item: Partial<WorkItem>; actorName?: string };
    if (!item?.title?.trim() || !item?.type) {
      return res.status(400).json({ error: 'Work item type and title are required.' });
    }
    const state = ensureDb();
    const id = state.nextWorkItemId++;
    const now = new Date().toISOString();
    const activeItems = state.workItems.filter((w) => !w.isDeleted);
    const maxOrder = activeItems.reduce((acc, w) => Math.max(acc, w.order), 0);

    const newItem: WorkItem = {
      id,
      order: item.order ?? maxOrder + 1,
      parentId: item.parentId ?? null,
      type: item.type,
      title: item.title.trim(),
      description: item.description ?? '',
      state: item.state ?? 'New',
      priority: item.priority ?? 'Medium',
      storyPoints: item.storyPoints ?? (item.type === 'User Story' ? 3 : null),
      valueArea: item.valueArea ?? (item.type === 'Test Case' ? 'QA' : 'Business'),
      iterationPath: item.iterationPath ?? 'Backlog',
      areaPath: item.areaPath ?? 'QA Vault',
      assignedToId: item.assignedToId ?? null,
      assignedToName: item.assignedToName ?? 'Unassigned',
      tags: Array.isArray(item.tags) ? item.tags : [],
      testSteps: item.testSteps ?? '',
      expectedResult: item.expectedResult ?? '',
      reproSteps: item.reproSteps ?? '',
      severity: item.severity ?? (item.type === 'Bug' ? 'Medium' : undefined),
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      createdAt: now,
      updatedAt: now,
    };

    state.workItems.push(newItem);
    addActivity(state, actorName || 'Admin', `created ${newItem.type} #${newItem.id}`, newItem.type, newItem.title);
    saveDb(state);
    res.status(201).json({ workItem: newItem, state: sanitizeState(state) });
  });

  // Update Work Item
  app.patch('/api/work-items/:id', (req, res) => {
    const id = Number(req.params.id);
    const { updates, actorName } = req.body as { updates: Partial<WorkItem>; actorName?: string };
    const state = ensureDb();
    const idx = state.workItems.findIndex((w) => w.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Work item not found.' });
    }
    const existing = state.workItems[idx];
    const updated: WorkItem = {
      ...existing,
      ...updates,
      id: existing.id,
      updatedAt: new Date().toISOString(),
    };
    state.workItems[idx] = updated;
    const actionLabel =
      updates.state && updates.state !== existing.state
        ? `changed state to ${updates.state}`
        : `updated ${updated.type} #${updated.id}`;
    addActivity(state, actorName || 'Admin', actionLabel, updated.type, updated.title);
    saveDb(state);
    res.json({ workItem: updated, state: sanitizeState(state) });
  });

  // Soft Delete Work Item
  app.delete('/api/work-items/:id', (req, res) => {
    const id = Number(req.params.id);
    const { actorName } = (req.body || {}) as { actorName?: string };
    const state = ensureDb();
    const item = state.workItems.find((w) => w.id === id);
    if (!item) {
      return res.status(404).json({ error: 'Work item not found.' });
    }
    const now = new Date().toISOString();
    item.isDeleted = true;
    item.deletedAt = now;
    item.deletedBy = actorName || 'Admin';
    item.updatedAt = now;

    addActivity(state, actorName || 'Admin', 'moved to Recycle Bin', item.type, item.title);
    saveDb(state);
    res.json({ state: sanitizeState(state) });
  });

  // Create Sprint
  app.post('/api/sprints', (req, res) => {
    const { sprint, actorName } = req.body as { sprint: Partial<Sprint>; actorName?: string };
    if (!sprint?.name?.trim()) {
      return res.status(400).json({ error: 'Sprint name is required.' });
    }
    const state = ensureDb();
    const newSprint: Sprint = {
      id: `spr-${Date.now()}`,
      name: sprint.name.trim(),
      iterationPath: sprint.iterationPath?.trim() || sprint.name.trim(),
      startDate: sprint.startDate || new Date().toISOString().slice(0, 10),
      endDate: sprint.endDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      status: sprint.status || 'Active',
      goal: sprint.goal || '',
    };
    state.sprints.push(newSprint);
    addActivity(state, actorName || 'Admin', 'created sprint', 'Sprint', `${newSprint.name} (${newSprint.iterationPath})`);
    saveDb(state);
    res.status(201).json({ sprint: newSprint, state: sanitizeState(state) });
  });

  // Upload Document
  app.post('/api/documents', (req, res) => {
    const { doc, actorName } = req.body as { doc: Partial<QADocument>; actorName?: string };
    if (!doc?.name?.trim() || !doc?.docType) {
      return res.status(400).json({ error: 'Document name and type are required.' });
    }
    const state = ensureDb();
    const now = new Date().toISOString();
    const newDoc: QADocument = {
      id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: doc.name.trim(),
      docType: doc.docType,
      mimeType: doc.mimeType || 'application/octet-stream',
      size: doc.size || 0,
      contentBase64: doc.contentBase64,
      sheets: doc.sheets,
      htmlContent: doc.htmlContent,
      pdfAnnotations: doc.pdfAnnotations || [],
      pdfMetadata: doc.pdfMetadata,
      uploadedBy: actorName || doc.uploadedBy || 'Admin',
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      createdAt: now,
      updatedAt: now,
    };
    state.documents.unshift(newDoc);
    addActivity(state, actorName || 'Admin', 'uploaded document', 'Document', newDoc.name);
    saveDb(state);
    res.status(201).json({ document: newDoc, state: sanitizeState(state) });
  });

  // Update Document
  app.patch('/api/documents/:id', (req, res) => {
    const { updates, actorName } = req.body as { updates: Partial<QADocument>; actorName?: string };
    const state = ensureDb();
    const idx = state.documents.findIndex((d) => d.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Document not found.' });
    }
    const updated: QADocument = {
      ...state.documents[idx],
      ...updates,
      id: state.documents[idx].id,
      updatedAt: new Date().toISOString(),
    };
    state.documents[idx] = updated;
    addActivity(state, actorName || 'Admin', 'edited document', 'Document', updated.name);
    saveDb(state);
    res.json({ document: updated, state: sanitizeState(state) });
  });

  // Soft Delete Document
  app.delete('/api/documents/:id', (req, res) => {
    const { actorName } = (req.body || {}) as { actorName?: string };
    const state = ensureDb();
    const doc = state.documents.find((d) => d.id === req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found.' });
    }
    const now = new Date().toISOString();
    doc.isDeleted = true;
    doc.deletedAt = now;
    doc.deletedBy = actorName || 'Admin';
    doc.updatedAt = now;
    addActivity(state, actorName || 'Admin', 'moved document to Recycle Bin', 'Document', doc.name);
    saveDb(state);
    res.json({ state: sanitizeState(state) });
  });

  // Create Note
  app.post('/api/notes', (req, res) => {
    const { title, content, actorName } = req.body as { title?: string; content?: string; actorName?: string };
    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({ error: 'Title and content are required.' });
    }
    const state = ensureDb();
    const now = new Date().toISOString();
    const note: QANote = {
      id: `note-${Date.now()}`,
      title: title.trim(),
      content: content.trim(),
      author: actorName || 'Admin',
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      createdAt: now,
      updatedAt: now,
    };
    state.notes.unshift(note);
    addActivity(state, actorName || 'Admin', 'added QA note', 'Note', note.title);
    saveDb(state);
    res.status(201).json({ note, state: sanitizeState(state) });
  });

  // Soft Delete Note
  app.delete('/api/notes/:id', (req, res) => {
    const { actorName } = (req.body || {}) as { actorName?: string };
    const state = ensureDb();
    const note = state.notes.find((n) => n.id === req.params.id);
    if (!note) {
      return res.status(404).json({ error: 'Note not found.' });
    }
    const now = new Date().toISOString();
    note.isDeleted = true;
    note.deletedAt = now;
    note.deletedBy = actorName || 'Admin';
    note.updatedAt = now;
    addActivity(state, actorName || 'Admin', 'moved note to Recycle Bin', 'Note', note.title);
    saveDb(state);
    res.json({ state: sanitizeState(state) });
  });

  // Log Manual Activity
  app.post('/api/activities', (req, res) => {
    const { actorName, action, targetType, targetTitle } = req.body as {
      actorName?: string;
      action?: string;
      targetType?: ActivityLog['targetType'];
      targetTitle?: string;
    };
    if (!action?.trim() || !targetTitle?.trim()) {
      return res.status(400).json({ error: 'Action and target title are required.' });
    }
    const state = ensureDb();
    addActivity(state, actorName || 'Admin', action.trim(), targetType || 'Task', targetTitle.trim());
    saveDb(state);
    res.status(201).json({ state: sanitizeState(state) });
  });

  // Recycle Bin: Restore
  app.post('/api/recycle-bin/restore', (req, res) => {
    const { kind, id, actorName } = req.body as {
      kind: 'workItem' | 'document' | 'note';
      id: string | number;
      actorName?: string;
    };
    const state = ensureDb();
    const now = new Date().toISOString();

    if (kind === 'workItem') {
      const item = state.workItems.find((w) => w.id === Number(id));
      if (!item) return res.status(404).json({ error: 'Item not found.' });
      item.isDeleted = false;
      item.deletedAt = null;
      item.deletedBy = null;
      item.updatedAt = now;
      addActivity(state, actorName || 'Admin', 'restored from Recycle Bin', item.type, item.title);
    } else if (kind === 'document') {
      const doc = state.documents.find((d) => d.id === String(id));
      if (!doc) return res.status(404).json({ error: 'Document not found.' });
      doc.isDeleted = false;
      doc.deletedAt = null;
      doc.deletedBy = null;
      doc.updatedAt = now;
      addActivity(state, actorName || 'Admin', 'restored from Recycle Bin', 'Document', doc.name);
    } else if (kind === 'note') {
      const note = state.notes.find((n) => n.id === String(id));
      if (!note) return res.status(404).json({ error: 'Note not found.' });
      note.isDeleted = false;
      note.deletedAt = null;
      note.deletedBy = null;
      note.updatedAt = now;
      addActivity(state, actorName || 'Admin', 'restored from Recycle Bin', 'Note', note.title);
    }
    saveDb(state);
    res.json({ state: sanitizeState(state) });
  });

  // Recycle Bin: Purge single item permanently
  app.post('/api/recycle-bin/purge', (req, res) => {
    const { kind, id, actorName } = req.body as {
      kind: 'workItem' | 'document' | 'note';
      id: string | number;
      actorName?: string;
    };
    const state = ensureDb();
    if (kind === 'workItem') {
      const item = state.workItems.find((w) => w.id === Number(id));
      state.workItems = state.workItems.filter((w) => w.id !== Number(id));
      if (item) addActivity(state, actorName || 'Admin', 'permanently deleted', item.type, item.title);
    } else if (kind === 'document') {
      const doc = state.documents.find((d) => d.id === String(id));
      state.documents = state.documents.filter((d) => d.id !== String(id));
      if (doc) addActivity(state, actorName || 'Admin', 'permanently deleted', 'Document', doc.name);
    } else if (kind === 'note') {
      const note = state.notes.find((n) => n.id === String(id));
      state.notes = state.notes.filter((n) => n.id !== String(id));
      if (note) addActivity(state, actorName || 'Admin', 'permanently deleted', 'Note', note.title);
    }
    saveDb(state);
    res.json({ state: sanitizeState(state) });
  });

  // Recycle Bin: Empty all deleted items
  app.post('/api/recycle-bin/empty', (req, res) => {
    const { actorName } = (req.body || {}) as { actorName?: string };
    const state = ensureDb();
    const deletedCount =
      state.workItems.filter((w) => w.isDeleted).length +
      state.documents.filter((d) => d.isDeleted).length +
      state.notes.filter((n) => n.isDeleted).length;
    state.workItems = state.workItems.filter((w) => !w.isDeleted);
    state.documents = state.documents.filter((d) => !d.isDeleted);
    state.notes = state.notes.filter((n) => !n.isDeleted);
    addActivity(state, actorName || 'Admin', `emptied ${deletedCount} items`, 'Recycle Bin', 'Recycle Bin');
    saveDb(state);
    res.json({ state: sanitizeState(state) });
  });

  // Vite / Static Serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`QA Vault server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start QA Vault server:', err);
  process.exit(1);
});
