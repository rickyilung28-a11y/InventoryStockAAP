import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  StockItem,
  LPBDocument,
  IssueVoucherDocument,
  StockMovement,
  AppNotification,
  UserAccount,
  UserRole,
  LPBItem,
  IssueVoucherItem,
  CostCenterEntry,
  GLAccountEntry,
  StorageLocation,
  CompanyProfile,
  MinStockProposal,
  SystemActivityLog,
  ActivityLogCategory,
  MovementVelocityCategory,
} from '../types/inventory';
import {
  INITIAL_USERS,
  INITIAL_STOCK_ITEMS,
  INITIAL_LPB_DOCUMENTS,
  INITIAL_ISSUE_VOUCHERS,
  INITIAL_STOCK_MOVEMENTS,
  INITIAL_NOTIFICATIONS,
  INITIAL_COST_CENTERS,
  INITIAL_GL_ACCOUNTS,
  INITIAL_STORAGE_LOCATIONS,
  INITIAL_COMPANY_PROFILE,
  INITIAL_MIN_STOCK_PROPOSALS,
  INITIAL_ACTIVITY_LOGS,
} from '../data/mockData';
import { realtimeService, RealtimeEventPayload } from '../services/realtimeService';

interface ToastInfo {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
  voucherNumber?: string;
}

interface InventoryContextType {
  currentUser: UserAccount | null;
  users: UserAccount[];
  login: (username: string, password: string) => { success: boolean; error?: string; user?: UserAccount };
  logout: () => void;
  createUser: (userData: {
    username: string;
    password: string;
    name: string;
    role: UserRole;
    department: string;
    email?: string;
  }) => { success: boolean; error?: string; user?: UserAccount };
  updateUser: (userId: string, updates: Partial<UserAccount>) => { success: boolean; error?: string };
  resetUserPassword: (userId: string, newPassword: string) => { success: boolean; error?: string };
  deleteUser: (userId: string) => { success: boolean; error?: string };
  toggleUserStatus: (userId: string) => { success: boolean; error?: string };

  stockItems: StockItem[];
  lpbDocuments: LPBDocument[];
  issueVouchers: IssueVoucherDocument[];
  stockMovements: StockMovement[];
  notifications: AppNotification[];

  // Cost Center & GL Accounts Master (Admin editable & dropdown selectable)
  costCenters: CostCenterEntry[];
  glAccounts: GLAccountEntry[];
  addCostCenter: (entry: CostCenterEntry) => { success: boolean; error?: string };
  updateCostCenter: (oldCode: string, entry: CostCenterEntry) => { success: boolean; error?: string };
  deleteCostCenter: (code: string) => { success: boolean; error?: string };
  clearAllCostCenters: () => void;
  importCostCentersBulk: (
    entries: CostCenterEntry[],
    mode?: 'upsert' | 'replace'
  ) => { success: boolean; added: number; updated: number; totalAfter: number; error?: string };
  addGLAccount: (entry: GLAccountEntry) => { success: boolean; error?: string };
  updateGLAccount: (oldCode: string, entry: GLAccountEntry) => { success: boolean; error?: string };
  deleteGLAccount: (code: string) => { success: boolean; error?: string };
  clearAllGLAccounts: () => void;
  importGLAccountsBulk: (
    entries: GLAccountEntry[],
    mode?: 'upsert' | 'replace'
  ) => { success: boolean; added: number; updated: number; totalAfter: number; error?: string };

  activeToast: ToastInfo | null;
  dismissToast: () => void;
  
  // Actions
  createLPB: (data: {
    sjNumber: string;
    sjDate: string;
    supplierName: string;
    receivedDate: string;
    poNumber?: string;
    driverName?: string;
    vehiclePlate?: string;
    usagePurpose?: string;
    storageLocation?: string;
    notes?: string;
    items: Omit<LPBItem, 'sku' | 'itemName' | 'unit'>[];
  }) => LPBDocument;

  approveLPBStockAddition: (
    lpbId: string,
    payload?: {
      warehouseHeadName?: string;
      notes?: string;
    }
  ) => { success: boolean; error?: string };

  rejectLPB: (lpbId: string, reason: string) => { success: boolean; error?: string };

  createIssueVoucher: (data: {
    purpose: string;
    notes?: string;
    department?: string;
    items: { itemId: string; requestedQty: number; costCenter?: string; glAcc?: string }[];
  }) => { success: boolean; voucher?: IssueVoucherDocument; error?: string };

  approveIssueVoucher: (
    voucherId: string,
    handover?: {
      warehouseHeadName?: string;
      approverAdminName?: string;
      notes?: string;
      handoverOfficer?: string;
      recipientName?: string;
    }
  ) => { success: boolean; error?: string };

  completeIssueVoucherHandover: (
    voucherId: string,
    payload: {
      recipientName: string;
      handoverOfficer?: string;
      notes?: string;
      itemsValidation?: {
        itemId: string;
        sku?: string;
        issuedQty: number;
        isCancelled: boolean;
        barcodeValidated?: boolean;
        barcodeScanned?: boolean;
        barcodeScannedAt?: string;
      }[];
      validatedItems?: {
        itemId: string;
        issuedQty: number;
        isCancelled: boolean;
        barcodeScanned?: boolean;
      }[];
    }
  ) => { success: boolean; voucher?: IssueVoucherDocument; error?: string };

  rejectIssueVoucher: (voucherId: string, reason: string) => { success: boolean; error?: string };

  updateIssueVoucher: (
    voucherId: string,
    data: {
      purpose: string;
      notes?: string;
      items: { itemId: string; requestedQty: number; costCenter?: string; glAcc?: string }[];
    }
  ) => { success: boolean; error?: string };

  deleteIssueVoucher: (voucherId: string) => { success: boolean; error?: string };

  markNotificationAsRead: (notificationId: string) => void;
  markAllNotificationsAsRead: () => void;
  
  addNewStockItem: (item: Omit<StockItem, 'id' | 'allocatedStock' | 'updatedAt'>) => StockItem;
  updateStockItem: (id: string, updates: Partial<StockItem>) => void;
  deleteStockItem: (id: string) => { success: boolean; error?: string };
  importStockItemsBulk: (
    items: Array<{
      sku: string;
      name: string;
      category: string;
      unit: string;
      currentStock: number;
      minStock: number;
      location: string;
      description?: string;
    }>,
    mode?: 'upsert' | 'add_only'
  ) => { success: boolean; added: number; updated: number; error?: string };

  // Lokasi & Rak Penyimpanan
  storageLocations: StorageLocation[];
  addStorageLocation: (loc: Omit<StorageLocation, 'id'>) => { success: boolean; location?: StorageLocation; error?: string };
  updateStorageLocation: (id: string, updates: Partial<StorageLocation>) => { success: boolean; error?: string };
  deleteStorageLocation: (id: string) => { success: boolean; error?: string };

  // Data Perusahaan & Branding
  companyProfile: CompanyProfile;
  updateCompanyProfile: (updates: Partial<CompanyProfile>) => void;
  resetCompanyProfile: () => void;
  
  // Batas Stok Minimal & Pengajuan
  minStockProposals: MinStockProposal[];
  createMinStockProposal: (data: {
    itemId: string;
    proposedMinStock: number;
    reason: string;
  }) => { success: boolean; proposal?: MinStockProposal; error?: string };
  updateMinStockProposal: (
    proposalId: string,
    data: {
      proposedMinStock: number;
      reason: string;
    }
  ) => { success: boolean; error?: string };
  deleteMinStockProposal: (proposalId: string) => { success: boolean; error?: string };
  verifyMinStockProposal: (
    proposalId: string,
    adminNotes?: string,
    verifiedMinStock?: number
  ) => { success: boolean; error?: string };
  approveMinStockProposal: (
    proposalId: string,
    headNotes?: string
  ) => { success: boolean; error?: string };
  rejectMinStockProposal: (
    proposalId: string,
    notes: string
  ) => { success: boolean; error?: string };

  // Alert helpers
  lowStockItems: StockItem[]; // Melampaui / Kritis (currentStock <= minStock)
  nearMinStockItems: StockItem[]; // Mendekati minimal (currentStock > minStock && currentStock <= minStock + buffer)

  // Analisa Kategori Keluar Barang (Fast / Medium / Low Moving)
  getItemMovementAnalytics: (itemId: string, sku?: string) => {
    totalOutQty: number;
    outFrequency: number;
    lastOutDate?: string;
    velocityCategory: MovementVelocityCategory;
    velocityLabel: 'Fast Moving' | 'Medium Moving' | 'Low Moving';
  };

  // System Activity Log (Audit Trail)
  activityLogs: SystemActivityLog[];
  addActivityLog: (entry: {
    category: ActivityLogCategory;
    action: string;
    title: string;
    description: string;
    referenceNumber?: string;
  }) => void;

  // Print preview state
  selectedDocumentForPrint: { type: 'LPB' | 'NPB'; doc: LPBDocument | IssueVoucherDocument } | null;
  openPrintPreview: (type: 'LPB' | 'NPB', doc: LPBDocument | IssueVoucherDocument) => void;
  closePrintPreview: () => void;

  resetToDefaultData: () => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

const STORAGE_KEYS = {
  CURRENT_USER: 'inv_current_user_id',
  USERS: 'inv_users_list_v2',
  STOCK_ITEMS: 'inv_stock_items_v2',
  LPB_DOCS: 'inv_lpb_docs_v2',
  ISSUE_VOUCHERS: 'inv_issue_vouchers_v2',
  STOCK_MOVEMENTS: 'inv_stock_movements_v2',
  NOTIFICATIONS: 'inv_notifications_v2',
  COST_CENTERS: 'inv_cost_centers_v2',
  GL_ACCOUNTS: 'inv_gl_accounts_v2',
  STORAGE_LOCATIONS: 'inv_storage_locations_v2',
  COMPANY_PROFILE: 'inv_company_profile_v2',
  MIN_STOCK_PROPOSALS: 'inv_min_stock_proposals_v2',
  ACTIVITY_LOGS: 'inv_activity_logs_v2',
};

export const InventoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Users list state (auto-ensure kepala_gudang account exists even if localStorage has older data)
  const [users, setUsers] = useState<UserAccount[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USERS);
      if (saved) {
        const parsed: UserAccount[] = JSON.parse(saved);
        const existingUsernames = new Set(parsed.map((u) => u.username.toLowerCase()));
        const missingDefaults = INITIAL_USERS.filter(
          (initUser) => !existingUsernames.has(initUser.username.toLowerCase())
        );
        if (missingDefaults.length > 0) {
          const merged = [...parsed, ...missingDefaults];
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(merged));
          return merged;
        }
        return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_USERS;
  });

  // Current user state (null if not logged in)
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (saved) {
        const savedUsersJson = localStorage.getItem(STORAGE_KEYS.USERS);
        const usersList: UserAccount[] = savedUsersJson ? JSON.parse(savedUsersJson) : INITIAL_USERS;
        const found = usersList.find((u) => u.id === saved && u.isActive !== false);
        if (found) return found;
      }
    } catch {
      // ignore
    }
    return null;
  });

  // Stock items
  const [stockItems, setStockItems] = useState<StockItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STOCK_ITEMS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_STOCK_ITEMS;
  });

  // LPB Documents
  const [lpbDocuments, setLpbDocuments] = useState<LPBDocument[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LPB_DOCS);
      if (saved) {
        const parsed: LPBDocument[] = JSON.parse(saved).map((doc: LPBDocument) => ({
          ...doc,
          status: doc.status || 'APPROVED',
        }));
        const existingNumbers = new Set(parsed.map((d) => d.lpbNumber));
        const missingDefaults = INITIAL_LPB_DOCUMENTS.filter(
          (initDoc) => !existingNumbers.has(initDoc.lpbNumber)
        );
        if (missingDefaults.length > 0) {
          const merged = [...missingDefaults, ...parsed];
          localStorage.setItem(STORAGE_KEYS.LPB_DOCS, JSON.stringify(merged));
          return merged;
        }
        return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_LPB_DOCUMENTS;
  });

  // Issue Vouchers (Nota Pengambilan Barang)
  const [issueVouchers, setIssueVouchers] = useState<IssueVoucherDocument[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ISSUE_VOUCHERS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_ISSUE_VOUCHERS;
  });

  // Stock Movements Ledger
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STOCK_MOVEMENTS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_STOCK_MOVEMENTS;
  });

  // Notifications
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_NOTIFICATIONS;
  });

  // Cost Centers Master State
  const [costCenters, setCostCenters] = useState<CostCenterEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.COST_CENTERS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_COST_CENTERS;
  });

  // GL Accounts Master State
  const [glAccounts, setGlAccounts] = useState<GLAccountEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.GL_ACCOUNTS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_GL_ACCOUNTS;
  });

  // Storage Locations State (Rak & Lokasi Penyimpanan)
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STORAGE_LOCATIONS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_STORAGE_LOCATIONS;
  });

  // Company Profile & Branding State
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.COMPANY_PROFILE);
      if (saved) return { ...INITIAL_COMPANY_PROFILE, ...JSON.parse(saved) };
    } catch {
      // ignore
    }
    return INITIAL_COMPANY_PROFILE;
  });

  // Batas Stok Minimal & Pengajuan State
  const [minStockProposals, setMinStockProposals] = useState<MinStockProposal[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MIN_STOCK_PROPOSALS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_MIN_STOCK_PROPOSALS;
  });

  // System Activity Logs State
  const [activityLogs, setActivityLogs] = useState<SystemActivityLog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ACTIVITY_LOGS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_ACTIVITY_LOGS;
  });

  const addActivityLog = useCallback(
    (entry: {
      category: ActivityLogCategory;
      action: string;
      title: string;
      description: string;
      referenceNumber?: string;
    }) => {
      const newLog: SystemActivityLog = {
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        category: entry.category,
        action: entry.action,
        title: entry.title,
        description: entry.description,
        actorName: currentUser ? currentUser.name : 'Administrator Gudang',
        actorUsername: currentUser ? currentUser.username : 'admin.gudang',
        actorRole: currentUser ? currentUser.role : 'admin',
        referenceNumber: entry.referenceNumber,
      };
      setActivityLogs((prev) => [newLog, ...prev]);
    },
    [currentUser]
  );

  // Floating Toast Alert
  const [activeToast, setActiveToast] = useState<ToastInfo | null>(null);

  // Print Preview Modal State
  const [selectedDocumentForPrint, setSelectedDocumentForPrint] = useState<{
    type: 'LPB' | 'NPB';
    doc: LPBDocument | IssueVoucherDocument;
  } | null>(null);

  // Sync to LocalStorage
  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, currentUser.id);
      } else {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      }
    } catch {}
  }, [currentUser]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    } catch {}
  }, [users]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.STOCK_ITEMS, JSON.stringify(stockItems));
    } catch {}
  }, [stockItems]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.LPB_DOCS, JSON.stringify(lpbDocuments));
    } catch {}
  }, [lpbDocuments]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ISSUE_VOUCHERS, JSON.stringify(issueVouchers));
    } catch {}
  }, [issueVouchers]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.STOCK_MOVEMENTS, JSON.stringify(stockMovements));
    } catch {}
  }, [stockMovements]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
    } catch {}
  }, [notifications]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.COST_CENTERS, JSON.stringify(costCenters));
    } catch {}
  }, [costCenters]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.GL_ACCOUNTS, JSON.stringify(glAccounts));
    } catch {}
  }, [glAccounts]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.STORAGE_LOCATIONS, JSON.stringify(storageLocations));
    } catch {}
  }, [storageLocations]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.COMPANY_PROFILE, JSON.stringify(companyProfile));
    } catch {}
  }, [companyProfile]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
    } catch {}
  }, [notifications]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.MIN_STOCK_PROPOSALS, JSON.stringify(minStockProposals));
    } catch {}
  }, [minStockProposals]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(activityLogs));
    } catch {}
  }, [activityLogs]);

  // Real-time Event Listener (BroadcastChannel & Storage Events)
  useEffect(() => {
    const unsubscribe = realtimeService.subscribe((payload: RealtimeEventPayload) => {
      if (payload.type === 'VOUCHER_APPROVED') {
        const voucher = payload.data as IssueVoucherDocument;
        
        // Show real-time toast to the user
        setActiveToast({
          id: Math.random().toString(),
          type: 'success',
          title: 'Nota Pengambilan Disetujui & Diserahkan!',
          message: `Nota #${voucher.voucherNumber} (${voucher.department}) telah di-ACC oleh Admin. Barang telah diserahkan & stok resmi dipotong.`,
          voucherNumber: voucher.voucherNumber,
        });

        // Ensure state is updated if from another tab
        setIssueVouchers((prev) =>
          prev.map((v) => (v.id === voucher.id ? voucher : v))
        );
      } else if (payload.type === 'VOUCHER_CREATED') {
        const voucher = payload.data as IssueVoucherDocument;
        setActiveToast({
          id: Math.random().toString(),
          type: 'info',
          title: 'Nota Pengambilan Baru Terbit',
          message: `Nota #${voucher.voucherNumber} dibuat oleh ${voucher.requestedBy} (${voucher.department}). Menunggu approval admin.`,
          voucherNumber: voucher.voucherNumber,
        });
      } else if (payload.type === 'VOUCHER_REJECTED') {
        const voucher = payload.data as IssueVoucherDocument;
        setActiveToast({
          id: Math.random().toString(),
          type: 'warning',
          title: 'Nota Pengambilan Ditolak',
          message: `Nota #${voucher.voucherNumber} ditolak. Alasan: ${voucher.rejectionReason || 'Tidak disebutkan'}.`,
          voucherNumber: voucher.voucherNumber,
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const login = useCallback(
    (username: string, password: string) => {
      const trimmedUser = username.trim().toLowerCase();
      const user = users.find(
        (u) => u.username.toLowerCase() === trimmedUser && u.password === password
      );

      if (!user) {
        return { success: false, error: 'Username atau password salah. Silakan periksa kembali.' };
      }

      if (user.isActive === false) {
        return {
          success: false,
          error: 'Akun Anda dinonaktifkan oleh Administrator. Hubungi admin gudang untuk mengaktifkan.',
        };
      }

      const updatedUser: UserAccount = {
        ...user,
        lastLogin: new Date().toISOString(),
      };

      setUsers((prev) => prev.map((u) => (u.id === user.id ? updatedUser : u)));
      setCurrentUser(updatedUser);

      setActiveToast({
        id: Math.random().toString(),
        type: 'success',
        title: 'Login Berhasil',
        message: `Selamat datang, ${user.name} (${
          user.role === 'admin'
            ? 'Administrator Gudang'
            : user.role === 'kepala_gudang'
            ? 'Kepala Gudang'
            : user.department
        }).`,
      });

      return { success: true, user: updatedUser };
    },
    [users]
  );

  const logout = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    setActiveToast({
      id: Math.random().toString(),
      type: 'info',
      title: 'Logout Berhasil',
      message: 'Anda telah keluar dari sistem inventaris gudang.',
    });
  }, []);

  const createUser = useCallback(
    (userData: {
      username: string;
      password: string;
      name: string;
      role: UserRole;
      department: string;
      email?: string;
    }) => {
      const trimmedUsername = userData.username.trim().toLowerCase();
      if (!trimmedUsername || !userData.password || !userData.name) {
        return { success: false, error: 'Username, password, dan nama lengkap wajib diisi.' };
      }

      if (users.some((u) => u.username.toLowerCase() === trimmedUsername)) {
        return { success: false, error: `Username "${userData.username}" sudah digunakan. Silakan gunakan username lain.` };
      }

      const newUser: UserAccount = {
        id: `user_${Date.now()}`,
        username: userData.username.trim(),
        password: userData.password,
        name: userData.name.trim(),
        role: userData.role,
        department: userData.department.trim(),
        email: userData.email ? userData.email.trim() : `${trimmedUsername}@pabrik.co.id`,
        isActive: true,
        createdAt: new Date().toISOString(),
      };

      setUsers((prev) => [...prev, newUser]);

      addActivityLog({
        category: 'USER_CHANGE',
        action: 'USER_CREATED',
        title: 'Penambahan Akun Pengguna Baru',
        description: `Akun pengguna baru "${newUser.name}" (@${newUser.username}) dengan role ${newUser.role.toUpperCase()} (${newUser.department}) ditambahkan.`,
        referenceNumber: `@${newUser.username}`,
      });

      setActiveToast({
        id: Math.random().toString(),
        type: 'success',
        title: 'Akun Pengguna Baru Dibuat',
        message: `Akun "${newUser.username}" (${newUser.name}) berhasil ditambahkan oleh Admin.`,
      });

      return { success: true, user: newUser };
    },
    [users, addActivityLog]
  );

  const updateUser = useCallback(
    (userId: string, updates: Partial<UserAccount>) => {
      const targetUser = users.find((u) => u.id === userId);
      if (!targetUser) return { success: false, error: 'Pengguna tidak ditemukan.' };

      if (updates.username) {
        const trimmed = updates.username.trim().toLowerCase();
        if (users.some((u) => u.id !== userId && u.username.toLowerCase() === trimmed)) {
          return { success: false, error: `Username "${updates.username}" sudah dipakai akun lain.` };
        }
      }

      const updated = { ...targetUser, ...updates };
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));

      if (currentUser && currentUser.id === userId) {
        setCurrentUser(updated);
      }

      addActivityLog({
        category: 'USER_CHANGE',
        action: 'USER_UPDATED',
        title: 'Perubahan Profil Akun Pengguna',
        description: `Data akun @${updated.username} (${updated.name} - ${updated.department}) diperbarui oleh Admin.`,
        referenceNumber: `@${updated.username}`,
      });

      setActiveToast({
        id: Math.random().toString(),
        type: 'info',
        title: 'Data Pengguna Diperbarui',
        message: `Perubahan akun ${updated.username} berhasil disimpan.`,
      });

      return { success: true };
    },
    [currentUser, users, addActivityLog]
  );

  const resetUserPassword = useCallback(
    (userId: string, newPassword: string) => {
      if (!newPassword || newPassword.length < 4) {
        return { success: false, error: 'Password baru minimal 4 karakter.' };
      }

      const targetUser = users.find((u) => u.id === userId);
      if (!targetUser) return { success: false, error: 'Pengguna tidak ditemukan.' };

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, password: newPassword } : u))
      );

      addActivityLog({
        category: 'USER_CHANGE',
        action: 'PASSWORD_RESET',
        title: 'Reset Password Akun Pengguna',
        description: `Password untuk akun @${targetUser.username} (${targetUser.name}) telah direset oleh Admin.`,
        referenceNumber: `@${targetUser.username}`,
      });

      setActiveToast({
        id: Math.random().toString(),
        type: 'success',
        title: 'Password Berhasil Diubah',
        message: `Password akun ${targetUser.username} telah diperbarui oleh Admin.`,
      });

      return { success: true };
    },
    [users, addActivityLog]
  );

  const deleteUser = useCallback(
    (userId: string) => {
      if (currentUser && currentUser.id === userId) {
        return { success: false, error: 'Tidak dapat menghapus akun Anda sendiri yang sedang aktif login.' };
      }

      const target = users.find((u) => u.id === userId);
      if (!target) return { success: false, error: 'Pengguna tidak ditemukan.' };

      setUsers((prev) => prev.filter((u) => u.id !== userId));

      addActivityLog({
        category: 'USER_CHANGE',
        action: 'USER_DELETED',
        title: 'Penghapusan Akun Pengguna',
        description: `Akun pengguna @${target.username} (${target.name} - ${target.department}) dihapus dari sistem.`,
        referenceNumber: `@${target.username}`,
      });

      setActiveToast({
        id: Math.random().toString(),
        type: 'info',
        title: 'Pengguna Dihapus',
        message: `Akun ${target.username} (${target.name}) telah dihapus dari sistem.`,
      });

      return { success: true };
    },
    [currentUser, users, addActivityLog]
  );

  const toggleUserStatus = useCallback(
    (userId: string) => {
      if (currentUser && currentUser.id === userId) {
        return { success: false, error: 'Tidak dapat menonaktifkan akun Anda sendiri yang sedang aktif.' };
      }

      const target = users.find((u) => u.id === userId);
      if (!target) return { success: false, error: 'Pengguna tidak ditemukan.' };

      const newStatus = !target.isActive;
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isActive: newStatus } : u))
      );

      addActivityLog({
        category: 'USER_CHANGE',
        action: newStatus ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        title: newStatus ? 'Pengaktifan Akun Pengguna' : 'Penonaktifan Akun Pengguna',
        description: `Status akses login akun @${target.username} (${target.name}) diubah menjadi ${newStatus ? 'AKTIF' : 'NONAKTIF'}.`,
        referenceNumber: `@${target.username}`,
      });

      setActiveToast({
        id: Math.random().toString(),
        type: 'info',
        title: newStatus ? 'Akun Diaktifkan' : 'Akun Dinonaktifkan',
        message: `Status akun ${target.username} diubah menjadi ${newStatus ? 'Aktif' : 'Nonaktif'}.`,
      });

      return { success: true };
    },
    [currentUser, users, addActivityLog]
  );

  const dismissToast = () => {
    setActiveToast(null);
  };

  // Cost Center Management (Admin)
  const addCostCenter = useCallback((entry: CostCenterEntry) => {
    const code = entry.code.trim();
    const name = entry.name.trim();
    if (!code) return { success: false, error: 'Nomor / Kode Cost Center wajib diisi.' };
    if (!name) return { success: false, error: 'Nama / Keterangan Cost Center wajib diisi.' };
    if (costCenters.some((c) => c.code.toLowerCase() === code.toLowerCase())) {
      return { success: false, error: `Cost Center dengan kode "${code}" sudah terdaftar.` };
    }
    setCostCenters((prev) => [...prev, { code, name, description: entry.description?.trim() || '' }]);
    addActivityLog({
      category: 'MASTER_DATA',
      action: 'CC_ADDED',
      title: 'Penambahan Cost Center Baru',
      description: `Cost Center kode "${code}" (${name}) ditambahkan ke sistem.`,
      referenceNumber: `CC-${code}`,
    });
    setActiveToast({
      id: Math.random().toString(),
      type: 'success',
      title: 'Cost Center Ditambahkan',
      message: `Cost Center ${code} - ${name} berhasil disimpan.`,
    });
    return { success: true };
  }, [costCenters, addActivityLog]);

  const updateCostCenter = useCallback((oldCode: string, entry: CostCenterEntry) => {
    const code = entry.code.trim();
    const name = entry.name.trim();
    if (!code) return { success: false, error: 'Nomor / Kode Cost Center wajib diisi.' };
    if (!name) return { success: false, error: 'Nama / Keterangan Cost Center wajib diisi.' };
    if (
      code.toLowerCase() !== oldCode.toLowerCase() &&
      costCenters.some((c) => c.code.toLowerCase() === code.toLowerCase())
    ) {
      return { success: false, error: `Cost Center dengan kode "${code}" sudah digunakan.` };
    }
    setCostCenters((prev) =>
      prev.map((c) => (c.code === oldCode ? { code, name, description: entry.description?.trim() || '' } : c))
    );
    addActivityLog({
      category: 'MASTER_DATA',
      action: 'CC_UPDATED',
      title: 'Pembaruan Data Cost Center',
      description: `Cost Center kode "${oldCode}" diperbarui menjadi "${code} - ${name}".`,
      referenceNumber: `CC-${code}`,
    });
    setActiveToast({
      id: Math.random().toString(),
      type: 'info',
      title: 'Cost Center Diperbarui',
      message: `Data Cost Center ${code} - ${name} berhasil diperbarui.`,
    });
    return { success: true };
  }, [costCenters, addActivityLog]);

  const deleteCostCenter = useCallback((code: string) => {
    const target = costCenters.find((c) => c.code === code);
    setCostCenters((prev) => prev.filter((c) => c.code !== code));
    addActivityLog({
      category: 'MASTER_DATA',
      action: 'CC_DELETED',
      title: 'Penghapusan Cost Center',
      description: `Cost Center "${code}${target ? ` - ${target.name}` : ''}" dihapus oleh Admin.`,
      referenceNumber: `CC-${code}`,
    });
    setActiveToast({
      id: Math.random().toString(),
      type: 'info',
      title: 'Cost Center Dihapus',
      message: `Cost Center "${code}${target ? ` - ${target.name}` : ''}" berhasil dihapus dari tabel.`,
    });
    return { success: true };
  }, [costCenters, addActivityLog]);

  const clearAllCostCenters = useCallback(() => {
    const count = costCenters.length;
    setCostCenters([]);
    addActivityLog({
      category: 'MASTER_DATA',
      action: 'CC_CLEARED',
      title: 'Pengosongan Tabel Cost Center',
      description: `Seluruh data Cost Center (${count} baris) dikosongkan oleh Admin.`,
      referenceNumber: 'CC-CLEAR',
    });
    setActiveToast({
      id: Math.random().toString(),
      type: 'info',
      title: 'Tabel Cost Center Dikosongkan',
      message: `Seluruh ${count} data Cost Center telah dihapus.`,
    });
  }, [costCenters.length, addActivityLog]);

  const importCostCentersBulk = useCallback(
    (entries: CostCenterEntry[], mode: 'upsert' | 'replace' = 'upsert') => {
      if (!entries || entries.length === 0) {
        return { success: false, added: 0, updated: 0, totalAfter: costCenters.length, error: 'Tidak ada data Cost Center yang valid untuk diimpor.' };
      }

      let added = 0;
      let updated = 0;

      if (mode === 'replace') {
        const existingMap = new Map<string, CostCenterEntry>();
        costCenters.forEach((c) => existingMap.set(c.code.toLowerCase(), c));

        const cleanedMap = new Map<string, CostCenterEntry>();
        for (const item of entries) {
          const code = (item.code || '').toString().trim();
          const name = (item.name || '').toString().trim();
          if (code && name) {
            const key = code.toLowerCase();
            if (!cleanedMap.has(key)) {
              if (existingMap.has(key)) {
                updated++;
              } else {
                added++;
              }
            }
            cleanedMap.set(key, {
              code,
              name,
              description: item.description ? item.description.toString().trim() : '',
            });
          }
        }
        const finalList = Array.from(cleanedMap.values());
        setCostCenters(finalList);
        addActivityLog({
          category: 'MASTER_DATA',
          action: 'CC_IMPORTED',
          title: 'Import & Penyesuaian Tabel Cost Center',
          description: `Tabel Cost Center disesuaikan dari file import menjadi ${finalList.length} baris (${updated} nomor sama di-replace, ${added} nomor baru ditambahkan).`,
          referenceNumber: 'IMPORT-CC',
        });
        setActiveToast({
          id: Math.random().toString(),
          type: 'success',
          title: 'Import Cost Center Berhasil',
          message: `Jumlah tabel disesuaikan menjadi ${finalList.length} Cost Center (${updated} di-replace, ${added} baru).`,
        });
        return { success: true, added, updated, totalAfter: finalList.length };
      } else {
        // Upsert mode: Nomor sama -> di-replace, Nomor berbeda -> ditambahkan
        const map = new Map<string, CostCenterEntry>();
        costCenters.forEach((c) => map.set(c.code.toLowerCase(), c));

        const seenInBatch = new Set<string>();
        entries.forEach((item) => {
          const code = (item.code || '').toString().trim();
          const name = (item.name || '').toString().trim();
          if (code && name) {
            const key = code.toLowerCase();
            const existedBefore = map.has(key);
            map.set(key, {
              code,
              name,
              description: item.description ? item.description.toString().trim() : map.get(key)?.description || '',
            });
            if (!seenInBatch.has(key)) {
              seenInBatch.add(key);
              if (existedBefore) {
                updated++;
              } else {
                added++;
              }
            }
          }
        });

        const finalList = Array.from(map.values());
        setCostCenters(finalList);

        addActivityLog({
          category: 'MASTER_DATA',
          action: 'CC_IMPORTED',
          title: 'Import Excel Cost Center (Upsert/Replace)',
          description: `${updated} Cost Center dengan nomor sama di-replace, ${added} nomor berbeda ditambahkan. Total sekarang: ${finalList.length} Cost Center.`,
          referenceNumber: 'IMPORT-CC',
        });

        setActiveToast({
          id: Math.random().toString(),
          type: 'success',
          title: 'Import Excel Berhasil',
          message: `${updated} Cost Center nomor sama di-replace, ${added} nomor baru ditambahkan (Total: ${finalList.length}).`,
        });

        return { success: true, added, updated, totalAfter: finalList.length };
      }
    },
    [costCenters, addActivityLog]
  );

  // GL Account Management (Admin)
  const addGLAccount = useCallback((entry: GLAccountEntry) => {
    const code = entry.code.trim();
    const name = entry.name.trim();
    if (!code) return { success: false, error: 'Nomor GL Account wajib diisi.' };
    if (!name) return { success: false, error: 'Nama / Keterangan GL Account wajib diisi.' };
    if (glAccounts.some((g) => g.code.toLowerCase() === code.toLowerCase())) {
      return { success: false, error: `GL Account dengan nomor "${code}" sudah terdaftar.` };
    }
    setGlAccounts((prev) => [...prev, { code, name, description: entry.description?.trim() || '' }]);
    addActivityLog({
      category: 'MASTER_DATA',
      action: 'GL_ADDED',
      title: 'Penambahan GL Account Baru',
      description: `GL Account nomor "${code}" (${name}) ditambahkan ke sistem.`,
      referenceNumber: `GL-${code}`,
    });
    setActiveToast({
      id: Math.random().toString(),
      type: 'success',
      title: 'GL Account Ditambahkan',
      message: `GL Account ${code} - ${name} berhasil disimpan.`,
    });
    return { success: true };
  }, [glAccounts, addActivityLog]);

  const updateGLAccount = useCallback((oldCode: string, entry: GLAccountEntry) => {
    const code = entry.code.trim();
    const name = entry.name.trim();
    if (!code) return { success: false, error: 'Nomor GL Account wajib diisi.' };
    if (!name) return { success: false, error: 'Nama / Keterangan GL Account wajib diisi.' };
    if (
      code.toLowerCase() !== oldCode.toLowerCase() &&
      glAccounts.some((g) => g.code.toLowerCase() === code.toLowerCase())
    ) {
      return { success: false, error: `GL Account dengan nomor "${code}" sudah digunakan.` };
    }
    setGlAccounts((prev) =>
      prev.map((g) => (g.code === oldCode ? { code, name, description: entry.description?.trim() || '' } : g))
    );
    addActivityLog({
      category: 'MASTER_DATA',
      action: 'GL_UPDATED',
      title: 'Pembaruan Data GL Account',
      description: `GL Account nomor "${oldCode}" diperbarui menjadi "${code} - ${name}".`,
      referenceNumber: `GL-${code}`,
    });
    setActiveToast({
      id: Math.random().toString(),
      type: 'info',
      title: 'GL Account Diperbarui',
      message: `Data GL Account ${code} - ${name} berhasil diperbarui.`,
    });
    return { success: true };
  }, [glAccounts, addActivityLog]);

  const deleteGLAccount = useCallback((code: string) => {
    const target = glAccounts.find((g) => g.code === code);
    setGlAccounts((prev) => prev.filter((g) => g.code !== code));
    addActivityLog({
      category: 'MASTER_DATA',
      action: 'GL_DELETED',
      title: 'Penghapusan GL Account',
      description: `GL Account "${code}${target ? ` - ${target.name}` : ''}" dihapus oleh Admin.`,
      referenceNumber: `GL-${code}`,
    });
    setActiveToast({
      id: Math.random().toString(),
      type: 'info',
      title: 'GL Account Dihapus',
      message: `GL Account "${code}${target ? ` - ${target.name}` : ''}" berhasil dihapus dari tabel.`,
    });
    return { success: true };
  }, [glAccounts, addActivityLog]);

  const clearAllGLAccounts = useCallback(() => {
    const count = glAccounts.length;
    setGlAccounts([]);
    addActivityLog({
      category: 'MASTER_DATA',
      action: 'GL_CLEARED',
      title: 'Pengosongan Tabel GL Account',
      description: `Seluruh data GL Account (${count} baris) dikosongkan oleh Admin.`,
      referenceNumber: 'GL-CLEAR',
    });
    setActiveToast({
      id: Math.random().toString(),
      type: 'info',
      title: 'Tabel GL Account Dikosongkan',
      message: `Seluruh ${count} data GL Account telah dihapus.`,
    });
  }, [glAccounts.length, addActivityLog]);

  const importGLAccountsBulk = useCallback(
    (entries: GLAccountEntry[], mode: 'upsert' | 'replace' = 'upsert') => {
      if (!entries || entries.length === 0) {
        return { success: false, added: 0, updated: 0, totalAfter: glAccounts.length, error: 'Tidak ada data GL Account yang valid untuk diimpor.' };
      }

      let added = 0;
      let updated = 0;

      if (mode === 'replace') {
        const existingMap = new Map<string, GLAccountEntry>();
        glAccounts.forEach((g) => existingMap.set(g.code.toLowerCase(), g));

        const cleanedMap = new Map<string, GLAccountEntry>();
        for (const item of entries) {
          const code = (item.code || '').toString().trim();
          const name = (item.name || '').toString().trim();
          if (code && name) {
            const key = code.toLowerCase();
            if (!cleanedMap.has(key)) {
              if (existingMap.has(key)) {
                updated++;
              } else {
                added++;
              }
            }
            cleanedMap.set(key, {
              code,
              name,
              description: item.description ? item.description.toString().trim() : '',
            });
          }
        }
        const finalList = Array.from(cleanedMap.values());
        setGlAccounts(finalList);
        addActivityLog({
          category: 'MASTER_DATA',
          action: 'GL_IMPORTED',
          title: 'Import & Penyesuaian Tabel GL Account',
          description: `Tabel GL Account disesuaikan dari file import menjadi ${finalList.length} baris (${updated} nomor sama di-replace, ${added} nomor baru ditambahkan).`,
          referenceNumber: 'IMPORT-GL',
        });
        setActiveToast({
          id: Math.random().toString(),
          type: 'success',
          title: 'Import GL Account Berhasil',
          message: `Jumlah tabel disesuaikan menjadi ${finalList.length} GL Account (${updated} di-replace, ${added} baru).`,
        });
        return { success: true, added, updated, totalAfter: finalList.length };
      } else {
        // Upsert mode: Nomor sama -> di-replace, Nomor berbeda -> ditambahkan
        const map = new Map<string, GLAccountEntry>();
        glAccounts.forEach((g) => map.set(g.code.toLowerCase(), g));

        const seenInBatch = new Set<string>();
        entries.forEach((item) => {
          const code = (item.code || '').toString().trim();
          const name = (item.name || '').toString().trim();
          if (code && name) {
            const key = code.toLowerCase();
            const existedBefore = map.has(key);
            map.set(key, {
              code,
              name,
              description: item.description ? item.description.toString().trim() : map.get(key)?.description || '',
            });
            if (!seenInBatch.has(key)) {
              seenInBatch.add(key);
              if (existedBefore) {
                updated++;
              } else {
                added++;
              }
            }
          }
        });

        const finalList = Array.from(map.values());
        setGlAccounts(finalList);

        addActivityLog({
          category: 'MASTER_DATA',
          action: 'GL_IMPORTED',
          title: 'Import Excel GL Account (Upsert/Replace)',
          description: `${updated} GL Account dengan nomor sama di-replace, ${added} nomor berbeda ditambahkan. Total sekarang: ${finalList.length} GL Account.`,
          referenceNumber: 'IMPORT-GL',
        });

        setActiveToast({
          id: Math.random().toString(),
          type: 'success',
          title: 'Import Excel Berhasil',
          message: `${updated} GL Account nomor sama di-replace, ${added} nomor baru ditambahkan (Total: ${finalList.length}).`,
        });

        return { success: true, added, updated, totalAfter: finalList.length };
      }
    },
    [glAccounts, addActivityLog]
  );

  // Storage Location & Rak Management
  const addStorageLocation = useCallback(
    (loc: Omit<StorageLocation, 'id'>) => {
      const code = loc.code.trim();
      const name = loc.name.trim();
      if (!code) return { success: false, error: 'Kode / Nomor Rak wajib diisi.' };
      if (!name) return { success: false, error: 'Nama Lokasi / Rak wajib diisi.' };
      if (storageLocations.some((s) => s.code.toLowerCase() === code.toLowerCase())) {
        return { success: false, error: `Lokasi dengan kode "${code}" sudah terdaftar.` };
      }
      const newLoc: StorageLocation = {
        id: `loc_${Date.now()}`,
        code,
        name,
        zone: loc.zone?.trim() || 'Zona Umum',
        description: loc.description?.trim() || '',
      };
      setStorageLocations((prev) => [...prev, newLoc]);
      setActiveToast({
        id: Math.random().toString(),
        type: 'success',
        title: 'Lokasi Rak Ditambahkan',
        message: `Lokasi "${newLoc.code} - ${newLoc.name}" berhasil didaftarkan.`,
      });
      return { success: true, location: newLoc };
    },
    [storageLocations]
  );

  const updateStorageLocation = useCallback(
    (id: string, updates: Partial<StorageLocation>) => {
      const target = storageLocations.find((s) => s.id === id);
      if (!target) return { success: false, error: 'Lokasi tidak ditemukan.' };
      if (updates.code) {
        const codeTrimmed = updates.code.trim().toLowerCase();
        if (storageLocations.some((s) => s.id !== id && s.code.toLowerCase() === codeTrimmed)) {
          return { success: false, error: `Kode lokasi "${updates.code}" sudah digunakan.` };
        }
      }
      setStorageLocations((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
      );
      return { success: true };
    },
    [storageLocations]
  );

  const deleteStorageLocation = useCallback(
    (id: string) => {
      const target = storageLocations.find((s) => s.id === id);
      if (!target) return { success: false, error: 'Lokasi tidak ditemukan.' };
      const itemsInLocation = stockItems.filter(
        (i) => i.location.toLowerCase() === target.code.toLowerCase() || i.location.toLowerCase() === target.name.toLowerCase()
      );
      if (itemsInLocation.length > 0) {
        return {
          success: false,
          error: `Tidak dapat menghapus "${target.code}" karena masih digunakan oleh ${itemsInLocation.length} barang di katalog stok.`,
        };
      }
      setStorageLocations((prev) => prev.filter((s) => s.id !== id));
      setActiveToast({
        id: Math.random().toString(),
        type: 'info',
        title: 'Lokasi Dihapus',
        message: `Rak / Lokasi "${target.code}" telah dihapus.`,
      });
      return { success: true };
    },
    [storageLocations, stockItems]
  );

  // Bulk Import Stock Items via Excel
  const importStockItemsBulk = useCallback(
    (
      newItemsList: Array<{
        sku: string;
        name: string;
        category: string;
        unit: string;
        currentStock: number;
        minStock: number;
        location: string;
        description?: string;
      }>,
      mode: 'upsert' | 'add_only' = 'upsert'
    ) => {
      if (!newItemsList || newItemsList.length === 0) {
        return { success: false, added: 0, updated: 0, error: 'Tidak ada data barang yang valid untuk diimpor.' };
      }

      let added = 0;
      let updated = 0;
      const nowStr = new Date().toISOString();

      const itemMap = new Map<string, StockItem>();
      stockItems.forEach((i) => itemMap.set(i.sku.toUpperCase(), i));

      newItemsList.forEach((raw) => {
        const sku = (raw.sku || '').toString().trim().toUpperCase();
        const name = (raw.name || '').toString().trim();
        if (sku && name) {
          if (itemMap.has(sku)) {
            if (mode === 'upsert') {
              const existing = itemMap.get(sku)!;
              const updatedItem: StockItem = {
                ...existing,
                name,
                category: raw.category ? raw.category.trim() : existing.category,
                unit: raw.unit ? raw.unit.trim() : existing.unit,
                currentStock: Number(raw.currentStock) >= 0 ? Number(raw.currentStock) : existing.currentStock,
                minStock: Number(raw.minStock) >= 0 ? Number(raw.minStock) : existing.minStock,
                location: raw.location ? raw.location.trim() : existing.location,
                description: raw.description ? raw.description.trim() : existing.description,
                updatedAt: nowStr,
              };
              itemMap.set(sku, updatedItem);
              updated++;
            }
          } else {
            const newItem: StockItem = {
              id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              sku,
              name,
              category: raw.category ? raw.category.trim() : 'Sparepart Mesin',
              unit: raw.unit ? raw.unit.trim() : 'Pcs',
              currentStock: Number(raw.currentStock) >= 0 ? Number(raw.currentStock) : 0,
              allocatedStock: 0,
              minStock: Number(raw.minStock) >= 0 ? Number(raw.minStock) : 10,
              location: raw.location ? raw.location.trim() : 'Rak A-01',
              description: raw.description ? raw.description.trim() : '',
              updatedAt: nowStr,
            };
            itemMap.set(sku, newItem);
            added++;
          }
        }
      });

      const finalItems = Array.from(itemMap.values());
      setStockItems(finalItems);

      addActivityLog({
        category: 'STOCK_ADJUSTMENT',
        action: 'STOCK_IMPORTED',
        title: 'Import Katalog Master Barang via Excel',
        description: `${added} barang baru ditambahkan, ${updated} barang diperbarui dari Excel.`,
        referenceNumber: 'IMPORT-STOK',
      });

      setActiveToast({
        id: Math.random().toString(),
        type: 'success',
        title: 'Impor Barang Berhasil',
        message: `${added} barang baru berhasil ditambahkan, ${updated} barang diperbarui dari Excel.`,
      });

      return { success: true, added, updated };
    },
    [stockItems, addActivityLog]
  );

  // Company Profile & Branding Management
  const updateCompanyProfile = useCallback((updates: Partial<CompanyProfile>) => {
    setCompanyProfile((prev) => ({ ...prev, ...updates }));
    setActiveToast({
      id: Math.random().toString(),
      type: 'success',
      title: 'Profil Perusahaan Diperbarui',
      message: 'Perubahan logo, nama aplikasi & identitas perusahaan telah disimpan dan berlaku di seluruh sistem.',
    });
  }, []);

  const resetCompanyProfile = useCallback(() => {
    setCompanyProfile(INITIAL_COMPANY_PROFILE);
    localStorage.removeItem(STORAGE_KEYS.COMPANY_PROFILE);
    setActiveToast({
      id: Math.random().toString(),
      type: 'info',
      title: 'Profil Dikembalikan ke Default',
      message: 'Data nama dan logo perusahaan telah direset ke setelan awal.',
    });
  }, []);

  // 1A. Create LPB (Oleh User Admin Gudang: Input SJ Supplier, ACC & Validasi Barang / Scan Barcode)
  // - Dokumen LPB berstatus 'PENDING_APPROVAL' (Menunggu Approve Penambahan Stock oleh User Kepala Gudang)
  // - Stok fisik (currentStock) BELUM BERTAMBAH sampai di-approve oleh Kepala Gudang!
  const createLPB = useCallback(
    (data: {
      sjNumber: string;
      sjDate: string;
      supplierName: string;
      receivedDate: string;
      poNumber?: string;
      driverName?: string;
      vehiclePlate?: string;
      usagePurpose?: string;
      storageLocation?: string;
      notes?: string;
      items: Omit<LPBItem, 'sku' | 'itemName' | 'unit'>[];
    }): LPBDocument => {
      const now = new Date();
      const nowIso = now.toISOString();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const count = lpbDocuments.length + 1;
      const lpbNumber = `LPB-${yearMonth}-${String(count).padStart(4, '0')}`;

      // Map item full details
      const resolvedItems: LPBItem[] = data.items.map((entry) => {
        const stockItem = stockItems.find((s) => s.id === entry.itemId);
        return {
          itemId: entry.itemId,
          sku: stockItem ? stockItem.sku : 'SKU-UNKNOWN',
          itemName: stockItem ? stockItem.name : 'Unknown Item',
          unit: stockItem ? stockItem.unit : 'Pcs',
          quantity: Number(entry.quantity),
          batchNo: entry.batchNo || '-',
          condition: entry.condition,
          notes: entry.notes || '',
          storageLocation: entry.storageLocation || (stockItem ? stockItem.location : 'Rak A-01'),
          barcodeValidated: entry.barcodeValidated ?? true,
          barcodeScannedAt: entry.barcodeScannedAt || nowIso,
        };
      });

      const adminName = currentUser ? currentUser.name : 'Hendra Gunawan';

      const newLPB: LPBDocument = {
        id: `lpb_${Date.now()}`,
        lpbNumber,
        sjNumber: data.sjNumber,
        sjDate: data.sjDate,
        supplierName: data.supplierName,
        receivedDate: data.receivedDate,
        poNumber: data.poNumber || '-',
        driverName: data.driverName || '-',
        vehiclePlate: data.vehiclePlate || '-',
        usagePurpose: data.usagePurpose || 'Pemenuhan Stok Logistik Gudang',
        storageLocation: data.storageLocation || (resolvedItems[0]?.storageLocation || 'Rak A-01'),
        notes: data.notes || '',
        status: 'PENDING_APPROVAL', // Menunggu Approve Penambahan Stock oleh Kepala Gudang
        receivedByAdmin: adminName,
        adminValidatedAt: nowIso,
        verifiedBy: 'Menunggu Approve Kepala Gudang',
        items: resolvedItems,
        createdAt: nowIso,
      };

      // Kirim notifikasi ke Kepala Gudang untuk Approve Penambahan Stock
      const newNotif: AppNotification = {
        id: `notif_${Date.now()}`,
        targetRole: 'kepala_gudang',
        type: 'lpb_created',
        title: 'LPB Baru Divalidasi Admin — Menunggu Approve Penambahan Stock (Kepala Gudang)',
        message: `Admin Gudang (${adminName}) telah meng-ACC & memvalidasi scan barang LPB #${lpbNumber} (SJ: ${data.sjNumber} - ${data.supplierName}). Stok fisik belum bertambah — menunggu Approve Penambahan Stock oleh Kepala Gudang.`,
        lpbId: newLPB.id,
        read: false,
        timestamp: nowIso,
      };

      // PENTING: Stok fisik (currentStock) BELUM ditambah pada tahap Admin Gudang!
      setLpbDocuments((prev) => [newLPB, ...prev]);
      setNotifications((prev) => [newNotif, ...prev]);

      addActivityLog({
        category: 'APPROVAL_WORKFLOW',
        action: 'LPB_VALIDATED_ADMIN',
        title: 'ACC & Validasi/Scan Barang Masuk LPB oleh Admin Gudang (Stok Belum Bertambah)',
        description: `Admin Gudang (${adminName}) menginput & memvalidasi scan barcode LPB #${lpbNumber} dari SJ ${data.sjNumber} (${data.supplierName}): ${resolvedItems.map((i) => `${i.itemName} (${i.quantity} ${i.unit})`).join(', ')}. Stok fisik belum berubah — menunggu Approve Penambahan Stock oleh Kepala Gudang.`,
        referenceNumber: lpbNumber,
      });

      setActiveToast({
        id: Math.random().toString(),
        type: 'info',
        title: 'LPB Di-ACC & Divalidasi Admin (Stok Belum Bertambah)',
        message: `LPB #${lpbNumber} berhasil divalidasi Admin Gudang. Menunggu Approve Penambahan Stock oleh User Kepala Gudang agar stok fisik bertambah.`,
      });

      return newLPB;
    },
    [currentUser, lpbDocuments.length, stockItems, addActivityLog]
  );

  // 1B. Approve Penambahan Stock LPB (HANYA oleh User Kepala Gudang)
  // - Mengubah status LPB menjadi 'APPROVED' dan OTOMATIS MENAMBAH stok fisik gudang (currentStock) + mencatat Kartu Stok IN!
  const approveLPBStockAddition = useCallback(
    (
      lpbId: string,
      payload?: {
        warehouseHeadName?: string;
        notes?: string;
      }
    ) => {
      if (currentUser?.role !== 'kepala_gudang') {
        return {
          success: false,
          error:
            'User Admin hanya berwenang melakukan ACC & validasi barang/scan. Approve penambahan stock hanya dapat dilakukan oleh User Kepala Gudang!',
        };
      }

      const targetLPB = lpbDocuments.find((d) => d.id === lpbId);
      if (!targetLPB) {
        return { success: false, error: 'Dokumen LPB tidak ditemukan.' };
      }

      if (targetLPB.status === 'APPROVED') {
        return {
          success: false,
          error: 'Penambahan stock untuk LPB ini sudah di-approve oleh Kepala Gudang sebelumnya.',
        };
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const headName = payload?.warehouseHeadName?.trim() || currentUser.name || 'Suryadi';

      const updatedLPB: LPBDocument = {
        ...targetLPB,
        status: 'APPROVED',
        verifiedBy: `${headName} (Kepala Gudang)`,
        approvedByWarehouseHead: headName,
        approvedAt: nowIso,
        headApprovalNotes: payload?.notes?.trim() || 'Penambahan stock di-approve oleh Kepala Gudang.',
        notes: payload?.notes?.trim()
          ? `${targetLPB.notes ? targetLPB.notes + ' | ' : ''}Approve Kepala Gudang: ${payload.notes.trim()}`
          : targetLPB.notes,
      };

      // TAMBAHKAN currentStock untuk setiap item di LPB & catat di Kartu Stok (StockMovement IN)
      const newMovements: StockMovement[] = [];
      const updatedStockItems = stockItems.map((item) => {
        const incoming = targetLPB.items.find(
          (ri) => ri.itemId === item.id || ri.sku === item.sku
        );
        if (incoming && incoming.quantity > 0) {
          const balanceBefore = item.currentStock;
          const balanceAfter = balanceBefore + incoming.quantity;

          newMovements.push({
            id: `mov_${Date.now()}_${item.id}`,
            itemId: item.id,
            sku: item.sku,
            itemName: item.name,
            type: 'IN',
            source: 'LPB_SUPPLIER',
            referenceNumber: targetLPB.lpbNumber,
            secondaryRef: `SJ: ${targetLPB.sjNumber} (${targetLPB.supplierName})`,
            quantity: incoming.quantity,
            balanceBefore,
            balanceAfter,
            date: nowIso,
            actor: `${headName} (Approve Kepala Gudang) & ${targetLPB.receivedByAdmin} (Validasi Admin)`,
            notes:
              incoming.notes ||
              `Approve Penambahan Stock Kepala Gudang (${headName}) atas SJ ${targetLPB.supplierName}`,
          });

          return {
            ...item,
            currentStock: balanceAfter,
            location: incoming.storageLocation || item.location,
            updatedAt: nowIso,
          };
        }
        return item;
      });

      const newNotif: AppNotification = {
        id: `notif_${Date.now()}`,
        targetRole: 'all',
        type: 'lpb_created',
        title: 'Kepala Gudang Meng-Approve Penambahan Stock (LPB)',
        message: `Kepala Gudang (${headName}) telah meng-approve penambahan stock LPB #${targetLPB.lpbNumber} (SJ: ${targetLPB.sjNumber}). Total ${targetLPB.items.reduce((acc, i) => acc + i.quantity, 0)} unit resmi ditambahkan ke stok fisik gudang.`,
        lpbId: targetLPB.id,
        read: false,
        timestamp: nowIso,
      };

      setStockItems(updatedStockItems);
      setLpbDocuments((prev) => prev.map((d) => (d.id === lpbId ? updatedLPB : d)));
      setStockMovements((prev) => [...newMovements, ...prev]);
      setNotifications((prev) => [newNotif, ...prev]);

      addActivityLog({
        category: 'STOCK_ADJUSTMENT',
        action: 'LPB_CREATED',
        title: 'Approve Penambahan Stock LPB oleh Kepala Gudang (Stok Fisik Bertambah)',
        description: `Kepala Gudang (${headName}) meng-approve penambahan stock LPB #${targetLPB.lpbNumber} dari hasil validasi Admin Gudang (${targetLPB.receivedByAdmin}). Penambahan stok fisik: ${targetLPB.items.map((i) => `${i.itemName} +${i.quantity} ${i.unit}`).join(', ')}.`,
        referenceNumber: targetLPB.lpbNumber,
      });

      realtimeService.notifyStockReceived(updatedLPB);

      setActiveToast({
        id: Math.random().toString(),
        type: 'success',
        title: 'Penambahan Stock Di-Approve Kepala Gudang',
        message: `LPB #${targetLPB.lpbNumber} telah di-approve oleh Kepala Gudang (${headName}). Stok fisik gudang otomatis bertambah!`,
      });

      return { success: true };
    },
    [currentUser, lpbDocuments, stockItems, addActivityLog]
  );

  // 1C. Reject LPB (Oleh User Kepala Gudang)
  const rejectLPB = useCallback(
    (lpbId: string, reason: string) => {
      if (currentUser?.role !== 'kepala_gudang') {
        return {
          success: false,
          error: 'Hanya User Kepala Gudang yang berwenang menolak dokumen LPB.',
        };
      }
      const targetLPB = lpbDocuments.find((d) => d.id === lpbId);
      if (!targetLPB) return { success: false, error: 'Dokumen LPB tidak ditemukan.' };
      if (targetLPB.status === 'APPROVED') {
        return { success: false, error: 'LPB yang sudah di-approve penambahan stoknya tidak dapat ditolak.' };
      }

      setLpbDocuments((prev) =>
        prev.map((d) =>
          d.id === lpbId
            ? {
                ...d,
                status: 'REJECTED',
                rejectionReason: reason.trim() || 'Ditolak oleh Kepala Gudang',
                verifiedBy: `Ditolak oleh ${currentUser.name}`,
              }
            : d
        )
      );

      addActivityLog({
        category: 'APPROVAL_WORKFLOW',
        action: 'LPB_REJECTED',
        title: 'Penolakan Penambahan Stock LPB oleh Kepala Gudang',
        description: `Kepala Gudang (${currentUser.name}) menolak penambahan stock LPB #${targetLPB.lpbNumber}. Alasan: ${reason}`,
        referenceNumber: targetLPB.lpbNumber,
      });

      setActiveToast({
        id: Math.random().toString(),
        type: 'warning',
        title: 'LPB Ditolak Kepala Gudang',
        message: `Penambahan stock untuk LPB #${targetLPB.lpbNumber} ditolak (stok fisik tidak berubah).`,
      });

      return { success: true };
    },
    [currentUser, lpbDocuments, addActivityLog]
  );

  // 2. Create Issue Voucher / Nota Pengambilan Barang (By User)
  // Stock does NOT leave warehouse yet! It is marked as allocated/pending.
  const createIssueVoucher = useCallback(
    (data: {
      purpose: string;
      notes?: string;
      department?: string;
      items: { itemId: string; requestedQty: number; costCenter?: string; glAcc?: string }[];
    }) => {
      // Validate items & stock availability
      if (!data.items || data.items.length === 0) {
        return { success: false, error: 'Pilih minimal satu item barang untuk diambil.' };
      }

      for (const reqItem of data.items) {
        const item = stockItems.find((s) => s.id === reqItem.itemId);
        if (!item) {
          return { success: false, error: 'Barang yang dipilih tidak ditemukan di sistem.' };
        }
        const available = item.currentStock - item.allocatedStock;
        if (reqItem.requestedQty <= 0) {
          return { success: false, error: `Jumlah permintaan untuk ${item.name} harus lebih dari 0.` };
        }
        if (reqItem.requestedQty > available) {
          return {
            success: false,
            error: `Stok tersedia tidak mencukupi untuk ${item.name}. Tersedia: ${available} ${item.unit}, diminta: ${reqItem.requestedQty} ${item.unit}.`,
          };
        }
      }

      const now = new Date();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const count = issueVouchers.length + 1;
      const voucherNumber = `NPB-${yearMonth}-${String(count).padStart(4, '0')}`;

      const voucherItems: IssueVoucherItem[] = data.items.map((i) => {
        const s = stockItems.find((item) => item.id === i.itemId)!;
        return {
          itemId: s.id,
          sku: s.sku,
          itemName: s.name,
          unit: s.unit,
          requestedQty: Number(i.requestedQty),
          availableStockSnapshot: s.currentStock,
          costCenter: i.costCenter || '60',
          glAcc: i.glAcc || '51010',
        };
      });

      const newVoucher: IssueVoucherDocument = {
        id: `voucher_${Date.now()}`,
        voucherNumber,
        requestedBy: currentUser ? currentUser.name : 'User',
        approvedByRequester: currentUser ? currentUser.name : 'User',
        userId: currentUser ? currentUser.id : 'unknown',
        department: data.department || (currentUser ? currentUser.department : 'General'),
        requestDate: now.toISOString().split('T')[0],
        purpose: data.purpose,
        notes: data.notes || '',
        status: 'PENDING', // Menunggu ACC Kepala Gudang
        items: voucherItems,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      // Reserve / allocate stock (stok fisik TETAP, tapi dialokasikan agar tidak diambil rangkap)
      const updatedStockItems = stockItems.map((item) => {
        const requested = voucherItems.find((vi) => vi.itemId === item.id);
        if (requested) {
          return {
            ...item,
            allocatedStock: item.allocatedStock + requested.requestedQty,
          };
        }
        return item;
      });

      // Notification to Kepala Gudang / Admin
      const newNotif: AppNotification = {
        id: `notif_${Date.now()}`,
        targetRole: 'admin',
        type: 'voucher_created',
        title: 'Nota Pengambilan Baru Menunggu ACC Kepala Gudang',
        message: `${currentUser ? currentUser.name : 'User'} (${newVoucher.department}) menerbitkan nota #${voucherNumber} untuk keperluan: ${data.purpose}.`,
        voucherId: newVoucher.id,
        read: false,
        timestamp: now.toISOString(),
      };

      setStockItems(updatedStockItems);
      setIssueVouchers((prev) => [newVoucher, ...prev]);
      setNotifications((prev) => [newNotif, ...prev]);

      addActivityLog({
        category: 'APPROVAL_WORKFLOW',
        action: 'SIV_CREATED',
        title: 'Penerbitan Nota Pengambilan Barang (SIV)',
        description: `${newVoucher.requestedBy} (${newVoucher.department}) menerbitkan Nota SIV #${voucherNumber} untuk keperluan "${data.purpose}" (${voucherItems.length} item barang).`,
        referenceNumber: voucherNumber,
      });

      // Broadcast event
      realtimeService.notifyVoucherCreated(newVoucher);

      return { success: true, voucher: newVoucher };
    },
    [currentUser, issueVouchers.length, stockItems, addActivityLog]
  );

  // 3A. Tahap 2 (Oleh User Admin Gudang): Meng-ACC SIV & Validasi Barang (Scan Barcode) + Qty Barang yang Diserahkan
  // - Dilakukan pada SIV berstatus 'PENDING'
  // - SIV langsung TERKUNCI (user pemohon tidak bisa hapus maupun edit)
  // - TETAPI STOCK FISIK BELUM AKAN BERUBAH sampai Kepala Gudang memverifikasi pengeluaran stock
  const completeIssueVoucherHandover = useCallback(
    (
      voucherId: string,
      payload: {
        recipientName: string;
        handoverOfficer?: string;
        notes?: string;
        itemsValidation?: {
          itemId: string;
          sku?: string;
          issuedQty: number;
          isCancelled: boolean;
          barcodeValidated?: boolean;
          barcodeScanned?: boolean;
          barcodeScannedAt?: string;
        }[];
        validatedItems?: {
          itemId: string;
          issuedQty: number;
          isCancelled: boolean;
          barcodeScanned?: boolean;
        }[];
      }
    ) => {
      const voucher = issueVouchers.find((v) => v.id === voucherId);
      if (!voucher) {
        return { success: false, error: 'Nota pengambilan barang tidak ditemukan.' };
      }

      if (currentUser?.role !== 'admin') {
        return {
          success: false,
          error:
            'Hanya User Admin Gudang yang berwenang melakukan ACC SIV & validasi barang/scan barcode.',
        };
      }

      if (voucher.status !== 'PENDING') {
        return {
          success: false,
          error: 'SIV ini sudah diverifikasi oleh Admin Gudang sebelumnya.',
        };
      }

      if (!payload.recipientName.trim()) {
        return {
          success: false,
          error: 'Nama penerima barang wajib diinputkan oleh Admin Gudang.',
        };
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const adminOfficer =
        payload.handoverOfficer?.trim() ||
        (currentUser ? currentUser.name : 'Hendra Gunawan');

      const rawValidations = payload.itemsValidation || payload.validatedItems || [];

      const updatedItems: IssueVoucherItem[] = voucher.items.map((item) => {
        const val = rawValidations.find(
          (v) => v.itemId === item.itemId || ('sku' in v && v.sku === item.sku)
        );
        if (!val) {
          return {
            ...item,
            approvedQty: item.requestedQty,
            issuedQty: item.requestedQty,
            isCancelled: false,
            barcodeValidated: true,
            barcodeScanned: true,
            barcodeScannedAt: nowIso,
          };
        }
        const finalQty = val.isCancelled ? 0 : Math.max(0, Number(val.issuedQty || 0));
        const isScanned =
          ('barcodeValidated' in val && val.barcodeValidated) ||
          ('barcodeScanned' in val && val.barcodeScanned) ||
          true;

        return {
          ...item,
          approvedQty: finalQty,
          issuedQty: finalQty,
          isCancelled: val.isCancelled || finalQty === 0,
          barcodeValidated: isScanned,
          barcodeScanned: isScanned,
          barcodeScannedAt:
            ('barcodeScannedAt' in val && val.barcodeScannedAt) || nowIso,
        };
      });

      const updatedVoucher: IssueVoucherDocument = {
        ...voucher,
        status: 'APPROVED', // SIV Terkunci (Admin Gudang sudah ACC & validasi barang/qty, stok fisik BELUM berubah, menunggu verifikasi Kepala Gudang)
        approvedByRequester: voucher.approvedByRequester || voucher.requestedBy,
        approvedByAdmin: adminOfficer,
        handoverOfficer: adminOfficer,
        handoverAt: nowIso,
        recipientName: payload.recipientName.trim(),
        items: updatedItems,
        notes: payload.notes
          ? `${voucher.notes ? voucher.notes + ' | ' : ''}Validasi Admin Gudang: ${payload.notes}`
          : voucher.notes,
        updatedAt: nowIso,
      };

      const issuedSummary = updatedItems
        .filter((i) => (i.issuedQty ?? 0) > 0 && !i.isCancelled)
        .map((i) => `${i.itemName} (${i.issuedQty} ${i.unit})`)
        .join(', ');

      const cancelledSummary = updatedItems
        .filter((i) => i.isCancelled || (i.issuedQty ?? 0) === 0)
        .map((i) => i.itemName)
        .join(', ');

      const newNotif: AppNotification = {
        id: `notif_${Date.now()}`,
        targetRole: 'all',
        type: 'voucher_approved',
        title: 'SIV Di-ACC & Divalidasi Admin Gudang (Menunggu Verifikasi Kepala Gudang)',
        message: `Nota #${voucher.voucherNumber} telah di-ACC & divalidasi oleh Admin Gudang (${adminOfficer}) untuk penerima ${payload.recipientName.trim()}. SIV kini terkunci (stok belum berubah), menunggu verifikasi pengeluaran stok oleh Kepala Gudang.`,
        voucherId: voucher.id,
        read: false,
        timestamp: nowIso,
      };

      // PENTING: Stok fisik (currentStock) BELUM diubah pada tahap ini!
      setIssueVouchers((prev) =>
        prev.map((v) => (v.id === voucherId ? updatedVoucher : v))
      );
      setNotifications((prev) => [newNotif, ...prev]);

      addActivityLog({
        category: 'APPROVAL_WORKFLOW',
        action: 'SIV_APPROVED',
        title: 'ACC SIV & Validasi Barang oleh Admin Gudang (SIV Terkunci · Stok Belum Berubah)',
        description: `Admin Gudang (${adminOfficer}) meng-ACC Nota #${voucher.voucherNumber} dan memvalidasi scan barcode barang untuk penerima "${payload.recipientName.trim()}". SIV terkunci (pemohon tidak dapat edit/hapus), stok fisik belum berubah menunggu verifikasi Kepala Gudang. Barang divalidasi: ${issuedSummary || 'Tidak ada (0)'}${cancelledSummary ? `. Batal dikeluarkan (Qty 0): ${cancelledSummary}` : ''}.`,
        referenceNumber: voucher.voucherNumber,
      });

      setActiveToast({
        id: Math.random().toString(),
        type: 'success',
        title: 'ACC & Validasi Admin Gudang Selesai (SIV Terkunci)',
        message: `Nota #${voucher.voucherNumber} telah terkunci. Stok fisik belum berubah — menunggu verifikasi pengeluaran stock oleh Kepala Gudang.`,
        voucherNumber: voucher.voucherNumber,
      });

      realtimeService.notifyVoucherApproved(updatedVoucher);

      return { success: true, voucher: updatedVoucher };
    },
    [currentUser, issueVouchers, addActivityLog]
  );

  // 3B. Tahap 3 (Oleh User Kepala Gudang): Verifikasi Pengeluaran Stock yang dilakukan Admin Gudang
  // - Otomatis mempengaruhi / memotong stock fisik gudang (currentStock) dan mencatat Kartu Stok!
  const approveIssueVoucher = useCallback(
    (
      voucherId: string,
      handover?: {
        warehouseHeadName?: string;
        approverAdminName?: string;
        notes?: string;
        handoverOfficer?: string;
        recipientName?: string;
      }
    ) => {
      const voucher = issueVouchers.find((v) => v.id === voucherId);
      if (!voucher) {
        return { success: false, error: 'Nota pengambilan barang tidak ditemukan.' };
      }

      if (voucher.status === 'HANDOVER_COMPLETED') {
        return {
          success: false,
          error: 'Pengeluaran stock untuk SIV ini sudah diverifikasi oleh Kepala Gudang sebelumnya!',
        };
      }

      if (currentUser?.role !== 'kepala_gudang') {
        return {
          success: false,
          error:
            'User Admin hanya berwenang melakukan ACC & validasi barang/scan. Approve pengurangan stock hanya dapat dilakukan oleh User Kepala Gudang!',
        };
      }

      if (voucher.status === 'PENDING') {
        return {
          success: false,
          error:
            'Nota SIV ini belum di-ACC dan belum divalidasi/scan barang oleh User Admin Gudang! Silakan lakukan ACC & validasi barang oleh Admin Gudang terlebih dahulu.',
        };
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const headUser = users.find((u) => u.role === 'kepala_gudang');
      const warehouseHeadName =
        handover?.warehouseHeadName?.trim() ||
        (currentUser?.role === 'kepala_gudang' ? currentUser.name : headUser?.name || 'Suryadi');

      // Status === 'APPROVED': Kepala Gudang meng-approve pengurangan stock yang sudah divalidasi Admin Gudang -> Otomatis mempengaruhi / memotong stock!
      const adminOfficer =
        voucher.handoverOfficer || voucher.approvedByAdmin || 'Hendra Gunawan';
      const recipientName = voucher.recipientName || voucher.requestedBy;

      const updatedVoucher: IssueVoucherDocument = {
        ...voucher,
        status: 'HANDOVER_COMPLETED',
        approvedByRequester: voucher.approvedByRequester || voucher.requestedBy,
        approvedByAdmin: adminOfficer,
        handoverOfficer: adminOfficer,
        handoverAt: voucher.handoverAt || nowIso,
        recipientName,
        warehouseHeadName,
        approvedByWarehouseHead: warehouseHeadName,
        headApprovedAt: nowIso,
        approvedAt: nowIso,
        notes: handover?.notes
          ? `${voucher.notes ? voucher.notes + ' | ' : ''}Verifikasi Kepala Gudang: ${handover.notes}`
          : voucher.notes,
        updatedAt: nowIso,
      };

      // Potong stok fisik HANYA untuk barang dengan issuedQty > 0 yang telah divalidasi Admin Gudang
      const newMovements: StockMovement[] = [];
      const updatedStockItems = stockItems.map((stock) => {
        const vItem = voucher.items.find(
          (vi) => vi.itemId === stock.id || vi.sku === stock.sku
        );
        if (!vItem) return stock;

        const actualIssued = vItem.isCancelled
          ? 0
          : Math.max(0, vItem.issuedQty ?? vItem.requestedQty);
        const balanceBefore = stock.currentStock;
        const balanceAfter = Math.max(0, balanceBefore - actualIssued);

        if (actualIssued > 0) {
          newMovements.push({
            id: `mov_${Date.now()}_${stock.id}`,
            itemId: stock.id,
            sku: stock.sku,
            itemName: stock.name,
            type: 'OUT',
            source: 'NOTA_PENGAMBILAN',
            referenceNumber: voucher.voucherNumber,
            secondaryRef: `${voucher.department} (Penerima: ${recipientName})`,
            quantity: actualIssued,
            balanceBefore,
            balanceAfter,
            date: nowIso,
            actor: `${warehouseHeadName} (Verifikasi Kepala Gudang) & ${adminOfficer} (Admin Gudang)`,
            notes: `Verifikasi pengeluaran stock oleh Kepala Gudang (${warehouseHeadName}) atas validasi Admin Gudang (${adminOfficer})`,
          });
        }

        return {
          ...stock,
          currentStock: balanceAfter,
          allocatedStock: Math.max(0, stock.allocatedStock - vItem.requestedQty),
          updatedAt: nowIso,
        };
      });

      const issuedSummary = voucher.items
        .filter((i) => !i.isCancelled && (i.issuedQty ?? i.requestedQty) > 0)
        .map((i) => `${i.itemName} (${i.issuedQty ?? i.requestedQty} ${i.unit})`)
        .join(', ');

      const newNotif: AppNotification = {
        id: `notif_${Date.now()}`,
        targetUserId: voucher.userId,
        type: 'voucher_approved',
        title: 'Kepala Gudang Memverifikasi Pengeluaran Stock SIV (Stok Terpotong)',
        message: `Kepala Gudang (${warehouseHeadName}) telah memverifikasi pengeluaran stock Nota #${voucher.voucherNumber}. Stok fisik gudang otomatis diperbarui.`,
        voucherId: voucher.id,
        read: false,
        timestamp: nowIso,
      };

      setStockItems(updatedStockItems);
      setIssueVouchers((prev) =>
        prev.map((v) => (v.id === voucherId ? updatedVoucher : v))
      );
      if (newMovements.length > 0) {
        setStockMovements((prev) => [...newMovements, ...prev]);
      }
      setNotifications((prev) => [newNotif, ...prev]);

      addActivityLog({
        category: 'APPROVAL_WORKFLOW',
        action: 'SIV_HANDOVER_COMPLETED',
        title: 'Verifikasi Pengeluaran Stock oleh Kepala Gudang',
        description: `Kepala Gudang (${warehouseHeadName}) memverifikasi pengeluaran stock Nota #${voucher.voucherNumber} yang divalidasi oleh Admin Gudang (${adminOfficer}). Stok fisik otomatis dipotong.`,
        referenceNumber: voucher.voucherNumber,
      });

      if (newMovements.length > 0) {
        addActivityLog({
          category: 'STOCK_ADJUSTMENT',
          action: 'STOCK_DEDUCTED_SIV',
          title: 'Pemotongan Otomatis Stok Fisik (Verifikasi Kepala Gudang)',
          description: `Stok fisik gudang otomatis berkurang setelah verifikasi Kepala Gudang (${warehouseHeadName}) pada Nota #${voucher.voucherNumber}: ${issuedSummary}.`,
          referenceNumber: voucher.voucherNumber,
        });
      }

      setActiveToast({
        id: Math.random().toString(),
        type: 'success',
        title: 'Verifikasi Kepala Gudang Selesai (Stok Otomatis Berkurang)',
        message: `Nota #${voucher.voucherNumber} telah diverifikasi oleh Kepala Gudang (${warehouseHeadName}). Stok fisik resmi terpotong.`,
        voucherNumber: voucher.voucherNumber,
      });

      realtimeService.notifyVoucherApproved(updatedVoucher);

      return { success: true };
    },
    [currentUser, users, issueVouchers, stockItems, completeIssueVoucherHandover, addActivityLog]
  );

  // 4. Reject Issue Voucher
  const rejectIssueVoucher = useCallback(
    (voucherId: string, reason: string) => {
      const voucher = issueVouchers.find((v) => v.id === voucherId);
      if (!voucher) return { success: false, error: 'Nota tidak ditemukan.' };
      if (voucher.status === 'HANDOVER_COMPLETED') {
        return { success: false, error: 'Nota yang barangnya sudah diserahkan tidak dapat ditolak!' };
      }

      const now = new Date();
      const updatedVoucher: IssueVoucherDocument = {
        ...voucher,
        status: 'REJECTED',
        rejectionReason: reason,
        updatedAt: now.toISOString(),
      };

      // Release allocated stock
      const updatedStockItems = stockItems.map((item) => {
        const vItem = voucher.items.find((vi) => vi.itemId === item.id);
        if (vItem) {
          return {
            ...item,
            allocatedStock: Math.max(0, item.allocatedStock - vItem.requestedQty),
          };
        }
        return item;
      });

      const newNotif: AppNotification = {
        id: `notif_${Date.now()}`,
        targetUserId: voucher.userId,
        type: 'voucher_rejected',
        title: 'Nota Pengambilan Ditolak',
        message: `Nota #${voucher.voucherNumber} ditolak. Alasan: ${reason}`,
        voucherId: voucher.id,
        read: false,
        timestamp: now.toISOString(),
      };

      setStockItems(updatedStockItems);
      setIssueVouchers((prev) =>
        prev.map((v) => (v.id === voucherId ? updatedVoucher : v))
      );
      setNotifications((prev) => [newNotif, ...prev]);

      addActivityLog({
        category: 'APPROVAL_WORKFLOW',
        action: 'SIV_REJECTED',
        title: 'Penolakan Nota Pengambilan Barang (SIV)',
        description: `Nota #${voucher.voucherNumber} (${voucher.requestedBy}) ditolak. Alasan: ${reason}`,
        referenceNumber: voucher.voucherNumber,
      });

      realtimeService.notifyVoucherRejected(updatedVoucher);

      return { success: true };
    },
    [issueVouchers, stockItems, addActivityLog]
  );

  // 5. Update Issue Voucher (Strictly locked if APPROVED or HANDOVER_COMPLETED!)
  const updateIssueVoucher = useCallback(
    (
      voucherId: string,
      data: {
        purpose: string;
        notes?: string;
        items: { itemId: string; requestedQty: number; costCenter?: string; glAcc?: string }[];
      }
    ) => {
      const voucher = issueVouchers.find((v) => v.id === voucherId);
      if (!voucher) return { success: false, error: 'Nota tidak ditemukan.' };

      if (voucher.status === 'APPROVED' || voucher.status === 'HANDOVER_COMPLETED') {
        return {
          success: false,
          error: 'Nota sudah di-approve! Dokumen telah terkunci secara permanen dan tidak dapat diubah.',
        };
      }

      // First, restore old allocated stock
      let tempStock = stockItems.map((item) => {
        const oldItem = voucher.items.find((vi) => vi.itemId === item.id);
        if (oldItem) {
          return {
            ...item,
            allocatedStock: Math.max(0, item.allocatedStock - oldItem.requestedQty),
          };
        }
        return item;
      });

      // Verify new requested items
      for (const reqItem of data.items) {
        const item = tempStock.find((s) => s.id === reqItem.itemId);
        if (!item) return { success: false, error: 'Barang tidak ditemukan.' };
        const available = item.currentStock - item.allocatedStock;
        if (reqItem.requestedQty > available) {
          return {
            success: false,
            error: `Stok tersedia tidak mencukupi untuk ${item.name} (${available} ${item.unit} tersedia).`,
          };
        }
      }

      // Re-allocate
      const newVoucherItems: IssueVoucherItem[] = data.items.map((i) => {
        const s = tempStock.find((item) => item.id === i.itemId)!;
        return {
          itemId: s.id,
          sku: s.sku,
          itemName: s.name,
          unit: s.unit,
          requestedQty: Number(i.requestedQty),
          availableStockSnapshot: s.currentStock,
          costCenter: i.costCenter || '60',
          glAcc: i.glAcc || '51010',
        };
      });

      tempStock = tempStock.map((item) => {
        const req = newVoucherItems.find((vi) => vi.itemId === item.id);
        if (req) {
          return {
            ...item,
            allocatedStock: item.allocatedStock + req.requestedQty,
          };
        }
        return item;
      });

      const updatedVoucher: IssueVoucherDocument = {
        ...voucher,
        purpose: data.purpose,
        notes: data.notes || '',
        items: newVoucherItems,
        updatedAt: new Date().toISOString(),
      };

      setStockItems(tempStock);
      setIssueVouchers((prev) =>
        prev.map((v) => (v.id === voucherId ? updatedVoucher : v))
      );

      setActiveToast({
        id: Math.random().toString(),
        type: 'info',
        title: 'Nota Berhasil Diperbarui',
        message: `Nota #${voucher.voucherNumber} berhasil diperbarui.`,
      });

      return { success: true };
    },
    [issueVouchers, stockItems]
  );

  // 6. Delete Issue Voucher (Strictly locked if APPROVED or HANDOVER_COMPLETED!)
  const deleteIssueVoucher = useCallback(
    (voucherId: string) => {
      const voucher = issueVouchers.find((v) => v.id === voucherId);
      if (!voucher) return { success: false, error: 'Nota tidak ditemukan.' };

      if (voucher.status === 'APPROVED' || voucher.status === 'HANDOVER_COMPLETED') {
        return {
          success: false,
          error: 'Nota sudah di-approve! Dokumen resmi tidak dapat dihapus.',
        };
      }

      // If pending, release allocated stock
      if (voucher.status === 'PENDING') {
        const updatedStockItems = stockItems.map((item) => {
          const vItem = voucher.items.find((vi) => vi.itemId === item.id);
          if (vItem) {
            return {
              ...item,
              allocatedStock: Math.max(0, item.allocatedStock - vItem.requestedQty),
            };
          }
          return item;
        });
        setStockItems(updatedStockItems);
      }

      setIssueVouchers((prev) => prev.filter((v) => v.id !== voucherId));

      setActiveToast({
        id: Math.random().toString(),
        type: 'info',
        title: 'Nota Dihapus',
        message: `Nota #${voucher.voucherNumber} berhasil dihapus/dibatalkan.`,
      });

      return { success: true };
    },
    [issueVouchers, stockItems]
  );

  const markNotificationAsRead = (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
  };

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const addNewStockItem = (itemData: Omit<StockItem, 'id' | 'allocatedStock' | 'updatedAt'>) => {
    const newItem: StockItem = {
      ...itemData,
      id: `item_${Date.now()}`,
      allocatedStock: 0,
      updatedAt: new Date().toISOString(),
    };
    setStockItems((prev) => [newItem, ...prev]);

    // Initial movement
    if (newItem.currentStock > 0) {
      const newMovement: StockMovement = {
        id: `mov_${Date.now()}_init`,
        itemId: newItem.id,
        sku: newItem.sku,
        itemName: newItem.name,
        type: 'IN',
        source: 'PENYESUAIAN_AWAL',
        referenceNumber: 'SALDO-AWAL',
        secondaryRef: 'Setup Barang Baru',
        quantity: newItem.currentStock,
        balanceBefore: 0,
        balanceAfter: newItem.currentStock,
        date: new Date().toISOString(),
        actor: currentUser ? currentUser.name : 'Admin Gudang',
        notes: 'Pencatatan saldo awal barang master baru',
      };
      setStockMovements((prev) => [newMovement, ...prev]);
    }

    addActivityLog({
      category: 'STOCK_ADJUSTMENT',
      action: 'ITEM_CREATED',
      title: 'Penambahan Master Barang Baru',
      description: `Barang baru "${newItem.name}" (${newItem.sku}) ditambahkan di ${newItem.location} dengan saldo awal ${newItem.currentStock} ${newItem.unit} (Stok Min: ${newItem.minStock} ${newItem.unit}).`,
      referenceNumber: newItem.sku,
    });

    return newItem;
  };

  const updateStockItem = (id: string, updates: Partial<StockItem>) => {
    const target = stockItems.find((i) => i.id === id);
    setStockItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item
      )
    );
    if (target) {
      addActivityLog({
        category: 'STOCK_ADJUSTMENT',
        action: 'ITEM_UPDATED',
        title: 'Pembaruan Spesifikasi / Stok Minimum Barang',
        description: `Data master barang ${updates.sku || target.sku} (${updates.name || target.name}) diperbarui${updates.minStock !== undefined ? `, Stok Minimum: ${updates.minStock} ${updates.unit || target.unit}` : ''}.`,
        referenceNumber: updates.sku || target.sku,
      });
    }
  };

  const deleteStockItem = (id: string): { success: boolean; error?: string } => {
    const item = stockItems.find((i) => i.id === id);
    if (!item) {
      return { success: false, error: 'Barang tidak ditemukan.' };
    }
    if (item.allocatedStock > 0) {
      return {
        success: false,
        error: `Barang "${item.name}" tidak dapat dihapus karena sedang dialokasikan (${item.allocatedStock} ${item.unit}) dalam nota pengambilan pending!`,
      };
    }
    setStockItems((prev) => prev.filter((i) => i.id !== id));
    addActivityLog({
      category: 'STOCK_ADJUSTMENT',
      action: 'ITEM_DELETED',
      title: 'Penghapusan SKU Master Barang',
      description: `Master barang ${item.sku} - ${item.name} dihapus dari sistem.`,
      referenceNumber: item.sku,
    });
    setActiveToast({
      id: Math.random().toString(),
      type: 'info',
      title: 'Barang Dihapus',
      message: `Master barang ${item.sku} - ${item.name} berhasil dihapus dari sistem.`,
    });
    return { success: true };
  };

  // Batas Stok Minimal Proposals & Actions (Alur 3 Tahap):
  // Tahap 1: Pengajuan oleh User Pemohon (Status 'PENDING' — masih bisa diedit/dihapus sebelum diverifikasi Admin Gudang)
  // Tahap 2: Verifikasi oleh User Admin Gudang (Status 'VERIFIED_ADMIN' — permohonan TERKUNCI tetapi BELUM mengganti data minimal stock pada sistem)
  // Tahap 3: Approval oleh User Kepala Gudang dari hasil verifikasi Admin Gudang (Status 'APPROVED' — data minimal stock pada sistem RESMI BERUBAH)
  const createMinStockProposal = (data: {
    itemId: string;
    proposedMinStock: number;
    reason: string;
  }) => {
    if (!currentUser) return { success: false, error: 'Silakan login terlebih dahulu' };
    const targetItem = stockItems.find((i) => i.id === data.itemId);
    if (!targetItem) return { success: false, error: 'Item barang tidak ditemukan' };
    if (data.proposedMinStock <= 0) return { success: false, error: 'Usulan batas stok minimal harus lebih dari 0' };
    if (!data.reason.trim()) return { success: false, error: 'Alasan/justifikasi pengajuan wajib diisi' };

    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const count = minStockProposals.length + 1;
    const proposalNumber = `PROP-MIN-${yearMonth}-${String(count).padStart(4, '0')}`;

    const newProposal: MinStockProposal = {
      id: `prop_min_${Date.now()}`,
      proposalNumber,
      itemId: targetItem.id,
      sku: targetItem.sku,
      itemName: targetItem.name,
      unit: targetItem.unit,
      currentMinStock: targetItem.minStock,
      proposedMinStock: Number(data.proposedMinStock),
      reason: data.reason.trim(),
      requestedBy: currentUser.name,
      requestedByUserId: currentUser.id,
      requestedByRole: currentUser.role,
      requestDate: now.toISOString(),
      status: 'PENDING',
    };

    setMinStockProposals((prev) => [newProposal, ...prev]);

    addActivityLog({
      category: 'APPROVAL_WORKFLOW',
      action: 'MIN_STOCK_PROPOSED',
      title: 'Pengajuan Perubahan Stok Minimal (Tahap 1)',
      description: `${currentUser.name} mengajukan perubahan stok minimal untuk ${targetItem.name} (${targetItem.sku}) dari ${targetItem.minStock} menjadi ${data.proposedMinStock} ${targetItem.unit}. Menunggu verifikasi Admin Gudang.`,
      referenceNumber: proposalNumber,
    });

    // Kirim notifikasi ke Admin Gudang untuk verifikasi
    const adminNotif: AppNotification = {
      id: `notif_${Date.now()}`,
      targetRole: 'admin',
      type: 'min_stock_proposal',
      title: 'Pengajuan Stok Minimal Menunggu Verifikasi Admin',
      message: `${currentUser.name} mengajukan perubahan stok minimal untuk ${targetItem.name} (${targetItem.sku}) dari ${targetItem.minStock} menjadi ${data.proposedMinStock} ${targetItem.unit}. Silakan lakukan verifikasi.`,
      proposalId: newProposal.id,
      read: false,
      timestamp: now.toISOString(),
    };
    setNotifications((prev) => [adminNotif, ...prev]);

    setActiveToast({
      id: Math.random().toString(),
      type: 'info',
      title: 'Pengajuan Stok Minimal Terkirim',
      message: `Usulan #${proposalNumber} berhasil diajukan. Menunggu verifikasi oleh Admin Gudang (selanjutnya di-approve oleh Kepala Gudang).`,
    });

    return { success: true, proposal: newProposal };
  };

  // Edit Pengajuan Minimal Stock (Hanya bisa jika belum diverifikasi oleh Admin Gudang -> status === 'PENDING')
  const updateMinStockProposal = (
    proposalId: string,
    data: {
      proposedMinStock: number;
      reason: string;
    }
  ) => {
    const proposal = minStockProposals.find((p) => p.id === proposalId);
    if (!proposal) return { success: false, error: 'Pengajuan tidak ditemukan.' };
    if (proposal.status !== 'PENDING') {
      return {
        success: false,
        error: 'Permohonan sudah diverifikasi oleh Admin Gudang dan telah terkunci! Tidak dapat diedit.',
      };
    }
    if (data.proposedMinStock <= 0) {
      return { success: false, error: 'Usulan batas stok minimal harus lebih dari 0.' };
    }
    if (!data.reason.trim()) {
      return { success: false, error: 'Alasan pengajuan wajib diisi.' };
    }

    setMinStockProposals((prev) =>
      prev.map((p) =>
        p.id === proposalId
          ? {
              ...p,
              proposedMinStock: Number(data.proposedMinStock),
              reason: data.reason.trim(),
            }
          : p
      )
    );

    setActiveToast({
      id: Math.random().toString(),
      type: 'info',
      title: 'Pengajuan Stok Minimal Diperbarui',
      message: `Permohonan #${proposal.proposalNumber} berhasil diperbarui sebelum diverifikasi Admin Gudang.`,
    });

    return { success: true };
  };

  // Hapus / Batalkan Pengajuan Minimal Stock (Hanya bisa jika belum diverifikasi oleh Admin Gudang -> status === 'PENDING')
  const deleteMinStockProposal = (proposalId: string) => {
    const proposal = minStockProposals.find((p) => p.id === proposalId);
    if (!proposal) return { success: false, error: 'Pengajuan tidak ditemukan.' };
    if (proposal.status !== 'PENDING') {
      return {
        success: false,
        error: 'Permohonan sudah diverifikasi oleh Admin Gudang dan telah terkunci! Tidak dapat dihapus.',
      };
    }

    setMinStockProposals((prev) => prev.filter((p) => p.id !== proposalId));

    setActiveToast({
      id: Math.random().toString(),
      type: 'info',
      title: 'Pengajuan Stok Minimal Dihapus',
      message: `Permohonan #${proposal.proposalNumber} telah dibatalkan dan dihapus.`,
    });

    return { success: true };
  };

  // Tahap 2: Verifikasi Pengajuan Minimal Stock oleh User Admin Gudang
  // -> Permohonan TERKUNCI (tidak bisa diedit/dihapus pemohon), TETAPI BELUM mengganti data minimal stock pada sistem!
  const verifyMinStockProposal = (
    proposalId: string,
    adminNotes?: string,
    verifiedMinStock?: number
  ) => {
    if (currentUser?.role !== 'admin') {
      return {
        success: false,
        error: 'Hanya User Admin Gudang yang berwenang melakukan verifikasi pengajuan stok minimal.',
      };
    }
    const proposal = minStockProposals.find((p) => p.id === proposalId);
    if (!proposal) return { success: false, error: 'Pengajuan tidak ditemukan' };
    if (proposal.status !== 'PENDING') {
      return { success: false, error: 'Pengajuan sudah diverifikasi atau diproses sebelumnya' };
    }

    const now = new Date().toISOString();
    const verifiedVal =
      verifiedMinStock !== undefined && verifiedMinStock > 0
        ? Number(verifiedMinStock)
        : proposal.proposedMinStock;
    const notesText =
      adminNotes?.trim() ||
      'Telah diverifikasi oleh Admin Gudang. Permohonan dikunci dan diteruskan ke Kepala Gudang untuk persetujuan akhir.';

    // Update status proposal menjadi 'VERIFIED_ADMIN' (Terkunci, tetapi TIDAK mengubah StockItem.minStock dulu!)
    setMinStockProposals((prev) =>
      prev.map((p) =>
        p.id === proposalId
          ? {
              ...p,
              status: 'VERIFIED_ADMIN',
              verifiedMinStock: verifiedVal,
              verifiedByAdmin: currentUser.name,
              verifiedAt: now,
              adminVerificationNotes: notesText,
              reviewedByAdmin: currentUser.name,
              reviewedAt: now,
              adminNotes: notesText,
            }
          : p
      )
    );

    addActivityLog({
      category: 'APPROVAL_WORKFLOW',
      action: 'MIN_STOCK_VERIFIED',
      title: 'Verifikasi Pengajuan Stok Minimal oleh Admin Gudang (Permohonan Terkunci)',
      description: `Admin Gudang (${currentUser.name}) memverifikasi pengajuan #${proposal.proposalNumber} untuk ${proposal.itemName} (${proposal.sku}) sebesar ${verifiedVal} ${proposal.unit}. Permohonan telah terkunci (data minimal stock pada sistem belum berubah; menunggu approval Kepala Gudang).`,
      referenceNumber: proposal.proposalNumber,
    });

    // Kirim notifikasi ke Kepala Gudang untuk Approval Akhir & ke Pemohon
    const headNotif: AppNotification = {
      id: `notif_${Date.now()}_head`,
      targetRole: 'kepala_gudang',
      type: 'min_stock_verified',
      title: 'Menunggu Approval Kepala Gudang: Stok Minimal Terverifikasi',
      message: `Admin Gudang (${currentUser.name}) telah memverifikasi usulan stok minimal #${proposal.proposalNumber} (${proposal.itemName}: ${proposal.currentMinStock} -> ${verifiedVal} ${proposal.unit}). Menunggu approval Kepala Gudang untuk mengubah data sistem.`,
      proposalId: proposal.id,
      read: false,
      timestamp: now,
    };

    const userNotif: AppNotification = {
      id: `notif_${Date.now()}_user`,
      targetUserId: proposal.requestedByUserId,
      type: 'min_stock_verified',
      title: 'Pengajuan Stok Minimal Diverifikasi Admin Gudang (Terkunci)',
      message: `Permohonan #${proposal.proposalNumber} (${proposal.itemName}) telah diverifikasi oleh Admin Gudang (${currentUser.name}) dan terkunci. Menunggu approval Kepala Gudang agar batas stok minimal sistem berubah.`,
      proposalId: proposal.id,
      read: false,
      timestamp: now,
    };

    setNotifications((prev) => [headNotif, userNotif, ...prev]);

    setActiveToast({
      id: Math.random().toString(),
      type: 'info',
      title: 'Terverifikasi Admin Gudang (Permohonan Terkunci)',
      message: `Usulan #${proposal.proposalNumber} telah diverifikasi & terkunci. Data minimal stock sistem belum berubah dan menunggu Approved Kepala Gudang.`,
    });

    return { success: true };
  };

  // Tahap 3: Approval Final oleh User Kepala Gudang dari hasil verifikasi Admin Gudang
  // -> Data minimal stock pada sistem RESMI BERUBAH!
  const approveMinStockProposal = (proposalId: string, headNotes?: string) => {
    const proposal = minStockProposals.find((p) => p.id === proposalId);
    if (!proposal) return { success: false, error: 'Pengajuan tidak ditemukan' };

    if (currentUser?.role !== 'kepala_gudang') {
      return {
        success: false,
        error:
          'User Admin hanya melakukan verifikasi & kunci permohonan. Approve perubahan minimal stock sistem hanya dapat dilakukan oleh User Kepala Gudang!',
      };
    }

    if (proposal.status === 'PENDING') {
      return {
        success: false,
        error: 'Pengajuan ini belum diverifikasi oleh User Admin Gudang! Admin Gudang wajib memverifikasi terlebih dahulu sebelum di-approve Kepala Gudang.',
      };
    }

    if (proposal.status !== 'VERIFIED_ADMIN') {
      return { success: false, error: 'Pengajuan sudah diproses sebelumnya' };
    }

    const now = new Date().toISOString();
    const newMinStock = proposal.verifiedMinStock ?? proposal.proposedMinStock;
    const headApproverName = currentUser?.name || 'Suryadi';
    const notesText =
      headNotes?.trim() ||
      'Disetujui (Approved) oleh Kepala Gudang dari hasil verifikasi Admin Gudang. Data minimal stock pada sistem resmi diperbarui.';

    // 1. Update proposal status menjadi 'APPROVED'
    setMinStockProposals((prev) =>
      prev.map((p) =>
        p.id === proposalId
          ? {
              ...p,
              status: 'APPROVED',
              approvedByWarehouseHead: headApproverName,
              approvedAt: now,
              headApprovalNotes: notesText,
              reviewedByAdmin: headApproverName,
              reviewedAt: now,
              adminNotes: notesText,
            }
          : p
      )
    );

    // 2. OTOMATIS MENGGANTI DATA MINIMAL STOCK PADA SISTEM (update target item's minStock!)
    setStockItems((prev) =>
      prev.map((item) =>
        item.id === proposal.itemId || item.sku === proposal.sku
          ? { ...item, minStock: newMinStock, updatedAt: now }
          : item
      )
    );

    addActivityLog({
      category: 'APPROVAL_WORKFLOW',
      action: 'MIN_STOCK_APPROVED',
      title: 'Approved Kepala Gudang: Perubahan Data Stok Minimal Sistem',
      description: `Kepala Gudang (${headApproverName}) meng-approve hasil verifikasi Admin Gudang (${proposal.verifiedByAdmin || 'Admin Gudang'}) untuk pengajuan #${proposal.proposalNumber}. Data minimal stock ${proposal.itemName} (${proposal.sku}) pada sistem resmi berubah dari ${proposal.currentMinStock} menjadi ${newMinStock} ${proposal.unit}.`,
      referenceNumber: proposal.proposalNumber,
    });

    // 3. Notification for requester & admin
    const newNotif: AppNotification = {
      id: `notif_${Date.now()}`,
      targetUserId: proposal.requestedByUserId,
      type: 'min_stock_approved',
      title: 'Approved Kepala Gudang: Data Minimal Stock Sistem Berubah',
      message: `Pengajuan batas stok minimal #${proposal.proposalNumber} untuk ${proposal.itemName} (${proposal.sku}) sebesar ${newMinStock} ${proposal.unit} telah di-approve oleh Kepala Gudang (${headApproverName}) dari hasil verifikasi Admin Gudang dan resmi mengubah data minimal stock pada sistem.`,
      proposalId: proposal.id,
      read: false,
      timestamp: now,
    };
    setNotifications((prev) => [newNotif, ...prev]);

    // 4. Toast
    setActiveToast({
      id: Math.random().toString(),
      type: 'success',
      title: 'Approved Kepala Gudang — Minimal Stock Sistem Berubah',
      message: `Data minimal stock ${proposal.itemName} pada sistem resmi berubah dari ${proposal.currentMinStock} menjadi ${newMinStock} ${proposal.unit}.`,
    });

    return { success: true };
  };

  const rejectMinStockProposal = (proposalId: string, notes: string) => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'kepala_gudang') {
      return {
        success: false,
        error: 'Hanya Admin Gudang atau Kepala Gudang yang berwenang menolak pengajuan stok minimal',
      };
    }
    const proposal = minStockProposals.find((p) => p.id === proposalId);
    if (!proposal) return { success: false, error: 'Pengajuan tidak ditemukan' };
    if (proposal.status === 'APPROVED' || proposal.status === 'REJECTED') {
      return { success: false, error: 'Pengajuan sudah selesai diproses' };
    }

    const now = new Date().toISOString();
    const actorLabel =
      currentUser.role === 'kepala_gudang'
        ? `Kepala Gudang (${currentUser.name})`
        : `Admin Gudang (${currentUser.name})`;

    setMinStockProposals((prev) =>
      prev.map((p) =>
        p.id === proposalId
          ? {
              ...p,
              status: 'REJECTED',
              reviewedByAdmin: `${currentUser.name} (${currentUser.role === 'kepala_gudang' ? 'Kepala Gudang' : 'Admin Gudang'})`,
              reviewedAt: now,
              adminNotes: notes || `Ditolak oleh ${actorLabel}`,
            }
          : p
      )
    );

    addActivityLog({
      category: 'APPROVAL_WORKFLOW',
      action: 'MIN_STOCK_REJECTED',
      title: 'Penolakan Pengajuan Stok Minimal',
      description: `${actorLabel} menolak pengajuan #${proposal.proposalNumber} untuk ${proposal.itemName} (${proposal.sku}). Alasan: ${notes}`,
      referenceNumber: proposal.proposalNumber,
    });

    const newNotif: AppNotification = {
      id: `notif_${Date.now()}`,
      targetUserId: proposal.requestedByUserId,
      type: 'min_stock_rejected',
      title: 'Pengajuan Stok Minimal Ditolak',
      message: `Pengajuan batas stok minimal untuk ${proposal.itemName} (${proposal.sku}) ditolak oleh ${actorLabel}. Alasan: ${notes}`,
      proposalId: proposal.id,
      read: false,
      timestamp: now,
    };
    setNotifications((prev) => [newNotif, ...prev]);

    setActiveToast({
      id: Math.random().toString(),
      type: 'warning',
      title: 'Pengajuan Stok Minimal Ditolak',
      message: `Pengajuan untuk ${proposal.itemName} telah ditolak.`,
    });

    return { success: true };
  };

  // Analisa Kategori Keluar Barang (Fast Moving, Medium Moving, Low Moving)
  const getItemMovementAnalytics = useCallback(
    (itemId: string, sku?: string) => {
      const outMovements = stockMovements.filter(
        (m) => m.type === 'OUT' && (m.itemId === itemId || (sku && m.sku === sku))
      );
      const totalOutQty = outMovements.reduce((sum, m) => sum + m.quantity, 0);
      const outFrequency = outMovements.length;
      const lastOutDate =
        outMovements.length > 0
          ? outMovements
              .map((m) => m.date)
              .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
          : undefined;

      let velocityCategory: MovementVelocityCategory = 'LOW_MOVING';
      let velocityLabel: 'Fast Moving' | 'Medium Moving' | 'Low Moving' = 'Low Moving';

      if (outFrequency >= 2 || totalOutQty >= 12) {
        velocityCategory = 'FAST_MOVING';
        velocityLabel = 'Fast Moving';
      } else if (outFrequency >= 1 || totalOutQty >= 3) {
        velocityCategory = 'MEDIUM_MOVING';
        velocityLabel = 'Medium Moving';
      } else {
        velocityCategory = 'LOW_MOVING';
        velocityLabel = 'Low Moving';
      }

      return {
        totalOutQty,
        outFrequency,
        lastOutDate,
        velocityCategory,
        velocityLabel,
      };
    },
    [stockMovements]
  );

  // Stock alert item arrays
  const lowStockItems = stockItems.filter((i) => i.currentStock <= i.minStock);
  const nearMinStockItems = stockItems.filter(
    (i) => i.currentStock > i.minStock && i.currentStock <= i.minStock + Math.max(3, Math.round(i.minStock * 0.35))
  );

  const openPrintPreview = (type: 'LPB' | 'NPB', doc: LPBDocument | IssueVoucherDocument) => {
    setSelectedDocumentForPrint({ type, doc });
  };

  const closePrintPreview = () => {
    setSelectedDocumentForPrint(null);
  };

  const resetToDefaultData = () => {
    setStockItems(INITIAL_STOCK_ITEMS);
    setLpbDocuments(INITIAL_LPB_DOCUMENTS);
    setIssueVouchers(INITIAL_ISSUE_VOUCHERS);
    setStockMovements(INITIAL_STOCK_MOVEMENTS);
    setNotifications(INITIAL_NOTIFICATIONS);
    setCostCenters(INITIAL_COST_CENTERS);
    setGlAccounts(INITIAL_GL_ACCOUNTS);
    setMinStockProposals(INITIAL_MIN_STOCK_PROPOSALS);
    setActivityLogs(INITIAL_ACTIVITY_LOGS);
    setUsers(INITIAL_USERS);
    setCurrentUser(INITIAL_USERS[0]);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    localStorage.removeItem(STORAGE_KEYS.USERS);
    localStorage.removeItem(STORAGE_KEYS.STOCK_ITEMS);
    localStorage.removeItem(STORAGE_KEYS.LPB_DOCS);
    localStorage.removeItem(STORAGE_KEYS.ISSUE_VOUCHERS);
    localStorage.removeItem(STORAGE_KEYS.STOCK_MOVEMENTS);
    localStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);
    localStorage.removeItem(STORAGE_KEYS.COST_CENTERS);
    localStorage.removeItem(STORAGE_KEYS.GL_ACCOUNTS);
    localStorage.removeItem(STORAGE_KEYS.STORAGE_LOCATIONS);
    localStorage.removeItem(STORAGE_KEYS.COMPANY_PROFILE);
    localStorage.removeItem(STORAGE_KEYS.MIN_STOCK_PROPOSALS);
    localStorage.removeItem(STORAGE_KEYS.ACTIVITY_LOGS);
    setStorageLocations(INITIAL_STORAGE_LOCATIONS);
    setCompanyProfile(INITIAL_COMPANY_PROFILE);
    setActiveToast({
      id: Math.random().toString(),
      type: 'info',
      title: 'Data Demo Direset',
      message: 'Seluruh data master stok, akun login, Cost Center, GL Account, lokasi rak, profil perusahaan, pengajuan stok minimal, LPB, dan nota dikembalikan ke kondisi awal.',
    });
  };

  return (
    <InventoryContext.Provider
      value={{
        currentUser,
        users,
        login,
        logout,
        createUser,
        updateUser,
        resetUserPassword,
        deleteUser,
        toggleUserStatus,
        stockItems,
        lpbDocuments,
        issueVouchers,
        stockMovements,
        notifications,
        costCenters,
        glAccounts,
        addCostCenter,
        updateCostCenter,
        deleteCostCenter,
        clearAllCostCenters,
        importCostCentersBulk,
        addGLAccount,
        updateGLAccount,
        deleteGLAccount,
        clearAllGLAccounts,
        importGLAccountsBulk,
        storageLocations,
        addStorageLocation,
        updateStorageLocation,
        deleteStorageLocation,
        importStockItemsBulk,
        companyProfile,
        updateCompanyProfile,
        resetCompanyProfile,
        minStockProposals,
        createMinStockProposal,
        updateMinStockProposal,
        deleteMinStockProposal,
        verifyMinStockProposal,
        approveMinStockProposal,
        rejectMinStockProposal,
        lowStockItems,
        nearMinStockItems,
        getItemMovementAnalytics,
        activityLogs,
        addActivityLog,
        activeToast,
        dismissToast,
        createLPB,
        approveLPBStockAddition,
        rejectLPB,
        createIssueVoucher,
        approveIssueVoucher,
        completeIssueVoucherHandover,
        rejectIssueVoucher,
        updateIssueVoucher,
        deleteIssueVoucher,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        addNewStockItem,
        updateStockItem,
        deleteStockItem,
        selectedDocumentForPrint,
        openPrintPreview,
        closePrintPreview,
        resetToDefaultData,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};
