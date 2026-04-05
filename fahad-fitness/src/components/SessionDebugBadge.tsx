import { useAuth } from "@/context/AuthContext";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL as string | undefined;

function isAdmin(userEmail: string | undefined, role: string | undefined): boolean {
  if (!userEmail) return false;
  if (ADMIN_EMAIL && userEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return true;
  if (role === "admin") return true;
  return false;
}

function shorten(sid: string | null): string {
  if (!sid) return "(none)";
  return sid.slice(0, 8) + "…";
}

export default function SessionDebugBadge() {
  const { user, sessionDebug } = useAuth();

  const role = (user?.user_metadata?.role as string | undefined);
  if (!isAdmin(user?.email, role)) return null;

  const { localSid, dbSid, match, tableMissing, checkedAt } = sessionDebug;

  let statusColor = "bg-zinc-800 border-zinc-600 text-zinc-300";
  let statusLabel = "Checking…";

  if (tableMissing) {
    statusColor = "bg-amber-950 border-amber-500 text-amber-300";
    statusLabel = "⚠ TABLE MISSING";
  } else if (match === true) {
    statusColor = "bg-green-950 border-green-600 text-green-300";
    statusLabel = "✓ MATCH";
  } else if (match === false) {
    statusColor = "bg-red-950 border-red-600 text-red-300";
    statusLabel = "✗ MISMATCH → kicking";
  }

  return (
    <div
      className={`fixed bottom-4 right-4 z-[9999] rounded-xl border px-3 py-2 text-[11px] font-mono shadow-2xl backdrop-blur-sm ${statusColor}`}
      style={{ maxWidth: 300 }}
    >
      <div className="font-bold mb-1 text-[12px] tracking-wide">SESSION DEBUG</div>
      <div className="space-y-0.5">
        <div>local: <span className="opacity-90">{shorten(localSid)}</span></div>
        <div>db:    <span className="opacity-90">{shorten(dbSid)}</span></div>
        <div className="font-bold">{statusLabel}</div>
        {checkedAt && (
          <div className="opacity-50 text-[10px]">
            checked {checkedAt.toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}
