/* eslint-disable */
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import LoadingRule from "@/components/LoadingRule";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, ShieldX, ExternalLink, ImageIcon } from "lucide-react";
import { toast } from "sonner";

const RANKS = [
  { v: "GC1", l: "Grand Champion 1" },
  { v: "GC2", l: "Grand Champion 2" },
  { v: "GC3", l: "Grand Champion 3" },
  { v: "SSL", l: "Supersonic Legend" },
];

export default function AdminVerifications() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending");
  const [forbidden, setForbidden] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const cli = await api();
      const { data } = await cli.get(`/admin/verifications?status_filter=${tab}`);
      setRows(data);
    } catch (e) {
      if (e?.response?.status === 403) {
        setForbidden(true);
      } else {
        toast.error("Failed to load");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

  if (loading) return <LoadingRule label="Loading Review Queue" />;

  if (forbidden) {
    return (
      <div className="min-h-screen bg-[#050505]">
        <Navbar />
        <div className="max-w-2xl mx-auto px-6 py-20 text-center" data-testid="admin-forbidden">
          <ShieldX className="w-12 h-12 text-[#ff003c] mx-auto mb-4" />
          <h1 className="font-display font-black uppercase text-3xl mb-2">Admin Only</h1>
          <p className="text-zinc-400 mb-6">
            You're signed in as <span className="font-mono-rl">{user?.email}</span>. To access
            this page, add your email to the <code className="text-[#007aff]">ADMIN_EMAILS</code>{" "}
            environment variable in the backend.
          </p>
          <Link to="/dashboard" className="btn-ghost-volt hud-clip px-5 py-2 text-xs inline-block">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="font-mono-rl text-xs tracking-[0.3em] text-[#ff6b00] mb-2">
          /// ADMIN
        </div>
        <h1 className="font-display font-black uppercase text-4xl mb-6">Creator Review Queue</h1>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-transparent border border-white/10 rounded-none p-0 h-auto">
            <TabsTrigger value="pending" className="rounded-none data-[state=active]:bg-[#ffd500] data-[state=active]:text-black font-display uppercase tracking-wider px-5 py-2" data-testid="admin-tab-pending">Pending</TabsTrigger>
            <TabsTrigger value="approved" className="rounded-none data-[state=active]:bg-[#00ff66] data-[state=active]:text-black font-display uppercase tracking-wider px-5 py-2" data-testid="admin-tab-approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected" className="rounded-none data-[state=active]:bg-[#ff003c] data-[state=active]:text-white font-display uppercase tracking-wider px-5 py-2" data-testid="admin-tab-rejected">Rejected</TabsTrigger>
            <TabsTrigger value="all" className="rounded-none data-[state=active]:bg-white data-[state=active]:text-black font-display uppercase tracking-wider px-5 py-2" data-testid="admin-tab-all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="mt-6 space-y-3" data-testid="admin-verifications-list">
          {rows.length === 0 ? (
            <div className="hud-clip border border-white/10 bg-[#0a0a0a] p-10 text-center text-zinc-400 font-mono-rl text-xs tracking-widest">
              // NO {tab.toUpperCase()} REQUESTS
            </div>
          ) : (
            rows.map((r) => <Row key={r.user_id} r={r} onChange={load} />)
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ r, onChange }) {
  const [peakRank, setPeakRank] = useState(r.peak_rank || "GC1");
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [showReject, setShowReject] = useState(false);

  const approve = async () => {
    setBusy(true);
    try {
      const cli = await api();
      await cli.post(`/admin/verifications/${r.user_id}/approve`, { peak_rank: peakRank });
      toast.success("Approved");
      onChange();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!rejectReason.trim()) return toast.error("Provide a rejection reason");
    setBusy(true);
    try {
      const cli = await api();
      await cli.post(`/admin/verifications/${r.user_id}/reject`, { reason: rejectReason });
      toast.success("Rejected");
      onChange();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="hud-clip border border-white/10 bg-[#0a0a0a] p-5" data-testid={`admin-row-${r.user_id}`}>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="font-display font-bold uppercase">{r.display_name || r.email || r.user_id}</div>
            <span className="font-mono-rl text-[10px] tracking-widest text-zinc-500">{r.email}</span>
            <StatusBadge status={r.verification_status} verified={r.verified} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <Field label="PLATFORM" value={r.platform?.toUpperCase()} />
            <Field label="USERNAME" value={r.rl_username} />
            <Field label="CLAIMED PEAK" value={r.peak_rank} />
            <Field label="SUBMITTED" value={r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "—"} />
          </div>
          <div className="flex gap-2 flex-wrap">
            {r.rl_tracker_url && (
              <a href={r.rl_tracker_url} target="_blank" rel="noreferrer" className="btn-ghost-volt hud-clip px-3 py-1.5 text-xs inline-flex items-center gap-1.5" data-testid={`admin-tracker-link-${r.user_id}`}>
                <ExternalLink className="w-3 h-3" /> RL Tracker
              </a>
            )}
            {r.screenshot_url && (
              <a href={r.screenshot_url} target="_blank" rel="noreferrer" className="btn-ghost-volt hud-clip px-3 py-1.5 text-xs inline-flex items-center gap-1.5" data-testid={`admin-screenshot-link-${r.user_id}`}>
                <ImageIcon className="w-3 h-3" /> Screenshot
              </a>
            )}
          </div>
          {r.verification_code && (
            <div className="font-mono-rl text-xs">
              VERIFICATION CODE TO LOOK FOR: <span className="text-[#ff6b00] font-bold">{r.verification_code}</span>
            </div>
          )}
          {r.rejection_reason && (
            <div className="text-xs text-[#ff5577] font-mono-rl">REASON: {r.rejection_reason}</div>
          )}
        </div>

        {r.verification_status === "pending" && (
          <div className="space-y-3 border-l border-white/10 pl-4">
            <div>
              <div className="font-mono-rl text-[10px] tracking-widest text-zinc-400 mb-1">CONFIRM PEAK RANK</div>
              <Select value={peakRank} onValueChange={setPeakRank}>
                <SelectTrigger className="bg-zinc-950 border-white/10 rounded-none" data-testid={`admin-rank-select-${r.user_id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a0a] border-white/10 rounded-none">
                  {RANKS.map((rr) => <SelectItem key={rr.v} value={rr.v}>{rr.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <button
              onClick={approve}
              disabled={busy}
              className="btn-boost hud-clip w-full py-2 text-xs inline-flex items-center justify-center gap-2"
              data-testid={`admin-approve-${r.user_id}`}
            >
              <ShieldCheck className="w-4 h-4" /> Approve
            </button>
            {showReject ? (
              <div className="space-y-2">
                <input
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Reason for rejection..."
                  className="w-full px-3 py-2 bg-zinc-950 border border-[#ff003c]/40 text-sm"
                  data-testid={`admin-reject-reason-${r.user_id}`}
                />
                <button
                  onClick={reject}
                  disabled={busy}
                  className="w-full py-2 text-xs border border-[#ff003c]/40 bg-[#ff003c]/10 text-[#ff5577] font-display uppercase tracking-wider"
                  data-testid={`admin-reject-confirm-${r.user_id}`}
                >
                  Reject
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowReject(true)}
                className="w-full py-2 text-xs font-mono-rl text-zinc-500 hover:text-[#ff5577] tracking-widest"
                data-testid={`admin-reject-show-${r.user_id}`}
              >
                // REJECT INSTEAD
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="font-mono-rl text-[10px] tracking-widest text-zinc-500">{label}</div>
      <div className="text-sm text-zinc-200 truncate">{value || "—"}</div>
    </div>
  );
}

function StatusBadge({ status, verified }) {
  const map = {
    pending: { c: "#ffd500", l: "PENDING" },
    approved: { c: "#00ff66", l: "APPROVED" },
    rejected: { c: "#ff003c", l: "REJECTED" },
    none: { c: "#71717a", l: "NONE" },
  };
  const s = map[status] || map.none;
  return (
    <span className="tag" style={{ borderColor: s.c, color: s.c }}>
      {s.l}
    </span>
  );
}
