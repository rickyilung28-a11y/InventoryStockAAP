import React, { useState, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import { StorageLocation, StockItem } from '../types/inventory';
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  Search,
  AlertTriangle,
  X,
  Boxes,
  Barcode,
} from 'lucide-react';
import { ThermalLabelDesignerModal } from '../components/ThermalLabelDesignerModal';

interface StorageLocationsViewProps {
  onSelectRackForFilter?: (rackCode: string) => void;
}

export const StorageLocationsView: React.FC<StorageLocationsViewProps> = () => {
  const {
    currentUser,
    stockItems,
    storageLocations,
    addStorageLocation,
    updateStorageLocation,
    deleteStorageLocation,
  } = useInventory();

  const isAdmin = currentUser?.role === 'admin';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>('ALL');

  // Barcode Printing State
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [barcodePreselectedId, setBarcodePreselectedId] = useState<string | undefined>(undefined);

  // Modal Create
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formZone, setFormZone] = useState('Zona A - Sparepart Mesin');
  const [formDesc, setFormDesc] = useState('');
  const [formError, setFormError] = useState('');

  // Modal Edit
  const [editingLocation, setEditingLocation] = useState<StorageLocation | null>(null);

  // Modal Delete
  const [locationToDelete, setLocationToDelete] = useState<StorageLocation | null>(null);
  const [deleteError, setDeleteError] = useState('');

  // Extract unique zones
  const zones = useMemo(() => {
    const list = storageLocations.map((s) => s.zone || 'Zona Umum').filter(Boolean);
    return ['ALL', ...Array.from(new Set(list))];
  }, [storageLocations]);

  // Map items per rack
  const getRackItems = (loc: StorageLocation): StockItem[] => {
    const codeLower = loc.code.trim().toLowerCase();
    const nameLower = loc.name.trim().toLowerCase();
    return stockItems.filter((item) => {
      const itemLoc = item.location.trim().toLowerCase();
      return itemLoc === codeLower || itemLoc === nameLower;
    });
  };

  const filteredLocations = useMemo(() => {
    return storageLocations.filter((loc) => {
      if (selectedZone !== 'ALL' && (loc.zone || 'Zona Umum') !== selectedZone) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const rackItems = getRackItems(loc);
      const matchesRackItem = rackItems.some(
        (i) => i.sku.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)
      );
      return (
        loc.code.toLowerCase().includes(q) ||
        loc.name.toLowerCase().includes(q) ||
        (loc.zone && loc.zone.toLowerCase().includes(q)) ||
        (loc.description && loc.description.toLowerCase().includes(q)) ||
        matchesRackItem
      );
    });
  }, [storageLocations, selectedZone, searchQuery, stockItems]);

  const handleOpenAdd = () => {
    setFormCode('');
    setFormName('');
    setFormZone('Zona A - Sparepart Mesin');
    setFormDesc('');
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const res = addStorageLocation({
      code: formCode,
      name: formName,
      zone: formZone,
      description: formDesc,
    });

    if (res.success) {
      setIsAddModalOpen(false);
    } else {
      setFormError(res.error || 'Gagal menambahkan lokasi penyimpanan.');
    }
  };

  const handleOpenEdit = (loc: StorageLocation) => {
    setEditingLocation(loc);
    setFormCode(loc.code);
    setFormName(loc.name);
    setFormZone(loc.zone || 'Zona A - Sparepart Mesin');
    setFormDesc(loc.description || '');
    setFormError('');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLocation) return;
    setFormError('');

    const res = updateStorageLocation(editingLocation.id, {
      code: formCode,
      name: formName,
      zone: formZone,
      description: formDesc,
    });

    if (res.success) {
      setEditingLocation(null);
    } else {
      setFormError(res.error || 'Gagal memperbarui lokasi penyimpanan.');
    }
  };

  const handleConfirmDelete = () => {
    if (!locationToDelete) return;
    const res = deleteStorageLocation(locationToDelete.id);
    if (!res.success) {
      setDeleteError(res.error || 'Gagal menghapus lokasi penyimpanan.');
    } else {
      setLocationToDelete(null);
      setDeleteError('');
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Sub-Master Lokasi &amp; Rak Penyimpanan Gudang
            </h2>
            <p className="text-xs text-slate-500">
              Daftar rak penyimpanan beserta rincian barang &amp; batas Stock Minimum pada setiap barang di rak.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setBarcodePreselectedId(undefined);
              setIsBarcodeModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors shadow-xs"
            title="Cetak label barcode stiker rak untuk printer thermal Clabel"
          >
            <Barcode className="w-4 h-4 text-slate-950" />
            <span>Cetak Barcode Rak (Clabel)</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>+ Tambah Lokasi / Rak Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <span className="font-semibold text-slate-500 mr-1 shrink-0">Filter Zona:</span>
          {zones.map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setSelectedZone(z)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                selectedZone === z
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {z === 'ALL' ? 'Semua Zona' : z}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari kode rak, nama barang, zona..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-slate-900"
          />
        </div>
      </div>

      {/* Table of Storage Locations & Sub-Master Items with Minimum Stock */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-4 py-3 w-32">Kode Rak</th>
                <th className="px-4 py-3">Nama Lokasi / Rak &amp; Zona</th>
                <th className="px-4 py-3">
                  Daftar Barang di Sub-Master Rak &amp; Stock Minimum
                </th>
                <th className="px-4 py-3 text-center w-28">Total Item</th>
                {isAdmin && <th className="px-4 py-3 text-right w-24">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLocations.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="px-4 py-8 text-center text-slate-500">
                    Tidak ada lokasi rak yang sesuai dengan pencarian "{searchQuery}".
                  </td>
                </tr>
              ) : (
                filteredLocations.map((loc) => {
                  const rackItems = getRackItems(loc);
                  const itemCount = rackItems.length;
                  return (
                    <tr key={loc.id} className="hover:bg-slate-50/70 transition-colors align-top">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        <span className="inline-block px-2.5 py-1 bg-slate-100 rounded text-slate-900 border border-slate-200">
                          {loc.code}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{loc.name}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {loc.zone || 'Zona Umum'}
                          </span>
                          {loc.description && (
                            <span className="text-[11px] text-slate-500">{loc.description}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {rackItems.length === 0 ? (
                          <span className="text-slate-400 italic text-[11px]">
                            Belum ada barang terdaftar di rak ini
                          </span>
                        ) : (
                          <div className="space-y-1.5">
                            {rackItems.map((item) => {
                              const isLow = item.currentStock <= item.minStock;
                              return (
                                <div
                                  key={item.id}
                                  className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px]"
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="font-mono font-bold text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                      {item.sku}
                                    </span>
                                    <span className="font-semibold text-slate-800 truncate">
                                      {item.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0 font-mono">
                                    <span className="text-slate-600">
                                      Stok: <strong className="text-slate-900">{item.currentStock} {item.unit}</strong>
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 rounded font-bold border ${
                                        isLow
                                          ? 'bg-red-100 text-red-900 border-red-300'
                                          : 'bg-amber-100 text-amber-950 border-amber-300'
                                      }`}
                                    >
                                      Stock Min: {item.minStock} {item.unit}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
                            itemCount > 0
                              ? 'bg-blue-100 text-blue-900'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <Boxes className="w-3 h-3" />
                          <span>{itemCount} Item</span>
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setBarcodePreselectedId(loc.id);
                                setIsBarcodeModalOpen(true);
                              }}
                              className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Cetak Barcode Stiker untuk Rak ini (Clabel)"
                            >
                              <Barcode className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(loc)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Edit Rak"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setLocationToDelete(loc);
                                setDeleteError('');
                              }}
                              disabled={itemCount > 0}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              title={
                                itemCount > 0
                                  ? 'Tidak dapat dihapus karena ada barang tersimpan'
                                  : 'Hapus Rak'
                              }
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add Storage Location */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm sm:text-base">Tambah Lokasi / Rak Baru</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdd} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 font-medium">
                  {formError}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Kode / Nomor Rak <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="Contoh: Rak A-03 atau PALLET-03"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold focus:ring-1 focus:ring-slate-900 focus:outline-hidden uppercase"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Lokasi / Rak <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Contoh: Rak A-03 (Kompresor & Selang Angin)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Zona / Area Wilayah Gudang
                </label>
                <input
                  type="text"
                  value={formZone}
                  onChange={(e) => setFormZone(e.target.value)}
                  placeholder="Contoh: Zona A - Sparepart Mesin"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Keterangan / Posisi Fisik (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Contoh: Baris ketiga dekat pintu keluar timur"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Simpan Rak Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Storage Location */}
      {editingLocation && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm sm:text-base">Edit Lokasi / Rak Penyimpanan</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingLocation(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 font-medium">
                  {formError}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Kode / Nomor Rak <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold focus:ring-1 focus:ring-slate-900 focus:outline-hidden uppercase"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Lokasi / Rak <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Zona / Area Wilayah Gudang
                </label>
                <input
                  type="text"
                  value={formZone}
                  onChange={(e) => setFormZone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Keterangan / Posisi Fisik
                </label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingLocation(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Rak */}
      {locationToDelete && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 text-xs">
            <div className="w-11 h-11 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 text-center">
              Hapus Lokasi Rak "{locationToDelete.code}"?
            </h3>
            <p className="text-slate-600 text-center mt-1.5">
              Anda yakin ingin menghapus lokasi <strong>{locationToDelete.name}</strong> dari daftar rak penyimpanan?
            </p>
            {deleteError && (
              <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setLocationToDelete(null)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg"
              >
                Ya, Hapus Rak
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cetak Barcode Stiker Thermal Rak (Clabel & Saved Templates) */}
      {isBarcodeModalOpen && (
        <ThermalLabelDesignerModal
          locations={
            barcodePreselectedId
              ? storageLocations.filter((l) => l.id === barcodePreselectedId)
              : storageLocations
          }
          initialMode="locations"
          onClose={() => {
            setIsBarcodeModalOpen(false);
            setBarcodePreselectedId(undefined);
          }}
        />
      )}
    </div>
  );
};
