import { useEffect, useMemo, useState } from "react"
import { Calendar, CheckCircle, Loader2, Package, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { adminAPI } from "@food/api"
import OrdersTopbar from "@food/components/admin/orders/OrdersTopbar"
import SubscriptionOrdersTable from "@food/components/admin/orders/SubscriptionOrdersTable"
import SubscriptionFilterPanel from "@food/components/admin/orders/SubscriptionFilterPanel"
import ViewSubscriptionDialog from "@food/components/admin/orders/ViewSubscriptionDialog"
import SettingsDialog from "@food/components/admin/orders/SettingsDialog"

export default function SubscriptionOrders() {
  const [subscriptions, setSubscriptions] = useState([])
  const [stats, setStats] = useState({ total: 0, totalAmount: 0, byStatus: {} })
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filters, setFilters] = useState({ status: "", orderType: "", restaurant: "" })
  const [appliedFilters, setAppliedFilters] = useState({ status: "", orderType: "", restaurant: "" })
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [selectedSubscription, setSelectedSubscription] = useState(null)
  const [visibleColumns, setVisibleColumns] = useState({
    si: true,
    subscriptionId: true,
    orderType: true,
    duration: true,
    restaurant: true,
    customer: true,
    status: true,
    actions: true,
  })

  const fetchSubscriptions = async () => {
    try {
      setIsLoading(true)
      const response = await adminAPI.getSubscriptions({ page: 1, limit: 1000 })
      const payload = response?.data?.data || {}
      const rows = payload.subscriptions || payload.data || []
      setSubscriptions(Array.isArray(rows) ? rows : [])
      setStats(payload.stats || { total: rows.length, totalAmount: 0, byStatus: {} })
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to load subscriptions")
      setSubscriptions([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSubscriptions()
  }, [])

  const restaurants = useMemo(() => {
    return [...new Set(subscriptions.map((item) => item.restaurant).filter(Boolean))]
  }, [subscriptions])

  const filteredData = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return subscriptions.filter((item) => {
      const matchesSearch = !query || [
        item.subscriptionId,
        item.shortId,
        item.customerName,
        item.customerPhone,
        item.restaurant,
        item.planTitle,
        item.dishName,
      ].some((value) => String(value || "").toLowerCase().includes(query))

      const matchesStatus =
        !appliedFilters.status ||
        String(item.statusLabel || item.status).toLowerCase() === appliedFilters.status.toLowerCase()
      const matchesType =
        !appliedFilters.orderType ||
        String(item.orderType || "").toLowerCase() === appliedFilters.orderType.toLowerCase()
      const matchesRestaurant =
        !appliedFilters.restaurant || item.restaurant === appliedFilters.restaurant

      return matchesSearch && matchesStatus && matchesType && matchesRestaurant
    })
  }, [subscriptions, searchQuery, appliedFilters])

  const pageStats = useMemo(() => {
    const active = subscriptions.filter((item) => item.status === "active").length
    const expired = subscriptions.filter((item) => item.status === "expired").length
    const delivered = subscriptions.reduce((sum, item) => sum + Number(item.delivered || 0), 0)
    return { active, expired, delivered }
  }, [subscriptions])

  const activeFiltersCount = Object.values(appliedFilters).filter(Boolean).length

  const toggleColumn = (key) => {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const resetColumns = () => {
    setVisibleColumns({
      si: true,
      subscriptionId: true,
      orderType: true,
      duration: true,
      restaurant: true,
      customer: true,
      status: true,
      actions: true,
    })
  }

  const handleViewSubscription = async (subscription) => {
    try {
      setSelectedSubscription(subscription)
      setIsViewOpen(true)
      const response = await adminAPI.getSubscriptionById(subscription.id || subscription.subscriptionId)
      const payload = response?.data?.data || {}
      setSelectedSubscription({
        ...(payload.subscription || subscription),
        schedules: payload.schedules || [],
      })
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to load subscription details")
    }
  }

  const handlePrintSubscription = (subscription) => {
    window.print()
    setSelectedSubscription(subscription)
  }

  const handleExport = () => {
    const header = ["Subscription ID", "Customer", "Phone", "Restaurant", "Plan", "Status", "Amount"]
    const rows = filteredData.map((item) => [
      item.subscriptionId,
      item.customerName,
      item.customerPhone,
      item.restaurant,
      item.planTitle || item.duration,
      item.statusLabel || item.status,
      `${item.currency || "INR"} ${Number(item.totalAmount || 0)}`,
    ])
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "subscriptions.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <OrdersTopbar
        title="All Subscriptions"
        count={filteredData.length}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onFilterClick={() => setIsFilterOpen(true)}
        activeFiltersCount={activeFiltersCount}
        onExport={handleExport}
        onSettingsClick={() => setIsSettingsOpen(true)}
      />

      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={fetchSubscriptions}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Subscriptions" value={stats.total || subscriptions.length} icon={Package} color="blue" />
        <StatCard label="Active" value={pageStats.active} icon={CheckCircle} color="emerald" />
        <StatCard label="Expired" value={pageStats.expired} icon={Calendar} color="sky" />
        <StatCard label="Meals Sent" value={pageStats.delivered} icon={Package} color="orange" />
      </div>

      <SubscriptionFilterPanel
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        setFilters={setFilters}
        onApply={() => {
          setAppliedFilters(filters)
          setIsFilterOpen(false)
        }}
        onReset={() => {
          const reset = { status: "", orderType: "", restaurant: "" }
          setFilters(reset)
          setAppliedFilters(reset)
        }}
        restaurants={restaurants}
      />

      <SettingsDialog
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        visibleColumns={visibleColumns}
        toggleColumn={toggleColumn}
        resetColumns={resetColumns}
        columnsConfig={{
          si: "Serial Number",
          subscriptionId: "Subscription ID",
          orderType: "Order Type",
          duration: "Duration",
          restaurant: "Restaurant",
          customer: "Customer",
          status: "Status",
          actions: "Actions",
        }}
      />

      <ViewSubscriptionDialog
        isOpen={isViewOpen}
        onOpenChange={setIsViewOpen}
        order={selectedSubscription}
      />

      {isLoading ? (
        <div className="flex min-h-80 items-center justify-center rounded-xl border border-slate-200 bg-white">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      ) : (
        <SubscriptionOrdersTable
          orders={filteredData}
          visibleColumns={visibleColumns}
          onViewOrder={handleViewSubscription}
          onPrintOrder={handlePrintSubscription}
        />
      )}
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color }) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    sky: "bg-sky-50 text-sky-600",
    orange: "bg-orange-50 text-orange-600",
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colorMap[color] || colorMap.blue}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  )
}

