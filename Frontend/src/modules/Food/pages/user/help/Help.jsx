import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowLeft,
  Search,
  HelpCircle,
  Building2,
  Package,
  CreditCard,
  User,
  Truck,
  MessageCircle,
  ShoppingBag,
  Phone,
  Mail,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  FileText,
  Shield,
  Clock,
  MapPin
} from "lucide-react"
import AnimatedPage from "@food/components/user/AnimatedPage"
import ScrollReveal from "@food/components/user/ScrollReveal"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@food/components/ui/card"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Textarea } from "@food/components/ui/textarea"
import { Badge } from "@food/components/ui/badge"
import { getCachedSettings, loadBusinessSettings } from "@food/utils/businessSettings"
import { orderAPI, restaurantAPI, supportAPI, authAPI } from "@food/api"
import { toast } from "sonner"

const helpCategories = [
  {
    id: "ordering",
    title: "Ordering",
    icon: Package,
    color: "text-primary",
    bgColor: "bg-orange-50",
    description: "Learn how to place and manage orders",
    topics: [
      {
        question: "How do I place an order?",
        answer: "To place an order, browse restaurants, add items to your cart, and proceed to checkout. Select your delivery address and payment method, then confirm your order."
      },
      {
        question: "Can I modify or cancel my order?",
        answer: "You can modify or cancel your order within 5 minutes of placing it. After that, please contact support for assistance."
      },
      {
        question: "How do I track my order?",
        answer: "Go to 'My Orders' in your profile, select the order you want to track, and you'll see real-time updates on your order status."
      },
      {
        question: "What is the minimum order amount?",
        answer: "The minimum order amount varies by restaurant, typically ranging from $10 to $15. This information is displayed on each restaurant's page."
      }
    ]
  },
  {
    id: "payments",
    title: "Payments",
    icon: CreditCard,
    color: "text-primary",
    bgColor: "bg-orange-50",
    description: "Payment methods and billing questions",
    topics: [
      {
        question: "What payment methods do you accept?",
        answer: "We accept all major credit cards, debit cards, digital wallets (Apple Pay, Google Pay), and cash on delivery in select areas."
      },
      {
        question: "Is my payment information secure?",
        answer: "Yes, we use industry-standard encryption to protect your payment information. We never store your full card details."
      },
      {
        question: "Can I get a refund?",
        answer: "Refunds are processed for cancelled orders, incorrect items, or quality issues. Contact support within 24 hours of delivery for assistance."
      },
      {
        question: "Why was my payment declined?",
        answer: "Payment can be declined due to insufficient funds, incorrect card details, or bank restrictions. Please verify your payment method and try again."
      }
    ]
  },
  {
    id: "delivery",
    title: "Delivery",
    icon: Truck,
    color: "text-#55254b",
    bgColor: "bg-orange-50",
    description: "Delivery times, fees, and tracking",
    topics: [
      {
        question: "What are your delivery times?",
        answer: "Delivery times typically range from 30-60 minutes, depending on the restaurant and your location. Estimated time is shown before checkout."
      },
      {
        question: "How much is the delivery fee?",
        answer: "Delivery fees vary by restaurant and distance, typically ranging from $2.99 to $5.99. The exact fee is shown before you place your order."
      },
      {
        question: "Can I schedule a delivery for later?",
        answer: "Yes, you can schedule orders for up to 7 days in advance during checkout. Select your preferred delivery time."
      },
      {
        question: "What if my order is late?",
        answer: "If your order is significantly delayed, contact support. We'll investigate and may provide compensation or a refund."
      }
    ]
  },
  {
    id: "account",
    title: "Account & Profile",
    icon: User,
    color: "text-primary",
    bgColor: "bg-orange-50",
    description: "Manage your account and preferences",
    topics: [
      {
        question: "How do I update my profile?",
        answer: "Go to 'Profile' in the menu, then select 'Edit Profile' to update your name, email, phone number, and other information."
      },
      {
        question: "How do I change my password?",
        answer: "Go to Profile > Settings > Security to change your password. You'll need to verify your current password first."
      },
      {
        question: "How do I manage my addresses?",
        answer: "Navigate to Profile > Addresses to view, add, edit, or delete delivery addresses. Set a default address for faster checkout."
      },
      {
        question: "How do I save my favorite restaurants?",
        answer: "Click the heart icon on any restaurant page to add it to your favorites. View all favorites in Profile > Favorites."
      }
    ]
  },
  {
    id: "refunds",
    title: "Refunds & Returns",
    icon: Shield,
    color: "text-primary",
    bgColor: "bg-orange-50",
    description: "Refund policy and return process",
    topics: [
      {
        question: "What is your refund policy?",
        answer: "We offer full refunds for cancelled orders, incorrect items, or quality issues reported within 24 hours of delivery."
      },
      {
        question: "How long do refunds take?",
        answer: "Refunds are typically processed within 5-7 business days, depending on your payment method. You'll receive a confirmation email."
      },
      {
        question: "Can I return food items?",
        answer: "Due to food safety regulations, we cannot accept returns of food items. However, we'll provide a full refund for quality issues."
      },
      {
        question: "What if I received the wrong order?",
        answer: "Contact support immediately with your order number. We'll arrange a replacement or full refund, and you can keep the incorrect order."
      }
    ]
  },
  {
    id: "general",
    title: "General Questions",
    icon: HelpCircle,
    color: "text-gray-600",
    bgColor: "bg-gray-50",
    description: "Other frequently asked questions",
    topics: [
      {
        question: "Do you offer discounts or promotions?",
        answer: "Yes! Check the 'Offers' section for current promotions, discount codes, and special deals from restaurants."
      },
      {
        question: "How do I contact customer support?",
        answer: "You can contact us via phone, email, or live chat. Visit the 'Contact Support' section below for all contact options."
      },
      {
        question: "Is there a mobile app?",
        answer: "Yes, our mobile app is available for iOS and Android. Download it from the App Store or Google Play for the best experience."
      },
      {
        question: "Do you deliver to my area?",
        answer: "Enter your delivery address to see available restaurants in your area. We're constantly expanding our delivery zones."
      }
    ]
  }
]

export default function Help() {
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedCategory, setExpandedCategory] = useState(null)
  const [expandedQuestion, setExpandedQuestion] = useState(null)
  const helpBackState = { backTo: "/food/user/help&support" }
  const [supportStep, setSupportStep] = useState("pick")
  const [orders, setOrders] = useState([])
  const [restaurants, setRestaurants] = useState([])
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [selectedRestaurant, setSelectedRestaurant] = useState(null)
  const [issueType, setIssueType] = useState("")
  const [subject, setSubject] = useState("")
  const [description, setDescription] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [tickets, setTickets] = useState([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [orderSearch, setOrderSearch] = useState("")
  const [restaurantSearch, setRestaurantSearch] = useState("")
  const [supportDetails, setSupportDetails] = useState(() => {
    const settings = getCachedSettings() || {}
    return {
      supportPhone: settings.supportPhone || settings.phone?.number || "",
      supportEmail: settings.supportEmail || settings.email || "",
      supportHours: settings.supportHours || "Our support team is here to assist you 24/7",
    }
  })

  useEffect(() => {
    let mounted = true

    const applySettings = (settings = {}) => {
      if (!mounted || !settings) return
      setSupportDetails({
        supportPhone: settings.supportPhone || settings.phone?.number || "",
        supportEmail: settings.supportEmail || settings.email || "",
        supportHours: settings.supportHours || "Our support team is here to assist you 24/7",
      })
    }

    applySettings(getCachedSettings() || {})
    loadBusinessSettings().then(applySettings).catch(() => {})

    const handleSettingsUpdate = () => applySettings(getCachedSettings() || {})
    window.addEventListener("businessSettingsUpdated", handleSettingsUpdate)

    return () => {
      mounted = false
      window.removeEventListener("businessSettingsUpdated", handleSettingsUpdate)
    }
  }, [])

  useEffect(() => {
    setLoadingTickets(true)
    authAPI
      .getCurrentUser()
      .catch(() => null)
      .finally(async () => {
        try {
          const res = await supportAPI.getMyTickets()
          const list = res?.data?.data?.tickets || res?.data?.tickets || []
          setTickets(list)
        } catch (_) {
        } finally {
          setLoadingTickets(false)
        }
      })
  }, [])

  const filteredCategories = helpCategories.filter(category =>
    category.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    category.topics.some(topic =>
      topic.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      topic.answer.toLowerCase().includes(searchQuery.toLowerCase())
    )
  )

  const toggleCategory = (categoryId) => {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId)
    setExpandedQuestion(null)
  }

  const toggleQuestion = (questionIndex) => {
    setExpandedQuestion(expandedQuestion === questionIndex ? null : questionIndex)
  }

  const supportPhoneHref = supportDetails.supportPhone
    ? `tel:${String(supportDetails.supportPhone).replace(/[^\d+]/g, "")}`
    : null
  const supportEmailHref = supportDetails.supportEmail
    ? `mailto:${supportDetails.supportEmail}`
    : null

  const orderIssues = ["Item missing", "Wrong item", "Not delivered", "Payment issue"]
  const restaurantIssues = ["Bad service", "Wrong info", "Other"]

  const fetchOrders = async () => {
    try {
      const res = await orderAPI.getOrders({ limit: 10, page: 1 })
      const list = res?.data?.data?.orders || res?.data?.orders || []
      setOrders(list)
    } catch {
      toast.error("Failed to load orders")
    }
  }

  const fetchRestaurants = async () => {
    try {
      const res = await restaurantAPI.getRestaurants({ limit: 20, page: 1 })
      const list = res?.data?.data?.restaurants || res?.data?.restaurants || []
      setRestaurants(list)
    } catch {
      toast.error("Failed to load restaurants")
    }
  }

  const resetSupportFlow = () => {
    setSupportStep("pick")
    setSelectedOrder(null)
    setSelectedRestaurant(null)
    setIssueType("")
    setSubject("")
    setDescription("")
    setOrderSearch("")
    setRestaurantSearch("")
  }

  const handlePickSupportType = (type) => {
    resetSupportFlow()
    if (type === "order") {
      fetchOrders()
      setSupportStep("choose_order")
      return
    }
    if (type === "restaurant") {
      fetchRestaurants()
      setSupportStep("choose_restaurant")
      return
    }
    setSupportStep("other_form")
  }

  const submitTicket = async (payload) => {
    setSubmitting(true)
    try {
      const res = await supportAPI.createTicket(payload)
      const data = res?.data
      if (!data?.success) throw new Error(data?.message || "Failed to create ticket")
      toast.success("Ticket created")
      setTickets((prev) => [data?.data?.ticket, ...prev].filter(Boolean))
      resetSupportFlow()
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Failed to create ticket")
    } finally {
      setSubmitting(false)
    }
  }

  const statusClasses = (status) => {
    const normalized = String(status || "").toLowerCase()
    if (normalized === "resolved" || normalized === "closed") return "bg-green-100 text-green-700"
    if (normalized === "open") return "bg-amber-100 text-amber-700"
    return "bg-slate-100 text-slate-700"
  }

  const getOrderLabel = (order) => {
    const restaurantName =
      order?.restaurantId?.restaurantName ||
      order?.restaurantId?.name ||
      order?.restaurantName ||
      order?.restaurant?.restaurantName ||
      "Restaurant"
    const dateValue = order?.createdAt || order?.date
    const dateLabel = dateValue ? new Date(dateValue).toLocaleDateString() : "No date"
    const amount = order?.pricing?.total ?? order?.total ?? 0
    const itemNames = (order?.items || []).map((item) => item?.name || item?.foodName).filter(Boolean).join(", ")
    const itemString = itemNames ? ` - ${itemNames}` : ""
    return `${restaurantName}${itemString} - ${dateLabel} - Rs.${amount}`
  }

  const getRestaurantLabel = (restaurant) => {
    const name = restaurant?.restaurantName || restaurant?.name || "Restaurant"
    const location = restaurant?.city || restaurant?.area || ""
    return `${name}${location ? ` - ${location}` : ""}`
  }

  const filteredOrders = orders.filter((order) => {
    const q = orderSearch.trim().toLowerCase()
    if (!q) return true
    return getOrderLabel(order).toLowerCase().includes(q)
  })

  const filteredRestaurants = restaurants.filter((restaurant) => {
    const q = restaurantSearch.trim().toLowerCase()
    if (!q) return true
    return getRestaurantLabel(restaurant).toLowerCase().includes(q)
  })

  return (
    <AnimatedPage className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.16),_transparent_28%),linear-gradient(180deg,_#fffdf7_0%,_#ffffff_45%,_#fff8ef_100%)] p-4 md:p-6 lg:p-8 dark:bg-[#0a0a0a]">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto space-y-5 md:space-y-6 lg:space-y-7">
        <ScrollReveal>
          <div className="relative overflow-hidden rounded-[28px] border border-amber-100 bg-white/95 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500" />
            <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-amber-100/70 blur-3xl" />
            <div className="absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-orange-100/60 blur-2xl" />
            <div className="relative p-5 md:p-7 lg:p-9">
            <div className="flex items-center gap-3 md:gap-4 mb-6">
              <Link to="/food/user">
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full border border-slate-200 bg-white/80 p-0 text-slate-700 shadow-sm hover:bg-slate-50">
                  <ArrowLeft className="h-5 w-5 md:h-6 md:w-6" />
                </Button>
              </Link>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-600">Customer Care</p>
                <h1 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl lg:text-5xl">Help & Support</h1>
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-[1.5fr_1fr] md:items-end">
              <div className="space-y-3">
                <p className="max-w-2xl text-sm leading-6 text-slate-600 md:text-base md:leading-7">
                  Find answers faster, raise a ticket when needed, and reach the right team without jumping between pages.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge className="rounded-full bg-amber-100 px-3 py-1 text-amber-800 hover:bg-amber-100">FAQs</Badge>
                  <Badge className="rounded-full bg-orange-100 px-3 py-1 text-orange-800 hover:bg-orange-100">Ticket Support</Badge>
                  <Badge className="rounded-full bg-slate-100 px-3 py-1 text-slate-700 hover:bg-slate-100">Order Help</Badge>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-center">
                  <p className="text-xl font-bold text-slate-900">{helpCategories.length}</p>
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">Categories</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-center">
                  <p className="text-xl font-bold text-slate-900">24/7</p>
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">Coverage</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-center">
                  <p className="text-xl font-bold text-slate-900">{tickets.length}</p>
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">My Tickets</p>
                </div>
              </div>
            </div>
          </div>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <Card className="overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
            <CardContent className="p-4 md:p-5 lg:p-6">
              <div className="relative">
                <Search className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 md:h-6 md:w-6 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search for help topics, questions, or keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-12 rounded-2xl border-slate-200 bg-slate-50 pl-10 text-base shadow-none focus-visible:ring-1 focus-visible:ring-orange-400 md:h-14 md:pl-12 md:text-lg"
                />
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>

        <ScrollReveal delay={0.2}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 lg:gap-6">
            <Link to="/food/user/orders" state={helpBackState}>
              <Card className="h-full rounded-3xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(15,23,42,0.08)]">
              <CardContent className="p-5 md:p-6">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="rounded-2xl bg-amber-50 p-3">
                    <Package className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 md:text-base">Track Your Order</h3>
                    <p className="text-xs text-slate-500 md:text-sm">View order status and delivery updates</p>
                  </div>
                </div>
              </CardContent>
              </Card>
            </Link>
            <Link to="/food/user/profile" state={helpBackState}>
              <Card className="h-full rounded-3xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(15,23,42,0.08)]">
              <CardContent className="p-5 md:p-6">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="rounded-2xl bg-orange-50 p-3">
                    <User className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 md:text-base">Manage Account</h3>
                    <p className="text-xs text-slate-500 md:text-sm">Update profile, addresses and settings</p>
                  </div>
                </div>
              </CardContent>
              </Card>
            </Link>
            <Card className="h-full rounded-3xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
              <CardContent className="p-5 md:p-6">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="rounded-2xl bg-rose-50 p-3">
                    <MessageCircle className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 md:text-base">Contact Support</h3>
                    <p className="text-xs text-slate-500 md:text-sm">Raise a ticket and follow replies here</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.3}>
          <div className="space-y-4 md:space-y-5 lg:space-y-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Knowledge Base</p>
                <h2 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">Browse by Category</h2>
              </div>
              <p className="hidden text-sm text-slate-500 md:block">Professional help, clearly organized</p>
            </div>
            {filteredCategories.length === 0 ? (
              <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                <CardContent className="py-12 text-center">
                  <HelpCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-semibold mb-2">No results found</p>
                  <p className="text-muted-foreground mb-4">
                    Try searching with different keywords
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setSearchQuery("")}
                  >
                    Clear Search
                  </Button>
                </CardContent>
              </Card>
            ) : (
              filteredCategories.map((category, categoryIndex) => {
                const Icon = category.icon
                const isExpanded = expandedCategory === category.id

                return (
                  <Card key={category.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                    <CardHeader
                      onClick={() => toggleCategory(category.id)}
                      className="cursor-pointer p-5 md:p-6"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 md:gap-4">
                          <div className={`rounded-2xl p-3 ${category.bgColor}`}>
                            <Icon className={`h-5 w-5 md:h-6 md:w-6 ${category.color}`} />
                          </div>
                          <div>
                            <CardTitle className="text-lg text-slate-900 md:text-xl lg:text-2xl">{category.title}</CardTitle>
                            <CardDescription className="text-sm text-slate-500 md:text-base">{category.description}</CardDescription>
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground flex-shrink-0" />
                        )}
                      </div>
                    </CardHeader>
                    {isExpanded && (
                      <CardContent className="space-y-3 border-t border-slate-100 bg-slate-50/55 p-4 pt-4 md:space-y-4 md:p-5 lg:p-6">
                        {category.topics.map((topic, topicIndex) => {
                          const questionIndex = `${category.id}-${topicIndex}`
                          const isQuestionExpanded = expandedQuestion === questionIndex

                          return (
                            <div
                              key={topicIndex}
                              className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                            >
                              <button
                                onClick={() => toggleQuestion(questionIndex)}
                                className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left text-sm text-slate-900 transition-colors hover:bg-slate-50 md:text-base"
                              >
                                <span className="font-semibold pr-4">{topic.question}</span>
                                {isQuestionExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                )}
                              </button>
                              {isQuestionExpanded && (
                                <div className="border-t border-slate-100 bg-slate-50/80 p-4 text-sm leading-6 text-slate-600 md:text-base">
                                  <p>{topic.answer}</p>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </CardContent>
                    )}
                  </Card>
                )
              })
            )}
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.35}>
          <Card className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.06)] dark:border-gray-800 dark:bg-[#1a1a1a]">
            <CardHeader className="p-4 md:p-5 lg:p-6">
              <CardTitle className="flex items-center gap-2 text-xl text-slate-950 md:text-2xl lg:text-3xl dark:text-white">
                <HelpCircle className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                Raise a Support Ticket
              </CardTitle>
              <CardDescription className="text-sm text-slate-500 md:text-base">
                Report order, restaurant, payment, or app issues and track replies in one place.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 md:p-5 lg:p-6">
              {supportStep === "pick" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button onClick={() => handlePickSupportType("order")} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-sm dark:border-slate-700 dark:hover:bg-slate-800">
                    <div className="flex items-center justify-between">
                      <ShoppingBag className="h-5 w-5 text-slate-700 dark:text-slate-200" />
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                    <p className="mt-3 font-semibold text-slate-900 dark:text-white">Order Issue</p>
                    <p className="text-xs text-slate-500 mt-1">Missing item, wrong item, delivery issue</p>
                  </button>

                  <button onClick={() => handlePickSupportType("restaurant")} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-sm dark:border-slate-700 dark:hover:bg-slate-800">
                    <div className="flex items-center justify-between">
                      <Building2 className="h-5 w-5 text-slate-700 dark:text-slate-200" />
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                    <p className="mt-3 font-semibold text-slate-900 dark:text-white">Restaurant Issue</p>
                    <p className="text-xs text-slate-500 mt-1">Service, listing info, behavior report</p>
                  </button>

                  <button onClick={() => handlePickSupportType("other")} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-sm dark:border-slate-700 dark:hover:bg-slate-800">
                    <div className="flex items-center justify-between">
                      <HelpCircle className="h-5 w-5 text-slate-700 dark:text-slate-200" />
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                    <p className="mt-3 font-semibold text-slate-900 dark:text-white">Other Issue</p>
                    <p className="text-xs text-slate-500 mt-1">Account, app, payment or general query</p>
                  </button>
                </div>
              )}

              {supportStep === "choose_order" && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-slate-900 dark:text-white">Select an order</h3>
                  <Input
                    list="help-order-options"
                    value={orderSearch}
                    onChange={(e) => {
                      const value = e.target.value
                      setOrderSearch(value)
                      const selected = filteredOrders.find((order) => getOrderLabel(order) === value)
                      if (selected) {
                        setSelectedOrder(selected)
                        setSupportStep("order_issue")
                      }
                    }}
                    placeholder="Select/search order"
                  />
                  <datalist id="help-order-options">
                    {filteredOrders.map((order) => (
                      <option key={order._id || order.id} value={getOrderLabel(order)} />
                    ))}
                  </datalist>
                  {filteredOrders.length === 0 ? <p className="text-sm text-slate-500">No matching orders found</p> : null}
                  <Button variant="outline" onClick={resetSupportFlow}>Back</Button>
                </div>
              )}

              {supportStep === "order_issue" && selectedOrder && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-slate-900 dark:text-white">Issue type</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {orderIssues.map((item) => (
                      <Button key={item} variant={issueType === item ? "default" : "outline"} onClick={() => setIssueType(item)}>{item}</Button>
                    ))}
                  </div>
                  <Textarea placeholder="Describe the issue (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
                  <div className="flex gap-2">
                    <Button onClick={() => submitTicket({ type: "order", orderId: selectedOrder._id || selectedOrder.id, issueType, description })} disabled={!issueType || submitting}>
                      {submitting ? "Submitting..." : "Submit Ticket"}
                    </Button>
                    <Button variant="outline" onClick={resetSupportFlow}>Cancel</Button>
                  </div>
                </div>
              )}

              {supportStep === "choose_restaurant" && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-slate-900 dark:text-white">Select a restaurant</h3>
                  <Input
                    list="help-restaurant-options"
                    value={restaurantSearch}
                    onChange={(e) => {
                      const value = e.target.value
                      setRestaurantSearch(value)
                      const selected = filteredRestaurants.find((restaurant) => getRestaurantLabel(restaurant) === value)
                      if (selected) {
                        setSelectedRestaurant(selected)
                        setSupportStep("restaurant_issue")
                      }
                    }}
                    placeholder="Select/search restaurant"
                  />
                  <datalist id="help-restaurant-options">
                    {filteredRestaurants.map((restaurant) => (
                      <option key={restaurant._id || restaurant.id} value={getRestaurantLabel(restaurant)} />
                    ))}
                  </datalist>
                  {filteredRestaurants.length === 0 ? <p className="text-sm text-slate-500">No matching restaurants found</p> : null}
                  <Button variant="outline" onClick={resetSupportFlow}>Back</Button>
                </div>
              )}

              {supportStep === "restaurant_issue" && selectedRestaurant && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-slate-900 dark:text-white">Issue type</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {restaurantIssues.map((item) => (
                      <Button key={item} variant={issueType === item ? "default" : "outline"} onClick={() => setIssueType(item)}>{item}</Button>
                    ))}
                  </div>
                  <Textarea placeholder="Describe the issue (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
                  <div className="flex gap-2">
                    <Button onClick={() => submitTicket({ type: "restaurant", restaurantId: selectedRestaurant._id || selectedRestaurant.id, issueType, description })} disabled={!issueType || submitting}>
                      {submitting ? "Submitting..." : "Submit Ticket"}
                    </Button>
                    <Button variant="outline" onClick={resetSupportFlow}>Cancel</Button>
                  </div>
                </div>
              )}

              {supportStep === "other_form" && (
                <div className="space-y-3">
                  <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
                  <Textarea placeholder="Describe your issue" value={description} onChange={(e) => setDescription(e.target.value)} />
                  <div className="flex gap-2">
                    <Button onClick={() => submitTicket({ type: "other", issueType: subject || "Other", description })} disabled={!subject || submitting}>
                      {submitting ? "Submitting..." : "Submit Ticket"}
                    </Button>
                    <Button variant="outline" onClick={resetSupportFlow}>Cancel</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </ScrollReveal>

        {/* Contact Support Section */}
        <ScrollReveal delay={0.4}>
          <Card className="overflow-hidden rounded-3xl border border-amber-200 bg-[linear-gradient(135deg,_#fff7db_0%,_#fff3e8_52%,_#fff_100%)] shadow-[0_16px_40px_rgba(251,146,60,0.12)]">
            <CardHeader className="p-4 md:p-5 lg:p-6">
              <CardTitle className="flex items-center gap-2 text-xl text-slate-950 md:text-2xl lg:text-3xl">
                <MessageCircle className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                Still Need Help?
              </CardTitle>
              <CardDescription className="text-sm text-slate-600 md:text-base">
                {supportDetails.supportHours || "Our support team is here to assist you 24/7"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-5 lg:space-y-6 p-4 md:p-5 lg:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 lg:gap-6">
                <div className="flex items-start gap-3 rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm">
                  <div className="rounded-2xl bg-orange-100 p-2">
                    <Phone className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="mb-1 font-semibold text-slate-900">Phone Support</h3>
                    <p className="mb-2 text-sm text-slate-500">
                      {supportDetails.supportHours || "Call us anytime"}
                    </p>
                    {supportPhoneHref ? (
                      <a
                        href={supportPhoneHref}
                        className="text-sm text-primary hover:underline font-medium"
                      >
                        {supportDetails.supportPhone}
                      </a>
                    ) : (
                      <p className="text-sm text-muted-foreground">Phone support not available</p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm">
                  <div className="rounded-2xl bg-orange-100 p-2">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="mb-1 font-semibold text-slate-900">Email Support</h3>
                    <p className="mb-2 text-sm text-slate-500">
                      We'll respond within 24 hours
                    </p>
                    {supportEmailHref ? (
                      <a
                        href={supportEmailHref}
                        className="text-sm text-primary hover:underline font-medium"
                      >
                        {supportDetails.supportEmail}
                      </a>
                    ) : (
                      <p className="text-sm text-muted-foreground">Email support not available</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="border-t border-amber-200/70 pt-4">
                <p className="mb-3 text-sm text-slate-600">
                  <Clock className="h-4 w-4 inline mr-1" />
                  Average response time: Less than 5 minutes
                </p>
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>

        <ScrollReveal delay={0.45}>
          <Card className="rounded-3xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.05)] dark:border-gray-800 dark:bg-[#1a1a1a]">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Support History</p>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">My Tickets</h3>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {tickets.length}
                </span>
              </div>

              {loadingTickets ? (
                <p className="text-sm text-slate-500">Loading tickets...</p>
              ) : tickets.length === 0 ? (
                <p className="text-sm text-slate-500">No tickets yet</p>
              ) : (
                <div className="space-y-3">
                  {tickets.map((ticket) => (
                    <div key={ticket._id || ticket.id} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-[#171717]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            #{String(ticket._id || ticket.id).slice(-6)} - {ticket.type} - {ticket.issueType}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">{new Date(ticket.createdAt).toLocaleDateString()}</p>
                        </div>
                        <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${statusClasses(ticket.status)}`}>
                          {ticket.status}
                        </span>
                      </div>
                      {ticket.adminResponse ? (
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">Reply: {ticket.adminResponse}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </ScrollReveal>
      </div>
    </AnimatedPage>
  )
}
