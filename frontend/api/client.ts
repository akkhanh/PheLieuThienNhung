export type ApiError = { code: string; message: string; status: number };
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type ListQuery = {
  page?: number;
  page_size?: number;
  from?: string;
  to?: string;
  search?: string;
  sort?: "default" | "amount_desc" | "amount_asc" | "customer_amount_desc" | "customer_amount_asc";
};

export type PaginatedResponse<T> = {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

const readCookie = (name: string) => {
  if (typeof document === "undefined") return "";
  return (
    document.cookie
      .split("; ")
      .find((part) => part.startsWith(`${name}=`))
      ?.split("=")
      .slice(1)
      .join("=") ?? ""
  );
};

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = {
    "content-type": "application/json",
    ...(init.headers ?? {}),
  } as Record<string, string>;
  if (["POST", "PUT", "PATCH", "DELETE"].includes((init.method ?? "GET").toUpperCase())) {
    const csrf = readCookie("csrf");
    if (csrf) headers["x-csrf-token"] = csrf;
  }
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = data.error ?? {
      code: "HTTP_ERROR",
      message: "Request failed",
    };
    throw Object.assign(new Error(error.message), {
      code: error.code,
      status: response.status,
    } satisfies Partial<ApiError>);
  }
  return data as T;
}

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "customer";
  active?: boolean;
};

export type Material = {
  id: number;
  code: string;
  name: string;
  group_name: string;
  unit: string;
  price_per_kg: number;
  active?: boolean;
  is_public?: boolean;
  qty_kg?: number;
  warning_kg?: number;
};

export type PriceHistory = {
  id: number;
  material_id: number;
  price_type: "purchase" | "sale" | "public";
  price_per_kg: number;
  customer_id?: number | null;
  effective_from: string;
  effective_to?: string | null;
  changed_by?: number | null;
  note?: string;
  code?: string;
  name?: string;
};

export type Customer = {
  id: number;
  code: string;
  name: string;
  phone: string;
  address: string;
  note: string;
  orders?: number;
  total_amount?: number;
};

export type PurchaseOrder = {
  id: number;
  code: string;
  customer_id: number;
  status: "draft" | "completed" | "cancelled";
  total_amount: number;
  created_at: string;
  completed_at?: string | null;
  item_count?: number;
  customer_name_snapshot?: string | null;
  customer_name?: string | null;
  customer_phone_snapshot?: string | null;
  customer_phone?: string | null;
};

export type PurchaseOrderItem = {
  material_id?: number;
  material_name?: string;
  material_name_snapshot?: string;
  qty_kg: number;
  unit_price: number;
  discount_amount?: number;
  line_amount: number;
};

export type PurchaseInvoice = PurchaseOrder & {
  invoice_code?: string;
  customer_name_snapshot?: string;
  customer_phone_snapshot?: string;
  note?: string;
  items: PurchaseOrderItem[];
};

export type InventoryMovement = {
  id: number;
  type: "in" | "out" | "adjust";
  qty_kg: number;
  ref_type?: string | null;
  ref_id?: number | null;
  note?: string | null;
  created_at: string;
  order_code?: string | null;
  order_status?: string | null;
  order_completed_at?: string | null;
  customer_id?: number | null;
  customer_code?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  unit_price?: number | null;
  line_amount?: number | null;
};

export type InventoryDetail = Material & {
  active?: boolean;
  effective_from?: string | null;
  movements: InventoryMovement[];
};

export type SalesOrderItem = {
  id?: number;
  material_id: number;
  material_name?: string;
  qty_kg: number;
  unit_price: number;
  discount_amount?: number;
  line_amount: number;
};

export type SalesOrder = {
  id: number;
  code: string;
  buyer_name: string;
  buyer_phone?: string;
  note?: string;
  total_amount: number;
  sold_at: string;
  item_count?: number;
  total_kg?: number;
  items?: SalesOrderItem[];
};

export type CustomerOrdersResponse = {
  customer: Customer;
  orders: Array<
    PurchaseOrder & {
      note?: string;
    }
  >;
};

export type ReportPoint = {
  day?: string;
  month?: string;
  orders: number;
  total_amount: number;
  total_kg?: number;
  revenue?: number;
};

export type AdminReport = {
  orders: number;
  total_amount: number;
  revenue: number;
  completed_orders: number;
  draft_orders: number;
  cancelled_orders: number;
  total_kg: number;
  total_inventory_kg?: number;
  inventory_value?: number;
  cost?: number;
  inventory: { total_kg: number; materials: number; low_stock: number };
  customers: { customers: number };
  top_material: { name: string; qty_kg: number } | null;
  orders_by_day: ReportPoint[];
  orders_by_month: ReportPoint[];
  revenue_by_month: Array<{
    month: string;
    revenue: number;
    total_kg: number;
  }>;
};

export type ProfitReport = {
  range: {
    from: string;
    to: string;
  };
  sales_revenue: number;
  purchase_cost: number;
  gross_profit: number;
  purchase_kg: number;
  sales_kg: number;
  inventory_kg: number;
  inventory_value: number;
  purchase_orders: number;
  sales_orders: number;
  by_day: Array<{
    day: string;
    sales_revenue: number;
    purchase_cost: number;
    gross_profit: number;
    purchase_kg: number;
    sales_kg: number;
    purchase_orders: number;
    sales_orders: number;
  }>;
};

export type CustomerReport = {
  orders: number;
  total_amount: number;
  total_kg: number;
  last_order_at?: string | null;
  top_material: { name: string; qty_kg: number } | null;
  by_day: ReportPoint[];
  by_month: ReportPoint[];
};

export type InventoryFlowReport = {
  material_id: number;
  code: string;
  name: string;
  group_name: string;
  total_in: number;
  total_out: number;
  closing_qty: number;
  inventory_qty: number;
  reconciliation_delta: number;
};

export type SalesMarginReport = {
  sales_order_id: number;
  sales_code: string;
  sold_at: string;
  sales_item_id: number;
  material_id: number;
  material_name_snapshot: string;
  qty_kg: number;
  sale_unit_price: number;
  revenue: number;
  cost_unit_price: number;
  cost_amount: number;
  gross_profit: number;
};

export type AuditLog = {
  id: number;
  action: string;
  entity: string;
  entity_id?: number | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  user_name?: string | null;
  user_email?: string | null;
};

const buildListQuery = (query: ListQuery = {}) => {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.page_size) params.set("page_size", String(query.page_size));
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.sort && query.sort !== "default") params.set("sort", query.sort);
  if (query.search) {
    params.set("search", query.search);
    params.set("q", query.search);
  }
  const text = params.toString();
  return text ? `?${text}` : "";
};

function normalizePaginated<T>(
  value: T[] | PaginatedResponse<T>,
  fallbackPageSize = 20,
): PaginatedResponse<T> {
  if (Array.isArray(value)) {
    return {
      items: value,
      page: 1,
      page_size: fallbackPageSize,
      total: value.length,
      total_pages: 1,
    };
  }
  return value;
}

export const authApi = {
  login: (email: string, password: string) =>
    api<{ user: AuthUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (payload: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    address?: string;
  }) =>
    api<{ user: AuthUser }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  me: () => api<{ user: AuthUser }>("/api/auth/me"),
  logout: () => api<{ ok: true }>("/api/auth/logout", { method: "POST" }),
};

export const publicApi = {
  prices: () => api<Material[]>("/api/prices"),
  materials: () => api<Material[]>("/api/materials"),
};

export const adminApi = {
  materials: (q = "") =>
    api<Material[]>(`/api/materials?q=${encodeURIComponent(q)}`),
  createMaterial: (payload: {
    code: string;
    name: string;
    group_name: string;
    unit?: string;
    active?: boolean;
    is_public?: boolean;
  }) =>
    api<Material>("/api/materials", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateMaterial: (id: number, payload: Partial<Pick<Material, "name" | "group_name" | "unit" | "is_public">>) =>
    api<Material>(`/api/materials/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  customers: async (query: string | ListQuery = "") =>
    normalizePaginated(
      await api<Customer[] | PaginatedResponse<Customer>>(
        `/api/customers${
          typeof query === "string"
            ? `?q=${encodeURIComponent(query)}`
            : buildListQuery(query)
        }`,
      ),
      typeof query === "object" && query.page_size ? query.page_size : 20,
    ),
  createCustomer: (
    payload: Pick<Customer, "name" | "phone"> &
      Partial<Pick<Customer, "address" | "note">>,
  ) =>
    api<Customer>("/api/customers", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateCustomer: (
    id: number,
    payload: Partial<Pick<Customer, "name" | "phone" | "address" | "note">>,
  ) =>
    api<Customer>(`/api/customers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteCustomer: (id: number) =>
    api<{ ok: true; affectedRows: number }>(`/api/customers/${id}`, {
      method: "DELETE",
    }),
  customerOrders: (id: number) =>
    api<CustomerOrdersResponse>(`/api/customers/${id}/orders`),
  orders: async (query: ListQuery = {}) =>
    normalizePaginated(
      await api<PurchaseOrder[] | PaginatedResponse<PurchaseOrder>>(
        `/api/orders${buildListQuery(query)}`,
      ),
      query.page_size ?? 20,
    ),
  order: (id: number) => api<PurchaseInvoice>(`/api/orders/${id}`),
  cancelOrder: (id: number, cancellationReason: string) =>
    api<{ ok: true; status: "cancelled" }>(`/api/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "cancelled", cancellation_reason: cancellationReason }),
    }),
  invoice: (code: string) =>
    api<PurchaseInvoice>(`/api/invoices/${encodeURIComponent(code)}`),
  createOrder: (payload: {
    customer_id: number | null;
    customer_name?: string;
    customer_phone?: string;
    items: { material_id: number; qty_kg: number; unit_price?: number; discount_amount?: number }[];
    note?: string;
  }) =>
    api<PurchaseOrder>("/api/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  inventory: async (query: ListQuery = {}) =>
    normalizePaginated(
      await api<Material[] | PaginatedResponse<Material>>(
        `/api/inventory${buildListQuery(query)}`,
      ),
      query.page_size ?? 20,
    ),
  inventoryDetail: (materialId: number) =>
    api<InventoryDetail>(`/api/inventory/${materialId}`),
  sales: async (query: string | ListQuery = "") =>
    normalizePaginated(
      await api<SalesOrder[] | PaginatedResponse<SalesOrder>>(
        `/api/sales${
          typeof query === "string"
            ? `?q=${encodeURIComponent(query)}`
            : buildListQuery(query)
        }`,
      ),
      typeof query === "object" && query.page_size ? query.page_size : 20,
    ),
  sale: (id: number) => api<SalesOrder>(`/api/sales/${id}`),
  createSale: (payload: {
    buyer_name: string;
    buyer_phone?: string;
    sold_at?: string;
    note?: string;
    items: { material_id: number; qty_kg: number; unit_price?: number; discount_amount?: number }[];
  }) =>
    api<SalesOrder>("/api/sales", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  summary: () => api<AdminReport>("/api/reports/summary"),
  dashboard: () => api<AdminReport>("/api/reports/dashboard"),
  profit: (params?: { from?: string; to?: string }) => {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return api<ProfitReport>(`/api/reports/profit${suffix}`);
  },
  inventoryFlow: () => api<{ items: InventoryFlowReport[]; total: number }>('/api/reports/inventory-flow'),
  salesMargins: async (query: ListQuery = {}) =>
    normalizePaginated(
      await api<PaginatedResponse<SalesMarginReport>>(`/api/reports/sales-margins${buildListQuery(query)}`),
      query.page_size ?? 25,
    ),
  auditLogs: async (query: ListQuery = {}) =>
    normalizePaginated(
      await api<AuditLog[] | PaginatedResponse<AuditLog>>(`/api/audit-logs${buildListQuery(query)}`),
      query.page_size ?? 25,
    ),
  createPrice: (
    material_id: number,
    price_per_kg: number,
    options?: string | { note?: string; is_public?: boolean },
  ) =>
    api<{ id: number }>("/api/prices", {
      method: "POST",
      body: JSON.stringify({
        material_id,
        price_per_kg,
        note: typeof options === "string" ? options : options?.note,
        is_public: typeof options === "object" ? options?.is_public : true,
      }),
    }),
  updatePrice: (
    material_id: number,
    price_per_kg: number,
    options?: string | { note?: string; is_public?: boolean },
  ) =>
    api<{ id: number }>("/api/prices", {
      method: "POST",
      body: JSON.stringify({
        material_id,
        price_per_kg,
        note: typeof options === "string" ? options : options?.note,
        is_public: typeof options === "object" ? options?.is_public : true,
      }),
    }),
  priceHistory: (materialId?: number) =>
    api<PriceHistory[]>(`/api/prices/history${materialId ? `?material_id=${materialId}` : ""}`),
  adjustInventory: (payload: {
    material_id: number;
    qty_kg: number;
    type: "in" | "out" | "adjust";
    note?: string;
  }) =>
    api<{ ok: true }>("/api/inventory/adjust", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export const customerApi = {
  orders: () => api<PurchaseOrder[]>("/api/customer/orders"),
  order: (code: string) =>
    api<PurchaseInvoice>(`/api/customer/orders/${encodeURIComponent(code)}`),
  report: () => api<CustomerReport>("/api/customer/reports"),
};
