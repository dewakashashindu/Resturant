import { create } from 'zustand';
import { useOrderStore } from './orderStore';
import { storage } from './storage';

export type CartItem = {
  itemRemarks: string;
  menuItemCode: string;
  menuItmDes: string;
  salesPrice: number;
  quantity: number;
};

export type HeldOrderSnapshot = {
  source: 'billing';
  savedAt: string;
  tableNo: string;
  tableGrpId: string;
  userId: string;
  lPax: number;
  fPax: number;
  grossTotal: number;
  itemCount: number;
  items: CartItem[];
  itemRemarksByCode: Record<string, string>;
  voidMetadata: Record<string, { remark: string; manager: string }>;
  pendingAdditions: Record<string, number>;
  billingHasChanges: boolean;
};

type CartItemInput = Partial<CartItem> & Record<string, unknown>;
type CartItemUpsertInput = CartItemInput & {
  quantity: number;
};

const toText = (value: unknown, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizeCartItem = (item: CartItemInput): CartItem | null => {
  const menuItemCode = toText(item.menuItemCode ?? item.ItemCode ?? item.itemCode ?? item.id ?? item.code);
  if (!menuItemCode) return null;

  const quantity = Math.max(0, Math.floor(toNumber(item.quantity ?? item.QTY ?? item.qty, 0)));
  if (quantity <= 0) return null;

  return {
    menuItemCode,
    menuItmDes: toText(item.menuItmDes ?? item.MenuItmDes ?? item.ItemName ?? item.itemName ?? item.name ?? item.label ?? item.description ?? menuItemCode, menuItemCode),
    salesPrice: toNumber(item.salesPrice ?? item.SalesPrice ?? item.price ?? item.unitPrice ?? 0, 0),
    quantity,
    itemRemarks: toText(item.itemRemarks ?? item.ItemRemarks ?? item.remarks ?? ''),
  };
};

export const normalizeCartItems = (items: CartItemInput[]) => {
  const merged = new Map<string, CartItem>();

  for (const rawItem of items) {
    const normalized = normalizeCartItem(rawItem);
    if (!normalized) continue;

    const existingItem = merged.get(normalized.menuItemCode);
    if (existingItem) {
      merged.set(normalized.menuItemCode, {
        ...existingItem,
        quantity: existingItem.quantity + normalized.quantity,
        menuItmDes: normalized.menuItmDes || existingItem.menuItmDes,
        salesPrice: normalized.salesPrice || existingItem.salesPrice,
        itemRemarks: normalized.itemRemarks || existingItem.itemRemarks,
      });
      continue;
    }

    merged.set(normalized.menuItemCode, normalized);
  }

  return [...merged.values()];
};

type CartStore = {
  cartItems: CartItem[];
  isDirty: boolean;
  addToCart: (item: Omit<CartItem, 'quantity'>) => void;
  upsertCartItem: (item: CartItemUpsertInput) => void;
  updateQuantity: (menuItemCode: string, delta: number) => void;
  setCartItems: (items: CartItem[]) => void;
  clearCart: () => void;
  saveCurrentOrderToHold: (tableNumber: string, snapshot: Omit<HeldOrderSnapshot, 'source' | 'savedAt' | 'itemCount' | 'tableNo'> & { tableNo?: string; savedAt?: string }) => HeldOrderSnapshot | null;
  getHeldTables: () => string[];
  loadHeldOrderForTable: (tableNumber: string) => HeldOrderSnapshot | null;
  clearHeldOrderForTable: (tableNumber: string) => void;
  clearAllHeldOrders: () => void;
  getHeldOrder: (tableNumber?: string) => HeldOrderSnapshot | null;
};

const HELD_ORDERS_MAP_KEY = 'held_orders_map_v1';
const LEGACY_HELD_ORDER_KEY = 'held_order_v1';

type HeldOrdersMap = Record<string, HeldOrderSnapshot>;

const normalizeTableNumber = (value: unknown) => toText(value, '');

const readHeldOrdersMap = (): HeldOrdersMap => {
  try {
    const raw = storage.getString(HELD_ORDERS_MAP_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as HeldOrdersMap;
      }
    }

    const legacyRaw = storage.getString(LEGACY_HELD_ORDER_KEY);
    if (legacyRaw) {
      const legacyParsed = JSON.parse(legacyRaw);
      const legacyTable = normalizeTableNumber((legacyParsed as any)?.tableNo);
      if (legacyParsed && typeof legacyParsed === 'object' && legacyTable) {
        return { [legacyTable]: legacyParsed as HeldOrderSnapshot };
      }
    }
  } catch (error) {
    console.log('[CartStore] readHeldOrdersMap failed', error);
  }

  return {};
};

const writeHeldOrdersMap = (map: HeldOrdersMap) => {
  storage.set(HELD_ORDERS_MAP_KEY, JSON.stringify(map));
};

export const useCartStore = create<CartStore>((set, get) => ({
  cartItems: [],
  isDirty: false,

  addToCart: (item) => {
    const normalizedItem = normalizeCartItem({ ...item, quantity: 1 });
    if (!normalizedItem) return;

    const existingItem = get().cartItems.find((cartItem) => cartItem.menuItemCode === normalizedItem.menuItemCode);

    if (existingItem) {
      set({
        cartItems: get().cartItems.map((cartItem) =>
          cartItem.menuItemCode === normalizedItem.menuItemCode
            ? {
                ...cartItem,
                quantity: cartItem.quantity + 1,
                menuItmDes: normalizedItem.menuItmDes || cartItem.menuItmDes,
                salesPrice: normalizedItem.salesPrice || cartItem.salesPrice,
                itemRemarks: normalizedItem.itemRemarks || cartItem.itemRemarks,
              }
            : cartItem
        ),
        isDirty: true,
      });
      return;
    }

    set({
      cartItems: [...get().cartItems, normalizedItem],
      isDirty: true,
    });
  },

  upsertCartItem: (item) => {
    const menuItemCode = toText(item.menuItemCode ?? item.ItemCode ?? item.itemCode ?? item.id ?? item.code);
    if (!menuItemCode) return;

    const quantity = Math.max(0, Math.floor(toNumber(item.quantity ?? item.QTY ?? item.qty, 0)));
    if (quantity <= 0) {
      set({
        cartItems: get().cartItems.filter((cartItem) => cartItem.menuItemCode !== menuItemCode),
        isDirty: true,
      });
      return;
    }

    const normalizedItem = normalizeCartItem({ ...item, menuItemCode, quantity });
    if (!normalizedItem) return;

    const nextItems = get().cartItems.some((cartItem) => cartItem.menuItemCode === menuItemCode)
      ? get().cartItems.map((cartItem) => (cartItem.menuItemCode === menuItemCode ? normalizedItem : cartItem))
      : [...get().cartItems, normalizedItem];

    set({
      cartItems: nextItems,
      isDirty: true,
    });
  },

  updateQuantity: (menuItemCode, delta) => {
    set((state) => {
      const nextItems = state.cartItems
        .map((cartItem) => {
          if (cartItem.menuItemCode !== menuItemCode) return cartItem;

          const nextQuantity = Math.max(0, Math.floor(cartItem.quantity + delta));
          return { ...cartItem, quantity: nextQuantity };
        })
        .filter((cartItem) => cartItem.quantity > 0);

      return {
        cartItems: nextItems,
        isDirty: true,
      };
    });
  },

  setCartItems: (items) => set({ cartItems: normalizeCartItems(items), isDirty: false }),

  clearCart: () => set({ cartItems: [], isDirty: false }),

  saveCurrentOrderToHold: (tableNumber, snapshot) => {
    const normalizedItems = normalizeCartItems(snapshot.items || []);
    const normalizedTableNo = normalizeTableNumber(tableNumber || snapshot.tableNo);
    if (!normalizedTableNo) {
      console.log('[CartStore] saveCurrentOrderToHold skipped: missing table number');
      return null;
    }

    const heldOrder: HeldOrderSnapshot = {
      source: 'billing',
      savedAt: snapshot.savedAt ?? new Date().toISOString(),
      tableNo: normalizedTableNo,
      tableGrpId: String(snapshot.tableGrpId ?? '').trim(),
      userId: String(snapshot.userId ?? 'SYSTEM').trim(),
      lPax: Number(snapshot.lPax ?? 0) || 0,
      fPax: Number(snapshot.fPax ?? 0) || 0,
      grossTotal: Number(snapshot.grossTotal ?? 0) || 0,
      itemCount: normalizedItems.length,
      items: normalizedItems,
      itemRemarksByCode: snapshot.itemRemarksByCode ?? {},
      voidMetadata: snapshot.voidMetadata ?? {},
      pendingAdditions: snapshot.pendingAdditions ?? {},
      billingHasChanges: Boolean(snapshot.billingHasChanges),
    };

    try {
      const heldOrders = readHeldOrdersMap();
      heldOrders[normalizedTableNo] = heldOrder;
      writeHeldOrdersMap(heldOrders);
    } catch (error) {
      console.log('[CartStore] saveCurrentOrderToHold persist failed', error);
      return null;
    }

    set({ cartItems: [], isDirty: false });
    useOrderStore.getState().clearLastConfirmedOrder();
    return heldOrder;
  },

  clearHeldOrder: () => {
    const current = readHeldOrdersMap();
    const firstKey = Object.keys(current)[0];
    if (!firstKey) return;
    delete current[firstKey];
    writeHeldOrdersMap(current);
  },

  getHeldTables: () => Object.keys(readHeldOrdersMap()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })),

  loadHeldOrderForTable: (tableNumber) => {
    const normalizedTableNo = normalizeTableNumber(tableNumber);
    if (!normalizedTableNo) return null;

    const heldOrders = readHeldOrdersMap();
    const heldOrder = heldOrders[normalizedTableNo];
    if (!heldOrder) return null;

    set({ cartItems: normalizeCartItems(heldOrder.items || []), isDirty: false });
    useOrderStore.getState().clearLastConfirmedOrder();
    return heldOrder;
  },

  clearHeldOrderForTable: (tableNumber) => {
    const normalizedTableNo = normalizeTableNumber(tableNumber);
    if (!normalizedTableNo) return;

    const heldOrders = readHeldOrdersMap();
    if (!heldOrders[normalizedTableNo]) return;
    delete heldOrders[normalizedTableNo];
    writeHeldOrdersMap(heldOrders);
  },

  clearAllHeldOrders: () => {
    try {
      storage.set(HELD_ORDERS_MAP_KEY, '{}');
    } catch (error) {
      console.log('[CartStore] clearAllHeldOrders failed', error);
    }
  },

  getHeldOrder: (tableNumber) => {
    const heldOrders = readHeldOrdersMap();
    if (tableNumber) {
      const normalizedTableNo = normalizeTableNumber(tableNumber);
      return heldOrders[normalizedTableNo] ?? null;
    }

    const firstKey = Object.keys(heldOrders)[0];
    return firstKey ? heldOrders[firstKey] : null;
  },
}));