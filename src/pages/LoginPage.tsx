import React, { useState, useEffect } from "react";
import { db } from "../lib/supabase";
import { Customization } from "../types";
import { Lock as LockIcon, Mail as MailIcon, Eye as EyeIcon, EyeOff as EyeOffIcon, KeyRound as KeyRoundIcon, QrCode as QrCodeIcon } from "../components/AdminIcons";
import ThemeToggle from "../components/ThemeToggle";
import { useSearchParams } from "react-router-dom";

export default function LoginPage({ onLoginSuccess }: { onLoginSuccess: (role: "admin" | "shop", redirect?: string) => void }) {
  const [searchParams] = useSearchParams();
  const [cust, setCust] = useState<Customization | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [recoveryStep, setRecoveryStep] = useState<1 | 2>(1);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySuccess, setRecoverySuccess] = useState<string | null>(null);

  // OTP verification state (after login returns EMAIL_NOT_VERIFIED)
  const [showOtpVerify, setShowOtpVerify] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSuccess, setOtpSuccess] = useState<string | null>(null);
  const [otpUserType, setOtpUserType] = useState<"admin" | "shop" | null>(null);

  useEffect(() => {
    db.getCustomization().then(setCust).catch(() => setCust(null));
  }, []);

  const siteName = cust?.title || "Mi Advantage";
  const logoUrl = cust?.logo_url || "";

  // shopQr: shop QR code scanned at the terminal — after login, redirect to
  // /scan?shop=<shopQr> so the shop is auto-selected in the discount form.
  const shopQrParam = searchParams.get("shopQr") || "";
  // shop: shop email pre-filled from a scanned shop QR.
  const shopEmailParam = searchParams.get("shop") || "";

  useEffect(() => {
    if (shopEmailParam) setEmailInput(shopEmailParam);
  }, [shopEmailParam]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) { setLoginError("Email and password are required."); return; }
    setLoginError(null);
    setAuthLoading(true);
    try {
      const result = await db.login(emailInput, passwordInput);

      // If email not verified, show OTP input
      if (result.code === "EMAIL_NOT_VERIFIED") {
        setOtpUserType(result.userType || null);
        setShowOtpVerify(true);
        setOtpError(null);
        setOtpSuccess(null);
        setOtpCode("");
        // Send a new verification code
        if (result.userType) {
          await db.sendVerificationCode(emailInput.toLowerCase().trim(), result.userType, "signup");
        }
        setAuthLoading(false);
        return;
      }

      if (result.error) {
        setLoginError(result.error);
      } else if (result.user) {
        // If we arrived here from a scanned counter QR, do a full-page
        // redirect into the scanner — the freshly stored session mounts the
        // shop terminal directly and a transient SPA redirect cannot race it.
        if (shopQrParam && result.user.role === "shop") {
          // Full-page redirect into the clean scanner path — the freshly
          // stored session mounts the shop terminal directly.
          window.location.replace(
            `${window.location.origin}/scan?shop=${encodeURIComponent(shopQrParam)}&entrance=${Date.now()}`
          );
          return;
        }
        onLoginSuccess(result.user.role as "admin" | "shop", searchParams.get("redirect") || undefined);
      }
    } catch {
      setLoginError("Auth connection error. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);
    setOtpSuccess(null);
    if (!otpCode) { setOtpError("Enter the verification code."); return; }
    setAuthLoading(true);
    try {
      const result = await db.verifyEmailCode(emailInput.toLowerCase().trim(), otpCode, "signup");
      if (result.success) {
        setOtpSuccess("Email verified! Signing you in...");
        // Now attempt login again after verification
        setTimeout(async () => {
          try {
            const loginResult = await db.login(emailInput, passwordInput);
            if (loginResult.user) {
              if (shopQrParam && loginResult.user.role === "shop") {
                window.location.replace(
                  `${window.location.origin}/scan?shop=${encodeURIComponent(shopQrParam)}&entrance=${Date.now()}`
                );
                return;
              }
              onLoginSuccess(
                loginResult.user.role as "admin" | "shop",
                searchParams.get("redirect") || undefined
              );
            } else if (loginResult.error) {
              setOtpError(loginResult.error);
              setShowOtpVerify(false);
            }
          } catch {
            setOtpError("Login after verification failed. Try signing in manually.");
            setShowOtpVerify(false);
          }
        }, 800);
      } else {
        setOtpError(result.error || "Invalid verification code.");
      }
    } catch (err: any) {
      setOtpError(err?.message || "Verification error.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setOtpError(null);
    setOtpSuccess(null);
    try {
      const sent = await db.sendVerificationCode(emailInput.toLowerCase().trim(), otpUserType || "admin", "signup");
      if (sent) {
        setOtpSuccess("A new verification code has been sent to your email.");
      } else {
        setOtpError("Failed to send verification code. Try again later.");
      }
    } catch {
      setOtpError("Failed to send verification code.");
    }
  };

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    setRecoverySuccess(null);
    if (!recoveryEmail) { setRecoveryError("Please enter your registered email."); return; }
    setAuthLoading(true);
    try {
      const { success, error } = await db.requestPasswordReset(recoveryEmail);
      if (success) { setRecoverySuccess("Recovery code sent to your email."); setRecoveryStep(2); }
      else { setRecoveryError(error || "Account not found."); }
    } catch (err: any) { setRecoveryError(err?.message || "Error."); } finally { setAuthLoading(false); }
  };

  const handleVerifyReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    if (!recoveryCode || !newPassword) { setRecoveryError("All fields required."); return; }
    if (newPassword !== confirmNewPassword) { setRecoveryError("Passwords do not match."); return; }
    setAuthLoading(true);
    try {
      const { success, error } = await db.verifyRecoveryAndReset(recoveryEmail, recoveryCode, newPassword);
      if (success) { setRecoverySuccess("Password updated! You can now sign in."); setEmailInput(recoveryEmail); setPasswordInput(newPassword); setRecoveryStep(1); setTimeout(() => setIsResetMode(false), 1500); }
      else { setRecoveryError(error || "Invalid code."); }
    } catch (err: any) { setRecoveryError(err?.message || "Error."); } finally { setAuthLoading(false); }
  };

  // --- OTP Verification Overlay ---
  if (showOtpVerify) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 dark:from-slate-950 to-emerald-50/30 dark:to-emerald-950/20 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg p-8 space-y-6">
          <div className="text-center">
            <div className="w-14 h-14 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            </div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Verify Your Email</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Enter the code sent to <span className="font-semibold text-slate-700 dark:text-slate-200">{emailInput}</span></p>
          </div>

          <form onSubmit={handleOtpVerify} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Verification Code</label>
              <input
                type="text"
                required
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="e.g. MA-123456"
                className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono tracking-wider"
              />
            </div>
            <button type="submit" disabled={authLoading} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold cursor-pointer">
              {authLoading ? "Verifying..." : "Verify & Sign In"}
            </button>
          </form>

          <div className="text-center">
            <button onClick={handleResendOtp} className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 text-xs font-semibold cursor-pointer">
              Resend verification code
            </button>
          </div>

          {otpError && <div className="bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs text-center">{otpError}</div>}
          {otpSuccess && <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 p-3 rounded-xl text-xs text-center">{otpSuccess}</div>}

          <button onClick={() => { setShowOtpVerify(false); setOtpCode(""); setOtpError(null); setOtpSuccess(null); }} className="text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300 text-xs font-semibold cursor-pointer block mx-auto">
            &larr; Back to login
          </button>
        </div>
      </div>
    );
  }

  // --- Password Reset Mode ---
  if (isResetMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 dark:from-slate-950 to-emerald-50/30 dark:to-emerald-950/20 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg p-8 space-y-6">
          <div className="text-center">
            <div className="w-14 h-14 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-3"><KeyRoundIcon className="w-7 h-7" /></div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Password Reset</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Regain access to your account</p>
          </div>
          {recoveryStep === 1 ? (
            <form onSubmit={handleRequestCode} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Registered Email</label>
                <div className="relative">
                  <MailIcon className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input type="email" required value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)} placeholder="your@email.com" className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
                </div>
              </div>
              <button type="submit" disabled={authLoading} className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold cursor-pointer">{authLoading ? "Sending..." : "Request Recovery Code"}</button>
            </form>
          ) : (
            <form onSubmit={handleVerifyReset} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Recovery Code</label>
                <input type="text" required value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value)} placeholder="e.g. MA-123456" className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono tracking-wider" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">New Password</label>
                <div className="relative">
                  <LockIcon className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Confirm Password</label>
                <div className="relative">
                  <LockIcon className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input type="password" required value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="••••••••" className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
              </div>
              <button type="submit" disabled={authLoading} className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold cursor-pointer">{authLoading ? "Resetting..." : "Verify & Set Password"}</button>
            </form>
          )}
          {recoveryError && <div className="bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs text-center">{recoveryError}</div>}
          {recoverySuccess && <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 p-3 rounded-xl text-xs text-center">{recoverySuccess}</div>}
          <button onClick={() => { setIsResetMode(false); setRecoveryStep(1); setRecoveryError(null); }} className="text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300 text-xs font-semibold cursor-pointer block mx-auto">&larr; Back to login</button>
        </div>
      </div>
    );
  }

  // --- Main Login Form ---
  return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 dark:from-slate-950 to-emerald-50/30 dark:to-emerald-950/20 flex items-center justify-center p-4 relative">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg p-8 space-y-6">
        <div className="text-center">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-10 w-auto object-contain mx-auto mb-3" />
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>
            </div>
          )}
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{siteName}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{cust?.login_subtext || "Access your dashboard"}</p>
          {shopQrParam && (
            <div className="mt-3 inline-flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-full px-3.5 py-1.5">
              <QrCodeIcon className="w-3.5 h-3.5" />
              <span className="text-[11px] font-black uppercase tracking-wider">
                {shopEmailParam ? "Counter sign-in — password only" : "Counter sign-in"}
              </span>
            </div>
          )}
        </div>

        <form onSubmit={handleLogin} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Email Address</label>
            <div className="relative">
              <MailIcon className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="admin or shop email"
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                autoComplete="username"
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">Password</label>
              <button type="button" onClick={() => { setRecoveryEmail(emailInput); setIsResetMode(true); }} className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-semibold cursor-pointer">Forgot password?</button>
            </div>
            <div className="relative">
              <LockIcon className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                {showPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={authLoading} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold cursor-pointer flex items-center justify-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></svg>
            <span>{authLoading ? 'Signing in...' : 'Sign In'}</span>
          </button>
        </form>

        <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3 text-center text-xs">
          <p className="text-slate-500 dark:text-slate-400">Don't have an account?</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <a href="/register" className="flex-1 py-2 px-4 border border-purple-200 dark:border-purple-900 text-purple-700 dark:text-purple-300 rounded-xl font-semibold hover:bg-purple-50 dark:hover:bg-purple-900/40 transition-colors">Create Admin Account</a>
          </div>
        </div>

        {loginError && <div className="bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs text-center">{loginError}</div>}
      </div>
    </div>
  );
}
