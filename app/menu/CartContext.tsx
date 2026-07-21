import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ImageSourcePropType } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface CartItem {
  id:    string;
  name:  string;
  price: string;
  image: ImageSourcePropType;
  qty:   number;
}

export type CartMap = Record<string, number>;

// Registry maps item id → item metadata so the cart screen can display names/prices/images
export type ItemRegistry = Record<string, { name: string; price: string; image: ImageSourcePropType }>;

interface CartContextValue {
  cart:        CartMap;
  registry:    ItemRegistry;
  increment:   (id: string) => void;
  decrement:   (id: string) => void;
  remove:      (id: string) => void;
  clearAll:    () => void;
  registerItems: (items: { id: string; name: string; price: string; image: ImageSourcePropType }[]) => void;
  total:       number;
  cartItems:   CartItem[];   // derived: items with qty > 0, merged with registry
}

const CartContext = createContext<CartContextValue | null>(null);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [cart,     setCart]     = useState<CartMap>({});
  const [registry, setRegistry] = useState<ItemRegistry>({});

  const registerItems = useCallback(
    (items: { id: string; name: string; price: string; image: ImageSourcePropType }[]) => {
      setRegistry(prev => {
        const next = { ...prev };
        items.forEach(item => { next[item.id] = { name: item.name, price: item.price, image: item.image }; });
        return next;
      });
    },
    [],
  );

  const increment = useCallback((id: string) => {
    setCart(prev => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }, []);

  const decrement = useCallback((id: string) => {
    setCart(prev => {
      const next = { ...prev };
      if ((next[id] ?? 0) <= 1) delete next[id];
      else next[id]--;
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setCart(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setCart({}), []);

  const total = useMemo(
    () => Object.values(cart).reduce((sum, n) => sum + n, 0),
    [cart],
  );

  const cartItems = useMemo<CartItem[]>(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => ({
          id,
          qty,
          name:  registry[id]?.name  ?? 'Unknown Item',
          price: registry[id]?.price ?? 'Rs. 0',
          image: registry[id]?.image ?? { uri: 'https://placehold.co/100x115' },
        })),
    [cart, registry],
  );

  return (
    <CartContext.Provider value={{ cart, registry, increment, decrement, remove, clearAll, registerItems, total, cartItems }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCartContext = (): CartContextValue => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCartContext must be used inside <CartProvider>');
  return ctx;
};