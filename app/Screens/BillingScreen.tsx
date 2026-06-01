import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View
} from 'react-native';
import { apiClient } from '../../services/api';
import { CartItem, useCartStore } from '../../services/cartStore';
import { useOrderStore } from '../../services/orderStore';

type VoidPresetItem = {
  VoidRmkId?: string | number;
  VoidDescription?: string;
};

export default function BillingScreen() {
  const router = useRouter();
  const { tableName, localPax, foreignPax, floor } = useLocalSearchParams<{
    tableName?: string;
    localPax?: string;
    foreignPax?: string;
    floor?: string;
  }>();
  
  const { width, height } = useWindowDimensions();

  // 2. Read live data and actions straight from Zustand store
  const cartItems = useCartStore((state) => state.cartItems);
  const updateQuantityInCart = useCartStore((state) => state.updateQuantity);
  const setCartItemsInStore = useCartStore((state) => state.setCartItems);
  const saveCurrentOrderToHold = useCartStore((state) => state.saveCurrentOrderToHold);
  const clearHeldOrderForTable = useCartStore((state) => state.clearHeldOrderForTable);

  // If we have a lastConfirmedOrder (set by Cart on confirm), prefer that snapshot
  const lastConfirmedOrder = useOrderStore((s) => s.lastConfirmedOrder);
  const displayedItems = lastConfirmedOrder
    ? lastConfirmedOrder.items.map((it) => ({
        menuItemCode: it.menuItemCode,
        menuItmDes: it.menuItmDes ?? '',
        salesPrice: it.salesPrice ?? 0,
        quantity: it.quantity,
        itemRemarks: it.itemRemarks ?? '',
      }))
    : cartItems;

  const [isVoidModalVisible, setIsVoidModalVisible] = useState(false);
  const [activeVoidItem, setActiveVoidItem] = useState<CartItem | null>(null);
  const [pendingVoidItemId, setPendingVoidItemId] = useState<string | null>(null);
  const [voidQuantity, setVoidQuantity] = useState(1);
  const [voidRemark, setVoidRemark] = useState('');
  const [managerName, setManagerName] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [isManagerAuthView, setIsManagerAuthView] = useState(false);
  const [managerIdError, setManagerIdError] = useState('');
  const [managerPasswordError, setManagerPasswordError] = useState('');
  const [isPresetListView, setIsPresetListView] = useState(false);
  const [voidPresetItems, setVoidPresetItems] = useState<VoidPresetItem[]>([]);
  const [billingHasChanges, setBillingHasChanges] = useState(false);
  const [isHydratingBill, setIsHydratingBill] = useState(false);
  const [pendingAdditions, setPendingAdditions] = useState<Record<string, number>>({});
  const [voidMetadata, setVoidMetadata] = useState<Record<string, { remark: string; manager: string }>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const originalQuantitiesRef = useRef<Record<string, number>>({});
  const originalTableNoRef = useRef('');
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const upsertVoidMetadata = useCallback((menuItemCode: string, remark: string, manager: string) => {
    setVoidMetadata((current) => ({
      ...current,
      [menuItemCode]: {
        remark: String(remark || '').trim(),
        manager: String(manager || '').trim(),
      },
    }));
  }, []);

  useEffect(() => {
    if (!isPresetListView) return;

    let isMounted = true;
    void (async () => {
      try {
        const response = await apiClient.getVoidPresets();
        if (!isMounted) return;
        if (response.ok && Array.isArray(response.data)) {
          setVoidPresetItems(response.data);
        } else {
          setVoidPresetItems([]);
        }
      } catch (error) {
        if (isMounted) setVoidPresetItems([]);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isPresetListView]);

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

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const clearPendingChanges = () => {
    setPendingAdditions({});
    setBillingHasChanges(false);
  };

  const buildHeldOrderSnapshot = useCallback(() => {
    const tableNo = String(lastConfirmedOrder?.tableNo ?? tableName ?? '').trim();
    const tableGrpId = String(lastConfirmedOrder?.tableGrpId ?? '').trim();
    const userId = String(lastConfirmedOrder?.userId ?? 'SYSTEM').trim();
    const lPax = Number(lastConfirmedOrder?.lPax ?? Number(localPax ?? 0)) || 0;
    const fPax = Number(lastConfirmedOrder?.fPax ?? Number(foreignPax ?? 0)) || 0;
    const computedGrossTotal = displayedItems.reduce((sum: number, item: any) => {
      const price = Number(item.salesPrice ?? 0) || 0;
      const qty = Number(item.quantity ?? 0) || 0;
      return sum + price * qty;
    }, 0);

    return {
      tableNo,
      tableGrpId,
      userId,
      lPax,
      fPax,
      grossTotal: computedGrossTotal,
      items: displayedItems.map((item: any) => ({
        menuItemCode: String(item.menuItemCode ?? '').trim(),
        menuItmDes: String(item.menuItmDes ?? '').trim(),
        salesPrice: Number(item.salesPrice ?? 0) || 0,
        quantity: Number(item.quantity ?? 0) || 0,
        itemRemarks: String(item.itemRemarks ?? '').trim(),
      })),
      itemRemarksByCode: displayedItems.reduce<Record<string, string>>((acc, item: any) => {
        acc[String(item.menuItemCode ?? '').trim()] = String(item.itemRemarks ?? '').trim();
        return acc;
      }, {}),
      voidMetadata,
      pendingAdditions,
      billingHasChanges,
    };
  }, [billingHasChanges, displayedItems, foreignPax, lastConfirmedOrder?.fPax, lastConfirmedOrder?.lPax, lastConfirmedOrder?.tableGrpId, lastConfirmedOrder?.tableNo, lastConfirmedOrder?.userId, localPax, pendingAdditions, tableName, voidMetadata]);

  const handleNewOrder = useCallback(() => {
    if (!displayedItems.length) {
      showToast('No active order to save');
      return;
    }

    const tableNumber = String(lastConfirmedOrder?.tableNo ?? tableName ?? '').trim();
    if (!tableNumber) {
      Alert.alert('Table required', 'Please select or enter a table number before saving the order.');
      return;
    }

    const saved = saveCurrentOrderToHold(tableNumber, {
      ...buildHeldOrderSnapshot(),
      savedAt: new Date().toISOString(),
    });

    if (!saved) {
      Alert.alert('Save failed', 'Unable to save the current order right now.');
      return;
    }

    clearPendingChanges();
    setVoidMetadata({});
    resetVoidState();
    originalQuantitiesRef.current = {};
    originalTableNoRef.current = '';
    setBillingHasChanges(false);
    showToast('Order saved successfully');
    router.replace('/Screens/operation');
  }, [buildHeldOrderSnapshot, clearPendingChanges, displayedItems.length, resetVoidState, saveCurrentOrderToHold, showToast]);

  const activeTableNo = String(lastConfirmedOrder?.tableNo ?? tableName ?? '').trim();

  useEffect(() => {
    if (!activeTableNo) {
      originalQuantitiesRef.current = {};
      originalTableNoRef.current = '';
      return;
    }

    const hasBaseline = originalTableNoRef.current === activeTableNo && Object.keys(originalQuantitiesRef.current).length > 0;
    if (hasBaseline) return;

    const sourceItems = lastConfirmedOrder?.items?.length ? lastConfirmedOrder.items : cartItems;
    if (!sourceItems.length) return;

    originalQuantitiesRef.current = sourceItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.menuItemCode] = Number(item.quantity ?? 0) || 0;
      return acc;
    }, {});
    originalTableNoRef.current = activeTableNo;
  }, [activeTableNo, cartItems, lastConfirmedOrder?.items]);

  const getBaselineQuantity = useCallback((menuItemCode: string) => {
    return Number(originalQuantitiesRef.current[menuItemCode] ?? 0) || 0;
  }, []);

  const hasQuantityChangesFromBaseline = useCallback(() => {
    const baseline = originalQuantitiesRef.current;
    const currentMap = displayedItems.reduce<Record<string, number>>((acc, item: any) => {
      acc[item.menuItemCode] = Number(item.quantity ?? 0) || 0;
      return acc;
    }, {});

    const allCodes = new Set<string>([
      ...Object.keys(baseline),
      ...Object.keys(currentMap),
    ]);

    for (const code of allCodes) {
      const baseQty = Number(baseline[code] ?? 0) || 0;
      const currentQty = Number(currentMap[code] ?? 0) || 0;
      if (baseQty !== currentQty) return true;
    }

    return false;
  }, [displayedItems]);

  useEffect(() => {
    setBillingHasChanges(hasQuantityChangesFromBaseline());
  }, [hasQuantityChangesFromBaseline]);

  const rollbackItemToBaseline = useCallback((menuItemCode: string) => {
    const baselineQty = getBaselineQuantity(menuItemCode);

    if (lastConfirmedOrder) {
      const exists = lastConfirmedOrder.items.some((item) => item.menuItemCode === menuItemCode);
      if (!exists) return;

      const rolledBack = {
        ...lastConfirmedOrder,
        items: lastConfirmedOrder.items
          .map((item) =>
            item.menuItemCode === menuItemCode ? { ...item, quantity: baselineQty } : item
          )
          .filter((item) => Number(item.quantity ?? 0) > 0),
      };
      useOrderStore.getState().setLastConfirmedOrder(rolledBack);
      return;
    }

    const exists = cartItems.some((item) => item.menuItemCode === menuItemCode);
    if (!exists) return;

    const rolledBack = cartItems
      .map((item) =>
        item.menuItemCode === menuItemCode ? { ...item, quantity: baselineQty } : item
      )
      .filter((item) => Number(item.quantity ?? 0) > 0);
    setCartItemsInStore(rolledBack);
    deleteVoidMetadata(menuItemCode);
  }, [cartItems, deleteVoidMetadata, getBaselineQuantity, lastConfirmedOrder, setCartItemsInStore]);

  const rollbackAllToBaseline = useCallback(() => {
    const baseline = originalQuantitiesRef.current;

    if (lastConfirmedOrder) {
      const rolledBack = {
        ...lastConfirmedOrder,
        items: lastConfirmedOrder.items
          .map((item) => ({
            ...item,
            quantity: Number(baseline[item.menuItemCode] ?? 0) || 0,
          }))
          .filter((item) => Number(item.quantity ?? 0) > 0),
      };
      useOrderStore.getState().setLastConfirmedOrder(rolledBack);
    } else {
      const rolledBack = cartItems
        .map((item) => ({
          ...item,
          quantity: Number(baseline[item.menuItemCode] ?? 0) || 0,
        }))
        .filter((item) => Number(item.quantity ?? 0) > 0);
      setCartItemsInStore(rolledBack);
    }

    clearPendingChanges();
    setVoidMetadata({});
    resetVoidState();
  }, [cartItems, lastConfirmedOrder, resetVoidState, setCartItemsInStore]);

  const adjustPendingAddition = (menuItemCode: string, delta: number) => {
    setPendingAdditions((current) => {
      const next = { ...current };
      const nextValue = Math.max(0, (next[menuItemCode] ?? 0) + delta);

      if (nextValue > 0) {
        next[menuItemCode] = nextValue;
      } else {
        delete next[menuItemCode];
      }
      return next;
    });
  };

  const voidRemarkPresets = [
    'No Spicy',
    'Extra Spicy',
    'Less Spicy',
    'No Onion',
    'No Garlic',
    'Take Away',
  ];

  const isTablet = width >= 600;
  const isSmall = height < 700;

  const hPad = isTablet ? 40 : 16;
  const headerH = isTablet ? 110 : isSmall ? 80 : 150;
  const backIconSize = isTablet ? 22 : isSmall ? 14 : 34;
  const backBtnSize = isTablet ? 40 : isSmall ? 30 : 44;
  const titleFs = isTablet ? 28 : isSmall ? 20 : 24;
  const logoW = isTablet ? 200 : isSmall ? 120 : 159;
  const logoH = isTablet ? 76 : isSmall ? 44 : 60;
  const tableFs = isTablet ? 18 : isSmall ? 13 : 16;
  const dateFs = isTablet ? 16 : isSmall ? 11 : 14;
  const itemFs = isTablet ? 18 : isSmall ? 13 : 16;
  const totalFs = isTablet ? 18 : isSmall ? 14 : 16;
  const btnH = isTablet ? 60 : isSmall ? 42 : 48;
  const btnFs = isTablet ? 20 : isSmall ? 14 : 16;
  const qtySize = isTablet ? 20 : isSmall ? 14 : 16;
  const qtyBtnSize = isTablet ? 28 : isSmall ? 20 : 24;

  // Simplified back handler: do not fetch or mutate store here.
  const goBack = useCallback(() => {
    if (hasQuantityChangesFromBaseline()) {
      rollbackAllToBaseline();
    }
    router.back();
  }, [hasQuantityChangesFromBaseline, rollbackAllToBaseline, router]);

  useEffect(() => {
    const handler = () => {
      goBack();
      return true; // indicate we've handled the back press
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => subscription.remove();
  }, [goBack]);

  const openVoidModal = (menuItemCode: string, editOnly = false) => {
    const item = displayedItems.find((entry: any) => entry.menuItemCode === menuItemCode) ?? null;
    if (!item) return;

    const existingMeta = voidMetadata[menuItemCode] ?? { remark: '', manager: '' };
    const prefilledRemark = existingMeta.remark || (editOnly ? (item.itemRemarks ?? '') : '');
    const prefilledManager = existingMeta.manager || '';

    setActiveVoidItem(item);
    // If opening for editing an existing remark, do not default to removing quantity
    if (editOnly) {
      setVoidQuantity(0);
      setVoidRemark(prefilledRemark);
    } else {
      setVoidQuantity(1);
      setVoidRemark(prefilledRemark);
    }
    setManagerName(prefilledManager);
    setManagerPassword('');
    setIsManagerAuthView(false);
    setIsVoidModalVisible(true);
  };

  // 3. Handles when '-' is pressed on an item row
  const handleVoidPreview = (menuItemCode: string) => {
    const item = displayedItems.find((entry: any) => entry.menuItemCode === menuItemCode) ?? null;
    if (!item) return;
    // If already staging a void for the same item, increment the staged void quantity
    if (pendingVoidItemId === menuItemCode && activeVoidItem && activeVoidItem.quantity) {
      const current = voidQuantity || 1;
      const maxQ = activeVoidItem.quantity;
      setVoidQuantity(Math.min(maxQ, current + 1));
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

  // 4. Triggered when the manager inputs details and clicks Confirm inside Void Modal
  const handleVoidConfirm = () => {
    if (!activeVoidItem) return;

    if (isManagerAuthView) {
      const trimmedManagerUsername = String(managerName || '').trim();
      const trimmedManagerPassword = String(managerPassword || '').trim();

      const nextManagerIdError = trimmedManagerUsername ? '' : 'Manager username is required!';
      const nextManagerPasswordError = trimmedManagerPassword ? '' : 'Password is required!';

      setManagerIdError(nextManagerIdError);
      setManagerPasswordError(nextManagerPasswordError);

      if (nextManagerIdError || nextManagerPasswordError) {
        return;
      }
    }

    const itemCode = activeVoidItem.menuItemCode;
    const baselineQty = getBaselineQuantity(itemCode);
    const currentItem = displayedItems.find((it: any) => it.menuItemCode === itemCode);
    const currentQty = Number(currentItem?.quantity ?? 0) || 0;
    const isTrueVoidReduction = currentQty < baselineQty;
    const trimmedRemark = String(voidRemark || '').trim();
    const trimmedManager = String(managerName || '').trim();

    if (isTrueVoidReduction && (!trimmedRemark || !trimmedManager)) {
      Alert.alert('Validation Error', 'Void Remark and Manager Username are required');
      return;
    }

    // Persist per-item metadata to avoid global overwrite across multiple void lines.
    if (trimmedRemark || trimmedManager) {
      upsertVoidMetadata(itemCode, trimmedRemark, trimmedManager);
    }

    // For edit-only remark updates, reflect immediately in local snapshot for UX parity.
    if (lastConfirmedOrder && !isTrueVoidReduction) {
      const updated = {
        ...lastConfirmedOrder,
        items: lastConfirmedOrder.items.map((it) =>
          it.menuItemCode === itemCode
            ? { ...it, itemRemarks: trimmedRemark || it.itemRemarks }
            : it
        ),
      };
      useOrderStore.getState().setLastConfirmedOrder(updated);
    }

    resetVoidState();
  };

  // Update quantity either in the confirmed snapshot or in the live cart store
  const updateDisplayedQuantity = (menuItemCode: string, delta: number) => {
    if (lastConfirmedOrder) {
      const currentItem = lastConfirmedOrder.items.find((it) => it.menuItemCode === menuItemCode);
      if (!currentItem) return;

      const originalQuantity = originalQuantitiesRef.current[menuItemCode] ?? (Number(currentItem.quantity ?? 0) || 0);
      const nextQuantity = Math.max(0, Number(currentItem.quantity ?? 0) + delta);
      const shouldOpenVoidRemark = delta < 0 && nextQuantity < originalQuantity;

      const tableNo = lastConfirmedOrder.tableNo;
      const tableGrpId = lastConfirmedOrder.tableGrpId ?? '';
      const lPax = Number(lastConfirmedOrder.lPax ?? Number(localPax ?? 0));
      const fPax = Number(lastConfirmedOrder.fPax ?? Number(foreignPax ?? 0));

      if (delta > 0) {
        useOrderStore.getState().setLastConfirmedOrder((current) => {
          if (!current) return current;

          return {
            ...current,
            items: current.items.map((it) =>
              it.menuItemCode === menuItemCode
                ? { ...it, quantity: Math.max(0, Math.floor(it.quantity + delta)) }
                : it
            ),
          };
        });
        adjustPendingAddition(menuItemCode, delta);
        return;
      }

      useOrderStore.getState().setLastConfirmedOrder((current) => {
        if (!current) return current;

        return {
          ...current,
          items: current.items.map((it) =>
            it.menuItemCode === menuItemCode
              ? { ...it, quantity: Math.max(0, Math.floor(it.quantity + delta)) }
              : it
          ),
        };
      });
      adjustPendingAddition(menuItemCode, delta);
      // Only treat it as a void when the quantity drops below the original DB baseline.
      const updatedItem = useOrderStore.getState().lastConfirmedOrder?.items.find((it) => it.menuItemCode === menuItemCode);
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
      // live-cart: update store and show remark action when decrementing
      const cartItem = cartItems.find((c) => c.menuItemCode === menuItemCode) ?? null;
      const originalQuantity = originalQuantitiesRef.current[menuItemCode] ?? (Number(cartItem?.quantity ?? 0) || 0);
      const nextQuantity = Math.max(0, Number(cartItem?.quantity ?? 0) + delta);
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

  // 5. Calculate gross total from the same items rendered on the billing screen
  const grossTotal = displayedItems.reduce((sum, item: any) => {
    const price = Number(item.salesPrice ?? 0) || 0;
    const qty = Number(item.quantity ?? 0) || 0;
    return sum + price * qty;
  }, 0);

  const footerButtonLabel = billingHasChanges ? 'Confirm Changes' : 'Print';
  const footerButtonBackgroundColor = billingHasChanges ? '#D97706' : '#8D9ED4';

  const handleFooterAction = () => {
    if (billingHasChanges) {
      void (async () => {
        try {
          const voidCandidates = displayedItems.filter((item: any) => {
            const baselineQty = getBaselineQuantity(item.menuItemCode);
            const currentQty = Number(item.quantity ?? 0) || 0;
            return currentQty < baselineQty;
          });

          const voidCandidateMissingMeta = voidCandidates.some((candidate: any) => {
            const itemMeta = voidMetadata[candidate.menuItemCode] || { remark: '', manager: '' };
            return !String(itemMeta.remark).trim() || !String(itemMeta.manager).trim();
          });

          if (voidCandidateMissingMeta) {
            Alert.alert('Validation Error', 'Void Remark and Manager Approval are required');
            return;
          }

          const pendingEntries = Object.entries(pendingAdditions).filter(([, qty]) => qty > 0);
          if (pendingEntries.length === 0 && voidCandidates.length === 0) {
            clearPendingChanges();
            Alert.alert('Confirmed', 'No pending changes to save.');
            return;
          }

          const tableNo = lastConfirmedOrder?.tableNo ?? String(tableName ?? '').trim();
          const tableGrpId = lastConfirmedOrder?.tableGrpId ?? '';
          const lPax = Number(lastConfirmedOrder?.lPax ?? Number(localPax ?? 0));
          const fPax = Number(lastConfirmedOrder?.fPax ?? Number(foreignPax ?? 0));
          const userId = lastConfirmedOrder?.userId ?? 'SYSTEM';
          const addBillingItem = apiClient.addBillingItem;

          if (typeof addBillingItem !== 'function') {
            throw new Error('Billing sync API is unavailable.');
          }

          const requests = pendingEntries.map(([menuItemCode, qty]) => {
            const currentItem = displayedItems.find((item: any) => item.menuItemCode === menuItemCode);
            if (!currentItem) {
              throw new Error(`Missing item details for ${menuItemCode}`);
            }

            return addBillingItem({
              tableNo,
              itemCode: menuItemCode,
              qty,
              salesPrice: Number(currentItem.salesPrice ?? 0) || 0,
              itemRemarks: currentItem.itemRemarks ?? '',
              userId,
              tableGrpId,
              lPax,
              fPax,
              mgrId: String(voidMetadata[menuItemCode]?.manager ?? managerName).trim(),
            });
          });

          const voidRequests = voidCandidates.map((item: any) => {
            const baselineQty = getBaselineQuantity(item.menuItemCode);
            const currentQty = Number(item.quantity ?? 0) || 0;
            const qtyDifference = Math.max(0, baselineQty - currentQty);
            const itemMeta = voidMetadata[item.menuItemCode] || { remark: '', manager: '' };

            if (qtyDifference <= 0) {
              return Promise.resolve({ ok: true, data: {} });
            }

            return apiClient.removeBillingItem({
              tableNo,
              itemCode: item.menuItemCode,
              qtyDifference,
              salesPrice: Number(item.salesPrice ?? 0) || 0,
              itemRemarks: '',
              voidRemark: String(itemMeta.remark).trim(),
              userId,
              tableGrpId,
              lPax,
              fPax,
              mgrId: String(itemMeta.manager).trim(),
            });
          });

          const results = await Promise.all([...requests, ...voidRequests]);
          const failed = results.find((result) => !result.ok);
          if (failed) {
            const serverMsg = failed.data && (failed.data.message || JSON.stringify(failed.data));
            throw new Error(serverMsg || 'Failed to save billing changes');
          }

          // After successful save, current quantities become the new baseline.
          originalQuantitiesRef.current = displayedItems.reduce<Record<string, number>>((acc, item: any) => {
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
          const message = error instanceof Error ? error.message : 'Failed to save billing changes';
          Alert.alert('Save failed', message);
        }
      })();
      return;
    }

    (async () => {
      try {
        if (hasQuantityChangesFromBaseline()) {
          rollbackAllToBaseline();
        }
        const tableNo = lastConfirmedOrder?.tableNo ?? String(tableName ?? '').trim();

        // Try to call a server-side finalize/print endpoint if available.
        let result: any = { ok: true, data: {} };
        if (typeof (apiClient as any).finalizeBill === 'function') {
          result = await (apiClient as any).finalizeBill({ tableNo });
        } else if (typeof (apiClient as any).printBill === 'function') {
          result = await (apiClient as any).printBill({ tableNo });
        }

        if (!result.ok) {
          const serverMsg = result.data && (result.data.message || JSON.stringify(result.data));
          throw new Error(serverMsg || 'Failed to finalize/print bill');
        }

        clearHeldOrderForTable(String(lastConfirmedOrder?.tableNo ?? tableName ?? '').trim());
        // On successful finalize/payment, clear the global cart so the next customer starts fresh.
        useCartStore.getState().clearCart();
        useOrderStore.getState().clearLastConfirmedOrder();

        Alert.alert('Done', 'Payment completed and cart cleared.');
        // Navigate back to the main screen (adjust as desired)
        router.push('/');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to finalize/print bill';
        Alert.alert('Finalize failed', message);
      }
    })();
  };

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', day: '2-digit', year: 'numeric' });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#002748" />

      {/* HEADER */}
      <View style={[styles.header, { height: headerH, paddingHorizontal: hPad }]}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={[styles.backButton, { width: backBtnSize, height: backBtnSize, borderRadius: backBtnSize / 2 }]}
            onPress={goBack}
            disabled={isHydratingBill}
          >
            <Image
              source={require('../../assets/icons/blackback.png')}
              style={{ width: backIconSize + 8, height: backIconSize + 8, tintColor: '#FFF' }}
              resizeMode="contain"
            />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { fontSize: titleFs }]}>Billing</Text>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleNewOrder}
            style={styles.newOrderButton}
          >
            <Ionicons name="add" size={14} color="#002748" />
            <Text style={styles.newOrderButtonText}>New Order</Text>
          </TouchableOpacity>
        </View>
      </View>

      {toastMessage && (
        <View style={[styles.toastBanner, { top: headerH - 10 }]} pointerEvents="none">
          <Text style={styles.toastBannerText}>{toastMessage}</Text>
        </View>
      )}

      {/* TABLE INFO CONTAINER */}
      <View style={[styles.fixedInfo, { paddingHorizontal: hPad }]}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/images/CAPTURE 1.png')}
            style={{ width: logoW, height: logoH }}
            resizeMode="contain"
          />
        </View>

        <Text style={[styles.tableNumber, { fontSize: tableFs }]}>Table Number - {tableName ?? 'GF 05'}</Text>
        <Text style={[styles.dateText, { fontSize: dateFs }]}>{timeStr}{'  '}{dateStr}</Text>
      </View>

      {/* SCROLLABLE ITEMS LIST */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingHorizontal: hPad }]}>
        {displayedItems.map((item: any, index: number) => (
          <View key={item.menuItemCode} style={styles.billItemBlock}>
            <View style={styles.itemRow}>
              <Text style={[styles.itemName, { fontSize: itemFs }]} numberOfLines={1}>{item.menuItmDes}</Text>

              <Text style={[styles.itemPrice, { fontSize: itemFs }]}>Lkr {(Number(item.salesPrice ?? 0) * Number(item.quantity ?? 0)).toFixed(2)}</Text>

              <View style={styles.qtyPill}>
                <TouchableOpacity
                  onPress={() => updateDisplayedQuantity(item.menuItemCode, -1)}
                  onLongPress={() => openVoidModal(item.menuItemCode)}
                  style={[styles.qtyBtn, { width: qtyBtnSize, height: qtyBtnSize }]}
                  delayLongPress={300}
                >
                  <Ionicons name="remove" size={isTablet ? 16 : 12} color="#000" />
                </TouchableOpacity>
                <Text style={[styles.qtyText, { fontSize: qtySize }]}>{item.quantity}</Text>
                <TouchableOpacity
                  onPress={() => updateDisplayedQuantity(item.menuItemCode, 1)}
                  style={[styles.qtyBtn, { width: qtyBtnSize, height: qtyBtnSize }]}
                >
                  <Ionicons name="add" size={isTablet ? 16 : 12} color="#000" />
                </TouchableOpacity>
              </View>
            </View>

            {pendingVoidItemId === item.menuItemCode && (
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.inlineVoidActionBtn}
                onPress={() => openVoidModal(item.menuItemCode)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.inlineVoidActionText}>Add Void Remark</Text>
                </View>
              </TouchableOpacity>
            )}
            {/* Show remark if present on the confirmed snapshot */}
            {('itemRemarks' in item) && item.itemRemarks ? (
              <TouchableOpacity activeOpacity={0.8} onPress={() => openVoidModal(item.menuItemCode, true)}>
                <Text style={{ color: '#555', marginTop: 0, lineHeight: 18 }}>{item.itemRemarks}</Text>
              </TouchableOpacity>
            ) : null}

            {index < displayedItems.length - 1 ? <View style={styles.itemDivider} /> : null}
          </View>
        ))}
      </ScrollView>

      {/* FOOTER CONTROLS */}
      <View style={[styles.footer, { paddingHorizontal: hPad, paddingBottom: isSmall ? 12 : 20 }]}>
        <View style={styles.topDivider} />
        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, { fontSize: totalFs }]}>Gross Total (Lkr)</Text>
          <Text style={[styles.totalValue, { fontSize: totalFs }]}>{grossTotal.toFixed(2)}</Text>
        </View>

        <TouchableOpacity
          style={[styles.printBtn, { height: btnH, backgroundColor: footerButtonBackgroundColor }]}
          activeOpacity={0.85}
          onPress={handleFooterAction}
        >
          <Text style={[styles.printText, { fontSize: btnFs }]}>{footerButtonLabel}</Text>
        </TouchableOpacity>
      </View>

      {/* VOID VERIFICATION BOTTOM SHEET MODAL */}
      <Modal visible={isVoidModalVisible} animationType="fade" transparent onRequestClose={handleVoidCancel}>
        <TouchableWithoutFeedback onPress={handleVoidCancel}>
          <View style={styles.voidModalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.voidCard}>
                {isManagerAuthView ? (
                  <View style={styles.managerAuthCardBody}>
                    <View style={styles.managerAuthHeaderRow}>
                      <Text style={styles.managerAuthTitle}>Manager Authentication</Text>
                      <TouchableOpacity onPress={() => setIsManagerAuthView(false)} activeOpacity={0.8}>
                        <Ionicons name="close" size={22} color="#0F172A" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.managerAuthFieldGroup}>
                      <Text style={styles.managerAuthLabel}>Manager Username:</Text>
                      <View style={[styles.managerAuthInputBox, managerIdError ? styles.managerAuthInputBoxError : null]}>
                          <TextInput
                          style={styles.managerAuthInput}
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
                      {!!managerIdError && <Text style={styles.managerAuthErrorText}>{managerIdError}</Text>}
                    </View>

                    <View style={styles.managerAuthFieldGroup}>
                      <Text style={styles.managerAuthLabel}>Manager Password:</Text>
                      <View style={[styles.managerAuthInputBox, managerPasswordError ? styles.managerAuthInputBoxError : null]}>
                          <TextInput
                          style={styles.managerAuthInput}
                          placeholder="Enter Password"
                          placeholderTextColor="rgba(0, 0, 0, 0.25)"
                          value={managerPassword}
                          onChangeText={(text) => {
                            setManagerPassword(text);
                            if (managerPasswordError) setManagerPasswordError('');
                          }}
                          secureTextEntry
                        />
                      </View>
                      {!!managerPasswordError && <Text style={styles.managerAuthErrorText}>{managerPasswordError}</Text>}
                    </View>

                    <View style={styles.managerAuthFooter}>
                      <TouchableOpacity style={styles.confirmActionButtonPrimary} onPress={handleVoidConfirm} activeOpacity={0.85}>
                        <View style={styles.confirmIconWrap}>
                          <Ionicons name="checkmark" size={18} color="#FFF" />
                        </View>
                        <Text style={styles.confirmButtonLabelInlineText}>Confirm</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : isPresetListView ? (
                  <View style={styles.presetListCardBody}>
                    <View style={styles.presetListHeaderRow}>
                      <TouchableOpacity
                        style={styles.presetBackButton}
                        activeOpacity={0.8}
                        onPress={() => setIsPresetListView(false)}
                      >
                        <Ionicons name="arrow-back" size={18} color="#0F172A" />
                      </TouchableOpacity>
                      <Text style={styles.presetListTitle}>Select Preset Remark</Text>
                      <View style={styles.presetBackButtonSpacer} />
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.presetListContent}>
                      {voidPresetItems.length > 0 ? (
                        voidPresetItems.map((item, index) => (
                          <TouchableOpacity
                            key={String(item.VoidRmkId ?? index)}
                            activeOpacity={0.82}
                            style={styles.presetListRow}
                            onPress={() => {
                              const selectedText = String(item.VoidDescription ?? '').trim();
                              setVoidRemark(selectedText);
                              setIsPresetListView(false);
                            }}
                          >
                            <Text style={styles.presetListRowText}>{String(item.VoidDescription ?? '').trim()}</Text>
                            <Ionicons name="chevron-forward" size={18} color="#002748" />
                          </TouchableOpacity>
                        ))
                      ) : (
                        <View style={styles.presetListEmptyWrap}>
                          <Text style={styles.presetListEmptyText}>No preset remarks available.</Text>
                        </View>
                      )}
                    </ScrollView>
                  </View>
                ) : (
                  <View style={styles.voidCardBody}>
                    <ScrollView showsVerticalScrollIndicator contentContainerStyle={styles.voidCardContent} style={styles.voidCardScroll}>
                      <View style={styles.metaSpecificationsStack}>
                        <View style={styles.metaRowInline}>
                          <Text style={styles.metaLabelStyle}>Void Item:</Text>
                          <Text style={styles.metaValueStyle}>{activeVoidItem?.menuItmDes || 'N/A'}</Text>
                        </View>

                        <View style={[styles.metaRowInline, { alignItems: 'center' }]}> 
                          <Text style={styles.metaLabelStyle}>Remove Quantity:</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
                            <TouchableOpacity
                              onPress={() => setVoidQuantity((q) => Math.max(1, (q || 1) - 1))}
                              style={[styles.qtyBtn, { width: 34, height: 34, marginRight: 8 }]}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="remove" size={16} color="#000" />
                            </TouchableOpacity>

                            <Text style={[styles.metaValueStyle, { minWidth: 32, textAlign: 'center' }]}>{String(voidQuantity || 1).padStart(2, '0')}</Text>

                            <TouchableOpacity
                              onPress={() => {
                                const maxQ = activeVoidItem?.quantity ?? 9999;
                                setVoidQuantity((q) => Math.min(maxQ, (q || 1) + 1));
                              }}
                              style={[styles.qtyBtn, { width: 34, height: 34, marginLeft: 8 }]}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="add" size={16} color="#000" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                      <Text style={styles.inputFieldLabelOutside}>Void Remarks:</Text>
                      <View style={styles.textareaWrapperContainer}>
                        <View style={styles.textAreaInputBox}>
                          <TextInput
                            style={styles.textAreaTextInput}
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
                          style={styles.presetToggleButton}
                          onPress={() => setIsPresetListView(true)}
                        >
                          <Text style={styles.presetToggleButtonText}>Preset</Text>
                          <Ionicons name="albums" size={14} color="#fff" />
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.inputFieldLabelOutside}>Manager Name:</Text>
                      <TouchableOpacity activeOpacity={0.9} onPress={() => setIsManagerAuthView(true)}>
                        <View style={styles.singleLineInputBoxWrapper}>
                          <TextInput
                            style={styles.singleLineInputField}
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

                    <View style={styles.voidCardFooter}>
                      <View style={styles.ctaButtonControlRowGroup}>
                        <TouchableOpacity style={styles.confirmActionButtonPrimary} onPress={handleVoidConfirm} activeOpacity={0.85}>
                          <View style={styles.confirmIconWrap}>
                            <Ionicons name="checkmark" size={18} color="#FFF" />
                          </View>
                          <Text style={styles.confirmButtonLabelInlineText}>Confirm</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.cancelActionButtonOutlineSecondary} onPress={handleVoidCancel} activeOpacity={0.85}>
                          <Text style={styles.cancelButtonLabelInlineText}>Cancel</Text>
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

      {isHydratingBill && (
        <View style={styles.loadingOverlay} pointerEvents="auto">
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#002748" />
            <Text style={styles.loadingText}>Loading active bill...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// 6. EXACT STYLES RETAINED (No Modifications Made)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#002748',
    paddingTop: 10,
    paddingBottom: 14,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  backButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  newOrderButton: {
    minWidth: 96,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  newOrderButtonText: {
    color: '#002748',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerTitle: {
    fontWeight: '500',
    color: '#FFF',
    textAlign: 'center',
    flex: 1,
  },
  fixedInfo: {
    backgroundColor: '#FFF',
    paddingTop: 14,
    paddingBottom: 6,
  },
  content: {
    flexGrow: 1,
    paddingTop: 10,
    paddingBottom: 12,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  tableNumber: {
    fontWeight: '500',
    color: '#000',
    textAlign: 'center',
    marginBottom: 4,
  },
  dateText: {
    fontWeight: '300',
    color: '#000',
    textAlign: 'center',
    marginBottom: 16,
  },
  topDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.15)',
    marginBottom: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  billItemBlock: {
    marginBottom: 8,
  },
  itemDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.10)',
    marginTop: 10,
  },
  itemName: {
    fontWeight: '400',
    color: '#000',
    flex: 1,
  },
  itemPrice: {
    fontWeight: '400',
    color: '#000',
    marginHorizontal: 8,
  },
  qtyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  qtyText: {
    fontWeight: '500',
    color: '#000',
    minWidth: 16,
    textAlign: 'center',
  },
  qtyBtn: {
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineVoidActionBtn: {
    alignSelf: 'flex-end',
    marginTop: 6,
    marginBottom: 8,
    backgroundColor: '#8D9ED4',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  inlineVoidActionText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  toastBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 30,
    alignItems: 'center',
  },
  toastBannerText: {
    backgroundColor: 'rgba(0, 39, 72, 0.96)',
    color: '#FFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    overflow: 'hidden',
    fontSize: 13,
    fontWeight: '600',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  totalLabel: {
    fontWeight: '500',
    color: '#000',
  },
  totalValue: {
    fontWeight: '500',
    color: '#000',
  },
  footer: {
    backgroundColor: '#FFF',
    paddingTop: 12,
  },
  printBtn: {
    backgroundColor: '#8D9ED4',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  printText: {
    color: '#FFF',
    fontWeight: '700',
  },
  modalOverlayScrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
    marginBottom: 0,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCard: {
    minWidth: 220,
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: '#FFF',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  loadingText: {
    color: '#002748',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  voidModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  voidCard: {
    width: '90%',
    maxWidth: 560,
    height: 560,
    borderRadius: 20,
    backgroundColor: '#FFF',
    padding: 16,
    overflow: 'hidden',
    elevation: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
  },
  voidCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  voidCardHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
    textAlign: 'center',
  },
  voidCardBody: {
    flex: 1,
  },
  managerAuthCardBody: {
    flex: 1,
    paddingTop: 4,
  },
  managerAuthHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  managerAuthTitle: {
    flex: 1,
    color: '#000',
    fontSize: 24,
    fontFamily: 'Roboto',
    fontWeight: '600',
  },
  managerAuthFieldGroup: {
    marginBottom: 14,
  },
  managerAuthLabel: {
    opacity: 0.75,
    color: 'rgba(0, 0, 0, 0.80)',
    fontSize: 14,
    fontFamily: 'Inter',
    fontWeight: '500',
    marginBottom: 6,
  },
  managerAuthInputBox: {
    width: '100%',
    height: 45,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#0062AA',
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  managerAuthInputBoxError: {
    borderColor: '#FF4D4D',
  },
  managerAuthInput: {
    flex: 1,
    color: 'black',
    fontSize: 14,
    fontFamily: 'Roboto',
    fontWeight: '500',
    padding: 0,
    margin: 0,
  },
  managerAuthErrorText: {
    marginTop: 6,
    color: '#FF4D4D',
    fontSize: 12,
    fontFamily: 'Inter',
    fontWeight: '500',
  },
  managerAuthFooter: {
    marginTop: 8,
    alignItems: 'center',
  },
  presetListCardBody: {
    flex: 1,
    paddingTop: 4,
  },
  presetListHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  presetBackButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 39, 72, 0.08)',
  },
  presetBackButtonSpacer: {
    width: 34,
    height: 34,
  },
  presetListTitle: {
    flex: 1,
    color: '#000',
    fontSize: 22,
    fontFamily: 'Roboto',
    fontWeight: '600',
    textAlign: 'center',
  },
  presetListContent: {
    paddingBottom: 6,
  },
  presetListRow: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#F4F7FB',
    borderWidth: 1,
    borderColor: 'rgba(0, 98, 170, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  presetListRowText: {
    flex: 1,
    color: '#002748',
    fontSize: 14,
    fontFamily: 'Roboto',
    fontWeight: '500',
  },
  presetListEmptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 22,
  },
  presetListEmptyText: {
    color: 'rgba(0, 39, 72, 0.7)',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  voidCardScroll: {
    flex: 1,
  },
  voidCardContent: {
    flexGrow: 1,
    paddingBottom: 8,
  },
  bottomSheetContainer: {
    width: '100%',
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 24,
    paddingTop: 16,
    overflow: 'hidden',
    marginBottom: 0,
  },
  modalTitleHeader: {
    alignSelf: 'center',
    color: 'black',
    fontSize: 24,
    fontFamily: 'Roboto',
    fontWeight: '600',
    marginBottom: 20,
  },
  metaSpecificationsStack: {
    gap: 12,
    marginBottom: 16,
  },
  metaRowInline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaLabelStyle: {
    opacity: 0.75,
    color: 'rgba(0, 0, 0, 0.80)',
    fontSize: 14,
    fontFamily: 'Inter',
    fontWeight: '500',
    width: 110,
  },
  metaValueStyle: {
    color: 'black',
    fontSize: 16,
    fontFamily: 'Roboto',
    fontWeight: '500',
  },
  inputFieldLabelOutside: {
    opacity: 0.75,
    color: 'rgba(0, 0, 0, 0.80)',
    fontSize: 14,
    fontFamily: 'Inter',
    fontWeight: '500',
    marginBottom: 6,
    marginTop: 4,
  },
  textareaWrapperContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  textAreaInputBox: {
    flex: 1,
    height: 104,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#0062AA',
    padding: 12,
    justifyContent: 'flex-start',
  },
  textAreaTextInput: {
    flex: 1,
    color: 'black',
    fontSize: 13,
    fontFamily: 'Roboto',
    fontWeight: '500',
    textAlignVertical: 'top',
    padding: 0,
    margin: 0,
  },
  ellipsisMoreBtn: {
    width: 39,
    height: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  ellipsisTextInline: {
    color: 'black',
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'Roboto',
    top: -4,
  },
  presetToggleButton: {
    alignSelf: 'flex-start',
    minWidth: 112,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#8D9ED4',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  presetToggleButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontFamily: 'Roboto',
    fontWeight: '600',
  },
  singleLineInputBoxWrapper: {
    width: '100%',
    marginBottom: 24,
  },
  singleLineInputField: {
    width: '100%',
    height: 45,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#0062AA',
    paddingHorizontal: 12,
    color: 'black',
    fontSize: 14,
    fontFamily: 'Roboto',
    fontWeight: '500',
  },
  ctaButtonControlRowGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 0,
  },
  voidCardFooter: {
    paddingTop: 12,
  },
  confirmActionButtonPrimary: {
    width: '47%',
    height: 54,
    backgroundColor: '#8D9ED4',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  confirmIconWrap: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  confirmButtonLabelInlineText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'Roboto',
    fontWeight: '500',
  },
  cancelActionButtonOutlineSecondary: {
    width: '47%',
    height: 54,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#8D9ED4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonLabelInlineText: {
    opacity: 0.5,
    color: 'black',
    fontSize: 16,
    fontFamily: 'Roboto',
    fontWeight: '500',
  },
});