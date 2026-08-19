export const writeArrayStorage = (key, value) => {
  if (typeof localStorage === "undefined") return;

  if (!Array.isArray(value) || value.length === 0) {
    localStorage.removeItem(key);
    return;
  }

  localStorage.setItem(key, JSON.stringify(value));
};

export const normalizeUserLocationForStorage = (location) => {
  if (!location || typeof location !== "object") return null;

  const { lat, lng, ...rest } = location;
  const latitude = Number(rest.latitude ?? lat);
  const longitude = Number(rest.longitude ?? lng);

  return {
    ...rest,
    ...(Number.isFinite(latitude) ? { latitude } : {}),
    ...(Number.isFinite(longitude) ? { longitude } : {}),
  };
};

export const writeUserLocationToStorage = (location) => {
  if (typeof localStorage === "undefined") return;

  const normalizedLocation = normalizeUserLocationForStorage(location);
  if (!normalizedLocation) {
    localStorage.removeItem("userLocation");
    localStorage.removeItem("userLat");
    localStorage.removeItem("userLng");
    return;
  }

  localStorage.setItem("userLocation", JSON.stringify(normalizedLocation));
  localStorage.removeItem("userLat");
  localStorage.removeItem("userLng");
};
