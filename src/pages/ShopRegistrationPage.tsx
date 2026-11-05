import React, { useState, useEffect } from "react";
import {
  db,
  BUSINESS_TYPES,
  BUSINESS_TYPE_LABELS,
  DISCOUNT_SCOPES,
  DISCOUNT_SCOPE_LABELS,
} from "../lib/supabase";
import { Customization } from "../types";
import { readImageAsDataUrl } from "../lib/imageUtil";
import {
  Lock as LockIcon,
  Mail as MailIcon,
  Eye as EyeIcon,
  EyeOff as EyeOffIcon,
  Store as StoreIcon,
  Upload as UploadIcon,
  FileText as FileTextIcon,
  CheckCircle2 as CheckIcon,
} from "../components/AdminIcons";
import ThemeToggle from "../components/ThemeToggle";

/**
 * Public "Register Your Shop" page (#/register-shop).
 * A prospective partner submits business details + documents; the shop starts
 * as PENDING and only goes live after email verification and admin approval.
 */
export default function ShopRegistrationPage({ onRegistered }: { onRegistered: () => void }) {
  const [cust, setCust] = useState<Customization | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [businessType, setBusinessType] = useState<string>("retail");
  const [discountScope, setDiscountScope] = useState<string>("all");
  const [description, setDescription] = useState("");
  const [contract, setContract] = useState("");
  const [rdb, setRdb] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "verify" | "done">("form");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    db.getCustomization().then(setCust).catch(() => setCust(null));
  }, []);

  const siteName = cust?.title || "Mi Advantage";
  const logoUrl = cust?.logo_url || "";

  const readFile = async (file: File, set: (v: string) => void) => {
    // Scanned contract / RDB letter images are downscaled; PDFs pass through.
    set(await readImageAsDataUrl(file, 900, 0.75));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!name.trim() || !email.trim() || !password) {
      setError("Business name, email and password are required.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await db.signUpShop(
        name.trim(),
        email.trim(),
        password,
        contract,
        rdb,
        businessType,
        discountScope,
        description,
      );
      if (res.success) {
        setSuccess(
          res.emailSent
            ? "Application received! Enter the verification code we emailed you."
            : "Application received! Ask an admin to verify your email, then wait for approval.",
        );
        setStep(res.emailSent ? "verify" : "done");
      } else {
        setError(res.error || "Could not submit your application.");
      }
    } catch (err: any) {
      setError(err?.message || "Registration error.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError(null);
    if (!verifyCode.trim()) {
      setVerifyError("Enter the verification code.");
      return;
    }
    setLoading(true);
    try {
      const res = await db.verifyEmailCode(email.trim(), verifyCode, "signup");
      if (res.success) {
        setSuccess("Email verified! Your shop is now waiting for admin approval.");
        setStep("done");
      } else {
        setVerifyError(res.error || "Invalid code.");
      }
    } catch (err: any) {
      setVerifyError(err?.message || "Verification error.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500";
  const labelCls = "block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="max-w-lg w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md p-6 sm:p-8 space-y-6">
        <div className="text-center">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-10 w-auto object-contain mx-auto mb-3" />
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
              <StoreIcon className="w-8 h-8" />
            </div>
          )}
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{siteName}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Join {siteName} as a partner outlet and start rewarding member cards.
          </p>
        </div>

        {step === "form" && (
          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div>
              <label className={labelCls}>Business Name</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Your Business Name" className={inputCls} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Business Type</label>
                <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className={inputCls}>
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t} value={t}>{BUSINESS_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Discount Applies To</label>
                <select value={discountScope} onChange={(e) => setDiscountScope(e.target.value)} className={inputCls}>
                  {DISCOUNT_SCOPES.map((s) => (
                    <option key={s} value={s}>{DISCOUNT_SCOPE_LABELS[s]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Short Description <span className="font-normal text-slate-400">(optional)</span></label>
              <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What makes your outlet a great partner?" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Email Address</label>
              <div className="relative">
                <MailIcon className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="shop@example.com" className={`${inputCls} pl-11`} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Password</label>
                <div className="relative">
                  <LockIcon className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                  <input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={`${inputCls} pl-11 pr-10`} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-slate-400">
                    {showPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className={labelCls}>Confirm Password</label>
                <div className="relative">
                  <LockIcon className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                  <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" className={`${inputCls} pl-11`} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Signed Contract <span className="font-normal text-slate-400">(optional)</span></label>
                <label className="flex items-center gap-2 w-full px-3 py-2.5 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                  <UploadIcon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{contract ? "Contract attached" : "Upload file"}</span>
                  <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0], setContract)} />
                </label>
              </div>
              <div>
                <label className={labelCls}>RDB Certificate <span className="font-normal text-slate-400">(optional)</span></label>
                <label className="flex items-center gap-2 w-full px-3 py-2.5 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                  <FileTextIcon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{rdb ? "RDB attached" : "Upload file"}</span>
                  <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0], setRdb)} />                </label>
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60">
              <StoreIcon className="w-4 h-4" />
              <span>{loading ? "Submitting..." : "Submit Application"}</span>
            </button>
          </form>
        )}

        {step === "verify" && (
          <form onSubmit={handleVerify} className="space-y-4 text-left">
            <div>
              <label className={labelCls}>Verification Code</label>
              <input type="text" required value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} placeholder="e.g. MA-123456" className={`${inputCls} font-mono tracking-wider`} />
            </div>
            <button type="submit" disabled={loading} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold uppercase tracking-wider cursor-pointer disabled:opacity-60">
              {loading ? "Verifying..." : "Verify Email"}
            </button>
            {verifyError && <div className="bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs text-center">{verifyError}</div>}
          </form>
        )}

        {step === "done" && (
          <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5 text-center space-y-2">
            <CheckIcon className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
            <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">Application submitted</p>
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              We&apos;ll review your shop and email you once it&apos;s approved. Then you can sign in at the shop portal.
            </p>
          </div>
        )}

        {error && <div className="bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs text-center">{error}</div>}
        {success && step === "verify" && <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 p-3 rounded-xl text-xs text-center">{success}</div>}

        <div className="text-center text-xs">
          <a href="/login" className="text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-bold cursor-pointer">
            Already registered? Sign in
          </a>
        </div>
      </div>
    </div>
  );
}
