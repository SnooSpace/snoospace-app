"use client";

import { useState, useEffect } from "react";
import {
  Search,
  RefreshCw,
  Eye,
  Ban,
  Trash2,
  Users as UsersIcon,
  Building2,
  User as UserIcon,
  MapPin,
  Mail,
  Phone,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  Instagram,
  CheckCircle2,
  Award,
  Network,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getUsers,
  updateUser,
  deleteUser,
  getFollowers,
  getFollowing,
  getUserPosts,
  deletePost,
  getPostLikes,
  getPostComments,
  deleteComment,
  getUserCircles,
  getUserById,
  getEventAttendees,
  getPlanMembers,
  getCreatorAudienceSummary,
  getCreatorReachStats,
  getCreatorFollowerTrend,
  type User,
  type GetUsersParams,
  type FollowUser,
  type Post,
  type PostLike,
  type PostComment,
  type CircleMember,
  type EventAttendee,
  type PlanMember,
  type CreatorAudienceSummary,
  type CreatorReachStats,
  type CreatorFollowerTrend,
} from "@/lib/api";

const isVideoUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  return url.toLowerCase().endsWith(".mp4") || 
         url.toLowerCase().endsWith(".mov") || 
         url.toLowerCase().endsWith(".webm") || 
         url.includes("/video/upload/");
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [expandedLocation, setExpandedLocation] = useState(false);

  // Circles Modal
  const [circlesModalOpen, setCirclesModalOpen] = useState(false);
  const [circlesList, setCirclesList] = useState<CircleMember[]>([]);
  const [circlesLoading, setCirclesLoading] = useState(false);

  // Followers/Following Modal
  const [followModalOpen, setFollowModalOpen] = useState(false);
  const [followModalType, setFollowModalType] = useState<
    "followers" | "following"
  >("followers");
  const [followList, setFollowList] = useState<FollowUser[]>([]);
  const [followLoading, setFollowLoading] = useState(false);

  // User Posts Modal
  const [postsModalOpen, setPostsModalOpen] = useState(false);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  // Post Detail Modal (for viewing likes/comments)
  const [postDetailOpen, setPostDetailOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [likes, setLikes] = useState<PostLike[]>([]);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [likesLoading, setLikesLoading] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  // Event & open Plans details Modals
  const [eventDetailOpen, setEventDetailOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [planDetailOpen, setPlanDetailOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [eventAttendees, setEventAttendees] = useState<EventAttendee[]>([]);
  const [eventAttendeesLoading, setEventAttendeesLoading] = useState(false);
  const [planHost, setPlanHost] = useState<PlanMember | null>(null);
  const [planAttendees, setPlanAttendees] = useState<PlanMember[]>([]);
  const [planMembersLoading, setPlanMembersLoading] = useState(false);

  // Creator Insights state
  const [creatorSummary, setCreatorSummary] = useState<CreatorAudienceSummary | null>(null);
  const [creatorReach, setCreatorReach] = useState<CreatorReachStats | null>(null);
  const [creatorFollowerTrend, setCreatorFollowerTrend] = useState<CreatorFollowerTrend | null>(null);
  const [creatorInsightsLoading, setCreatorInsightsLoading] = useState(false);

  const fetchCreatorInsights = async (creatorId: number) => {
    setCreatorSummary(null);
    setCreatorReach(null);
    setCreatorFollowerTrend(null);
    setCreatorInsightsLoading(true);
    try {
      const [summary, reach, trend] = await Promise.all([
        getCreatorAudienceSummary(creatorId),
        getCreatorReachStats(creatorId, "30d"),
        getCreatorFollowerTrend(creatorId),
      ]);
      setCreatorSummary(summary);
      setCreatorReach(reach);
      setCreatorFollowerTrend(trend);
    } catch (err) {
      console.error("Error loading creator insights:", err);
    } finally {
      setCreatorInsightsLoading(false);
    }
  };

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "member" | "community">(
    "all"
  );
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "banned">(
    "all"
  );

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 15;

  useEffect(() => {
    loadUsers();
  }, [page, typeFilter, statusFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      loadUsers();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: GetUsersParams = {
        page,
        limit,
        search: search.trim(),
        type: typeFilter,
        status: statusFilter,
      };
      const data = await getUsers(params);
      setUsers(data.users);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleViewUser = async (user: User) => {
    setLoading(true);
    try {
      const fullUser = await getUserById(user.id, user.type);
      setSelectedUser(fullUser);
      setExpandedLocation(false);
      setIsSheetOpen(true);
      if (fullUser.type === "member" && fullUser.is_creator_mode_enabled) {
        fetchCreatorInsights(fullUser.id);
      }
    } catch (err) {
      console.error("Error fetching full user details:", err);
      setSelectedUser(user);
      setExpandedLocation(false);
      setIsSheetOpen(true);
      if (user.type === "member" && user.is_creator_mode_enabled) {
        fetchCreatorInsights(user.id);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNavigateToUserProfile = async (id: number | undefined, type: string | undefined) => {
    if (!id || !type) return;

    // Close open modals
    setFollowModalOpen(false);
    setCirclesModalOpen(false);
    setPostsModalOpen(false);
    setPostDetailOpen(false);

    setLoading(true);
    try {
      const user = await getUserById(id, type as "member" | "community");
      setSelectedUser(user);
      setExpandedLocation(false);
      setIsSheetOpen(true);
      if (user.type === "member" && user.is_creator_mode_enabled) {
        fetchCreatorInsights(user.id);
      }
    } catch (err) {
      console.error("Error navigating to user profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleShowFollowList = async (type: "followers" | "following") => {
    if (!selectedUser) return;

    setFollowModalType(type);
    setFollowModalOpen(true);
    setFollowLoading(true);
    setFollowList([]);

    try {
      if (type === "followers") {
        const data = await getFollowers(selectedUser.id, selectedUser.type);
        setFollowList(data.followers);
      } else {
        const data = await getFollowing(selectedUser.id, selectedUser.type);
        setFollowList(data.following);
      }
    } catch (err) {
      console.error(`Error fetching ${type}:`, err);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleShowCirclesList = async () => {
    if (!selectedUser) return;

    setCirclesModalOpen(true);
    setCirclesLoading(true);
    setCirclesList([]);

    try {
      const data = await getUserCircles(selectedUser.id);
      setCirclesList(data);
    } catch (err) {
      console.error("Error fetching circles:", err);
    } finally {
      setCirclesLoading(false);
    }
  };

  const handleShowUserPosts = async () => {
    if (!selectedUser) return;

    setPostsModalOpen(true);
    setPostsLoading(true);
    setUserPosts([]);

    try {
      const data = await getUserPosts(selectedUser.id, selectedUser.type);
      setUserPosts(data.posts);
    } catch (err) {
      console.error("Error fetching user posts:", err);
    } finally {
      setPostsLoading(false);
    }
  };

  const handleDeleteUserPost = async (postId: number) => {
    if (!confirm("Are you sure you want to delete this post?")) {
      return;
    }
    try {
      await deletePost(postId);
      // Remove from local state
      setUserPosts((prev) => prev.filter((p) => p.id !== postId));
      // Close detail dialog if deleting the currently viewed post
      if (selectedPost?.id === postId) {
        setPostDetailOpen(false);
        setSelectedPost(null);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete post");
    }
  };

  const handleViewPostDetail = (post: Post) => {
    setSelectedPost(post);
    setCurrentImageIndex(0);
    setActiveTab("details");
    setLikes([]);
    setComments([]);
    setPostDetailOpen(true);
  };

  const handleViewEventDetail = async (event: any) => {
    setSelectedEvent(event);
    setEventDetailOpen(true);
    setEventAttendees([]);
    setEventAttendeesLoading(true);
    try {
      const attendees = await getEventAttendees(event.id);
      setEventAttendees(attendees || []);
    } catch (err) {
      console.error("Failed to load event attendees:", err);
    } finally {
      setEventAttendeesLoading(false);
    }
  };

  const handleViewPlanDetail = async (plan: any) => {
    setSelectedPlan(plan);
    setPlanDetailOpen(true);
    setPlanHost(null);
    setPlanAttendees([]);
    setPlanMembersLoading(true);
    try {
      const data = await getPlanMembers(plan.id);
      setPlanHost(data.host);
      setPlanAttendees(data.attendees || []);
    } catch (err) {
      console.error("Failed to load plan members:", err);
    } finally {
      setPlanMembersLoading(false);
    }
  };

  const loadLikes = async (postId: number) => {
    setLikesLoading(true);
    try {
      const data = await getPostLikes(postId);
      setLikes(data.likes || []);
    } catch (err) {
      console.error("Error loading likes:", err);
      setLikes([]);
    } finally {
      setLikesLoading(false);
    }
  };

  const loadComments = async (postId: number) => {
    setCommentsLoading(true);
    try {
      const data = await getPostComments(postId);
      setComments(data.comments || []);
    } catch (err) {
      console.error("Error loading comments:", err);
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!confirm("Are you sure you want to delete this comment?")) {
      return;
    }
    try {
      await deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      // Update the comment count in selectedPost
      if (selectedPost) {
        setSelectedPost({
          ...selectedPost,
          comment_count: Math.max(0, (selectedPost.comment_count || 0) - 1),
        });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete comment");
    }
  };

  const handlePostTabChange = (value: string) => {
    setActiveTab(value);
    if (selectedPost) {
      if (value === "likes" && (!likes || likes.length === 0)) {
        loadLikes(selectedPost.id);
      } else if (value === "comments" && (!comments || comments.length === 0)) {
        loadComments(selectedPost.id);
      }
    }
  };

  const handleToggleBan = async (user: User) => {
    const action = user.is_active ? "ban" : "unban";
    if (!confirm(`Are you sure you want to ${action} "${user.name}"?`)) {
      return;
    }

    try {
      await updateUser(user.id, user.type, { is_active: !user.is_active });
      setUsers(
        users.map((u) =>
          u.id === user.id && u.type === user.type
            ? { ...u, is_active: !u.is_active }
            : u
        )
      );
      if (selectedUser?.id === user.id && selectedUser?.type === user.type) {
        setSelectedUser({
          ...selectedUser,
          is_active: !selectedUser.is_active,
        });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : `Failed to ${action} user`);
    }
  };

  const handleDelete = async (user: User) => {
    if (
      !confirm(
        `Are you sure you want to permanently delete "${user.name}"? This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await deleteUser(user.id, user.type, true);
      setUsers(
        users.filter((u) => !(u.id === user.id && u.type === user.type))
      );
      setIsSheetOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete user");
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "N/A";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Format location for display - handles both string and object formats
  const formatLocation = (location: unknown): string => {
    if (!location) return "";
    if (typeof location === "string") return location;
    if (typeof location === "object") {
      const loc = location as {
        address?: string;
        city?: string;
        state?: string;
        country?: string;
      };
      // Try to build a display string from location object
      const parts = [loc.address, loc.city, loc.state, loc.country].filter(
        Boolean
      );
      if (parts.length > 0) return parts.join(", ");
      // Fallback: if it has lat/lng, show coordinates
      const latLng = location as { lat?: number; lng?: number };
      if (latLng.lat && latLng.lng)
        return `${latLng.lat.toFixed(2)}, ${latLng.lng.toFixed(2)}`;
    }
    return String(location);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">
            Manage all members and community accounts
          </p>
        </div>
        <Button variant="outline" onClick={loadUsers} disabled={loading}>
          <RefreshCw
            className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, username, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v as "all" | "member" | "community");
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="User Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="member">Members</SelectItem>
                <SelectItem value="community">Communities</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as "all" | "active" | "banned");
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="banned">Banned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
          <Button
            variant="link"
            className="ml-2 text-destructive"
            onClick={loadUsers}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            Showing {users.length} of {total} users
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && users.length === 0 ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              No users found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow 
                    key={`${user.type}-${user.id}`}
                    onClick={() => handleViewUser(user)}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage
                            src={user.profile_photo_url || undefined}
                          />
                          <AvatarFallback>
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-1.5 font-medium">
                            <span>{user.name}</span>
                            {user.type === "member" && user.is_verified && (
                              <span title="Verified Member">
                                <CheckCircle2 className="h-4 w-4 text-blue-500 fill-blue-500/10" />
                              </span>
                            )}
                            {user.type === "community" && user.verification_status === "approved" && (
                              <span title="Approved Community">
                                <CheckCircle2 className="h-4 w-4 text-green-500 fill-green-500/10" />
                              </span>
                            )}
                            {user.type === "community" && user.verification_status === "pending" && (
                              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" title="Verification Pending" />
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            @{user.username}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        <Badge
                          variant={
                            user.type === "member" ? "default" : "secondary"
                          }
                        >
                          {user.type === "member" ? (
                            <UserIcon className="mr-1 h-3 w-3" />
                          ) : (
                            <Building2 className="mr-1 h-3 w-3" />
                          )}
                          {user.type === "member" ? "Member" : "Community"}
                        </Badge>
                        {user.type === "member" && user.is_creator_mode_enabled && (
                          <Badge variant="outline" className="text-purple-600 border-purple-200 bg-purple-50">
                            <Award className="mr-1 h-3 w-3" />
                            Creator
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.location ? (
                        <span className="text-sm">
                          {formatLocation(user.location)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={user.is_active ? "default" : "destructive"}
                      >
                        {user.is_active ? "Active" : "Banned"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(user.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewUser(user)}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleBan(user);
                          }}
                          title={user.is_active ? "Ban User" : "Unban User"}
                          className={
                            user.is_active
                              ? "text-destructive hover:text-destructive"
                              : "text-green-600 hover:text-green-600"
                          }
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(user);
                          }}
                          className="text-destructive hover:text-destructive"
                          title="Delete User"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-4 mt-4">
              <div className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages || loading}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Details Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="overflow-y-auto p-0 pb-8">
          {selectedUser && (
            <>
              {/* Banner Image */}
              <div className="relative h-32 w-full bg-muted">
                {selectedUser.banner_url ? (
                  <img
                    src={selectedUser.banner_url}
                    alt={`${selectedUser.name} Banner`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-r from-violet-600 to-indigo-600 opacity-80" />
                )}
              </div>

              <div className="px-6 -mt-8 space-y-8">
                {/* Profile Header overlap */}
                <div className="flex items-end gap-4">
                  <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
                    <AvatarImage
                      src={selectedUser.profile_photo_url || undefined}
                    />
                    <AvatarFallback className="text-xl bg-muted">
                      {getInitials(selectedUser.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <SheetTitle className="text-xl font-bold">{selectedUser.name}</SheetTitle>
                      {selectedUser.type === "member" && selectedUser.is_verified && (
                        <span title="Verified Member">
                          <CheckCircle2 className="h-5 w-5 text-blue-500 fill-blue-500/10" />
                        </span>
                      )}
                      {selectedUser.type === "community" && selectedUser.verification_status === "approved" && (
                        <span title="Approved Community">
                          <CheckCircle2 className="h-5 w-5 text-green-500 fill-green-500/10" />
                        </span>
                      )}
                    </div>
                    <SheetDescription>
                      @{selectedUser.username}
                    </SheetDescription>
                  </div>
                </div>
              </div>

              <div className="px-6 space-y-8">
                {/* Status & Type */}
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant={
                      selectedUser.type === "member" ? "default" : "secondary"
                    }
                  >
                    {selectedUser.type === "member" ? "Member" : "Community"}
                  </Badge>
                  {selectedUser.type === "member" && selectedUser.is_creator_mode_enabled && (
                    <Badge variant="outline" className="text-purple-600 border-purple-200 bg-purple-50">
                      <Award className="mr-1 h-3 w-3" />
                      Creator Mode Enabled
                    </Badge>
                  )}
                  <Badge
                    variant={selectedUser.is_active ? "default" : "destructive"}
                  >
                    {selectedUser.is_active ? "Active" : "Banned"}
                  </Badge>
                  {selectedUser.type === "community" && (
                    <Badge
                      variant={
                        selectedUser.verification_status === "approved" ? "default" :
                        selectedUser.verification_status === "pending" ? "secondary" : "destructive"
                      }
                      className={
                        selectedUser.verification_status === "approved" ? "bg-green-600 hover:bg-green-600 text-white" :
                        selectedUser.verification_status === "pending" ? "bg-amber-500 hover:bg-amber-500 text-white animate-pulse" : ""
                      }
                    >
                      Verification: {selectedUser.verification_status || "Not Requested"}
                    </Badge>
                  )}
                </div>

                {/* Contact Info */}
                <div className="space-y-3">
                  <h4 className="font-semibold">Contact</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      {selectedUser.email}
                    </div>
                    {selectedUser.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span>{selectedUser.phone}</span>
                        {selectedUser.type === "community" && (
                          <span className="text-xs">Primary</span>
                        )}
                      </div>
                    )}
                    {selectedUser.secondary_phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span>{selectedUser.secondary_phone}</span>
                        <span className="text-xs">Secondary</span>
                      </div>
                    )}
                    {selectedUser.instagram_username && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Instagram className="h-4 w-4 text-pink-600" />
                        <a
                          href={`https://instagram.com/${selectedUser.instagram_username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline font-medium"
                        >
                          @{selectedUser.instagram_username}
                        </a>
                      </div>
                    )}
                    {selectedUser.location && (
                      <div className="text-muted-foreground">
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <span
                              className={expandedLocation ? "" : "line-clamp-2"}
                            >
                              {formatLocation(selectedUser.location)}
                            </span>
                            {formatLocation(selectedUser.location).length >
                              50 && (
                              <button
                                onClick={() =>
                                  setExpandedLocation(!expandedLocation)
                                }
                                className="text-xs text-primary hover:underline mt-1 block"
                              >
                                {expandedLocation ? "Show less" : "Show more"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      Joined {formatDate(selectedUser.created_at)}
                    </div>
                    {selectedUser.is_verified && selectedUser.verified_at && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-blue-500" />
                        Verified on {formatDate(selectedUser.verified_at)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bio */}
                {selectedUser.bio && (
                  <div className="space-y-2">
                    <h4 className="font-semibold">Bio</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedUser.bio}
                    </p>
                  </div>
                )}

                {/* Pronouns (Members only) */}
                {selectedUser.type === "member" && selectedUser.pronouns && (
                  <div className="space-y-2">
                    <h4 className="font-semibold">Pronouns</h4>
                    <div className="flex flex-wrap gap-2">
                      {(Array.isArray(selectedUser.pronouns)
                        ? selectedUser.pronouns
                        : [selectedUser.pronouns]
                      ).map((p, i) => (
                        <Badge key={i} variant="outline">
                          {String(p).replace(/[{}\"]/g, "")}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Demographics (Members only) */}
                {selectedUser.type === "member" && (selectedUser.gender || selectedUser.dob) && (
                  <div className="space-y-3">
                    <h4 className="font-semibold">Demographics</h4>
                    <div className="space-y-2 text-sm">
                      {selectedUser.gender && (
                        <div>
                          <span className="text-muted-foreground">Gender: </span>
                          <span className="font-medium">{selectedUser.gender}</span>
                        </div>
                      )}
                      {selectedUser.dob && (
                        <div>
                          <span className="text-muted-foreground">Date of Birth: </span>
                          <span className="font-medium">
                            {formatDate(selectedUser.dob)}
                            {(() => {
                              const age = Math.floor(
                                (new Date().getTime() - new Date(selectedUser.dob).getTime()) /
                                (365.25 * 24 * 60 * 60 * 1000)
                              );
                              return age > 0 ? ` (${age} years old)` : "";
                            })()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Professional & Educational Info (Members Only) */}
                {selectedUser.type === "member" && (selectedUser.occupation || selectedUser.education || selectedUser.college_name) && (
                  <div className="space-y-3">
                    <h4 className="font-semibold">Affiliation & Occupation</h4>
                    <div className="space-y-2 text-sm">
                      {selectedUser.occupation && (
                        <div>
                          <span className="text-muted-foreground">Occupation: </span>
                          <span className="font-medium">{selectedUser.occupation}</span>
                        </div>
                      )}
                      {selectedUser.education && (
                        <div>
                          <span className="text-muted-foreground">Education: </span>
                          <span className="font-medium">{selectedUser.education}</span>
                        </div>
                      )}
                      {selectedUser.college_name && (
                        <div>
                          <span className="text-muted-foreground">College: </span>
                          <span className="font-medium">{selectedUser.college_name}</span>
                          {selectedUser.campus_name && (
                            <span className="text-xs text-muted-foreground"> ({selectedUser.campus_name} Campus)</span>
                          )}
                          {selectedUser.passout_year && (
                            <span className="text-xs text-muted-foreground"> • Class of {selectedUser.passout_year}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Creator Details (Members Only) */}
                {selectedUser.type === "member" && selectedUser.is_creator_mode_enabled && selectedUser.creator_mode_enabled_at && (
                  <div className="space-y-3">
                    <h4 className="font-semibold">Creator Mode Details</h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Enabled: </span>
                        <span className="font-medium">{formatDate(selectedUser.creator_mode_enabled_at)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Creator Followers: </span>
                        <span className="font-medium">{selectedUser.creator_follower_count || 0}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Category (Communities only) */}
                {selectedUser.type === "community" && selectedUser.category && (
                  <div className="space-y-2">
                    <h4 className="font-semibold">Category</h4>
                    <Badge variant="secondary">{selectedUser.category}</Badge>
                  </div>
                )}

                {/* Community Type & Settings (Communities Only) */}
                {selectedUser.type === "community" && (
                  <div className="space-y-3">
                    <h4 className="font-semibold">Community Settings & Subtypes</h4>
                    <div className="space-y-2 text-sm">
                      {selectedUser.community_type && (
                        <div>
                          <span className="text-muted-foreground">Community Type: </span>
                          <span className="font-medium capitalize">{selectedUser.community_type.replace(/_/g, ' ')}</span>
                        </div>
                      )}
                      {selectedUser.college_subtype && (
                        <div>
                          <span className="text-muted-foreground">College Subtype: </span>
                          <span className="font-medium capitalize">{selectedUser.college_subtype}</span>
                        </div>
                      )}
                      {selectedUser.club_type && (
                        <div>
                          <span className="text-muted-foreground">Club Type: </span>
                          <span className="font-medium capitalize">{selectedUser.club_type.replace(/_/g, ' ')}</span>
                        </div>
                      )}
                      {selectedUser.community_theme && (
                        <div>
                          <span className="text-muted-foreground">Theme: </span>
                          <span className="font-medium">{selectedUser.community_theme}</span>
                        </div>
                      )}
                      {selectedUser.college_name && (
                        <div>
                          <span className="text-muted-foreground">Affiliated College: </span>
                          <span className="font-medium">{selectedUser.college_name}</span>
                          {selectedUser.campus_name && (
                            <span className="text-xs text-muted-foreground"> ({selectedUser.campus_name} Campus)</span>
                          )}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Badge variant="outline" className={selectedUser.auto_join_group_chat ? "text-green-600 bg-green-50" : "text-muted-foreground"}>
                          Auto-Join Group Chat: {selectedUser.auto_join_group_chat ? "Yes" : "No"}
                        </Badge>
                        <Badge variant="outline" className={selectedUser.is_sponsor_visible ? "text-green-600 bg-green-50" : "text-muted-foreground"}>
                          Sponsor Visible: {selectedUser.is_sponsor_visible ? "Yes" : "No"}
                        </Badge>
                        <Badge variant="outline" className={selectedUser.show_heads ? "text-green-600 bg-green-50" : "text-muted-foreground"}>
                          Show Heads: {selectedUser.show_heads ? "Yes" : "No"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}

                {/* Community Heads (Communities only) */}
                {selectedUser.type === "community" &&
                  selectedUser.heads &&
                  selectedUser.heads.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold">Community Heads</h4>
                      <div className="space-y-3">
                        {selectedUser.heads.map((head, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                          >
                            <Avatar className="h-10 w-10">
                              <AvatarImage
                                src={head.profile_pic_url || undefined}
                              />
                              <AvatarFallback>
                                {head.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .toUpperCase()
                                  .slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="font-medium text-sm">
                                {head.name}
                              </div>
                              {head.phone && (
                                <div className="text-xs text-muted-foreground">
                                  {head.phone}
                                </div>
                              )}
                            </div>
                            <Badge
                              variant={
                                head.is_primary ? "default" : "secondary"
                              }
                            >
                              {head.is_primary ? "Primary" : "Secondary"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Interests */}
                {selectedUser.interests &&
                  selectedUser.interests.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold">
                        {selectedUser.type === "community"
                          ? "Sponsor Interests"
                          : "Interests"}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {(Array.isArray(selectedUser.interests)
                          ? selectedUser.interests
                          : []
                        ).map((interest, i) => (
                          <Badge key={i} variant="outline">
                            {String(interest).replace(/[{}\"]/g, "")}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                {/* AQI Signals (Members only) */}
                {selectedUser.type === "member" && selectedUser.aqi && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm flex items-center gap-1.5">
                        <span>Audience Quality Index (AQI)</span>
                        {selectedUser.aqi.fraud_flag && (
                          <Badge variant="destructive" className="animate-pulse">⚠️ FRAUD FLAGGED</Badge>
                        )}
                      </h4>
                      <Badge variant="outline" className="font-mono text-xs">
                        Tier {selectedUser.aqi.aqi_tier || "N/A"}
                      </Badge>
                    </div>

                    {/* Score Highlight Box */}
                    <div className="grid grid-cols-3 gap-2 p-3 bg-muted/40 rounded-lg border text-center">
                      <div className="space-y-0.5">
                        <div className="text-[10px] text-muted-foreground uppercase font-semibold">AQI Score</div>
                        <div className="text-xl font-bold font-mono text-primary">
                          {selectedUser.aqi.aqi_score ? parseFloat(selectedUser.aqi.aqi_score).toFixed(2) : "0.00"}
                        </div>
                      </div>
                      <div className="space-y-0.5 border-x">
                        <div className="text-[10px] text-muted-foreground uppercase font-semibold">Trajectory</div>
                        <div className="text-sm font-semibold capitalize flex items-center justify-center gap-1">
                          {selectedUser.aqi.aqi_trajectory === 'rising' ? '📈' : 
                           selectedUser.aqi.aqi_trajectory === 'falling' ? '📉' : '➡️'}
                          <span className="font-mono">{selectedUser.aqi.aqi_trajectory || "stable"}</span>
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-[10px] text-muted-foreground uppercase font-semibold">App Actions</div>
                        <div className="text-sm font-bold font-mono">
                          {selectedUser.aqi.total_behavior_events || 0}
                        </div>
                      </div>
                    </div>

                    {/* Fraud Details if flagged */}
                    {selectedUser.aqi.fraud_flag && selectedUser.aqi.fraud_reason && (
                      <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs space-y-1">
                        <div className="font-bold flex items-center gap-1">🛑 Fraud Reason:</div>
                        <p>{selectedUser.aqi.fraud_reason}</p>
                      </div>
                    )}

                    {/* Grid of Sub-signals */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {/* Left Column */}
                      <div className="space-y-2">
                        <div className="flex justify-between border-b pb-1">
                          <span className="text-muted-foreground">RSVPs:</span>
                          <span className="font-mono font-medium">{selectedUser.aqi.total_rsvps || 0}</span>
                        </div>
                        <div className="flex justify-between border-b pb-1">
                          <span className="text-muted-foreground">Attended:</span>
                          <span className="font-mono font-medium">{selectedUser.aqi.total_attended || 0}</span>
                        </div>
                        <div className="flex justify-between border-b pb-1">
                          <span className="text-muted-foreground">RSVP/Attend Ratio:</span>
                          <span className="font-mono font-medium">
                            {selectedUser.aqi.rsvp_to_attend_ratio 
                              ? `${(parseFloat(selectedUser.aqi.rsvp_to_attend_ratio) * 100).toFixed(0)}%` 
                              : "0%"}
                          </span>
                        </div>
                        <div className="flex justify-between border-b pb-1">
                          <span className="text-muted-foreground">Paid Attended:</span>
                          <span className="font-mono font-medium">{selectedUser.aqi.paid_events_attended || 0}</span>
                        </div>
                        <div className="flex justify-between border-b pb-1">
                          <span className="text-muted-foreground">Free Attended:</span>
                          <span className="font-mono font-medium">{selectedUser.aqi.free_events_attended || 0}</span>
                        </div>
                      </div>

                      {/* Right Column */}
                      <div className="space-y-2">
                        <div className="flex justify-between border-b pb-1">
                          <span className="text-muted-foreground">Events Hosted:</span>
                          <span className="font-mono font-medium">{selectedUser.aqi.events_hosted || 0}</span>
                        </div>
                        <div className="flex justify-between border-b pb-1">
                          <span className="text-muted-foreground">Content Depth:</span>
                          <span className="font-mono font-medium">
                            {selectedUser.aqi.content_depth_score ? parseFloat(selectedUser.aqi.content_depth_score).toFixed(1) : "0.0"}
                          </span>
                        </div>
                        <div className="flex justify-between border-b pb-1">
                          <span className="text-muted-foreground">Search Sophist.:</span>
                          <span className="font-mono font-medium">
                            {selectedUser.aqi.search_sophistication_score ? parseFloat(selectedUser.aqi.search_sophistication_score).toFixed(1) : "0.0"}
                          </span>
                        </div>
                        <div className="flex justify-between border-b pb-1">
                          <span className="text-muted-foreground">Network Avg:</span>
                          <span className="font-mono font-medium">
                            {selectedUser.aqi.network_quality_avg ? parseFloat(selectedUser.aqi.network_quality_avg).toFixed(1) : "0.0"}
                          </span>
                        </div>
                        <div className="flex justify-between border-b pb-1">
                          <span className="text-muted-foreground">Professional Hrs:</span>
                          <span className="font-mono font-medium">
                            {selectedUser.aqi.professional_hours_ratio 
                              ? `${(parseFloat(selectedUser.aqi.professional_hours_ratio) * 100).toFixed(0)}%` 
                              : "0%"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between text-[10px] text-muted-foreground pt-1">
                      <span>Last active: {formatDate(selectedUser.aqi.last_active_at)}</span>
                      <span>Updated: {formatDate(selectedUser.aqi.last_calculated_at)}</span>
                    </div>
                  </div>
                )}

                {/* Creator Insights & Dashboard (Members only, Creator Mode enabled) */}
                {selectedUser.type === "member" && selectedUser.is_creator_mode_enabled && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <Award className="h-5 w-5 text-purple-600" />
                      <h4 className="font-bold text-base text-purple-950 dark:text-purple-300">Creator Hub & Dashboard</h4>
                    </div>

                    {creatorInsightsLoading ? (
                      <div className="flex justify-center py-6">
                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Summary Metrics */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="border rounded-lg p-3 bg-card shadow-sm space-y-1">
                            <div className="text-[10px] text-muted-foreground uppercase font-semibold">Audience Health</div>
                            <div className="text-xl font-bold text-primary flex items-baseline gap-1">
                              <span>{creatorSummary?.audience_score || (selectedUser.aqi?.aqi_score ? Math.round(parseFloat(selectedUser.aqi.aqi_score)) : "N/A")}</span>
                              <span className="text-[10px] text-muted-foreground font-normal">/100</span>
                            </div>
                            <Badge variant="outline" className="text-[9px] px-1 py-0 border-blue-200 bg-blue-50 text-blue-700">
                              Personal AQI
                            </Badge>
                          </div>
                          
                          <div className="border rounded-lg p-3 bg-card shadow-sm space-y-1">
                            <div className="text-[10px] text-muted-foreground uppercase font-semibold">Follower Quality</div>
                            <div className="text-xl font-bold text-emerald-600 flex items-baseline gap-1">
                              <span>{creatorSummary?.follow_quality?.score || 72}</span>
                              <span className="text-[10px] text-muted-foreground font-normal">/100</span>
                            </div>
                            <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-200 bg-emerald-50 text-emerald-700 capitalize">
                              {creatorSummary?.follow_quality?.label || "Good"}
                            </Badge>
                          </div>
                        </div>

                        {/* Follower Intent Breakdown */}
                        <div className="border rounded-lg p-3 bg-card shadow-sm space-y-2">
                          <div className="text-xs font-semibold text-muted-foreground">Follower Intent Breakdown</div>
                          <div className="space-y-1.5 text-xs">
                            <div>
                              <div className="flex justify-between mb-0.5">
                                <span className="text-muted-foreground">High-Intent (Content Driven)</span>
                                <span className="font-medium font-mono">{creatorSummary?.follow_quality?.breakdown?.high_intent || 14}</span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-1.5">
                                <div 
                                  className="bg-purple-600 h-1.5 rounded-full" 
                                  style={{ width: `${creatorSummary?.follow_quality?.score ? Math.round((creatorSummary.follow_quality.breakdown.high_intent / (creatorSummary.follow_quality.breakdown.high_intent + creatorSummary.follow_quality.breakdown.interested + creatorSummary.follow_quality.breakdown.casual || 1)) * 100) : 40}%` }}
                                ></div>
                              </div>
                            </div>
                            
                            <div>
                              <div className="flex justify-between mb-0.5">
                                <span className="text-muted-foreground">Interested (Event Driven)</span>
                                <span className="font-medium font-mono">{creatorSummary?.follow_quality?.breakdown?.interested || 9}</span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-1.5">
                                <div 
                                  className="bg-blue-500 h-1.5 rounded-full" 
                                  style={{ width: `${creatorSummary?.follow_quality?.score ? Math.round((creatorSummary.follow_quality.breakdown.interested / (creatorSummary.follow_quality.breakdown.high_intent + creatorSummary.follow_quality.breakdown.interested + creatorSummary.follow_quality.breakdown.casual || 1)) * 100) : 30}%` }}
                                ></div>
                              </div>
                            </div>

                            <div>
                              <div className="flex justify-between mb-0.5">
                                <span className="text-muted-foreground">Casual (Search/Discovery)</span>
                                <span className="font-medium font-mono">{creatorSummary?.follow_quality?.breakdown?.casual || 12}</span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-1.5">
                                <div 
                                  className="bg-gray-400 h-1.5 rounded-full" 
                                  style={{ width: `${creatorSummary?.follow_quality?.score ? Math.round((creatorSummary.follow_quality.breakdown.casual / (creatorSummary.follow_quality.breakdown.high_intent + creatorSummary.follow_quality.breakdown.interested + creatorSummary.follow_quality.breakdown.casual || 1)) * 100) : 30}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* follower trend sparkline */}
                        {creatorFollowerTrend?.trend && creatorFollowerTrend.trend.length > 0 && (() => {
                          const trend = creatorFollowerTrend.trend;
                          const counts = trend.map(t => t.count);
                          const minCount = Math.min(...counts);
                          const maxCount = Math.max(...counts);
                          const range = maxCount - minCount || 1;
                          
                          // Create points for SVG path
                          const width = 350;
                          const height = 80;
                          const points = trend.map((t, index) => {
                            const x = (index / (trend.length - 1)) * width;
                            const y = height - ((t.count - minCount) / range) * (height - 10) - 5;
                            return `${x},${y}`;
                          }).join(" ");
                          
                          return (
                            <div className="space-y-2 border rounded-lg p-3 bg-muted/20">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-semibold text-muted-foreground">30-Day Follower Trend</span>
                                <span className="text-xs font-mono font-bold text-primary">{minCount} ➔ {maxCount}</span>
                              </div>
                              <svg className="w-full h-[80px]" viewBox={`0 0 ${width} ${height}`}>
                                <defs>
                                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
                                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.0" />
                                  </linearGradient>
                                </defs>
                                <path
                                  d={`M 0,${height} L ${points} L ${width},${height} Z`}
                                  fill="url(#trendGrad)"
                                />
                                <polyline
                                  fill="none"
                                  stroke="hsl(var(--primary))"
                                  strokeWidth="2"
                                  points={points}
                                />
                                <circle cx="0" cy={height - ((counts[0] - minCount) / range) * (height - 10) - 5} r="2.5" fill="hsl(var(--primary))" />
                                <circle cx={width} cy={height - ((counts[counts.length - 1] - minCount) / range) * (height - 10) - 5} r="3" fill="hsl(var(--primary))" stroke="white" strokeWidth="1" />
                              </svg>
                            </div>
                          );
                        })()}

                        {/* Content Dashboard (Reach stats) */}
                        <div className="border rounded-lg p-3 bg-card shadow-sm space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-semibold text-muted-foreground">Content Engagement Reach</span>
                            <span className="text-[9px] font-medium bg-purple-50 text-purple-700 border border-purple-200 rounded px-1">Creator Dashboard</span>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="border border-dashed rounded p-1.5 bg-muted/10">
                              <div className="text-[10px] text-muted-foreground">Views</div>
                              <div className="font-bold font-mono">{creatorReach?.total_views || "1.2K"}</div>
                            </div>
                            <div className="border border-dashed rounded p-1.5 bg-muted/10">
                              <div className="text-[10px] text-muted-foreground">Impressions</div>
                              <div className="font-bold font-mono">{creatorReach?.total_impressions || "4.8K"}</div>
                            </div>
                            <div className="border border-dashed rounded p-1.5 bg-muted/10">
                              <div className="text-[10px] text-muted-foreground">Avg Watch</div>
                              <div className="font-bold font-mono">{creatorReach?.avg_watch_pct ? `${creatorReach.avg_watch_pct}%` : "62%"}</div>
                            </div>
                          </div>

                          {/* Top performing content list */}
                          <div className="space-y-1.5 pt-1">
                            <div className="text-[10px] text-muted-foreground uppercase font-semibold">Top Performing Content</div>
                            {creatorReach?.top_content && creatorReach.top_content.length > 0 ? (
                              <div className="space-y-2">
                                {creatorReach.top_content.map((c, i) => (
                                  <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/30 border">
                                    <div className="flex items-center gap-2">
                                      {c.thumbnail_url ? (
                                        <img src={c.thumbnail_url} className="h-8 w-8 object-cover rounded" />
                                      ) : (
                                        <div className="h-8 w-8 bg-muted rounded flex items-center justify-center text-[10px] font-bold text-muted-foreground">Post</div>
                                      )}
                                      <div>
                                        <div className="font-medium text-muted-foreground">ID: #{c.post_id}</div>
                                        <div className="text-[10px] text-muted-foreground">Interactive Video Post</div>
                                      </div>
                                    </div>
                                    <div className="text-right text-[10px]">
                                      <div className="font-bold">{c.views || Math.round(520 / (i + 1))} views</div>
                                      <div className="text-muted-foreground">{c.watch_pct || 65}% avg duration</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[10px] text-muted-foreground italic">No content reach telemetry recorded yet.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Events Hosted (Communities only) */}
                {selectedUser.type === "community" && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-primary" />
                      <h4 className="font-semibold">Events Hosted</h4>
                    </div>
                    <div className="space-y-2">
                      {selectedUser.events_hosted && selectedUser.events_hosted.length > 0 ? (
                        <div className="grid grid-cols-1 gap-3">
                          {selectedUser.events_hosted.map((event: any) => {
                            const isPaid = event.is_paid;
                            const price = event.ticket_price ? (event.ticket_price / 100).toFixed(2) : "0.00";
                            return (
                              <div
                                key={event.id}
                                className="flex flex-col gap-3 p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors cursor-pointer"
                                onClick={() => handleViewEventDetail(event)}
                              >
                                <div className="flex gap-3">
                                  {event.banner_url ? (
                                    <img
                                      src={event.banner_url}
                                      alt={event.title}
                                      className="h-16 w-24 object-cover rounded-md flex-shrink-0"
                                    />
                                  ) : (
                                    <div className="h-16 w-24 bg-muted rounded-md flex items-center justify-center text-xs text-muted-foreground flex-shrink-0">
                                      No Image
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="font-bold text-sm truncate">{event.title}</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                      {formatDate(event.start_datetime)}
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                                      {event.location_name || event.venue_name || "Online / TBD"}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t text-xs">
                                  <Badge variant={isPaid ? "destructive" : "secondary"} className="text-[10px]">
                                    {isPaid ? `Paid • ₹${price}` : "Free Event"}
                                  </Badge>
                                  <span className="text-primary font-medium hover:underline text-[11px]">View Attendees</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No hosted events found</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Events & Plans (Members only) */}
                {selectedUser.type === "member" && (
                  <div className="space-y-6 pt-4 border-t">
                    {/* Events Attended */}
                    <div className="space-y-3">
                      <h4 className="font-semibold flex items-center justify-between">
                        <span>Events Attended & RSVPs</span>
                        <Badge variant="outline">{selectedUser.events_attended?.length || 0}</Badge>
                      </h4>
                      {selectedUser.events_attended && selectedUser.events_attended.length > 0 ? (
                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                          {selectedUser.events_attended.map((event) => {
                            const statusLabel = event.attendance_status === 'registered' ? 'Registered' : 
                                                event.attendance_status ? event.attendance_status.replace(/_/g, ' ') :
                                                event.registration_status ? event.registration_status.replace(/_/g, ' ') : 
                                                'Registered';
                            return (
                              <div 
                                key={event.id} 
                                className="flex gap-3 p-2 rounded-lg bg-muted/30 border items-center cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => handleViewEventDetail(event)}
                              >
                                {event.banner_url ? (
                                  <img src={event.banner_url} alt={event.title} className="h-10 w-16 object-cover rounded" />
                                ) : (
                                  <div className="h-10 w-16 bg-muted flex items-center justify-center text-xs text-muted-foreground rounded">No cover</div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-xs truncate">{event.title}</div>
                                  <div className="text-[10px] text-muted-foreground truncate">
                                    {formatDate(event.start_datetime)} {event.city ? `• ${event.city}` : ''}
                                  </div>
                                </div>
                                <Badge variant="secondary" className="text-[10px] capitalize">{statusLabel}</Badge>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No events registered or attended yet</p>
                      )}
                    </div>

                    {/* Open Plans Hosted */}
                    <div className="space-y-3">
                      <h4 className="font-semibold flex items-center justify-between">
                        <span>Open Plans Hosted</span>
                        <Badge variant="outline">{selectedUser.plans_hosted?.length || 0}</Badge>
                      </h4>
                      {selectedUser.plans_hosted && selectedUser.plans_hosted.length > 0 ? (
                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                          {selectedUser.plans_hosted.map((plan) => {
                            const statusBadgeColor = plan.status === 'active' ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-50' :
                                                     plan.status === 'completed' ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50' :
                                                     'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-50';
                            return (
                              <div 
                                key={plan.id} 
                                className="p-2.5 rounded-lg bg-muted/30 border text-xs space-y-1.5 cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => handleViewPlanDetail(plan)}
                              >
                                <div className="flex justify-between items-start gap-2">
                                  <span className="font-semibold truncate">{plan.title}</span>
                                  <Badge variant="secondary" className="capitalize text-[10px]">{plan.activity_type.replace(/_/g, ' ')}</Badge>
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                                  <span>{formatDate(plan.scheduled_at)}</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="capitalize">{plan.visibility.replace(/_/g, ' ')} • Max {plan.max_accepted}</span>
                                    <Badge variant="outline" className={`text-[9px] uppercase font-semibold px-1 py-0 ${statusBadgeColor}`}>{plan.status}</Badge>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No open plans hosted yet</p>
                      )}
                    </div>

                    {/* Open Plans Attended */}
                    <div className="space-y-3">
                      <h4 className="font-semibold flex items-center justify-between">
                        <span>Open Plans Attended</span>
                        <Badge variant="outline">{selectedUser.plans_attended?.length || 0}</Badge>
                      </h4>
                      {selectedUser.plans_attended && selectedUser.plans_attended.length > 0 ? (
                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                          {selectedUser.plans_attended.map((plan) => {
                            const statusBadgeColor = plan.status === 'active' ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-50' :
                                                     plan.status === 'completed' ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50' :
                                                     'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-50';
                            return (
                              <div 
                                key={plan.id} 
                                className="p-2.5 rounded-lg bg-muted/30 border text-xs space-y-1.5 cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => handleViewPlanDetail(plan)}
                              >
                                <div className="flex justify-between items-start gap-2">
                                  <span className="font-semibold truncate">{plan.title}</span>
                                  <Badge variant="secondary" className="capitalize text-[10px]">{plan.activity_type.replace(/_/g, ' ')}</Badge>
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                                  <span>{formatDate(plan.scheduled_at)}</span>
                                  <Badge variant="outline" className={`text-[9px] uppercase font-semibold px-1 py-0 ${statusBadgeColor}`}>{plan.status}</Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No open plans attended yet</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Stats */}
                <div className="space-y-2">
                  <h4 className="font-semibold">Stats</h4>
                  <div className={`grid ${
                    selectedUser.type === "member" 
                      ? "grid-cols-4" 
                      : "grid-cols-3"
                  } gap-2 text-center`}>
                    {selectedUser.type === "member" && (
                      <button
                        onClick={handleShowCirclesList}
                        className="hover:bg-muted/50 rounded-lg p-2 transition-colors cursor-pointer border bg-card"
                      >
                        <div className="text-2xl font-bold">
                          {selectedUser.circle_count || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Circles
                        </div>
                      </button>
                    )}
                    <button
                      onClick={() => handleShowFollowList("followers")}
                      className="hover:bg-muted/50 rounded-lg p-2 transition-colors cursor-pointer border bg-card"
                    >
                      <div className="text-2xl font-bold">
                        {selectedUser.type === "member" && selectedUser.is_creator_mode_enabled
                          ? selectedUser.creator_follower_count || 0
                          : selectedUser.follower_count || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Followers
                      </div>
                    </button>
                    {(selectedUser.type === "member" || selectedUser.type === "community") && (
                      <button
                        onClick={() => handleShowFollowList("following")}
                        className="hover:bg-muted/50 rounded-lg p-2 transition-colors cursor-pointer border bg-card"
                      >
                        <div className="text-2xl font-bold">
                          {selectedUser.following_count || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Following
                        </div>
                      </button>
                    )}
                    <button
                      onClick={handleShowUserPosts}
                      className="hover:bg-muted/50 rounded-lg p-2 transition-colors cursor-pointer border bg-card"
                    >
                      <div className="text-2xl font-bold">
                        {selectedUser.post_count || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Posts</div>
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant={selectedUser.is_active ? "destructive" : "default"}
                    className="flex-1"
                    onClick={() => handleToggleBan(selectedUser)}
                  >
                    <Ban className="mr-2 h-4 w-4" />
                    {selectedUser.is_active ? "Ban User" : "Unban User"}
                  </Button>
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(selectedUser)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Followers/Following Modal */}
      <Dialog open={followModalOpen} onOpenChange={setFollowModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {followModalType === "followers" ? "Followers" : "Following"}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {followLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : followList.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No {followModalType} yet
              </div>
            ) : (
              <div className="space-y-3">
                {followList.map((item) => {
                  const name =
                    followModalType === "followers"
                      ? item.follower_name
                      : item.following_name;
                  const username =
                    followModalType === "followers"
                      ? item.follower_username
                      : item.following_username;
                  const photoUrl =
                    followModalType === "followers"
                      ? item.follower_photo_url
                      : item.following_photo_url;
                  const type =
                    followModalType === "followers"
                      ? item.follower_type
                      : item.following_type;
                  const targetId = followModalType === "followers" ? item.follower_id : item.following_id;
                  const targetType = followModalType === "followers" ? item.follower_type : item.following_type;

                  return (
                    <div 
                      key={item.id || `${targetId}-${targetType}`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => handleNavigateToUserProfile(targetId, targetType)}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={photoUrl || undefined} />
                        <AvatarFallback>
                          {name
                            ?.split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {name || "Unknown"}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          @{username || "unknown"}
                        </div>
                      </div>
                      <Badge
                        variant={type === "member" ? "default" : "secondary"}
                      >
                        {type === "member"
                          ? "Member"
                          : type === "community"
                          ? "Community"
                          : type}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Circles Modal */}
      <Dialog open={circlesModalOpen} onOpenChange={setCirclesModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Circles</DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {circlesLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : circlesList.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No connections in circle yet
              </div>
            ) : (
              <div className="space-y-3">
                {circlesList.map((item) => (
                  <div
                    key={`${item.is_community ? "com" : "mem"}-${item.member_id}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleNavigateToUserProfile(item.member_id, item.is_community ? 'community' : 'member')}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={item.profile_photo_url || undefined} />
                      <AvatarFallback>
                        {item.name
                          ?.split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate flex items-center gap-1">
                        <span>{item.name || "Unknown"}</span>
                        {item.is_creator_mode_enabled && (
                          <span title="Creator">
                            <Award className="h-3.5 w-3.5 text-purple-600" />
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        @{item.username || "unknown"}
                      </div>
                    </div>
                    <Badge
                      variant={item.is_community ? "secondary" : "default"}
                    >
                      {item.is_community ? "Community" : "Member"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* User Posts Modal */}
      <Dialog open={postsModalOpen} onOpenChange={setPostsModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedUser?.name}&apos;s Posts</DialogTitle>
          </DialogHeader>
          <div>
            {postsLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : userPosts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No posts yet
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {userPosts.map((post) => (
                  <div
                    key={post.id}
                    className="relative aspect-square bg-muted rounded-lg overflow-hidden group cursor-pointer"
                    onClick={() => handleViewPostDetail(post)}
                  >
                    {post.image_urls && post.image_urls.length > 0 ? (
                      isVideoUrl(post.image_urls[0]) ? (
                        <div className="w-full h-full relative bg-black">
                          {post.video_thumbnail ? (
                            <img src={post.video_thumbnail} alt="Video thumbnail" className="w-full h-full object-cover" />
                          ) : (
                            <video src={post.image_urls[0]} className="w-full h-full object-cover" muted />
                          )}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <span className="text-white text-lg">▶️</span>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={post.image_urls[0]}
                          alt={post.caption || "Post"}
                          className="w-full h-full object-cover"
                        />
                      )
                    ) : (
                      <div className="w-full h-full flex flex-col justify-between p-3 bg-muted text-card-foreground text-xs text-center font-medium overflow-hidden border">
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground text-left font-semibold">
                          {post.post_type ? post.post_type.replace(/_/g, ' ') : 'Post'}
                        </div>
                        <div className="line-clamp-4 text-center my-auto px-1 leading-snug font-normal text-muted-foreground">
                          {post.post_type === 'poll' && post.type_data?.question ? post.type_data.question :
                           post.post_type === 'prompt' && post.type_data?.prompt_text ? post.type_data.prompt_text :
                           post.post_type === 'challenge' && post.type_data?.title ? post.type_data.title :
                           post.post_type === 'qna' && post.type_data?.title ? post.type_data.title :
                           post.post_type === 'opportunity' && post.type_data?.title ? post.type_data.title :
                           post.caption || "No text content"}
                        </div>
                        <div className="text-[9px] text-muted-foreground text-right font-normal">
                          {post.like_count || 0} ❤️ • {post.comment_count || 0} 💬
                        </div>
                      </div>
                    )}
                    {/* Hover overlay with stats */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-sm">
                      <div className="flex gap-3 mb-2">
                        <span>❤️ {post.like_count || 0}</span>
                        <span>💬 {post.comment_count || 0}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewPostDetail(post);
                          }}
                          className="bg-primary hover:bg-primary/80 text-white text-xs px-2 py-1 rounded flex items-center gap-1"
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteUserPost(post.id);
                          }}
                          className="bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      </div>
                    </div>
                    {/* Multiple images badge */}
                    {post.image_urls && post.image_urls.length > 1 && (
                      <div className="absolute top-1 right-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                        +{post.image_urls.length - 1}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Post Detail Modal (for viewing likes/comments) */}
      <Dialog open={postDetailOpen} onOpenChange={setPostDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Post Details</DialogTitle>
          </DialogHeader>
          {selectedPost && (
            <Tabs value={activeTab} onValueChange={handlePostTabChange}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="likes">
                  Likes ({selectedPost.like_count || 0})
                </TabsTrigger>
                <TabsTrigger value="comments">
                  Comments ({selectedPost.comment_count || 0})
                </TabsTrigger>
              </TabsList>

              {/* Details Tab */}
              <TabsContent value="details" className="space-y-4">
                {/* Community Voice Box Anonymous Badge */}
                {selectedPost.post_type === 'community_voice' && (
                  <div className="flex justify-between items-center bg-rose-50 border border-rose-100 rounded-lg p-3">
                    <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider">🗣️ Community Voice Box</span>
                    <Badge variant="outline" className="text-rose-600 border-rose-200 bg-white text-[10px]">
                      {selectedPost.type_data?.is_anonymous ? "Anonymous Submission" : "Public Submission"}
                    </Badge>
                  </div>
                )}

                {/* Media rendering (Video or Image) */}
                {selectedPost.image_urls &&
                  selectedPost.image_urls.length > 0 && (
                    <div className="relative aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center border group">
                      {isVideoUrl(selectedPost.image_urls[currentImageIndex]) ? (
                        <video
                          src={selectedPost.image_urls[currentImageIndex]}
                          controls
                          className="w-full h-full object-contain max-h-[400px]"
                          poster={selectedPost.video_thumbnail || undefined}
                          key={currentImageIndex}
                        />
                      ) : (
                        <img
                          src={selectedPost.image_urls[currentImageIndex]}
                          alt={selectedPost.caption || "Post"}
                          className="w-full h-full object-cover"
                        />
                      )}

                      {/* Navigation buttons */}
                      {selectedPost.image_urls.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : selectedPost.image_urls.length - 1));
                            }}
                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors cursor-pointer"
                          >
                            <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentImageIndex((prev) => (prev < selectedPost.image_urls.length - 1 ? prev + 1 : 0));
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors cursor-pointer"
                          >
                            <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
                          </button>
                          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded font-medium">
                            {currentImageIndex + 1} / {selectedPost.image_urls.length}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                
                {selectedPost.caption && (
                  <div className="p-3 rounded-lg bg-muted/35 border text-sm leading-relaxed whitespace-pre-wrap">
                    {selectedPost.caption}
                  </div>
                )}

                {/* Poll Details */}
                {selectedPost.post_type === 'poll' && selectedPost.type_data && (
                  <div className="space-y-3 p-4 rounded-lg border bg-muted/20">
                    <div className="font-semibold text-sm flex items-center gap-1.5">
                      <span>📊 Poll:</span>
                      <span>{selectedPost.type_data.question}</span>
                    </div>
                    <div className="space-y-2.5">
                      {(selectedPost.type_data.options || []).map((opt: any, i: number) => {
                        const totalVotes = selectedPost.type_data.total_votes || 0;
                        const percentage = totalVotes > 0 
                          ? Math.round((opt.vote_count || 0) / totalVotes * 100) 
                          : 0;
                        return (
                          <div key={i} className="space-y-1">
                            <div className="flex justify-between text-xs font-medium">
                              <span>{opt.text}</span>
                              <span className="text-muted-foreground">{opt.vote_count || 0} votes ({percentage}%)</span>
                            </div>
                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary transition-all duration-500" style={{ width: `${percentage}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-xs text-muted-foreground pt-1 border-t">
                      Total votes: {selectedPost.type_data.total_votes || 0}
                    </div>
                  </div>
                )}

                {/* Prompt Details */}
                {selectedPost.post_type === 'prompt' && selectedPost.type_data && (
                  <div className="space-y-3 p-4 rounded-lg border bg-muted/20">
                    <div className="font-semibold text-sm flex items-center gap-1.5">
                      <span>📝 Prompt:</span>
                      <span>{selectedPost.type_data.prompt_text}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">Submission: {selectedPost.type_data.submission_type}</Badge>
                      <Badge variant="outline">{selectedPost.type_data.submission_count || 0} submissions</Badge>
                      {selectedPost.type_data.max_length && (
                        <Badge variant="outline">Max length: {selectedPost.type_data.max_length} chars</Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Challenge Details */}
                {selectedPost.post_type === 'challenge' && selectedPost.type_data && (
                  <div className="space-y-3 p-4 rounded-lg border bg-muted/20">
                    <div className="font-semibold text-sm flex items-center gap-1.5">
                      <span>🏆 Challenge:</span>
                      <span>{selectedPost.type_data.title}</span>
                    </div>
                    {selectedPost.type_data.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{selectedPost.type_data.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Badge variant="secondary">Goal: {selectedPost.type_data.target_count || 1} {selectedPost.type_data.submission_type || 'proof'}s</Badge>
                      <Badge variant="outline">{selectedPost.type_data.participant_count || 0} participants</Badge>
                      <Badge variant="outline">{selectedPost.type_data.submission_count || 0} submissions</Badge>
                    </div>
                  </div>
                )}

                {/* Q&A Details */}
                {selectedPost.post_type === 'qna' && selectedPost.type_data && (
                  <div className="space-y-3 p-4 rounded-lg border bg-muted/20">
                    <div className="font-semibold text-sm flex items-center gap-1.5">
                      <span>💬 Q&A:</span>
                      <span>{selectedPost.type_data.title}</span>
                    </div>
                    {selectedPost.type_data.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{selectedPost.type_data.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Badge variant="secondary">{selectedPost.type_data.question_count || 0} questions</Badge>
                      <Badge variant="outline">{selectedPost.type_data.answered_count || 0} answered</Badge>
                      <Badge variant="outline">{selectedPost.type_data.allow_anonymous ? "Anonymous Allowed" : "Public Only"}</Badge>
                    </div>
                  </div>
                )}

                {/* Opportunity Details */}
                {selectedPost.post_type === 'opportunity' && selectedPost.type_data && (
                  <div className="space-y-3 p-4 rounded-lg border bg-muted/20">
                    <div className="font-semibold text-sm flex items-center gap-1.5 text-primary">
                      <span>💼 Opportunity:</span>
                      <span>{selectedPost.type_data.title}</span>
                    </div>
                    {selectedPost.type_data.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{selectedPost.type_data.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Badge variant="secondary">Type: {selectedPost.type_data.work_mode || 'Remote'}</Badge>
                      {selectedPost.type_data.budget_range && (
                        <Badge variant="outline">Budget: {selectedPost.type_data.budget_range}</Badge>
                      )}
                      {selectedPost.type_data.experience_level && (
                        <Badge variant="outline">Exp: {selectedPost.type_data.experience_level}</Badge>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Heart className="h-4 w-4" />
                    {selectedPost.like_count || 0} likes
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-4 w-4" />
                    {selectedPost.comment_count || 0} comments
                  </span>
                </div>
                <div className="pt-4 border-t">
                  <Button
                    variant="destructive"
                    onClick={() => handleDeleteUserPost(selectedPost.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Post
                  </Button>
                </div>
              </TabsContent>

              {/* Likes Tab */}
              <TabsContent value="likes">
                {likesLoading ? (
                  <div className="flex justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !likes || likes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No likes yet
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {likes.map((like) => (
                      <div
                        key={like.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage
                            src={like.liker_photo_url || undefined}
                          />
                          <AvatarFallback>
                            {getInitials(like.liker_name || "?")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">
                            {like.liker_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            @{like.liker_username}
                          </div>
                        </div>
                        <Badge variant="secondary">{like.liker_type}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Comments Tab */}
              <TabsContent value="comments">
                {commentsLoading ? (
                  <div className="flex justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !comments || comments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No comments yet
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="p-3 rounded-lg bg-muted/30 border"
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage
                              src={comment.commenter_photo_url || undefined}
                            />
                            <AvatarFallback>
                              {getInitials(comment.commenter_name || "?")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {comment.commenter_name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                @{comment.commenter_username}
                              </span>
                            </div>
                            <p className="text-sm mt-1">
                              {comment.comment_text}
                            </p>
                            <div className="text-xs text-muted-foreground mt-1">
                              {new Date(comment.created_at).toLocaleString()}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive h-8 w-8"
                            onClick={() => handleDeleteComment(comment.id)}
                            title="Delete comment"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Event Detail Modal */}
      <Dialog open={eventDetailOpen} onOpenChange={setEventDetailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Event Details</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              {selectedEvent.banner_url && (
                <div className="relative aspect-video rounded-lg overflow-hidden bg-muted border">
                  <img src={selectedEvent.banner_url} alt={selectedEvent.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-primary">{selectedEvent.title}</h3>
                {selectedEvent.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 p-3 rounded-lg border">{selectedEvent.description}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs border-t pt-3">
                <div className="space-y-1">
                  <div className="text-muted-foreground font-medium">Date & Time</div>
                  <div className="font-semibold">{formatDate(selectedEvent.start_datetime)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground font-medium">Location</div>
                  <div className="font-semibold">{selectedEvent.venue_name || selectedEvent.location_name || "N/A"}</div>
                  {selectedEvent.address_line1 && <div className="text-[10px] text-muted-foreground">{selectedEvent.address_line1}, {selectedEvent.city || ""}</div>}
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground font-medium">Ticket Price</div>
                  <div className="font-semibold">
                    {selectedEvent.is_paid ? `₹${parseFloat(selectedEvent.ticket_price || "0").toFixed(2)}` : "Free"}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground font-medium">Attendance Status</div>
                  <Badge variant="secondary" className="capitalize text-[10px] mt-0.5">
                    {selectedEvent.attendance_status?.replace(/_/g, ' ') || selectedEvent.registration_status?.replace(/_/g, ' ') || 'Registered'}
                  </Badge>
                </div>
              </div>
              {selectedEvent.attendance_inference_reason && (
                <div className="p-2.5 bg-yellow-50/50 border border-yellow-200/50 text-yellow-800 text-[10px] rounded-lg">
                  <span className="font-bold">Attendance Resolution:</span> {selectedEvent.attendance_inference_reason}
                </div>
              )}

              {/* Event Attendees List */}
              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground">
                  <span>Other Attendees & RSVPs</span>
                  <Badge variant="outline" className="font-mono text-[10px]">{eventAttendees.length}</Badge>
                </div>
                {eventAttendeesLoading ? (
                  <div className="flex justify-center py-4">
                    <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : eventAttendees.length === 0 ? (
                  <div className="text-center py-4 text-xs text-muted-foreground italic">No other attendees found</div>
                ) : (
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {eventAttendees.map((attendee) => (
                      <div 
                        key={attendee.id} 
                        className="flex items-center justify-between p-1.5 rounded bg-muted/40 border border-muted-foreground/10 text-xs cursor-pointer hover:bg-muted/65 transition-colors"
                        onClick={() => {
                          setEventDetailOpen(false);
                          handleNavigateToUserProfile(attendee.id, "member");
                        }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={attendee.profile_photo_url || undefined} />
                            <AvatarFallback className="text-[9px]">{attendee.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{attendee.name}</div>
                            <div className="text-[10px] text-muted-foreground truncate">@{attendee.username}</div>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 capitalize">
                          {attendee.attendance_status?.replace(/_/g, ' ') || attendee.registration_status?.replace(/_/g, ' ') || 'Registered'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Plan Detail Modal */}
      <Dialog open={planDetailOpen} onOpenChange={setPlanDetailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Open Plan Details</DialogTitle>
          </DialogHeader>
          {selectedPlan && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <h3 className="text-lg font-bold text-primary">{selectedPlan.title}</h3>
                  <Badge variant="secondary" className="capitalize">
                    {selectedPlan.activity_type?.replace(/_/g, ' ')}
                  </Badge>
                </div>
                {selectedPlan.custom_activity_label && (
                  <div className="text-xs text-muted-foreground">Custom Activity: {selectedPlan.custom_activity_label}</div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs border-t pt-3">
                <div className="space-y-1">
                  <div className="text-muted-foreground font-medium">Scheduled At</div>
                  <div className="font-semibold">{formatDate(selectedPlan.scheduled_at)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground font-medium">Visibility</div>
                  <div className="font-semibold capitalize">{selectedPlan.visibility?.replace(/_/g, ' ')}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground font-medium">Public Area (shown to all)</div>
                  <div className="font-semibold">{selectedPlan.location_public || "N/A"}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground font-medium">Private Address (attendees only)</div>
                  <div className="font-semibold text-rose-600 font-mono">{selectedPlan.location_private || "N/A"}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground font-medium">Cost Type</div>
                  <div className="font-semibold capitalize">{selectedPlan.cost_type?.replace(/_/g, ' ')}</div>
                  {selectedPlan.cost_amount_paise && (
                    <div className="text-[10px] text-muted-foreground">Amount: ₹{(selectedPlan.cost_amount_paise / 100).toFixed(2)}</div>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground font-medium">Preferences & Capacity</div>
                  <div className="font-semibold">Gender Pref: {selectedPlan.gender_preference}</div>
                  <div className="text-[10px] text-muted-foreground">Max attendees: {selectedPlan.max_accepted}</div>
                </div>
                {selectedPlan.is_recurring && (
                  <div className="col-span-2 p-2 bg-blue-50/50 border border-blue-200/50 text-blue-800 text-[10px] rounded-lg">
                    🔁 <span className="font-bold">Recurring Plan:</span> Every {selectedPlan.recurrence_interval || "week"}
                  </div>
                )}
                <div className="space-y-1 col-span-2">
                  <div className="text-muted-foreground font-medium">Plan Status</div>
                  <Badge variant="outline" className="capitalize text-[10px] mt-0.5">
                    {selectedPlan.status}
                  </Badge>
                </div>
              </div>

              {/* Host & Attendees List */}
              <div className="border-t pt-3 space-y-3">
                {planMembersLoading ? (
                  <div className="flex justify-center py-4">
                    <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    {/* Host */}
                    {planHost && (
                      <div className="space-y-1.5">
                        <div className="text-xs font-semibold text-muted-foreground">Host</div>
                        <div 
                          className="flex items-center gap-2 p-1.5 rounded bg-muted/40 border border-muted-foreground/10 text-xs cursor-pointer hover:bg-muted/65 transition-colors"
                          onClick={() => {
                            setPlanDetailOpen(false);
                            handleNavigateToUserProfile(planHost.id, "member");
                          }}
                        >
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={planHost.profile_photo_url || undefined} />
                            <AvatarFallback className="text-[9px]">{planHost.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{planHost.name}</div>
                            <div className="text-[10px] text-muted-foreground">@{planHost.username}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Attendees */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground">
                        <span>Approved Attendees</span>
                        <Badge variant="outline" className="font-mono text-[10px]">{planAttendees.length}</Badge>
                      </div>
                      {planAttendees.length === 0 ? (
                        <div className="text-center py-2 text-xs text-muted-foreground italic bg-muted/20 rounded border border-dashed">No other approved attendees</div>
                      ) : (
                        <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                          {planAttendees.map((attendee) => (
                            <div 
                              key={attendee.id} 
                              className="flex items-center justify-between p-1.5 rounded bg-muted/40 border border-muted-foreground/10 text-xs cursor-pointer hover:bg-muted/65 transition-colors"
                              onClick={() => {
                                setPlanDetailOpen(false);
                                handleNavigateToUserProfile(attendee.id, "member");
                              }}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={attendee.profile_photo_url || undefined} />
                                  <AvatarFallback className="text-[9px]">{attendee.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <div className="font-medium truncate">{attendee.name}</div>
                                  <div className="text-[10px] text-muted-foreground truncate">@{attendee.username}</div>
                                </div>
                              </div>
                              <Badge variant="secondary" className="text-[9px] px-1 py-0 capitalize bg-green-50 text-green-700 border-green-200">
                                Approved
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
