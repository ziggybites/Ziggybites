import React from "react";
import { MapPin, ChevronDown, Search, Mic, ShoppingCart } from "lucide-react";

export default function MobileHeader({ 
  effectiveLocation, 
  handleLocationClick, 
  handleSearchFocus, 
  vegMode, 
  handleVegModeChange
}) {
  return (
    <header className="sticky top-0 z-50 bg-[#fff9f2]/95 backdrop-blur-md px-5 pt-3 pb-2">
            <div className="relative flex min-h-[34px] items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleLocationClick}
                className="min-w-0 max-w-[34%] flex items-center gap-1.5 text-left"
              >
                <MapPin className="h-4 w-4 text-black fill-black" />
                <span className="text-[11px] font-black text-gray-900 truncate">
                  {effectiveLocation?.area || effectiveLocation?.city || "Select location"}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-gray-700" />
              </button>

              <div className="pointer-events-none absolute left-1/2 top-1/2 w-[34%] -translate-x-1/2 -translate-y-1/2 text-center">
                <div className="text-[18px] leading-none font-black italic text-[#e92823] tracking-tight">
                  ZiggyBites
                </div>
                <div className="truncate text-[5px] font-black text-gray-700 tracking-[0.08em]">
                  Homemade. Healthy. Delivered.
                </div>
              </div>

              <div className="ml-auto flex w-[34%] items-center justify-end gap-3 text-gray-900">
                <ShoppingCart className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={handleSearchFocus}
                className="h-10 flex-1 bg-white rounded-full border border-orange-100 shadow-sm px-4 flex items-center gap-2 text-left"
              >
                <Search className="h-4 w-4 text-[#e92823]" />
                <span className="text-xs font-semibold text-gray-400 truncate">
                  Search "veg thali"
                </span>
                <Mic className="h-4 w-4 text-gray-500 ml-auto" />
              </button>
              <button
                type="button"
                onClick={() => handleVegModeChange?.(!vegMode)}
                className="relative h-10 w-12 rounded-xl bg-[#6aad37] text-white flex flex-col items-center justify-center shadow-sm"
                aria-label="Toggle veg mode"
              >
                <span className="text-[8px] font-black leading-none">VEG</span>
                <span className="text-[7px] font-black leading-none">MODE</span>
                <span
                  className={`absolute -bottom-1 right-0 h-3.5 w-7 rounded-full border border-white bg-[#9bd46f] transition-colors ${
                    vegMode ? "bg-[#6aad37]" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-transform ${
                      vegMode ? "translate-x-3.5" : "translate-x-0.5"
                    }`}
                  />
                </span>
              </button>
            </div>
          </header>
  );
}
