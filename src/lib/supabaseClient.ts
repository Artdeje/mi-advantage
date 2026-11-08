const API_BASE = import.meta.env.VITE_API_URL || "";
const TOKEN_KEY = "mi_auth_token";

export interface ApiResponse<T> {
  data: T | null;
  error: { message: string } | null;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // --- Token management ---
  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  }
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }
  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  private authHeaders(): Record<string, string> {
    const token = this.getToken();
    if (token) return { Authorization: `Bearer ${token}` };
    return {};
  }

  from(table: string) {
    return new QueryBuilder(this.baseUrl, table, this.authHeaders.bind(this));
  }

  // Raw authenticated GET for non-table endpoints (e.g. /api/db/partners).
  async get<T>(path: string): Promise<ApiResponse<T>> {
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        headers: this.authHeaders(),
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { data: null, error: { message: body.error || res.statusText } };
      }
      return { data: (await res.json()) as T, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err?.message || "Request failed" } };
    }
  }

  // Generic server endpoint call (Bearer-protected) — used for non-table
  // routes such as POST /api/db/seed.
  async post(path: string, body?: unknown): Promise<{ ok: boolean; data: any }> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(body ?? {}),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  }

  // --- Auth endpoints (server-side session) ---
  async login(email: string, password: string) {
    const res = await fetch(`${this.baseUrl}/api/db/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        data: null,
        error: body as { error: string; code?: string; userType?: string },
      };
    }
    // Store the session token
    this.setToken(body.token);
    return {
      data: body as { token: string; user: any },
      error: null,
    };
  }

  async logout() {
    try {
      await fetch(`${this.baseUrl}/api/db/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.authHeaders(),
        },
      });
    } catch { /* safe */ }
    this.clearToken();
  }

  // Validate the stored token against the lightweight auth endpoint (no DB
  // round-trips — the heavy /api/db/test table sweep took seconds per call).
  // Network failure returns TRUE (offline resilience): an unreachable server
  // is not proof of an expired session.
  async validateSession(): Promise<boolean> {
    const token = this.getToken();
    if (!token) return false;
    try {
      const res = await fetch(`${this.baseUrl}/api/db/auth/validate`, {
        headers: this.authHeaders(),
      });
      // If the server returns 401, the session is invalid
      return res.status < 300;
    } catch {
      return true;
    }
  }

  // --- Public self-registration (no login, no email) ---
  // Server computes the next sequential CUST-### code atomically.
  async registerCustomer(payload: {
    name: string;
    phone: string;
    customer_type?: string;
    student_id?: string;
    university?: string;
    referee_number?: string;
  }) {
    const res = await fetch(`${this.baseUrl}/api/db/auth/register-customer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { data: null as any, error: { message: body.error || "Registration failed" } };
    return { data: body.customer as any, error: null };
  }

  // --- Public subscription activation (mock mobile-money confirmation) ---
  async activateSubscription(payload: {
    customerId: string;
    provider: string;
    senderPhone: string;
    txCode: string;
  }) {
    const res = await fetch(`${this.baseUrl}/api/db/auth/activate-subscription`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { data: null as any, error: { message: body.error || "Activation failed" } };
    return { data: body.customer as any, error: null };
  }

  // Placeholder for Supabase Auth compatibility (unused in MySQL mode)
  auth = {
    signUp: async (_opts: any) => ({ data: null, error: null }),
    signOut: async () => { this.clearToken(); return { error: null }; },
  };
}

class QueryBuilder {
  private baseUrl: string;
  private table: string;
  private getAuthHeaders: () => Record<string, string>;
  private filters: [string, string, any][] = [];
  private ilikeFilters: [string, any][] = [];
  private inFilters: [string, any[]][] = [];
  // Comparison filters used by incremental polling (created_at_gt, etc.).
  private compareFilters: [string, string, any][] = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitCount: number | null = null;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private singleMode = false;
  private selectCols = "*";
  private operation: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private body: any = null;
  private returnResult = false;

  constructor(baseUrl: string, table: string, getAuthHeaders: () => Record<string, string>) {
    this.baseUrl = baseUrl;
    this.table = table;
    this.getAuthHeaders = getAuthHeaders;
  }

  select(cols = "*"): this {
    this.selectCols = cols;
    if (this.operation !== "select") {
      this.returnResult = true;
    } else {
      this.operation = "select";
    }
    return this;
  }

  insert(rows: any[]): this {
    this.operation = "insert";
    this.body = rows;
    return this;
  }

  update(data: any): this {
    this.operation = "update";
    this.body = data;
    return this;
  }

  delete(): this {
    this.operation = "delete";
    return this;
  }

  upsert(rows: any[], _opts?: { onConflict?: string }): this {
    this.operation = "upsert";
    this.body = rows;
    return this;
  }

  eq(col: string, val: any): this {
    this.filters.push(["eq", col, val]);
    return this;
  }

  ilike(col: string, val: any): this {
    this.ilikeFilters.push([col, val]);
    return this;
  }

  in(col: string, vals: any[]): this {
    this.inFilters.push([col, vals]);
    return this;
  }

  gt(col: string, val: any): this {
    this.compareFilters.push(["gt", col, val]);
    return this;
  }

  gte(col: string, val: any): this {
    this.compareFilters.push(["gte", col, val]);
    return this;
  }

  lt(col: string, val: any): this {
    this.compareFilters.push(["lt", col, val]);
    return this;
  }

  lte(col: string, val: any): this {
    this.compareFilters.push(["lte", col, val]);
    return this;
  }

  order(col: string, opts: { ascending: boolean }): this {
    this.orderCol = col;
    this.orderAsc = opts.ascending;
    return this;
  }

  limit(n: number): this {
    this.limitCount = n;
    return this;
  }

  // Inclusive row range (PostgREST). Lets callers page past the 1000-row cap.
  range(from: number, to: number): this {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  single(): this {
    this.singleMode = true;
    return this;
  }

  maybeSingle(): this {
    this.singleMode = true;
    return this;
  }

  async then<TResult>(
    resolve: (result: ApiResponse<any>) => TResult,
  ): Promise<TResult> {
    try {
      const result = await this.execute();
      return resolve(result);
    } catch (err: any) {
      return resolve({ data: null, error: { message: err?.message || "Request failed" } });
    }
  }

  private async execute(): Promise<ApiResponse<any>> {
    const headers = {
      "Content-Type": "application/json",
      ...this.getAuthHeaders(),
    };

    // INSERT
    if (this.operation === "insert") {
      const res = await fetch(`${this.baseUrl}/api/db/${this.table}`, {
        method: "POST",
        headers,
        body: JSON.stringify(this.body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        return { data: null, error: { message: err.error || "Insert failed" } };
      }
      return { data: null, error: null };
    }

    // UPSERT
    if (this.operation === "upsert") {
      const res = await fetch(`${this.baseUrl}/api/db/${this.table}/upsert`, {
        method: "POST",
        headers,
        body: JSON.stringify(this.body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        return { data: null, error: { message: err.error || "Upsert failed" } };
      }
      return { data: null, error: null };
    }

    // UPDATE with .eq()
    if (this.operation === "update") {
      // Batch update with .in()
      if (this.inFilters.length > 0) {
        const [col, ids] = this.inFilters[0];
        if (col === "id") {
          const res = await fetch(`${this.baseUrl}/api/db/batch-update/${this.table}`, {
            method: "POST",
            headers,
            body: JSON.stringify({ ids, data: this.body }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            return { data: null, error: { message: err.error || "Batch update failed" } };
          }
          return { data: null, error: null };
        }
      }

      // Single row update by id
      const idFilter = this.filters.find(([op, col]) => op === "eq" && col === "id");
      if (idFilter) {
        const id = idFilter[2];
        const res = await fetch(`${this.baseUrl}/api/db/${this.table}/${id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify(this.body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          return { data: null, error: { message: err.error || "Update failed" } };
        }
        const data = await res.json();
        return { data, error: null };
      }

      // Update by non-id filter
      if (this.filters.length > 0) {
        const filters: Record<string, any> = {};
        for (const [, col, val] of this.filters) {
          filters[col] = val;
        }
        const res = await fetch(`${this.baseUrl}/api/db/${this.table}`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ data: this.body, filters }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          return { data: null, error: { message: err.error || "Update failed" } };
        }
        return { data: null, error: null };
      }
    }

    // DELETE
    if (this.operation === "delete") {
      const idFilter = this.filters.find(([op, col]) => op === "eq" && col === "id");
      if (idFilter) {
        const id = idFilter[2];
        const res = await fetch(`${this.baseUrl}/api/db/${this.table}/${id}`, {
          method: "DELETE",
          headers: this.getAuthHeaders(),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          return { data: null, error: { message: err.error || "Delete failed" } };
        }
        return { data: null, error: null };
      }
    }

    // SELECT - build query string
    const params = new URLSearchParams();

    for (const [, col, val] of this.filters) {
      params.set(col, String(val));
    }

    for (const [col, val] of this.ilikeFilters) {
      params.set(`${col}_ilike`, String(val));
    }

    for (const [op, col, val] of this.compareFilters) {
      params.set(`${col}_${op}`, String(val));
    }

    // Column projection: keeps heavy fields (base64 logos, contracts) out of
    // the 2-second polling payloads.
    if (this.selectCols && this.selectCols !== "*") {
      params.set("select", this.selectCols);
    }

    if (this.orderCol) {
      params.set("order", this.orderCol);
      params.set("ascending", String(this.orderAsc));
    }

    if (this.limitCount !== null) {
      params.set("limit", String(this.limitCount));
    }

    if (this.rangeFrom !== null && this.rangeTo !== null) {
      params.set("offset", String(this.rangeFrom));
      params.set("limit", String(this.rangeTo - this.rangeFrom + 1));
    }

    if (this.singleMode) {
      params.set("single", "true");
    }

    const qs = params.toString();
    const url = `${this.baseUrl}/api/db/${this.table}${qs ? "?" + qs : ""}`;

    const res = await fetch(url, { headers: this.getAuthHeaders(), cache: "no-store" });
    if (!res.ok) {
      // A 304 (Not Modified) is not an error — the browser cache revalidated
      // the request. Re-fetch it with the cache bypassed so the caller still
      // gets the rows instead of an empty list.
      if (res.status === 304) {
        try {
          const retry = await fetch(url, {
            headers: { ...this.getAuthHeaders(), "Cache-Control": "no-cache" },
            cache: "reload",
          });
          if (retry.ok) {
            const retryData = await retry.json();
            return this.singleMode
              ? { data: retryData || null, error: null }
              : { data: retryData, error: null };
          }
        } catch {
          /* fall through to the generic error below */
        }
      }
      const err = await res.json().catch(() => ({ error: res.statusText }));
      return { data: null, error: { message: err.error || "Query failed" } };
    }

    const data = await res.json();

    if (this.singleMode) {
      return { data: data || null, error: null };
    }

    return { data, error: null };
  }
}

// --- Singleton client ---
let _client = new ApiClient(API_BASE);

export const getSupabase = (): ApiClient => _client;

export const updateSupabaseClient = (
  _url: string,
  _key: string,
): { url: string; key: string } => {
  return { url: _url, key: _key };
};

export const resetSupabaseClient = (): { url: string; key: string } => {
  _client = new ApiClient(API_BASE);
  return { url: "", key: "" };
};
