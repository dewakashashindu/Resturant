import { apiClient } from './api';
import { useAuthStore } from './authStore';
import { useCartStore } from './cartStore';
import { useOrderStore } from './orderStore';
import { getUniqueDeviceId } from './deviceIdService';

// ─── Signing out ─────────────────────────────────────────────────────────────
// One path for every logout, so the tab bar button, an expired session and the
// automatic sign-out all leave the device in exactly the same state:
//
//   1. release the workstation, so the next steward does not take over a
//      session that has already ended
//   2. optionally drop the order that was being taken (the automatic sign-out
//      does this: the next person must not find someone else's cart)
//   3. clear the session, including the biometric re-entry
//   4. go to the sign-in screen, which is what locks the device again

type LogoutRouter = {
  replace: (href: any) => void;
};

export const performLogout = async (
  router: LogoutRouter,
  options?: { clearOrder?: boolean },
) => {
  try {
    const deviceId = await getUniqueDeviceId();
    if (deviceId) await apiClient.releaseDevice(deviceId);
  } catch (error) {
    console.log('[Session] workstation release failed', error);
  }

  if (options?.clearOrder) {
    try {
      useCartStore.getState().clearCart();
      useOrderStore.getState().clearLastConfirmedOrder();
    } catch (error) {
      console.log('[Session] clearing the order failed', error);
    }
  }

  try {
    await useAuthStore.getState().clearSession();
  } catch (error) {
    console.log('[Session] session clear failed', error);
  }

  router.replace('/auth/login');
};
