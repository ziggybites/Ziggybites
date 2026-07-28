import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { subscriptionAPI } from "@food/api"

const SubscriptionsContext = createContext(null)
const SUBSCRIPTIONS_STORAGE_KEY = "userSubscriptions"
const SUBSCRIPTION_SCHEDULES_STORAGE_KEY = "userSubscriptionSchedules"

const isUserAuthenticated = () =>
  localStorage.getItem("user_authenticated") === "true" ||
  !!localStorage.getItem("user_accessToken")

export function SubscriptionsProvider({ children }) {
  const [subscriptions, setSubscriptions] = useState(() => {
    try {
      const saved = localStorage.getItem(SUBSCRIPTIONS_STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [upcomingSchedules, setUpcomingSchedules] = useState(() => {
    try {
      const saved = localStorage.getItem(SUBSCRIPTION_SCHEDULES_STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [loading, setLoading] = useState(
    () => (subscriptions.length === 0 || upcomingSchedules.length === 0) && isUserAuthenticated(),
  )

  useEffect(() => {
    try {
      if (subscriptions.length > 0 || isUserAuthenticated()) {
        localStorage.setItem(SUBSCRIPTIONS_STORAGE_KEY, JSON.stringify(subscriptions))
      }
    } catch {
      // ignore storage errors
    }
  }, [subscriptions])

  useEffect(() => {
    try {
      if (upcomingSchedules.length > 0 || isUserAuthenticated()) {
        localStorage.setItem(
          SUBSCRIPTION_SCHEDULES_STORAGE_KEY,
          JSON.stringify(upcomingSchedules),
        )
      }
    } catch {
      // ignore storage errors
    }
  }, [upcomingSchedules])

  const refreshSubscriptions = useCallback(async ({ silent = false } = {}) => {
    if (!isUserAuthenticated()) {
      setSubscriptions([])
      setUpcomingSchedules([])
      setLoading(false)
      try {
        localStorage.removeItem(SUBSCRIPTIONS_STORAGE_KEY)
        localStorage.removeItem(SUBSCRIPTION_SCHEDULES_STORAGE_KEY)
      } catch {
        // ignore storage errors
      }
      return { subscriptions: [], schedules: [] }
    }

    if (!silent) {
      setLoading(true)
    }

    try {
      const [subscriptionsResponse, schedulesResponse] = await Promise.all([
        subscriptionAPI.getMySubscriptions(),
        subscriptionAPI.getUpcomingSchedules().catch(() => null),
      ])

      const nextSubscriptions =
        subscriptionsResponse?.data?.data?.subscriptions ||
        subscriptionsResponse?.data?.subscriptions ||
        []
      const nextSchedules =
        schedulesResponse?.data?.data?.schedules ||
        schedulesResponse?.data?.schedules ||
        []

      const safeSubscriptions = Array.isArray(nextSubscriptions) ? nextSubscriptions : []
      const safeSchedules = Array.isArray(nextSchedules) ? nextSchedules : []

      setSubscriptions(safeSubscriptions)
      setUpcomingSchedules(safeSchedules)

      return { subscriptions: safeSubscriptions, schedules: safeSchedules }
    } catch (error) {
      if (!silent) {
        setSubscriptions([])
        setUpcomingSchedules([])
      }
      throw error
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    const hydrateSubscriptions = () => {
      if (!isUserAuthenticated()) {
        setSubscriptions([])
        setUpcomingSchedules([])
        setLoading(false)
        return
      }

      refreshSubscriptions({
        silent: subscriptions.length > 0 || upcomingSchedules.length > 0,
      }).catch(() => {
        setLoading(false)
      })
    }

    hydrateSubscriptions()

    const handleAuthChange = () => {
      hydrateSubscriptions()
    }

    window.addEventListener("userAuthChanged", handleAuthChange)

    return () => {
      window.removeEventListener("userAuthChanged", handleAuthChange)
    }
  }, [refreshSubscriptions, subscriptions.length, upcomingSchedules.length])

  const getSubscriptionById = useCallback(
    (subscriptionId) =>
      subscriptions.find(
        (item) => String(item.subscriptionId || item._id) === String(subscriptionId),
      ) || null,
    [subscriptions],
  )

  const getSchedulesForSubscription = useCallback(
    (subscriptionId) =>
      upcomingSchedules.filter(
        (schedule) =>
          String(
            schedule.subscriptionId?._id ||
              schedule.subscriptionId ||
              schedule.subscription?.subscriptionId ||
              "",
          ) === String(subscriptionId),
      ),
    [upcomingSchedules],
  )

  const value = useMemo(
    () => ({
      subscriptions,
      upcomingSchedules,
      loading,
      refreshSubscriptions,
      getSubscriptionById,
      getSchedulesForSubscription,
    }),
    [
      subscriptions,
      upcomingSchedules,
      loading,
      refreshSubscriptions,
      getSubscriptionById,
      getSchedulesForSubscription,
    ],
  )

  return <SubscriptionsContext.Provider value={value}>{children}</SubscriptionsContext.Provider>
}

export function useSubscriptions() {
  const context = useContext(SubscriptionsContext)
  if (!context) {
    throw new Error("useSubscriptions must be used within a SubscriptionsProvider")
  }
  return context
}
