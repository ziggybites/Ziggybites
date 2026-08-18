import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Clock3, CreditCard, MapPin, Store, Utensils } from "lucide-react";
import AnimatedPage from "@food/components/user/AnimatedPage";
import { Card, CardContent } from "@food/components/ui/card";
import { Button } from "@food/components/ui/button";
import { useSubscriptions } from "@food/context/SubscriptionsContext";

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getAddressText = (address = {}) =>
  [
    address.street || address.address || address.formattedAddress,
    address.additionalDetails,
    address.city,
    address.state,
    address.zipCode || address.postalCode,
  ]
    .filter(Boolean)
    .join(", ");

export default function SubscriptionDetails() {
  const navigate = useNavigate();
  const { subscriptionId } = useParams();
  const {
    loading,
    getSubscriptionById,
    getSchedulesForSubscription,
    refreshSubscriptions,
  } = useSubscriptions();

  const subscription = getSubscriptionById(subscriptionId);
  const schedules = getSchedulesForSubscription(subscriptionId);

  useEffect(() => {
    if (!subscription && subscriptionId) {
      refreshSubscriptions({ silent: false }).catch(() => {});
    }
  }, [subscription, subscriptionId, refreshSubscriptions]);

  const nextSchedule = useMemo(() => schedules[0] || null, [schedules]);

  const goBackToSubscriptions = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/food/user/profile/subscriptions", { replace: true });
  };

  const openAddressSelector = () => {
    navigate("/food/user/address-selector", {
      state: {
        mode: "subscription-address",
        subscriptionId,
        returnTo: `/food/user/profile/subscriptions/${subscriptionId}`,
        backTo: `/food/user/profile/subscriptions/${subscriptionId}`,
      },
    });
  };

  if (loading) {
    return (
      <AnimatedPage className="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a]">
        <div className="max-w-md mx-auto px-4 py-4 pb-24">
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="p-6 text-center text-sm text-gray-400">
              Loading subscription...
            </CardContent>
          </Card>
        </div>
      </AnimatedPage>
    );
  }

  if (!subscription) {
    return (
      <AnimatedPage className="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a]">
        <div className="max-w-md mx-auto px-4 py-4 pb-24">
          <Button variant="ghost" className="mb-4 px-0" onClick={goBackToSubscriptions}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="p-6 text-center text-sm text-gray-500">
              Subscription not found.
            </CardContent>
          </Card>
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage className="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a]">
      <div className="max-w-md mx-auto px-4 py-4 pb-24">
        <div className="mb-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 p-0" onClick={goBackToSubscriptions}>
            <ArrowLeft className="h-5 w-5 text-black dark:text-white" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Subscription details</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">{subscription.restaurantName || "Restaurant"}</p>
          </div>
        </div>

        <div className="space-y-3">
          <Card className="rounded-2xl border-0 bg-white shadow-sm dark:bg-[#1a1a1a]">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#55254b]/10 text-[#55254b]">
                  <Utensils className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">
                    {subscription.dishName || "Subscription meal"}
                  </h2>
                  <p className="mt-1 flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                    <Store className="h-4 w-4" />
                    {subscription.restaurantName || "Restaurant"}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900/60">
                  <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Plan
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                    {subscription.planTitle || `${subscription.planDays} Days`}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900/60">
                  <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <CreditCard className="h-3.5 w-3.5" />
                    Amount
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                    Rs. {Number(subscription.totalAmount || 0).toFixed(0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 bg-white shadow-sm dark:bg-[#1a1a1a]">
            <CardContent className="p-4 space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Duration</p>
                <p className="mt-1 flex items-center gap-2 text-sm text-gray-900 dark:text-white">
                  <Clock3 className="h-4 w-4 text-[#55254b]" />
                  {formatDate(subscription.startDate)} to {formatDate(subscription.endDate)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Meals</p>
                <p className="mt-1 text-sm text-gray-900 dark:text-white">
                  {Array.isArray(subscription.meals) && subscription.meals.length > 0
                    ? subscription.meals.join(", ")
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Delivery address</p>
                <p className="mt-1 flex items-start gap-2 text-sm text-gray-900 dark:text-white">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#55254b]" />
                  <span>{getAddressText(subscription.deliveryAddress || subscription.address || {}) || "No address selected"}</span>
                </p>
                <Button variant="outline" className="mt-3 rounded-xl" onClick={openAddressSelector}>
                  Change address
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 bg-white shadow-sm dark:bg-[#1a1a1a]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Next delivery</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                    {nextSchedule ? formatDateTime(nextSchedule.deliveryDate || nextSchedule.scheduledFor) : "No upcoming delivery"}
                  </p>
                </div>
                <div className="rounded-full bg-[#55254b]/10 px-3 py-1 text-xs font-semibold text-[#55254b]">
                  {subscription.status || "pending"}
                </div>
              </div>

              {schedules.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {schedules.map((schedule) => (
                    <div
                      key={schedule._id || schedule.scheduleId || `${schedule.deliveryDate}-${schedule.slot}`}
                      className="rounded-xl bg-gray-50 p-3 text-sm dark:bg-gray-900/60"
                    >
                      <p className="font-medium text-gray-900 dark:text-white">
                        {formatDateTime(schedule.deliveryDate || schedule.scheduledFor)}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {schedule.dishName || subscription.dishName || "Meal"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">No upcoming schedules available.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AnimatedPage>
  );
}
