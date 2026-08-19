import { createSlice } from '@reduxjs/toolkit'
import { normalizeUserLocationForStorage, writeUserLocationToStorage } from '../../core/storage/localStorage.js'

const initialState = {
  isLocationResolved: false,
  coords: null, // { latitude, longitude }
  zoneId: null,
  address: null,
}

const getMergedStoredLocation = (coords, address) => {
  let existing = {};

  try {
    const raw = localStorage.getItem('userLocation');
    existing = raw ? JSON.parse(raw) || {} : {};
  } catch {
    existing = {};
  }

  const latitude = Number(coords?.latitude);
  const longitude = Number(coords?.longitude);

  return {
    ...existing,
    ...(Number.isFinite(latitude) ? { latitude } : {}),
    ...(Number.isFinite(longitude) ? { longitude } : {}),
    ...(address ? { address, formattedAddress: address } : {}),
  };
};

const locationSlice = createSlice({
  name: 'location',
  initialState,
  reducers: {
    setLocation: (state, action) => {
      const { coords, zoneId, address } = action.payload;
      state.coords = coords;
      state.zoneId = zoneId;
      state.address = address;
      state.isLocationResolved = true;
      
      // Sync to local storage using the canonical location object.
      if (zoneId) {
        localStorage.setItem('userZoneId', zoneId);
      }
      if (coords?.latitude && coords?.longitude) {
        writeUserLocationToStorage(normalizeUserLocationForStorage(getMergedStoredLocation(coords, address)));
      }
    },
    clearLocation: (state) => {
      state.coords = null;
      state.zoneId = null;
      state.address = null;
      state.isLocationResolved = false;
      localStorage.removeItem('userZoneId');
      localStorage.removeItem('userLat');
      localStorage.removeItem('userLng');
      localStorage.removeItem('userLocation');
    }
  },
})

export const { setLocation, clearLocation } = locationSlice.actions
export default locationSlice.reducer
