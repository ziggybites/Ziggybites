import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import RestaurantImageCarousel from "@food/components/user/RestaurantImageCarousel";
import { API_BASE_URL } from "@food/api/config";

const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

export default function RecommendedRestaurants({ recommendedForYouRestaurants }) {
  if (recommendedForYouRestaurants.length === 0) return null;
  return (
    <motion.section
      className="hidden md:block content-auto pt-1 sm:pt-2"
      initial={false}
      animate={{ opacity: 1, y: 0 }}>
      <h2 className="text-xs sm:text-sm lg:text-base font-semibold text-gray-400 dark:text-gray-500 tracking-widest uppercase mb-2 sm:mb-3 px-4">
        Recommended For You
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 px-4">
        {recommendedForYouRestaurants.map((restaurant, index) => {
          const restaurantSlug =
            restaurant.slug ||
            restaurant.name.toLowerCase().replace(/\s+/g, "-");
          return (
            <motion.div
              key={`recommended-${restaurant.mongoId || restaurant.id || restaurantSlug}`}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: index * 0.05 }}>
              <Link
                to={`/user/restaurants/${restaurantSlug}`}
                className="block rounded-[20px] overflow-hidden border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1a1a1a] shadow-sm hover:shadow-md transition-shadow">
                <div className="relative h-24 sm:h-28 md:h-32 bg-gray-50">
                  <RestaurantImageCarousel
                    restaurant={restaurant}
                    backendOrigin={BACKEND_ORIGIN}
                    className="h-24 sm:h-28 md:h-32"
                    roundedClass="rounded-t-[20px]"
                  />
                  <div className={`absolute bottom-2 left-2 px-2 py-0.5 rounded-lg ${Number(restaurant.rating) > 0 ? "bg-black/80 backdrop-blur-md text-white font-medium" : "bg-gray-200/90 text-gray-600 font-medium"} text-[10px] shadow-lg border border-white/10`}>
                    {Number(restaurant.rating) > 0 ? Number(restaurant.rating).toFixed(1) : "NEW"}
                  </div>
                </div>
                <div className="p-2.5">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate tracking-tight">
                    {restaurant.name}
                  </p>
                  <p className="text-[10px] text-[#7e3866] font-bold mt-1 flex items-center gap-1 uppercase tracking-wider">
                    <Flame className="w-3.5 h-3.5 fill-[#7e3866]" />
                    Near & Fast
                  </p>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}
