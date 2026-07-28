import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Loader2, Send, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { restaurantAPI } from "@food/api";
import { useRestaurantNotifications } from "@food/hooks/useRestaurantNotifications";

const detailTabs = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "accepted", label: "Accepted" },
  { id: "delivery", label: "Delivery to user" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
];

const formatSubscriptionDate = (value) => {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (value) => {
  if (!value) return "No time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No time";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const isMealDueToday = (value) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return date.getTime() <= endOfToday.getTime();
};

const formatAddress = (address = {}) =>
  [address?.street, address?.additionalDetails, address?.city, address?.state]
    .filter(Boolean)
    .join(", ");

const getSubscriptionLabel = (meal) =>
  meal?.subscription?.subscriptionCode ||
  meal?.subscription?.shortId ||
  meal?.subscription?.planTitle ||
  meal?.subscription?.planName ||
  `Subscription ${String(getSubscriptionGroupKey(meal)).slice(-6)}`;

const getSubscriptionGroupKey = (meal) =>
  meal?.subscription?.subscriptionId?._id ||
  meal?.subscription?.subscriptionId ||
  meal?.subscriptionId?._id ||
  meal?.subscriptionId ||
  meal?.subscription?._id ||
  meal?.subscription?.id ||
  meal?.subscriptionId?.id ||
  meal?.subscriptionKey ||
  meal?.userId?._id ||
  meal?.user?._id ||
  meal?.customerId ||
  meal?.customerPhone ||
  meal?.customerName ||
  meal?.deliveryAddressId ||
  meal?.groupId ||
  meal?._id;

const formatStatusLabel = (value, fallback = "Scheduled") => {
  const normalized = String(value || "").trim();
  if (!normalized) return fallback;
  return normalized.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
};
const getLinkedOrderStatus = (meal = {}) => {
  const dispatchStatus = String(meal?.order?.dispatch?.status || "").toLowerCase().trim();
  const orderStatus = String(meal?.order?.orderStatus || meal?.order?.status || "").toLowerCase().trim();

  if (dispatchStatus === "accepted") return "accepted";
  if (orderStatus === "picked_up") return "delivery_to_user";
  if (orderStatus === "reached_drop") return "delivery_to_user";
  if (orderStatus === "delivered") return "delivered";
  if (orderStatus === "confirmed" || orderStatus === "preparing" || orderStatus === "ready_for_pickup") return orderStatus;
  if (dispatchStatus === "unassigned") return meal?.status || "scheduled";
  return orderStatus || dispatchStatus || meal?.status || "scheduled";
};

const getLinkedOrderStatusLabel = (meal = {}) => {
  const status = getLinkedOrderStatus(meal);
  switch (status) {
    case "accepted":
      return "Accepted";
    case "delivery_to_user":
      return "Delivery to user";
    case "picked_up":
      return "Delivery to user";
    case "reached_drop":
      return "At user location";
    case "delivered":
      return "Delivered";
    case "preparing":
      return "Preparing";
    case "ready_for_pickup":
      return "Ready for pickup";
    case "confirmed":
      return "Confirmed";
    case "created":
      return "Request sent";
    case "scheduled":
      return "Scheduled";
    default:
      return formatStatusLabel(status, "Scheduled");
  }
};

const getRestaurantOrderStatus = (meal = {}) => {
  const mealStatus = String(meal?.status || "").toLowerCase().trim();
  const orderStatus = String(meal?.order?.orderStatus || meal?.order?.status || "").toLowerCase().trim();

  if (orderStatus) {
    if (orderStatus === "picked_up") return "Picked up";
    if (orderStatus === "reached_drop") return "Reached customer";
    return formatStatusLabel(orderStatus, "Scheduled");
  }

  if (mealStatus === "sent_to_delivery") return "Sent to delivery";
  return formatStatusLabel(mealStatus, "Scheduled");
};

const isAcceptedByDeliveryBoy = (meal = {}) =>
  String(meal?.order?.dispatch?.status || "").toLowerCase().trim() === "accepted";

const getMealProgressStatus = (meal = {}) => {
  const orderStatus = String(meal?.order?.orderStatus || meal?.order?.status || "").toLowerCase().trim();
  const dispatchStatus = String(meal?.order?.dispatch?.status || "").toLowerCase().trim();
  const mealStatus = String(meal?.status || "").toLowerCase().trim();

  if (["cancelled", "skipped"].includes(mealStatus) || orderStatus.includes("cancel")) return "cancelled";
  if (orderStatus === "delivered") return "delivered";
  if (["picked_up", "reached_drop"].includes(orderStatus)) return "delivery";
  if (dispatchStatus === "accepted") return "accepted";
  if (["confirmed", "preparing", "ready_for_pickup"].includes(orderStatus)) return "pending";
  if (mealStatus === "sent_to_delivery") return "accepted";
  return "pending";
};

function SubscriptionOrdersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { subscriptionId } = useParams();
  const { pickupOtpReveal, clearPickupOtpReveal } = useRestaurantNotifications();
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingScheduleIds, setSendingScheduleIds] = useState({});

  const subscriptionLabel =
    location.state?.subscriptionLabel || `Subscription ${String(subscriptionId || "").slice(-6)}`;

  useEffect(() => {
    let active = true;

    const fetchMeals = async () => {
      try {
        setLoading(true);
        const response = await restaurantAPI.getTodaySubscriptionMeals({ view: "all" });
        const rows = response?.data?.data?.schedules || [];
        if (!active) return;
        setMeals(
          rows.filter(
            (meal) =>
              String(getSubscriptionGroupKey(meal)) === String(subscriptionId) &&
              !["cancelled", "skipped"].includes(String(meal.status || "").toLowerCase()),
          ),
        );
      } catch (error) {
        if (active) setMeals([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchMeals();
    const interval = setInterval(fetchMeals, 15000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [subscriptionId]);

  const sortedMeals = useMemo(() => {
    return [...meals].sort((a, b) => {
      const timeA = new Date(a.serviceDate || a.createdAt || 0).getTime();
      const timeB = new Date(b.serviceDate || b.createdAt || 0).getTime();
      return timeA - timeB;
    });
  }, [meals]);

  const groupedMeals = useMemo(() => {
    const groups = new Map();

    for (const meal of sortedMeals) {
      const key = String(getSubscriptionGroupKey(meal));
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: getSubscriptionLabel(meal),
          meal,
          items: [],
        });
      }

      groups.get(key).items.push(meal);
    }

    return Array.from(groups.values());
  }, [sortedMeals]);

  const [activeTab, setActiveTab] = useState("all");

  const visibleGroups = useMemo(() => {
    if (activeTab === "all") return groupedMeals;
    return groupedMeals
      .map((group) => ({
        ...group,
        items: group.items.filter((meal) => getMealProgressStatus(meal) === activeTab),
      }))
      .filter((group) => group.items.length > 0);
  }, [activeTab, groupedMeals]);

  const tabCounts = useMemo(() => {
    const counts = { all: 0, pending: 0, accepted: 0, delivery: 0, delivered: 0, cancelled: 0 };
    for (const group of groupedMeals) {
      counts.all += group.items.length;
      for (const meal of group.items) {
        const status = getMealProgressStatus(meal);
        if (counts[status] != null) counts[status] += 1;
      }
    }
    return counts;
  }, [groupedMeals]);

  const summary = useMemo(() => {
    const total = sortedMeals.length;
    const sent = sortedMeals.filter((meal) => meal.status === "sent_to_delivery").length;
    const active = total - sent;
    return { total, sent, active };
  }, [sortedMeals]);

  const activePickupOtpReveal = useMemo(() => {
    if (!pickupOtpReveal || !Array.isArray(sortedMeals) || sortedMeals.length === 0) {
      return null;
    }

    const revealIds = [
      pickupOtpReveal?.orderMongoId,
      pickupOtpReveal?.orderId,
      pickupOtpReveal?._id,
      pickupOtpReveal?.id,
    ]
      .map((value) => (value == null ? "" : String(value).trim()))
      .filter(Boolean);

    if (revealIds.length === 0) return null;

    const matchesSubscription = sortedMeals.some((meal) => {
      const mealOrderIds = [
        meal?.order?._id,
        meal?.order?.id,
        meal?.order?.order_id,
        meal?.order?.orderId,
      ]
        .map((value) => (value == null ? "" : String(value).trim()))
        .filter(Boolean);

      return mealOrderIds.some((id) => revealIds.includes(id));
    });

    return matchesSubscription ? pickupOtpReveal : null;
  }, [pickupOtpReveal, sortedMeals]);


  const subscriptionMeta = useMemo(() => {
    const firstMeal = sortedMeals[0] || {};
    const address = formatAddress(firstMeal.subscription?.deliveryAddress);

    return {
      customerName: firstMeal.subscription?.customerName || firstMeal.user?.name || "Customer",
      customerPhone: firstMeal.subscription?.customerPhone || firstMeal.user?.phone || "",
      address,
      label: getSubscriptionLabel(firstMeal),
    };
  }, [sortedMeals]);

  const handleSendMeal = async (meal) => {
    const scheduleId = meal.scheduleId || meal._id;
    if (!scheduleId || sendingScheduleIds[scheduleId]) return;

    try {
      setSendingScheduleIds((prev) => ({ ...prev, [scheduleId]: true }));
      await restaurantAPI.sendSubscriptionMealToDelivery(scheduleId);
      toast.success("Subscription meal sent to delivery");
      const response = await restaurantAPI.getTodaySubscriptionMeals({ view: "all" });
      const rows = response?.data?.data?.schedules || [];
      setMeals(
        rows.filter(
          (item) =>
            String(getSubscriptionGroupKey(item)) === String(subscriptionId) &&
            !["cancelled", "skipped"].includes(String(item.status || "").toLowerCase()),
        ),
      );
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to send subscription meal");
    } finally {
      setSendingScheduleIds((prev) => {
        const next = { ...prev };
        delete next[scheduleId];
        return next;
      });
    }
  };

  const handleResendMealRequest = async (meal) => {
    const targetScheduleId = meal.scheduleId || meal._id;
    if (!targetScheduleId || sendingScheduleIds[`resend-${targetScheduleId}`]) return;

    try {
      setSendingScheduleIds((prev) => ({
        ...prev,
        [`resend-${targetScheduleId}`]: true,
      }));
      await restaurantAPI.sendSubscriptionMealToDelivery(targetScheduleId);
      toast.success("Delivery boy request sent again");
      const response = await restaurantAPI.getTodaySubscriptionMeals({ view: "all" });
      const rows = response?.data?.data?.schedules || [];
      setMeals(
        rows.filter(
          (item) =>
            String(getSubscriptionGroupKey(item)) === String(subscriptionId) &&
            !["cancelled", "skipped"].includes(String(item.status || "").toLowerCase()),
        ),
      );
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to resend delivery request");
    } finally {
      setSendingScheduleIds((prev) => {
        const next = { ...prev };
        delete next[`resend-${targetScheduleId}`];
        return next;
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-4">
      <div className="mx-auto max-w-3xl">
        <button
          type="button"
          onClick={() => navigate("/food/restaurant")}
          className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-bold text-gray-700 shadow-sm">
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-primary-orange">Subscription</p>
          <h1 className="mt-1 text-lg font-black text-gray-900">{subscriptionLabel}</h1>
          <p className="mt-1 text-sm text-gray-500">All scheduled meals for this subscription appear here.</p>

          <div className="mt-3 rounded-2xl border border-gray-100 bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Customer details</p>
            <div className="mt-2 grid gap-1 text-sm text-gray-700">
              <p><span className="font-bold text-gray-900">Subscription:</span> {subscriptionMeta.label}</p>
              <p><span className="font-bold text-gray-900">Customer:</span> {subscriptionMeta.customerName}</p>
              {subscriptionMeta.customerPhone && (
                <p><span className="font-bold text-gray-900">Phone:</span> {subscriptionMeta.customerPhone}</p>
              )}
              {subscriptionMeta.address && (
                <p className="line-clamp-2"><span className="font-bold text-gray-900">Address:</span> {subscriptionMeta.address}</p>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{summary.total} meals</span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{summary.sent} sent</span>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">{summary.active} active</span>
          </div>
        </div>

        {activePickupOtpReveal && (
          <div className="mb-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Pickup OTP requested</p>
                <p className="mt-1 text-sm text-emerald-900">
                  Delivery boy asked for the pickup OTP for Order #{activePickupOtpReveal.orderId || ""}
                </p>
                <div className="mt-3 inline-flex rounded-2xl border border-emerald-200 bg-white px-4 py-3">
                  <span className="text-3xl font-black tracking-[0.3em] text-emerald-800">
                    {activePickupOtpReveal.otp}
                  </span>
                </div>
                <p className="mt-3 text-xs font-medium text-emerald-800">
                  Share this OTP with the delivery boy to complete pickup.
                </p>
              </div>
              <button
                type="button"
                onClick={clearPickupOtpReveal}
                className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700 shadow-sm">
                Hide
              </button>
            </div>
          </div>
        )}

        <div className="mb-4 flex gap-2 overflow-x-auto rounded-full bg-transparent py-1">
          {detailTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const count = tabCounts[tab.id] || 0;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide transition-colors ${isActive ? "bg-primary-orange text-white shadow-sm" : "bg-white text-gray-600 shadow-sm"
                  }`}>
                {tab.label}
                <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] ${isActive ? "bg-white/20" : "bg-gray-100"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex items-center justify-center rounded-2xl bg-white py-12 shadow-sm">
            <Loader2 className="h-6 w-6 animate-spin text-primary-orange" />
          </div>
        ) : visibleGroups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-5 py-10 text-center shadow-sm">
            <p className="text-sm font-bold text-gray-900">No meals found for this filter</p>
            <p className="mt-1 text-xs text-gray-500">Try another tab to see different order states.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleGroups.map((group) => {
              const activeLabel = activeTab === "all" ? "All" : detailTabs.find((tab) => tab.id === activeTab)?.label;

              return (
                <div
                  key={group.key}
                  className="rounded-3xl border border-gray-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-white/70">
                  <div className="flex items-start justify-between gap-3 border-b border-dashed border-gray-200 pb-3">
                    <div className="min-w-0 border-l-4 border-primary-orange/80 pl-3">
                      <p className="text-sm font-black text-gray-900">{group.label}</p>
                      <p className="mt-1 text-xs text-gray-500">{group.items.length} matching orders</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase text-slate-600">
                      {activeLabel}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    {group.items.map((meal) => {
                      const scheduleId = meal.scheduleId || meal._id;
                      const sent = meal.status === "sent_to_delivery";
                      const cancelled = ["cancelled", "skipped"].includes(String(meal.status || "").toLowerCase());
                      const canSend = !sent && !cancelled && isMealDueToday(meal.serviceDate);
                      const linkedOrderStatus = getLinkedOrderStatus(meal);
                      const linkedOrderStatusLabel = getLinkedOrderStatusLabel(meal);
                      const acceptedByDeliveryBoy = isAcceptedByDeliveryBoy(meal);
                      const canResend = sent && !acceptedByDeliveryBoy;
                      const statusBadgeClass =
                        linkedOrderStatus === "delivered"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : linkedOrderStatus === "accepted"
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : linkedOrderStatus === "delivery_to_user" || linkedOrderStatus === "picked_up"
                              ? "border-violet-200 bg-violet-50 text-violet-700"
                              : cancelled
                                ? "border-red-200 bg-red-50 text-red-600"
                                : sent
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : "border-slate-200 bg-slate-50 text-slate-700";

                      return (
                        <div
                          key={scheduleId}
                          className="rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-slate-50 p-3 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 border-l-4 border-primary-orange/80 pl-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-bold text-gray-900">{meal.dishName || "Subscription meal"}</p>
                                <span className="rounded-full bg-primary-orange/10 px-2 py-0.5 text-[10px] font-black uppercase text-primary-orange">
                                  {meal.mealName || "Meal"}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-gray-500">{formatDateTime(meal.serviceDate)}</p>
                              <p className="mt-2 text-xs text-gray-500">Schedule ID: {scheduleId}</p>
                              {meal.order?._id && (
                                <p className="mt-1 text-xs text-gray-500">Linked order: {meal.order.order_id || meal.order._id}</p>
                              )}
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase ${statusBadgeClass}`}>
                              {linkedOrderStatusLabel}
                            </span>
                          </div>

                          {meal.order && (
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Order status</p>
                                <p className="mt-1 text-sm font-bold text-slate-900">
                                  {getRestaurantOrderStatus(meal)}
                                </p>
                              </div>
                              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Delivery status</p>
                                <p className="mt-1 text-sm font-bold text-slate-900">{linkedOrderStatusLabel}</p>
                              </div>
                            </div>
                          )}

                          {meal.notes && (
                            <div className="mt-3 rounded-2xl border border-dashed border-gray-200 bg-white p-3">
                              <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Notes</p>
                              <p className="mt-1 text-sm text-gray-700">{meal.notes}</p>
                            </div>
                          )}

                          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <button
                              type="button"
                              disabled={!canSend || sendingScheduleIds[scheduleId]}
                              onClick={() => handleSendMeal(meal)}
                              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary-orange text-sm font-bold text-white shadow-sm transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:bg-gray-200 disabled:text-gray-500">
                              {sendingScheduleIds[scheduleId] ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                              {sent ? "Already sent" : canSend ? "Send to delivery boy" : "Available on service day"}
                            </button>
                            {canResend ? (
                              <button
                                type="button"
                                disabled={sendingScheduleIds[`resend-${scheduleId}`]}
                                onClick={() => handleResendMealRequest(meal)}
                                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 text-sm font-bold text-red-700 shadow-sm transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:bg-gray-100 disabled:text-gray-400">
                                {sendingScheduleIds[`resend-${scheduleId}`] ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Send className="h-4 w-4" />
                                )}
                                Resend request
                              </button>
                            ) : sent ? (
                              <div className="flex h-10 w-full items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-bold text-emerald-700">
                                {acceptedByDeliveryBoy ? "Accepted by delivery boy" : "Sent to delivery"}
                              </div>
                            ) : (
                              <div className="hidden sm:block" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default SubscriptionOrdersPage;
