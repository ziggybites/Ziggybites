import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Pizza, UtensilsCrossed, Flame, Bookmark, Star, Clock, BadgePercent, Timer } from "lucide-react";
import { Button } from "@food/components/ui/button";
import { Card, CardContent } from "@food/components/ui/card";
import { useProfile } from "@food/context/ProfileContext";
import RestaurantImageCarousel from "@food/components/user/RestaurantImageCarousel";
import { getRestaurantAvailabilityStatus } from "@food/utils/restaurantAvailability";
import chefMascot from "@food/assets/chef-mascot.png";
import { API_BASE_URL } from "@food/api/config";

const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

export default function RestaurantsSection({
  shouldShowOutOfZoneHome,
  filteredRestaurants,
  isLoadingFilterResults,
  loadingRestaurants,
  visibleRestaurants,
  isOutOfService,
  availabilityTick,
  hasMoreRestaurants,
  loadMoreRestaurants,
  setSelectedRestaurantSlug,
  setShowManageCollections,
  setShowToast,
  restaurantLoadMoreRef
}) {
  const { isFavorite, addFavorite } = useProfile();

  return (
    <motion.section
          className="hidden md:block content-auto space-y-0 pt-3 sm:pt-4 lg:pt-6 pb-8 md:pb-10"
          initial={false}
          animate={{ opacity: 1 }}>
          {!shouldShowOutOfZoneHome && (
            <div className="px-4 mb-3 lg:mb-4">
              <div className="flex flex-col gap-0.5 lg:gap-1">
                <h2 className="text-xs sm:text-sm lg:text-base font-semibold text-gray-400 tracking-widest uppercase">
                  {filteredRestaurants.length} Restaurants Delivering to You
                </h2>
<span className="text-base sm:text-lg lg:text-2xl text-gray-500 font-normal">
                  Featured
                </span>
              </div>
            </div>
          )}
            {shouldShowOutOfZoneHome ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center min-h-[480px] overflow-visible">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="flex flex-col items-center max-w-sm mx-auto relative"
                >
                  <div className="relative mb-14">
                    {/* Multi-layered Glow System */}
                    <motion.div
                      animate={{
                        scale: [1, 1.4, 1],
                        opacity: [0.15, 0.35, 0.15],
                      }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute inset-0 bg-[#7e3866] rounded-full blur-[70px]"
                    />
                    <motion.div
                      animate={{
                        scale: [1.3, 1, 1.3],
                        opacity: [0.1, 0.25, 0.1],
                      }}
                      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                      className="absolute inset-0 bg-rose-400 rounded-full blur-[50px]"
                    />

                    {/* Floating Decorative Icons */}
                    <motion.div 
                      animate={{ y: [0, -15, 0], rotate: [0, 15, 0], scale: [1, 1.1, 1] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute -top-10 -left-10 text-orange-400/40"
                    >
                      <Pizza className="w-12 h-12" strokeWidth={1} />
                    </motion.div>
                    <motion.div 
                      animate={{ y: [0, 15, 0], rotate: [0, -20, 0], scale: [1, 1.05, 1] }}
                      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                      className="absolute -bottom-6 -right-12 text-rose-400/40"
                    >
                      <UtensilsCrossed className="w-10 h-10" strokeWidth={1} />
                    </motion.div>
                    <motion.div 
                      animate={{ x: [0, 12, 0], y: [0, -10, 0] }}
                      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
                      className="absolute top-4 -right-14 text-amber-400/30"
                    >
                      <Flame className="w-8 h-8" strokeWidth={1} />
                    </motion.div>

                    <motion.div
                      animate={{ y: [0, -25, 0] }}
                      transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                      className="relative z-10 w-44 h-44 bg-white/80 dark:bg-[#1a1a1a]/80 backdrop-blur-sm rounded-[3rem] shadow-[0_20px_50px_rgba(126,56,102,0.3)] flex items-center justify-center border border-white/50 dark:border-white/10 overflow-hidden"
                    >
                      <img 
                        src={chefMascot} 
                        alt="Chef Mascot" 
                        className="w-full h-full object-contain p-2 transform scale-115 drop-shadow-2xl"
                      />
                    </motion.div>
                    
                    {/* Animated Particles with varied colors */}
                    {[...Array(5)].map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{ 
                          y: [0, -120], 
                          x: [0, (i - 2) * 40],
                          opacity: [0, 0.6, 0],
                          scale: [0, 1, 0]
                        }}
                        transition={{ 
                          duration: 3 + i * 0.2, 
                          repeat: Infinity, 
                          delay: i * 0.6,
                          ease: "easeOut" 
                        }}
                        className={`absolute top-1/2 left-1/2 w-${2 + (i % 2)} h-${2 + (i % 2)} ${i % 2 === 0 ? 'bg-[#7e3866]/40' : 'bg-rose-400/40'} rounded-full`}
                      />
                    ))}
                  </div>

                  <h3 className="text-3xl sm:text-4xl font-black mb-4 tracking-tight leading-tight bg-gradient-to-r from-[#7e3866] via-rose-500 to-[#7e3866] bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient-shift">
                    Coming Soon!
                  </h3>
                  <p className="text-base sm:text-lg font-medium text-gray-500 dark:text-gray-400 leading-relaxed px-4 max-w-xs">
                    Currently we are not operating on this area. We are coming soon to your location!
                  </p>
                  
                  <div className="mt-12 flex items-center gap-3">
                    <motion.div 
                      animate={{ width: [8, 40, 8], opacity: [0.2, 0.5, 0.2] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                      className="h-1.5 bg-[#7e3866] rounded-full" 
                    />
                    <motion.div 
                      animate={{ width: [40, 8, 40], opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                      className="h-1.5 bg-[#7e3866] rounded-full" 
                    />
                    <motion.div 
                      animate={{ width: [8, 40, 8], opacity: [0.2, 0.5, 0.2] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                      className="h-1.5 bg-[#7e3866] rounded-full" 
                    />
                  </div>
                </motion.div>
              </div>
            ) : (
              <>
                <div
                  className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-4 lg:gap-5 xl:gap-6 px-4 pt-1 sm:pt-1.5 lg:pt-2 items-stretch ${isLoadingFilterResults || loadingRestaurants ? "opacity-50" : "opacity-100"} transition-opacity duration-300`}>
                  {visibleRestaurants.map((restaurant, index) => {
                    const nameStr =
                      typeof restaurant?.name === "string"
                        ? restaurant.name.trim()
                        : "";
                    const fallbackSlugSource =
                      nameStr ||
                      (typeof restaurant?.restaurantName === "string"
                        ? restaurant.restaurantName.trim()
                        : "") ||
                      String(
                        restaurant?.slug ||
                        restaurant?.id ||
                        restaurant?._id ||
                        `restaurant-${index}`,
                      );

                    const restaurantSlug =
                      typeof restaurant?.slug === "string" &&
                        restaurant.slug.trim()
                        ? restaurant.slug.trim()
                        : fallbackSlugSource.toLowerCase().replace(/\s+/g, "-");
                    const availability = getRestaurantAvailabilityStatus(
                      restaurant,
                      new Date(availabilityTick),
                      { ignoreOperationalStatus: true },
                    );
                    // Direct favorite check - isFavorite is already memoized in context
                    const favorite = isFavorite(restaurantSlug);

                    const handleToggleFavorite = (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (favorite) {
                        // If already bookmarked, show Manage Collections modal
                        setSelectedRestaurantSlug(restaurantSlug);
                        setShowManageCollections(true);
                      } else {
                        // Add to favorites and show toast
                        addFavorite({
                          slug: restaurantSlug,
                          name: restaurant.name,
                          cuisine: restaurant.cuisine,
                          rating: restaurant.rating,
                          deliveryTime: restaurant.deliveryTime,
                          distance: restaurant.distance,
                          priceRange: restaurant.priceRange,
                          image: restaurant.image,
                        });
                        setShowToast(true);
                        setTimeout(() => {
                          setShowToast(false);
                        }, 3000);
                      }
                    };

                    return (
                      <div
                        key={
                          restaurant?.id ||
                          restaurant?._id ||
                          restaurantSlug ||
                          index
                        }
                        className="h-full transform transition-all duration-300 hover:-translate-y-3 hover:scale-[1.02]"
                        style={{
                          perspective: 1000,
                          animation:
                            index < 10
                              ? `fade-in-up 0.5s ease-out ${index * 0.05}s backwards`
                              : "none",
                        }}>
                        <div className="h-full group">
                          <Link
                            to={`/user/restaurants/${restaurantSlug}`}
                            className="h-full flex">
                            <Card
                              className={`overflow-hidden gap-0 cursor-pointer border-0 dark:border-gray-800 group bg-white dark:bg-[#1a1a1a] border-background transition-all duration-500 py-0 rounded-[28px] flex flex-col h-full w-full relative shadow-sm hover:shadow-xl ${isOutOfService || !availability.isOpen
                                ? "grayscale opacity-75"
                                : ""
                                }`}>
                              {/* Image Section with Carousel */}
                              <div className="relative">
                                <RestaurantImageCarousel
                                  restaurant={restaurant}
                                  priority={index < 3}
                                  backendOrigin={BACKEND_ORIGIN}
                                />

                                {restaurant.featuredDish && Number.isFinite(Number(restaurant.featuredPrice)) && (
                                  <div className="absolute top-4 left-4 flex items-center z-10 transform transition-transform duration-300 group-hover:scale-105">
                                    <div className="bg-black/70 backdrop-blur-lg text-white px-4 py-1.5 rounded-full text-[11px] font-medium tracking-tight flex items-center shadow-2xl border border-white/20">
                                      {restaurant.featuredDish} • Rs. {restaurant.featuredPrice}
                                    </div>
                                  </div>
                                )}

                                {/* Bookmark Icon - Top Right */}
                                <div className="absolute top-4 right-4 z-10 transform transition-transform duration-300 group-hover:scale-110">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleToggleFavorite}
                                    aria-label={
                                      favorite
                                        ? "Remove from favorites"
                                        : "Add to favorites"
                                    }
                                    className={`h-11 w-11 rounded-[20px] shadow-xl flex items-center justify-center transition-all duration-300 ${favorite
                                      ? "bg-red-500 text-white"
                                      : "bg-white/90 backdrop-blur-sm text-gray-800 hover:bg-white"
                                      }`}>
                                    <Bookmark
                                      className={`h-5 w-5 transition-all duration-300 ${favorite ? "fill-white" : ""
                                        }`}
                                    />
                                  </Button>
                                </div>
                              </div>

                              {/* Content Section */}
                              <div className="transform transition-transform duration-300 group-hover:-translate-y-1">
                                <CardContent className="p-3 sm:p-4 lg:p-5 pt-3 sm:pt-4 lg:pt-5 flex flex-col flex-grow">
                                  {/* Restaurant Name & Rating */}
                                  <div className="flex items-start justify-between gap-2 mb-2 lg:mb-3">
                                    <div className="flex-1 min-w-0">
                                      <h3 className="text-lg lg:text-2xl font-bold text-gray-950 dark:text-white line-clamp-1 leading-tight tracking-tight transition-colors duration-300 group-hover:text-[#7e3866]">
                                        {restaurant.name}
                                      </h3>
                                      <div className="flex flex-wrap items-center gap-2 mt-2">
                                        <span
                                          className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest shadow-sm ${availability.isOpen ? "bg-[#7e3866] text-white" : "bg-gray-400 text-white"}`}>
                                          {availability.isOpen
                                            ? "Open now"
                                            : "Offline"}
                                        </span>
                                        {availability.isOpen &&
                                          availability.closingCountdownLabel &&
                                          availability.openingTime &&
                                          availability.closingTime && (
                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#7e3866]/10 text-[#7e3866] border border-[#7e3866]/20 text-[10px] font-black uppercase tracking-widest">
                                              <Timer
                                                className="h-3 w-3 flex-shrink-0"
                                                strokeWidth={3}
                                              />
                                              <span>
                                                {availability.closingCountdownLabel}
                                              </span>
                                            </div>
                                          )}
                                      </div>
                                    </div>
                                    <div className={`flex-shrink-0 ${Number(restaurant.rating) > 0 ? "bg-[#7e3866]" : "bg-gray-400"} text-white px-3 py-1.5 rounded-2xl flex items-center gap-1.5 shadow-md transform transition-transform duration-300 group-hover:scale-110`}>
                                      <span className="text-sm lg:text-lg font-black tracking-tight">
                                        {Number(restaurant.rating) > 0 ? Number(restaurant.rating).toFixed(1) : "NEW"}
                                      </span>
                                      {Number(restaurant.rating) > 0 && <Star className="h-3.5 w-3.5 lg:h-4.5 lg:w-4.5 fill-white text-white" strokeWidth={0} />}
                                    </div>
                                  </div>

                                  {/* Delivery Time & Distance */}
                                  <div className="flex items-center gap-1 text-sm lg:text-base text-gray-500 mb-2 lg:mb-3 transition-opacity duration-300 opacity-70 group-hover:opacity-100">
                                    <Clock
                                      className="h-4 w-4 lg:h-5 lg:w-5 text-gray-500 dark:text-gray-400"
                                      strokeWidth={1.5}
                                    />
                                    <span className="font-medium dark:text-gray-300 text-gray-700">
                                      {restaurant.deliveryTime}
                                    </span>
                                    <span className="mx-1">|</span>
                                    <span className="font-medium dark:text-gray-300 text-gray-700">
                                      {restaurant.distance}
                                    </span>
                                  </div>

                                  {/* Offer Badge */}
                                  {restaurant.offer && (
                                    <div className="flex items-center gap-2 text-sm lg:text-base mt-auto transform transition-transform duration-300 group-hover:translate-x-1">
                                      <BadgePercent
                                        className="h-4 w-4 lg:h-5 lg:w-5 text-[#7e3866]"
                                        strokeWidth={3}
                                      />
                                      <span className="text-[#7e3866] dark:text-[#a05485] font-black uppercase text-[10px] tracking-wider">
                                        {restaurant.offer}
                                      </span>
                                    </div>
                                  )}
                                </CardContent>
                              </div>

                              {/* Border Glow Effect */}
                              <div className="absolute inset-0 rounded-md pointer-events-none z-0 transition-all duration-300 border border-transparent group-hover:border-[#7e3866]/30 group-hover:shadow-[inset_0_0_0_1px_rgba(235,89,14,0.2)]" />
                            </Card>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col items-center pt-2 sm:pt-3 gap-2 px-4">
                  {hasMoreRestaurants && (
                    <Button
                      variant="outline"
                      onClick={loadMoreRestaurants}
                      className="text-sm font-medium border-gray-300 hover:border-gray-400">
                      Load more restaurants
                    </Button>
                  )}
                  <div
                    ref={restaurantLoadMoreRef}
                    className="h-1 w-full"
                    aria-hidden="true"
                  />
                </div>
              </>
            )}
        </motion.section>
  );
}
