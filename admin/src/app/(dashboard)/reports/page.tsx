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
  MapPin,
} from "lucide-react";
import {
  getReports,
  getReportStats,
  resolveReport,
  getReportById,
  getChatReports,
  getChatReportById,
  resolveChatReport,
  type Report,
  type ChatReport,
  type ChatMessage,
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
  open_plan: <MapPin className="h-4 w-4" />,
  conversation: <MessageSquare className="h-4 w-4" />,
};

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [reports, setReports] = useState<Report[]>([]);
  const [chatReports, setChatReports] = useState<ChatReport[]>([]);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedChatReport, setSelectedChatReport] = useState<ChatReport | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");

  useEffect(() => {
    fetchData();
  }, [statusFilter, typeFilter, activeTab]);

  async function fetchData() {
    try {
      setLoading(true);
      if (activeTab === "general") {
        const [reportsData, statsData] = await Promise.all([
          getReports({
            status: statusFilter === "all" ? undefined : statusFilter,
            type: typeFilter === "all" ? undefined : typeFilter,
          }),
          getReportStats(),
        ]);
        setReports(reportsData.reports);
        setStats(statsData);
      } else {
        const chatData = await getChatReports({
          status: statusFilter === "all" ? undefined : statusFilter,
        });
        setChatReports(chatData.reports);
      }
    } catch (error) {
      console.error("Failed to fetch reports:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleResolve(status: "resolved" | "dismissed") {
    try {
      setResolving(true);
      if (activeTab === "general" && selectedReport) {
        await resolveReport(selectedReport.id, status, resolutionNotes);
        setSelectedReport(null);
      } else if (activeTab === "chat" && selectedChatReport) {
        await resolveChatReport(selectedChatReport.id, status, resolutionNotes);
        setSelectedChatReport(null);
      }
      setResolutionNotes("");
      fetchData();
    } catch (error) {
      console.error("Failed to resolve report:", error);
    } finally {
      setResolving(false);
    }
  }

  const renderReportedContent = (report: Report) => {
    const content = report.reported_content;
    if (!content) {
      return (
        <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground text-center border border-dashed">
          Content details not available (may have been deleted)
        </div>
      );
    }

    switch (report.reported_type) {
      case "post": {
        const typeData = content.type_data ? (typeof content.type_data === "string" ? JSON.parse(content.type_data) : content.type_data) : {};
        let subText = "";
        if (content.post_type === "prompt") subText = typeData.prompt_text || "";
        else if (content.post_type === "poll") subText = typeData.question || "";
        else if (content.post_type === "qna") subText = typeData.prompt_text || "";
        else if (content.post_type === "challenge") subText = typeData.description || "";
        else if (content.post_type === "opportunity") subText = typeData.description || "";

        return (
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{content.author_name || "Anonymous"}</span>
                <Badge variant="secondary" className="capitalize text-xs">
                  {content.post_type || "Post"}
                </Badge>
              </div>
              {content.created_at && (
                <span className="text-xs text-muted-foreground">
                  {formatDate(content.created_at)}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {content.caption && (
                <p className="text-sm font-medium leading-relaxed">{content.caption}</p>
              )}
              {subText && (
                <div className="rounded bg-muted/60 p-2.5 text-xs text-muted-foreground italic border-l-2 border-primary/70">
                  {subText}
                </div>
              )}
              {content.image_urls && (
                <div className="flex gap-2 flex-wrap">
                  {(() => {
                    try {
                      const urls = typeof content.image_urls === "string" ? JSON.parse(content.image_urls) : content.image_urls;
                      if (Array.isArray(urls)) {
                        return urls.map((url: string, idx: number) => (
                          <img key={idx} src={url} alt="Post content" className="w-16 h-16 object-cover rounded border" />
                        ));
                      }
                    } catch (e) {}
                    return null;
                  })()}
                </div>
              )}
            </div>
          </div>
        );
      }

      case "comment":
        return (
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between border-b pb-1">
              <span className="font-semibold text-sm">{content.author_name || "Anonymous"}</span>
              <span className="text-xs text-muted-foreground">Comment</span>
            </div>
            <p className="text-sm italic">"{content.comment_text}"</p>
          </div>
        );

      case "member":
        return (
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-3">
              {content.profile_photo_url && (
                <img src={content.profile_photo_url} alt={content.name} className="w-12 h-12 rounded-full object-cover border" />
              )}
              <div>
                <h4 className="font-semibold text-sm">{content.name}</h4>
                <p className="text-xs text-muted-foreground">@{content.username}</p>
              </div>
            </div>
            {content.bio && <p className="text-sm text-muted-foreground">{content.bio}</p>}
            {content.current_college && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">College:</span> {content.current_college}
              </p>
            )}
          </div>
        );

      case "community":
        return (
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-3">
              {content.logo_url && (
                <img src={content.logo_url} alt={content.name} className="w-12 h-12 rounded-lg object-cover border" />
              )}
              <div>
                <h4 className="font-semibold text-sm">{content.name}</h4>
                <p className="text-xs text-muted-foreground">@{content.username}</p>
              </div>
            </div>
            {content.tagline && <p className="text-sm font-medium">{content.tagline}</p>}
            {content.description && <p className="text-sm text-muted-foreground">{content.description}</p>}
          </div>
        );

      case "event":
        return (
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex justify-between items-start border-b pb-2">
              <div>
                <h4 className="font-semibold text-sm text-primary">{content.title}</h4>
                <p className="text-xs text-muted-foreground">by {content.author_name || "Community"}</p>
              </div>
              {content.event_date && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                  {new Date(content.event_date).toLocaleDateString()}
                </span>
              )}
            </div>
            {content.description && <p className="text-sm text-muted-foreground">{content.description}</p>}
            {content.location_url && (
              <a href={content.location_url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline block truncate">
                Map Location Link
              </a>
            )}
          </div>
        );

      case "open_plan":
        return (
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex justify-between items-start border-b pb-2">
              <div>
                <h4 className="font-semibold text-sm text-primary">{content.title}</h4>
                <p className="text-xs text-muted-foreground">Host: {content.author_name || "User"}</p>
              </div>
              <Badge variant="outline" className="capitalize text-xs">
                {content.activity_type || "Plan"}
              </Badge>
            </div>
            {content.description && <p className="text-sm text-muted-foreground">{content.description}</p>}
            {content.scheduled_at && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">Scheduled:</span> {new Date(content.scheduled_at).toLocaleString()}
              </p>
            )}
            {content.location_public && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">Location:</span> {content.location_public}
              </p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="general">General Reports</TabsTrigger>
          <TabsTrigger value="chat">Chat Moderation</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6 m-0">
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
                <div className="flex items-center gap-2">
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="post">Post</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                      <SelectItem value="open_plan">Open Plan</SelectItem>
                      <SelectItem value="member">Person</SelectItem>
                      <SelectItem value="comment">Comment</SelectItem>
                      <SelectItem value="community">Community</SelectItem>
                    </SelectContent>
                  </Select>
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
                            {typeIcons[report.reported_type] ?? <FileText className="h-4 w-4" />}
                            <span className="capitalize">
                              {report.reported_type === "open_plan" ? "Open Plan" : report.reported_type}
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
                              onClick={async () => {
                                setSelectedReport(report);
                                try {
                                  const data = await getReportById(Number(report.id));
                                  if (data?.success && data?.report) {
                                    setSelectedReport(data.report);
                                  }
                                } catch (e) {
                                  console.error("Failed to load report details:", e);
                                }
                              }}
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
        </TabsContent>

        <TabsContent value="chat" className="m-0">
          {/* Chat Reports Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Chat Moderation Queue</CardTitle>
                  <CardDescription>
                    Review reported direct messages and group chats
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
              ) : chatReports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <ShieldAlert className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium">No chat reports found</p>
                  <p className="text-sm">
                    {statusFilter === "pending"
                      ? "No pending chat reports to review!"
                      : "No chat reports match this filter."}
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
                    {chatReports.map((report) => (
                      <TableRow
                        key={report.id}
                        className="cursor-pointer hover:bg-muted/50"
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {typeIcons.conversation}
                            <span className="capitalize">Chat</span>
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
                              onClick={async () => {
                                setSelectedChatReport(report);
                                setChatMessages([]);
                                setLoadingMessages(true);
                                try {
                                  const data = await getChatReportById(report.id);
                                  setChatMessages(data.messages ?? []);
                                } catch (e) {
                                  console.error("Failed to load messages:", e);
                                } finally {
                                  setLoadingMessages(false);
                                }
                              }}
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
        </TabsContent>
      </Tabs>

      {/* Resolution Dialog - General */}
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

              {/* Reported Content Box */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reported Content</label>
                {renderReportedContent(selectedReport)}
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

      {/* Resolution Dialog - Chat */}
      <Dialog
        open={!!selectedChatReport}
        onOpenChange={() => setSelectedChatReport(null)}
      >
        <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Review Chat Report
            </DialogTitle>
            <DialogDescription>Take action on this chat moderation report</DialogDescription>
          </DialogHeader>

          {selectedChatReport && (
            <div className="space-y-4">
              {/* Report metadata */}
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">Chat ID:</span>
                  <span className="text-muted-foreground">
                    #{selectedChatReport.conversation_id}
                  </span>
                  {selectedChatReport.is_group && selectedChatReport.group_name && (
                    <span className="text-muted-foreground">({selectedChatReport.group_name})</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">Reason:</span>
                  <span className="capitalize">{selectedChatReport.reason.replace(/_/g, " ")}</span>
                </div>
                {selectedChatReport.details && (
                  <div className="text-sm">
                    <span className="font-medium">Details:</span>
                    <p className="mt-1 text-muted-foreground">
                      {selectedChatReport.details}
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    Reported by {selectedChatReport.reporter_name || "Unknown"}
                  </span>
                  <span>•</span>
                  <span>{formatDate(selectedChatReport.created_at)}</span>
                </div>
              </div>

              {/* Chat history */}
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Chat History
                </p>
                <div className="rounded-lg border bg-muted/30 p-3 h-64 overflow-y-auto space-y-2">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    </div>
                  ) : chatMessages.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No messages found.</p>
                  ) : (
                    chatMessages.map((msg) => (
                      <div key={msg.id} className="flex flex-col gap-0.5">
                        {/* Sender + timestamp row */}
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-xs font-semibold">
                            {msg.sender_name
                              ? `${msg.sender_name}${msg.sender_username ? ` (@${msg.sender_username})` : ""}`
                              : msg.sender_username || `User #${msg.sender_id}`}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDate(msg.created_at)}
                          </span>
                          {msg.message_type === "system" && (
                            <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">system</span>
                          )}
                          {msg.message_type === "post_share" && !msg.is_deleted && (
                            <span className="text-[10px] bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded-full">shared post</span>
                          )}
                          {msg.is_deleted && (
                            <span className="text-[10px] bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded-full font-medium">
                              ● Deleted
                            </span>
                          )}
                        </div>

                        {/* Reply-to quote (if this message is a reply) */}
                        {msg.replyPreview && !msg.is_deleted && (
                          <div className="ml-2 pl-2 border-l-2 border-muted-foreground/30 text-[11px] text-muted-foreground mb-0.5">
                            <span className="font-medium">
                              ↩ {msg.replyPreview.senderName || "Unknown"}:{" "}
                            </span>
                            {msg.replyPreview.isDeleted ? (
                              <span className="italic">This message was unsent</span>
                            ) : msg.replyPreview.isPostShare ? (
                              <span>
                                🖼️ Shared a post
                                {msg.replyPreview.postAuthorUsername && (
                                  <> · <span className="font-medium">@{msg.replyPreview.postAuthorUsername}</span></>
                                )}
                                {msg.replyPreview.postCaption && (
                                  <> · {msg.replyPreview.postCaption.slice(0, 60)}{msg.replyPreview.postCaption.length > 60 ? "…" : ""}</>
                                )}
                              </span>
                            ) : (
                              <span className="italic">
                                {(msg.replyPreview.messageText || "").slice(0, 80)}
                                {(msg.replyPreview.messageText || "").length > 80 ? "…" : ""}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Message body */}
                        {msg.message_type === "system" ? (
                          <p className="text-muted-foreground text-center text-xs italic">
                            {msg.message_text}
                          </p>
                        ) : msg.message_type === "post_share" && !msg.is_deleted && msg.metadata ? (
                          <div className="rounded-md border bg-background p-2 text-xs max-w-[280px]">
                            <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium mb-1">
                              🖼️ Shared a post
                            </div>
                            {(msg.metadata.authorName || msg.metadata.authorUsername) && (
                              <div className="text-muted-foreground">
                                {msg.metadata.authorName && (
                                  <span className="font-medium text-foreground">{msg.metadata.authorName} </span>
                                )}
                                {msg.metadata.authorUsername && (
                                  <span>@{msg.metadata.authorUsername}</span>
                                )}
                              </div>
                            )}
                            {msg.metadata.caption && (
                              <p className="text-muted-foreground mt-0.5 line-clamp-2">
                                {msg.metadata.caption}
                              </p>
                            )}
                            {!msg.metadata.authorName && !msg.metadata.authorUsername && !msg.metadata.caption && (
                              <p className="text-muted-foreground italic">No post details available</p>
                            )}
                          </div>
                        ) : (
                          <p className={`text-sm ${msg.is_deleted ? "line-through text-muted-foreground" : ""}`}>
                            {msg.is_deleted ? "This message was unsent" : (msg.message_text || "")}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Resolution notes */}
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
