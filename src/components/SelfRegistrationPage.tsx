import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db, buildCardUrl } from '../lib/supabase';
import { Shop, Customer, Customization } from '../types';
import { QRCodeCanvas } from 'qrcode.react';
import { jsPDF } from 'jspdf';
import {
  MemberCard,
  BrandMonogram,
  deriveCardBrand,
  deriveCardNumber,
  formatCardExpiry,
  type CardFace,
} from './MemberCard';
import {
  Store,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  X,
  Download,
  UserPlus,
  BadgeCheck,
  Clock,
  Shield,
} from './AdminIcons';
import ThemeToggle from './ThemeToggle';

// Public join URL (works with the app's HashRouter). Printed on the common
// counter QR so shoppers can self-register without any login.
export function buildJoinUrl(ref?: string): string {
  const base = `${window.location.origin}${window.location.pathname}#/join`;
  return ref ? `${base}?ref=${encodeURIComponent(ref)}` : base;
}

const PAY_PROVIDERS = ['MTN MoMo', 'Airtel Money'];

export default function SelfRegistrationPage() {
  const [searchParams] = useSearchParams();
  const initialRef = (searchParams.get('ref') || '').trim().toUpperCase();

  const [shops, setShops] = useState<Shop[]>([]);
  const [loadingShops, setLoadingShops] = useState(true);
  const [detailShop, setDetailShop] = useState<Shop | null>(null);

  // Registration form (deliberately NO email field; all members are general)
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [referee, setReferee] = useState(initialRef);
  const [refereeName, setRefereeName] = useState<string | null>(null);
  const [formMsg, setFormMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Issued card + subscription payment
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [provider, setProvider] = useState(PAY_PROVIDERS[0]);
  const [senderPhone, setSenderPhone] = useState('');
  const [txCode, setTxCode] = useState('');
  const [payMsg, setPayMsg] = useState('');
  const [paying, setPaying] = useState(false);
  const [copied, setCopied] = useState(false);

  // Card branding + which face of the card is on screen
  const [customization, setCustomization] = useState<Customization | null>(null);
  const [cardFace, setCardFace] = useState<CardFace>('front');

  const cardBrand = deriveCardBrand(customization?.title, customization?.card_brand);
  const cardWordmark = (customization?.card_wordmark || 'THE BEYOND').trim();
  const cardLogoUrl = customization?.card_logo_url || '';
  const systemLogoUrl = customization?.logo_url || '';

  useEffect(() => {
    db.getCustomization().then(setCustomization).catch(() => setCustomization(null));
  }, []);

  const carouselRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const list = await db.getShops();
        setShops(list.filter((s) => !s.status || s.status === 'approved'));
      } catch {
        setShops([]);
      } finally {
        setLoadingShops(false);
      }
    };
    load();
  }, []);

  // Validate a ?ref= code from a referrer's QR (public lookup).
  useEffect(() => {
    if (!initialRef) return;
    db.getCustomerByQRCode(initialRef).then((c) => {
      if (c) setRefereeName(c.name);
    }).catch(() => {});
  }, [initialRef]);

  const scrollCarousel = (dir: 1 | -1) => {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.8, 360), behavior: 'smooth' });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg('');
    if (!name.trim() || !phone.trim()) {
      setFormMsg('Please enter your full name and phone number.');
      return;
    }
    setSubmitting(true);
    try {
      const { customer: c, error } = await db.selfRegisterCustomer({
        name: name.trim(),
        phone: phone.trim(),
        customer_type: 'other',
        student_id: '',
        university: '',
        referee_number: referee.trim().toUpperCase(),
      });
      if (error || !c) {
        setFormMsg(error || 'Registration failed. Please try again.');
      } else {
        setCustomer(c);
        setSenderPhone(phone.trim());
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch {
      setFormMsg('Registration failed. Check your connection and retry.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    setPayMsg('');
    if (!senderPhone.trim() || !txCode.trim()) {
      setPayMsg('Enter the sender phone and the mobile-money transaction code.');
      return;
    }
    setPaying(true);
    try {
      const { customer: updated, error } = await db.activateCustomerSubscription({
        customerId: customer.id,
        provider,
        senderPhone: senderPhone.trim(),
        txCode: txCode.trim(),
      });
      if (error || !updated) {
        setPayMsg(error || 'Activation failed. Verify the transaction code and retry.');
      } else {
        setCustomer(updated);
        setPayMsg('');
      }
    } catch {
      setPayMsg('Activation failed. Check your connection and retry.');
    } finally {
      setPaying(false);
    }
  };

  // Member card as PDF — page 1 is the front face, page 2 the back face
  // (the back carries the QR code, exactly like the printed card).
  const handleDownloadOnlineCard = () => {
    if (!customer) return;
    const brand = deriveCardBrand(customization?.title, customization?.card_brand);
    const wordmark = (customization?.card_wordmark || 'THE BEYOND').trim();
    const number = deriveCardNumber(customer.qr_code);
    const expiry = formatCardExpiry(customer.valid_until);

    const doc = new jsPDF({ unit: 'mm', format: [86, 54] }); // CR80 card ratio
    const W = 86;
    const H = 54;

    /* ---------------------------- FRONT FACE ---------------------------- */
    doc.setFillColor(8, 13, 24);
    doc.rect(0, 0, W, H, 'F');
    // cyan glow edge
    doc.setDrawColor(0, 200, 240);
    doc.setLineWidth(0.5);
    doc.roundedRect(1, 1, W - 2, H - 2, 3, 3, 'S');

    // wordmark
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(wordmark.toUpperCase(), 6, 11);
    // gold rule
    doc.setDrawColor(232, 177, 58);
    doc.setLineWidth(0.4);
    doc.line(6, 13, 34, 13);

    // THE <BRAND> / DISCOUNT CARD
    doc.setTextColor(0, 200, 240);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(`THE ${brand}`, 6, 24);
    doc.text('DISCOUNT CARD', 6, 31);

    // gold monogram + caption
    doc.setTextColor(232, 177, 58);
    doc.setFontSize(20);
    doc.text(brand, 6, 46);
    doc.setFontSize(7);
    doc.text('DISCOUNT CARD', 22, 46);

    /* ----------------------------- BACK FACE ----------------------------- */
    doc.addPage([W, H], 'landscape');
    doc.setFillColor(8, 13, 24);
    doc.rect(0, 0, W, H, 'F');
    doc.setDrawColor(0, 200, 240);
    doc.setLineWidth(0.6);
    doc.roundedRect(1, 1, W - 2, H - 2, 3, 3, 'S');

    doc.setTextColor(0, 200, 240);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('SCAN', 6, 18);
    doc.setTextColor(255, 255, 255);
    doc.text('TO SAVE', 6, 26);

    doc.setDrawColor(232, 177, 58);
    doc.setLineWidth(0.4);
    doc.line(6, 29, 32, 29);

    doc.setTextColor(235, 240, 248);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text('Scan the QR code to check', 6, 35);
    doc.text('where the card can be used', 6, 38.5);

    // QR image from the rendered canvas
    try {
      const canvas = document.getElementById('selfreg-card-qr-canvas') as HTMLCanvasElement | null;
      if (canvas) {
        doc.addImage(canvas.toDataURL('image/png'), 'PNG', 55, 8, 24, 24);
      }
    } catch { /* QR is decorative; the card stays valid without it */ }

    // card number + expiry
    doc.setDrawColor(232, 177, 58);
    doc.setLineWidth(0.3);
    doc.roundedRect(30, 42, 18, 7, 1, 1, 'S');
    doc.roundedRect(50, 42, 30, 7, 1, 1, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 200, 240);
    doc.text(brand, 32, 47);
    doc.setTextColor(255, 255, 255);
    doc.text(number, 38, 47);
    doc.setTextColor(232, 177, 58);
    doc.setFontSize(5.5);
    doc.text('EXPIRES', 52, 44.4);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text(expiry, 52, 48.6);

    doc.save(`MA-Card-${customer.qr_code}.pdf`);
  };

  const handleDownloadReferralQR = () => {
    if (!customer) return;
    const canvas = document.getElementById('selfreg-referral-qr-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${customer.qr_code}-referral-qr.png`;
    link.click();
  };

  const handleCopyReferralLink = async () => {
    if (!customer) return;
    try {
      await navigator.clipboard.writeText(buildJoinUrl(customer.qr_code));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setFormMsg('Copy failed — long-press the link instead.');
    }
  };

  const isPaid = customer?.subscription_status === 'paid' && customer?.card_status === 'active';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 dark:from-slate-950 via-emerald-50/50 dark:via-emerald-950/20 to-teal-50/50 dark:to-teal-950/20 py-6 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top nav */}
        <div className="flex items-center justify-between gap-3">
          <a href="#/" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
            <BrandMonogram brand={cardBrand} className="w-8 h-8 rounded-lg text-xs" />
            <span>Home</span>
          </a>
          <div className="flex items-center gap-2">
            <a href="#/scan" className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 text-slate-700 dark:text-slate-200 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all">
              Scan &amp; Shop
            </a>
            <a href="#/login" className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all">
              Partner Login
            </a>
            <ThemeToggle />
          </div>
        </div>

        {customer ? (
          /* ============ SUCCESS: card issued ============ */
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Your card is ready, {customer.name.split(' ')[0]}!</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {isPaid
                    ? 'Subscription active — your 1-year physical card is being prepared.'
                    : 'Online card issued with 14-day access. Pay the subscription below to activate discounts.'}
                </p>
              </div>
              <div className="inline-block bg-slate-900 text-white rounded-2xl px-8 py-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Your Card ID</p>
                <p className="font-mono font-black text-2xl tracking-widest">{customer.qr_code}</p>
              </div>

              {/* The member card — same artwork as the admin portal.
                  Front face carries the brand, back face carries the QR. */}
              <div className="mx-auto w-fit space-y-3">
                <div className="flex rounded-full bg-slate-100 dark:bg-slate-800 p-1 w-fit mx-auto">
                  {(['front', 'back'] as CardFace[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setCardFace(f)}
                      className={
                        'px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ' +
                        (cardFace === f
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100')
                      }
                    >
                      {f === 'front' ? 'Front' : 'Back / QR'}
                    </button>
                  ))}
                </div>

                <div className="w-[min(380px,88vw)]">
                  <MemberCard
                    customer={customer}
                    face={cardFace}
                    brand={cardBrand}
                    wordmark={cardWordmark}
                    cardLogoUrl={cardLogoUrl}
                    systemLogoUrl={systemLogoUrl}
                  />
                </div>

                {/* Rendered QR canvas — used for the PDF download */}
                <div className="hidden">
                  <QRCodeCanvas id="selfreg-card-qr-canvas" value={buildCardUrl(customer.qr_code)} size={420} level="M" includeMargin />
                </div>

                <p className="text-[10px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                  Scan the code on the back at the partner counter &mdash; the cashier reads
                  your Card ID, or your phone opens the partner list.
                </p>
              </div>
              <div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider ${isPaid ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300'}`}>
                  {isPaid ? (<><BadgeCheck className="w-4 h-4" /> Active • valid until {customer.valid_until ? new Date(customer.valid_until).toLocaleDateString() : ''}</>) : (<><Clock className="w-4 h-4" /> Awaiting subscription payment</>)}
                </span>
              </div>
              {/* Timeline */}
              <div className="grid grid-cols-3 gap-2 max-w-lg mx-auto text-center">
                {[
                  { label: 'Registered', done: true },
                  { label: 'Subscription paid', done: !!isPaid },
                  { label: 'Physical 1-year card', done: false },
                ].map((s, i) => (
                  <div key={i} className={`rounded-xl border p-2.5 ${s.done ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
                    <p className={`text-[10px] font-black uppercase tracking-wider ${s.done ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400'}`}>Step {i + 1}</p>
                    <p className={`text-[11px] font-bold ${s.done ? 'text-emerald-800 dark:text-emerald-200' : 'text-slate-500 dark:text-slate-400'}`}>{s.label}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={handleDownloadOnlineCard}
                className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Download member card (PDF)</span>
              </button>
            </div>

            {/* Referral QR */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Your referring QR</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Friends scan it to open this same card-issuing form — with you as their referrer.</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-5 mt-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shrink-0">
                  <QRCodeCanvas id="selfreg-referral-qr-canvas" value={buildJoinUrl(customer.qr_code)} size={160} level="M" includeMargin />
                </div>
                <div className="flex-1 w-full space-y-3">
                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-600 dark:text-slate-300 break-all">
                    {buildJoinUrl(customer.qr_code)}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button onClick={handleDownloadReferralQR} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer inline-flex items-center justify-center gap-2">
                      <Download className="w-4 h-4" />
                      <span>Download QR</span>
                    </button>
                    <button onClick={handleCopyReferralLink} className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer">
                      {copied ? 'Copied!' : 'Copy referral link'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Subscription payment */}
            {!isPaid ? (
              <form onSubmit={handlePay} className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900 rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Activate with subscription payment</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Pay with mobile money, then enter the transaction code. Discounts unlock instantly for a full year.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Provider</label>
                    <select value={provider} onChange={(e) => setProvider(e.target.value)} className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      {PAY_PROVIDERS.map((p) => (<option key={p} value={p}>{p}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Sender phone</label>
                    <input type="tel" value={senderPhone} onChange={(e) => setSenderPhone(e.target.value)} placeholder="+2507..." className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Transaction code</label>
                    <input type="text" value={txCode} onChange={(e) => setTxCode(e.target.value)} placeholder="e.g. 123456789" className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>
                {payMsg && (
                  <div className="bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900 rounded-xl p-3 flex items-start gap-2 text-xs text-red-800 dark:text-red-300">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <span>{payMsg}</span>
                  </div>
                )}
                <button type="submit" disabled={paying} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer">
                  {paying ? 'Confirming payment...' : 'Confirm payment & activate card'}
                </button>
                <p className="text-[11px] text-slate-400 text-center">Paid at a counter instead? The shop or admin can activate your card — keep your Card ID safe.</p>
              </form>
            ) : (
              <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-3xl p-6 text-center">
                <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">Subscription active — show your Card ID ({customer.qr_code}) at any partner shop to save instantly.</p>
              </div>
            )}
          </div>
        ) : (
          /* ============ REGISTRATION ============ */
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm text-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100/70 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 rounded-full text-[10px] font-black uppercase tracking-widest">
                <UserPlus className="w-3.5 h-3.5" />
                Free self-registration • no email needed
              </span>
              <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-3">Get your Advantage Card</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl mx-auto">
                Register in under a minute and receive an online card with 14-day access right away.
                Pay the subscription to unlock discounts and receive your 1-year physical card.
              </p>
            </div>

            {/* Partner carousel */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Our partner shops</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Swipe through — tap a card for details</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => scrollCarousel(-1)} aria-label="Previous partners" className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 cursor-pointer">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button onClick={() => scrollCarousel(1)} aria-label="Next partners" className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 cursor-pointer">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {loadingShops ? (
                <p className="text-xs text-slate-400 py-8 text-center">Loading partners...</p>
              ) : shops.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">No partner shops yet — check back soon.</p>
              ) : (
                <div ref={carouselRef} className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-smooth py-3 -mx-1 px-1">
                  {shops.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setDetailShop(s)}
                      className="snap-start shrink-0 basis-[78%] sm:basis-[46%] lg:basis-[31%] text-left bg-gradient-to-br from-slate-50 dark:from-slate-950 to-emerald-50/60 dark:to-emerald-950/20 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 rounded-2xl p-4 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        {s.profile_picture ? (
                          <img src={s.profile_picture} alt={s.shop_name} className="w-14 h-14 rounded-2xl object-cover border border-slate-200 dark:border-slate-800" />
                        ) : (
                          <span className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-xl shrink-0">
                            {s.shop_name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-emerald-700">{s.shop_name}</p>
                          <span className="inline-block mt-0.5 bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{s.discount_percent}% OFF</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 min-h-[2rem]">
                        {s.description || 'Tap to learn more about this partner.'}
                      </p>
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 group-hover:underline">View details →</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Registration form */}
            <form onSubmit={handleRegister} className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Card issuing form</h3>
              {initialRef && (
                <div className={`rounded-xl p-3 text-xs flex items-start gap-2 ${refereeName ? 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200' : 'bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300'}`}>
                  {refereeName ? (
                    <><BadgeCheck className="w-4 h-4 shrink-0 mt-0.5" /><span>Referred by <strong>{refereeName}</strong> ({initialRef}) — they earn rewards when you shop.</span></>
                  ) : (
                    <><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span>Referrer {initialRef} was not found — you can still register, or correct the code below.</span></>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Full name *</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jean Bosco" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Phone number *</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+2507..." className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Referrer Card ID (optional)</label>
                <input type="text" value={referee} onChange={(e) => setReferee(e.target.value.toUpperCase())} placeholder="e.g. CUST-001" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              {formMsg && (
                <div className="bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900 rounded-xl p-3 flex items-start gap-2 text-xs text-red-800 dark:text-red-300">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{formMsg}</span>
                </div>
              )}
              <button type="submit" disabled={submitting} className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-sm font-bold uppercase tracking-wider cursor-pointer inline-flex items-center justify-center gap-2">
                <UserPlus className="w-4 h-4" />
                <span>{submitting ? 'Issuing your card...' : 'Issue my online card'}</span>
              </button>
              <p className="text-[11px] text-slate-400 text-center">No email required. Your 14-day online card is free — subscription payment activates discounts + the 1-year physical card.</p>
            </form>
          </div>
        )}

        {/* Partner detail modal */}
        {detailShop && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setDetailShop(null)}>
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="bg-gradient-to-br from-emerald-700 to-teal-800 p-6 text-white relative">
                <button onClick={() => setDetailShop(null)} aria-label="Close details" className="absolute top-4 right-4 p-1.5 bg-white/15 hover:bg-white/25 rounded-lg cursor-pointer">
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
                  <div>
                    <h3 className="text-lg font-black">{detailShop.shop_name}</h3>
                    <span className="inline-block mt-1 bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-200 text-[11px] font-black px-2.5 py-0.5 rounded-full">{detailShop.discount_percent}% MEMBER DISCOUNT</span>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-3 text-sm">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">About this partner</p>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{detailShop.description || 'A verified Mi Advantage partner. Show your member card at the counter to save instantly on every visit.'}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Contact</p>
                    <p className="font-bold text-slate-700 dark:text-slate-200 break-all">{detailShop.email}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Partner since</p>
                    <p className="font-bold text-slate-700 dark:text-slate-200">{detailShop.created_at ? new Date(detailShop.created_at).toLocaleDateString() : '—'}</p>
                  </div>
                </div>
                <a href="#/scan" className="block text-center py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider">
                  Shop with my card
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
