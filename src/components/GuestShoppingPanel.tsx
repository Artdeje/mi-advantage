import React, { useState, useEffect, useRef } from 'react';
import { db, getCustomerCardBlockReason } from '../lib/supabase';
import { Shop, Sale, Customer } from '../types';
import {
  Camera,
  RefreshCw,
  ShoppingCart,
  Receipt,
  Plus,
  Minus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  UserCheck,
} from './AdminIcons';
import { Html5Qrcode } from 'html5-qrcode';

export interface GuestCartItem {
  name: string;
  price: number;
  qty: number;
}

// Guest shopping: scan a SHOP QR (created by admin) to unlock that shop's
// discount, build a cart, check out, and get a receipt — no member card
// or login needed.
export default function GuestShoppingPanel({ shops }: { shops: Shop[] }) {
  const [guestShop, setGuestShop] = useState<Shop | null>(null);
  const [guestScanMsg, setGuestScanMsg] = useState<string | null>(null);
  const [guestShopCode, setGuestShopCode] = useState('');
  const [guestCart, setGuestCart] = useState<GuestCartItem[]>([]);
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState<number | ''>('');
  const [itemQty, setItemQty] = useState<number | ''>(1);
  const [guestName, setGuestName] = useState('');
  const [guestReceipt, setGuestReceipt] = useState<{ sale: Sale; items: GuestCartItem[] } | null>(null);
  const [isGuestSubmitting, setIsGuestSubmitting] = useState(false);

  // STEP 2 — scanned member card (discount is placed on a real customer).
  // The shop stays autoselected from Step 1; no login needed anywhere.
  const [guestCustomer, setGuestCustomer] = useState<Customer | null>(null);
  const [customerScanMsg, setCustomerScanMsg] = useState<string | null>(null);
  const [customerCode, setCustomerCode] = useState('');
  const [isCustomerCameraActive, setIsCustomerCameraActive] = useState(false);
  const [customerFacingMode, setCustomerFacingMode] = useState<'user' | 'environment'>('environment');
  const [customerScannerError, setCustomerScannerError] = useState<string | null>(null);
  const customerQrRef = useRef<Html5Qrcode | null>(null);
  const customerScannerId = 'guest-customer-scanner';
  const scanLockRef = useRef(false);

  // Dedicated camera scanner for shop codes
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [scannerError, setScannerError] = useState<string | null>(null);
  const qrCodeInstanceRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'guest-shop-scanner';

  const stopCamera = async () => {
    if (qrCodeInstanceRef.current && qrCodeInstanceRef.current.isScanning) {
      try {
        await qrCodeInstanceRef.current.stop();
      } catch (err) {
        console.error('Guest scanner stop error:', err);
      }
    }
    qrCodeInstanceRef.current = null;
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      if (qrCodeInstanceRef.current && qrCodeInstanceRef.current.isScanning) {
        qrCodeInstanceRef.current.stop().catch(console.error);
      }
      if (customerQrRef.current && customerQrRef.current.isScanning) {
        customerQrRef.current.stop().catch(console.error);
      }
    };
  }, []);

  const toggleFacingMode = async () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    if (isCameraActive) {
      await stopCamera();
      await startCamera(nextMode);
    }
  };

  const startCamera = async (mode: 'user' | 'environment') => {
    setScannerError(null);
    setIsCameraActive(true);
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode(scannerContainerId);
        qrCodeInstanceRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: mode },
          {
            fps: 10,
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.75;
              return { width: size, height: size };
            },
          },
          (decodedText) => {
            handleShopScan(decodedText);
          },
          () => {
            // ignore per-frame errors
          },
        );
      } catch (err) {
        console.error('Guest QR camera start failure:', err);
        setScannerError('Camera unavailable. Type the shop code manually below (e.g. SHOP-1001).');
        setIsCameraActive(false);
      }
    }, 150);
  };

  const handleShopScan = async (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;
    setGuestScanMsg(null);
    const shop = await db.getShopByQRCode(cleanCode);
    if (shop) {
      setGuestShop(shop);
      setGuestCart([]);
      setGuestReceipt(null);
      setGuestScanMsg(null);
      await stopCamera();
    } else {
      setGuestScanMsg(
        'Invalid shop code "' + cleanCode + '". Scan the QR displayed at a partner shop counter (e.g. SHOP-1001).',
      );
    }
  };

  // ---- STEP 2 camera: member card scanner (shop stays autoselected) ----
  const stopCustomerCamera = async () => {
    if (customerQrRef.current && customerQrRef.current.isScanning) {
      try {
        await customerQrRef.current.stop();
      } catch (err) {
        console.error('Guest customer scanner stop error:', err);
      }
    }
    customerQrRef.current = null;
    setIsCustomerCameraActive(false);
  };

  const toggleCustomerFacingMode = async () => {
    const nextMode = customerFacingMode === 'user' ? 'environment' : 'user';
    setCustomerFacingMode(nextMode);
    if (isCustomerCameraActive) {
      await stopCustomerCamera();
      await startCustomerCamera(nextMode);
    }
  };

  const startCustomerCamera = async (mode: 'user' | 'environment') => {
    setCustomerScannerError(null);
    setIsCustomerCameraActive(true);
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode(customerScannerId);
        customerQrRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: mode },
          {
            fps: 10,
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.75;
              return { width: size, height: size };
            },
          },
          (decodedText) => {
            handleCustomerScan(decodedText);
          },
          () => {
            // ignore per-frame errors
          },
        );
      } catch (err) {
        console.error('Guest customer camera start failure:', err);
        setCustomerScannerError('Camera unavailable. Type the CARD ID manually below (e.g. CUST-001).');
        setIsCustomerCameraActive(false);
      }
    }, 150);
  };

  const handleCustomerScan = async (code: string) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    try {
      const cleanCode = code.trim();
      if (!cleanCode) return;
      setCustomerScanMsg(null);
      const customer = await db.getCustomerByQRCode(cleanCode);
      if (!customer) {
        setCustomerScanMsg(
          'Invalid card "' + cleanCode + '". Scan a registered member card (e.g. CUST-001) or register free at the counter QR.',
        );
        return;
      }
      const blockReason = getCustomerCardBlockReason(customer);
      if (blockReason) {
        setGuestCustomer(null);
        setCustomerScanMsg(blockReason);
        return;
      }
      setGuestCustomer(customer);
      setCustomerScanMsg(null);
      setCustomerCode('');
      await stopCustomerCamera();
    } finally {
      scanLockRef.current = false;
    }
  };

  const addItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const price = typeof itemPrice === 'number' ? itemPrice : 0;
    const qty = typeof itemQty === 'number' ? itemQty : 0;
    if (!itemName.trim() || price <= 0 || qty <= 0) {
      alert('Enter a product name, a price above 0, and a quantity of at least 1.');
      return;
    }
    setGuestCart((prev) => [...prev, { name: itemName.trim(), price: price, qty: Math.floor(qty) }]);
    setItemName('');
    setItemPrice('');
    setItemQty(1);
  };

  const updateQty = (index: number, delta: number) => {
    setGuestCart((prev) =>
      prev.map((it, i) => (i === index ? { name: it.name, price: it.price, qty: Math.max(1, it.qty + delta) } : it)),
    );
  };

  const removeItem = (index: number) => {
    setGuestCart((prev) => prev.filter((_, i) => i !== index));
  };

  const subtotal = guestCart.reduce((acc, it) => acc + it.price * it.qty, 0);
  const discountPercent = guestShop ? guestShop.discount_percent : 0;
  const discountVal = Math.round((subtotal * discountPercent) / 100);
  const total = Math.max(0, subtotal - discountVal);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestShop || guestCart.length === 0 || !guestCustomer) return;
    setIsGuestSubmitting(true);
    try {
      const buyer = guestName.trim() || guestCustomer.name;
      const result = await db.createSale(guestShop.id, buyer, subtotal, guestCustomer.id);
      if (result.error) {
        alert(result.error);
      } else if (result.sale) {
        setGuestReceipt({ sale: result.sale, items: guestCart.slice() });
        setGuestCart([]);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to record guest purchase.');
    } finally {
      setIsGuestSubmitting(false);
    }
  };

  const resetFlow = () => {
    setGuestShop(null);
    setGuestCustomer(null);
    setCustomerScanMsg(null);
    setCustomerCode('');
    setGuestCart([]);
    setGuestReceipt(null);
    setGuestScanMsg(null);
    setGuestShopCode('');
    setGuestName('');
    setItemName('');
    setItemPrice('');
    setItemQty(1);
  };

  const itemCount = guestCart.reduce((a, it) => a + it.qty, 0);
  const otherShops = guestShop ? shops.filter((s) => s.id !== guestShop.id) : [];

  return (
    <div className="space-y-6" id="guest-shopping-portal">
      {guestShop && otherShops.length > 0 && (
        <div className="overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-sm">
          <p className="px-4 pt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
            Also visit our other partner shops
          </p>
          <div className="flex w-max animate-marquee gap-3 px-4 py-3">
            {otherShops.concat(otherShops).map((s, i) => (
              <div key={s.id + '-' + i} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 shrink-0">
                {s.profile_picture ? (
                  <img src={s.profile_picture} alt={s.shop_name} className="w-7 h-7 rounded-lg object-cover" />
                ) : (
                  <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-[10px]">
                    {s.shop_name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="leading-tight">
                  <p className="text-[11px] font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">{s.shop_name}</p>
                  <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{s.discount_percent}% off</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!guestShop && (
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-5 md:p-6 space-y-5">
          <div className="text-center space-y-1">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Step 1: Scan a Shop QR Code</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Point your camera at the QR displayed at any partner shop counter. The shop is
              autoselected — then scan the member card, build the cart, and get the discounted receipt.
              No login needed.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden min-h-[220px]">
            {!isCameraActive && (
              <div className="py-6 px-4 flex flex-col items-center text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400">
                  <Camera className="w-6 h-6" />
                </div>
                <button
                  onClick={() => startCamera(facingMode)}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                >
                  Scan Shop QR
                </button>
              </div>
            )}
            {isCameraActive && (
              <div className="w-full relative">
                <div id={scannerContainerId} className="w-full overflow-hidden rounded-xl border border-slate-800 bg-black min-h-[220px]" />
                <button
                  onClick={stopCamera}
                  className="absolute bottom-3 right-3 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  Stop Camera
                </button>
              </div>
            )}
            {scannerError && (
              <div className="mt-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-900 rounded-xl p-3 flex items-start gap-2 text-left text-xs text-amber-800 dark:text-amber-300 w-full">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-[11px]">{scannerError}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end">
            <button
              onClick={toggleFacingMode}
              className="px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              title="Toggle front/rear camera"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{facingMode === 'user' ? 'Rear Camera' : 'Front Camera'}</span>
            </button>
          </div>

          {guestScanMsg && (
            <div className="bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900 rounded-xl p-3 flex items-start gap-2 text-xs text-red-800 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{guestScanMsg}</span>
            </div>
          )}

          <div className="space-y-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block text-center">
              Or type the shop code manually
            </span>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={guestShopCode}
                onChange={(e) => setGuestShopCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (guestShopCode.trim()) handleShopScan(guestShopCode);
                  }
                }}
                placeholder="e.g. SHOP-1001"
                className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono tracking-wider"
              />
              <button
                type="button"
                onClick={() => {
                  if (guestShopCode.trim()) handleShopScan(guestShopCode);
                }}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap"
              >
                Find Shop
              </button>
            </div>
          </div>
        </div>
      )}

      {guestShop && !guestReceipt && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 flex items-center gap-3">
              {guestShop.profile_picture ? (
                <img src={guestShop.profile_picture} alt={guestShop.shop_name} className="w-12 h-12 rounded-xl object-cover" />
              ) : (
                <span className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-lg">
                  {guestShop.shop_name.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate">{guestShop.shop_name}</h3>
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{guestShop.discount_percent}% discount unlocked</p>
              </div>
              <button onClick={resetFlow} className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 uppercase tracking-wider cursor-pointer shrink-0">
                Change shop
              </button>
            </div>

            {/* STEP 2 — scan the member card the discount is placed on */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <UserCheck className="w-4 h-4" />
                  <span>Step 2: Scan member card</span>
                </span>
                {guestCustomer && (
                  <button
                    type="button"
                    onClick={() => { setGuestCustomer(null); setCustomerScanMsg(null); }}
                    className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 uppercase tracking-wider cursor-pointer"
                  >
                    Change card
                  </button>
                )}
              </div>

              {!guestCustomer ? (
                <div className="space-y-3">
                  {!isCustomerCameraActive ? (
                    <button
                      type="button"
                      onClick={() => startCustomerCamera(customerFacingMode)}
                      className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Scan Customer Card</span>
                    </button>
                  ) : (
                    <div className="relative">
                      <div id={customerScannerId} className="w-full overflow-hidden rounded-xl border border-slate-800 bg-black min-h-[200px]" />
                      <button
                        type="button"
                        onClick={stopCustomerCamera}
                        className="absolute bottom-3 right-3 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                      >
                        Stop Camera
                      </button>
                    </div>
                  )}
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={toggleCustomerFacingMode}
                      className="px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
                      title="Toggle front/rear camera"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>{customerFacingMode === 'user' ? 'Rear Camera' : 'Front Camera'}</span>
                    </button>
                  </div>
                  {customerScannerError && (
                    <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-900 rounded-xl p-3 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <span className="text-[11px]">{customerScannerError}</span>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={customerCode}
                      onChange={(e) => setCustomerCode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (customerCode.trim()) handleCustomerScan(customerCode);
                        }
                      }}
                      placeholder="or type CARD ID e.g. CUST-001"
                      className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono tracking-wider"
                    />
                    <button
                      type="button"
                      onClick={() => { if (customerCode.trim()) handleCustomerScan(customerCode); }}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap"
                    >
                      Find Card
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black">
                    {guestCustomer.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{guestCustomer.name}</p>
                    <p className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-300">{guestCustomer.qr_code}</p>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 ml-auto shrink-0" />
                </div>
              )}

              {customerScanMsg && (
                <div className="bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900 rounded-xl p-3 text-xs text-red-800 dark:text-red-300">
                  <p>{customerScanMsg}</p>
                  <a href="#/join" className="font-bold underline hover:text-red-900 dark:hover:text-red-400">
                    No card yet? Register free for an online card.
                  </a>
                </div>
              )}
            </div>

            <form onSubmit={addItem} className="bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-4 space-y-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Add products to cart</span>
              <input
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="Product name (e.g. Milk 1L)"
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Price"
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-3 text-[10px] font-bold text-slate-400">RWF</span>
                </div>
                <input
                  type="number"
                  min="1"
                  value={itemQty}
                  onChange={(e) => setItemQty(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Qty"
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add to Cart</span>
              </button>
            </form>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800">
              {guestCart.length === 0 && (
                <p className="p-6 text-center text-xs text-slate-400 font-semibold">Your cart is empty. Add products above.</p>
              )}
              {guestCart.map((it, i) => (
                <div key={i} className="p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{it.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">{it.price.toLocaleString()} RWF each</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => updateQty(i, -1)} className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 cursor-pointer" title="Decrease quantity"><Minus className="w-3.5 h-3.5" /></button>
                    <span className="w-6 text-center text-sm font-bold text-slate-800 dark:text-slate-100">{it.qty}</span>
                    <button type="button" onClick={() => updateQty(i, 1)} className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 cursor-pointer" title="Increase quantity"><Plus className="w-3.5 h-3.5" /></button>
                  </div>
                  <span className="w-20 text-right text-sm font-bold text-slate-800 dark:text-slate-100">{(it.price * it.qty).toLocaleString()}</span>
                  <button type="button" onClick={() => removeItem(i)} className="p-1.5 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg text-red-600 dark:text-red-400 cursor-pointer" title="Remove item"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5">
            <form onSubmit={handleCheckout} className="bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-5 space-y-4 lg:sticky lg:top-6">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                <span>Order summary</span>
              </span>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>Items:</span><span className="font-bold text-slate-800 dark:text-slate-100">{itemCount}</span></div>
                <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>Subtotal:</span><span className="font-bold text-slate-800 dark:text-slate-100">{subtotal.toLocaleString()} RWF</span></div>
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold"><span>Discount ({discountPercent}%):</span><span>- {discountVal.toLocaleString()} RWF</span></div>
                <div className="border-t border-slate-100 dark:border-slate-800 pt-2 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Total to pay:</span>
                  <span className="text-base text-emerald-600 dark:text-emerald-400 font-extrabold">{total.toLocaleString()} RWF</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Buyer name (defaults to card holder)</label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder={guestCustomer ? guestCustomer.name : 'e.g. Guest'}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              {!guestCustomer && (
                <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-900 rounded-xl p-2.5">
                  Scan the member card in Step 2 above before checkout — the discount is placed on that card.
                </p>
              )}
              <button
                type="submit"
                disabled={isGuestSubmitting || guestCart.length === 0 || !guestCustomer}
                className="w-full py-3 px-4 rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                <Receipt className="w-4 h-4" />
                <span>{isGuestSubmitting ? 'Processing...' : 'Apply Discount and Get Receipt'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {guestShop && guestReceipt && (
        <div id="guest-receipt" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 space-y-5 max-w-lg mx-auto">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Payment Receipt</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{guestReceipt.sale.shop_name} - {discountPercent}% discount applied</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-xs space-y-1.5">
            <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>Receipt No:</span><span className="font-mono font-bold text-slate-800 dark:text-slate-100">{guestReceipt.sale.id}</span></div>
            <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>Date:</span><span className="font-semibold text-slate-800 dark:text-slate-100">{new Date(guestReceipt.sale.created_at).toLocaleString()}</span></div>
            <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>Buyer:</span><span className="font-semibold text-slate-800 dark:text-slate-100">{guestReceipt.sale.customer_name}</span></div>
          </div>
          <div className="border-t border-dashed border-slate-200 dark:border-slate-800 pt-4 space-y-2 text-sm">
            {guestReceipt.items.map((it, i) => (
              <div key={i} className="flex justify-between gap-3">
                <span className="text-slate-700 dark:text-slate-200 font-medium">{it.name} <span className="text-slate-400 text-xs">x {it.qty}</span></span>
                <span className="font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">{(it.price * it.qty).toLocaleString()} RWF</span>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>Subtotal:</span><span className="font-bold text-slate-800 dark:text-slate-100">{guestReceipt.sale.amount_before_discount.toLocaleString()} RWF</span></div>
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold"><span>Discount ({guestReceipt.sale.discount_percent}%):</span><span>- {guestReceipt.sale.discount_applied.toLocaleString()} RWF</span></div>
            <div className="flex justify-between items-center pt-1"><span className="font-bold text-slate-800 dark:text-slate-100 uppercase text-xs">Total Paid:</span><span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">{guestReceipt.sale.final_amount.toLocaleString()} RWF</span></div>
          </div>
          <p className="text-center text-[11px] text-slate-400">Thank you for shopping with Mi Advantage partners!</p>
          <div className="flex flex-col sm:flex-row gap-2 print:hidden">
            <button
              onClick={() => window.print()}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              Print Receipt
            </button>
            <button
              onClick={() => { setGuestReceipt(null); setGuestName(''); }}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              Continue Shopping
            </button>
            <button
              onClick={resetFlow}
              className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              New Scan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
