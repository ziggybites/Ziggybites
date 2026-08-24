import { useMemo, useState, useEffect } from "react"
import { BarChart3, ChevronDown, Settings, FileText, FileSpreadsheet, Code, Loader2 } from "lucide-react"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@food/components/ui/dialog"
import { exportReportsToCSV, exportReportsToExcel, exportReportsToPDF, exportReportsToJSON } from "@food/components/admin/reports/reportsExportUtils"
import { getOrderAmountBreakdown } from "@food/utils/orderAmounts"
import searchIcon from "@food/assets/Dashboard-icons/image8.png"
import exportIcon from "@food/assets/Dashboard-icons/image9.png"

const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const PAGE_SIZE = 25

export default function RegularOrderReport() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterLoading, setFilterLoading] = useState(false)
  const [error, setError] = useState(null)
  const [zones, setZones] = useState([])
  const [restaurants, setRestaurants] = useState([])
  const [customers, setCustomers] = useState([])

  const [filters, setFilters] = useState({
    zone: "All Zones",
    restaurant: "All restaurants",
    customer: "All customers",
    time: "All Time",
  })
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  useEffect(() => {
    const fetchFilterData = async () => {
      try {
        const zonesRes = await adminAPI.getZones({ limit: 1000, isActive: true })
        if (zonesRes.data?.success) {
          setZones(zonesRes.data.data.zones || [])
        }

        const restaurantsRes = await adminAPI.getRestaurants({ limit: 1000 })
        if (restaurantsRes.data?.success) {
          setRestaurants(restaurantsRes.data.data.restaurants || [])
        }

        const customersRes = await adminAPI.getCustomers({ limit: 1000 })
        if (customersRes.data?.success) {
          setCustomers(customersRes.data.data.customers || [])
        }
      } catch (err) {
        debugError("Error fetching filter data:", err)
      }
    }

    fetchFilterData()
  }, [])

  const getDateRange = () => {
    const now = new Date()
    let fromDate = null
    let toDate = null

    switch (filters.time) {
      case "Today":
        fromDate = new Date(now.setHours(0, 0, 0, 0))
        toDate = new Date(now.setHours(23, 59, 59, 999))
        break
      case "This Week": {
        const weekStart = new Date(now)
        weekStart.setDate(now.getDate() - now.getDay())
        weekStart.setHours(0, 0, 0, 0)
        fromDate = weekStart
        toDate = new Date(now.setHours(23, 59, 59, 999))
        break
      }
      case "This Month":
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1)
        toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
        break
      default:
        break
    }

    return { fromDate, toDate }
  }

  useEffect(() => {
    const fetchOrders = async () => {
      if (orders.length === 0) {
        setLoading(true)
      } else {
        setFilterLoading(true)
      }

      setError(null)

      try {
        const { fromDate, toDate } = getDateRange()
        const params = {
          page: 1,
          limit: 10000,
          startDate: fromDate ? fromDate.toISOString().split("T")[0] : undefined,
          endDate: toDate ? toDate.toISOString().split("T")[0] : undefined,
        }

        const response = await adminAPI.getOrders(params)

        if (response.data?.success) {
          const rawOrders = response.data.data.orders || []
          const transformedOrders = rawOrders.map((order) => {
            const items = Array.isArray(order.items) ? order.items : []
            const amountBreakdown = getOrderAmountBreakdown(order)
            const settlementAmounts = order.settlementAmounts || order.transaction?.amounts || {}
            const transactionPricing = order.transaction?.pricing || {}
            const isSubscriptionPrepaidOrder =
              String(order?.paymentMethod || order?.payment?.method || "").toLowerCase() === "subscription" ||
              String(order?.subscriptionUsage?.billingMode || "").toLowerCase() === "subscription_prepaid"

            const itemsSubtotal = items.reduce((sum, item) => {
              const qty = Number(item.quantity || 1)
              const price = Number(item.price || 0)
              return sum + qty * price
            }, 0)

            const foodValue =
              itemsSubtotal > 0
                ? itemsSubtotal
                : Number(
                    settlementAmounts.subscriptionAllocationAmount ||
                    amountBreakdown.subtotal ||
                    transactionPricing.subtotal ||
                    0
                  )
            const packagingFee = Number(amountBreakdown.packagingFee || transactionPricing.packagingFee || 0)
            const deliveryCharge = Number(
              isSubscriptionPrepaidOrder
                ? settlementAmounts.riderShare ||
                  order.riderEarning ||
                  0
                : settlementAmounts.riderShare ||
                  amountBreakdown.deliveryFee ||
                  transactionPricing.deliveryFee ||
                  order.riderEarning ||
                  0
            )
            const platformFee = Number(amountBreakdown.platformFee || transactionPricing.platformFee || 0)
            const vatTax = Number(
              settlementAmounts.taxAmount ||
              amountBreakdown.tax ||
              transactionPricing.tax ||
              0
            )
            const couponDiscount = Number(amountBreakdown.discount || transactionPricing.discount || 0)
            const totalAmount = Number(
              isSubscriptionPrepaidOrder
                ? settlementAmounts.subscriptionAllocationAmount ||
                  settlementAmounts.totalCustomerPaid ||
                  amountBreakdown.total ||
                  foodValue
                : amountBreakdown.total
            )

            const restaurantName =
              order.restaurantId?.restaurantName ||
              order.restaurantName ||
              ""
            const restaurantId =
              order.restaurantId?._id ||
              order.restaurantId?.id ||
              order.restaurantId ||
              ""

            const customerName =
              order.userId?.name ||
              order.customerName ||
              "N/A"
            const customerId =
              order.userId?._id ||
              order.userId?.id ||
              order.userId ||
              ""

            const restaurantMeta = restaurants.find((restaurant) => {
              const candidateId = restaurant?._id || restaurant?.id || restaurant?.restaurantId
              return String(candidateId || "") === String(restaurantId || "")
            })

            const zoneId =
              order.zoneId?._id ||
              order.zoneId?.id ||
              order.zoneId ||
              restaurantMeta?.zoneId?._id ||
              restaurantMeta?.zoneId ||
              ""

            const backendStatus = String(order.orderStatus || "").toLowerCase()
            let displayStatus = order.orderStatus

            if (!backendStatus || backendStatus === "created" || backendStatus === "confirmed") {
              displayStatus = "Pending"
            } else if (backendStatus === "preparing" || backendStatus === "ready_for_pickup") {
              displayStatus = "Processing"
            } else if (backendStatus === "picked_up") {
              displayStatus = "Food On The Way"
            } else if (backendStatus === "delivered") {
              displayStatus = "Delivered"
            } else if (backendStatus === "cancelled_by_restaurant") {
              displayStatus = "Canceled"
            } else if (backendStatus === "cancelled_by_user" || backendStatus === "cancelled_by_admin") {
              displayStatus = "Canceled"
            }

            return {
              orderId: order.orderId,
              restaurantId: String(restaurantId || ""),
              restaurant: restaurantName,
              customerId: String(customerId || ""),
              customerName,
              zoneId: String(zoneId || ""),
              totalItemAmount: foodValue,
              packagingFee,
              couponDiscount,
              vatTax,
              deliveryCharge,
              platformFee,
              totalAmount,
              orderStatus: displayStatus,
            }
          })

          setOrders(transformedOrders)
        } else {
          setError(response.data?.message || "Failed to fetch orders")
          toast.error(response.data?.message || "Failed to fetch orders")
        }
      } catch (err) {
        debugError("Error fetching orders:", err)
        setError(err.response?.data?.message || "Failed to fetch orders")
        toast.error(err.response?.data?.message || "Failed to fetch orders")
      } finally {
        setLoading(false)
        setFilterLoading(false)
      }
    }

    fetchOrders()
  }, [filters.time, restaurants])

  const filteredOrders = useMemo(() => {
    let result = [...orders]

    if (filters.zone !== "All Zones") {
      result = result.filter((order) => String(order.zoneId || "") === String(filters.zone))
    }

    if (filters.restaurant !== "All restaurants") {
      result = result.filter((order) => String(order.restaurantId || "") === String(filters.restaurant))
    }

    if (filters.customer !== "All customers") {
      result = result.filter((order) => String(order.customerId || "") === String(filters.customer))
    }

    if (!searchQuery.trim()) return result

    const q = searchQuery.toLowerCase().trim()
    return result.filter((order) =>
      String(order.orderId || "").toLowerCase().includes(q) ||
      String(order.restaurant || "").toLowerCase().includes(q) ||
      String(order.customerName || "").toLowerCase().includes(q)
    )
  }, [orders, filters.zone, filters.restaurant, filters.customer, searchQuery])

  const handleExport = (format) => {
    if (filteredOrders.length === 0) {
      alert("No data to export")
      return
    }

    const headers = [
      { key: "orderId", label: "Order ID" },
      { key: "restaurant", label: "Restaurant" },
      { key: "customerName", label: "Customer Name" },
      { key: "totalItemAmount", label: "Food Value" },
      { key: "packagingFee", label: "Packaging Fee" },
      { key: "couponDiscount", label: "Coupon Discount" },
      { key: "deliveryCharge", label: "Delivery Share" },
      { key: "totalAmount", label: "Total Amount" },
      { key: "orderStatus", label: "Status" },
    ]

    switch (format) {
      case "csv": exportReportsToCSV(filteredOrders, headers, "regular_order_report"); break
      case "excel": exportReportsToExcel(filteredOrders, headers, "regular_order_report"); break
      case "pdf": exportReportsToPDF(filteredOrders, headers, "regular_order_report", "Regular Order Report"); break
      case "json": exportReportsToJSON(filteredOrders, "regular_order_report"); break
    }
  }

  const handleFilterApply = () => {}

  const handleResetFilters = () => {
    setFilters({
      zone: "All Zones",
      restaurant: "All restaurants",
      customer: "All customers",
      time: "All Time",
    })
    setSearchQuery("")
    setCurrentPage(1)
  }

  const activeFiltersCount =
    (filters.zone !== "All Zones" ? 1 : 0) +
    (filters.restaurant !== "All restaurants" ? 1 : 0) +
    (filters.customer !== "All customers" ? 1 : 0) +
    (filters.time !== "All Time" ? 1 : 0)

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE))

  const paginatedOrders = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages)
    const start = (safePage - 1) * PAGE_SIZE
    return filteredOrders.slice(start, start + PAGE_SIZE)
  }, [filteredOrders, currentPage, totalPages])

  const pricingStats = useMemo(
    () =>
      filteredOrders.reduce(
        (acc, order) => {
          acc.totalOrders += 1
          acc.foodValue += Number(order.totalItemAmount || 0)
          acc.packagingFee += Number(order.packagingFee || 0)
          acc.discount += Number(order.couponDiscount || 0)
          acc.gst += Number(order.vatTax || 0)
          acc.delivery += Number(order.deliveryCharge || 0)
          acc.platform += Number(order.platformFee || 0)
          acc.totalAmount += Number(order.totalAmount || 0)
          return acc
        },
        {
          totalOrders: 0,
          foodValue: 0,
          packagingFee: 0,
          discount: 0,
          gst: 0,
          delivery: 0,
          platform: 0,
          totalAmount: 0,
        }
      ),
    [filteredOrders]
  )

  const formatAmount = (amount) =>
    `Rs. ${Number(amount || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setCurrentPage(1)
  }

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return
    setCurrentPage(newPage)
  }

  if (loading) {
    return (
      <div className="p-2 lg:p-3 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-gray-600">Loading orders...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-2 lg:p-3 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-2">Error: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-2 lg:p-3 bg-slate-50 min-h-screen">
      <div className="w-full mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <BarChart3 className="w-3.5 h-3.5 text-white" />
            </div>
            <h1 className="text-lg font-bold text-slate-900">Order Report</h1>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 mb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <select
                value={filters.zone}
                onChange={(e) => handleFilterChange("zone", e.target.value)}
                className="w-full px-2.5 py-1.5 pr-5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs appearance-none cursor-pointer"
              >
                <option value="All Zones">All Zones</option>
                {zones.map((zone) => (
                  <option key={zone._id} value={zone._id}>
                    {zone.zoneName || zone.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
            </div>

            <div className="relative flex-1 min-w-0">
              <select
                value={filters.restaurant}
                onChange={(e) => handleFilterChange("restaurant", e.target.value)}
                className="w-full px-2.5 py-1.5 pr-5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs appearance-none cursor-pointer"
              >
                <option value="All restaurants">All restaurants</option>
                {restaurants.map((restaurant) => (
                  <option key={restaurant._id} value={restaurant._id}>
                    {restaurant.restaurantName || restaurant.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
            </div>

            <div className="relative flex-1 min-w-0">
              <select
                value={filters.customer}
                onChange={(e) => handleFilterChange("customer", e.target.value)}
                className="w-full px-2.5 py-1.5 pr-5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs appearance-none cursor-pointer"
              >
                <option value="All customers">All customers</option>
                {customers.map((customer) => (
                  <option key={customer._id} value={customer._id}>
                    {customer.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
            </div>

            <div className="relative flex-1 min-w-0">
              <select
                value={filters.time}
                onChange={(e) => handleFilterChange("time", e.target.value)}
                className="w-full px-2.5 py-1.5 pr-5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs appearance-none cursor-pointer"
              >
                <option key="all-time" value="All Time">All Time</option>
                <option key="today" value="Today">Today</option>
                <option key="this-week" value="This Week">This Week</option>
                <option key="this-month" value="This Month">This Month</option>
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
            </div>

            <button
              onClick={handleResetFilters}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all whitespace-nowrap"
            >
              Reset
            </button>
            <button
              onClick={handleFilterApply}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all whitespace-nowrap relative ${
                activeFiltersCount > 0 ? "ring-2 ring-blue-300" : ""
              }`}
            >
              Filter
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white rounded-full text-[8px] flex items-center justify-center font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
          <SummaryCard label="Total Orders" value={pricingStats.totalOrders} tone="blue" />
          <SummaryCard label="Food Value" value={formatAmount(pricingStats.foodValue)} tone="slate" />
          <SummaryCard label="Packaging Fee" value={formatAmount(pricingStats.packagingFee)} tone="amber" />
          <SummaryCard label="Discount" value={formatAmount(pricingStats.discount)} tone="rose" />
          <SummaryCard label="GST" value={formatAmount(pricingStats.gst)} tone="emerald" />
          <SummaryCard label="Delivery Share" value={formatAmount(pricingStats.delivery)} tone="cyan" />
          <SummaryCard label="Platform Fee" value={formatAmount(pricingStats.platform)} tone="indigo" />
          <SummaryCard label="Total Amount" value={formatAmount(pricingStats.totalAmount)} tone="green" />
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <h2 className="text-base font-bold text-slate-900">
              Total Orders <span className="text-blue-600">{pricingStats.totalOrders}</span>
            </h2>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:flex-initial min-w-[180px]">
                <input
                  type="text"
                  placeholder="Search by Order ID"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="pl-7 pr-2 py-1.5 w-full text-[11px] rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <img src={searchIcon} alt="Search" className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3" />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1 transition-all">
                    <img src={exportIcon} alt="Export" className="w-3 h-3" />
                    <span>Export</span>
                    <ChevronDown className="w-2.5 h-2.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50 animate-in fade-in-0 zoom-in-95 duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95">
                  <DropdownMenuLabel>Export Format</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleExport("csv")} className="cursor-pointer">
                    <FileText className="w-4 h-4 mr-2" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("excel")} className="cursor-pointer">
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Export as Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("pdf")} className="cursor-pointer">
                    <FileText className="w-4 h-4 mr-2" />
                    Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("json")} className="cursor-pointer">
                    <Code className="w-4 h-4 mr-2" />
                    Export as JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-all"
              >
                <Settings className="w-3 h-3" />
              </button>
            </div>
          </div>

          {filterLoading && (
            <div className="mb-3 flex items-center gap-2 text-[11px] text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
              Updating report...
            </div>
          )}

          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full" style={{ tableLayout: "fixed", width: "100%" }}>
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "3%" }}>
                    SI
                  </th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "8%" }}>
                    Order Id
                  </th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "12%" }}>
                    Restaurant
                  </th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "12%" }}>
                    Customer Name
                  </th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "8%" }}>
                    Food Value
                  </th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "7%" }}>
                    Packaging
                  </th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "7%" }}>
                    Coupon
                  </th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "7%" }}>
                    Delivery Share
                  </th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "8%" }}>
                    Total Amount
                  </th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "5%" }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <p className="text-lg font-semibold text-slate-700 mb-1">No Data Found</p>
                        <p className="text-sm text-slate-500">No orders match your filters</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((order, index) => (
                    <tr key={order.orderId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-1.5 py-1">
                        <span className="text-[10px] font-medium text-slate-700">
                          {(currentPage - 1) * PAGE_SIZE + index + 1}
                        </span>
                      </td>
                      <td className="px-1.5 py-1">
                        <span className="text-[10px] text-blue-600 hover:underline cursor-pointer">{order.orderId}</span>
                      </td>
                      <td className="px-1.5 py-1">
                        <span className="text-[10px] text-slate-700 truncate block">{order.restaurant}</span>
                      </td>
                      <td className="px-1.5 py-1">
                        <span className="text-[10px] text-slate-700 truncate block">{order.customerName}</span>
                      </td>
                      <td className="px-1.5 py-1">
                        <span className="text-[10px] text-slate-700">{formatAmount(order.totalItemAmount)}</span>
                      </td>
                      <td className="px-1.5 py-1">
                        <span className="text-[10px] text-slate-700">{formatAmount(order.packagingFee)}</span>
                      </td>
                      <td className="px-1.5 py-1">
                        <span className="text-[10px] text-slate-700">{formatAmount(order.couponDiscount)}</span>
                      </td>
                      <td className="px-1.5 py-1">
                        <span className="text-[10px] text-slate-700">{formatAmount(order.deliveryCharge)}</span>
                      </td>
                      <td className="px-1.5 py-1">
                        <span className="text-[10px] font-medium text-slate-900">{formatAmount(order.totalAmount)}</span>
                      </td>
                      <td className="px-1.5 py-1">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-slate-100 text-slate-700">
                          {order.orderStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-3">
            <p className="text-[10px] text-slate-500">
              Showing{" "}
              <span className="font-semibold text-slate-700">
                {paginatedOrders.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} -{" "}
                {(currentPage - 1) * PAGE_SIZE + paginatedOrders.length}
              </span>{" "}
              of <span className="font-semibold text-slate-700">{filteredOrders.length}</span> orders
            </p>

            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-2 py-1 text-[10px] rounded border border-slate-300 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                Prev
              </button>
              {Array.from({ length: totalPages }).map((_, idx) => (
                <button
                  key={idx + 1}
                  onClick={() => handlePageChange(idx + 1)}
                  className={`w-6 h-6 text-[10px] rounded border ${
                    currentPage === idx + 1
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-[10px] rounded border border-slate-300 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-md bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Report Settings
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            <p className="text-sm text-slate-700">
              Regular order report settings and preferences will be available here.
            </p>
          </div>
          <div className="px-6 pb-6 flex items-center justify-end">
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-md"
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SummaryCard({ label, value, tone }) {
  const toneMap = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    slate: "bg-slate-50 text-slate-700 border-slate-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    cyan: "bg-cyan-50 text-cyan-700 border-cyan-100",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-100",
    green: "bg-green-50 text-green-700 border-green-100",
  }

  return (
    <div className={`rounded-lg border p-3 shadow-sm ${toneMap[tone] || toneMap.blue}`}>
      <p className="text-[11px] font-medium opacity-80">{label}</p>
      <p className="mt-1 text-base font-bold">{value}</p>
    </div>
  )
}
