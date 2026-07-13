import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '../../services/api';
import { CartItem, useCartStore } from '../../services/cartStore';
import useItemStore from '../../services/itemStore';
import { useOrderStore } from '../../services/orderStore';

// ─── Types ────────────────────────────────────────────────────────────────────
type VoidPresetItem = {
  VoidRmkId?: string | number;
  VoidDescription?: string;
};

// ─── Static data (outside component — never recreated) ────────────────────────
const VOID_REMARK_PRESETS = [
  'No Spicy',
  'Extra Spicy',
  'Less Spicy',
  'No Onion',
  'No Garlic',
  'Take Away',
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function BillingScreen() {
  const router = useRouter();
  const {
    tableName,
    tableNo,
    localPax,
    foreignPax,
    floor,
    invoiceNo: routeInvoiceNo,
    fromCart,
    forceRefresh,
  } = useLocalSearchParams<{
    tableName?: string;
    tableNo?: string;
    localPax?: string;
    foreignPax?: string;
    floor?: string;
    invoiceNo?: string;
    fromBilling?: string;
    fromCart?: string;
    forceRefresh?: string;
  }>();

  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const s = getDynamicStyles(width, height, insets.bottom);

  // ── Zustand stores ─────────────────────────────────────────────────────────
  const cartItems = useCartStore((state) => state.cartItems);
  const updateQuantityInCart = useCartStore((state) => state.updateQuantity);
  const setCartItemsInStore = useCartStore((state) => state.setCartItems);

  const lastConfirmedOrder = useOrderStore((state) => state.lastConfirmedOrder);

  const displayedItems = useMemo(() => {
    if (lastConfirmedOrder?.items?.length) {
      return lastConfirmedOrder.items.map((it) => ({
        menuItemCode: it.menuItemCode,
        menuItmDes: it.menuItmDes ?? '',
        salesPrice: it.salesPrice ?? 0,
        quantity: it.quantity,
        itemRemarks: it.itemRemarks ?? '',
      }));
    }
    return cartItems;
  }, [lastConfirmedOrder, cartItems]);

  // ── Item store — used for category grouping ────────────────────────────────
  const storeItems = useItemStore((state) => state.items);

  const categoryByCode = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of storeItems) {
      const code = String(item.MenuItemCode ?? item.ItemCode ?? '').trim();
      const cat = String(item.Category ?? '').trim();
      if (code && cat) map[code] = cat;
    }
    return map;
  }, [storeItems]);

  const BILLING_CATEGORY_LABELS: Record<string, string> = {
    F: 'Foods',
    B: 'Beverages',
    S: 'Siga',
    O: 'Others',
  };
  const BILLING_CATEGORY_ORDER = ['F', 'B', 'S', 'O'];

  type BillingSection = {
    categoryCode: string;
    label: string;
    items: typeof displayedItems;
  };

  const billingSections = useMemo((): BillingSection[] => {
    const buckets: Record<string, typeof displayedItems> = {};
    for (const item of displayedItems) {
      const cat = categoryByCode[item.menuItemCode] ?? 'O';
      if (!buckets[cat]) buckets[cat] = [];
      buckets[cat].push(item);
    }
    const knownOrder = BILLING_CATEGORY_ORDER.filter((c) => buckets[c]);
    const unknownOrder = Object.keys(buckets)
      .filter((c) => !BILLING_CATEGORY_ORDER.includes(c))
      .sort();
    return [...knownOrder, ...unknownOrder].map((cat) => ({
      categoryCode: cat,
      label: BILLING_CATEGORY_LABELS[cat] ?? cat,
      items: buckets[cat],
    }));
  }, [displayedItems, categoryByCode]);

  // ── State ──────────────────────────────────────────────────────────────────
  const [isVoidModalVisible, setIsVoidModalVisible] = useState(false);
  const [activeVoidItem, setActiveVoidItem] = useState<CartItem | null>(null);
  const [pendingVoidItemId, setPendingVoidItemId] = useState<string | null>(null);
  const [voidQuantity, setVoidQuantity] = useState(1);
  const [voidRemark, setVoidRemark] = useState('');
  const [managerName, setManagerName] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [isManagerAuthView, setIsManagerAuthView] = useState(false);
  const [managerVerifying, setManagerVerifying] = useState(false);
  const [managerIdError, setManagerIdError] = useState('');
  const [managerPasswordError, setManagerPasswordError] = useState('');
  const [isPresetListView, setIsPresetListView] = useState(false);
  const [voidPresetItems, setVoidPresetItems] = useState<VoidPresetItem[]>([]);
  const [billingHasChanges, setBillingHasChanges] = useState(false);
  const [isHydratingBill, setIsHydratingBill] = useState(false);
  const [pendingAdditions, setPendingAdditions] = useState<Record<string, number>>({});
  const [voidMetadata, setVoidMetadata] = useState<
    Record<string, { remark: string; manager: string; managerId: string }>
  >({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [dbInvoiceNo, setDbInvoiceNo] = useState<string | null>(null);
  const [dbLPax, setDbLPax] = useState<number | null>(null);
  const [dbFPax, setDbFPax] = useState<number | null>(null);
  const [isLoadingBillFromDb, setIsLoadingBillFromDb] = useState(false);

  const [billingRemarkVisible, setBillingRemarkVisible] = useState(false);
  const [billingRemarkItemId, setBillingRemarkItemId] = useState<string | null>(null);
  const [billingRemarkItemName, setBillingRemarkItemName] = useState('');
  const [billingRemarkDraft, setBillingRemarkDraft] = useState('');
  const [billingModalTags, setBillingModalTags] = useState<string[]>([]);
  const [billingEditingTagIndex, setBillingEditingTagIndex] = useState<number | null>(null);
  const [billingIsViewingPresets, setBillingIsViewingPresets] = useState(false);
  const [billingRemarkOptions, setBillingRemarkOptions] = useState<string[]>([]);
  const [billingLoadingPresets, setBillingLoadingPresets] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const originalQuantitiesRef = useRef<Record<string, number>>({});
  const originalTableNoRef = useRef('');
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Derived values ─────────────────────────────────────────────────────────
  const isTablet = width >= 600;
  const isSmall = height < 700;

  const resolvePaxValue = useCallback((...values: unknown[]) => {
    for (const value of values) {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return 0;
  }, []);

  const activeTableNo = String(lastConfirmedOrder?.tableNo ?? tableName ?? '').trim();
  const grossTotal = displayedItems.reduce((sum, item: any) => {
    return (
      sum + (Number(item.salesPrice ?? 0) || 0) * (Number(item.quantity ?? 0) || 0)
    );
  }, 0);
  const footerButtonLabel = billingHasChanges ? 'Confirm Changes' : 'Print';
  const footerButtonBackgroundColor = billingHasChanges ? '#D97706' : '#8D9ED4';

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    day: '2-digit',
    year: 'numeric',
  });

  // ── fetchOrderDetails ──────────────────────────────────────────────────────
  const fetchOrderDetails = useCallback(async (invoiceNo?: string) => {
    console.log('Refreshing bill data from DB...');

    setCartItemsInStore([]);
    useOrderStore.getState().clearLastConfirmedOrder();

    const targetInvoiceNo = invoiceNo
      ? String(invoiceNo)
      : String(routeInvoiceNo ?? '').trim() || undefined;
    const targetTableNo = String(tableName ?? tableNo ?? '').trim();

    if (!targetTableNo && !targetInvoiceNo) {
      return;
    }

    setIsLoadingBillFromDb(true);

    try {
      const response = await apiClient.getActiveBillItems(
        targetTableNo,
        targetInvoiceNo,
      );

      if (!response.ok || !response.data?.data) {
        console.warn('[BillingScreen] Fetch failed or empty data');
        return;
      }

      const data = response.data.data;
      const freshItems = Array.isArray(data.items) ? data.items : [];

      setCartItemsInStore(freshItems);

      // FIX: Prefer server-returned tableNo, fall back to route param
      const resolvedTableNo = String(data.tableNo ?? targetTableNo ?? '').trim();

      useOrderStore.getState().setLastConfirmedOrder({
        orderType: data.orderType || 'DI',
        tableNo: resolvedTableNo,
        userId: data.userId || 'SYSTEM',
        tableGrpId: data.tableGrpId || '',
        lPax: resolvePaxValue(data.lPax, (data as any).LPax, localPax),
        fPax: resolvePaxValue(data.fPax, (data as any).FPax, foreignPax),
        invoiceNo: targetInvoiceNo ?? data.invoiceNo ?? undefined,
        createdAt: data.createdAt || new Date().toISOString(),
        items: freshItems.map((item: any) => ({
          menuItemCode: item.menuItemCode || item.ItemCode || item.itemCode,
          menuItmDes: item.menuItmDes || item.ItemDescription || '',
          salesPrice: Number(item.salesPrice ?? item.SalesPrice ?? 0),
          quantity: Number(item.quantity ?? item.QTY ?? 0),
          itemRemarks: item.itemRemarks || item.ItemRemarks || '',
        })),
      });

      setDbInvoiceNo(targetInvoiceNo ?? data.invoiceNo ?? null);
      setDbLPax(resolvePaxValue(data.lPax, (data as any).LPax, localPax));
      setDbFPax(resolvePaxValue(data.fPax, (data as any).FPax, foreignPax));

      // When returning from Cart after confirming Add-More items, the DB data
      // we just fetched is the new baseline.  Without resetting this baseline
      // here, DI bills can compare the freshly saved quantities against the
      // old pre-cart quantities and incorrectly show "Confirm Changes".
      if (fromCart === '1') {
        originalQuantitiesRef.current = freshItems.reduce(
          (acc: Record<string, number>, item: any) => {
            const code = item.menuItemCode || item.ItemCode || item.itemCode;
            if (code) acc[code] = Number(item.quantity ?? item.QTY ?? 0) || 0;
            return acc;
          },
          {} as Record<string, number>,
        );
        originalTableNoRef.current = resolvedTableNo;
        setPendingAdditions({});
        // voidMetadata clear නොකරනවා — manager verify කළාට පස්සෙ
        // bill re-fetch වෙද්දී managerId wipe වෙනවා නිසා
        setPendingVoidItemId(null);
        setActiveVoidItem(null);
        setBillingHasChanges(false);
      }
    } catch (error) {
      console.error('[BillingScreen] Error fetching bill:', error);
    } finally {
      setIsLoadingBillFromDb(false);
    }
  }, [routeInvoiceNo, tableName, tableNo, localPax, foreignPax, fromCart, resolvePaxValue]);

  // ── useFocusEffect ─────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      const currentInvoice = routeInvoiceNo ? String(routeInvoiceNo) : undefined;
      fetchOrderDetails(currentInvoice);
    }, [fetchOrderDetails, routeInvoiceNo])
  );

  // ── Callbacks & Handlers ───────────────────────────────────────────────────
  const upsertVoidMetadata = useCallback(
    (menuItemCode: string, remark: string, manager: string, managerId?: string) => {
      setVoidMetadata((current) => ({
        ...current,
        [menuItemCode]: {
          remark: String(remark || '').trim(),
          manager: String(manager || '').trim(),
          managerId: String(managerId || '').trim(),
        },
      }));
    },
    [],
  );

  const deleteVoidMetadata = useCallback((menuItemCode: string) => {
    setVoidMetadata((current) => {
      if (!current[menuItemCode]) return current;
      const next = { ...current };
      delete next[menuItemCode];
      return next;
    });
  }, []);

  const resetVoidState = useCallback(() => {
    setIsVoidModalVisible(false);
    setActiveVoidItem(null);
    setPendingVoidItemId(null);
    setVoidQuantity(1);
    setVoidRemark('');
    setManagerName('');
    setManagerPassword('');
    setIsManagerAuthView(false);
    setIsPresetListView(false);
    setManagerIdError('');
    setManagerPasswordError('');
  }, []);

  const openBillingRemarkModal = useCallback((item: any) => {
    setBillingRemarkItemId(item.menuItemCode);
    setBillingRemarkItemName(item.menuItmDes ?? '');
    const existing = String(item.itemRemarks ?? '').trim();
    const parts = existing
      ? existing
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [];
    setBillingModalTags(parts);
    setBillingRemarkDraft('');
    setBillingEditingTagIndex(null);
    setBillingIsViewingPresets(false);
    setBillingRemarkVisible(true);
  }, []);

  const billingAddTag = useCallback(
    (tag: string) => {
      const t = String(tag || '').trim();
      if (!t) return;
      setBillingModalTags((prev) => {
        if (billingEditingTagIndex !== null) {
          const next = [...prev];
          const insertAt = Math.max(0, Math.min(billingEditingTagIndex, next.length));
          next.splice(insertAt, 0, t);
          setBillingEditingTagIndex(null);
          return next;
        }
        return prev.includes(t) ? prev : [...prev, t];
      });
      setBillingRemarkDraft('');
      setBillingIsViewingPresets(false);
    },
    [billingEditingTagIndex],
  );

  const billingEditTag = useCallback((tag: string, index: number) => {
    setBillingRemarkDraft(tag);
    setBillingEditingTagIndex(index);
    setBillingModalTags((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const billingRemoveTag = useCallback((tag: string) => {
    setBillingModalTags((prev) => {
      const removeIndex = prev.indexOf(tag);
      if (removeIndex === -1) return prev;
      return prev.filter((_, i) => i !== removeIndex);
    });
  }, []);

  const saveBillingRemarks = useCallback(() => {
    if (!billingRemarkItemId) return;
    const trimmedDraft = billingRemarkDraft.trim();
    const finalTags = [...billingModalTags];
    if (trimmedDraft) {
      if (billingEditingTagIndex !== null) {
        const insertAt = Math.max(0, Math.min(billingEditingTagIndex, finalTags.length));
        finalTags.splice(insertAt, 0, trimmedDraft);
      } else if (!finalTags.includes(trimmedDraft)) {
        finalTags.push(trimmedDraft);
      }
    }
    const compiled = finalTags.join(', ');

    if (lastConfirmedOrder) {
      useOrderStore.getState().setLastConfirmedOrder({
        ...lastConfirmedOrder,
        items: lastConfirmedOrder.items.map((it) =>
          it.menuItemCode === billingRemarkItemId
            ? { ...it, itemRemarks: compiled }
            : it,
        ),
      });
    } else {
      useCartStore.getState().upsertCartItem({
        ...(cartItems.find((c) => c.menuItemCode === billingRemarkItemId) as any),
        itemRemarks: compiled,
      });
    }

    setBillingRemarkVisible(false);
    setBillingRemarkItemId(null);
    setBillingRemarkItemName('');
    setBillingEditingTagIndex(null);
    setBillingIsViewingPresets(false);
  }, [
    billingEditingTagIndex,
    billingModalTags,
    billingRemarkDraft,
    billingRemarkItemId,
    cartItems,
    lastConfirmedOrder,
  ]);

  const loadBillingRemarkPresets = useCallback(async () => {
    setBillingLoadingPresets(true);
    try {
      const response = await apiClient.getVoidPresets();
      if (response.ok && Array.isArray(response.data)) {
        setBillingRemarkOptions(
          response.data
            .map((d: any) => String(d.VoidDescription ?? '').trim())
            .filter(Boolean),
        );
      } else {
        setBillingRemarkOptions([]);
      }
    } catch {
      setBillingRemarkOptions([]);
    } finally {
      setBillingLoadingPresets(false);
    }
  }, []);

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToastMessage(message);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 1800);
  }, []);

  const clearPendingChanges = useCallback(() => {
    setPendingAdditions({});
    setBillingHasChanges(false);
  }, []);

  const getBaselineQuantity = useCallback((menuItemCode: string) => {
    return Number(originalQuantitiesRef.current[menuItemCode] ?? 0) || 0;
  }, []);

  const hasQuantityChangesFromBaseline = useCallback(() => {
    const baseline = originalQuantitiesRef.current;
    const currentMap = displayedItems.reduce<Record<string, number>>(
      (acc, item: any) => {
        acc[item.menuItemCode] = Number(item.quantity ?? 0) || 0;
        return acc;
      },
      {},
    );
    const allCodes = new Set<string>([
      ...Object.keys(baseline),
      ...Object.keys(currentMap),
    ]);
    for (const code of allCodes) {
      if (
        (Number(baseline[code] ?? 0) || 0) !==
        (Number(currentMap[code] ?? 0) || 0)
      )
        return true;
    }
    return false;
  }, [displayedItems]);

  const rollbackItemToBaseline = useCallback(
    (menuItemCode: string) => {
      const baselineQty = getBaselineQuantity(menuItemCode);
      if (lastConfirmedOrder) {
        if (
          !lastConfirmedOrder.items.some(
            (item) => item.menuItemCode === menuItemCode,
          )
        )
          return;
        useOrderStore.getState().setLastConfirmedOrder({
          ...lastConfirmedOrder,
          items: lastConfirmedOrder.items
            .map((item) =>
              item.menuItemCode === menuItemCode
                ? { ...item, quantity: baselineQty }
                : item,
            )
            .filter((item) => Number(item.quantity ?? 0) > 0),
        });
        return;
      }
      if (!cartItems.some((item) => item.menuItemCode === menuItemCode)) return;
      setCartItemsInStore(
        cartItems
          .map((item) =>
            item.menuItemCode === menuItemCode
              ? { ...item, quantity: baselineQty }
              : item,
          )
          .filter((item) => Number(item.quantity ?? 0) > 0),
      );
      deleteVoidMetadata(menuItemCode);
    },
    [
      cartItems,
      deleteVoidMetadata,
      getBaselineQuantity,
      lastConfirmedOrder,
      setCartItemsInStore,
    ],
  );

  const rollbackAllToBaseline = useCallback(() => {
    const baseline = originalQuantitiesRef.current;
    if (lastConfirmedOrder) {
      useOrderStore.getState().setLastConfirmedOrder({
        ...lastConfirmedOrder,
        items: lastConfirmedOrder.items
          .map((item) => ({
            ...item,
            quantity: Number(baseline[item.menuItemCode] ?? 0) || 0,
          }))
          .filter((item) => Number(item.quantity ?? 0) > 0),
      });
    } else {
      setCartItemsInStore(
        cartItems
          .map((item) => ({
            ...item,
            quantity: Number(baseline[item.menuItemCode] ?? 0) || 0,
          }))
          .filter((item) => Number(item.quantity ?? 0) > 0),
      );
    }
    clearPendingChanges();
    setVoidMetadata({});
    resetVoidState();
  }, [
    cartItems,
    clearPendingChanges,
    lastConfirmedOrder,
    resetVoidState,
    setCartItemsInStore,
  ]);

  const adjustPendingAddition = (menuItemCode: string, delta: number) => {
    if (
      !menuItemCode ||
      menuItemCode === 'undefined' ||
      menuItemCode === 'null'
    ) {
      console.warn(
        '[BillingScreen] Prevented pending addition for an invalid/undefined item code.',
      );
      return;
    }
    setPendingAdditions((current) => {
      const next = { ...current };
      const nextValue = Math.max(0, (next[menuItemCode] ?? 0) + delta);
      if (nextValue > 0) next[menuItemCode] = nextValue;
      else delete next[menuItemCode];
      return next;
    });
  };

  const handleNewOrder = useCallback(() => {
    clearPendingChanges();
    setVoidMetadata({});
    resetVoidState();
    originalQuantitiesRef.current = {};
    originalTableNoRef.current = '';
    setBillingHasChanges(false);
    setCartItemsInStore([]);
    useOrderStore.getState().clearLastConfirmedOrder();
    router.replace('/Screens/operation');
  }, [clearPendingChanges, resetVoidState, router, setCartItemsInStore]);

  const goBack = useCallback(() => {
    if (hasQuantityChangesFromBaseline()) rollbackAllToBaseline();
    router.back();
  }, [hasQuantityChangesFromBaseline, rollbackAllToBaseline, router]);

  const openVoidModal = (menuItemCode: string, editOnly = false) => {
    const item =
      displayedItems.find(
        (entry: any) => entry.menuItemCode === menuItemCode,
      ) ?? null;
    if (!item) return;
    const existingMeta = voidMetadata[menuItemCode] ?? {
      remark: '',
      manager: '',
    };
    const prefilledRemark =
      existingMeta.remark || (editOnly ? (item.itemRemarks ?? '') : '');
    setActiveVoidItem(item);
    setVoidQuantity(editOnly ? 0 : 1);
    setVoidRemark(prefilledRemark);
    setManagerName(existingMeta.manager || '');
    setManagerPassword('');
    setIsManagerAuthView(false);
    setIsVoidModalVisible(true);
  };

  const handleVoidPreview = (menuItemCode: string) => {
    const item =
      displayedItems.find(
        (entry: any) => entry.menuItemCode === menuItemCode,
      ) ?? null;
    if (!item) return;
    if (
      pendingVoidItemId === menuItemCode &&
      activeVoidItem &&
      activeVoidItem.quantity
    ) {
      setVoidQuantity(
        Math.min(activeVoidItem.quantity, (voidQuantity || 1) + 1),
      );
      setBillingHasChanges(true);
      return;
    }
    setActiveVoidItem(item as CartItem);
    setPendingVoidItemId(menuItemCode);
    setVoidQuantity(1);
    setVoidRemark('');
    setManagerName('');
    setManagerIdError('');
    setManagerPasswordError('');
  };

  const handleVoidConfirm = async () => {
    if (!activeVoidItem) return;
    if (isManagerAuthView) {
      const trimmedManagerUsername = String(managerName || '').trim();
      const trimmedManagerPassword = String(managerPassword || '').trim();
      const nextManagerIdError = trimmedManagerUsername
        ? ''
        : 'Manager username is required!';
      const nextManagerPasswordError = trimmedManagerPassword
        ? ''
        : 'Password is required!';
      setManagerIdError(nextManagerIdError);
      setManagerPasswordError(nextManagerPasswordError);
      if (nextManagerIdError || nextManagerPasswordError) return;
      if (managerVerifying) return;
      setManagerVerifying(true);
      try {
        const verifyResult = await apiClient.verifyManager(
          trimmedManagerUsername,
          trimmedManagerPassword,
        );
        if (!verifyResult.ok) {
          setManagerPasswordError(
            verifyResult.data?.message || 'Invalid manager credentials',
          );
          return;
        }
        const verifiedMgrId = String(verifyResult.data?.manager?.userId ?? '').trim();
        const itemCode = activeVoidItem.menuItemCode;
        const trimmedRemark = String(voidRemark || '').trim();
        const trimmedManager = String(managerName || '').trim();
        upsertVoidMetadata(itemCode, trimmedRemark, trimmedManager, verifiedMgrId);
        resetVoidState();
        return;
      } catch (error) {
        setManagerPasswordError(
          'Could not verify manager. Check connection and try again.',
        );
        return;
      } finally {
        setManagerVerifying(false);
      }
    }
    const itemCode = activeVoidItem.menuItemCode;
    const baselineQty = getBaselineQuantity(itemCode);
    const currentItem = displayedItems.find(
      (it: any) => it.menuItemCode === itemCode,
    );
    const currentQty = Number(currentItem?.quantity ?? 0) || 0;
    const isTrueVoidReduction = currentQty < baselineQty;
    const trimmedRemark = String(voidRemark || '').trim();
    const trimmedManager = String(managerName || '').trim();
    if (isTrueVoidReduction && (!trimmedRemark || !trimmedManager)) {
      Alert.alert(
        'Validation Error',
        'Void Remark and Manager Username are required',
      );
      return;
    }
    if (trimmedRemark || trimmedManager)
      upsertVoidMetadata(itemCode, trimmedRemark, trimmedManager, voidMetadata[itemCode]?.managerId);
    if (lastConfirmedOrder && !isTrueVoidReduction) {
      useOrderStore.getState().setLastConfirmedOrder({
        ...lastConfirmedOrder,
        items: lastConfirmedOrder.items.map((it) =>
          it.menuItemCode === itemCode
            ? { ...it, itemRemarks: trimmedRemark || it.itemRemarks }
            : it,
        ),
      });
    }
    resetVoidState();
  };

  const updateDisplayedQuantity = (menuItemCode: string, delta: number) => {
    if (lastConfirmedOrder) {
      const currentItem = lastConfirmedOrder.items.find(
        (it) => it.menuItemCode === menuItemCode,
      );
      if (!currentItem) return;
      const originalQuantity =
        originalQuantitiesRef.current[menuItemCode] ??
        (Number(currentItem.quantity ?? 0) || 0);
      const nextQuantity = Math.max(
        0,
        Number(currentItem.quantity ?? 0) + delta,
      );
      const shouldOpenVoidRemark = delta < 0 && nextQuantity < originalQuantity;
      useOrderStore.getState().setLastConfirmedOrder((current) => {
        if (!current) return current;
        return {
          ...current,
          items: current.items.map((it) =>
            it.menuItemCode === menuItemCode
              ? {
                  ...it,
                  quantity: Math.max(0, Math.floor(it.quantity + delta)),
                }
              : it,
          ),
        };
      });
      adjustPendingAddition(menuItemCode, delta);
      const updatedItem = useOrderStore
        .getState()
        .lastConfirmedOrder?.items.find(
          (it) => it.menuItemCode === menuItemCode,
        );
      if (shouldOpenVoidRemark && updatedItem) {
        setPendingVoidItemId(menuItemCode);
        setActiveVoidItem(updatedItem as CartItem);
      } else if (pendingVoidItemId === menuItemCode) {
        setPendingVoidItemId(null);
        setActiveVoidItem(null);
        setVoidQuantity(1);
        setVoidRemark('');
      }
    } else {
      const cartItem =
        cartItems.find((c) => c.menuItemCode === menuItemCode) ?? null;
      const originalQuantity =
        originalQuantitiesRef.current[menuItemCode] ??
        (Number(cartItem?.quantity ?? 0) || 0);
      const nextQuantity = Math.max(
        0,
        Number(cartItem?.quantity ?? 0) + delta,
      );
      const shouldOpenVoidRemark = delta < 0 && nextQuantity < originalQuantity;
      updateQuantityInCart(menuItemCode, delta);
      adjustPendingAddition(menuItemCode, delta);
      if (shouldOpenVoidRemark && cartItem) {
        setPendingVoidItemId(menuItemCode);
        setActiveVoidItem(cartItem);
      } else if (pendingVoidItemId === menuItemCode) {
        setPendingVoidItemId(null);
        setActiveVoidItem(null);
        setVoidQuantity(1);
        setVoidRemark('');
      }
    }
  };

  const handleVoidCancel = () => {
    if (activeVoidItem) {
      rollbackItemToBaseline(activeVoidItem.menuItemCode);
      deleteVoidMetadata(activeVoidItem.menuItemCode);
    }
    resetVoidState();
  };

  // ── handleFooterAction ─────────────────────────────────────────────────────
  const handleFooterAction = () => {
    if (billingHasChanges) {
      void (async () => {
        try {
          const voidCandidates = displayedItems.filter((item: any) => {
            return (
              (Number(item.quantity ?? 0) || 0) <
              getBaselineQuantity(
                item.menuItemCode || item.ItemCode || item.itemCode,
              )
            );
          });

          const voidCandidateMissingMeta = voidCandidates.some(
            (candidate: any) => {
              const itemCode =
                candidate.menuItemCode ||
                candidate.ItemCode ||
                candidate.itemCode;
              const itemMeta = voidMetadata[itemCode] || {
                remark: '',
                manager: '',
              };
              return (
                !String(itemMeta.remark).trim() ||
                !String(itemMeta.manager).trim()
              );
            },
          );

          if (voidCandidateMissingMeta) {
            Alert.alert(
              'Validation Error',
              'Void Remark and Manager Approval are required',
            );
            return;
          }

          const pendingEntries = Object.entries(pendingAdditions).filter(
            ([code, qty]) =>
              qty > 0 && code && code !== 'undefined' && code !== 'null',
          );

          if (pendingEntries.length === 0 && voidCandidates.length === 0) {
            clearPendingChanges();
            Alert.alert('Confirmed', 'No pending changes to save.');
            return;
          }

          // ─── FIX: Robust tableNo resolution ─────────────────────────────
          // Priority: lastConfirmedOrder.tableNo → tableNo param → tableName param → ''
          // For TA orders, lastConfirmedOrder.tableNo holds the TA serial (e.g. "TA-0012")
          // For DI orders, it holds the server table number
          const tNo = String(
            lastConfirmedOrder?.tableNo ??
            tableNo ??
            tableName ??
            ''
          ).trim();

          // ─── FIX: Robust tableGrpId resolution ──────────────────────────
          const tableGrpId = String(
            lastConfirmedOrder?.tableGrpId ?? ''
          ).trim();

          const lPax = resolvePaxValue(
            lastConfirmedOrder?.lPax,
            localPax,
            dbLPax,
          );
          const fPax = resolvePaxValue(
            lastConfirmedOrder?.fPax,
            foreignPax,
            dbFPax,
          );
          const userId = lastConfirmedOrder?.userId ?? 'SYSTEM';
          const orderType = (lastConfirmedOrder as any)?.orderType || 'DI';

          // ─── Guard: backend requires tableNo ────────────────────────────
          if (!tNo) {
            Alert.alert(
              'Missing Table',
              'Could not determine the table number. Please go back and reopen the bill.',
            );
            return;
          }

          console.log('[BillingScreen] handleFooterAction payload meta:', {
            tNo,
            tableGrpId,
            orderType,
            lPax,
            fPax,
            userId,
          });

          const addRequests = pendingEntries.map(
            ([menuItemCode, deltaQty]) => {
              const currentItem = displayedItems.find(
                (item: any) =>
                  item.menuItemCode === menuItemCode ||
                  item.ItemCode === menuItemCode ||
                  item.itemCode === menuItemCode,
              );

              if (!currentItem) {
                console.error(
                  `[BillingScreen] Missing details for item: ${menuItemCode}`,
                );
                return Promise.resolve({ ok: true, data: {} } as any);
              }

              // ─── FIX: Explicitly include tableNo + tableGrpId + invoiceNo ─
              // invoiceNo is required so the server can find the existing row
              // via the PK (TabelNo, ItemCode, InvoiceNo) and UPDATE instead
              // of INSERT — prevents "PRIMARY KEY constraint" errors.
              return apiClient.addBillingItem({
                tableNo: tNo,
                tableGrpId,
                invoiceNo: dbInvoiceNo ?? undefined,
                itemCode: menuItemCode,
                qty: deltaQty,
                QTY: deltaQty,
                AoR: 'A',
                salesPrice: Number(currentItem.salesPrice ?? 0) || 0,
                itemRemarks: currentItem.itemRemarks ?? '',
                userId,
                orderType,
                lPax,
                fPax,
                mgrId: String(
                  voidMetadata[menuItemCode]?.managerId ?? '',
                ).trim(),
              } as any);
            },
          );

          const voidRequests = voidCandidates.map((item: any) => {
            const baselineQty = getBaselineQuantity(item.menuItemCode);
            const currentQty = Number(item.quantity ?? 0) || 0;
            const removeQtyDelta = Math.max(0, baselineQty - currentQty);
            const itemMeta = voidMetadata[item.menuItemCode] || {
              remark: '',
              manager: '',
              managerId: '',
            };

            if (removeQtyDelta <= 0)
              return Promise.resolve({ ok: true, data: {} });

            // ─── FIX: Explicitly include tableNo + tableGrpId ─────────────
            return apiClient.removeBillingItem({
              tableNo: tNo,
              tableGrpId,
              itemCode: item.menuItemCode,
              qty: removeQtyDelta,
              QTY: removeQtyDelta,
              qtyDifference: removeQtyDelta,
              AoR: 'R',
              salesPrice: Number(item.salesPrice ?? 0) || 0,
              itemRemarks: '',
              voidRemark: String(itemMeta.remark).trim(),
              userId,
              orderType,
              lPax,
              fPax,
              mgrId: String(itemMeta.managerId ?? '').trim(),
            } as any);
          });

          // ─── FIX: Run sequentially, NOT with Promise.all ────────────────
          // Concurrent requests on the same InvoiceNo can race each other
          // at the DB level and hit "Violation of PRIMARY KEY constraint".
          // Sequential execution lets each request complete its
          // SELECT → UPDATE/INSERT cycle inside a SERIALIZABLE transaction
          // before the next one starts.
          const results: Array<{ ok: boolean; data?: any }> = [];
          for (const req of [...addRequests, ...voidRequests]) {
            results.push(await req);
          }
          const failed = results.find((result) => !result.ok);
          if (failed) {
            const serverMsg =
              failed.data &&
              (failed.data.message || JSON.stringify(failed.data));
            throw new Error(serverMsg || 'Failed to save billing changes');
          }

          originalQuantitiesRef.current = displayedItems.reduce<
            Record<string, number>
          >((acc, item: any) => {
            acc[item.menuItemCode] = Number(item.quantity ?? 0) || 0;
            return acc;
          }, {});

          clearPendingChanges();
          setVoidMetadata((current) => {
            const next = { ...current };
            voidCandidates.forEach((candidate: any) => {
              delete next[candidate.menuItemCode];
            });
            return next;
          });
          resetVoidState();
          Alert.alert('Confirmed', 'Billing changes saved successfully.');
        } catch (error) {
          Alert.alert(
            'Save failed',
            error instanceof Error
              ? error.message
              : 'Failed to save billing changes',
          );
        }
      })();
      return;
    }

    void (async () => {
      try {
        if (hasQuantityChangesFromBaseline()) rollbackAllToBaseline();
        const tNo = String(
          lastConfirmedOrder?.tableNo ??
          tableNo ??
          tableName ??
          ''
        ).trim();

        let result: any = { ok: true, data: {} };

        if (typeof (apiClient as any).finalizeBill === 'function') {
          result = await (apiClient as any).finalizeBill({ tableNo: tNo });
        } else if (typeof (apiClient as any).printBill === 'function') {
          result = await (apiClient as any).printBill({ tableNo: tNo });
        }

        if (!result.ok) {
          const serverMsg =
            result.data &&
            (result.data.message || JSON.stringify(result.data));
          throw new Error(serverMsg || 'Failed to finalize/print bill');
        }

        if (dbInvoiceNo) {
          const payResult = await apiClient.payBill({
            invoiceNo: dbInvoiceNo,
            tableNo: tNo || undefined,
            orderType: (lastConfirmedOrder as any)?.orderType || 'DI',
            tableGrpId: lastConfirmedOrder?.tableGrpId || '',
          } as any);

          if (!payResult.ok)
            console.log('[BillingScreen] payBill failed', payResult.error);
        }

        useOrderStore.getState().clearLastConfirmedOrder();
        Alert.alert('Done', 'Payment completed and cart cleared.');
        router.push('/');
      } catch (error) {
        Alert.alert(
          'Finalize failed',
          error instanceof Error
            ? error.message
            : 'Failed to finalize/print bill',
        );
      }
    })();
  };

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPresetListView) return;
    let isMounted = true;
    void (async () => {
      try {
        const response = await apiClient.getVoidPresets();
        if (!isMounted) return;
        setVoidPresetItems(
          response.ok && Array.isArray(response.data) ? response.data : [],
        );
      } catch {
        if (isMounted) setVoidPresetItems([]);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [isPresetListView]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // ── fromCart effect ────────────────────────────────────────────────────────
  useEffect(() => {
    const targetTableNo = String(tableName ?? tableNo ?? '').trim();
    const targetInvoiceNo = String(routeInvoiceNo ?? '').trim() || undefined;
    const returningFromCart = fromCart === '1';

    if (!targetTableNo) return;

    if (
      !returningFromCart &&
      lastConfirmedOrder &&
      String(lastConfirmedOrder.tableNo ?? '').trim() === targetTableNo
    ) {
      return;
    }

    let isMounted = true;

    if (returningFromCart) {
      useOrderStore.getState().clearLastConfirmedOrder();
      setCartItemsInStore([]);
    }

    setIsLoadingBillFromDb(true);

    // Capture as a stable local boolean so the async closure always reads
    // the value from *this* effect invocation — avoids stale-closure lint errors.
    const isFromCart = returningFromCart;

    const fetchBillData = async () => {
      try {
        const response = await apiClient.getActiveBillItems(
          targetTableNo,
          targetInvoiceNo,
        );

        if (!isMounted || !response.ok || !response.data?.data) return;

        const data = response.data.data;
        const freshItems = Array.isArray(data.items) ? data.items : [];

        setCartItemsInStore(freshItems);

        // FIX: Prefer server-returned tableNo, fall back to route param
        const resolvedTableNo = String(data.tableNo ?? targetTableNo ?? '').trim();

        useOrderStore.getState().setLastConfirmedOrder({
          orderType: data.orderType || 'DI',
          tableNo: resolvedTableNo,
          userId: data.userId || 'SYSTEM',
          tableGrpId: data.tableGrpId || '',
          lPax: resolvePaxValue(data.lPax, (data as any).LPax, localPax),
          fPax: resolvePaxValue(data.fPax, (data as any).FPax, foreignPax),
          invoiceNo: targetInvoiceNo ?? data.invoiceNo ?? undefined,
          createdAt: data.createdAt || new Date().toISOString(),
          items: freshItems.map((item: any) => ({
            menuItemCode: item.menuItemCode || item.ItemCode || item.itemCode,
            menuItmDes: item.menuItmDes || item.ItemDescription || '',
            salesPrice: Number(item.salesPrice ?? item.SalesPrice ?? 0),
            quantity: Number(item.quantity ?? item.QTY ?? 0),
            itemRemarks: item.itemRemarks || item.ItemRemarks || '',
          })),
        });

        // ✅ FIX: When coming from cart, establish fresh baseline and clear changes flag
        if (isFromCart && isMounted) {
          originalQuantitiesRef.current = freshItems.reduce(
            (acc: Record<string, number>, item: any) => {
              const code = item.menuItemCode || item.ItemCode || item.itemCode;
              acc[code] = Number(item.quantity ?? item.QTY ?? 0) || 0;
              return acc;
            },
            {} as Record<string, number>,
          );
          originalTableNoRef.current = resolvedTableNo;
          setBillingHasChanges(false);
          setPendingAdditions({});
          setVoidMetadata({});
        }

        setDbInvoiceNo(targetInvoiceNo ?? data.invoiceNo ?? null);
        setDbLPax(resolvePaxValue(data.lPax, (data as any).LPax, localPax));
        setDbFPax(resolvePaxValue(data.fPax, (data as any).FPax, foreignPax));
      } catch (error) {
        console.error('[BillingScreen] Error fetching bill:', error);
      } finally {
        if (isMounted) setIsLoadingBillFromDb(false);
      }
    };

    fetchBillData();

    return () => {
      isMounted = false;
    };
  }, [tableName, tableNo, routeInvoiceNo, fromCart, forceRefresh, localPax, foreignPax, resolvePaxValue]);

  useEffect(() => {
    if (!activeTableNo) {
      originalQuantitiesRef.current = {};
      originalTableNoRef.current = '';
      return;
    }
    
    // ✅ FIX: Don't reinitialize baseline if already set for this table
    const hasBaseline =
      originalTableNoRef.current === activeTableNo &&
      Object.keys(originalQuantitiesRef.current).length > 0;
    if (hasBaseline) return;
    
    const sourceItems = lastConfirmedOrder?.items?.length
      ? lastConfirmedOrder.items
      : cartItems;
    if (!sourceItems.length) return;
    
    originalQuantitiesRef.current = sourceItems.reduce<Record<string, number>>(
      (acc, item) => {
        acc[item.menuItemCode] = Number(item.quantity ?? 0) || 0;
        return acc;
      },
      {},
    );
    originalTableNoRef.current = activeTableNo;
    
    // ✅ FIX: Ensure changes flag is false when baseline is freshly set
    setBillingHasChanges(false);
  }, [activeTableNo, cartItems, lastConfirmedOrder?.items]);

  useEffect(() => {
    setBillingHasChanges(hasQuantityChangesFromBaseline());
  }, [hasQuantityChangesFromBaseline]);

  useEffect(() => {
    const handler = () => {
      goBack();
      return true;
    };
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      handler,
    );
    return () => subscription.remove();
  }, [goBack]);

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#002748" />

      {/* HEADER */}
      <View style={[s.header, { paddingTop: insets.top }]}>
        <View style={s.headerTopRow}>
          <TouchableOpacity
            style={s.backButton}
            onPress={goBack}
            disabled={isHydratingBill}
          >
            <Image
              source={require('../../assets/icons/blackback.png')}
              style={s.backIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>

          <Text style={s.headerTitle}>Billing</Text>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleNewOrder}
            style={s.newOrderButton}
          >
            <Ionicons name="add" size={14} color="#002748" />
            <Text style={s.newOrderButtonText}>New Order</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* TOAST BANNER */}
      {toastMessage && (
        <View style={s.toastBanner} pointerEvents="none">
          <Text style={s.toastBannerText}>{toastMessage}</Text>
        </View>
      )}

      {/* TABLE INFO */}
      <View style={s.fixedInfo}>
        <View style={s.logoContainer}>
          <Image
            source={require('../../assets/images/CAPTURE 1.png')}
            style={s.logo}
            resizeMode="contain"
          />
        </View>

        {/* Show DB-resolved tableNo (TA-XXXX for take-away, table name for dine-in) */}
        <Text style={s.tableNumber}>
          {(lastConfirmedOrder as any)?.orderType === 'TA'
            ? `Take Away - ${activeTableNo || lastConfirmedOrder?.tableNo || '—'}`
            : `Table - ${activeTableNo || tableName || tableNo || '—'}`}
        </Text>

        {/* Invoice number — shown once confirmed */}
        {!!(dbInvoiceNo || lastConfirmedOrder?.invoiceNo) && (
          <Text style={[s.dateText, { fontSize: isTablet ? 14 : isSmall ? 10 : 11, marginTop: 2, opacity: 0.8 }]}>
            Invoice: {dbInvoiceNo || lastConfirmedOrder?.invoiceNo}
          </Text>
        )}

        {/* Order type badge */}
        
          
          <Text style={s.dateText}>
            {timeStr}{'  '}{dateStr}
          </Text>
        
      </View>

      {/* ITEMS LIST */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom }]}
      >
        {isLoadingBillFromDb ? (
          <View style={s.loadingCard}>
            <ActivityIndicator size="large" color="#002748" />
            <Text style={s.loadingText}>Loading bill...</Text>
          </View>
        ) : (
          <>
            {billingSections.map((section) => (
              <React.Fragment key={section.categoryCode}>
                <View style={s.billingSectionHeader}>
                  <Text style={s.billingSectionHeaderText}>
                    {section.label}
                  </Text>
                  <View style={s.billingSectionHeaderLine} />
                </View>

                {section.items.map((item: any, index: number) => (
                  <View
                    key={`${item.menuItemCode}-${index}`}
                    style={s.billItemBlock}
                  >
                    <View style={s.itemRow}>
                      <Text style={s.itemName} numberOfLines={2}>
                        {item.menuItmDes}
                      </Text>
                      <View style={s.itemRightBlock}>
                        <Text style={s.itemPrice}>
                          Lkr{' '}
                          {(
                            Number(item.salesPrice ?? 0) *
                            Number(item.quantity ?? 0)
                          ).toFixed(2)}
                        </Text>
                        <View style={s.qtyPill}>
                          <TouchableOpacity
                            onPress={() =>
                              updateDisplayedQuantity(item.menuItemCode, -1)
                            }
                            onLongPress={() =>
                              openVoidModal(item.menuItemCode)
                            }
                            style={s.qtyBtn}
                            delayLongPress={300}
                          >
                            <Ionicons
                              name="remove"
                              size={isTablet ? 16 : 12}
                              color="#000"
                            />
                          </TouchableOpacity>
                          <Text style={s.qtyText}>{item.quantity}</Text>
                          <TouchableOpacity
                            onPress={() =>
                              updateDisplayedQuantity(item.menuItemCode, 1)
                            }
                            style={s.qtyBtn}
                          >
                            <Ionicons
                              name="add"
                              size={isTablet ? 16 : 12}
                              color="#000"
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>

                    {pendingVoidItemId === item.menuItemCode && (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        style={s.inlineVoidActionBtn}
                        onPress={() => openVoidModal(item.menuItemCode)}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Text style={s.inlineVoidActionText}>
                            Add Void Remark
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}

                    {'itemRemarks' in item && item.itemRemarks ? (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => openBillingRemarkModal(item)}
                        style={s.billingRemarkRow}
                      >
                        <Text style={s.billingRemarkText} numberOfLines={2}>
                          {item.itemRemarks}
                        </Text>
                      </TouchableOpacity>
                    ) : null}

                    {index < section.items.length - 1 ? (
                      <View style={s.itemDivider} />
                    ) : null}
                  </View>
                ))}
              </React.Fragment>
            ))}

            {/* ── ADD MORE BUTTON ── */}
            <View style={s.addMoreWrap}>
              <TouchableOpacity
                style={s.addMoreBtn}
                activeOpacity={0.85}
                onPress={() => {
                  const activeOrderType: string =
                    (lastConfirmedOrder as any)?.orderType ||
                    String(useOrderStore.getState().lastConfirmedOrder?.orderType ?? '') ||
                    'DI';

                  if (!lastConfirmedOrder && cartItems.length > 0) {
                    const activeTable = String(
                      tableName ?? tableNo ?? '',
                    ).trim();
                    const activeInvoice = String(
                      routeInvoiceNo ?? dbInvoiceNo ?? '',
                    ).trim();
                    useOrderStore.getState().setLastConfirmedOrder({
                      orderType: activeOrderType,
                      tableNo: activeTable,
                      userId: 'SYSTEM',
                      tableGrpId: '',
                      lPax: resolvePaxValue(dbLPax, localPax),
                      fPax: resolvePaxValue(dbFPax, foreignPax),
                      invoiceNo: activeInvoice || undefined,
                      createdAt: new Date().toISOString(),
                      items: cartItems.map((item) => ({
                        menuItemCode: item.menuItemCode,
                        menuItmDes: item.menuItmDes ?? '',
                        salesPrice: item.salesPrice ?? 0,
                        quantity: item.quantity,
                        itemRemarks: item.itemRemarks ?? '',
                      })),
                    } as any);
                  }

                  const activeConfirmedOrder =
                    useOrderStore.getState().lastConfirmedOrder ?? lastConfirmedOrder;
                  const baseItemsForSelection = (
                    activeConfirmedOrder?.items?.length
                      ? activeConfirmedOrder.items
                      : displayedItems
                  ).map((item: any) => ({
                    menuItemCode: item.menuItemCode,
                    menuItmDes: item.menuItmDes ?? '',
                    salesPrice: Number(item.salesPrice ?? 0) || 0,
                    quantity: Math.max(0, Number(item.quantity ?? 0) || 0),
                    itemRemarks: item.itemRemarks ?? '',
                  }));

                  useCartStore.getState().setCartItems(baseItemsForSelection);

                  const resolvedTableNo = String(
                    lastConfirmedOrder?.tableNo ??
                      tableNo ??
                      tableName ??
                      '',
                  );

                  const resolvedTableName = String(
                    tableName ??
                      lastConfirmedOrder?.tableNo ??
                      '',
                  );

                  router.push({
                    pathname: '/Screens/selectitems',
                    params: {
                      tableName: resolvedTableName,
                      tableNo: resolvedTableNo,
                      invoiceNo: String(
                        routeInvoiceNo ??
                          dbInvoiceNo ??
                          lastConfirmedOrder?.invoiceNo ??
                          '',
                      ),
                      localPax: String(
                        resolvePaxValue(lastConfirmedOrder?.lPax, localPax, dbLPax),
                      ),
                      foreignPax: String(
                        resolvePaxValue(lastConfirmedOrder?.fPax, foreignPax, dbFPax),
                      ),
                      floor: String(floor ?? ''),
                      fromBilling: '1',
                      status: 'Active',
                      orderType: activeOrderType,
                    },
                  });
                }}
              >
                <Text style={s.addMoreText}>+ Add More</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* FOOTER */}
      <View style={s.footer}>
        <View style={s.topDivider} />
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Gross Total (Lkr)</Text>
          <Text style={s.totalValue}>{grossTotal.toFixed(2)}</Text>
        </View>
        <TouchableOpacity
          style={[
            s.printBtn,
            { backgroundColor: footerButtonBackgroundColor },
          ]}
          activeOpacity={0.85}
          onPress={handleFooterAction}
        >
          <Text style={s.printText}>{footerButtonLabel}</Text>
        </TouchableOpacity>
      </View>

      {/* VOID MODAL */}
      <Modal
        visible={isVoidModalVisible}
        animationType="fade"
        transparent
        onRequestClose={handleVoidCancel}
      >
        <TouchableWithoutFeedback onPress={handleVoidCancel}>
          <View style={s.voidModalOverlay}>
            <TouchableWithoutFeedback>
              <View style={s.voidCard}>
                {isManagerAuthView ? (
                  <View style={s.managerAuthCardBody}>
                    <View style={s.managerAuthHeaderRow}>
                      <Text style={s.managerAuthTitle}>
                        Manager Authentication
                      </Text>
                      <TouchableOpacity
                        onPress={() => setIsManagerAuthView(false)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="close" size={22} color="#0F172A" />
                      </TouchableOpacity>
                    </View>

                    <View style={s.managerAuthFieldGroup}>
                      <Text style={s.managerAuthLabel}>
                        Manager Username:
                      </Text>
                      <View
                        style={[
                          s.managerAuthInputBox,
                          managerIdError
                            ? s.managerAuthInputBoxError
                            : null,
                        ]}
                      >
                        <TextInput
                          style={s.managerAuthInput}
                          placeholder="Enter Manager Username"
                          placeholderTextColor="rgba(0, 0, 0, 0.25)"
                          value={managerName}
                          onChangeText={(text) => {
                            setManagerName(text);
                            if (managerIdError) setManagerIdError('');
                          }}
                          onFocus={() => setIsManagerAuthView(true)}
                        />
                      </View>
                      {!!managerIdError && (
                        <Text style={s.managerAuthErrorText}>
                          {managerIdError}
                        </Text>
                      )}
                    </View>

                    <View style={s.managerAuthFieldGroup}>
                      <Text style={s.managerAuthLabel}>
                        Manager Password:
                      </Text>
                      <View
                        style={[
                          s.managerAuthInputBox,
                          managerPasswordError
                            ? s.managerAuthInputBoxError
                            : null,
                        ]}
                      >
                        <TextInput
                          style={s.managerAuthInput}
                          placeholder="Enter Password"
                          placeholderTextColor="rgba(0, 0, 0, 0.25)"
                          value={managerPassword}
                          onChangeText={(text) => {
                            setManagerPassword(text);
                            if (managerPasswordError)
                              setManagerPasswordError('');
                          }}
                          secureTextEntry
                        />
                      </View>
                      {!!managerPasswordError && (
                        <Text style={s.managerAuthErrorText}>
                          {managerPasswordError}
                        </Text>
                      )}
                    </View>

                    <View style={s.managerAuthFooter}>
                      <TouchableOpacity
                        style={[
                          s.confirmActionButtonPrimary,
                          managerVerifying ? { opacity: 0.6 } : null,
                        ]}
                        onPress={handleVoidConfirm}
                        activeOpacity={0.85}
                        disabled={managerVerifying}
                      >
                        <View style={s.confirmIconWrap}>
                          <Ionicons
                            name="checkmark"
                            size={18}
                            color="#FFF"
                          />
                        </View>
                        <Text style={s.confirmButtonLabelInlineText}>
                          {managerVerifying ? 'Verifying...' : 'Confirm'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : isPresetListView ? (
                  <View style={s.presetListCardBody}>
                    <View style={s.presetListHeaderRow}>
                      <TouchableOpacity
                        style={s.presetBackButton}
                        activeOpacity={0.8}
                        onPress={() => setIsPresetListView(false)}
                      >
                        <Ionicons
                          name="arrow-back"
                          size={18}
                          color="#0F172A"
                        />
                      </TouchableOpacity>
                      <Text style={s.presetListTitle}>
                        Select Preset Remark
                      </Text>
                      <View style={s.presetBackButtonSpacer} />
                    </View>
                    <ScrollView
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={s.presetListContent}
                    >
                      {voidPresetItems.length > 0 ? (
                        voidPresetItems.map((item, index) => (
                          <TouchableOpacity
                            key={String(item.VoidRmkId ?? index)}
                            activeOpacity={0.82}
                            style={s.presetListRow}
                            onPress={() => {
                              setVoidRemark(
                                String(item.VoidDescription ?? '').trim(),
                              );
                              setIsPresetListView(false);
                            }}
                          >
                            <Text style={s.presetListRowText}>
                              {String(item.VoidDescription ?? '').trim()}
                            </Text>
                            <Ionicons
                              name="chevron-forward"
                              size={18}
                              color="#002748"
                            />
                          </TouchableOpacity>
                        ))
                      ) : (
                        <View style={s.presetListEmptyWrap}>
                          <Text style={s.presetListEmptyText}>
                            No preset remarks available.
                          </Text>
                        </View>
                      )}
                    </ScrollView>
                  </View>
                ) : (
                  <View style={s.voidCardBody}>
                    <ScrollView
                      showsVerticalScrollIndicator
                      contentContainerStyle={s.voidCardContent}
                      style={s.voidCardScroll}
                    >
                      <View style={s.metaSpecificationsStack}>
                        <View style={s.metaRowInline}>
                          <Text style={s.metaLabelStyle}>Void Item:</Text>
                          <Text style={s.metaValueStyle}>
                            {activeVoidItem?.menuItmDes || 'N/A'}
                          </Text>
                        </View>
                        <View
                          style={[
                            s.metaRowInline,
                            { alignItems: 'center' },
                          ]}
                        >
                          <Text style={s.metaLabelStyle}>
                            Remove Quantity:
                          </Text>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              marginLeft: 8,
                            }}
                          >
                            <TouchableOpacity
                              onPress={() =>
                                setVoidQuantity((q) =>
                                  Math.max(1, (q || 1) - 1),
                                )
                              }
                              style={s.voidQtyBtn}
                              activeOpacity={0.8}
                            >
                              <Ionicons
                                name="remove"
                                size={16}
                                color="#000"
                              />
                            </TouchableOpacity>
                            <Text
                              style={[
                                s.metaValueStyle,
                                { minWidth: 32, textAlign: 'center' },
                              ]}
                            >
                              {String(voidQuantity || 1).padStart(2, '0')}
                            </Text>
                            <TouchableOpacity
                              onPress={() =>
                                setVoidQuantity((q) =>
                                  Math.min(
                                    activeVoidItem?.quantity ?? 9999,
                                    (q || 1) + 1,
                                  ),
                                )
                              }
                              style={s.voidQtyBtn}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="add" size={16} color="#000" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>

                      <Text style={s.inputFieldLabelOutside}>
                        Void Remarks:
                      </Text>
                      <View style={s.textareaWrapperContainer}>
                        <View style={s.textAreaInputBox}>
                          <TextInput
                            style={s.textAreaTextInput}
                            placeholder="Add Void Remark..."
                            placeholderTextColor="rgba(0, 0, 0, 0.25)"
                            multiline
                            numberOfLines={4}
                            value={voidRemark}
                            onChangeText={setVoidRemark}
                          />
                        </View>
                        <TouchableOpacity
                          activeOpacity={0.82}
                          style={s.presetToggleButton}
                          onPress={() => setIsPresetListView(true)}
                        >
                          <Text style={s.presetToggleButtonText}>
                            Preset
                          </Text>
                          <Ionicons name="albums" size={14} color="#fff" />
                        </TouchableOpacity>
                      </View>

                      <Text style={s.inputFieldLabelOutside}>
                        Manager Name:
                      </Text>
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => setIsManagerAuthView(true)}
                      >
                        <View style={s.singleLineInputBoxWrapper}>
                          <TextInput
                            style={s.singleLineInputField}
                            placeholder="Enter Manager Username"
                            placeholderTextColor="rgba(0, 0, 0, 0.25)"
                            value={managerName}
                            onChangeText={(text) => {
                              setManagerName(text);
                              if (managerIdError) setManagerIdError('');
                            }}
                            onFocus={() => setIsManagerAuthView(true)}
                          />
                        </View>
                      </TouchableOpacity>
                    </ScrollView>

                    <View style={s.voidCardFooter}>
                      <View style={s.ctaButtonControlRowGroup}>
                        <TouchableOpacity
                          style={s.confirmActionButtonPrimary}
                          onPress={handleVoidConfirm}
                          activeOpacity={0.85}
                        >
                          <View style={s.confirmIconWrap}>
                            <Ionicons
                              name="checkmark"
                              size={18}
                              color="#FFF"
                            />
                          </View>
                          <Text style={s.confirmButtonLabelInlineText}>
                            Confirm
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={s.cancelActionButtonOutlineSecondary}
                          onPress={handleVoidCancel}
                          activeOpacity={0.85}
                        >
                          <Text style={s.cancelButtonLabelInlineText}>
                            Cancel
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* BILLING REMARK MODAL */}
      <Modal
        visible={billingRemarkVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBillingRemarkVisible(false)}
      >
        <TouchableWithoutFeedback
          onPress={() => setBillingRemarkVisible(false)}
        >
          <View style={s.remarkModalOverlay}>
            <TouchableWithoutFeedback>
              <View style={s.remarkCard}>
                {!billingIsViewingPresets ? (
                  <>
                    <View style={s.remarkCardHeader}>
                      <Text style={s.remarkCardHeaderTitle}>
                        Order Remark
                      </Text>
                      <TouchableOpacity
                        onPress={() => setBillingRemarkVisible(false)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="close" size={22} color="#0F172A" />
                      </TouchableOpacity>
                    </View>
                    <View style={s.remarkCardBody}>
                      <ScrollView
                        showsVerticalScrollIndicator
                        contentContainerStyle={s.remarkCardContent}
                        style={s.remarkScrollArea}
                      >
                        <View style={s.tagsWrap}>
                          {billingModalTags.map((t, index) => (
                            <View
                              key={`${t}-${index}`}
                              style={s.tagBadge}
                            >
                              <TouchableOpacity
                                onPress={() => billingEditTag(t, index)}
                                style={s.tagLabelBtn}
                                activeOpacity={0.75}
                              >
                                <Text style={s.tagText}>{t}</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => billingRemoveTag(t)}
                                style={s.tagClose}
                              >
                                <Ionicons
                                  name="close"
                                  size={14}
                                  color="#fff"
                                />
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                        <View style={s.remarkInputRow}>
                          <View style={s.remarkInputShell}>
                            <TextInput
                              value={billingRemarkDraft}
                              onChangeText={setBillingRemarkDraft}
                              placeholder="Type custom remark"
                              placeholderTextColor="rgba(0,0,0,0.5)"
                              style={s.remarkInput}
                            />
                            <TouchableOpacity
                              onPress={() => {
                                setBillingIsViewingPresets(true);
                                void loadBillingRemarkPresets();
                              }}
                              style={s.remarkDropdownIconBtn}
                              activeOpacity={0.8}
                            >
                              <Ionicons
                                name="chevron-down"
                                size={20}
                                color="#0062AA"
                              />
                            </TouchableOpacity>
                          </View>
                          <TouchableOpacity
                            style={s.addTagBtn}
                            onPress={() =>
                              billingAddTag(billingRemarkDraft)
                            }
                          >
                            <Text style={s.addTagText}>Add Tag</Text>
                          </TouchableOpacity>
                        </View>
                      </ScrollView>
                      <TouchableOpacity
                        style={s.saveRemarkBtn}
                        onPress={saveBillingRemarks}
                        activeOpacity={0.85}
                      >
                        <Text style={s.saveRemarkText}>Save Remarks</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={s.remarkCardHeader}>
                      <TouchableOpacity
                        onPress={() => setBillingIsViewingPresets(false)}
                        activeOpacity={0.8}
                        style={s.remarkHeaderIconBtn}
                      >
                        <Ionicons
                          name="arrow-back"
                          size={22}
                          color="#0F172A"
                        />
                      </TouchableOpacity>
                      <Text style={s.remarkCardHeaderTitle}>
                        Select Preset Remark
                      </Text>
                      <TouchableOpacity
                        onPress={() => setBillingRemarkVisible(false)}
                        activeOpacity={0.8}
                        style={s.remarkHeaderIconBtn}
                      >
                        <Ionicons name="close" size={22} color="#0F172A" />
                      </TouchableOpacity>
                    </View>
                    <View style={s.presetsDivider} />
                    {billingLoadingPresets ? (
                      <View style={s.presetsLoaderWrap}>
                        <ActivityIndicator size="small" color="#002748" />
                      </View>
                    ) : (
                      <ScrollView
                        showsVerticalScrollIndicator
                        contentContainerStyle={s.presetsListContent}
                      >
                        {billingRemarkOptions.length > 0 ? (
                          billingRemarkOptions.map((r) => (
                            <TouchableOpacity
                              key={r}
                              style={s.presetsRow}
                              onPress={() => billingAddTag(r)}
                            >
                              <Text style={s.presetsRowText}>{r}</Text>
                            </TouchableOpacity>
                          ))
                        ) : (
                          <View style={s.presetsLoaderWrap}>
                            <Text
                              style={{
                                color: 'rgba(0,39,72,0.7)',
                                fontSize: 13,
                              }}
                            >
                              No presets available.
                            </Text>
                          </View>
                        )}
                      </ScrollView>
                    )}
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* LOADING OVERLAY */}
      {isHydratingBill && (
        <View style={s.loadingOverlay} pointerEvents="auto">
          <View style={s.loadingCard}>
            <ActivityIndicator size="large" color="#002748" />
            <Text style={s.loadingText}>Loading active bill...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Dynamic Styles Factory ───────────────────────────────────────────────────
function getDynamicStyles(width: number, height: number, bottomInset: number) {
  const isTablet = width >= 600;
  const isSmall = height < 700;

  const BASE_WIDTH = isTablet ? 768 : 375;
  const scale = (size: number): number => (width / BASE_WIDTH) * size;

  const headerH = isTablet ? 220 : isSmall ? 80 : 150;
  const hPad = isTablet ? 40 : isSmall ? 12 : 16;
  const backBtnSize = isTablet ? 40 : isSmall ? 30 : 44;
  const backIconSize = isTablet ? 64 : isSmall ? 22 : 42;
  const titleFs = isTablet ? 32 : isSmall ? 20 : 24;

  const newOrderBtnH = isTablet ? 42 : isSmall ? 28 : 34;
  const newOrderBtnPadH = isTablet ? 16 : isSmall ? 10 : 12;
  const newOrderBtnR = 999;
  const newOrderFs = isTablet ? 15 : isSmall ? 11 : 12;

  const toastTop = headerH - 10;
  const toastLR = isTablet ? 24 : isSmall ? 12 : 16;
  const toastPadV = isTablet ? 14 : isSmall ? 8 : 10;
  const toastPadH = isTablet ? 22 : isSmall ? 12 : 16;
  const toastRadius = 999;
  const toastFs = isTablet ? 15 : isSmall ? 11 : 13;

  const fixedInfoPadT = isTablet ? 20 : isSmall ? 10 : 14;
  const fixedInfoPadB = isTablet ? 10 : isSmall ? 4 : 6;
  const logoW = isTablet ? 200 : isSmall ? 120 : 159;
  const logoH = isTablet ? 100 : isSmall ? 44 : 60;
  const logoMB = isTablet ? 16 : isSmall ? 8 : 12;
  const tableFs = isTablet ? 24 : isSmall ? 13 : 16;
  const tableMB = isTablet ? 6 : isSmall ? 2 : 4;
  const dateFs = isTablet ? 16 : isSmall ? 11 : 14;
  const dateMB = isTablet ? 20 : isSmall ? 10 : 16;

  const contentPadT = isTablet ? 14 : isSmall ? 6 : 10;
  const contentPadB = isTablet ? 16 : isSmall ? 8 : 12;
  const billItemMB = isTablet ? 12 : isSmall ? 5 : 8;
  const itemFs = isTablet ? 20 : isSmall ? 13 : 14;
  const itemRowMB = isTablet ? 4 : isSmall ? 1 : 2;
  const itemNameMR = isTablet ? 12 : isSmall ? 6 : 8;
  const itemPriceMB = isTablet ? 6 : isSmall ? 2 : 4;
  const itemDivMT = isTablet ? 14 : isSmall ? 7 : 10;
  const qtyBtnSize = isTablet ? 28 : isSmall ? 20 : 24;
  const qtyBtnRadius = isTablet ? 6 : isSmall ? 3 : 4;
  const qtyPillGap = isTablet ? 6 : isSmall ? 3 : 4;
  const qtyFs = isTablet ? 20 : isSmall ? 14 : 16;
  const qtyMinW = isTablet ? 22 : isSmall ? 14 : 16;
  const inlineVoidPadH = isTablet ? 20 : isSmall ? 10 : 14;
  const inlineVoidPadV = isTablet ? 10 : isSmall ? 4 : 6;
  const inlineVoidMT = isTablet ? 10 : isSmall ? 4 : 6;
  const inlineVoidMB = isTablet ? 12 : isSmall ? 5 : 8;
  const inlineVoidRadius = isTablet ? 12 : isSmall ? 6 : 8;
  const inlineVoidFs = isTablet ? 17 : isSmall ? 12 : 14;
  const remarkTextFs = isTablet ? 15 : isSmall ? 10 : 12;
  const remarkMT = isTablet ? 4 : isSmall ? 1 : 2;

  const addMoreMT = isTablet ? 22 : isSmall ? 10 : 16;
  const addMoreMB = isTablet ? 12 : isSmall ? 5 : 8;
  const addMoreH = isTablet ? 64 : isSmall ? 42 : 52;
  const addMoreRadius = isTablet ? 16 : isSmall ? 10 : 12;
  const addMoreBW = isTablet ? 2 : 1.5;
  const addMoreFs = isTablet ? 20 : isSmall ? 13 : 16;

  const footerPadT = isTablet ? 16 : isSmall ? 8 : 12;
  const footerPadB = isTablet ? 28 : isSmall ? 12 : 20;
  const dividerMB = isTablet ? 20 : isSmall ? 10 : 16;
  const totalFs = isTablet ? 24 : isSmall ? 14 : 16;
  const totalMT = isTablet ? 6 : isSmall ? 2 : 4;
  const printBtnH = isTablet ? 60 : isSmall ? 42 : 48;
  const printBtnRadius = isTablet ? 16 : isSmall ? 10 : 12;
  const printBtnGap = isTablet ? 14 : isSmall ? 6 : 10;
  const printFs = isTablet ? 24 : isSmall ? 14 : 16;

  const loadingCardMinW = isTablet ? 280 : isSmall ? 180 : 220;
  const loadingCardPadV = isTablet ? 28 : isSmall ? 16 : 20;
  const loadingCardPadH = isTablet ? 32 : isSmall ? 18 : 24;
  const loadingCardR = isTablet ? 22 : isSmall ? 12 : 16;
  const loadingCardGap = isTablet ? 16 : isSmall ? 8 : 12;
  const loadingTextFs = isTablet ? 20 : isSmall ? 13 : 16;

  const voidOverlayPadH = isTablet ? 28 : isSmall ? 14 : 20;
  const voidCardRadius = isTablet ? 28 : isSmall ? 16 : 20;
  const voidCardPad = isTablet ? 22 : isSmall ? 12 : 16;
  const voidCardH = isTablet ? 680 : isSmall ? 460 : 560;
  const voidCardShadH = isTablet ? 12 : isSmall ? 5 : 8;
  const voidCardShadR = isTablet ? 22 : isSmall ? 12 : 16;

  const managerTitleFs = isTablet ? 30 : isSmall ? 19 : 24;
  const managerLabelFs = isTablet ? 17 : isSmall ? 12 : 14;
  const managerLabelMB = isTablet ? 8 : isSmall ? 4 : 6;
  const managerFieldMB = isTablet ? 18 : isSmall ? 10 : 14;
  const managerInputH = isTablet ? 56 : isSmall ? 38 : 45;
  const managerInputR = isTablet ? 12 : isSmall ? 6 : 8;
  const managerInputPH = isTablet ? 16 : isSmall ? 10 : 12;
  const managerInputBW = 2;
  const managerInputFs = isTablet ? 17 : isSmall ? 12 : 14;
  const managerErrFs = isTablet ? 14 : isSmall ? 10 : 12;
  const managerErrMT = isTablet ? 8 : isSmall ? 4 : 6;
  const managerHdrMB = isTablet ? 24 : isSmall ? 12 : 18;
  const managerFootMT = isTablet ? 12 : isSmall ? 5 : 8;

  const presetTitleFs = isTablet ? 28 : isSmall ? 17 : 22;
  const presetBackBtnSz = isTablet ? 42 : isSmall ? 28 : 34;
  const presetBackR = isTablet ? 21 : isSmall ? 14 : 17;
  const presetHdrMB = isTablet ? 18 : isSmall ? 10 : 14;
  const presetListPB = isTablet ? 10 : isSmall ? 4 : 6;
  const presetRowMinH = isTablet ? 60 : isSmall ? 40 : 48;
  const presetRowRadius = isTablet ? 16 : isSmall ? 10 : 12;
  const presetRowPadH = isTablet ? 18 : isSmall ? 10 : 14;
  const presetRowPadV = isTablet ? 16 : isSmall ? 9 : 12;
  const presetRowMB = isTablet ? 14 : isSmall ? 7 : 10;
  const presetRowFs = isTablet ? 17 : isSmall ? 12 : 14;
  const presetRowGap = isTablet ? 14 : isSmall ? 7 : 10;
  const presetEmptyPadV = isTablet ? 30 : isSmall ? 15 : 22;
  const presetEmptyFs = isTablet ? 15 : isSmall ? 11 : 13;

  const metaStackGap = isTablet ? 16 : isSmall ? 8 : 12;
  const metaStackMB = isTablet ? 22 : isSmall ? 12 : 16;
  const metaLabelW = isTablet ? 140 : isSmall ? 90 : 110;
  const metaLabelFs = isTablet ? 17 : isSmall ? 12 : 14;
  const metaValueFs = isTablet ? 20 : isSmall ? 13 : 16;
  const voidQtyBtnSz = isTablet ? 40 : isSmall ? 28 : 34;
  const voidQtyBtnR = isTablet ? 8 : isSmall ? 5 : 6;
  const voidQtyBtnMR = isTablet ? 12 : isSmall ? 6 : 8;
  const fieldLabelFs = isTablet ? 17 : isSmall ? 12 : 14;
  const fieldLabelMB = isTablet ? 8 : isSmall ? 4 : 6;
  const fieldLabelMT = isTablet ? 6 : isSmall ? 2 : 4;
  const textareaH = isTablet ? 130 : isSmall ? 82 : 104;
  const textareaRadius = isTablet ? 12 : isSmall ? 6 : 8;
  const textareaGap = isTablet ? 16 : isSmall ? 8 : 12;
  const textareaTextFs = isTablet ? 16 : isSmall ? 11 : 13;
  const textareaPad = isTablet ? 16 : isSmall ? 8 : 12;
  const textareaBW = 2;
  const presetToggleW = isTablet ? 140 : isSmall ? 90 : 112;
  const presetToggleH = isTablet ? 46 : isSmall ? 28 : 36;
  const presetToggleR = isTablet ? 12 : isSmall ? 6 : 8;
  const presetTogglePH = isTablet ? 14 : isSmall ? 8 : 10;
  const presetToggleFs = isTablet ? 15 : isSmall ? 10 : 12;
  const singleInputH = isTablet ? 56 : isSmall ? 38 : 45;
  const singleInputR = isTablet ? 12 : isSmall ? 6 : 8;
  const singleInputPH = isTablet ? 16 : isSmall ? 10 : 12;
  const singleInputMB = isTablet ? 30 : isSmall ? 18 : 24;
  const singleInputBW = 2;
  const singleInputFs = isTablet ? 17 : isSmall ? 12 : 14;
  const voidFooterPT = isTablet ? 16 : isSmall ? 8 : 12;
  const confirmBtnW = '47%' as const;
  const confirmBtnH = isTablet ? 66 : isSmall ? 44 : 54;
  const confirmBtnR = isTablet ? 12 : isSmall ? 6 : 8;
  const confirmBtnFs = isTablet ? 20 : isSmall ? 13 : 16;
  const confirmIconSz = isTablet ? 30 : isSmall ? 20 : 24;
  const confirmIconMR = isTablet ? 12 : isSmall ? 5 : 8;
  const cancelBtnBW = 2;

  const remarkModalPadH = isTablet ? 28 : isSmall ? 14 : 20;
  const remarkCardRadius = isTablet ? 28 : isSmall ? 16 : 20;
  const remarkCardPad = isTablet ? 22 : isSmall ? 12 : 16;
  const remarkCardH = isTablet ? 400 : isSmall ? 260 : 320;
  const remarkHdrMB = isTablet ? 12 : isSmall ? 5 : 8;
  const remarkHdrTitleFs = isTablet ? 20 : isSmall ? 13 : 16;
  const remarkHdrIconSz = isTablet ? 42 : isSmall ? 28 : 36;
  const remarkInputH = isTablet ? 60 : isSmall ? 38 : 48;
  const remarkInputPH = isTablet ? 16 : isSmall ? 8 : 12;
  const remarkInputFs = isTablet ? 20 : isSmall ? 13 : 16;
  const saveRemarkBtnH = isTablet ? 60 : isSmall ? 38 : 48;
  const saveRemarkR = isTablet ? 12 : isSmall ? 6 : 8;
  const saveRemarkMT = isTablet ? 18 : isSmall ? 10 : 14;
  const saveRemarkFs = isTablet ? 20 : isSmall ? 13 : 16;
  const tagPadH = isTablet ? 14 : isSmall ? 7 : 10;
  const tagPadV = isTablet ? 9 : isSmall ? 4 : 6;
  const tagRadius = isTablet ? 22 : isSmall ? 12 : 16;
  const tagMR = isTablet ? 12 : isSmall ? 6 : 8;
  const tagMB = isTablet ? 12 : isSmall ? 5 : 8;
  const tagFs = isTablet ? 16 : isSmall ? 10 : 13;
  const tagCloseSz = isTablet ? 24 : isSmall ? 14 : 18;
  const tagCloseR = isTablet ? 12 : isSmall ? 7 : 9;
  const tagsWrapGap = isTablet ? 12 : isSmall ? 5 : 8;
  const tagsWrapMB = isTablet ? 16 : isSmall ? 8 : 12;
  const addTagPH = isTablet ? 16 : isSmall ? 8 : 12;
  const addTagPV = isTablet ? 12 : isSmall ? 5 : 8;
  const addTagRadius = isTablet ? 12 : isSmall ? 6 : 8;
  const addTagFs = isTablet ? 15 : isSmall ? 12 : 14;
  const remarkInputRowGap = isTablet ? 14 : isSmall ? 7 : 10;
  const remarkInputRowMT = isTablet ? 4 : isSmall ? 1 : 2;
  const presetsRowPadV = isTablet ? 16 : isSmall ? 8 : 12;
  const presetsRowFs = isTablet ? 17 : isSmall ? 12 : 14;
  const presetsLoaderPadV = isTablet ? 26 : isSmall ? 12 : 18;

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },

    header: {
      height: scale(headerH),
      paddingHorizontal: scale(hPad),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#002748',
    },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flex: 1,
    },
    backButton: {
      width: scale(backBtnSize),
      height: scale(backBtnSize),
      borderRadius: scale(backBtnSize / 2),
      justifyContent: 'center',
      alignItems: 'center',
    },
    backIcon: {
      width: scale(backIconSize),
      height: scale(backIconSize),
      tintColor: '#FFF',
    },
    headerTitle: {
      fontWeight: '500',
      color: '#FFF',
      textAlign: 'center',
      flex: 1,
      fontSize: scale(titleFs),
    },
    newOrderButton: {
      minWidth: scale(96),
      height: scale(newOrderBtnH),
      paddingHorizontal: scale(newOrderBtnPadH),
      borderRadius: newOrderBtnR,
      backgroundColor: 'rgba(255,255,255,0.94)',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: scale(6),
      shadowColor: '#000',
      shadowOpacity: 0.14,
      shadowRadius: scale(8),
      shadowOffset: { width: 0, height: scale(2) },
      elevation: 2,
    },
    newOrderButtonText: {
      color: '#002748',
      fontSize: scale(newOrderFs),
      fontWeight: '700',
      letterSpacing: 0.2,
    },

    toastBanner: {
      position: 'absolute',
      left: scale(toastLR),
      right: scale(toastLR),
      top: scale(toastTop),
      zIndex: 30,
      alignItems: 'center',
    },
    toastBannerText: {
      backgroundColor: 'rgba(0, 39, 72, 0.96)',
      color: '#FFF',
      paddingVertical: scale(toastPadV),
      paddingHorizontal: scale(toastPadH),
      borderRadius: toastRadius,
      overflow: 'hidden',
      fontSize: scale(toastFs),
      fontWeight: '600',
      shadowColor: '#000',
      shadowOpacity: 0.16,
      shadowRadius: scale(8),
      shadowOffset: { width: 0, height: scale(2) },
      elevation: 3,
    },

    fixedInfo: {
      backgroundColor: '#FFF',
      paddingTop: scale(fixedInfoPadT),
      paddingBottom: scale(fixedInfoPadB),
      paddingHorizontal: scale(hPad),
    },
    logoContainer: { alignItems: 'center', marginBottom: scale(logoMB) },
    logo: { width: scale(logoW), height: scale(logoH) },
    tableNumber: {
      fontWeight: '500',
      color: '#000',
      textAlign: 'center',
      marginBottom: scale(tableMB),
      fontSize: scale(tableFs),
    },
    dateText: {
      fontWeight: '300',
      color: '#000',
      textAlign: 'center',
      marginBottom: scale(dateMB),
      fontSize: scale(dateFs),
    },

    content: {
      flexGrow: 1,
      paddingTop: scale(contentPadT),
      paddingBottom: scale(contentPadB),
      paddingHorizontal: scale(hPad),
    },
    billItemBlock: { marginBottom: scale(billItemMB) },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: scale(itemRowMB),
    },
    itemName: {
      fontWeight: '400',
      color: '#000',
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
      marginRight: scale(itemNameMR),
      fontSize: scale(itemFs),
    },
    itemRightBlock: { flexShrink: 0, alignItems: 'flex-end' },
    itemPrice: {
      fontWeight: '400',
      color: '#000',
      flexShrink: 0,
      textAlign: 'right',
      marginBottom: scale(itemPriceMB),
      fontSize: scale(itemFs),
    },
    qtyPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(qtyPillGap),
    },
    qtyText: {
      fontWeight: '500',
      color: '#000',
      minWidth: scale(qtyMinW),
      textAlign: 'center',
      fontSize: scale(qtyFs),
    },
    qtyBtn: {
      width: scale(qtyBtnSize),
      height: scale(qtyBtnSize),
      borderRadius: scale(qtyBtnRadius),
      backgroundColor: 'rgba(0,0,0,0.08)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    inlineVoidActionBtn: {
      alignSelf: 'flex-end',
      marginTop: scale(inlineVoidMT),
      marginBottom: scale(inlineVoidMB),
      backgroundColor: '#8D9ED4',
      borderRadius: scale(inlineVoidRadius),
      paddingHorizontal: scale(inlineVoidPadH),
      paddingVertical: scale(inlineVoidPadV),
    },
    inlineVoidActionText: {
      color: '#FFF',
      fontSize: scale(inlineVoidFs),
      fontWeight: '600',
    },
    billingRemarkRow: {
      alignSelf: 'flex-start',
      marginTop: scale(remarkMT),
      maxWidth: '100%',
    },
    billingRemarkText: {
      color: '#555',
      lineHeight: scale(18),
      textAlign: 'left',
      fontSize: scale(remarkTextFs),
    },
    itemDivider: {
      height: 1,
      backgroundColor: 'rgba(0,0,0,0.10)',
      marginTop: scale(itemDivMT),
    },
    addMoreWrap: {
      marginTop: scale(addMoreMT),
      marginBottom: scale(addMoreMB),
    },
    addMoreBtn: {
      height: scale(addMoreH),
      borderRadius: scale(addMoreRadius),
      borderWidth: addMoreBW,
      borderColor: '#002748',
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    addMoreText: {
      color: '#002748',
      fontSize: scale(addMoreFs),
      fontWeight: '700',
    },

    footer: {
      backgroundColor: '#FFF',
      paddingTop: scale(footerPadT),
      paddingBottom: scale(footerPadB) + bottomInset,
      paddingHorizontal: scale(hPad),
    },
    topDivider: {
      height: 1,
      backgroundColor: 'rgba(0,0,0,0.15)',
      marginBottom: scale(dividerMB),
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: scale(totalMT),
    },
    totalLabel: { fontWeight: '500', color: '#000', fontSize: scale(totalFs) },
    totalValue: { fontWeight: '500', color: '#000', fontSize: scale(totalFs) },
    printBtn: {
      height: scale(printBtnH),
      borderRadius: scale(printBtnRadius),
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: scale(printBtnGap),
      marginTop: scale(12),
    },
    printText: { color: '#FFF', fontWeight: '700', fontSize: scale(printFs) },

    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.25)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingCard: {
      minWidth: scale(loadingCardMinW),
      paddingVertical: scale(loadingCardPadV),
      paddingHorizontal: scale(loadingCardPadH),
      borderRadius: scale(loadingCardR),
      backgroundColor: '#FFF',
      alignItems: 'center',
      gap: scale(loadingCardGap),
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: scale(12),
      shadowOffset: { width: 0, height: scale(4) },
      elevation: 5,
    },
    loadingText: {
      color: '#002748',
      fontSize: scale(loadingTextFs),
      fontWeight: '600',
      textAlign: 'center',
    },

    voidModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: scale(voidOverlayPadH),
    },
    voidCard: {
      width: '90%',
      maxWidth: scale(560),
      height: scale(voidCardH),
      borderRadius: scale(voidCardRadius),
      backgroundColor: '#FFF',
      padding: scale(voidCardPad),
      overflow: 'hidden',
      elevation: 18,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: scale(voidCardShadH) },
      shadowOpacity: 0.22,
      shadowRadius: scale(voidCardShadR),
    },
    voidCardBody: { flex: 1 },
    voidCardScroll: { flex: 1 },
    voidCardContent: { flexGrow: 1, paddingBottom: scale(8) },
    voidCardFooter: { paddingTop: scale(voidFooterPT) },

    managerAuthCardBody: { flex: 1, paddingTop: scale(4) },
    managerAuthHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: scale(managerHdrMB),
    },
    managerAuthTitle: {
      flex: 1,
      color: '#000',
      fontSize: scale(managerTitleFs),
      fontWeight: '600',
    },
    managerAuthFieldGroup: { marginBottom: scale(managerFieldMB) },
    managerAuthLabel: {
      opacity: 0.75,
      color: 'rgba(0, 0, 0, 0.80)',
      fontSize: scale(managerLabelFs),
      fontWeight: '500',
      marginBottom: scale(managerLabelMB),
    },
    managerAuthInputBox: {
      width: '100%',
      height: scale(managerInputH),
      borderRadius: scale(managerInputR),
      borderWidth: managerInputBW,
      borderColor: '#0062AA',
      paddingHorizontal: scale(managerInputPH),
      justifyContent: 'center',
    },
    managerAuthInputBoxError: { borderColor: '#FF4D4D' },
    managerAuthInput: {
      flex: 1,
      color: 'black',
      fontSize: scale(managerInputFs),
      fontWeight: '500',
      padding: 0,
      margin: 0,
    },
    managerAuthErrorText: {
      marginTop: scale(managerErrMT),
      color: '#FF4D4D',
      fontSize: scale(managerErrFs),
      fontWeight: '500',
    },
    managerAuthFooter: {
      marginTop: scale(managerFootMT),
      alignItems: 'center',
    },

    presetListCardBody: { flex: 1, paddingTop: scale(4) },
    presetListHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: scale(presetHdrMB),
    },
    presetBackButton: {
      width: scale(presetBackBtnSz),
      height: scale(presetBackBtnSz),
      borderRadius: scale(presetBackR),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 39, 72, 0.08)',
    },
    presetBackButtonSpacer: {
      width: scale(presetBackBtnSz),
      height: scale(presetBackBtnSz),
    },
    presetListTitle: {
      flex: 1,
      color: '#000',
      fontSize: scale(presetTitleFs),
      fontWeight: '600',
      textAlign: 'center',
    },
    presetListContent: { paddingBottom: scale(presetListPB) },
    presetListRow: {
      minHeight: scale(presetRowMinH),
      borderRadius: scale(presetRowRadius),
      backgroundColor: '#F4F7FB',
      borderWidth: 1,
      borderColor: 'rgba(0, 98, 170, 0.12)',
      paddingHorizontal: scale(presetRowPadH),
      paddingVertical: scale(presetRowPadV),
      marginBottom: scale(presetRowMB),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: scale(presetRowGap),
    },
    presetListRowText: {
      flex: 1,
      color: '#002748',
      fontSize: scale(presetRowFs),
      fontWeight: '500',
    },
    presetListEmptyWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: scale(presetEmptyPadV),
    },
    presetListEmptyText: {
      color: 'rgba(0, 39, 72, 0.7)',
      fontSize: scale(presetEmptyFs),
      fontWeight: '500',
      textAlign: 'center',
    },

    metaSpecificationsStack: {
      gap: scale(metaStackGap),
      marginBottom: scale(metaStackMB),
    },
    metaRowInline: { flexDirection: 'row', alignItems: 'center' },
    metaLabelStyle: {
      opacity: 0.75,
      color: 'rgba(0, 0, 0, 0.80)',
      fontSize: scale(metaLabelFs),
      fontWeight: '500',
      width: scale(metaLabelW),
    },
    metaValueStyle: {
      color: 'black',
      fontSize: scale(metaValueFs),
      fontWeight: '500',
    },
    voidQtyBtn: {
      width: scale(voidQtyBtnSz),
      height: scale(voidQtyBtnSz),
      borderRadius: scale(voidQtyBtnR),
      backgroundColor: 'rgba(0,0,0,0.08)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: scale(voidQtyBtnMR),
    },
    inputFieldLabelOutside: {
      opacity: 0.75,
      color: 'rgba(0, 0, 0, 0.80)',
      fontSize: scale(fieldLabelFs),
      fontWeight: '500',
      marginBottom: scale(fieldLabelMB),
      marginTop: scale(fieldLabelMT),
    },
    textareaWrapperContainer: {
      flexDirection: 'row',
      width: '100%',
      gap: scale(textareaGap),
      alignItems: 'flex-start',
      marginBottom: scale(14),
    },
    textAreaInputBox: {
      flex: 1,
      height: scale(textareaH),
      borderRadius: scale(textareaRadius),
      borderWidth: textareaBW,
      borderColor: '#0062AA',
      padding: scale(textareaPad),
      justifyContent: 'flex-start',
    },
    textAreaTextInput: {
      flex: 1,
      color: 'black',
      fontSize: scale(textareaTextFs),
      fontWeight: '500',
      textAlignVertical: 'top',
      padding: 0,
      margin: 0,
    },
    presetToggleButton: {
      alignSelf: 'flex-start',
      minWidth: scale(presetToggleW),
      height: scale(presetToggleH),
      borderRadius: scale(presetToggleR),
      backgroundColor: '#8D9ED4',
      paddingHorizontal: scale(presetTogglePH),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    presetToggleButtonText: {
      color: '#FFF',
      fontSize: scale(presetToggleFs),
      fontWeight: '600',
    },
    singleLineInputBoxWrapper: {
      width: '100%',
      marginBottom: scale(singleInputMB),
    },
    singleLineInputField: {
      width: '100%',
      height: scale(singleInputH),
      borderRadius: scale(singleInputR),
      borderWidth: singleInputBW,
      borderColor: '#0062AA',
      paddingHorizontal: scale(singleInputPH),
      color: 'black',
      fontSize: scale(singleInputFs),
      fontWeight: '500',
    },
    ctaButtonControlRowGroup: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
      marginBottom: 0,
    },
    confirmActionButtonPrimary: {
      width: confirmBtnW,
      height: scale(confirmBtnH),
      backgroundColor: '#8D9ED4',
      borderRadius: scale(confirmBtnR),
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
    },
    confirmIconWrap: {
      width: scale(confirmIconSz),
      height: scale(confirmIconSz),
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: scale(confirmIconMR),
    },
    confirmButtonLabelInlineText: {
      color: 'white',
      fontSize: scale(confirmBtnFs),
      fontWeight: '500',
    },
    cancelActionButtonOutlineSecondary: {
      width: confirmBtnW,
      height: scale(confirmBtnH),
      borderRadius: scale(confirmBtnR),
      borderWidth: cancelBtnBW,
      borderColor: '#8D9ED4',
      justifyContent: 'center',
      alignItems: 'center',
    },
    cancelButtonLabelInlineText: {
      opacity: 0.5,
      color: 'black',
      fontSize: scale(confirmBtnFs),
      fontWeight: '500',
    },

    remarkModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: scale(remarkModalPadH),
    },
    remarkCard: {
      width: '90%',
      maxWidth: scale(560),
      height: scale(remarkCardH),
      borderRadius: scale(remarkCardRadius),
      backgroundColor: '#fff',
      padding: scale(remarkCardPad),
      overflow: 'hidden',
      elevation: 18,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: scale(8) },
      shadowOpacity: 0.22,
      shadowRadius: scale(16),
    },
    remarkCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: scale(remarkHdrMB),
    },
    remarkCardHeaderTitle: {
      fontSize: scale(remarkHdrTitleFs),
      fontWeight: '800',
      color: '#0F172A',
      flex: 1,
      textAlign: 'center',
    },
    remarkHeaderIconBtn: {
      width: scale(remarkHdrIconSz),
      height: scale(remarkHdrIconSz),
      alignItems: 'center',
      justifyContent: 'center',
    },
    remarkCardBody: { flex: 1 },
    remarkScrollArea: { flex: 1 },
    remarkCardContent: { paddingBottom: scale(4) },
    presetsDivider: {
      height: 1,
      backgroundColor: '#E2E8F0',
      marginBottom: scale(8),
    },
    presetsLoaderWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: scale(presetsLoaderPadV),
    },
    remarkInput: {
      height: scale(remarkInputH),
      paddingHorizontal: scale(remarkInputPH),
      fontSize: scale(remarkInputFs),
      color: '#000',
      textAlignVertical: 'center',
      flex: 1,
    },
    saveRemarkBtn: {
      marginTop: scale(saveRemarkMT),
      height: scale(saveRemarkBtnH),
      borderRadius: scale(saveRemarkR),
      backgroundColor: '#8D9ED4',
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveRemarkText: {
      color: '#FFF',
      fontSize: scale(saveRemarkFs),
      fontWeight: '600',
    },
    tagsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: scale(tagsWrapGap),
      marginBottom: scale(tagsWrapMB),
    },
    tagBadge: {
      backgroundColor: '#0062AA',
      paddingHorizontal: scale(tagPadH),
      paddingVertical: scale(tagPadV),
      borderRadius: scale(tagRadius),
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: scale(tagMR),
      marginBottom: scale(tagMB),
    },
    tagLabelBtn: { paddingRight: scale(4) },
    tagText: {
      color: '#FFF',
      fontSize: scale(tagFs),
      marginRight: scale(6),
    },
    tagClose: {
      width: scale(tagCloseSz),
      height: scale(tagCloseSz),
      borderRadius: scale(tagCloseR),
      backgroundColor: 'rgba(0,0,0,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    remarkInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(remarkInputRowGap),
      marginTop: scale(remarkInputRowMT),
    },
    remarkInputShell: { flex: 1, position: 'relative' },
    remarkDropdownIconBtn: {
      position: 'absolute',
      right: scale(8),
      top: 0,
      bottom: 0,
      width: scale(36),
      alignItems: 'center',
      justifyContent: 'center',
    },
    addTagBtn: {
      backgroundColor: '#002748',
      paddingHorizontal: scale(addTagPH),
      paddingVertical: scale(addTagPV),
      borderRadius: scale(addTagRadius),
    },
    addTagText: {
      color: '#FFF',
      fontWeight: '700',
      fontSize: scale(addTagFs),
    },
    presetsListContent: { paddingVertical: scale(2) },
    presetsRow: {
      paddingVertical: scale(presetsRowPadV),
      borderBottomWidth: 1,
      borderBottomColor: '#F4F4F4',
    },
    presetsRowText: {
      color: '#003366',
      fontWeight: '600',
      fontSize: scale(presetsRowFs),
    },

    billingSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: scale(18),
      marginBottom: scale(4),
      paddingHorizontal: scale(4),
    },
    billingSectionHeaderText: {
      fontSize: scale(14),
      fontWeight: '700',
      color: '#186cb1',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginRight: scale(8),
      flexShrink: 0,
    },
    billingSectionHeaderLine: {
      flex: 1,
      height: 3,
      backgroundColor: 'rgba(0,39,72,0.12)',
    },
  });
}