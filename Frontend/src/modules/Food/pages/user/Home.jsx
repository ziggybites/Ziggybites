
import HomeCategories from "@food/components/user/home/HomeCategories";
import { useHome } from "@food/hooks/useHome";
import MobileHeader from "@food/components/user/home/MobileHeader";import { useSearchParams, Link, useNavigate } from "react-router-dom";
import React, {
  useRef,
  useEffect,
  useState,
  useMemo,
  useCallback,
  startTransition,
} from "react";
import { createPortal } from "react-dom";
import {
  Star,
  Clock,
  MapPin,
  Heart,
  Search,
  Tag,
  Flame,
  ShoppingBag,
  ShoppingCart,
  Mic,
  SlidersHorizontal,
  CheckCircle2,
  Bookmark,
  BadgePercent,
  X,
  ArrowDownUp,
  ArrowRight,
  Timer,
  CalendarClock,
  ShieldCheck,
  IndianRupee,
  UtensilsCrossed,
  Pizza,
  Leaf,
  AlertCircle,
  Loader2,
  Plus,
  Check,
  Share2,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import Footer from "@food/components/user/Footer";
import StickyCartCard from "@food/components/user/StickyCartCard";
import OrderTrackingCard from "@food/components/user/OrderTrackingCard";
import {
  CategoryChipRowSkeleton,
  ExploreGridSkeleton,
  HeroBannerSkeleton,
  LoadingSkeletonRegion,
  RestaurantGridSkeleton,
} from "@food/components/ui/loading-skeletons";
import { useProfile } from "@food/context/ProfileContext";
import { useCart } from "@food/context/CartContext";
import { HorizontalCarousel } from "@food/components/ui/horizontal-carousel";
import { DotPattern } from "@food/components/ui/dot-pattern";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@food/components/ui/card";
import { Button } from "@food/components/ui/button";
import { Badge } from "@food/components/ui/badge";
import { Input } from "@food/components/ui/input";
import { Switch } from "@food/components/ui/switch";
import { Checkbox } from "@food/components/ui/checkbox";
import {
  useSearchOverlay,
  useLocationSelector,
} from "@food/components/user/UserLayout";
import PageNavbar from "@food/components/user/PageNavbar";

const debugLog = (...args) => { };
const debugWarn = (...args) => { };
const debugError = (...args) => { };

// Import shared food images - prevents duplication
import { foodImages } from "@food/constants/images";

import { Avatar, AvatarFallback } from "@food/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@food/components/ui/dropdown-menu";
import { useLocation } from "@food/hooks/useLocation";
import { useZone } from "@food/hooks/useZone";
import quickSpicyLogo from "@food/assets/quicky-spicy-logo.png";
import offerImage from "@food/assets/offerimage.png";
import api, { publicGetOnce, restaurantAPI, adminAPI } from "@food/api";
import { API_BASE_URL } from "@food/api/config";
import OptimizedImage from "@food/components/OptimizedImage";
import { getRestaurantAvailabilityStatus } from "@food/utils/restaurantAvailability";
import { DEFAULT_APP_CUSTOMIZATION, loadAppCustomization } from "@food/utils/appCustomization";
import HomeHeader from "@food/components/user/home/HomeHeader";
import QuickSection from "@food/components/user/home/QuickSection";
import PromoRow from "@food/components/user/home/PromoRow";
import FestBanner from "@food/components/user/home/FestBanner";
import chefMascot from "@food/assets/chef-mascot.png";

// Explore More Icons
import exploreOffers from "@food/assets/explore more icons/offers.png";
import exploreGourmet from "@food/assets/explore more icons/gourmet.png";
import exploreTop10 from "@food/assets/explore more icons/top 10.png";
import exploreCollection from "@food/assets/explore more icons/collection.png";

// Banner images for hero carousel - will be fetched from API

// Animated placeholder for search - moved outside component to prevent recreation
const placeholders = [
  'Search "burger"',
  'Search "biryani"',
  'Search "pizza"',
  'Search "desserts"',
  'Search "chinese"',
  'Search "thali"',
  'Search "momos"',
  'Search "dosa"',
];

const WEBVIEW_SESSION_CACHE_BUSTER = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const HOME_MENU_CACHE = new Map();
const HOME_MENU_REQUESTS = new Map();
const HOME_MENU_META_CACHE = new Map();
const HOME_CATEGORY_ITEMS_CACHE = new Map();
const HOME_RECOMMENDED_ITEMS_CACHE = new Map();

const readMenuFromResponse = (response) =>
  response?.data?.data?.menu || response?.data?.menu || null;

const getHomeMenuCacheKey = (restaurantId) => String(restaurantId || "").trim();

const loadRestaurantMenuCached = async (restaurantId) => {
  const cacheKey = getHomeMenuCacheKey(restaurantId);
  if (!cacheKey) return null;

  if (HOME_MENU_CACHE.has(cacheKey)) {
    return HOME_MENU_CACHE.get(cacheKey);
  }

  if (HOME_MENU_REQUESTS.has(cacheKey)) {
    return HOME_MENU_REQUESTS.get(cacheKey);
  }

  const request = restaurantAPI
    .getMenuByRestaurantId(cacheKey)
    .then((response) => {
      const menu = readMenuFromResponse(response);
      HOME_MENU_CACHE.set(cacheKey, menu);
      return menu;
    })
    .catch(() => {
      HOME_MENU_CACHE.set(cacheKey, null);
      return null;
    })
    .finally(() => {
      HOME_MENU_REQUESTS.delete(cacheKey);
    });

  HOME_MENU_REQUESTS.set(cacheKey, request);
  return request;
};

const loadMenusInChunks = async (restaurantIds, chunkSize = 6) => {
  const menusByRestaurantId = new Map();

  for (let index = 0; index < restaurantIds.length; index += chunkSize) {
    const batchIds = restaurantIds.slice(index, index + chunkSize);
    const batchMenus = await Promise.all(
      batchIds.map(async (restaurantId) => [
        restaurantId,
        await loadRestaurantMenuCached(restaurantId),
      ]),
    );

    batchMenus.forEach(([restaurantId, menu]) => {
      menusByRestaurantId.set(String(restaurantId), menu);
    });
  }

  return menusByRestaurantId;
};
const normalizeHealthyFlag = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") return ["true", "1", "yes", "healthy"].includes(value.trim().toLowerCase());
  return false;
};

const normalizeCategoryFoodScope = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");

  if (normalized === "veg" || normalized === "vegetarian") return "veg";
  if (normalized === "non-veg" || normalized === "nonveg" || normalized === "non-vegetarian") return "non-veg";
  if (normalized === "both" || normalized === "all") return "both";
  return "unknown";
};

const isVegFoodItem = (item) => {
  const foodType = String(item?.foodType || item?.type || item?.category || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, "");
  if (foodType === "nonveg" || foodType === "nonvegetarian" || foodType.includes("nonveg")) {
    return false;
  }
  return item?.isVeg === true || foodType === "veg" || foodType === "vegetarian";
};

const getRestaurantDisplayName = (restaurant) => {
  const nameCandidates = [
    restaurant?.name,
    restaurant?.restaurantName,
    restaurant?.restaurantName?.english,
    restaurant?.restaurantName?.value,
    restaurant?.onboarding?.step1?.restaurantName,
  ];
  const resolvedName = nameCandidates.find(
    (candidate) =>
      typeof candidate === "string" && candidate.trim().length > 0,
  );
  return resolvedName ? resolvedName.trim() : "Restaurant";
};

import RestaurantImageCarousel from "@food/components/user/RestaurantImageCarousel";
import SubscriptionHero from "@food/components/user/home/SubscriptionHero";
import OffersBanner from "@food/components/user/home/OffersBanner";
import RecommendedItems from "@food/components/user/home/RecommendedItems";
import CategoryRailSection from "@food/components/user/home/CategoryRailSection";
import FilterBar from "@food/components/user/home/FilterBar";
import MindCategories from "@food/components/user/home/MindCategories";
import StickyHeader from "@food/components/user/home/StickyHeader";
import ExploreMoreSection from "@food/components/user/home/ExploreMoreSection";
import RecommendedRestaurants from "@food/components/user/home/RecommendedRestaurants";
import RestaurantsSection from "@food/components/user/home/RestaurantsSection";
import AllCategoriesModal from "@food/components/user/home/AllCategoriesModal";
import ManageCollectionsModal from "@food/components/user/home/ManageCollectionsModal";
import VegModeOverlay from "@food/components/user/home/VegModeOverlay";

export default function Home() {
  const HERO_BANNER_AUTO_SLIDE_MS = 3500;
  const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const [heroSearch, setHeroSearch] = useState("");
  const { openSearch, closeSearch, searchValue, setSearchValue } =
    useSearchOverlay();
  const { openLocationSelector } = useLocationSelector();
  const { vegMode, setVegMode: setVegModeContext } = useProfile();
  const [prevVegMode, setPrevVegMode] = useState(vegMode);
  const [showVegModePopup, setShowVegModePopup] = useState(false);
  const [showSwitchOffPopup, setShowSwitchOffPopup] = useState(false);
  const [vegModeOption, setVegModeOption] = useState("all"); // "all" or "pure-veg"
  const [selectedHomeCategory, setSelectedHomeCategory] = useState(null);
  const [categoryFoodItems, setCategoryFoodItems] = useState([]);
  const [loadingCategoryFoodItems, setLoadingCategoryFoodItems] = useState(false);
  const [recommendedFoodItems, setRecommendedFoodItems] = useState([]);
  const [loadingRecommendedFoodItems, setLoadingRecommendedFoodItems] = useState(false);
  const [isApplyingVegMode, setIsApplyingVegMode] = useState(false);
  const [isSwitchingOffVegMode, setIsSwitchingOffVegMode] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0, triangleLeft: 0 });
  const vegModeToggleRef = useRef(null);
  const [isStickyHeaderVisible, setIsStickyHeaderVisible] = useState(false);
  const [showStickySearch, setShowStickySearch] = useState(false);
  const lastScrollY = useRef(0);

  // Profile, Cart, Customization setup
  let profileContext = null;
  try {
    profileContext = useProfile();
  } catch (error) {
    debugWarn("ProfileProvider not available, using fallback:", error.message);
    profileContext = {
      addFavorite: () => debugWarn("ProfileProvider not available"),
      removeFavorite: () => debugWarn("ProfileProvider not available"),
      isFavorite: () => false,
      getFavorites: () => [],
      getDefaultAddress: () => null,
    };
  }

  const {
    addFavorite,
    removeFavorite,
    isFavorite,
    getFavorites,
    getDefaultAddress,
  } = profileContext;
  const { addToCart, cart } = useCart();

  // Location and Zone resolution
  const { location } = useLocation();

  const formatSavedAddress = useCallback((address) => {
    if (!address) return "";
    if (address.formattedAddress && address.formattedAddress !== "Select location") {
      return address.formattedAddress;
    }
    const parts = [];
    if (address.additionalDetails) parts.push(address.additionalDetails);
    if (address.street) parts.push(address.street);
    if (address.city) parts.push(address.city);
    if (address.state) parts.push(address.state);
    if (address.zipCode) parts.push(address.zipCode);
    if (parts.length > 0) return parts.join(", ");
    if (address.address && address.address !== "Select location") return address.address;
    return "";
  }, []);

  const savedAddressText = useMemo(() => {
    const defaultAddress = getDefaultAddress?.();
    return formatSavedAddress(defaultAddress);
  }, [getDefaultAddress, formatSavedAddress]);

  const defaultSavedAddress = useMemo(
    () => getDefaultAddress?.() || null,
    [getDefaultAddress],
  );

  const defaultSavedAddressLocation = useMemo(() => {
    const coords = defaultSavedAddress?.location?.coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      const lng = parseFloat(coords[0]);
      const lat = parseFloat(coords[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { latitude: lat, longitude: lng };
      }
    }
    const lat = parseFloat(defaultSavedAddress?.latitude || defaultSavedAddress?.lat);
    const lng = parseFloat(defaultSavedAddress?.longitude || defaultSavedAddress?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { latitude: lat, longitude: lng };
    }
    return null;
  }, [defaultSavedAddress]);

  const effectiveLocation = useMemo(() => {
    let deliveryAddressMode = "saved";
    try {
      deliveryAddressMode = localStorage.getItem("deliveryAddressMode") || "saved";
    } catch {
      deliveryAddressMode = "saved";
    }
    if (deliveryAddressMode === "current") {
      return location;
    }
    if (
      defaultSavedAddressLocation &&
      Number.isFinite(defaultSavedAddressLocation.latitude) &&
      Number.isFinite(defaultSavedAddressLocation.longitude)
    ) {
      const resolvedAddress = formatSavedAddress(defaultSavedAddress);
      return {
        ...(location || {}),
        latitude: defaultSavedAddressLocation.latitude,
        longitude: defaultSavedAddressLocation.longitude,
        area:
          defaultSavedAddress?.additionalDetails ||
          defaultSavedAddress?.street ||
          defaultSavedAddress?.area ||
          location?.area ||
          "",
        city: defaultSavedAddress?.city || location?.city || "",
        state: defaultSavedAddress?.state || location?.state || "",
        address: resolvedAddress || defaultSavedAddress?.address || location?.address || "",
        formattedAddress: resolvedAddress || defaultSavedAddress?.formattedAddress || location?.formattedAddress || "",
      };
    }
    return location;
  }, [defaultSavedAddress, defaultSavedAddressLocation, formatSavedAddress, location]);

  const {
    zoneId: effectiveZoneId,
    isOutOfService: isEffectiveLocationOutOfService,
    loading: effectiveZoneLoading,
    error: effectiveZoneError,
  } = useZone(effectiveLocation);

  const {
    heroBannerImages,
    heroBannersData,
    loadingBanners,
    landingExploreMore,
    exploreMoreHeading,
    festBannerVideoUrl,
    loadingLandingConfig,
    realCategories,
    loadingRealCategories,
    restaurantsData,
    loadingRestaurants,
    fetchRestaurants,
    recommendedRestaurantIds,
    under250PriceLimit,
    recommendedRestaurantsFromSettings,
  } = useHome({
    effectiveLocation,
    effectiveZoneId,
    hasUsableUserCity: !!effectiveLocation?.city,
  });
  useEffect(() => {
    const handleScrollHeader = () => {
      const currentScrollY = window.scrollY;
      const categoriesSection = document.getElementById("categories-section");

      if (!categoriesSection) return;

      const rect = categoriesSection.getBoundingClientRect();
      const sectionBottom = rect.bottom + currentScrollY;

      // When to show/hide the sticky header
      if (currentScrollY > sectionBottom) {
        setIsStickyHeaderVisible(true);
      } else {
        setIsStickyHeaderVisible(false);
      }

      // Track scroll direction for search bar visibility in sticky header
      if (currentScrollY < lastScrollY.current) {
        // Scrolling UP
        setShowStickySearch(true);
      } else {
        // Scrolling DOWN
        setShowStickySearch(false);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScrollHeader, { passive: true });
    return () => window.removeEventListener("scroll", handleScrollHeader);
  }, []);

  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [hasScrolledPastBanner, setHasScrolledPastBanner] = useState(false);
  const [landingCategories, setLandingCategories] = useState([]);
  const [menuCategories, setMenuCategories] = useState([]);
  const [loadingMenuCategories, setLoadingMenuCategories] = useState(false);
  const [, setRestaurantDietMeta] = useState({});
  const [showAllCategoriesModal, setShowAllCategoriesModal] = useState(false);
  const [availabilityTick, setAvailabilityTick] = useState(Date.now());
  const RESTAURANTS_BATCH_SIZE = 9;
  const [visibleRestaurantCount, setVisibleRestaurantCount] = useState(
    RESTAURANTS_BATCH_SIZE,
  );
  const restaurantLoadMoreRef = useRef(null);

  const isHandlingSwitchOff = useRef(false);
  const heroShellRef = useRef(null);
  const mobileHeroShellRef = useRef(null);
  const stickyHeaderRef = useRef(null);
  const slugifyCategory = useCallback(
    (value) =>
      String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, ""),
    [],
  );


  const normalizeImageUrl = useCallback(
    (imageUrl) => {
      if (typeof imageUrl !== "string") return "";
      const trimmed = imageUrl.trim();
      if (!trimmed) return "";
      if (/^data:/i.test(trimmed) || /^blob:/i.test(trimmed)) {
        return trimmed;
      }
      const appProtocol =
        typeof window !== "undefined" ? window.location?.protocol : "";
      const appHost =
        typeof window !== "undefined" ? window.location?.hostname : "";
      let normalizedInput = trimmed
        .replace(/\\/g, "/")
        .replace(/^(https?):\/(?!\/)/i, "$1://")
        .replace(/^(https?:\/\/)(https?:\/\/)/i, "$1");

      if (/^\/\//.test(normalizedInput)) {
        normalizedInput = `${appProtocol || "https:"}${normalizedInput}`;
      }

      // WebView can fail on unescaped spaces/special chars; keep URLs safely encoded.
      if (/^(https?:)?\/\//i.test(normalizedInput)) {
        try {
          const parsed = new URL(normalizedInput, window.location.origin);

          // In mobile production, localhost/127.0.0.1 inside image URLs is unreachable.
          // Use BACKEND_ORIGIN (API server) for image host, not frontend hostï¿½uploads are served by the backend.
          if (
            appHost &&
            appHost !== "localhost" &&
            appHost !== "127.0.0.1" &&
            /^(localhost|127\.0\.0\.1)$/i.test(parsed.hostname)
          ) {
            try {
              const backendUrl = new URL(BACKEND_ORIGIN);
              parsed.protocol = backendUrl.protocol;
              parsed.hostname = backendUrl.hostname;
              parsed.port = backendUrl.port;
            } catch {
              parsed.protocol = window.location.protocol;
              parsed.hostname = window.location.hostname;
              if (window.location.port) parsed.port = window.location.port;
            }
          }

          // Prevent mixed-content image blocking in HTTPS WebView.
          if (appProtocol === "https:" && parsed.protocol === "http:") {
            parsed.protocol = "https:";
          }

          const finalUrl = parsed.toString();
          // Do not encode signed URLs (S3/Cloudfront/Cloudinary); encoding query params can break signatures.
          const hasSignedParams =
            /[?&](X-Amz-|Signature=|Expires=|AWSAccessKeyId=|GoogleAccessId=|token=|sig=|se=|sp=|sv=)/i.test(
              finalUrl,
            );
          return hasSignedParams ? finalUrl : encodeURI(finalUrl);
        } catch {
          return normalizedInput;
        }
      }

      const absolutePath = normalizedInput.startsWith("/")
        ? `${BACKEND_ORIGIN}${normalizedInput}`
        : `${BACKEND_ORIGIN}/${normalizedInput.replace(/^\.?\/*/, "")}`;

      try {
        const parsed = new URL(absolutePath, window.location.origin);
        if (appProtocol === "https:" && parsed.protocol === "http:") {
          parsed.protocol = "https:";
        }
        const finalUrl = parsed.toString();
        const hasSignedParams =
          /[?&](X-Amz-|Signature=|Expires=|AWSAccessKeyId=|GoogleAccessId=|token=|sig=|se=|sp=|sv=)/i.test(
            finalUrl,
          );
        return hasSignedParams ? finalUrl : encodeURI(finalUrl);
      } catch {
        return absolutePath;
      }
    },
    [BACKEND_ORIGIN],
  );

  const extractImageFromValue = useCallback(
    (value) => {
      if (!value) return "";

      if (typeof value === "string") {
        return normalizeImageUrl(value);
      }

      if (typeof value === "object") {
        const candidate =
          value.url ||
          value.secure_url ||
          value.imageUrl ||
          value.imageURL ||
          value.image ||
          value.src ||
          value.path ||
          value.location ||
          value.link ||
          value.href ||
          "";
        return typeof candidate === "string"
          ? normalizeImageUrl(candidate)
          : "";
      }

      return "";
    },
    [normalizeImageUrl],
  );

  const buildRestaurantImageCandidates = useCallback(
    (value) => {
      const normalized = extractImageFromValue(value);
      if (!normalized) return [];

      // Mobile WebView safety: try deterministic JPEG first, then auto, then original.
      if (
        /res\.cloudinary\.com/i.test(normalized) &&
        /\/image\/upload\//i.test(normalized)
      ) {
        const hasTransform =
          /\/image\/upload\/(?:f_|q_|w_|h_|c_|dpr_|g_)/i.test(normalized);
        if (!hasTransform) {
          return Array.from(
            new Set([
              normalized.replace(
                "/image/upload/",
                "/image/upload/f_jpg,q_auto,w_1080/",
              ),
              normalized.replace(
                "/image/upload/",
                "/image/upload/f_auto,q_auto,w_1080/",
              ),
              normalized,
            ]),
          );
        }
      }

      return [normalized];
    },
    [extractImageFromValue],
  );

  const extractImages = useCallback(
    (source) => {
      if (!source) return [];

      const normalizedImages = (Array.isArray(source)
        ? source.flatMap((entry) => buildRestaurantImageCandidates(entry))
        : buildRestaurantImageCandidates(source)
      )
        .filter(Boolean)
        .map((value) => String(value).trim())
        .filter(Boolean);

      // De-duplicate image urls while preserving order.
      return normalizedImages.filter(
        (value, index) => normalizedImages.indexOf(value) === index,
      );

    },
    [buildRestaurantImageCandidates],
  );

  useEffect(() => {
    const intervalId = setInterval(() => {
      setAvailabilityTick(Date.now());
    }, 60000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const isMobile = window.innerWidth < 768;
      const heroShell = isMobile ? (mobileHeroShellRef.current || heroShellRef.current) : (heroShellRef.current || mobileHeroShellRef.current);
      const stickyHeader = stickyHeaderRef.current;

      if (!heroShell) {
        setHasScrolledPastBanner(false);
        return;
      }

      const heroRect = heroShell.getBoundingClientRect();
      const stickyHeight = stickyHeader?.getBoundingClientRect().height || 0;
      setHasScrolledPastBanner(heroRect.bottom <= stickyHeight);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  // Merge API explore items with fallback to ensure all 4 cards are shown
  const finalExploreItems = useMemo(() => {
    const fallback = [
      {
        id: "offers",
        label: "Offers",
        image: exploreOffers,
        href: "/food/user/offers",
      },
      {
        id: "gourmet",
        label: "Gourmet",
        image: exploreGourmet,
        href: "/food/user/gourmet",
      },
      {
        id: "collection",
        label: "Collections",
        image: exploreCollection,
        href: "/food/user/profile/favorites",
      },
    ];

    if (!landingExploreMore || landingExploreMore.length === 0) return fallback;

    return fallback.map((item) => {
      const apiItem = landingExploreMore.find(
        (ai) => ai.label?.toLowerCase() === item.label?.toLowerCase(),
      );
      if (apiItem) {
        const href = apiItem.link
          ? apiItem.link.startsWith("/")
            ? apiItem.link
            : `/${apiItem.link}`
          : item.href;
        return {
          ...item,
          image:
            normalizeImageUrl(apiItem.imageUrl || apiItem.image || "") ||
            item.image,
          href,
        };
      }
      return item;
    });
  }, [landingExploreMore, normalizeImageUrl]);

  const normalizedLandingCategories = useMemo(() => {
    return (landingCategories || []).map((category, index) => ({
      id: category.id || category._id || `landing-category-${index}`,
      name: category.label || category.name || "Category",
      image:
        normalizeImageUrl(category.imageUrl || category.image) ||
        foodImages[index % foodImages.length] ||
        foodImages[0],
      slug:
        category.slug || slugifyCategory(category.label || category.name || ""),
      label: category.label || category.name || "Category",
    }));
  }, [landingCategories, normalizeImageUrl, slugifyCategory]);

  const displayCategories = useMemo(() => {
    const source = realCategories.length > 0
      ? realCategories
      : menuCategories.length > 0
        ? menuCategories
        : normalizedLandingCategories;

    if (!vegMode) return source;

    return source.filter((category) => {
      const scope = normalizeCategoryFoodScope(
        category?.foodTypeScope || category?.type || category?.dietType || "",
      );

      return scope !== "non-veg";
    });
  }, [menuCategories, normalizedLandingCategories, realCategories, vegMode]);

  // Swipe functionality for hero banner carousel
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndX = useRef(0);
  const touchEndY = useRef(0);
  const isSwiping = useRef(false);
  const autoSlideIntervalRef = useRef(null);

  // Sync prevVegMode when vegMode changes from context
  useEffect(() => {
    if (vegMode !== prevVegMode && !isHandlingSwitchOff.current) {
      setPrevVegMode(vegMode);
    }
  }, [vegMode]);

  // Keep persisted Veg Mode preference; only reset popup UI state on mount.
  useEffect(() => {
    setPrevVegMode(vegMode);
    setShowVegModePopup(false);
    setShowSwitchOffPopup(false);
    setVegModeOption("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle vegMode toggle - show popup when turned ON or OFF
  const handleVegModeChange = (newValue) => {
    // Skip if we're handling switch off confirmation
    if (isHandlingSwitchOff.current) {
      return;
    }

    if (newValue && !prevVegMode) {
      // Veg mode was just turned ON
      // Calculate popup position relative to toggle
      if (vegModeToggleRef.current) {
        const rect = vegModeToggleRef.current.getBoundingClientRect();
        const screenWidth = window.innerWidth;
        const popupWidth = Math.min(screenWidth - 32, 320); // 320 is max-w-xs

        let left = rect.left + rect.width / 2 - popupWidth / 2;
        left = Math.max(16, Math.min(left, screenWidth - popupWidth - 16));

        const triangleLeft = rect.left + rect.width / 2 - left;

        setPopupPosition({
          top: rect.bottom + 10,
          left: left,
          triangleLeft: triangleLeft
        });
      }
      setShowVegModePopup(true);
      // Don't update context yet - wait for user to apply or cancel
    } else if (!newValue && prevVegMode) {
      // Veg mode was just turned OFF - show switch off confirmation popup
      isHandlingSwitchOff.current = true;
      setShowSwitchOffPopup(true);
      // Don't update context yet - wait for user to confirm
    } else {
      // Normal state change - update context directly
      setVegModeContext(newValue);
      setPrevVegMode(newValue);
    }
  };

  // Update popup position on scroll/resize
  useEffect(() => {
    if (!showVegModePopup) return;

    const updatePosition = () => {
      if (vegModeToggleRef.current) {
        const rect = vegModeToggleRef.current.getBoundingClientRect();
        const screenWidth = window.innerWidth;
        const popupWidth = Math.min(screenWidth - 32, 320);

        let left = rect.left + rect.width / 2 - popupWidth / 2;
        left = Math.max(16, Math.min(left, screenWidth - popupWidth - 16));

        const triangleLeft = rect.left + rect.width / 2 - left;

        setPopupPosition({
          top: rect.bottom + 10,
          left: left,
          triangleLeft: triangleLeft
        });
      }
    };

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [showVegModePopup]);

  // Keep index within current banner bounds after admin updates/reloads.
  useEffect(() => {
    setCurrentBannerIndex((prev) => {
      if (heroBannerImages.length === 0) return 0;
      return Math.min(prev, heroBannerImages.length - 1);
    });
  }, [heroBannerImages.length]);

  // Preload hero images to avoid white blink during slide transition.
  useEffect(() => {
    heroBannerImages.forEach((src) => {
      if (!src) return;
      const img = new window.Image();
      img.src = src;
    });
  }, [heroBannerImages]);

  const startHeroBannerAutoSlide = useCallback(() => {
    if (autoSlideIntervalRef.current) {
      clearInterval(autoSlideIntervalRef.current);
    }

    if (heroBannerImages.length <= 1) return;

    autoSlideIntervalRef.current = setInterval(() => {
      if (!isSwiping.current) {
        setCurrentBannerIndex((prev) => (prev + 1) % heroBannerImages.length);
      }
    }, HERO_BANNER_AUTO_SLIDE_MS);
  }, [heroBannerImages.length, HERO_BANNER_AUTO_SLIDE_MS]);

  // Auto-cycle hero banner images
  useEffect(() => {
    startHeroBannerAutoSlide();

    return () => {
      if (autoSlideIntervalRef.current) {
        clearInterval(autoSlideIntervalRef.current);
      }
    };
  }, [startHeroBannerAutoSlide]);

  // Helper function to reset auto-slide timer
  const resetAutoSlide = useCallback(() => {
    startHeroBannerAutoSlide();
  }, [startHeroBannerAutoSlide]);

  // Swipe handlers for hero banner carousel
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = true;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
    touchEndY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = () => {
    if (!isSwiping.current || heroBannerImages.length === 0) return;

    const deltaX = touchEndX.current - touchStartX.current;
    const deltaY = Math.abs(touchEndY.current - touchStartY.current);
    const minSwipeDistance = 50; // Minimum distance for a swipe

    // Check if it's a horizontal swipe (not vertical scroll)
    if (Math.abs(deltaX) > minSwipeDistance && Math.abs(deltaX) > deltaY) {
      if (deltaX > 0) {
        // Swipe right - go to previous image
        setCurrentBannerIndex(
          (prev) =>
            (prev - 1 + heroBannerImages.length) % heroBannerImages.length,
        );
      } else {
        // Swipe left - go to next image
        setCurrentBannerIndex((prev) => (prev + 1) % heroBannerImages.length);
      }
      // Reset auto-slide timer after manual swipe
      resetAutoSlide();
    }

    // Reset swipe state after a short delay
    setTimeout(() => {
      isSwiping.current = false;
    }, 300);

    // Reset touch positions
    touchStartX.current = 0;
    touchStartY.current = 0;
    touchEndX.current = 0;
    touchEndY.current = 0;
  };

  // Mouse handlers for desktop drag support
  const handleMouseDown = (e) => {
    touchStartX.current = e.clientX;
    touchStartY.current = e.clientY;
    isSwiping.current = true;
  };

  const handleMouseMove = (e) => {
    if (!isSwiping.current) return;
    touchEndX.current = e.clientX;
    touchEndY.current = e.clientY;
  };

  const handleMouseUp = () => {
    if (!isSwiping.current || heroBannerImages.length === 0) return;

    const deltaX = touchEndX.current - touchStartX.current;
    const deltaY = Math.abs(touchEndY.current - touchStartY.current);
    const minSwipeDistance = 50;

    if (Math.abs(deltaX) > minSwipeDistance && Math.abs(deltaX) > deltaY) {
      if (deltaX > 0) {
        setCurrentBannerIndex(
          (prev) =>
            (prev - 1 + heroBannerImages.length) % heroBannerImages.length,
        );
      } else {
        setCurrentBannerIndex((prev) => (prev + 1) % heroBannerImages.length);
      }
      // Reset auto-slide timer after manual swipe
      resetAutoSlide();
    }

    setTimeout(() => {
      isSwiping.current = false;
    }, 300);

    touchStartX.current = 0;
    touchStartY.current = 0;
    touchEndX.current = 0;
    touchEndY.current = 0;
  };
  const [activeFilters, setActiveFilters] = useState(new Set());
  const [sortBy, setSortBy] = useState(null); // null, 'price-low', 'price-high', 'rating-high', 'rating-low'
  const [selectedCuisine, setSelectedCuisine] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState({
    activeFilters: new Set(),
    sortBy: null,
    selectedCuisine: null,
  });
  const [isLoadingFilterResults, setIsLoadingFilterResults] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState("sort");
  const categoryScrollRef = useRef(null);
  const gsapAnimationsRef = useRef([]);
  // Show skeletons immediately while loading â€” delayed toggles caused visible layout swap (CLS).
  const showBannerSkeleton = loadingBanners;
  const showCategorySkeleton = loadingRealCategories || loadingMenuCategories;
  const showExploreSkeleton = loadingLandingConfig;
  const showRestaurantSkeleton = isLoadingFilterResults || loadingRestaurants;

  const [appCustomization, setAppCustomization] = useState(DEFAULT_APP_CUSTOMIZATION);
  const openMealSelectionForHomeItem = useCallback(
    (item) => {
      const params = new URLSearchParams();
      const itemId = item.itemId || item.id || "";
      const restaurantId =
        item.mongoRestaurantId ||
        item.restaurantMongoId ||
        item.restaurantId ||
        "";

      if (item.name) params.set("dish", item.name);
      if (itemId) params.set("dishId", itemId);
      if (item.restaurantName) params.set("restaurant", item.restaurantName);
      if (restaurantId) params.set("restaurantId", restaurantId);
      if (item.categoryName) params.set("category", item.categoryName);
      if (Number.isFinite(Number(item.price))) params.set("price", String(item.price));

      navigate(
        {
          pathname: "/food/user/choose-meal",
          search: params.toString() ? `?${params.toString()}` : "",
        },
        { state: { dish: { ...item, itemId, restaurantId } } },
      );
    },
    [navigate],
  );

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

  const handleAddHomeItemToCart = useCallback(
    (event, item) => {
      event.preventDefault();
      event.stopPropagation();
      openMealSelectionForHomeItem(item);
    },
    [openMealSelectionForHomeItem],
  );

  const [showToast, setShowToast] = useState(false);
  const [showManageCollections, setShowManageCollections] = useState(false);
  const [selectedRestaurantSlug, setSelectedRestaurantSlug] = useState(null);

  // Memoize cartCount to prevent recalculation on every render - use cart directly
  const cartCount = useMemo(
    () => cart.reduce((total, item) => total + (item.quantity || 0), 0),
    [cart],
  );

  const cityName = location?.city || "Select";
  const stateName = location?.state || "Location";
  const hasLiveLocation = useMemo(() => {
    if (!location) return false;

    const isPlaceholder = (value) => {
      if (!value) return true;
      const normalized = String(value).trim().toLowerCase();
      return (
        !normalized ||
        normalized === "select location" ||
        normalized === "current location"
      );
    };

    const hasAddressText =
      !isPlaceholder(location.formattedAddress) ||
      !isPlaceholder(location.address);
    const hasCityState =
      !isPlaceholder(location.city) || !isPlaceholder(location.state);

    return hasAddressText || hasCityState;
  }, [location]);





  const festVideoActive =
    typeof festBannerVideoUrl === "string" && festBannerVideoUrl.trim().length > 0;

  // Stable list of restaurant ids for menu-category union so we don't refetch menus
  // when `restaurantsData` changes for reasons like distance recalculation or outletTimings enrichment.
  const menuUnionRestaurantIdsKey = useMemo(() => {
    if (!Array.isArray(restaurantsData) || restaurantsData.length === 0) return "";
    return restaurantsData
      .map((r) => String(r?.restaurantId || r?.id || "").trim())
      .filter(Boolean)
      .sort()
      .join(",");
  }, [restaurantsData]);

  const shouldShowOutOfZoneHome =
    !effectiveZoneLoading &&
    !effectiveZoneError &&
    isEffectiveLocationOutOfService;

  // Mock points value - replace with actual points from context/store
  const userPoints = 99;

  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [activeTab, setActiveTab] = useState("food");


  // Simple filter toggle function
  const toggleFilter = (filterId) => {
    setActiveFilters((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(filterId)) {
        newSet.delete(filterId);
      } else {
        newSet.add(filterId);
      }
      return newSet;
    });
  };

  const foodPreferenceFilters = useMemo(
    () => [
      { id: "healthy", label: "Healthy Food", icon: Leaf },
      { id: "all", label: "All Food Items", icon: UtensilsCrossed },
    ],
    [],
  );

  // Refs for scroll tracking
  const filterSectionRefs = useRef({});
  const [activeScrollSection, setActiveScrollSection] = useState("sort");
  const rightContentRef = useRef(null);
  const restaurantsRequestSeqRef = useRef(0);
  const menuUnionRequestSeqRef = useRef(0);
  const menuUnionCacheRef = useRef(new Map());

  // Scroll tracking effect
  useEffect(() => {
    if (!isFilterOpen || !rightContentRef.current) return;

    const observerOptions = {
      root: rightContentRef.current,
      rootMargin: "-20% 0px -70% 0px",
      threshold: 0,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.getAttribute("data-section-id");
          if (sectionId) {
            setActiveScrollSection(sectionId);
            setActiveFilterTab(sectionId);
          }
        }
      });
    }, observerOptions);

    // Observe all filter sections
    Object.values(filterSectionRefs.current).forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, [isFilterOpen]);

  const applyFiltersAndRefetch = useCallback(
    async (
      nextActiveFilters = activeFilters,
      nextSortBy = sortBy,
      nextSelectedCuisine = selectedCuisine,
    ) => {
      const nextFilterState = {
        activeFilters: new Set(nextActiveFilters),
        sortBy: nextSortBy,
        selectedCuisine: nextSelectedCuisine,
      };

      setAppliedFilters(nextFilterState);
      setIsLoadingFilterResults(true);

      try {
        await fetchRestaurants(nextFilterState);
      } catch (error) {
        debugError("Error applying filters:", error);
      } finally {
        setIsLoadingFilterResults(false);
      }
    },
    [activeFilters, sortBy, selectedCuisine, fetchRestaurants],
  );

  // Fetch restaurants when appliedFilters change
  useEffect(() => {
    fetchRestaurants(appliedFilters);
  }, [appliedFilters, fetchRestaurants]);

  // IMPORTANT:
  // Homepage should avoid eager N+1 menu requests. We only resolve menu metadata
  // when the UI truly needs it: Veg Mode is enabled, or admin categories are unavailable.
  useEffect(() => {
    const restaurantIds = menuUnionRestaurantIdsKey
      ? menuUnionRestaurantIdsKey.split(",").filter(Boolean)
      : [];
    const shouldFetchMenuMeta = vegMode || realCategories.length === 0;
    const menuMetaCacheKey = shouldFetchMenuMeta ? menuUnionRestaurantIdsKey : "";

    const fetchMenuCategories = async () => {
      const requestSeq = ++menuUnionRequestSeqRef.current;

      if (!menuUnionRestaurantIdsKey || !shouldFetchMenuMeta) {
        setMenuCategories([]);
        setRestaurantDietMeta({});
        setLoadingMenuCategories(false);
        return;
      }

      const cachedMenuMeta = HOME_MENU_META_CACHE.get(menuMetaCacheKey);
      if (cachedMenuMeta) {
        setMenuCategories(cachedMenuMeta.categories);
        setRestaurantDietMeta(cachedMenuMeta.restaurantDietMeta);
        setLoadingMenuCategories(false);
        return;
      }

      setLoadingMenuCategories(true);
      try {
        const categoryMap = new Map();
        const menuResponses = [];
        const menusByRestaurantId = await loadMenusInChunks(restaurantIds, 4);

        if (requestSeq !== menuUnionRequestSeqRef.current) return;

        menusByRestaurantId.forEach((menu, id) => {
          menuUnionCacheRef.current.set(String(id), menu);
          menuResponses.push({ id, menu });
        });

        const nextDietMeta = {};

        menuResponses.forEach(({ id, menu }) => {
          let hasVeg = false;
          let hasNonVeg = false;
          const sections = Array.isArray(menu?.sections) ? menu.sections : [];
          sections.forEach((section) => {
            const sectionItems = Array.isArray(section?.items)
              ? section.items
              : [];
            sectionItems.forEach((item) => {
              const foodType = String(item?.foodType || "")
                .trim()
                .toLowerCase();
              if (foodType === "veg") hasVeg = true;
              if (
                foodType === "non-veg" ||
                foodType === "non veg" ||
                foodType === "nonveg"
              )
                hasNonVeg = true;
            });

            const subsections = Array.isArray(section?.subsections)
              ? section.subsections
              : [];
            subsections.forEach((subsection) => {
              const subsectionItems = Array.isArray(subsection?.items)
                ? subsection.items
                : [];
              subsectionItems.forEach((item) => {
                const foodType = String(item?.foodType || "")
                  .trim()
                  .toLowerCase();
                if (foodType === "veg") hasVeg = true;
                if (
                  foodType === "non-veg" ||
                  foodType === "non veg" ||
                  foodType === "nonveg"
                )
                  hasNonVeg = true;
              });
            });

            const categoryName = String(section?.name || "").trim();
            if (!categoryName) return;

            const slug = slugifyCategory(categoryName);
            if (!slug) return;

            let image = "";
            if (Array.isArray(section?.items) && section.items.length > 0) {
              image = normalizeImageUrl(section.items[0]?.image);
            }
            if (!image && Array.isArray(section?.subsections)) {
              for (const subsection of section.subsections) {
                if (
                  Array.isArray(subsection?.items) &&
                  subsection.items.length > 0
                ) {
                  image = normalizeImageUrl(subsection.items[0]?.image);
                  if (image) break;
                }
              }
            }

            const categoryScope = hasVeg && hasNonVeg
              ? "Both"
              : hasVeg
                ? "Veg"
                : hasNonVeg
                  ? "Non-Veg"
                  : "Both";

            if (!categoryMap.has(slug)) {
              categoryMap.set(slug, {
                id: slug,
                name: categoryName,
                slug,
                label: categoryName,
                image: image || "",
                foodTypeScope: categoryScope,
              });
            } else {
              const existingCategory = categoryMap.get(slug);
              if (image && !existingCategory.image) {
                existingCategory.image = image;
              }
              const existingScope = normalizeCategoryFoodScope(existingCategory.foodTypeScope);
              const nextScope = normalizeCategoryFoodScope(categoryScope);
              if (existingScope !== nextScope) {
                existingCategory.foodTypeScope = "Both";
              } else if (!existingCategory.foodTypeScope || existingScope === "unknown") {
                existingCategory.foodTypeScope = categoryScope;
              }
            }
          });

          if (id) {
            nextDietMeta[id] = {
              hasVeg,
              hasNonVeg,
              isPureVeg: hasVeg && !hasNonVeg,
            };
          }
        });

        const categories = Array.from(categoryMap.values())
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((category, index) => ({
            ...category,
            image:
              category.image ||
              foodImages[index % foodImages.length] ||
              foodImages[0],
          }));

        HOME_MENU_META_CACHE.set(menuMetaCacheKey, {
          categories,
          restaurantDietMeta: nextDietMeta,
        });
        setMenuCategories(categories);
        setRestaurantDietMeta(nextDietMeta);
      } finally {
        if (requestSeq === menuUnionRequestSeqRef.current) {
          setLoadingMenuCategories(false);
        }
      }
    };

    fetchMenuCategories();
  }, [
    menuUnionRestaurantIdsKey,
    normalizeImageUrl,
    realCategories.length,
    slugifyCategory,
    vegMode,
  ]);

  const matchesVegMode = useCallback(
    (restaurant) => {
      if (!vegMode) return true;
      return restaurant?.pureVegRestaurant === true;
    },
    [vegMode],
  );

  // Filter restaurants and foods based on active filters
  const filteredRestaurants = useMemo(() => {
    // Rely on API data which is already filtered and sorted by the backend.
    // We only apply client-side Veg Mode filtering here.
    return (restaurantsData || []).filter(matchesVegMode);
  }, [restaurantsData, matchesVegMode]);

  const restaurantLazyLoadResetKey = useMemo(() => {
    const activeFilterKey = Array.from(activeFilters).sort().join("|");
    return `${restaurantsData.length}:${activeFilterKey}:${selectedCuisine || ""}:${sortBy || ""}:${vegMode ? "1" : "0"}`;
  }, [activeFilters, restaurantsData.length, selectedCuisine, sortBy, vegMode]);

  const visibleRestaurants = useMemo(
    () => filteredRestaurants.slice(0, visibleRestaurantCount),
    [filteredRestaurants, visibleRestaurantCount],
  );
  const mobileRecommendedRestaurants = useMemo(
    () => filteredRestaurants.slice(0, 8),
    [filteredRestaurants],
  );
  const mobileFeaturedRestaurant = mobileRecommendedRestaurants[0] || restaurantsData[0] || null;
  const homeCategoryTiles = useMemo(() => {
    const source = Array.isArray(displayCategories) ? displayCategories : [];

    const mapped = source.map((category, index) => ({
      id: category.id || category.slug || `home-category-${index}`,
      categoryId: category.categoryId || category.id || category._id || "",
      name: category.name || category.label || "Meals",
      slug:
        category.slug ||
        slugifyCategory(category.name || category.label || `category-${index}`),
      image:
        category.image ||
        category.imageUrl ||
        "",
      healthy: normalizeHealthyFlag(category.healthy),
    }));

    return mapped.slice(0, 8);
  }, [displayCategories, slugifyCategory]);

  useEffect(() => {
    if (!selectedHomeCategory) return;
    const stillVisible = homeCategoryTiles.some((category) => category.slug === selectedHomeCategory.slug);
    if (!stillVisible) setSelectedHomeCategory(null);
  }, [homeCategoryTiles, selectedHomeCategory]);

  const getRestaurantSlug = useCallback((restaurant, index = 0) => {
    const nameStr =
      typeof restaurant?.name === "string" ? restaurant.name.trim() : "";
    const fallbackSlugSource =
      nameStr ||
      (typeof restaurant?.restaurantName === "string"
        ? restaurant.restaurantName.trim()
        : "") ||
      String(restaurant?.slug || restaurant?.id || restaurant?._id || `restaurant-${index}`);

    return typeof restaurant?.slug === "string" && restaurant.slug.trim()
      ? restaurant.slug.trim()
      : fallbackSlugSource.toLowerCase().replace(/\s+/g, "-");
  }, []);

  useEffect(() => {
    let cancelled = false;

    const getItemsFromSection = (section, restaurant, category) => {
      const selectedSlug = String(category?.slug || "").trim().toLowerCase();
      const selectedCategoryId = String(category?.categoryId || category?.id || "").trim();
      const categoryName = String(category?.name || "").trim().toLowerCase();

      // Generate keywords from slug and name
      const keywords = Array.from(new Set([
        selectedSlug,
        categoryName,
        ...selectedSlug.split("-"),
        ...categoryName.split(/\s+/),
      ])).filter(Boolean).map(w => w.trim().toLowerCase());

      const sectionCategoryId = String(section?.categoryId || section?.id || "").trim();
      const sectionName = String(section?.name || section?.categoryName || "").trim().toLowerCase();
      const sectionMatches =
        (selectedCategoryId && sectionCategoryId && sectionCategoryId === selectedCategoryId) ||
        keywords.some(kw => sectionName.includes(kw));
      const restaurantSlug = getRestaurantSlug(restaurant);

      const normalizeItem = (item, itemIndex, sourceName = sectionName) => {
        if (!item || typeof item !== "object") return null;
        const itemTag = String(item.tag || "").trim();
        if (vegMode && !isVegFoodItem(item)) return null;
        const itemCategoryId = String(item.categoryId || "").trim();
        const itemCategory = String(item.categoryName || item.category || sourceName || "").trim().toLowerCase();
        const itemName = String(item.name || item.itemName || item.title || "").trim().toLowerCase();

        const idMatches = selectedCategoryId && itemCategoryId && itemCategoryId === selectedCategoryId;
        const itemMatches =
          idMatches ||
          sectionMatches ||
          keywords.some(kw => itemCategory.includes(kw) || itemName.includes(kw));

        if (!itemMatches) return null;
        if (!itemName && !itemCategory) return null;

        const image =
          normalizeImageUrl(item.image || item.imageUrl || item.photo || item.thumbnail) ||
          restaurant.image ||
          "";
        const priceCandidate = [item.price, item.finalPrice, item.basePrice]
          .map((value) => Number(value))
          .find((value) => Number.isFinite(value) && value > 0);

        return {
          id: item._id || item.id || `${restaurantSlug}-${selectedSlug}-${itemIndex}`,
          itemId:
            item._id || item.id || `${restaurantSlug}-${selectedSlug}-${itemIndex}`,
          name: item.name || itemName || itemCategory,
          description:
            item.description ||
            item.shortDescription ||
            restaurant.name ||
            "",
          price: priceCandidate,
          image,
          foodType: item.foodType || "",
          tag: itemTag || "Normal",
          restaurantName: restaurant.name,
          mongoRestaurantId:
            restaurant._id ||
            restaurant.mongoId ||
            restaurant.id ||
            restaurant.restaurantId ||
            "",
          restaurantId:
            restaurant._id ||
            restaurant.mongoId ||
            restaurant.id ||
            restaurant.restaurantId ||
            "",
          restaurantSlug,
          categoryId: itemCategoryId || selectedCategoryId || "",
          categoryName: item.categoryName || item.category || category?.name || "",
          nutrition: item.nutrition || null,
        };
      };

      const directItems = Array.isArray(section?.items) ? section.items : [];
      const directMatches = directItems
        .map((item, index) => normalizeItem(item, index))
        .filter(Boolean);

      const subsectionMatches = (Array.isArray(section?.subsections) ? section.subsections : [])
        .flatMap((subsection) =>
          (Array.isArray(subsection?.items) ? subsection.items : [])
            .map((item, index) => normalizeItem(item, index, subsection?.name || sectionName))
            .filter(Boolean),
        );

      return [...directMatches, ...subsectionMatches];
    };

    const fetchCategoryItems = async () => {
      if (!selectedHomeCategory?.slug) {
        setCategoryFoodItems([]);
        setLoadingCategoryFoodItems(false);
        return;
      }

      const categoryItemsCacheKey = [
        menuUnionRestaurantIdsKey,
        String(selectedHomeCategory?.slug || ""),
        String(selectedHomeCategory?.categoryId || ""),
        vegMode ? "veg" : "all",
      ].join("|");
      const cachedCategoryItems = HOME_CATEGORY_ITEMS_CACHE.get(categoryItemsCacheKey);
      if (cachedCategoryItems) {
        setCategoryFoodItems(cachedCategoryItems);
        setLoadingCategoryFoodItems(false);
        return;
      }

      setLoadingCategoryFoodItems(true);
      try {
        const restaurants = restaurantsData.slice(0, 48);
        const nextItems = [];
        const restaurantsWithIds = restaurants
          .map((restaurant) => ({
            restaurant,
            restaurantId: restaurant.restaurantId || restaurant.id || restaurant.mongoId,
          }))
          .filter((entry) => entry.restaurantId);
        const menusByRestaurantId = await loadMenusInChunks(
          restaurantsWithIds.map((entry) => entry.restaurantId),
        );

        for (const { restaurant, restaurantId } of restaurantsWithIds) {
          const menu = menusByRestaurantId.get(String(restaurantId)) || null;
          menuUnionCacheRef.current.set(String(restaurantId), menu);

          if (cancelled) return;

          const sections = Array.isArray(menu?.sections) ? menu.sections : [];
          sections.forEach((section) => {
            nextItems.push(...getItemsFromSection(section, restaurant, selectedHomeCategory));
          });
        }

        if (nextItems.length === 0) {
          const fallbackParams = {
            limit: 200,
            category: selectedHomeCategory.name || selectedHomeCategory.slug,
          };
          if (selectedHomeCategory.categoryId) {
            fallbackParams.categoryId = selectedHomeCategory.categoryId;
          }
          if (vegMode) {
            fallbackParams.foodType = "Veg";
          }

          try {
            const response = await restaurantAPI.getPublicDishes(fallbackParams);
            const dishes = response?.data?.data?.dishes || response?.data?.dishes || [];
            (Array.isArray(dishes) ? dishes : []).forEach((dish, index) => {
              const restaurant = dish.restaurant || {};
              const restaurantName = dish.restaurantName || restaurant.restaurantName || restaurant.name || "";
              const restaurantId = dish.restaurantId || restaurant._id || restaurant.id || "";
              const restaurantSlug = dish.restaurantSlug || getRestaurantSlug({
                name: restaurantName,
                restaurantName,
                _id: restaurantId,
              }, index);
              const priceCandidate = [dish.price, dish.finalPrice, dish.basePrice]
                .map((value) => Number(value))
                .find((value) => Number.isFinite(value) && value > 0);

              nextItems.push({
                id: dish._id || dish.id || `${restaurantSlug}-${selectedHomeCategory.slug}-${index}`,
                itemId: dish._id || dish.id || `${restaurantSlug}-${selectedHomeCategory.slug}-${index}`,
                name: dish.name || "",
                description: dish.description || restaurantName || "",
                price: priceCandidate,
                image: normalizeImageUrl(dish.image) || restaurant.profileImage?.url || "",
                foodType: dish.foodType || "",
                tag: dish.tag || "Normal",
                restaurantName,
                mongoRestaurantId: restaurantId,
                restaurantId,
                restaurantSlug,
                categoryId: dish.categoryId || selectedHomeCategory.categoryId || "",
                categoryName: dish.categoryName || dish.category || selectedHomeCategory.name || "",
                nutrition: dish.nutrition || null,
              });
            });
          } catch {
            // The menu scan above remains the primary source; public dishes are only a fallback.
          }
        }

        const dedupedItems = nextItems.filter((item, index, list) => {
          const key = `${item.restaurantSlug}-${item.id}-${item.name}`;
          return list.findIndex((entry) => `${entry.restaurantSlug}-${entry.id}-${entry.name}` === key) === index;
        });

        const nextCategoryItems = dedupedItems.slice(0, 20);
        HOME_CATEGORY_ITEMS_CACHE.set(categoryItemsCacheKey, nextCategoryItems);
        if (!cancelled) setCategoryFoodItems(nextCategoryItems);
      } finally {
        if (!cancelled) setLoadingCategoryFoodItems(false);
      }
    };

    fetchCategoryItems();

    return () => {
      cancelled = true;
    };
  }, [
    menuUnionRestaurantIdsKey,
    restaurantsData,
    getRestaurantSlug,
    normalizeImageUrl,
    selectedHomeCategory,
    slugifyCategory,
    vegMode,
  ]);

  useEffect(() => {
    let cancelled = false;
    const recommendedItemsCacheKey = `${menuUnionRestaurantIdsKey}|${vegMode ? "veg" : "all"}`;

    const normalizeRecommendedItem = (item, restaurant, itemIndex, categoryName = "") => {
      const itemName = String(item?.name || item?.itemName || item?.title || "").trim();
      if (!itemName) return null;
      const itemTag = String(item?.tag || "").trim();
      if (vegMode && !isVegFoodItem(item)) return null;

      const restaurantSlug = getRestaurantSlug(restaurant, itemIndex);
      const itemCategory = String(
        item?.category ||
        item?.categoryName ||
        item?.categoryTitle ||
        categoryName ||
        "",
      ).trim();
      const priceCandidate = [item?.price, item?.finalPrice, item?.basePrice]
        .map((value) => Number(value))
        .find((value) => Number.isFinite(value) && value > 0);
      const image =
        normalizeImageUrl(item?.image || item?.imageUrl || item?.photo || item?.thumbnail) ||
        restaurant?.image ||
        "";

      return {
        id: item?._id || item?.id || `${restaurantSlug}-recommended-${itemIndex}`,
        itemId:
          item?._id || item?.id || `${restaurantSlug}-recommended-${itemIndex}`,
        name: itemName,
        description: item?.description || item?.shortDescription || restaurant?.name || "",
        price: priceCandidate,
        image,
        foodType: item?.foodType || "",
        tag: itemTag || "Normal",
        restaurantName: restaurant?.name || "",
        mongoRestaurantId:
          restaurant?._id ||
          restaurant?.mongoId ||
          restaurant?.id ||
          restaurant?.restaurantId ||
          "",
        restaurantId:
          restaurant?._id ||
          restaurant?.mongoId ||
          restaurant?.id ||
          restaurant?.restaurantId ||
          "",
        restaurantSlug,
        categoryName: itemCategory,
        nutrition: item?.nutrition || null,
      };
    };

    const collectRecommendedItemsFromMenu = (menu, restaurant) => {
      const sections = Array.isArray(menu?.sections) ? menu.sections : [];
      return sections.flatMap((section, sectionIndex) => {
        const sectionName = section?.name || section?.title || section?.category || "";
        const directItems = Array.isArray(section?.items) ? section.items : [];
        const directMatches = directItems
          .map((item, itemIndex) =>
            normalizeRecommendedItem(item, restaurant, sectionIndex * 100 + itemIndex, sectionName),
          )
          .filter(Boolean);

        const subsectionMatches = (Array.isArray(section?.subsections) ? section.subsections : [])
          .flatMap((subsection, subsectionIndex) =>
            (Array.isArray(subsection?.items) ? subsection.items : [])
              .map((item, itemIndex) =>
                normalizeRecommendedItem(
                  item,
                  restaurant,
                  sectionIndex * 1000 + subsectionIndex * 100 + itemIndex,
                  subsection?.name || sectionName,
                ),
              )
              .filter(Boolean),
          );

        return [...directMatches, ...subsectionMatches];
      });
    };

    const fetchRecommendedItems = async () => {
      const cachedRecommendedItems = HOME_RECOMMENDED_ITEMS_CACHE.get(recommendedItemsCacheKey);
      if (cachedRecommendedItems) {
        setRecommendedFoodItems(cachedRecommendedItems);
        setLoadingRecommendedFoodItems(false);
        return;
      }

      setLoadingRecommendedFoodItems(true);
      try {
        const restaurants = restaurantsData.slice(0, 48);
        const nextItems = [];
        const restaurantsWithIds = restaurants
          .map((restaurant) => ({
            restaurant,
            restaurantId: restaurant.restaurantId || restaurant.id || restaurant.mongoId,
          }))
          .filter((entry) => entry.restaurantId);
        const menusByRestaurantId = await loadMenusInChunks(
          restaurantsWithIds.map((entry) => entry.restaurantId),
        );

        for (const { restaurant, restaurantId } of restaurantsWithIds) {
          const menu = menusByRestaurantId.get(String(restaurantId)) || null;
          menuUnionCacheRef.current.set(String(restaurantId), menu);

          if (cancelled) return;
          nextItems.push(...collectRecommendedItemsFromMenu(menu, restaurant));
        }

        const dedupedItems = nextItems.filter((item, index, list) => {
          const key = `${item.restaurantSlug}-${item.id}-${item.name}`;
          return list.findIndex((entry) => `${entry.restaurantSlug}-${entry.id}-${entry.name}` === key) === index;
        });

        const nextRecommendedItems = dedupedItems.slice(0, 20);
        HOME_RECOMMENDED_ITEMS_CACHE.set(recommendedItemsCacheKey, nextRecommendedItems);
        if (!cancelled) setRecommendedFoodItems(nextRecommendedItems);
      } finally {
        if (!cancelled) setLoadingRecommendedFoodItems(false);
      }
    };

    fetchRecommendedItems();

    return () => {
      cancelled = true;
    };
  }, [
    menuUnionRestaurantIdsKey,
    restaurantsData,
    getRestaurantSlug,
    normalizeImageUrl,
    vegMode,
  ]);

  const hasMoreRestaurants =
    visibleRestaurantCount < filteredRestaurants.length;

  const loadMoreRestaurants = useCallback(() => {
    setVisibleRestaurantCount((previous) =>
      Math.min(previous + RESTAURANTS_BATCH_SIZE, filteredRestaurants.length),
    );
  }, [filteredRestaurants.length, RESTAURANTS_BATCH_SIZE]);

  useEffect(() => {
    setVisibleRestaurantCount(
      Math.min(RESTAURANTS_BATCH_SIZE, filteredRestaurants.length),
    );
  }, [restaurantLazyLoadResetKey, filteredRestaurants.length, RESTAURANTS_BATCH_SIZE]);

  useEffect(() => {
    if (visibleRestaurantCount <= filteredRestaurants.length) return;
    setVisibleRestaurantCount(filteredRestaurants.length);
  }, [filteredRestaurants.length, visibleRestaurantCount]);

  useEffect(() => {
    if (!hasMoreRestaurants) return;
    if (showRestaurantSkeleton || loadingRestaurants || isLoadingFilterResults) return;
    const target = restaurantLoadMoreRef.current;
    if (!target || typeof window === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;
        startTransition(() => {
          loadMoreRestaurants();
        });
      },
      {
        root: null,
        rootMargin: "240px 0px",
        threshold: 0.01,
      },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [
    hasMoreRestaurants,
    showRestaurantSkeleton,
    loadingRestaurants,
    isLoadingFilterResults,
    loadMoreRestaurants,
  ]);

  const recommendedForYouRestaurants = useMemo(() => {
    const idsInOrder = (recommendedRestaurantIds || []).map((id) => String(id));
    const hasIds = idsInOrder.length > 0;
    const fromSettings = Array.isArray(recommendedRestaurantsFromSettings)
      ? recommendedRestaurantsFromSettings
      : [];

    // Primary source: restaurants returned by landing settings API (already admin-selected).
    const fromSettingsMapped = fromSettings.map((restaurant) => {
      const restaurantId = restaurant?._id ? String(restaurant._id) : "";
      const cuisine =
        Array.isArray(restaurant?.cuisines) && restaurant.cuisines.length > 0
          ? restaurant.cuisines[0]
          : "";
      const imageCandidates = extractImages([
        ...(Array.isArray(restaurant?.coverImages)
          ? restaurant.coverImages
          : [restaurant?.coverImages]
        ).filter(Boolean),
        restaurant?.profileImage,
      ]);
      const image = imageCandidates[0] || "";

      return {
        id: restaurant?.restaurantId || restaurantId,
        mongoId: restaurantId,
        name: getRestaurantDisplayName(restaurant),
        cuisine,
        rating: Number(restaurant?.rating) || 0,
        distance: "",
        deliveryTime: "",
        image: normalizeImageUrl(image) || "",
        images: imageCandidates,
        slug: restaurant?.slug || restaurant?.restaurantId || restaurantId,
        offer: null,
        pureVegRestaurant: restaurant?.pureVegRestaurant === true,
        isActive: true,
        isAcceptingOrders: true,
      };
    });

    // Keep admin-selected order when IDs exist.
    const orderedFromSettings = hasIds
      ? idsInOrder
        .map((id) =>
          fromSettingsMapped.find(
            (restaurant) => String(restaurant.mongoId) === id,
          ),
        )
        .filter(Boolean)
      : fromSettingsMapped;

    // Fallback: if settings payload misses some entries, recover them from fetched restaurant list by ID.
    const existingIds = new Set(
      orderedFromSettings.map((restaurant) =>
        String(restaurant.mongoId || restaurant.id),
      ),
    );
    const fromFetchedMissing = (restaurantsData || []).filter((restaurant) => {
      const mongoId = String(restaurant.mongoId || "");
      return (
        hasIds && idsInOrder.includes(mongoId) && !existingIds.has(mongoId)
      );
    });

    return [...orderedFromSettings, ...fromFetchedMissing]
      .filter(matchesVegMode)
      .slice(0, 12);
  }, [
    recommendedRestaurantIds,
    recommendedRestaurantsFromSettings,
    restaurantsData,
    extractImages,
    normalizeImageUrl,
    matchesVegMode,
  ]);

  // Featured foods removed - will be handled by restaurants data from API
  const filteredFeaturedFoods = useMemo(() => {
    // Return empty array - featured foods will come from API if needed
    return [];
  }, [activeFilters, sortBy]);

  // Memoize callbacks to prevent unnecessary re-renders
  const handleLocationClick = useCallback(() => {
    openLocationSelector();
  }, [openLocationSelector]);

  const handleSearchFocus = useCallback(() => {
    navigate("/food/user/search");
  }, [navigate]);

  const handleSearchClose = useCallback(() => {
    closeSearch();
    setHeroSearch("");
  }, [closeSearch]);

  // Removed GSAP animations - using CSS and ScrollReveal components instead for better performance
  // Auto-scroll removed - manual scroll only

  // Animated placeholder cycling - same as RestaurantDetails highlight offer animation
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
    }, 2000); // Change placeholder every 2 seconds (same as RestaurantDetails)

    return () => clearInterval(interval);
  }, []); // placeholders is a constant, no need for dependency

  // Dynamic Hero Banner Component helper
  const renderHeroBannerSection = (isMobile = false) => {
    if (showBannerSkeleton) {
      return (
        <div className="px-0 md:px-4 py-2">
          <HeroBannerSkeleton className="h-36 sm:h-44 lg:h-56 rounded-2xl" />
        </div>
      );
    }

    if (heroBannerImages.length === 0) return null;

    return (
      <div className="px-0 md:px-4 py-2">
        <div
          ref={isMobile ? mobileHeroShellRef : heroShellRef}
          data-home-hero-shell="true"
          className="relative w-full overflow-hidden aspect-[1.7/1] sm:aspect-[1.9/1] lg:aspect-[2.1/1] min-h-[180px] sm:min-h-[220px] lg:min-h-[260px] rounded-2xl shadow-sm group cursor-pointer bg-white"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div className="absolute inset-0 z-0">
            {/* Shining Glint Effect */}
            <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
              <motion.div
                animate={{
                  x: ['-200%', '200%'],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  repeatDelay: 5,
                  ease: "easeInOut"
                }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-20deg] w-[150%] h-full"
              />
            </div>
            {heroBannerImages.map((image, index) => (
              <div
                key={`${index}-${image}`}
                className="absolute inset-0 transition-opacity duration-700 ease-in-out"
                style={{
                  opacity: currentBannerIndex === index ? 1 : 0,
                  zIndex: currentBannerIndex === index ? 2 : 1,
                  pointerEvents: "none",
                }}>
                <img
                  src={image}
                  alt={`Hero Banner ${index + 1}`}
                  className="h-full w-full object-cover"
                  loading={index === currentBannerIndex ? "eager" : "lazy"}
                  fetchPriority={index === currentBannerIndex ? "high" : "low"}
                  draggable={false}
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            className="absolute inset-0 z-20 h-full w-full border-0 p-0 bg-transparent text-left"
            onClick={() => {
              const bannerData = heroBannersData[currentBannerIndex];
              const linkedRestaurants = bannerData?.linkedRestaurants || [];
              if (linkedRestaurants.length > 0) {
                const firstRestaurant = linkedRestaurants[0];
                const restaurantSlug = firstRestaurant.slug || firstRestaurant.restaurantId || firstRestaurant._id;
                navigate(`/food/user/restaurants/${restaurantSlug}`);
              }
            }}
            aria-label={`Open hero banner ${currentBannerIndex + 1}`}
          />

          {/* Indicators removed as requested */}
        </div>
      </div>
    );
  };

  // Extracted CategoryRailSection

  return (

    <div className="relative min-h-screen bg-white dark:bg-[#0a0a0a] pb-16 md:pb-6 overflow-x-clip">


      <div className="transition-all duration-300">
        {/* Unified Background for Entire Page - Vibrant Food Theme */}
        <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none overflow-hidden z-0">
          {/* Main Background */}
          <div className="absolute inset-0 bg-white dark:bg-[#0a0a0a]"></div>
          {/* Background Elements - Reduced to 2 blobs with CSS animations for better performance */}
          <div className="absolute inset-0 overflow-hidden opacity-20">
            {/* Top right blob - CSS animation */}
            <div
              style={{
                animation: "blob 8s ease-in-out infinite",
                willChange: "transform",
              }}
            />
            {/* Bottom left blob - CSS animation */}
            <div
              style={{
                animation: "blob-reverse 10s ease-in-out infinite",
                willChange: "transform",
              }}
            />
          </div>
          {/* CSS keyframes for animations */}
          <style>{`
          @keyframes blob {
            0%, 100% {
              transform: translate(0, 0) scale(1);
            }
            50% {
              transform: translate(50px, -30px) scale(1.2);
            }
          }
          @keyframes blob-reverse {
            0%, 100% {
              transform: translate(0, 0) scale(1);
            }
            50% {
              transform: translate(-40px, 40px) scale(1.3);
            }
          }
          @keyframes fade-in {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes gradient {
            0%, 100% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
          }
          @keyframes fade-in-up {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes wiggle {
            0%, 100% {
              transform: rotate(0deg);
            }
            25% {
              transform: rotate(10deg);
            }
            75% {
              transform: rotate(-10deg);
            }
          }
          @keyframes placeholderFade {
            0% {
              opacity: 0;
              transform: translateY(20px);
            }
            100% {
              opacity: 0.6;
              transform: translateY(0);
            }
          }
          @keyframes gradientShift {
            0%, 100% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
          }
          @keyframes slideUp {
            0% {
              opacity: 0;
              transform: translateY(15px);
            }
            100% {
              opacity: 1;
              transform: translateY(0);
            }
          }
            .red-header-bg {
              background-color: #ef4f5f;
              background-image: linear-gradient(180deg, #ef4f5f 0%, #e03546 100%);
            }
            @keyframes gradient-shift {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
            .animate-gradient-shift {
              animation: gradient-shift 3s ease infinite;
            }
          `}</style>
        </div>

        <div className="md:hidden relative overflow-x-clip bg-[#fff9f2] min-h-screen pb-24">
          <MobileHeader
            effectiveLocation={effectiveLocation}
            handleLocationClick={handleLocationClick}
            handleSearchFocus={handleSearchFocus}
            vegMode={vegMode}
            handleVegModeChange={handleVegModeChange}
            cartCount={cartCount}
          />

          <main className="px-5">
            {renderHeroBannerSection(true)}

            <HomeCategories 
  loadingRealCategories={loadingRealCategories} 
  homeCategoryTiles={homeCategoryTiles} 
  selectedHomeCategory={selectedHomeCategory} 
  setSelectedHomeCategory={setSelectedHomeCategory} 
/>

            <RecommendedItems 
  selectedHomeCategory={selectedHomeCategory} 
  setSelectedHomeCategory={setSelectedHomeCategory} 
  showRestaurantSkeleton={showRestaurantSkeleton} 
  loadingRestaurants={loadingRestaurants} 
  loadingCategoryFoodItems={loadingCategoryFoodItems} 
  loadingRecommendedFoodItems={loadingRecommendedFoodItems} 
  categoryFoodItems={categoryFoodItems} 
  recommendedFoodItems={recommendedFoodItems} 
  handleAddHomeItemToCart={handleAddHomeItemToCart} 
  cart={cart} 
/>
          </main>
        </div>

        <div className="hidden md:block relative overflow-x-clip bg-white dark:bg-[#0a0a0a]">
          {/* Brand Top Section (Dark) */}
          <div className="relative overflow-hidden bg-gradient-to-b from-[#3a142c] to-[#1a0a14] rounded-b-[2rem] shadow-lg mb-2">
            {festVideoActive && (
              <div className="absolute inset-0 z-0">
                <video
                  src={festBannerVideoUrl}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
                <div className="absolute inset-0 bg-black/40" />
              </div>
            )}
            <div className="relative z-10">
              <HomeHeader
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                location={effectiveLocation}
                handleLocationClick={handleLocationClick}
                handleSearchFocus={handleSearchFocus}
                placeholderIndex={placeholderIndex}
                placeholders={placeholders}
                vegMode={vegMode}
                handleVegModeChange={handleVegModeChange}
              />

              {activeTab === "food" && (
                <FestBanner
                  isVegMode={vegMode}
                  videoUrl={festVideoActive ? "" : festBannerVideoUrl}
                  hideFoodImages={festVideoActive}
                />
              )}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === "food" ? (
              <motion.div
                key="food-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-transparent dark:bg-transparent"
              >

                {/* "What's on your mind today?" Section - Now with Sticky Logic */}
                <MindCategories displayCategories={displayCategories} />

                {/* Dynamic Sticky Header (Search + Slider + Filters) */}
                <StickyHeader 
      isStickyHeaderVisible={isStickyHeaderVisible}
      showStickySearch={showStickySearch}
      handleSearchFocus={handleSearchFocus}
      displayCategories={displayCategories}
      setIsFilterOpen={setIsFilterOpen}
      foodPreferenceFilters={foodPreferenceFilters}
      activeFilters={activeFilters}
      toggleFilter={toggleFilter}
    />

                {/* Admin Hero Banners Section - Now below categories */}
                {renderHeroBannerSection(false)}

                {/* Filters Sticky Sidebar Header */}
                <FilterBar 
  setIsFilterOpen={setIsFilterOpen} 
  foodPreferenceFilters={foodPreferenceFilters} 
  activeFilters={activeFilters} 
  setActiveFilters={setActiveFilters} 
  applyFiltersAndRefetch={applyFiltersAndRefetch} 
  sortBy={sortBy} 
  selectedCuisine={selectedCuisine} 
/>

              </motion.div>
            ) : (
              <motion.div
                key="quick-content"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <QuickSection />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <RecommendedRestaurants recommendedForYouRestaurants={recommendedForYouRestaurants} />

        {/* Explore More Section */}
        <ExploreMoreSection 
  exploreMoreHeading={exploreMoreHeading} 
  showExploreSkeleton={showExploreSkeleton} 
  finalExploreItems={finalExploreItems} 
/>

        {/* Featured Foods - Horizontal Scroll */}

        {/* Restaurants - Enhanced with Animations */}
        <RestaurantsSection 
      shouldShowOutOfZoneHome={shouldShowOutOfZoneHome}
      filteredRestaurants={filteredRestaurants}
      isLoadingFilterResults={isLoadingFilterResults}
      loadingRestaurants={loadingRestaurants}
      visibleRestaurants={visibleRestaurants}
      isOutOfService={isEffectiveLocationOutOfService}
      availabilityTick={availabilityTick}
      hasMoreRestaurants={hasMoreRestaurants}
      loadMoreRestaurants={loadMoreRestaurants}
      setSelectedRestaurantSlug={setSelectedRestaurantSlug}
      setShowManageCollections={setShowManageCollections}
      setShowToast={setShowToast}
      restaurantLoadMoreRef={restaurantLoadMoreRef}
    />
      </div>

      {/* Filter Modal - Bottom Sheet */}
      <AnimatePresence>
        {isFilterOpen && (
          <div className="fixed inset-0 z-[100]">
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/50"
              onClick={() => setIsFilterOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />

            {/* Modal Content */}
            <motion.div
              className="absolute bottom-0 left-0 right-0 bg-white dark:bg-[#1a1a1a] rounded-t-3xl max-h-[85vh] flex flex-col"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{
                type: "spring",
                damping: 30,
                stiffness: 400,
                duration: 0.3,
              }}>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-4 border-b dark:border-gray-800">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Filters and sorting
                </h2>
                <button
                  onClick={() => {
                    setActiveFilters(new Set());
                    setSortBy(null);
                    setSelectedCuisine(null);
                  }}
                  className="text-[#7e3866] font-medium text-sm">
                  Clear all
                </button>
              </div>

              {/* Body */}
              <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar - Tabs */}
                <div className="w-24 sm:w-28 bg-gray-50 dark:bg-[#0a0a0a] border-r dark:border-gray-800 flex flex-col">
                  {[
                    { id: "sort", label: "Sort By", icon: ArrowDownUp },
                    { id: "time", label: "Time", icon: Timer },
                    { id: "rating", label: "Rating", icon: Star },
                    { id: "distance", label: "Distance", icon: MapPin },
                    { id: "price", label: "Dish Price", icon: IndianRupee },
                    { id: "offers", label: "Offers", icon: BadgePercent },
                    { id: "trust", label: "Trust", icon: ShieldCheck },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive =
                      activeScrollSection === tab.id ||
                      activeFilterTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveFilterTab(tab.id);
                          const section = filterSectionRefs.current[tab.id];
                          if (section) {
                            section.scrollIntoView({
                              behavior: "smooth",
                              block: "start",
                            });
                          }
                        }}
                        className={`flex flex-col items-center gap-1 py-4 px-2 text-center relative transition-colors ${isActive
                          ? "bg-white dark:bg-[#1a1a1a] text-[#7e3866]"
                          : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                          }`}>
                        {isActive && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#7e3866] rounded-r" />
                        )}
                        <Icon className="h-5 w-5" strokeWidth={1.5} />
                        <span className="text-xs font-medium leading-tight">
                          {tab.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Right Content Area - Scrollable */}
                <div
                  ref={rightContentRef}
                  className="flex-1 overflow-y-auto p-4">
                  {/* Sort By Tab */}
                  <div
                    ref={(el) => (filterSectionRefs.current["sort"] = el)}
                    data-section-id="sort"
                    className="space-y-4 mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Sort by
                    </h3>
                    <div className="flex flex-col gap-3">
                      {[
                        { id: null, label: "Relevance" },
                        { id: "price-low", label: "Price: Low to High" },
                        { id: "price-high", label: "Price: High to Low" },
                        { id: "rating-high", label: "Rating: High to Low" },
                        { id: "rating-low", label: "Rating: Low to High" },
                      ].map((option) => (
                        <button
                          key={option.id || "relevance"}
                          onClick={() => setSortBy(option.id)}
                          className={`px-4 py-3 rounded-xl border text-left transition-colors ${sortBy === option.id
                            ? "border-[#7e3866] bg-[#F9F9FB] dark:bg-green-900/20"
                            : "border-gray-200 dark:border-gray-800 hover:border-[#7e3866]"
                            }`}>
                          <span
                            className={`text-sm font-medium ${sortBy === option.id ? "text-[#7e3866]" : "text-gray-700 dark:text-gray-300"}`}>
                            {option.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Time Tab */}
                  <div
                    ref={(el) => (filterSectionRefs.current["time"] = el)}
                    data-section-id="time"
                    className="space-y-4 mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Estimated Time
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => toggleFilter("delivery-under-30")}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has("delivery-under-30")
                          ? "border-[#7e3866] bg-[#F9F9FB] dark:bg-green-900/20"
                          : "border-gray-200 dark:border-gray-800 hover:border-[#7e3866]"
                          }`}>
                        <Timer
                          className={`h-6 w-6 ${activeFilters.has("delivery-under-30") ? "text-[#7e3866]" : "text-gray-600 dark:text-gray-400"}`}
                          strokeWidth={1.5}
                        />
                        <span
                          className={`text-sm font-medium ${activeFilters.has("delivery-under-30") ? "text-[#7e3866]" : "text-gray-700 dark:text-gray-300"}`}>
                          Under 30 mins
                        </span>
                      </button>
                      <button
                        onClick={() => toggleFilter("delivery-under-45")}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has("delivery-under-45")
                          ? "border-[#7e3866] bg-[#F9F9FB] dark:bg-green-900/20"
                          : "border-gray-200 dark:border-gray-800 hover:border-[#7e3866]"
                          }`}>
                        <Timer
                          className={`h-6 w-6 ${activeFilters.has("delivery-under-45") ? "text-[#7e3866]" : "text-gray-600 dark:text-gray-400"}`}
                          strokeWidth={1.5}
                        />
                        <span
                          className={`text-sm font-medium ${activeFilters.has("delivery-under-45") ? "text-[#7e3866]" : "text-gray-700 dark:text-gray-300"}`}>
                          Under 45 mins
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Rating Tab */}
                  <div
                    ref={(el) => (filterSectionRefs.current["rating"] = el)}
                    data-section-id="rating"
                    className="space-y-4 mb-8">
                    <h3 className="text-lg font-semibold text-gray-900  dark:text-white mb-4">
                      Restaurant Rating
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => toggleFilter("rating-35-plus")}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has("rating-35-plus")
                          ? "border-[#7e3866] bg-[#F9F9FB] dark:bg-green-900/20"
                          : "border-gray-200 dark:border-gray-800 hover:border-[#7e3866]"
                          }`}>
                        <Star
                          className={`h-6 w-6 ${activeFilters.has("rating-35-plus") ? "text-[#7e3866] fill-[#7e3866]" : "text-gray-400 dark:text-gray-500"}`}
                        />
                        <span
                          className={`text-sm font-medium ${activeFilters.has("rating-35-plus") ? "text-[#7e3866]" : "text-gray-700 dark:text-gray-300"}`}>
                          Rated 3.5+
                        </span>
                      </button>
                      <button
                        onClick={() => toggleFilter("rating-4-plus")}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has("rating-4-plus")
                          ? "border-[#7e3866] bg-[#F9F9FB] dark:bg-green-900/20"
                          : "border-gray-200 dark:border-gray-800 hover:border-[#7e3866]"
                          }`}>
                        <Star
                          className={`h-6 w-6 ${activeFilters.has("rating-4-plus") ? "text-[#7e3866] fill-[#7e3866]" : "text-gray-400 dark:text-gray-500"}`}
                        />
                        <span
                          className={`text-sm font-medium ${activeFilters.has("rating-4-plus") ? "text-[#7e3866]" : "text-gray-700 dark:text-gray-300"}`}>
                          Rated 4.0+
                        </span>
                      </button>
                      <button
                        onClick={() => toggleFilter("rating-45-plus")}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has("rating-45-plus")
                          ? "border-[#7e3866] bg-[#F9F9FB] dark:bg-green-900/20"
                          : "border-gray-200 dark:border-gray-800 hover:border-[#7e3866]"
                          }`}>
                        <Star
                          className={`h-6 w-6 ${activeFilters.has("rating-45-plus") ? "text-[#7e3866] fill-[#7e3866]" : "text-gray-400 dark:text-gray-500"}`}
                        />
                        <span
                          className={`text-sm font-medium ${activeFilters.has("rating-45-plus") ? "text-[#7e3866]" : "text-gray-700 dark:text-gray-300"}`}>
                          Rated 4.5+
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Distance Tab */}
                  <div
                    ref={(el) => (filterSectionRefs.current["distance"] = el)}
                    data-section-id="distance"
                    className="space-y-4 mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Distance
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => toggleFilter("distance-under-1km")}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has("distance-under-1km")
                          ? "border-[#7e3866] bg-[#F9F9FB] dark:bg-green-900/20"
                          : "border-gray-200 dark:border-gray-800 hover:border-[#7e3866]"
                          }`}>
                        <MapPin
                          className={`h-6 w-6 ${activeFilters.has("distance-under-1km") ? "text-[#7e3866]" : "text-gray-600 dark:text-gray-400"}`}
                          strokeWidth={1.5}
                        />
                        <span
                          className={`text-sm font-medium ${activeFilters.has("distance-under-1km") ? "text-[#7e3866]" : "text-gray-700 dark:text-gray-300"}`}>
                          Under 1 km
                        </span>
                      </button>
                      <button
                        onClick={() => toggleFilter("distance-under-2km")}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has("distance-under-2km")
                          ? "border-[#7e3866] bg-[#F9F9FB] dark:bg-green-900/20"
                          : "border-gray-200 dark:border-gray-800 hover:border-[#7e3866]"
                          }`}>
                        <MapPin
                          className={`h-6 w-6 ${activeFilters.has("distance-under-2km") ? "text-[#7e3866]" : "text-gray-600 dark:text-gray-400"}`}
                          strokeWidth={1.5}
                        />
                        <span
                          className={`text-sm font-medium ${activeFilters.has("distance-under-2km") ? "text-[#7e3866]" : "text-gray-700 dark:text-gray-300"}`}>
                          Under 2 km
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Price Tab */}
                  <div
                    ref={(el) => (filterSectionRefs.current["price"] = el)}
                    data-section-id="price"
                    className="space-y-4 mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Dish Price
                    </h3>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => toggleFilter("price-under-200")}
                        className={`px-4 py-3 rounded-xl border text-left transition-colors ${activeFilters.has("price-under-200")
                          ? "border-[#7e3866] bg-[#F9F9FB] dark:bg-green-900/20"
                          : "border-gray-200 dark:border-gray-800 hover:border-[#7e3866]"
                          }`}>
                        <span
                          className={`text-sm font-medium ${activeFilters.has("price-under-200") ? "text-[#7e3866]" : "text-gray-700 dark:text-gray-300"}`}>
                          Under â‚¹200
                        </span>
                      </button>
                      <button
                        onClick={() => toggleFilter("price-under-500")}
                        className={`px-4 py-3 rounded-xl border text-left transition-colors ${activeFilters.has("price-under-500")
                          ? "border-[#7e3866] bg-[#F9F9FB] dark:bg-green-900/20"
                          : "border-gray-200 dark:border-gray-800 hover:border-[#7e3866]"
                          }`}>
                        <span
                          className={`text-sm font-medium ${activeFilters.has("price-under-500") ? "text-[#7e3866]" : "text-gray-700 dark:text-gray-300"}`}>
                          Under â‚¹500
                        </span>
                      </button>
                    </div>
                  </div>



                  {/* Trust Markers Tab */}
                  <div
                    ref={(el) => (filterSectionRefs.current["trust"] = el)}
                    data-section-id="trust"
                    className="space-y-4 mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Trust Markers
                    </h3>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => toggleFilter("top-rated")}
                        className={`px-4 py-3 rounded-xl border text-left transition-colors ${activeFilters.has("top-rated")
                          ? "border-[#7e3866] bg-[#F9F9FB] dark:bg-green-900/20"
                          : "border-gray-200 dark:border-gray-800 hover:border-[#7e3866]"
                          }`}>
                        <span
                          className={`text-sm font-medium ${activeFilters.has("top-rated") ? "text-[#7e3866]" : "text-gray-700 dark:text-gray-300"}`}>
                          Top Rated
                        </span>
                      </button>
                      <button
                        onClick={() => toggleFilter("trusted")}
                        className={`px-4 py-3 rounded-xl border text-left transition-colors ${activeFilters.has("trusted")
                          ? "border-[#7e3866] bg-[#F9F9FB] dark:bg-green-900/20"
                          : "border-gray-200 dark:border-gray-800 hover:border-[#7e3866]"
                          }`}>
                        <span
                          className={`text-sm font-medium ${activeFilters.has("trusted") ? "text-[#7e3866]" : "text-gray-700 dark:text-gray-300"}`}>
                          Trusted by 1000+ users
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Offers Tab */}
                  <div
                    ref={(el) => (filterSectionRefs.current["offers"] = el)}
                    data-section-id="offers"
                    className="space-y-4 mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Offers
                    </h3>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => toggleFilter("has-offers")}
                        className={`px-4 py-3 rounded-xl border text-left transition-colors ${activeFilters.has("has-offers")
                          ? "border-[#7e3866] bg-[#F9F9FB] dark:bg-green-900/20"
                          : "border-gray-200 dark:border-gray-800 hover:border-[#7e3866]"
                          }`}>
                        <span
                          className={`text-sm font-medium ${activeFilters.has("has-offers") ? "text-[#7e3866]" : "text-gray-700 dark:text-gray-300"}`}>
                          Restaurants with offers
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center gap-4 px-4 py-4 border-t dark:border-gray-800 bg-white dark:bg-[#1a1a1a]">
                <button
                  onClick={() => setIsFilterOpen(false)}
                  className="flex-1 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">
                  Close
                </button>
                <button
                  onClick={async () => {
                    setIsFilterOpen(false);
                    await applyFiltersAndRefetch(
                      activeFilters,
                      sortBy,
                      selectedCuisine,
                    );
                  }}
                  className={`flex-1 py-3 font-semibold rounded-xl transition-colors ${activeFilters.size > 0 || sortBy || selectedCuisine
                    ? "bg-[#7e3866] text-white hover:bg-[#55254b]"
                    : "bg-gray-200 text-gray-500"
                    }`}
                  disabled={isLoadingFilterResults}>
                  {isLoadingFilterResults
                    ? "Loading..."
                    : activeFilters.size > 0 || sortBy || selectedCuisine
                      ? `Show results`
                      : "Show results"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Veg Mode Popup */}
      <AnimatePresence>
        {showVegModePopup && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => {
                setShowVegModePopup(false);
                // Revert veg mode to OFF if popup is closed without applying
                setVegModeContext(false);
                setPrevVegMode(false);
              }}
              className="fixed inset-0 bg-black/30 z-[9998] backdrop-blur-sm"
            />

            {/* Popup */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              transition={{
                type: "spring",
                damping: 25,
                stiffness: 300,
                mass: 0.8,
              }}
              className="fixed z-[9999] bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl p-4 w-[calc(100%-2rem)] max-w-xs"
              style={{
                top: `${popupPosition.top}px`,
                left: `${popupPosition.left}px`,
              }}
              onClick={(e) => e.stopPropagation()}>
              {/* Pointer Triangle */}
              <div
                className="absolute -top-2 w-3 h-3 bg-white dark:bg-[#1a1a1a] transform rotate-45"
                style={{
                  left: `${popupPosition.triangleLeft - 6}px`,
                  boxShadow: "-2px -2px 4px rgba(0,0,0,0.1)",
                }}
              />

              {/* Title */}
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3">
                See veg dishes from
              </h3>

              {/* Radio Options */}
              <div className="space-y-2 mb-4">
                {/* All restaurants */}
                <label
                  className="flex items-center gap-2.5 cursor-pointer p-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => setVegModeOption("all")}>
                  <div className="relative flex items-center justify-center">
                    <input
                      type="radio"
                      name="vegModeOption"
                      value="all"
                      checked={vegModeOption === "all"}
                      onChange={() => setVegModeOption("all")}
                      className="sr-only"
                    />
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${vegModeOption === "all"
                        ? "border-green-600 dark:border-green-500 bg-green-600 dark:bg-green-500"
                        : "border-gray-300 dark:border-gray-600 bg-white dark:bg-[#2a2a2a]"
                        }`}>
                      {vegModeOption === "all" && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-white" />
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    All restaurants
                  </span>
                </label>

                {/* Pure Veg restaurants only */}
                <label
                  className="flex items-center gap-2.5 cursor-pointer p-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => setVegModeOption("pure-veg")}>
                  <div className="relative flex items-center justify-center">
                    <input
                      type="radio"
                      name="vegModeOption"
                      value="pure-veg"
                      checked={vegModeOption === "pure-veg"}
                      onChange={() => setVegModeOption("pure-veg")}
                      className="sr-only"
                    />
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${vegModeOption === "pure-veg"
                        ? "border-green-600 dark:border-green-500 bg-green-600 dark:bg-green-500"
                        : "border-gray-300 dark:border-gray-600 bg-white dark:bg-[#2a2a2a]"
                        }`}>
                      {vegModeOption === "pure-veg" && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-white" />
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    Pure Veg restaurants only
                  </span>
                </label>
              </div>

              {/* Apply Button */}
              <button
                onClick={() => {
                  setShowVegModePopup(false);
                  setIsApplyingVegMode(true);
                  // Confirm veg mode is ON by updating context and prevVegMode
                  setVegModeContext(true);
                  setPrevVegMode(true);
                  // Simulate applying veg mode settings
                  setTimeout(() => {
                    setIsApplyingVegMode(false);
                  }, 2000);
                }}
                className="w-full bg-[#7e3866] text-white font-semibold py-2.5 rounded-xl hover:bg-[#55254b] transition-colors mb-2 text-sm">
                Apply
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Switch Off Veg Mode Popup */}
      <AnimatePresence>
        {showSwitchOffPopup && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => {
                setShowSwitchOffPopup(false);
                isHandlingSwitchOff.current = false;
                setVegModeContext(true);
                // prevVegMode stays true (from before), which is correct
              }}
              className="fixed inset-0 bg-black/50 z-[9998] backdrop-blur-sm"
            />

            {/* Popup */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{
                type: "spring",
                damping: 25,
                stiffness: 300,
                mass: 0.8,
              }}
              className="fixed inset-0 z-[9999] flex dark:bg-[#lalala] dark:text-white items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}>
              <div className="bg-white dark:bg-[#lalala] dark:text-white rounded-2xl shadow-2xl w-[85%] max-w-sm p-6">
                {/* Warning Icon */}
                <div className="flex justify-center mb-4">
                  <div className="w-20 h-20 rounded-full bg-pink-100 flex items-center justify-center">
                    <AlertCircle
                      className="w-20 h-20 text-white bg-red-500/90 rounded-full p-2"
                      strokeWidth={2.5}
                    />
                  </div>
                </div>

                {/* Title */}
                <h2 className="text-2xl font-bold text-gray-900  text-center mb-2">
                  Switch off Veg Mode?
                </h2>

                {/* Description */}
                <p className="text-gray-600 text-center mb-6 text-sm">
                  You'll see all restaurants, including those serving non-veg
                  dishes
                </p>

                {/* Buttons */}
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setShowSwitchOffPopup(false);
                      setIsSwitchingOffVegMode(true);
                      // Simulate switching off veg mode
                      setTimeout(() => {
                        setIsSwitchingOffVegMode(false);
                        isHandlingSwitchOff.current = false;
                        setVegModeContext(false);
                        setPrevVegMode(false); // Set to false to match current state (veg mode is OFF)
                      }, 2000);
                    }}
                    className="w-full bg-transparent text-red-600 font-normal py-1 text-normal rounded-xl hover:bg-red-50 transition-colors text-base">
                    Switch off
                  </button>

                  <button
                    onClick={() => {
                      setShowSwitchOffPopup(false);
                      isHandlingSwitchOff.current = false;
                      setVegModeContext(true);
                      // prevVegMode stays true (from before), which is correct
                    }}
                    className="w-full text-gray-900 font-normal py-1 text-center rounded-xl hover:bg-gray-200 transition-colors text-base">
                    Keep using this mode
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* All Categories Modal */}
      <AllCategoriesModal 
        showAllCategoriesModal={showAllCategoriesModal}
        setShowAllCategoriesModal={setShowAllCategoriesModal}
        displayCategories={displayCategories}
      />

      <VegModeOverlay isApplyingVegMode={isApplyingVegMode} isSwitchingOffVegMode={isSwitchingOffVegMode} />
      
      {/* Loading Screen - Switching Off Veg Mode */}
      

      {/* Toast Notification - Fixed to viewport bottom */}
      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {showToast && (
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                transition={{ duration: 0.3, type: "spring", damping: 25 }}
                className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[10001] bg-black text-white px-6 py-3 rounded-lg shadow-2xl">
                <p className="text-sm font-medium">Added to bookmark</p>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}

      {/* Manage Collections Modal */}
      <ManageCollectionsModal 
        showManageCollections={showManageCollections}
        setShowManageCollections={setShowManageCollections}
        selectedRestaurantSlug={selectedRestaurantSlug}
        setSelectedRestaurantSlug={setSelectedRestaurantSlug}
      />
      
      <StickyCartCard />
      {/* Live order strip: only on homepage (not in UserLayout) */}
      <OrderTrackingCard hasBottomNav />
    </div>
  );
}

