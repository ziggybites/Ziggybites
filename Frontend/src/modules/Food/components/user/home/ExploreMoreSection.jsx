import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import OptimizedImage from "@food/components/OptimizedImage";
import { ExploreGridSkeleton } from "@food/components/ui/loading-skeletons";

export default function ExploreMoreSection({
  exploreMoreHeading,
  showExploreSkeleton,
  finalExploreItems
}) {
  return (
    <motion.section
          className="hidden md:block content-auto pt-2 sm:pt-3 lg:pt-4"
          initial={false}
          animate={{ opacity: 1, y: 0 }}>
          <div className="px-4 mb-6 flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white leading-tight">
              {exploreMoreHeading}
            </h2>
            <div className="h-[1px] bg-gray-100 dark:bg-gray-800 flex-1"></div>
          </div>
          <div className="px-4 pb-4 lg:pb-6">
            <div className="flex overflow-x-auto no-scrollbar gap-4 sm:gap-5 md:gap-6 items-start py-2">
              {showExploreSkeleton ? (
                Array(6).fill(0).map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-20 sm:w-24 md:w-28">
                    <ExploreGridSkeleton count={1} />
                  </div>
                ))
              ) : (
                finalExploreItems.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{
                      duration: 0.4,
                      delay: index * 0.08,
                    }}
                    whileHover={{ y: -8 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-shrink-0 w-20 sm:w-24 md:w-28">
                    <Link
                      to={item.href}
                      className="block w-full">
                      <div className="flex flex-col items-center gap-2 w-full group">
                        <div className="relative w-full aspect-square rounded-[1.25rem] bg-white dark:bg-[#1a1a1a] flex items-center justify-center shadow-[0_4px_12px_-4px_rgba(0,0,0,0.1)] group-hover:shadow-[0_12px_24px_-6px_rgba(0,0,0,0.15)] transition-all duration-500 overflow-hidden border border-gray-100 dark:border-gray-800 group-hover:border-[#7e3866]/40">
                          {/* Colorful Glow Background */}
                          <div className={`absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500 bg-gradient-to-br ${index % 3 === 0 ? 'from-[#7e3866] to-rose-500' : index % 3 === 1 ? 'from-indigo-500 to-purple-500' : 'from-teal-500 to-emerald-500'} z-20 pointer-events-none`} />

                          {/* Shine Effect */}
                          <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
                            <motion.div
                              animate={{ x: ['-200%', '200%'] }}
                              transition={{ duration: 3, repeat: Infinity, repeatDelay: 5 + index * 0.5 }}
                              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent skew-x-[-25deg] w-[150%]"
                            />
                          </div>

                          <OptimizedImage
                            src={item.image}
                            alt={item.label}
                            className="w-full h-full object-cover relative z-10 transition-transform duration-500 group-hover:scale-110"
                            width={200}
                            height={200}
                          />
                        </div>
                        <span className="text-[10px] sm:text-[11px] font-bold text-gray-500 dark:text-gray-400 group-hover:text-[#7e3866] dark:group-hover:text-white transition-colors text-center tracking-tight leading-tight uppercase px-1">
                          {item.label}
                        </span>
                      </div>
                    </Link>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </motion.section>
  );
}
