"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Wallet,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  IndianRupee,
  TrendingDown,
  Calendar,
  Building2,
  User,
} from "lucide-react";
import {
  getPayouts,
  releasePayout,
  getRefundRequests,
  approveRefundRequest,
  rejectRefundRequest,
  getCommunityPayoutSettings,
  updateCommunityPayoutSettings,
  type EventPayout,
  type RefundRequest,
  type CommunityPayoutSetting,
  type LedgerTier,
} from "@/lib/api";

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt(amount: string | number | null): string {
  if (amount === null || amount === undefined) return "—";
  const n = parseFloat(String(amount));
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const payoutStatusColors: Record<string, string> = {
  ready:    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  released: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  pending:  "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

const refundStatusColors: Record<string, string> = {
  pending_review:  "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  auto_approved:   "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  manual_review:   "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  approved:        "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  completed:       "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  rejected:        "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const refundStatusLabels: Record<string, string> = {
  pending_review: "Pending Review",
  auto_approved:  "Auto-Approved",
  manual_review:  "Manual Review",
  approved:       "Approved",
  completed:      "Completed",
  rejected:       "Rejected",
};

// ─── Ledger Snapshot Expander ────────────────────────────────────────────────

function LedgerSnapshotView({ payout }: { payout: EventPayout }) {
  const snapshot = payout.ledger_snapshot;
  const totals = snapshot?.totals;
  const isNegative = parseFloat(payout.final_payout_amount) < 0;

  return (
    <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-4">
      {snapshot?.notes && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 p-3 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{snapshot.notes}</span>
        </div>
      )}

      {/* Per-tier breakdown */}
      {snapshot?.tiers && snapshot.tiers.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Ticket Tier Breakdown</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Tickets</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Platform Fee (8%)</TableHead>
                <TableHead className="text-right">Net (pre-refund)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshot.tiers.map((tier: LedgerTier, i: number) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{tier.tier_name}</TableCell>
                  <TableCell className="text-right">{tier.tickets_sold}</TableCell>
                  <TableCell className="text-right">{fmt(tier.gross)}</TableCell>
                  <TableCell className="text-right text-red-600">−{fmt(tier.platform_fee)}</TableCell>
                  <TableCell className="text-right">{fmt(tier.net_before_refund)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Totals */}
      {totals && (
        <div className="border-t pt-3 space-y-1.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Gross Revenue</span>
            <span className="font-medium">{fmt(totals.gross_revenue)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Discounts Applied</span>
            <span className="text-muted-foreground">−{fmt(totals.total_discounts)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Platform Fee (8%)</span>
            <span className="text-red-600">−{fmt(totals.platform_fee_amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Refunds Deducted</span>
            <span className="text-orange-600">−{fmt(totals.refunds_deducted)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-muted-foreground italic">Tax (pending compliance)</span>
            <span className="text-xs text-muted-foreground italic">null — deferred</span>
          </div>
          <div className="flex justify-between border-t pt-2 font-semibold text-base">
            <span className={isNegative ? "text-red-600" : ""}>Final Payout</span>
            <span className={isNegative ? "text-red-600" : "text-green-600"}>
              {isNegative && <TrendingDown className="inline h-4 w-4 mr-1" />}
              {fmt(payout.final_payout_amount)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Computed at: {fmtDate(snapshot.computed_at)}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── REFUND QUEUE TAB ────────────────────────────────────────────────────────

function RefundQueueTab() {
  const [requests, setRequests] = useState<RefundRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Reject dialog
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRefundRequests({ status: statusFilter });
      setRequests(data.requests);
      setTotal(data.total);
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id: number) => {
    if (!confirm("Execute this refund via Razorpay? This cannot be undone.")) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await approveRefundRequest(id);
      await load();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Approval failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectOpen = (id: number) => {
    setRejectingId(id);
    setRejectionReason("");
    setActionError(null);
    setRejectDialogOpen(true);
  };

  const handleRejectSubmit = async () => {
    if (!rejectingId || !rejectionReason.trim()) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await rejectRefundRequest(rejectingId, rejectionReason);
      setRejectDialogOpen(false);
      await load();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Rejection failed");
    } finally {
      setActionLoading(false);
    }
  };

  const actionableStatuses = ["pending_review", "auto_approved", "manual_review"];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="manual_review">Manual Review</SelectItem>
            <SelectItem value="auto_approved">Auto-Approved</SelectItem>
            <SelectItem value="pending_review">Pending Review</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-2" />Refresh
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">{total} request(s)</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No refund requests found</div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Policy</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((rq) => (
                <>
                  <TableRow key={rq.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell onClick={() => setExpandedId(expandedId === rq.id ? null : rq.id)}>
                      {expandedId === rq.id
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      }
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{rq.buyer_name}</div>
                      <div className="text-xs text-muted-foreground">@{rq.buyer_username}</div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[180px] truncate font-medium">{rq.event_title}</div>
                      <div className="text-xs text-muted-foreground">{fmtDate(rq.event_start)}</div>
                    </TableCell>
                    <TableCell>{rq.ticket_tier_name ?? "—"}</TableCell>
                    <TableCell className="font-semibold">{fmt(rq.requested_amount)}</TableCell>
                    <TableCell>
                      <div className="text-xs text-muted-foreground">
                        {rq.policy_snapshot?.percentage}% · {rq.policy_snapshot?.deadline_hours_before}h
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={refundStatusColors[rq.status]}>
                        {refundStatusLabels[rq.status] ?? rq.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtDate(rq.requested_at)}
                    </TableCell>
                    <TableCell>
                      {actionableStatuses.includes(rq.status) && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-green-400 text-green-700 hover:bg-green-50"
                            onClick={() => handleApprove(rq.id)}
                            disabled={actionLoading}
                          >
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-400 text-red-700 hover:bg-red-50"
                            onClick={() => handleRejectOpen(rq.id)}
                            disabled={actionLoading}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />Reject
                          </Button>
                        </div>
                      )}
                      {rq.status === "rejected" && rq.decided_by_name && (
                        <span className="text-xs text-muted-foreground">by {rq.decided_by_name}</span>
                      )}
                    </TableCell>
                  </TableRow>
                  {expandedId === rq.id && (
                    <TableRow key={`${rq.id}-detail`}>
                      <TableCell colSpan={9} className="bg-muted/20">
                        <div className="py-2 px-4 space-y-2 text-sm">
                          {rq.reason && (
                            <div><span className="font-medium">Buyer reason: </span>{rq.reason}</div>
                          )}
                          {rq.rejection_reason && (
                            <div className="text-red-600"><span className="font-medium">Rejection reason: </span>{rq.rejection_reason}</div>
                          )}
                          <div className="text-muted-foreground text-xs">
                            Request #{rq.id} · Registration #{rq.registration_id}
                            {rq.decided_by_name && ` · Decided by ${rq.decided_by_name}`}
                            {rq.decided_at && ` on ${fmtDate(rq.decided_at)}`}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {actionError && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-red-700 text-sm">
          {actionError}
        </div>
      )}

      {/* Reject dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Refund Request</DialogTitle>
            <DialogDescription>
              Provide a reason for rejection. This will be stored and may be displayed to the buyer.
              No Razorpay call will be made.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection (required)"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="min-h-[100px]"
          />
          {actionError && (
            <p className="text-sm text-red-600">{actionError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectSubmit}
              disabled={actionLoading || !rejectionReason.trim()}
            >
              {actionLoading ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── PAYOUT LEDGER TAB ───────────────────────────────────────────────────────

function PayoutLedgerTab() {
  const [payouts, setPayouts] = useState<EventPayout[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPayouts({ status: statusFilter });
      setPayouts(data.payouts);
      setTotal(data.total);
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleRelease = async (payout: EventPayout) => {
    const finalAmt = parseFloat(payout.final_payout_amount);
    const negativeWarning = finalAmt < 0
      ? `\n\n⚠️ WARNING: This payout has a NEGATIVE amount (${fmt(payout.final_payout_amount)}). Are you sure?`
      : "";
    if (!confirm(`Mark payout for "${payout.event_title}" as released? This is a bookkeeping action only — no real bank transfer occurs.${negativeWarning}`)) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await releasePayout(payout.id);
      await load();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Release failed");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="released">Released</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-2" />Refresh
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">{total} payout(s)</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : payouts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No payouts found. Payouts are computed automatically 48h after each event ends.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Community</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Fee (8%)</TableHead>
                <TableHead>Refunds</TableHead>
                <TableHead>Final Payout</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.map((p) => {
                const isNegative = parseFloat(p.final_payout_amount) < 0;
                return (
                  <>
                    <TableRow key={p.id} className="hover:bg-muted/50 cursor-pointer">
                      <TableCell onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                        {expandedId === p.id
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        }
                      </TableCell>
                      <TableCell>
                        <div className="font-medium max-w-[180px] truncate">{p.event_title}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />{fmtDate(p.event_end)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {p.community_name}
                        </div>
                      </TableCell>
                      <TableCell>{fmt(p.gross_revenue)}</TableCell>
                      <TableCell className="text-red-600">−{fmt(p.platform_fee_amount)}</TableCell>
                      <TableCell className="text-orange-600">−{fmt(p.refunds_deducted)}</TableCell>
                      <TableCell className={`font-semibold ${isNegative ? "text-red-600" : "text-green-600"}`}>
                        {isNegative && <TrendingDown className="inline h-4 w-4 mr-1" />}
                        {fmt(p.final_payout_amount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {p.trigger_type === "early_on_demand" ? "Early" : "Scheduled"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={payoutStatusColors[p.status]}>
                          {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {p.status === "ready" && (
                          <Button
                            size="sm"
                            onClick={() => handleRelease(p)}
                            disabled={actionLoading}
                          >
                            Mark Released
                          </Button>
                        )}
                        {p.status === "released" && p.released_by_name && (
                          <span className="text-xs text-muted-foreground">
                            by {p.released_by_name}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                    {expandedId === p.id && (
                      <TableRow key={`${p.id}-detail`}>
                        <TableCell colSpan={10} className="bg-muted/20 p-4">
                          <LedgerSnapshotView payout={p} />
                          {p.actual_released_at && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Released at {fmtDate(p.actual_released_at)}
                              {p.released_by_name && ` by ${p.released_by_name}`}
                            </p>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {actionError && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-red-700 text-sm">
          {actionError}
        </div>
      )}
    </div>
  );
}

// ─── COMMUNITY SETTINGS TAB ──────────────────────────────────────────────────

function CommunitySettingsTab() {
  const [settings, setSettings] = useState<CommunityPayoutSetting[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toggling, setToggling] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCommunityPayoutSettings({ search: search || undefined });
      setSettings(data.settings);
      setTotal(data.total);
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const handleToggle = async (communityId: number, current: boolean) => {
    const action = !current ? "enable" : "disable";
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} early payout for this community?`)) return;
    setToggling(communityId);
    setError(null);
    try {
      await updateCommunityPayoutSettings(communityId, !current);
      setSettings((prev) =>
        prev.map((s) =>
          s.community_id === communityId
            ? { ...s, early_payout_enabled: !current }
            : s
        )
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update settings");
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search communities..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <span className="text-sm text-muted-foreground ml-auto">{total} communities</span>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-red-700 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : settings.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No communities found</div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Community</TableHead>
                <TableHead>Early Payout</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>Updated By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settings.map((s) => (
                <TableRow key={s.community_id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {s.logo_url ? (
                        <img src={s.logo_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                      ) : (
                        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <span className="font-medium">{s.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={s.early_payout_enabled}
                        onCheckedChange={() => handleToggle(s.community_id, s.early_payout_enabled)}
                        disabled={toggling === s.community_id}
                      />
                      <span className={`text-sm ${s.early_payout_enabled ? "text-green-600 font-medium" : "text-muted-foreground"}`}>
                        {s.early_payout_enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {fmtDate(s.updated_at)}
                  </TableCell>
                  <TableCell>
                    {s.updated_by_name ? (
                      <div className="flex items-center gap-1 text-sm">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        {s.updated_by_name}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function FinancePage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Wallet className="h-6 w-6" />
          Finance
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage refund requests, payout ledgers, and community payout settings.
        </p>
        <div className="mt-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-amber-800 text-sm dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300">
          <strong>Note:</strong> &quot;Mark as Released&quot; is a bookkeeping action only. No real bank transfer is executed —
          Route/KYB infrastructure is not yet integrated. Tax amounts are intentionally omitted pending compliance decision.
        </div>
      </div>

      <Tabs defaultValue="refunds" className="space-y-4">
        <TabsList>
          <TabsTrigger value="refunds">Refund Queue</TabsTrigger>
          <TabsTrigger value="payouts">Payout Ledger</TabsTrigger>
          <TabsTrigger value="settings">Community Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="refunds">
          <Card>
            <CardHeader>
              <CardTitle>Refund Queue</CardTitle>
              <CardDescription>
                Review and action buyer refund requests. Approving executes a real Razorpay refund.
                All downstream reconciliation (registration cancellation, inventory) is handled by
                the refund.created webhook automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RefundQueueTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payouts">
          <Card>
            <CardHeader>
              <CardTitle>Payout Ledger</CardTitle>
              <CardDescription>
                Computed payouts per event. Auto-computed 48h after event end. Expand rows to see
                itemized ledger. &quot;Mark as Released&quot; records that payout was made — no automated
                bank transfer occurs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PayoutLedgerTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Community Payout Settings</CardTitle>
              <CardDescription>
                Toggle early payout eligibility per community. When enabled, admins can trigger
                payout immediately after an event ends (skips the standard 48h wait).
                Communities cannot enable this themselves.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CommunitySettingsTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
