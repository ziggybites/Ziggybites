import { useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarDays, CheckCircle2, ChevronRight, Clock3, CreditCard, Store } from "lucide-react";
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

const getStatusClasses = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "active") return "bg-green-50 text-green-700 border-green-200";
  if (normalized.includes("failed")) return "bg-red-50 text-red-700 border-red-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
};

export default function MySubscriptions() {
  const navigate = useNavigate();
  const { subscriptions, loading, refreshSubscriptions } = useSubscriptions();

  useEffect(() => {
    refreshSubscriptions({ silent: false }).catch(() => {});
  }, [refreshSubscriptions]);

  const activeCount = useMemo(
    () =>
      subscriptions.filter(
        (subscription) => String(subscription?.status || "").toLowerCase() === "active",
      ).length,
    [subscriptions],
  );

  return (
    <AnimatedPage className="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a]">
      <div className="max-w-md mx-auto px-4 py-4 pb-24">
        <div className="sticky top-0 z-40 -mx-4 mb-4 flex items-center gap-3 border-b border-gray-200/80 bg-[#f5f5f5]/95 px-4 py-3 backdrop-blur-md dark:border-gray-800/80 dark:bg-[#0a0a0a]/95">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 p-0"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5 text-black dark:text-white" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              Purchased Subscriptions
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {activeCount} active plan{activeCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {loading ? (
          <Card className="rounded-[20px] border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-[#1a1a1a]">
            <CardContent className="p-6 text-center text-sm text-gray-400">
              Loading subscriptions...
            </CardContent>
          </Card>
        ) : subscriptions.length === 0 ? (
          <Card className="rounded-[20px] border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-[#1a1a1a]">
            <CardContent className="p-6 text-center">
              <p className="text-base font-medium text-gray-900 dark:text-white">
                No subscriptions purchased yet
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Choose a dish and plan to start your meal subscription.
              </p>
              <Link to="/food/user" className="inline-block mt-4">
                <Button className="rounded-xl bg-[#e3282c] text-white hover:bg-[#c92226]">
                  Explore meals
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {subscriptions.map((subscription) => {
              const id = subscription.subscriptionId || subscription._id;
              return (
                <Link key={id} to={`/food/user/profile/subscriptions/${id}`} className="block">
                <Card className="rounded-[20px] border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-[#1a1a1a]">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="truncate text-base font-semibold text-gray-900 dark:text-white">
                            {subscription.dishName || "Subscription meal"}
                          </h2>
                          <p className="mt-1 flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 truncate">
                            <Store className="h-4 w-4" />
                            {subscription.restaurantName || "Restaurant"}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium capitalize ${getStatusClasses(subscription.status)}`}
                        >
                          {subscription.status || "pending"}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-gray-50 dark:bg-gray-900/60 p-3">
                          <p className="flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                            <CalendarDays className="h-3.5 w-3.5" />
                            Plan
                          </p>
                            <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                            {subscription.planTitle || `${subscription.planDays} Days`}
                          </p>
                        </div>
                        <div className="rounded-xl bg-gray-50 dark:bg-gray-900/60 p-3">
                          <p className="flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                            <CreditCard className="h-3.5 w-3.5" />
                            Amount
                          </p>
                          <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                            Rs. {Number(subscription.totalAmount || 0).toFixed(0)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                        <p className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          Meals: <span className="font-medium">{Array.isArray(subscription.meals) && subscription.meals.length > 0 ? subscription.meals.join(", ") : "-"}</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <Clock3 className="h-4 w-4 text-[#e3282c]" />
                          Active: <span className="font-medium">{formatDate(subscription.startDate)} to {formatDate(subscription.endDate)}</span>
                        </p>
                      </div>

                      <div className="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>ID: {id || "-"}</span>
                        <span className="inline-flex items-center gap-1 text-sm text-[#e3282c] dark:text-red-300">
                          Details
                          <ChevronRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AnimatedPage>
  );
}
