import { useEffect, useMemo, useState } from "react"
import { BarChart3, ChevronDown, Code, FileSpreadsheet, FileText, Loader2, Settings } from "lucide-react"
import { toast } from "sonner"
import { adminAPI } from "@food/api"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@food/components/ui/dialog"
import { exportReportsToCSV, exportReportsToExcel, exportReportsToPDF, exportReportsToJSON } from "@food/components/admin/reports/reportsExportUtils"
import searchIcon from "@food/assets/Dashboard-icons/image8.png"
import exportIcon from "@food/assets/Dashboard-icons/image9.png"

const PAGE_SIZE = 25

export default function SubscriptionReport() {
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [restaurants, setRestaurants] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [filters, setFilters] = useState({
    restaurant: "All restaurants",
    status: "All Status",
  })

  useEffect(() => {
    const fetchPurchases = async () => {
      try {
        setIsRefreshing(true)
        const response = await adminAPI.getTransactionReport({ limit: 1000 })
        const rows = response?.data?.data?.transactions || []
        const purchaseRows = rows.filter((item) => item.transactionType === "subscription_purchase")
        setPurchases(Array.isArray(purchaseRows) ? purchaseRows : [])
      } catch (error) {
        toast.error(error?.response?.data?.message || "Failed to fetch subscription purchase report")
        setPurchases([])
      } finally {
        setLoading(false)
        setIsRefreshing(false)
      }
    }

    fetchPurchases()
  }, [])

  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const response = await adminAPI.getRestaurants({ page: 1, limit: 1000 })
        const rows = response?.data?.data?.restaurants || []
        setRestaurants(Array.isArray(rows) ? rows : [])
      } catch {
        setRestaurants([])
      }
    }

    fetchRestaurants()
  }, [])

  const filteredPurchases = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return purchases.filter((item) => {
      const matchesSearch =
        !query ||
        [
          item.referenceId,
          item.customerName,
          item.restaurant,
          item.planTitle,
          item.paymentMethod,
        ].some((value) => String(value || "").toLowerCase().includes(query))

      const matchesRestaurant =
        filters.restaurant === "All restaurants" ||
        String(item.restaurant || "") === String(
          restaurants.find((restaurant) => String(restaurant._id) === String(filters.restaurant))?.restaurantName || ""
        )

      const matchesStatus =
        filters.status === "All Status" ||
        String(item.status || "").toLowerCase() === filters.status.toLowerCase()

      return matchesSearch && matchesRestaurant && matchesStatus
    })
  }, [purchases, searchQuery, filters, restaurants])

  const stats = useMemo(() => {
    return filteredPurchases.reduce(
      (acc, item) => {
        acc.total += 1
        acc.totalPaid += Number(item.customerPaymentAmount || 0)
        acc.totalGst += Number(item.vatTax || 0)
        acc.totalPlatformFee += Number(item.platformFee || 0)
        return acc
      },
      { total: 0, totalPaid: 0, totalGst: 0, totalPlatformFee: 0 }
    )
  }, [filteredPurchases])

  const totalPages = Math.max(1, Math.ceil(filteredPurchases.length / PAGE_SIZE))

  const paginatedPurchases = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages)
    const start = (safePage - 1) * PAGE_SIZE
    return filteredPurchases.slice(start, start + PAGE_SIZE)
  }, [filteredPurchases, currentPage, totalPages])

  const activeFiltersCount =
    (filters.restaurant !== "All restaurants" ? 1 : 0) +
    (filters.status !== "All Status" ? 1 : 0)

  const handleExport = (format) => {
    if (!filteredPurchases.length) {
      toast.error("No data to export")
      return
    }

    const exportRows = filteredPurchases.map((item, index) => ({
      si: index + 1,
      referenceId: item.referenceId || "N/A",
      customerName: item.customerName || "N/A",
      restaurant: item.restaurant || "N/A",
      planTitle: item.planTitle || "N/A",
      mealValue: Number(item.mealValue || 0).toFixed(2),
      couponDiscount: Number(item.couponDiscount || 0).toFixed(2),
      vatTax: Number(item.vatTax || 0).toFixed(2),
      deliveryCharge: Number(item.deliveryCharge || 0).toFixed(2),
      platformFee: Number(item.platformFee || 0).toFixed(2),
      customerPaymentAmount: Number(item.customerPaymentAmount || 0).toFixed(2),
      paymentMethod: String(item.paymentMethod || "unknown"),
      status: item.status || "N/A",
    }))

    const headers = [
      { key: "si", label: "SI" },
      { key: "referenceId", label: "Subscription Ref" },
      { key: "customerName", label: "Customer" },
      { key: "restaurant", label: "Restaurant" },
      { key: "planTitle", label: "Plan" },
      { key: "mealValue", label: "Food Value" },
      { key: "couponDiscount", label: "Coupon" },
      { key: "vatTax", label: "GST" },
      { key: "deliveryCharge", label: "Delivery" },
      { key: "platformFee", label: "Platform Fee" },
      { key: "customerPaymentAmount", label: "Total Paid" },
      { key: "paymentMethod", label: "Payment Method" },
      { key: "status", label: "Status" },
    ]

    switch (format) {
      case "csv": exportReportsToCSV(exportRows, headers, "subscription_purchase_report"); break
      case "excel": exportReportsToExcel(exportRows, headers, "subscription_purchase_report"); break
      case "pdf": exportReportsToPDF(exportRows, headers, "subscription_purchase_report", "Subscription Purchase Report"); break
      case "json": exportReportsToJSON(exportRows, "subscription_purchase_report"); break
    }
  }

  const formatAmount = (amount) =>
    `Rs. ${Number(amount || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`

  const handleResetFilters = () => {
    setFilters({
      restaurant: "All restaurants",
      status: "All Status",
    })
    setSearchQuery("")
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
          <p className="text-gray-600">Loading subscription purchase report...</p>
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
            <h1 className="text-lg font-bold text-slate-900">Subscription Purchase Report</h1>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 mb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <select
                value={filters.restaurant}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, restaurant: e.target.value }))
                  setCurrentPage(1)
                }}
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
                value={filters.status}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, status: e.target.value }))
                  setCurrentPage(1)
                }}
                className="w-full px-2.5 py-1.5 pr-5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs appearance-none cursor-pointer"
              >
                <option value="All Status">All Status</option>
                <option value="paid">Paid</option>
                <option value="refunded">Refunded</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
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
              className={`px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white transition-all whitespace-nowrap relative ${
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
          <StatCard label="Total Purchases" value={stats.total} tone="blue" />
          <StatCard label="Total Collected" value={formatAmount(stats.totalPaid)} tone="green" />
          <StatCard label="GST Collected" value={formatAmount(stats.totalGst)} tone="emerald" />
          <StatCard label="Platform Fee Collected" value={formatAmount(stats.totalPlatformFee)} tone="amber" />
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <h2 className="text-base font-bold text-slate-900">
              Subscription Purchases <span className="text-blue-600">{filteredPurchases.length}</span>
            </h2>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:flex-initial min-w-[220px]">
                <input
                  type="text"
                  placeholder="Search by ref, customer, restaurant"
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
                <DropdownMenuContent align="end" className="w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
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

          {isRefreshing && (
            <div className="mb-3 flex items-center gap-2 text-[11px] text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
              Updating report...
            </div>
          )}

          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full" style={{ tableLayout: "fixed", width: "100%" }}>
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "4%" }}>SI</th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "9%" }}>Ref</th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "10%" }}>Customer</th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "10%" }}>Restaurant</th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "9%" }}>Plan</th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "7%" }}>Food</th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "6%" }}>Coupon</th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "6%" }}>GST</th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "7%" }}>Delivery</th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "7%" }}>Platform</th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "8%" }}>Total Paid</th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "8%" }}>Method</th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "9%" }}>Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {paginatedPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <p className="text-lg font-semibold text-slate-700 mb-1">No Data Found</p>
                        <p className="text-sm text-slate-500">No subscription purchases match your filters</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedPurchases.map((item, index) => (
                    <tr key={item.id || item.referenceId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-1.5 py-1 text-[10px] text-slate-700">{(currentPage - 1) * PAGE_SIZE + index + 1}</td>
                      <td className="px-1.5 py-1 text-[10px] text-slate-700">{item.referenceId || "N/A"}</td>
                      <td className="px-1.5 py-1 text-[10px] text-slate-700 truncate">{item.customerName || "N/A"}</td>
                      <td className="px-1.5 py-1 text-[10px] text-slate-700 truncate">{item.restaurant || "N/A"}</td>
                      <td className="px-1.5 py-1 text-[10px] text-slate-700 truncate">{item.planTitle || "N/A"}</td>
                      <td className="px-1.5 py-1 text-[10px] text-slate-700">{formatAmount(item.mealValue || 0)}</td>
                      <td className="px-1.5 py-1 text-[10px] text-slate-700">{formatAmount(item.couponDiscount || 0)}</td>
                      <td className="px-1.5 py-1 text-[10px] text-slate-700">{formatAmount(item.vatTax || 0)}</td>
                      <td className="px-1.5 py-1 text-[10px] text-slate-700">{formatAmount(item.deliveryCharge || 0)}</td>
                      <td className="px-1.5 py-1 text-[10px] text-slate-700">{formatAmount(item.platformFee || 0)}</td>
                      <td className="px-1.5 py-1 text-[10px] font-medium text-slate-900">{formatAmount(item.customerPaymentAmount || 0)}</td>
                      <td className="px-1.5 py-1 text-[10px] text-slate-700 capitalize">{String(item.paymentMethod || "unknown").replace(/_/g, " ")}</td>
                      <td className="px-1.5 py-1">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-slate-100 text-slate-700 uppercase">
                          {item.status || "N/A"}
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
              Showing <span className="font-semibold text-slate-700">{paginatedPurchases.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} - {(currentPage - 1) * PAGE_SIZE + paginatedPurchases.length}</span> of <span className="font-semibold text-slate-700">{filteredPurchases.length}</span> purchases
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
        <DialogContent className="max-w-md bg-white p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Report Settings
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            <p className="text-sm text-slate-700">
              Subscription purchase report settings and preferences will be available here.
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

function StatCard({ label, value, tone }) {
  const toneMap = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    green: "bg-green-50 text-green-700 border-green-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
  }

  return (
    <div className={`rounded-lg border p-3 shadow-sm ${toneMap[tone] || toneMap.blue}`}>
      <p className="text-[11px] font-medium opacity-80">{label}</p>
      <p className="mt-1 text-base font-bold">{value}</p>
    </div>
  )
}
