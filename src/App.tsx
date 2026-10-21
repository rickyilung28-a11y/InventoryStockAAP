/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { Navbar } from './components/Navbar';
import { ToastNotification } from './components/ToastNotification';
import { NotificationDrawer } from './components/NotificationDrawer';
import { PrintDocumentModal } from './components/PrintDocumentModal';
import { ApprovalModal } from './components/ApprovalModal';
import { CreateLPBModal } from './components/CreateLPBModal';
import { CreateIssueVoucherModal } from './components/CreateIssueVoucherModal';
import { EditIssueVoucherModal } from './components/EditIssueVoucherModal';

import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { LPBView } from './views/LPBView';
import { IssueVoucherListView } from './views/IssueVoucherListView';
import { StockMasterView } from './views/StockMasterView';
import { StockMovementView } from './views/StockMovementView';
import { UserManagementView } from './views/UserManagementView';
import { CostCenterGLView } from './views/CostCenterGLView';
import { StorageLocationsView } from './views/StorageLocationsView';
import { CompanySettingsView } from './views/CompanySettingsView';
import { MinStockManagementView } from './views/MinStockManagementView';
import { SystemActivityLogView } from './views/SystemActivityLogView';
import { IssueVoucherDocument } from './types/inventory';
import { BellRing, Users } from 'lucide-react';

function InventoryAppContent() {
  const {
    currentUser,
    users,
    login,
    logout,
    stockItems,
    lpbDocuments,
    issueVouchers,
    stockMovements,
    notifications,
    activeToast,
    dismissToast,
    createLPB,
    createIssueVoucher,
    approveIssueVoucher,
    completeIssueVoucherHandover,
    rejectIssueVoucher,
    updateIssueVoucher,
    deleteIssueVoucher,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    selectedDocumentForPrint,
    openPrintPreview,
    closePrintPreview,
    resetToDefaultData,
  } = useInventory();

  // If user is not logged in, show clean Login View
  if (!currentUser) {
    return (
      <>
        <LoginView />
        <ToastNotification
          toast={activeToast}
          onDismiss={dismissToast}
        />
      </>
    );
  }

  // Active navigation tab
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [ledgerSkuFilter, setLedgerSkuFilter] = useState<string>('');

  // Modals state
  const [isCreateLPBOpen, setIsCreateLPBOpen] = useState(false);
  const [isCreateVoucherOpen, setIsCreateVoucherOpen] = useState(false);
  const [voucherToEdit, setVoucherToEdit] = useState<IssueVoucherDocument | null>(null);
  const [voucherToApprove, setVoucherToApprove] = useState<IssueVoucherDocument | null>(null);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);

  // User pemohon SIV hanya dapat melihat SIV yang diterbitkan oleh dirinya sendiri
  const visibleIssueVouchers =
    currentUser.role === 'user'
      ? issueVouchers.filter(
          (v) =>
            v.userId === currentUser.id ||
            v.requestedBy.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
        )
      : issueVouchers;

  const pendingApprovalsCount = visibleIssueVouchers.filter(
    (v) => v.status === 'PENDING' || v.status === 'APPROVED'
  ).length;

  const handleNavigateToLedgerItem = (sku: string) => {
    setLedgerSkuFilter(sku);
    setCurrentTab('ledger');
  };

  const handleViewVoucherFromToast = (voucherNumber: string) => {
    const voucher = visibleIssueVouchers.find((v) => v.voucherNumber === voucherNumber);
    if (voucher) {
      openPrintPreview('NPB', voucher);
    } else {
      setCurrentTab('vouchers');
    }
  };

  const handleSelectVoucherFromNotif = (voucherId: string) => {
    const v = visibleIssueVouchers.find((item) => item.id === voucherId);
    if (v) {
      openPrintPreview('NPB', v);
    }
  };

  const handleSelectLPBFromNotif = (lpbId: string) => {
    const l = lpbDocuments.find((item) => item.id === lpbId);
    if (l) {
      openPrintPreview('LPB', l);
    }
  };

  const handleSwitchUser = (userId: string) => {
    const target = users.find((u) => u.id === userId);
    if (target) {
      login(target.username, target.password);
    }
  };

  // Quick Simulation Helper for Real-Time Approval
  const handleQuickSimulateApproval = () => {
    const firstPending = issueVouchers.find((v) => v.status === 'PENDING');
    const firstApproved = issueVouchers.find((v) => v.status === 'APPROVED');
    if (firstPending) {
      approveIssueVoucher(firstPending.id, {
        warehouseHeadName: 'Suryadi (Kepala Gudang)',
        approverAdminName: currentUser.name,
        notes: 'Simulasi ACC SIV Kepala Gudang: Disetujui untuk proses pengeluaran.',
      });
    } else if (firstApproved) {
      completeIssueVoucherHandover(firstApproved.id, {
        handoverOfficer: firstApproved.approvedByAdmin || 'Hendra Gunawan',
        recipientName: firstApproved.requestedBy,
        notes: 'Simulasi Penyerahan & Scan Barcode selesai.',
        validatedItems: firstApproved.items.map((i) => ({
          itemId: i.itemId,
          issuedQty: i.requestedQty,
          isCancelled: false,
          barcodeScanned: true,
        })),
      });
    } else {
      const res = createIssueVoucher({
        purpose: 'Simulasi Kebutuhan Mendesak Sparepart Maintenance',
        department: 'Dept. Pemeliharaan & Workshop',
        notes: 'Dibuat untuk demonstrasi notifikasi real-time.',
        items: [{ itemId: stockItems[0].id, requestedQty: 1 }],
      });
      if (res.success && res.voucher) {
        setTimeout(() => {
          approveIssueVoucher(res.voucher!.id, {
            warehouseHeadName: 'Suryadi (Kepala Gudang)',
            approverAdminName: 'Hendra Gunawan',
            notes: 'ACC SIV Kepala Gudang selesai.',
          });
        }, 600);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navigation */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setLedgerSkuFilter('');
          setCurrentTab(tab);
        }}
        currentUser={currentUser}
        allUsers={users}
        onSwitchUser={handleSwitchUser}
        onLogout={logout}
        notifications={notifications}
        onOpenNotifications={() => setIsNotificationDrawerOpen(true)}
        onResetData={resetToDefaultData}
        pendingApprovalsCount={pendingApprovalsCount}
      />

      {/* Real-time interactive simulation guidance bar */}
      <div className="bg-slate-900 border-b border-slate-800 text-slate-200 text-xs py-2 px-4 no-print">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-slate-300">
              Pengguna Aktif: <strong className="text-white">{currentUser.name}</strong> (@{currentUser.username}) &middot;{' '}
              <span
                className={
                  currentUser.role === 'admin'
                    ? 'text-emerald-400 font-semibold'
                    : currentUser.role === 'kepala_gudang'
                    ? 'text-blue-400 font-semibold'
                    : 'text-amber-400 font-semibold'
                }
              >
                {currentUser.role === 'admin'
                  ? 'Administrator Gudang'
                  : currentUser.role === 'kepala_gudang'
                  ? 'Kepala Gudang'
                  : `${currentUser.department} (Pemohon SIV)`}
              </span>
            </span>
            {(currentUser.role === 'admin' || currentUser.role === 'kepala_gudang') && (
              <button
                onClick={() => setCurrentTab('users')}
                className="inline-flex items-center gap-1 ml-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-[11px] transition-colors"
              >
                <Users className="w-3 h-3" />
                <span>Kelola User</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 self-start lg:self-auto">
            <span className="text-[10px] text-slate-400 font-mono uppercase mr-1">Ganti Peran Cepat:</span>
            {(() => {
              const userPemohon = users.find((u) => u.role === 'user' && u.isActive !== false);
              const userAdmin = users.find((u) => u.role === 'admin' && u.isActive !== false);
              const userKepala = users.find((u) => u.role === 'kepala_gudang' && u.isActive !== false);

              return (
                <>
                  {userPemohon && (
                    <button
                      onClick={() => handleSwitchUser(userPemohon.id)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                        currentUser.role === 'user'
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                          : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                      }`}
                    >
                      1. Pemohon (@{userPemohon.username})
                    </button>
                  )}
                  {userAdmin && (
                    <button
                      onClick={() => handleSwitchUser(userAdmin.id)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                        currentUser.role === 'admin'
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                          : 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border-slate-700'
                      }`}
                    >
                      2. Admin Gudang (@{userAdmin.username})
                    </button>
                  )}
                  {userKepala && (
                    <button
                      onClick={() => handleSwitchUser(userKepala.id)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                        currentUser.role === 'kepala_gudang'
                          ? 'bg-blue-500 text-white border-blue-400 font-bold'
                          : 'bg-slate-800 hover:bg-slate-700 text-blue-300 border-slate-700'
                      }`}
                    >
                      3. Kepala Gudang (@{userKepala.username})
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === 'dashboard' && (
          <DashboardView
            currentUser={currentUser}
            stockItems={stockItems}
            lpbDocuments={lpbDocuments}
            issueVouchers={visibleIssueVouchers}
            stockMovements={stockMovements}
            onOpenCreateLPB={() => setIsCreateLPBOpen(true)}
            onOpenCreateVoucher={() => setIsCreateVoucherOpen(true)}
            onOpenApproval={(v) => setVoucherToApprove(v)}
            onPrintDocument={(type, doc) => openPrintPreview(type, doc)}
            onNavigateTab={(tab) => setCurrentTab(tab)}
          />
        )}

        {currentTab === 'lpb' && (
          <LPBView
            currentUser={currentUser}
            lpbDocuments={lpbDocuments}
            onOpenCreateLPB={() => setIsCreateLPBOpen(true)}
            onPrintLPB={(doc) => openPrintPreview('LPB', doc)}
          />
        )}

        {currentTab === 'vouchers' && (
          <IssueVoucherListView
            currentUser={currentUser}
            issueVouchers={visibleIssueVouchers}
            onOpenCreateVoucher={() => setIsCreateVoucherOpen(true)}
            onOpenEditVoucher={(v) => setVoucherToEdit(v)}
            onOpenApproval={(v) => setVoucherToApprove(v)}
            onDeleteVoucher={(id) => deleteIssueVoucher(id)}
            onPrintVoucher={(doc) => openPrintPreview('NPB', doc)}
          />
        )}

        {currentTab === 'items' && (
          <StockMasterView
            onViewLedgerItem={handleNavigateToLedgerItem}
            onNavigateToMinStock={() => setCurrentTab('min-stock')}
          />
        )}

        {currentTab === 'min-stock' && (
          <MinStockManagementView
            onNavigateToLPB={() => setIsCreateLPBOpen(true)}
            onNavigateToStockMaster={() => setCurrentTab('items')}
          />
        )}

        {currentTab === 'ledger' && (
          <StockMovementView preselectedSku={ledgerSkuFilter} />
        )}

        {currentTab === 'activity-log' && <SystemActivityLogView />}

        {currentTab === 'locations' && (
          <StorageLocationsView
            onSelectRackForFilter={() => {
              setCurrentTab('items');
            }}
          />
        )}

        {currentTab === 'company' && currentUser.role === 'admin' && (
          <CompanySettingsView />
        )}

        {currentTab === 'users' && currentUser.role === 'admin' && (
          <UserManagementView />
        )}

        {currentTab === 'accounting' && currentUser.role === 'admin' && (
          <CostCenterGLView />
        )}
      </main>

      {/* Modals & Drawers */}
      {/* 1. Modal Buat LPB (Penambahan Stok dari SJ Supplier) */}
      {isCreateLPBOpen && (
        <CreateLPBModal
          stockItems={stockItems}
          onClose={() => setIsCreateLPBOpen(false)}
          onSubmit={createLPB}
          onSuccessPrint={(doc) => openPrintPreview('LPB', doc)}
        />
      )}

      {/* 2. Modal Buat Nota Pengambilan Barang (User SIV) */}
      {isCreateVoucherOpen && (
        <CreateIssueVoucherModal
          stockItems={stockItems}
          currentUser={currentUser}
          onClose={() => setIsCreateVoucherOpen(false)}
          onSubmit={createIssueVoucher}
          onSuccessPrint={(doc) => openPrintPreview('NPB', doc)}
        />
      )}

      {/* 3. Modal Edit Nota Pengambilan Barang */}
      {voucherToEdit && (
        <EditIssueVoucherModal
          voucher={voucherToEdit}
          stockItems={stockItems}
          onClose={() => setVoucherToEdit(null)}
          onSubmit={updateIssueVoucher}
        />
      )}

      {/* 4. Modal Approval Kepala Gudang (Tahap 1) & Validasi Scan Barcode Penyerahan Admin Gudang (Tahap 2) */}
      {voucherToApprove && (
        <ApprovalModal
          voucher={voucherToApprove}
          stockItems={stockItems}
          currentAdminName={currentUser.name}
          currentUserRole={currentUser.role}
          onClose={() => setVoucherToApprove(null)}
          onApprove={(handover) => {
            approveIssueVoucher(voucherToApprove.id, handover);
            setVoucherToApprove(null);
          }}
          onCompleteHandover={(handoverData) => {
            const res = completeIssueVoucherHandover(voucherToApprove.id, handoverData);
            if (res.success) {
              setVoucherToApprove(null);
            }
            return res;
          }}
          onReject={(reason) => {
            rejectIssueVoucher(voucherToApprove.id, reason);
            setVoucherToApprove(null);
          }}
        />
      )}

      {/* 5. Printable Document Modal (LPB & NPB) */}
      {selectedDocumentForPrint && (
        <PrintDocumentModal
          documentData={selectedDocumentForPrint}
          onClose={closePrintPreview}
        />
      )}

      {/* 6. Notification Center Drawer */}
      <NotificationDrawer
        isOpen={isNotificationDrawerOpen}
        onClose={() => setIsNotificationDrawerOpen(false)}
        notifications={notifications}
        currentUserId={currentUser.id}
        currentUserRole={currentUser.role}
        onMarkAsRead={markNotificationAsRead}
        onMarkAllAsRead={markAllNotificationsAsRead}
        onSelectVoucher={handleSelectVoucherFromNotif}
        onSelectLPB={handleSelectLPBFromNotif}
      />

      {/* 7. Real-Time Toast Alert */}
      <ToastNotification
        toast={activeToast}
        onDismiss={dismissToast}
        onViewVoucher={handleViewVoucherFromToast}
      />

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-4 text-xs text-slate-500 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; 2026 PT Indo Manufaktur Logistik Utama. Sistem Manajemen Pergudangan & Inventaris.</span>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Standar ISO 9001:2015</span>
            <span>&middot;</span>
            <span>Autentikasi Terproteksi & RBAC</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <InventoryProvider>
      <InventoryAppContent />
    </InventoryProvider>
  );
}
