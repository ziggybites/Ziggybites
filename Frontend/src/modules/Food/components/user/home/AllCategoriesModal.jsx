import React from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import OptimizedImage from "@food/components/OptimizedImage";

export default function AllCategoriesModal({
  showAllCategoriesModal,
  setShowAllCategoriesModal,
  displayCategories
}) {
  if (typeof window === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {showAllCategoriesModal && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setShowAllCategoriesModal(false)}
            className="fixed inset-0 bg-black/40 z-[9998] backdrop-blur-sm"
          />

          {/* Modal - Full screen with rounded corners */}
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{
              type: "spring",
              damping: 30,
              stiffness: 300,
            }}
            className="fixed inset-x-0 bottom-0 top-12 sm:top-16 md:top-20 z-[9999] bg-white dark:bg-[#1a1a1a] rounded-t-3xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 sm:px-6 sm:py-5 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                All Categories
              </h2>
              <button
                onClick={() => setShowAllCategoriesModal(false)}
                className="p-1.5 sm:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Close">
                <X className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Categories Grid - Scrollable */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 sm:py-5">
              <div className="grid grid-cols-3 gap-4 sm:gap-5 md:gap-6">
                {displayCategories.map((category, index) => {
                  const categoryData = {
                    name: category.name || category.label,
                    image: category.image || category.imageUrl,
                    slug: category.slug,
                  };
                  return (
                    <motion.div
                      key={category.id || index}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        duration: 0.3,
                        delay: index * 0.02,
                        type: "spring",
                        stiffness: 100,
                      }}
                      whileTap={{ scale: 0.95 }}>
                      <Link
                        to={`/food/user/category/${categoryData.slug || categoryData.name.toLowerCase().replace(/\s+/g, "-")}`}
                        onClick={() => setShowAllCategoriesModal(false)}
                        className="block">
                        <div className="flex flex-col items-center gap-2 sm:gap-2.5 cursor-pointer w-full">
                          <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-2xl overflow-hidden shadow-md transition-all hover:shadow-lg flex-shrink-0">
                            <OptimizedImage
                              src={categoryData.image}
                              alt={categoryData.name}
                              className="w-full h-full bg-white object-cover"
                              sizes="(max-width: 640px) 80px, (max-width: 768px) 96px, 112px"
                              objectFit="cover"
                              placeholder="blur"
                              onError={() => { }}
                            />
                          </div>
                          <span className="text-xs sm:text-sm font-medium text-gray-800 dark:text-gray-200 text-center leading-tight px-1 break-words w-full min-w-0">
                            {categoryData.name}
                          </span>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
