import { create } from 'zustand';

export type ConfirmedOrderItem = {
  menuItemCode: string;
  quantity: number;
  itemRemarks?: string;
  salesPrice?: number;
  menuItmDes?: string;
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
