import React, { useState } from 'react';
import { KeyRound, LogOut, Trash2, UserPlus, Users } from 'lucide-react';
import { useQAVault } from '../store/QAVaultContext';
import type { UserRole } from '../types/qa';

export const SettingsView: React.FC = () => {
  const { state, currentUser, login, logout, addUser, deleteUser } = useQAVault();

  // Sign-In state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState<string | null>(null);

  // Add User state
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('Admin');
  const [userFeedback, setUserFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [addingUser, setAddingUser] = useState(false);

  const isAdmin = currentUser?.role === 'Admin';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginSuccess(null);
    const res = await login(loginUsername, loginPassword);
    if (!res.ok) {
      setLoginError(res.error || 'Sign in failed.');
    } else {
      setLoginSuccess('Signed in successfully.');
      setLoginUsername('');
      setLoginPassword('');
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFeedback(null);
    setAddingUser(true);
    try {
      const res = await addUser({
        name: newName,
        username: newUsername,
        email: newEmail,
        password: newPassword,
        role: newRole,
      });
      if (!res.ok) {
        setUserFeedback({ ok: false, text: res.error || 'Unable to add user.' });
      } else {
        setUserFeedback({ ok: true, text: `Added ${newName} (${newRole}) to QA Vault.` });
        setNewName('');
        setNewUsername('');
        setNewEmail('');
        setNewPassword('');
        setNewRole('Admin');
      }
    } finally {
      setAddingUser(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your Admin account and add team users.
        </p>
      </div>

      {/* Account & Sign In */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 max-w-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <KeyRound className="w-4 h-4 text-teal-600" />
            <h2 className="text-sm font-semibold text-slate-900">Admin Account & Sign In</h2>
          </div>
          {currentUser && (
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          )}
        </div>

        {currentUser ? (
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: currentUser.avatarColor }}
              >
                {currentUser.initials}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{currentUser.name}</p>
                <p className="text-xs text-slate-500">
                  @{currentUser.username} · Role:{' '}
                  <span className="font-semibold text-slate-800">{currentUser.role}</span>
                </p>
              </div>
            </div>
            <span className="text-xs font-medium text-teal-700">Active Session</span>
          </div>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
            Signed out. Sign in with your Admin credentials below.
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-3 pt-1">
          <p className="text-xs font-medium text-slate-600">
            Sign In (Admin Username: <span className="font-mono text-slate-900">Admin</span> / Password:{' '}
            <span className="font-mono text-slate-900">QA_VAULT@123</span>)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
              placeholder="Username (Admin)"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
            />
            <input
              type="password"
              required
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="Password"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
            />
          </div>

          {loginError && <p className="text-xs font-medium text-rose-600">{loginError}</p>}
          {loginSuccess && <p className="text-xs font-medium text-teal-700">{loginSuccess}</p>}

          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Sign In
          </button>
        </form>
      </div>

      {/* Add User + Users List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
            <UserPlus className="w-4 h-4 text-teal-600" />
            <h2 className="text-sm font-semibold text-slate-900">Add User</h2>
          </div>

          {!isAdmin ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
              Sign in with Admin credentials (<span className="font-mono text-slate-900">Admin</span> /{' '}
              <span className="font-mono text-slate-900">QA_VAULT@123</span>) above to add users.
            </div>
          ) : (
            <form onSubmit={handleAddUser} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter full name"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Username</label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="username"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Manager">Manager</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="user@qavault.local"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Set password"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>

              {userFeedback && (
                <p className={`text-xs font-medium ${userFeedback.ok ? 'text-teal-700' : 'text-rose-600'}`}>
                  {userFeedback.text}
                </p>
              )}

              <button
                type="submit"
                disabled={addingUser}
                className="w-full rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {addingUser ? 'Adding User...' : 'Add User'}
              </button>
            </form>
          )}
        </div>

        {/* Users List */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">
                Users ({state.users.length})
              </h2>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {state.users.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white shrink-0"
                    style={{ backgroundColor: u.avatarColor }}
                  >
                    {u.initials}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{u.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      @{u.username} · {u.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-semibold text-slate-800">{u.role}</span>
                  {isAdmin && u.id !== 'usr-admin' && (
                    <button
                      type="button"
                      onClick={() => deleteUser(u.id)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      title="Remove user"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
