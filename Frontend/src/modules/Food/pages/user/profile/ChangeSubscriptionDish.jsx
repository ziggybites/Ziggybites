import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Check, Clock3, Store } from "lucide-react";
import AnimatedPage from "@food/components/user/AnimatedPage";
import { Button } from "@food/components/ui/button";
import { Card, CardContent } from "@food/components/ui/card";
import { subscriptionAPI } from "@food/api";

const FOOD_IMAGE_FALLBACK = "https://picsum.photos/seed/food-fallback/800/600";

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

const getDishId = (dish) => String(dish?.id || dish?._id || dish?.dishId || "");

const getDishImage = (dish) =>
  dish?.image || dish?.imageUrl || dish?.photo || dish?.thumbnail || "";

const isVegDish = (dish) => {
  const type = String(dish?.foodType || dish?.type || "").toLowerCase();
  return dish?.isVeg === true || type === "veg" || type === "vegetarian";
};

export default function ChangeSubscriptionDish() {
  const navigate = useNavigate();
  const { subscriptionId, scheduleId } = useParams();
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);

  const returnPath = `/food/user/profile/subscriptions/${subscriptionId}`;

  const loadSchedule = async () => {
    setLoading(true);
    try {
      const response = await subscriptionAPI.getUpcomingSchedules();
      const schedules =
        response?.data?.data?.schedules ||
        response?.data?.schedules ||
        [];
      const current = (Array.isArray(schedules) ? schedules : []).find(
        (item) => String(item.scheduleId || item._id) === String(scheduleId),
      );
      setSchedule(current || null);
    } catch {
      setSchedule(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedule();
  }, [scheduleId]);

  const dishes = useMemo(() => {
    const list = Array.isArray(schedule?.availableDishes) ? schedule.availableDishes : [];
    const currentDish = schedule?.dishId
      ? {
        id: schedule.dishId,
        name: schedule.dishName,
        price: schedule.price || schedule.subscription?.creditPerOrder,
        image: schedule.image || "",
        foodType: schedule.foodType,
      }
      : null;

    const merged = currentDish ? [currentDish, ...list] : list;
    const seen = new Set();
    return merged.filter((dish) => {
      const id = getDishId(dish);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [schedule]);

  const openCheckout = (dish) => {
    const dishId = getDishId(dish);
    if (!dishId || dishId === String(schedule?.dishId || "")) return;
    navigate(
      `/food/user/profile/subscriptions/${subscriptionId}/change-dish/${scheduleId}/checkout/${dishId}`,
    );
  };

  if (loading) {
    return (
      <AnimatedPage className="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a]">
        <div className="mx-auto max-w-md px-4 py-4 pb-24">
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="p-6 text-center text-sm text-gray-400">
              Loading dishes...
            </CardContent>
          </Card>
        </div>
      </AnimatedPage>
    );
  }

  if (!schedule) {
    return (
      <AnimatedPage className="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a]">
        <div className="mx-auto max-w-md px-4 py-4 pb-24">
          <Button variant="ghost" className="mb-4 px-0" onClick={() => navigate(returnPath, { replace: true })}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="p-6 text-center text-sm text-gray-500">
              Subscription meal not found.
            </CardContent>
          </Card>
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage className="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a]">
      <div className="mx-auto max-w-md px-4 py-4 pb-24">
        <div className="mb-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 p-0"
            onClick={() => navigate(returnPath, { replace: true })}
          >
            <ArrowLeft className="h-5 w-5 text-black dark:text-white" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Change dish</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {schedule.mealName || "Subscription meal"} - {formatDate(schedule.serviceDate)}
            </p>
          </div>
        </div>

        <Card className="mb-3 rounded-2xl border-0 bg-white shadow-sm dark:bg-[#1a1a1a]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
              <Store className="h-4 w-4 text-[#55254b]" />
              {schedule.subscription?.restaurantName || schedule.restaurantName || "Restaurant"}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 dark:bg-gray-900">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(schedule.serviceDate)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 dark:bg-gray-900">
                <Clock3 className="h-3.5 w-3.5" />
                Change before {formatDateTime(schedule.dishChangeDeadline)}
              </span>
            </div>
          </CardContent>
        </Card>

        {!schedule.canChangeDish ? (
          <Card className="rounded-2xl border-0 bg-white shadow-sm dark:bg-[#1a1a1a]">
            <CardContent className="p-6 text-center text-sm text-gray-500">
              Dish change is closed for this meal.
            </CardContent>
          </Card>
        ) : dishes.length === 0 ? (
          <Card className="rounded-2xl border-0 bg-white shadow-sm dark:bg-[#1a1a1a]">
            <CardContent className="p-6 text-center text-sm text-gray-500">
              No dishes available to change.
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-[#1a1a1a]">
            {dishes.map((dish) => {
              const dishId = getDishId(dish);
              const selected = dishId === String(schedule.dishId || "");
              const veg = isVegDish(dish);
              const image = getDishImage(dish);

              return (
                <button
                  key={dishId}
                  type="button"
                  disabled={selected}
                  onClick={() => openCheckout(dish)}
                  className={`flex w-full gap-4 border-b border-gray-100 p-4 text-left last:border-none transition-colors dark:border-gray-800 ${selected
                      ? "bg-[#55254b]/5"
                      : "bg-white hover:bg-[#55254b]/5 dark:bg-[#1a1a1a] dark:hover:bg-[#55254b]/10"
                    } disabled:cursor-default`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm border-2 ${veg ? "border-green-600" : "border-red-600"
                          }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${veg ? "bg-green-600" : "bg-red-600"}`} />
                      </span>
                      {selected && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#55254b] px-2 py-0.5 text-[10px] font-bold text-white">
                          <Check className="h-3 w-3" />
                          Current
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-bold leading-tight text-gray-900 dark:text-white">
                      {dish.name || "Subscription dish"}
                    </h2>
                    <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                      Rs. {Number(dish.price || 0).toFixed(0)}
                    </p>
                    {dish.categoryName && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{dish.categoryName}</p>
                    )}
                    {dish.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
                        {dish.description}
                      </p>
                    )}
                  </div>

                  <div className="relative h-32 w-32 flex-shrink-0">
                    {image ? (
                      <img
                        src={image}
                        alt={dish.name || "Dish"}
                        className="h-full w-full rounded-2xl object-cover shadow-sm"
                        onError={(event) => {
                          if (event.currentTarget.src !== FOOD_IMAGE_FALLBACK) {
                            event.currentTarget.src = FOOD_IMAGE_FALLBACK;
                          }
                        }}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-2xl bg-gray-200 dark:bg-gray-700">
                        <span className="text-xs text-gray-400">No image</span>
                      </div>
                    )}
                    {!selected && (
                      <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-lg bg-[#55254b] px-5 py-1.5 text-sm font-bold text-white shadow-md">
                        CHANGE
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AnimatedPage>
  );
}
