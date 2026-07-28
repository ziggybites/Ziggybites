import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, CreditCard, Plus, Wallet } from "lucide-react";
import AnimatedPage from "@food/components/user/AnimatedPage";
import { Button } from "@food/components/ui/button";
import { Card, CardContent } from "@food/components/ui/card";
import { subscriptionAPI } from "@food/api";
import { initRazorpayPayment } from "@food/utils/razorpay";
import { toast } from "sonner";

const FOOD_IMAGE_FALLBACK = "https://picsum.photos/seed/food-fallback/800/600";

const formatCurrency = (value) => `Rs. ${Number(value || 0).toFixed(0)}`;

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

const getDishId = (dish) => String(dish?.id || dish?._id || dish?.dishId || "");

const getDishImage = (dish) =>
  dish?.image || dish?.imageUrl || dish?.photo || dish?.thumbnail || "";

const getDishPrice = (dish, fallback = 0) => Math.max(0, Number(dish?.price ?? fallback ?? 0));

export default function ChangeSubscriptionDishCheckout() {
  const navigate = useNavigate();
  const { subscriptionId, scheduleId, dishId } = useParams();
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const detailsPath = `/food/user/profile/subscriptions/${subscriptionId}`;
  const changePath = `/food/user/profile/subscriptions/${subscriptionId}/change-dish/${scheduleId}`;

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

  const availableDishes = useMemo(
    () => (Array.isArray(schedule?.availableDishes) ? schedule.availableDishes : []),
    [schedule],
  );

  const selectedDish = useMemo(() => {
    return availableDishes.find((dish) => getDishId(dish) === String(dishId)) || null;
  }, [availableDishes, dishId]);

  const currentDish = useMemo(() => {
    const currentFromList =
      availableDishes.find((dish) => getDishId(dish) === String(schedule?.dishId || "")) || {};
    return {
      ...currentFromList,
      id: schedule?.dishId,
      name: currentFromList.name || schedule?.dishName || "Current dish",
      price:
        currentFromList.price ??
        schedule?.price ??
        schedule?.subscription?.creditPerOrder ??
        0,
      image: getDishImage(currentFromList) || schedule?.image || "",
    };
  }, [availableDishes, schedule]);

  const oldPrice = getDishPrice(currentDish, schedule?.subscription?.creditPerOrder);
  const newPrice = getDishPrice(selectedDish);
  const priceDifference = Number((newPrice - oldPrice).toFixed(2));
  const payableAmount = Math.max(0, priceDifference);
  const walletCreditAmount = Math.max(0, Math.abs(Math.min(0, priceDifference)));
  const isUpgrade = priceDifference > 0;
  const isDowngrade = priceDifference < 0;

  const handleConfirm = async () => {
    if (!selectedDish || submitting) return;
    try {
      setSubmitting(true);
      const response = await subscriptionAPI.changeScheduleDish(scheduleId, { dishId });
      const payload = response?.data?.data || {};

      if (payload.status === "payment_required" && payload.razorpay) {
        await initRazorpayPayment({
          key: payload.razorpay.key,
          amount: payload.razorpay.amount,
          currency: payload.razorpay.currency || "INR",
          order_id: payload.razorpay.orderId,
          name: "ZiggyBites",
          description: "Subscription dish change",
          notes: { scheduleId },
          handler: async (razorpayResponse) => {
            try {
              await subscriptionAPI.verifyDishChangePayment(scheduleId, {
                razorpayOrderId: razorpayResponse.razorpay_order_id || payload.razorpay.orderId,
                razorpayPaymentId: razorpayResponse.razorpay_payment_id,
                razorpaySignature: razorpayResponse.razorpay_signature,
              });
              toast.success("Dish changed successfully");
              navigate(detailsPath, { replace: true });
            } catch (error) {
              toast.error(error?.response?.data?.message || "Payment verification failed");
            } finally {
              setSubmitting(false);
            }
          },
          onError: (error) => {
            toast.error(error?.description || error?.message || "Payment failed");
            setSubmitting(false);
          },
          onClose: () => {
            toast.info("Payment was not completed");
            setSubmitting(false);
          },
        });
        return;
      }

      toast.success(
        payload.status === "wallet_credited"
          ? "Dish changed and price difference added to wallet"
          : "Dish changed successfully",
      );
      navigate(detailsPath, { replace: true });
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to change dish");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AnimatedPage className="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a]">
        <div className="mx-auto max-w-md px-4 py-4 pb-24">
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="p-6 text-center text-sm text-gray-400">
              Loading checkout...
            </CardContent>
          </Card>
        </div>
      </AnimatedPage>
    );
  }

  if (!schedule || !selectedDish) {
    return (
      <AnimatedPage className="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a]">
        <div className="mx-auto max-w-md px-4 py-4 pb-24">
          <Button variant="ghost" className="mb-4 px-0" onClick={() => navigate(changePath, { replace: true })}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="p-6 text-center text-sm text-gray-500">
              Selected dish is not available.
            </CardContent>
          </Card>
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage className="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a]">
      <div className="mx-auto max-w-md px-4 py-4 pb-44 md:pb-28">
        <div className="mb-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 p-0"
            onClick={() => navigate(changePath, { replace: true })}
          >
            <ArrowLeft className="h-5 w-5 text-black dark:text-white" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Change checkout</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {schedule.mealName || "Subscription meal"} - {formatDate(schedule.serviceDate)}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Card className="rounded-2xl border-0 bg-white shadow-sm dark:bg-[#1a1a1a]">
            <CardContent className="p-4">
              <p className="mb-3 text-sm font-bold text-gray-900 dark:text-white">Dish change</p>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <DishPreview dish={currentDish} label="Current" />
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-900">
                  <Plus className="h-4 w-4 rotate-45" />
                </div>
                <DishPreview dish={selectedDish} label="New" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 bg-white shadow-sm dark:bg-[#1a1a1a]">
            <CardContent className="p-4">
              <p className="mb-3 text-sm font-bold text-gray-900 dark:text-white">Price breakdown</p>
              <BreakdownRow label="Current dish price" value={formatCurrency(oldPrice)} />
              <BreakdownRow label="New dish price" value={formatCurrency(newPrice)} />
              <BreakdownRow
                label={isDowngrade ? "Wallet credit" : "Price difference"}
                value={
                  isDowngrade
                    ? `+ ${formatCurrency(walletCreditAmount)}`
                    : formatCurrency(priceDifference)
                }
                positive={isDowngrade}
              />
              <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
                <BreakdownRow
                  label={isDowngrade ? "Payable now" : "Total payable"}
                  value={formatCurrency(payableAmount)}
                  strong
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 bg-white shadow-sm dark:bg-[#1a1a1a]">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {isUpgrade ? (
                  <CreditCard className="mt-0.5 h-5 w-5 text-[#55254b]" />
                ) : (
                  <Wallet className="mt-0.5 h-5 w-5 text-[#55254b]" />
                )}
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {isUpgrade
                      ? "Pay online to confirm"
                      : isDowngrade
                        ? "Difference will be added to wallet"
                        : "No extra amount required"}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    The dish changes only after you confirm this checkout.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="fixed bottom-[54px] left-0 right-0 border-t border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-[#1a1a1a] md:bottom-0">
          <div className="mx-auto max-w-md">
            <Button
              type="button"
              disabled={submitting}
              onClick={handleConfirm}
              className="h-12 w-full rounded-xl bg-[#55254b] text-base font-bold text-white hover:bg-[#6f3461] disabled:bg-gray-200 disabled:text-gray-400"
            >
              {submitting
                ? "Processing..."
                : isUpgrade
                  ? `Pay online ${formatCurrency(payableAmount)}`
                  : isDowngrade
                    ? `Add ${formatCurrency(walletCreditAmount)} to wallet`
                    : "Confirm change"}
            </Button>
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}

function DishPreview({ dish, label }) {
  const image = getDishImage(dish);
  return (
    <div className="min-w-0">
      <div className="relative mb-2 h-24 overflow-hidden rounded-2xl bg-gray-100 dark:bg-gray-800">
        {image ? (
          <img
            src={image}
            alt={dish?.name || label}
            className="h-full w-full object-cover"
            onError={(event) => {
              if (event.currentTarget.src !== FOOD_IMAGE_FALLBACK) {
                event.currentTarget.src = FOOD_IMAGE_FALLBACK;
              }
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">No image</div>
        )}
      </div>
      <p className="text-[11px] font-bold uppercase text-gray-400">{label}</p>
      <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{dish?.name || "Dish"}</p>
      <p className="text-xs font-semibold text-gray-500">{formatCurrency(dish?.price)}</p>
    </div>
  );
}

function BreakdownRow({ label, value, strong = false, positive = false }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className={`${strong ? "font-bold text-gray-900 dark:text-white" : "text-gray-500"} text-sm`}>
        {label}
      </span>
      <span
        className={`${strong ? "font-bold text-gray-900 dark:text-white" : "font-semibold"} ${positive ? "text-green-600" : "text-gray-900 dark:text-white"
          } text-sm`}
      >
        {value}
      </span>
    </div>
  );
}
