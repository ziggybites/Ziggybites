import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Search, Mic, SlidersHorizontal, MapPin } from "lucide-react";
import OptimizedImage from "@food/components/OptimizedImage";

export default function StickyHeader({
  isStickyHeaderVisible,
  showStickySearch,
  handleSearchFocus,
  displayCategories,
  setIsFilterOpen,
  foodPreferenceFilters,
  activeFilters,
  toggleFilter
}) {
  return (
    <AnimatePresence>
                  {isStickyHeaderVisible && (
                    <motion.div
                      initial={{ y: -200 }}
                      animate={{ y: 0 }}
                      exit={{ y: -200 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="fixed top-0 left-0 right-0 z-[100] bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-md shadow-lg border-b border-gray-100 dark:border-white/5 safe-top"
                    >
                      {/* Search Bar Row (appears when scrolling up) */}
                      <AnimatePresence>
                        {showStickySearch && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="px-4 pt-3 pb-2"
                          >
                            <div
                              className="bg-white dark:bg-[#1a1a1a] rounded-2xl flex items-center px-4 py-3 cursor-pointer border-2 border-[#7e3866]/30 dark:border-[#7e3866]/50 shadow-md"
                              onClick={handleSearchFocus}
                            >
                              <Search className="h-5 w-5 text-[#7e3866] dark:text-[#a14b84] mr-3" strokeWidth={2.5} />
                              <div className="flex-1 relative h-5 overflow-hidden">
                                <span className="absolute inset-0 text-base text-gray-400 font-medium">Search "biryani"</span>
                              </div>
                              <div className="h-5 w-[1px] bg-gray-200 dark:bg-white/10 mx-2" />
                              <Mic className="h-5 w-5 text-[#7e3866] dark:text-[#a14b84]" />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Categories Slider (Increased Icon Size) */}
                      <div className="flex overflow-x-auto gap-5 py-3 pb-2 scrollbar-hide px-4 mask-edge-fade">
                        {displayCategories.map((category, index) => (
                          <Link
                            key={`sticky-${category.id || index}`}
                            to={`/food/user/category/${category.slug}`}
                            className="flex-shrink-0 flex flex-col items-center gap-1.5 group w-[86px]"
                          >
                            <div className="h-[86px] w-[86px] rounded-2xl overflow-hidden border-2 border-gray-100 dark:border-white/10 shadow-md bg-white dark:bg-white/5 transition-transform group-active:scale-95">
                              <OptimizedImage
                                src={category.image}
                                alt={category.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 text-center truncate w-full uppercase tracking-tighter">
                              {category.name}
                            </span>
                          </Link>
                        ))}
                      </div>

                      {/* Integrated Filters Row */}
                      <div className="px-4 pb-3">
                        <div
                          className="flex items-center gap-2 overflow-x-auto scrollbar-hide"
                          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                        >
                          <button
                            type="button"
                            onClick={() => setIsFilterOpen(true)}
                            className="h-8 px-3 rounded-full flex items-center gap-1.5 bg-white dark:bg-white/10 border border-gray-200 dark:border-white/5 shadow-sm whitespace-nowrap"
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            <span className="text-[10px] font-bold uppercase">Filters</span>
                          </button>

                          {foodPreferenceFilters.map((filter) => {
                            const Icon = filter.icon;
                            const isActive =
                              filter.id === "healthy"
                                ? activeFilters.has("healthy")
                                : !activeFilters.has("healthy");
                            return (
                              <button
                                key={filter.id}
                                type="button"
                                onClick={() => {
                                  if (filter.id === "healthy" && !activeFilters.has("healthy")) {
                                    toggleFilter("healthy");
                                  }
                                  if (filter.id === "all" && activeFilters.has("healthy")) {
                                    toggleFilter("healthy");
                                  }
                                }}
                                className={`h-8 px-4 rounded-full flex items-center gap-2 whitespace-nowrap transition-all font-bold text-[10px] uppercase ${
                                  isActive
                                    ? filter.id === "healthy"
                                      ? "bg-green-600 text-white"
                                      : "bg-[#7e3866] text-white"
                                    : "bg-white dark:bg-white/5 border border-gray-100 dark:border-white/5 text-gray-600 dark:text-gray-400"
                                }`}
                              >
                                <Icon className="h-3 w-3" />
                                {filter.label}
                              </button>
                            );
                          })}

                          {[
                            { id: "delivery-under-30", label: "Under 30 mins" },
                            { id: "delivery-under-45", label: "Under 45 mins" },
                            { id: "distance-under-1km", label: "Under 1km", icon: MapPin },
                          ].map((filter) => {
                            const Icon = filter.icon;
                            const isActive = activeFilters.has(filter.id);
                            return (
                              <button
                                key={filter.id}
                                type="button"
                                onClick={() => toggleFilter(filter.id)}
                                className={`h-8 px-4 rounded-full flex items-center gap-2 whitespace-nowrap transition-all font-bold text-[10px] uppercase ${isActive
                                  ? "bg-[#7e3866] text-white"
                                  : "bg-white dark:bg-white/5 border border-gray-100 dark:border-white/5 text-gray-600 dark:text-gray-400"
                                  }`}
                              >
                                {Icon && <Icon className="h-3 w-3" />}
                                {filter.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
  );
}
