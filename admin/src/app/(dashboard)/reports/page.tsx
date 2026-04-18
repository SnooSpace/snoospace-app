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
import {
  ShieldAlert,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  User,
  MessageSquare,
  Calendar,
  Image,
} from "lucide-react";
import {
  getReports,
  getReportStats,
  resolveReport,
  type Report,
  type ReportStats,
} from "@/lib/api";

const statusColors: Record<string, string> = {
  pending:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  reviewed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  resolved:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  dismissed: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

const typeIcons: Record<string, React.ReactNode> = {
  post: <Image className="h-4 w-4" />,
  comment: <MessageSquare className="h-4 w-4" />,
  member: <User className="h-4 w-4" />,
  community: <User className="h-4 w-4" />,
  event: <Calendar className="h-4 w-4" />,
};

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  async function fetchData() {
    try {
      setLoading(true);
      const [reportsData, statsData] = await Promise.all([
        getReports({
          status: statusFilter === "all" ? undefined : statusFilter,
        }),
        getReportStats(),
      ]);
      setReports(reportsData.reports);
      setStats(statsData);
    } catch (error) {
      console.error("Failed to fetch reports:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleResolve(status: "resolved" | "dismissed") {
    if (!selectedReport) return;
    try {
      setResolving(true);
      await resolveReport(selectedReport.id, status, resolutionNotes);
      setSelectedReport(null);
      setResolutionNotes("");
      fetchData();
    } catch (error) {
      console.error("Failed to resolve report:", error);
    } finally {
      setResolving(false);
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">Review and manage user reports</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pending ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Resolved
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.resolved ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Dismissed
            </CardTitle>
            <XCircle className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.dismissed ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total
            </CardTitle>
            <ShieldAlert className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Reports Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Reports Queue</CardTitle>
              <CardDescription>
                Click on a report to review and take action
              </CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ShieldAlert className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No reports found</p>
              <p className="text-sm">
                {statusFilter === "pending"
                  ? "No pending reports to review!"
                  : "No reports match this filter."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow
                    key={report.id}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {typeIcons[report.reported_type]}
                        <span className="capitalize">
                          {report.reported_type}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {report.reason}
                    </TableCell>
                    <TableCell>{report.reporter_name || "Unknown"}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[report.status]}>
                        {report.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(report.created_at)}</TableCell>
                    <TableCell className="text-right">
                      {report.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedReport(report)}
                        >
                          Review
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Resolution Dialog */}
      <Dialog
        open={!!selectedReport}
        onOpenChange={() => setSelectedReport(null)}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Review Report
            </DialogTitle>
            <DialogDescription>Take action on this report</DialogDescription>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">Type:</span>
                  <span className="capitalize">
                    {selectedReport.reported_type}
                  </span>
                  <span className="text-muted-foreground">
                    #{selectedReport.reported_id}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">Reason:</span>
                  <span>{selectedReport.reason}</span>
                </div>
                {selectedReport.description && (
                  <div className="text-sm">
                    <span className="font-medium">Details:</span>
                    <p className="mt-1 text-muted-foreground">
                      {selectedReport.description}
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    Reported by {selectedReport.reporter_name || "Unknown"}
                  </span>
                  <span>•</span>
                  <span>{formatDate(selectedReport.created_at)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Resolution Notes (optional)
                </label>
                <Textarea
                  placeholder="Add notes about your decision..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => handleResolve("dismissed")}
              disabled={resolving}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Dismiss
            </Button>
            <Button
              onClick={() => handleResolve("resolved")}
              disabled={resolving}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Resolve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
