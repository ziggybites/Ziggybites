import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, Bookmark, Plus, Check } from "lucide-react";
import { Button } from "@food/components/ui/button";
import { Checkbox } from "@food/components/ui/checkbox";
import { useProfile } from "@food/context/ProfileContext";

export default function ManageCollectionsModal({
  showManageCollections,
  setShowManageCollections,
  selectedRestaurantSlug,
  setSelectedRestaurantSlug
}) {
  const { isFavorite, removeFavorite, getFavorites } = useProfile();

  if (typeof window === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {showManageCollections && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/40 z-[9999]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setShowManageCollections(false)}
          />

          {/* Manage Collections Bottom Sheet */}
          <motion.div
            className="fixed left-0 right-0 bottom-0 z-[10000] bg-white rounded-t-3xl shadow-2xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{
              duration: 0.2,
              type: "spring",
              damping: 30,
              stiffness: 400,
            }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-6 pb-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">
                Manage Collections
              </h2>
              <button
                onClick={() => setShowManageCollections(false)}
                className="h-8 w-8 rounded-full bg-gray-700 flex items-center justify-center hover:bg-gray-800 transition-colors">
                <X className="h-4 w-4 text-white" />
              </button>
            </div>

            {/* Collections List */}
            <div className="px-4 py-4 space-y-2 max-h-[60vh] overflow-y-auto">
              {/* Bookmarks Collection */}
              <div
                className="w-full flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                }}>
                <div className="h-12 w-12 rounded-lg bg-pink-100 flex items-center justify-center flex-shrink-0">
                  <Bookmark className="h-6 w-6 text-red-500 fill-red-500" />
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-medium text-gray-900">
                      Bookmarks
                    </span>
                    {selectedRestaurantSlug && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isFavorite(selectedRestaurantSlug)}
                          onCheckedChange={(checked) => {
                            if (!checked) {
                              removeFavorite(selectedRestaurantSlug);
                              setSelectedRestaurantSlug(null);
                              setShowManageCollections(false);
                            }
                          }}
                          className="h-5 w-5 rounded border-2 border-red-500 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                        />
                      </div>
                    )}
                    {!selectedRestaurantSlug && (
                      <div className="h-5 w-5 rounded border-2 border-red-500 bg-red-500 flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {getFavorites().length} restaurant
                    {getFavorites().length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* Create new Collection */}
              <button
                className="w-full flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
                onClick={() => setShowManageCollections(false)}>
                <div className="h-12 w-12 rounded-lg bg-pink-100 flex items-center justify-center flex-shrink-0">
                  <Plus className="h-6 w-6 text-red-500" />
                </div>
                <div className="flex-1 text-left">
                  <span className="text-base font-medium text-gray-900">
                    Create new Collection
                  </span>
                </div>
              </button>
            </div>

            {/* Done Button */}
            <div className="border-t border-gray-200 px-4 py-4">
              <Button
                className="w-full bg-gray-300 hover:bg-gray-400 text-gray-700 py-3 rounded-lg font-medium"
                onClick={() => {
                  setSelectedRestaurantSlug(null);
                  setShowManageCollections(false);
                }}>
                Done
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
