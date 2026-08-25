import { useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Upload,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@food/components/ui/dialog"
import { Input } from "@food/components/ui/input"
import { Label } from "@food/components/ui/label"
import { Button } from "@food/components/ui/button"
import { adminAPI, uploadAPI } from "@food/api"
import { getGoogleMapsApiKey } from "@food/utils/googleMapsApiKey"
import { EMAIL_REGEX } from "@/shared/utils/emailValidation"

const cuisinesOptions = [
  "North Indian",
  "South Indian",
  "Chinese",
  "Pizza",
  "Burgers",
  "Bakery",
  "Cafe",
]

const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const PHONE_REGEX = /^\d{10}$/
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/
const FSSAI_REGEX = /^\d{14}$/
const ACCOUNT_NUMBER_REGEX = /^\d{9,18}$/
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const NAME_REGEX = /^[A-Za-z][A-Za-z\s.'-]*$/

const sanitizeDigits = (value = "") => value.replace(/\D/g, "")
const sanitizePan = (value = "") => value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)
const sanitizeFssai = (value = "") => value.replace(/\D/g, "").slice(0, 14)
const sanitizeIfsc = (value = "") => value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11)
const sanitizeGst = (value = "") => value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15)
const normalizeName = (value = "") => value.replace(/\s+/g, " ").trimStart()
const hasLetters = (value = "") => /[A-Za-z]/.test(value)
const getTodayLocalYMD = () => new Date().toISOString().split("T")[0]

const timeStringToMinutes = (value = "") => {
  const raw = String(value || "").trim()
  if (!/^\d{2}:\d{2}$/.test(raw)) return null
  const [hours, minutes] = raw.split(":").map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return hours * 60 + minutes
}

const normalizeZoneId = (zoneId) => {
  if (!zoneId) return ""
  if (typeof zoneId === "string") return zoneId
  return zoneId?._id || zoneId?.id || ""
}

const getStoredFileLabel = (value) => {
  if (!value) return ""
  if (value instanceof File) return value.name
  if (typeof value === "string") return value.split("/").pop() || "Uploaded file"
  if (value?.url) return value.url.split("/").pop() || "Uploaded file"
  return "Uploaded file"
}

const getStoredImageSrc = (value) => {
  if (!value) return ""
  if (value instanceof File) return URL.createObjectURL(value)
  if (typeof value === "string") return value
  if (value?.url) return value.url
  return ""
}

const toMediaValue = (value) => {
  if (!value) return null
  if (typeof value === "string") return value.trim() ? { url: value.trim() } : null
  if (value?.url) return { url: value.url, publicId: value.publicId || "" }
  return null
}

const normalizeMenuImages = (images) =>
  Array.isArray(images) ? images.map(toMediaValue).filter(Boolean) : []

const loadGooglePlaces = async () => {
  if (window.google?.maps?.places?.Autocomplete) return true
  const apiKey = await getGoogleMapsApiKey()
  if (!apiKey) return false

  const existing = document.getElementById("admin-edit-google-maps-script")
  if (existing) {
    await new Promise((resolve, reject) => {
      if (window.google?.maps?.places?.Autocomplete) {
        resolve()
        return
      }
      existing.addEventListener("load", resolve, { once: true })
      existing.addEventListener("error", reject, { once: true })
    })
    return !!window.google?.maps?.places?.Autocomplete
  }

  await new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.id = "admin-edit-google-maps-script"
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly`
    script.async = true
    script.defer = true
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })

  return !!window.google?.maps?.places?.Autocomplete
}

const buildStep1FromRestaurant = (restaurant) => {
  const location = restaurant?.location || {}
  return {
    restaurantName: restaurant?.restaurantName || restaurant?.name || "",
    pureVegRestaurant:
      typeof restaurant?.pureVegRestaurant === "boolean" ? restaurant.pureVegRestaurant : null,
    ownerName: restaurant?.ownerName || "",
    ownerEmail: restaurant?.ownerEmail || "",
    ownerPhone: restaurant?.ownerPhone || "",
    primaryContactNumber: restaurant?.primaryContactNumber || "",
    zoneId: normalizeZoneId(restaurant?.zoneId),
    location: {
      addressLine1: location?.addressLine1 || "",
      addressLine2: location?.addressLine2 || "",
      area: location?.area || "",
      city: location?.city || "",
      state: location?.state || "",
      pincode: location?.pincode || "",
      landmark: location?.landmark || "",
      formattedAddress: location?.formattedAddress || location?.address || "",
      latitude: location?.latitude ?? "",
      longitude: location?.longitude ?? "",
    },
  }
}

const buildStep2FromRestaurant = (restaurant) => ({
  menuImages: normalizeMenuImages(restaurant?.menuImages),
  profileImage: toMediaValue(restaurant?.profileImage),
  cuisines: Array.isArray(restaurant?.cuisines) ? restaurant.cuisines : [],
  estimatedDeliveryTime:
    restaurant?.estimatedDeliveryTime || restaurant?.estimatedDeliveryTimeMinutes || "",
  openingTime: restaurant?.openingTime || "",
  closingTime: restaurant?.closingTime || "",
  openDays: Array.isArray(restaurant?.openDays) ? restaurant.openDays : [],
})

const buildStep3FromRestaurant = (restaurant) => ({
  panNumber: restaurant?.panNumber || "",
  nameOnPan: restaurant?.nameOnPan || "",
  panImage: toMediaValue(restaurant?.panImage),
  gstRegistered: !!restaurant?.gstRegistered,
  gstNumber: restaurant?.gstNumber || "",
  gstLegalName: restaurant?.gstLegalName || "",
  gstAddress: restaurant?.gstAddress || "",
  gstImage: toMediaValue(restaurant?.gstImage),
  fssaiNumber: restaurant?.fssaiNumber || "",
  fssaiExpiry: restaurant?.fssaiExpiry ? String(restaurant.fssaiExpiry).slice(0, 10) : "",
  fssaiImage: toMediaValue(restaurant?.fssaiImage),
  accountNumber: restaurant?.accountNumber || "",
  confirmAccountNumber: restaurant?.accountNumber || "",
  ifscCode: restaurant?.ifscCode || "",
  accountHolderName: restaurant?.accountHolderName || "",
  accountType: restaurant?.accountType || "",
})

export default function EditRestaurant() {
  const { id } = useParams()
  const navigate = useNavigate()
  const mainContentRef = useRef(null)
  const locationSearchInputRef = useRef(null)
  const placesAutocompleteRef = useRef(null)

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [formErrors, setFormErrors] = useState({})
  const [zones, setZones] = useState([])
  const [zonesLoading, setZonesLoading] = useState(false)
  const [restaurantName, setRestaurantName] = useState("")
  const [locationSearchValue, setLocationSearchValue] = useState("")
  const [locationSuggestions, setLocationSuggestions] = useState([])
  const [isSearchingLocation, setIsSearchingLocation] = useState(false)

  const [step1, setStep1] = useState(buildStep1FromRestaurant(null))
  const [step2, setStep2] = useState(buildStep2FromRestaurant(null))
  const [step3, setStep3] = useState(buildStep3FromRestaurant(null))

  useEffect(() => {
    const contentEl = mainContentRef.current
    if (contentEl?.scrollTo) contentEl.scrollTo({ top: 0, behavior: "auto" })
    if (typeof window !== "undefined" && window.scrollTo) window.scrollTo({ top: 0, behavior: "auto" })
  }, [step])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        setLoading(true)
        setZonesLoading(true)
        const [restaurantRes, zonesRes] = await Promise.all([
          adminAPI.getRestaurantById(id),
          adminAPI.getZones({ limit: 1000 }),
        ])

        const restaurant =
          restaurantRes?.data?.data?.restaurant ||
          restaurantRes?.data?.data ||
          null

        const zoneList =
          zonesRes?.data?.data?.zones ||
          zonesRes?.data?.data?.data?.zones ||
          zonesRes?.data?.data ||
          []

        if (!mounted) return
        if (!restaurant) {
          setFormErrors({ submit: "Restaurant not found" })
          return
        }

        setRestaurantName(restaurant?.restaurantName || restaurant?.name || "")
        setStep1(buildStep1FromRestaurant(restaurant))
        setStep2(buildStep2FromRestaurant(restaurant))
        setStep3(buildStep3FromRestaurant(restaurant))
        setLocationSearchValue(
          restaurant?.location?.formattedAddress ||
            restaurant?.location?.address ||
            restaurant?.location?.addressLine1 ||
            ""
        )
        setZones(Array.isArray(zoneList) ? zoneList : [])
      } catch (error) {
        if (!mounted) return
        setFormErrors({
          submit: error?.response?.data?.message || "Failed to load restaurant details",
        })
      } finally {
        if (!mounted) return
        setLoading(false)
        setZonesLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [id])

  useEffect(() => {
    if (step !== 1) return
    if (!locationSearchInputRef.current) return
    if (placesAutocompleteRef.current) return

    let cancelled = false

    const init = async () => {
      const loaded = await loadGooglePlaces()
      if (cancelled || !loaded || !window.google?.maps?.places?.Autocomplete) return

      const autocomplete = new window.google.maps.places.Autocomplete(locationSearchInputRef.current, {
        fields: ["formatted_address", "address_components", "geometry"],
        componentRestrictions: { country: "in" },
      })

      const getAddressPart = (parts, types) =>
        parts.find((entry) => types.some((type) => entry.types?.includes(type)))?.long_name || ""

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace()
        const comps = Array.isArray(place?.address_components) ? place.address_components : []
        const lat = place?.geometry?.location?.lat?.()
        const lng = place?.geometry?.location?.lng?.()
        const formattedAddress = place?.formatted_address || ""

        setStep1((prev) => ({
          ...prev,
          location: {
            ...prev.location,
            formattedAddress: formattedAddress || prev.location.formattedAddress,
            addressLine1: formattedAddress || prev.location.addressLine1,
            area:
              getAddressPart(comps, ["sublocality_level_1", "sublocality", "neighborhood"]) ||
              getAddressPart(comps, ["locality"]) ||
              prev.location.area,
            city:
              getAddressPart(comps, ["locality"]) ||
              getAddressPart(comps, ["administrative_area_level_2"]) ||
              prev.location.city,
            state: getAddressPart(comps, ["administrative_area_level_1"]) || prev.location.state,
            pincode: getAddressPart(comps, ["postal_code"]) || prev.location.pincode,
            latitude: Number.isFinite(lat) ? Number(lat.toFixed(6)) : prev.location.latitude,
            longitude: Number.isFinite(lng) ? Number(lng.toFixed(6)) : prev.location.longitude,
          },
        }))
        setLocationSearchValue(formattedAddress)
        setLocationSuggestions([])
      })

      placesAutocompleteRef.current = autocomplete
    }

    init()
    return () => {
      cancelled = true
    }
  }, [step])

  useEffect(() => {
    if (step !== 1) return
    const query = String(locationSearchValue || "").trim()
    if (query.length < 3) {
      setLocationSuggestions([])
      setIsSearchingLocation(false)
      return
    }

    const timeoutId = setTimeout(async () => {
      try {
        setIsSearchingLocation(true)
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(query)}&countrycodes=in`
        const response = await fetch(url, { headers: { Accept: "application/json" } })
        const json = await response.json()
        const mapped = (Array.isArray(json) ? json : []).map((result) => ({
          id: result.place_id,
          display: result.display_name || "",
          lat: Number(result.lat),
          lng: Number(result.lon),
          addr: result.address || {},
        }))
        setLocationSuggestions(mapped)
      } catch {
        setLocationSuggestions([])
      } finally {
        setIsSearchingLocation(false)
      }
    }, 350)

    return () => clearTimeout(timeoutId)
  }, [locationSearchValue, step])

  const handleUpload = async (file, folder) => {
    const response = await uploadAPI.uploadMedia(file, { folder })
    const data = response?.data?.data || response?.data
    return { url: data?.url, publicId: data?.publicId || "" }
  }

  const validateStep1 = () => {
    const errors = []
    if (!step1.restaurantName?.trim()) errors.push("Restaurant name is required")
    if (typeof step1.pureVegRestaurant !== "boolean") errors.push("Please select whether restaurant is pure veg")
    if (!step1.ownerName?.trim()) errors.push("Owner name is required")
    if (step1.ownerName?.trim() && (!NAME_REGEX.test(step1.ownerName.trim()) || !hasLetters(step1.ownerName))) {
      errors.push("Owner name must contain valid characters")
    }
    if (!step1.ownerEmail?.trim()) errors.push("Owner email is required")
    if (step1.ownerEmail?.trim() && !EMAIL_REGEX.test(step1.ownerEmail.trim())) {
      errors.push("Please enter a valid owner email")
    }
    if (!step1.ownerPhone?.trim()) errors.push("Owner phone number is required")
    if (step1.ownerPhone?.trim() && !PHONE_REGEX.test(step1.ownerPhone.trim())) {
      errors.push("Owner phone number must be 10 digits")
    }
    if (!step1.primaryContactNumber?.trim()) errors.push("Primary contact number is required")
    if (step1.primaryContactNumber?.trim() && !PHONE_REGEX.test(step1.primaryContactNumber.trim())) {
      errors.push("Primary contact number must be 10 digits")
    }
    if (!step1.zoneId?.trim()) errors.push("Service zone is required")
    if (!step1.location?.area?.trim()) errors.push("Area/Sector/Locality is required")
    if (!step1.location?.city?.trim()) errors.push("City is required")
    return errors
  }

  const validateStep2 = () => {
    const errors = []
    if (!step2.menuImages || step2.menuImages.length === 0) errors.push("At least one menu image is required")
    if (!step2.profileImage) errors.push("Restaurant profile image is required")
    if (!step2.cuisines || step2.cuisines.length === 0) errors.push("Please select at least one cuisine")
    if (!step2.estimatedDeliveryTime?.trim()) errors.push("Estimated delivery time is required")
    if (!step2.openingTime?.trim()) errors.push("Opening time is required")
    if (!step2.closingTime?.trim()) errors.push("Closing time is required")
    const openingMinutes = timeStringToMinutes(step2.openingTime)
    const closingMinutes = timeStringToMinutes(step2.closingTime)
    if (openingMinutes !== null && closingMinutes !== null) {
      if (openingMinutes === closingMinutes) errors.push("Opening time and closing time cannot be same")
      if (closingMinutes < openingMinutes) errors.push("Closing time cannot be less than opening time")
    }
    if (!step2.openDays || step2.openDays.length === 0) errors.push("Please select at least one open day")
    return errors
  }

  const validateStep3 = () => {
    const errors = []
    if (!step3.panNumber?.trim()) errors.push("PAN number is required")
    if (step3.panNumber?.trim() && !PAN_REGEX.test(step3.panNumber.trim())) errors.push("PAN number must be in valid format")
    if (!step3.nameOnPan?.trim()) errors.push("Name on PAN is required")
    if (step3.nameOnPan?.trim() && (!NAME_REGEX.test(step3.nameOnPan.trim()) || !hasLetters(step3.nameOnPan))) {
      errors.push("Name on PAN must contain characters only")
    }
    if (!step3.panImage) errors.push("PAN image is required")
    if (!step3.fssaiNumber?.trim()) errors.push("FSSAI number is required")
    if (step3.fssaiNumber?.trim() && !FSSAI_REGEX.test(step3.fssaiNumber.trim())) errors.push("FSSAI number must be 14 digits")
    if (!step3.fssaiExpiry?.trim()) errors.push("FSSAI expiry date is required")
    if (step3.fssaiExpiry?.trim() && step3.fssaiExpiry < getTodayLocalYMD()) errors.push("FSSAI expiry date cannot be in the past")
    if (!step3.fssaiImage) errors.push("FSSAI image is required")
    if (step3.gstRegistered) {
      if (!step3.gstNumber?.trim()) errors.push("GST number is required when GST registered")
      if (step3.gstNumber?.trim() && !GST_REGEX.test(step3.gstNumber.trim())) errors.push("GST number must be in valid format")
      if (!step3.gstLegalName?.trim()) errors.push("GST legal name is required")
      if (!step3.gstAddress?.trim()) errors.push("GST registered address is required")
      if (!step3.gstImage) errors.push("GST image is required")
    }
    if (!step3.accountNumber?.trim()) errors.push("Account number is required")
    if (step3.accountNumber?.trim() && !ACCOUNT_NUMBER_REGEX.test(step3.accountNumber.trim())) {
      errors.push("Account number must be 9 to 18 digits")
    }
    if (step3.accountNumber !== step3.confirmAccountNumber) errors.push("Account number and confirmation do not match")
    if (!step3.ifscCode?.trim()) errors.push("IFSC code is required")
    if (step3.ifscCode?.trim() && !IFSC_REGEX.test(step3.ifscCode.trim())) errors.push("IFSC code must be in valid format")
    if (!step3.accountHolderName?.trim()) errors.push("Account holder name is required")
    if (!step3.accountType?.trim()) errors.push("Account type is required")
    return errors
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setFormErrors({})

    try {
      const profileImageData =
        step2.profileImage instanceof File
          ? await handleUpload(step2.profileImage, "appzeto/restaurant/profile")
          : step2.profileImage

      const menuImagesData = []
      for (const entry of step2.menuImages) {
        if (entry instanceof File) {
          menuImagesData.push(await handleUpload(entry, "appzeto/restaurant/menu"))
        } else if (entry?.url || typeof entry === "string") {
          menuImagesData.push(entry)
        }
      }

      const panImageData =
        step3.panImage instanceof File
          ? await handleUpload(step3.panImage, "appzeto/restaurant/pan")
          : step3.panImage

      const gstImageData =
        step3.gstRegistered && step3.gstImage instanceof File
          ? await handleUpload(step3.gstImage, "appzeto/restaurant/gst")
          : step3.gstImage

      const fssaiImageData =
        step3.fssaiImage instanceof File
          ? await handleUpload(step3.fssaiImage, "appzeto/restaurant/fssai")
          : step3.fssaiImage

      const locationPayload = {
        zoneId: step1.zoneId,
        latitude: Number(step1.location.latitude || 0),
        longitude: Number(step1.location.longitude || 0),
        coordinates: [Number(step1.location.longitude || 0), Number(step1.location.latitude || 0)],
        formattedAddress: step1.location.formattedAddress || "",
        address: step1.location.formattedAddress || "",
        addressLine1: step1.location.addressLine1 || "",
        addressLine2: step1.location.addressLine2 || "",
        area: step1.location.area || "",
        city: step1.location.city || "",
        state: step1.location.state || "",
        pincode: step1.location.pincode || "",
        zipCode: step1.location.pincode || "",
        postalCode: step1.location.pincode || "",
        landmark: step1.location.landmark || "",
      }

      const payload = {
        restaurantName: step1.restaurantName,
        pureVegRestaurant: step1.pureVegRestaurant,
        ownerName: step1.ownerName,
        ownerEmail: step1.ownerEmail,
        ownerPhone: step1.ownerPhone,
        primaryContactNumber: step1.primaryContactNumber,
        menuImages: menuImagesData,
        profileImage: profileImageData,
        cuisines: step2.cuisines,
        estimatedDeliveryTime: step2.estimatedDeliveryTime,
        openingTime: step2.openingTime,
        closingTime: step2.closingTime,
        openDays: step2.openDays,
        panNumber: step3.panNumber,
        nameOnPan: step3.nameOnPan,
        panImage: panImageData,
        gstRegistered: step3.gstRegistered,
        gstNumber: step3.gstNumber,
        gstLegalName: step3.gstLegalName,
        gstAddress: step3.gstAddress,
        gstImage: gstImageData,
        fssaiNumber: step3.fssaiNumber,
        fssaiExpiry: step3.fssaiExpiry,
        fssaiImage: fssaiImageData,
        accountNumber: step3.accountNumber,
        ifscCode: step3.ifscCode,
        accountHolderName: step3.accountHolderName,
        accountType: step3.accountType,
      }

      await adminAPI.updateRestaurant(id, payload)
      await adminAPI.updateRestaurantLocation(id, locationPayload)

      toast.success("Restaurant updated successfully")
      setShowSuccessDialog(true)
      setTimeout(() => navigate("/admin/food/restaurants"), 1500)
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || "Failed to update restaurant"
      toast.error(message)
      setFormErrors({ submit: message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNext = () => {
    setFormErrors({})
    const errors = step === 1 ? validateStep1() : step === 2 ? validateStep2() : validateStep3()
    if (errors.length > 0) {
      errors.forEach((error) => toast.error(error))
      return
    }
    if (step < 3) {
      setStep((current) => current + 1)
      return
    }
    handleSubmit()
  }

  const renderStep1 = () => (
    <div className="space-y-6">
      <section className="bg-white p-4 sm:p-6 rounded-md">
        <h2 className="text-lg font-semibold text-black mb-4">Restaurant information</h2>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-gray-700">Restaurant name*</Label>
            <Input
              value={step1.restaurantName || ""}
              onChange={(e) => setStep1({ ...step1, restaurantName: e.target.value })}
              className="mt-1 bg-white text-sm"
              placeholder="Customers will see this name"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-700">Pure veg restaurant?*</Label>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setStep1({ ...step1, pureVegRestaurant: true })}
                className={`px-3 py-1.5 text-xs rounded-full border ${
                  step1.pureVegRestaurant === true
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-white text-gray-700 border-gray-200"
                }`}
              >
                Yes, Pure Veg
              </button>
              <button
                type="button"
                onClick={() => setStep1({ ...step1, pureVegRestaurant: false })}
                className={`px-3 py-1.5 text-xs rounded-full border ${
                  step1.pureVegRestaurant === false
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700 border-gray-200"
                }`}
              >
                No, Mixed Menu
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md">
        <h2 className="text-lg font-semibold text-black mb-4">Owner details</h2>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-gray-700">Full name*</Label>
            <Input
              value={step1.ownerName || ""}
              onChange={(e) => setStep1({ ...step1, ownerName: normalizeName(e.target.value) })}
              className="mt-1 bg-white text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-700">Email address*</Label>
            <Input
              type="email"
              value={step1.ownerEmail || ""}
              onChange={(e) => setStep1({ ...step1, ownerEmail: e.target.value })}
              className="mt-1 bg-white text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-700">Phone number*</Label>
            <Input
              value={step1.ownerPhone || ""}
              onChange={(e) => setStep1({ ...step1, ownerPhone: sanitizeDigits(e.target.value).slice(0, 10) })}
              className="mt-1 bg-white text-sm"
              inputMode="numeric"
              maxLength={10}
            />
          </div>
        </div>
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">Restaurant contact & location</h2>
        <div>
          <Label className="text-xs text-gray-700">Search location</Label>
          <div className="relative">
            <Input
              ref={locationSearchInputRef}
              value={locationSearchValue}
              onChange={(e) => setLocationSearchValue(e.target.value)}
              className="mt-1 bg-white text-sm"
              placeholder="Search and select restaurant address..."
            />
            {isSearchingLocation ? (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 mt-0.5">
                <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
              </div>
            ) : null}
            {locationSuggestions.length > 0 ? (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-xl">
                {locationSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    onClick={() => {
                      const area =
                        suggestion.addr.suburb ||
                        suggestion.addr.neighbourhood ||
                        suggestion.addr.city_district ||
                        suggestion.addr.locality ||
                        ""
                      const city =
                        suggestion.addr.city ||
                        suggestion.addr.town ||
                        suggestion.addr.village ||
                        ""
                      const state = suggestion.addr.state || ""
                      const pincode = suggestion.addr.postcode || ""

                      setStep1((prev) => ({
                        ...prev,
                        location: {
                          ...prev.location,
                          formattedAddress: suggestion.display,
                          addressLine1: suggestion.display,
                          area: area || prev.location.area,
                          city: city || prev.location.city,
                          state: state || prev.location.state,
                          pincode: pincode || prev.location.pincode,
                          latitude: suggestion.lat || prev.location.latitude,
                          longitude: suggestion.lng || prev.location.longitude,
                        },
                      }))
                      setLocationSearchValue(suggestion.display)
                      setLocationSuggestions([])
                    }}
                    className="w-full border-b border-gray-100 px-4 py-2 text-left text-[13px] font-medium text-gray-700 hover:bg-orange-50 last:border-none"
                  >
                    <span className="block truncate">{suggestion.display}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div>
          <Label className="text-xs text-gray-700">Service zone*</Label>
          <select
            value={step1.zoneId || ""}
            onChange={(e) => setStep1({ ...step1, zoneId: e.target.value })}
            className="mt-1 w-full h-9 rounded-md border border-input bg-white px-3 text-sm"
            disabled={zonesLoading}
          >
            <option value="">{zonesLoading ? "Loading zones..." : "Select a zone"}</option>
            {zones.map((zone) => {
              const zoneId = String(zone?._id || zone?.id || "")
              const label = zone?.name || zone?.zoneName || zoneId
              return (
                <option key={zoneId} value={zoneId}>
                  {label}
                </option>
              )
            })}
          </select>
        </div>
        <div>
          <Label className="text-xs text-gray-700">Primary contact number*</Label>
          <Input
            value={step1.primaryContactNumber || ""}
            onChange={(e) =>
              setStep1({ ...step1, primaryContactNumber: sanitizeDigits(e.target.value).slice(0, 10) })
            }
            className="mt-1 bg-white text-sm"
            inputMode="numeric"
            maxLength={10}
          />
        </div>
        <div className="space-y-3">
          <Input
            value={step1.location?.area || ""}
            onChange={(e) => setStep1({ ...step1, location: { ...step1.location, area: e.target.value } })}
            className="bg-white text-sm"
            placeholder="Area / Sector / Locality*"
          />
          <Input
            value={step1.location?.city || ""}
            onChange={(e) => setStep1({ ...step1, location: { ...step1.location, city: e.target.value } })}
            className="bg-white text-sm"
            placeholder="City*"
          />
          <Input
            value={step1.location?.addressLine1 || ""}
            onChange={(e) => setStep1({ ...step1, location: { ...step1.location, addressLine1: e.target.value } })}
            className="bg-white text-sm"
            placeholder="Shop no. / building no. (optional)"
          />
          <Input
            value={step1.location?.addressLine2 || ""}
            onChange={(e) => setStep1({ ...step1, location: { ...step1.location, addressLine2: e.target.value } })}
            className="bg-white text-sm"
            placeholder="Floor / tower (optional)"
          />
          <Input
            value={step1.location?.state || ""}
            onChange={(e) => setStep1({ ...step1, location: { ...step1.location, state: e.target.value } })}
            className="bg-white text-sm"
            placeholder="State"
          />
          <Input
            value={step1.location?.pincode || ""}
            onChange={(e) => setStep1({ ...step1, location: { ...step1.location, pincode: e.target.value } })}
            className="bg-white text-sm"
            placeholder="Pin code"
          />
          <Input
            value={step1.location?.landmark || ""}
            onChange={(e) => setStep1({ ...step1, location: { ...step1.location, landmark: e.target.value } })}
            className="bg-white text-sm"
            placeholder="Nearby landmark"
          />
        </div>
      </section>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-6">
      <section className="bg-white p-4 sm:p-6 rounded-md space-y-5">
        <h2 className="text-lg font-semibold text-black">Menu & photos</h2>
        <div className="space-y-2">
          <Label className="text-xs font-medium text-gray-700">Menu images*</Label>
          <div className="mt-1 border border-dashed border-gray-300 rounded-md bg-gray-50/70 px-4 py-3">
            <label htmlFor="editMenuImagesInput" className="inline-flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-sm bg-white text-black border-black text-xs font-medium cursor-pointer w-full">
              <Upload className="w-4.5 h-4.5" />
              <span>Choose files</span>
            </label>
            <input
              id="editMenuImagesInput"
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || [])
                if (files.length) setStep2((prev) => ({ ...prev, menuImages: [...prev.menuImages, ...files] }))
                e.target.value = ""
              }}
            />
          </div>
          {step2.menuImages.length > 0 && (
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {step2.menuImages.map((file, idx) => (
                <div key={`${getStoredFileLabel(file)}-${idx}`} className="relative aspect-[4/5] rounded-md overflow-hidden bg-gray-100">
                  {getStoredImageSrc(file) ? (
                    <img src={getStoredImageSrc(file)} alt={`Menu ${idx + 1}`} className="w-full h-full object-cover" />
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      setStep2((prev) => ({ ...prev, menuImages: prev.menuImages.filter((_, index) => index !== idx) }))
                    }
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-gray-700">Restaurant profile image*</Label>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
              {step2.profileImage ? (
                <img src={getStoredImageSrc(step2.profileImage)} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-6 h-6 text-gray-500" />
              )}
            </div>
            <label htmlFor="editProfileImageInput" className="inline-flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-sm bg-white text-black border-black text-xs font-medium cursor-pointer">
              <Upload className="w-4.5 h-4.5" />
              <span>Upload</span>
            </label>
            <input
              id="editProfileImageInput"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] || null
                if (file) setStep2((prev) => ({ ...prev, profileImage: file }))
                e.target.value = ""
              }}
            />
          </div>
        </div>
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md space-y-5">
        <div>
          <Label className="text-xs text-gray-700">Select cuisines (up to 3)*</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {cuisinesOptions.map((cuisine) => {
              const active = step2.cuisines.includes(cuisine)
              return (
                <button
                  key={cuisine}
                  type="button"
                  onClick={() =>
                    setStep2((prev) => {
                      const exists = prev.cuisines.includes(cuisine)
                      if (exists) return { ...prev, cuisines: prev.cuisines.filter((entry) => entry !== cuisine) }
                      if (prev.cuisines.length >= 3) return prev
                      return { ...prev, cuisines: [...prev.cuisines, cuisine] }
                    })
                  }
                  className={`px-3 py-1.5 text-xs rounded-full ${active ? "bg-black text-white" : "bg-gray-100 text-gray-800"}`}
                >
                  {cuisine}
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-xs text-gray-700">Outlet timings*</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-gray-700 mb-1 block">Opening time</Label>
              <Input type="time" value={step2.openingTime || ""} onChange={(e) => setStep2({ ...step2, openingTime: e.target.value })} className="bg-white text-sm" />
            </div>
            <div>
              <Label className="text-xs text-gray-700 mb-1 block">Closing time</Label>
              <Input type="time" value={step2.closingTime || ""} onChange={(e) => setStep2({ ...step2, closingTime: e.target.value })} className="bg-white text-sm" />
            </div>
          </div>
        </div>

        <div>
          <Label className="text-xs text-gray-700">Estimated delivery time*</Label>
          <Input
            value={step2.estimatedDeliveryTime || ""}
            onChange={(e) => setStep2({ ...step2, estimatedDeliveryTime: e.target.value })}
            className="mt-1 bg-white text-sm"
            placeholder="e.g., 25-30 mins"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-gray-700 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-gray-800" />
            <span>Open days*</span>
          </Label>
          <div className="mt-1 grid grid-cols-7 gap-1.5 sm:gap-2">
            {daysOfWeek.map((day) => {
              const active = step2.openDays.includes(day)
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() =>
                    setStep2((prev) => {
                      const exists = prev.openDays.includes(day)
                      if (exists) return { ...prev, openDays: prev.openDays.filter((entry) => entry !== day) }
                      return { ...prev, openDays: [...prev.openDays, day] }
                    })
                  }
                  className={`aspect-square flex items-center justify-center rounded-md text-[11px] font-medium ${active ? "bg-black text-white" : "bg-gray-100 text-gray-800"}`}
                >
                  {day.charAt(0)}
                </button>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-6">
      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">PAN details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-gray-700">PAN number*</Label>
            <Input value={step3.panNumber || ""} onChange={(e) => setStep3({ ...step3, panNumber: sanitizePan(e.target.value) })} className="mt-1 bg-white text-sm" maxLength={10} />
          </div>
          <div>
            <Label className="text-xs text-gray-700">Name on PAN*</Label>
            <Input value={step3.nameOnPan || ""} onChange={(e) => setStep3({ ...step3, nameOnPan: normalizeName(e.target.value) })} className="mt-1 bg-white text-sm" />
          </div>
        </div>
        <div>
          <Label className="text-xs text-gray-700">PAN image*</Label>
          <Input type="file" accept="image/*" onChange={(e) => setStep3({ ...step3, panImage: e.target.files?.[0] || null })} className="mt-1 bg-white text-sm" />
          {step3.panImage ? (
            <div className="mt-2 flex items-center gap-3">
              <div className="h-14 w-14 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
                <img src={getStoredImageSrc(step3.panImage)} alt="PAN" className="h-full w-full object-cover" />
              </div>
              <p className="text-xs text-gray-600">Selected: {getStoredFileLabel(step3.panImage)}</p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">GST details</h2>
        <div className="flex gap-4 items-center text-sm">
          <span className="text-gray-700">GST registered?</span>
          <button type="button" onClick={() => setStep3({ ...step3, gstRegistered: true })} className={`px-3 py-1.5 text-xs rounded-full ${step3.gstRegistered ? "bg-black text-white" : "bg-gray-100 text-gray-800"}`}>Yes</button>
          <button type="button" onClick={() => setStep3({ ...step3, gstRegistered: false, gstNumber: "", gstLegalName: "", gstAddress: "", gstImage: null })} className={`px-3 py-1.5 text-xs rounded-full ${!step3.gstRegistered ? "bg-black text-white" : "bg-gray-100 text-gray-800"}`}>No</button>
        </div>
        {step3.gstRegistered ? (
          <div className="space-y-3">
            <Input value={step3.gstNumber || ""} onChange={(e) => setStep3({ ...step3, gstNumber: sanitizeGst(e.target.value) })} className="bg-white text-sm" placeholder="GST number*" maxLength={15} />
            <Input value={step3.gstLegalName || ""} onChange={(e) => setStep3({ ...step3, gstLegalName: normalizeName(e.target.value) })} className="bg-white text-sm" placeholder="Legal name*" />
            <Input value={step3.gstAddress || ""} onChange={(e) => setStep3({ ...step3, gstAddress: e.target.value })} className="bg-white text-sm" placeholder="Registered address*" />
            <Input type="file" accept="image/*" onChange={(e) => setStep3({ ...step3, gstImage: e.target.files?.[0] || null })} className="bg-white text-sm" />
            {step3.gstImage ? (
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
                  <img src={getStoredImageSrc(step3.gstImage)} alt="GST" className="h-full w-full object-cover" />
                </div>
                <p className="text-xs text-gray-600">Selected: {getStoredFileLabel(step3.gstImage)}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">FSSAI details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input value={step3.fssaiNumber || ""} onChange={(e) => setStep3({ ...step3, fssaiNumber: sanitizeFssai(e.target.value) })} className="bg-white text-sm" placeholder="FSSAI number*" inputMode="numeric" maxLength={14} />
          <div>
            <Label className="text-xs text-gray-700 mb-1 block">FSSAI expiry date*</Label>
            <Input type="date" value={step3.fssaiExpiry || ""} onChange={(e) => setStep3({ ...step3, fssaiExpiry: e.target.value })} min={getTodayLocalYMD()} className="bg-white text-sm" />
          </div>
        </div>
        <Input type="file" accept="image/*" onChange={(e) => setStep3({ ...step3, fssaiImage: e.target.files?.[0] || null })} className="bg-white text-sm" />
        {step3.fssaiImage ? (
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
              <img src={getStoredImageSrc(step3.fssaiImage)} alt="FSSAI" className="h-full w-full object-cover" />
            </div>
            <p className="text-xs text-gray-600">Selected: {getStoredFileLabel(step3.fssaiImage)}</p>
          </div>
        ) : null}
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">Bank account details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input value={step3.accountNumber || ""} onChange={(e) => setStep3({ ...step3, accountNumber: sanitizeDigits(e.target.value).slice(0, 18) })} className="bg-white text-sm" placeholder="Account number*" inputMode="numeric" maxLength={18} />
          <Input value={step3.confirmAccountNumber || ""} onChange={(e) => setStep3({ ...step3, confirmAccountNumber: sanitizeDigits(e.target.value).slice(0, 18) })} className="bg-white text-sm" placeholder="Re-enter account number*" inputMode="numeric" maxLength={18} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input value={step3.ifscCode || ""} onChange={(e) => setStep3({ ...step3, ifscCode: sanitizeIfsc(e.target.value) })} className="bg-white text-sm" placeholder="IFSC code*" maxLength={11} />
          <select value={step3.accountType || ""} onChange={(e) => setStep3({ ...step3, accountType: e.target.value })} className="bg-white text-sm border border-input rounded-md h-10 px-3">
            <option value="">Select account type</option>
            <option value="Saving">Saving</option>
            <option value="Current">Current</option>
          </select>
        </div>
        <Input value={step3.accountHolderName || ""} onChange={(e) => setStep3({ ...step3, accountHolderName: normalizeName(e.target.value) })} className="bg-white text-sm" placeholder="Account holder name*" />
      </section>
    </div>
  )

  const renderStep = () => {
    if (step === 1) return renderStep1()
    if (step === 2) return renderStep2()
    return renderStep3()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="inline-flex items-center gap-2 rounded-md bg-white border border-gray-200 px-4 py-3 text-sm text-gray-700">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading restaurant...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="px-4 py-4 sm:px-6 sm:py-5 bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/admin/food/restaurants")} className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white p-2">
            <ArrowLeft className="w-4 h-4 text-gray-700" />
          </button>
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-blue-600" />
            <div>
              <div className="text-sm font-semibold text-black">Edit Restaurant</div>
              <div className="text-xs text-gray-500">{restaurantName || id}</div>
            </div>
          </div>
        </div>
        <div className="text-xs text-gray-600">Step {step} of 3</div>
      </header>

      <main ref={mainContentRef} className="flex-1 px-4 sm:px-6 py-4 space-y-4">
        {renderStep()}
      </main>

      {formErrors.submit ? (
        <div className="px-4 sm:px-6 pb-2 text-xs text-red-600">{formErrors.submit}</div>
      ) : null}

      <footer className="px-4 sm:px-6 py-3 bg-white">
        <div className="flex justify-between items-center">
          <Button variant="ghost" disabled={step === 1 || isSubmitting} onClick={() => setStep((current) => Math.max(1, current - 1))} className="text-sm text-gray-700 bg-transparent">
            Back
          </Button>
          <Button onClick={handleNext} disabled={isSubmitting} className="text-sm bg-black text-white px-6">
            {step === 3 ? (
              isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Restaurant"
              )
            ) : (
              "Continue"
            )}
          </Button>
        </div>
      </footer>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-md bg-white p-0">
          <div className="p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-100 rounded-full animate-ping opacity-75" />
                <div className="relative bg-emerald-500 rounded-full p-4">
                  <CheckCircle2 className="w-12 h-12 text-white" />
                </div>
              </div>
            </div>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-slate-900 mb-2">Restaurant Updated Successfully!</DialogTitle>
              <DialogDescription className="text-sm text-slate-600">
                All onboarding fields are now editable from this page.
              </DialogDescription>
            </DialogHeader>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
