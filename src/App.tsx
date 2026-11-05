import React, { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
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

function AppContent() {
  const navigate = useNavigate();
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

  const handleLoginSuccess = (role: "admin" | "shop") => {
    setCurrentUser(db.currentUser);
    navigate("/dashboard");
  };

  const handleLogout = async () => {
    await db.logout();
    setCurrentUser(null);
    navigate("/login");
  };

  // Wait for session validation before rendering
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
        <Route path="*" element={<Navigate to="/" replace />} />
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
