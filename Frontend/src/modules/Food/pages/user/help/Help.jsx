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
    <AnimatedPage className="min-h-screen bg-gradient-to-b from-yellow-50/30 via-white to-orange-50/20 dark:from-[#0a0a0a] dark:via-[#0a0a0a] dark:to-[#0a0a0a] p-4 md:p-6 lg:p-8">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto space-y-4 md:space-y-5 lg:space-y-6">
        <ScrollReveal>
          <div className="mb-6 md:mb-8">
            <div className="flex items-center gap-3 md:gap-4 mb-4">
              <Link to="/food/user">
                <Button variant="ghost" size="icon" className="h-9 w-9 md:h-10 md:w-10 p-0">
                  <ArrowLeft className="h-5 w-5 md:h-6 md:w-6" />
                </Button>
              </Link>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold">Help Center</h1>
            </div>
            <div className="text-center space-y-3 md:space-y-4">
              <p className="text-base md:text-lg lg:text-xl text-muted-foreground">
                Find answers to common questions or contact our support team
              </p>
            </div>
          </div>
        </ScrollReveal>

        {/* Search Bar */}
        <ScrollReveal delay={0.1}>
          <Card className="shadow-lg">
            <CardContent className="p-4 md:p-5 lg:p-6">
              <div className="relative">
                <Search className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search for help topics, questions, or keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 md:pl-12 h-12 md:h-14 text-base md:text-lg"
                />
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>

        {/* Quick Actions */}
        <ScrollReveal delay={0.2}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 lg:gap-6">
            <Link to="/food/user/orders" state={helpBackState}>
              <CardContent className="p-4 md:p-5 lg:p-6">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="p-2 md:p-3 bg-yellow-100 rounded-lg">
                    <Package className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm md:text-base font-semibold">Track Your Order</h3>
                    <p className="text-xs md:text-sm text-muted-foreground">View order status</p>
                  </div>
                </div>
              </CardContent>
            </Link>
            <Link to="/food/user/profile" state={helpBackState}>
              <CardContent className="p-4 md:p-5 lg:p-6">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="p-2 md:p-3 bg-orange-100 rounded-lg">
                    <User className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm md:text-base font-semibold">Manage Account</h3>
                    <p className="text-xs md:text-sm text-muted-foreground">Update profile & settings</p>
                  </div>
                </div>
              </CardContent>
            </Link>
            <CardContent className="p-4 md:p-5 lg:p-6">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="p-2 md:p-3 bg-orange-100 rounded-lg">
                  <MessageCircle className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm md:text-base font-semibold">Contact Support</h3>
                  <p className="text-xs md:text-sm text-muted-foreground">Get help from our team</p>
                </div>
              </div>
            </CardContent>
          </div>
        </ScrollReveal>

        {/* Help Categories */}
        <ScrollReveal delay={0.3}>
          <div className="space-y-4 md:space-y-5 lg:space-y-6">
            <h2 className="text-xl md:text-2xl lg:text-3xl font-bold">Browse by Category</h2>
            {filteredCategories.length === 0 ? (
              <Card>
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
                  <Card key={category.id} className="shadow-lg">
                    <CardHeader
                      onClick={() => toggleCategory(category.id)}
                      className="p-4 md:p-5 lg:p-6"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 md:gap-4">
                          <div className={`p-2 md:p-3 ${category.bgColor} rounded-lg`}>
                            <Icon className={`h-5 w-5 md:h-6 md:w-6 ${category.color}`} />
                          </div>
                          <div>
                            <CardTitle className="text-lg md:text-xl lg:text-2xl">{category.title}</CardTitle>
                            <CardDescription className="text-sm md:text-base">{category.description}</CardDescription>
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
                      <CardContent className="space-y-3 md:space-y-4 pt-0 p-4 md:p-5 lg:p-6">
                        {category.topics.map((topic, topicIndex) => {
                          const questionIndex = `${category.id}-${topicIndex}`
                          const isQuestionExpanded = expandedQuestion === questionIndex

                          return (
                            <div
                              key={topicIndex}
                              className="border rounded-lg overflow-hidden"
                            >
                              <button
                                onClick={() => toggleQuestion(questionIndex)}
                              >
                                <span className="font-semibold pr-4">{topic.question}</span>
                                {isQuestionExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                )}
                              </button>
                              {isQuestionExpanded && (
                                <div className="p-4 text-muted-foreground border-t bg-muted/30">
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
          <Card className="bg-white dark:bg-[#1a1a1a] shadow-lg border-slate-200 dark:border-gray-800">
            <CardHeader className="p-4 md:p-5 lg:p-6">
              <CardTitle className="text-xl md:text-2xl lg:text-3xl flex items-center gap-2">
                <HelpCircle className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                Raise a Support Ticket
              </CardTitle>
              <CardDescription className="text-sm md:text-base">
                Report order, restaurant, payment, or app issues and track replies in one place.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 md:p-5 lg:p-6">
              {supportStep === "pick" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button onClick={() => handlePickSupportType("order")} className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <div className="flex items-center justify-between">
                      <ShoppingBag className="h-5 w-5 text-slate-700 dark:text-slate-200" />
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                    <p className="mt-3 font-semibold text-slate-900 dark:text-white">Order Issue</p>
                    <p className="text-xs text-slate-500 mt-1">Missing item, wrong item, delivery issue</p>
                  </button>

                  <button onClick={() => handlePickSupportType("restaurant")} className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <div className="flex items-center justify-between">
                      <Building2 className="h-5 w-5 text-slate-700 dark:text-slate-200" />
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                    <p className="mt-3 font-semibold text-slate-900 dark:text-white">Restaurant Issue</p>
                    <p className="text-xs text-slate-500 mt-1">Service, listing info, behavior report</p>
                  </button>

                  <button onClick={() => handlePickSupportType("other")} className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
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
          <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200 shadow-lg">
            <CardHeader className="p-4 md:p-5 lg:p-6">
              <CardTitle className="text-xl md:text-2xl lg:text-3xl flex items-center gap-2">
                <MessageCircle className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                Still Need Help?
              </CardTitle>
              <CardDescription className="text-sm md:text-base">
                {supportDetails.supportHours || "Our support team is here to assist you 24/7"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-5 lg:space-y-6 p-4 md:p-5 lg:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 lg:gap-6">
                <div className="flex items-start gap-3 p-4 bg-white rounded-lg">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Phone className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Phone Support</h3>
                    <p className="text-sm text-muted-foreground mb-2">
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
                <div className="flex items-start gap-3 p-4 bg-white rounded-lg">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Email Support</h3>
                    <p className="text-sm text-muted-foreground mb-2">
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
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-3">
                  <Clock className="h-4 w-4 inline mr-1" />
                  Average response time: Less than 5 minutes
                </p>
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>

        <ScrollReveal delay={0.45}>
          <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm border border-slate-200 dark:border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">My Tickets</h3>
                <span className="text-xs font-medium px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {tickets.length}
                </span>
              </div>

              {loadingTickets ? (
                <p className="text-sm text-slate-500">Loading tickets...</p>
              ) : tickets.length === 0 ? (
                <p className="text-sm text-slate-500">No tickets yet</p>
              ) : (
                <div className="space-y-2">
                  {tickets.map((ticket) => (
                    <div key={ticket._id || ticket.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-[#171717]">
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
