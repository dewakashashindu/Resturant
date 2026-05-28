import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

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
  const envBaseUrl = String((globalThis as any)?.process?.env?.EXPO_PUBLIC_API_BASE_URL ?? '').trim();
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

const API_BASE_URL = resolveApiBaseUrl();

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
  TabelNo: string;
  UserID: number;
  TabelGrpID: string | null;
  LPax: number;
  FPax: number;
  items: ConfirmCartItemPayload[];
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
  const token = await AsyncStorage.getItem('token');
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

const normalizeConfirmCartPayload = (payload: ConfirmCartPayload | {
  tableNo?: string;
  userId?: number | string;
  tableGrpId?: string | null;
  lPax?: number;
  fPax?: number;
  items: Array<CartItem | {
    menuItemCode?: string;
    ItemCode?: string;
    quantity?: number;
    QTY?: number;
    salesPrice?: number;
    SalesPrice?: number;
    itemRemarks?: string;
    ItemRemarks?: string;
  }>;
}) : ConfirmCartPayload => {
  const items = Array.isArray(payload.items)
    ? payload.items.map((item) => ({
        ItemCode: toString((item as any).ItemCode ?? (item as any).menuItemCode, '').trim(),
        QTY: toNumber((item as any).QTY ?? (item as any).quantity, 0),
        ItemRemarks: toString((item as any).ItemRemarks ?? (item as any).itemRemarks, ''),
        SalesPrice: toNumber((item as any).SalesPrice ?? (item as any).salesPrice, 0),
      })).filter((item) => item.ItemCode && item.QTY > 0)
    : [];

  return {
    TabelNo: toString((payload as any).TabelNo ?? (payload as any).tableNo, '').trim(),
    UserID: toNumber((payload as any).UserID ?? (payload as any).userId, 0),
    TabelGrpID: (payload as any).TabelGrpID ?? (payload as any).tableGrpId ?? null,
    LPax: toNumber((payload as any).LPax ?? (payload as any).lPax, 0),
    FPax: toNumber((payload as any).FPax ?? (payload as any).fPax, 0),
    items,
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

  return {
    TabelNo: toString((payload as any).TabelNo ?? (payload as any).tableNo, '').trim(),
    UserID: toNumber((payload as any).UserID ?? (payload as any).userId, 0),
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
}) => ({
  TabelNo: toString((payload as any).TabelNo ?? (payload as any).tableNo, '').trim(),
  UserID: toNumber((payload as any).UserID ?? (payload as any).userId, 0),
  ItemCode: toString((payload as any).ItemCode ?? (payload as any).itemCode, '').trim(),
  QTY: toPositiveQuantity((payload as any).QTY ?? (payload as any).qty ?? (payload as any).qtyDifference ?? (payload as any).quantity, 0),
  ItemRemarks: '',
  VoidRemark: toString((payload as any).VoidRemark ?? (payload as any).voidRemark ?? (payload as any).ItemRemarks ?? (payload as any).itemRemarks, ''),
  MgrID: toString((payload as any).MgrID ?? (payload as any).mgrId, '').trim(),
});

export const apiClient = {
  login: async (username: string, password: string) => {
    return requestJson(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  },

  signup: async (username: string, password: string, phoneNumber: string) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, phoneNumber }),
    });
    const data = await response.json();
    return { ok: response.ok, data };
  },

  forgotPassword: async (username: string) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    const data = await response.json();
    return { ok: response.ok, data };
  },

  resetPassword: async (username: string, newPassword: string) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, newPassword }),
    });
    const data = await response.json();
    return { ok: response.ok, data };
  },

  changePassword: async (username: string, currentPassword: string, newPassword: string) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, currentPassword, newPassword }),
    });
    const data = await response.json();
    return { ok: response.ok, data };
  },

  getFloors: async () => {
    const response = await fetch(`${API_BASE_URL}/api/floors`);
    const contentType = response.headers.get('content-type') || '';
    let data: any = null;
    try {
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        // non-json response (HTML error page, etc.) — return text for debugging
        data = await response.text();
      }
    } catch (err) {
      // parsing failed — include raw text for debugging
      try {
        data = await response.text();
      } catch (_) {
        data = null;
      }
    }
    return { ok: response.ok, data };
  },

  getTables: async (floor: string) => {
    const response = await fetch(`${API_BASE_URL}/api/tables?floor=${encodeURIComponent(floor)}`);
    const data = await response.json();
    return { ok: response.ok, data };
  },

  getTableCounts: async (floor?: string) => {
    const url = floor
      ? `${API_BASE_URL}/api/tables/counts?floor=${encodeURIComponent(floor)}`
      : `${API_BASE_URL}/api/tables/counts`;

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
  },

  getCategories: async () => {
    const response = await fetch(`${API_BASE_URL}/api/menu/categories`);
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
    const response = await fetch(`${API_BASE_URL}/api/menu/main-categories`);
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
    const response = await fetch(`${API_BASE_URL}/api/menu/sub-categories?category=${encodeURIComponent(category)}`);
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

    const response = await fetch(`${API_BASE_URL}/api/menu/level?${query.toString()}`);
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

  getOrderDescriptions: async (): Promise<string[]> => {
    const response = await requestJson<{ ok?: boolean; descriptions?: string[] }>(`${API_BASE_URL}/api/remarks/order-descriptions`);

    if (!response.ok || !Array.isArray(response.data?.descriptions)) {
      return [];
    }

    return response.data.descriptions
      .map((value) => String(value ?? '').trim())
      .filter(Boolean);
  },

  getTableGroup: async (tableNo: string) => {
    try {
      const url = `${API_BASE_URL}/api/tables/group?tableNo=${encodeURIComponent(tableNo)}`;
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

  getActiveBillItems: async (tableNo: string) => {
    try {
      const url = `${API_BASE_URL}/api/billing/active-items?tableNo=${encodeURIComponent(tableNo)}`;
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
  
  confirmCart: async (payload: ConfirmCartPayloadInput) => {
    const normalized = normalizeConfirmCartPayload(payload as any);
    const response = await requestJson(`${API_BASE_URL}/api/confirm-cart`, {
      method: 'POST',
      headers: await buildAuthHeaders(),
      body: JSON.stringify(normalized),
    });

    return response;
  },

  addBillingItem: async (payload: AddBillingItemPayloadInput) => {
    const normalized = normalizeAddBillingPayload(payload as any);
    const response = await requestJson(`${API_BASE_URL}/api/add-billing-item`, {
      method: 'POST',
      headers: await buildAuthHeaders(),
      body: JSON.stringify(normalized),
    });

    return response;
  },

  removeBillingItem: async (payload: RemoveBillingItemPayloadInput) => {
    const normalized = normalizeRemoveBillingPayload(payload as any);
    const response = await requestJson(`${API_BASE_URL}/api/remove-billing-item`, {
      method: 'POST',
      headers: await buildAuthHeaders(),
      body: JSON.stringify(normalized),
    });

    return response;
  },
  




};