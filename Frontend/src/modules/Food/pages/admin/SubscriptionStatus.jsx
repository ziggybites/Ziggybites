import { useEffect, useMemo, useState } from "react"
import { CalendarDays, CheckCircle2, Clock, Loader2, Package, Search } from "lucide-react"
import { toast } from "sonner"
import { adminAPI } from "@food/api"

const formatDate = (value) => {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

const statusClass = (status) => {
  const normalized = String(status || "").toLowerCase()
  if (normalized === "active") return "bg-emerald-100 text-emerald-700"
  if (normalized === "expired") return "bg-sky-100 text-sky-700"
  if (normalized.includes("pending")) return "bg-amber-100 text-amber-700"
  if (normalized.includes("failed") || normalized.includes("cancel")) return "bg-rose-100 text-rose-700"
  return "bg-slate-100 text-slate-700"
}

export default function SubscriptionStatus() {
  const [subscriptions, setSubscriptions] = useState([])
  const [selectedId, setSelectedId] = useState("")
  const [detail, setDetail] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [search, setSearch] = useState("")

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true)
        const response = await adminAPI.getSubscriptions({ page: 1, limit: 1000 })
        const rows = response?.data?.data?.subscriptions || response?.data?.data?.data || []
        setSubscriptions(Array.isArray(rows) ? rows : [])
        if (rows?.length) setSelectedId(rows[0].id || rows[0].subscriptionId)
      } catch (error) {
        toast.error(error?.response?.data?.message || "Unable to load subscriptions")
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }

    const loadDetail = async () => {
      try {
        setIsDetailLoading(true)
        const response = await adminAPI.getSubscriptionById(selectedId)
        setDetail(response?.data?.data || null)
      } catch (error) {
        toast.error(error?.response?.data?.message || "Unable to load subscription status")
        setDetail(null)
      } finally {
        setIsDetailLoading(false)
      }
    }

    loadDetail()
  }, [selectedId])

  const filteredSubscriptions = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return subscriptions
    return subscriptions.filter((item) =>
      [
        item.shortId,
        item.subscriptionId,
        item.customerName,
        item.customerPhone,
        item.restaurant,
        item.planTitle,
      ].some((value) => String(value || "").toLowerCase().includes(query)),
    )
  }, [subscriptions, search])

  const selected = detail?.subscription || subscriptions.find((item) => (item.id || item.subscriptionId) === selectedId)
  const schedules = detail?.schedules || []

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Subscription Status</h1>
        <p className="mt-1 text-sm text-slate-500">Select a subscription to inspect customer, payment, credit, and meal status from the database.</p>
      </div>

      {isLoading ? (
        <div className="flex min-h-96 items-center justify-center rounded-xl border border-slate-200 bg-white">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
          <aside className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search subscriptions"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-2">
              {filteredSubscriptions.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">No subscriptions found</div>
              ) : (
                filteredSubscriptions.map((item) => {
                  const id = item.id || item.subscriptionId
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedId(id)}
                      className={`mb-2 w-full rounded-lg border p-3 text-left transition ${
                        selectedId === id
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{item.shortId || id}</p>
                          <p className="truncate text-xs text-slate-500">{item.customerName || "Customer"} - {item.restaurant || "Restaurant"}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass(item.status)}`}>
                          {item.statusLabel || item.status}
                        </span>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </aside>

          <main className="space-y-6">
            {isDetailLoading ? (
              <div className="flex min-h-96 items-center justify-center rounded-xl border border-slate-200 bg-white">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
              </div>
            ) : !selected ? (
              <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">Select a subscription</div>
            ) : (
              <>
                <section className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-500">{selected.shortId || selected.subscriptionId}</p>
                      <h2 className="mt-1 text-xl font-bold text-slate-900">{selected.planTitle || selected.dishName || "Subscription"}</h2>
                      <p className="mt-1 text-sm text-slate-500">{selected.customerName || "Customer"} - {selected.customerPhone || "No phone"}</p>
                    </div>
                    <span className={`w-fit rounded-full px-3 py-1 text-sm font-semibold ${statusClass(selected.status)}`}>
                      {selected.statusLabel || selected.status}
                    </span>
                  </div>
                </section>

                <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <Metric label="Total Meals" value={selected.totalOrders || 0} icon={Package} />
                  <Metric label="Sent" value={selected.delivered || 0} icon={CheckCircle2} />
                  <Metric label="Scheduled" value={selected.scheduled || 0} icon={Clock} />
                  <Metric label="Remaining Credits" value={selected.remainingCredits || 0} icon={CalendarDays} />
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-5">
                  <h3 className="mb-4 text-base font-bold text-slate-900">Details</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <Info label="Restaurant" value={selected.restaurant} />
                    <Info label="Payment Status" value={selected.paymentStatus} />
                    <Info label="Amount" value={`${selected.currency || "INR"} ${Number(selected.totalAmount || 0).toFixed(2)}`} />
                    <Info label="Duration" value={selected.duration} />
                    <Info label="Start Date" value={formatDate(selected.startDate)} />
                    <Info label="End Date" value={formatDate(selected.endDate)} />
                    <Info label="Meals" value={(selected.meals || []).join(", ") || "-"} />
                    <Info label="Dish" value={selected.dishName} />
                    <Info label="Address" value={selected.deliveryAddress?.street || "-"} />
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 p-5">
                    <h3 className="text-base font-bold text-slate-900">Meal Schedule Status</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px]">
                      <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-5 py-3">Date</th>
                          <th className="px-5 py-3">Meal</th>
                          <th className="px-5 py-3">Dish</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3">Order</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {schedules.length === 0 ? (
                          <tr>
                            <td className="px-5 py-8 text-center text-sm text-slate-500" colSpan={5}>No schedule records found</td>
                          </tr>
                        ) : (
                          schedules.slice(0, 100).map((schedule) => (
                            <tr key={schedule.scheduleId || schedule._id} className="text-sm">
                              <td className="px-5 py-3 text-slate-700">{formatDate(schedule.serviceDate)}</td>
                              <td className="px-5 py-3 font-medium text-slate-900">{schedule.mealName}</td>
                              <td className="px-5 py-3 text-slate-700">{schedule.dishName}</td>
                              <td className="px-5 py-3">
                                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(schedule.status)}`}>
                                  {String(schedule.status || "").replace(/_/g, " ")}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-slate-700">{schedule.orderId?.order_id || schedule.orderId?._id || "-"}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </main>
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
        </div>
        <div className="rounded-lg bg-emerald-50 p-3 text-emerald-600">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-slate-900">{value || "-"}</p>
    </div>
  )
}
