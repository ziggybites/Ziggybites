import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  Loader2,
  LogIn,
  Mail,
  Phone,
  Clock3,
  Send,
} from "lucide-react";
import { adminAPI, deliveryAPI } from "@food/api";
import { getModuleToken } from "@food/utils/auth";
import { toast } from "sonner";

const CATEGORY_OPTIONS = [
  { value: "order", label: "Orders" },
  { value: "payment", label: "Payments" },
  { value: "account", label: "Account" },
  { value: "technical", label: "Technical" },
  { value: "other", label: "Other" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const DEFAULT_SUPPORT = {
  supportEmail: "support@ziggybites.com",
  supportPhone: "+91 1234567890",
  supportHours: "24/7 Availability",
};

const getStatusStyle = (status) => {
  if (status === "resolved") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (status === "in_progress") return "bg-blue-100 text-blue-700 border-blue-200";
  if (status === "closed") return "bg-slate-100 text-slate-700 border-slate-200";
  return "bg-amber-100 text-amber-700 border-amber-200";
};

export default function DeliverySupportPage() {
  const navigate = useNavigate();
  const [supportInfo, setSupportInfo] = useState(DEFAULT_SUPPORT);
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getModuleToken("delivery")));
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState({
    category: "order",
    subject: "",
    priority: "medium",
    description: "",
  });

  const stats = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter((t) => t.status === "open").length;
    const inProgress = tickets.filter((t) => t.status === "in_progress").length;
    const resolved = tickets.filter((t) => t.status === "resolved").length;
    return { total, open, inProgress, resolved };
  }, [tickets]);

  useEffect(() => {
    setIsAuthenticated(Boolean(getModuleToken("delivery")));
  }, []);

  useEffect(() => {
    let mounted = true;

    adminAPI
      .getPublicBusinessSettings()
      .then((response) => {
        if (!mounted) return;
        const data = response?.data?.data || response?.data || {};
        setSupportInfo({
          supportEmail: data.supportEmail || DEFAULT_SUPPORT.supportEmail,
          supportPhone: data.supportPhone || DEFAULT_SUPPORT.supportPhone,
          supportHours: data.supportHours || DEFAULT_SUPPORT.supportHours,
        });
      })
      .catch(() => {
        if (mounted) {
          setSupportInfo(DEFAULT_SUPPORT);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setTickets([]);
      return;
    }

    let mounted = true;

    const loadTickets = async () => {
      try {
        setLoading(true);
        const response = await deliveryAPI.getSupportTickets();
        if (!mounted) return;
        const list = response?.data?.data?.tickets || [];
        setTickets(
          statusFilter
            ? list.filter((ticket) => String(ticket.status || "") === statusFilter)
            : list,
        );
      } catch (error) {
        if (!mounted) return;
        toast.error(error?.response?.data?.message || "Failed to load support tickets");
        setTickets([]);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadTickets();
    return () => {
      mounted = false;
    };
  }, [isAuthenticated, statusFilter]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      navigate("/food/delivery/login");
      return;
    }
    if (!form.subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    if (form.description.trim().length < 10) {
      toast.error("Description must be at least 10 characters");
      return;
    }

    try {
      setSubmitting(true);
      await deliveryAPI.createSupportTicket({
        category: form.category,
        subject: form.subject.trim(),
        priority: form.priority,
        description: form.description.trim(),
      });
      toast.success("Support ticket submitted");
      setForm((prev) => ({ ...prev, subject: "", description: "" }));
      const response = await deliveryAPI.getSupportTickets();
      const list = response?.data?.data?.tickets || [];
      setTickets(
        statusFilter
          ? list.filter((ticket) => String(ticket.status || "") === statusFilter)
          : list,
      );
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to submit support ticket");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1 hover:bg-slate-100 rounded-full transition-colors"
            aria-label="Go back"
          >
            <ChevronLeft className="w-6 h-6 text-slate-900" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Support</h1>
            <p className="text-xs text-slate-500">
              Reach support directly or raise a delivery ticket
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <a
            href={`tel:${supportInfo.supportPhone}`}
            className="rounded-2xl border border-slate-200 bg-white p-4 flex items-start gap-3"
          >
            <div className="rounded-xl bg-slate-100 p-2">
              <Phone className="w-4 h-4 text-slate-700" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Call support</p>
              <p className="text-sm font-semibold text-slate-900 break-all">
                {supportInfo.supportPhone}
              </p>
            </div>
          </a>
          <a
            href={`mailto:${supportInfo.supportEmail}`}
            className="rounded-2xl border border-slate-200 bg-white p-4 flex items-start gap-3"
          >
            <div className="rounded-xl bg-slate-100 p-2">
              <Mail className="w-4 h-4 text-slate-700" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Email support</p>
              <p className="text-sm font-semibold text-slate-900 break-all">
                {supportInfo.supportEmail}
              </p>
            </div>
          </a>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-start gap-3">
            <div className="rounded-xl bg-slate-100 p-2">
              <Clock3 className="w-4 h-4 text-slate-700" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Support hours</p>
              <p className="text-sm font-semibold text-slate-900">
                {supportInfo.supportHours}
              </p>
            </div>
          </div>
        </div>

        {isAuthenticated ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs text-slate-500">Total</p>
                <p className="text-lg font-bold text-slate-900">{stats.total}</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-700">Open</p>
                <p className="text-lg font-bold text-amber-800">{stats.open}</p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                <p className="text-xs text-blue-700">In progress</p>
                <p className="text-lg font-bold text-blue-800">{stats.inProgress}</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs text-emerald-700">Resolved</p>
                <p className="text-lg font-bold text-emerald-800">{stats.resolved}</p>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3"
            >
              <h2 className="text-sm font-bold text-slate-900">Raise support ticket</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={form.priority}
                  onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <input
                value={form.subject}
                onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                placeholder="Short subject"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                maxLength={180}
              />
              <textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Describe your issue"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-24 resize-none"
                maxLength={1000}
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-black text-white py-2.5 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Submit Ticket
              </button>
            </form>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-slate-900">My tickets</h2>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs bg-white"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value || "all"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {loading ? (
                <div className="py-8 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading tickets...
                </div>
              ) : tickets.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-sm">
                  No support tickets found.
                </div>
              ) : (
                <div className="space-y-3">
                  {tickets.map((ticket) => (
                    <div key={ticket._id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-500">
                          {ticket.ticketId ? `#${ticket.ticketId}` : `#${String(ticket._id).slice(-6)}`} {" • "}
                          {new Date(ticket.createdAt).toLocaleString()}
                        </p>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold capitalize ${getStatusStyle(ticket.status)}`}
                        >
                          {String(ticket.status || "").replace("_", " ")}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{ticket.subject}</p>
                      <p className="text-xs text-slate-600 mt-1">{ticket.description}</p>
                      {ticket.adminResponse ? (
                        <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-3">
                          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                            Support Response
                          </p>
                          <p className="text-sm text-slate-700 mt-1">{ticket.adminResponse}</p>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="text-base font-bold text-slate-900">Need ticket tracking?</h2>
            <p className="text-sm text-slate-600 mt-2">
              This support page is open without login. Sign in as a delivery partner if you want to raise a ticket and track admin responses inside the app.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate("/food/delivery/login")}
                className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white"
              >
                <LogIn className="w-4 h-4" />
                Delivery Login
              </button>
              <a
                href={`mailto:${supportInfo.supportEmail}`}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-900"
              >
                <Mail className="w-4 h-4" />
                Email Support
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
