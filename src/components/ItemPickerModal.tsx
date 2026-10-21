import React, { useState, useMemo } from 'react';
import { StockItem } from '../types/inventory';
import {
  Search,
  Check,
  MapPin,
  X,
  AlertCircle,
  Plus,
  Boxes,
  Minus,
  Sliders,
} from 'lucide-react';

interface ItemPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockItems: StockItem[];
  selectedItemIds: string[];
  onSelectItem: (item: StockItem, requestedQty: number) => void;
  title?: string;
  subtitle?: string;
  replaceModeIndex?: number | null; // If replacing a specific line item
}

export const ItemPickerModal: React.FC<ItemPickerModalProps> = ({
  isOpen,
  onClose,
  stockItems,
  selectedItemIds,
  onSelectItem,
  title = 'Pilih Item Barang dari Gudang',
  subtitle = 'Cari dan tentukan jumlah barang yang akan dimasukkan ke nota.',
  replaceModeIndex = null,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Unique categories
  const categories = useMemo(() => {
    return ['ALL', ...Array.from(new Set(stockItems.map((i) => i.category)))];
  }, [stockItems]);

  const filteredItems = useMemo(() => {
    return stockItems.filter((item) => {
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.sku.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [stockItems, selectedCategory, searchQuery]);

  if (!isOpen) return null;

  const getQty = (itemId: string, available: number) => {
    const val = quantities[itemId];
    if (val !== undefined) return Math.min(val, Math.max(1, available));
    return 1;
  };

  const handleQtyChange = (itemId: string, val: number, maxAvailable: number) => {
    const clamped = Math.max(1, Math.min(val, Math.max(1, maxAvailable)));
    setQuantities((prev) => ({ ...prev, [itemId]: clamped }));
  };

  const handleConfirmSelect = (item: StockItem) => {
    const available = item.currentStock - item.allocatedStock;
    const qty = getQty(item.id, available);
    onSelectItem(item, qty);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">{title}</h2>
              <p className="text-[11px] sm:text-xs text-slate-300">
                {replaceModeIndex !== null ? 'Pilih barang pengganti untuk baris ini' : subtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 shrink-0 space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ketik kode SKU, nama barang, rak, atau spesifikasi..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                Hapus
              </button>
            )}
          </div>

          {/* Categories Tab Strip */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 font-medium rounded-lg whitespace-nowrap transition-colors text-xs ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                {cat === 'ALL' ? 'Semua Kategori' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Item List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 divide-y divide-slate-100 space-y-3">
          {filteredItems.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              Tidak ada barang yang cocok dengan pencarian "{searchQuery}".
            </div>
          ) : (
            filteredItems.map((item) => {
              const available = item.currentStock - item.allocatedStock;
              const isOutOfStock = available <= 0;
              const isAlreadySelected = selectedItemIds.includes(item.id) && replaceModeIndex === null;
              const currentQty = getQty(item.id, available);

              return (
                <div
                  key={item.id}
                  className={`p-3.5 sm:p-4 rounded-xl border transition-all flex flex-col gap-3 ${
                    isOutOfStock
                      ? 'bg-slate-50 border-slate-200 opacity-60'
                      : isAlreadySelected
                      ? 'bg-amber-50/50 border-amber-200'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                  }`}
                >
                  {/* Top: Info Row */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono font-bold bg-slate-100 text-slate-900 px-2 py-0.5 rounded">
                          {item.sku}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs text-slate-500">{item.category}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs text-slate-600 flex items-center gap-1 font-mono">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {item.location}
                        </span>
                      </div>

                      <h4 className="text-sm font-semibold text-slate-900 leading-snug">
                        {item.name}
                      </h4>

                      {item.description && (
                        <p className="text-xs text-slate-500 line-clamp-1">{item.description}</p>
                      )}

                      {/* Stock status indicator */}
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs pt-1">
                        <span className="text-slate-500">
                          Fisik di rak: <strong>{item.currentStock} {item.unit}</strong>
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-700 font-medium">
                          Stok Min: <strong className="font-mono text-slate-900">{item.minStock} {item.unit}</strong>
                        </span>
                        {item.allocatedStock > 0 && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span className="text-amber-700">
                              Dialokasikan: {item.allocatedStock} {item.unit}
                            </span>
                          </>
                        )}
                        <span className="text-slate-300">·</span>
                        <span
                          className={`font-semibold font-mono tabular-nums ${
                            available > 5
                              ? 'text-emerald-700'
                              : available > 0
                              ? 'text-amber-700'
                              : 'text-red-600'
                          }`}
                        >
                          Tersedia: {available} {item.unit}
                        </span>
                      </div>
                    </div>

                    {/* Stock Badge */}
                    <div className="shrink-0 self-start sm:self-auto">
                      {isOutOfStock ? (
                        <span className="text-xs font-semibold text-red-600 px-2.5 py-1 bg-red-50 rounded-lg border border-red-200">
                          Stok Habis
                        </span>
                      ) : (
                        <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                          Maks: {available} {item.unit}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom: Quantity Entry & Action Bar */}
                  {!isOutOfStock && (
                    <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70 p-2.5 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700">Jumlah Diambil:</span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          (Maks. {available} {item.unit})
                        </span>
                      </div>

                      {/* Stepper + Select Action Button */}
                      <div className="flex items-center justify-end gap-2 shrink-0">
                        {/* Quick Presets */}
                        {available >= 4 && (
                          <div className="hidden sm:flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleQtyChange(item.id, 1, available)}
                              className="px-2 py-1 text-[10px] font-semibold bg-white border border-slate-200 rounded hover:bg-slate-100"
                            >
                              1
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleQtyChange(item.id, Math.max(1, Math.floor(available / 2)), available)
                              }
                              className="px-2 py-1 text-[10px] font-semibold bg-white border border-slate-200 rounded hover:bg-slate-100"
                            >
                              50%
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQtyChange(item.id, available, available)}
                              className="px-2 py-1 text-[10px] font-semibold bg-white border border-slate-200 rounded hover:bg-slate-100"
                            >
                              Max
                            </button>
                          </div>
                        )}

                        {/* Plus / Minus Stepper */}
                        <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleQtyChange(item.id, currentQty - 1, available)}
                            disabled={currentQty <= 1}
                            className="px-2.5 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            max={available}
                            value={currentQty}
                            onChange={(e) =>
                              handleQtyChange(item.id, parseInt(e.target.value) || 1, available)
                            }
                            className="w-12 py-1 text-center font-mono font-bold text-xs focus:outline-hidden"
                          />
                          <button
                            type="button"
                            onClick={() => handleQtyChange(item.id, currentQty + 1, available)}
                            disabled={currentQty >= available}
                            className="px-2.5 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Select Button */}
                        <button
                          type="button"
                          onClick={() => handleConfirmSelect(item)}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors shadow-xs ${
                            isAlreadySelected
                              ? 'bg-amber-600 hover:bg-amber-500 text-white'
                              : 'bg-slate-900 hover:bg-slate-800 text-white'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isAlreadySelected ? 'Update Qty' : '+ Masukkan'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-500 text-[11px] sm:text-xs">
            Ditemukan {filteredItems.length} dari {stockItems.length} barang di katalog
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
