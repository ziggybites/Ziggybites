import React from "react";

export default function HomeCategories({ 
  loadingRealCategories, 
  homeCategoryTiles, 
  selectedHomeCategory, 
  setSelectedHomeCategory 
}) {
  return (
    <section className="mt-4">
      {/* Category Horizontal Scroll Row */}
      <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide -mx-5 px-5 mask-edge-fade">
        {loadingRealCategories && homeCategoryTiles.length === 0 ? (
          Array.from({ length: 5 }).map((_, index) => (
            <div 
              key={`home-category-skeleton-${index}`} 
              className="flex-shrink-0 w-24 h-24 rounded-xl border border-orange-100 bg-white shadow-sm flex flex-col items-center justify-start gap-1.5 p-2 overflow-hidden"
            >
              <div className="h-13 w-20 animate-pulse bg-orange-100 rounded-full mx-auto" />
              <div className="h-2 w-12 animate-pulse rounded bg-orange-100 my-0.5 mx-auto" />
            </div>
          ))
        ) : homeCategoryTiles.length === 0 ? (
          <div className="w-full py-4 text-center text-xs font-semibold text-gray-500">
            No categories available
          </div>
        ) : (
          homeCategoryTiles.map((category) => {
            const isSelected = selectedHomeCategory?.slug === category.slug;

            return (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  setSelectedHomeCategory((current) =>
                    current?.slug === category.slug ? null : category,
                  )
                  window.setTimeout(() => {
                    document.getElementById("home-recommended-items")?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    })
                  }, 80)
                }}
                className="flex-shrink-0 w-24 text-left focus:outline-none"
              >
                <div
                  className={`relative rounded-xl bg-white border shadow-sm flex flex-col items-center justify-start gap-1.5 p-2 h-24 overflow-hidden transition-all duration-300 ${
                    isSelected
                      ? "border-[#e92823] ring-2 ring-[#e92823]/15 scale-[1.02]"
                      : "border-orange-100 hover:border-orange-200"
                  }`}
                >
                  {category.healthy && (
                    <span className="absolute top-1 right-1 rounded-full bg-[#6aad37] px-1.5 py-0.5 text-[6px] font-black uppercase text-white shadow-sm z-10">
                      Healthy
                    </span>
                  )}
                  
                  {/* Category Image Container - oval container */}
                  <div className="h-13 w-20 overflow-hidden rounded-full bg-orange-50/50 flex items-center justify-center relative shrink-0">
                    {category.image ? (
                      <img 
                        src={category.image} 
                        alt={category.name} 
                        className="h-full w-full object-cover transform hover:scale-105 transition-transform duration-300" 
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-xl font-black text-[#e92823]">
                        {String(category.name || "M").slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  
                  <span
                    className={`text-[9px] leading-tight font-extrabold text-center line-clamp-2 w-full px-1 ${
                      isSelected ? "text-[#e92823]" : "text-gray-700"
                    }`}
                  >
                    {category.name}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
