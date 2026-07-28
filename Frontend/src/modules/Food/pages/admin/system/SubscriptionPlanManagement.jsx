import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Loader2,
  Pencil,
  Plus,
  Power,
  Save,
  Trash2,
  X,
} from "lucide-react";
import api from "@food/api";
import { getModuleToken } from "@food/utils/auth";

const emptyForm = {
  id: "",
  title: "",
  durationDays: "",
  subtitle: "",
  description: "",
  badge: "",
  features: "24-hour prior delivery notification\nModify, skip, or confirm each delivery\nNo refunds on cancellation",
};

export default function SubscriptionPlanManagement() {
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isEditing = Boolean(form.id);

  const authConfig = useMemo(() => {
    const token = getModuleToken("admin");
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }, []);

  const loadPlans = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/food/subscription-plans", authConfig);
      setPlans(response?.data?.data?.plans || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load subscription plans");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const resetForm = () => setForm(emptyForm);

  const editPlan = (plan) => {
    setForm({
      id: plan._id || plan.id || "",
      title: plan.title || "",
      durationDays: plan.durationDays || "",
      subtitle: plan.subtitle || "",
      description: plan.description || "",
      badge: plan.badge || "",
      features: Array.isArray(plan.features) ? plan.features.join("\n") : "",
    });
  };

  const savePlan = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const payload = {
      title: form.title,
      durationDays: Number(form.durationDays),
      subtitle: form.subtitle,
      description: form.description,
      badge: form.badge,
      features: form.features,
    };

    try {
      if (isEditing) {
        await api.patch(`/food/subscription-plans/${form.id}`, payload, authConfig);
      } else {
        await api.post("/food/subscription-plans", payload, authConfig);
      }
      setMessage(isEditing ? "Subscription plan updated" : "Subscription plan added");
      resetForm();
      await loadPlans();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save subscription plan");
    } finally {
      setSaving(false);
    }
  };

  const deletePlan = async (plan) => {
    const id = plan._id || plan.id;
    if (!id || !window.confirm(`Delete ${plan.title}?`)) return;
    try {
      await api.delete(`/food/subscription-plans/${id}`, authConfig);
      setMessage("Subscription plan deleted");
      await loadPlans();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to delete subscription plan");
    }
  };

  const togglePlan = async (plan) => {
    const id = plan._id || plan.id;
    if (!id) return;
    try {
      await api.patch(`/food/subscription-plans/${id}/status`, {}, authConfig);
      await loadPlans();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update status");
    }
  };

  const movePlan = async (plan, direction) => {
    const id = plan._id || plan.id;
    if (!id) return;
    const nextOrder = Number(plan.order ?? plan.sortOrder ?? 0) + direction;
    try {
      await api.patch(`/food/subscription-plans/${id}/order`, { order: nextOrder }, authConfig);
      await loadPlans();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update order");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Subscription Plan Management</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage the subscription cards shown after users choose their meals.
        </p>
      </div>

      {message && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <form onSubmit={savePlan} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              {isEditing ? "Edit Plan" : "Add Plan"}
            </h2>
            {isEditing && (
              <button type="button" onClick={resetForm} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">
                <X className="h-4 w-4" />
                Cancel
              </button>
            )}
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-bold text-slate-700">Plan Title</span>
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="30 Days"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#ef2b24]"
                required
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-bold text-slate-700">Duration Days</span>
                <input
                  type="number"
                  min="1"
                  value={form.durationDays}
                  onChange={(event) => setForm((current) => ({ ...current, durationDays: event.target.value }))}
                  placeholder="30"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#ef2b24]"
                  required
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-slate-700">Badge</span>
                <input
                  value={form.badge}
                  onChange={(event) => setForm((current) => ({ ...current, badge: event.target.value }))}
                  placeholder="Most Popular"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#ef2b24]"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">Subtitle</span>
              <input
                value={form.subtitle}
                onChange={(event) => setForm((current) => ({ ...current, subtitle: event.target.value }))}
                placeholder="Valid for 1 month"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#ef2b24]"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">Description</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Standard month-long consistency plan."
                rows={2}
                className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#ef2b24]"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">Features</span>
              <textarea
                value={form.features}
                onChange={(event) => setForm((current) => ({ ...current, features: event.target.value }))}
                rows={4}
                className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#ef2b24]"
              />
              <span className="mt-1 block text-xs text-slate-400">One feature per line.</span>
            </label>
          </div>

          <button type="submit" disabled={saving} className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#ef2b24] text-sm font-bold text-white disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isEditing ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isEditing ? "Save Plan" : "Add Plan"}
          </button>
        </form>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Configured Plans</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              {plans.length} item(s)
            </span>
          </div>

          {loading ? (
            <div className="flex h-52 items-center justify-center text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : plans.length === 0 ? (
            <div className="flex h-52 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-slate-400">
              <CalendarDays className="mb-2 h-8 w-8" />
              No subscription plans yet
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {plans.map((plan) => (
                <article key={plan._id || plan.id} className="rounded-xl border border-red-100 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-2xl font-black text-slate-950">{plan.title}</h3>
                      <p className="mt-2 inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-black uppercase tracking-wider text-[#ef2b24]">
                        {Number(plan.durationDays || 0)} days
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-600">{plan.subtitle}</p>
                      <p className="mt-2 text-sm text-slate-500">{plan.description}</p>
                    </div>
                    {plan.badge && (
                      <span className="rounded-full bg-[#ef2b24] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white">
                        {plan.badge}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                    {(plan.features || []).map((feature) => (
                      <p key={feature} className="text-sm font-semibold text-slate-600">- {feature}</p>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button type="button" onClick={() => editPlan(plan)} className="rounded-lg border border-slate-200 p-2 text-slate-600"><Pencil className="h-4 w-4" /></button>
                    <button type="button" onClick={() => movePlan(plan, -1)} className="rounded-lg border border-slate-200 p-2 text-slate-600"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" onClick={() => movePlan(plan, 1)} className="rounded-lg border border-slate-200 p-2 text-slate-600"><ArrowDown className="h-4 w-4" /></button>
                    <button type="button" onClick={() => togglePlan(plan)} className={`rounded-lg border p-2 ${plan.isActive ? "border-emerald-100 text-emerald-600" : "border-slate-200 text-slate-400"}`}><Power className="h-4 w-4" /></button>
                    <button type="button" onClick={() => deletePlan(plan)} className="rounded-lg border border-red-100 p-2 text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}


