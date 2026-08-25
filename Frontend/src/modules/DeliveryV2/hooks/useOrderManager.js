import { useRef } from 'react';
import { useDeliveryStore } from '@/modules/DeliveryV2/store/useDeliveryStore';
import { deliveryAPI } from '@food/api';

/**
 * useOrderManager - Professional hook for real-world trip lifecycle actions.
 * Connects directly to the backend API services.
 */
export const useOrderManager = () => {
  const {
    activeOrder,
    updateTripStatus,
    clearActiveOrder,
    setActiveOrder,
    riderLocation,
  } = useDeliveryStore();

  const resolveOrderId = (orderLike = activeOrder) =>
    orderLike?._id || orderLike?.id || orderLike?.orderId || orderLike?.order_id;

  const acceptOrderInFlight = useRef(false);

  const acceptOrder = async (order) => {
    if (acceptOrderInFlight.current) {
      return;
    }

    const orderId = resolveOrderId(order);
    if (!orderId) {
      return;
    }

    acceptOrderInFlight.current = true;
    try {
      const response = await deliveryAPI.acceptOrder(orderId);

      if (!response?.data?.success) {
        throw new Error('Accept failed');
      }

      const fullOrder = response.data.data?.order || order;

      const getLoc = (ref, keysLat, keysLng) => {
        if (!ref) return null;
        if (ref.location) {
          if (Array.isArray(ref.location.coordinates) && ref.location.coordinates.length >= 2) {
            return {
              lat: ref.location.coordinates[1],
              lng: ref.location.coordinates[0],
            };
          }
          return {
            lat: ref.location.latitude || ref.location.lat,
            lng: ref.location.longitude || ref.location.lng,
          };
        }
        for (const k of keysLat) {
          if (ref[k] != null) {
            return { lat: ref[k], lng: ref[keysLng[keysLat.indexOf(k)]] };
          }
        }
        return null;
      };

      console.log('[OrderManager] Raw Full Order Data:', fullOrder);

      const resLoc =
        getLoc(fullOrder.restaurantId, ['latitude', 'lat'], ['longitude', 'lng']) ||
        getLoc(
          fullOrder,
          ['restaurant_lat', 'restaurantLat', 'latitude'],
          ['restaurant_lng', 'restaurantLng', 'longitude'],
        );

      const cusLoc =
        getLoc(fullOrder.deliveryAddress, ['latitude', 'lat'], ['longitude', 'lng']) ||
        getLoc(
          fullOrder,
          ['customer_lat', 'customerLat', 'latitude'],
          ['customer_lng', 'customerLng', 'longitude'],
        );

      console.log('[OrderManager] Locations Mapped Result:', { resLoc, cusLoc });

      setActiveOrder({
        ...fullOrder,
        orderId,
        restaurantLocation: resLoc,
        customerLocation: cusLoc,
      });

      updateTripStatus('PICKING_UP');
    } catch (error) {
      console.error('Accept Order Error:', error);
      throw error;
    } finally {
      acceptOrderInFlight.current = false;
    }
  };

  const reachPickup = async () => {
    const orderId = resolveOrderId();
    if (!orderId) {
      throw new Error('Missing order id');
    }

    try {
      const response = await deliveryAPI.confirmReachedPickup(orderId);
      if (!response?.data?.success) {
        throw new Error('Confirm pickup failed');
      }
      updateTripStatus('REACHED_PICKUP');
    } catch (error) {
      throw error;
    }
  };

  const pickUpOrder = async (billImageUrl, otp) => {
    const orderId = resolveOrderId();
    if (!orderId) {
      throw new Error('Missing order id');
    }

    try {
      const response = await deliveryAPI.confirmOrderId(
        orderId,
        activeOrder.displayOrderId || orderId,
        riderLocation || {},
        { billImageUrl, otp },
      );

      if (!response?.data?.success) {
        throw new Error('Confirm order ID failed');
      }

      updateTripStatus('PICKED_UP');
    } catch (error) {
      throw error;
    }
  };

  const reachDrop = async () => {
    const orderId = resolveOrderId();
    if (!orderId) {
      throw new Error('Missing order id');
    }

    try {
      const response = await deliveryAPI.confirmReachedDrop(orderId);
      if (!response?.data?.success) {
        throw new Error('Confirm drop failed');
      }
      updateTripStatus('REACHED_DROP');
    } catch (error) {
      throw error;
    }
  };

  const completeDelivery = async (otp, paymentMethodOverride = null) => {
    const orderId = resolveOrderId();
    if (!orderId) {
      throw new Error('Missing order id');
    }

    try {
      const isAlreadyVerified = activeOrder?.deliveryVerification?.dropOtp?.verified;

      if (!isAlreadyVerified) {
        const verifyRes = await deliveryAPI.verifyDropOtp(orderId, otp);
        if (!verifyRes?.data?.success) {
          throw new Error('Invalid OTP');
        }
      }

      const otpToUse = otp || activeOrder?.deliveryVerification?.dropOtp?.code;

      let finalOrder = activeOrder;
      try {
        const completeRes = await deliveryAPI.completeDelivery(orderId, {
          otp: otpToUse,
          rating: 5,
        });
        if (completeRes.data?.success && completeRes.data?.data?.order) {
          finalOrder = completeRes.data.data.order;
        }
      } catch (completeErr) {
        console.warn('Complete call failed, but OTP was verified.', completeErr);
      }

      if (finalOrder) setActiveOrder(finalOrder);
      updateTripStatus('COMPLETED');
    } catch (error) {
      console.error('Completion Error:', error);
      throw error;
    }
  };

  const resetTrip = () => {
    clearActiveOrder();
  };

  return {
    acceptOrder,
    reachPickup,
    pickUpOrder,
    reachDrop,
    completeDelivery,
    resetTrip,
  };
};
