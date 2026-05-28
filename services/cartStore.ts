import { create } from 'zustand';

export type CartItem = {
  itemRemarks: string;
  menuItemCode: string;
  menuItmDes: string;
  salesPrice: number;
  quantity: number;
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
}));