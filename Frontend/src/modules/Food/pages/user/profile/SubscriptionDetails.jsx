import { useEffect, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Clock3, CreditCard, MapPin, Store, Utensils } from "lucide-react";
import { toast } from "sonner";
import { subscriptionAPI } from "@food/api";
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

const getScheduleDate = (schedule) =>
  schedule?.serviceDate || schedule?.deliveryDate || schedule?.scheduledFor || schedule?.date || null;

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
  const location = useLocation();
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
    if (!subscriptionId) return;
    refreshSubscriptions({ silent: false }).catch(() => {});
  }, [subscriptionId, refreshSubscriptions]);

  useEffect(() => {
    const selectedAddress = location.state?.selectedDeliveryAddress;
    if (!selectedAddress || !subscriptionId) return;

    let active = true;
    subscriptionAPI
      .changeAddress(subscriptionId, { deliveryAddress: selectedAddress })
      .then(() => {
        if (!active) return;
        toast.success("Delivery address updated for upcoming meals");
        refreshSubscriptions({ silent: true }).catch(() => {});
        navigate(location.pathname, { replace: true, state: null });
      })
      .catch((error) => {
        if (!active) return;
        toast.error(error?.response?.data?.message || "Failed to update delivery address");
        navigate(location.pathname, { replace: true, state: null });
      });

    return () => {
      active = false;
    };
  }, [location.pathname, location.state, navigate, refreshSubscriptions, subscriptionId]);

  const nextSchedule = useMemo(() => schedules[0] || null, [schedules]);
  const nextDeliveryAddress = getAddressText(
    nextSchedule?.subscription?.deliveryAddress ||
      nextSchedule?.deliveryAddress ||
      subscription.deliveryAddress ||
      subscription.address ||
      {},
  );

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

  const openDishChange = (schedule) => {
    const scheduleId = schedule?.scheduleId || schedule?._id;
    if (!scheduleId) return;
    navigate(`/food/user/profile/subscriptions/${subscriptionId}/change-dish/${scheduleId}`);
  };

  if (loading) {
    return (
      <AnimatedPage className="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a]">
        <div className="max-w-md mx-auto px-4 py-4 pb-24">
          <Card className="rounded-[20px] border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-[#1a1a1a]">
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
          <Card className="rounded-[20px] border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-[#1a1a1a]">
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
        <div className="sticky top-0 z-40 -mx-4 mb-4 flex items-center gap-3 border-b border-gray-200/80 bg-[#f5f5f5]/95 px-4 py-3 backdrop-blur-md dark:border-gray-800/80 dark:bg-[#0a0a0a]/95">
          <Button variant="ghost" size="icon" className="h-8 w-8 p-0" onClick={goBackToSubscriptions}>
            <ArrowLeft className="h-5 w-5 text-black dark:text-white" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Subscription details</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">{subscription.restaurantName || "Restaurant"}</p>
          </div>
        </div>

        <div className="space-y-3">
          <Card className="rounded-[20px] border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-[#1a1a1a]">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-[#e3282c] dark:bg-red-950/30 dark:text-red-300">
                  <Utensils className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">
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
                  <p className="flex items-center gap-1 text-[11px] font-medium text-gray-500">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Plan
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                    {subscription.planTitle || `${subscription.planDays} Days`}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900/60">
                  <p className="flex items-center gap-1 text-[11px] font-medium text-gray-500">
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

          <Card className="rounded-[20px] border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-[#1a1a1a]">
            <CardContent className="p-4 space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-500">Duration</p>
                <p className="mt-1 flex items-center gap-2 text-sm text-gray-900 dark:text-white">
                  <Clock3 className="h-4 w-4 text-[#e3282c]" />
                  {formatDate(subscription.startDate)} to {formatDate(subscription.endDate)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Meals</p>
                <p className="mt-1 text-sm text-gray-900 dark:text-white">
                  {Array.isArray(subscription.meals) && subscription.meals.length > 0
                    ? subscription.meals.join(", ")
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Delivery address</p>
                <p className="mt-1 flex items-start gap-2 text-sm text-gray-900 dark:text-white">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#e3282c]" />
                  <span>{getAddressText(subscription.deliveryAddress || subscription.address || {}) || "No address selected"}</span>
                </p>
                <Button variant="outline" className="mt-3 rounded-xl" onClick={openAddressSelector}>
                  Change for upcoming meals
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[20px] border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-[#1a1a1a]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500">Next delivery</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                    {nextSchedule ? formatDateTime(getScheduleDate(nextSchedule)) : "No upcoming delivery"}
                  </p>
                  <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#e3282c]" />
                    <span>{nextDeliveryAddress || "No delivery address selected"}</span>
                  </p>
                </div>
                <div className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium capitalize text-[#e3282c] dark:bg-red-950/30 dark:text-red-300">
                  {subscription.status || "pending"}
                </div>
              </div>

              {schedules.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {schedules.map((schedule) => (
                    <div
                      key={schedule._id || schedule.scheduleId || `${getScheduleDate(schedule)}-${schedule.mealName || schedule.slot || "meal"}`}
                      className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm dark:border-gray-800 dark:bg-gray-900/60"
                    >
                      <p className="font-medium text-gray-900 dark:text-white">
                        {formatDateTime(getScheduleDate(schedule))}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {schedule.dishName || subscription.dishName || "Meal"}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="text-[11px] font-medium text-gray-400">
                          {schedule.canChangeDish === false
                            ? "Dish change window closed"
                            : "You can change this meal"}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 rounded-lg px-3 text-xs font-medium text-[#e3282c]"
                          disabled={schedule.canChangeDish === false}
                          onClick={() => openDishChange(schedule)}
                        >
                          Change dish
                        </Button>
                      </div>
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
