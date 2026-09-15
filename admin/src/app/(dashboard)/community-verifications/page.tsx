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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  FileText,
  Info,
  ExternalLink,
  Building2,
  Users,
  GraduationCap,
  Calendar,
} from "lucide-react";
import {
  getCommunityVerifications,
  reviewCommunityVerification,
  getCommunityVerificationDocument,
  type CommunityVerificationItem,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Badge helpers — exact Tailwind classes reused from member verifications page
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: CommunityVerificationItem["status"] }) {
  if (status === "approved") {
    return (
      <Badge
        variant="outline"
        className="border-green-200 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 font-medium"
      >
        Approved
      </Badge>
    );
  }
  if (status === "rejected") {
    return (
      <Badge
        variant="outline"
        className="border-red-200 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 font-medium"
      >
        Rejected
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 font-medium"
    >
      Pending
    </Badge>
  );
}

function TierBadge({ tier }: { tier: CommunityVerificationItem["tier"] }) {
  if (tier === "community_verified") {
    return (
      <Badge
        variant="outline"
        className="border-violet-200 bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 font-medium"
      >
        Community Verified
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-sky-200 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 font-medium"
    >
      Registered Org
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CommunityVerificationsPage() {
  const [verifications, setVerifications] = useState<CommunityVerificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters and pagination
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [tierFilter, setTierFilter] = useState<"all" | "community_verified" | "registered_org">("all");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Review dialog state
  const [selected, setSelected] = useState<CommunityVerificationItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [resolving, setResolving] = useState(false);

  // Document fetch state (lazy — fetched only on button click, not on dialog open)
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  const loadVerifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCommunityVerifications({
        status: statusFilter,
        tier: tierFilter,
        page,
        limit: pageSize,
      });
      setVerifications(data.verifications || []);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error("Failed to load community verifications:", err);
      setError(err instanceof Error ? err.message : "Failed to load verifications");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, tierFilter, page, pageSize]);

  useEffect(() => {
    loadVerifications();
  }, [loadVerifications]);

  async function handleReview(status: "approved" | "rejected") {
    if (!selected) return;
    if (status === "rejected" && !rejectionReason.trim()) return;

    try {
      setResolving(true);
      await reviewCommunityVerification(
        selected.id,
        status,
        status === "rejected" ? rejectionReason.trim() : undefined
      );
      // Close modal and reset state
      setSelected(null);
      setRejectionReason("");
      // Refetch current page
      await loadVerifications();
    } catch (err) {
      console.error("Failed to review community verification:", err);
      alert(err instanceof Error ? err.message : "Failed to review verification");
    } finally {
      setResolving(false);
    }
  }

  // Fetch signed document URL only when admin clicks the button
  async function handleViewDocument() {
    if (!selected) return;
    try {
      setDocLoading(true);
      setDocError(null);
      const { url } = await getCommunityVerificationDocument(selected.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch document";
      const isNotFound =
        msg.includes("404") ||
        msg.toLowerCase().includes("not found") ||
        msg.toLowerCase().includes("no_document");
      setDocError(
        isNotFound
          ? "No document is attached to this submission."
          : msg
      );
    } finally {
      setDocLoading(false);
    }
  }

  function openDialog(item: CommunityVerificationItem) {
    setSelected(item);
    setRejectionReason(item.rejection_reason || "");
    setDocError(null);
  }

  function closeDialog() {
    setSelected(null);
    setRejectionReason("");
    setDocError(null);
  }

  const getInitials = (name: string) => {
    if (!name) return "C";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  /** Returns "42 days" or "2 years" depending on age. */
  const formatAge = (createdAt: string) => {
    const days = Math.floor(
      (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (days < 1) return "< 1 day";
    if (days === 1) return "1 day";
    if (days < 30) return `${days} days`;
    if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? "s" : ""}`;
    const years = Math.floor(days / 365);
    return `${years} year${years > 1 ? "s" : ""}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Community Verifications</h1>
          <p className="text-muted-foreground">
            Review community verification submissions
          </p>
        </div>
        <Button variant="outline" onClick={loadVerifications} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {statusFilter === "pending" ? "Pending Submissions" : "Filtered Submissions"}
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {statusFilter === "pending"
                ? "Awaiting admin review"
                : `Status: ${statusFilter} • Tier: ${tierFilter}`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive flex items-center justify-between">
          <span>{error}</span>
          <Button variant="link" className="text-destructive" onClick={loadVerifications}>
            Retry
          </Button>
        </div>
      )}

      {/* Verifications Queue Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle>
                {statusFilter === "pending" ? "Pending Queue" : "Verification Log"}
              </CardTitle>
              <CardDescription>
                Showing {verifications.length} of {total} record{total === 1 ? "" : "s"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Status Filter */}
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v as "all" | "pending" | "approved" | "rejected");
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>

              {/* Tier Filter */}
              <Select
                value={tierFilter}
                onValueChange={(v) => {
                  setTierFilter(v as "all" | "community_verified" | "registered_org");
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="community_verified">Community Verified</SelectItem>
                  <SelectItem value="registered_org">Registered Org</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Community</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      <span className="text-xs text-muted-foreground">Loading queue...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : verifications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    No verifications found for the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                verifications.map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => openDialog(item)}
                  >
                    {/* Community */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={item.community_logo || undefined} />
                          <AvatarFallback>{getInitials(item.community_name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{item.community_name}</div>
                          <div className="text-xs text-muted-foreground">
                            @{item.community_username}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Tier */}
                    <TableCell>
                      <TierBadge tier={item.tier} />
                    </TableCell>

                    {/* Submitted */}
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(item.submitted_at)}
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right pr-6">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDialog(item);
                        }}
                      >
                        {item.status === "pending" ? "Review" : "View"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-6 py-4">
              <div className="text-sm text-muted-foreground">
                Showing {(page - 1) * pageSize + 1} to{" "}
                {Math.min(page * pageSize, total)} of {total} submissions
              </div>
              <div className="flex items-center gap-2">
                <div className="text-sm text-muted-foreground mr-2">
                  Page {page} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Community Verification Review Dialog */}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap pr-6">
              <span>{selected?.community_name}</span>
              {selected && <TierBadge tier={selected.tier} />}
              {selected?.status === "approved" && (
                <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                  Approved
                </Badge>
              )}
              {selected?.status === "rejected" && (
                <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                  Rejected
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Submitted on {selected && formatDate(selected.submitted_at)}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-5 py-2">

              {/* Resolved row info banner */}
              {selected.status !== "pending" && (
                <div className="rounded-lg border bg-muted/40 p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span className="flex items-center gap-1.5">
                      Status:{" "}
                      <span
                        className={
                          selected.status === "approved"
                            ? "text-green-600"
                            : "text-destructive"
                        }
                      >
                        {selected.status.toUpperCase()}
                      </span>
                    </span>
                    {selected.reviewed_at && (
                      <span className="text-xs font-normal text-muted-foreground">
                        Reviewed on {formatDate(selected.reviewed_at)}
                      </span>
                    )}
                  </div>
                  {selected.rejection_reason && (
                    <p className="text-sm text-destructive mt-1">
                      <span className="font-semibold">Rejection reason:</span>{" "}
                      {selected.rejection_reason}
                    </p>
                  )}
                </div>
              )}

              {/* Community context block */}
              <div className="rounded-lg border p-4 space-y-4">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Community Context
                </div>

                {/* Identity row */}
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14">
                    <AvatarImage src={selected.community_logo || undefined} />
                    <AvatarFallback className="text-lg">
                      {getInitials(selected.community_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-0.5 min-w-0">
                    <div className="font-semibold text-base">{selected.community_name}</div>
                    <div className="text-sm text-muted-foreground">
                      @{selected.community_username}
                    </div>
                  </div>
                </div>

                {/* Metadata grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {/* Category */}
                  {selected.community_category && (
                    <div className="flex items-start gap-2">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs text-muted-foreground">Category</div>
                        <div className="font-medium">{selected.community_category}</div>
                      </div>
                    </div>
                  )}

                  {/* Community type */}
                  {selected.community_type && (
                    <div className="flex items-start gap-2">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs text-muted-foreground">Type</div>
                        <div className="font-medium capitalize">{selected.community_type.replace(/_/g, " ")}</div>
                      </div>
                    </div>
                  )}

                  {/* Follower count */}
                  <div className="flex items-start gap-2">
                    <Users className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground">Followers</div>
                      <div className="font-medium">{selected.follower_count.toLocaleString()}</div>
                    </div>
                  </div>

                  {/* Community age */}
                  <div className="flex items-start gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground">Age</div>
                      <div className="font-medium">{formatAge(selected.community_created_at)}</div>
                    </div>
                  </div>

                  {/* College affiliation (only when present) */}
                  {selected.college_name && (
                    <div className="flex items-start gap-2 col-span-2">
                      <GraduationCap className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs text-muted-foreground">College affiliation</div>
                        <div className="font-medium">
                          {selected.college_name}
                          {selected.campus_name && (
                            <span className="text-muted-foreground font-normal">
                              {" "}— {selected.campus_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tier-branched section */}
              {selected.tier === "community_verified" ? (
                // Tier A — no document, legitimacy judgment call
                <div className="rounded-lg border border-violet-200 bg-violet-50/50 dark:border-violet-900/40 dark:bg-violet-950/20 p-4 flex gap-3">
                  <Info className="h-4 w-4 text-violet-600 dark:text-violet-400 mt-0.5 shrink-0" />
                  <div className="space-y-1 text-sm">
                    <div className="font-semibold text-violet-800 dark:text-violet-300">
                      Tier A — No documents required
                    </div>
                    <p className="text-violet-700 dark:text-violet-400 leading-relaxed">
                      Community Verified submissions include no supporting documents by design. This is a
                      legitimacy and impersonation judgment call. Verify the community is authentic, not
                      spoofing a known group, and genuinely meets the spirit of this verification tier.
                    </p>
                  </div>
                </div>
              ) : (
                // Tier B — registration document (signed URL fetched on demand)
                <div className="space-y-2">
                  <div className="text-sm font-semibold flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Registration Document
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Signed URL is generated on demand (valid for 15 minutes). Opens in a new tab.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleViewDocument}
                    disabled={docLoading}
                    className="gap-2"
                  >
                    {docLoading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <ExternalLink className="h-4 w-4" />
                    )}
                    {docLoading ? "Fetching…" : "View Document"}
                  </Button>
                  {docError && (
                    <p className="text-sm text-destructive">{docError}</p>
                  )}
                </div>
              )}

              {/* Rejection reason — shown only for pending rows */}
              {selected.status === "pending" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Rejection Reason{" "}
                    <span className="text-muted-foreground font-normal">
                      (required only if rejecting)
                    </span>
                  </label>
                  <Textarea
                    placeholder="e.g. Community name mimics an existing verified group, insufficient evidence of legitimacy..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {selected?.status === "pending" ? (
              <>
                <Button
                  variant="outline"
                  onClick={closeDialog}
                  disabled={resolving}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleReview("rejected")}
                  disabled={resolving || !rejectionReason.trim()}
                  title={
                    !rejectionReason.trim()
                      ? "Rejection reason is required to reject"
                      : "Reject this verification"
                  }
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button
                  onClick={() => handleReview("approved")}
                  disabled={resolving}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={closeDialog}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
