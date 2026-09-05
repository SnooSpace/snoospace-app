"use client";

import { useEffect, useState } from "react";
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
  ShieldCheck,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  User as UserIcon,
} from "lucide-react";
import {
  getAdminVerifications,
  reviewVerification,
  type VerificationItem,
} from "@/lib/api";
import {
  getVerificationVideoUrl,
  getCloudinaryImageUrl,
} from "@/lib/cloudinary";

export default function VerificationsPage() {
  const [verifications, setVerifications] = useState<VerificationItem[]>([]);
  const [thresholds, setThresholds] = useState<{ match: number; noMatch: number }>({
    match: 0.55,
    noMatch: 0.85,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState<"all" | "plans" | "discover">("all");

  // Review modal state
  const [selectedVerification, setSelectedVerification] = useState<VerificationItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    loadVerifications();
  }, []);

  async function loadVerifications() {
    try {
      setLoading(true);
      setError(null);
      const data = await getAdminVerifications();
      setVerifications(data.verifications || []);
      if (data.thresholds) {
        setThresholds(data.thresholds);
      }
    } catch (err) {
      console.error("Failed to load verifications:", err);
      setError(err instanceof Error ? err.message : "Failed to load verifications");
    } finally {
      setLoading(false);
    }
  }

  async function handleReview(status: "approved" | "rejected") {
    if (!selectedVerification) return;
    if (status === "rejected" && !rejectionReason.trim()) {
      return;
    }

    try {
      setResolving(true);
      await reviewVerification(
        selectedVerification.id,
        status,
        status === "rejected" ? rejectionReason.trim() : undefined
      );

      // Close modal and reset state
      setSelectedVerification(null);
      setRejectionReason("");

      // Refetch queue
      await loadVerifications();
    } catch (err) {
      console.error("Failed to review verification:", err);
      alert(err instanceof Error ? err.message : "Failed to review verification");
    } finally {
      setResolving(false);
    }
  }

  const filteredVerifications = verifications.filter((v) => {
    if (scopeFilter === "all") return true;
    return v.scope === scopeFilter;
  });

  const getInitials = (name: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateStr: string) => {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Verifications</h1>
          <p className="text-muted-foreground">
            Review pending identity verification submissions
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
              Pending Submissions
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{verifications.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Awaiting admin review
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
              <CardTitle>Pending Queue</CardTitle>
              <CardDescription>
                Showing {filteredVerifications.length} of {verifications.length} submissions
              </CardDescription>
            </div>
            <Select
              value={scopeFilter}
              onValueChange={(v) => setScopeFilter(v as "all" | "plans" | "discover")}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Scopes</SelectItem>
                <SelectItem value="plans">Plans Only</SelectItem>
                <SelectItem value="discover">Discover Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Submitted Date</TableHead>
                <TableHead>Match Score</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
              ) : filteredVerifications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    No pending verifications
                  </TableCell>
                </TableRow>
              ) : (
                filteredVerifications.map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      setSelectedVerification(item);
                      setRejectionReason("");
                    }}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={item.member_photo || undefined} />
                          <AvatarFallback>{getInitials(item.member_name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{item.member_name}</div>
                          <div className="text-xs text-muted-foreground">{item.member_email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.scope === "plans" ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-medium"
                        >
                          Plans
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-medium"
                        >
                          Discover
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(item.submitted_at)}
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {item.match_score !== null && item.match_score !== undefined
                        ? Number(item.match_score).toFixed(3)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVerification(item);
                          setRejectionReason("");
                        }}
                      >
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Verification Review Dialog */}
      <Dialog
        open={!!selectedVerification}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedVerification(null);
            setRejectionReason("");
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle className="flex items-center gap-2">
                <span>Verification #{selectedVerification?.id}</span>
                {selectedVerification?.scope === "plans" ? (
                  <Badge
                    variant="outline"
                    className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  >
                    Plans Tier
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                  >
                    Discover Tier
                  </Badge>
                )}
              </DialogTitle>
            </div>
            <DialogDescription>
              Submitted by {selectedVerification?.member_name} ({selectedVerification?.member_email}) on{" "}
              {selectedVerification && formatDate(selectedVerification.submitted_at)}
            </DialogDescription>
          </DialogHeader>

          {selectedVerification && (
            <div className="space-y-6 py-2">
              {/* Media Comparison: Video & Reference Image(s) side by side or stacked */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* 1. Liveness Video */}
                <div className="space-y-2">
                  <div className="text-sm font-semibold flex items-center justify-between">
                    <span>Liveness Video</span>
                    <span className="text-xs font-normal text-muted-foreground">8-sec selfie</span>
                  </div>
                  <div className="rounded-lg overflow-hidden border bg-black aspect-[3/4] max-h-[360px] flex items-center justify-center">
                    <video
                      src={getVerificationVideoUrl(selectedVerification.video_storage_path)}
                      controls
                      preload="metadata"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>

                {/* 2. Reference Media (Branching on Scope) */}
                <div className="space-y-2">
                  {selectedVerification.scope === "plans" ? (
                    <div>
                      <div className="text-sm font-semibold">Reference Photo</div>
                      <p className="text-xs text-muted-foreground mb-2">
                        Private, submitted for this verification
                      </p>
                      {selectedVerification.manual_reference_photo_url ? (
                        <div className="rounded-lg overflow-hidden border aspect-[3/4] max-h-[360px] bg-muted flex items-center justify-center">
                          <img
                            src={getCloudinaryImageUrl(selectedVerification.manual_reference_photo_url)}
                            alt="Reference photo"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground bg-muted/40">
                          No reference photo provided
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm font-semibold">Discover Photos</div>
                      <p className="text-xs text-muted-foreground mb-2">
                        Closest automated match highlighted
                      </p>
                      {selectedVerification.discover_photos &&
                      selectedVerification.discover_photos.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2 max-h-[360px] overflow-y-auto p-1">
                          {selectedVerification.discover_photos.map((photoUrl, idx) => {
                            const isClosestMatch =
                              selectedVerification.matched_photo_url &&
                              photoUrl === selectedVerification.matched_photo_url;
                            return (
                              <div
                                key={idx}
                                className={`relative rounded-lg overflow-hidden border aspect-square bg-muted ${
                                  isClosestMatch
                                    ? "ring-3 ring-blue-600 border-blue-600 shadow-md"
                                    : "border-border"
                                }`}
                              >
                                <img
                                  src={getCloudinaryImageUrl(photoUrl)}
                                  alt={`Discover photo ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                                {isClosestMatch && (
                                  <div className="absolute bottom-1 left-1 right-1 bg-blue-600/90 text-white text-[10px] font-semibold py-0.5 text-center rounded">
                                    Best Match
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground bg-muted/40">
                          No Discover photos found for member
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Liveness Prompt Verification (Action + Code) */}
              {(selectedVerification.liveness_action || selectedVerification.liveness_code) && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20 p-3 text-sm space-y-1.5">
                  <div className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wide">
                    Prompted Liveness Verification
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-foreground">
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Prompted Action:</span>
                      <span className="font-semibold">{selectedVerification.liveness_action || "—"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Code:</span>
                      <span className="font-mono font-bold tracking-widest text-base px-2 py-0.5 rounded bg-background border">
                        {selectedVerification.liveness_code || "—"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Match Diagnostics */}
              <div className="rounded-lg border bg-muted/30 p-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">Automated Match Distance:</span>
                <span className="font-mono font-semibold">
                  {selectedVerification.match_score !== null &&
                  selectedVerification.match_score !== undefined
                    ? `${Number(selectedVerification.match_score).toFixed(3)} (auto-approve ≤ ${thresholds.match}, auto-reject ≥ ${thresholds.noMatch})`
                    : "Not attempted / manual"}
                </span>
              </div>

              {/* Rejection Reason (Required if Rejecting) */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Rejection Reason <span className="text-muted-foreground font-normal">(required only if rejecting)</span>
                </label>
                <Textarea
                  placeholder="e.g. Face not clearly visible in video, sunglasses worn, or identity mismatch..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedVerification(null);
                setRejectionReason("");
              }}
              disabled={resolving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleReview("rejected")}
              disabled={resolving || !rejectionReason.trim()}
              title={!rejectionReason.trim() ? "Rejection reason is required to reject" : "Reject verification"}
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
