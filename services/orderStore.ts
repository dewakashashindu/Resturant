import { create } from 'zustand';

export type ConfirmedOrderItem = {
  menuItemCode: string;
  quantity: number;
  itemRemarks?: string;
  salesPrice?: number;
  menuItmDes?: string;
  // Where the line comes from. 'pos' lines are already on the POS bill and can
  // never be edited here; 'app' lines are this app's own, still unmerged.
  billSource?: 'pos' | 'app';
  readOnly?: boolean;
  // How much of the quantity the POS already holds. Shown to the steward; it
  // no longer blocks a change - every line on the bill can be edited.
  lockedQty?: number;
  posQty?: number;
};

export type ConfirmedOrder = {
  tableNo: string;
  userId: string;
  tableGrpId?: string;
  lPax?: number;
  fPax?: number;
  items: ConfirmedOrderItem[];
  createdAt?: string;
  invoiceNo?: string;
  orderType?: string;
};

type OrderStore = {
  lastConfirmedOrder: ConfirmedOrder | null;
  setLastConfirmedOrder: (order: ConfirmedOrder | null | ((current: ConfirmedOrder | null) => ConfirmedOrder | null)) => void;
  clearLastConfirmedOrder: () => void;
};

export const useOrderStore = create<OrderStore>((set) => ({
  lastConfirmedOrder: null,
  setLastConfirmedOrder: (order) => set((state) => ({
    lastConfirmedOrder: typeof order === 'function' ? order(state.lastConfirmedOrder) : order,
  })),
  clearLastConfirmedOrder: () => set({ lastConfirmedOrder: null }),
}));
