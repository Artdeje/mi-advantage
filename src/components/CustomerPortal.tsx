import React, { useState, useEffect, useRef } from 'react';
import {
  db,
  getCustomerCardBlockReason,
  extractScanCode,
  buildShopUrl,
  BUSINESS_TYPE_LABELS,
  DISCOUNT_SCOPE_LABELS,
} from '../lib/supabase';
import { Customer, Shop } from '../types';
import {
  QrCode,
  Camera,
  RefreshCw,
  ShoppingBag,
  CheckCircle2,
  AlertTriangle,
  User,
  ShoppingCart,
  Store,
} from './AdminIcons';
import GuestShoppingPanel from './GuestShoppingPanel';
import ThemeToggle from './ThemeToggle';
import { Html5Qrcode } from 'html5-qrcode';
import { motion, AnimatePresence } from 'motion/react';

export default function CustomerPortal({ onNewSale }: { onNewSale?: () => void }) {
  // Database states
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState('');
  const [portalMode, setPortalMode] = useState<'member' | 'guest'>('member');
  // A logged-in shop gets the full transaction terminal; everyone else (an
  // external phone camera / guest) gets the partner directory after a scan.
  const isShopSession = db.currentUser?.role === 'shop';
  // External scanner result: show the partner directory instead of a form.
  const [showPartners, setShowPartners] = useState(false);
  // Deep link ?shop=SHOP-1001 (from a scanned counter QR) pre-selects the shop.
  const [pendingShopCode, setPendingShopCode] = useState('');
  
  // Scanned customer state
  const [scannedCustomer, setScannedCustomer] = useState<Customer | null>(null);
  const [scanDone, setScanDone] = useState(false);
  const [amountBefore, setAmountBefore] = useState<number | ''>('');
  const [scanErrorState, setScanErrorState] = useState<string | null>(null);

  // Scanned shop state — a shop QR fills the discount form automatically,
  // so the operator never has to choose the shop from the dropdown.
  const [shopScanCode, setShopScanCode] = useState('');
  const [shopScanMsg, setShopScanMsg] = useState<string | null>(null);
  const [shopAutoSelected, setShopAutoSelected] = useState(false);
  const [isShopCameraActive, setIsShopCameraActive] = useState(false);
  const shopQrRef = useRef<Html5Qrcode | null>(null);
  const shopScannerContainerId = 'reader-shopqr-portal';
  
  // Camera scanning states
  const [isCameraScannerActive, setIsCameraScannerActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [scannerError, setScannerError] = useState<string | null>(null);

  // References for html5-qrcode
  const qrCodeInstanceRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'reader-homepage-portal';
  // Guards against the camera firing multiple decodes for the same card
  // while a lookup is already in flight.
  const scanLockRef = useRef(false);
  // Anchor for the discount-applying form — we scroll to it after a scan.
  const discountFormRef = useRef<HTMLDivElement | null>(null);

  const scrollToDiscountForm = () => {
    setTimeout(() => {
      discountFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  };

  // Load registered shops from database.
  // Note: customer lookup is done per-QR via getCustomerByQRCode (public
  // endpoint), so we don't fetch the full customer list here. The full list
  // requires authentication and would 401 on the public portal.
  const loadDatabaseData = async () => {
    try {
      const shopList = await db.getShops();
      const approvedShops = shopList.filter((s) => !s.status || s.status === 'approved');
      setShops(approvedShops);
      if (approvedShops.length > 0) {
        setSelectedShopId((prev) => prev || approvedShops[0].id);
      }
    } catch (err) {
      console.error('Failed to load portal data:', err);
    }
  };

  useEffect(() => {
    loadDatabaseData();
  }, []);

  // Deep link: read ?shop=… once from the hash, then resolve it against the
  // loaded shop list so a scanned counter QR opens with that shop filled in.
  useEffect(() => {
    const readShopCode = () => {
      const h = window.location.hash || '';
      const qi = h.indexOf('?');
      if (qi < 0) return;
      try {
        const params = new URLSearchParams(h.slice(qi + 1));
        const code = params.get('shop') || params.get('ref');
        if (code) setPendingShopCode(extractScanCode(code));
      } catch {
        /* ignore malformed query */
      }
    };
    readShopCode();
    window.addEventListener('hashchange', readShopCode);
    return () => window.removeEventListener('hashchange', readShopCode);
  }, []);

  useEffect(() => {
    if (!pendingShopCode || shops.length === 0) return;
    const wanted = pendingShopCode.toLowerCase();
    const match = shops.find((s) => (s.qr_code || '').toLowerCase() === wanted);
    if (match) {
      setSelectedShopId(match.id);
      setShopAutoSelected(true);
      setPortalMode('member');
      setPendingShopCode('');
    }
  }, [pendingShopCode, shops]);

  // Switch between cameras
  const toggleFacingMode = async () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    if (isCameraScannerActive) {
      await stopCameraScanner();
      await startCameraScanner(nextMode);
    }
  };

  // Start Html5Qrcode camera
  const startCameraScanner = async (mode: 'user' | 'environment') => {
    // Only one camera at a time — stop the shop scanner first.
    await stopShopCamera();
    setScannerError(null);
    setIsCameraScannerActive(true);
    setScanDone(false);

    // Allow container element to render first
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
            }
          },
          (decodedText) => {
            handleQRDecoded(decodedText);
          },
          () => {
            // Constant framing ticks, ignore silent errors
          }
        );
      } catch (err: any) {
        console.error('QR camera start failure:', err);
        setScannerError(
          'Webcam access blocked or unavailable in this window. Use the high-fidelity sandbox buttons below to scan registered members!'
        );
        setIsCameraScannerActive(false);
      }
    }, 150);
  };

  // Stop Html5Qrcode camera
  const stopCameraScanner = async () => {
    if (qrCodeInstanceRef.current && qrCodeInstanceRef.current.isScanning) {
      try {
        await qrCodeInstanceRef.current.stop();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
    qrCodeInstanceRef.current = null;
    setIsCameraScannerActive(false);
  };

  // Stop the shop-QR camera
  const stopShopCamera = async () => {
    if (shopQrRef.current && shopQrRef.current.isScanning) {
      try {
        await shopQrRef.current.stop();
      } catch (err) {
        console.error('Error stopping shop scanner:', err);
      }
    }
    shopQrRef.current = null;
    setIsShopCameraActive(false);
  };

  // Start the shop-QR camera (fills the discount form's shop automatically)
  const startShopCamera = async (mode: 'user' | 'environment') => {
    // Only one camera at a time — stop the member-card scanner first.
    await stopCameraScanner();
    setShopScanMsg(null);
    setIsShopCameraActive(true);
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode(shopScannerContainerId);
        shopQrRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: mode },
          {
            fps: 10,
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.75;
              return { width: size, height: size };
            }
          },
          (decodedText) => {
            handleShopQRScan(decodedText);
          },
          () => {
            // Constant framing ticks, ignore silent errors
          }
        );
      } catch (err: any) {
        console.error('Shop QR camera start failure:', err);
        setShopScanMsg(
          'Camera unavailable. Type the shop code manually below (e.g. SHOP-1001).'
        );
        setIsShopCameraActive(false);
      }
    }, 150);
  };

  // Handle a decoded SHOP-#### code: autoselect the shop in the discount form.
  // If no shop session exists, redirect to login with the shop email pre-filled
  // and the shop QR stored so the scanner auto-selects it after login.
  const handleShopQRScan = async (code: string) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    try {
      const cleanCode = code.trim();
      if (!cleanCode) return;
      const shop = await db.getShopByQRCode(cleanCode);
      if (shop) {
        if (!isShopSession) {
          // Not logged in as a shop — send to login with email + QR pre-filled.
          window.location.hash = `/login?shop=${encodeURIComponent(shop.email)}&shopQr=${encodeURIComponent(shop.qr_code)}`;
          return;
        }
        setSelectedShopId(shop.id);
        setShopAutoSelected(true);
        setShopScanMsg(null);
        setShopScanCode('');
        await stopShopCamera();
        scrollToDiscountForm();
      } else {
        setShopScanMsg(
          `Invalid shop code "${cleanCode}". Scan the QR posted at a partner counter (e.g. SHOP-1001).`
        );
      }
    } finally {
      scanLockRef.current = false;
    }
  };

  // Clean up scanners on unmount
  useEffect(() => {
    return () => {
      if (qrCodeInstanceRef.current && qrCodeInstanceRef.current.isScanning) {
        qrCodeInstanceRef.current.stop().catch(console.error);
      }
      if (shopQrRef.current && shopQrRef.current.isScanning) {
        shopQrRef.current.stop().catch(console.error);
      }
    };
  }, []);

  // Handle Decoded QR code text (expects customer QR code format e.g., "CUST-XXXX")
  const handleQRDecoded = async (qrCodeText: string) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    try {
      const cleanCode = qrCodeText.trim();
      const customer = await db.getCustomerByQRCode(cleanCode);

      if (customer) {
        // Card validity is disabled the moment the expiration date/time is reached.
        // The ONLY message shown is the block reason ("Renew your subscription").
        const blockReason = getCustomerCardBlockReason(customer);
        if (blockReason) {
          setScanErrorState(blockReason);
          setScannedCustomer(null);
          setScanDone(false);
          alert(blockReason);
          return;
        }

        setScanErrorState(null);
        setScannedCustomer(customer);
        setScanDone(true);
        await stopCameraScanner();
        if (isShopSession) {
          // Shop terminal: jump to the discount form (customer ID auto-filled).
          scrollToDiscountForm();
        } else {
          // External scan (phone / other): show the member's partner directory.
          setShowPartners(true);
          setTimeout(() => {
            document
              .getElementById('member-partners-panel')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 150);
        }
      } else {
        setScanErrorState(null);
        alert(`Invalid Card scanned: "${cleanCode}". Please scan a valid registered customer card.`);
      }
    } finally {
      scanLockRef.current = false;
    }
  };

  // Simulated scan fallback for testing/development
  const triggerSimulatorScan = async (code: string) => {
    await handleQRDecoded(code);
  };



  // Submit calculated discount transaction
  const [isSubmittingTx, setIsSubmittingTx] = useState(false);
  const [txSuccess, setTxSuccess] = useState('');

  const activeShop = shops.find(s => s.id === selectedShopId);
  const discountPercent = activeShop ? activeShop.discount_percent : 0;
  const rawAmount = typeof amountBefore === 'number' ? amountBefore : 0;
  const discountVal = Math.round((rawAmount * discountPercent) / 100);
  const finalPayable = Math.max(0, rawAmount - discountVal);

  const handleRecordTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedCustomer) return;

    // Double check if card is blocked (absolute block at transaction time)
    const blockReason = getCustomerCardBlockReason(scannedCustomer);
    if (blockReason) {
      setScanErrorState(blockReason);
      setScannedCustomer(null);
      setScanDone(false);
      alert(blockReason);
      return;
    }

    if (!shopAutoSelected || !activeShop) {
      alert('Please scan the shop QR code first to select this outlet.');
      return;
    }
    if (!amountBefore || amountBefore <= 0) {
      alert('Please fill out a valid transaction purchase amount.');
      return;
    }

    setIsSubmittingTx(true);
    try {
      const { sale, error } = await db.createSale(selectedShopId, scannedCustomer.name, amountBefore, scannedCustomer.id);
      if (error) {
        alert(error);
      } else if (sale) {
        setTxSuccess(`Transaction recorded successfully! Simulated discount applied for ${scannedCustomer.name}.`);
        
        // Reset scanner variables
        setScannedCustomer(null);
        setScanDone(false);
        setAmountBefore('');
        setScanErrorState(null);
        
        // Load database again to capture updated metrics
        await loadDatabaseData();
        if (onNewSale) onNewSale();

        setTimeout(() => setTxSuccess(''), 5000);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to record transaction in database.');
    } finally {
      setIsSubmittingTx(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 py-6 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top nav */}
        <div className="flex items-center justify-between gap-3">
          <a href="#/" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
            <span className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-xs">MA</span>
            <span>Home</span>
          </a>
          <div className="flex items-center gap-2">
            <a href="#/login" className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 text-slate-700 dark:text-slate-200 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all">
              Partner Login
            </a>
            <ThemeToggle />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-8" id="home-transaction-portal">
      
      {/* Title Header */}
      <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900 shadow-sm">
          <QrCode className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Kigali Smart Scan & Loyalty Terminal</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Scan customer membership cards in real-time to compute discount rates and record transaction logs.</p>
        </div>
      </div>

      {/* Mode toggle: member card vs guest shopping */}
      <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5">
        <button
          type="button"
          onClick={() => setPortalMode('member')}
          className={`py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
            portalMode === 'member'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>Member Card</span>
        </button>
        <button
          type="button"
          onClick={() => setPortalMode('guest')}
          className={`py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
            portalMode === 'guest'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Guest Shopping</span>
        </button>
      </div>

      {portalMode === 'member' ? (
        showPartners && scannedCustomer ? (
          <div id="member-partners-panel" className="space-y-6 scroll-mt-6">
            {/* Verified member banner */}
            <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center gap-4">
              <span className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-lg shrink-0">
                {scannedCustomer.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Member card verified</p>
                <p className="text-base font-bold text-slate-800 dark:text-slate-100 truncate">{scannedCustomer.name}</p>
                <p className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-300">{scannedCustomer.qr_code}</p>
              </div>
              <button
                type="button"
                onClick={() => { setShowPartners(false); setScannedCustomer(null); setScanDone(false); }}
                className="shrink-0 px-3 py-2 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-[11px] font-bold uppercase tracking-wider cursor-pointer"
              >
                Scan another
              </button>
            </div>

            {/* Partner directory */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 md:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Where you get your discount</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Show this card at any partner counter to redeem.</p>
                </div>
              </div>
              {shops.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No partner shops yet — check back soon.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {shops.map((s) => (
                    <div key={s.id} className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                      <div className="flex items-center gap-3">
                        {s.profile_picture ? (
                          <img src={s.profile_picture} alt={s.shop_name} className="w-11 h-11 rounded-xl object-cover shrink-0" />
                        ) : (
                          <span className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shrink-0">
                            {s.shop_name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{s.shop_name}</p>
                          <span className="inline-block mt-0.5 bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{s.discount_percent}% OFF</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 min-h-[2rem]">
                        {s.description || 'Verified Mi Advantage partner.'}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {s.business_type && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-0.5 rounded-full">
                            {BUSINESS_TYPE_LABELS[s.business_type] || s.business_type}
                          </span>
                        )}
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900 px-2 py-0.5 rounded-full">
                          {DISCOUNT_SCOPE_LABELS[s.discount_scope || 'all'] || 'All items'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: CAMERA SCANNER & SIMULATOR ACCORDION */}
        <div className="lg:col-span-6 space-y-6" id="qr-scanner-terminal-box">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Step 1: Scan Member Card</span>
              <button
                onClick={toggleFacingMode}
                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                title="Toggle front/rear camera"
              >
                <RefreshCw className="w-3 h-3" />
                <span>{facingMode === 'user' ? 'Rear Camera' : 'Front Camera'}</span>
              </button>
            </div>

            {/* CYBER WEBCAM SCAN VIEW CONTAINER */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden min-h-[250px]">
              <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-emerald-500 rounded-tl pointer-events-none" />
              <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-emerald-500 rounded-tr pointer-events-none" />
              <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-emerald-500 rounded-bl pointer-events-none" />
              <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-emerald-500 rounded-br pointer-events-none" />

              {!isCameraScannerActive ? (
                <div className="py-8 px-4 flex flex-col items-center text-center relative z-10 space-y-4">
                  <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-200 text-sm">Interactive Camera Scanner</h4>
                    <p className="text-xs text-slate-400 max-w-xs mt-1">Activate your mobile/webcam to scan customer membership barcodes directly.</p>
                  </div>
                  <button
                    onClick={() => startCameraScanner(facingMode)}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                  >
                    Start Camera
                  </button>
                </div>
              ) : (
                <div className="w-full relative z-10">
                  <div id={scannerContainerId} className="w-full overflow-hidden rounded-xl border border-slate-800 bg-black min-h-[240px]" />
                  <div className="absolute left-4 right-4 h-0.5 bg-emerald-400/40 shadow-[0_0_12px_#10b981] top-1/2 pointer-events-none animate-pulse" />
                  <button
                    onClick={stopCameraScanner}
                    className="absolute bottom-3 right-3 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all z-20 cursor-pointer"
                  >
                    Stop Camera
                  </button>
                </div>
              )}

              {scannerError && (
                <div className="mt-4 mx-2 bg-amber-50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-900 rounded-xl p-3 flex items-start gap-2 text-left text-xs text-amber-800 dark:text-amber-300 relative z-10">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider text-[10px]">Camera Access Warning</p>
                    <p className="mt-0.5 text-amber-700 dark:text-amber-300 leading-relaxed text-[10px]">{scannerError}</p>
                  </div>
                </div>
              )}

              {scanErrorState && (
                <div className="mt-4 mx-2 bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900 rounded-xl p-3 flex items-start gap-2 text-left text-xs text-red-800 dark:text-red-300 relative z-10 w-full animate-bounce">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-red-950 dark:text-red-200 uppercase tracking-wider text-[10px]">Access Denied: Card Blocked</p>
                    <p className="mt-0.5 text-red-700 dark:text-red-300 leading-relaxed text-[11px]">{scanErrorState}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SIMULATOR QUICK ACTIONS BLOCK */}
          <div className="border-t border-dashed border-slate-100 dark:border-slate-800 pt-5 space-y-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
              ⚡ Live Scan Simulator (Sandbox Mode)
            </span>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              If camera access is blocked in this sandbox browser preview, simulate a card barcode scan by typing the member card code below (e.g. <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1 py-0.5 rounded">CUST-9821</span>):
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                id="simulator-scan-code-input"
                placeholder="Type member token e.g. CUST-9821"
                className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (val) triggerSimulatorScan(val);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const input = document.getElementById('simulator-scan-code-input') as HTMLInputElement;
                  if (input && input.value.trim()) {
                    triggerSimulatorScan(input.value.trim());
                  } else {
                    alert('Please type a valid membership code.');
                  }
                }}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap"
              >
                Simulate Scan
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: TRANSACTION FORM & LIVE CALCULATOR */}
        <div ref={discountFormRef} className="lg:col-span-6 scroll-mt-6" id="qr-transaction-calculator-container">
          <form onSubmit={handleRecordTransaction} className="bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-5 md:p-6 space-y-5 text-slate-800 dark:text-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Step 2: Process Purchase Record</span>
              {scanDone && (
                <span className="bg-emerald-600 text-white px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Card Authenticated</span>
                </span>
              )}
            </div>

            {/* Scanned Customer Input (Read-only status) */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Scanned Advantage Card</label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  readOnly
                  placeholder="Auto-filled: Scan a Member Card QR"
                  value={scannedCustomer ? `${scannedCustomer.name} (${scannedCustomer.qr_code})` : ''}
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 rounded-xl text-sm font-semibold focus:outline-none"
                />
              </div>
              {scannedCustomer && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1.5 block">
                  ✓ Active privilege matched for cardholder: {scannedCustomer.name}
                </span>
              )}
            </div>

            {/* Partner shop — autoselected by scanning the shop QR.
                No choosing needed: the scanned shop fills the form. */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Partner Shop (auto-filled by shop QR)</label>
              {shopAutoSelected && activeShop ? (
                <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 flex items-center gap-3">
                  {activeShop.profile_picture ? (
                    <img src={activeShop.profile_picture} alt={activeShop.shop_name} className="w-10 h-10 rounded-xl object-cover" />
                  ) : (
                    <span className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black">
                      {activeShop.shop_name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{activeShop.shop_name}</p>
                    <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">{activeShop.discount_percent}% discount • QR autoselected</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShopAutoSelected(false)}
                    className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 uppercase tracking-wider cursor-pointer shrink-0"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-black shrink-0">
                    🏪
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">No shop selected</p>
                    <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300">Scan the shop QR above to select this outlet.</p>
                  </div>
                </div>
              )}

              {/* Shop QR quick scan */}
              <div className="mt-2 bg-slate-900 border border-slate-800 rounded-xl p-3">
                {!isShopCameraActive ? (
                  <button
                    type="button"
                    onClick={() => startShopCamera(facingMode)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Scan Shop QR to fill shop</span>
                  </button>
                ) : (
                  <div className="relative">
                    <div id={shopScannerContainerId} className="w-full overflow-hidden rounded-xl border border-slate-800 bg-black min-h-[180px]" />
                    <button
                      type="button"
                      onClick={stopShopCamera}
                      className="absolute bottom-2 right-2 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                    >
                      Stop
                    </button>
                  </div>
                )}
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={shopScanCode}
                    onChange={(e) => setShopScanCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (shopScanCode.trim()) handleShopQRScan(shopScanCode);
                      }
                    }}
                    placeholder="or type shop code e.g. SHOP-1001"
                    className="flex-1 min-w-0 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => { if (shopScanCode.trim()) handleShopQRScan(shopScanCode); }}
                    className="shrink-0 px-3 py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-[11px] font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap"
                  >
                    Find
                  </button>
                </div>
                {shopScanMsg && (
                  <p className="mt-2 text-[11px] font-semibold text-amber-300">{shopScanMsg}</p>
                )}
              </div>
            </div>

            {/* Total purchase amount input */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Gross Purchase Amount (RWF)</label>
              <div className="relative">
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 25000"
                  value={amountBefore}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAmountBefore(val === '' ? '' : Number(val));
                  }}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="absolute right-4 top-3 text-xs font-bold text-slate-400">RWF</span>
              </div>
            </div>

            {/* Dynamic discount calculations breakdown */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                <span>Total Purchase Amount:</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">{rawAmount.toLocaleString()} RWF</span>
              </div>
              <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 font-semibold">
                <span>Partner Outlet Discount ({discountPercent}%):</span>
                <span>- {discountVal.toLocaleString()} RWF</span>
              </div>
              <div className="border-t border-slate-100 dark:border-slate-800 pt-2 flex justify-between items-center font-bold text-sm uppercase">
                <span className="text-slate-500 dark:text-slate-400 text-[10px]">Net Payable to Merchant:</span>
                <span className="text-base text-emerald-600 dark:text-emerald-400 font-extrabold">{finalPayable.toLocaleString()} RWF</span>
              </div>
            </div>

            {/* Submit save button */}
            <button
              type="submit"
              disabled={isSubmittingTx || !scannedCustomer || !amountBefore}
              className={`w-full py-3 px-4 rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer ${
                scannedCustomer && amountBefore
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-400 border border-slate-200 dark:border-slate-800 cursor-not-allowed'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{isSubmittingTx ? 'Processing transaction...' : 'Apply Discount & Save Record'}</span>
            </button>

            {txSuccess && (
              <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl p-3 text-xs text-center font-semibold flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{txSuccess}</span>
              </div>
            )}
          </form>
        </div>
        </div>
        )
      ) : (
        <GuestShoppingPanel shops={shops} />
      )}

      </div>
      </div>
    </div>
  );
}
