export interface Customer {
  id: string;
  name: string;
  email?: string | null; // optional — self-registered cards have no email
  phone: string;
  qr_code: string; // unique scan code (e.g., "CUST-001")
  created_at: string;
  valid_until?: string; // Card validation/expiry date
  customer_type?: 'student' | 'other'; // Student/Other membership type
  student_id?: string; // Student ID when customer_type === 'student'
  university?: string; // University name when customer_type === 'student'
  referee_number?: string; // Optional referrer CARD ID used for referrer rewards
  card_status?: 'active' | 'renew' | 'suspended'; // Auto-managed card status
  credit_status?: 'pending' | 'approved' | 'paid'; // Referrer reward credit lifecycle
  subscription_status?: 'unpaid' | 'paid'; // Self-registration payment lifecycle
}

export interface Admin {
  id: string;
  name: string;
  email: string;
  password?: string;
  role?: 'super_admin' | 'admin' | 'manager';
  status?: 'active' | 'suspended';
  email_verified?: boolean;
  created_at: string;
}

export interface Shop {
  id: string;
  shop_name: string;
  discount_percent: number;
  email: string;
  password?: string;
  profile_picture?: string;
  qr_code?: string; // public guest-scan code (e.g., "SHOP-1001")
  description?: string; // partner business blurb for the join-page carousel
  business_type?: string; // 'retail' | 'restaurant' | 'cafe' | 'hotel' | 'services' | 'other'
  discount_scope?: string; // 'all' | 'drinks' | 'food' | 'rooms' | 'services'
  status?: 'pending' | 'approved' | 'rejected';
  contract?: string;
  rdb_certificate?: string;
  email_verified?: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  shop_id?: string; // owning shop (server forces this for shop accounts)
  name: string;
  price: number; // in Rwandan Francs (RWF)
  stock: number;
  description?: string;
  image_url?: string;
  status?: 'active' | 'hidden';
  created_at: string;
}

export interface Sale {  id: string;
  shop_id: string;
  customer_id?: string; // Reference to customer table
  shop_name: string; // denormalized for easy rendering
  customer_name: string;
  amount_before_discount: number; // in Rwandan Francs (RWF)
  discount_percent: number;
  discount_applied: number; // in RWF
  final_amount: number; // in RWF
  created_at: string; // ISO string
}

export interface AuditLog {
  id: string;
  action: string; // e.g., "Transaction Recorded", "Shop Registered", "Theme Updated", "Customer Generated"
  user_role: 'Admin' | 'Shop' | 'System';
  user_email: string;
  details: string;
  created_at: string;
}

export interface Customization {
  theme_color: 'green' | 'teal' | 'emerald' | 'dark-green' | 'blue';
  logo_url: string;
  // Member card branding
  card_brand?: string; // short monogram printed on the card (e.g. "BP")
  card_logo_url?: string; // logo artwork printed on the card face
  card_wordmark?: string; // wordmark at the top of the card (e.g. "THE BEYOND")
  title: string;
  subtitle?: string;
  favicon_url?: string;
  home_h1?: string;
  home_h2?: string;
  home_p?: string;
  login_heading?: string;
  login_subtext?: string;
  signup_heading?: string;
  signup_subtext?: string;
  // Full branding colors
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  background_color?: string;
  sidebar_color?: string;
  card_color?: string;
  text_primary_color?: string;
  text_secondary_color?: string;
  // Typography
  font_family?: string;
  heading_font?: string;
  base_font_size?: string;
  // Login background
  login_background_type?: string;
  login_background_value?: string;
  // Landing page background
  home_background_type?: 'none' | 'image' | 'gradient';
  home_background_value?: string;
  // Feature strip (editable landing page content)
  feature1_title?: string;
  feature1_desc?: string;
  feature2_title?: string;
  feature2_desc?: string;
  feature3_title?: string;
  feature3_desc?: string;
  // Footer
  footer_text?: string;
  footer_subtext?: string;
  // Email branding
  email_header_html?: string;
  email_footer_html?: string;
  // Custom CSS
  custom_css?: string;
  // Timestamps
  updated_at?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: 'admin' | 'shop';
  name?: string; // Dynamic name from admins or shops table
  shop_id?: string; // if role is 'shop'
  admin_role?: 'super_admin' | 'admin' | 'manager'; // if role is 'admin'
}

export interface VerificationCode {
  id: string;
  email: string;
  code: string;
  purpose: 'signup' | 'password_reset';
  user_type: 'admin' | 'shop' | 'manager';
  expires_at: string;
  used: boolean;
  created_at: string;
}
