import React, { useState, useEffect, useRef } from 'react';
import { db, getCustomerCardBlockReason, buildShopUrl } from '../lib/supabase';
import { readImageAsDataUrl } from '../lib/imageUtil';
import { Shop, Sale, Customer, Product, Customization } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Html5Qrcode } from 'html5-qrcode';
import ShopCounterQr from './ShopCounterQr';
import {
  Store, Camera, RefreshCw, ShoppingBag, CheckCircle2, AlertTriangle,
  User, Users, DollarSign, Tag, TrendingUp, History, Upload, UserCheck,
  Search, Filter, ArrowUpDown, FileText, Printer, LayoutDashboard, Settings, BarChart3,
  Mail, Lock, Eye, EyeOff, ImageIcon, XCircle,
} from './AdminIcons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import ThemeToggle from './ThemeToggle';

export default function ShopDashboard({ shopUser, onLogout }: { shopUser: { id: string; email: string }; onLogout?: () => void }) {
  const [shopDetails, setShopDetails] = useState<Shop | null>(null);
  const [customization, setCustomization] = useState<Customization | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'sales' | 'products' | 'account'>('dashboard');

  // Scan panel visibility — the scanner lives behind the "Scan Card" button,
  // keeping the dashboard welcome view clean (stats + charts).
  const [scanOpen, setScanOpen] = useState(false);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  // Sales trend range for the dashboard line chart.
  const [trendRange, setTrendRange] = useState<'daily' | 'weekly' | 'monthly' | 'annual'>('daily');

  // Profile management state
  const [profilePic, setProfilePic] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);

  // Account management state
  const [accountShopName, setAccountShopName] = useState('');
  const [accountDiscount, setAccountDiscount] = useState<number | ''>('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountDescription, setAccountDescription] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [accountMsg, setAccountMsg] = useState('');
  const [accountMsgType, setAccountMsgType] = useState<'success' | 'error'>('success');

  // Scanner state
  const [scannedCustomer, setScannedCustomer] = useState<Customer | null>(null);
  const [scanDone, setScanDone] = useState(false);
  const [amountBefore, setAmountBefore] = useState<number | ''>('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [scannerError, setScannerError] = useState<string | null>(null);
  
  // Ref for scanner
  const qrCodeInstanceRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'shop-portal-scanner';
  // Guards against the camera firing multiple decodes for the same card
  // while a lookup is already in flight (caused repeat alerts / UI thrash
  // that looked like the page navigating away).
  const scanLockRef = useRef(false);
  // Anchor for the discount-applying form — we scroll to it after a scan.
  const discountFormRef = useRef<HTMLDivElement | null>(null);
  const amountInputRef = useRef<HTMLInputElement | null>(null);

  const scrollToDiscountForm = () => {
    // Let React render the filled form first, then bring it into view.
    setTimeout(() => {
      discountFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      amountInputRef.current?.focus({ preventScroll: true });
    }, 120);
  };

  // State messages
  const [txSuccess, setTxSuccess] = useState('');
  const [isSubmittingTx, setIsSubmittingTx] = useState(false);
  const [scanErrorState, setScanErrorState] = useState<string | null>(null);

  // Products / menu catalog state (full CRUD for this shop only)
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState<number | ''>('');
  const [productStock, setProductStock] = useState<number | ''>('');
  const [productDescription, setProductDescription] = useState('');
  const [productStatus, setProductStatus] = useState<'active' | 'hidden'>('active');
  const [productMsg, setProductMsg] = useState('');
  const [productMsgType, setProductMsgType] = useState<'success' | 'error'>('success');
  const [savingProduct, setSavingProduct] = useState(false);

  // Reports, filters and sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'today', '7days', '30days'
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'oldest', 'gross_desc', 'discount_desc'

  const getFilteredAndSortedSales = () => {
    let result = [...sales];

    // 1. Filter by search term
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      result = result.filter(sale => 
        sale.customer_name.toLowerCase().includes(term)
      );
    }

    // 2. Filter by date range
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    if (dateFilter === 'today') {
      result = result.filter(sale => {
        const saleDate = new Date(sale.created_at).toISOString().split('T')[0];
        return saleDate === todayStr;
      });
    } else if (dateFilter === '7days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      result = result.filter(sale => new Date(sale.created_at) >= sevenDaysAgo);
    } else if (dateFilter === '30days') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      result = result.filter(sale => new Date(sale.created_at) >= thirtyDaysAgo);
    }

    // 3. Sort by
    if (sortBy === 'newest') {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortBy === 'oldest') {
      result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (sortBy === 'gross_desc') {
      result.sort((a, b) => b.amount_before_discount - a.amount_before_discount);
    } else if (sortBy === 'discount_desc') {
      result.sort((a, b) => b.discount_applied - a.discount_applied);
    }

    return result;
  };

  const handlePrintReport = () => {
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
      alert('Pop-up blocked. Please allow pop-ups for this app to view the report.');
      return;
    }

    const reportSales = getFilteredAndSortedSales();
    const repGross = reportSales.reduce((acc, curr) => acc + curr.amount_before_discount, 0);
    const repDiscount = reportSales.reduce((acc, curr) => acc + curr.discount_applied, 0);
    const repNet = reportSales.reduce((acc, curr) => acc + curr.final_amount, 0);

    const rowsHTML = reportSales.map((sale, index) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px; font-size: 11px;">${index + 1}</td>
        <td style="padding: 10px; font-size: 11px; font-weight: bold;">${sale.customer_name.toUpperCase()}</td>
        <td style="padding: 10px; font-size: 11px;">${new Date(sale.created_at).toLocaleDateString()} at ${new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
        <td style="padding: 10px; font-size: 11px; text-align: right;">${sale.amount_before_discount.toLocaleString()} RWF</td>
        <td style="padding: 10px; font-size: 11px; text-align: right; color: #059669; font-weight: bold;">-${sale.discount_applied.toLocaleString()} RWF</td>
        <td style="padding: 10px; font-size: 11px; text-align: right; font-weight: bold;">${sale.final_amount.toLocaleString()} RWF</td>
      </tr>
    `).join('');

    reportWindow.document.write(`
      <html>
        <head>
          <title>${shopDetails?.shop_name || 'Shop'} - Sales Report</title>
          <style>
            body { font-family: 'Inter', sans-serif; color: #1e293b; padding: 40px; margin: 0; background-color: #fff; }
            .header-container { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #059669; padding-bottom: 20px; margin-bottom: 30px; }
            .store-name { font-size: 22px; font-weight: 800; color: #064e3b; margin: 0 0 5px 0; text-transform: uppercase; }
            .meta-text { font-size: 11px; color: #64748b; margin: 2px 0; }
            .report-title { font-size: 16px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 1px; margin: 0; }
            .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
            .stat-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; text-align: left; }
            .stat-label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-bottom: 5px; }
            .stat-val { font-size: 15px; font-weight: 800; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #f1f5f9; padding: 12px 10px; font-size: 9px; text-transform: uppercase; color: #475569; text-align: left; font-weight: bold; border-bottom: 2px solid #cbd5e1; }
            td { color: #334155; border-bottom: 1px solid #f1f5f9; }
            .footer-notes { margin-top: 50px; border-top: 1px dashed #cbd5e1; padding-top: 20px; display: flex; justify-content: space-between; font-size: 10px; color: #64748b; }
            @media print {
              body { padding: 20px; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div>
              <h1 class="store-name">${shopDetails?.shop_name || 'Verified Partner Shop'}</h1>
              <p class="meta-text">Email ID: ${shopUser.email}</p>
              <p class="meta-text">Verified Partner Code: ${shopUser.id.slice(0, 8).toUpperCase()}</p>
            </div>
            <div style="text-align: right;">
              <h2 class="report-title">Sales Audit Report</h2>
              <p class="meta-text">Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
              <p class="meta-text">Active Filter: Date: ${dateFilter.toUpperCase()} | Sort: ${sortBy.toUpperCase()}</p>
            </div>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Total Transactions</div>
              <div class="stat-val">${reportSales.length} Scans</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Gross Value</div>
              <div class="stat-val">${repGross.toLocaleString()} RWF</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Discounts Saved</div>
              <div class="stat-val" style="color: #059669;">${repDiscount.toLocaleString()} RWF</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Net Store Earnings</div>
              <div class="stat-val">${repNet.toLocaleString()} RWF</div>
            </div>
          </div>

          <h3 style="font-size: 14px; text-transform: uppercase; margin-bottom: 10px; color: #1e293b;">Transaction Details Table</h3>
          <table>
            <thead>
              <tr>
                <th style="width: 40px;">#</th>
                <th>Cardholder Customer</th>
                <th>Scan Timestamp</th>
                <th style="text-align: right;">Gross Price</th>
                <th style="text-align: right;">Discount Rate</th>
                <th style="text-align: right;">Final Paid</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHTML || '<tr><td colspan="6" style="padding: 30px; text-align: center; color: #94a3b8; font-weight: bold;">No transactions match the selected filters.</td></tr>'}
            </tbody>
          </table>

          <div class="footer-notes">
            <div>
              <p style="margin: 0; font-weight: bold;">Certified ${(customization?.card_wordmark || customization?.title || 'Loyalty Network').trim()} Loyalty Network</p>
              <p style="margin: 5px 0 0 0;">Compute rate: ${shopDetails?.discount_percent || 0}% Authorized Member Discount</p>
            </div>
            <div style="text-align: right;">
              <div style="width: 150px; border-bottom: 1px solid #cbd5e1; margin-bottom: 5px; display: inline-block;"></div>
              <p style="margin: 0; font-weight: bold;">Store Manager Signature / Seal</p>
            </div>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    reportWindow.document.close();
  };

  // Load shop data — one parallel round-trip instead of three sequential ones.
  const loadData = async () => {
    setLoading(true);
    db.getCustomization().then(setCustomization).catch(() => setCustomization(null));
    const [shopsList, allSales, shopProducts] = await Promise.all([
      db.getShops(),
      db.getSales(),
      db.getProducts(shopUser.id),
    ]);
    const currentShop = shopsList.find(s => s.id === shopUser.id);
    if (currentShop) {
      setShopDetails(currentShop);
      if (currentShop.profile_picture) {
        setProfilePic(currentShop.profile_picture);
      }
      setAccountShopName(currentShop.shop_name);
      setAccountDiscount(currentShop.discount_percent);
      setAccountEmail(currentShop.email);
      setAccountDescription(currentShop.description || '');
    }

    const shopSales = allSales.filter(sale => sale.shop_id === shopUser.id);
    shopSales.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setSales(shopSales);

    setProducts(shopProducts);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [shopUser]);

  // Clean up scanner on unmount
  useEffect(() => {
    return () => {
      if (qrCodeInstanceRef.current && qrCodeInstanceRef.current.isScanning) {
        qrCodeInstanceRef.current.stop().catch(console.error);
      }
    };
  }, []);

  // Handle Drag & Drop for Profile Image Upload
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (png, jpeg, webp).');
      return;
    }
    // Downscale through a canvas so the stored base64 stays small — the
    // picture rides inside the partners-panel list response.
    const base64 = await readImageAsDataUrl(file, 256, 0.72);
    setProfilePic(base64);
    // Save directly to the database
    const res = await db.updateShop(shopUser.id, { profile_picture: base64 });
    alert(res.error ? 'Could not update profile picture: ' + res.error : 'Shop profile picture updated successfully!');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // QR Camera Controls
  const toggleFacingMode = async () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    if (isCameraActive) {
      await stopCamera();
      await startCamera(nextMode);
    }
  };

  // Reset the scanner container so a new Html5Qrcode instance starts clean
  // (html5-qrcode injects its video/scan UI inside this div).
  const clearScannerContainer = () => {
    const el = document.getElementById(containerId);
    if (el) {
      el.innerHTML = '';
    }
  };

  const startCamera = async (mode: 'user' | 'environment') => {
    setScannerError(null);
    setScanDone(false);
    setIsCameraActive(true);

    setTimeout(async () => {
      const opposite = mode === 'user' ? 'environment' : 'user';

      // Enumerate real cameras; some devices (e.g. tablets) have no front camera.
      let cameras: Array<{ id: string; label: string }> = [];
      let chosenId: string | null = null;
      let chosenIsFront = false;
      try {
        cameras = await Html5Qrcode.getCameras();
        const front = cameras.find((c) =>
          /front|user/i.test(c.label || ''),
        );
        const back = cameras.find((c) =>
          /back|rear|environment/i.test(c.label || ''),
        );
        if (mode === 'user') {
          if (front) { chosenId = front.id; chosenIsFront = true; }
          else if (back) { chosenId = back.id; }
          else if (cameras.length) { chosenId = cameras[0].id; }
        } else {
          if (back) { chosenId = back.id; }
          else if (front) { chosenId = front.id; chosenIsFront = true; }
          else if (cameras.length) { chosenId = cameras[0].id; }
        }
      } catch {
        cameras = [];
      }

      // Ordered attempts: exact device → requested facing → opposite facing → any camera.
      const attempts: Array<Record<string, unknown>> = [];
      if (chosenId) attempts.push({ deviceId: chosenId });
      attempts.push({ facingMode: mode });
      attempts.push({ facingMode: opposite });
      attempts.push({});

      let startedWith: 'user' | 'environment' | null = null;
      for (const constraints of attempts) {
        try {
          clearScannerContainer();
          const scanner = new Html5Qrcode(containerId);
          qrCodeInstanceRef.current = scanner;
          await scanner.start(
            constraints,
            {
              fps: 10,
              qrbox: (w, h) => {
                const size = Math.min(w, h) * 0.7;
                return { width: size, height: size };
              },
            },
            (text) => {
              handleDecodedQR(text);
            },
            () => {},
          );
          startedWith =
            constraints.deviceId
              ? (chosenIsFront ? 'user' : 'environment')
              : (constraints.facingMode === 'user' ? 'user' : 'environment');
          break;
        } catch (err) {
          console.warn('Camera attempt failed:', constraints, err);
          qrCodeInstanceRef.current = null;
        }
      }

      if (!startedWith) {
        console.error('Shop scanner error: no camera feed available');
        setScannerError('No camera feed available on this device. Please utilize the scan simulator below!');
        setIsCameraActive(false);
        return;
      }
      setFacingMode(startedWith);
    }, 150);
  };

  const stopCamera = async () => {
    if (qrCodeInstanceRef.current && qrCodeInstanceRef.current.isScanning) {
      try {
        await qrCodeInstanceRef.current.stop();
      } catch (e) {
        console.error('Stop scanner error:', e);
      }
    }
    qrCodeInstanceRef.current = null;
    setIsCameraActive(false);
  };

  // Close the scanner popup and release the camera.
  const closeScanModal = async () => {
    await stopCamera();
    setScanModalOpen(false);
  };

  const handleDecodedQR = async (code: string) => {
    // Ignore repeat frames for a card we are already resolving.
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    try {
      const customer = await db.getCustomerByQRCode(code.trim());
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
        // Close the scanner popup and reveal the filled discount form below.
        setScanModalOpen(false);
        setScanOpen(true);
        // Stay on the dashboard tab and move to the discount-applying form
        // (fills customer ID + name below) instead of leaving the scanner view.
        setActiveTab('dashboard');
        const simInput = document.getElementById('shop-simulator-scan-input') as HTMLInputElement | null;
        if (simInput) simInput.value = '';
        await stopCamera();
        scrollToDiscountForm();
      } else {
        setScanErrorState(null);
        alert(`Invalid customer QR code scanned: "${code}"`);
      }
    } finally {
      scanLockRef.current = false;
    }
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedCustomer || !shopDetails) return;

    // Double-check if the card is blocked to absolute block it
    const blockReason = getCustomerCardBlockReason(scannedCustomer);
    if (blockReason) {
      setScanErrorState(blockReason);
      setScannedCustomer(null);
      setScanDone(false);
      alert(blockReason);
      return;
    }

    if (!amountBefore || amountBefore <= 0) {
      alert('Please enter a valid purchase amount before discount.');
      return;
    }

    setIsSubmittingTx(true);
    try {
      const { sale, error } = await db.createSale(shopDetails.id, scannedCustomer.name, amountBefore, scannedCustomer.id);
      if (error) {
        alert(error);
      } else if (sale) {
        setTxSuccess(`Transaction created successfully! Scanned ${scannedCustomer.name} and saved ${sale.discount_applied.toLocaleString()} RWF.`);
        setScannedCustomer(null);
        setScanDone(false);
        setAmountBefore('');
        setScanErrorState(null);

        // Local refresh only — a full data reload here costs seconds and the
        // report list just needs the new record on top.
        setSales((prev) => [sale, ...prev.filter((s) => s.id !== sale.id)]);

        setTimeout(() => setTxSuccess(''), 5000);
      }
    } catch {
      alert('Failed to save transaction.');
    } finally {
      setIsSubmittingTx(false);
    }
  };

  // ---- Products / menu CRUD (scoped to this shop by server + client) ----
  const resetProductForm = () => {
    setEditingProductId(null);
    setProductName('');
    setProductPrice('');
    setProductStock('');
    setProductDescription('');
    setProductStatus('active');
    setProductMsg('');
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setProductMsg('');
    setSavingProduct(true);
    try {
      if (editingProductId) {
        const { error } = await db.updateProduct(editingProductId, {
          name: productName,
          price: productPrice === '' ? undefined : Number(productPrice),
          stock: productStock === '' ? undefined : Number(productStock),
          description: productDescription,
          status: productStatus,
        });
        if (error) {
          setProductMsg(error);
          setProductMsgType('error');
        } else {
          setProductMsg('Product updated successfully.');
          setProductMsgType('success');
          resetProductForm();
          setProducts(await db.getProducts(shopUser.id));
        }
      } else {
        const { error } = await db.createProduct(shopUser.id, {
          name: productName,
          price: productPrice,
          stock: productStock,
          description: productDescription,
          status: productStatus,
        });
        if (error) {
          setProductMsg(error);
          setProductMsgType('error');
        } else {
          setProductMsg(`Product "${productName.trim()}" added to your menu.`);
          setProductMsgType('success');
          resetProductForm();
          setProducts(await db.getProducts(shopUser.id));
        }
      }
    } catch {
      setProductMsg('Failed to save product. Check your connection.');
      setProductMsgType('error');
    } finally {
      setSavingProduct(false);
    }
    setTimeout(() => setProductMsg(''), 5000);
  };

  const handleEditProductClick = (p: Product) => {
    setEditingProductId(p.id);
    setProductName(p.name);
    setProductPrice(Number(p.price));
    setProductStock(Number(p.stock));
    setProductDescription(p.description || '');
    setProductStatus(p.status === 'hidden' ? 'hidden' : 'active');
    setProductMsg('');
    document.getElementById('shop-product-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDeleteProductClick = async (p: Product) => {
    if (!confirm(`Delete "${p.name}" from your menu? This cannot be undone.`)) return;
    const { error } = await db.deleteProduct(p.id);
    if (error) {
      setProductMsg(error);
      setProductMsgType('error');
    } else {
      if (editingProductId === p.id) resetProductForm();
      setProductMsg(`Product "${p.name}" deleted.`);
      setProductMsgType('success');
      setProducts(await db.getProducts(shopUser.id));
    }
    setTimeout(() => setProductMsg(''), 5000);
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.trim().toLowerCase()),
  );

  // Aggregated analytics calculation for this specific shop
  const totalSalesCount = sales.length;
  const totalAmountBefore = sales.reduce((acc, curr) => acc + curr.amount_before_discount, 0);
  const totalDiscountsGiven = sales.reduce((acc, curr) => acc + curr.discount_applied, 0);
  const totalEarnings = sales.reduce((acc, curr) => acc + curr.final_amount, 0);

  // Group performance daily (past 7 days)
  const getDailyPerformanceData = () => {
    const datesMap: { [date: string]: { date: string; amount: number; sales: number } } = {};
    
    // Seed last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      datesMap[dateStr] = { date: dateStr, amount: 0, sales: 0 };
    }

    sales.forEach(s => {
      const dateStr = new Date(s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      if (datesMap[dateStr]) {
        datesMap[dateStr].amount += s.final_amount;
        datesMap[dateStr].sales += 1;
      }
    });

    return Object.values(datesMap);
  };

  const chartData = getDailyPerformanceData();

  // ---- Dashboard charts: top customers pie + ranged sales trend ----
  const PIE_COLORS = ['#059669', '#0d9488', '#3b82f6', '#8b5cf6', '#f59e0b', '#94a3b8'];

  const getTopCustomers = () => {
    const byCustomer = new Map<string, number>();
    sales.forEach((s) =>
      byCustomer.set(s.customer_name, (byCustomer.get(s.customer_name) || 0) + s.final_amount),
    );
    const sorted = [...byCustomer.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    const top = sorted.slice(0, 5);
    const rest = sorted.slice(5).reduce((acc, c) => acc + c.value, 0);
    if (rest > 0) top.push({ name: 'Others', value: rest });
    return top;
  };
  const topCustomers = getTopCustomers();

  const getSalesTrend = () => {
    const now = new Date();
    const buckets: Array<{ key: string; label: string; amount: number; sales: number }> = [];
    if (trendRange === 'daily') {
      // Last 14 days, one bucket per day.
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        buckets.push({
          key,
          label: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
          amount: 0,
          sales: 0,
        });
      }
      sales.forEach((s) => {
        const sd = new Date(s.created_at);
        const key = `${sd.getFullYear()}-${sd.getMonth()}-${sd.getDate()}`;
        const b = buckets.find((x) => x.key === key);
        if (b) { b.amount += s.final_amount; b.sales += 1; }
      });
    } else if (trendRange === 'weekly') {
      // Last 8 weeks, Monday-start buckets.
      const monday = new Date(now);
      const day = (monday.getDay() + 6) % 7;
      monday.setDate(now.getDate() - day);
      monday.setHours(0, 0, 0, 0);
      for (let i = 7; i >= 0; i--) {
        const d = new Date(monday);
        d.setDate(monday.getDate() - i * 7);
        const key = `w-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        buckets.push({
          key,
          label: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
          amount: 0,
          sales: 0,
        });
      }
      sales.forEach((s) => {
        const sd = new Date(s.created_at);
        // Bucket by the Monday of the sale's own week (works for any day,
        // including later days of the current week).
        const sMonday = new Date(sd);
        sMonday.setDate(sd.getDate() - ((sd.getDay() + 6) % 7));
        sMonday.setHours(0, 0, 0, 0);
        const key = `w-${sMonday.getFullYear()}-${sMonday.getMonth()}-${sMonday.getDate()}`;
        const b = buckets.find((x) => x.key === key);
        if (b) { b.amount += s.final_amount; b.sales += 1; }
      });
    } else if (trendRange === 'monthly') {
      // Last 12 months.
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `m-${d.getFullYear()}-${d.getMonth()}`;
        buckets.push({
          key,
          label: d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
          amount: 0,
          sales: 0,
        });
      }
      sales.forEach((s) => {
        const sd = new Date(s.created_at);
        const key = `m-${sd.getFullYear()}-${sd.getMonth()}`;
        const b = buckets.find((x) => x.key === key);
        if (b) { b.amount += s.final_amount; b.sales += 1; }
      });
    } else {
      // Annual: last 5 years.
      for (let i = 4; i >= 0; i--) {
        const y = now.getFullYear() - i;
        buckets.push({ key: `y-${y}`, label: String(y), amount: 0, sales: 0 });
      }
      sales.forEach((s) => {
        const key = `y-${new Date(s.created_at).getFullYear()}`;
        const b = buckets.find((x) => x.key === key);
        if (b) { b.amount += s.final_amount; b.sales += 1; }
      });
    }
    return buckets;
  };
  const trendData = getSalesTrend();

  const handleAccountSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountMsg('');
    if (!shopDetails) return;
    try {
      const { error } = await db.updateShop(shopDetails.id, {
        shop_name: accountShopName,
        discount_percent: Number(accountDiscount),
        email: accountEmail,
        description: accountDescription.trim(),
      });
      if (error) {
        setAccountMsg(error);
        setAccountMsgType('error');
      } else {
        setAccountMsg('Shop details updated successfully.');
        setAccountMsgType('success');
        await loadData();
      }
    } catch {
      setAccountMsg('Failed to update shop details.');
      setAccountMsgType('error');
    }
    setTimeout(() => setAccountMsg(''), 5000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountMsg('');
    if (!newPassword || !confirmPassword || !currentPassword) {
      setAccountMsg('All password fields are required.');
      setAccountMsgType('error');
      setTimeout(() => setAccountMsg(''), 4000);
      return;
    }
    if (newPassword !== confirmPassword) {
      setAccountMsg('New passwords do not match.');
      setAccountMsgType('error');
      setTimeout(() => setAccountMsg(''), 4000);
      return;
    }
    if (!shopDetails) return;

    const allShops = await db.getShops();
    const currentShop = allShops.find(s => s.id === shopDetails.id);
    if (!currentShop || currentShop.password !== currentPassword) {
      setAccountMsg('Current password is incorrect.');
      setAccountMsgType('error');
      setTimeout(() => setAccountMsg(''), 4000);
      return;
    }

    try {
      const { error } = await db.updateShop(shopDetails.id, { password: newPassword });
      if (error) {
        setAccountMsg(error);
        setAccountMsgType('error');
      } else {
        setAccountMsg('Password changed successfully.');
        setAccountMsgType('success');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch {
      setAccountMsg('Failed to change password.');
      setAccountMsgType('error');
    }
    setTimeout(() => setAccountMsg(''), 5000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8 relative z-10 font-sans" id="shop-dashboard-root">
      
      {/* SHOP METRICS HEADER & PROFILE */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-6 relative overflow-hidden text-slate-800 dark:text-slate-100" id="shop-header">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            {/* PROFILE PICTURE VIEWER & EDITOR */}
            <div className="relative group cursor-pointer" id="profile-picture-container">
              <div className="w-20 h-20 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-emerald-500 overflow-hidden flex items-center justify-center shadow-sm relative">
                {profilePic ? (
                  <img src={profilePic} alt="Shop Profile" className="w-full h-full object-cover" />
                ) : (
                  <Store className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                )}
                
                {/* Upload overlay */}
                <label className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer">
                  <Upload className="w-4 h-4 mb-0.5 text-emerald-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Upload</span>
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mb-1.5">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                  {shopDetails ? shopDetails.shop_name : 'Loading Shop...'}
                </h1>
                <span className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-900">
                  {shopDetails ? `${shopDetails.discount_percent}% Partner Discount` : '...' }
                </span>
              </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-semibold">{shopUser.email} • Verified Partner Shop Account</p>
            </div>
          </div>

          <div className="flex items-center gap-3 justify-center">
            <ThemeToggle />
            {onLogout && (
              <button
                onClick={onLogout}
                className="px-4 py-2 border border-red-200 dark:border-red-900 bg-white dark:bg-slate-900 hover:bg-red-50 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                <span>Logout</span>
              </button>
            )}
          </div>
        </div>

        {/* TAB NAVIGATION */}
        <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800" id="shop-tab-navigation">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'products', label: 'Products', icon: ShoppingBag },
            { id: 'sales', label: 'Sales', icon: BarChart3 },
            { id: 'account', label: 'Account', icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* FINANCIAL SUMMARY HIGHLIGHT CARDS - Always visible */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800" id="shop-stats-grids">
          
          <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900 shadow-sm">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block">Net Earnings</span>
              <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{totalEarnings.toLocaleString()} RWF</span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900 shadow-sm">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block">Total Discounts Saved</span>
              <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{totalDiscountsGiven.toLocaleString()} RWF</span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900 shadow-sm">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block">Gross Sales Value</span>
              <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{totalAmountBefore.toLocaleString()} RWF</span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900 shadow-sm">
              <History className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block">Total Transactions</span>
              <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{totalSalesCount} Scans</span>
            </div>
          </div>

        </div>
      </div>

      {/* TAB BODY */}
      <div className="space-y-6">
        {activeTab === 'dashboard' && (
          <div className="space-y-6" id="shop-dashboard-tab">
            {/* SCAN CARD CTA — opens the scanner popup; the filled form appears below */}
            <button
              onClick={() => setScanModalOpen(true)}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl p-5 flex items-center gap-4 text-left shadow-sm transition-all cursor-pointer"
            >
              <span className="p-3 rounded-2xl bg-white/15 border border-white/20 shrink-0">
                <Camera className="w-6 h-6" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-base font-black tracking-tight">
                  Scan Card
                </span>
                <span className="block text-xs text-emerald-50/90">
                  Open the scanner popup to fill the discount form instantly
                </span>
              </span>
              <span className="px-3 py-1.5 bg-white/15 border border-white/20 rounded-xl text-[11px] font-black uppercase tracking-wider shrink-0">
                Open
              </span>
            </button>

            {/* SCANNER POPUP — scan here, then the filled discount form appears below */}
            {scanModalOpen && (
            <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
                <button onClick={closeScanModal} aria-label="Close scanner" title="Close scanner" className="absolute top-4 right-4 p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 cursor-pointer z-20">
                  <XCircle className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900 shadow-sm">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 tracking-tight">Scan Member Card</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">The discount form below fills instantly after a valid scan</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Step 1: Scan Member Card</span>
                  <button
                    onClick={toggleFacingMode}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{facingMode === 'user' ? 'Rear' : 'Front'} Camera</span>
                  </button>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col items-center relative overflow-hidden min-h-[280px]">
                <div className="absolute top-2 left-2 w-8 h-8 border-t-2 border-l-2 border-emerald-500 rounded-tl-lg pointer-events-none" />
                <div className="absolute top-2 right-2 w-8 h-8 border-t-2 border-r-2 border-emerald-500 rounded-tr-lg pointer-events-none" />
                <div className="absolute bottom-2 left-2 w-8 h-8 border-b-2 border-l-2 border-emerald-500 rounded-bl-lg pointer-events-none" />
                <div className="absolute bottom-2 right-2 w-8 h-8 border-b-2 border-r-2 border-emerald-500 rounded-br-lg pointer-events-none" />

                {!isCameraActive ? (
                  <div className="py-8 px-6 text-center flex flex-col items-center relative z-10">
                    <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400 mb-3 animate-pulse">
                      <Camera className="w-7 h-7" />
                    </div>
                    <h3 className="font-bold text-slate-100 text-sm uppercase tracking-wider mb-1">Scanner Idle</h3>
                    <p className="text-xs text-slate-400 max-w-sm mb-5 leading-relaxed">
                      Activate camera feed to scan customer QR cards, auto-fill name records, and apply store discounts.
                    </p>
                    <button
                      onClick={() => startCamera(facingMode)}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all cursor-pointer"
                    >
                      Activate QR Scanner Camera
                    </button>
                  </div>
                ) : (
                  <div className="w-full relative z-10 flex flex-col items-center">
                    <div id={containerId} className="relative w-full max-w-[300px] mx-auto aspect-square rounded-xl overflow-hidden border border-slate-800 bg-black">
                      <div className="absolute left-3 right-3 h-0.5 bg-emerald-400/40 shadow-[0_0_12px_#10b981] top-1/2 pointer-events-none z-10" />
                    </div>
                    <button
                      onClick={stopCamera}
                      className="mt-3 px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all z-20 shadow cursor-pointer flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Stop Scanner
                    </button>
                  </div>
                )}

                {scannerError && (
                  <div className="mt-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 rounded-xl p-3 flex items-start gap-2.5 text-left text-xs text-amber-800 dark:text-amber-300 relative z-10">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">Sandboxed Camera Warning</p>
                      <p className="mt-0.5 text-amber-700 dark:text-amber-300 leading-relaxed text-[11px]">{scannerError}</p>
                    </div>
                  </div>
                )}

                {scanErrorState && (
                  <div className="mt-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl p-3 flex items-start gap-2.5 text-left text-xs text-red-800 dark:text-red-300 relative z-10 w-full animate-bounce">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-red-950 dark:text-red-200 uppercase tracking-wider">Access Denied: Card Blocked</p>
                      <p className="mt-0.5 text-red-700 dark:text-red-300 leading-relaxed text-[11px]">{scanErrorState}</p>
                    </div>
                  </div>
                )}
                </div>

                <div className="border-t border-dashed border-slate-200 dark:border-slate-800 mt-5 pt-5">
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Simulated Customer QR Scan (Sandbox Mode)</span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
                    Type any member card code below to simulate a card swipe/scanner action:
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      id="shop-simulator-scan-input"
                      placeholder="e.g. CUST-####"
                      className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val) handleDecodedQR(val);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById('shop-simulator-scan-input') as HTMLInputElement;
                        if (input && input.value.trim()) {
                          handleDecodedQR(input.value.trim());
                        } else {
                          alert('Please type a valid membership code.');
                        }
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap"
                    >
                      Simulate
                    </button>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* DASHBOARD CHARTS: top customers + sales trend */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-6 text-slate-800 dark:text-slate-100">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-base font-bold tracking-tight">Top Purchasing Customers</h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Ranked by total spent at your shop</p>
                {topCustomers.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs uppercase tracking-wider font-semibold bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                    No sales yet.
                  </div>
                ) : (
                  <div className="h-64 w-full text-xs font-semibold">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={topCustomers}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={2}
                        >
                          {topCustomers.map((entry, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#1e293b', borderRadius: '12px' }}
                          itemStyle={{ color: '#059669' }}
                          formatter={(v) => [`${Number(v).toLocaleString()} RWF`, 'Spent']}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-6 text-slate-800 dark:text-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="text-base font-bold tracking-tight">Sales Trend</h3>
                  </div>
                  <div className="flex gap-1.5">
                    {(['daily', 'weekly', 'monthly', 'annual'] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setTrendRange(r)}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all ${
                          trendRange === r
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {r === 'daily' ? 'Daily' : r === 'weekly' ? 'Weekly' : r === 'monthly' ? 'Monthly' : 'Annual'}
                      </button>
                    ))}
                  </div>
                </div>
                {trendData.every((d) => d.amount === 0) ? (
                  <div className="py-12 text-center text-slate-400 text-xs uppercase tracking-wider font-semibold bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                    No sales in this period.
                  </div>
                ) : (
                  <div className="h-64 w-full text-[10px] font-semibold">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="label" stroke="#64748b" fontSize={9} />
                        <YAxis stroke="#64748b" fontSize={9} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#1e293b', borderRadius: '12px' }}
                          itemStyle={{ color: '#059669' }}
                          formatter={(v) => [`${Number(v).toLocaleString()} RWF`, 'Sales']}
                        />
                        <Line type="monotone" dataKey="amount" stroke="#059669" strokeWidth={3} dot={{ r: 3, stroke: '#fff', strokeWidth: 1 }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
            {scanOpen && (
            <div id="shop-scan-panel" className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-6 text-slate-800 dark:text-slate-100 scroll-mt-6">
              <div className="flex items-center gap-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900 shadow-sm">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">QR Discount Scan & Calculator</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Scan customer cards and record transactions instantly</p>
                  </div>
                </div>
                
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
                <div className="lg:col-span-1">
                  {/* MY COUNTER QR — staff scans it to sign into this account */}
                  <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 mb-5">
                    {shopDetails?.qr_code ? (
                      <>
                        <div className="flex items-center gap-2 mb-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">My counter QR • active</p>
                          <span className="font-mono font-black text-[10px] text-slate-800 dark:text-slate-100 tracking-widest">{shopDetails.qr_code}</span>
                        </div>
                        <ShopCounterQr
                          shop={shopDetails}
                          qrValue={buildShopUrl(shopDetails)}
                          systemTitle={customization?.title || 'Mi Advantage'}
                          className="w-40 max-w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 mx-auto [&>div]:w-full [&_svg]:w-full [&_svg]:h-auto"
                        />
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-2.5">
                          Print and display at your counter. Staff scan it, enter the company password, and land in this account&apos;s scanner.
                        </p>
                      </>
                    ) : (
                      <div className="flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 rounded-xl p-3 w-full">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <span>No counter QR yet. Ask your admin to generate it (Partners → Shop QR), then it appears here.</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="lg:col-span-2 space-y-5">
              <div ref={discountFormRef} id="shop-discount-form" className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl scroll-mt-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase text-slate-700 dark:text-slate-200 tracking-wider">Transaction Data</span>
                  {scanDone && (
                    <div className="bg-emerald-600 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-sm">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Scan Completed</span>
                    </div>
                  )}
                </div>

                <form onSubmit={handleSaveTransaction} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Customer ID (Auto-Filled)</label>
                      <input
                        type="text"
                        readOnly
                        required
                        placeholder="Scan a card — e.g. CUST-1001"
                        value={scannedCustomer ? scannedCustomer.qr_code : ''}
                        className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 rounded-xl text-sm font-semibold font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Customer Name (Auto-Filled)</label>
                      <input
                        type="text"
                        readOnly
                        required
                        placeholder="Scan a member QR code to auto-populate customer details"
                        value={scannedCustomer ? scannedCustomer.name : ''}
                        className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 rounded-xl text-sm font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Purchase Cost Before Discount (RWF)</label>
                    <div className="relative">
                      <input
                        ref={amountInputRef}
                        type="number"
                        required
                        min="1"
                        placeholder="Enter transaction total before discount"
                        value={amountBefore}
                        onChange={(e) => setAmountBefore(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                      />
                      <span className="absolute right-4 top-3 text-xs text-slate-400 font-bold">RWF</span>
                    </div>
                  </div>

                  {shopDetails && (
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 text-sm">
                      <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                        <span>Gross Price:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-100">{(amountBefore || 0).toLocaleString()} RWF</span>
                      </div>
                      <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 text-[11px] font-bold uppercase tracking-wider">
                        <span>Discount Saved ({shopDetails.discount_percent}%):</span>
                        <span>- {Math.round(((Number(amountBefore) || 0) * shopDetails.discount_percent) / 100).toLocaleString()} RWF</span>
                      </div>
                      <div className="border-t border-slate-100 dark:border-slate-800 pt-2 flex justify-between items-center text-slate-800 dark:text-slate-100 font-bold text-base uppercase">
                        <span className="text-slate-500 dark:text-slate-400 text-xs tracking-wider font-semibold">Client Pays:</span>
                        <span className="text-xl text-emerald-600 dark:text-emerald-400 font-black tracking-tight">
                          {Math.max(0, (Number(amountBefore) || 0) - Math.round(((Number(amountBefore) || 0) * shopDetails.discount_percent) / 100)).toLocaleString()} RWF
                        </span>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmittingTx || !scannedCustomer || !amountBefore}
                    className={`w-full py-3.5 px-4 rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer ${
                      scannedCustomer && amountBefore
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-800 cursor-not-allowed'
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>{isSubmittingTx ? 'Recording Transaction...' : 'Save Discount Sale'}</span>
                  </button>

                  {txSuccess && (
                    <div className="mt-2 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl p-3 text-xs text-center font-semibold">
                      {txSuccess}
                    </div>
                  )}
                </form>
              </div>
                </div>
              </div>
            </div>
            )}
          </div>
        )}

        {activeTab === 'products' && (
          <div className="space-y-6" id="shop-products-tab">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-6 text-slate-800 dark:text-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-1">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900 shadow-sm">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">Products Menu</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{products.length} item{products.length === 1 ? '' : 's'} in your catalog</p>
                  </div>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Create / Edit form */}
              <form onSubmit={handleSaveProduct} id="shop-product-form" className="bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-4 sm:p-5 mt-4 space-y-4 scroll-mt-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {editingProductId ? 'Edit Product' : 'Add New Product'}
                  </span>
                  {editingProductId && (
                    <button
                      type="button"
                      onClick={resetProductForm}
                      className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 uppercase tracking-wider cursor-pointer"
                    >
                      Cancel edit
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">Product name *</label>
                    <input
                      type="text"
                      required
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      placeholder="e.g. Milk 1L"
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">Price (RWF) *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={productPrice}
                      onChange={(e) => setProductPrice(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="e.g. 2000"
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">Stock *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="1"
                      value={productStock}
                      onChange={(e) => setProductStock(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="e.g. 50"
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">Description</label>
                    <textarea
                      rows={2}
                      value={productDescription}
                      onChange={(e) => setProductDescription(e.target.value)}
                      placeholder="Short description shown to shoppers..."
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">Visibility</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['active', 'hidden'] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setProductStatus(st)}
                          className={`py-2 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer border transition-all ${
                            productStatus === st
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700'
                          }`}
                        >
                          {st === 'active' ? 'Visible' : 'Hidden'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {productMsg && (
                  <div className={`rounded-xl p-3 text-xs font-semibold ${productMsgType === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200' : 'bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300'}`}>
                    {productMsg}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  {savingProduct ? 'Saving...' : editingProductId ? 'Save Changes' : 'Add Product'}
                </button>
              </form>

              {/* Product list */}
              <div className="mt-5">
                {filteredProducts.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs uppercase tracking-wider font-semibold bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                    {products.length === 0 ? 'No products yet — add your first item above.' : 'No products match your search.'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {filteredProducts.map((p) => (
                      <div key={p.id} className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-white dark:bg-slate-900 hover:shadow-sm transition-shadow flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-snug">{p.name}</p>
                          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${p.status === 'hidden' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400' : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900'}`}>
                            {p.status === 'hidden' ? 'Hidden' : 'Visible'}
                          </span>
                        </div>
                        {p.description ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">{p.description}</p>
                        ) : null}
                        <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100 dark:border-slate-800">
                          <div>
                            <p className="text-base font-black text-emerald-700 dark:text-emerald-300">{Number(p.price).toLocaleString()} RWF</p>
                            <p className={`text-[11px] font-bold ${Number(p.stock) === 0 ? 'text-red-500' : 'text-slate-400'}`}>
                              {Number(p.stock) === 0 ? 'Out of stock' : `Stock: ${Number(p.stock)}`}
                            </p>
                          </div>
                          <div className="flex gap-1.5">
                            <button onClick={() => handleEditProductClick(p)} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 text-[11px] font-bold uppercase cursor-pointer" title="Edit product">Edit</button>
                            <button onClick={() => handleDeleteProductClick(p)} className="px-3 py-1.5 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg text-red-600 dark:text-red-400 text-[11px] font-bold uppercase cursor-pointer" title="Delete product">Delete</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sales' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="shop-sales-tab">
            <div className="lg:col-span-6 space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-6 text-slate-800 dark:text-slate-100">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 tracking-tight">Weekly Sales Analytics</h3>
                </div>
                <div className="h-56 w-full text-[10px] font-semibold">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={9} />
                      <YAxis stroke="#64748b" fontSize={9} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#1e293b', borderRadius: '12px' }}
                        itemStyle={{ color: '#059669' }}
                        formatter={(v) => [`${Number(v).toLocaleString()} RWF`, 'Sales']} 
                      />
                      <Line type="monotone" dataKey="amount" stroke="#059669" strokeWidth={3} dot={{ r: 4, stroke: '#fff', strokeWidth: 1 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-6 text-slate-800 dark:text-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100 tracking-tight uppercase">Audit & Reports Center</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Analyze, filter, sort, and print certified sales reports.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handlePrintReport}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Get Report PDF</span>
                  </button>
                </div>

                <div className="space-y-3 mb-4 bg-slate-50 dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Search customer name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Date Period</label>
                      <select
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="w-full px-2 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="all">All Records</option>
                        <option value="today">Today Only</option>
                        <option value="7days">Past 7 Days</option>
                        <option value="30days">Past 30 Days</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Sorting Order</label>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="w-full px-2 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="gross_desc">Highest Gross</option>
                        <option value="discount_desc">Max Savings</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">
                  <span>Filtered Matches</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{getFilteredAndSortedSales().length} of {sales.length} Sales</span>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin" id="shop-compact-transactions">
                  {getFilteredAndSortedSales().length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs uppercase tracking-wider font-semibold bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                      No matching transactions.
                    </div>
                  ) : (
                    getFilteredAndSortedSales().map((sale) => (
                      <div key={sale.id} className="p-3.5 border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100/50 dark:hover:bg-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs transition-all">
                        <div>
                          <span className="font-extrabold text-slate-800 dark:text-slate-100 block truncate max-w-[160px] uppercase tracking-wide">{sale.customer_name}</span>
                          <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                            {new Date(sale.created_at).toLocaleDateString()} at {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-extrabold text-emerald-600 dark:text-emerald-400 block">
                            {(sale.final_amount).toLocaleString()} RWF
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                            Saved {sale.discount_applied.toLocaleString()} RWF
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'account' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" id="shop-account-tab">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-6 text-slate-800 dark:text-slate-100 space-y-6">
              <div>
                <h3 className="text-base font-bold tracking-tight uppercase mb-1 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  Shop Profile Picture
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Configure your official customer-facing profile image logo.</p>
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                    dragActive
                      ? 'border-emerald-50 dark:border-emerald-900 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-100/50 dark:hover:bg-slate-800'
                  }`}
                >
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="shop-profile-upload-input" />
                  <div className="flex flex-col items-center">
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-full border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 shadow-sm mb-3">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 uppercase tracking-wider">Drag & Drop Store Image</p>
                    <p className="text-[10px] text-slate-400 mb-4 uppercase tracking-widest font-semibold font-sans">Supports PNG, JPG, or WebP</p>
                    <label
                      htmlFor="shop-profile-upload-input"
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all shadow-sm"
                    >
                      Browse Store File
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <form onSubmit={handleAccountSave} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-6 text-slate-800 dark:text-slate-100 space-y-4">
                <h3 className="text-base font-bold tracking-tight uppercase flex items-center gap-2">
                  <Store className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  Shop Details
                </h3>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">Shop Name</label>
                  <input
                    type="text"
                    required
                    value={accountShopName}
                    onChange={(e) => setAccountShopName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">Discount %</label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    value={accountDiscount}
                    onChange={(e) => setAccountDiscount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    required
                    value={accountEmail}
                    onChange={(e) => setAccountEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">Business Description (Join-page carousel)</label>
                  <textarea
                    rows={3}
                    value={accountDescription}
                    onChange={(e) => setAccountDescription(e.target.value)}
                    placeholder="Tell shoppers what your business offers..."
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold resize-y"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                >
                  Save Shop Details
                </button>
              </form>

              <form onSubmit={handleChangePassword} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-6 text-slate-800 dark:text-slate-100 space-y-4">
                <h3 className="text-base font-bold tracking-tight uppercase flex items-center gap-2">
                  <Lock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  Change Password
                </h3>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">Current Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type={showCurrentPass ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full pl-11 pr-10 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button type="button" onClick={() => setShowCurrentPass(!showCurrentPass)} className="absolute right-3 top-3 text-slate-400">
                      {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-11 pr-10 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="absolute right-3 top-3 text-slate-400">
                      {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">Confirm New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                >
                  Update Password
                </button>
              </form>

              {accountMsg && (
                <div className={`p-3.5 rounded-xl text-center font-bold text-xs border ${
                  accountMsgType === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-100 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-950/50 border-red-100 dark:border-red-900 text-red-700 dark:text-red-300'
                }`}>
                  {accountMsg}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

