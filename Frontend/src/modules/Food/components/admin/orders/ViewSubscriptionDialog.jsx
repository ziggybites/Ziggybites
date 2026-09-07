import { Eye, MapPin } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@food/components/ui/dialog"

const formatFullAddress = (address) => {
  if (!address) return ""
  if (typeof address === "string") return address.trim()

  const formattedAddress = String(address.formattedAddress || "").trim()
  const rawAddress = String(address.address || "").trim()

  const fragments = [
    address.houseNumber || address.house || address.flat || address.apartment,
    address.floor ? `Floor ${address.floor}` : null,
    address.street || address.addressLine1,
    address.additionalDetails || address.addressLine2,
    address.landmark ? `Near ${address.landmark}` : null,
    address.area,
    address.city,
    address.state,
    address.zipCode || address.postalCode || address.pincode,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean)

  const orderedParts = []
  const pushPart = (part) => {
    const norm = String(part || "").trim()
    if (!norm) return
    const key = norm.toLowerCase()
    const exists = orderedParts.some((existing) => {
      const existingKey = existing.toLowerCase()
      return existingKey === key || existingKey.includes(key) || key.includes(existingKey)
    })
    if (!exists) orderedParts.push(norm)
  }

  if (formattedAddress) pushPart(formattedAddress)
  if (rawAddress) pushPart(rawAddress)
  fragments.forEach(pushPart)

  return orderedParts.join(", ")
}

const getStatusColor = (status) => {
  if (status === "Expired") return "bg-blue-100 text-blue-700"
  if (status === "Active") return "bg-emerald-100 text-emerald-700"
  if (status === "Pending") return "bg-amber-100 text-amber-700"
  return "bg-slate-100 text-slate-700"
}

export default function ViewSubscriptionDialog({ isOpen, onOpenChange, order }) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-orange-600" />
            Subscription Details
          </DialogTitle>
          <DialogDescription>
            View complete information about this subscription
          </DialogDescription>
        </DialogHeader>
        {order && (
          <div className="px-6 py-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Subscription ID</p>
                <p className="text-sm font-medium text-slate-900">{order.subscriptionId}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Order Type</p>
                <p className="text-sm font-medium text-slate-900">{order.orderType}</p>
              </div>
              <div className="space-y-1 col-span-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Duration</p>
                <p className="text-sm font-medium text-slate-900">{order.duration}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer Name</p>
                <p className="text-sm font-medium text-slate-900">{order.customerName}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone</p>
                <p className="text-sm font-medium text-slate-900">{order.customerPhone}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Restaurant</p>
                <p className="text-sm font-medium text-slate-900">{order.restaurant}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</p>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                  {order.status}
                </span>
              </div>
            </div>
            <div className="pt-4 border-t border-slate-200">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Total Orders</p>
                  <p className="text-lg font-bold text-slate-900">{order.totalOrders}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Delivered</p>
                  <p className="text-lg font-bold text-emerald-600">{order.delivered}</p>
                </div>
              </div>
            </div>

            {(order.deliveryAddress || order.formattedAddress) && (
              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                    Delivery Address
                  </p>
                  {order.deliveryAddress?.label && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                      {order.deliveryAddress.label}
                    </span>
                  )}
                </div>
                <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3">
                  <p className="break-words text-sm font-medium leading-relaxed text-slate-900">
                    {formatFullAddress(order.deliveryAddress || order.formattedAddress) || "Address not available"}
                  </p>
                  {order.deliveryAddress?.location?.coordinates?.length === 2 && (
                    <p className="mt-1 text-xs text-slate-500">
                      <span className="font-semibold text-slate-600">Coordinates:</span>{" "}
                      {Number(order.deliveryAddress.location.coordinates[1]).toFixed(6)},{" "}
                      {Number(order.deliveryAddress.location.coordinates[0]).toFixed(6)}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

