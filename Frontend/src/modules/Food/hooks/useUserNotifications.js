import { useEffect, useRef, useState, useContext } from 'react';
import io from 'socket.io-client';
import { toast } from 'sonner';
import { API_BASE_URL } from '@food/api/config';
import { dispatchNotificationInboxRefresh } from '@food/hooks/useNotificationInbox';
import { UserNotificationContext } from '../context/UserNotificationContext';
import { readUserProfileFromStorage } from '../../../core/auth/storageKeys';
import { getAccessToken } from '../../../core/auth/tokenStore';

const debugLog = (...args) => {
  if (import.meta.env.DEV) {
    console.log('📬 [UserSocket]', ...args);
  }
};

/**
 * Hook for user to receive real-time order notifications.
 * Dispatches 'orderStatusNotification' custom event for OrderTrackingCard.
 */
export const useUserNotifications = () => {
  const context = useContext(UserNotificationContext);
  if (context) return context;
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [userId, setUserId] = useState(null);
  const lastDropOtpToastRef = useRef({ key: '', at: 0 });
  const lastOrderStatusToastRef = useRef({ key: '', at: 0 });

  const DROP_OTP_TOAST_ID = 'user-delivery-drop-otp';
  const DROP_OTP_DEDUPE_MS = 15000;
  const ORDER_STATUS_TOAST_ID = 'user-order-status-update';
  const ORDER_STATUS_DEDUPE_MS = 4000;
  useEffect(() => {
    const resolveUserId = () => {
      try {
        const user = readUserProfileFromStorage();
        const id = user?._id?.toString?.() || user?.userId || user?.id || null;
        if (id) {
          setUserId(String(id));
          return;
        }
      } catch {
        // ignore storage errors
      }

      setUserId(null)
    }

    resolveUserId()
    window.addEventListener('userAuthChanged', resolveUserId)
    return () => {
      window.removeEventListener('userAuthChanged', resolveUserId)
    }
  }, []);

  useEffect(() => {
    if (!API_BASE_URL || !String(API_BASE_URL).trim()) {
      setIsConnected(false);
      return;
    }
    if (!userId) {
      return;
    }

    // Normalize backend URL
    let backendUrl = API_BASE_URL;
    try {
      backendUrl = new URL(backendUrl).origin;
    } catch {
      backendUrl = String(backendUrl || "")
        .replace(/\/api\/v\d+\/?$/i, "")
        .replace(/\/api\/?$/i, "")
        .replace(/\/+$/, "");
    }

    const socketUrl = `${backendUrl}`;
    
    // Auth token
    const token = getAccessToken('user');
    if (!token) return;

    debugLog('🔌 Connecting to User Socket.IO:', socketUrl);

    socketRef.current = io(socketUrl, {
      path: '/socket.io/',
      transports: ['polling', 'websocket'],
      reconnection: true,
      auth: { token }
    });

    socketRef.current.on('connect', () => {
      debugLog('✅ User Socket connected, userId:', userId);
      setIsConnected(true);
      if (typeof window !== 'undefined') window.orderSocketConnected = true;
      // Backend auto-joins 'user:userId' room based on role/token in config/socket.js
    });

    socketRef.current.on('order_status_update', (data) => {
      debugLog('🔔 Order status update received:', data);
      
      const title = data.title || `Order #${data.orderId || 'Update'}`;
      const message = data.message || `Your order status is now ${String(data.orderStatus || '').replace(/_/g, ' ')}`;
      const handoverOtp = data?.handoverOtp != null ? String(data.handoverOtp) : '';

      // Optional: Show toast for important updates (Cancel, Ready, etc.)
      const isImportant = String(data.orderStatus).includes('cancel') || ['ready_for_pickup', 'ready', 'confirmed'].includes(data.orderStatus);
      const isOrderTrackingScreen =
        typeof window !== 'undefined' &&
        String(window.location?.pathname || '').includes('/user/orders/');

      const statusKey = `${String(data.orderId || '')}:${String(data.orderStatus || '')}`;
      const now = Date.now();
      const isDuplicateStatusToast =
        statusKey &&
        statusKey === lastOrderStatusToastRef.current.key &&
        now - lastOrderStatusToastRef.current.at < ORDER_STATUS_DEDUPE_MS;

      if (isImportant && !isOrderTrackingScreen && !isDuplicateStatusToast) {
        lastOrderStatusToastRef.current = { key: statusKey, at: now };
        toast.dismiss(ORDER_STATUS_TOAST_ID);
        toast.message(title, {
          id: ORDER_STATUS_TOAST_ID,
          description: message,
          duration: 6000
        });
      }

      // Dispatch custom event for OrderTrackingCard and other listeners
      const event = new CustomEvent('orderStatusNotification', {
        detail: {
          orderMongoId: data.orderMongoId,
          orderId: data.orderId,
          status: data.orderStatus,
          orderStatus: data.orderStatus, // Ensure compatibility with different UI checks
          title,
          message,
          deliveryState: data.deliveryState,
          deliveryVerification: data.deliveryVerification,
          timestamp: new Date().toISOString()
        }
      });
      window.dispatchEvent(event);

      if (handoverOtp) {
        window.dispatchEvent(
          new CustomEvent('deliveryDropOtp', {
            detail: {
              orderMongoId: data?.orderMongoId,
              orderId: data?.orderId,
              otp: handoverOtp,
              message: data?.message || 'Share this OTP with your delivery partner to hand over the order.',
            }
          })
        );
      }
    });

    /** Customer receives handover OTP when partner confirms "reached drop" (never shown to partner). */
    socketRef.current.on('delivery_drop_otp', (payload) => {
      debugLog('🔐 Delivery handover OTP:', payload?.orderId);
      const otp = payload?.otp != null ? String(payload.otp) : '';
      const orderId = payload?.orderId != null ? String(payload.orderId) : '';
      const message = payload?.message != null ? String(payload.message) : '';

      const otpKey = `${orderId}:${otp}`;
      const now = Date.now();
      const lastToast = lastDropOtpToastRef.current;
      const isDuplicateOtp =
        otpKey &&
        otpKey === lastToast.key &&
        now - lastToast.at < DROP_OTP_DEDUPE_MS;

      if (isDuplicateOtp) {
        return;
      }

      lastDropOtpToastRef.current = { key: otpKey, at: now };

      window.dispatchEvent(
        new CustomEvent('deliveryDropOtp', {
          detail: {
            orderMongoId: payload?.orderMongoId,
            orderId,
            otp,
            message
          }
        })
      );
      const title = orderId ? `Order ${orderId}` : 'Delivery OTP';
      const parts = [message, otp ? `OTP: ${otp}` : ''].filter(Boolean);

      toast.dismiss(DROP_OTP_TOAST_ID);
      toast.message(title, {
        id: DROP_OTP_TOAST_ID,
        description: parts.join(' — ') || 'Handover OTP from your delivery partner.',
        duration: 12_000
      });
    });

    socketRef.current.on('admin_notification', (payload) => {
      toast.message(payload?.title || 'Notification', {
        description: payload?.message || 'New broadcast notification received.',
        duration: 8000
      });
      dispatchNotificationInboxRefresh();
    });

    socketRef.current.on('connect_error', (error) => {
      if (import.meta.env.DEV) {
        // debugLog('❌ Socket connection error:', error.message);
      }
      setIsConnected(false);
      if (typeof window !== 'undefined') window.orderSocketConnected = false;
    });

    socketRef.current.on('disconnect', (reason) => {
      debugLog('🔌 Socket disconnected:', reason);
      setIsConnected(false);
      if (typeof window !== 'undefined') window.orderSocketConnected = false;
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [userId]);

  return { isConnected };
};
