export const toAmountNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export const getOrderAmountBreakdown = (orderLike = {}) => {
  const pricing = orderLike?.pricing || {}

  const subtotal = toAmountNumber(pricing.subtotal ?? orderLike.subtotal)
  const originalItemTotal = toAmountNumber(pricing.originalItemTotal)
  const packagingFee = toAmountNumber(pricing.packagingFee ?? orderLike.packagingFee)
  const deliveryFee = toAmountNumber(pricing.deliveryFee ?? orderLike.deliveryFee)
  const platformFee = toAmountNumber(pricing.platformFee ?? orderLike.platformFee)
  const subscriptionFee = toAmountNumber(pricing.subscriptionFee ?? orderLike.subscriptionFee)
  const tax = toAmountNumber(
    pricing.tax ?? pricing.gst ?? orderLike.tax ?? orderLike.gst,
  )
  const couponDiscount = toAmountNumber(pricing.discount ?? orderLike.discount)
  const itemLevelDiscount = Math.max(0, originalItemTotal - subtotal)
  const discount = couponDiscount + itemLevelDiscount

  const fallbackTotal = Math.max(
    0,
    subtotal +
      packagingFee +
      deliveryFee +
      platformFee +
      subscriptionFee +
      tax -
      couponDiscount,
  )

  const total = (() => {
    const backendTotal = toAmountNumber(
      pricing.total ?? orderLike.totalAmount ?? orderLike.total,
    )
    return backendTotal > 0 ? backendTotal : fallbackTotal
  })()

  return {
    subtotal,
    originalItemTotal,
    packagingFee,
    deliveryFee,
    platformFee,
    subscriptionFee,
    tax,
    gst: tax,
    couponDiscount,
    itemLevelDiscount,
    discount,
    total,
    totalAmount: total,
  }
}

export const applyOrderAmountBreakdown = (orderLike = {}) => ({
  ...orderLike,
  ...getOrderAmountBreakdown(orderLike),
})
