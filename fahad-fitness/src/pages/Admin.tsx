import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  LayoutDashboard, Layers, Users, CreditCard, FileText, Dumbbell,
  Pencil, Trash2, Plus, X, Check, Loader2, ChevronDown, ChevronUp,
  Shield, TrendingUp, UserCheck, DollarSign, Eye, Search, RefreshCw, Copy, Lock,
} from "lucide-react";

/* ── helpers ─────────────────────────────────────────────── */
const fmt = (n: number) => `$${n.toLocaleString()}`;
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

type Section = "overview" | "plans" | "users" | "subscriptions" | "invoices" | "workouts";

interface PlanRow        { id: number; name: string; price: number; description?: string }
interface UserRow        { id: string; name: string; email: string; phone: string; birth_date: string; status: string }
interface SubRow         { id: string; user_id: string; plan_id: number; status: string; payment_status: string; start_date: string; end_date: string; plan?: { name: string; price: number }; user_name?: string; user_email?: string }
interface InvoiceRow     { id: string; user_id: string; date: string; plan: string; amount: number; status: string }

/* ── tiny modal shell ─────────────────────────────────────── */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="glass rounded-2xl border border-white/10 w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h3 className="text-lg font-bold text-white" style={{ fontFamily: "'Oswald', sans-serif" }}>{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ── confirm dialog ───────────────────────────────────────── */
function Confirm({ message, onConfirm, onCancel, loading }: { message: string; onConfirm: () => void; onCancel: () => void; loading?: boolean }) {
  return (
    <Modal title="Confirm Action" onClose={onCancel}>
      <p className="text-zinc-300 mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white border border-white/10 hover:border-white/20 transition-all">Cancel</button>
        <button onClick={onConfirm} disabled={loading} className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-500 text-white disabled:opacity-60 flex items-center gap-2 transition-all">
          {loading && <Loader2 className="w-3 h-3 animate-spin" />}Delete
        </button>
      </div>
    </Modal>
  );
}

/* ── field row ────────────────────────────────────────────── */
function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
      <span className="text-sm text-zinc-200">{value ?? "—"}</span>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", placeholder }: { label: string; value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-zinc-400 font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-red-500 focus:ring-1 focus:ring-red-500/30 text-white text-sm outline-none transition-all placeholder-zinc-600"
      />
    </div>
  );
}

/* ── badge ────────────────────────────────────────────────── */
function Badge({ value }: { value: string }) {
  const map: Record<string, string> = {
    active:    "bg-green-900/30 text-green-400 border-green-700/30",
    paid:      "bg-green-900/30 text-green-400 border-green-700/30",
    expired:   "bg-red-900/30 text-red-400 border-red-700/30",
    cancelled: "bg-zinc-800 text-zinc-400 border-zinc-700/30",
    unpaid:    "bg-yellow-900/30 text-yellow-400 border-yellow-700/30",
    pending:   "bg-yellow-900/30 text-yellow-400 border-yellow-700/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${map[value] ?? "bg-zinc-800 text-zinc-400 border-zinc-700/30"}`}>
      {value}
    </span>
  );
}

/* ── table wrapper ────────────────────────────────────────── */
function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/5">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="py-3 px-3 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`py-3 px-3 text-zinc-300 whitespace-nowrap ${className ?? ""}`}>{children}</td>;
}

/* ══════════════════════════════════════════════════
   SECTION: OVERVIEW
══════════════════════════════════════════════════ */
const SESSION_TABLE_SQL = `create table user_sessions (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  session_id text not null,
  updated_at timestamptz default now()
);
alter table user_sessions enable row level security;
create policy "Users manage own session"
  on user_sessions for all using (auth.uid() = user_id);`;

function OverviewSection() {
  const [stats, setStats] = useState({ users: 0, activeSubs: 0, revenue: 0, invoices: 0 });
  const [loading, setLoading] = useState(true);
  const [copiedSession, setCopiedSession] = useState(false);
  const { sessionTableMissing } = useAuth();

  useEffect(() => {
    Promise.all([
      supabase.from("users").select("id", { count: "exact", head: true }),
      supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("invoices").select("amount").eq("status", "paid"),
      supabase.from("invoices").select("id", { count: "exact", head: true }),
    ]).then(([u, s, inv, invCount]) => {
      const revenue = (inv.data ?? []).reduce((sum: number, r: any) => sum + (r.amount ?? 0), 0);
      setStats({
        users:      u.count ?? 0,
        activeSubs: s.count ?? 0,
        revenue,
        invoices:   invCount.count ?? 0,
      });
      setLoading(false);
    });
  }, []);

  const cards = [
    { icon: Users,      label: "Total Users",          value: loading ? "…" : stats.users,      color: "text-blue-400",  bg: "bg-blue-900/20" },
    { icon: UserCheck,  label: "Active Subscriptions", value: loading ? "…" : stats.activeSubs, color: "text-green-400", bg: "bg-green-900/20" },
    { icon: DollarSign, label: "Total Revenue",        value: loading ? "…" : fmt(stats.revenue), color: "text-red-400",  bg: "bg-red-900/20" },
    { icon: FileText,   label: "Total Invoices",       value: loading ? "…" : stats.invoices,   color: "text-amber-400", bg: "bg-amber-900/20" },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-white" style={{ fontFamily: "'Oswald', sans-serif" }}>Dashboard Overview</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="glass rounded-2xl p-5 border border-white/5">
              <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${c.color}`} />
              </div>
              <div className="text-2xl font-black text-white mb-1" style={{ fontFamily: "'Oswald', sans-serif" }}>{c.value}</div>
              <div className="text-xs text-zinc-500">{c.label}</div>
            </div>
          );
        })}
      </div>
      <div className="glass rounded-2xl p-6 border border-white/5">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4 text-red-500" />
          <span className="text-sm font-semibold text-zinc-300">Quick Stats</span>
        </div>
        <p className="text-zinc-500 text-sm">Use the sections below to manage plans, users, subscriptions, and invoices. All changes are applied to the database immediately.</p>
      </div>

      {/* Session enforcement status card */}
      {sessionTableMissing ? (
        <div className="glass rounded-2xl border border-amber-600/30 p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Lock className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-300 mb-0.5">Single-Session Enforcement — Setup Required</p>
              <p className="text-xs text-zinc-500">
                Run this SQL in Supabase to enable the <code className="text-amber-400/80 bg-white/5 px-1 rounded">user_sessions</code> table.
                Once created, each user can only be logged in on one device at a time.
              </p>
            </div>
          </div>
          <pre className="text-xs text-green-300 bg-black/40 rounded-xl p-4 overflow-x-auto font-mono leading-relaxed">{SESSION_TABLE_SQL}</pre>
          <button
            onClick={() => { navigator.clipboard.writeText(SESSION_TABLE_SQL).then(() => { setCopiedSession(true); setTimeout(() => setCopiedSession(false), 2000); }); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-zinc-300 border border-white/10 transition-all"
          >
            {copiedSession ? <><Check className="w-3.5 h-3.5 text-green-400" />Copied!</> : <><Copy className="w-3.5 h-3.5" />Copy SQL</>}
          </button>
        </div>
      ) : (
        <div className="glass rounded-2xl border border-green-600/20 p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-900/30 flex items-center justify-center flex-shrink-0">
            <Lock className="w-4 h-4 text-green-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-green-300">Single-Session Enforcement Active</p>
            <p className="text-xs text-zinc-500">Each user can only be logged in on one device at a time. New logins invalidate all previous sessions.</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   SECTION: PLANS  (full CRUD)
══════════════════════════════════════════════════ */
const BLANK_PLAN = { name: "", price: "", description: "" };

function PlansSection() {
  const [plans, setPlans]           = useState<PlanRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [editing, setEditing]       = useState<PlanRow | null>(null);
  const [adding, setAdding]         = useState(false);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [delError, setDelError]     = useState("");
  const [editForm, setEditForm]     = useState(BLANK_PLAN);
  const [addForm, setAddForm]       = useState(BLANK_PLAN);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("plans").select("*").order("price");
    setPlans(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (p: PlanRow) => {
    setEditing(p);
    setEditForm({ name: p.name, price: String(p.price), description: p.description ?? "" });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    await supabase.from("plans").update({ name: editForm.name, price: Number(editForm.price), description: editForm.description }).eq("id", editing.id);
    await load();
    setSaving(false);
    setEditing(null);
  };

  const addPlan = async () => {
    setSaving(true);
    await supabase.from("plans").insert({ name: addForm.name, price: Number(addForm.price), description: addForm.description });
    await load();
    setSaving(false);
    setAdding(false);
    setAddForm(BLANK_PLAN);
  };

  const deletePlan = async () => {
    if (confirmDel === null) return;
    setDeleting(true);
    setDelError("");
    const { error } = await supabase.from("plans").delete().eq("id", confirmDel);
    if (error) {
      setDelError("Cannot delete — this plan is still referenced by subscriptions.");
      setDeleting(false);
      return;
    }
    await load();
    setDeleting(false);
    setConfirmDel(null);
  };

  const PlanForm = ({ form, setForm, onSave, onCancel, title }: {
    form: typeof BLANK_PLAN; setForm: React.Dispatch<React.SetStateAction<typeof BLANK_PLAN>>;
    onSave: () => void; onCancel: () => void; title: string;
  }) => (
    <Modal title={title} onClose={onCancel}>
      <div className="space-y-4">
        <Input label="Plan Name" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} placeholder="e.g. 1 Month Plan" />
        <Input label="Price (USD)" type="number" value={form.price} onChange={(v) => setForm((p) => ({ ...p, price: v }))} placeholder="60" />
        <Input label="Description" value={form.description} onChange={(v) => setForm((p) => ({ ...p, description: v }))} placeholder="Brief plan description..." />
        <div className="flex gap-3 pt-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-zinc-400 border border-white/10 hover:border-white/20 transition-all">Cancel</button>
          <button onClick={onSave} disabled={saving || !form.name || !form.price} className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-500 text-white disabled:opacity-60 flex items-center gap-2 transition-all">
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}<Check className="w-3.5 h-3.5" />Save
          </button>
        </div>
      </div>
    </Modal>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-black text-white" style={{ fontFamily: "'Oswald', sans-serif" }}>Plans</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setAdding(true); setAddForm(BLANK_PLAN); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />Add Plan
          </button>
          <button onClick={load} className="p-2 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-white transition-colors"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-red-500 animate-spin" /></div>
      ) : (
        <TableWrap>
          <thead className="bg-white/2 border-b border-white/5">
            <tr><Th>ID</Th><Th>Name</Th><Th>Price</Th><Th>Description</Th><Th>Actions</Th></tr>
          </thead>
          <tbody className="divide-y divide-white/3">
            {plans.map((p) => (
              <tr key={p.id} className="hover:bg-white/2 transition-colors">
                <Td className="text-zinc-500 text-xs font-mono">{p.id}</Td>
                <Td className="font-medium text-white">{p.name}</Td>
                <Td><span className="font-bold text-green-400">${p.price}</span></Td>
                <Td className="text-zinc-500 max-w-xs truncate">{p.description ?? "—"}</Td>
                <Td>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors" title="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { setConfirmDel(p.id); setDelError(""); }} className="p-1.5 rounded-lg hover:bg-red-900/30 text-zinc-400 hover:text-red-400 transition-colors" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
            {plans.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-zinc-600 text-sm">No plans yet — add one above</td></tr>
            )}
          </tbody>
        </TableWrap>
      )}

      {editing && (
        <PlanForm
          title={`Edit Plan — ${editing.name}`}
          form={editForm} setForm={setEditForm}
          onSave={saveEdit} onCancel={() => setEditing(null)}
        />
      )}

      {adding && (
        <PlanForm
          title="Add New Plan"
          form={addForm} setForm={setAddForm}
          onSave={addPlan} onCancel={() => setAdding(false)}
        />
      )}

      {confirmDel !== null && (
        <Modal title="Delete Plan" onClose={() => setConfirmDel(null)}>
          <p className="text-zinc-300 mb-2">Permanently delete this plan? This cannot be undone.</p>
          {delError && <p className="text-red-400 text-sm mb-4 bg-red-900/20 px-3 py-2 rounded-lg">{delError}</p>}
          <div className="flex gap-3 justify-end mt-4">
            <button onClick={() => setConfirmDel(null)} className="px-4 py-2 rounded-lg text-sm text-zinc-400 border border-white/10 hover:border-white/20 transition-all">Cancel</button>
            <button onClick={deletePlan} disabled={deleting} className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-500 text-white disabled:opacity-60 flex items-center gap-2 transition-all">
              {deleting && <Loader2 className="w-3 h-3 animate-spin" />}<Trash2 className="w-3.5 h-3.5" />Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   SECTION: USERS
══════════════════════════════════════════════════ */
function UsersSection() {
  const [users, setUsers]       = useState<UserRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [viewing, setViewing]   = useState<UserRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("users").select("*").order("name");
    setUsers(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter((u) =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-black text-white" style={{ fontFamily: "'Oswald', sans-serif" }}>Users</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className="pl-8 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-zinc-600 outline-none focus:border-red-500/50 transition-all w-48"
            />
          </div>
          <button onClick={load} className="p-2 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-white transition-colors"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-red-500 animate-spin" /></div>
      ) : (
        <TableWrap>
          <thead className="bg-white/2 border-b border-white/5">
            <tr><Th>Name</Th><Th>Email</Th><Th>Phone</Th><Th>Status</Th><Th>Actions</Th></tr>
          </thead>
          <tbody className="divide-y divide-white/3">
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-white/2 transition-colors">
                <Td className="font-medium text-white">{u.name || "—"}</Td>
                <Td className="text-zinc-400 text-xs">{u.email}</Td>
                <Td className="text-zinc-500 text-xs">{u.phone || "—"}</Td>
                <Td><Badge value={u.status || "active"} /></Td>
                <Td>
                  <button onClick={() => setViewing(u)} className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      {viewing && (
        <Modal title="User Details" onClose={() => setViewing(null)}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Full Name"   value={viewing.name} />
            <Field label="Email"       value={viewing.email} />
            <Field label="Phone"       value={viewing.phone} />
            <Field label="Birth Date"  value={fmtDate(viewing.birth_date)} />
            <Field label="Status"      value={viewing.status} />
            <Field label="User ID"     value={viewing.id.slice(0, 8) + "…"} />
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   SECTION: SUBSCRIPTIONS
══════════════════════════════════════════════════ */
function SubscriptionsSection() {
  const [subs, setSubs]         = useState<SubRow[]>([]);
  const [plans, setPlans]       = useState<PlanRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<"all" | "active" | "expired" | "cancelled">("all");
  const [editing, setEditing]   = useState<SubRow | null>(null);
  const [adding, setAdding]     = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(false);

  const blankAdd = { user_id: "", plan_id: "", status: "active", payment_status: "paid", start_date: "", end_date: "" };
  const [addForm, setAddForm]   = useState<typeof blankAdd>(blankAdd);
  const [editStatus, setEditStatus] = useState<{ status: string; payment_status: string; end_date: string }>({ status: "", payment_status: "", end_date: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: subData }, { data: planData }] = await Promise.all([
      supabase.from("subscriptions").select("*, plan:plan_id(name, price)").order("start_date", { ascending: false }),
      supabase.from("plans").select("id, name, price").order("price"),
    ]);
    setSubs(subData ?? []);
    setPlans(planData ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = subs.filter((s) => filter === "all" ? true : s.status === filter);

  const openEdit = (s: SubRow) => {
    setEditing(s);
    setEditStatus({ status: s.status, payment_status: s.payment_status, end_date: s.end_date });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    await supabase.from("subscriptions").update(editStatus).eq("id", editing.id);
    await load();
    setSaving(false);
    setEditing(null);
  };

  const addSub = async () => {
    setSaving(true);
    await supabase.from("subscriptions").insert({ ...addForm, plan_id: Number(addForm.plan_id) });
    await load();
    setSaving(false);
    setAdding(false);
    setAddForm(blankAdd);
  };

  const deleteSub = async () => {
    if (!confirmDel) return;
    setDeleting(true);
    await supabase.from("subscriptions").delete().eq("id", confirmDel);
    await load();
    setDeleting(false);
    setConfirmDel(null);
  };

  const sel = "w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-red-500 text-white text-sm outline-none transition-all";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-black text-white" style={{ fontFamily: "'Oswald', sans-serif" }}>Subscriptions</h2>
        <div className="flex items-center gap-2">
          <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-zinc-300 outline-none">
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors">
            <Plus className="w-3.5 h-3.5" />Add
          </button>
          <button onClick={load} className="p-2 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-white transition-colors"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-red-500 animate-spin" /></div>
      ) : (
        <TableWrap>
          <thead className="bg-white/2 border-b border-white/5">
            <tr><Th>User ID</Th><Th>Plan</Th><Th>Status</Th><Th>Payment</Th><Th>Start</Th><Th>End</Th><Th>Actions</Th></tr>
          </thead>
          <tbody className="divide-y divide-white/3">
            {filtered.map((s) => (
              <tr key={s.id} className="hover:bg-white/2 transition-colors">
                <Td className="text-zinc-500 text-xs font-mono">{s.user_id.slice(0, 8)}…</Td>
                <Td className="font-medium">{(s as any).plan?.name ?? `Plan ${s.plan_id}`}</Td>
                <Td><Badge value={s.status} /></Td>
                <Td><Badge value={s.payment_status} /></Td>
                <Td className="text-xs text-zinc-500">{fmtDate(s.start_date)}</Td>
                <Td className="text-xs text-zinc-500">{fmtDate(s.end_date)}</Td>
                <Td>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setConfirmDel(s.id)} className="p-1.5 rounded-lg hover:bg-red-900/30 text-zinc-400 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </Td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-zinc-600 text-sm">No subscriptions found</td></tr>
            )}
          </tbody>
        </TableWrap>
      )}

      {/* Edit modal */}
      {editing && (
        <Modal title="Edit Subscription" onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <Field label="User ID"  value={editing.user_id.slice(0, 8) + "…"} />
              <Field label="Plan"     value={(editing as any).plan?.name} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400 font-medium">Status</label>
              <select value={editStatus.status} onChange={(e) => setEditStatus((p) => ({ ...p, status: e.target.value }))} className={sel}>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400 font-medium">Payment Status</label>
              <select value={editStatus.payment_status} onChange={(e) => setEditStatus((p) => ({ ...p, payment_status: e.target.value }))} className={sel}>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <Input label="End Date" type="date" value={editStatus.end_date} onChange={(v) => setEditStatus((p) => ({ ...p, end_date: v }))} />
            <div className="flex gap-3 pt-2 justify-end">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg text-sm text-zinc-400 border border-white/10 hover:border-white/20 transition-all">Cancel</button>
              <button onClick={saveEdit} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-500 text-white disabled:opacity-60 flex items-center gap-2 transition-all">
                {saving && <Loader2 className="w-3 h-3 animate-spin" />}<Check className="w-3.5 h-3.5" />Save
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add modal */}
      {adding && (
        <Modal title="Add Subscription" onClose={() => setAdding(false)}>
          <div className="space-y-4">
            <Input label="User ID (UUID)" value={addForm.user_id} onChange={(v) => setAddForm((p) => ({ ...p, user_id: v }))} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400 font-medium">Plan</label>
              <select value={addForm.plan_id} onChange={(e) => setAddForm((p) => ({ ...p, plan_id: e.target.value }))} className={sel}>
                <option value="">Select plan...</option>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name} — ${p.price}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Start Date" type="date" value={addForm.start_date} onChange={(v) => setAddForm((p) => ({ ...p, start_date: v }))} />
              <Input label="End Date"   type="date" value={addForm.end_date}   onChange={(v) => setAddForm((p) => ({ ...p, end_date: v }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400 font-medium">Payment Status</label>
              <select value={addForm.payment_status} onChange={(e) => setAddForm((p) => ({ ...p, payment_status: e.target.value }))} className={sel}>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2 justify-end">
              <button onClick={() => setAdding(false)} className="px-4 py-2 rounded-lg text-sm text-zinc-400 border border-white/10 hover:border-white/20 transition-all">Cancel</button>
              <button onClick={addSub} disabled={saving || !addForm.user_id || !addForm.plan_id || !addForm.start_date || !addForm.end_date} className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 flex items-center gap-2 transition-all">
                {saving && <Loader2 className="w-3 h-3 animate-spin" />}<Plus className="w-3.5 h-3.5" />Create
              </button>
            </div>
          </div>
        </Modal>
      )}

      {confirmDel && (
        <Confirm
          message="Are you sure you want to delete this subscription? This action cannot be undone."
          onConfirm={deleteSub}
          onCancel={() => setConfirmDel(null)}
          loading={deleting}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   SECTION: INVOICES
══════════════════════════════════════════════════ */
function InvoicesSection() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<"all" | "paid" | "pending">("all");
  const [editing, setEditing]   = useState<InvoiceRow | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editStatus, setEditStatus] = useState("paid");
  const [addingInv, setAddingInv] = useState(false);
  const blankInv = { user_id: "", plan: "", amount: "", date: "" };
  const [addForm, setAddForm]   = useState<typeof blankInv>(blankInv);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("invoices").select("*").order("date", { ascending: false });
    setInvoices(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = invoices.filter((i) => filter === "all" ? true : i.status === filter);

  const saveStatus = async () => {
    if (!editing) return;
    setSaving(true);
    await supabase.from("invoices").update({ status: editStatus }).eq("id", editing.id);
    await load();
    setSaving(false);
    setEditing(null);
  };

  const deleteInv = async () => {
    if (!confirmDel) return;
    setDeleting(true);
    await supabase.from("invoices").delete().eq("id", confirmDel);
    await load();
    setDeleting(false);
    setConfirmDel(null);
  };

  const addInv = async () => {
    setSaving(true);
    await supabase.from("invoices").insert({ user_id: addForm.user_id, plan: addForm.plan, amount: Number(addForm.amount), date: addForm.date, status: "paid" });
    await load();
    setSaving(false);
    setAddingInv(false);
    setAddForm(blankInv);
  };

  const sel = "w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-red-500 text-white text-sm outline-none transition-all";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-black text-white" style={{ fontFamily: "'Oswald', sans-serif" }}>Invoices</h2>
        <div className="flex items-center gap-2">
          <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-zinc-300 outline-none">
            <option value="all">All</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
          </select>
          <button onClick={() => setAddingInv(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors">
            <Plus className="w-3.5 h-3.5" />Add
          </button>
          <button onClick={load} className="p-2 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-white transition-colors"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-red-500 animate-spin" /></div>
      ) : (
        <TableWrap>
          <thead className="bg-white/2 border-b border-white/5">
            <tr><Th>User ID</Th><Th>Date</Th><Th>Plan</Th><Th>Amount</Th><Th>Status</Th><Th>Actions</Th></tr>
          </thead>
          <tbody className="divide-y divide-white/3">
            {filtered.map((inv) => (
              <tr key={inv.id} className="hover:bg-white/2 transition-colors">
                <Td className="text-zinc-500 text-xs font-mono">{inv.user_id?.slice(0, 8)}…</Td>
                <Td className="text-xs text-zinc-500">{fmtDate(inv.date)}</Td>
                <Td className="font-medium">{inv.plan}</Td>
                <Td><span className="font-bold text-green-400">${inv.amount}</span></Td>
                <Td><Badge value={inv.status} /></Td>
                <Td>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditing(inv); setEditStatus(inv.status); }} className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setConfirmDel(inv.id)} className="p-1.5 rounded-lg hover:bg-red-900/30 text-zinc-400 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </Td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-zinc-600 text-sm">No invoices found</td></tr>
            )}
          </tbody>
        </TableWrap>
      )}

      {editing && (
        <Modal title="Edit Invoice Status" onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <Field label="Plan"   value={editing.plan} />
              <Field label="Amount" value={`$${editing.amount}`} />
              <Field label="Date"   value={fmtDate(editing.date)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400 font-medium">Status</label>
              <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className={sel}>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2 justify-end">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg text-sm text-zinc-400 border border-white/10 hover:border-white/20 transition-all">Cancel</button>
              <button onClick={saveStatus} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-500 text-white disabled:opacity-60 flex items-center gap-2 transition-all">
                {saving && <Loader2 className="w-3 h-3 animate-spin" />}<Check className="w-3.5 h-3.5" />Save
              </button>
            </div>
          </div>
        </Modal>
      )}

      {addingInv && (
        <Modal title="Add Invoice" onClose={() => setAddingInv(false)}>
          <div className="space-y-4">
            <Input label="User ID (UUID)" value={addForm.user_id} onChange={(v) => setAddForm((p) => ({ ...p, user_id: v }))} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
            <Input label="Plan Name" value={addForm.plan} onChange={(v) => setAddForm((p) => ({ ...p, plan: v }))} placeholder="e.g. 1 Month Plan" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Amount ($)" type="number" value={addForm.amount} onChange={(v) => setAddForm((p) => ({ ...p, amount: v }))} />
              <Input label="Date" type="date" value={addForm.date} onChange={(v) => setAddForm((p) => ({ ...p, date: v }))} />
            </div>
            <div className="flex gap-3 pt-2 justify-end">
              <button onClick={() => setAddingInv(false)} className="px-4 py-2 rounded-lg text-sm text-zinc-400 border border-white/10 hover:border-white/20 transition-all">Cancel</button>
              <button onClick={addInv} disabled={saving || !addForm.user_id || !addForm.plan || !addForm.amount || !addForm.date} className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 flex items-center gap-2 transition-all">
                {saving && <Loader2 className="w-3 h-3 animate-spin" />}<Plus className="w-3.5 h-3.5" />Create
              </button>
            </div>
          </div>
        </Modal>
      )}

      {confirmDel && (
        <Confirm
          message="Delete this invoice permanently? This cannot be undone."
          onConfirm={deleteInv}
          onCancel={() => setConfirmDel(null)}
          loading={deleting}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   SECTION: WORKOUTS  (full CRUD — workouts table)
══════════════════════════════════════════════════ */
interface WorkoutRow {
  id: string; plan_id: number | null; week: number; day: number;
  name: string; type: string; exercises: number; color: string;
  video_url: string; description: string;
}

const COLOR_OPTIONS = [
  { label: "Red",    value: "bg-red-600"     },
  { label: "Blue",   value: "bg-blue-600"    },
  { label: "Green",  value: "bg-emerald-600" },
  { label: "Purple", value: "bg-purple-600"  },
  { label: "Amber",  value: "bg-amber-600"   },
  { label: "Cyan",   value: "bg-cyan-600"    },
  { label: "Rose",   value: "bg-rose-600"    },
  { label: "Indigo", value: "bg-indigo-600"  },
];

const SETUP_SQL = `create table workouts (
  id          uuid default gen_random_uuid() primary key,
  plan_id     int  references plans(id) on delete set null,
  week        int  not null default 1,
  day         int  not null,
  name        text not null,
  type        text not null default '',
  exercises   int  default 0,
  color       text default 'bg-red-600',
  video_url   text default '',
  description text default '',
  created_at  timestamptz default now()
);
alter table workouts enable row level security;
create policy "Admin full access" on workouts for all using (true);`;

const MIGRATION_SQL = `-- Safely add missing columns to an existing workouts table:
alter table workouts add column if not exists plan_id     int  references plans(id) on delete set null;
alter table workouts add column if not exists week        int  not null default 1;
alter table workouts add column if not exists type        text not null default '';
alter table workouts add column if not exists exercises   int  default 0;
alter table workouts add column if not exists color       text default 'bg-red-600';
alter table workouts add column if not exists video_url   text default '';
alter table workouts add column if not exists description text default '';
-- Re-create RLS policy if missing:
drop policy if exists "Admin full access" on workouts;
create policy "Admin full access" on workouts for all using (true);`;

const BLANK_WO = {
  plan_id: "", week: "1", day: "1", name: "", type: "",
  exercises: "0", color: "bg-red-600", video_url: "", description: "",
};

/** Safely map any DB row → WorkoutRow */
function mapRow(r: any): WorkoutRow {
  return {
    id:          r.id          ?? String(Math.random()),
    plan_id:     r.plan_id     ?? null,
    week:        r.week        ?? 1,
    day:         r.day         ?? r.day_number ?? r.week_day ?? 1,
    name:        r.name        ?? r.workout_name ?? r.title  ?? "Workout",
    type:        r.type        ?? r.muscle_group ?? r.category ?? "",
    exercises:   r.exercises   ?? r.exercise_count ?? 0,
    color:       r.color       ?? r.card_color ?? "bg-red-600",
    video_url:   r.video_url   ?? r.video ?? "",
    description: r.description ?? r.notes ?? "",
  };
}

/** True only when the table itself is missing */
function isTableMissing(err: { code?: string; message?: string }) {
  const msg = (err.message ?? "").toLowerCase();
  return (
    err.code === "42P01" ||
    (msg.includes("relation") && msg.includes("does not exist")) ||
    msg.includes("undefined table")
  );
}

function WorkoutsSection() {
  const [workouts, setWorkouts]     = useState<WorkoutRow[]>([]);
  const [plans, setPlans]           = useState<PlanRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loadError, setLoadError]   = useState("");
  const [copied, setCopied]         = useState(false);
  const [filterPlan, setFilterPlan] = useState<string>("all");
  const [editing, setEditing]       = useState<WorkoutRow | null>(null);
  const [adding, setAdding]         = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [editForm, setEditForm]     = useState(BLANK_WO);
  const [addForm, setAddForm]       = useState(BLANK_WO);

  const sel = "w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-red-500 text-white text-sm outline-none transition-all";

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    setNeedsSetup(false);

    const [{ data: planData }, { data, error }] = await Promise.all([
      supabase.from("plans").select("id, name, price").order("price"),
      supabase.from("workouts").select("*").order("week").order("day"),
    ]);
    setPlans(planData ?? []);

    if (error) {
      if (isTableMissing(error)) {
        setNeedsSetup(true);
      } else {
        const { data: raw, error: e2 } = await supabase.from("workouts").select("*");
        if (!e2) {
          setWorkouts((raw ?? []).map(mapRow));
        } else if (isTableMissing(e2)) {
          setNeedsSetup(true);
        } else {
          setLoadError(`${e2.message ?? e2.code ?? "Unknown error"} — check Supabase RLS policies or table schema.`);
        }
      }
      setLoading(false);
      return;
    }

    setWorkouts((data ?? []).map(mapRow));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (w: WorkoutRow) => {
    setEditing(w);
    setEditForm({
      plan_id:     w.plan_id != null ? String(w.plan_id) : "",
      week:        String(w.week),
      day:         String(w.day),
      name:        w.name,
      type:        w.type,
      exercises:   String(w.exercises),
      color:       w.color,
      video_url:   w.video_url,
      description: w.description,
    });
  };

  const buildPayload = (f: typeof BLANK_WO) => ({
    plan_id:     f.plan_id ? Number(f.plan_id) : null,
    week:        Number(f.week),
    day:         Number(f.day),
    name:        f.name,
    type:        f.type,
    exercises:   Number(f.exercises),
    color:       f.color,
    video_url:   f.video_url,
    description: f.description,
  });

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase.from("workouts").update(buildPayload(editForm)).eq("id", editing.id);
    if (error) {
      setLoadError(`Save failed: ${error.message} — run the migration SQL to add missing columns.`);
      setSaving(false); setEditing(null); return;
    }
    await load(); setSaving(false); setEditing(null);
  };

  const addWorkout = async () => {
    setSaving(true);
    const { error } = await supabase.from("workouts").insert(buildPayload(addForm));
    if (error) {
      setLoadError(`Insert failed: ${error.message} — run the migration SQL to add missing columns.`);
      setSaving(false); setAdding(false); return;
    }
    await load(); setSaving(false); setAdding(false); setAddForm(BLANK_WO);
  };

  const deleteWorkout = async () => {
    if (!confirmDel) return;
    setDeleting(true);
    await supabase.from("workouts").delete().eq("id", confirmDel);
    await load(); setDeleting(false); setConfirmDel(null);
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  /* ── Shared form modal ── */
  const WorkoutForm = ({
    form, setForm, onSave, onCancel, title,
  }: {
    form: typeof BLANK_WO;
    setForm: React.Dispatch<React.SetStateAction<typeof BLANK_WO>>;
    onSave: () => void; onCancel: () => void; title: string;
  }) => (
    <Modal title={title} onClose={onCancel}>
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">

        {/* Plan + Week + Day row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5 sm:col-span-1">
            <label className="text-xs text-zinc-400 font-medium">Plan</label>
            <select value={form.plan_id} onChange={(e) => setForm((p) => ({ ...p, plan_id: e.target.value }))} className={sel}>
              <option value="">— All Plans —</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name} (${p.price})</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400 font-medium">Week #</label>
            <input type="number" min={1} value={form.week} onChange={(e) => setForm((p) => ({ ...p, week: e.target.value }))}
              className={sel} placeholder="1" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400 font-medium">Day (1–7)</label>
            <select value={form.day} onChange={(e) => setForm((p) => ({ ...p, day: e.target.value }))} className={sel}>
              {[1,2,3,4,5,6,7].map((d) => <option key={d} value={d}>Day {d}</option>)}
            </select>
          </div>
        </div>

        {/* Name + Type */}
        <Input label="Workout Name" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} placeholder="e.g. Bench Press" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Muscle Group" value={form.type} onChange={(v) => setForm((p) => ({ ...p, type: v }))} placeholder="e.g. Chest, Arms…" />
          <Input label="Exercise Count" type="number" value={form.exercises} onChange={(v) => setForm((p) => ({ ...p, exercises: v }))} />
        </div>

        {/* Video URL */}
        <Input label="Video URL" value={form.video_url} onChange={(v) => setForm((p) => ({ ...p, video_url: v }))} placeholder="https://youtube.com/…" />

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-zinc-400 font-medium">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            rows={3}
            placeholder="Notes, instructions, tips…"
            className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-red-500 focus:ring-1 focus:ring-red-500/30 text-white text-sm outline-none transition-all placeholder-zinc-600 resize-none"
          />
        </div>

        {/* Color picker */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-zinc-400 font-medium">Card Color</label>
          <div className="flex flex-wrap gap-2 pt-1">
            {COLOR_OPTIONS.map((c) => (
              <button key={c.value} type="button"
                onClick={() => setForm((p) => ({ ...p, color: c.value }))}
                className={`w-8 h-8 rounded-lg ${c.value} border-2 transition-all flex-shrink-0 ${form.color === c.value ? "border-white scale-110" : "border-transparent opacity-60 hover:opacity-100"}`}
                title={c.label}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-zinc-400 border border-white/10 hover:border-white/20 transition-all">Cancel</button>
          <button onClick={onSave} disabled={saving || !form.name} className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-500 text-white disabled:opacity-60 flex items-center gap-2 transition-all">
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}<Check className="w-3.5 h-3.5" />Save
          </button>
        </div>
      </div>
    </Modal>
  );

  /* ── filter + group ── */
  const filtered = workouts.filter((w) =>
    filterPlan === "all" ? true : w.plan_id === Number(filterPlan)
  );

  const planName = (id: number | null) =>
    id == null ? "All Plans" : (plans.find((p) => p.id === id)?.name ?? `Plan ${id}`);

  // Group: week → day → workouts[]
  const grouped = filtered.reduce<Record<number, Record<number, WorkoutRow[]>>>((acc, w) => {
    (acc[w.week] ??= {});
    (acc[w.week][w.day] ??= []).push(w);
    return acc;
  }, {});
  const weeks = Object.keys(grouped).map(Number).sort((a, b) => a - b);

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-black text-white" style={{ fontFamily: "'Oswald', sans-serif" }}>Workouts</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {!needsSetup && !loadError && (
            <>
              {/* Plan filter */}
              <select
                value={filterPlan}
                onChange={(e) => setFilterPlan(e.target.value)}
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-zinc-300 outline-none focus:border-red-500/50 transition-all"
              >
                <option value="all">All Plans</option>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button
                onClick={() => { setAdding(true); setAddForm(BLANK_WO); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />Add Workout
              </button>
            </>
          )}
          <button onClick={load} className="p-2 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-white transition-colors"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-red-500 animate-spin" /></div>}

      {/* Setup banner */}
      {needsSetup && !loading && (
        <div className="glass rounded-2xl border border-amber-600/30 p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Dumbbell className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-300 mb-1">One-time setup required</p>
              <p className="text-xs text-zinc-400">Run this SQL in Supabase SQL Editor to create the workouts table, then click Retry.</p>
            </div>
          </div>
          <pre className="text-xs text-green-300 bg-black/40 rounded-xl p-4 overflow-x-auto font-mono leading-relaxed">{SETUP_SQL}</pre>
          <div className="flex items-center gap-3">
            <button onClick={() => copyText(SETUP_SQL)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-zinc-300 border border-white/10 transition-all">
              {copied ? <><Check className="w-3.5 h-3.5 text-green-400" />Copied!</> : "Copy SQL"}
            </button>
            <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-sm text-white font-semibold transition-all">
              <RefreshCw className="w-3.5 h-3.5" />Retry
            </button>
          </div>
        </div>
      )}

      {/* Load / save error */}
      {loadError && !loading && (
        <div className="glass rounded-2xl border border-red-600/30 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <X className="w-4 h-4 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-300 mb-1">Error</p>
              <p className="text-xs text-zinc-400 break-words">{loadError}</p>
            </div>
            <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-zinc-300 border border-white/10 flex-shrink-0 transition-all">
              <RefreshCw className="w-3 h-3" />Retry
            </button>
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-2">Run this migration in Supabase SQL Editor to safely add missing columns:</p>
            <pre className="text-xs text-green-300 bg-black/40 rounded-xl p-4 overflow-x-auto font-mono leading-relaxed">{MIGRATION_SQL}</pre>
            <button onClick={() => copyText(MIGRATION_SQL)} className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-zinc-300 border border-white/10 transition-all">
              {copied ? <><Check className="w-3.5 h-3.5 text-green-400" />Copied!</> : "Copy Migration SQL"}
            </button>
          </div>
        </div>
      )}

      {/* ── Card grid: grouped by Week → Day ── */}
      {!needsSetup && !loadError && !loading && (
        <>
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-zinc-600 text-sm">
              {workouts.length === 0 ? "No workouts yet — add one above." : "No workouts match the selected plan."}
            </div>
          ) : (
            <div className="space-y-6">
              {weeks.map((week) => (
                <div key={week}>
                  {/* Week header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-px flex-1 bg-white/5" />
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest px-2">Week {week}</span>
                    <div className="h-px flex-1 bg-white/5" />
                  </div>

                  <div className="space-y-3">
                    {Object.keys(grouped[week]).map(Number).sort((a, b) => a - b).map((day) => (
                      <div key={day}>
                        <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest mb-1.5 px-0.5">Day {day}</p>
                        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                          {grouped[week][day].map((w) => (
                            <div key={w.id} className="glass rounded-2xl border border-white/5 p-4 group">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={`w-9 h-9 rounded-lg ${w.color} flex items-center justify-center text-white font-black text-sm flex-shrink-0`}>{w.day}</div>
                                  <div className="min-w-0">
                                    <div className="font-semibold text-white text-sm truncate">{w.name}</div>
                                    <div className="text-xs text-zinc-500 truncate">
                                      {w.type}{w.exercises ? ` · ${w.exercises} ex` : ""}
                                    </div>
                                  </div>
                                </div>
                                {/* Actions — always visible on mobile */}
                                <div className="flex items-center gap-1 flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => openEdit(w)} className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => setConfirmDel(w.id)} className="p-1.5 rounded-lg hover:bg-red-900/30 text-zinc-400 hover:text-red-400 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                              </div>
                              {/* Plan badge + video + description */}
                              <div className="mt-2.5 space-y-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {w.plan_id != null && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-900/25 text-red-400 border border-red-700/20">
                                      {planName(w.plan_id)}
                                    </span>
                                  )}
                                  {w.video_url && (
                                    <a href={w.video_url} target="_blank" rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-900/25 text-blue-400 border border-blue-700/20 hover:bg-blue-900/40 transition-colors">
                                      ▶ Video
                                    </a>
                                  )}
                                </div>
                                {w.description && (
                                  <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">{w.description}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {editing && <WorkoutForm title={`Edit — ${editing.name}`} form={editForm} setForm={setEditForm} onSave={saveEdit} onCancel={() => setEditing(null)} />}
      {adding  && <WorkoutForm title="Add Workout" form={addForm} setForm={setAddForm} onSave={addWorkout} onCancel={() => setAdding(false)} />}
      {confirmDel && (
        <Confirm message="Delete this workout permanently?" onConfirm={deleteWorkout} onCancel={() => setConfirmDel(null)} loading={deleting} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MAIN ADMIN PAGE
══════════════════════════════════════════════════ */
const SECTIONS: { id: Section; label: string; Icon: React.ElementType }[] = [
  { id: "overview",       label: "Overview",      Icon: LayoutDashboard },
  { id: "plans",          label: "Plans",         Icon: Layers          },
  { id: "users",          label: "Users",         Icon: Users           },
  { id: "subscriptions",  label: "Subscriptions", Icon: CreditCard      },
  { id: "invoices",       label: "Invoices",      Icon: FileText        },
  { id: "workouts",       label: "Workouts",      Icon: Dumbbell        },
];

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [section, setSection] = useState<Section>("overview");

  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL as string | undefined;
  const isAdmin =
    (adminEmail && user?.email === adminEmail) ||
    user?.user_metadata?.role === "admin";

  // Redirect unauthenticated users after render
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login", { replace: true });
    }
  }, [user, authLoading]);

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center pt-16">
        <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
      </div>
    );
  }

  // Access denied
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center pt-16 px-4">
        <div className="text-center glass rounded-2xl p-12 border border-red-600/20 max-w-md w-full">
          <div className="w-20 h-20 rounded-full bg-red-900/20 flex items-center justify-center mx-auto mb-6">
            <Shield className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-3xl font-black text-white mb-3" style={{ fontFamily: "'Oswald', sans-serif" }}>Access Denied</h2>
          <p className="text-zinc-500 mb-8 leading-relaxed">
            This area is restricted to administrators only. If you believe this is an error, contact the system administrator.
          </p>
          <button onClick={() => navigate("/")} className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-all">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const ActiveSection = {
    overview:      OverviewSection,
    plans:         PlansSection,
    users:         UsersSection,
    subscriptions: SubscriptionsSection,
    invoices:      InvoicesSection,
    workouts:      WorkoutsSection,
  }[section];

  return (
    <div className="min-h-screen bg-transparent pt-16">
      <div className="flex min-h-[calc(100vh-4rem)]">

        {/* ── Desktop sidebar ── */}
        <aside className="hidden md:flex flex-col w-56 border-r border-white/5 glass-light py-6 px-3 flex-shrink-0">
          <div className="flex items-center gap-2 px-3 mb-6">
            <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-white" style={{ fontFamily: "'Oswald', sans-serif" }}>ADMIN</span>
          </div>
          <nav className="space-y-0.5">
            {SECTIONS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                  section === id
                    ? "bg-red-600/15 text-red-400 border border-red-600/20"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </button>
            ))}
          </nav>
          <div className="mt-auto px-3 pt-4 border-t border-white/5">
            <p className="text-[11px] text-zinc-600 truncate">{user.email}</p>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 px-4 py-6 md:px-8 pb-24 md:pb-6 overflow-x-hidden">
          <ActiveSection />
        </main>
      </div>

      {/* ── Mobile bottom tab bar ── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass border-t border-white/5 flex">
        {SECTIONS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 transition-all ${
              section === id ? "text-red-400" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="text-[10px] font-medium leading-tight">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
