import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Leaf, Plus } from "lucide-react";
import { RestaurantGridSkeleton } from "@food/components/ui/loading-skeletons";
import { getNutritionSummary } from "@food/utils/nutrition";
import { getRestaurantAvailabilityStatus } from "@food/utils/restaurantAvailability";
import { toast } from "sonner";

const getFoodTypeTag = (item, fallbackLabel) => {
  const rawLabel = String(item.foodType || fallbackLabel || "").trim();
  if (!rawLabel) return null;

  const normalized = rawLabel.toLowerCase().replace(/[\s_-]/g, "");
  const isNonVeg =
    normalized === "nonveg" ||
    normalized === "nonvegetarian" ||
    normalized.includes("nonveg");
  const isVeg =
    !isNonVeg &&
    (normalized === "veg" ||
      normalized === "vegetarian" ||
      item.isVeg === true);

  return {
    label: isNonVeg ? "Non-Veg" : isVeg ? "Veg" : rawLabel,
    colorClass: isNonVeg ? "text-red-600" : "text-[#6aad37]",
  };
};

function RecommendedDishCard({ item, fallbackLabel, handleAddHomeItemToCart, restaurant, availabilityTick }) {
  const nutritionSummary = getNutritionSummary(item.nutrition);
  const foodTypeTag = getFoodTypeTag(item, fallbackLabel);
  const availability = restaurant
    ? getRestaurantAvailabilityStatus(restaurant, new Date(availabilityTick))
    : { isOpen: true };
  const isUnavailable = !availability.isOpen;

  return (
    <Link
      to={{
        pathname: "/food/user/choose-meal",
        search: `?dish=${encodeURIComponent(item.name || "")}&dishId=${encodeURIComponent(item.itemId || item.id || "")}&restaurant=${encodeURIComponent(item.restaurantName || "")}&restaurantId=${encodeURIComponent(item.restaurantId || "")}&category=${encodeURIComponent(item.categoryName || "")}${Number.isFinite(item.price) ? `&price=${encodeURIComponent(item.price)}` : ""}`,
      }}
      state={{ dish: item }}
      className={`flex gap-3 rounded-[10px] bg-white dark:bg-[#1a1a1a] border border-orange-100 dark:border-gray-800 shadow-sm p-2 ${isUnavailable ? "grayscale opacity-75 cursor-not-allowed" : ""}`}
      aria-disabled={isUnavailable}
      onClick={(event) => {
        if (!isUnavailable) return;
        event.preventDefault();
        toast.info("This restaurant is currently unavailable. Please try again later.");
      }}
    >
      <div className="h-[74px] w-[94px] rounded-lg overflow-hidden shrink-0 bg-orange-50 dark:bg-gray-900">
        {item.image ? (
          <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-lg font-black text-[#e92823]">
            {String(item.name || "I").slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[12px] font-black text-gray-900 dark:text-white truncate">
              {item.name}
            </h3>
            {item.description && (
              <p className="mt-0.5 text-[9px] font-semibold text-gray-600 dark:text-gray-400 line-clamp-2">
                {item.description}
              </p>
            )}
          </div>
          {Number.isFinite(item.price) && (
            <span className="text-[13px] font-black text-gray-900 dark:text-white shrink-0">
              Rs. {item.price}
            </span>
          )}
        </div>

        {nutritionSummary && (
          <p className="mt-1 text-[8px] font-black text-gray-600 dark:text-gray-400 line-clamp-1">
            {nutritionSummary}
          </p>
        )}

        <p className="mt-1 text-[8px] font-medium text-gray-400 line-clamp-1">
          {[item.restaurantName, item.categoryName].filter(Boolean).join(" | ")}
        </p>

        <div className="mt-2 flex items-center justify-between">
          {foodTypeTag && (
            <span className={`inline-flex items-center gap-1 text-[8px] font-black ${foodTypeTag.colorClass}`}>
              <Leaf className="h-3 w-3" />
              {foodTypeTag.label}
            </span>
          )}
          <button
            type="button"
            onClick={(event) => {
              if (isUnavailable) {
                event.preventDefault();
                event.stopPropagation();
                toast.info("This restaurant is currently unavailable. Please try again later.");
                return;
              }
              handleAddHomeItemToCart(event, item);
            }}
            className="ml-auto h-6 w-6 rounded-full bg-[#ef2b24] text-white flex items-center justify-center"
            aria-label={`Add ${item.name || "item"} to cart`}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Link>
  );
}

export default function RecommendedItems({
  selectedHomeCategory,
  setSelectedHomeCategory,
  showRestaurantSkeleton,
  loadingRestaurants,
  loadingCategoryFoodItems,
  loadingRecommendedFoodItems,
  categoryFoodItems,
  recommendedFoodItems,
  handleAddHomeItemToCart,
  restaurantsData,
  availabilityTick,
}) {
  const navigate = useNavigate();
  const isLoading =
    showRestaurantSkeleton ||
    loadingRestaurants ||
    loadingCategoryFoodItems ||
    (!selectedHomeCategory && loadingRecommendedFoodItems);

  const findRestaurant = (item) => {
    const itemRestaurantId = String(item?.restaurantId || item?.mongoRestaurantId || "");
    const itemSlug = String(item?.restaurantSlug || "");
    return (restaurantsData || []).find((restaurant) => {
      const restaurantId = String(
        restaurant?.mongoId || restaurant?.restaurantId || restaurant?.id || "",
      );
      return (itemRestaurantId && restaurantId === itemRestaurantId) ||
        (itemSlug && String(restaurant?.slug || "") === itemSlug);
    });
  };

  return (
    <section id="home-recommended-items" className="mt-4 scroll-mt-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-black text-gray-900 dark:text-white">
          {selectedHomeCategory
            ? `${selectedHomeCategory.name} For You`
            : "Recommended For You"}
        </h2>
        <button
          type="button"
          onClick={() =>
            selectedHomeCategory
              ? setSelectedHomeCategory(null)
              : navigate("/food/user/restaurants")
          }
          className="text-[10px] font-black text-[#d9251d] flex items-center gap-1"
        >
          {selectedHomeCategory ? "Clear" : "View All"} <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <RestaurantGridSkeleton count={4} />
        ) : selectedHomeCategory ? (
          categoryFoodItems.length > 0 ? (
            categoryFoodItems.map((item, index) => (
              <RecommendedDishCard
                key={`${item.restaurantSlug}-${item.id}-${index}`}
                item={item}
                fallbackLabel=""
                handleAddHomeItemToCart={handleAddHomeItemToCart}
                restaurant={findRestaurant(item)}
                availabilityTick={availabilityTick}
              />
            ))
          ) : (
            <div className="rounded-[10px] border border-dashed border-orange-200 dark:border-gray-800 bg-white/70 dark:bg-[#1a1a1a] p-5 text-center">
              <p className="text-sm font-black text-gray-900 dark:text-white">No items found</p>
              <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                Try another category or switch to All Food Items.
              </p>
            </div>
          )
        ) : recommendedFoodItems.length > 0 ? (
          recommendedFoodItems.map((item, index) => (
            <RecommendedDishCard
              key={`${item.restaurantSlug}-${item.id}-${index}`}
              item={item}
              fallbackLabel=""
              handleAddHomeItemToCart={handleAddHomeItemToCart}
              restaurant={findRestaurant(item)}
              availabilityTick={availabilityTick}
            />
          ))
        ) : (
          <div className="rounded-[10px] border border-dashed border-orange-200 dark:border-gray-800 bg-white/70 dark:bg-[#1a1a1a] p-5 text-center">
            <p className="text-sm font-black text-gray-900 dark:text-white">No items found</p>
            <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
              Menu items will appear here after restaurants add them.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
