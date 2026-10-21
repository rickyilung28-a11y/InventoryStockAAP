export type UserRole = 'admin' | 'kepala_gudang' | 'user';

export interface UserAccount {
  id: string;
  username: string;
  password: string;
  name: string;
  role: UserRole;
  department: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
}

export interface StockItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  allocatedStock: number; // Qty requested in pending/approved vouchers waiting handover/verification
  minStock: number;
  location: string;
  unitPrice?: number;
  description?: string;
  updatedAt: string;
}

export type LPBStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface LPBItem {
  itemId: string;
  sku: string;
  itemName: string;
  unit: string;
  quantity: number;
  batchNo?: string;
  condition: 'Baik' | 'Kurang' | 'Rusak';
  notes?: string;
  specification?: string;
  storageLocation?: string;
  barcodeValidated?: boolean;
  barcodeScannedAt?: string;
}

export interface LPBDocument {
  id: string;
  lpbNumber: string; // LPB-202610-XXXX
  sjNumber: string; // Surat Jalan Supplier
  sjDate: string;
  supplierName: string;
  supplierAddress?: string;
  receivedDate: string;
  poNumber?: string;
  driverName?: string;
  vehiclePlate?: string;
  usagePurpose?: string;
  storageLocation?: string;
  notes?: string;
  status?: LPBStatus; // PENDING_APPROVAL (Admin sudah ACC & validasi/scan, stok belum bertambah) | APPROVED (Kepala Gudang sudah approve penambahan stock) | REJECTED
  receivedByAdmin: string; // Admin Gudang yang ACC & Validasi/Scan Barang Masuk
  adminValidatedAt?: string;
  verifiedBy: string; // Kepala Gudang yang Approve Penambahan Stock
  approvedByWarehouseHead?: string;
  approvedAt?: string;
  headApprovalNotes?: string;
  rejectionReason?: string;
  items: LPBItem[];
  createdAt: string;
}

export interface CostCenterEntry {
  code: string; // e.g. "60"
  name: string; // e.g. "Bagging Plant 2 & Pemuatan"
  description?: string;
}

export interface GLAccountEntry {
  code: string; // e.g. "51010"
  name: string; // e.g. "Biaya Sparepart Mesin & Peralatan"
  description?: string;
}

export interface StorageLocation {
  id: string;
  code: string; // e.g. "RAK-A1"
  name: string; // e.g. "Rak A1 - Sparepart Mesin"
  zone?: string; // e.g. "Zona A (Mekanik & Mesin)"
  description?: string;
}

export interface CompanyProfile {
  appName: string; // e.g. "GudangPresisi"
  appTagline: string; // e.g. "SISTEM INVENTORY"
  companyName: string; // e.g. "PT. Abadi Agrosindo Persada"
  city: string; // e.g. "Sidoarjo"
  address: string; // e.g. "Kawasan Industri, Sidoarjo - Jawa Timur"
  phone?: string;
  email?: string;
  logoUrl?: string; // custom uploaded logo base64 or url; if empty uses default sprout logo
  sivDocCode: string; // e.g. "FR/AAP/G-STR/23/001"
  lpbDocCode: string; // e.g. "FR/AAP/G-LPB/23/002"
}

export type IssueVoucherStatus = 'PENDING' | 'APPROVED' | 'HANDOVER_COMPLETED' | 'REJECTED';

export interface IssueVoucherItem {
  itemId: string;
  sku: string;
  itemName: string;
  unit: string;
  requestedQty: number;
  approvedQty?: number;
  issuedQty?: number; // Jumlah realisasi yang dikeluarkan saat validasi scan barcode oleh Admin Gudang (0 = tidak jadi dikeluarkan)
  isCancelled?: boolean; // Centang barang tidak jadi dikeluarkan (qty pengeluaran = 0)
  barcodeValidated?: boolean; // Sudah divalidasi dengan scan barcode barang
  barcodeScannedAt?: string; // Waktu scan barcode barang
  availableStockSnapshot?: number;
  costCenter?: string;
  glAcc?: string;
  glAccount?: string;
}

export interface IssueVoucherDocument {
  id: string;
  voucherNumber: string; // NPB-202610-XXXX
  requestedBy: string; // User yang Menerbitkan Nota Pengambilan Barang
  userId: string;
  department: string;
  requestDate: string;
  purpose: string;
  notes?: string;
  costCenter?: string;
  glAccount?: string;
  status: IssueVoucherStatus;
  items: IssueVoucherItem[];
  approvedByRequester?: string; // User yang Menerbitkan Nota Pengambilan Barang
  approvedByWarehouseHead?: string; // Nama Kepala Gudang yang Verifikasi Pengeluaran Stok
  warehouseHeadName?: string; // Nama Kepala Gudang
  headApprovedAt?: string; // Tanggal dan waktu Verifikasi Pengeluaran Stok oleh Kepala Gudang
  approvedByAdmin?: string; // Nama User Admin Gudang yang ACC SIV
  approvedAt?: string; // Tanggal dan waktu ACC SIV / Verifikasi Final
  handoverOfficer?: string; // Petugas / Admin Gudang yang meng-ACC SIV & memvalidasi pengeluaran barang
  handoverAt?: string; // Tanggal dan waktu Penyerahan & Validasi barang oleh Admin Gudang
  recipientName?: string; // Nama penerima (yang diinputkan admin saat penyerahan)
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type MovementType = 'IN' | 'OUT';

export interface StockMovement {
  id: string;
  itemId: string;
  sku: string;
  itemName: string;
  type: MovementType;
  source: 'LPB_SUPPLIER' | 'NOTA_PENGAMBILAN' | 'PENYESUAIAN_AWAL';
  referenceNumber: string; // LPB No or NPB No
  secondaryRef?: string; // SJ No or Dept Pemohon
  quantity: number;
  balanceBefore: number;
  balanceAfter: number;
  date: string;
  actor: string;
  notes?: string;
}

export interface AppNotification {
  id: string;
  targetUserId?: string; // If specific to a user
  targetRole?: UserRole | 'all';
  type:
    | 'voucher_approved'
    | 'voucher_rejected'
    | 'voucher_created'
    | 'lpb_created'
    | 'low_stock'
    | 'min_stock_proposal'
    | 'min_stock_verified'
    | 'min_stock_approved'
    | 'min_stock_rejected';
  title: string;
  message: string;
  voucherId?: string;
  lpbId?: string;
  proposalId?: string;
  read: boolean;
  timestamp: string;
}

export type MinStockProposalStatus = 'PENDING' | 'VERIFIED_ADMIN' | 'APPROVED' | 'REJECTED';

export interface MinStockProposal {
  id: string;
  proposalNumber: string; // e.g. "PROP-MIN-202610-0001"
  itemId: string;
  sku: string;
  itemName: string;
  unit: string;
  currentMinStock: number; // Stok minimal sebelum usulan
  proposedMinStock: number; // Usulan stok minimal baru dari pemohon
  verifiedMinStock?: number; // Usulan stok minimal hasil verifikasi Admin Gudang
  reason: string; // Alasan/justifikasi kebutuhan perubahan stok minimal
  requestedBy: string; // Nama user pemohon
  requestedByUserId: string;
  requestedByRole: UserRole;
  requestDate: string; // ISO date
  status: MinStockProposalStatus;
  verifiedByAdmin?: string; // Nama Admin Gudang yang memverifikasi (mengunci permohonan)
  verifiedAt?: string; // Waktu verifikasi Admin Gudang
  adminVerificationNotes?: string; // Catatan verifikasi Admin Gudang
  approvedByWarehouseHead?: string; // Nama Kepala Gudang yang meng-approve final (mengubah sistem)
  approvedAt?: string; // Waktu approve Kepala Gudang
  headApprovalNotes?: string; // Catatan approve Kepala Gudang
  reviewedByAdmin?: string; // Nama pejabat terakhir yang menyetujui / memverifikasi / menolak
  reviewedAt?: string;
  adminNotes?: string; // Catatan review / penolakan
}

export type MovementVelocityCategory = 'FAST_MOVING' | 'MEDIUM_MOVING' | 'LOW_MOVING';

export type ActivityLogCategory =
  | 'STOCK_ADJUSTMENT'
  | 'APPROVAL_WORKFLOW'
  | 'USER_CHANGE'
  | 'MASTER_DATA';

export interface SystemActivityLog {
  id: string;
  timestamp: string; // ISO string
  category: ActivityLogCategory;
  action: string; // Short action badge e.g. 'LPB_CREATED', 'SIV_APPROVED', 'USER_ADDED', 'MIN_STOCK_APPROVED', 'CC_GL_IMPORTED'
  title: string;
  description: string;
  actorName: string;
  actorUsername?: string;
  actorRole: UserRole;
  referenceNumber?: string; // e.g. LPB-..., NPB-..., SKU-..., PROP-...
  metadata?: Record<string, string | number | boolean>;
}
