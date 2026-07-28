import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import OptimizedImage from "@food/components/OptimizedImage";
import { CategoryChipRowSkeleton } from "@food/components/ui/loading-skeletons";
import offerImage from "@food/assets/offerimage.png";

export default function CategoryRailSection({
  categoryScrollRef,
  showCategorySkeleton,
  displayCategories
}) {
  const navigate = useNavigate();
  const labelColors = ["text-[#4f9f2f]", "text-[#ef2b52]", "text-[#f26d21]", "text-[#7146d8]", "text-[#4f9f2f]"];

  return (
    <section className="space-y-1 sm:space-y-1.5 lg:space-y-2 min-h-[94px] sm:min-h-[108px]">
      <div
        ref={categoryScrollRef}
        className="flex gap-2.5 sm:gap-3 overflow-x-auto overflow-y-visible scrollbar-hide scroll-smooth px-2 sm:px-3 py-2 sm:py-3"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <div
          className="flex-shrink-0 w-[100px] sm:w-[122px] rounded-2xl border border-gray-100 bg-white shadow-[0_3px_12px_rgba(15,23,42,0.08)] p-1.5 flex flex-col items-center justify-between cursor-pointer transition-transform hover:-translate-y-0.5 active:scale-95"
          onClick={() => navigate("/user/under-250")}
        >
          <div className="h-12 sm:h-14 w-full overflow-hidden">
            <img src={offerImage} alt="Offers" className="h-full w-full object-cover" />
          </div>
          <span className="mt-1 text-[11px] sm:text-xs font-extrabold text-[#f26d21] text-center leading-tight truncate w-full">Offers</span>
        </div>

        {showCategorySkeleton ? (
          <CategoryChipRowSkeleton className="py-1" />
        ) : (
          displayCategories.slice(0, 12).map((category, index) => (
            <Link
              key={category.id || index}
              to={`/food/user/category/${category.slug || category.name.toLowerCase().replace(/\s+/g, "-")}`}
              className="flex-shrink-0 w-[100px] sm:w-[122px] rounded-2xl border border-gray-100 bg-white shadow-[0_3px_12px_rgba(15,23,42,0.08)] p-1.5 flex flex-col items-center justify-between group transition-all duration-300 hover:-translate-y-0.5"
              style={{ animation: `fade-in-up 0.5s ease-out forwards ${index * 0.05}s`, opacity: 0 }}
            >
              <div className="h-12 sm:h-14 w-full overflow-hidden">
                <OptimizedImage
                  src={category.image}
                  alt={category.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  sizes="80px"
                />
              </div>
              <span className={`mt-1 text-[11px] sm:text-xs font-extrabold text-center leading-tight truncate w-full ${labelColors[index % labelColors.length]}`}>
                {category.name}
              </span>
            </Link>
          ))
        )}

        {displayCategories.length > 12 && !showCategorySkeleton && (
          <div
            className="flex-shrink-0 flex flex-col items-center gap-2 cursor-pointer group"
            onClick={() => navigate("/food/user/categories")}
          >
            <div className="w-[100px] sm:w-[122px] h-[78px] sm:h-[90px] rounded-2xl bg-white flex items-center justify-center border border-gray-100 shadow-[0_3px_12px_rgba(15,23,42,0.08)] group-hover:border-[#7e3866] transition-all">
              <Plus className="w-6 h-6 text-[#7e3866]" />
            </div>
            <span className="sr-only">See All</span>
          </div>
        )}
      </div>
    </section>
  );
}
