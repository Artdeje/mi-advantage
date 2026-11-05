import {
  Customer,
  Shop,
  Sale,
  Product,
  AuditLog,
  Customization,
  AuthUser,
  Admin,
  VerificationCode,
} from "../types";
import { getSupabase, updateSupabaseClient, resetSupabaseClient } from "./supabaseClient";
import {
  sendEmail,
  codeEmailTemplate,
  approvalEmailTemplate,
  rejectionEmailTemplate,
} from "./email";

// Feature flags for optional customers columns that ship via migrations.
// v3: customer_type / student_id / university (supabase-migration-v3.sql)
// v4: referee_number / card_status (supabase-migration-v4.sql)
// v5: credit_status (supabase-migration-v5.sql)
// Each falls back gracefully when its columns are missing.
let customerV3ColumnsReady: boolean | null = null;
let customerV4ColumnsReady: boolean | null = null;
let customerV5ColumnsReady: boolean | null = null;
  let customerV6ColumnsReady: boolean | null = null;
  let shopV7ColumnsReady: boolean | null = null;

  async function areShopV7ColumnsReady(): Promise<boolean> {
    if (shopV7ColumnsReady !== null) return shopV7ColumnsReady;
    try {
      const { error } = await getSupabase()
        .from("shops")
        .select("business_type")
        .limit(1);
      shopV7ColumnsReady = !error;
    } catch {
      shopV7ColumnsReady = false;
    }
    return shopV7ColumnsReady;
  }

  const PAGE_SIZE = 1000;
  async function fetchAllPaged<T>(
    table: string,
    orderCol: string,
    ascending: boolean,
    applyFilters?: (q: any) => any,
  ): Promise<T[]> {
    const all: T[] = [];
    for (let from = 0; from <= 500000; from += PAGE_SIZE) {
      try {
        let q: any = getSupabase()
          .from(table)
          .select("*")
          .order(orderCol, { ascending });
        if (applyFilters) q = applyFilters(q);
        const { data, error } = await q.range(from, from + PAGE_SIZE - 1);
        if (error || !data) break;
        const batch = data as T[];
        all.push(...batch);
        if (batch.length < PAGE_SIZE) break;
      } catch {
        break;
      }
    }
    return all;
  }

// Pull a CUST-###/SHOP-#### token out of any scanned payload — a bare code, a
// referral link (?ref=), a shop deep link (?shop=), or a card link (?card=).
// Returns the first full token uppercased, or the trimmed text uppercased when
// no token matches.
export function extractScanCode(raw: string): string {
  const text = (raw || "").trim();
  if (!text) return "";
  const token = text.match(/(?:CUST|SHOP)-\d{2,}/i);
  if (token) return token[0].toUpperCase();
  const queryIndex = text.indexOf("?");
  if (queryIndex >= 0) {
    try {
      const params = new URLSearchParams(text.slice(queryIndex + 1));
      const p =
        params.get("shop") ||
        params.get("ref") ||
        params.get("code") ||
        params.get("card");
      if (p) return decodeURIComponent(p).trim().toUpperCase();
    } catch {
      /* not a query string — fall through */
    }
  }
  return text.toUpperCase();
}

// Deep link encoded into a shop counter QR — the staff entrance. Scanning it
// opens the sign-in screen with the company email pre-filled (only the
// password is typed), then lands in the company scanner with the outlet
// pre-selected. The direct /scan?shop=<code> deep link stays available for
// the public terminal form.
export function buildShopUrl(shop: { qr_code?: string | null; id?: string; email: string }): string {
  const code = (shop.qr_code || shop.id || "").trim();
  const base = `${window.location.origin}/login`;
  return `${base}?shop=${encodeURIComponent(shop.email)}&shopQr=${encodeURIComponent(code)}`;
}

// Deep link encoded into a MEMBER CARD QR.
//  - Scanned by our system terminal  -> the CUST-### token is extracted and
//    autofills the discount form.
//  - Scanned by an external phone camera -> the link opens the scan page, which
//    authenticates the card and shows the partner directory.
export function buildCardUrl(code: string): string {
  const base = `${window.location.origin}/scan`;
  return code ? `${base}?card=${encodeURIComponent(code)}` : base;
}

// Shop business category + which catalog the discount covers. Used by the shop
// registration form, the admin Add-Shop modal, and the scan terminals.
export const BUSINESS_TYPES = ["retail", "restaurant", "cafe", "hotel", "services", "other"] as const;
export const DISCOUNT_SCOPES = ["all", "drinks", "food", "rooms", "services"] as const;

export const BUSINESS_TYPE_LABELS: Record<string, string> = {
  retail: "Retail / Shop",
  restaurant: "Restaurant",
  cafe: "Cafe / Bar",
  hotel: "Hotel / Lodging",
  services: "Services",
  other: "Other",
};

export const DISCOUNT_SCOPE_LABELS: Record<string, string> = {
  all: "All items",
  drinks: "Drinks only",
  food: "Food only",
  rooms: "Rooms only",
  services: "Services only",
};

export function normalizeBusinessType(v?: string): string {
  const s = (v || "").toLowerCase().trim();
  return (BUSINESS_TYPES as readonly string[]).includes(s) ? s : "retail";
}

export function normalizeDiscountScope(v?: string): string {
  const s = (v || "").toLowerCase().trim();
  return (DISCOUNT_SCOPES as readonly string[]).includes(s) ? s : "all";
}

async function areCustomerV3ColumnsReady(): Promise<boolean> {
  if (customerV3ColumnsReady !== null) return customerV3ColumnsReady;
  try {
    const { error } = await getSupabase()
      .from("customers")
      .select("customer_type")
      .limit(1);
    customerV3ColumnsReady = !error;
  } catch {
    customerV3ColumnsReady = false;
  }
  return customerV3ColumnsReady;
}

async function areCustomerV4ColumnsReady(): Promise<boolean> {
  if (customerV4ColumnsReady !== null) return customerV4ColumnsReady;
  try {
    const { error } = await getSupabase()
      .from("customers")
      .select("referee_number,card_status")
      .limit(1);
    customerV4ColumnsReady = !error;
  } catch {
    customerV4ColumnsReady = false;
  }
  return customerV4ColumnsReady;
}

async function areCustomerV5ColumnsReady(): Promise<boolean> {
  if (customerV5ColumnsReady !== null) return customerV5ColumnsReady;
  try {
    const { error } = await getSupabase()
      .from("customers")
      .select("credit_status")
      .limit(1);
    customerV5ColumnsReady = !error;
  } catch {
    customerV5ColumnsReady = false;
  }
  return customerV5ColumnsReady;
}

// v6: subscription_status (mysql-migration-selfreg.sql)
async function areCustomerV6ColumnsReady(): Promise<boolean> {
  if (customerV6ColumnsReady !== null) return customerV6ColumnsReady;
  try {
    const { error } = await getSupabase()
      .from("customers")
      .select("subscription_status")
      .limit(1);
    customerV6ColumnsReady = !error;
  } catch {
    customerV6ColumnsReady = false;
  }
  return customerV6ColumnsReady;
}

// Single source of truth for a card's current status.
// A card whose expiration date/time has been REACHED is immediately marked for
// renewal and is never accessible at scan terminals. 'expired' is treated as a
// legacy alias of 'renew'.
export type CardStatusProbe = {
  card_status?: string;
  valid_until?: string;
  subscription_status?: string;
};

export function isCustomerCardExpired(c: CardStatusProbe): boolean {
  if (!c.valid_until) return false;
  let expiry: Date;
  const v = c.valid_until.trim();
  if (v.includes("T")) {
    expiry = new Date(v);
  } else if (v.includes(" ")) {
    expiry = new Date(v.replace(" ", "T"));
  } else {
    // Date-only format (e.g. "2026-10-16"): valid through the end of that day
    expiry = new Date(`${v}T23:59:59.999`);
  }
  if (isNaN(expiry.getTime())) return false;
  return new Date() > expiry;
}

export function getCustomerCardStatus(
  c: CardStatusProbe,
): "active" | "renew" | "suspended" {
  if (c.card_status === "suspended") return "suspended";
  if (isCustomerCardExpired(c)) return "renew";
  return "active";
}

// Returns the exact message that blocks a card at a scan terminal, or null if
// the card may be used. Guarantees the ONLY message shown for expired cards is
// "Renew your subscription".
//
// A card is considered usable when:
//   - card_status is NOT "suspended" (admin-imposed block), AND
//   - valid_until has NOT been reached (not expired → "renew").
//
// subscription_status is informational only — an active, in-date membership
// card works regardless of whether the subscription payment has been marked
// "paid" in the system. This prevents valid active cards from showing
// "Invalid card" at scan terminals.
export function getCustomerCardBlockReason(c: CardStatusProbe): string | null {
  if (c.card_status === "suspended") return "Card suspended. Contact the administrator.";
  if (isCustomerCardExpired(c)) return "Renew your subscription";
  return null;
}

// True when a Postgres insert failed only because customers.email is still
// declared NOT NULL on that database (the intended schema makes it nullable
// so email-less cards can be issued).
export function isEmailNotNullError(error: unknown): boolean {
  const msg =
    typeof error === "string"
      ? error
      : (error as any)?.message || (error as any)?.error || "";
  const text = String(msg).toLowerCase();
  return (
    text.includes("not-null") ||
    text.includes("not null") ||
    (text.includes("email") && text.includes("null value"))
  );
}

// Short, user-facing validation outcome shown at the scan terminal.
export type CardScanOutcome = {
  valid: boolean;
  message: string;
  detail: string;
};

export function getCardScanOutcome(c: CardStatusProbe): CardScanOutcome {
  if (c.card_status === "suspended") {
    return {
      valid: false,
      message: "Renew subscription",
      detail: "This card is suspended. Please contact the administrator.",
    };
  }
  if (isCustomerCardExpired(c)) {
    return {
      valid: false,
      message: "Renew subscription",
      detail: "This card has expired. Renew the subscription to keep using it.",
    };
  }
  return {
    valid: true,
    message: "Card is valid",
    detail: "This member card is active and can be used for a discount.",
  };
}

// Next sequential card ID (CUST-001, CUST-002, ...) skipping taken codes.
// Shared by admin issuing and the public self-registration endpoint logic.
export function nextSequentialCustomerCode(takenCodes: string[]): string {
  const taken = new Set(takenCodes.map((c) => (c || "").toUpperCase().trim()));
  const usedNums = new Set<number>();
  for (const code of taken) {
    const m = /^CUST-(\d+)$/.exec(code);
    if (m) usedNums.add(parseInt(m[1], 10));
  }
  let n = 1;
  while (usedNums.has(n) || taken.has(`CUST-${String(n).padStart(3, "0")}`)) n++;
  return `CUST-${String(n).padStart(3, "0")}`;
}

export interface ProductInput {
  name: string;
  price: number | "";
  stock: number | "";
  description?: string;
  status?: string;
}

// Pure product validation shared by the shop UI (and unit tests).
// Returns an error message, or null when the input is valid.
export function validateProductInput(input: ProductInput): string | null {
  if (!input.name.trim()) return "Product name is required.";
  if (input.price === "" || !Number.isFinite(Number(input.price)))
    return "Price must be a valid number.";
  if (Number(input.price) < 0) return "Price must be 0 or more.";
  if (
    input.stock === "" ||
    !Number.isInteger(Number(input.stock)) ||
    Number(input.stock) < 0
  )
    return "Stock must be a whole number (0 or more).";
  if ((input.description || "").length > 500)
    return "Description is too long (max 500 characters).";
  if (
    input.status !== undefined &&
    input.status !== "active" &&
    input.status !== "hidden"
  )
    return "Invalid product status.";
  return null;
}

const DEFAULT_CUSTOMIZATION: Customization = {
  theme_color: 'green',
  logo_url: '',
  card_brand: '',
  card_logo_url: '',
  card_wordmark: '',
  title: 'Mi Advantage',
  subtitle: '',
  scan_title: 'Member Scan & Loyalty Terminal',
  scan_subtitle: 'Scan customer membership cards in real-time to compute discounts and record transaction logs.',
  favicon_url: '',
  home_h1: '',
  home_h2: '',
  home_p: '',
  login_heading: 'Sign In',
  login_subtext: '',
  signup_heading: 'Create Admin Account',
  signup_subtext: '',
  primary_color: '#059669',
  secondary_color: '#0d9488',
  accent_color: '#f59e0b',
  background_color: '#f8fafc',
  font_family: 'Inter',
  heading_font: 'Space Grotesk',
  login_background_type: 'gradient',
  login_background_value: 'linear-gradient(135deg, #f8fafc 0%, #ecfdf5 100%)',
  home_background_type: 'image',
  home_background_value: '',
  feature1_title: 'Partner Outlets',
  feature1_desc: 'Verified merchants offer exclusive member discounts.',
  feature2_title: 'Instant Savings',
  feature2_desc: 'Discounts are computed in real-time at the checkout terminal.',
  feature3_title: 'Member Cards',
  feature3_desc: 'Every member gets unique QR credentials.',
  custom_css: '',
};
export class SupabaseDatabaseService {
  updateConfig(url: string, key: string) {
    return updateSupabaseClient(url, key);
  }

  resetConfig() {
    return resetSupabaseClient();
  }

  getCurrentConfig() {
    const useCustomConfig =
      localStorage.getItem("mi_supabase_config_override") === "true";
    return {
      url:
        (useCustomConfig && localStorage.getItem("mi_supabase_url")) ||
        import.meta.env.VITE_SUPABASE_URL ||
        "https://wbldciermnpgmlsookrs.supabase.co",
      key:
        (useCustomConfig && localStorage.getItem("mi_supabase_anon_key")) ||
        import.meta.env.VITE_SUPABASE_ANON_KEY ||
        "",
      isOverridden: useCustomConfig,
    };
  }

  get currentUser(): AuthUser | null {
    const user = localStorage.getItem("mi_auth_user");
    return user ? JSON.parse(user) : null;
  }
  set currentUser(val: AuthUser | null) {
    if (val) {
      localStorage.setItem("mi_auth_user", JSON.stringify(val));
    } else {
      localStorage.removeItem("mi_auth_user");
    }
  }

  async getAdmins(): Promise<Admin[]> {
    try {
      const { data, error } = await getSupabase()
        .from("admins")
        .select("*")
        .order("created_at", { ascending: true });
      if (!error && data) return data as Admin[];
    } catch (e) {
      console.warn("Supabase admins fetch failed:", e);
    }
    return [];
  }

  async createAdmin(
    name: string,
    email: string,
    pass: string,
    role: "super_admin" | "admin" | "manager" = "admin",
  ): Promise<{ admin: Admin | null; error: string | null }> {
    const currentAdmins = await this.getAdmins();
    if (
      currentAdmins.some((a) => a.email.toLowerCase() === email.toLowerCase())
    ) {
      return {
        admin: null,
        error: "An administrator with this email already exists!",
      };
    }

    const newAdmin: Admin = {
      id: "admin-" + Date.now(),
      name,
      email: email.toLowerCase().trim(),
      password: pass,
      role,
      status: "active",
      email_verified: false,
      created_at: new Date().toISOString(),
    };

    try {
      const { error } = await getSupabase().from("admins").insert([newAdmin]);
      if (error) return { admin: null, error: error.message };
    } catch (e: any) {
      return { admin: null, error: e?.message || "Insert failed" };
    }

    // Send email verification code - new admins must verify before signing in
    await this.sendVerificationCode(newAdmin.email, "admin");

    await this.addLog(
      "Admin Created",
      "Admin",
      this.currentUser?.email || "unknown",
      `Registered new administrator account: ${name} (${email}) with role ${role}. Verification email sent.`,
    );
    return { admin: newAdmin, error: null };
  }

  async updateAdmin(
    id: string,
    updates: Partial<Admin>,
  ): Promise<{ admin: Admin | null; error: string | null }> {
    try {
      const { data, error } = await getSupabase()
        .from("admins")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) return { admin: null, error: error.message };

      await this.addLog(
        "Admin Updated",
        "Admin",
        this.currentUser?.email || "unknown",
        `Updated profile settings for admin: ${data?.name || id}.`,
      );
      return { admin: data as Admin, error: null };
    } catch (e: any) {
      return { admin: null, error: e?.message || "Update failed" };
    }
  }

  async deleteAdmin(
    id: string,
  ): Promise<{ success: boolean; error: string | null }> {
    const currentAdmins = await this.getAdmins();
    if (currentAdmins.length <= 1) {
      return {
        success: false,
        error: "Cannot delete the only remaining administrator account.",
      };
    }

    const admin = currentAdmins.find((a) => a.id === id);
    if (admin?.role === "super_admin") {
      return {
        success: false,
        error: "The super admin account cannot be deleted.",
      };
    }
    try {
      const { error } = await getSupabase().from("admins").delete().eq("id", id);
      if (error) return { success: false, error: error.message };

      await this.addLog(
        "Admin Deleted",
        "Admin",
        this.currentUser?.email || "unknown",
        `Removed admin account: ${admin?.name || id}.`,
      );
      return { success: true, error: null };
    } catch (e: any) {
      return { success: false, error: e?.message || "Delete failed" };
    }
  }

  async getShops(): Promise<Shop[]> {
    return fetchAllPaged<Shop>("shops", "created_at", true);
  }

  // Generate a unique public guest-scan code (SHOP-####) for a shop.
  private async generateUniqueShopQRCode(): Promise<string> {
    const shops = await this.getShops();
    const taken = new Set(
      shops.map((s) => (s.qr_code || "").toUpperCase()).filter(Boolean),
    );
    for (let attempt = 0; attempt < 50; attempt++) {
      const code = `SHOP-${Math.floor(1000 + Math.random() * 9000)}`;
      if (!taken.has(code)) return code;
    }
    // Fallback: timestamp-suffixed (still matches SHOP- prefix convention)
    return `SHOP-${Date.now().toString().slice(-6)}`;
  }

  // Public guest lookup: find an approved shop by its QR code (exact match).
  // Safe for unauthenticated use — getShops() is a public endpoint.
  async getShopByQRCode(qrCode: string): Promise<Shop | null> {
    const clean = extractScanCode(qrCode);
    if (!clean) return null;
    const shops = await this.getShops();
    const match =
      shops.find(
        (s) => (s.qr_code || "").toLowerCase() === clean.toLowerCase(),
      ) ||
      shops.find((s) => s.id.toLowerCase() === clean.toLowerCase()) ||
      null;
    if (!match) return null;
    if (match.status && match.status !== "approved") return null;
    return match;
  }

  // Admin maintenance: give every shop missing a guest-scan QR a unique one.
  // Returns the number of shops fixed (0 = all valid already).
  async ensureAllShopQRCodes(): Promise<{ fixed: number; error: string | null }> {
    try {
      const shops = await this.getShops();
      const taken = new Set(
        shops.map((s) => (s.qr_code || "").toUpperCase()).filter(Boolean),
      );
      let fixed = 0;
      for (const shop of shops) {
        if (shop.qr_code && shop.qr_code.trim()) continue;
        let code = "";
        for (let attempt = 0; attempt < 50 && !code; attempt++) {
          const c = `SHOP-${Math.floor(1000 + Math.random() * 9000)}`;
          if (!taken.has(c)) code = c;
        }
        if (!code) code = `SHOP-${Date.now().toString().slice(-6)}`;
        const { error } = await this.updateShop(shop.id, { qr_code: code });
        if (error) {
          return {
            fixed,
            error: error.includes("column")
              ? "Database needs the shop QR column: run supabase-schema.sql in the Supabase SQL Editor, then retry."
              : error,
          };
        }
        taken.add(code);
        fixed++;
      }
      return { fixed, error: null };
    } catch (e: any) {
      return { fixed: 0, error: e?.message || "Failed to fix shop QR codes." };
    }
  }

  // ---- Product / menu catalog (per shop) ----
  async getProducts(shopId?: string): Promise<Product[]> {
    return fetchAllPaged<Product>("products", "created_at", false, (q) =>
      shopId ? q.eq("shop_id", shopId) : q,
    );
  }

  async createProduct(
    shopId: string,
    input: ProductInput,
  ): Promise<{ product: Product | null; error: string | null }> {
    const validation = validateProductInput(input);
    if (validation) return { product: null, error: validation };
    const newProduct: Product = {
      id: "prod-" + Date.now(),
      shop_id: shopId,
      name: input.name.trim(),
      price: Number(input.price) || 0,
      stock: Math.floor(Number(input.stock)) || 0,
      description: (input.description || "").trim(),
      status: input.status === "hidden" ? "hidden" : "active",
      created_at: new Date().toISOString(),
    };
    try {
      const { error } = await getSupabase()
        .from("products")
        .insert([newProduct]);
      if (error) {
        return {
          product: null,
            error: error.message.includes("products")
              ? "Database needs the products table: run supabase-schema.sql in the Supabase SQL Editor, then retry."
              : error.message,
        };
      }
    } catch (e: any) {
      return { product: null, error: e?.message || "Insert failed" };
    }
    await this.addLog(
      "Product Created",
      "Shop",
      this.currentUser?.email || "unknown",
      `Added product ${newProduct.name} (${newProduct.price} RWF) to the menu.`,
    );
    return { product: newProduct, error: null };
  }

  async updateProduct(
    id: string,
    updates: Partial<Product>,
  ): Promise<{ product: Product | null; error: string | null }> {
    try {
      const patch: Partial<Product> = {};
      if (updates.name !== undefined) {
        if (!updates.name.trim()) return { product: null, error: "Product name is required." };
        patch.name = updates.name.trim();
      }
      if (updates.price !== undefined) {
        if (!Number.isFinite(Number(updates.price)) || Number(updates.price) < 0)
          return { product: null, error: "Price must be 0 or more." };
        patch.price = Number(updates.price);
      }
      if (updates.stock !== undefined) {
        if (!Number.isInteger(Number(updates.stock)) || Number(updates.stock) < 0)
          return { product: null, error: "Stock must be a whole number (0 or more)." };
        patch.stock = Math.floor(Number(updates.stock));
      }
      if (updates.description !== undefined) {
        if (updates.description.length > 500)
          return { product: null, error: "Description is too long (max 500 characters)." };
        patch.description = updates.description;
      }
      if (updates.status !== undefined) {
        if (updates.status !== "active" && updates.status !== "hidden")
          return { product: null, error: "Invalid product status." };
        patch.status = updates.status;
      }
      if (updates.image_url !== undefined) patch.image_url = updates.image_url;
      if (Object.keys(patch).length === 0)
        return { product: null, error: "No changes to save." };
      const { data, error } = await getSupabase()
        .from("products")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) return { product: null, error: error.message };
      await this.addLog(
        "Product Updated",
        "Shop",
        this.currentUser?.email || "unknown",
        `Updated product ${(data as Product)?.name || id}.`,
      );
      return { product: data as Product, error: null };
    } catch (e: any) {
      return { product: null, error: e?.message || "Update failed" };
    }
  }

  async deleteProduct(id: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error } = await getSupabase().from("products").delete().eq("id", id);
      if (error) return { success: false, error: error.message };
      await this.addLog(
        "Product Deleted",
        "Shop",
        this.currentUser?.email || "unknown",
        `Removed product ${id} from the menu.`,
      );
      return { success: true, error: null };
    } catch (e: any) {
      return { success: false, error: e?.message || "Delete failed" };
    }
  }

  async createShop(
    name: string,
    discount: number,
    email: string,
    pass: string,
    description?: string,
    businessType?: string,
    discountScope?: string,
  ): Promise<{ shop: Shop | null; error: string | null }> {
    const currentShops = await this.getShops();
    if (
      currentShops.some((s) => s.email.toLowerCase() === email.toLowerCase())
    ) {
      return { shop: null, error: "A shop with this email already exists!" };
    }

    const newShop: Shop = {
      id: "shop-" + Date.now(),
      shop_name: name,
      discount_percent: discount,
      email: email,
      password: pass,
      qr_code: await this.generateUniqueShopQRCode(),
      description: description?.trim() || undefined,
      status: "approved",
      email_verified: true,
      created_at: new Date().toISOString(),
    };
    if (await areShopV7ColumnsReady()) {
      newShop.business_type = normalizeBusinessType(businessType);
      newShop.discount_scope = normalizeDiscountScope(discountScope);
    }

    try {
      const { error } = await getSupabase().from("shops").insert([newShop]);
      if (error) return { shop: null, error: error.message };
    } catch (e: any) {
      return { shop: null, error: e?.message || "Insert failed" };
    }

    await this.addLog(
      "Shop Created",
      "Admin",
      this.currentUser?.email || "unknown",
      `Registered new shop ${name} with ${discount}% discount (admin-approved).`,
    );
    return { shop: newShop, error: null };
  }

  // Shop self-registration: starts pending, requires email verification + admin approval
  async signUpShop(
    name: string,
    email: string,
    pass: string,
    contract: string,
    rdbCertificate: string,
    businessType?: string,
    discountScope?: string,
    description?: string,
  ): Promise<{ success: boolean; emailSent: boolean; error: string | null }> {
    const cleanEmail = email.toLowerCase().trim();

    const { data: existing, error: lookupError } = await getSupabase()
      .from("shops")
      .select("id,email")
      .ilike("email", cleanEmail)
      .maybeSingle();
    if (lookupError) {
      return { success: false, emailSent: false, error: "Database error: " + lookupError.message };
    }
    if (existing) {
      return {
        success: false,
        emailSent: false,
        error: "A shop with this email is already registered. Sign in or use password recovery.",
      };
    }

    const newShop: Shop = {
      id: "shop-" + Date.now(),
      shop_name: name,
      discount_percent: 10,
      email: cleanEmail,
      password: pass,
      qr_code: await this.generateUniqueShopQRCode(),
      description: description?.trim() || undefined,
      status: "pending",
      contract: contract || undefined,
      rdb_certificate: rdbCertificate || undefined,
      email_verified: false,
      created_at: new Date().toISOString(),
    };
    if (await areShopV7ColumnsReady()) {
      newShop.business_type = normalizeBusinessType(businessType);
      newShop.discount_scope = normalizeDiscountScope(discountScope);
    }

    const { error: insertError } = await getSupabase()
      .from("shops")
      .insert([newShop]);
    if (insertError) {
      if (insertError.message.includes("column")) {
        return {
          success: false,
          emailSent: false,
          error: "Database migration required. Run supabase-migration.sql in your Supabase SQL Editor, then npm run db:init.",
        };
      }
      return { success: false, emailSent: false, error: insertError.message };
    }

    const emailSent = await this.sendVerificationCode(cleanEmail, "shop");

    await this.addLog(
      "Shop Application Submitted",
      "Shop",
      cleanEmail,
      `New shop application: ${name}. Status: pending approval. Verification email ${emailSent ? "sent" : "failed"}.`,
    );
    return { success: true, emailSent, error: null };
  }

  async approveShop(
    id: string,
  ): Promise<{ success: boolean; error: string | null }> {
    const shops = await this.getShops();
    const shop = shops.find((s) => s.id === id);
    if (!shop) return { success: false, error: "Shop not found." };

    const { error } = await getSupabase()
      .from("shops")
      .update({ status: "approved" })
      .eq("id", id);
    if (error) return { success: false, error: error.message };

    await sendEmail(
      shop.email,
      "Your Mi Advantage shop application is approved",
      approvalEmailTemplate(shop.shop_name),
    );

    await this.addLog(
      "Shop Approved",
      "Admin",
      this.currentUser?.email || "unknown",
      `Approved shop application: ${shop.shop_name} (${shop.email}).`,
    );
    return { success: true, error: null };
  }

  async rejectShop(
    id: string,
  ): Promise<{ success: boolean; error: string | null }> {
    const shops = await this.getShops();
    const shop = shops.find((s) => s.id === id);
    if (!shop) return { success: false, error: "Shop not found." };

    const { error } = await getSupabase()
      .from("shops")
      .update({ status: "rejected" })
      .eq("id", id);
    if (error) return { success: false, error: error.message };

    await sendEmail(
      shop.email,
      "Update on your Mi Advantage shop application",
      rejectionEmailTemplate(shop.shop_name),
    );

    await this.addLog(
      "Shop Rejected",
      "Admin",
      this.currentUser?.email || "unknown",
      `Rejected shop application: ${shop.shop_name} (${shop.email}).`,
    );
    return { success: true, error: null };
  }

  // --- Email verification codes (stored in DB, sent via Gmail SMTP) ---

  async sendVerificationCode(
    email: string,
    userType: "admin" | "shop",
    purpose: "signup" | "password_reset" = "signup",
  ): Promise<boolean> {
    const cleanEmail = email.toLowerCase().trim();
    const code = "MA-" + Math.floor(100000 + Math.random() * 900000);
    const record: Partial<VerificationCode> = {
      id: "vcode-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      email: cleanEmail,
      code,
      purpose,
      user_type: userType,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      used: false,
    };

    const { error } = await getSupabase()
      .from("verification_codes")
      .insert([record]);
    if (error) {
      console.error("Could not store verification code:", error.message);
      return false;
    }

    const subject =
      purpose === "signup"
        ? "Verify your Mi Advantage account"
        : "Mi Advantage password reset code";
    const purposeText =
      purpose === "signup"
        ? "Use this code to verify your email address and activate your account:"
        : "Use this code to reset your account password:";
    const result = await sendEmail(cleanEmail, subject, codeEmailTemplate(code, purposeText));
    return result.success;
  }

  async verifyEmailCode(
    email: string,
    code: string,
    purpose: "signup" | "password_reset" = "signup",
  ): Promise<{ success: boolean; userType: "admin" | "shop" | null; error: string | null }> {
    const cleanEmail = email.toLowerCase().trim();
    // Use the server's public verification endpoint (no auth required)
    const API_BASE = import.meta.env.VITE_API_URL || "";
    try {
      const res = await fetch(`${API_BASE}/api/db/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, code: code.trim(), purpose }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { success: false, userType: null, error: body.error || "Verification failed." };
      return { success: true, userType: body.userType || null, error: null };
    } catch (e: any) {
      return { success: false, userType: null, error: e?.message || "Verification failed." };
    }
  }

  async updateShop(
    id: string,
    updates: Partial<Shop>,
  ): Promise<{ shop: Shop | null; error: string | null }> {
    try {
      const patch: Partial<Shop> = { ...updates };
      // Drop the v7 fields when their columns are missing so a plain shop edit
      // never fails on an un-migrated database.
      if (await areShopV7ColumnsReady()) {
        if (patch.business_type !== undefined)
          patch.business_type = normalizeBusinessType(patch.business_type);
        if (patch.discount_scope !== undefined)
          patch.discount_scope = normalizeDiscountScope(patch.discount_scope);
      } else {
        delete patch.business_type;
        delete patch.discount_scope;
      }
      const { data, error } = await getSupabase()
        .from("shops")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) return { shop: null, error: error.message };

      await this.addLog(
        "Shop Updated",
        "Admin",
        this.currentUser?.email || "unknown",
        `Updated configurations for shop: ${data?.shop_name || id}.`,
      );
      return { shop: data as Shop, error: null };
    } catch (e: any) {
      return { shop: null, error: e?.message || "Update failed" };
    }
  }

  async deleteShop(
    id: string,
  ): Promise<{ success: boolean; error: string | null }> {
    const shop = (await this.getShops()).find((s) => s.id === id);
    try {
      const { error } = await getSupabase().from("shops").delete().eq("id", id);
      if (error) return { success: false, error: error.message };

      await this.addLog(
        "Shop Deleted",
        "Admin",
        this.currentUser?.email || "unknown",
        `Removed shop ${shop?.shop_name || id} from registry.`,
      );
      return { success: true, error: null };
    } catch (e: any) {
      return { success: false, error: e?.message || "Delete failed" };
    }
  }

  // Reconcile a card's status against its expiration date automatically, in
  // BOTH directions:
  //   - expiration date/time reached  -> status becomes 'renew' (access blocked)
  //   - card renewed (new future date) -> status becomes 'active' (access back)
  // Suspended cards keep their admin-imposed state.
  private async reconcileCustomerStatus(c: Customer): Promise<Customer> {
    const desired =
      c.card_status === "suspended"
        ? "suspended"
        : isCustomerCardExpired(c)
          ? "renew"
          : "active";
    if (c.card_status === desired) return c;
    // Only persist the flip when a signed-in operator is driving the scan.
    // An external QR scanner is unauthenticated, so writing would 401; the
    // in-memory status below is still correct for the validation result.
    if (!this.currentUser) return { ...c, card_status: desired };
    try {
      const { error } = await getSupabase()
        .from("customers")
        .update({ card_status: desired })
        .eq("id", c.id);
      if (error) {
        console.warn("Supabase card status reconcile failed:", error.message);
        return c;
      }
    } catch (e) {
      console.warn("Supabase card status reconcile failed:", e);
      return c;
    }
    return { ...c, card_status: desired };
  }

  async getCustomers(): Promise<Customer[]> {
    let data: Customer[] | null = null;
    try {
      data = await fetchAllPaged<Customer>("customers", "created_at", false);
    } catch (e) {
      console.warn("Supabase customers fetch failed:", e);
    }
    if (!data) return [];

    // Auto status sweep: persist BOTH the 'renew' flip (expired cards) and the
    // 'active' flip (cards renewed into the future) based on valid_until.
    const needsRenew = data.filter(
      (c) =>
        c.card_status !== "suspended" &&
        isCustomerCardExpired(c) &&
        c.card_status !== "renew",
    );
    const needsActive = data.filter(
      (c) =>
        c.card_status !== "suspended" &&
        !isCustomerCardExpired(c) &&
        c.card_status === "renew",
    );
    const statusById = new Map<string, "renew" | "active">();
    needsRenew.forEach((c) => statusById.set(c.id, "renew"));
    needsActive.forEach((c) => statusById.set(c.id, "active"));

    if (statusById.size > 0) {
      const batches: Array<{ status: "renew" | "active"; ids: string[] }> = [];
      const renewIds = needsRenew.map((c) => c.id);
      const activeIds = needsActive.map((c) => c.id);
      if (renewIds.length > 0) batches.push({ status: "renew", ids: renewIds });
      if (activeIds.length > 0) batches.push({ status: "active", ids: activeIds });
      await Promise.all(
        batches.map(async ({ status, ids }) => {
          try {
            const { error } = await getSupabase()
              .from("customers")
              .update({ card_status: status })
              .in("id", ids);
            if (error) {
              console.warn("Supabase auto card status sweep failed:", error.message);
            }
          } catch (e) {
            console.warn("Supabase auto card status sweep failed:", e);
          }
        }),
      );
      data = data.map((c) => {
        const status = statusById.get(c.id);
        return status ? { ...c, card_status: status } : c;
      });
    }
    return data;
  }

  async createCustomer(
    name: string,
    email: string,
    phone: string,
    validUntil?: string,
    opts?: Partial<
      Pick<
        Customer,
        "customer_type" | "student_id" | "university" | "referee_number"
      >
    >,
  ): Promise<{ customer: Customer | null; error: string | null }> {
    const currentCustomers = await this.getCustomers();
    const cleanEmail = (email || "").trim();
    const existing = cleanEmail
      ? currentCustomers.find(
          (c) => (c.email || "").toLowerCase() === cleanEmail.toLowerCase(),
        )
      : undefined;
    if (existing) {
      const updates: Partial<Customer> = {};
      if (validUntil) updates.valid_until = validUntil;
      if (opts?.customer_type) updates.customer_type = opts.customer_type;
      if (opts?.student_id !== undefined) updates.student_id = opts.student_id;
      if (opts?.university !== undefined) updates.university = opts.university;
      if (opts?.referee_number !== undefined)
        updates.referee_number = opts.referee_number;
      if (Object.keys(updates).length > 0) {
        await this.updateCustomer(existing.id, updates);
      }
      return { customer: existing, error: null };
    }

    // Sequential card IDs starting at CUST-001 (skips taken codes).
    const newCust: Customer = {
      id: "cust-" + Date.now(),
      name,
      email: cleanEmail || undefined,
      phone,
      qr_code: nextSequentialCustomerCode(
        currentCustomers.map((c) => c.qr_code),
      ),
      created_at: new Date().toISOString(),
      valid_until:
        validUntil ||
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
    };
    if (await areCustomerV3ColumnsReady()) {
      newCust.customer_type = opts?.customer_type || "other";
      newCust.student_id = opts?.student_id || "";
      newCust.university = opts?.university || "";
    }
    if (await areCustomerV4ColumnsReady()) {
      newCust.referee_number = opts?.referee_number || "";
      newCust.card_status = "active";
    }
    if (await areCustomerV5ColumnsReady()) {
      newCust.credit_status = "pending";
    }
    // Admin-issued cards are physical 1-year cards: treated as paid.
    if (await areCustomerV6ColumnsReady()) {
      newCust.subscription_status = "paid";
    }
    // Activation PIN: 4-digit code for confirming card use in a new session.
    newCust.activation_pin = String(Math.floor(1000 + Math.random() * 9000));

    try {
      const { error } = await getSupabase()
        .from("customers")
        .insert([newCust]);
      if (error) {
        // Some live databases still have customers.email as NOT NULL while the
        // intended schema makes it nullable (email-less cards are valid).
        // Retry once with a deterministic placeholder so issuing a card never
        // fails because the member did not provide an email.
        if (!cleanEmail && isEmailNotNullError(error)) {
          const retry: Customer = {
            ...newCust,
            email: `card-${newCust.qr_code.toLowerCase()}@cards.mi-advantage.local`,
          };
          const { error: retryErr } = await getSupabase()
            .from("customers")
            .insert([retry]);
          if (retryErr) return { customer: null, error: retryErr.message };
          newCust.email = retry.email;
        } else {
          return { customer: null, error: error.message };
        }
      }
    } catch (e: any) {
      return { customer: null, error: e?.message || "Insert failed" };
    }

    await this.addLog(
      "Customer QR Generated",
      "Admin",
      this.currentUser?.email || "unknown",
      `Generated unique QR Code ${newCust.qr_code} for ${name} valid until ${newCust.valid_until}.`,
    );
    return { customer: newCust, error: null };
  }

  // Public self-registration from the /join page: no login, no email.
  // The server issues the next sequential CUST-001+ card ID, a 14-day online
  // card (valid_until), and an unpaid subscription (discounts blocked until
  // payment). Referrer codes are validated server-side.
  async selfRegisterCustomer(input: {
    name: string;
    phone: string;
    customer_type?: string;
    student_id?: string;
    university?: string;
    referee_number?: string;
    activation_pin?: string;
  }): Promise<{ customer: Customer | null; error: string | null }> {
    try {
      const { data, error } = await getSupabase().registerCustomer(input);
      if (error) return { customer: null, error: error.message };
      return { customer: data as Customer, error: null };
    } catch (e: any) {
      return { customer: null, error: e?.message || "Registration failed" };
    }
  }

  // Public subscription activation (mobile-money confirmation).
  // Flips the card to paid/active with a 1-year physical-card validity.
  async activateCustomerSubscription(input: {
    customerId: string;
    provider: string;
    senderPhone: string;
    txCode: string;
  }): Promise<{ customer: Customer | null; error: string | null }> {
    try {
      const { data, error } = await getSupabase().activateSubscription(input);
      if (error) return { customer: null, error: error.message };
      return { customer: data as Customer, error: null };
    } catch (e: any) {
      return { customer: null, error: e?.message || "Activation failed" };
    }
  }

  async updateCustomer(
    id: string,
    updates: Partial<Customer>,
  ): Promise<{ customer: Customer | null; error: string | null }> {    const safeUpdates = { ...updates };
    if (!(await areCustomerV3ColumnsReady())) {
      delete safeUpdates.customer_type;
      delete safeUpdates.student_id;
      delete safeUpdates.university;
    }
    if (!(await areCustomerV4ColumnsReady())) {
      delete safeUpdates.referee_number;
      delete safeUpdates.card_status;
    }
    if (!(await areCustomerV5ColumnsReady())) {
      delete safeUpdates.credit_status;
    }
    if (!(await areCustomerV6ColumnsReady())) {
      delete safeUpdates.subscription_status;
    }
    try {
      const { data, error } = await getSupabase()
        .from("customers")
        .update(safeUpdates)
        .eq("id", id)
        .select()
        .single();
      if (error) return { customer: null, error: error.message };

      // Auto status: if the admin renewed the card (new future expiry) without
      // explicitly setting a status, flip it back to 'active' automatically.
      // Past expiry is flipped to 'renew' here as well as by the load sweep.
      if (updates.card_status === undefined && updates.valid_until !== undefined) {
        const reconciled = await this.reconcileCustomerStatus(data as Customer);
        return { customer: reconciled, error: null };
      }

      await this.addLog(
        "Customer Card Updated",
        "Admin",
        this.currentUser?.email || "unknown",
        `Updated configurations for customer: ${data?.name || id}.`,
      );
      return { customer: data as Customer, error: null };
    } catch (e: any) {
      return { customer: null, error: e?.message || "Update failed" };
    }
  }

  // Approve / mark paid a referrer reward credit earned by a referred member.
  async setCustomerCreditStatus(
    id: string,
    status: Customer["credit_status"],
  ): Promise<{ success: boolean; error: string | null }> {
    const customer = (await this.getCustomers()).find((c) => c.id === id);
    const { error } = await this.updateCustomer(id, { credit_status: status });
    if (error) return { success: false, error };
    if (status === "approved") {
      await this.addLog(
        "Referrer Credit Approved",
        "Admin",
        this.currentUser?.email || "unknown",
        `Approved referral credit for ${customer?.name || id}.`,
      );
    } else if (status === "paid") {
      await this.addLog(
        "Referrer Credit Paid",
        "Admin",
        this.currentUser?.email || "unknown",
        `Marked referral credit as PAID for ${customer?.name || id}.`,
      );
    }
    return { success: true, error: null };
  }

  // Remove a referral (full CRUD delete) — clears the referee and its credit.
  async clearCustomerReferee(
    id: string,
  ): Promise<{ success: boolean; error: string | null }> {
    const customer = (await this.getCustomers()).find((c) => c.id === id);
    const { error } = await this.updateCustomer(id, {
      referee_number: "",
      credit_status: "pending",
    });
    if (error) return { success: false, error };
    await this.addLog(
      "Referrer Credit Removed",
      "Admin",
      this.currentUser?.email || "unknown",
      `Removed referral record for ${customer?.name || id}.`,
    );
    return { success: true, error: null };
  }

  async deleteCustomer(
    id: string,
  ): Promise<{ success: boolean; error: string | null }> {
    const customer = (await this.getCustomers()).find((c) => c.id === id);
    try {
      const { error } = await getSupabase()
        .from("customers")
        .delete()
        .eq("id", id);
      if (error) return { success: false, error: error.message };

      await this.addLog(
        "Customer QR Revoked",
        "Admin",
        this.currentUser?.email || "unknown",
        `Deleted customer card: ${customer?.name || id} (Code: ${customer?.qr_code || id})`,
      );
      return { success: true, error: null };
    } catch (e: any) {
      return { success: false, error: e?.message || "Delete failed" };
    }
  }

  async getCustomerByQRCode(qrCode: string): Promise<Customer | null> {
    const clean = extractScanCode(qrCode);
    if (!clean) return null;
    try {
      // Exact match first — prevents partial scans from resolving to the wrong card.
      const { data: exact, error: exactError } = await getSupabase()
        .from("customers")
        .select("*")
        .eq("qr_code", clean)
        .maybeSingle();
      if (!exactError && exact) {
        const customer = await this.reconcileCustomerStatus(exact as Customer);
        // Audit logging must not delay the scan — it is informational.
        void this.addLog(
          "QR Code Scanned",
          "System",
          "scanner",
          `Scan completed successfully for ${customer.name}.`,
        );
        return customer;
      }
      // Fallback: substring match only when it resolves to exactly one card.
      // The server adds the SQL wildcards, so pass the bare code here.
      const { data, error } = await getSupabase()
        .from("customers")
        .select("*")
        .ilike("qr_code", clean)
        .limit(50);
      if (!error && data) {
        const match = (data as Customer[]).find(
          (c) => (c.qr_code || "").toLowerCase() === clean.toLowerCase(),
        );
        if (match) {
          const customer = await this.reconcileCustomerStatus(match);
          void this.addLog(
            "QR Code Scanned",
            "System",
            "scanner",
            `Scan completed successfully for ${customer.name}.`,
          );
          return customer;
        }
      }
    } catch (e) {
      console.warn("Supabase customer scan fetch failed:", e);
    }
    return null;
  }

  async getSales(): Promise<Sale[]> {
    return fetchAllPaged<Sale>("sales", "created_at", false);
  }

  // Single-row shop fetch — full list sweeps are too slow for the terminal.
  async getShopById(id: string): Promise<Shop | null> {
    if (!id) return null;
    try {
      const { data, error } = await getSupabase()
        .from("shops")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) return null;
      return data as Shop;
    } catch {
      return null;
    }
  }

  // Name resolution without pulling the entire customer table.
  async findCustomerByName(name: string): Promise<Customer | null> {
    if (!name || !name.trim()) return null;
    try {
      const { data, error } = await getSupabase()
        .from("customers")
        .select("*")
        .ilike("name", name.trim())
        .limit(1);
      if (error || !data) return null;
      return (data[0] as Customer) || null;
    } catch {
      return null;
    }
  }

  async createSale(
    shopId: string,
    customerName: string,
    amountBefore: number,
    customerId?: string,
  ): Promise<{ sale: Sale | null; error: string | null }> {
    // Stamp the sale at the moment the operator confirms it — lookups must not
    // shift the recorded timestamp.
    const createdAt = new Date().toISOString();

    const shop = await this.getShopById(shopId);
    if (!shop) {
      return { sale: null, error: "Registered shop not found." };
    }

    const discountPercent = shop.discount_percent;
    const discountApplied = Math.round((amountBefore * discountPercent) / 100);
    const finalAmount = amountBefore - discountApplied;

    let finalCustomerId = customerId;
    if (!finalCustomerId && customerName) {
      const match = await this.findCustomerByName(customerName);
      if (match) finalCustomerId = match.id;
    }

    const newSale: Sale = {
      id: "sale-" + Date.now(),
      shop_id: shopId,
      customer_id: finalCustomerId,
      shop_name: shop.shop_name,
      customer_name: customerName,
      amount_before_discount: amountBefore,
      discount_percent: discountPercent,
      discount_applied: discountApplied,
      final_amount: finalAmount,
      created_at: createdAt,
    };

    try {
      const { error } = await getSupabase().from("sales").insert([newSale]);
      if (error) return { sale: null, error: error.message };
    } catch (e: any) {
      return { sale: null, error: e?.message || "Insert failed" };
    }

    // Audit logging must not block the terminal's confirmation flow.
    void this.addLog(
      "Transaction Recorded",
      "Shop",
      shop.email,
      `Recorded discount transaction for ${customerName}. Amount: ${amountBefore} RWF, Saved: ${discountApplied} RWF.`,
    );
    return { sale: newSale, error: null };
  }

  async getAuditLogs(): Promise<AuditLog[]> {
    return fetchAllPaged<AuditLog>("audit_logs", "created_at", false);
  }

  async addLog(
    action: string,
    role: "Admin" | "Shop" | "System",
    email: string,
    details: string,
  ) {
    const newLog: AuditLog = {
      id: "log-" + Date.now(),
      action,
      user_role: role,
      user_email: email,
      details,
      created_at: new Date().toISOString(),
    };

    try {
      await getSupabase().from("audit_logs").insert([newLog]);
    } catch (e) {
      console.warn("Audit log insert failed:", e);
    }
  }

  async getCustomization(): Promise<Customization> {
    try {
      const { data, error } = await getSupabase()
        .from("customization")
        .select("*")
        .maybeSingle();
      if (!error && data) return data as Customization;
    } catch (e) {
      console.warn("Supabase customization query failed:", e);
    }
    return DEFAULT_CUSTOMIZATION;
  }

  async updateCustomization(
    updates: Partial<Customization>,
  ): Promise<Customization> {
    const current = await this.getCustomization();
    const updated = { ...current, ...updates };

    try {
      await getSupabase()
        .from("customization")
        .upsert([{ id: "global-config", ...updated }]);
    } catch (e) {
      console.warn("Supabase customization save failed:", e);
    }

    await this.addLog(
      "Theme Settings Updated",
      "Admin",
      this.currentUser?.email || "unknown",
      `Updated global app styling to: Title: "${updated.title}", Theme: "${updated.theme_color}".`,
    );
    return updated;
  }

  async login(
    email: string,
    password: string,
  ): Promise<{
    user: AuthUser | null;
    error: string | null;
    code?: "EMAIL_NOT_VERIFIED" | "ACCOUNT_PENDING" | "ACCOUNT_REJECTED" | null;
    userType?: "admin" | "shop" | null;
  }> {
    const lowerEmail = email.toLowerCase().trim();
    if (!lowerEmail || !password) {
      return { user: null, error: "Email and password are required." };
    }

    // Delegate authentication to the server's session-based login endpoint.
    // The server validates credentials, creates a session token, and returns it.
    // The ApiClient stores the token automatically for all subsequent requests.
    const { data, error } = await getSupabase().login(lowerEmail, password);

    if (error) {
      const errData = error as any;
      return {
        user: null,
        error: errData.error || "Login failed. Please try again.",
        code: errData.code || null,
        userType: errData.userType || null,
      };
    }

    if (!data || !data.user) {
      return { user: null, error: "Login failed. No user data returned." };
    }

    const user: AuthUser = {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role: data.user.role,
      shop_id: data.user.shop_id,
      admin_role: data.user.admin_role,
    };
    this.currentUser = user;
    return { user, error: null };
  }

  async signUpAdmin(
    name: string,
    email: string,
    pass: string,
  ): Promise<{ success: boolean; error: string | null }> {
    // Use the server's public registration endpoint (no auth required)
    const API_BASE = import.meta.env.VITE_API_URL || "";
    try {
      const res = await fetch(`${API_BASE}/api/db/auth/register-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email: email.toLowerCase().trim(), password: pass }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { success: false, error: body.error || "Registration failed." };
      return { success: true, error: null };
    } catch (e: any) {
      return { success: false, error: e?.message || "Registration failed." };
    }
  }

  async resetAdminPassword(
    email: string,
    currentPass: string,
    newPass: string,
  ): Promise<{ success: boolean; error: string | null }> {
    const cleanEmail = email.toLowerCase().trim();
    const { data: admin, error: queryError } = await getSupabase()
      .from("admins")
      .select("*")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (queryError) {
      return {
        success: false,
        error: "Unable to access administrator accounts in Supabase. Verify the database and RLS policies.",
      };
    }

    if (!admin) {
      return { success: false, error: "Administrator email not found." };
    }

    if (admin.password !== currentPass) {
      return { success: false, error: "Incorrect current password." };
    }

    const updateResult = await this.updateAdmin(admin.id, { password: newPass });
    if (updateResult.error) {
      return { success: false, error: updateResult.error };
    }
    await this.addLog(
      "Admin Password Reset",
      "Admin",
      admin.email,
      `Successfully updated profile password for admin: ${admin.name}.`,
    );
    return { success: true, error: null };
  }

  async requestPasswordReset(
    email: string,
  ): Promise<{ success: boolean; emailSent: boolean; error: string | null }> {
    const cleanEmail = email.toLowerCase().trim();
    // Use the server's public endpoint (no auth required)
    const API_BASE = import.meta.env.VITE_API_URL || "";
    try {
      const res = await fetch(`${API_BASE}/api/db/auth/request-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { success: false, emailSent: false, error: body.error || "Password reset request failed." };
      return { success: true, emailSent: true, error: null };
    } catch (e: any) {
      return { success: false, emailSent: false, error: e?.message || "Password reset request failed." };
    }
  }

  async verifyRecoveryAndReset(
    email: string,
    code: string,
    newPass: string,
  ): Promise<{ success: boolean; error: string | null }> {
    const cleanEmail = email.toLowerCase().trim();
    // Use the server's public endpoint (no auth required)
    const API_BASE = import.meta.env.VITE_API_URL || "";
    try {
      const res = await fetch(`${API_BASE}/api/db/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, code: code.trim(), newPassword: newPass }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { success: false, error: body.error || "Password reset failed." };
      return { success: true, error: null };
    } catch (e: any) {
      return { success: false, error: e?.message || "Password reset failed." };
    }
  }

  async logout(): Promise<void> {
    const user = this.currentUser;
    if (user) {
      // Log the action BEFORE clearing auth (server still has the session)
      await this.addLog(
        `${user.role === "admin" ? "Admin" : "Shop"} Logout`,
        user.role === "admin" ? "Admin" : "Shop",
        user.email,
        "Logged out successfully.",
      );
    }
    // Call server to destroy the session and clear the stored token
    await getSupabase().logout();
    this.currentUser = null;
  }

  async testConnection(): Promise<{
    connected: boolean;
    status: "connected" | "fallback" | "invalid_keys" | "missing_tables";
    message: string;
    tables: {
      admins: boolean;
      shops: boolean;
      customers: boolean;
      sales: boolean;
      audit_logs: boolean;
      customization: boolean;
      verification_codes: boolean;
    };
  }> {
    const tableStatus = {
      admins: false,
      shops: false,
      customers: false,
      sales: false,
      audit_logs: false,
      customization: false,
      verification_codes: false,
    };

    try {
      const [adminsRes, shopsRes, customersRes, salesRes, logsRes, customRes, vcodesRes] =
        await Promise.all([
          getSupabase().from("admins").select("id").limit(1),
          getSupabase().from("shops").select("id").limit(1),
          getSupabase().from("customers").select("id").limit(1),
          getSupabase().from("sales").select("id").limit(1),
          getSupabase().from("audit_logs").select("id").limit(1),
          getSupabase().from("customization").select("id").limit(1),
          getSupabase().from("verification_codes").select("id").limit(1),
        ]);

      tableStatus.admins = !adminsRes.error;
      tableStatus.shops = !shopsRes.error;
      tableStatus.customers = !customersRes.error;
      tableStatus.sales = !salesRes.error;
      tableStatus.audit_logs = !logsRes.error;
      tableStatus.customization = !customRes.error;
      tableStatus.verification_codes = !vcodesRes.error;

      const allOk = Object.values(tableStatus).every((v) => v);

      if (allOk) {
        return {
          connected: true,
          status: "connected",
          message:
            "Securely connected to Supabase Database. All tables active!",
          tables: tableStatus,
        };
      } else {
        const missing = Object.entries(tableStatus)
          .filter(([_, exists]) => !exists)
          .map(([name]) => name)
          .join(", ");
        return {
          connected: true,
          status: "missing_tables",
          message: `Database API is active, but missing tables or failing access permissions: ${missing}. Run supabase-migration.sql (existing DB) or supabase-schema.sql (new DB) in your Supabase SQL editor, then npm run db:init.`,
          tables: tableStatus,
        };
      }
    } catch (err: any) {
      console.error("Supabase connection diagnostics failed:", err);
      return {
        connected: false,
        status: "invalid_keys",
        message: `Failed to connect. Check your Supabase URL & Anon Key. Details: ${err?.message || err}`,
        tables: tableStatus,
      };
    }
  }

  // Bootstrap demo rows live server-side (server/api-server.ts) and are
  // optional: seeding is an administrator-only maintenance endpoint.
  async seedDatabase(): Promise<{ success: boolean; error: string | null }> {
    try {
      const { ok, data } = await getSupabase().post("/api/db/seed");
      if (!ok) {
        const message = (data && data.error) || "Seeding failed (administrator session required).";
        return { success: false, error: message };
      }
      await this.addLog(
        "Database Seeded",
        "System",
        this.currentUser?.email || "system",
        `Server seed completed: ${(data && data.message) || "done"}.`,
      );
      return { success: true, error: null };
    } catch (err: any) {
      console.error("Seeding failure:", err);
      return {
        success: false,
        error: err?.message || "Error occurred during database seeding.",
      };
    }
  }
}

export const db = new SupabaseDatabaseService();
