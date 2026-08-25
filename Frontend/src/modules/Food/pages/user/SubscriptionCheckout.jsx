import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  IndianRupee,
  Lock,
  MapPin,
  TicketPercent,
} from "lucide-react";
import { toast } from "sonner";
import { restaurantAPI, subscriptionAPI } from "@food/api";
import { initRazorpayPayment, loadRazorpayScript } from "@food/utils/razorpay";
import { getCompanyNameAsync } from "@food/utils/businessSettings";
import { useProfile } from "@food/context/ProfileContext";
import { useLocation as useUserLocation } from "@food/hooks/useLocation";
import { DEFAULT_APP_CUSTOMIZATION, loadAppCustomization } from "@food/utils/appCustomization";
import { normalizeUserLocationForStorage } from "../../../../core/storage/localStorage.js";

const RUPEE_SYMBOL = "\u20B9";

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;
const formatCurrency = (value) =>
  `${RUPEE_SYMBOL}${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const normalizeCheckoutDeliveryAddress = (address, fallbackLocation, phone = "") => {
  if (!address && !fallbackLocation) return null;

  const coordinatesFromAddress = Array.isArray(address?.location?.coordinates)
    ? address.location.coordinates.map(Number)
    : null;
  const hasAddressCoordinates =
    coordinatesFromAddress?.length === 2 &&
    coordinatesFromAddress.every((value) => Number.isFinite(value));

  const lat = hasAddressCoordinates
    ? Number(coordinatesFromAddress[1])
    : Number(
        address?.latitude ??
          address?.lat ??
          address?.location?.latitude ??
          address?.location?.lat ??
          fallbackLocation?.latitude,
      );
  const lng = hasAddressCoordinates
    ? Number(coordinatesFromAddress[0])
    : Number(
        address?.longitude ??
          address?.lng ??
          address?.location?.longitude ??
          address?.location?.lng ??
          fallbackLocation?.longitude,
      );

  const addressLineParts = [
    address?.street,
    address?.additionalDetails,
    address?.city,
    address?.state,
    address?.zipCode || address?.postalCode,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const explicitAddressText = addressLineParts.join(", ");

  const coordinates =
    hasAddressCoordinates
      ? coordinatesFromAddress
      : Number.isFinite(lat) && Number.isFinite(lng)
        ? [lng, lat]
        : undefined;

  const formattedAddressFromAddress =
    explicitAddressText ||
    address?.formattedAddress ||
    address?.address ||
    "";
  const formattedAddress =
    formattedAddressFromAddress ||
    fallbackLocation?.formattedAddress ||
    fallbackLocation?.address ||
    "";
  const fallbackAddressText =
    formattedAddress && formattedAddress !== "Select location"
      ? formattedAddress
      : [
          explicitAddressText,
          fallbackLocation?.area,
          fallbackLocation?.city,
          fallbackLocation?.state,
        ]
          .filter(Boolean)
          .join(", ") || "Current Location";

  return {
    ...address,
    label: address?.label || "Home",
    formattedAddress: fallbackAddressText,
    address: fallbackAddressText,
    street:
      address?.street ||
      explicitAddressText ||
      fallbackLocation?.street ||
      fallbackLocation?.address ||
      fallbackLocation?.area ||
      "Current Location",
    additionalDetails: address?.additionalDetails || fallbackLocation?.area || "",
    city: address?.city || fallbackLocation?.city || fallbackLocation?.area || "Current City",
    state: address?.state || fallbackLocation?.state || fallbackLocation?.city || "Current State",
    zipCode:
      address?.zipCode ||
      address?.postalCode ||
      fallbackLocation?.postalCode ||
      fallbackLocation?.zipCode ||
      "",
    phone: address?.phone || phone || "",
    ...(Number.isFinite(lat) ? { latitude: lat } : {}),
    ...(Number.isFinite(lng) ? { longitude: lng } : {}),
    ...(coordinates
      ? {
          location: {
            ...(address?.location || {}),
            type: "Point",
            coordinates,
          },
        }
      : {}),
  };
};

const formatFullAddress = (address) => {
  if (!address) return "";
  if (
    address.formattedAddress &&
    address.formattedAddress !== "Select location"
  ) {
    return address.formattedAddress;
  }
  const parts = [
    address.street,
    address.additionalDetails,
    address.city,
    address.state,
    address.zipCode,
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  return address.address || "";
};

export default function SubscriptionCheckout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile, getDefaultAddress, isAuthenticated } = useProfile();
  const { location: currentLocation } = useUserLocation();

  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [appCustomization, setAppCustomization] = useState(DEFAULT_APP_CUSTOMIZATION);
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [showCoupons, setShowCoupons] = useState(false);
  const [manualCouponCode, setManualCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [priceQuote, setPriceQuote] = useState(null);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [companyName, setCompanyName] = useState("");

  const { dish, selectedMeals = [], subscriptionPlan, selectedDeliveryAddress } = location.state || {};

  useEffect(() => {
    let mounted = true;
    loadAppCustomization()
      .then((settings) => {
        if (!mounted) return;
        setAppCustomization(settings);
        if (settings.subscriptionFlowEnabled === false) {
          navigate("/food/user", { replace: true });
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    let active = true;

    loadRazorpayScript().catch(() => {});
    getCompanyNameAsync()
      .then((name) => {
        if (!active) return;
        setCompanyName(String(name || "").trim());
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const basePrice = Math.max(0, Number.parseFloat(dish?.price || 0) || 0);
  const mealCount = selectedMeals.length || 1;
  const days = subscriptionPlan?.durationDays || 30;
  const estimatedFoodSubtotal = roundMoney(basePrice * mealCount * days);
  const pricing = priceQuote?.pricing || {};
  const totalFoodCost = roundMoney(pricing.foodSubtotal || 0);
  const gstRate = Number(pricing.gstRate || 0);
  const gstAmount = roundMoney(pricing.gstAmount || 0);
  const deliveryDistanceKm = Number(pricing.deliveryDistanceKm || 0);
  const deliveryFeePerDay = roundMoney(pricing.deliveryFeePerDay || 0);
  const totalDeliveryCharges = roundMoney(pricing.deliveryCharges || 0);
  const totalBeforeDiscount = roundMoney(pricing.totalBeforeDiscount || 0);
  const couponDiscount = roundMoney(pricing.couponDiscount || 0);
  const totalAmount = roundMoney(pricing.totalAmount || 0);
  const totalDeliveries = Number(pricing.totalDeliveries || mealCount * days);

  const savedAddress = getDefaultAddress();
  const storedUserLocation = useMemo(() => {
    try {
      const raw = localStorage.getItem("userLocation");
      return raw ? normalizeUserLocationForStorage(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }, []);
  const defaultAddress = useMemo(() => {
    const fallbackLocation =
      currentLocation?.latitude && currentLocation?.longitude
        ? currentLocation
        : storedUserLocation;
    if (selectedDeliveryAddress) {
      return normalizeCheckoutDeliveryAddress(
        selectedDeliveryAddress,
        fallbackLocation,
        userProfile?.phone || "",
      );
    }
    if (savedAddress) {
      return normalizeCheckoutDeliveryAddress(
        savedAddress,
        fallbackLocation,
        userProfile?.phone || "",
      );
    }
    return normalizeCheckoutDeliveryAddress(
      null,
      fallbackLocation,
      userProfile?.phone || "",
    );
  }, [currentLocation, savedAddress, selectedDeliveryAddress, storedUserLocation, userProfile?.phone]);

  useEffect(() => {
    const fetchCoupons = async () => {
      const restaurantId = dish?.restaurantId;
      const itemId = dish?.itemId || dish?.id;

      if (!restaurantId || !itemId) {
        setAvailableCoupons([]);
        return;
      }

      setLoadingCoupons(true);
      try {
        const response = await restaurantAPI.getCouponsByItemIdPublic(restaurantId, itemId);
        const coupons = response?.data?.data?.coupons || [];
        const normalized = coupons
          .filter((coupon) => coupon?.showInCart !== false && coupon?.couponCode)
          .map((coupon) => {
            const minOrder = Number(coupon.minOrderValue || coupon.minOrder || 0);
            const discountValue =
              coupon.discountType === "percentage"
                ? Math.min(
                    estimatedFoodSubtotal,
                    coupon.maxDiscount
                      ? (estimatedFoodSubtotal * (Number(coupon.discountPercentage || 0) / 100) > Number(coupon.maxDiscount)
                        ? Number(coupon.maxDiscount)
                        : estimatedFoodSubtotal * (Number(coupon.discountPercentage || 0) / 100))
                      : estimatedFoodSubtotal * (Number(coupon.discountPercentage || 0) / 100),
                  )
                : Math.min(estimatedFoodSubtotal, Number(coupon.discountValue || coupon.discount || 0));

            return {
              code: String(coupon.couponCode).toUpperCase(),
              discount: roundMoney(discountValue),
              discountPercentage: Number(coupon.discountPercentage || 0),
              discountDisplay:
                coupon.discountType === "percentage"
                  ? `${Number(coupon.discountPercentage || 0)}% OFF`
                  : `${RUPEE_SYMBOL}${roundMoney(discountValue)} OFF`,
              minOrder,
              description:
                coupon.discountType === "percentage"
                  ? `${Number(coupon.discountPercentage || 0)}% OFF with '${coupon.couponCode}'`
                  : `Save ${formatCurrency(discountValue)} with '${coupon.couponCode}'`,
              customerGroup: coupon.customerGroup || "all",
              maxDiscount: Number(coupon.maxDiscount || 0),
              discountType: coupon.discountType || "flat",
            };
          });

        setAvailableCoupons(normalized);
      } catch {
        setAvailableCoupons([]);
      } finally {
        setLoadingCoupons(false);
      }
    };

    fetchCoupons();
  }, [dish?.id, dish?.itemId, dish?.restaurantId, estimatedFoodSubtotal]);

  const addressLabel = formatFullAddress(defaultAddress);
  const selectedMealLabel = selectedMeals
    .map((meal) => String(meal?.title || meal?.name || "").trim())
    .filter(Boolean)
    .join(", ");

  const orderNote = useMemo(() => {
    const noteParts = [
      `Subscription plan: ${subscriptionPlan?.title || `${days} Days`}`,
      selectedMealLabel ? `Meals: ${selectedMealLabel}` : "",
    ].filter(Boolean);
    return noteParts.join(" | ");
  }, [days, selectedMealLabel, subscriptionPlan?.title]);

  const buildQuotePayload = (couponCodeOverride = appliedCoupon?.code || manualCouponCode) => ({
    dishId: dish?.itemId || dish?.id,
    dishName: dish?.name || "Subscription meal",
    restaurantId: dish?.restaurantId,
    restaurantName: dish?.restaurantName || "",
    meals: selectedMeals
      .map((meal) => String(meal?.title || meal?.name || "").trim())
      .filter(Boolean),
    planId: subscriptionPlan?.id || undefined,
    planDays: days,
    itemPrice: basePrice,
    couponCode: couponCodeOverride ? String(couponCodeOverride).trim().toUpperCase() : undefined,
    deliveryAddress: defaultAddress || undefined,
    currency: "INR",
  });

  useEffect(() => {
    let active = true;

    const fetchQuote = async () => {
      if (!dish?.restaurantId || !(dish?.itemId || dish?.id) || !selectedMeals.length || !subscriptionPlan?.id) {
        setPriceQuote(null);
        return;
      }

      setIsQuoteLoading(true);
      try {
        const payload = buildQuotePayload();
        console.log("[SubscriptionCheckout] address debug", {
          selectedDeliveryAddress,
          savedAddress,
          currentLocation,
          storedUserLocation,
          defaultAddress,
        });
        console.log("[SubscriptionCheckout] quote payload", payload);
        console.log(
          "[SubscriptionCheckout] quote payload json",
          JSON.stringify(payload, null, 2),
        );
        const response = await subscriptionAPI.getQuote(payload);
        if (!active) return;
        const nextQuote = response?.data?.data || null;
        console.log("[SubscriptionCheckout] quote response", nextQuote);
        console.log(
          "[SubscriptionCheckout] quote response json",
          JSON.stringify(nextQuote, null, 2),
        );
        setPriceQuote(nextQuote);
        const nextCouponCode = String(nextQuote?.pricing?.couponCode || "").trim().toUpperCase();
        if (nextCouponCode) {
          const matchedCoupon = availableCoupons.find(
            (coupon) => String(coupon.code || "").toUpperCase() === nextCouponCode,
          );
          setAppliedCoupon(matchedCoupon ? { ...matchedCoupon, code: nextCouponCode } : { code: nextCouponCode });
          setManualCouponCode(nextCouponCode);
        } else {
          setAppliedCoupon(null);
        }
      } catch (error) {
        if (!active) return;
        setPriceQuote(null);
        if (appliedCoupon?.code || manualCouponCode) {
          setAppliedCoupon(null);
          toast.error(
            error?.response?.data?.message ||
              "Unable to refresh pricing for this coupon.",
          );
        }
      } finally {
        if (active) setIsQuoteLoading(false);
      }
    };

    fetchQuote();

    return () => {
      active = false;
    };
  }, [
    appliedCoupon?.code,
    basePrice,
    days,
    dish?.id,
    dish?.itemId,
    dish?.name,
    dish?.restaurantId,
    dish?.restaurantName,
    defaultAddress,
    selectedMeals,
    subscriptionPlan?.id,
  ]);

  const handleApplyCoupon = async (coupon) => {
    const couponCode = String(coupon?.code || "").trim().toUpperCase();
    if (!couponCode) {
      toast.error("Invalid coupon");
      return;
    }

    setIsQuoteLoading(true);
    try {
      const response = await subscriptionAPI.getQuote(buildQuotePayload(couponCode));
      setPriceQuote(response?.data?.data || null);
      setAppliedCoupon({ ...coupon, code: couponCode });
      setManualCouponCode(couponCode);
      setShowCoupons(false);
      toast.success("Coupon applied");
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Coupon is not applicable right now.",
      );
    } finally {
      setIsQuoteLoading(false);
    }
  };

  const handleApplyCouponCode = async () => {
    const inputCode = manualCouponCode.trim().toUpperCase();
    if (!inputCode) {
      toast.error("Enter coupon code");
      return;
    }

    await handleApplyCoupon({ code: inputCode });
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setManualCouponCode("");
    toast.success("Coupon removed");
  };

  const redirectToLogin = () => {
    navigate("/user/auth/login", {
      replace: true,
      state: { from: location.pathname },
    });
  };

  const goBackWithFallback = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/food/user/subscription-plans", {
      replace: true,
      state: {
        dish,
        selectedMeals,
      },
    });
  };

  const handleChangeAddress = () => {
    if (!isAuthenticated) {
      redirectToLogin();
      return;
    }

    navigate("/food/user/address-selector", {
      state: {
        mode: "subscription-checkout-address",
        returnTo: location.pathname || "/food/user/checkout",
        backTo: location.pathname || "/food/user/checkout",
        checkoutState: {
          ...(location.state || {}),
          dish,
          selectedMeals,
          subscriptionPlan,
        },
      },
    });
  };

  const handlePlaceOrder = async () => {
    if (!isAuthenticated) {
      toast.info("Please login to continue with payment.");
      redirectToLogin();
      return;
    }

    if (appCustomization.subscriptionFlowEnabled === false) {
      toast.error("Subscription ordering is currently unavailable.");
      return;
    }

    console.log("[SubscriptionCheckout] Proceed to pay clicked", {
      rawState: location.state || null,
      dish,
      selectedMeals,
      subscriptionPlan,
      defaultAddress,
      addressLabel,
      pricing,
    });

    if (!dish?.restaurantId) {
      console.warn("[SubscriptionCheckout] Missing restaurantId", {
        dish,
        rawState: location.state || null,
      });
      toast.error("Restaurant details are missing for this dish.");
      return;
    }

    if (!dish?.itemId && !dish?.id) {
      console.warn("[SubscriptionCheckout] Missing dish/item id", {
        dish,
        rawState: location.state || null,
      });
      toast.error("Dish details are missing for this subscription.");
      return;
    }

    if (!selectedMeals.length) {
      toast.error("Please select at least one meal.");
      goBackWithFallback();
      return;
    }

    if (basePrice <= 0) {
      toast.error("Dish price is missing for this subscription.");
      return;
    }

    if (isQuoteLoading || !priceQuote?.pricing) {
      toast.info("Please wait, updating the latest amount from server.");
      return;
    }

    if (!defaultAddress || !addressLabel) {
      toast.error("Please add a delivery address before payment.");
      navigate("/food/user/profile");
      return;
    }

    setIsPlacingOrder(true);

    try {
      const customerName = userProfile?.name || userProfile?.fullName || "User";
      const customerPhone = userProfile?.phone || defaultAddress?.phone || "";
      const payload = {
        dishId: dish.itemId || dish.id,
        dishName: dish.name || "Subscription meal",
        restaurantId: dish.restaurantId,
        restaurantName: dish.restaurantName || "",
        meals: selectedMeals
          .map((meal) => String(meal?.title || meal?.name || "").trim())
          .filter(Boolean),
        planId: subscriptionPlan?.id || undefined,
        planDays: days,
        itemPrice: basePrice,
        totalAmount,
        couponCode: appliedCoupon?.code || undefined,
        currency: "INR",
        customerName,
        customerPhone,
        deliveryAddress: defaultAddress,
      };

      console.log("[SubscriptionCheckout] Subscription create-order payload", payload);

      const response = await subscriptionAPI.createOrder(payload);
      const { subscription, razorpay, order } = response?.data?.data || {};

      console.log("[SubscriptionCheckout] Create-order response", {
        response: response?.data,
        subscription,
        razorpay,
        order,
      });

      if (!subscription) {
        throw new Error("Unable to initialize subscription payment.");
      }

      if (appCustomization.directPaymentTestMode === true) {
        const verifyPayload = {
          subscriptionId: subscription.subscriptionId || subscription._id || "",
          razorpayOrderId: razorpay?.orderId || subscription.razorpayOrderId || `test_order_${Date.now()}`,
          razorpayPaymentId: `test_payment_${Date.now()}`,
          razorpaySignature: "test_signature_bypass",
        };

        const verifyResponse = await subscriptionAPI.verifyPayment(verifyPayload);
        if (!verifyResponse?.data?.success) {
          throw new Error(
            verifyResponse?.data?.message || "Payment verification failed.",
          );
        }

        toast.success("Subscription activated successfully.");
        navigate("/food/user/profile", { replace: true });
        setIsPlacingOrder(false);
        return;
      }

      if (!razorpay?.orderId || !razorpay?.key) {
        throw new Error("Unable to initialize subscription payment.");
      }

      const formattedPhone = String(customerPhone || "")
        .replace(/\D/g, "")
        .slice(-10);

      let paymentHandled = false;

      await initRazorpayPayment({
        key: razorpay.key,
        amount: razorpay.amount,
        currency: razorpay.currency || "INR",
        order_id: razorpay.orderId,
        name: companyName || undefined,
        description: `${subscriptionPlan?.title || `${days} Days`} - ${dish.name || "Meal Subscription"}`,
        prefill: {
          name: customerName,
          email: userProfile?.email || "",
          contact: formattedPhone,
        },
        notes: {
          subscriptionId:
            subscription.subscriptionId || subscription._id || "",
          dishName: dish.name || "",
          customerName,
          customerPhone,
          deliveryAddress: addressLabel,
          note: orderNote,
        },
        handler: async (razorpayResponse) => {
          if (paymentHandled) return;
          paymentHandled = true;
          console.log("[SubscriptionCheckout] Razorpay success response", razorpayResponse);

          try {
            const verifyPayload = {
              subscriptionId:
                subscription.subscriptionId || subscription._id || "",
              razorpayOrderId:
                razorpayResponse.razorpay_order_id ||
                razorpay.orderId,
              razorpayPaymentId: razorpayResponse.razorpay_payment_id,
              razorpaySignature: razorpayResponse.razorpay_signature,
            };

            console.log("[SubscriptionCheckout] Verify-payment payload", verifyPayload);

            const verifyResponse = await subscriptionAPI.verifyPayment(verifyPayload);

            console.log("[SubscriptionCheckout] Verify-payment response", verifyResponse?.data);

            if (!verifyResponse?.data?.success) {
              throw new Error(
                verifyResponse?.data?.message || "Payment verification failed.",
              );
            }

            toast.success("Subscription activated successfully.");
            navigate("/food/user/profile", { replace: true });
          } catch (error) {
            if (error?.response?.status === 401) {
              toast.info("Please login to continue.");
              redirectToLogin();
              return;
            }

            toast.error(
              error?.response?.data?.message ||
                error?.message ||
                "Payment verification failed.",
            );
          } finally {
            setIsPlacingOrder(false);
          }
        },
        onError: (error) => {
          if (paymentHandled) return;
          paymentHandled = true;
          console.error("[SubscriptionCheckout] Razorpay payment error", error);
          toast.error(
            error?.description ||
              error?.message ||
              "Payment failed. Please try again.",
          );
          setIsPlacingOrder(false);
        },
        onClose: () => {
          if (paymentHandled) return;
          paymentHandled = true;
          console.warn("[SubscriptionCheckout] Razorpay modal closed by user");
          toast.info("Payment was not completed.");
          setIsPlacingOrder(false);
          navigate("/food/user/checkout", { replace: true });
        },
      });
    } catch (error) {
      if (error?.response?.status === 401) {
        toast.info("Please login to continue with payment.");
        redirectToLogin();
        setIsPlacingOrder(false);
        return;
      }

      console.error("[SubscriptionCheckout] Failed to start subscription payment", error);
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to start subscription payment.",
      );
      setIsPlacingOrder(false);
    }
  };

  if (!dish || !subscriptionPlan) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 font-sans">
        <p className="text-gray-500 font-medium mb-4">No plan details found.</p>
        <button
          onClick={goBackWithFallback}
          className="text-[#e3282c] font-bold border border-[#e3282c] px-6 py-2.5 rounded-xl"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-gray-900 pb-12 font-sans">
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white px-4 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={goBackWithFallback} className="text-gray-800">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-bold tracking-tight">Plan details & payment</h1>
        </div>
        <button className="text-gray-500">
          <HelpCircle className="h-6 w-6" strokeWidth={1.5} />
        </button>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4">
        <div className="bg-gradient-to-r from-[#fff5ef] to-[#fffaf8] rounded-[20px] p-5 flex justify-between relative overflow-hidden border border-orange-50/50">
          <div className="flex-1 z-10 pr-2 pt-1">
            <div className="flex items-center gap-2 mb-1.5">
              <CalendarDays className="h-5 w-5 text-[#e3282c]" strokeWidth={1.5} />
              <span className="text-[10px] font-bold text-[#e3282c] tracking-widest uppercase">
                Validity
              </span>
            </div>
            <p className="text-xl font-bold mb-2">{days} Days</p>
            <p className="text-xs font-semibold text-gray-700 leading-snug max-w-[210px]">
              {subscriptionPlan.description || "Value plan for a balanced everyday meal."}
            </p>
            {selectedMealLabel && (
              <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-[#e3282c]">
                {selectedMealLabel}
              </p>
            )}
          </div>
          <div className="w-32 h-32 shrink-0 absolute -right-2 top-2">
            {dish.image ? (
              <img
                src={dish.image}
                alt={dish.name}
                className="w-full h-full object-contain mix-blend-multiply"
              />
            ) : (
              <div className="w-24 h-24 mt-4 ml-4 bg-gray-200 rounded-2xl flex items-center justify-center font-bold text-gray-400 text-2xl">
                {dish.name?.charAt(0)}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-[20px] p-5 shadow-sm border border-gray-100">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-[#e3282c]">
              <MapPin className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-[15px]">Delivery address</h2>
              <p className="mt-1 text-xs text-gray-500 leading-snug">
                {addressLabel || "Add a default address from profile"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleChangeAddress}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-bold text-[#e3282c] active:bg-red-100"
            >
              {addressLabel ? "Change" : "Add"}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[20px] p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-[#e3282c]">
              <TicketPercent className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <h2 className="font-bold text-[15px]">Coupons & offers</h2>
          </div>

          {appliedCoupon ? (
            <div className="rounded-[14px] border border-green-200 bg-green-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-green-800">{appliedCoupon.code} applied</p>
                  <p className="mt-1 text-xs font-medium text-green-700">
                    You saved {formatCurrency(couponDiscount)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveCoupon}
                  className="text-xs font-bold text-[#e3282c]"
                >
                  REMOVE
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualCouponCode}
                  onChange={(e) => setManualCouponCode(e.target.value.toUpperCase())}
                  placeholder="Enter coupon code"
                  className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#e3282c]"
                />
                <button
                  type="button"
                  onClick={handleApplyCouponCode}
                  className="rounded-xl bg-[#e3282c] px-4 py-2.5 text-sm font-bold text-white"
                >
                  Apply
                </button>
              </div>

              {loadingCoupons ? (
                <p className="text-xs text-gray-500">Loading coupons...</p>
              ) : availableCoupons.length > 0 ? (
                <div className="rounded-[14px] border border-gray-100 bg-[#fafafa] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-gray-900">
                        Save with {availableCoupons[0].code}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {availableCoupons[0].discountDisplay || availableCoupons[0].description}
                      </p>
                      {availableCoupons.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => setShowCoupons((prev) => !prev)}
                          className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#e3282c]"
                        >
                          {showCoupons ? "Hide coupons" : "View all coupons"}
                          {showCoupons ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        </button>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleApplyCoupon(availableCoupons[0])}
                      disabled={isQuoteLoading}
                      className="rounded-full border border-[#e3282c] px-3 py-1.5 text-xs font-bold text-[#e3282c] disabled:opacity-50"
                    >
                      Apply
                    </button>
                  </div>

                  {showCoupons ? (
                    <div className="mt-3 space-y-3 border-t border-gray-200 pt-3">
                      {availableCoupons.slice(1).map((coupon) => (
                        <div key={coupon.code} className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{coupon.code}</p>
                            <p className="mt-1 text-xs text-gray-500">
                              {coupon.discountDisplay || coupon.description}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleApplyCoupon(coupon)}
                            disabled={isQuoteLoading}
                            className="rounded-full border border-[#e3282c] px-3 py-1.5 text-xs font-bold text-[#e3282c] disabled:opacity-50"
                          >
                            Apply
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-gray-500">No coupons available for this plan right now.</p>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-[20px] p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-[#e3282c]">
              <IndianRupee className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <h2 className="font-bold text-[15px]">Price breakdown</h2>
          </div>

          <div className="mb-4 rounded-[12px] border border-gray-100 bg-[#fafafa] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-900 truncate">
                  {dish.name || "Subscription meal"}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-gray-500">
                  {mealCount} meal{mealCount === 1 ? "" : "s"} per day x {days} days
                </p>
              </div>
              <div className="shrink-0 rounded-full bg-red-50 px-3 py-1 text-xs font-black text-[#e3282c]">
                {totalDeliveries} deliveries
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-[10px] bg-white px-3 py-2">
              <p className="text-[11px] font-semibold text-gray-500">Delivery distance</p>
              <p className="text-xs font-bold text-gray-900">
                {deliveryDistanceKm > 0 ? `${deliveryDistanceKm.toFixed(1)} km` : "Not available"}
              </p>
            </div>
          </div>

          <div className="space-y-4 text-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-gray-700">Dish price</p>
                <p className="mt-0.5 text-xs font-medium text-gray-400">Base price for one meal</p>
              </div>
              <span className="shrink-0 font-bold">{formatCurrency(basePrice)}</span>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-gray-700">Food subtotal</p>
                <p className="mt-0.5 text-xs font-medium text-gray-400">
                  {formatCurrency(basePrice)} x {mealCount} meal{mealCount === 1 ? "" : "s"} x {days} days
                </p>
              </div>
              <span className="shrink-0 font-bold">{formatCurrency(totalFoodCost)}</span>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-gray-700">GST</p>
                <p className="mt-0.5 text-xs font-medium text-gray-400">
                  {gstRate}% of food subtotal
                </p>
              </div>
              <span className="shrink-0 font-bold">{formatCurrency(gstAmount)}</span>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-gray-700">Delivery charges</p>
                <p className="mt-0.5 text-xs font-medium text-gray-400">
                  {deliveryDistanceKm > 0
                    ? `${deliveryDistanceKm.toFixed(1)} km slab · ${formatCurrency(deliveryFeePerDay)} x ${days} days`
                    : `${formatCurrency(deliveryFeePerDay)} x ${days} days`}
                </p>
              </div>
              <span className="shrink-0 font-bold">{formatCurrency(totalDeliveryCharges)}</span>
            </div>

            {couponDiscount > 0 ? (
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-green-700">Coupon discount</p>
                  <p className="mt-0.5 text-xs font-medium text-green-600">
                    {appliedCoupon?.code || "Applied coupon"}
                  </p>
                </div>
                <span className="shrink-0 font-bold text-green-700">- {formatCurrency(couponDiscount)}</span>
              </div>
            ) : null}

            <div className="border-t border-dashed border-gray-200 my-4"></div>

            <div className="flex justify-between items-center">
              <span className="font-bold text-[15px]">Total amount</span>
              <span className="font-bold text-xl text-[#e3282c]">
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>
        </div>

        <div className="px-1 mt-6 pt-2">
          <h3 className="font-bold text-[15px] mb-4">What you get</h3>
          <ul className="space-y-4">
            {[
              "24-hour prior delivery notification before each meal",
              "Modify, skip, or confirm each delivery",
              "One-time secure checkout for this meal plan",
              "No refunds on cancellation (ZiggyBites policy)",
            ].map((feature) => (
              <li key={feature} className="flex items-start gap-3">
                <CheckCircle2
                  className="h-5 w-5 text-green-500 shrink-0 mt-0.5"
                  strokeWidth={2}
                />
                <span className="text-sm font-medium text-gray-600 leading-snug">
                  {feature}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 space-y-3 pb-8">
          {isQuoteLoading ? (
            <p className="text-center text-xs font-medium text-gray-500">
              Updating amount from backend...
            </p>
          ) : null}
          <button
            onClick={handlePlaceOrder}
            disabled={isPlacingOrder || isQuoteLoading || !priceQuote?.pricing}
            className="w-full bg-[#e3282c] text-white rounded-[12px] py-3.5 flex justify-center items-center gap-2 font-bold text-sm transition-opacity active:opacity-80 disabled:opacity-70 shadow-sm hover:bg-[#d02023]"
          >
            {isPlacingOrder ? (
              "Processing..."
            ) : (
              <>
                <Lock className="h-4 w-4" strokeWidth={2} />
                Proceed to pay {RUPEE_SYMBOL}
                {totalAmount.toLocaleString("en-IN")}
              </>
            )}
          </button>
          <button
            onClick={goBackWithFallback}
            className="w-full bg-white text-[#e3282c] border border-[#e3282c] rounded-[12px] py-3.5 flex justify-center items-center font-bold text-sm transition-colors active:bg-red-50 hover:bg-red-50/50"
          >
            Back to plans
          </button>
        </div>
      </main>
    </div>
  );
}

