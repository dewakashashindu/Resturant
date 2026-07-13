import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { AUTH_SESSION_KEYS, storage } from './storage';

type ExpoConstantsLike = typeof Constants & {
  expoConfig?: { hostUri?: string };
  manifest?: { debuggerHost?: string };
  manifest2?: { extra?: { expoClient?: { hostUri?: string } } };
};

const extractHost = (value?: string) => {
  if (!value) return '';
  return String(value).split(':')[0].trim();
};

const isDirectReachableDevHost = (host: string) => {
  if (!host) return false;
  if (host === 'localhost' || host === '127.0.0.1') return true;
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
};


const resolveApiBaseUrl = () => {
  const envBaseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').trim();
  if (envBaseUrl) return envBaseUrl;

  const constants = Constants as ExpoConstantsLike;
  const hostUri = constants.expoConfig?.hostUri ?? constants.manifest2?.extra?.expoClient?.hostUri;
  const debuggerHost = constants.manifest?.debuggerHost;
  const lanHost = extractHost(hostUri);
  const debugHost = extractHost(debuggerHost);

  if (isDirectReachableDevHost(lanHost)) {
    return `http://${lanHost}:3000`;
  }

  if (isDirectReachableDevHost(debugHost)) {
    return `http://${debugHost}:3000`;
  }

  return Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
};


const BACKEND_IP_KEY = 'backend-ip';

export const setBackendIP = (ip: string) => {
  (global as any).backendIP = ip;
  try {
    storage.set(BACKEND_IP_KEY, ip);
  } catch (e) {
    console.log('[api] Failed to persist backendIP', e);
  }
};

const getDynamicApiBaseUrl = () => {

  let ip = (global as any).backendIP;

  if (!ip) {
    try {
      const stored = storage.getString(BACKEND_IP_KEY);
      if (stored) {
        ip = stored;
        (global as any).backendIP = stored; // warm the in-memory cache for this session
      }
    } catch (e) {
      console.log('[api] Failed to read persisted backendIP', e);
    }
  }

  ip = ip || '192.168.8.100';

  return `http://${ip}:3000`;
};

const GLOBAL_PRESET_REMARKS_KEY = 'global_preset_remarks';

// 1. Get cached remarks instantly from local memory (No network latency)
export const getCachedOrderDescriptions = (): string[] => {
  try {
    const cachedData = storage.getString(GLOBAL_PRESET_REMARKS_KEY);
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      if (Array.isArray(parsed)) {
        return parsed
          .map((value) => String(value ?? '').trim())
          .filter(Boolean);
      }
    }
  } catch (error) {
    console.log('❌ Error reading MMKV cache:', error);
  }

  // Hardcoded fallback list in case MMKV is completely empty on first launch
  return ['TAKE A WAY', 'LESS OIL', 'NO BEEF', 'LESS CHILI'];
};

// 2. Background sync function to fetch fresh records from SQL and save to MMKV
export const syncGlobalOrderDescriptions = async (): Promise<void> => {
  try {
    
    const response = await fetch(`${getDynamicApiBaseUrl()}/api/remarks/order-descriptions`);
    const data = await response.json();

    if (data.ok && Array.isArray(data.descriptions)) {
      const cleanedDescriptions = data.descriptions
        .map((value: unknown) => String(value ?? '').trim())
        .filter(Boolean);

      // Save the fresh string array from SQL Server straight into MMKV
      storage.set(GLOBAL_PRESET_REMARKS_KEY, JSON.stringify(cleanedDescriptions));
      console.log('✅ [MMKV Global Sync] Cache successfully updated with fresh SQL DB data!');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log('⚠️ [MMKV Global Sync] Server unreachable. Keeping existing cache:', message);
  }
};

export interface CartItem {
  menuItemCode: string;
  menuItmDes: string;
  salesPrice: number;
  quantity: number;
  itemRemarks?: string;
}

export interface ConfirmCartItemPayload {
  ItemCode: string;
  QTY: number;
  ItemRemarks: string;
  SalesPrice: number;
}

export interface ConfirmCartPayload {
  orderType?: string; 
  TabelNo: string;
  UserID: number;
  TabelGrpID: string | null;
  LPax: number;
  FPax: number;
  items: ConfirmCartItemPayload[];
  customerDetails?: { 
    regTel: string;
    cusName: string;
    rmks: string;
  } | null;
}

export interface AddBillingItemPayload {
  TabelNo: string;
  UserID: number;
  items: {
    ItemCode: string;
    QTY: number;
    SalesPrice: number;
    ItemRemarks?: string;
    itemRemarks?: string;
  }[];
}

export interface RemoveBillingItemPayload {
  TabelNo: string;
  UserID: number;
  ItemCode: string;
  QTY: number;
  ItemRemarks: string;
  VoidRemark?: string;
  MgrID: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  ok: boolean;
  data?: T;
  error?: string;
}

type ConfirmCartPayloadInput = ConfirmCartPayload | {
  orderType?: string; 
  tableNo?: string;
  TableNo?: string;
  userId?: number | string;
  UserID?: number | string;
  tableGrpId?: string | null;
  TabelGrpID?: string | null;
  lPax?: number;
  LPax?: number;
  fPax?: number;
  FPax?: number;
  existingInvoiceNo?: string | null;
  invoiceNo?: string | null;
  items: Array<{
    menuItemCode?: string;
    ItemCode?: string;
    quantity?: number;
    QTY?: number;
    itemRemarks?: string;
    ItemRemarks?: string;
    salesPrice?: number;
    SalesPrice?: number;
  }>;
  customerDetails?: { 
    regTel?: string;
    regTelNo?: string;
    cusName?: string;
    rmks?: string;
  } | null;
};

type AddBillingItemPayloadInput = AddBillingItemPayload | {
  tableNo?: string;
  TabelNo?: string;
  userId?: number | string;
  UserID?: number | string;
  itemCode?: string;
  ItemCode?: string;
  qty?: number;
  QTY?: number;
  salesPrice?: number;
  SalesPrice?: number;
  itemRemarks?: string;
  ItemRemarks?: string;
  tableGrpId?: string;
  TabelGrpID?: string;
  lPax?: number;
  LPax?: number;
  fPax?: number;
  FPax?: number;
  mgrId?: string;
  MgrID?: string;
  items?: Array<{
    ItemCode?: string;
    itemCode?: string;
    QTY?: number;
    qty?: number;
    qtyDifference?: number;
    quantity?: number;
    SalesPrice?: number;
    salesPrice?: number;
    ItemRemarks?: string;
    itemRemarks?: string;
  }>;
};

type RemoveBillingItemPayloadInput = RemoveBillingItemPayload | {
  tableNo?: string;
  TabelNo?: string;
  userId?: number | string;
  UserID?: number | string;
  itemCode?: string;
  ItemCode?: string;
  qty?: number;
  QTY?: number;
  qtyDifference?: number;
  quantity?: number;
  salesPrice?: number;
  SalesPrice?: number;
  tableGrpId?: string;
  TabelGrpID?: string;
  lPax?: number;
  LPax?: number;
  fPax?: number;
  FPax?: number;
  itemRemarks?: string;
  ItemRemarks?: string;
  mgrId?: string;
  MgrID?: string;
  voidRemark?: string;
  VoidRemark?: string;
};

const buildAuthHeaders = async (): Promise<Record<string, string>> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  // The current login flow (authStore.setSession) writes the token to MMKV,
  // not AsyncStorage. Read from MMKV first; fall back to the legacy
  // AsyncStorage key only for sessions created before that migration.
  let token = String(storage.getString(AUTH_SESSION_KEYS.token) ?? '').trim();
  if (!token) {
    token = String((await AsyncStorage.getItem('token')) ?? '').trim();
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

const parseResponseBody = async (response: Response) => {
  const contentType = response.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json')) {
      return await response.json();
    }
    return await response.text();
  } catch (error) {
    try {
      return await response.text();
    } catch (_) {
      return null;
    }
  }
};

const requestJson = async <T = any>(url: string, init?: RequestInit): Promise<ApiResponse<T>> => {
  try {
    const response = await fetch(url, init);
    const data = await parseResponseBody(response);

    if (!response.ok) {
      const errorMessage =
        (data && typeof data === 'object' && ('message' in data || 'error' in data))
          ? String((data as any).message || (data as any).error)
          : `Request failed with status ${response.status}`;

      return {
        success: false,
        ok: false,
        data,
        error: errorMessage,
      };
    }

    return {
      success: true,
      ok: true,
      data,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      ok: false,
      error: message,
    };
  }
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toPositiveQuantity = (value: unknown, fallback = 0) => {
  const parsed = Math.floor(Math.abs(toNumber(value, fallback)));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
};

const toString = (value: unknown, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  return String(value);
};

const normalizeConfirmCartPayload = (payload: ConfirmCartPayloadInput): any => {
  
  const items = Array.isArray(payload.items)
    ? payload.items.map((item) => ({
        itemCode: toString((item as any).ItemCode ?? (item as any).menuItemCode ?? (item as any).itemCode, '').trim(),
        quantity: toNumber((item as any).QTY ?? (item as any).quantity ?? 0, 0),
        itemRemarks: toString((item as any).ItemRemarks ?? (item as any).itemRemarks, ''),
        salesPrice: toNumber((item as any).SalesPrice ?? (item as any).salesPrice ?? (item as any).price ?? 0, 0),
      })).filter((item) => item.itemCode && item.quantity > 0)
    : [];

  const rawCustomer = (payload as any).customerDetails;
  const normalizedCustomer = rawCustomer
    ? {
        regTel: toString(rawCustomer.regTel ?? rawCustomer.regTelNo, '').trim(),
        cusName: toString(rawCustomer.cusName, '').trim(),
        rmks: toString(rawCustomer.rmks, '').trim(),
      }
    : null;

  
  let rawOrderType = toString((payload as any).orderType, 'DI').trim();
  if (rawOrderType === 'DINING' || rawOrderType === 'Dine In' || rawOrderType === 'DI') {
    rawOrderType = 'DI';
  } else if (rawOrderType === 'TA' || rawOrderType === 'Take Away' || rawOrderType === 'TAKEAWAY') {
    rawOrderType = 'TA';
  }


  // Resolve the existing invoice number — checked under both field names
  // so it survives regardless of how the caller spelled it.
  const existingInvoiceNo = toString(
    (payload as any).existingInvoiceNo ?? (payload as any).invoiceNo ?? '',
    ''
  ).trim() || null;

  return {
    items,
    tableNo: toString((payload as any).TabelNo ?? (payload as any).tableNo ?? '', '').trim(),
    orderType: rawOrderType,
    tableGrpId: (payload as any).TabelGrpID ?? (payload as any).tableGrpId ?? null,
    lPax: toNumber((payload as any).LPax ?? (payload as any).lPax, 0),
    fPax: toNumber((payload as any).FPax ?? (payload as any).fPax, 0),
    userId: toString((payload as any).UserID ?? (payload as any).userId ?? 'SYSTEM', ''),
    customerDetails: normalizedCustomer,
    // Pass through so the server can match the existing open bill instead of
    // generating a new TA serial / INV number on every Add-More confirm.
    existingInvoiceNo,
  };
};

const normalizeAddBillingPayload = (payload: AddBillingItemPayload | {
  tableNo?: string;
  userId?: number | string;
  itemCode?: string;
  ItemCode?: string;
  qty?: number;
  QTY?: number;
  salesPrice?: number;
  SalesPrice?: number;
  items: Array<{ ItemCode?: string; itemCode?: string; QTY?: number; qty?: number; quantity?: number; SalesPrice?: number; salesPrice?: number }>;
}) => {
  const sourceItems = Array.isArray((payload as any).items)
    ? (payload as any).items
    : ((payload as any).ItemCode || (payload as any).itemCode ? [payload as any] : []);

  // Resolve orderType at payload level — TA orders must keep 'TA' all the way to the server.
  const rawOrderType = toString((payload as any).orderType ?? (payload as any).OrderType, '').trim();
  const orderType = rawOrderType === 'TA' ? 'TA' : (rawOrderType || 'DI');

  // tableGrpId: TA orders use a single space " " (DB constraint); DI orders pass whatever came in.
  const rawTableGrpId = toString((payload as any).tableGrpId ?? (payload as any).TabelGrpID ?? (payload as any).TableGrpID, '');
  const tableGrpId = orderType === 'TA' ? ' ' : rawTableGrpId;

  return {
    TabelNo: toString((payload as any).TabelNo ?? (payload as any).tableNo, '').trim(),
    UserID: toNumber((payload as any).UserID ?? (payload as any).userId, 0),
    orderType,
    tableGrpId,
    // invoiceNo MUST be forwarded — the PK on Tbl_HoldUpsCloud is (TabelNo, ItemCode, InvoiceNo).
    // Without it the server cannot find the existing row, falls through to INSERT,
    // and hits "Violation of PRIMARY KEY constraint PK_Tbl_HoldUpsCloud".
    invoiceNo: toString((payload as any).invoiceNo ?? (payload as any).InvoiceNo, '').trim() || undefined,
    lPax: toNumber((payload as any).lPax ?? (payload as any).LPax, 0),
    fPax: toNumber((payload as any).fPax ?? (payload as any).FPax, 0),
    mgrId: toString((payload as any).mgrId ?? (payload as any).MgrID, '').trim(),
    items: sourceItems
      .map((item: any) => ({
        ItemCode: toString((item as any).ItemCode ?? (item as any).itemCode, '').trim(),
        QTY: toPositiveQuantity((item as any).QTY ?? (item as any).qty ?? (item as any).qtyDifference ?? (item as any).quantity, 0),
        SalesPrice: toNumber((item as any).SalesPrice ?? (item as any).salesPrice, 0),
        ItemRemarks: toString((item as any).ItemRemarks ?? (item as any).itemRemarks, ''),
      }))
      .filter((item: any) => item.ItemCode && item.QTY > 0),
  };
};

const normalizeRemoveBillingPayload = (payload: RemoveBillingItemPayload | {
  tableNo?: string;
  userId?: number | string;
  itemCode?: string;
  ItemCode?: string;
  qty?: number;
  QTY?: number;
  quantity?: number;
  itemRemarks?: string;
  ItemRemarks?: string;
  mgrId?: string;
  MgrID?: string;
  voidRemark?: string;
  VoidRemark?: string;
}) => {
  const rawOrderType = toString((payload as any).orderType ?? (payload as any).OrderType, '').trim();
  const orderType = rawOrderType === 'TA' ? 'TA' : (rawOrderType || 'DI');

  // tableGrpId: TA orders must use a single space " " per DB constraint.
  const rawTableGrpId = toString((payload as any).tableGrpId ?? (payload as any).TabelGrpID ?? (payload as any).TableGrpID, '');
  const tableGrpId = orderType === 'TA' ? ' ' : rawTableGrpId;

  return {
    TabelNo: toString((payload as any).TabelNo ?? (payload as any).tableNo, '').trim(),
    UserID: toNumber((payload as any).UserID ?? (payload as any).userId, 0),
    ItemCode: toString((payload as any).ItemCode ?? (payload as any).itemCode, '').trim(),
    QTY: toPositiveQuantity((payload as any).QTY ?? (payload as any).qty ?? (payload as any).qtyDifference ?? (payload as any).quantity, 0),
    ItemRemarks: '',
    VoidRemark: toString((payload as any).VoidRemark ?? (payload as any).voidRemark ?? (payload as any).ItemRemarks ?? (payload as any).itemRemarks, ''),
    MgrID: toString((payload as any).MgrID ?? (payload as any).mgrId, '').trim(),
    SalesPrice: toNumber((payload as any).SalesPrice ?? (payload as any).salesPrice, 0),
    orderType,
    tableGrpId,
    lPax: toNumber((payload as any).lPax ?? (payload as any).LPax, 0),
    fPax: toNumber((payload as any).fPax ?? (payload as any).FPax, 0),
  };
};

export const apiClient = {
  login: async (username: string, password: string) => {
    return requestJson(`${getDynamicApiBaseUrl()}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  },

  /**
   * Checks whether a username exists in the DB.
   * Called on username field blur — before the user types their password.
   *
   * Returns:
   *   { status: 'found' }              — username exists in DB
   *   { status: 'not_found' }          — username NOT in DB
   *   { status: 'server_unreachable' } — cannot reach backend at all
   *   { status: 'db_error', message }  — backend reachable but DB failed
   */
  checkUsername: async (username: string): Promise<{
    status: 'found' | 'not_found' | 'server_unreachable' | 'db_error';
    message?: string;
  }> => {
    try {
      const url = `${getDynamicApiBaseUrl()}/api/auth/check-username?username=${encodeURIComponent(username)}`;
      const response = await fetch(url, { method: 'GET' });
      const data = await response.json();

      if (response.ok && data.exists === true) {
        return { status: 'found' };
      }
      if (response.status === 404) {
        return { status: 'not_found', message: data.message };
      }
      if (response.status === 503) {
        return { status: 'db_error', message: data.message };
      }
      return { status: 'not_found', message: data.message };
    } catch (_) {
      // fetch itself threw — network unreachable or server is down
      return { status: 'server_unreachable' };
    }
  },

  signup: async (username: string, password: string, phoneNumber: string) => {
    const response = await fetch(`${getDynamicApiBaseUrl()}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, phoneNumber }),
    });
    const data = await response.json();
    return { ok: response.ok, data };
  },

  forgotPassword: async (username: string) => {
    const response = await fetch(`${getDynamicApiBaseUrl()}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    const data = await response.json();
    return { ok: response.ok, data };
  },

  resetPassword: async (username: string, newPassword: string) => {
    const response = await fetch(`${getDynamicApiBaseUrl()}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, newPassword }),
    });
    const data = await response.json();
    return { ok: response.ok, data };
  },

  changePassword: async (username: string, currentPassword: string, newPassword: string) => {
    const response = await fetch(`${getDynamicApiBaseUrl()}/api/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, currentPassword, newPassword }),
    });
    const data = await response.json();
    return { ok: response.ok, data };
  },

  verifyManager: async (username: string, password: string) => {
    const response = await fetch(`${getDynamicApiBaseUrl()}/api/auth/verify-manager`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    let data: any = null;
    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }
    return { ok: response.ok, data };
  },

  getFloors: async () => {
    const response = await fetch(`${getDynamicApiBaseUrl()}/api/floors`, {
      headers: await buildAuthHeaders(),
    });
    const contentType = response.headers.get('content-type') || '';
    let data: any = null;
    try {
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
    } catch (err) {
      try {
        data = await response.text();
      } catch (_) {
        data = null;
      }
    }
    return { ok: response.ok, data };
  },

  getTables: async (floor: string) => {
    const response = await fetch(`${getDynamicApiBaseUrl()}/api/tables?floor=${encodeURIComponent(floor)}`, {
      headers: await buildAuthHeaders(),
    });
    const data = await response.json();
    return { ok: response.ok, data };
  },

  getTableCounts: async (floor?: string) => {
    const url = floor
      ? `${getDynamicApiBaseUrl()}/api/tables/counts?floor=${encodeURIComponent(floor)}`
      : `${getDynamicApiBaseUrl()}/api/tables/counts`;

    const response = await fetch(url, {
      headers: await buildAuthHeaders(),
    });
    const contentType = response.headers.get('content-type') || '';
    let data: any = null;
    try {
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
    } catch (err) {
      try {
        data = await response.text();
      } catch (_) {
        data = null;
      }
    }
    return { ok: response.ok, data };
  },

  getCategories: async () => {
    const response = await fetch(`${getDynamicApiBaseUrl()}/api/menu/categories`);
    const contentType = response.headers.get('content-type') || '';
    let data: any = null;
    try {
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
    } catch (err) {
      data = null;
    }
    return { ok: response.ok, data };
  },

  getMainTabs: async () => {
    const response = await fetch(`${getDynamicApiBaseUrl()}/api/menu/main-categories`);
    const contentType = response.headers.get('content-type') || '';
    let data: any = null;
    try {
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
    } catch (err) {
      data = null;
    }
    return { ok: response.ok, data };
  },

  getSubCategories: async (category: string) => {
    const response = await fetch(`${getDynamicApiBaseUrl()}/api/menu/sub-categories?category=${encodeURIComponent(category)}`);
    const contentType = response.headers.get('content-type') || '';
    let data: any = null;
    try {
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
    } catch (err) {
      data = null;
    }
    return { ok: response.ok, data };
  },

  getMenuLevel: async (params: {
    intLevel: number;
    level1?: string;
    level2?: string;
    level3?: string;
    level4?: string;
    level5?: string;
    level6?: string;
    level7?: string;
  }) => {
    const query = new URLSearchParams();
    query.set('intLevel', String(params.intLevel));

    (['level1', 'level2', 'level3', 'level4', 'level5', 'level6', 'level7'] as const).forEach((key) => {
      const value = params[key];
      if (value !== undefined && value !== '') {
        query.set(key, value);
      }
    });

    const response = await fetch(`${getDynamicApiBaseUrl()}/api/menu/level?${query.toString()}`);
    const contentType = response.headers.get('content-type') || '';
    let data: any = null;
    try {
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
    } catch (err) {
      data = null;
    }
    return { ok: response.ok, data };
  },

  getMenuItems: async () => {
    try {
      const url = `${getDynamicApiBaseUrl()}/api/menu/items`;
      console.log('[api] getMenuItems URL=', url);
      const response = await fetch(url);
      const contentType = response.headers.get('content-type') || '';
      let data: any = null;
      try {
        if (contentType.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text();
        }
      } catch (err) {
        try {
          data = await response.text();
        } catch (_) {
          data = null;
        }
      }

      console.log('[api] getMenuItems data status:', {
        dataType: typeof data,
        isList: Array.isArray(data),
       objectKeys: data && typeof data === 'object' ? Object.keys(data) : [],
        totalItemsCount: Array.isArray(data) ? data.length : (Array.isArray(data?.items) ? data.items.length : 0), 
      });
      return { ok: response.ok, data };
    } catch (err) {
      console.log('[api] getMenuItems fetch error', (err as any)?.message ?? String(err));
      const msg = (err as any)?.message ?? String(err);
      return { ok: false, data: { message: msg } };
    }
  },

  getVoidPresets: async () => {
    try {
      const url = `${getDynamicApiBaseUrl()}/api/void-remarks`;
      const response = await fetch(url);
      const contentType = response.headers.get('content-type') || '';
      let data: any = null;
      try {
        if (contentType.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text();
        }
      } catch (err) {
        try {
          data = await response.text();
        } catch (_) {
          data = null;
        }
      }

      return { ok: response.ok, data };
    } catch (err) {
      const msg = (err as any)?.message ?? String(err);
      return { ok: false, data: { message: msg } };
    }
  },

  getOrderDescriptions: async (): Promise<string[]> => {
    // Fire-and-forget background refresh — syncGlobalOrderDescriptions() fetches
    // fresh data from the server and updates MMKV for the next call.
    syncGlobalOrderDescriptions().catch((error) => {
      console.log('⚠️ [MMKV Global Sync] Background refresh failed:', error);
    });

    // Return cached data immediately — no blocking network call.
    return getCachedOrderDescriptions();
  },

  getTemplateGroup: async (tableNo: string) => {
    try {
      const url = `${getDynamicApiBaseUrl()}/api/tables/group?tableNo=${encodeURIComponent(tableNo)}`;
      const response = await fetch(url);
      const contentType = response.headers.get('content-type') || '';
      let data: any = null;
      try {
        if (contentType.includes('application/json')) data = await response.json();
        else data = await response.text();
      } catch (err) {
        data = null;
      }
      return { ok: response.ok, data };
    } catch (err) {
      const msg = (err as any)?.message ?? String(err);
      return { ok: false, data: { message: msg } };
    }
  },

  getActiveBillItems: async (tableNo: string, invoiceNo?: string) => {
    try {
      // Prefer invoiceNo — it uniquely identifies one bill so items from
      // other users on the same table are never mixed in.
      const params = new URLSearchParams();
      if (invoiceNo) {
        params.set('invoiceNo', invoiceNo);
      } else {
        params.set('tableNo', tableNo);
      }
      const url = `${getDynamicApiBaseUrl()}/api/billing/active-items?${params.toString()}`;
      const response = await fetch(url);
      const contentType = response.headers.get('content-type') || '';
      let data: any = null;
      try {
        if (contentType.includes('application/json')) data = await response.json();
        else data = await response.text();
      } catch (err) {
        data = null;
      }
      return { ok: response.ok, data };
    } catch (err) {
      const msg = (err as any)?.message ?? String(err);
      return { ok: false, data: { message: msg } };
    }
  },
  
  // ── DB-driven billing (unpaid bills list / detail / payment) ─────────────

  fetchUnpaidBills: async () => {
    try {
      const url = `${getDynamicApiBaseUrl()}/api/unpaid-bills`;
      // Auth header required — server uses JWT to decide manager vs own-bills filter.
      const response = await fetch(url, { headers: await buildAuthHeaders() });
      const data = await parseResponseBody(response);
      return { ok: response.ok, data };
    } catch (err) {
      const msg = (err as any)?.message ?? String(err);
      return { ok: false, data: { message: msg } };
    }
  },

  fetchBillItems: async (params: { invoiceNo?: string; tableNo?: string }) => {
    try {
      const query = new URLSearchParams();
      if (params.invoiceNo) query.set('invoiceNo', params.invoiceNo);
      if (params.tableNo) query.set('tableNo', params.tableNo);

      const url = `${getDynamicApiBaseUrl()}/api/bill-items?${query.toString()}`;
      const response = await fetch(url);
      const data = await parseResponseBody(response);
      return { ok: response.ok, data };
    } catch (err) {
      const msg = (err as any)?.message ?? String(err);
      return { ok: false, data: { message: msg } };
    }
  },

  payBill: async (payload: string | { invoiceNo: string; tableNo?: string }) => {
    const normalized = typeof payload === 'string' ? { invoiceNo: payload } : payload;
    const response = await requestJson(`${getDynamicApiBaseUrl()}/api/pay-bill`, {
      method: 'POST',
      headers: await buildAuthHeaders(),
      body: JSON.stringify(normalized),
    });

    return response;
  },

  updateTableStatus: async (payload: { tableId: string; status: 'Y' | 'N' }) => {
    const response = await requestJson(`${getDynamicApiBaseUrl()}/api/tables/status`, {
      method: 'POST',
      headers: await buildAuthHeaders(),
      body: JSON.stringify(payload),
    });

    return response;
  },

confirmCart: async (payload: ConfirmCartPayloadInput) => {
 
  const normalized = normalizeConfirmCartPayload(payload);
  
  console.log("[FRONTEND API] Sending structured payload to backend:", JSON.stringify(normalized, null, 2));

  
  const response = await requestJson(`${getDynamicApiBaseUrl()}/api/orders/confirm-cart`, {
    method: 'POST',
    headers: await buildAuthHeaders(),
    body: JSON.stringify(normalized), 
  });

  return response;
},

  addBillingItem: async (payload: AddBillingItemPayloadInput) => {
    const normalized = normalizeAddBillingPayload(payload as any);
    const response = await requestJson(`${getDynamicApiBaseUrl()}/api/add-billing-item`, {
      method: 'POST',
      headers: await buildAuthHeaders(),
      body: JSON.stringify(normalized),
    });

    return response;
  },

  removeBillingItem: async (payload: RemoveBillingItemPayloadInput) => {
    const normalized = normalizeRemoveBillingPayload(payload as any);
    const response = await requestJson(`${getDynamicApiBaseUrl()}/api/remove-billing-item`, {
      method: 'POST',
      headers: await buildAuthHeaders(),
      body: JSON.stringify(normalized),
    });

    return response;
  },
  
  getCustomerByPhone: async (phone: string) => {
    try {
      const response = await fetch(`${getDynamicApiBaseUrl()}/api/customer/${phone}`);
      const data = await response.json();
      return { ok: response.ok, data };
    } catch (err) {
      return { ok: false, data: null };
    }
  },

  saveCustomer: async (payload: { RegTel: string; CusName: string; Rmks: string; CusBehaviour?: number }) => {
    return requestJson(`${getDynamicApiBaseUrl()}/api/customer/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

// ── NEW DYNAMIC USER GROUPS SERVICE ──
  getUserGroups: async () => {
    try {
      const response = await fetch(`${getDynamicApiBaseUrl()}/api/user-groups`);
      const data = await response.json();
      return { ok: response.ok, data: data.data || [] };
    } catch (err) {
      return { ok: false, data: [] };
    }
  },

  
getWorkers: async () => {
  return requestJson(`${getDynamicApiBaseUrl()}/api/auth/workers`, {
    method: 'GET',
    headers: await buildAuthHeaders(),
  });
},

// ── NEW: TABLE GROUPS (Floor Access options, from Tbl_TableGroup.GroupName) ──
  getTableGroups: async () => {
    try {
      const response = await fetch(`${getDynamicApiBaseUrl()}/api/table-groups`);
      const data = await response.json();
      return { ok: response.ok, data: data.data || [] };
    } catch (err) {
      return { ok: false, data: [] };
    }
  },


  saveUserFloorAccess: async (payload: { UserId: number | string; TableGroupIds: (number | string)[]; AssignedBy: number | string }) => {
    return requestJson(`${getDynamicApiBaseUrl()}/api/user-floor-access/save`, {
      method: 'POST',
      headers: await buildAuthHeaders(),
      body: JSON.stringify(payload),
    });
  },

  getUserFloorAccess: async (userId: string) => {
    try {
      const url = `${getDynamicApiBaseUrl()}/api/user-floor-access/${encodeURIComponent(userId)}`;
      const response = await fetch(url, { headers: await buildAuthHeaders() });
      const data = await response.json();
      return { ok: response.ok, data };
    } catch (error: any) {
      console.log('[api] getUserFloorAccess error:', error?.message || error);
      return { ok: false, data: { assignedFloors: [] } };
    }
  },


  // ── Profile Picture ────────────────────────────────────────────────────────
  getProfilePicture: async (userId: string | number, locCode: string): Promise<{ ok: boolean; picture?: string | null }> => {
    try {
      const url = `${getDynamicApiBaseUrl()}/api/auth/profile-picture?userId=${encodeURIComponent(String(userId))}&locCode=${encodeURIComponent(locCode)}`;
      const response = await fetch(url);
      const data = await response.json();
      return { ok: response.ok, picture: data.picture || null };
    } catch (error: any) {
      console.error('[API] getProfilePicture failed:', error);
      return { ok: false, picture: null };
    }
  },

  updateProfilePicture: async (userId: string | number, locCode: string, pictureBase64: string): Promise<{ ok: boolean; message?: string }> => {
    try {
      const response = await fetch(`${getDynamicApiBaseUrl()}/api/auth/update-picture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: String(userId), locCode, picture: pictureBase64 }),
      });
      const data = await response.json();
      return { ok: response.ok, message: data.message };
    } catch (error: any) {
      console.error('[API] updateProfilePicture failed:', error);
      return { ok: false, message: error.message || 'Network error' };
    }
  },

  checkDeviceStatus: async (deviceId: string): Promise<{ ok: boolean;
     data?: { allowed: boolean; 
      status: string;
      deviceId?: string;
    message?: string;
    }; error?: string }> => {
    try {
     
      let baseIP = (global as any).backendIP;
      if (!baseIP) {
        try {
          baseIP = storage.getString(BACKEND_IP_KEY) || undefined;
        } catch (e) {}
      }
      baseIP = baseIP || '192.168.8.100';

      
      const response = await fetch(`http://${baseIP}:3000/api/devices/check-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deviceId }),
      });

      const data = await response.json();

      return {
        ok: response.ok,
        data: data
      };
    } catch (error: any) {
      console.error('[API Client] Device check-in failed:', error);
      return {
        ok: false,
        error: error.message || 'Network request failed'
      };
    }
  },


}