# Storage Plan

## Current production-safe ownership

- `cookie`
  - `refreshToken`
  - Owner: backend only
  - Rule: `HttpOnly`, `Secure`, `SameSite`, never read in browser JS

- `sessionStorage`
  - `*_accessToken_session`
  - OTP/auth flow drafts such as `userAuthData`, `restaurantAuthData`, `deliveryAuthData`
  - Delivery signup drafts: `deliverySignupDetails`, `deliverySignupDocs`, `deliveryNeedsRegistration`
  - Rule: short-lived, tab-scoped, cleared on flow completion/logout

- `localStorage`
  - Durable UI preferences only
  - Examples: theme, search history, dismissed prompts, selected tabs, notification sound flags
  - Rule: no secrets, no refresh tokens, avoid storing mutable server truth

- `IndexedDB`
  - Public response cache
  - Large file/blob drafts for onboarding and signup flows
  - Rule: use for structured cached data and uploads, not auth/session state

- `Redis / server cache`
  - Shared GET response cache
  - Rule: backend-owned only

## What phase 1 changed

- Moved delivery auth/signup flow state to `sessionStorage`
- Stopped reading legacy browser refresh-token keys during logout
- Made request location headers prefer canonical `userLocation`
- Stopped writing fresh `userLat` / `userLng` duplicates from the Redux location slice

## Current duplicates still to clean

- `user_user` and `userProfile`
- `delivery_online_status`, `delivery-v2-online-pref`, and `delivery_gig_storage`
- `auth-storage` versus the token/session store
- `userZoneId` and `userZone` versus the richer `userLocation`
- Several legacy direct reads of `*_accessToken` keys still exist in UI modules

## Next phases

1. Consolidate auth reads so UI uses token/session utilities instead of legacy `localStorage` token keys.
2. Choose one persisted delivery online-state owner and remove the others.
3. Choose one user-profile cache key and remove the duplicate writes.
4. Audit `localStorage` domain data and move long-lived server truth back to API-backed state where possible.
