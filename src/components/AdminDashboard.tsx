import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  db,
  getCustomerCardStatus,
  buildShopUrl,
  BUSINESS_TYPES,
  BUSINESS_TYPE_LABELS,
  DISCOUNT_SCOPES,
  DISCOUNT_SCOPE_LABELS,
} from "../lib/supabase";
import { Shop, Customer, Sale, AuditLog, Customization, Admin } from "../types";
import {
  Plus,
  Edit,
  Trash2,
  QrCode,
  Shield,
  Store,
  Users,
  BarChart3,
  Settings,
  Search,
  Download,
  Trash,
  CheckCircle2,
  SlidersHorizontal,
  ImageIcon,
  Palette,
  FileText,
  ArrowUpDown,
  Mail,
  Filter,
  Printer,


  RefreshCw,
  AlertTriangle,
  KeyRound,
  UserPlus,
  UserMinus,
  Clock,
  XCircle,
  DollarSign,
  ShoppingBag,
  Tag,
  Lock,
  LogIn,
  LogOut,
  Eye,
  EyeOff,
  History,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from "./AdminIcons";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { QRCodeCanvas } from "qrcode.react";
import ThemeToggle from "./ThemeToggle";

// Constants for charts
const COLORS = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
];

export default function AdminDashboard({
  onCustomizationChange,
  onLogout,
}: {
  onCustomizationChange?: () => void;
  onLogout?: () => void;
}) {
  const navigate = useNavigate();

  // Determine initial tab from URL hash
  const getInitialTab = () => {
    const hash = window.location.hash;
    if (hash.includes("/admins")) return "admins";
    if (hash.includes("/partners")) return "shops";
    if (hash.includes("/customers")) return "qrs";
    if (hash.includes("/referrers")) return "referrers";
    if (hash.includes("/reports")) return "reports";
    if (hash.includes("/customize")) return "customization";
    if (hash.includes("/logs")) return "audits";
    return "analytics";
  };

  // Navigation Tabs inside Admin
  const [activeTab, setActiveTab] = useState<
    | "analytics"
    | "shops"
    | "qrs"
    | "referrers"
    | "reports"
    | "customization"
    | "audits"
    | "admins"
  >(getInitialTab());

  // DB States
  const [shops, setShops] = useState<Shop[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [customization, setCustomization] = useState<Customization | null>(
    null,
  );
  const [adminsList, setAdminsList] = useState<Admin[]>([]);
  const [currentAdminRole, setCurrentAdminRole] = useState<'super_admin' | 'admin'>('admin');

  // Admin Account CRUD Form state
  const [isEditingAdmin, setIsEditingAdmin] = useState<string | null>(null); // admin ID or null for creation
  const [adminFormName, setAdminFormName] = useState("");
  const [adminFormEmail, setAdminFormEmail] = useState("");
  const [adminFormPassword, setAdminFormPassword] = useState("");
  const [adminFormRole, setAdminFormRole] = useState<'super_admin' | 'admin'>('admin');
  const [adminMsg, setAdminMsg] = useState("");



  // Shop Form CRUD states
  const [isEditingShop, setIsEditingShop] = useState<string | null>(null); // shop ID or null for creation
  const [shopName, setShopName] = useState("");
  const [shopDiscount, setShopDiscount] = useState<number | "">("");
  const [shopEmail, setShopEmail] = useState("");
  const [shopDescription, setShopDescription] = useState("");
  const [shopBusinessType, setShopBusinessType] = useState("retail");
  const [shopDiscountScope, setShopDiscountScope] = useState("all");
  const [shopPassword, setShopPassword] = useState("");
  const [shopMsg, setShopMsg] = useState("");

  // Customer Form states (Admin custom generation)
  const [isEditingCustomer, setIsEditingCustomer] = useState<string | null>(
    null,
  ); // customer ID or null for creation
  const [custName, setCustName] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custValidUntil, setCustValidUntil] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().split("T")[0];
  });
  const [custValidTime, setCustValidTime] = useState("");
  const [custReferee, setCustReferee] = useState("");
  const [custMsg, setCustMsg] = useState("");

  // Filtering & Sorting for Customer Cards
  const [custSearchTerm, setCustSearchTerm] = useState("");
  const [custFilterStatus, setCustFilterStatus] = useState<
    "all" | "active" | "expired"
  >("all");
  const [custSortBy, setCustSortBy] = useState<
    "name_asc" | "name_desc" | "code_asc" | "expiry_soon"
  >("name_asc");

  // Customization inputs
  const [titleInput, setTitleInput] = useState("");
  const [subtitleInput, setSubtitleInput] = useState("");
  const [themeInput, setThemeInput] = useState<
    "green" | "teal" | "emerald" | "dark-green" | "blue"
  >("green");
  const [logoInput, setLogoInput] = useState("");
  const [faviconInput, setFaviconInput] = useState("");
  const [h1Input, setH1Input] = useState("");
  const [h2Input, setH2Input] = useState("");
  const [pInput, setPInput] = useState("");
  const [loginHeading, setLoginHeading] = useState("");
  const [loginSubtext, setLoginSubtext] = useState("");
  const [signupHeading, setSignupHeading] = useState("");
  const [signupSubtext, setSignupSubtext] = useState("");
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [footerText, setFooterText] = useState("");
  const [footerSubtext, setFooterSubtext] = useState("");
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [brandingMsg, setBrandingMsg] = useState("");
  // Full branding colors & typography
  const [primaryColor, setPrimaryColor] = useState("#059669");
  const [secondaryColor, setSecondaryColor] = useState("#0d9488");
  const [accentColor, setAccentColor] = useState("#f59e0b");
  const [bgColor, setBgColor] = useState("#f8fafc");
  const [fontFamily, setFontFamily] = useState("Inter");
  const [headingFont, setHeadingFont] = useState("Space Grotesk");
  const [loginBgType, setLoginBgType] = useState("gradient");
  const [loginBgValue, setLoginBgValue] = useState("linear-gradient(135deg, #f8fafc 0%, #ecfdf5 100%)");
  const [customCss, setCustomCss] = useState("");

  // Selected customer for card download preview modal
  const [selectedCardCustomer, setSelectedCardCustomer] =
    useState<Customer | null>(null);

  // Filtering & Sorting for Sales Reports
  const [filterShopId, setFilterShopId] = useState("");
  const [filterPeriod, setFilterPeriod] = useState<
    "all" | "daily" | "monthly" | "quarterly" | "annually" | "custom"
  >("all");
  const [sortBy, setSortBy] = useState<"date" | "alphabetical" | "amount">(
    "date",
  );
  const [customFromDate, setCustomFromDate] = useState("");
  const [customToDate, setCustomToDate] = useState("");

  // Load all admin data
  const loadData = async () => {
    try {
      const listShops = await db.getShops();
      const listCustomers = await db.getCustomers();
      const listSales = await db.getSales();
      const listLogs = await db.getAuditLogs();
      const currentCust = await db.getCustomization();
      const listAdmins = await db.getAdmins();

      setShops(listShops);
      setCustomers(listCustomers);
      setSales(listSales);
      setLogs(listLogs);
      setCustomization(currentCust);
      setAdminsList(listAdmins);

      const authUser = db.currentUser;
      setCurrentAdminRole((authUser?.admin_role as 'super_admin' | 'admin') || 'admin');

      // Seed form customizations
      setTitleInput(currentCust.title);
      setSubtitleInput(currentCust.subtitle || "Kigali Premium Privilege");
      setThemeInput(currentCust.theme_color);
      setLogoInput(currentCust.logo_url);
      setFaviconInput(currentCust.favicon_url || "");
      setH1Input(currentCust.home_h1 || "Instant Merchant Discounts");
      setH2Input(currentCust.home_h2 || "QR Member Advantage System");
      setPInput(
        currentCust.home_p ||
          "Scan your digital member card at any registered partner outlet in Kigali to instantly redeem high-value discount privileges. Connect with top local merchants, supermarkets, and cafes seamlessly.",
      );
      setLoginHeading(currentCust.login_heading || 'Partner Shop Terminal');
      setLoginSubtext(currentCust.login_subtext || 'Authorized Merchants Only');
      setSignupHeading(currentCust.signup_heading || 'Register Your Shop');
      setSignupSubtext(currentCust.signup_subtext || 'Submit your business documents for admin approval.');

      // Seed footer values
      setFooterText(currentCust.footer_text || '© 2026 Mi Advantage • Partner Merchant Terminals Kigali, Rwanda');
      setFooterSubtext(currentCust.footer_subtext || 'Encrypted Connection • Kigali, Rwanda');

      // Seed full branding values
      setPrimaryColor(currentCust.primary_color || '#059669');
      setSecondaryColor(currentCust.secondary_color || '#0d9488');
      setAccentColor(currentCust.accent_color || '#f59e0b');
      setBgColor(currentCust.background_color || '#f8fafc');
      setFontFamily(currentCust.font_family || 'Inter');
      setHeadingFont(currentCust.heading_font || 'Space Grotesk');
      setLoginBgType(currentCust.login_background_type || 'gradient');
      setLoginBgValue(currentCust.login_background_value || 'linear-gradient(135deg, #f8fafc 0%, #ecfdf5 100%)');
      setCustomCss(currentCust.custom_css || '');

    } catch (err) {
      console.error("AdminDashboard loadData failed:", err);
    }
  };

  useEffect(() => {
    loadData().catch((err) => console.error("AdminDashboard useEffect error:", err));
  }, [activeTab]);

  // Handle Create / Update Shop
  const handleSaveShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName || !shopDiscount || !shopEmail) {
      setShopMsg("Please fill in all standard fields.");
      return;
    }

    setShopMsg("");
    try {
      if (isEditingShop) {
        // Update
        const { error } = await db.updateShop(isEditingShop, {
          shop_name: shopName,
          discount_percent: Number(shopDiscount),
          email: shopEmail,
          description: shopDescription.trim(),
          business_type: shopBusinessType,
          discount_scope: shopDiscountScope,
          ...(shopPassword ? { password: shopPassword } : {}),
        });
        if (error) {
          setShopMsg(error);
        } else {
          resetShopForm();
          await loadData();
          flashShopListMsg("Shop updated successfully!");
        }
      } else {
        // Create
        if (!shopPassword) {
          setShopMsg("Password is required for new shops.");
          return;
        }
        const { error } = await db.createShop(
          shopName,
          Number(shopDiscount),
          shopEmail,
          shopPassword,
          shopDescription,
          shopBusinessType,
          shopDiscountScope,
        );
        if (error) {
          setShopMsg(error);
        } else {
          resetShopForm();
          await loadData();
          flashShopListMsg("New shop registered successfully!");
        }
      }
    } catch {
      setShopMsg("Error performing operation.");
    }
  };

  const resetShopForm = () => {
    setIsEditingShop(null);
    setShopName("");
    setShopDiscount("");
    setShopEmail("");
    setShopPassword("");
    setShopDescription("");
    setShopBusinessType("retail");
    setShopDiscountScope("all");
    setShopModalOpen(false);
  };

  const handleEditShopClick = (shop: Shop) => {
    setIsEditingShop(shop.id);
    setShopName(shop.shop_name);
    setShopDiscount(shop.discount_percent);
    setShopEmail(shop.email);
    setShopPassword(""); // leave blank unless changing
    setShopDescription(shop.description || "");
    setShopBusinessType(shop.business_type || "retail");
    setShopDiscountScope(shop.discount_scope || "all");
    setShopModalOpen(true);
  };

  const handleDeleteShopClick = async (id: string) => {
    if (
      confirm(
        "Are you sure you want to delete this partner shop? All matching credentials will be revoked.",
      )
    ) {
      await db.deleteShop(id);
      await loadData();
      flashShopListMsg("Partner shop deleted.");
    }
  };

  const handleApproveShop = async (id: string) => {
    if (
      confirm(
        "Approve this shop application? The shop will be notified by email and gain sign-in access.",
      )
    ) {
      const { success, error } = await db.approveShop(id);
      if (success) {
        alert("Shop application approved and the shop has been notified by email.");
        await loadData();
      } else {
        alert(error || "Failed to approve shop application.");
      }
    }
  };

  const handleRejectShop = async (id: string) => {
    if (
      confirm(
        "Reject this shop application? The shop will be notified and will not be able to sign in.",
      )
    ) {
      const { success, error } = await db.rejectShop(id);
      if (success) {
        alert("Shop application rejected and the shop has been notified.");
        await loadData();
      } else {
        alert(error || "Failed to reject shop application.");
      }
    }
  };

  const handleDownloadShopQR = () => {
    const canvas = document.getElementById("shop-qr-canvas") as HTMLCanvasElement | null;
    if (!canvas || !qrModalShop) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${qrModalShop.qr_code || "shop"}-qr.png`;
    link.click();
  };

  // Generate or Update Customer QR Code details from Admin Dashboard
  const handleAdminGenerateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName || !custPhone) {
      setCustMsg("Please enter the customer name and phone number.");
      return;
    }
    // All customers are general members (no student type).

    // Secure referee validation: format, existence, and no self-referrals.
    const refereeCode = custReferee.trim().toUpperCase();
    if (refereeCode) {
      if (!/^CUST-\d{3,}$/.test(refereeCode)) {
        setCustMsg("Referee ID must be a valid CARD ID (e.g. CUST-001).");
        return;
      }
      const refCust = customers.find(
        (c) => c.qr_code.toUpperCase() === refereeCode,
      );
      if (!refCust) {
        setCustMsg(
          `Referee ID ${refereeCode} not found. Enter a registered CARD ID.`,
        );
        return;
      }
      if (
        (isEditingCustomer && isEditingCustomer === refCust.id) ||
        (custEmail.trim() && (refCust.email || "").toLowerCase() === custEmail.trim().toLowerCase())
      ) {
        setCustMsg("A customer cannot refer themselves.");
        return;
      }
    }

    setCustMsg("");
    const finalValidUntil =
      custValidUntil && custValidTime
        ? `${custValidUntil}T${custValidTime}`
        : custValidUntil;

    try {
      if (isEditingCustomer) {
        // Update Customer card details (all members are general)
        const { customer, error } = await db.updateCustomer(isEditingCustomer, {
          name: custName,
          email: custEmail,
          phone: custPhone,
          valid_until: finalValidUntil,
          customer_type: "other",
          student_id: "",
          university: "",
          referee_number: refereeCode,
        });
        if (error) {
          setCustMsg(error);
        } else if (customer) {
          resetCustomerForm();
          await loadData();
          flashCardListMsg(`Member card details updated successfully!`);
        }
      } else {
        // Create Customer (all members are general)
        const { customer, error } = await db.createCustomer(
          custName,
          custEmail,
          custPhone,
          finalValidUntil,
          {
            customer_type: "other",
            student_id: "",
            university: "",
            referee_number: refereeCode,
          },
        );
        if (error) {
          setCustMsg(error);
        } else if (customer) {
          resetCustomerForm();
          await loadData();
          flashCardListMsg(
            `Customer registered successfully! Created QR card code: ${customer.qr_code}`,
          );
        }
      }
    } catch {
      setCustMsg("Error processing customer card operation.");
    }
  };

  const resetCustomerForm = () => {
    setIsEditingCustomer(null);
    setCustName("");
    setCustEmail("");
    setCustPhone("");
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    setCustValidUntil(d.toISOString().split("T")[0]);
    setCustValidTime("");
    setCustReferee("");
    setCustMsg("");
    setCardModalOpen(false);
  };

  const handleEditCustomerClick = (c: Customer) => {
    setIsEditingCustomer(c.id);
    setCustName(c.name);
    setCustEmail(c.email || "");
    setCustPhone(c.phone);
    setCustReferee(c.referee_number || "");
    setCardModalOpen(true);
    if (c.valid_until) {
      if (c.valid_until.includes("T")) {
        const [date, time] = c.valid_until.split("T");
        setCustValidUntil(date);
        setCustValidTime(time);
      } else if (c.valid_until.includes(" ")) {
        const [date, time] = c.valid_until.split(" ");
        setCustValidUntil(date);
        setCustValidTime(time);
      } else {
        setCustValidUntil(c.valid_until);
        setCustValidTime("");
      }
    } else {
      setCustValidUntil("");
      setCustValidTime("");
    }
    setCustMsg("");
  };

  // Delete Customer Card
  const handleDeleteCustomerClick = async (id: string) => {
    if (
      confirm(
        "Are you sure you want to delete this customer QR card registration?",
      )
    ) {
      await db.deleteCustomer(id);
      await loadData();
      flashCardListMsg("Member card deleted.");
    }
  };

  // Remove a referee link from a customer (full CRUD delete of the referral).
  const handleRemoveRefereeClick = async (c: Customer) => {
    if (
      !c.referee_number ||
      !confirm(
        `Remove referee ${c.referee_number} from ${c.name} and reset its reward credit?`,
      )
    ) {
      return;
    }
    const res = await db.clearCustomerReferee(c.id);
    if (!res.success) {
      alert("Failed to remove referee: " + res.error);
    }
    await loadData();
  };

  // Update Global Configurations Theme / Logo
  const handleSaveCustomization = async (e: React.FormEvent) => {
    e.preventDefault();
    setBrandingMsg("");
    try {
      const updated = await db.updateCustomization({
        title: titleInput,
        subtitle: subtitleInput,
        theme_color: themeInput,
        logo_url: logoInput,
        favicon_url: faviconInput.trim(),
        home_h1: h1Input,
        home_h2: h2Input,
        home_p: pInput,
        login_heading: loginHeading,
        login_subtext: loginSubtext,
        signup_heading: signupHeading,
        signup_subtext: signupSubtext,
        footer_text: footerText,
        footer_subtext: footerSubtext,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        accent_color: accentColor,
        background_color: bgColor,
        font_family: fontFamily,
        heading_font: headingFont,
        login_background_type: loginBgType,
        login_background_value: loginBgValue,
        custom_css: customCss,
      });
      const fresh = await db.getCustomization();
      if (fresh.title === updated.title && fresh.theme_color === updated.theme_color) {
        setBrandingMsg("Branding saved successfully. Changes are live across the portal.");
        if (onCustomizationChange) onCustomizationChange();
      } else {
        setBrandingMsg("Saved locally but the server may not have persisted. Check your connection.");
        if (onCustomizationChange) onCustomizationChange();
      }
      setTimeout(() => setBrandingMsg(""), 6000);
    } catch {
      setBrandingMsg("Failed to update branding. Please check your database connection.");
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setLogoInput(event.target?.result as string);
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleFaviconFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFaviconInput(event.target?.result as string);
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  // --- ADMIN ACCOUNTS CRUD HANDLERS ---
  const handleSaveAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminFormName || !adminFormEmail) {
      setAdminMsg("Name and email are required.");
      return;
    }
    setAdminMsg("");
    try {
      if (isEditingAdmin) {
        const { error } = await db.updateAdmin(isEditingAdmin, {
          name: adminFormName,
          email: adminFormEmail,
          ...(adminFormRole ? { role: adminFormRole } : {}),
          ...(adminFormPassword ? { password: adminFormPassword } : {}),
        });
        if (error) {
          setAdminMsg(error);
        } else {
          setAdminMsg("Administrator settings updated successfully!");
          resetAdminForm();
          await loadData();
        }
      } else {
        if (!adminFormPassword) {
          setAdminMsg("Password is required for new administrator profiles.");
          return;
        }
        const { error } = await db.createAdmin(
          adminFormName,
          adminFormEmail,
          adminFormPassword,
          adminFormRole,
        );
        if (error) {
          setAdminMsg(error);
        } else {
          setAdminMsg(
            "Admin registered successfully. A verification email was sent - the new admin must verify before signing in.",
          );
          resetAdminForm();
          await loadData();
        }
      }
    } catch {
      setAdminMsg("Failed to execute administrator operations.");
    }
  };

  const resetAdminForm = () => {
    setIsEditingAdmin(null);
    setAdminFormName("");
    setAdminFormEmail("");
    setAdminFormPassword("");
    setAdminFormRole('admin');
  };

  const handleEditAdminClick = (admin: Admin) => {
    setIsEditingAdmin(admin.id);
    setAdminFormName(admin.name);
    setAdminFormEmail(admin.email);
    setAdminFormPassword("");
    setAdminFormRole(admin.role || 'admin');
  };

  const handleDeleteAdminClick = async (id: string) => {
    if (currentAdminRole !== 'super_admin') {
      alert("Only the super admin can delete administrator accounts.");
      return;
    }
    if (
      confirm(
        "Are you sure you want to revoke credentials and delete this administrator account?",
      )
    ) {
      const { success, error } = await db.deleteAdmin(id);
      if (success) {
        await loadData();
      } else {
        alert(error || "Failed to delete administrator account.");
      }
    }
  };


  // --- REPORT FILTER & SORT LOGIC ---
  const getFilteredSales = () => {
    let result = [...sales];

    // 1. Shop filter
    if (filterShopId) {
      result = result.filter((s) => s.shop_id === filterShopId);
    }

    // 2. Period filter
    const now = new Date();
    if (filterPeriod === "custom" && customFromDate && customToDate) {
      // Custom date range filter — real from/to selection
      const from = new Date(customFromDate + "T00:00:00");
      const to = new Date(customToDate + "T23:59:59");
      result = result.filter((s) => {
        const d = new Date(s.created_at);
        return d >= from && d <= to;
      });
    } else if (filterPeriod === "custom" && customFromDate) {
      // Only from date set
      const from = new Date(customFromDate + "T00:00:00");
      result = result.filter((s) => new Date(s.created_at) >= from);
    } else if (filterPeriod === "custom" && customToDate) {
      // Only to date set
      const to = new Date(customToDate + "T23:59:59");
      result = result.filter((s) => new Date(s.created_at) <= to);
    } else if (filterPeriod === "daily") {
      const today = now.toDateString();
      result = result.filter(
        (s) => new Date(s.created_at).toDateString() === today,
      );
    } else if (filterPeriod === "monthly") {
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      result = result.filter((s) => {
        const d = new Date(s.created_at);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });
    } else if (filterPeriod === "quarterly") {
      // Current quarter: 0-2 (Q1), 3-5 (Q2), 6-8 (Q3), 9-11 (Q4)
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const currentYear = now.getFullYear();
      result = result.filter((s) => {
        const d = new Date(s.created_at);
        const q = Math.floor(d.getMonth() / 3);
        return q === currentQuarter && d.getFullYear() === currentYear;
      });
    } else if (filterPeriod === "annually") {
      const currentYear = now.getFullYear();
      result = result.filter(
        (s) => new Date(s.created_at).getFullYear() === currentYear,
      );
    }

    // 3. Sorting
    if (sortBy === "date") {
      result.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    } else if (sortBy === "alphabetical") {
      result.sort((a, b) => a.customer_name.localeCompare(b.customer_name));
    } else if (sortBy === "amount") {
      result.sort((a, b) => b.final_amount - a.final_amount);
    }

    return result;
  };

  const filteredSalesData = getFilteredSales();

  // Export Sorted / Filtered Sales as PDF via jsPDF + autoTable
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();

      // Header styling
      doc.setFillColor(16, 185, 129); // emerald green header
      doc.rect(0, 0, 210, 40, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont("Helvetica", "bold");
      doc.text(customization?.title || "Mi Advantage", 14, 18);

      doc.setFontSize(10);
      doc.setFont("Helvetica", "normal");
      doc.text("AUTOMATED COMPLIANCE SALES REPORT", 14, 26);
      doc.text(`Generated on: ${new Date().toLocaleString()} (UTC)`, 14, 32);

      // Filters summary
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(11);
      doc.setFont("Helvetica", "bold");
      doc.text("REPORT PARAMETERS:", 14, 48);

      const dateRangeLabel =
        filterPeriod === "custom"
          ? `Custom: ${customFromDate || "Start"} → ${customToDate || "End"}`
          : filterPeriod.toUpperCase();

      doc.setFont("Helvetica", "normal");
      doc.text(
        `• Selected Shop: ${filterShopId ? shops.find((s) => s.id === filterShopId)?.shop_name || "Selected" : "All Shops"}`,
        14,
        55,
      );
      doc.text(`• Reporting Cycle: ${dateRangeLabel}`, 14, 61);
      doc.text(`• Ordered By: ${sortBy.toUpperCase()}`, 14, 67);

      // Summary blocks
      const totSales = filteredSalesData.reduce(
        (acc, curr) => acc + curr.final_amount,
        0,
      );
      const totDiscounts = filteredSalesData.reduce(
        (acc, curr) => acc + curr.discount_applied,
        0,
      );

      doc.rect(130, 45, 66, 26, "S");
      doc.setFont("Helvetica", "bold");
      doc.text("METRICS SUMMARY:", 133, 51);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Records: ${filteredSalesData.length}`, 133, 57);
      doc.text(`Total Discount: ${totDiscounts.toLocaleString()} RWF`, 133, 63);
      doc.text(`Total Revenue: ${totSales.toLocaleString()} RWF`, 133, 69);

      // Main Table of transactions
      const tableRows = filteredSalesData.map((s, idx) => [
        idx + 1,
        new Date(s.created_at).toLocaleDateString(),
        s.customer_name,
        s.shop_name,
        `${s.amount_before_discount.toLocaleString()} RWF`,
        `${s.discount_percent}%`,
        `${s.discount_applied.toLocaleString()} RWF`,
        `${s.final_amount.toLocaleString()} RWF`,
      ]);

      autoTable(doc, {
        startY: 76,
        head: [
          [
            "#",
            "Date",
            "Customer Name",
            "Shop Outlet",
            "Price before",
            "Discount",
            "Value Saved",
            "Net Amount",
          ],
        ],
        body: tableRows,
        theme: "striped",
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] },
        styles: { fontSize: 8 },
        columnStyles: {
          4: { fontStyle: "bold" },
          7: { fontStyle: "bold", textColor: [16, 185, 129] },
        },
      });

      // Footer
      const finalY = (doc as any).lastAutoTable.finalY || 100;
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        "© Mi Advantage Rwanda • Authentic Merchant Ledger",
        14,
        finalY + 15,
      );

      // Generate PDF blob for preview
      const pdfBlob = doc.output("blob");
      const url = URL.createObjectURL(pdfBlob);
      setPdfPreviewUrl(url);
    } catch (err) {
      console.error(err);
      alert("Error generating PDF file.");
    }
  };

  const handleConfirmDownload = () => {
    if (pdfPreviewUrl) {
      const link = document.createElement("a");
      link.href = pdfPreviewUrl;
      link.download = `mi-advantage-sales-report-${filterPeriod}.pdf`;
      link.click();
    }
    setPdfPreviewUrl(null);
  };

  // --- CUSTOMER FILTER, SORT & PDF EXPORT LOGIC ---
  const getFilteredCustomers = () => {
    let result = [...customers];

    // 1. Filter by search term (name, email, phone, qr_code)
    if (custSearchTerm.trim() !== "") {
      const term = custSearchTerm.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          (c.email || "").toLowerCase().includes(term) ||
          c.phone.toLowerCase().includes(term) ||
          c.qr_code.toLowerCase().includes(term),
      );
    }

    // 2. Filter by status (active vs renew subscription)
    if (custFilterStatus !== "all") {
      if (custFilterStatus === "active") {
        result = result.filter((c) => getCustomerCardStatus(c) !== "renew");
      } else if (custFilterStatus === "expired") {
        result = result.filter((c) => getCustomerCardStatus(c) === "renew");
      }
    }

    // 3. Sort by
    if (custSortBy === "name_asc") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (custSortBy === "name_desc") {
      result.sort((a, b) => b.name.localeCompare(a.name));
    } else if (custSortBy === "code_asc") {
      result.sort((a, b) => a.qr_code.localeCompare(b.qr_code));
    } else if (custSortBy === "expiry_soon") {
      result.sort((a, b) => {
        if (!a.valid_until) return 1;
        if (!b.valid_until) return -1;
        return a.valid_until.localeCompare(b.valid_until);
      });
    }

    return result;
  };

  const handleExportCustomersPDF = () => {
    try {
      const doc = new jsPDF();
      const filteredCusts = getFilteredCustomers();

      // Header styling
      doc.setFillColor(16, 185, 129); // emerald green header
      doc.rect(0, 0, 210, 40, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont("Helvetica", "bold");
      doc.text(customization?.title || "Mi Advantage", 14, 18);
      doc.setFontSize(10);
      doc.setFont("Helvetica", "normal");
      doc.text("CERTIFIED ACTIVE CUSTOMER DATABASE LEDGER", 14, 26);
      doc.text(`Generated on: ${new Date().toLocaleString()} (UTC)`, 14, 32);

      // Filters summary
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(11);
      doc.setFont("Helvetica", "bold");
      doc.text("DATABASE SUMMARY & PARAMETERS:", 14, 48);

      doc.setFont("Helvetica", "normal");
      doc.text(
        `• Total Filtered Customers: ${filteredCusts.length} of ${customers.length}`,
        14,
        55,
      );
      doc.text(`• Status Filter: ${custFilterStatus.toUpperCase()}`, 14, 61);
      doc.text(`• Ordered By: ${custSortBy.toUpperCase()}`, 14, 67);

      // Table of customers in list mode (CUST, Full name, email, telephone)
      const tableRows = filteredCusts.map((c, idx) => [
        idx + 1,
        c.qr_code, // CUST
        c.name, // Full name
        c.email, // email
        c.phone, // telephone
        c.valid_until || "NEVER EXPIRES",
      ]);

      autoTable(doc, {
        startY: 76,
        head: [
          [
            "#",
            "CUST ID",
            "Full Name",
            "Email Address",
            "Telephone",
            "Validation Until",
          ],
        ],
        body: tableRows,
        theme: "striped",
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] },
        styles: { fontSize: 8.5 },
      });

      // Footer
      const finalY = (doc as any).lastAutoTable.finalY || 100;
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        "© Mi Advantage Rwanda • Official Customer Directory",
        14,
        finalY + 15,
      );

      // Trigger download
      doc.save(`mi-advantage-customer-directory.pdf`);
    } catch (err) {
      console.error(err);
      alert("Error generating Customer Directory PDF file.");
    }
  };

  // Bulk customer actions (super admin only)
  const handleSelectCustomer = (id: string) => {
    setSelectedCustomers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllCustomers = () => {
    const filtered = getFilteredCustomers();
    if (selectedCustomers.size === filtered.length) {
      setSelectedCustomers(new Set());
    } else {
      setSelectedCustomers(new Set(filtered.map((c) => c.id)));
    }
  };

  const handleBulkActivate = async () => {
    if (selectedCustomers.size === 0) return;
    const newDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    for (const id of selectedCustomers) {
      await db.updateCustomer(id, {
        valid_until: newDate,
        card_status: "active",
      });
    }
    setSelectedCustomers(new Set());
    await loadData();
  };

  const handleBulkDeactivate = async () => {
    if (selectedCustomers.size === 0) return;
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    for (const id of selectedCustomers) {
      await db.updateCustomer(id, {
        valid_until: yesterday,
        card_status: "renew",
      });
    }
    setSelectedCustomers(new Set());
    await loadData();
  };

  const handleBulkDelete = async () => {
    if (selectedCustomers.size === 0) return;
    if (!confirm(`Delete ${selectedCustomers.size} selected customers?`)) return;
    for (const id of selectedCustomers) {
      await db.deleteCustomer(id);
    }
    setSelectedCustomers(new Set());
    await loadData();
  };

  const getCardStatusBadge = (c: Customer) => {
    const cardStatus = getCustomerCardStatus(c);

    if (cardStatus === "suspended") {
      return (
        <span className="bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 text-[9px] font-bold px-2 py-0.5 rounded-full border border-red-200 dark:border-red-900">
          SUSPENDED
        </span>
      );
    }

    if (cardStatus === "active") {
      return (
        <span className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900">
          ACTIVE
        </span>
      );
    }

    // Card expiration date/time reached → subscription must be renewed.
    const expiryDate = new Date(c.valid_until as string);
    const dropDate = new Date(expiryDate);
    dropDate.setMonth(dropDate.getMonth() + 2);
    const today = new Date();
    const diffTime = dropDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const daysLeftStr =
      diffDays > 0 ? `${diffDays}d left before drop` : "Purging today";

    return (
      <span
        className="bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-[9px] font-bold px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-900"
        title={`Card disabled on expiration (${c.valid_until}) — renew subscription. ${daysLeftStr}`}
      >
        RENEW SUBSCRIPTION
      </span>
    );
  };

  // --- ANALYTICS AGGREGATION & DATA PREPARATION ---

  // 1. Total All-time sales
  const allTimeSalesAmount = sales.reduce((acc, s) => acc + s.final_amount, 0);
  const allTimeDiscounts = sales.reduce(
    (acc, s) => acc + s.discount_applied,
    0,
  );
  const allTimeGrossSales = sales.reduce(
    (acc, s) => acc + s.amount_before_discount,
    0,
  );

  // 2. Ranking of best performing shops (revenue)
  const getShopRanking = () => {
    const shopRevenueMap: {
      [id: string]: {
        name: string;
        sales: number;
        earnings: number;
        discount: number;
      };
    } = {};

    // Seed shops
    shops.forEach((s) => {
      shopRevenueMap[s.id] = {
        name: s.shop_name,
        sales: 0,
        earnings: 0,
        discount: 0,
      };
    });

    sales.forEach((sale) => {
      if (shopRevenueMap[sale.shop_id]) {
        shopRevenueMap[sale.shop_id].sales += 1;
        shopRevenueMap[sale.shop_id].earnings += sale.final_amount;
        shopRevenueMap[sale.shop_id].discount += sale.discount_applied;
      } else {
        // dynamic addition if shop was deleted but sale remains
        shopRevenueMap[sale.shop_id] = {
          name: sale.shop_name,
          sales: 1,
          earnings: sale.final_amount,
          discount: sale.discount_applied,
        };
      }
    });

    return Object.values(shopRevenueMap).sort(
      (a, b) => b.earnings - a.earnings,
    );
  };

  const shopLeaderboard = getShopRanking();

  // 3. Monthly Shop Sales
  const getMonthlySalesData = () => {
    // Let's group sales per shop
    const data: { name: string; revenue: number; discount: number }[] = [];
    shops.forEach((sh) => {
      const shopSales = sales.filter((s) => s.shop_id === sh.id);
      const totalEarned = shopSales.reduce(
        (acc, curr) => acc + curr.final_amount,
        0,
      );
      const totalDiscount = shopSales.reduce(
        (acc, curr) => acc + curr.discount_applied,
        0,
      );
      data.push({
        name: sh.shop_name,
        revenue: totalEarned,
        discount: totalDiscount,
      });
    });
    return data;
  };

  const monthlySalesChartData = getMonthlySalesData();

  // 4. Daily Performance / System-wide Line Chart
  const getSystemDailyData = () => {
    const map: {
      [date: string]: {
        date: string;
        systemRevenue: number;
        systemDiscount: number;
      };
    } = {};

    // Seed last 10 days
    for (let i = 9; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const str = d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
      map[str] = { date: str, systemRevenue: 0, systemDiscount: 0 };
    }

    sales.forEach((s) => {
      const str = new Date(s.created_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
      if (map[str]) {
        map[str].systemRevenue += s.final_amount;
        map[str].systemDiscount += s.discount_applied;
      }
    });

    return Object.values(map);
  };

  const systemDailyData = getSystemDailyData();

  // 5. Shop comparison pie chart (distribution of revenue shares)
  const getPieData = () => {
    return shopLeaderboard
      .filter((item) => item.earnings > 0)
      .map((item) => ({
        name: item.name,
        value: item.earnings,
      }));
  };

  const pieChartData = getPieData();

  // 6. Histogram of sales (Distribution of transaction price ranges)
  const getSalesHistogram = () => {
    const histogram = [
      { range: "0-10k RWF", count: 0 },
      { range: "10k-50k RWF", count: 0 },
      { range: "50k-100k RWF", count: 0 },
      { range: "100k+ RWF", count: 0 },
    ];

    sales.forEach((s) => {
      const amt = s.amount_before_discount;
      if (amt <= 10000) {
        histogram[0].count += 1;
      } else if (amt <= 50000) {
        histogram[1].count += 1;
      } else if (amt <= 100000) {
        histogram[2].count += 1;
      } else {
        histogram[3].count += 1;
      }
    });

    return histogram;
  };

  const histogramData = getSalesHistogram();

  // Current logged in administrator role for super-admin gating
  const activeAdminRole = db.currentUser?.admin_role || "admin";
  const isSuperAdmin = activeAdminRole === "super_admin";
  const pendingShops = shops.filter((s) => s.status === "pending");

  const tabs = (
    [
      { id: "analytics", label: "Analytics", icon: BarChart3 },
      { id: "shops", label: "Partners", icon: Store },
      { id: "qrs", label: "QR Cards", icon: QrCode },
      { id: "referrers", label: "Referrers", icon: Users },
      { id: "reports", label: "Reports PDF", icon: FileText },
      { id: "customization", label: "Branding", icon: Palette },
      { id: "admins", label: "Admins", icon: Shield },
      { id: "audits", label: "Audit Logs", icon: History },
    ] as const
  ).filter((t) => t.id !== "admins" || isSuperAdmin);

  // Main menu + grouped Settings menu (Branding, Admins, Database, Audit Logs)
  const mainTabs = tabs.filter(
    (t) => !["customization", "admins", "audits"].includes(t.id),
  );
  const settingsTabs = tabs.filter((t) =>
    ["customization", "admins", "audits"].includes(t.id),
  );

  const tabRoutes: Record<string, string> = {
    analytics: "/dashboard",
    shops: "/partners",
    qrs: "/customers",
    referrers: "/referrers",
    reports: "/reports",
    customization: "/customize",
    admins: "/admins",
    audits: "/logs",
  };

  // Sidebar UI state: collapse/expand (desktop icon rail) + mobile drawer
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Settings submenu (Branding, Admins, Database, Audit Logs) — open by
  // default when landing directly on one of its pages.
  const [settingsOpen, setSettingsOpen] = useState(
    ["customization", "admins", "audits"].includes(getInitialTab()),
  );
  // Shop guest-scan QR modal
  const [qrModalShop, setQrModalShop] = useState<Shop | null>(null);
  // Create/edit modals (full CRUD): lists stay on screen, forms open on demand
  const [shopModalOpen, setShopModalOpen] = useState(false);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  // List-level feedback (modals close on success, so confirmation lives here)
  const [shopListMsg, setShopListMsg] = useState("");
  const [cardListMsg, setCardListMsg] = useState("");

  const flashShopListMsg = (msg: string) => {
    setShopListMsg(msg);
    setTimeout(() => setShopListMsg(""), 5000);
  };
  const flashCardListMsg = (msg: string) => {
    setCardListMsg(msg);
    setTimeout(() => setCardListMsg(""), 5000);
  };
  // Bulk QR repair + common self-registration QR (posted at counters)
  const [shopQrFixMsg, setShopQrFixMsg] = useState("");
  const [fixingShopQrs, setFixingShopQrs] = useState(false);
  const [joinQrOpen, setJoinQrOpen] = useState(false);
  const [joinCopied, setJoinCopied] = useState(false);
  const [joinMsg, setJoinMsg] = useState("");

  // Give every shop missing a guest-scan QR a valid unique one.
  const handleEnsureShopQRs = async () => {
    setShopQrFixMsg("Checking every shop for a valid guest-scan QR...");
    setFixingShopQrs(true);
    try {
      const { fixed, error } = await db.ensureAllShopQRCodes();
      if (error) {
        setShopQrFixMsg(error);
      } else {
        setShopQrFixMsg(
          fixed === 0
            ? "All shops already have a valid QR code."
            : `Fixed ${fixed} shop${fixed === 1 ? "" : "s"} — every shop now has a valid guest-scan QR.`,
        );
      }
      await loadData();
    } finally {
      setFixingShopQrs(false);
    }
  };

  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}#/join`
      : "";

  const handleDownloadJoinQR = () => {
    const canvas = document.getElementById("join-qr-canvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "mi-advantage-join-qr.png";
    link.click();
  };

  const handleCopyJoinLink = async () => {
    setJoinMsg("");
    try {
      await navigator.clipboard.writeText(joinUrl);
      setJoinCopied(true);
      setTimeout(() => setJoinCopied(false), 2500);
    } catch {
      setJoinMsg("Copy failed — copy the link shown above.");
    }
  };

  const handleTabClick = (tabId: string) => {
    const route = tabRoutes[tabId] || "/dashboard";
    navigate(route);
    setActiveTab(tabId as typeof activeTab);
    if (["customization", "admins", "audits"].includes(tabId)) {
      setSettingsOpen(true);
    }
    setMobileNavOpen(false);
  };

  const settingsActive = ["customization", "admins", "audits"].includes(activeTab);

  const handleSettingsToggle = () => {
    if (sidebarCollapsed) {
      // From the icon rail, expand first so the submenu is visible.
      setSidebarCollapsed(false);
      setSettingsOpen(true);
      return;
    }
    setSettingsOpen((v) => !v);
  };

  // Main tabs + grouped Settings submenu (shared by sidebar and drawer).
  const renderNavItems = (collapsed: boolean) => (
    <>
      {mainTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            title={tab.label}
            className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center gap-2.5 transition-all cursor-pointer min-h-[40px] ${collapsed ? "justify-center" : ""} ${
              isActive
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100"
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="whitespace-nowrap">{tab.label}</span>}
          </button>
        );
      })}
      {/* Settings group */}
      <button
        onClick={handleSettingsToggle}
        title="Settings"
        className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center gap-2.5 transition-all cursor-pointer min-h-[40px] ${collapsed ? "justify-center" : ""} ${
          settingsActive
            ? "bg-emerald-600 text-white shadow-sm"
            : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100"
        }`}
      >
        <Settings className="w-4 h-4 shrink-0" />
        {!collapsed && <span className="whitespace-nowrap flex-1 text-left">Settings</span>}
        {!collapsed && (
          <ChevronRight
            className={`w-3.5 h-3.5 shrink-0 transition-transform ${settingsOpen ? "rotate-90" : ""}`}
          />
        )}
      </button>
      {settingsOpen && !collapsed &&
        settingsTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              title={tab.label}
              className={`w-full pl-3 pr-3 py-2 ml-4 rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center gap-2.5 transition-all cursor-pointer border-l-2 ${
                isActive
                  ? "bg-emerald-600 text-white shadow-sm border-emerald-600"
                  : "text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100"
              }`}
              style={{ width: "calc(100% - 1rem)" }}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
    </>
  );

  return (
    <div
      className="min-h-screen bg-slate-50/60 dark:bg-slate-950 text-slate-800 dark:text-slate-100 lg:flex"
      id="admin-dashboard-root"
    >
      {/* MOBILE TOP BAR */}
      <div className="lg:hidden sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setMobileNavOpen(true)}
          className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200 cursor-pointer"
          title="Open menu"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        {customization?.logo_url ? (
          <img src={customization.logo_url} alt="Company Logo" className="h-8 w-auto object-contain" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">MA</div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{customization?.title || "Mi Advantage"}</h1>
        </div>
        <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900 rounded-full text-[10px] font-bold uppercase">Live</span>
        <ThemeToggle variant="sidebar" />
      </div>

      {/* MOBILE DRAWER */}
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileNavOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-white dark:bg-slate-900 shadow-2xl flex flex-col">
            <div className="flex items-center gap-3 p-4 border-b border-slate-100 dark:border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">MA</div>
              <div className="flex-1 min-w-0">
                <h1 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{customization?.title || "Mi Advantage"}</h1>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{currentAdminRole === 'super_admin' ? 'Super Administrator' : 'Administrator'}</p>
              </div>
              <button
                onClick={() => setMobileNavOpen(false)}
                className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 cursor-pointer"
                title="Close menu"
                aria-label="Close navigation menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {renderNavItems(false)}
            </nav>
            <div className="p-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={onLogout}
                className="w-full px-3 py-2.5 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl text-xs font-semibold border border-red-200 dark:border-red-900 cursor-pointer flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIDE NAV BAR — collapsible, full viewport height, scrollable nav */}
      <aside className={`hidden lg:flex lg:sticky lg:top-0 lg:h-screen lg:shrink-0 bg-white dark:bg-slate-900 lg:border-r border-slate-200 dark:border-slate-800 shadow-sm flex-col transition-all duration-300 ${sidebarCollapsed ? "lg:w-20" : "lg:w-64"}`}>
        {/* LOGO & TITLE + COLLAPSE BUTTON */}
        <div className={`flex items-center gap-3 p-4 border-b border-slate-100 dark:border-slate-800 ${sidebarCollapsed ? "flex-col" : ""}`}>
          {customization?.logo_url && !sidebarCollapsed ? (
            <img src={customization.logo_url} alt="Company Logo" className="h-10 w-auto object-contain" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">MA</div>
          )}
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{customization?.title || "Mi Advantage"}</h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{currentAdminRole === 'super_admin' ? 'Super Administrator' : 'Administrator'}</p>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 cursor-pointer shrink-0"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
        {!sidebarCollapsed && (
          <div className="px-4 pt-3">
            <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900 rounded-full text-[10px] font-bold uppercase">Live</span>
          </div>
        )}

        {/* NAV LINKS — vertical, scrollable, full height */}
        <nav className="flex flex-col gap-1.5 p-3 overflow-y-auto flex-1 min-h-0">
          {renderNavItems(sidebarCollapsed)}
        </nav>

        {/* LOGOUT — pinned to sidebar bottom */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800">
          <div className={`flex items-center gap-2 ${sidebarCollapsed ? "flex-col" : ""}`}>
            <div className={sidebarCollapsed ? "" : "shrink-0"}>
              <ThemeToggle variant="sidebar" title="Toggle dark theme" />
            </div>
            <button
              onClick={onLogout}
              title="Logout"
              className={`flex-1 px-3 py-2.5 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl text-xs font-semibold border border-red-200 dark:border-red-900 cursor-pointer whitespace-nowrap flex items-center gap-2 justify-center`}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 min-w-0">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* RENDER ACTIVE TAB BODY */}
          <div id="admin-tab-body" className="transition-all duration-300">
        {/* --- TAB: PARTNER SHOPS MANAGEMENT --- */}
        {activeTab === "shops" && (
          <div
            className="grid grid-cols-1 gap-8"
            id="admin-shops-management"
          >
            {/* Pending shop approvals (visible to all admins) */}
            {pendingShops.length > 0 && (
              <div className="lg:col-span-12 bg-amber-50/60 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 rounded-2xl p-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                      <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      Shop Applications Awaiting Approval
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {pendingShops.length} self-registered shop
                      {pendingShops.length > 1 ? "s" : ""} submitted business
                      documents for review. Approve to grant access or reject
                      the application.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingShops.map((shop) => (
                    <div
                      key={shop.id}
                      className="p-4 border border-amber-200 dark:border-amber-900 bg-white dark:bg-slate-900 rounded-2xl flex flex-col gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-900 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                          <Store className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                            {shop.shop_name}
                          </h4>
                          <span className="text-[10px] text-slate-400 block truncate font-semibold">
                            {shop.email}
                          </span>
                          <span className="inline-block mt-1 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                            {shop.discount_percent}% Disc • Pending
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 dark:border-slate-800 pt-3">
                        {shop.contract && (
                          <a
                            href={shop.contract}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                            title="View uploaded contract document"
                          >
                            <FileText className="w-3.5 h-3.5" /> Contract
                          </a>
                        )}
                        {shop.rdb_certificate && (
                          <a
                            href={shop.rdb_certificate}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                            title="View uploaded RDB business registration certificate"
                          >
                            <FileText className="w-3.5 h-3.5" /> RDB Certificate
                          </a>
                        )}
                        {!shop.contract && (
                          <span className="text-[10px] text-red-500 font-semibold uppercase tracking-wider">
                            No contract
                          </span>
                        )}
                        {!shop.rdb_certificate && (
                          <span className="text-[10px] text-red-500 font-semibold uppercase tracking-wider">
                            No RDB
                          </span>
                        )}
                      </div>

                <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveShop(shop.id)}
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                        >
                          Approve Shop
                        </button>
                        <button
                          onClick={() => handleRejectShop(shop.id)}
                          className="flex-1 py-2 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                        >
                          Reject Application
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Shop create/edit modal — Add New Partner creates, row Edit updates */}
            {shopModalOpen && (
            <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
                <button onClick={() => resetShopForm()} aria-label="Close" title="Close" className="absolute top-4 right-4 p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1 uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span>
                  {isEditingShop
                    ? "Edit Partner Shop"
                    : "Register New Partner Shop"}
                </span>
              </h3>

              <form onSubmit={handleSaveShop} className="space-y-4 mt-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">
                    Shop/Outlet Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Simba Supermarket"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">
                    Standard Discount %
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="99"
                    placeholder="e.g. 15 (stands for 15%)"
                    value={shopDiscount}
                    onChange={(e) =>
                      setShopDiscount(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">
                    Shop Email (Login ID)
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. simba@shop.com"
                    value={shopEmail}
                    onChange={(e) => setShopEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">
                    Business Description (Join-page carousel)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Family supermarket in Kacyiru — fresh groceries, bakery and household goods."
                    value={shopDescription}
                    onChange={(e) => setShopDescription(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-semibold resize-y"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">
                      Business Type
                    </label>
                    <select
                      value={shopBusinessType}
                      onChange={(e) => setShopBusinessType(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-semibold"
                    >
                      {BUSINESS_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {BUSINESS_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">
                      Discount Applies To
                    </label>
                    <select
                      value={shopDiscountScope}
                      onChange={(e) => setShopDiscountScope(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-semibold"
                    >
                      {DISCOUNT_SCOPES.map((s) => (
                        <option key={s} value={s}>
                          {DISCOUNT_SCOPE_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">
                    Shop Password{" "}
                    {isEditingShop && "(Leave blank to keep same)"}
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    required={!isEditingShop}
                    placeholder="Password for shop login"
                    value={shopPassword}
                    onChange={(e) => setShopPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-semibold"
                  />
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                  >
                    {isEditingShop ? "Save Changes" : "Register Shop"}
                  </button>
                  {isEditingShop && (
                    <button
                      type="button"
                      onClick={resetShopForm}
                      className="px-4 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold uppercase tracking-wide transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {shopMsg && (
                  <p className="text-xs text-center font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 p-2.5 rounded-xl border border-red-100 dark:border-red-900">
                    {shopMsg}
                  </p>
                )}
              </form>
              </div>
            </div>
            )}

            {/* List of registered shops (7 cols) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm p-6">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                  Shop Registry Overview
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      resetShopForm();
                      setShopModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[11px] font-bold uppercase tracking-wider cursor-pointer inline-flex items-center gap-1.5"
                    title="Open the form to add a new partner shop"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add New Partner</span>
                  </button>
                  <button
                    onClick={handleEnsureShopQRs}
                    disabled={fixingShopQrs}
                    className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-[11px] font-bold uppercase tracking-wider cursor-pointer disabled:opacity-60"
                    title="Give every shop missing a QR a valid guest-scan code"
                  >
                    {fixingShopQrs ? "Checking..." : "Ensure shop QRs"}
                  </button>
                  <button
                    onClick={() => setJoinQrOpen(true)}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[11px] font-bold uppercase tracking-wider cursor-pointer inline-flex items-center gap-1.5"
                    title="Common QR to post at counters for customer self-registration"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Self-Registration QR</span>
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                View and moderate all active partner outlets registered inside
                Kigali.
              </p>
              {shopListMsg && (
                <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900 mb-4">
                  {shopListMsg}
                </p>
              )}
              {shopQrFixMsg && (
                <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900 mb-4">
                  {shopQrFixMsg}
                </p>
              )}

               <div className="overflow-x-auto">
                 <table className="w-full text-xs border-collapse">
                   <thead>
                     <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                       <th className="p-3 text-left">Shop Name</th>
                       <th className="p-3 text-left">Email</th>
                       <th className="p-3 text-left">Discount</th>
                       <th className="p-3 text-left">Shop QR</th>
                       <th className="p-3 text-left">Status</th>
                       <th className="p-3 text-left">Documents</th>
                       <th className="p-3 text-right">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200 font-semibold">
                      {shops.filter((s) => s.status !== "pending").length === 0 ? (
                        <tr><td colSpan={7} className="p-8 text-center text-slate-400">No shops registered yet.</td></tr>
                      ) : shops.filter((s) => s.status !== "pending").map((shop) => (
                       <tr key={shop.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                         <td className="p-3 font-bold text-slate-800 dark:text-slate-100">{shop.shop_name}</td>
                         <td className="p-3 text-slate-600 dark:text-slate-300">{shop.email}</td>
                         <td className="p-3"><span className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900 px-2 py-0.5 rounded-full text-[10px] font-bold">{shop.discount_percent}%</span></td>
                         <td className="p-3">
                            {shop.qr_code ? (
                              <button
                                onClick={() => { setQrModalShop(shop); }}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-lg text-[10px] font-bold font-mono cursor-pointer"
                                title="View guest-scan QR code"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                                {shop.qr_code}
                              </button>
                            ) : (
                              <span
                                className="inline-block px-2 py-1 text-slate-300 dark:text-slate-600 text-[10px] font-bold"
                                title="No code yet — use Ensure shop QRs above to issue one"
                              >
                                —
                              </span>
                            )}
                         </td>
                         <td className="p-3">
                           <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${shop.status === "approved" ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300" : shop.status === "pending" ? "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300" : "bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400"}`}>
                             {shop.status || "approved"}
                           </span>
                         </td>
                         <td className="p-3">
                           <div className="flex gap-1">
                             {shop.contract && <a href={shop.contract} target="_blank" className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-[10px] font-semibold text-slate-700 dark:text-slate-200">Contract</a>}
                             {shop.rdb_certificate && <a href={shop.rdb_certificate} target="_blank" className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-[10px] font-semibold text-slate-700 dark:text-slate-200">RDB</a>}
                           </div>
                         </td>
                         <td className="p-3 text-right">
                           <div className="flex items-center justify-end gap-1.5">
                             {shop.status === "pending" && (
                               <>
                                 <button onClick={() => handleApproveShop(shop.id)} className="p-1.5 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded text-emerald-700 dark:text-emerald-300" title="Approve"><CheckCircle2 className="w-3.5 h-3.5" /></button>
                                 <button onClick={() => handleRejectShop(shop.id)} className="p-1.5 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/40 rounded text-red-600 dark:text-red-400" title="Reject"><XCircle className="w-3.5 h-3.5" /></button>
                               </>
                             )}
                             <button onClick={() => handleEditShopClick(shop)} className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300" title="Edit"><Edit className="w-3.5 h-3.5" /></button>
                             <button onClick={() => handleDeleteShopClick(shop.id)} className="p-1.5 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/40 rounded text-red-600 dark:text-red-400" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                           </div>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>
          </div>
        )}

        {/* --- TAB: ANALYTICS (PRIMARY DASHBOARD VIEW) --- */}
        {activeTab === "analytics" && (
          <div className="space-y-6" id="admin-analytics-dashboard">

            {/* REAL-TIME KPI SUMMARY CARDS */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg"><DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /></div>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase tracking-wider font-semibold">Revenue</span>
                <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{allTimeSalesAmount.toLocaleString()} RWF</span>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-blue-50 dark:bg-blue-950/50 rounded-lg"><Tag className="w-4 h-4 text-blue-600 dark:text-blue-400" /></div>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase tracking-wider font-semibold">Discounts</span>
                <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{allTimeDiscounts.toLocaleString()} RWF</span>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-purple-50 dark:bg-purple-950/50 rounded-lg"><ShoppingBag className="w-4 h-4 text-purple-600 dark:text-purple-400" /></div>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase tracking-wider font-semibold">Gross Sales</span>
                <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{allTimeGrossSales.toLocaleString()} RWF</span>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-amber-50 dark:bg-amber-950/50 rounded-lg"><Users className="w-4 h-4 text-amber-600 dark:text-amber-400" /></div>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase tracking-wider font-semibold">Customers</span>
                <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{customers.length} Members</span>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-teal-50 dark:bg-teal-950/50 rounded-lg"><Store className="w-4 h-4 text-teal-600 dark:text-teal-400" /></div>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase tracking-wider font-semibold">Partners</span>
                <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{shops.length} Active</span>
              </div>
            </div>

            {/* INTERACTIVE CHARTS ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>System Performance (Past 10 Days)</span>
                </h3>
                <div className="h-64 w-full text-xs font-semibold">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={systemDailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: "#fff", borderColor: "#e2e8f0", borderRadius: "12px", color: "#1e293b" }} itemStyle={{ color: "#059669" }} labelStyle={{ fontWeight: "bold", color: "#1e293b" }} formatter={(v) => [`${Number(v).toLocaleString()} RWF`, "Amount"]} />
                      <Legend wrapperStyle={{ paddingTop: "10px" }} />
                      <Line type="monotone" dataKey="systemRevenue" stroke="#059669" strokeWidth={3} name="Total Sales" dot={{ r: 4, stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="systemDiscount" stroke="#8b5cf6" strokeWidth={2} name="Total Discount" dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Store className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Revenue per Shop Outlet</span>
                </h3>
                <div className="h-64 w-full text-xs font-semibold">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlySalesChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: "#fff", borderColor: "#e2e8f0", borderRadius: "12px", color: "#1e293b" }} itemStyle={{ color: "#059669" }} labelStyle={{ fontWeight: "bold", color: "#1e293b" }} formatter={(v) => [`${Number(v).toLocaleString()} RWF`, "Amount"]} />
                      <Legend wrapperStyle={{ paddingTop: "10px" }} />
                      <Bar dataKey="revenue" fill="#059669" radius={[4, 4, 0, 0]} name="Net Revenue" />
                      <Bar dataKey="discount" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Discounts Given" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* MIDDLE ROW: Market Share + Histogram + Leaderboard */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-4">Market Share</h3>
                <div className="h-56 w-full text-[10px] flex items-center justify-center">
                  {pieChartData.length === 0 ? (
                    <div className="text-slate-400 font-semibold text-xs">No transaction history.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                          {pieChartData.map((entry, index) => (<Cell key={index} fill={COLORS[index % COLORS.length]} />))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2.5 justify-center max-h-24 overflow-y-auto pr-1">
                  {pieChartData.map((item, index) => (
                    <div key={item.name} className="flex items-center gap-1.5 text-[10px] text-slate-600 dark:text-slate-300 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="truncate max-w-[80px]">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-4">Price Range Distribution</h3>
                <div className="h-64 w-full text-xs font-semibold">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={histogramData} margin={{ left: -25 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="range" stroke="#64748b" fontSize={9} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: "#fff", borderColor: "#e2e8f0", borderRadius: "12px", color: "#1e293b" }} />
                      <Bar dataKey="count" fill="#3b82f6" name="Transactions Count" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-3">Top Performing Shops</h3>
                <div className="space-y-3.5 max-h-[280px] overflow-y-auto pr-1">
                  {shopLeaderboard.length === 0 ? (
                    <div className="text-slate-400 font-semibold text-xs py-8 text-center">No sales data yet.</div>
                  ) : shopLeaderboard.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between gap-3 text-xs border-b border-slate-100 dark:border-slate-800 pb-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={"w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 " + (index === 0 ? "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900" : index === 1 ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800" : index === 2 ? "bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800")}>{index + 1}</span>
                        <span className="font-bold text-slate-800 dark:text-slate-100 truncate block">{item.name}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-slate-800 dark:text-slate-100 block">{item.earnings.toLocaleString()} RWF</span>
                        <span className="text-[9px] text-slate-400 block font-semibold">{item.sales} scans</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB: QR CODE CUSTOMER CARDS PANEL --- */}
        {activeTab === "qrs" && (
          <div
            className="grid grid-cols-1 gap-8"
            id="admin-qr-management"
          >
            {/* Member card create/edit modal — Register New Card creates, row Edit updates */}
            {cardModalOpen && (
            <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
                <button onClick={() => resetCustomerForm()} aria-label="Close" title="Close" className="absolute top-4 right-4 p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2 uppercase tracking-wider">
                <QrCode className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span>
                  {isEditingCustomer
                    ? "Update Member Card"
                    : "Issue Member QR Card"}
                </span>
              </h3>

              <form
                onSubmit={handleAdminGenerateCustomer}
                className="space-y-4 mt-4"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">
                    Customer Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Marie Claire Uwineza"
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-semibold"
                  />
                </div>

                                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +250 782 111 222"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">
                      Expiry Date
                    </label>
                    <input
                      type="date"
                      required
                      value={custValidUntil}
                      onChange={(e) => setCustValidUntil(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">
                      Expiry Time (Optional)
                    </label>
                    <input
                      type="time"
                      value={custValidTime}
                      onChange={(e) => setCustValidTime(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">
                    Referee ID <span className="text-slate-400 normal-case">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CUST-9821 (referrer's card code)"
                    value={custReferee}
                    onChange={(e) => setCustReferee(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-semibold"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Enter the referrer&apos;s CARD ID so they earn reward credits.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                  >
                    {isEditingCustomer ? "Update Card" : "Save & Compile Card"}
                  </button>
                  {isEditingCustomer && (
                    <button
                      type="button"
                      onClick={resetCustomerForm}
                      className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {custMsg && (
                  <p className="text-xs text-center font-bold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 p-2.5 rounded-xl border border-red-100 dark:border-red-900">
                    {custMsg}
                  </p>
                )}
              </form>
              </div>
            </div>
            )}

            {/* Visual list of issued QR Cards */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1 uppercase tracking-wider">
                    Active Customer Database
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    View issued QR credentials. Auto-fills fields instantly
                    during scan events.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      resetCustomerForm();
                      setCardModalOpen(true);
                    }}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Register New Card</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportCustomersPDF}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Download Directory PDF</span>
                  </button>
                </div>
              </div>

              {cardListMsg && (
                <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900">
                  {cardListMsg}
                </p>
              )}

              {/* SEARCH BAR & FILTERING DROP-DOWNS */}
              <div className="space-y-3 mb-4 bg-slate-50 dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                {/* Search input */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search name, email, phone or CUST ID..."
                    value={custSearchTerm}
                    onChange={(e) => setCustSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Date Filter & Sort By controls */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Card Status
                    </label>
                    <select
                      value={custFilterStatus}
                      onChange={(e) =>
                        setCustFilterStatus(e.target.value as any)
                      }
                      className="w-full px-2 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="all">All Members</option>
                      <option value="active">Active Only</option>
                      <option value="expired">Renew Subscription (Expired)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Sorting Order
                    </label>
                    <select
                      value={custSortBy}
                      onChange={(e) => setCustSortBy(e.target.value as any)}
                      className="w-full px-2 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="name_asc">Name (A-Z)</option>
                      <option value="name_desc">Name (Z-A)</option>
                      <option value="code_asc">CUST ID Code</option>
                      <option value="expiry_soon">Soonest Expiration</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* RESULTS METRICS */}
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">
                <span>Database Matches</span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  {getFilteredCustomers().length} of {customers.length} Members
                </span>
              </div>

               {/* BULK ACTIONS (Super Admin Only) */}
               {currentAdminRole === "super_admin" && getFilteredCustomers().length > 0 && (
                 <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                   <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
                     <input
                       type="checkbox"
                       checked={selectedCustomers.size === getFilteredCustomers().length && getFilteredCustomers().length > 0}
                       onChange={handleSelectAllCustomers}
                       className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 focus:ring-emerald-500"
                     />
                     Select All
                   </label>
                   {selectedCustomers.size > 0 && (
                     <>
                       <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{selectedCustomers.size} selected</span>
                       <button onClick={handleBulkActivate} className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-[10px] font-bold cursor-pointer">Activate</button>
                       <button onClick={handleBulkDeactivate} className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900 rounded-lg text-[10px] font-bold cursor-pointer">Deactivate</button>
                       <button onClick={handleBulkDelete} className="px-3 py-1.5 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-lg text-[10px] font-bold cursor-pointer">Delete</button>
                     </>
                   )}
                 </div>
               )}

                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                        {currentAdminRole === "super_admin" && (
                          <th className="p-3 text-left w-8">
                            <input
                              type="checkbox"
                              checked={selectedCustomers.size === getFilteredCustomers().length && getFilteredCustomers().length > 0}
                              onChange={handleSelectAllCustomers}
                              className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 focus:ring-emerald-500"
                            />
                          </th>
                        )}
                        <th className="p-3 text-left">QR Code</th>
                        <th className="p-3 text-left">Customer Name</th>
                        <th className="p-3 text-left">Email</th>
                        <th className="p-3 text-left">Phone</th>
                        <th className="p-3 text-left">Valid Until</th>
                       <th className="p-3 text-left">Referee</th>
                       <th className="p-3 text-left">Status</th>
                       <th className="p-3 text-right">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200 font-semibold">
                      {getFilteredCustomers().length === 0 ? (
                        <tr><td colSpan={currentAdminRole === "super_admin" ? 9 : 8} className="p-8 text-center text-slate-400">No matching members found.</td></tr>
                      ) : getFilteredCustomers().map((c) => (
                       <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                         {currentAdminRole === "super_admin" && (
                           <td className="p-3"><input type="checkbox" checked={selectedCustomers.has(c.id)} onChange={() => handleSelectCustomer(c.id)} className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 focus:ring-emerald-500" /></td>
                         )}
                         <td className="p-3">
                           <div className="bg-white dark:bg-slate-900 p-0.5 border border-slate-200 dark:border-slate-800 rounded inline-block">
                             <img src={`https://api.qrserver.com/v1/create-qr-code/?size=40x40&data=${c.qr_code}&margin=1`} alt="qr" className="w-8 h-8" referrerPolicy="no-referrer" />
                           </div>
                           <span className="ml-2 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">{c.qr_code}</span>
                         </td>
                          <td className="p-3 font-bold text-slate-800 dark:text-slate-100">{c.name}</td>
                           <td className="p-3 text-slate-600 dark:text-slate-300">{c.email || "—"}</td>
                          <td className="p-3 text-slate-600 dark:text-slate-300">{c.phone}</td>
                          <td className="p-3 text-slate-600 dark:text-slate-300">{c.valid_until ? c.valid_until.replace("T", " ") : "N/A"}</td>
                         <td className="p-3">
                           {c.referee_number ? (
                             <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider" title="Referrer CARD ID">
                               <Users className="w-3 h-3" /> {c.referee_number}
                             </span>
                           ) : (
                             <span className="text-slate-300 text-[10px]">—</span>
                           )}
                         </td>
                         <td className="p-3">{getCardStatusBadge(c)}</td>
                         <td className="p-3 text-right">
                           <div className="flex items-center justify-end gap-1.5">
                             <button onClick={() => handleEditCustomerClick(c)} className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300" title="Edit"><Edit className="w-3.5 h-3.5" /></button>
                             <button onClick={() => setSelectedCardCustomer(c)} className="p-1.5 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded text-emerald-700 dark:text-emerald-300" title="Download Card"><Download className="w-3.5 h-3.5" /></button>
                             {c.referee_number && (
                               <button onClick={() => handleRemoveRefereeClick(c)} className="p-1.5 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded text-amber-600 dark:text-amber-400" title={`Remove referee ${c.referee_number}`}><UserMinus className="w-3.5 h-3.5" /></button>
                             )}
                             <button onClick={() => handleDeleteCustomerClick(c.id)} className="p-1.5 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/40 rounded text-red-600 dark:text-red-400" title="Delete"><Trash className="w-3.5 h-3.5" /></button>
                           </div>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>
          </div>
        )}

        {/* --- TAB: REFERRERS & REWARDS --- */}
        {activeTab === "referrers" && (() => {
          const refMap = new Map<string, Customer[]>();
          customers.forEach((c) => {
            const refCode = (c.referee_number || "").trim().toUpperCase();
            if (refCode) {
              const arr = refMap.get(refCode) || [];
              arr.push(c);
              refMap.set(refCode, arr);
            }
          });
          const lookupReferee = (code: string) =>
            customers.find(
              (c) => c.qr_code.toUpperCase() === code.toUpperCase(),
            );
          const referrers = Array.from(refMap.entries()).sort(
            (a, b) => b[1].length - a[1].length,
          );
          const creditFeatureReady =
            customers.length === 0 ||
            customers.some((c) => "credit_status" in c);

          const countStatus = (arr: Customer[], s: string) =>
            arr.filter((m) => (m.credit_status || "pending") === s).length;

          const totalEarned = referrers.reduce(
            (acc, [, arr]) => acc + arr.length,
            0,
          );
          const totalApproved = referrers.reduce(
            (acc, [, arr]) => acc + countStatus(arr, "approved"),
            0,
          );
          const totalPaid = referrers.reduce(
            (acc, [, arr]) => acc + countStatus(arr, "paid"),
            0,
          );

          const getCreditBadge = (m: Customer) => {
            const s = m.credit_status || "pending";
            if (s === "approved")
              return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 text-[9px] font-bold uppercase tracking-wider">
                  Approved
                </span>
              );
            if (s === "paid")
              return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold uppercase tracking-wider">
                  Paid
                </span>
              );
            return (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[9px] font-bold uppercase tracking-wider">
                Pending
              </span>
            );
          };

          const handleApproveCredit = async (id: string) => {
            await db.setCustomerCreditStatus(id, "approved");
            await loadData();
          };
          const handlePayCredit = async (id: string) => {
            await db.setCustomerCreditStatus(id, "paid");
            await loadData();
          };
          const handleApproveAll = async (arr: Customer[]) => {
            for (const m of arr) {
              if ((m.credit_status || "pending") === "pending") {
                await db.setCustomerCreditStatus(m.id, "approved");
              }
            }
            await loadData();
          };
          const handlePayAllApproved = async (arr: Customer[]) => {
            if (
              !confirm(
                "Mark ALL approved credits for this referrer as PAID? This deducts them from the total credits earned. This action cannot be undone.",
              )
            )
              return;
            for (const m of arr) {
              if (m.credit_status === "approved") {
                await db.setCustomerCreditStatus(m.id, "paid");
              }
            }
            await loadData();
          };
          const handleRemoveReferral = async (m: Customer) => {
            if (
              !confirm(
                `Remove the referral record for ${m.name}? Their referee and credit will be cleared.`,
              )
            )
              return;
            await db.clearCustomerReferee(m.id);
            await loadData();
          };

          return (
            <div className="space-y-6" id="admin-referrers-panel">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 uppercase tracking-wider">
                      <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      Referrers, Credits &amp; Payments
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Every registered member that enters a referrer&apos;s CARD ID
                      earns that referrer{" "}
                      <span className="font-bold text-emerald-700 dark:text-emerald-300">1 reward credit</span>.
                      Validate credits to approve them, then mark credits as
                      <span className="font-bold text-slate-700 dark:text-slate-200"> PAID</span> when the
                      company pays the referrer — paid credits are deducted from
                      the total earned.
                    </p>
                  </div>
                </div>

                {!creditFeatureReady && (
                  <div className="mb-5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                    Referrer credit validation (approve / mark paid) requires
                    running <span className="font-mono">supabase-migration-v5.sql</span>{" "}
                    in your Supabase SQL Editor. Referral tracking still works.
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
                  <div className="bg-emerald-50/50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900 rounded-xl p-4">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 block">Active Referrers</span>
                    <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{referrers.length}</span>
                  </div>
                  <div className="bg-emerald-50/50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900 rounded-xl p-4">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 block">Total Earned</span>
                    <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{totalEarned}</span>
                  </div>
                  <div className="bg-blue-50/50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900 rounded-xl p-4">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 block">Approved (Payable)</span>
                    <span className="text-2xl font-bold text-blue-700 dark:text-blue-300">{totalApproved}</span>
                  </div>
                  <div className="bg-emerald-50/50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900 rounded-xl p-4">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 block">Paid (Deducted)</span>
                    <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{totalPaid}</span>
                  </div>
                  <div className="bg-amber-50/50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-900 rounded-xl p-4">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 block">Outstanding</span>
                    <span className="text-2xl font-bold text-amber-700 dark:text-amber-300">{Math.max(0, totalApproved - totalPaid)}</span>
                  </div>
                </div>

                {referrers.length === 0 ? (
                  <div className="p-10 text-center text-slate-400 text-sm">
                    No referrals recorded yet. Add a{" "}
                    <span className="font-bold">Referee Number</span> when
                    registering a card in the QR Cards tab to start tracking rewards.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {referrers.map(([refCode, referred]) => {
                      const referee = lookupReferee(refCode);
                      const pendingCount = countStatus(referred, "pending");
                      const approvedCount = countStatus(referred, "approved");
                      const paidCount = countStatus(referred, "paid");
                      const hasApproved =
                        approvedCount > 0 && approvedCount - paidCount > 0;
                      return (
                        <div key={refCode} className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                          <details className="group">
                            <summary className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 cursor-pointer list-none hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                              <div className="flex items-center gap-3 min-w-[210px]">
                                <div className="w-9 h-9 rounded-lg bg-emerald-600/10 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                                  {refCode.replace("CUST-", "")}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                                    {refCode}
                                    <span className="ml-2 text-[9px] font-bold uppercase tracking-wider text-slate-400">Referee</span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                    {referee
                                      ? `${referee.name} • ${referee.email}`
                                      : "Unregistered referee card"}
                                  </div>
                                </div>
                              </div>
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">{pendingCount} Pending</span>
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 text-[10px] font-bold">{approvedCount} Approved</span>
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">{paidCount} Paid</span>
                              <span className="ml-auto flex items-center gap-2">
                                {creditFeatureReady && pendingCount > 0 && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleApproveAll(referred); }}
                                    className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900 rounded-lg text-[10px] font-bold cursor-pointer"
                                  >
                                    Approve All Pending
                                  </button>
                                )}
                                {creditFeatureReady && hasApproved && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handlePayAllApproved(referred); }}
                                    className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-[10px] font-bold cursor-pointer"
                                  >
                                    Mark Approved as Paid
                                  </button>
                                )}
                                <span className="text-[10px] font-semibold text-slate-400 group-open:rotate-180 transition-transform">▾ Details</span>
                              </span>
                            </summary>
                            <div className="px-4 pb-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                                <span>Referred Member</span>
                                <span className="hidden sm:inline">Credit Status</span>
                              </div>
                              {referred.map((m) => (
                                <div key={m.id} className="flex flex-wrap items-center gap-3 py-2 border-t border-slate-100 dark:border-slate-800">
                                  <span className="font-bold text-slate-700 dark:text-slate-200 text-xs min-w-[130px]">{m.name}</span>
                                  <span className="text-slate-500 dark:text-slate-400 text-[10px] min-w-[150px]">{m.email}</span>
                                  <span className="text-slate-500 dark:text-slate-400 text-[10px]">{m.qr_code}</span>
                                  <span className="text-slate-400 text-[10px]">Joined {new Date(m.created_at).toLocaleDateString()}</span>
                                  {getCreditBadge(m)}
                                  <span className="ml-auto flex items-center gap-1.5">
                                    {creditFeatureReady && (m.credit_status || "pending") === "pending" && (
                                      <button
                                        type="button"
                                        onClick={() => handleApproveCredit(m.id)}
                                        className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900 rounded-lg text-[9px] font-bold cursor-pointer"
                                      >
                                        Approve
                                      </button>
                                    )}
                                    {creditFeatureReady && m.credit_status === "approved" && (
                                      <button
                                        type="button"
                                        onClick={() => handlePayCredit(m.id)}
                                        className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-[9px] font-bold cursor-pointer"
                                      >
                                        Mark Paid
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveReferral(m)}
                                      className="px-2.5 py-1 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-lg text-[9px] font-bold cursor-pointer"
                                    >
                                      Remove
                                    </button>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </details>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* --- TAB: LEDGERS, FILTERS & PDF EXPORTS --- */}
        {activeTab === "reports" && (
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6"
            id="admin-reports-panel"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                  Compliance sales Ledger
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Perform tabular audits and download custom sorted PDF reports.
                </p>
              </div>

              {/* PDF EXPORT TRIGGER */}
              <button
                onClick={handleExportPDF}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white uppercase tracking-wider text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Report Ledger (PDF)</span>
              </button>
            </div>

            {/* TABULAR FILTERING SUITE */}
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold">
              {/* Shop Filter */}
              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">
                  Filter by Partner Shop
                </label>
                <select
                  value={filterShopId}
                  onChange={(e) => setFilterShopId(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="" className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200">
                    All Shops
                  </option>
                  {shops.map((s) => (
                    <option
                      key={s.id}
                      value={s.id}
                      className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                    >
                      {s.shop_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Period Filter */}
              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">
                  Reporting Cycle
                </label>
                <select
                  value={filterPeriod}
                  onChange={(e) => setFilterPeriod(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all" className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200">
                    All Dates History
                  </option>
                  <option value="daily" className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200">
                    Daily Report (Today)
                  </option>
                  <option value="monthly" className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200">
                    Monthly Report (Current Month)
                  </option>
                  <option value="quarterly" className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200">
                    Quarterly Report (Current Quarter)
                  </option>
                  <option value="annually" className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200">
                    Annually Report (Current Year)
                  </option>
                  <option value="custom" className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200">
                    Custom Date Range
                  </option>
                </select>
              </div>

              {/* Custom Date Range — shown when "Custom" is selected */}
              {filterPeriod === "custom" && (
                <div className="sm:col-span-3">
                  <label className="block text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">
                    Custom Date Range
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">From Date</label>
                      <input
                        type="date"
                        value={customFromDate}
                        onChange={(e) => setCustomFromDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">To Date</label>
                      <input
                        type="date"
                        value={customToDate}
                        onChange={(e) => setCustomToDate(e.target.value)}
                        max={new Date().toISOString().split("T")[0]}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Sort filter */}
              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">
                  Sort Columns
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="date" className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200">
                    Transaction Date (Newest first)
                  </option>
                  <option
                    value="alphabetical"
                    className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                  >
                    Customer Name (A–Z)
                  </option>
                  <option value="amount" className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200">
                    Revenue Amount (Highest first)
                  </option>
                </select>
              </div>
            </div>

            {/* LEDGER DATA TABLE */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Customer Name</th>
                    <th className="p-3.5">Shop Outlet</th>
                    <th className="p-3.5">Price Before</th>
                    <th className="p-3.5">Discount Rate</th>
                    <th className="p-3.5">Discount Applied</th>
                    <th className="p-3.5 text-right">Net Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200 font-semibold">
                  {filteredSalesData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="p-8 text-center text-slate-400 font-semibold"
                      >
                        No sales records found matching the active sorting /
                        filters.
                      </td>
                    </tr>
                  ) : (
                    filteredSalesData.map((sale) => (
                      <tr
                        key={sale.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <td className="p-3.5">
                          {new Date(sale.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-3.5 font-bold text-slate-800 dark:text-slate-100">
                          {sale.customer_name}
                        </td>
                        <td className="p-3.5 text-[11px]">{sale.shop_name}</td>
                        <td className="p-3.5">
                          {sale.amount_before_discount.toLocaleString()} RWF
                        </td>
                        <td className="p-3.5">
                          <span className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900 px-2 py-0.5 rounded-full font-bold">
                            {sale.discount_percent}%
                          </span>
                        </td>
                        <td className="p-3.5 text-emerald-600 dark:text-emerald-400 font-bold">
                          - {sale.discount_applied.toLocaleString()} RWF
                        </td>
                        <td className="p-3.5 text-right font-bold text-slate-800 dark:text-slate-100">
                          {sale.final_amount.toLocaleString()} RWF
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- TAB: BRANDING BRAND CONFIGURATIONS --- */}
        {activeTab === "customization" && (
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 lg:p-8"
            id="admin-customization-panel"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span>Branding Customization</span>
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Configure colors, logos, content, and styling across the entire portal.</p>
              </div>
              {currentAdminRole === "super_admin" && (
                <span className="px-3 py-1 bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900 rounded-full text-xs font-bold">Full Edit Access</span>
              )}
            </div>

            <form onSubmit={handleSaveCustomization} className="space-y-6">
              {/* ROW 1: Title + Theme + Logo */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Platform Title</label>
                  <input type="text" required value={titleInput} onChange={(e) => setTitleInput(e.target.value)} placeholder="e.g. Mi Advantage" className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  <p className="text-[10px] text-slate-400 mt-1">Shown across the portal, dashboards, and member cards.</p>
                </div>
                <div className="lg:col-span-1">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Platform Subtitle</label>
                  <input type="text" value={subtitleInput} onChange={(e) => setSubtitleInput(e.target.value)} placeholder="e.g. Kigali Premium Privilege" className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  <p className="text-[10px] text-slate-400 mt-1">Line under the title in the nav bar and on member cards.</p>
                </div>
                <div className="lg:col-span-1">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Theme Accent</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "green", label: "Green", bg: "bg-green-600" },
                      { id: "emerald", label: "Emerald", bg: "bg-emerald-500" },
                      { id: "teal", label: "Teal", bg: "bg-teal-600" },
                      { id: "dark-green", label: "Dark", bg: "bg-emerald-950" },
                    ].map((theme) => (
                      <button key={theme.id} type="button" onClick={() => setThemeInput(theme.id as any)}
                        className={`p-2 rounded-lg border text-left flex items-center gap-2 text-xs cursor-pointer transition-all ${themeInput === theme.id ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 font-bold" : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"}`}>
                        <span className={`w-4 h-4 rounded-full ${theme.bg}`} />
                        <span>{theme.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="lg:col-span-1">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Company Logo</label>
                  <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-lg">
                    <div className="w-14 h-14 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                      {logoInput ? <img src={logoInput} alt="Logo" className="w-full h-full object-contain" /> : <ImageIcon className="w-6 h-6 text-slate-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      {currentAdminRole === "super_admin" ? (
                        <>
                          <input type="file" accept="image/*" onChange={handleLogoFileChange} className="hidden" id="admin-logo-upload" />
                          <label htmlFor="admin-logo-upload" className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold cursor-pointer inline-block">Upload Logo</label>
                          <p className="text-[10px] text-slate-400 mt-1">PNG with transparency recommended</p>
                        </>
                      ) : (
                        <p className="text-xs text-slate-400">Super Admin can change logo</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-1">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Site Favicon</label>
                  <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-lg">
                    <div className="w-14 h-14 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                      {faviconInput ? <img src={faviconInput} alt="Favicon" className="w-8 h-8 object-contain" /> : <ImageIcon className="w-6 h-6 text-slate-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      {currentAdminRole === "super_admin" ? (
                        <>
                          <input type="file" accept="image/*" onChange={handleFaviconFileChange} className="hidden" id="admin-favicon-upload" />
                          <label htmlFor="admin-favicon-upload" className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold cursor-pointer inline-block">Upload Icon</label>
                          <input
                            type="text"
                            value={faviconInput}
                            onChange={(e) => setFaviconInput(e.target.value)}
                            placeholder="…or paste image URL"
                            className="mt-2 w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          <p className="text-[10px] text-slate-400 mt-1">Square PNG/ICO — shown in the browser tab</p>
                        </>
                      ) : (
                        <p className="text-xs text-slate-400">Super Admin can change favicon</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ROW 2: Homepage Content */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">Homepage Content</h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Heading H1</label>
                    <input type="text" required value={h1Input} onChange={(e) => setH1Input(e.target.value)} placeholder="e.g. Instant Merchant Discounts" className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Subheading H2</label>
                    <input type="text" required value={h2Input} onChange={(e) => setH2Input(e.target.value)} placeholder="e.g. QR Member Advantage System" className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Paragraph Description</label>
                    <textarea required rows={2} value={pInput} onChange={(e) => setPInput(e.target.value)} placeholder="e.g. Scan your digital member card..." className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>
              </div>

              {/* ROW 3: Login/Signup + Footer */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">Login & Signup Forms</h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Login Heading</label>
                      <input type="text" value={loginHeading} onChange={(e) => setLoginHeading(e.target.value)} className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Login Subtext</label>
                      <input type="text" value={loginSubtext} onChange={(e) => setLoginSubtext(e.target.value)} className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Signup Heading</label>
                      <input type="text" value={signupHeading} onChange={(e) => setSignupHeading(e.target.value)} className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Signup Subtext</label>
                      <input type="text" value={signupSubtext} onChange={(e) => setSignupSubtext(e.target.value)} className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  </div>
                </div>
              </div>

              {/* ROW 4: Footer */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">Footer Content</h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Footer Text</label>
                    <input type="text" value={footerText} onChange={(e) => setFooterText(e.target.value)} placeholder="© 2026 Mi Advantage" className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Footer Subtext</label>
                    <input type="text" value={footerSubtext} onChange={(e) => setFooterSubtext(e.target.value)} placeholder="Encrypted Connection • Kigali, Rwanda" className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>
              </div>

              {/* ROW 5: Super Admin Only — Colors, Typography, CSS */}
              {currentAdminRole === "super_admin" && (
                <div className="border-t border-slate-200 dark:border-slate-800 pt-6 space-y-6">
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">Advanced Branding (Super Admin Only)</h4>

                  {/* Colors */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Brand Colors</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {[
                        { label: "Primary", value: primaryColor, set: setPrimaryColor },
                        { label: "Secondary", value: secondaryColor, set: setSecondaryColor },
                        { label: "Accent", value: accentColor, set: setAccentColor },
                        { label: "Background", value: bgColor, set: setBgColor },
                      ].map((c) => (
                        <div key={c.label} className="min-w-0">
                          <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">{c.label}</label>
                          <div className="flex items-center gap-2">
                            <input type="color" value={c.value} onChange={(e) => c.set(e.target.value)} className="w-10 h-10 shrink-0 rounded border border-slate-200 dark:border-slate-800 cursor-pointer" />
                            <input type="text" value={c.value} onChange={(e) => c.set(e.target.value)} className="flex-1 min-w-0 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Typography */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Base Font</label>
                      <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm">
                        <option value="Inter">Inter</option>
                        <option value="Roboto">Roboto</option>
                        <option value="Open Sans">Open Sans</option>
                        <option value="Lato">Lato</option>
                        <option value="Poppins">Poppins</option>
                        <option value="system-ui">System UI</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Heading Font</label>
                      <select value={headingFont} onChange={(e) => setHeadingFont(e.target.value)} className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm">
                        <option value="Space Grotesk">Space Grotesk</option>
                        <option value="Inter">Inter</option>
                        <option value="Montserrat">Montserrat</option>
                        <option value="Playfair Display">Playfair Display</option>
                        <option value="Raleway">Raleway</option>
                      </select>
                    </div>
                  </div>

                  {/* Login Background */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Login Background Type</label>
                      <select value={loginBgType} onChange={(e) => setLoginBgType(e.target.value)} className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm">
                        <option value="gradient">Gradient</option>
                        <option value="solid">Solid Color</option>
                        <option value="image">Image URL</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{loginBgType === "image" ? "Image URL" : "Value"}</label>
                      {loginBgType === "image" ? (
                        <input type="url" value={loginBgValue} onChange={(e) => setLoginBgValue(e.target.value)} placeholder="https://example.com/bg.jpg" className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
                      ) : (
                        <input type="text" value={loginBgValue} onChange={(e) => setLoginBgValue(e.target.value)} placeholder={loginBgType === "gradient" ? "linear-gradient(...)" : "#ffffff"} className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-mono" />
                      )}
                    </div>
                  </div>

                  {/* Custom CSS */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Custom CSS</label>
                    <textarea value={customCss} onChange={(e) => setCustomCss(e.target.value)} rows={4} placeholder=".my-class { color: red; }" className="w-full px-4 py-2 bg-slate-900 text-slate-200 rounded-lg text-xs font-mono" />
                  </div>
                </div>
              )}

              <button type="submit" className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm cursor-pointer">
                Save All Branding Changes
              </button>

              {brandingMsg && (
                <div className={`p-4 rounded-xl text-center font-semibold text-sm border ${brandingMsg.includes("Failed") ? "bg-red-50 dark:bg-red-950/50 border-red-100 dark:border-red-900 text-red-700 dark:text-red-300" : "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-100 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300"}`}>
                  {brandingMsg}
                </div>
              )}
            </form>
          </div>
        )}

        {activeTab === "admins" && currentAdminRole === "super_admin" && (
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6"
            id="admin-admins-panel"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                  Administrator Accounts Management
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Add, edit, or revoke access permissions for platform security control.
                </p>
              </div>
              {isEditingAdmin && (
                <button onClick={resetAdminForm} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold uppercase transition-all">Cancel Edit / Add New</button>
              )}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <form onSubmit={handleSaveAdmin} className="lg:col-span-5 space-y-4 bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs">
                <h4 className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                  {isEditingAdmin ? <Edit className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                  <span>{isEditingAdmin ? "Edit Administrator Profile" : "Register New Administrator"}</span>
                </h4>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">Full Name</label>
                  <input type="text" required value={adminFormName} onChange={(e) => setAdminFormName(e.target.value)} placeholder="e.g. Marie Claire Uwineza" className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold" />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">Corporate Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                    <input type="email" required value={adminFormEmail} onChange={(e) => setAdminFormEmail(e.target.value)} placeholder="admin.corporate@miadvantage.com" className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold" />
                  </div>
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">Administrator Role</label>
                  <select value={adminFormRole} onChange={(e) => setAdminFormRole(e.target.value as 'super_admin' | 'admin')} className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold">
                    <option value="admin">Standard Admin</option>
                    <option value="super_admin">Super Admin (manages other admins)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1 uppercase tracking-wider">{isEditingAdmin ? "Change Password (Leave blank to keep current)" : "Account Password"}</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                    <input type="password" autoComplete="new-password" required={!isEditingAdmin} value={adminFormPassword} onChange={(e) => setAdminFormPassword(e.target.value)} placeholder={isEditingAdmin ? "••••••••" : "Password credential"} className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold" />
                  </div>
                </div>
                <button type="submit" className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer">
                  <span>{isEditingAdmin ? "Update Administrator Settings" : "Create Admin Credentials"}</span>
                </button>
                {adminMsg && (<div className="p-3 bg-slate-200/50 dark:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-center font-bold">{adminMsg}</div>)}
              </form>
              <div className="lg:col-span-7 space-y-3">
                <h4 className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider text-[11px] mb-2">Platform Administrator Registry</h4>
                <div className="space-y-2.5 max-h-[450px] overflow-y-auto pr-1">
                  {adminsList.map((adm) => (
                    <div key={adm.id} className="p-3.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-between gap-4 text-xs hover:border-emerald-200 dark:hover:border-emerald-700 transition-all">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{adm.name}</span>
                          {adm.role === "super_admin" && (<span className="bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded">Super Admin</span>)}
                          {adm.role !== "super_admin" && adm.email_verified !== true && (<span className="bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded">Unverified</span>)}
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 font-semibold truncate">{adm.email}</p>
                        <span className="text-[10px] text-slate-400 block font-semibold">Registered: {new Date(adm.created_at).toLocaleDateString()}{adm.status === "active" ? "" : ` • Status: ${adm.status}`}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => handleEditAdminClick(adm)} className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg transition-all cursor-pointer" title="Edit Admin Account"><Edit className="w-3.5 h-3.5" /></button>
                        {adm.role !== "super_admin" && (<button onClick={() => handleDeleteAdminClick(adm.id)} className="p-1.5 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg transition-all cursor-pointer" title="Revoke Admin Access"><Trash2 className="w-3.5 h-3.5" /></button>)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === "admins" && currentAdminRole !== "super_admin" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6" id="admin-admins-panel">
            <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 p-5 rounded-xl text-xs text-center font-semibold">
              Restricted Access: Only the Super Administrator can manage administrator accounts.
              <p className="mt-1 text-amber-600 dark:text-amber-400 font-normal">Your role does not have permission to view this section.</p>
            </div>
          </div>
        )}

        {/* --- TAB: SUPABASE SETUP & DIAGNOSTICS --- */}
        {/* --- TAB: AUDIT LOGS SECURE VIEWER --- */}
        {activeTab === "audits" && (
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6"
            id="admin-audits-panel"
          >
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1 uppercase tracking-wider">
              System Audit Trail
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
              Permanent chronological logs of scans, database registrations, and
              system parameters edits.
            </p>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {logs.map((log) => {
                const isAdmin = log.user_role === "Admin";
                const isShop = log.user_role === "Shop";
                return (
                  <div
                    key={log.id}
                    className="p-3.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:border-emerald-200 dark:hover:border-emerald-700 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${
                            isAdmin
                              ? "bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900"
                              : isShop
                                ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900"
                                : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                          }`}
                        >
                          {log.user_role}
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-100">
                          {log.action}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px] font-semibold">
                        {log.details}
                      </p>
                      <span className="text-[10px] text-slate-400 block font-semibold">
                        Actor: {log.user_email}
                      </span>
                    </div>
                    <div className="shrink-0 text-left sm:text-right">
                      <span className="text-[10px] text-slate-400 font-semibold">
                        {new Date(log.created_at).toLocaleDateString()}{" "}
                        {new Date(log.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- MODAL: DESIGNED CARD PREVIEW & DOWNLOAD --- */}
        {selectedCardCustomer && (
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto"
            id="card-preview-modal"
          >
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800 relative">
              <button
                onClick={() => setSelectedCardCustomer(null)}
                className="absolute top-4 right-4 p-2 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition-all cursor-pointer"
                title="Close modal"
              >
                <span className="text-xl font-bold font-sans">×</span>
              </button>

              <div className="text-center mb-6">
                <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  Designed Member Card Preview
                </span>
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mt-2 uppercase">
                  Official Loyalty Credentials
                </h3>
                <p className="text-xs text-slate-400 font-semibold">
                  Ready for distribution, printing, or digital scan redemption.
                </p>
              </div>

              {/* CARD CONTAINER WITH SHADOW & RADIUS */}
              <div className="flex justify-center my-6">
                {/* Visual Loyalty Card */}
                <div
                  id="loyalty-card-graphic"
                  className="w-[380px] h-[240px] rounded-2xl bg-gradient-to-br from-emerald-900 via-teal-950 to-slate-950 text-white p-5 flex flex-col justify-between shadow-xl relative overflow-hidden border border-emerald-800/50"
                >
                  {/* Decorative mesh */}
                  <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />
                  <div className="absolute -right-16 -top-16 w-36 h-36 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
                  <div className="absolute -left-16 -bottom-16 w-36 h-36 rounded-full bg-teal-500/20 blur-3xl pointer-events-none" />

                  {/* Top bar with Logo & Title */}
                  <div className="flex items-start justify-between relative z-10">
                    <div className="flex items-center gap-2">
                      {customization?.logo_url ? (
                        <img
                          src={customization.logo_url}
                          alt="Logo"
                          className="h-6 w-auto object-contain"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded bg-emerald-500 text-white flex items-center justify-center font-black text-xs">
                          MA
                        </div>
                      )}
                      <div className="text-left">
                        <span className="font-sans text-[10px] uppercase tracking-wider font-extrabold text-slate-100 block">
                          {customization?.title
                            ? customization.title.slice(0, 24)
                            : "Mi Advantage"}
                        </span>
                        <span className="block text-[6px] uppercase text-emerald-400 font-bold tracking-widest">
                          {customization?.subtitle || "Kigali Premium Privilege"}
                        </span>
                      </div>
                    </div>
                    <div className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[8px] font-black uppercase tracking-widest">
                      Member Card
                    </div>
                  </div>

                  {/* Center with Customer Info & QR Code */}
                  <div className="flex items-center justify-between gap-4 mt-1 relative z-10 text-left">
                    <div className="min-w-0 space-y-1">
                      <p className="text-[7px] uppercase text-emerald-400 font-bold tracking-widest">
                        CARDHOLDER
                      </p>
                      <h4 className="font-sans font-black text-sm tracking-tight truncate uppercase text-white">
                        {selectedCardCustomer.name}
                      </h4>
                      <p className="text-[9px] text-slate-400 font-medium shrink-0">
                        {selectedCardCustomer.phone}
                      </p>
                    </div>

                    {/* QR Code Graphic */}
                    <div className="bg-white dark:bg-slate-900 p-1 rounded-xl shadow-lg shrink-0 border border-emerald-500/20">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${selectedCardCustomer.qr_code}&margin=1`}
                        alt="QR Code"
                        className="w-16 h-16"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>

                  {/* Bottom Bar: Expiry & Card ID */}
                  <div className="flex items-end justify-between relative z-10 border-t border-emerald-800/40 pt-2.5 mt-1">
                    <div className="text-left">
                      <p className="text-[6px] uppercase text-emerald-400 font-bold tracking-wider">
                        Card ID
                      </p>
                      <p className="font-mono text-[10px] font-black text-emerald-300 tracking-wider">
                        {selectedCardCustomer.qr_code}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[6px] uppercase text-amber-400 font-bold tracking-wider">
                        Valid Until
                      </p>
                      <p className="font-sans text-[10px] font-black text-amber-300">
                        {selectedCardCustomer.valid_until || "NEVER EXPIRES"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* DOWNLOAD & ACTION OPTIONS */}
              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  onClick={() => {
                    // Create direct dynamic download of card as SVG
                    const logoMarkup = customization?.logo_url
                      ? `<ImageIcon href="${customization.logo_url}" x="20" y="25" height="24" width="60" />`
                      : `<rect x="20" y="25" width="24" height="24" rx="4" fill="#10b981" />
                         <text x="32" y="41" font-family="'Inter', sans-serif" font-weight="900" font-size="11" fill="#ffffff" text-anchor="middle">MA</text>`;

                    const svgContent = `
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 240" width="380" height="240">
                      <defs>
                        <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stop-color="#064e3b" />
                          <stop offset="50%" stop-color="#042f2e" />
                          <stop offset="100%" stop-color="#020617" />
                        </linearGradient>
                      </defs>
                      
                      <!-- Card Background -->
                      <rect width="380" height="240" rx="16" fill="url(#cardGrad)" stroke="#047857" stroke-width="1.5" />
                      
                      <!-- Decorative blur lights -->
                      <circle cx="340" cy="40" r="60" fill="#10b981" opacity="0.15" filter="blur(20px)" />
                      <circle cx="40" cy="200" r="60" fill="#14b8a6" opacity="0.15" filter="blur(20px)" />
                      
                      <!-- Header elements -->
                      ${logoMarkup}
                      <text x="52" y="34" font-family="'Inter', sans-serif" font-weight="800" font-size="9" fill="#ffffff" letter-spacing="1">${(customization?.title || "Mi Advantage").toUpperCase().slice(0, 24)}</text>
                      <text x="52" y="44" font-family="'Inter', sans-serif" font-weight="700" font-size="5" fill="#34d399" letter-spacing="1">${(customization?.subtitle || "Kigali Premium Privilege").toUpperCase().slice(0, 28)}</text>
                      
                      <rect x="290" y="22" width="70" height="16" rx="4" fill="#10b981" fill-opacity="0.1" stroke="#10b981" stroke-width="0.5" stroke-opacity="0.3" />
                      <text x="325" y="32" font-family="'Inter', sans-serif" font-weight="900" font-size="7" fill="#6ee7b7" text-anchor="middle" letter-spacing="1">MEMBER CARD</text>
                      
                      <!-- Cardholder Details -->
                      <text x="20" y="90" font-family="'Inter', sans-serif" font-weight="700" font-size="6" fill="#34d399" letter-spacing="1">CARDHOLDER</text>
                      <text x="20" y="112" font-family="'Inter', sans-serif" font-weight="900" font-size="14" fill="#ffffff">${selectedCardCustomer.name.toUpperCase()}</text>
                      <text x="20" y="132" font-family="'Inter', sans-serif" font-weight="500" font-size="8" fill="#cbd5e1">${selectedCardCustomer.phone}</text>
                      
                      <!-- QR Code wrapper -->
                      <rect x="280" y="80" width="80" height="80" rx="8" fill="#ffffff" />
                      <ImageIcon href="https://api.qrserver.com/v1/create-qr-code/?size=100x100&amp;data=${selectedCardCustomer.qr_code}&amp;margin=1" x="284" y="84" height="72" width="72" />
                      
                      <!-- Separator line -->
                      <line x1="20" y1="185" x2="360" y2="185" stroke="#064e3b" stroke-width="1" stroke-opacity="0.4" />
                      
                      <!-- Footer Info -->
                      
                      <text x="20" y="202" font-family="'Inter', sans-serif" font-weight="700" font-size="5" fill="#34d399" letter-spacing="1">CARD ID</text>
                      <text x="20" y="218" font-family="'Courier New', monospace" font-weight="800" font-size="9" fill="#6ee7b7" letter-spacing="1">${selectedCardCustomer.qr_code}</text>
                      
                      <text x="360" y="202" font-family="'Inter', sans-serif" font-weight="700" font-size="5" fill="#f59e0b" letter-spacing="1" text-anchor="end">VALID UNTIL</text>
                      <text x="360" y="218" font-family="'Inter', sans-serif" font-weight="800" font-size="9" fill="#fcd34d" text-anchor="end">${selectedCardCustomer.valid_until || "NEVER EXPIRES"}</text>
                    </svg>
                    `;

                    const blob = new Blob([svgContent], {
                      type: "image/svg+xml;charset=utf-8",
                    });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `MA-Card-${selectedCardCustomer.name.replace(/\s+/g, "-")}.svg`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  }}
                  className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download SVG Card</span>
                </button>

                <button
                  onClick={() => {
                    // Simple printable dynamic card pop-out window
                    const printWindow = window.open("", "_blank");
                    if (printWindow) {
                      printWindow.document.write(`
                        <html>
                          <head>
                            <title>Print Card - ${selectedCardCustomer.name}</title>
                            <style>
                              body {
                                display: flex;
                                justify-content: center;
                                align-items: center;
                                height: 100vh;
                                margin: 0;
                                font-family: 'Inter', sans-serif;
                                background-color: #f8fafc;
                              }
                              .card {
                                width: 380px;
                                height: 240px;
                                border-radius: 16px;
                                background: linear-gradient(135deg, #064e3b 0%, #042f2e 50%, #020617 100%);
                                color: white;
                                padding: 20px;
                                box-sizing: border-box;
                                display: flex;
                                flex-direction: column;
                                justify-content: space-between;
                                position: relative;
                                box-shadow: 0 10px 25px rgba(0,0,0,0.3);
                                -webkit-print-color-adjust: exact;
                              }
                              .header { display: flex; justify-content: space-between; align-items: center; }
                              .logo { display: flex; align-items: center; gap: 8px; }
                              .logo-box { width: 24px; height: 24px; background-color: #10b981; border-radius: 4px; display: flex; justify-content: center; align-items: center; font-weight: 900; font-size: 11px; }
                              .title { font-weight: 800; font-size: 10px; letter-spacing: 1px; }
                              .subtitle { font-size: 6px; color: #34d399; letter-spacing: 1px; text-transform: uppercase; }
                              .badge { padding: 4px 8px; border-radius: 4px; background-color: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); color: #6ee7b7; font-weight: 900; font-size: 7px; letter-spacing: 1px; }
                              .body { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
                              .holder-label { font-weight: 700; font-size: 6px; color: #34d399; letter-spacing: 1px; }
                              .holder-name { font-weight: 900; font-size: 14px; margin: 2px 0; }
                              .holder-contact { font-size: 8px; color: #cbd5e1; margin: 1px 0; }
                              .qr-box { background: white; padding: 4px; border-radius: 8px; width: 64px; height: 64px; }
                              .qr-box img { width: 100%; height: 100%; }
                              .footer { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid rgba(6,78,59,0.4); padding-top: 10px; }
                              .tok-lbl { font-size: 5px; color: #10b981; letter-spacing: 1px; }
                              .tok-val { font-family: monospace; font-weight: 800; font-size: 11px; }
                              .exp-lbl { font-size: 5px; color: #f59e0b; letter-spacing: 1px; text-align: right; }
                              .exp-val { font-weight: 800; font-size: 9px; color: #fcd34d; text-align: right; }
                              @media print {
                                body { background-color: white; }
                                .card { box-shadow: none; border: 1px solid #064e3b; }
                              }
                            </style>
                          </head>
                          <body>
                            <div class="card">
                              <div class="header">
                                <div class="logo">
                                  ${customization?.logo_url ? `<img src="${customization.logo_url}" style="height:24px; max-width:60px; object-fit:contain;" />` : `<div class="logo-box">MA</div>`}
                                  <div>
                                    <div class="title">${(customization?.title || "Mi Advantage").toUpperCase().slice(0, 24)}</div>
                                    <div class="subtitle">${customization?.subtitle || "Kigali Premium Privilege"}</div>
                                  </div>
                                </div>
                                <div class="badge">MEMBER CARD</div>
                              </div>
                              <div class="body">
                                <div>
                                  <div class="holder-label">CARDHOLDER</div>
                                  <div class="holder-name">${selectedCardCustomer.name.toUpperCase()}</div>
                                  <div class="holder-contact">${selectedCardCustomer.phone}</div>
                                </div>
                                <div class="qr-box">
                                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${selectedCardCustomer.qr_code}&margin=1" />
                                </div>
                              </div>
                              <div class="footer">
                                <div>
                                  <div class="tok-lbl">CARD ID</div>
                                  <div class="tok-val">${selectedCardCustomer.qr_code}</div>
                                </div>
                                <div>
                                  <div class="exp-lbl">VALID UNTIL</div>
                                  <div class="exp-val">${selectedCardCustomer.valid_until || "NEVER EXPIRES"}</div>
                                </div>
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
                      printWindow.document.close();
                    }
                  }}
                  className="py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Print Card / Save PDF</span>
                </button>
              </div>

              <div className="mt-4 text-center">
                <button
                  onClick={() => setSelectedCardCustomer(null)}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold uppercase tracking-wider hover:underline"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SHOP GUEST-SCAN QR MODAL */}
        {qrModalShop && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-4 text-center">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900 flex items-center justify-center mx-auto">
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{qrModalShop.shop_name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Printing &amp; posting this at the counter: scanning it opens the Scan page with{" "}
                  <strong>{qrModalShop.shop_name}</strong> already selected, so a member&apos;s{" "}
                  {qrModalShop.discount_percent}% discount is filled in for the cashier.
                </p>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 inline-block mx-auto">
                <QRCodeCanvas
                  id="shop-qr-canvas"
                  value={buildShopUrl(qrModalShop.qr_code || qrModalShop.id)}
                  size={200}
                  level="M"
                  includeMargin
                />
              </div>
              <div className="font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900 rounded-xl px-3 py-2 text-sm tracking-widest">
                {qrModalShop.qr_code || qrModalShop.id}
              </div>
              <button
                onClick={handleDownloadShopQR}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Download PNG</span>
              </button>
              <button
                onClick={() => { setQrModalShop(null); }}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* COMMON SELF-REGISTRATION QR MODAL — print & post at counters */}
        {joinQrOpen && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-4 text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center mx-auto">
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Customer Self-Registration QR</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  One common code for all counters. Shoppers scan it to open the card-issuing
                  page (partner carousel + registration form) — no login, no email needed.
                </p>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 inline-block mx-auto">
                <QRCodeCanvas
                  id="join-qr-canvas"
                  value={joinUrl}
                  size={200}
                  level="M"
                  includeMargin
                />
              </div>
              <div className="font-mono text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 break-all">
                {joinUrl}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadJoinQR}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>Download PNG</span>
                </button>
                <button
                  onClick={handleCopyJoinLink}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  {joinCopied ? "Copied!" : "Copy Link"}
                </button>
              </div>
              {joinMsg && (
                <div className="bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs">{joinMsg}</div>
              )}
              <button
                onClick={() => { setJoinQrOpen(false); setJoinMsg(""); }}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* PDF PREVIEW MODAL */}
        {pdfPreviewUrl && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full h-[90vh] shadow-2xl flex flex-col overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">PDF Preview — Review before downloading</h3>
                <div className="flex items-center gap-2">
                  <button onClick={handleConfirmDownload} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5"><Download className="w-3.5 h-3.5" />Download PDF</button>
                  <button onClick={() => setPdfPreviewUrl(null)} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold cursor-pointer">Close</button>
                </div>
              </div>
              <iframe src={pdfPreviewUrl} className="flex-1 w-full border-0" title="PDF Preview" />
            </div>
          </div>
        )}
        </div>
        </div>
      </div>
    </div>
  );
}







