import mongoose from 'mongoose';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';
import { buildPaginationOptions, buildPaginatedResult } from '../../../../utils/helpers.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { FoodSubscriptionPlan } from '../../landing/models/subscriptionPlan.model.js';
import { FoodSubscription } from '../models/subscription.model.js';
import { FoodSubscriptionSchedule } from '../models/subscriptionSchedule.model.js';
import { FoodOrder } from '../../orders/models/order.model.js';
import { FoodItem } from '../../admin/models/food.model.js';
import { FoodUser } from '../../../../core/users/user.model.js';
import {
  createRazorpayOrder,
  getRazorpayKeyId,
  isRazorpayConfigured,
  verifyPaymentSignature,
} from '../../orders/helpers/razorpay.helper.js';
import * as userWalletService from '../../user/services/userWallet.service.js';
import * as foodTransactionService from '../../orders/services/foodTransaction.service.js';
import * as dispatchService from '../../orders/services/order-dispatch.service.js';
import {
  enqueueOrderEvent,
  haversineKm,
  notifyOwnersSafely,
  pushStatusHistory,
  normalizeOrderForClient,
} from '../../orders/services/order.helpers.js';
import { getIO, rooms } from '../../../../config/socket.js';
import {
  assertSubscriptionFlowAllowed,
  getAppCustomizationSettings,
} from '../../shared/appCustomization.service.js';
import { FoodMealSlot } from '../../landing/models/mealSlot.model.js';
import { FoodDeliveryCommissionRule } from '../../admin/models/deliveryCommissionRule.model.js';
import { FoodFeeSettings } from '../../admin/models/feeSettings.model.js';

function normalizeMeals(meals = []) {
  return meals
    .map((meal) => String(meal || '').trim())
    .filter(Boolean);
}

function buildSubscriptionDates(planDays, options = {}) {
  const startDate = new Date();
  const startFromToday = options.startFrom === 'today';
  const devModePlaceNow =
    options.devModePlaceNow === true && process.env.NODE_ENV !== 'production';

  if (devModePlaceNow) {
    startDate.setSeconds(0, 0);
  } else {
    if (!startFromToday) {
      startDate.setDate(startDate.getDate() + 1);
    }
    startDate.setHours(0, 0, 0, 0);
  }

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + Number(planDays || 0) - 1);
  endDate.setHours(23, 59, 59, 999);
  return { startDate, endDate };
}

function parseMealStartTime(timeLabel = '') {
  const match = String(timeLabel || '').match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = String(match[3] || '').toUpperCase();
  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  if (!Number.isFinite(hours) || hours < 0 || hours > 23) return null;
  return { hours, minutes: Number.isFinite(minutes) ? minutes : 0 };
}

function fallbackMealStartTime(mealName = '') {
  const normalized = String(mealName || '').toLowerCase();
  if (normalized.includes('breakfast')) return { hours: 7, minutes: 0 };
  if (normalized.includes('lunch')) return { hours: 13, minutes: 0 };
  if (normalized.includes('snack')) return { hours: 17, minutes: 0 };
  if (normalized.includes('dinner')) return { hours: 20, minutes: 0 };
  return { hours: 9, minutes: 0 };
}

async function getMealOrderAt(schedule) {
  const serviceDate = new Date(schedule.serviceDate);
  serviceDate.setHours(0, 0, 0, 0);
  const mealName = String(schedule.mealName || '').trim().toLowerCase();
  const slot = mealName
    ? await FoodMealSlot.findOne({
        title: { $regex: `^${mealName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
      }).lean()
    : null;
  const parsed = parseMealStartTime(slot?.timeLabel) || fallbackMealStartTime(schedule.mealName);
  serviceDate.setHours(parsed.hours, parsed.minutes, 0, 0);
  return serviceDate;
}

async function getDishChangeWindow(schedule, appSettings) {
  const orderAt = await getMealOrderAt(schedule);
  const leadHours = Math.max(
    1,
    Number(appSettings?.timeManagement?.dishChangeLeadHours || 24),
  );
  const deadline = new Date(orderAt.getTime() - leadHours * 60 * 60 * 1000);
  return {
    orderAt,
    deadline,
    leadHours,
    canChange:
      String(schedule.status) === 'scheduled' &&
      (appSettings?.timeManagement?.devModeAllowAnytimeChanges === true || new Date() <= deadline),
  };
}

async function getAddressChangeWindow(schedule, appSettings) {
  const orderAt = await getMealOrderAt(schedule);
  const leadHours = Math.max(
    1,
    Number(appSettings?.timeManagement?.addressChangeLeadHours || 3),
  );
  const deadline = new Date(orderAt.getTime() - leadHours * 60 * 60 * 1000);
  return {
    orderAt,
    deadline,
    leadHours,
    canChange:
      String(schedule.status) === 'scheduled' &&
      (appSettings?.timeManagement?.devModeAllowAnytimeChanges === true || new Date() <= deadline),
  };
}

function normalizeDishForClient(dish) {
  if (!dish) return null;
  return {
    id: dish._id?.toString?.() || String(dish._id || ''),
    name: dish.name || '',
    price: Number(dish.price || 0),
    image: dish.image || '',
    foodType: dish.foodType || '',
    categoryName: dish.categoryName || '',
  };
}

function normalizeDeliveryAddress(address = {}, { customerName = '', customerPhone = '' } = {}) {
  const coordinates = Array.isArray(address?.location?.coordinates)
    ? address.location.coordinates.map(Number).filter((n) => Number.isFinite(n))
    : undefined;
  return {
    label: address.label || 'Home',
    name: address.name || address.fullName || customerName || '',
    fullName: address.fullName || address.name || customerName || '',
    street: address.street || address.address || address.formattedAddress || '',
    additionalDetails: address.additionalDetails || '',
    city: address.city || '',
    state: address.state || '',
    zipCode: address.zipCode || address.postalCode || '',
    phone: address.phone || customerPhone || '',
    location:
      coordinates?.length === 2
        ? { type: 'Point', coordinates }
        : undefined,
  };
}

const BUSINESS_TZ_OFFSET_MINUTES = Number(
  process.env.FOOD_BUSINESS_TZ_OFFSET_MINUTES || 330,
);

function getDayBounds(dateInput = new Date()) {
  // Normalize subscription day boundaries to one business timezone so
  // local/dev/prod servers do not disagree when their machine timezones differ.
  const source = new Date(dateInput);
  const shifted = new Date(
    source.getTime() + BUSINESS_TZ_OFFSET_MINUTES * 60 * 1000,
  );
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const day = shifted.getUTCDate();

  const start = new Date(
    Date.UTC(year, month, day, 0, 0, 0, 0) -
      BUSINESS_TZ_OFFSET_MINUTES * 60 * 1000,
  );
  const end = new Date(
    Date.UTC(year, month, day, 23, 59, 59, 999) -
      BUSINESS_TZ_OFFSET_MINUTES * 60 * 1000,
  );

  return { start, end };
}

function addDays(dateInput, days) {
  const next = new Date(dateInput);
  next.setDate(next.getDate() + days);
  return next;
}

function getTotalCredits(planDays, meals = []) {
  const safePlanDays = Math.max(0, Number(planDays) || 0);
  const mealCount = Math.max(1, Array.isArray(meals) ? meals.length : 0);
  return safePlanDays * mealCount;
}

function getCreditPerOrder(totalAmount, totalCredits) {
  const safeTotalAmount = Math.max(0, Number(totalAmount) || 0);
  const safeCredits = Math.max(0, Number(totalCredits) || 0);
  if (!safeCredits) return 0;
  return Number((safeTotalAmount / safeCredits).toFixed(2));
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

const SUBSCRIPTION_COMMISSION_CACHE_MS = 10 * 1000;
let subscriptionCommissionRulesCache = null;
let subscriptionCommissionRulesLoadedAt = 0;

async function getActiveDeliveryCommissionRules() {
  const now = Date.now();
  if (
    subscriptionCommissionRulesCache &&
    now - subscriptionCommissionRulesLoadedAt < SUBSCRIPTION_COMMISSION_CACHE_MS
  ) {
    return subscriptionCommissionRulesCache;
  }

  const list = await FoodDeliveryCommissionRule.find({
    status: { $ne: false },
  }).lean();
  subscriptionCommissionRulesCache = list || [];
  subscriptionCommissionRulesLoadedAt = now;
  return subscriptionCommissionRulesCache;
}

async function getSubscriptionRiderEarning(distanceKm) {
  const d = Number(distanceKm);
  if (!Number.isFinite(d) || d <= 0) return 0;

  const rules = await getActiveDeliveryCommissionRules();
  if (!rules.length) return 0;

  const sorted = [...rules].sort(
    (a, b) => (a.minDistance || 0) - (b.minDistance || 0),
  );
  const baseRule = sorted.find((rule) => Number(rule.minDistance || 0) === 0) || null;
  if (!baseRule) return 0;

  let earning = Number(baseRule.basePayout || 0);

  for (const rule of sorted) {
    const perKm = Number(rule.commissionPerKm || 0);
    if (!Number.isFinite(perKm) || perKm <= 0) continue;

    const min = Number(rule.minDistance || 0);
    const max = rule.maxDistance == null ? null : Number(rule.maxDistance);
    if (d <= min) continue;

    const upper = max == null ? d : Math.min(d, max);
    const kmInSlab = Math.max(0, upper - min);
    if (kmInSlab > 0) {
      earning += kmInSlab * perKm;
    }
  }

  if (!Number.isFinite(earning) || earning <= 0) return 0;

  const feeSettings = await FoodFeeSettings.findOne({ isActive: true }).lean();
  const deliveryBonusAmount = Number(feeSettings?.deliveryBonusAmount || 0);
  if (deliveryBonusAmount > 0) {
    earning += deliveryBonusAmount;
  }

  return Math.round(earning);
}
function normalizeSubscriptionForClient(doc) {
  const subscription = doc?.toObject ? doc.toObject() : doc || {};
  const totalCredits =
    Number(subscription.totalCredits) ||
    getTotalCredits(subscription.planDays, subscription.meals);
  const usedCredits = Math.max(0, Number(subscription.usedCredits) || 0);
  return {
    ...subscription,
    subscriptionId:
      subscription._id?.toString?.() || String(subscription._id || ''),
    totalCredits,
    usedCredits,
    remainingCredits: Math.max(0, totalCredits - usedCredits),
    creditPerOrder:
      Number(subscription.creditPerOrder) ||
      getCreditPerOrder(subscription.totalAmount, totalCredits),
  };
}

function isSubscriptionActiveNow(subscription) {
  if (!subscription) return false;
  if (String(subscription.status || '').toLowerCase() !== 'active') return false;
  if (String(subscription.paymentStatus || '').toLowerCase() !== 'paid') return false;
  const now = new Date();
  if (subscription.startDate && new Date(subscription.startDate) > now) return false;
  if (subscription.endDate && new Date(subscription.endDate) < now) return false;
  const normalized = normalizeSubscriptionForClient(subscription);
  return normalized.remainingCredits > 0;
}

async function createSubscriptionSchedules(subscriptionDoc) {
  const subscription = subscriptionDoc?.toObject
    ? subscriptionDoc.toObject()
    : subscriptionDoc;
  if (!subscription?._id) return { created: 0 };

  const meals = normalizeMeals(subscription.meals);
  if (!meals.length) return { created: 0 };

  const startDate = subscription.startDate
    ? new Date(subscription.startDate)
    : buildSubscriptionDates(subscription.planDays).startDate;

  const rows = [];
  const planDays = Math.max(1, Number(subscription.planDays || 0));
  for (let dayOffset = 0; dayOffset < planDays; dayOffset += 1) {
    const serviceDate = addDays(startDate, dayOffset);
    serviceDate.setHours(0, 0, 0, 0);
    for (const mealName of meals) {
      rows.push({
        subscriptionId: subscription._id,
        userId: subscription.userId,
        restaurantId: subscription.restaurantId,
        planId: subscription.planId || null,
        dishId: subscription.dishId,
        dishName: subscription.dishName,
        mealName,
        serviceDate,
        status: 'scheduled',
      });
    }
  }

  if (!rows.length) return { created: 0 };

  try {
    const result = await FoodSubscriptionSchedule.insertMany(rows, {
      ordered: false,
    });
    return { created: result.length };
  } catch (error) {
    if (error?.code !== 11000 && error?.writeErrors == null) throw error;
    return { created: 0, duplicate: true };
  }
}

async function notifyRestaurantSubscriptionStarted(subscriptionDoc) {
  const subscription = subscriptionDoc?.toObject
    ? subscriptionDoc.toObject()
    : subscriptionDoc;
  if (!subscription?.restaurantId) return;

  const payload = {
    subscriptionId: String(subscription._id),
    restaurantId: String(subscription.restaurantId),
    userId: String(subscription.userId),
    dishName: subscription.dishName,
    planTitle: subscription.planTitle,
    meals: subscription.meals || [],
    startDate: subscription.startDate,
    type: 'subscription_started',
  };

  try {
    const io = getIO();
    if (io) {
      io.to(rooms.restaurant(subscription.restaurantId)).emit(
        'play_notification_sound',
        {
          ...payload,
          orderId: `SUB-${String(subscription._id).slice(-6)}`,
          orderMongoId: String(subscription._id),
        },
      );
      io.to(rooms.restaurant(subscription.restaurantId)).emit(
        'subscription_started',
        payload,
      );
    }
  } catch {
    // Notification failure should not block activation.
  }

  await notifyOwnersSafely(
    [{ ownerType: 'RESTAURANT', ownerId: subscription.restaurantId }],
    {
      title: 'New subscription received',
      body: `${subscription.dishName || 'A dish'} subscription starts from ${
        subscription.startDate
          ? new Date(subscription.startDate).toLocaleDateString('en-IN')
          : 'the selected start date'
      }.`,
      data: {
        type: 'subscription_started',
        subscriptionId: String(subscription._id),
        restaurantId: String(subscription.restaurantId),
      },
    },
  );
}

export function computeSubscriptionOrderAdjustment(subscriptionDoc, orderTotal) {
  const normalized = normalizeSubscriptionForClient(subscriptionDoc);
  const orderAmount = Math.max(0, Number(orderTotal) || 0);
  const creditPerOrder = Math.max(0, Number(normalized.creditPerOrder) || 0);
  const subscriptionCreditApplied = Math.min(orderAmount, creditPerOrder);
  const payableTotal = Math.max(
    0,
    Number((orderAmount - creditPerOrder).toFixed(2)),
  );
  const walletCreditAmount = Math.max(
    0,
    Number((creditPerOrder - orderAmount).toFixed(2)),
  );

  return {
    subscriptionId: normalized.subscriptionId,
    planId: normalized.planId || null,
    planTitle: normalized.planTitle || '',
    creditPerOrder,
    subscriptionCreditApplied,
    payableTotal,
    walletCreditAmount,
    remainingCredits: normalized.remainingCredits,
  };
}

export async function getApplicableActiveSubscription(
  userId,
  restaurantId,
  { restaurantName } = {},
) {
  if (!mongoose.isValidObjectId(userId)) {
    return null;
  }

  const baseFilter = {
    userId: new mongoose.Types.ObjectId(userId),
    status: 'active',
    paymentStatus: 'paid',
  };

  let candidates = [];

  if (mongoose.isValidObjectId(restaurantId)) {
    candidates = await FoodSubscription.find({
      ...baseFilter,
      restaurantId: new mongoose.Types.ObjectId(restaurantId),
    })
      .sort({ createdAt: -1 })
      .lean();
  }

  let matchedSubscription =
    candidates.find((subscription) => isSubscriptionActiveNow(subscription)) || null;

  const normalizedRestaurantName = String(restaurantName || '').trim().toLowerCase();
  if (!matchedSubscription && normalizedRestaurantName) {
    const fallbackCandidates = await FoodSubscription.find(baseFilter)
      .sort({ createdAt: -1 })
      .lean();

    matchedSubscription =
      fallbackCandidates.find((subscription) => {
        const subscriptionRestaurantName = String(
          subscription.restaurantName || '',
        )
          .trim()
          .toLowerCase();

        return (
          subscriptionRestaurantName &&
          subscriptionRestaurantName === normalizedRestaurantName &&
          isSubscriptionActiveNow(subscription)
        );
      }) || null;
  }

  return matchedSubscription;
}

export async function consumeSubscriptionCredit({
  subscriptionId,
  userId,
  orderId,
  orderTotal,
}) {
  if (!mongoose.isValidObjectId(subscriptionId)) {
    throw new ValidationError('Subscription id is invalid');
  }

  const subscription = await FoodSubscription.findById(subscriptionId);
  if (!subscription) throw new NotFoundError('Subscription not found');
  if (!isSubscriptionActiveNow(subscription)) {
    throw new ValidationError('Subscription is not active for this order');
  }

  const adjustment = computeSubscriptionOrderAdjustment(subscription, orderTotal);
  subscription.usedCredits = Math.max(0, Number(subscription.usedCredits || 0)) + 1;
  await subscription.save();

  if (adjustment.walletCreditAmount > 0) {
    await userWalletService.refundWalletBalance(
      userId,
      adjustment.walletCreditAmount,
      `Subscription balance credit for order #${orderId}`,
      {
        source: 'subscription_leftover_credit',
        orderId,
        subscriptionId: subscription._id,
      },
    );
  }

  return {
    subscription: normalizeSubscriptionForClient(subscription),
    adjustment,
  };
}

export async function createSubscriptionOrder(userId, dto) {
  const appSettings = await getAppCustomizationSettings();
  assertSubscriptionFlowAllowed(appSettings);

  if (!isRazorpayConfigured()) {
    throw new ValidationError('Razorpay is not configured');
  }

  if (!mongoose.isValidObjectId(dto.restaurantId)) {
    throw new ValidationError('Restaurant id is invalid');
  }

  const restaurant = await FoodRestaurant.findById(dto.restaurantId)
    .select('restaurantName status isAcceptingOrders')
    .lean();
  if (!restaurant) throw new ValidationError('Restaurant not found');
  if (restaurant.status !== 'approved' || restaurant.isAcceptingOrders === false) {
    throw new ValidationError('Restaurant is not accepting orders');
  }

  let plan = null;
  if (dto.planId && !mongoose.isValidObjectId(dto.planId)) {
    throw new ValidationError('Plan id is invalid');
  }
  if (dto.planId && mongoose.isValidObjectId(dto.planId)) {
    plan = await FoodSubscriptionPlan.findOne({
      _id: new mongoose.Types.ObjectId(dto.planId),
      isActive: true,
    });
    if (!plan) throw new ValidationError('Subscription plan not found');
  }
  if (!plan) {
    throw new ValidationError('Please select an admin-created subscription plan');
  }

  const planDays = Number(plan?.durationDays || dto.planDays || 0);
  if (!Number.isFinite(planDays) || planDays <= 0) {
    throw new ValidationError('Plan days must be greater than 0');
  }

  const meals = normalizeMeals(dto.meals);
  if (!meals.length) {
    throw new ValidationError('At least one meal is required');
  }
  const mealCount = meals.length;
  let itemPrice = Number(dto.itemPrice || 0);
  if (!Number.isFinite(itemPrice) || itemPrice <= 0) {
    const dish = mongoose.isValidObjectId(dto.dishId)
      ? await FoodItem.findById(dto.dishId).select('price').lean()
      : null;
    itemPrice = Number(dish?.price || 0);
  }
  if (!Number.isFinite(itemPrice) || itemPrice <= 0) {
    throw new ValidationError('Dish price is required for subscription');
  }

  const foodSubtotal = roundMoney(itemPrice * mealCount * planDays);
  const gstRate = Number.isFinite(Number(dto.gstRate)) ? Number(dto.gstRate) : 5;
  const gstAmount = roundMoney(foodSubtotal * (gstRate / 100));
  const deliveryFeePerDay = Number.isFinite(Number(dto.deliveryFeePerDay))
    ? Number(dto.deliveryFeePerDay)
    : 10;
  const deliveryCharges = roundMoney(deliveryFeePerDay * planDays);
  const payableAmount = roundMoney(foodSubtotal + gstAmount + deliveryCharges);
  const dtoTotalAmount = roundMoney(dto.totalAmount || 0);
  if (!Number.isFinite(dtoTotalAmount) || dtoTotalAmount <= 0) {
    throw new ValidationError('Total amount must be greater than 0');
  }
  if (Math.abs(dtoTotalAmount - payableAmount) > 1) {
    throw new ValidationError('Subscription amount mismatch. Please refresh and try again.');
  }

  const customerName = String(dto.customerName || '').trim();
  const customerPhone = String(dto.customerPhone || '').trim();
  const deliveryAddress = normalizeDeliveryAddress(dto.deliveryAddress, {
    customerName,
    customerPhone,
  });
  if (!deliveryAddress.street || !deliveryAddress.city || !deliveryAddress.state) {
    throw new ValidationError('Delivery address is required for subscription');
  }
  const payableAmountPaise = Math.round(payableAmount * 100);
  if (payableAmountPaise < 100) {
    throw new ValidationError('Amount too low for online payment');
  }
  const totalCredits = getTotalCredits(planDays, meals);
  const creditPerOrder = getCreditPerOrder(payableAmount, totalCredits);
  const currency = String(plan?.currency || dto.currency || 'INR').trim().toUpperCase();
  const razorpayOrder = await createRazorpayOrder(
    payableAmountPaise,
    currency,
    `sub_${Date.now()}`,
  );

  const subscription = await FoodSubscription.create({
    userId: new mongoose.Types.ObjectId(userId),
    restaurantId: new mongoose.Types.ObjectId(dto.restaurantId),
    dishId: String(dto.dishId).trim(),
    dishName: String(dto.dishName).trim(),
    restaurantName:
      String(dto.restaurantName || restaurant.restaurantName || '').trim(),
    meals,
    customerName,
    customerPhone: customerPhone || deliveryAddress.phone || '',
    deliveryAddress,
    planId: plan?._id || null,
    planTitle: String(plan?.title || `${planDays} Days`).trim(),
    planDays,
    totalAmount: payableAmount,
    creditPerOrder,
    totalCredits,
    usedCredits: 0,
    currency,
    razorpayPlanId: '',
    razorpaySubscriptionId: '',
    razorpayOrderId: razorpayOrder.id,
    status: 'pending_payment',
    paymentStatus: 'created',
  });

  return {
    subscription: normalizeSubscriptionForClient(subscription),
    order: razorpayOrder,
    razorpay: {
      key: getRazorpayKeyId(),
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount || payableAmountPaise,
      currency: razorpayOrder.currency || currency,
    },
  };
}

export async function verifySubscriptionPayment(userId, dto) {
  if (!mongoose.isValidObjectId(dto.subscriptionId)) {
    throw new ValidationError('Subscription id is invalid');
  }

  const subscription = await FoodSubscription.findOne({
    _id: dto.subscriptionId,
    userId: new mongoose.Types.ObjectId(userId),
  });
  if (!subscription) throw new NotFoundError('Subscription not found');

  if (subscription.status === 'active' && subscription.paymentStatus === 'paid') {
    return { subscription: normalizeSubscriptionForClient(subscription) };
  }

  if (String(subscription.razorpayOrderId) !== String(dto.razorpayOrderId)) {
    throw new ValidationError('Razorpay order mismatch');
  }

  const appSettings = await getAppCustomizationSettings();
  const valid = appSettings?.directPaymentTestMode === true
    ? true
    : verifyPaymentSignature(
        dto.razorpayOrderId,
        dto.razorpayPaymentId,
        dto.razorpaySignature,
      );
  if (!valid) {
    subscription.paymentStatus = 'failed';
    subscription.status = 'payment_failed';
    await subscription.save();
    throw new ValidationError('Payment verification failed');
  }

  assertSubscriptionFlowAllowed(appSettings);
  const { startDate, endDate } = buildSubscriptionDates(
    subscription.planDays,
    appSettings.subscriptionOrders,
  );
  const totalCredits = getTotalCredits(subscription.planDays, subscription.meals);
  const creditPerOrder = getCreditPerOrder(subscription.totalAmount, totalCredits);
  subscription.razorpayOrderId = dto.razorpayOrderId;
  subscription.razorpayPaymentId = dto.razorpayPaymentId;
  subscription.razorpaySignature = dto.razorpaySignature;
  subscription.paymentStatus = 'paid';
  subscription.status = 'active';
  subscription.totalCredits = totalCredits;
  subscription.creditPerOrder = creditPerOrder;
  subscription.usedCredits = Number(subscription.usedCredits || 0);
  subscription.startDate = startDate;
  subscription.endDate = endDate;
  await subscription.save();

  await createSubscriptionSchedules(subscription);
  await notifyRestaurantSubscriptionStarted(subscription);

  return { subscription: normalizeSubscriptionForClient(subscription) };
}

export async function listTodaySubscriptionMealsForRestaurant(
  restaurantId,
  query = {},
) {
  const view = String(query.view || 'current').trim().toLowerCase();
  const rawDate = String(query.date || '').trim();
  const date = rawDate ? new Date(rawDate) : new Date();
  const baseDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const todayBounds = getDayBounds(baseDate);
  const tomorrowBounds = getDayBounds(addDays(baseDate, 1));
  const rangeStart = getDayBounds(addDays(baseDate, -30)).start;
  const rangeEnd = getDayBounds(addDays(baseDate, 30)).end;

  let serviceDateFilter = { $gte: todayBounds.start, $lte: todayBounds.end };
  let statusFilter = { $in: ['scheduled', 'sent_to_delivery'] };

  if (view === 'all') {
    serviceDateFilter = { $gte: todayBounds.start, $lte: rangeEnd };
    statusFilter = { $in: ['scheduled', 'sent_to_delivery', 'skipped', 'cancelled'] };
  } else if (view === 'scheduled') {
    serviceDateFilter = { $gte: todayBounds.start, $lte: rangeEnd };
    statusFilter = 'scheduled';
  } else if (view === 'next') {
    serviceDateFilter = { $gte: tomorrowBounds.start, $lte: tomorrowBounds.end };
    statusFilter = { $in: ['scheduled', 'sent_to_delivery'] };
  } else if (view === 'cancelled') {
    serviceDateFilter = { $gte: rangeStart, $lte: rangeEnd };
    statusFilter = { $in: ['cancelled', 'skipped'] };
  }

  const schedules = await FoodSubscriptionSchedule.find({
    restaurantId: new mongoose.Types.ObjectId(restaurantId),
    serviceDate: serviceDateFilter,
    status: statusFilter,
  })
    .populate('subscriptionId', 'customerName customerPhone deliveryAddress planTitle')
    .populate('userId', 'name phone email')
    .populate('orderId', 'order_id orderStatus dispatch pricing')
    .sort({ serviceDate: 1, mealName: 1, createdAt: 1 })
    .lean();

  return {
    schedules: schedules.map((schedule) => ({
      ...schedule,
      scheduleId: schedule._id?.toString?.() || String(schedule._id),
      subscription: schedule.subscriptionId || null,
      user: schedule.userId || null,
      order: schedule.orderId || null,
    })),
  };
}

export async function sendSubscriptionMealToDelivery(scheduleId, restaurantId) {
  if (!mongoose.isValidObjectId(scheduleId)) {
    throw new ValidationError('Subscription schedule id is invalid');
  }

  const schedule = await FoodSubscriptionSchedule.findOne({
    _id: new mongoose.Types.ObjectId(scheduleId),
    restaurantId: new mongoose.Types.ObjectId(restaurantId),
  });
  if (!schedule) throw new NotFoundError('Subscription meal not found');
  if (schedule.status === 'sent_to_delivery' && schedule.orderId) {
    const existingOrder = await FoodOrder.findById(schedule.orderId);
    if (!existingOrder) {
      schedule.status = 'scheduled';
      schedule.orderId = null;
      schedule.sentAt = null;
      await schedule.save();
    } else {
      const dispatchResult = await dispatchService.resendDeliveryNotificationRestaurant(
        existingOrder._id,
        restaurantId,
      );

      const refreshedOrder = await FoodOrder.findById(existingOrder._id);
      if (refreshedOrder) {
        schedule.sentAt = new Date();
        await schedule.save();
      }

      return {
        schedule,
        order: normalizeOrderForClient(refreshedOrder || existingOrder),
        alreadySent: true,
        resent: true,
        revivedDeadOrder: String(existingOrder.orderStatus || '').toLowerCase() === 'dead',
        dispatch: dispatchResult,
      };
    }
  }
  if (schedule.status !== 'scheduled') {
    throw new ValidationError(`Cannot send meal with status ${schedule.status}`);
  }

  const today = getDayBounds(new Date());
  if (new Date(schedule.serviceDate) > today.end) {
    throw new ValidationError('This subscription meal is not due yet');
  }

  const subscription = await FoodSubscription.findOne({
    _id: schedule.subscriptionId,
    restaurantId: new mongoose.Types.ObjectId(restaurantId),
    status: 'active',
    paymentStatus: 'paid',
  });
  if (!subscription) throw new ValidationError('Subscription is not active');
  if (!isSubscriptionActiveNow(subscription)) {
    throw new ValidationError('Subscription is not active for today');
  }

  const [restaurant, user, foodItem] = await Promise.all([
    FoodRestaurant.findById(restaurantId)
      .select('restaurantName zoneId location isAcceptingOrders status')
      .lean(),
    FoodUser.findById(subscription.userId).select('name phone email').lean(),
    mongoose.isValidObjectId(schedule.dishId || subscription.dishId)
      ? FoodItem.findById(schedule.dishId || subscription.dishId).lean()
      : null,
  ]);

  if (!restaurant) throw new ValidationError('Restaurant not found');
  if (restaurant.status !== 'approved' || restaurant.isAcceptingOrders === false) {
    throw new ValidationError('Restaurant is not accepting orders');
  }

  const deliveryAddress = normalizeDeliveryAddress(subscription.deliveryAddress, {
    customerName: subscription.customerName || user?.name || '',
    customerPhone: subscription.customerPhone || user?.phone || '',
  });
  if (!deliveryAddress.street || !deliveryAddress.city || !deliveryAddress.state) {
    throw new ValidationError('Subscription delivery address is incomplete');
  }

  const itemPrice = Math.max(
    0,
    Number(foodItem?.price || subscription.creditPerOrder || 0),
  );
  const creditPerOrder = Math.max(0, Number(subscription.creditPerOrder || itemPrice));
  const pricing = {
    subtotal: creditPerOrder,
    tax: 0,
    packagingFee: 0,
    deliveryFee: 0,
    platformFee: 0,
    restaurantCommission: 0,
    discount: 0,
    originalTotal: creditPerOrder,
    payableTotal: 0,
    subscriptionCreditApplied: creditPerOrder,
    subscriptionWalletCredit: 0,
    total: creditPerOrder,
    currency: subscription.currency || 'INR',
  };

  let distanceKm = null;
  if (
    restaurant.location?.coordinates?.length === 2 &&
    deliveryAddress.location?.coordinates?.length === 2
  ) {
    const [rLng, rLat] = restaurant.location.coordinates;
    const [dLng, dLat] = deliveryAddress.location.coordinates;
    const d = haversineKm(rLat, rLng, dLat, dLng);
    distanceKm = Number.isFinite(d) ? d : null;
  }

  const riderEarning = await getSubscriptionRiderEarning(distanceKm);
  const order = new FoodOrder({
    userId: subscription.userId,
    restaurantId: subscription.restaurantId,
    zoneId: restaurant.zoneId || undefined,
    items: [
      {
        itemId: String(schedule.dishId || subscription.dishId),
        name: schedule.dishName || subscription.dishName,
        price: itemPrice || creditPerOrder,
        quantity: 1,
        isVeg: String(foodItem?.foodType || '').toLowerCase() === 'veg',
        image: foodItem?.image || '',
        notes: `${schedule.mealName} subscription meal`,
      },
    ],
    deliveryAddress,
    customerName: subscription.customerName || user?.name || deliveryAddress.fullName || '',
    customerPhone: subscription.customerPhone || user?.phone || deliveryAddress.phone || '',
    pricing,
    payment: {
      method: 'subscription',
      status: 'paid',
      amountDue: 0,
      razorpay: {},
      qr: {},
    },
    subscriptionUsage: {
      subscriptionId: subscription._id,
      planId: subscription.planId || null,
      planTitle: subscription.planTitle,
      creditPerOrder,
      subscriptionCreditApplied: creditPerOrder,
      walletCreditAmount: 0,
      payableTotal: 0,
      status: 'applied',
      appliedAt: new Date(),
    },
    orderStatus: 'preparing',
    dispatch: { modeAtCreation: 'auto', status: 'unassigned' },
    statusHistory: [
      {
        at: new Date(),
        byRole: 'RESTAURANT',
        byId: new mongoose.Types.ObjectId(restaurantId),
        from: '',
        to: 'preparing',
        note: `Subscription meal sent to delivery${distanceKm != null ? ` (${distanceKm.toFixed(1)} km)` : ''}`,
      },
    ],
    note: `Subscription meal: ${schedule.mealName}`,
    restaurantNote: 'Created from subscription schedule',
    sendCutlery: true,
    deliveryFleet: 'standard',
    scheduledAt: schedule.serviceDate,
    riderEarning: Number.isFinite(riderEarning) ? Math.max(0, riderEarning) : 0,
    platformProfit: 0,
  });

  await order.save();
  await foodTransactionService.createInitialTransaction(order.toObject());

  await consumeSubscriptionCredit({
    subscriptionId: subscription._id,
    userId: subscription.userId,
    orderId: order._id,
    orderTotal: pricing.total,
  });

  schedule.status = 'sent_to_delivery';
  schedule.orderId = order._id;
  schedule.sentAt = new Date();
  await schedule.save();

  try {
    await FoodOrder.findByIdAndUpdate(order._id, {
      $set: {
        'dispatch.lastRequestedAt': new Date(),
      },
    });
    await dispatchService.tryAutoAssign(order._id, { attempt: 2 });
  } catch {
    // Keep the created order visible; dispatch timeout job can retry.
  }

  await notifyOwnersSafely(
    [{ ownerType: 'USER', ownerId: subscription.userId }],
    {
      title: 'Subscription meal is being prepared',
      body: `${schedule.dishName || subscription.dishName} is being sent for delivery.`,
      data: {
        type: 'subscription_meal_sent',
        orderId: String(order._id),
        orderMongoId: String(order._id),
      },
    },
  );

  enqueueOrderEvent('subscription_meal_sent_to_delivery', {
    subscriptionId: String(subscription._id),
    scheduleId: String(schedule._id),
    orderMongoId: String(order._id),
    restaurantId: String(restaurantId),
  });

  const refreshed = await FoodOrder.findById(order._id);
  return {
    schedule,
    order: normalizeOrderForClient(refreshed || order),
    alreadySent: false,
  };
}

export async function resendSubscriptionMealToDelivery(subscriptionId, restaurantId) {
  if (!mongoose.isValidObjectId(subscriptionId)) {
    throw new ValidationError('Subscription id is invalid');
  }
  if (!mongoose.isValidObjectId(restaurantId)) {
    throw new ValidationError('Restaurant id is invalid');
  }

  const schedule = await FoodSubscriptionSchedule.findOne({
    subscriptionId: new mongoose.Types.ObjectId(subscriptionId),
    restaurantId: new mongoose.Types.ObjectId(restaurantId),
    status: { $in: ['scheduled', 'sent_to_delivery'] },
  }).sort({ serviceDate: 1, createdAt: 1 });

  if (!schedule) {
    throw new NotFoundError('No subscription meal found to send');
  }

  return sendSubscriptionMealToDelivery(schedule._id, restaurantId);
}

export async function cancelSubscriptionForRestaurant(subscriptionId, restaurantId, reason = '') {
  if (!mongoose.isValidObjectId(subscriptionId)) {
    throw new ValidationError('Subscription id is invalid');
  }
  if (!mongoose.isValidObjectId(restaurantId)) {
    throw new ValidationError('Restaurant id is invalid');
  }

  const subscription = await FoodSubscription.findOne({
    _id: new mongoose.Types.ObjectId(subscriptionId),
    restaurantId: new mongoose.Types.ObjectId(restaurantId),
  });
  if (!subscription) throw new NotFoundError('Subscription not found');
  if (String(subscription.status || '').toLowerCase() === 'cancelled') {
    return { subscription: normalizeSubscriptionForClient(subscription), alreadyCancelled: true };
  }

  subscription.status = 'cancelled';
  subscription.cancelledAt = new Date();
  subscription.cancelReason = String(reason || '').trim();
  await subscription.save();

  await FoodSubscriptionSchedule.updateMany(
    {
      subscriptionId: subscription._id,
      restaurantId: new mongoose.Types.ObjectId(restaurantId),
      status: { $in: ['scheduled', 'sent_to_delivery'] },
    },
    {
      $set: {
        status: 'cancelled',
        cancelledAt: new Date(),
      },
    },
  );

  await notifyOwnersSafely(
    [{ ownerType: 'USER', ownerId: subscription.userId }],
    {
      title: 'Subscription cancelled',
      body: `${subscription.planTitle || subscription.dishName || 'Your subscription'} was cancelled by the restaurant.`,
      data: {
        type: 'subscription_cancelled',
        subscriptionId: String(subscription._id),
        restaurantId: String(restaurantId),
        reason: String(reason || '').trim(),
      },
    },
  );

  return { subscription: normalizeSubscriptionForClient(subscription), alreadyCancelled: false };
}

export async function listUpcomingSchedulesForUser(userId) {
  if (!mongoose.isValidObjectId(userId)) {
    throw new ValidationError('User not found');
  }

  const appSettings = await getAppCustomizationSettings();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 14);
  end.setHours(23, 59, 59, 999);

  const schedules = await FoodSubscriptionSchedule.find({
    userId: new mongoose.Types.ObjectId(userId),
    status: 'scheduled',
    serviceDate: { $gte: start, $lte: end },
  })
    .populate('subscriptionId', 'planTitle creditPerOrder deliveryAddress restaurantName')
    .sort({ serviceDate: 1, mealName: 1 })
    .lean();

  const restaurantIds = [
    ...new Set(schedules.map((schedule) => String(schedule.restaurantId || '')).filter(Boolean)),
  ];
  const dishes = restaurantIds.length
    ? await FoodItem.find({
        restaurantId: { $in: restaurantIds.map((id) => new mongoose.Types.ObjectId(id)) },
        approvalStatus: 'approved',
        isAvailable: true,
      })
        .select('restaurantId name price image foodType categoryName')
        .sort({ name: 1 })
        .lean()
    : [];

  const dishesByRestaurant = dishes.reduce((acc, dish) => {
    const key = String(dish.restaurantId);
    if (!acc[key]) acc[key] = [];
    acc[key].push(normalizeDishForClient(dish));
    return acc;
  }, {});

  const rows = await Promise.all(
    schedules.map(async (schedule) => {
      const window = await getDishChangeWindow(schedule, appSettings);
      const addressWindow = await getAddressChangeWindow(schedule, appSettings);
      return {
        ...schedule,
        scheduleId: schedule._id?.toString?.() || String(schedule._id),
        subscription: schedule.subscriptionId || null,
        orderAt: window.orderAt,
        dishChangeDeadline: window.deadline,
        canChangeDish: window.canChange,
        dishChangeLeadHours: window.leadHours,
        addressChangeDeadline: addressWindow.deadline,
        canChangeAddress: addressWindow.canChange,
        addressChangeLeadHours: addressWindow.leadHours,
        availableDishes: dishesByRestaurant[String(schedule.restaurantId)] || [],
      };
    }),
  );

  return {
    schedules: rows,
    timeManagement: appSettings.timeManagement,
  };
}

async function getScheduleForDishChange(scheduleId, userId) {
  if (!mongoose.isValidObjectId(scheduleId)) {
    throw new ValidationError('Subscription schedule id is invalid');
  }
  const schedule = await FoodSubscriptionSchedule.findOne({
    _id: new mongoose.Types.ObjectId(scheduleId),
    userId: new mongoose.Types.ObjectId(userId),
  });
  if (!schedule) throw new NotFoundError('Subscription schedule not found');
  if (schedule.status !== 'scheduled') {
    throw new ValidationError('This subscription meal can no longer be changed');
  }
  const appSettings = await getAppCustomizationSettings();
  const window = await getDishChangeWindow(schedule, appSettings);
  if (!window.canChange) {
    throw new ValidationError(
      `Dish changes close ${window.leadHours} hours before the subscription meal`,
    );
  }
  return { schedule, window };
}

export async function changeSubscriptionScheduleDish(userId, scheduleId, dto = {}) {
  if (!mongoose.isValidObjectId(userId)) throw new ValidationError('User not found');
  const { schedule, window } = await getScheduleForDishChange(scheduleId, userId);
  const newDishId = String(dto.dishId || '').trim();
  if (!mongoose.isValidObjectId(newDishId)) throw new ValidationError('Dish id is required');

  const [subscription, oldDish, newDish] = await Promise.all([
    FoodSubscription.findOne({
      _id: schedule.subscriptionId,
      userId: new mongoose.Types.ObjectId(userId),
      status: 'active',
      paymentStatus: 'paid',
    }),
    mongoose.isValidObjectId(schedule.dishId) ? FoodItem.findById(schedule.dishId).lean() : null,
    FoodItem.findOne({
      _id: new mongoose.Types.ObjectId(newDishId),
      restaurantId: schedule.restaurantId,
      approvalStatus: 'approved',
      isAvailable: true,
    }).lean(),
  ]);

  if (!subscription) throw new ValidationError('Subscription is not active');
  if (!newDish) throw new ValidationError('Selected dish is not available for this restaurant');
  if (String(schedule.dishId) === String(newDish._id)) {
    return {
      status: 'unchanged',
      schedule,
      adjustment: { priceDifference: 0, payableAmount: 0, walletCreditAmount: 0 },
    };
  }

  const oldPrice = Math.max(
    0,
    Number(oldDish?.price || schedule.dishChange?.newPrice || subscription.creditPerOrder || 0),
  );
  const newPrice = Math.max(0, Number(newDish.price || 0));
  const priceDifference = Number((newPrice - oldPrice).toFixed(2));
  const baseChange = {
    originalDishId: schedule.dishChange?.originalDishId || schedule.dishId,
    originalDishName: schedule.dishChange?.originalDishName || schedule.dishName,
    oldPrice,
    newPrice,
    priceDifference,
    changedAt: new Date(),
  };

  if (priceDifference > 0) {
    const amountPaise = Math.round(priceDifference * 100);
    const receipt = `sub_dish_${String(schedule._id).slice(-8)}_${Date.now()}`;
    const order = isRazorpayConfigured()
      ? await createRazorpayOrder(amountPaise, subscription.currency || 'INR', receipt)
      : { id: `order_dev_${Date.now()}`, amount: amountPaise, currency: subscription.currency || 'INR' };

    schedule.pendingDishChange = {
      dishId: String(newDish._id),
      dishName: newDish.name,
      oldPrice,
      newPrice,
      priceDifference,
      razorpayOrderId: String(order.id),
      createdAt: new Date(),
    };
    await schedule.save();

    return {
      status: 'payment_required',
      schedule,
      orderAt: window.orderAt,
      dishChangeDeadline: window.deadline,
      adjustment: {
        priceDifference,
        payableAmount: priceDifference,
        walletCreditAmount: 0,
      },
      razorpay: {
        key: getRazorpayKeyId() || 'rzp_test_dummy',
        orderId: String(order.id),
        amount: Number(order.amount) || amountPaise,
        currency: order.currency || subscription.currency || 'INR',
      },
    };
  }

  const walletCreditAmount = Math.abs(priceDifference);
  schedule.dishId = String(newDish._id);
  schedule.dishName = newDish.name;
  schedule.dishChange = {
    ...baseChange,
    walletCreditAmount,
    paidAmount: 0,
  };
  schedule.pendingDishChange = undefined;
  await schedule.save();

  if (walletCreditAmount > 0) {
    await userWalletService.refundWalletBalance(
      userId,
      walletCreditAmount,
      'Subscription dish change price difference',
      {
        source: 'subscription_dish_change',
        subscriptionId: subscription._id,
        scheduleId: schedule._id,
        oldDishId: baseChange.originalDishId,
        newDishId: newDish._id,
      },
    );
  }

  return {
    status: walletCreditAmount > 0 ? 'wallet_credited' : 'changed',
    schedule,
    adjustment: {
      priceDifference,
      payableAmount: 0,
      walletCreditAmount,
    },
  };
}

export async function verifySubscriptionDishChangePayment(userId, scheduleId, dto = {}) {
  if (!mongoose.isValidObjectId(userId)) throw new ValidationError('User not found');
  if (!mongoose.isValidObjectId(scheduleId)) {
    throw new ValidationError('Subscription schedule id is invalid');
  }
  const schedule = await FoodSubscriptionSchedule.findOne({
    _id: new mongoose.Types.ObjectId(scheduleId),
    userId: new mongoose.Types.ObjectId(userId),
    status: 'scheduled',
  });
  if (!schedule) throw new NotFoundError('Subscription schedule not found');
  const pending = schedule.pendingDishChange || {};
  if (!pending.razorpayOrderId || !pending.dishId) {
    throw new ValidationError('No pending dish change payment found');
  }

  const orderId = String(dto.razorpayOrderId || '').trim();
  const paymentId = String(dto.razorpayPaymentId || '').trim();
  const signature = String(dto.razorpaySignature || '').trim();
  if (orderId !== String(pending.razorpayOrderId)) {
    throw new ValidationError('Razorpay order mismatch');
  }
  if (!paymentId) throw new ValidationError('razorpayPaymentId is required');
  if (!signature) throw new ValidationError('razorpaySignature is required');

  const ok = isRazorpayConfigured() ? verifyPaymentSignature(orderId, paymentId, signature) : true;
  if (!ok) throw new ValidationError('Payment verification failed');

  const originalDishId = schedule.dishChange?.originalDishId || schedule.dishId;
  const originalDishName = schedule.dishChange?.originalDishName || schedule.dishName;
  schedule.dishId = pending.dishId;
  schedule.dishName = pending.dishName;
  schedule.dishChange = {
    originalDishId,
    originalDishName,
    oldPrice: pending.oldPrice,
    newPrice: pending.newPrice,
    priceDifference: pending.priceDifference,
    walletCreditAmount: 0,
    paidAmount: pending.priceDifference,
    changedAt: new Date(),
    razorpayOrderId: orderId,
    razorpayPaymentId: paymentId,
  };
  schedule.pendingDishChange = undefined;
  await schedule.save();

  return {
    status: 'changed',
    schedule,
    adjustment: {
      priceDifference: pending.priceDifference,
      payableAmount: pending.priceDifference,
      walletCreditAmount: 0,
    },
  };
}

export async function changeSubscriptionAddress(userId, subscriptionId, dto = {}) {
  if (!mongoose.isValidObjectId(userId)) throw new ValidationError('User not found');
  if (!mongoose.isValidObjectId(subscriptionId)) {
    throw new ValidationError('Subscription id is invalid');
  }

  const subscription = await FoodSubscription.findOne({
    _id: new mongoose.Types.ObjectId(subscriptionId),
    userId: new mongoose.Types.ObjectId(userId),
    status: 'active',
    paymentStatus: 'paid',
  });
  if (!subscription) throw new NotFoundError('Subscription not found');

  const nextSchedule = await FoodSubscriptionSchedule.findOne({
    subscriptionId: subscription._id,
    userId: subscription.userId,
    status: 'scheduled',
    serviceDate: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
  }).sort({ serviceDate: 1, mealName: 1 });

  if (!nextSchedule) {
    throw new ValidationError('No upcoming scheduled subscription meal found');
  }

  const appSettings = await getAppCustomizationSettings();
  const window = await getAddressChangeWindow(nextSchedule, appSettings);
  if (!window.canChange) {
    throw new ValidationError(
      `Address changes close ${window.leadHours} hours before the subscription meal`,
    );
  }

  const deliveryAddress = normalizeDeliveryAddress(dto.deliveryAddress, {
    customerName: subscription.customerName,
    customerPhone: subscription.customerPhone,
  });
  if (!deliveryAddress.street || !deliveryAddress.city || !deliveryAddress.state) {
    throw new ValidationError('Delivery address is incomplete');
  }

  subscription.deliveryAddress = deliveryAddress;
  if (deliveryAddress.phone) subscription.customerPhone = deliveryAddress.phone;
  if (deliveryAddress.fullName || deliveryAddress.name) {
    subscription.customerName = deliveryAddress.fullName || deliveryAddress.name;
  }
  await subscription.save();

  return {
    subscription: normalizeSubscriptionForClient(subscription),
    nextScheduleId: String(nextSchedule._id),
    addressChangeDeadline: window.deadline,
    addressChangeLeadHours: window.leadHours,
  };
}

export async function syncSubscriptionScheduleReminders() {
  const appSettings = await getAppCustomizationSettings();
  const now = new Date();
  const maxLeadHours = Math.max(
    Number(appSettings.timeManagement?.dishChangeLeadHours || 24),
    Number(appSettings.timeManagement?.addressChangeLeadHours || 3),
  );
  const rangeEnd = new Date(now.getTime() + (maxLeadHours + 2) * 60 * 60 * 1000);
  const schedules = await FoodSubscriptionSchedule.find({
    status: 'scheduled',
    serviceDate: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000), $lte: rangeEnd },
    $or: [
      { dishChangeReminderSentAt: null },
      { dishChangeReminderSentAt: { $exists: false } },
      { addressChangeReminderSentAt: null },
      { addressChangeReminderSentAt: { $exists: false } },
    ],
  }).limit(200);

  for (const schedule of schedules) {
    const orderAt = await getMealOrderAt(schedule);
    const dishNotifyAt = new Date(
      orderAt.getTime() - Number(appSettings.timeManagement?.dishChangeLeadHours || 24) * 60 * 60 * 1000,
    );
    const addressNotifyAt = new Date(
      orderAt.getTime() - Number(appSettings.timeManagement?.addressChangeLeadHours || 3) * 60 * 60 * 1000,
    );
    const updates = {};

    if (!schedule.dishChangeReminderSentAt && now >= dishNotifyAt && now < orderAt) {
      await notifyOwnersSafely(
        [{ ownerType: 'USER', ownerId: schedule.userId }],
        {
          title: 'Change your subscription dish',
          body: `You can change ${schedule.mealName || 'your meal'} before the cut-off time.`,
          data: {
            type: 'subscription_dish_change_reminder',
            scheduleId: String(schedule._id),
            subscriptionId: String(schedule.subscriptionId),
            link: '/food/user/profile/subscriptions/' + String(schedule.subscriptionId) + '/change-dish/' + String(schedule._id),
            targetUrl: '/food/user/profile/subscriptions/' + String(schedule.subscriptionId) + '/change-dish/' + String(schedule._id),
          },
        },
      );
      updates.dishChangeReminderSentAt = now;
    }

    if (!schedule.addressChangeReminderSentAt && now >= addressNotifyAt && now < orderAt) {
      await notifyOwnersSafely(
        [{ ownerType: 'USER', ownerId: schedule.userId }],
        {
          title: 'Confirm your delivery address',
          body: `Please update your address if needed for ${schedule.mealName || 'your subscription meal'}.`,
          data: {
            type: 'subscription_address_change_reminder',
            scheduleId: String(schedule._id),
            subscriptionId: String(schedule.subscriptionId),
            link: '/food/user/profile/subscriptions/' + String(schedule.subscriptionId),
            targetUrl: '/food/user/profile/subscriptions/' + String(schedule.subscriptionId),
          },
        },
      );
      updates.addressChangeReminderSentAt = now;
    }

    if (Object.keys(updates).length) {
      await FoodSubscriptionSchedule.updateOne({ _id: schedule._id }, { $set: updates });
    }
  }

  return { checked: schedules.length };
}

export async function sendTestSubscriptionReminder(type = 'dish') {
  const reminderType = String(type || 'dish').toLowerCase() === 'address' ? 'address' : 'dish';
  const now = new Date();
  const rangeEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const schedule = await FoodSubscriptionSchedule.findOne({
    status: 'scheduled',
    serviceDate: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000), $lte: rangeEnd },
  }).sort({ serviceDate: 1, mealName: 1 });

  if (!schedule) {
    throw new ValidationError('No upcoming scheduled subscription meal found for test notification');
  }

  const payload =
    reminderType === 'address'
      ? {
          title: 'Test: Confirm your delivery address',
          body: `Test reminder: update your address if needed for ${schedule.mealName || 'your subscription meal'}.`,
          data: {
            type: 'subscription_address_change_reminder_test',
            scheduleId: String(schedule._id),
            subscriptionId: String(schedule.subscriptionId),
            link: '/food/user/profile/subscriptions/' + String(schedule.subscriptionId),
            targetUrl: '/food/user/profile/subscriptions/' + String(schedule.subscriptionId),
          },
        }
      : {
          title: 'Test: Change your subscription dish',
          body: `Test reminder: you can change ${schedule.mealName || 'your meal'} before the cut-off time.`,
          data: {
            type: 'subscription_dish_change_reminder_test',
            scheduleId: String(schedule._id),
            subscriptionId: String(schedule.subscriptionId),
            link: '/food/user/profile/subscriptions/' + String(schedule.subscriptionId) + '/change-dish/' + String(schedule._id),
            targetUrl: '/food/user/profile/subscriptions/' + String(schedule.subscriptionId) + '/change-dish/' + String(schedule._id),
          },
        };

  const resultsRaw = await notifyOwnersSafely([{ ownerType: 'USER', ownerId: schedule.userId }], payload);
  const results = Array.isArray(resultsRaw)
    ? resultsRaw
    : [resultsRaw].filter(Boolean);
  const successCount = results.reduce((sum, item) => sum + Number(item?.successCount || 0), 0);
  const failureCount = results.reduce((sum, item) => sum + Number(item?.failureCount || 0), 0);

  return {
    sent: successCount > 0,
    type: reminderType,
    scheduleId: String(schedule._id),
    userId: String(schedule.userId),
    successCount,
    failureCount,
    results,
  };
}

export async function listSubscriptionsForUser(userId) {
  const subscriptions = await FoodSubscription.find({
    userId: new mongoose.Types.ObjectId(userId),
  })
    .sort({ createdAt: -1 })
    .lean();

  return {
    subscriptions: subscriptions.map((subscription) =>
      normalizeSubscriptionForClient(subscription),
    ),
  };
}

function getSubscriptionDateStatus(subscription) {
  const rawStatus = String(subscription?.status || '').toLowerCase();
  const paymentStatus = String(subscription?.paymentStatus || '').toLowerCase();
  const now = new Date();

  if (rawStatus === 'active' && subscription?.endDate && new Date(subscription.endDate) < now) {
    return 'expired';
  }
  if (rawStatus === 'pending_payment' || paymentStatus === 'created' || paymentStatus === 'authenticated') {
    return 'pending';
  }
  if (rawStatus === 'payment_failed' || paymentStatus === 'failed') {
    return 'payment_failed';
  }
  return rawStatus || 'pending';
}

function getSubscriptionOrderType(planDays) {
  const days = Number(planDays || 0);
  if (days >= 28) return 'Monthly';
  if (days >= 7) return 'Weekly';
  return 'Daily';
}

function normalizeSubscriptionForAdmin(subscription, scheduleSummary = {}) {
  const normalized = normalizeSubscriptionForClient(subscription);
  const status = getSubscriptionDateStatus(subscription);
  const totalOrders = Math.max(0, Number(scheduleSummary.total || normalized.totalCredits || 0));
  const delivered = Math.max(0, Number(scheduleSummary.sent_to_delivery || normalized.usedCredits || 0));
  const restaurant =
    subscription?.restaurantId && typeof subscription.restaurantId === 'object'
      ? subscription.restaurantId.restaurantName || subscription.restaurantName || ''
      : subscription?.restaurantName || '';
  const customer =
    subscription?.userId && typeof subscription.userId === 'object'
      ? subscription.userId
      : null;

  return {
    ...normalized,
    id: normalized.subscriptionId,
    subscriptionId: normalized.subscriptionId,
    shortId: `SUB-${String(normalized.subscriptionId).slice(-6).toUpperCase()}`,
    orderType: getSubscriptionOrderType(subscription?.planDays),
    duration: `${Number(subscription?.planDays || 0)} days`,
    restaurant,
    restaurantId:
      subscription?.restaurantId?._id?.toString?.() ||
      subscription?.restaurantId?.toString?.() ||
      '',
    customerName: subscription?.customerName || customer?.name || '',
    customerPhone: subscription?.customerPhone || customer?.phone || '',
    customerEmail: customer?.email || '',
    planTitle: subscription?.planTitle || '',
    status,
    statusLabel: status
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' '),
    paymentStatus: subscription?.paymentStatus || '',
    totalOrders,
    delivered,
    scheduled: Math.max(0, Number(scheduleSummary.scheduled || 0)),
    skipped: Math.max(0, Number(scheduleSummary.skipped || 0)),
    cancelled: Math.max(0, Number(scheduleSummary.cancelled || 0)),
    totalAmount: Number(subscription?.totalAmount || 0),
    currency: subscription?.currency || 'INR',
    meals: Array.isArray(subscription?.meals) ? subscription.meals : [],
    deliveryAddress: subscription?.deliveryAddress || null,
    createdAt: subscription?.createdAt || null,
    startDate: subscription?.startDate || null,
    endDate: subscription?.endDate || null,
  };
}

async function getScheduleSummaries(subscriptionIds = []) {
  if (!subscriptionIds.length) return new Map();
  const rows = await FoodSubscriptionSchedule.aggregate([
    { $match: { subscriptionId: { $in: subscriptionIds } } },
    {
      $group: {
        _id: { subscriptionId: '$subscriptionId', status: '$status' },
        count: { $sum: 1 },
      },
    },
  ]);

  const summaryMap = new Map();
  rows.forEach((row) => {
    const id = String(row._id.subscriptionId);
    const status = String(row._id.status || 'unknown');
    const current = summaryMap.get(id) || { total: 0 };
    current[status] = Number(row.count || 0);
    current.total += Number(row.count || 0);
    summaryMap.set(id, current);
  });
  return summaryMap;
}

export async function listSubscriptionsAdmin(query = {}) {
  const { page, limit, skip } = buildPaginationOptions(query);
  const filter = {};
  const status = String(query.status || '').trim().toLowerCase();
  const restaurantId = String(query.restaurantId || '').trim();
  const search = String(query.search || '').trim();

  if (status && status !== 'all' && status !== 'expired') {
    filter.status = status;
  }
  if (restaurantId && mongoose.isValidObjectId(restaurantId)) {
    filter.restaurantId = new mongoose.Types.ObjectId(restaurantId);
  }
  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { dishName: regex },
      { restaurantName: regex },
      { customerName: regex },
      { customerPhone: regex },
      { planTitle: regex },
      { razorpaySubscriptionId: regex },
      { razorpayOrderId: regex },
    ];
    if (mongoose.isValidObjectId(search)) {
      filter.$or.push({ _id: new mongoose.Types.ObjectId(search) });
    }
  }

  const [docs, total, statsRows] = await Promise.all([
    FoodSubscription.find(filter)
      .populate('userId', 'name phone email')
      .populate('restaurantId', 'restaurantName area city ownerPhone')
      .populate('planId', 'title durationDays amount currency')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    FoodSubscription.countDocuments(filter),
    FoodSubscription.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          amount: { $sum: '$totalAmount' },
        },
      },
    ]),
  ]);

  const scheduleSummaries = await getScheduleSummaries(docs.map((doc) => doc._id));
  let rows = docs.map((doc) =>
    normalizeSubscriptionForAdmin(doc, scheduleSummaries.get(String(doc._id)) || {}),
  );

  if (status === 'expired') {
    rows = rows.filter((row) => row.status === 'expired');
  }

  const stats = statsRows.reduce(
    (acc, row) => {
      const key = String(row._id || 'unknown');
      acc.byStatus[key] = Number(row.count || 0);
      acc.total += Number(row.count || 0);
      acc.totalAmount += Number(row.amount || 0);
      return acc;
    },
    { total: 0, totalAmount: 0, byStatus: {} },
  );

  const paginated = buildPaginatedResult({ docs: rows, total, page, limit });
  return { ...paginated, subscriptions: paginated.data, stats };
}

export async function getSubscriptionAdmin(subscriptionId) {
  if (!mongoose.isValidObjectId(subscriptionId)) {
    throw new ValidationError('Subscription id is invalid');
  }

  const subscription = await FoodSubscription.findById(subscriptionId)
    .populate('userId', 'name phone email')
    .populate('restaurantId', 'restaurantName area city ownerPhone')
    .populate('planId', 'title durationDays amount currency')
    .lean();

  if (!subscription) throw new NotFoundError('Subscription not found');

  const schedules = await FoodSubscriptionSchedule.find({
    subscriptionId: new mongoose.Types.ObjectId(subscriptionId),
  })
    .populate('orderId', 'order_id orderStatus payment pricing createdAt')
    .sort({ serviceDate: 1, mealName: 1 })
    .lean();

  const scheduleSummary = schedules.reduce((acc, schedule) => {
    const status = String(schedule.status || 'unknown');
    acc[status] = Number(acc[status] || 0) + 1;
    acc.total += 1;
    return acc;
  }, { total: 0 });

  return {
    subscription: normalizeSubscriptionForAdmin(subscription, scheduleSummary),
    schedules: schedules.map((schedule) => ({
      ...schedule,
      scheduleId: schedule._id?.toString?.() || String(schedule._id || ''),
    })),
  };
}

