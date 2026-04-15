/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/src/lib/supabase';
import { Product } from '@/src/types';
import Header from '@/src/components/Header';
import ProductList from '@/src/components/ProductList';
import Scanner from '@/src/components/Scanner';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle } from 'lucide-react';

const getCatalog = () => JSON.parse(localStorage.getItem('catalog') || '[]');
const saveCatalog = (catalog: any[]) => localStorage.setItem('catalog', JSON.stringify(catalog));

const getInventory = () => JSON.parse(localStorage.getItem('inventory') || '[]');
const saveInventory = (inventory: any[]) => localStorage.setItem('inventory', JSON.stringify(inventory));

function findProductByBarcode(barcode: string) {
  const catalog = getCatalog();
  return catalog.find((p: any) => p.barcode === barcode);
}

function createNewProduct(product: any) {
  const catalog = getCatalog();
  catalog.push(product);
  saveCatalog(catalog);
}

function addToInventory(barcode: string) {
  const inventory = getInventory();
  const item = inventory.find((i: any) => i.barcode === barcode);

  if (item) {
    item.quantity += 1;
    item.updated_at = new Date().toISOString();
  } else {
    inventory.push({ 
      barcode, 
      quantity: 1,
      updated_at: new Date().toISOString()
    });
  }

  saveInventory(inventory);
}

interface ProductListProps {
  products: Product[];
  lastScannedId?: string | null;
  onUpdate: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastScanned, setLastScanned] = useState<{ barcode: string; name: string; quantity: number } | null>(null);
  const [lastScannedId, setLastScannedId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showInventoryView, setShowInventoryView] = useState(false);
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) setTheme(savedTheme);
  }, []);

  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.body.className = theme;
  }, [theme]);

  const processingLockRef = useRef(false);
  const lastScanTimeRef = useRef(0);
  const lastBarcodeRef = useRef<string | null>(null);

  const handleScanRef = useRef<((barcode: string) => void) | null>(null);

  // Fetch initial products
  const fetchProducts = useCallback(async () => {
    try {
      // Fetch both products and inventory
      const { data: inventoryData, error: invError } = await supabase
        .from('inventory')
        .select('*');
        
      const { data: catalogData, error: catError } = await supabase
        .from('products')
        .select('*');

      if (invError || catError) {
        const err = invError || catError;
        console.error('Error fetching data:', err);
        setIsConnected(false);
        setError(`Supabase Error: ${err?.message || 'Connection failed'}`);
        return;
      }

      // Join catalog and inventory for UI
      const joinedProducts: Product[] = (inventoryData || []).map((inv: any) => {
        const cat = (catalogData || []).find((c: any) => c.barcode === inv.barcode);
        return {
          id: inv.barcode, // Use barcode as ID for UI operations
          barcode: inv.barcode,
          name: cat ? cat.name : 'Unknown Product',
          quantity: inv.quantity,
          created_at: cat ? cat.created_at : new Date().toISOString(),
          updated_at: inv.updated_at
        };
      });

      joinedProducts.sort((a: Product, b: Product) => {
        const dateA = new Date(a.updated_at || a.created_at).getTime();
        const dateB = new Date(b.updated_at || b.created_at).getTime();
        return dateB - dateA;
      });
      
      setProducts(joinedProducts);
      setIsConnected(true);
    } catch (err) {
      console.error('Error fetching products:', err);
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('inventory-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
        fetchProducts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchProducts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchProducts]);

  const handleUpdate = async (id: string, name: string) => {
    try {
      // Check if product exists in catalog
      const { data: existing } = await supabase
        .from('products')
        .select('*')
        .eq('barcode', id)
        .maybeSingle();
        
      if (existing) {
        await supabase.from('products').update({ name }).eq('barcode', id);
      } else {
        await supabase.from('products').insert([{ barcode: id, name }]);
      }
      
      fetchProducts();
    } catch (err: any) {
      console.error('Error updating product:', err);
      setError(`Failed to update product: ${err?.message || 'Unknown error'}`);
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await supabase.from('inventory').delete().eq('barcode', id);
      fetchProducts();
    } catch (err: any) {
      console.error('Error deleting product:', err);
      setError(`Failed to delete product: ${err?.message || 'Unknown error'}`);
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleDeleteAll = async () => {
    try {
      await supabase.from('inventory').delete().neq('barcode', 'impossible_value');
      await supabase.from('products').delete().neq('barcode', 'impossible_value');
      fetchProducts();
      setSuccessMessage('All data deleted successfully');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error('Error deleting all data:', err);
      setError(`Failed to delete all data: ${err?.message || 'Unknown error'}`);
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleScan = async (rawBarcode: string) => {
    const barcode = rawBarcode.trim();
    if (!barcode) return;

    const now = Date.now();

    // 1. Check processing lock (synchronous)
    if (processingLockRef.current) return;

    // 2. Check cooldown (1000ms)
    if (now - lastScanTimeRef.current < 1000) return;

    // 3. Check same barcode repeat within 1000ms
    if (barcode === lastBarcodeRef.current && now - lastScanTimeRef.current < 1000) return;

    // Lock
    processingLockRef.current = true;
    setIsProcessing(true);
    lastScanTimeRef.current = now;
    lastBarcodeRef.current = barcode;

    try {
      // 1. Check catalog
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('barcode', barcode)
        .maybeSingle();

      if (productError) throw productError;

      let catItem = product;

      if (!product) {
        // Create new product
        const newProduct = {
          barcode,
          name: "Unknown Product"
        };
        const { data: insertedProduct, error: insertError } = await supabase
          .from('products')
          .insert([newProduct])
          .select()
          .single();
          
        if (insertError) throw insertError;
        catItem = insertedProduct;
      }

      // 2. Check inventory
      const { data: inventoryItem, error: invItemError } = await supabase
        .from('inventory')
        .select('*')
        .eq('barcode', barcode)
        .maybeSingle();

      if (invItemError) throw invItemError;

      let updatedQuantity = 1;

      if (inventoryItem) {
        updatedQuantity = inventoryItem.quantity + 1;
        await supabase
          .from('inventory')
          .update({ 
            quantity: updatedQuantity,
            updated_at: new Date().toISOString()
          })
          .eq('barcode', barcode);
      } else {
        await supabase
          .from('inventory')
          .insert([{ 
            barcode, 
            quantity: 1,
            updated_at: new Date().toISOString()
          }]);
      }

      fetchProducts();

      setLastScanned({ 
        barcode: catItem.barcode, 
        name: catItem.name, 
        quantity: updatedQuantity 
      });
      setLastScannedId(barcode);

      // Clear success indicator after 5 seconds
      setTimeout(() => {
        setLastScanned(null);
      }, 5000);

      // Clear highlight after 3 seconds
      setTimeout(() => {
        setLastScannedId(null);
      }, 3000);

    } catch (err: any) {
      console.error('Error processing scan:', err);
      setError(`Failed to process scan: ${err?.message || 'Unknown error'}`);
      setTimeout(() => setError(null), 5000);
    } finally {
      // Keep the lock for a bit longer to prevent double scans
      setTimeout(() => {
        processingLockRef.current = false;
        setIsProcessing(false);
      }, 800);
    }
  };

  handleScanRef.current = handleScan;

  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const currentTime = Date.now();
      
      // Reset buffer if typing is too slow (> 50ms per keystroke)
      // Physical scanners type very fast (usually < 20ms per char)
      if (currentTime - lastKeyTime > 50) {
        buffer = '';
      }
      
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        const barcode = buffer.trim();
        if (barcode.length > 0) {
          if (handleScanRef.current) {
            handleScanRef.current(barcode);
          }
        }
        buffer = '';
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#F1F5F9] flex flex-col font-sans text-[#1E293B] theme-container">
      <Header 
        isConnected={isConnected} 
        showInventoryView={showInventoryView}
        onToggleInventory={() => setShowInventoryView(!showInventoryView)}
        theme={theme}
        onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")}
      />
      
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 font-bold"
          >
            <AlertCircle size={20} />
            {error}
          </motion.div>
        )}
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 font-bold"
          >
            <AlertCircle size={20} />
            {successMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <main className={cn(
        "flex-grow flex flex-col lg:grid",
        showInventoryView ? "block" : "lg:grid-cols-[1fr_400px]"
      )}>
        {/* Mobile: Scanner on top, Desktop: Scanner on right */}
        <div className={cn(
          "flex-1 overflow-visible",
          showInventoryView ? "block" : "order-2 lg:order-1"
        )}>
          <ProductList 
            products={products} 
            lastScannedId={lastScannedId} 
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onDeleteAll={handleDeleteAll}
          />
        </div>
        
        {!showInventoryView && (
          <div className="order-1 lg:order-2 border-b lg:border-b-0 lg:border-l border-[#E2E8F0] bg-white w-full lg:h-full theme-container">
            <Scanner 
              onScan={handleScan} 
              lastScan={lastScanned} 
              isProcessing={isProcessing} 
            />
          </div>
        )}
      </main>
    </div>
  );
}

import { cn } from '@/src/lib/utils';
