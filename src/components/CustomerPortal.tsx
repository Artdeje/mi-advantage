import { BrandMonogram, deriveCardBrand } from './MemberCard';
import React, { useState, useEffect, useRef } from 'react';
import {
  db,
  getCustomerCardBlockReason,
  getCardScanOutcome,
  extractScanCode,
  buildShopUrl,
  BUSINESS_TYPE_LABELS,
  DISCOUNT_SCOPE_LABELS,
} from '../lib/supabase';
import { Customer, Shop, Customization } from '../types';
import {
  QrCode,
  Camera,
  RefreshCw,
  ShoppingBag,
  CheckCircle2,
  AlertTriangle,
  User,
  Store,
  X,
} from './AdminIcons';
import ThemeToggle from './ThemeToggle';
import { Html5Qrcode } from 'html5-qrcode';

export default function CustomerPortal({ onNewSale }: { onNewSale?: () => void }) {
  // Database states
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState('');
  // Card branding (system logo follows the same monogram as the printed card)
  const [cardBrand, setCardBrand] = useState('MA');
  // Scan terminal heading is admin-editable branding (Customization table)
  const [customization, setCustomization] = useState<Customization | null>(null);
  useEffect(() => {
    db.getCustomization()
      .then((c) => {
        setCardBrand(deriveCardBrand(c?.title, c?.card_brand));
        setCustomization(c);
      })
      .catch(() => setCardBrand('MA'));
  }, []);
  // A logged-in shop gets the full transaction terminal; everyone else (an
  // external phone camera / guest) gets the partner directory after a scan.
  const isShopSession = db.currentUser?.role === 'shop';
  // External scanner result: show the partner directory instead of a form.
  const [showPartners, setShowPartners] = useState(false);
  // Activation PIN prompt for external scanner scans.
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [showDiscountPinPrompt, setShowDiscountPinPrompt] = useState(false);
  const [discountPin, setDiscountPin] = useState('');
  const [discountPinError, setDiscountPinError] = useState<string | null>(null);
  const [pendingPinCustomer, setPendingPinCustomer] = useState<Customer | null>(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  // Deep link ?shop=SHOP-1234 (from a scanned counter QR) pre-selects the shop.
  const [pendingShopCode, setPendingShopCode] = useState('');
  // Deep link ?card=CUST-0001 (from an external QR scanner) authenticates the card.
  const [pendingCardCode, setPendingCardCode] = useState('');
  
  // Scanned customer state
  const [scannedCustomer, setScannedCustomer] = useState<Customer | null>(null);
  const [scanDone, setScanDone] = useState(false);
  // Company details opened by tapping a partner card in the directory.
  const [detailShop, setDetailShop] = useState<Shop | null>(null);
  const [amountBefore, setAmountBefore] = useState<number | ''>('');
  const [scanErrorState, setScanErrorState] = useState<string | null>(null);
  // Card validation outcome shown to the user: "Card is valid" / "Renew subscription"
  const [cardOutcome, setCardOutcome] = useState<{ valid: boolean; message: string; detail: string } | null>(null);
  // Shop-terminal flow: the member-QR scanner card owns the page until a card
  // authenticates, then the popup hands over to the discount form.
  const [shopScanStage, setShopScanStage] = useState<'scan' | 'form'>('scan');
  // Transient verdict popup: "Card is valid" / "Card is invalid" / "Renew subscription".
  const [scanPopup, setScanPopup] = useState<{
    kind: 'valid' | 'invalid' | 'renew';
    message: string;
    detail: string;
  } | null>(null);
  const scanPopupTimer = useRef<number | null>(null);

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

  const scrollToPartners = () => {
    setTimeout(() => {
      document
        .getElementById('member-partners-panel')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  // Verdict popup — valid cards navigate DIRECTLY to their destination
  // (discount form for a logged-in shop, partner directory for a guest)
  // while the toast briefly confirms the verdict on top.
  const showScanPopup = (
    kind: 'valid' | 'invalid' | 'renew',
    message: string,
    detail: string,
  ) => {
    if (scanPopupTimer.current) window.clearTimeout(scanPopupTimer.current);
    setScanPopup({ kind, message, detail });
    if (kind === 'valid') {
      // Already route: no waiting gate between the verdict and the panel.
      if (isShopSession) setShopScanStage('form');
      else setShowPartners(true);
      scrollToPartners();
      scanPopupTimer.current = window.setTimeout(() => {
        setScanPopup(null);
        scanPopupTimer.current = null;
      }, 1900);
      return;
    }
    scanPopupTimer.current = window.setTimeout(() => {
      setScanPopup(null);
      scanPopupTimer.current = null;
    }, 3600);
  };

  const handlePinVerify = () => {
    if (!pendingPinCustomer) return;
    if (enteredPin === pendingPinCustomer.activation_pin) {
      setScannedCustomer(pendingPinCustomer);
      setShowPinPrompt(false);
      setPendingPinCustomer(null);
      setEnteredPin('');
      setPinError(null);
      setShowPartners(true);
      showScanPopup('valid', 'Card is valid', 'PIN verified. Browse partner outlets below.');
      scrollToPartners();
    } else {
      setPinError('Incorrect PIN. Please try again.');
    }
  };

  const handlePinCancel = () => {
    setShowPinPrompt(false);
    setPendingPinCustomer(null);
    setEnteredPin('');
    setPinError(null);
  };

  const closeScanPopup = (proceed: boolean) => {
    if (scanPopupTimer.current) {
      window.clearTimeout(scanPopupTimer.current);
      scanPopupTimer.current = null;
    }
    setScanPopup(null);
    if (proceed && isShopSession) setShopScanStage('form');
  };

  const backToScanStage = () => {
    setScanPopup(null);
    setShopScanStage('scan');
    setScannedCustomer(null);
    setScanDone(false);
    setAmountBefore('');
    setCardOutcome(null);
    setScanErrorState(null);
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
        if (db.currentUser?.role === 'shop') {
          // Logged-in partner: the form starts on its OWN outlet — never on
          // the first row of the list (a ?shop= deep link can still override).
          const ownId = db.currentUser.id || db.currentUser.shop_id || '';
          const own = ownId ? approvedShops.find((s) => s.id === ownId) : null;
          if (own) {
            setSelectedShopId(own.id);
            setShopAutoSelected(true);
          }
        } else {
          setSelectedShopId((prev) => prev || approvedShops[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load portal data:', err);
    }
  };

  useEffect(() => {
    loadDatabaseData();
  }, []);

  // Deep link: read ?shop=… / ?card=… once from the hash.
  //  - ?shop=SHOP-1234  → pre-selects that counter (shop QR posted at a partner)
  //  - ?card=CUST-0001  → an external QR scanner link authenticates the card
  useEffect(() => {
    const readDeepLink = () => {
      const h = window.location.hash || '';
      const qi = h.indexOf('?');
      if (qi < 0) return;
      try {
        const params = new URLSearchParams(h.slice(qi + 1));
        const card = params.get('card');
        if (card) setPendingCardCode(extractScanCode(card));
        const shop = params.get('shop');
        if (shop) setPendingShopCode(extractScanCode(shop));
      } catch {
        /* ignore malformed query */
      }
    };
    readDeepLink();
    window.addEventListener('hashchange', readDeepLink);
    return () => window.removeEventListener('hashchange', readDeepLink);
  }, []);

  useEffect(() => {
    if (!pendingShopCode || shops.length === 0) return;
    const wanted = pendingShopCode.toLowerCase();
    const match = shops.find((s) => (s.qr_code || '').toLowerCase() === wanted);
    if (match) {
      setSelectedShopId(match.id);
      setShopAutoSelected(true);
      setPendingShopCode('');
    }
  }, [pendingShopCode, shops]);

  // Logged-in shop: the partner records sales for its OWN outlet, so the
  // discount form auto-fills it (a ?shop= deep link still takes precedence).
  // Guests get no auto-fill — they must scan or type a shop code.
  useEffect(() => {
    if (!isShopSession) return;
    const ownId = db.currentUser?.id || db.currentUser?.shop_id || '';
    if (!ownId || pendingShopCode || selectedShopId) return;
    if (shops.some((s) => s.id === ownId)) {
      setSelectedShopId(ownId);
      setShopAutoSelected(true);
    }
  }, [isShopSession, shops, pendingShopCode, selectedShopId]);

  // External QR-scanner deep link (?card=CUST-0001): authenticate the card
  // and route to the partner directory (or fill the shop terminal form).
  useEffect(() => {
    if (!pendingCardCode) return;
    let cancelled = false;
    (async () => {
      const customer = await db.getCustomerByQRCode(pendingCardCode);
      if (cancelled) return;
      setPendingCardCode('');
      if (!customer) {
        // Unknown card: verdict popup ONLY — no authentication to any page.
        setCardOutcome({
          valid: false,
          message: 'Card not found',
          detail: `No member card matches "${pendingCardCode}".`,
        });
        showScanPopup(
          'invalid',
          'Card is invalid',
          `No member card matches "${pendingCardCode}". Scan or type a registered member card and try again.`,
        );
        return;
      }
      const outcome = getCardScanOutcome(customer);
      setCardOutcome(outcome);
      if (!outcome.valid) {
        setScannedCustomer(null);
        setScanDone(false);
        const renew = outcome.message.toLowerCase().includes('renew');
        showScanPopup(renew ? 'renew' : 'invalid', outcome.message, outcome.detail);
        // Found-but-expired guests may still browse the partner directory to
        // arrange a renewal; only UNKNOWN cards are locked out completely.
        if (!isShopSession && renew) {
          setScannedCustomer(customer);
          setShowPartners(true);
          scrollToPartners();
        }
        return;
      }
      setScanErrorState(null);
      // Only shop sessions authenticate the card to the discount form.
      // External/guest scans require PIN confirmation before showing partners.
      if (isShopSession) {
        setScannedCustomer(customer);
        setScanDone(true);
        showScanPopup('valid', outcome.message, outcome.detail);
        scrollToDiscountForm();
      } else {
        // External scanner: require activation PIN before showing partners.
        if (customer.activation_pin) {
          setPendingPinCustomer(customer);
          setShowPinPrompt(true);
          setEnteredPin('');
          setPinError(null);
        } else {
          // Legacy cards without PIN: show partners directly.
          setShowPartners(true);
          showScanPopup('valid', outcome.message, outcome.detail);
          scrollToPartners();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCardCode]);

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
          'Camera unavailable. Type the shop code manually below (e.g. SHOP-1234).'
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
          `Invalid shop code "${cleanCode}". Scan the QR posted at a partner counter (e.g. SHOP-1234).`
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
        // Card validity: "Card is valid" or "Renew subscription".
        const outcome = getCardScanOutcome(customer);
        setCardOutcome(outcome);
        if (!outcome.valid) {
          setScanErrorState(outcome.detail);
          setScannedCustomer(null);
          setScanDone(false);
          const renew = outcome.message.toLowerCase().includes('renew');
          showScanPopup(renew ? 'renew' : 'invalid', outcome.message, outcome.detail);
          // Found-but-expired guests may still browse the partner directory to
          // arrange a renewal; only UNKNOWN cards are locked out completely.
          if (!isShopSession && renew) {
            setScannedCustomer(customer);
            setShowPartners(true);
            scrollToPartners();
          }
          return;
        }

        setScanErrorState(null);
        setScannedCustomer(customer);
        setScanDone(true);
        await stopCameraScanner();
        // Verdict popup handles the navigation itself (direct auth): the
        // terminal form (shop) or the partner directory (guest) mounts right
        // away while the toast confirms the verdict.
        // For external/guest scans with a PIN, require PIN verification first.
        if (!isShopSession && customer.activation_pin) {
          setPendingPinCustomer(customer);
          setShowPinPrompt(true);
          setEnteredPin('');
          setPinError(null);
        } else {
          showScanPopup('valid', outcome.message, outcome.detail);
          if (isShopSession) scrollToDiscountForm();
          else setShowPartners(true);
        }
      } else {
        setScanErrorState(null);
        setCardOutcome({
          valid: false,
          message: 'Card is invalid',
          detail: `No member card matches "${cleanCode}". Please scan a valid registered card.`,
        });
        // Unknown card: verdict popup ONLY, for every session type — no
        // navigation, no authentication, no browser alert.
        showScanPopup(
          'invalid',
          'Card is invalid',
          `No member card matches "${cleanCode}". Scan or type a registered member card and try again.`,
        );
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

    // If card has an activation PIN, require verification before applying discount.
    if (scannedCustomer.activation_pin && !showDiscountPinPrompt) {
      setShowDiscountPinPrompt(true);
      setDiscountPin('');
      setDiscountPinError(null);
      return;
    }

    // Verify PIN if prompt was shown
    if (scannedCustomer.activation_pin && showDiscountPinPrompt) {
      if (discountPin !== scannedCustomer.activation_pin) {
        setDiscountPinError('Incorrect PIN. Please try again.');
        return;
      }
      setShowDiscountPinPrompt(false);
      setDiscountPin('');
      setDiscountPinError(null);
    }

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

        if (onNewSale) onNewSale();
        // Back to the scanner card for the next member — a full data reload
        // here would slow the terminal without any UI needing it.
        if (isShopSession) setShopScanStage('scan');

        setTimeout(() => setTxSuccess(''), 5000);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to record transaction in database.');
    } finally {
      setIsSubmittingTx(false);
    }
  };

// --- Activation PIN Prompt (external scanner) ---
  if (showPinPrompt && pendingPinCustomer) {
    return (
      <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg p-8 space-y-6">
          <div className="text-center">
            <div className="w-14 h-14 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Activation PIN Required</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Enter the 4-digit PIN for card <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{pendingPinCustomer.qr_code}</span>
            </p>
          </div>
          <div className="space-y-4">
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={enteredPin}
              onChange={(e) => setEnteredPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 rounded-xl text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus
            />
            {pinError && <div className="bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs text-center">{pinError}</div>}
            <button
              onClick={handlePinVerify}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold cursor-pointer"
            >
              Verify PIN
            </button>
            <button
              onClick={handlePinCancel}
              className="w-full py-2 text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

// --- Discount Activation PIN Prompt ---
  if (showDiscountPinPrompt && scannedCustomer) {
    return (
      <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg p-8 space-y-6">
          <div className="text-center">
            <div className="w-14 h-14 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Enter Card PIN</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Enter the 4-digit PIN for <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{scannedCustomer.qr_code}</span> to apply the discount
            </p>
          </div>
          <div className="space-y-4">
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={discountPin}
              onChange={(e) => setDiscountPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 rounded-xl text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus
            />
            {discountPinError && <div className="bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs text-center">{discountPinError}</div>}
            <button
              onClick={() => {
                if (discountPin === scannedCustomer.activation_pin) {
                  setShowDiscountPinPrompt(false);
                  setDiscountPin('');
                  setDiscountPinError(null);
                  const form = document.querySelector('form');
                  if (form) form.requestSubmit();
                } else {
                  setDiscountPinError('Incorrect PIN. Please try again.');
                }
              }}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold cursor-pointer"
            >
              Verify & Apply Discount
            </button>
            <button
              onClick={() => { setShowDiscountPinPrompt(false); setDiscountPin(''); setDiscountPinError(null); }}
              className="w-full py-2 text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 py-6 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top nav */}
        <div className="flex items-center justify-between gap-3">
          <a href="#/" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
            <BrandMonogram brand={cardBrand} className="w-8 h-8 rounded-lg text-xs" />
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
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
            {customization?.scan_title || 'Member Scan & Loyalty Terminal'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {customization?.scan_subtitle || 'Scan customer membership cards in real-time to compute discount rates and record transaction logs.'}
          </p>
        </div>
      </div>

      {/* Card validation outcome: "Card is valid" / "Renew subscription" */}
      {cardOutcome && (
        <div
          id="card-validation-banner"
          role="status"
          className={`flex items-start gap-3 rounded-2xl border p-4 ${
            cardOutcome.valid
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800'
              : 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800'
          }`}
        >
          <span
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              cardOutcome.valid
                ? 'bg-emerald-600 text-white'
                : 'bg-amber-500 text-white'
            }`}
          >
            {cardOutcome.valid ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </span>
          <div className="min-w-0">
            <p
              className={`text-sm font-black uppercase tracking-wider ${
                cardOutcome.valid
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-amber-700 dark:text-amber-300'
              }`}
            >
              {cardOutcome.message}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              {cardOutcome.detail}
            </p>
          </div>
        </div>
      )}

      {/* Scan verdict popup — Card is valid / Card is invalid / Renew subscription */}
      {scanPopup && (
        <div
          className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => closeScanPopup(false)}
        >
          <div
            className={`rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl border-2 cursor-pointer ${
              scanPopup.kind === 'valid'
                ? 'bg-white dark:bg-slate-900 border-emerald-500'
                : scanPopup.kind === 'renew'
                  ? 'bg-white dark:bg-slate-900 border-amber-400 mi-warn-ring-amber'
                  : 'bg-white dark:bg-slate-900 border-red-500 mi-warn-ring'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Animated warning lights for blocked verdicts */}
            {scanPopup.kind !== 'valid' && (
              <div className="flex items-center justify-center gap-3 mb-3">
                <span className={`mi-lamp ${scanPopup.kind === 'renew' ? 'mi-lamp-amber' : 'mi-lamp-red'}`} />
                <span
                  className={`w-2 h-2 rounded-full ${
                    scanPopup.kind === 'renew' ? 'bg-amber-300' : 'bg-red-300'
                  }`}
                />
                <span className={`mi-lamp ${scanPopup.kind === 'renew' ? 'mi-lamp-red' : 'mi-lamp-amber'}`} />
              </div>
            )}
            <span
              className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center ${
                scanPopup.kind === 'valid'
                  ? 'bg-emerald-600 text-white'
                  : scanPopup.kind === 'renew'
                    ? 'bg-amber-500 text-white'
                    : 'bg-red-600 text-white'
              }`}
            >
              {scanPopup.kind === 'valid' ? (
                <CheckCircle2 className="w-7 h-7" />
              ) : (
                <AlertTriangle className="w-7 h-7" />
              )}
            </span>
            <p
              className={`mt-3 text-base font-black uppercase tracking-wider ${
                scanPopup.kind === 'valid'
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : scanPopup.kind === 'renew'
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-red-700 dark:text-red-300'
              }`}
            >
              {scanPopup.message}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
              {scanPopup.detail}
            </p>
            <button
              type="button"
              onClick={() => closeScanPopup(scanPopup.kind === 'valid')}
              className={`mt-4 w-full py-2.5 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer transition-all ${
                scanPopup.kind === 'valid'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : scanPopup.kind === 'renew'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {scanPopup.kind === 'valid' ? 'Open discount form' : 'Scan again'}
            </button>
            <p className="text-[10px] font-semibold text-slate-400 mt-2 uppercase tracking-widest">
              {scanPopup.kind === 'valid'
                ? 'Continuing automatically…'
                : 'This popup closes automatically…'}
            </p>
          </div>
        </div>
      )}

      {showPartners && scannedCustomer ? (
          <>
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
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setDetailShop(s)}
                      className="text-left bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 rounded-2xl p-4 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        {s.profile_picture ? (
                          <img src={s.profile_picture} alt={s.shop_name} className="w-11 h-11 rounded-xl object-cover shrink-0" />
                        ) : (
                          <span className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shrink-0">
                            {s.shop_name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-300">{s.shop_name}</p>
                          <span className="inline-block mt-0.5 bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{s.discount_percent}% OFF</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 min-h-[2rem]">
                        {s.description || 'Verified Mi Advantage partner.'}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {s.business_type && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-0.5 rounded-full">
                            {BUSINESS_TYPE_LABELS[s.business_type] || s.business_type}
                          </span>
                        )}
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900 px-2 py-0.5 rounded-full">
                          {DISCOUNT_SCOPE_LABELS[s.discount_scope || 'all'] || 'All items'}
                        </span>
                        <span className="ml-auto text-[11px] font-bold text-emerald-600 dark:text-emerald-400 group-hover:underline">Details →</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Company details modal — tap a partner card to open it */}
          {detailShop && (
            <div
              className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
              onClick={() => setDetailShop(null)}
            >
              <div
                className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-gradient-to-br from-emerald-700 to-teal-800 p-6 text-white relative">
                  <button
                    onClick={() => setDetailShop(null)}
                    aria-label="Close details"
                    className="absolute top-4 right-4 p-1.5 bg-white/15 hover:bg-white/25 rounded-lg cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-4">
                    {detailShop.profile_picture ? (
                      <img src={detailShop.profile_picture} alt={detailShop.shop_name} className="w-16 h-16 rounded-2xl object-cover border-2 border-white/40" />
                    ) : (
                      <span className="w-16 h-16 rounded-2xl bg-white/15 border-2 border-white/40 text-white flex items-center justify-center font-black text-2xl">
                        {detailShop.shop_name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <h3 className="text-lg font-black truncate">{detailShop.shop_name}</h3>
                      <span className="inline-block mt-1 bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-200 text-[11px] font-black px-2.5 py-0.5 rounded-full">
                        {detailShop.discount_percent}% MEMBER DISCOUNT
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-6 space-y-3 text-sm">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">About this partner</p>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                      {detailShop.description || 'A verified Mi Advantage partner. Show your member card at the counter to save instantly on every visit.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {detailShop.business_type && (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                        {BUSINESS_TYPE_LABELS[detailShop.business_type] || detailShop.business_type}
                      </span>
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                      {DISCOUNT_SCOPE_LABELS[detailShop.discount_scope || 'all'] || 'All items'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Contact</p>
                      <p className="font-bold text-slate-700 dark:text-slate-200 break-all">{detailShop.email}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Partner since</p>
                      <p className="font-bold text-slate-700 dark:text-slate-200">
                        {detailShop.created_at ? new Date(detailShop.created_at).toLocaleDateString() : '—'}
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Show this member card ({scannedCustomer?.qr_code}) at their counter to redeem.
                  </p>
                </div>
              </div>
            </div>
          )}
          </>
        ) : (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* LEFT COLUMN: CAMERA SCANNER & SIMULATOR ACCORDION */}

        {/* Shop stage 1: the member-QR scanner card is the only panel on the
            page — after the verdict popup it hands over to the form (stage 2). */}
        {isShopSession && shopScanStage === 'form' ? null : (
        <div
          className={
            isShopSession
              ? "lg:col-span-12 mx-auto w-full max-w-xl space-y-6"
              : "lg:col-span-6 space-y-6"
          }
          id="qr-scanner-terminal-box"
        >
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
              If camera access is blocked in this sandbox browser preview, simulate a card barcode scan by typing the member card code below (e.g. <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1 py-0.5 rounded">CUST-####</span>):
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                id="simulator-scan-code-input"
                placeholder="Type member token e.g. CUST-####"
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
        )}

        {/* RIGHT COLUMN: TRANSACTION FORM & LIVE CALCULATOR */}

        {/* Shop stage 2: only the authenticated discount form is on the page */}
        {isShopSession && shopScanStage === 'scan' ? null : (
        <div
          ref={discountFormRef}
          className={
            isShopSession
              ? "lg:col-span-12 mx-auto w-full max-w-2xl scroll-mt-6"
              : "lg:col-span-6 scroll-mt-6"
          }
          id="qr-transaction-calculator-container"
        >
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
            {isShopSession && (
              <button
                type="button"
                onClick={backToScanStage}
                className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:underline uppercase tracking-wider cursor-pointer flex items-center gap-1.5"
              >
                ← Scan another member card
              </button>
            )}

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
                    <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                      {activeShop.discount_percent}% discount • {isShopSession ? 'your outlet, auto-filled' : 'QR autoselected'}
                    </p>
                  </div>
                  {!isShopSession && (
                    <button
                      type="button"
                      onClick={() => setShopAutoSelected(false)}
                      className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 uppercase tracking-wider cursor-pointer shrink-0"
                    >
                      Change
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-black shrink-0">
                    🏪
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">No shop selected</p>
                    <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                      {isShopSession
                        ? 'Your outlet fills automatically from your shop account once loaded.'
                        : 'Scan the shop QR above to select this outlet.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Shop QR quick scan — guests only; logged-in shops
                  always record for their own (auto-filled) outlet. */}
              {!isShopSession && (
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
                    placeholder="or type shop code e.g. SHOP-1234"
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
              )}
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
        )}

      </div>
        )}

      </div>
      </div>
    </div>
  );
}
