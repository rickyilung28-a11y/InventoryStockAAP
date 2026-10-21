import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { UserAccount, UserRole } from '../types/inventory';
import {
  UserPlus,
  Key,
  Shield,
  ShieldCheck,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Search,
  Eye,
  EyeOff,
  X,
  AlertTriangle,
} from 'lucide-react';

export const UserManagementView: React.FC = () => {
  const {
    currentUser,
    users,
    createUser,
    updateUser,
    resetUserPassword,
    deleteUser,
    toggleUserStatus,
  } = useInventory();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'admin' | 'kepala_gudang' | 'user'>('ALL');

  // Modal Create
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('user');
  const [newDepartment, setNewDepartment] = useState('Dept. Produksi Line 1');
  const [newEmail, setNewEmail] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [createError, setCreateError] = useState('');

  // Modal Reset Password
  const [resetTargetUser, setResetTargetUser] = useState<UserAccount | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetError, setResetError] = useState('');

  // Modal Edit User
  const [editTargetUser, setEditTargetUser] = useState<UserAccount | null>(null);
  const [editName, setEditName] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('user');
  const [editError, setEditError] = useState('');

  const filteredUsers = users.filter((u) => {
    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
    const q = searchQuery.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q) ||
      u.department.toLowerCase().includes(q)
    );
  });

  const handleOpenCreate = (presetRole: UserRole = 'user') => {
    setNewUsername('');
    setNewPassword(presetRole === 'user' ? 'user123' : 'admin123');
    setNewName('');
    setNewRole(presetRole);
    setNewDepartment(
      presetRole === 'kepala_gudang'
        ? 'Kepala Gudang & Logistik'
        : presetRole === 'admin'
        ? 'Admin Gudang & Logistik'
        : 'Dept. Produksi Line 1'
    );
    setNewEmail('');
    setCreateError('');
    setIsCreateOpen(true);
  };

  const handleSaveCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');

    if (!newUsername.trim() || !newPassword || !newName.trim()) {
      setCreateError('Username, password, dan nama lengkap wajib diisi.');
      return;
    }

    const res = createUser({
      username: newUsername.trim(),
      password: newPassword,
      name: newName.trim(),
      role: newRole,
      department: newDepartment.trim(),
      email: newEmail.trim(),
    });

    if (res.success) {
      setIsCreateOpen(false);
    } else if (res.error) {
      setCreateError(res.error);
    }
  };

  const handleOpenResetPassword = (user: UserAccount) => {
    setResetTargetUser(user);
    setResetPasswordValue('');
    setResetError('');
  };

  const handleSaveResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser) return;
    setResetError('');

    if (!resetPasswordValue || resetPasswordValue.length < 4) {
      setResetError('Password baru minimal 4 karakter.');
      return;
    }

    const res = resetUserPassword(resetTargetUser.id, resetPasswordValue);
    if (res.success) {
      setResetTargetUser(null);
    } else if (res.error) {
      setResetError(res.error);
    }
  };

  const handleOpenEdit = (user: UserAccount) => {
    setEditTargetUser(user);
    setEditName(user.name);
    setEditDepartment(user.department);
    setEditRole(user.role);
    setEditError('');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTargetUser) return;
    setEditError('');

    if (!editName.trim() || !editDepartment.trim()) {
      setEditError('Nama dan departemen tidak boleh kosong.');
      return;
    }

    const res = updateUser(editTargetUser.id, {
      name: editName.trim(),
      department: editDepartment.trim(),
      role: editRole,
    });

    if (res.success) {
      setEditTargetUser(null);
    } else if (res.error) {
      setEditError(res.error);
    }
  };

  const formatDateTime = (iso?: string) => {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    } catch {
      return iso;
    }
  };

  const adminCount = users.filter((u) => u.role === 'admin').length;
  const kepalaCount = users.filter((u) => u.role === 'kepala_gudang').length;
  const pemohonCount = users.filter((u) => u.role === 'user').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              <Shield className="w-4 h-4 text-emerald-600" />
              <span>Otorisasi Akses & Keamanan Sistem (3 Peran)</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Manajemen Akun Pengguna (Pemohon, Admin Gudang & Kepala Gudang)
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
              Kelola akun karyawan untuk peran <strong>User Pemohon</strong>, <strong>Admin Gudang</strong>, dan <strong>Kepala Gudang</strong>, termasuk pengaturan username, password, departemen, serta status aktif.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => handleOpenCreate('kepala_gudang')}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs"
            >
              <ShieldCheck className="w-4 h-4 text-blue-200" />
              Tambah User Kepala Gudang
            </button>
            <button
              onClick={() => handleOpenCreate('user')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs"
            >
              <UserPlus className="w-4 h-4 text-emerald-400" />
              Tambah Pengguna Baru
            </button>
          </div>
        </div>

        {/* Filter & Search */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => setRoleFilter('ALL')}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
                roleFilter === 'ALL' ? 'bg-white shadow-2xs text-slate-900 font-semibold' : 'text-slate-600'
              }`}
            >
              Semua ({users.length})
            </button>
            <button
              onClick={() => setRoleFilter('kepala_gudang')}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
                roleFilter === 'kepala_gudang' ? 'bg-white shadow-2xs text-blue-900 font-semibold' : 'text-slate-600'
              }`}
            >
              Kepala Gudang ({kepalaCount})
            </button>
            <button
              onClick={() => setRoleFilter('admin')}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
                roleFilter === 'admin' ? 'bg-white shadow-2xs text-emerald-900 font-semibold' : 'text-slate-600'
              }`}
            >
              Admin Gudang ({adminCount})
            </button>
            <button
              onClick={() => setRoleFilter('user')}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
                roleFilter === 'user' ? 'bg-white shadow-2xs text-slate-900 font-semibold' : 'text-slate-600'
              }`}
            >
              User Pemohon ({pemohonCount})
            </button>
          </div>

          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari username, nama, departemen..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:bg-white focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Users Table on Desktop (hidden md:block) */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Username & Akun</th>
                <th className="px-4 py-3">Nama Lengkap</th>
                <th className="px-4 py-3">Peran (Role)</th>
                <th className="px-4 py-3">Departemen</th>
                <th className="px-4 py-3">Password Tersimpan</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3">Terakhir Login</th>
                <th className="px-4 py-3 text-center w-36">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user) => {
                const isCurrent = currentUser?.id === user.id;
                const isAdmin = user.role === 'admin';
                const isKepala = user.role === 'kepala_gudang';

                return (
                  <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Username */}
                    <td className="px-4 py-3 font-mono">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                          {user.username}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-sans font-medium">
                            Akun Anda
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Full Name & Email */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{user.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{user.email}</div>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      {isKepala ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-[11px]">
                          <ShieldCheck className="w-3 h-3 text-blue-600" />
                          Kepala Gudang
                        </span>
                      ) : isAdmin ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                          <Shield className="w-3 h-3 text-emerald-600" />
                          Admin Gudang
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          User Pemohon
                        </span>
                      )}
                    </td>

                    {/* Department */}
                    <td className="px-4 py-3 text-slate-700 font-medium">
                      {user.department}
                    </td>

                    {/* Password display & change */}
                    <td className="px-4 py-3 font-mono text-slate-600">
                      <div className="flex items-center gap-2">
                        <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">
                          {user.password}
                        </span>
                        <button
                          onClick={() => handleOpenResetPassword(user)}
                          className="text-[11px] text-emerald-700 hover:text-emerald-800 font-sans underline"
                          title="Ubah Password Akun ini"
                        >
                          Ubah
                        </button>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleUserStatus(user.id)}
                        disabled={isCurrent}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                          user.isActive
                            ? 'text-emerald-700 hover:bg-emerald-50'
                            : 'text-red-700 hover:bg-red-50'
                        } ${isCurrent ? 'cursor-not-allowed opacity-60' : ''}`}
                        title={isCurrent ? 'Tidak dapat menonaktifkan akun sendiri' : 'Klik untuk mengubah status'}
                      >
                        {user.isActive ? (
                          <>
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Aktif</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Nonaktif</span>
                          </>
                        )}
                      </button>
                    </td>

                    {/* Last login */}
                    <td className="px-4 py-3 text-slate-500 text-[11px] font-mono">
                      {formatDateTime(user.lastLogin)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(user)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                          title="Edit Pengguna"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleOpenResetPassword(user)}
                          className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                          title="Reset Password"
                        >
                          <Key className="w-3.5 h-3.5" />
                        </button>

                        {!isCurrent ? (
                          <button
                            onClick={() => {
                              if (window.confirm(`Hapus akun pengguna "${user.username}" (${user.name}) secara permanen?`)) {
                                deleteUser(user.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Hapus Pengguna"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="p-1.5 text-slate-300 cursor-not-allowed" title="Akun aktif tidak dapat dihapus">
                            <Trash2 className="w-3.5 h-3.5 opacity-30" />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Users Card List on Mobile (md:hidden) */}
      <div className="md:hidden space-y-3">
        {filteredUsers.map((user) => {
          const isCurrent = currentUser?.id === user.id;
          const isAdmin = user.role === 'admin';
          const isKepala = user.role === 'kepala_gudang';

          return (
            <div
              key={user.id}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-900">
                      @{user.username}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold">
                        Akun Anda
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm mt-1">{user.name}</h4>
                  <p className="text-slate-500 text-[11px] font-mono">{user.email}</p>
                </div>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    isKepala
                      ? 'bg-blue-50 text-blue-800 border-blue-200'
                      : isAdmin
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {isKepala ? 'Kepala Gudang' : isAdmin ? 'Admin Gudang' : 'Pemohon'}
                </span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg space-y-1.5 text-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Departemen:</span>
                  <span className="font-medium text-slate-900">{user.department}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Password:</span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="font-bold text-slate-800">{user.password}</span>
                    <button
                      onClick={() => handleOpenResetPassword(user)}
                      className="text-[10px] text-emerald-700 underline font-sans"
                    >
                      Ubah
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <button
                  onClick={() => toggleUserStatus(user.id)}
                  disabled={isCurrent}
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                    user.isActive ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {user.isActive ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Aktif</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Nonaktif</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(user)}
                    className="px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200 flex items-center gap-1"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleOpenResetPassword(user)}
                    className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 flex items-center gap-1"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Password</span>
                  </button>
                  {!isCurrent && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Hapus akun pengguna "${user.username}"?`)) {
                          deleteUser(user.id);
                        }
                      }}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                      title="Hapus Pengguna"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal 1: Tambah Pengguna Baru */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-semibold">Tambah Akun Pengguna Baru</h2>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCreate} className="p-6 space-y-4 text-xs">
              {createError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Username Login <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    placeholder="Contoh: kepala2 / doni"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Huruf kecil, tanpa spasi</span>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Password Ditetapkan <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Password login"
                      className="w-full px-3 py-2 pr-8 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Nama Lengkap Karyawan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Contoh: Suryadi / Doni Kurniawan"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Peran Sistem (Role) <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => {
                      const r = e.target.value as UserRole;
                      setNewRole(r);
                      if (r === 'kepala_gudang') {
                        setNewDepartment('Kepala Gudang & Logistik');
                      } else if (r === 'admin') {
                        setNewDepartment('Admin Gudang & Logistik');
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="user">User Pemohon (Buat SIV & Ajukan Minimal Stock)</option>
                    <option value="admin">Admin Gudang (ACC & Validasi Barang SIV / Verifikasi Minimal Stock)</option>
                    <option value="kepala_gudang">Kepala Gudang (Verifikasi Akhir SIV & Approve Minimal Stock)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Departemen / Divisi <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    placeholder="Contoh: Kepala Gudang & Logistik"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Email Perusahaan (Opsional)</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="kepala.gudang@pabrik.co.id"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg shadow-xs"
                >
                  Simpan & Daftarkan Akun
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Ubah Password oleh Admin */}
      {resetTargetUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-semibold">Ubah Password Pengguna</h2>
              </div>
              <button
                onClick={() => setResetTargetUser(null)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveResetPassword} className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="font-semibold text-slate-900">{resetTargetUser.name}</div>
                <div className="text-slate-500 font-mono text-[11px]">
                  Username: @{resetTargetUser.username} · {resetTargetUser.department}
                </div>
              </div>

              {resetError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Password Baru <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    value={resetPasswordValue}
                    onChange={(e) => setResetPasswordValue(e.target.value)}
                    placeholder="Masukkan password baru (min 4 karakter)"
                    className="w-full px-3 py-2 pr-9 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showResetPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetTargetUser(null)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg shadow-xs"
                >
                  Perbarui Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Edit Data Pengguna */}
      {editTargetUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-semibold">Edit Data Pengguna</h2>
              </div>
              <button
                onClick={() => setEditTargetUser(null)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200 font-mono text-slate-600">
                Username: <strong>{editTargetUser.username}</strong>
              </div>

              {editError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Nama Lengkap <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Departemen <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editDepartment}
                  onChange={(e) => setEditDepartment(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Peran (Role)
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900"
                >
                  <option value="user">User Pemohon</option>
                  <option value="admin">Admin Gudang</option>
                  <option value="kepala_gudang">Kepala Gudang</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditTargetUser(null)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg shadow-xs"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
