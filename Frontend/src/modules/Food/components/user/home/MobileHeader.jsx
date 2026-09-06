import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, ChevronDown, Search, Mic, Bell } from "lucide-react";
import { DEFAULT_APP_CUSTOMIZATION, loadAppCustomization } from "@food/utils/appCustomization";
import useNotificationInbox from "@food/hooks/useNotificationInbox";

export default function MobileHeader({ 
  effectiveLocation, 
  handleLocationClick, 
  handleSearchFocus, 
  vegMode, 
  handleVegModeChange,
  cartCount = 0,
}) {
  const navigate = useNavigate();
  const [appCustomization, setAppCustomization] = useState(DEFAULT_APP_CUSTOMIZATION);
  const [localNotifs, setLocalNotifs] = useState(() => {
    try {
      const saved = localStorage.getItem('food_user_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const { unreadCount: broadcastUnreadCount = 0 } = useNotificationInbox("user", { limit: 20 });

  useEffect(() => {
    const syncNotifications = () => {
      try {
        const saved = localStorage.getItem('food_user_notifications');
        setLocalNotifs(saved ? JSON.parse(saved) : []);
      } catch {}
    };
    window.addEventListener('notificationsUpdated', syncNotifications);
    return () => window.removeEventListener('notificationsUpdated', syncNotifications);
  }, []);

  const unreadCount = (Array.isArray(localNotifs) ? localNotifs.filter(n => !n.read).length : 0) + (broadcastUnreadCount || 0);

  useEffect(() => {
    let mounted = true;
    loadAppCustomization()
      .then((settings) => {
        if (mounted) setAppCustomization(settings);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-[#fff9f2]/95 dark:bg-[#0a0a0a]/95 backdrop-blur-md px-5 pt-3 pb-2">
            <div className="relative flex min-h-[34px] items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleLocationClick}
                className="min-w-0 max-w-[34%] flex items-center gap-1.5 text-left"
              >
                <MapPin className="h-4 w-4 text-black dark:text-white fill-black dark:fill-white" />
                <span className="text-[11px] font-black text-gray-900 dark:text-white truncate">
                  {effectiveLocation?.area || effectiveLocation?.city || "Select location"}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-gray-700 dark:text-gray-300" />
              </button>

              <div className="pointer-events-none absolute left-1/2 top-1/2 w-[34%] -translate-x-1/2 -translate-y-1/2 text-center">
                <div className="text-[18px] leading-none font-black italic text-[#e92823] tracking-tight">
                  ZiggyBites
                </div>
                <div className="truncate text-[5px] font-black text-gray-700 dark:text-gray-300 tracking-[0.08em]">
                  Homemade. Healthy. Delivered.
                </div>
              </div>

              <div className="relative z-10 ml-auto flex w-[34%] items-center justify-end gap-3 text-gray-900 dark:text-white">
                <button
                  type="button"
                  onClick={() => navigate("/food/user/notifications")}
                  className="relative p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center justify-center text-gray-800 dark:text-white"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  )}
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={handleSearchFocus}
                className="h-10 flex-1 bg-white dark:bg-[#1a1a1a] rounded-full border border-orange-100 dark:border-gray-800 shadow-sm px-4 flex items-center gap-2 text-left"
              >
                <Search className="h-4 w-4 text-[#e92823]" />
                <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 truncate">
                  Search "veg thali"
                </span>
                <Mic className="h-4 w-4 text-gray-500 dark:text-gray-400 ml-auto" />
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
