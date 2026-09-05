export function formatRestaurantId(id) {
  if (!id) return 'REST000000'
  const value = String(id)
  const parts = value.split(/[-.]/)
  const digits = parts.at(-1).match(/\d+/g) || parts.join('').match(/\d+/g)
  const suffix = digits
    ? digits.join('').slice(-6).padStart(6, '0')
    : Math.abs([...value].reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0))
        .toString().slice(-6).padStart(6, '0')
  return `REST${suffix}`
}

export function matchesRestaurantSearch(restaurant, search) {
  const query = String(search || '').trim().toLowerCase()
  if (!query) return true
  const ids = [restaurant.restaurantId, restaurant.restaurantCode, restaurant._id, restaurant.id]
    .filter(Boolean).map(String)
  const idQuery = query.replace(/^#\s*/, '')
  return [restaurant.name, restaurant.restaurantName]
    .some(name => String(name || '').toLowerCase().includes(query)) ||
    ids.some(id => id.toLowerCase().includes(idQuery) || formatRestaurantId(id).toLowerCase().includes(idQuery))
}
