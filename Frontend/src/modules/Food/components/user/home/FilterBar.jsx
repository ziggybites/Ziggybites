import React from "react";
import { SlidersHorizontal, MapPin } from "lucide-react";

export default function FilterBar({
  setIsFilterOpen,
  foodPreferenceFilters,
  activeFilters,
  setActiveFilters,
  applyFiltersAndRefetch,
  sortBy,
  selectedCuisine
}) {
  return (
    <section className="py-2.5 px-4 bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-md sticky top-0 z-[40] -mx-4 w-[calc(100%+2rem)] border-b border-gray-100 dark:border-white/5 shadow-sm transition-colors duration-300">
                  <div
                    className="flex items-center gap-2 overflow-x-auto scrollbar-hide px-4"
                    style={{
                      scrollbarWidth: "none",
                      msOverflowStyle: "none",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setIsFilterOpen(true)}
                      className="h-9 px-4 rounded-full flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 font-bold transition-all bg-white dark:bg-[#1a1a1a] border border-gray-200 shadow-sm active:scale-95"
                    >
                      <SlidersHorizontal className="h-4 w-4 text-black" />
                      <span className="text-xs font-bold text-black dark:text-white uppercase tracking-tight">
                        Filters
                      </span>
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
                            const nextFilters = new Set(activeFilters);
                            if (filter.id === "healthy") {
                              nextFilters.add("healthy");
                            } else {
                              nextFilters.delete("healthy");
                            }
                            setActiveFilters(nextFilters);
                            void applyFiltersAndRefetch(
                              nextFilters,
                              sortBy,
                              selectedCuisine,
                            );
                          }}
                          className={`h-9 px-4 rounded-full flex items-center gap-2 whitespace-nowrap flex-shrink-0 transition-all font-bold shadow-sm active:scale-95 ${
                            isActive
                              ? filter.id === "healthy"
                                ? "bg-green-600 text-white border border-green-600"
                                : "bg-[#7e3866] text-white border border-[#7e3866]"
                              : "bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {filter.label}
                        </button>
                      );
                    })}

                    {[
                      { id: "delivery-under-30", label: "Under 30 mins" },
                      { id: "delivery-under-45", label: "Under 45 mins" },
                      { id: "distance-under-1km", label: "Under 1km", icon: MapPin },
                      { id: "distance-under-2km", label: "Under 2km", icon: MapPin },
                    ].map((filter) => {
                      const Icon = filter.icon;
                      const isActive = activeFilters.has(filter.id);
                      return (
                        <button
                          key={filter.id}
                          type="button"
                          onClick={() => {
                            const nextFilters = new Set(activeFilters);
                            if (nextFilters.has(filter.id)) {
                              nextFilters.delete(filter.id);
                            } else {
                              nextFilters.add(filter.id);
                            }
                            setActiveFilters(nextFilters);
                            void applyFiltersAndRefetch(
                              nextFilters,
                              sortBy,
                              selectedCuisine,
                            );
                          }}
                          className={`h-9 px-4 rounded-full flex items-center gap-2 whitespace-nowrap flex-shrink-0 transition-all font-bold shadow-sm active:scale-95 ${isActive
                            ? "bg-[#7e3866] text-white border border-[#7e3866] hover:bg-orange-700"
                            : "bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                            }`}
                        >
                          {Icon && (
                            <Icon
                              className={`h-3.5 w-3.5 ${isActive ? "fill-white" : ""}`}
                            />
                          )}
                          <span className="text-xs font-bold tracking-tight">
                            {filter.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
  );
}
