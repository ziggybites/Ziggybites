import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react"
import { orderAPI } from "@food/api"

const OrdersContext = createContext(null)
const ORDERS_STORAGE_KEY = "userOrders"
const ORDERS_SYNC_STORAGE_KEY = "userOrdersLastSyncedAt"
const FETCH_LIMIT = 100
const ORDERS_STALE_MS = 2 * 60 * 1000
const ACTIVE_POLL_INTERVAL_MS = 20000
const IDLE_POLL_INTERVAL_MS = 2 * 60 * 1000

const isUserAuthenticated = () =>
  localStorage.getItem("user_authenticated") === "true" ||
  !!localStorage.getItem("user_accessToken")

const getOrderStatus = (order) => {
  const status = order?.status
  if (status === "delivered" || status === "completed") return "delivered"
  if (status === "out_for_delivery" || status === "outForDelivery") return "outForDelivery"
  if (status === "ready" || status === "preparing") return "preparing"
  if (String(status).toLowerCase().includes("cancel")) return "cancelled"
  if (status === "dead") return "dead"
  return status || "confirmed"
}

const isTerminalOrderStatus = (status) => {
  const normalized = String(status || "").trim().toLowerCase()
  return [
    "delivered",
    "completed",
    "cancelled",
    "canceled",
    "restaurant_cancelled",
    "cancelled_by_user",
    "cancelled_by_restaurant",
    "cancelled_by_admin",
    "dead",
    "failed",
  ].includes(normalized)
}

const getLastOrdersSyncTime = () => {
  try {
    return Number(localStorage.getItem(ORDERS_SYNC_STORAGE_KEY) || 0)
  } catch {
    return 0
  }
}

const hasFreshOrdersCache = (orders = []) =>
  orders.length > 0 && Date.now() - getLastOrdersSyncTime() < ORDERS_STALE_MS

const transformOrders = (ordersData = []) => {
  const transformedOrders = ordersData.map((order) => {
    const createdAt = order.createdAt ? new Date(order.createdAt) : new Date()
    const backendStatus = order.orderStatus || order.status
    const isCancelled =
      backendStatus === "cancelled" ||
      backendStatus === "cancelled_by_user" ||
      backendStatus === "cancelled_by_restaurant" ||
      backendStatus === "cancelled_by_admin" ||
      backendStatus === "dead"
    const cancellationReason = order.cancellationReason || ""
    const isRestaurantCancelled =
      isCancelled &&
      (order.cancelledBy === "restaurant" ||
        /rejected by restaurant|restaurant rejected|restaurant cancelled|restaurant is too busy|item not available|outside delivery area|kitchen closing|technical issue|order not accepted within time limit|restaurant did not respond/i.test(
          cancellationReason,
        ))
    const isUserCancelled = isCancelled && order.cancelledBy === "user"
    const isDead = backendStatus === "dead"
    const originalStatus = backendStatus
    const restaurantRating = order.ratings?.restaurant?.rating || null
    const deliveryPartnerRating = order.ratings?.deliveryPartner?.rating || null

    return {
      id: order._id?.toString() || order.orderId || `ORD-${order._id}`,
      mongoId: order._id,
      orderId: order.orderId || order._id?.toString(),
      status: isRestaurantCancelled
        ? "restaurant_cancelled"
        : getOrderStatus({ ...order, status: backendStatus }),
      originalStatus,
      createdAt: createdAt.toISOString(),
      address: order.address || order.deliveryAddress || {},
      items: (order.items || []).map((item) => ({
        itemId: item.itemId || item._id || item.id,
        name: item.name || item.foodName || "Item",
        variantName: item.variantName || "",
        quantity: item.quantity || 1,
        price: item.price || 0,
        image: item.image || null,
        description: item.description || null,
        isVeg:
          item.isVeg === true ||
          item.foodType === "Veg" ||
          item.category === "veg" ||
          item.type === "veg",
        _id: item._id || item.id,
        id: item.id || item._id,
      })),
      total: order.pricing?.total || order.total || 0,
      subtotal: order.pricing?.subtotal || 0,
      deliveryFee: order.pricing?.deliveryFee || 0,
      tax: order.pricing?.tax || 0,
      pricing: order.pricing || {},
      payment: order.payment || {},
      paymentMethod: order.payment?.method || order.paymentMethod,
      restaurant:
        order.restaurantId?.restaurantName ||
        order.restaurantId?.name ||
        order.restaurantName ||
        "Restaurant",
      restaurantId: order.restaurantId?._id || order.restaurantId,
      restaurantSlug: order.restaurantId?.slug || null,
      restaurantImage:
        order.restaurantId?.profileImage?.url || order.restaurantId?.profileImage || null,
      restaurantLocation:
        order.restaurantId?.location?.area ||
        order.restaurantId?.location?.city ||
        order.address?.city ||
        order.deliveryAddress?.city ||
        "",
      restaurantRating,
      deliveryPartnerRating,
      ratings: order.ratings || {},
      rating: restaurantRating || null,
      review: order.review || null,
      tracking: order.tracking || {},
      cancellationReason,
      isRestaurantCancelled,
      isUserCancelled,
      isDead,
      cancelledBy: order.cancelledBy,
      eta: order.eta || {
        min: order.estimatedDeliveryTime || 30,
        max: order.estimatedDeliveryTime || 30,
      },
      estimatedDeliveryTime: order.estimatedDeliveryTime || 30,
      preparationTime: order.preparationTime || 0,
      deliveredAt: order.deliveredAt || null,
      deliveryPartnerId: order.deliveryPartnerId?._id || order.deliveryPartnerId || null,
      deliveryPartnerName: order.deliveryPartnerId?.name || order.deliveryPartnerName || null,
      deliveryPartnerPhone: order.deliveryPartnerId?.phone || order.deliveryPartnerPhone || null,
      note: order.note || null,
    }
  })

  transformedOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  return transformedOrders
}

const fetchAllOrders = async () => {
  const firstResponse = await orderAPI.getOrders({
    limit: FETCH_LIMIT,
    page: 1,
  })

  let firstPageOrders = []
  let totalPages = 1

  if (firstResponse?.data?.success && firstResponse?.data?.data?.orders) {
    firstPageOrders = firstResponse.data.data.orders || []
    totalPages = firstResponse.data.data?.pagination?.pages || 1
  } else if (firstResponse?.data?.orders) {
    firstPageOrders = firstResponse.data.orders || []
    totalPages = firstResponse.data?.pagination?.pages || 1
  } else if (firstResponse?.data?.data && Array.isArray(firstResponse.data.data)) {
    firstPageOrders = firstResponse.data.data || []
  }

  if (totalPages <= 1) {
    return firstPageOrders
  }

  const pageResponses = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      orderAPI.getOrders({ limit: FETCH_LIMIT, page: index + 2 }),
    ),
  )

  const remainingOrders = pageResponses.flatMap((resp) => {
    if (resp?.data?.success && resp?.data?.data?.orders) {
      return resp.data.data.orders || []
    }
    if (resp?.data?.orders) {
      return resp.data.orders || []
    }
    if (resp?.data?.data && Array.isArray(resp.data.data)) {
      return resp.data.data || []
    }
    return []
  })

  return [...firstPageOrders, ...remainingOrders]
}

export function OrdersProvider({ children }) {
  const [orders, setOrders] = useState(() => {
    if (typeof window === "undefined") return []
    try {
      const saved = localStorage.getItem(ORDERS_STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [loading, setLoading] = useState(() => orders.length === 0 && isUserAuthenticated())

  useEffect(() => {
    try {
      const isAuthenticated = isUserAuthenticated()
      if (orders.length > 0 || isAuthenticated) {
        localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders))
      }
    } catch {
      // ignore storage errors
    }
  }, [orders])

  const refreshOrders = useCallback(async ({ silent = false } = {}) => {
    if (!isUserAuthenticated()) {
      setOrders([])
      setLoading(false)
      try {
        localStorage.removeItem(ORDERS_STORAGE_KEY)
        localStorage.removeItem(ORDERS_SYNC_STORAGE_KEY)
      } catch {
        // ignore storage errors
      }
      return []
    }

    if (!silent) {
      setLoading(true)
    }

    try {
      const ordersData = await fetchAllOrders()
      const transformedOrders = transformOrders(ordersData)
      setOrders(transformedOrders)
      try {
        localStorage.setItem(ORDERS_SYNC_STORAGE_KEY, String(Date.now()))
      } catch {
        // ignore storage errors
      }
      return transformedOrders
    } catch (error) {
      if (!silent) {
        setOrders([])
      }
      throw error
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [])

  const hasActiveOrders = useMemo(
    () => orders.some((order) => !isTerminalOrderStatus(order?.status || order?.originalStatus)),
    [orders],
  )

  useEffect(() => {
    const hydrateOrders = ({ force = false } = {}) => {
      if (!isUserAuthenticated()) {
        setOrders([])
        setLoading(false)
        return
      }

      if (!force && hasFreshOrdersCache(orders)) {
        setLoading(false)
        return
      }

      refreshOrders({ silent: orders.length > 0 }).catch(() => {
        setLoading(false)
      })
    }

    hydrateOrders()

    const pollInterval = setInterval(() => {
      if (!isUserAuthenticated()) return
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return
      refreshOrders({ silent: true }).catch(() => {})
    }, hasActiveOrders ? ACTIVE_POLL_INTERVAL_MS : IDLE_POLL_INTERVAL_MS)

    const handleAuthChange = () => {
      hydrateOrders({ force: true })
    }

    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        hydrateOrders()
      }
    }

    window.addEventListener("userAuthChanged", handleAuthChange)
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange)
    }

    return () => {
      clearInterval(pollInterval)
      window.removeEventListener("userAuthChanged", handleAuthChange)
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange)
      }
    }
  }, [orders, hasActiveOrders, refreshOrders])

  const createOrder = (orderData) => {
    const newOrder = {
      id: `ORD-${Date.now()}`,
      ...orderData,
      status: "confirmed",
      createdAt: new Date().toISOString(),
      tracking: {
        confirmed: { status: true, timestamp: new Date().toISOString() },
        preparing: { status: false, timestamp: null },
        outForDelivery: { status: false, timestamp: null },
        delivered: { status: false, timestamp: null }
      }
    }
    setOrders((prevOrders) => [newOrder, ...prevOrders])
    return newOrder.id
  }

  const patchOrder = useCallback((orderId, updates) => {
    setOrders((prevOrders) =>
      prevOrders.map((order) => {
        if (String(order.id) !== String(orderId)) {
          return order
        }
        const nextUpdates = typeof updates === "function" ? updates(order) : updates
        return { ...order, ...nextUpdates }
      }),
    )
  }, [])

  const getOrderById = useCallback((orderId) => {
    return orders.find(order => order.id === orderId)
  }, [orders])

  const getAllOrders = useCallback(() => {
    return [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }, [orders])

  const updateOrderStatus = useCallback((orderId, status) => {
    setOrders((prevOrders) => prevOrders.map(order => {
      if (order.id === orderId) {
        const updatedTracking = { ...order.tracking }
        if (status === "preparing") {
          updatedTracking.preparing = { status: true, timestamp: new Date().toISOString() }
        } else if (status === "outForDelivery") {
          updatedTracking.outForDelivery = { status: true, timestamp: new Date().toISOString() }
        } else if (status === "delivered") {
          updatedTracking.delivered = { status: true, timestamp: new Date().toISOString() }
        }
        return {
          ...order,
          status,
          tracking: updatedTracking
        }
      }
      return order
    }))
  }, [])

  const value = useMemo(() => ({
    orders,
    loading,
    createOrder,
    getOrderById,
    getAllOrders,
    updateOrderStatus,
    refreshOrders,
    patchOrder,
  }), [orders, loading, getOrderById, getAllOrders, updateOrderStatus, refreshOrders, patchOrder])

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>
}

export function useOrders() {
  const context = useContext(OrdersContext)
  if (!context) {
    throw new Error("useOrders must be used within an OrdersProvider")
  }
  return context
}

