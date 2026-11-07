export function getApiBase(): string {
  // In the browser, always use same-origin relative `/api/v1`.
  // Next.js rewrites in next.config.mjs proxy all `/api/v1/*` requests directly
  // to BACKEND_INTERNAL_URL. This completely eliminates CORS errors and Cloudflare 530/502 errors!
  if (typeof window !== "undefined") {
    return "/api/v1";
  }
  const envUrl = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8005";
  const clean = envUrl.replace(/\/+$/, "");
  return clean.endsWith("/api/v1") ? clean : `${clean}/api/v1`;
}

export const API_BASE = getApiBase();

class ApiClient {
  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("bricdoc_token");
  }

  public setToken(token: string) {
    if (typeof window !== "undefined") {
      localStorage.setItem("bricdoc_token", token);
    }
  }

  public clearToken() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("bricdoc_token");
      localStorage.removeItem("bricdoc_user");
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    let url: string;
    if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
      url = endpoint;
    } else {
      const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
      const subPath = cleanEndpoint.startsWith("/api/v1/")
        ? cleanEndpoint.replace(/^\/api\/v1/, "")
        : cleanEndpoint;
      const base = getApiBase();
      url = `${base}${subPath}`;
    }

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    const token = this.getToken();
    if (token && !headers["Authorization"]) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Do not set Content-Type if body is FormData
    if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
      });

      // If the direct external URL returned 502/503/504 (e.g. dead tunnel), attempt same-origin proxy fallback
      if (!response.ok && (response.status === 502 || response.status === 503 || response.status === 504)) {
        if (typeof window !== "undefined" && (url.startsWith("http://") || url.startsWith("https://"))) {
          try {
            const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
            const proxySubPath = cleanEndpoint.startsWith("/api/v1/")
              ? cleanEndpoint
              : `/api/v1${cleanEndpoint}`;
            const proxyResponse = await fetch(proxySubPath, {
              ...options,
              headers,
            });
            if (proxyResponse.ok) {
              response = proxyResponse;
            }
          } catch {
            // Keep original response for error formatting
          }
        }
      }
    } catch (fetchErr: any) {
      // If direct request failed and we were calling an absolute URL, attempt same-origin Next.js proxy fallback
      if (typeof window !== "undefined" && (url.startsWith("http://") || url.startsWith("https://"))) {
        try {
          const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
          const proxySubPath = cleanEndpoint.startsWith("/api/v1/")
            ? cleanEndpoint
            : `/api/v1${cleanEndpoint}`;
          response = await fetch(proxySubPath, {
            ...options,
            headers,
          });
        } catch {
          throw new Error(
            `Cannot reach BricDoc backend engine (${url}). Please ensure the backend service is running and accessible.`
          );
        }
      } else {
        if (fetchErr.name === "TypeError" || fetchErr.message?.includes("fetch")) {
          throw new Error(
            `Cannot reach BricDoc backend engine (${url}). Please ensure the backend service is running and accessible.`
          );
        }
        throw fetchErr;
      }
    }

    if (!response.ok) {
      let errorMessage = `Request failed (${response.status})`;
      try {
        const rawText = await response.text();
        if (rawText) {
          try {
            const errorJson = JSON.parse(rawText);
            if (errorJson.detail) {
              errorMessage = typeof errorJson.detail === "string" 
                ? errorJson.detail 
                : JSON.stringify(errorJson.detail);
            } else if (errorJson.message) {
              errorMessage = errorJson.message;
            } else {
              errorMessage = rawText;
            }
          } catch {
            // rawText is not JSON (e.g. HTML 502/504 gateway error from proxy or tunnel)
            if (response.status === 530 || response.status === 502 || response.status === 504 || response.status === 503) {
              errorMessage = `BricDoc backend engine is reconnecting. Please retry your request in a few moments.`;
            } else if (rawText.length < 300 && !rawText.includes("<!DOCTYPE")) {
              errorMessage = rawText;
            } else {
              errorMessage = `Server returned status ${response.status}.`;
            }
          }
        }
      } catch {
        // Stream could not be read
      }
      const err: any = new Error(errorMessage);
      err.status = response.status;
      err.isLimitExceeded = response.status === 429 || errorMessage.includes("DAILY_LIMIT_EXCEEDED") || errorMessage.includes("limit of 10 files");
      throw err;
    }

    // If response is a downloadable binary (PDF, ZIP, DOCX, Excel, Images, etc.)
    const contentType = response.headers.get("content-type") || "";
    if (
      contentType.includes("application/pdf") ||
      contentType.includes("application/zip") ||
      contentType.includes("application/octet-stream") ||
      contentType.includes("application/vnd.openxmlformats") ||
      contentType.includes("image/")
    ) {
      return (await response.blob()) as unknown as T;
    }

    // Safely read response text once to avoid "body stream already read"
    const bodyText = await response.text();
    try {
      return JSON.parse(bodyText) as T;
    } catch {
      // Fallback for plain text, markdown, or binary-like text streams
      return new Blob([bodyText], { type: contentType || "text/plain" }) as unknown as T;
    }
  }

  // Auth
  async register(data: { email: string; password: string; full_name?: string }) {
    const res = await this.request<{ access_token: string; user_id: string; email: string; full_name?: string }>(
      "/auth/register",
      { method: "POST", body: JSON.stringify(data) }
    );
    this.setToken(res.access_token);
    return res;
  }

  async login(data: { email: string; password: string }) {
    const res = await this.request<{ access_token: string; user_id: string; email: string; full_name?: string }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify(data) }
    );
    this.setToken(res.access_token);
    return res;
  }

  async getMe() {
    return this.request<any>("/auth/me");
  }

  async updateProfile(data: any) {
    return this.request<any>("/auth/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  // Documents & Vault
  async listDocuments(params?: { folder_id?: string; is_favorite?: boolean; is_trashed?: boolean; search?: string }) {
    const query = new URLSearchParams();
    if (params?.folder_id) query.append("folder_id", params.folder_id);
    if (params?.is_favorite !== undefined) query.append("is_favorite", String(params.is_favorite));
    if (params?.is_trashed !== undefined) query.append("is_trashed", String(params.is_trashed));
    if (params?.search) query.append("search", params.search);

    const qs = query.toString() ? `?${query.toString()}` : "";
    return this.request<any[]>(`/documents${qs}`);
  }

  async uploadDocument(file: File, folderId?: string) {
    const formData = new FormData();
    formData.append("file", file);
    const qs = folderId ? `?folder_id=${encodeURIComponent(folderId)}` : "";
    return this.request<any>(`/documents/upload${qs}`, {
      method: "POST",
      body: formData,
    });
  }

  async deleteDocument(id: string) {
    return this.request<void>(`/documents/${id}`, { method: "DELETE" });
  }

  async trashDocument(id: string) {
    return this.request<any>(`/documents/${id}/trash`, { method: "POST" });
  }

  async restoreDocument(id: string) {
    return this.request<any>(`/documents/${id}/restore`, { method: "POST" });
  }

  async createShareLink(documentId: string, hours: number = 48) {
    return this.request<any>("/documents/share", {
      method: "POST",
      body: JSON.stringify({ document_id: documentId, expires_in_hours: hours, allow_download: true })
    });
  }

  // Generic Tool Runner (multipart upload returning Blob or JSON)
  async executeTool<T = Blob>(endpoint: string, formData: FormData): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: formData,
    });
  }

  // AI
  async aiSummarize(formData: FormData) {
    return this.request<any>("/ai/summarize", {
      method: "POST",
      body: formData,
    });
  }

  async aiChat(formData: FormData) {
    return this.request<any>("/ai/chat", {
      method: "POST",
      body: formData,
    });
  }

  async aiExtract(formData: FormData) {
    return this.request<any>("/ai/extract", {
      method: "POST",
      body: formData,
    });
  }

  async aiStudy(formData: FormData) {
    return this.request<any>("/ai/study", {
      method: "POST",
      body: formData,
    });
  }

  // Workflows
  async listWorkflows() {
    return this.request<any[]>("/workflows");
  }

  async createWorkflow(data: any) {
    return this.request<any>("/workflows", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async runWorkflow(workflowId: string, formData: FormData): Promise<Blob> {
    return this.request<Blob>(`/workflows/${workflowId}/run`, {
      method: "POST",
      body: formData,
    });
  }

  // Health
  async getHealth() {
    return this.request<any>("/admin/health");
  }

  // Document Editor
  async getEditorInfo(formData: FormData) {
    return this.request<{ total_pages: number; pages: { page: number; width: number; height: number }[] }>(
      "/editor/info",
      { method: "POST", body: formData }
    );
  }

  async renderEditorPage(formData: FormData) {
    return this.request<{ page: number; total_pages: number; width: number; height: number; image: string }>(
      "/editor/render-page",
      { method: "POST", body: formData }
    );
  }

  async getEditorTextBlocks(formData: FormData) {
    return this.request<{ page: number; blocks: { bbox: [number, number, number, number]; text: string; block_id: number }[] }>(
      "/editor/text-blocks",
      { method: "POST", body: formData }
    );
  }

  async replaceEditorText(formData: FormData): Promise<Blob> {
    return this.request<Blob>("/editor/replace-text", {
      method: "POST",
      body: formData,
    });
  }

  async deleteEditorText(formData: FormData): Promise<Blob> {
    return this.request<Blob>("/editor/delete-text", {
      method: "POST",
      body: formData,
    });
  }

  async replaceEditorBlock(formData: FormData): Promise<Blob> {
    return this.request<Blob>("/editor/replace-block", {
      method: "POST",
      body: formData,
    });
  }

  // Daily Usage & Subscription Quota
  async getDailyUsage(): Promise<{
    plan_tier: string;
    is_pro: boolean;
    daily_limit: number | null;
    daily_used: number;
    daily_remaining: number;
    is_limit_exceeded: boolean;
    first_time_offer: {
      eligible: boolean;
      promo_price_usd: number;
      regular_price_usd: number;
      discount_pct: number;
      headline?: string;
      terms?: string;
    };
  }> {
    return this.request("/subscription/usage");
  }

  async claimFirstTimeOffer(): Promise<{
    success: boolean;
    message: string;
    plan_tier?: string;
    requires_auth?: boolean;
    redirect_url?: string;
  }> {
    return this.request("/subscription/claim-first-time-offer", {
      method: "POST",
    });
  }

  // Subscription & Payment Gateway Endpoints
  async getCurrentSubscription(): Promise<any> {
    return this.request("/subscription/current");
  }

  async cancelSubscription(data: { cancel_at_period_end?: boolean; reason?: string } = {}): Promise<{
    success: boolean;
    message: string;
    cancel_at_period_end: boolean;
  }> {
    return this.request("/subscription/cancel", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async reactivateSubscription(): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.request("/subscription/reactivate", {
      method: "POST",
    });
  }

  async getPaymentMethod(): Promise<any> {
    return this.request("/subscription/current");
  }

  async cancelAutoRenew(): Promise<any> {
    return this.request("/subscription/cancel", {
      method: "POST",
      body: JSON.stringify({ cancel_at_period_end: true }),
    });
  }

  // Real Payment Gateway Endpoints
  async getPaymentConfig(): Promise<{
    gateway: string;
    is_configured: boolean;
    razorpay_key_id: string | null;
    mode: string;
    pricing_catalog: {
      free: any;
      pro: any;
      business: any;
      tax_rate_percent: number;
    };
    supported_methods: string[];
    user_subscription?: any;
  }> {
    return this.request("/payments/config");
  }

  async createPaymentOrder(data: {
    plan?: string;
    currency?: string;
    billing_name?: string;
    billing_email?: string;
  } = {}): Promise<{
    success: boolean;
    order_id: string;
    amount: number;
    currency: string;
    amount_inr: number;
    subtotal_inr: number;
    tax_inr: number;
    tax_rate: number;
    is_intro_promo: boolean;
    key_id: string;
    name: string;
    description: string;
    prefill: {
      name: string;
      email: string;
    };
    theme: {
      color: string;
    };
  }> {
    return this.request("/payments/create-order", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async verifyPayment(data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    billing_name?: string;
    billing_email?: string;
    billing_address?: string;
  }): Promise<{
    success: boolean;
    message: string;
    plan_tier: string;
    payment_id: string;
    order_id: string;
    invoice_id?: string;
    invoice_number?: string;
    current_period_end: string;
  }> {
    return this.request("/payments/verify", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getPaymentStatus(orderId: string): Promise<any> {
    return this.request(`/payments/status/${orderId}`);
  }

  async getPaymentHistory(): Promise<{
    total: number;
    transactions: Array<{
      id: string;
      payment_id: string;
      amount_paise: number;
      amount_inr: number;
      currency: string;
      method: string;
      status: string;
      invoice_id?: string;
      invoice_number?: string;
      created_at: string;
    }>;
  }> {
    return this.request("/payments/history");
  }

  async getInvoices(): Promise<{
    total: number;
    invoices: Array<{
      id: string;
      invoice_number: string;
      plan_tier: string;
      amount_subtotal_inr: number;
      tax_amount_inr: number;
      amount_total_inr: number;
      currency: string;
      status: string;
      issued_at: string;
      download_url: string;
    }>;
  }> {
    return this.request("/payments/invoices");
  }

  async requestRefund(data: {
    transaction_id: string;
    reason?: string;
    amount_paise?: number;
  }): Promise<{
    success: boolean;
    refund_id: string;
    gateway_refund_id?: string;
    amount_inr: number;
    status: string;
    message: string;
  }> {
    return this.request("/payments/refund", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async setPaymentKeys(data: {
    razorpay_key_id: string;
    razorpay_key_secret: string;
    razorpay_webhook_secret?: string;
  }): Promise<{
    success: boolean;
    message: string;
    key_id: string;
    mode: string;
  }> {
    return this.request("/payments/set-keys", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiClient();
