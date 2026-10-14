import React, { useState } from "react";
import { db } from "../lib/supabase";
import { Lock as LockIcon, Mail as MailIcon, Eye as EyeIcon, EyeOff as EyeOffIcon, UserPlus as UserPlusIcon } from "../components/AdminIcons";
import ThemeToggle from "../components/ThemeToggle";

export default function RegisterPage({ onRegistered }: { onRegistered: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!name || !email || !password) { setError("All fields are required."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const res = await db.signUpAdmin(name, email, password);
      if (res.success) { setSuccess("Account created! Check your email for verification code."); setShowVerify(true); }
      else { setError(res.error || "Failed to create account."); }
    } catch (err: any) { setError(err?.message || "Registration error."); } finally { setLoading(false); }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError(null);
    if (!verifyCode) { setVerifyError("Enter the verification code."); return; }
    setLoading(true);
    try {
      const res = await db.verifyEmailCode(email, verifyCode, "signup");
      if (res.success) { setSuccess("Email verified! You can now sign in."); setTimeout(() => onRegistered(), 1500); }
      else { setVerifyError(res.error || "Invalid code."); }
    } catch (err: any) { setVerifyError(err?.message || "Verification error."); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md p-8 space-y-6">
        <div className="text-center"><div className="w-16 h-16 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto mb-4"><UserPlusIcon className="w-8 h-8" /></div><h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Create Admin Account</h2><p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Register a new administrator account</p></div>

        {!showVerify ? (
          <form onSubmit={handleRegister} className="space-y-4 text-left">
            <div><label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Full Name</label><input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marie Claire Uwineza" className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" /></div>
            <div><label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Email Address</label><div className="relative"><MailIcon className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-400" /><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" className="w-full pl-11 pr-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" /></div></div>
            <div><label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Password</label><div className="relative"><LockIcon className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-400" /><input type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full pl-11 pr-10 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-slate-400">{showPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}</button></div></div>
            <div><label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Confirm Password</label><div className="relative"><LockIcon className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-400" /><input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" className="w-full pl-11 pr-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" /></div></div>
            <button type="submit" disabled={loading} className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2"><UserPlusIcon className="w-4 h-4" /><span>{loading ? "Creating..." : "Create Account"}</span></button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4 text-left">
            <div><label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Verification Code</label><input type="text" required value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} placeholder="e.g. MA-123456" className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono tracking-wider" /></div>
            <button type="submit" disabled={loading} className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold uppercase tracking-wider cursor-pointer">{loading ? "Verifying..." : "Verify Email"}</button>
            {verifyError && <div className="bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs text-center">{verifyError}</div>}
          </form>
        )}

        {error && <div className="bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs text-center">{error}</div>}
        {success && !showVerify && <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 p-3 rounded-xl text-xs text-center">{success}</div>}
        {success && showVerify && !verifyError && <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 p-3 rounded-xl text-xs text-center">{success}</div>}

        <div className="text-center text-xs"><a href="#/login" className="text-slate-500 dark:text-slate-400 hover:text-purple-700 dark:hover:text-purple-300 font-bold cursor-pointer">Already have an account? Sign in</a></div>
      </div>
    </div>
  );
}

