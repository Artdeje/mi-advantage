import React, { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { db } from "./lib/supabase";
import { getSupabase } from "./lib/supabaseClient";
import { AuthUser, Customization } from "./types";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ShopRegistrationPage from "./pages/ShopRegistrationPage";
import AdminDashboard from "./components/AdminDashboard";
import ShopDashboard from "./components/ShopDashboard";
import CustomerPortal from "./components/CustomerPortal";
import SelfRegistrationPage from "./components/SelfRegistrationPage";
import WelcomePage from "./components/WelcomePage";
import { applyTheme, getInitialTheme } from "./lib/theme";

// Legacy cards and counter QRs still encode HashRouter URLs
// (e.g. https://…/#/scan?card=CUST-001). Rewrite them to clean BrowserRouter
// paths before the router reads the location, so already-printed QRs keep
// working on every device.
function normalizeLegacyHashUrl() {
  if (typeof window === "undefined") return;
  const hash = window.location.hash || "";
  if (!hash.startsWith("#/")) return;
  const target = hash.slice(1);
  const q = target.indexOf("?");
  const pathname = q === -1 ? target : target.slice(0, q);
  const search = q === -1 ? "" : target.slice(q);
  const base = window.location.pathname.replace(/\/+$/, "");
  window.history.replaceState(null, "", (base || "") + pathname + search);
}

normalizeLegacyHashUrl();
// Also normalize a legacy link pasted into an already-open tab (hash-only
// navigation does not reload the app).
window.addEventListener("hashchange", normalizeLegacyHashUrl);

function AuthRedirect() {
  const location = useLocation();
  return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
}

// Public pages must never wait for session validation: a customer scanning a
// card (or a shop opening its counter QR) can land here while the server is
// still cold-starting, and a "Verifying session..." spinner looks like a
// broken page. Only protected routes gate on the session check.
const PUBLIC_PATHS = new Set([
  "/",
  "/scan",
  "/join",
  "/login",
  "/register",
  "/register-shop",
]);

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(db.currentUser);
  const [customization, setCustomization] = useState<Customization | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Apply the saved (or system) theme before anything renders.
  useEffect(() => { applyTheme(getInitialTheme()); }, []);

  const loadBranding = useCallback(async () => {
    const cust = await db.getCustomization();
    setCustomization(cust);
    document.title = cust.title || "Mi Advantage";
    // CMS-managed favicon (Branding → Site Favicon); falls back to index.html.
    const iconUrl = (cust.favicon_url || "").trim();
    if (iconUrl) {
      let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      if (link.href !== iconUrl) link.href = iconUrl;
    }
  }, []);

  // Validate stored session token on mount
  useEffect(() => {
    const validateSession = async () => {
      if (db.currentUser) {
        try {
          const valid = await getSupabase().validateSession();
          if (!valid) {
            // Token expired or invalid — clear auth
            db.currentUser = null;
            setCurrentUser(null);
          }
        } catch {
          // Server unreachable — keep local state for offline resilience
        }
      }
      setAuthChecked(true);
    };
    validateSession();
  }, []);

  useEffect(() => { if (authChecked) loadBranding(); }, [loadBranding, authChecked]);

  const handleLoginSuccess = (role: "admin" | "shop", redirect?: string) => {
    setCurrentUser(db.currentUser);
    navigate(redirect || "/dashboard");
  };

  const handleLogout = async () => {
    await db.logout();
    setCurrentUser(null);
    navigate("/login");
  };

  // Render public pages immediately — no session gate. This keeps /scan,
  // /join and the shop QR login usable even on a cold production start.
  if (PUBLIC_PATHS.has(location.pathname)) {
    return (
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/scan" element={<CustomerPortal />} />
        <Route path="/join" element={<SelfRegistrationPage />} />
        <Route
          path="/login"
          element={
            currentUser ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <LoginPage onLoginSuccess={handleLoginSuccess} />
            )
          }
        />
        <Route path="/register" element={<RegisterPage onRegistered={() => navigate("/login")} />} />
        <Route path="/register-shop" element={<ShopRegistrationPage onRegistered={() => navigate("/login")} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Wait for session validation before rendering protected pages
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-slate-500 text-sm">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/scan" element={<CustomerPortal />} />
        <Route path="/join" element={<SelfRegistrationPage />} />
        <Route path="/login" element={<LoginPage onLoginSuccess={handleLoginSuccess} />} />
        <Route path="/register" element={<RegisterPage onRegistered={() => navigate("/login")} />} />
        <Route path="/register-shop" element={<ShopRegistrationPage onRegistered={() => navigate("/login")} />} />
        <Route path="*" element={<AuthRedirect />} />
      </Routes>
    );
  }

  if (currentUser.role === "shop") {
    return (
      <Routes>
        <Route path="/dashboard" element={<ShopDashboard shopUser={currentUser} onLogout={handleLogout} />} />
        <Route path="/scan" element={<CustomerPortal />} />
        <Route path="/join" element={<SelfRegistrationPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/dashboard" element={<AdminDashboard onCustomizationChange={loadBranding} onLogout={handleLogout} />} />
      <Route path="/admins" element={<AdminDashboard onCustomizationChange={loadBranding} onLogout={handleLogout} />} />
      <Route path="/partners" element={<AdminDashboard onCustomizationChange={loadBranding} onLogout={handleLogout} />} />
      <Route path="/customers" element={<AdminDashboard onCustomizationChange={loadBranding} onLogout={handleLogout} />} />
      <Route path="/referrers" element={<AdminDashboard onCustomizationChange={loadBranding} onLogout={handleLogout} />} />
      <Route path="/reports" element={<AdminDashboard onCustomizationChange={loadBranding} onLogout={handleLogout} />} />
      <Route path="/customize" element={<AdminDashboard onCustomizationChange={loadBranding} onLogout={handleLogout} />} />
      <Route path="/logs" element={<AdminDashboard onCustomizationChange={loadBranding} onLogout={handleLogout} />} />
      <Route path="/scan" element={<CustomerPortal />} />
      <Route path="/join" element={<SelfRegistrationPage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
