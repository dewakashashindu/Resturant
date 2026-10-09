import { create } from 'zustand';
import type { CartItem } from './cartStore';
import { storage } from './storage';

const MENU_DINING_SESSION_KEY = 'menu_dining_session_v1';
const MENU_DINING_CART_KEY = 'menu_dining_cart_v1';

export type MenuDiningSession = {
  groupId: string;
  groupLabel: string;
  tableName: string;
  tableNo: string;
  floor: string;
  localPax: string;
  foreignPax: string;
  orderType: 'DINING';
  // Present only when the customer is adding to an already-open Dining bill.
  // The baseline quantities keep old bill items from being edited as new items.
  existingInvoiceNo?: string;
  existingBillItems?: CartItem[];
};

type MenuSessionStore = {
  diningSession: MenuDiningSession | null;
  savedCartItems: CartItem[];
  setDiningSession: (session: MenuDiningSession) => void;
  saveCartItems: (items: CartItem[]) => void;
  clearSavedCartItems: () => void;
  clearDiningSession: () => void;
};

const sanitizeCartItems = (value: unknown): CartItem[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: any) => ({
      menuItemCode: String(item?.menuItemCode ?? ''),
      menuItmDes: String(item?.menuItmDes ?? ''),
      salesPrice: Number(item?.salesPrice ?? 0) || 0,
      quantity: Math.max(0, Number(item?.quantity ?? 0) || 0),
      itemRemarks: String(item?.itemRemarks ?? ''),
    }))
    .filter((item: CartItem) => item.menuItemCode && item.quantity > 0);
};

const readSavedCartItems = (): CartItem[] => {
  try {
    const raw = storage.getString(MENU_DINING_CART_KEY);
    return sanitizeCartItems(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
};

const readSavedSession = (): MenuDiningSession | null => {
  try {
    const raw = storage.getString(MENU_DINING_SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<MenuDiningSession>;
    if (!data.tableNo || !data.floor) return null;
    return {
      groupId: String(data.groupId ?? ''),
      groupLabel: String(data.groupLabel ?? data.floor ?? ''),
      tableName: String(data.tableName ?? data.tableNo),
      tableNo: String(data.tableNo),
      floor: String(data.floor),
      localPax: String(data.localPax ?? '0'),
      foreignPax: String(data.foreignPax ?? '0'),
      orderType: 'DINING',
      existingInvoiceNo: String(data.existingInvoiceNo ?? '').trim() || undefined,
      existingBillItems: sanitizeCartItems(data.existingBillItems),
    };
  } catch {
    return null;
  }
};

export const useMenuSessionStore = create<MenuSessionStore>((set) => ({
  diningSession: readSavedSession(),
  savedCartItems: readSavedCartItems(),

  setDiningSession: (session) => {
    const normalized: MenuDiningSession = {
      groupId: String(session.groupId ?? ''),
      groupLabel: String(session.groupLabel ?? session.floor ?? ''),
      tableName: String(session.tableName ?? session.tableNo ?? ''),
      tableNo: String(session.tableNo ?? ''),
      floor: String(session.floor ?? ''),
      localPax: String(session.localPax ?? '0'),
      foreignPax: String(session.foreignPax ?? '0'),
      orderType: 'DINING',
      existingInvoiceNo: String(session.existingInvoiceNo ?? '').trim() || undefined,
      existingBillItems: sanitizeCartItems(session.existingBillItems),
    };
    storage.set(MENU_DINING_SESSION_KEY, JSON.stringify(normalized));
    set({ diningSession: normalized });
  },

  saveCartItems: (items) => {
    const next = items.filter((item) => item.menuItemCode && item.quantity > 0);
    storage.set(MENU_DINING_CART_KEY, JSON.stringify(next));
    set({ savedCartItems: next });
  },

  clearSavedCartItems: () => {
    storage.set(MENU_DINING_CART_KEY, '');
    set({ savedCartItems: [] });
  },

  clearDiningSession: () => {
    storage.set(MENU_DINING_SESSION_KEY, '');
    storage.set(MENU_DINING_CART_KEY, '');
    set({ diningSession: null, savedCartItems: [] });
  },
}));
