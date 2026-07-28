import express from 'express';
import { upload } from '../../../../middleware/upload.js';
import { cacheResponse } from '../../../../middleware/cache.js';
import {
    listHeroBannersController,
    uploadHeroBannersController,
    deleteHeroBannerController,
    updateHeroBannerOrderController,
    toggleHeroBannerStatusController,
    linkRestaurantsToBannerController
} from '../controllers/heroBanner.controller.js';
import {
    listUnder250BannersController,
    uploadUnder250BannersController,
    deleteUnder250BannerController,
    updateUnder250BannerOrderController,
    toggleUnder250BannerStatusController
} from '../controllers/under250Banner.controller.js';
import {
    listDiningBannersController,
    uploadDiningBannersController,
    deleteDiningBannerController,
    updateDiningBannerOrderController,
    toggleDiningBannerStatusController
} from '../controllers/diningBanner.controller.js';
import {
    getAdminLandingSettingsController,
    updateAdminLandingSettingsController
} from '../controllers/landingSettings.controller.js';
import {
    listExploreMoreController,
    createExploreMoreController,
    updateExploreMoreController,
    deleteExploreMoreController,
    toggleExploreMoreStatusController,
    updateExploreMoreOrderController
} from '../controllers/exploreIcon.controller.js';
import {
    getPublicHeroBannersController,
    getPublicUnder250BannersController,
    getPublicDiningBannersController,
    getPublicExploreIconsController,
    getPublicGourmetController,
    getPublicLandingSettingsController
} from '../controllers/publicLanding.controller.js';
import { detectZonePublicController, listZonesPublicController, listZonesNearbyPublicController } from '../controllers/zonePublic.controller.js';
import { getPublicEnvController } from '../controllers/publicEnv.controller.js';
import {
    listGourmetAdmin,
    createGourmetAdmin,
    deleteGourmetAdmin,
    updateGourmetOrderAdmin,
    toggleGourmetStatusAdmin
} from '../controllers/top10GourmetAdmin.controller.js';
import { getPublicPageController } from '../../admin/controllers/pageContent.controller.js';
import { getPublicReferralSettingsController } from '../controllers/publicReferralSettings.controller.js';
import { getAppCustomizationController } from '../../shared/appCustomization.controller.js';
import {
    listMealSlotsAdminController,
    listMealSlotsPublicController,
    createMealSlotController,
    updateMealSlotController,
    deleteMealSlotController,
    toggleMealSlotStatusController,
    updateMealSlotOrderController,
} from '../controllers/mealSlot.controller.js';
import {
    listSubscriptionPlansAdminController,
    createSubscriptionPlanController,
    updateSubscriptionPlanController,
    deleteSubscriptionPlanController,
    toggleSubscriptionPlanStatusController,
    updateSubscriptionPlanOrderController,
    listSubscriptionPlansPublicController,
} from '../controllers/subscriptionPlan.controller.js';
import { getPublicActiveAds } from '../../admin/controllers/appIntroAd.controller.js';

const router = express.Router();

router.get('/pages/:key', cacheResponse(1800, 'public_pages'), getPublicPageController);
router.get('/referral-settings', cacheResponse(900, 'public_referral_settings'), getPublicReferralSettingsController);
router.get('/app-customization/public', cacheResponse(900, 'app_customization_public'), getAppCustomizationController);
router.get('/meal-slots/public', cacheResponse(900, 'public_meal_slots'), listMealSlotsPublicController);
router.get('/subscription-plans/public', cacheResponse(900, 'public_subscription_plans'), listSubscriptionPlansPublicController);

router.get('/meal-slots', listMealSlotsAdminController);
router.post('/meal-slots', upload.single('image'), createMealSlotController);
router.patch('/meal-slots/:id', upload.single('image'), updateMealSlotController);
router.delete('/meal-slots/:id', deleteMealSlotController);
router.patch('/meal-slots/:id/status', toggleMealSlotStatusController);
router.patch('/meal-slots/:id/order', updateMealSlotOrderController);

router.get('/subscription-plans', listSubscriptionPlansAdminController);
router.post('/subscription-plans', createSubscriptionPlanController);
router.patch('/subscription-plans/:id', updateSubscriptionPlanController);
router.delete('/subscription-plans/:id', deleteSubscriptionPlanController);
router.patch('/subscription-plans/:id/status', toggleSubscriptionPlanStatusController);
router.patch('/subscription-plans/:id/order', updateSubscriptionPlanOrderController);

router.get('/hero-banners', listHeroBannersController);
router.post('/hero-banners/multiple', upload.array('files'), uploadHeroBannersController);
router.delete('/hero-banners/:id', deleteHeroBannerController);
router.patch('/hero-banners/:id/order', updateHeroBannerOrderController);
router.patch('/hero-banners/:id/status', toggleHeroBannerStatusController);
router.patch('/hero-banners/:id/link-restaurants', linkRestaurantsToBannerController);

router.get('/hero-banners/under-250', listUnder250BannersController);
router.post('/hero-banners/under-250/multiple', upload.array('files'), uploadUnder250BannersController);
router.delete('/hero-banners/under-250/:id', deleteUnder250BannerController);
router.patch('/hero-banners/under-250/:id/order', updateUnder250BannerOrderController);
router.patch('/hero-banners/under-250/:id/status', toggleUnder250BannerStatusController);

router.get('/hero-banners/ads', listDiningBannersController);
router.post('/hero-banners/ads/multiple', upload.array('files'), uploadDiningBannersController);
router.delete('/hero-banners/ads/:id', deleteDiningBannerController);
router.patch('/hero-banners/ads/:id/order', updateDiningBannerOrderController);
router.patch('/hero-banners/ads/:id/status', toggleDiningBannerStatusController);

router.get('/hero-banners/landing/explore-more', listExploreMoreController);
router.post('/hero-banners/landing/explore-more', upload.single('image'), createExploreMoreController);
router.delete('/hero-banners/landing/explore-more/:id', deleteExploreMoreController);
router.patch('/hero-banners/landing/explore-more/:id/status', toggleExploreMoreStatusController);
router.patch('/hero-banners/landing/explore-more/:id/order', updateExploreMoreOrderController);
router.patch('/hero-banners/landing/explore-more/:id', upload.single('image'), updateExploreMoreController);

router.get('/hero-banners/gourmet', listGourmetAdmin);
router.post('/hero-banners/gourmet', createGourmetAdmin);
router.delete('/hero-banners/gourmet/:id', deleteGourmetAdmin);
router.patch('/hero-banners/gourmet/:id/order', updateGourmetOrderAdmin);
router.patch('/hero-banners/gourmet/:id/status', toggleGourmetStatusAdmin);

router.get('/hero-banners/public', cacheResponse(600, 'landing_hero_banners'), getPublicHeroBannersController);
router.get('/hero-banners/under-250/public', cacheResponse(600, 'landing_under_250_banners'), getPublicUnder250BannersController);
router.get('/hero-banners/ads/public', cacheResponse(600, 'landing_ads_banners'), getPublicDiningBannersController);
router.get('/explore-icons/public', cacheResponse(1800, 'landing_explore_icons'), getPublicExploreIconsController);
router.get('/hero-banners/gourmet/public', cacheResponse(900, 'landing_gourmet'), getPublicGourmetController);
router.get('/landing/settings/public', cacheResponse(900, 'landing_settings_public'), getPublicLandingSettingsController);
router.get('/zones/detect', detectZonePublicController);
router.get('/zones/nearby', listZonesNearbyPublicController);
router.get('/zones/public', cacheResponse(1800, 'landing_zones_public'), listZonesPublicController);
router.get('/public/env', cacheResponse(1800, 'public_env'), getPublicEnvController);
router.get('/app-intro-ads/public', cacheResponse(600, 'landing_intro_ads'), getPublicActiveAds);

router.get('/hero-banners/landing/settings', getAdminLandingSettingsController);
router.patch('/hero-banners/landing/settings', updateAdminLandingSettingsController);

export default router;
