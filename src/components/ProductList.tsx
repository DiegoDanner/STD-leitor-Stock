import { Product } from '@/src/types';
import { cn } from '@/src/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Download, Search, Trash2, Edit2, Check, X, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import * as XLSX from 'xlsx';

interface ProductListProps {
  products: Product[];
  lastScannedId?: string | null;
  onUpdate: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDeleteAll: () => Promise<void>;
}

export default function ProductList({ products, lastScannedId, onUpdate, onDelete, onDeleteAll }: ProductListProps) {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.barcode.includes(search)
  );

  const handleExport = () => {
    // Sheet 1: Inventory
    const inventoryData = [
      ["Product Name", "Barcode", "Quantity", "Last Updated"],
      ...products.map(p => [
        p.name,
        p.barcode,
        p.quantity,
        new Date(p.updated_at || p.created_at).toLocaleString()
      ])
    ];
    const wsInventory = XLSX.utils.aoa_to_sheet(inventoryData);
    wsInventory['!cols'] = [
      { wch: 30 }, // Product Name
      { wch: 20 }, // Barcode
      { wch: 10 }, // Quantity
      { wch: 25 }  // Last Updated
    ];
    wsInventory['!views'] = [{ state: 'frozen', ySplit: 1 }];

    // Sheet 2: Products Catalog
    const productsData = [
      ["Product Name", "Barcode", "Created At"],
      ...products.map(p => [
        p.name,
        p.barcode,
        new Date(p.created_at).toLocaleString()
      ])
    ];
    const wsProducts = XLSX.utils.aoa_to_sheet(productsData);
    wsProducts['!cols'] = [
      { wch: 30 }, // Product Name
      { wch: 20 }, // Barcode
      { wch: 25 }  // Created At
    ];
    wsProducts['!views'] = [{ state: 'frozen', ySplit: 1 }];

    // Create Workbook and append sheets
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsInventory, "Inventory");
    XLSX.utils.book_append_sheet(wb, wsProducts, "Products");

    // Export File
    XLSX.writeFile(wb, "InventoryFlow_Export.xlsx");
  };

  const startEditing = (product: Product) => {
    setEditingId(product.id);
    setEditName(product.name);
  };

  const saveEdit = async () => {
    if (editingId && editName.trim()) {
      await onUpdate(editingId, editName.trim());
      setEditingId(null);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      await onDelete(id);
    }
  };

  const confirmDeleteAll = async () => {
    if (deleteConfirmText === 'DELETE') {
      await onDeleteAll();
      setShowDeleteAllModal(false);
      setDeleteConfirmText('');
    }
  };

  return (
    <section className="p-6 border-r border-[#E2E8F0] flex flex-col bg-[#F8FAFC] flex-1 overflow-visible">
      <div className="flex justify-between items-center mb-5">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-[#1E293B]">Inventory Overview</h2>
          <p className="text-sm text-[#64748B]">
            Tracking {products.reduce((acc, p) => acc + p.quantity, 0)} total items across {products.length} SKUs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowDeleteAllModal(true)}
            className="px-3 py-1.5 border border-red-200 rounded-md font-medium text-xs text-red-600 bg-red-50 hover:bg-red-100 flex items-center gap-1.5 transition-colors"
            title="Delete All Data"
          >
            <Trash2 size={14} />
            Delete All
          </button>
          <button 
            onClick={handleExport}
            className="px-4 py-2 border border-[#E2E8F0] rounded-lg font-semibold text-sm text-[#1E293B] bg-white hover:bg-gray-50 flex items-center gap-2 transition-colors"
          >
            <Download size={16} />
            Export Excel
          </button>
        </div>
      </div>

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" size={18} />
        <input 
          type="text"
          placeholder="Search by name or barcode..."
          className="w-full pl-10 pr-4 py-2 border border-[#E2E8F0] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-visible flex-grow flex flex-col shadow-sm">
        <div className="overflow-visible flex-grow">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-[#64748B] font-bold">Product Name</th>
                <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-[#64748B] font-bold">Barcode ID</th>
                <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-[#64748B] font-bold">Quantity</th>
                <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-[#64748B] font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-[#64748B] italic">
                    No products found. Start scanning to add items.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr 
                    key={product.id}
                    className={cn(
                      "border-b border-[#E2E8F0] transition-colors group",
                      lastScannedId === product.id ? "bg-[#EEF2FF] border-l-4 border-l-[#4F46E5]" : "hover:bg-gray-50"
                    )}
                  >
                    <td className="px-4 py-4">
                      {editingId === product.id ? (
                        <div className="flex items-center gap-2">
                          <input 
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="flex-1 px-2 py-1 border border-[#4F46E5] rounded text-sm focus:outline-none"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit();
                              if (e.key === 'Escape') cancelEdit();
                            }}
                          />
                          <button onClick={saveEdit} className="p-1 text-green-600 hover:bg-green-50 rounded">
                            <Check size={16} />
                          </button>
                          <button onClick={cancelEdit} className="p-1 text-red-600 hover:bg-red-50 rounded">
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <strong className="text-[#1E293B] font-bold">{product.name}</strong>
                          <button 
                            onClick={() => startEditing(product)}
                            className="p-1 text-[#64748B] hover:text-[#4F46E5] opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Edit2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-mono text-sm text-[#4F46E5] font-bold tracking-[1px]">
                        {product.barcode}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={cn(
                        "inline-block px-3 py-1 rounded-full text-sm font-bold font-mono",
                        product.quantity > 10 ? "bg-green-100 text-green-700" : 
                        product.quantity > 0 ? "bg-blue-100 text-blue-700" : 
                        "bg-red-100 text-red-700"
                      )}>
                        {product.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end items-center gap-2">
                        <span className="text-[11px] text-[#64748B] mr-2">
                          {lastScannedId === product.id ? (
                            <span className="text-[#10B981] font-semibold">Just now</span>
                          ) : (
                            formatDistanceToNow(new Date(product.updated_at || product.created_at), { addSuffix: true })
                          )}
                        </span>
                        <button 
                          onClick={() => handleDelete(product.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete product"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showDeleteAllModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 theme-container">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-xl font-bold">Delete All Data</h3>
            </div>
            
            <p className="text-[#1E293B] font-medium mb-2">
              Are you sure you want to delete all data?
            </p>
            <p className="text-[#64748B] text-sm mb-6">
              This action cannot be undone. All products and inventory records will be permanently removed.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-[#1E293B] mb-2">
                Type <span className="text-red-600 font-mono bg-red-50 px-1 py-0.5 rounded">DELETE</span> to confirm:
              </label>
              <input 
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-4 py-2 border border-[#E2E8F0] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => {
                  setShowDeleteAllModal(false);
                  setDeleteConfirmText('');
                }}
                className="px-4 py-2 rounded-lg font-semibold text-sm text-[#64748B] hover:bg-[#F1F5F9] transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteAll}
                disabled={deleteConfirmText !== 'DELETE'}
                className="px-4 py-2 rounded-lg font-semibold text-sm text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
