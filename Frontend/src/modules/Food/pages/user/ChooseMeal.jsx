import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  ChefHat,
  Coffee,
  Soup,
  UserCircle2,
  Utensils,
} from "lucide-react";
import api, { restaurantAPI } from "@food/api";
import { loadAppCustomization } from "@food/utils/appCustomization";
const getImageUrl = (value) => {
  const candidate =
    typeof value === "string"
      ? value
      : value?.url || value?.secure_url || value?.imageUrl || value?.image || "";
  if (!candidate) return "";
  if (/^(https?:|data:|blob:)/i.test(candidate)) return candidate;

  const apiOrigin = String(api.defaults?.baseURL || "")
    .replace(/\/api\/v1\/?$/, "")
    .replace(/\/$/, "");
  return `${apiOrigin}/${String(candidate).replace(/^\/+/, "")}`;
};

const getMenuSections = (response) => {
  const payload = response?.data?.data ?? response?.data ?? {};
  const menu = payload?.menu ?? payload;
  return menu?.sections || payload?.sections || [];
};

const fallbackMealSlots = [
  {
    id: "breakfast",
    title: "Breakfast",
    timeLabel: "7:00 AM - 10:00 AM",
    icon: Utensils,
    accentColor: "#f59e0b",
    backgroundColor: "#fff7e6",
  },
  {
    id: "lunch",
    title: "Lunch",
    timeLabel: "1:00 PM - 3:00 PM",
    icon: ChefHat,
    accentColor: "#ef4444",
    backgroundColor: "#fff1f2",
  },
  {
    id: "snacks",
    title: "Evening Snacks",
    timeLabel: "5:00 PM - 7:00 PM",
    icon: Coffee,
    accentColor: "#7c3aed",
    backgroundColor: "#f5f3ff",
  },
  {
    id: "dinner",
    title: "Dinner",
    timeLabel: "8:00 PM - 10:00 PM",
    icon: Soup,
    accentColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
];

const iconMap = {
  breakfast: Utensils,
  lunch: ChefHat,
  snacks: Coffee,
  dinner: Soup,
  meal: Utensils,
};

export default function ChooseMeal() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [mealSlots, setMealSlots] = useState(fallbackMealSlots);
  const [resolvedDishImage, setResolvedDishImage] = useState("");

  useEffect(() => {
    let mounted = true;
    loadAppCustomization()
      .then((settings) => {
        if (!mounted) return;
        const enabled = settings.subscriptionFlowEnabled !== false;
        if (!enabled) {
          navigate("/food/user", { replace: true });
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [navigate]);
  const [loadingSlots, setLoadingSlots] = useState(true);

  const dish = useMemo(() => {
    const stateDish = location.state?.dish || {};
    return {
      id: stateDish.id || stateDish.itemId || searchParams.get("dishId") || "",
      itemId: stateDish.itemId || stateDish.id || searchParams.get("dishId") || "",
      name: stateDish.name || searchParams.get("dish") || "Selected meal",
      restaurantName:
        stateDish.restaurantName || searchParams.get("restaurant") || "",
      restaurantId:
        stateDish.restaurantId || searchParams.get("restaurantId") || "",
      categoryName: stateDish.categoryName || searchParams.get("category") || "",
      price: stateDish.price || searchParams.get("price") || "",
      image: stateDish.image || "",
      foodType: stateDish.foodType || "",
    };
  }, [location.state, searchParams]);
  useEffect(() => {
    setResolvedDishImage(getImageUrl(dish.image));
  }, [dish.image]);

  useEffect(() => {
    if (resolvedDishImage || !dish.restaurantId || !dish.itemId) return;

    let cancelled = false;
    restaurantAPI
      .getMenuByRestaurantId(dish.restaurantId, { noCache: true })
      .then((response) => {
        if (cancelled) return;
        const items = getMenuSections(response).flatMap((section) => [
          ...(Array.isArray(section?.items) ? section.items : []),
          ...(Array.isArray(section?.subsections)
            ? section.subsections.flatMap((subsection) =>
                Array.isArray(subsection?.items) ? subsection.items : [],
              )
            : []),
        ]);
        const selectedDish = items.find(
          (item) =>
            String(item?._id || item?.id || item?.itemId || "") ===
            String(dish.itemId),
        );
        setResolvedDishImage(
          getImageUrl(
            selectedDish?.image ||
              selectedDish?.imageUrl ||
              selectedDish?.photoUrl ||
              selectedDish?.images?.[0],
          ),
        );
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [dish.itemId, dish.restaurantId, resolvedDishImage]);

  const canContinue = selectedSlots.length > 0;
  const toggleSlot = (slotId) => {
    setSelectedSlots((current) =>
      current.includes(slotId)
        ? current.filter((id) => id !== slotId)
        : [...current, slotId],
    );
  };

  useEffect(() => {
    let cancelled = false;

    const loadMealSlots = async () => {
      setLoadingSlots(true);
      try {
        const response = await api.get("/food/meal-slots/public");
        const slots = response?.data?.data?.slots || response?.data?.slots || [];
        const mapped = slots
          .filter((slot) => slot?.title && slot?.timeLabel)
          .map((slot, index) => ({
            id: slot._id || slot.id || `meal-slot-${index}`,
            title: slot.title,
            timeLabel: slot.timeLabel,
            description: slot.description || "",
            imageUrl: getImageUrl(
              slot.imageUrl ||
                slot.image ||
                slot.photoUrl ||
                slot.thumbnail ||
                slot.images?.[0],
            ),
            icon: iconMap[slot.icon] || Utensils,
            accentColor: slot.accentColor || "#ef2b24",
            backgroundColor: slot.backgroundColor || "#fff7ed",
          }));

        if (!cancelled && mapped.length > 0) {
          setMealSlots(mapped);
        }
      } catch {
        if (!cancelled) setMealSlots(fallbackMealSlots);
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    };

    loadMealSlots();

    return () => {
      cancelled = true;
    };
  }, []);

  const continueToPlans = () => {
    if (!canContinue) return;
    const mealsToPass = mealSlots
      .filter((slot) => selectedSlots.includes(slot.id))
      .map(({ icon, ...rest }) => rest);
    navigate("/food/user/subscription-plans", {
      state: {
        dish,
        selectedMeals: mealsToPass,
      },
    });
  };

  return (
    <div className="min-h-screen bg-white text-[#171724] font-['Poppins',sans-serif]">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-28 pt-3">
        <header className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#171724] active:bg-gray-100"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.5} />
          </button>
          <h1 className="flex-1 text-left text-xl font-black tracking-tight">
            Choose your meal
          </h1>
          <button
            type="button"
            onClick={() => navigate("/food/user/profile")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-50 text-gray-600 shadow-sm ring-1 ring-gray-200"
            aria-label="Profile"
          >
            <UserCircle2 className="h-6 w-6" strokeWidth={2} />
          </button>
        </header>

        <p className="mt-4 pl-10 pr-6 text-[12px] font-semibold leading-5 text-[#6d6a7d]">
          Pick your preferred meal time to get started. Once you choose at
          least one meal, you can continue to the plan page.
        </p>

        <section className="mt-7">
          <div className="flex items-end justify-between">
            <h2 className="text-lg font-black tracking-tight">
              Select Meal Time
            </h2>
            <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wide text-[#e32c31]">
              Daily Schedule
              <CalendarDays className="h-3.5 w-3.5" strokeWidth={2.4} />
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {mealSlots.map((slot) => {
              const Icon = slot.icon;
              const active = selectedSlots.includes(slot.id);
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => toggleSlot(slot.id)}
                  className={`relative min-h-[164px] overflow-hidden rounded-[14px] border px-4 pb-3 pt-3 text-left shadow-sm transition active:scale-[0.98] ${
                    active
                      ? "border-[#e32c31] ring-2 ring-[#e32c31]/10"
                      : "border-transparent"
                  }`}
                  style={{
                    backgroundColor: slot.backgroundColor,
                  }}
                >
                  <span className="absolute right-3 top-3 h-4 w-4 rounded-full border-2 border-[#a4a0a5] bg-white">
                    {active && (
                      <span className="absolute inset-[3px] rounded-full bg-[#e32c31]" />
                    )}
                  </span>
                  <div className="absolute left-4 top-3 z-10 max-w-[76%]">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm">
                      <Icon className="h-5 w-5" style={{ color: slot.accentColor }} strokeWidth={2.3} />
                    </span>
                    <p className="mt-2 text-[14px] font-black leading-tight">{slot.title}</p>
                    <p
                      className="mt-1 text-[9px] font-black uppercase tracking-wide"
                      style={{ color: slot.accentColor }}
                    >
                      {slot.timeLabel}
                    </p>
                  </div>
                  {slot.imageUrl ? (
                    <img
                      src={slot.imageUrl}
                      alt={slot.title}
                      className="absolute bottom-0 left-1/2 h-[76px] w-[92%] -translate-x-1/2 object-contain"
                    />
                  ) : (
                    <span className="absolute bottom-5 left-1/2 flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-full bg-white/70 text-2xl font-black opacity-80" style={{ color: slot.accentColor }}>
                      {String(slot.title).slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {loadingSlots && (
            <p className="mt-3 text-center text-xs font-medium text-gray-400">
              Loading meal schedule...
            </p>
          )}
        </section>

        <section className="mt-4 flex min-h-[88px] overflow-hidden rounded-[14px] bg-[#fff0ec]">
          <div className="min-w-0 flex-1 px-4 py-3">
            <p className="text-lg font-black leading-5 text-[#171724]">Good food.</p>
            <p className="text-lg font-black leading-5 text-[#e32c31]">Made with care.</p>
            <p className="mt-2 max-w-[170px] text-[9px] font-semibold leading-3 text-[#777184]">
              Fresh ingredients, hygienic kitchens and on-time delivery every single day.
            </p>
          </div>
          <div className="relative w-[42%] shrink-0">
            {resolvedDishImage ? (
              <img
                src={resolvedDishImage}
                alt={dish.name}
                className="absolute bottom-0 right-2 h-24 w-28 rounded-full object-cover"
              />
            ) : (
              <div className="absolute bottom-2 right-3 flex h-20 w-20 items-center justify-center rounded-full bg-white text-3xl font-black text-[#e32c31]">
                {String(dish.name || "M").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="absolute right-3 top-3 flex h-12 w-12 rotate-12 items-center justify-center rounded-full bg-[#e32c31] text-center text-[8px] font-black uppercase leading-[9px] text-white shadow-md">
              Fresh<br />Daily
            </div>
          </div>
        </section>

        {canContinue && (
          <button
            type="button"
            onClick={continueToPlans}
            className="fixed bottom-[74px] left-4 right-4 z-30 mx-auto h-12 max-w-md rounded-xl bg-[#e32c31] text-sm font-black text-white shadow-lg shadow-red-200 active:scale-[0.98]"
          >
            Continue
          </button>
        )}

      </div>
    </div>
  );
}
