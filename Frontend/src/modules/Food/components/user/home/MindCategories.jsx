import React from "react";
import { Link } from "react-router-dom";
import { ArrowDownUp } from "lucide-react";
import { motion } from "framer-motion";
import OptimizedImage from "@food/components/OptimizedImage";

export default function MindCategories({ displayCategories }) {
  return (
    <div
                  id="categories-section"
                  className="px-4 py-2.5 space-y-3 bg-white dark:bg-[#0a0a0a]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white min-w-0 flex-shrink leading-tight">What's on your mind today?</h2>
                    <div className="h-[1px] bg-gray-100 dark:bg-gray-800 flex-1"></div>
                    <Link to="/food/user/categories" className="text-sm font-bold text-gray-400 dark:text-gray-500 flex items-center gap-0.5 whitespace-nowrap shrink-0">
                      View All <ArrowDownUp className="h-3 w-3 rotate-90" />
                    </Link>
                  </div>

                  {/* Categories Horizontal Slider */}
                  <div className="flex overflow-x-auto gap-4 sm:gap-5 pb-4 scrollbar-hide -mx-4 px-4 mask-edge-fade">
                    {displayCategories.map((category, index) => (
                      <Link
                        key={category.id || index}
                        to={`/food/user/category/${category.slug}`}
                        className="flex-shrink-0 w-[178px] sm:w-[220px] md:w-[260px] rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1a1a1a] shadow-[0_6px_20px_rgba(15,23,42,0.11)] p-2.5 sm:p-3 flex flex-col items-center justify-between group active:scale-95 transition-all duration-300"
                      >
                        <div className="relative h-[136px] sm:h-40 md:h-[184px] w-full overflow-hidden rounded-xl">
                          {/* Shining Glint Effect */}
                          <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
                            <motion.div
                              animate={{
                                x: ['-200%', '200%'],
                              }}
                              transition={{
                                duration: 2,
                                repeat: Infinity,
                                repeatDelay: 3 + index * 0.5,
                                ease: "easeInOut"
                              }}
                              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-20deg] w-[150%] h-full"
                            />
                          </div>

                          <OptimizedImage
                            src={category.image}
                            alt={category.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          />
                        </div>
                        <span className={`mt-2.5 text-sm sm:text-base font-extrabold text-center leading-tight line-clamp-2 w-full px-1 min-h-[38px] ${["text-[#4f9f2f]", "text-[#ef2b52]", "text-[#f26d21]", "text-[#7146d8]", "text-[#4f9f2f]"][index % 5]}`}>
                          {category.name}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
  );
}
