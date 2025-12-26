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
  type User,
  type GetUsersParams,
  type FollowUser,
  type Post,
  type PostLike,
  type PostComment,
} from "@/lib/api";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [expandedLocation, setExpandedLocation] = useState(false);

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
  const [likes, setLikes] = useState<PostLike[]>([]);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [likesLoading, setLikesLoading] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

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

  const handleViewUser = (user: User) => {
    setSelectedUser(user);
    setExpandedLocation(false);
    setIsSheetOpen(true);
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
    setActiveTab("details");
    setLikes([]);
    setComments([]);
    setPostDetailOpen(true);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
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
                  <TableRow key={`${user.type}-${user.id}`}>
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
                          <div className="font-medium">{user.name}</div>
                          <div className="text-sm text-muted-foreground">
                            @{user.username}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
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
                          onClick={() => handleToggleBan(user)}
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
                          onClick={() => handleDelete(user)}
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
        <SheetContent className="overflow-y-auto px-6 pb-8">
          {selectedUser && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage
                      src={selectedUser.profile_photo_url || undefined}
                    />
                    <AvatarFallback className="text-lg">
                      {getInitials(selectedUser.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <SheetTitle>{selectedUser.name}</SheetTitle>
                    <SheetDescription>
                      @{selectedUser.username}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-8 space-y-8">
                {/* Status & Type */}
                <div className="flex gap-2">
                  <Badge
                    variant={
                      selectedUser.type === "member" ? "default" : "secondary"
                    }
                  >
                    {selectedUser.type === "member" ? "Member" : "Community"}
                  </Badge>
                  <Badge
                    variant={selectedUser.is_active ? "default" : "destructive"}
                  >
                    {selectedUser.is_active ? "Active" : "Banned"}
                  </Badge>
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

                {/* Category (Communities only) */}
                {selectedUser.type === "community" && selectedUser.category && (
                  <div className="space-y-2">
                    <h4 className="font-semibold">Category</h4>
                    <Badge variant="secondary">{selectedUser.category}</Badge>
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

                {/* Stats */}
                <div className="space-y-2">
                  <h4 className="font-semibold">Stats</h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <button
                      onClick={() => handleShowFollowList("followers")}
                      className="hover:bg-muted/50 rounded-lg p-2 transition-colors cursor-pointer"
                    >
                      <div className="text-2xl font-bold">
                        {selectedUser.follower_count || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Followers
                      </div>
                    </button>
                    <button
                      onClick={() => handleShowFollowList("following")}
                      className="hover:bg-muted/50 rounded-lg p-2 transition-colors cursor-pointer"
                    >
                      <div className="text-2xl font-bold">
                        {selectedUser.following_count || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Following
                      </div>
                    </button>
                    <button
                      onClick={handleShowUserPosts}
                      className="hover:bg-muted/50 rounded-lg p-2 transition-colors cursor-pointer"
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

                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
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
                      <img
                        src={post.image_urls[0]}
                        alt={post.caption || "Post"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                        No image
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
                {selectedPost.image_urls &&
                  selectedPost.image_urls.length > 0 && (
                    <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                      <img
                        src={selectedPost.image_urls[0]}
                        alt={selectedPost.caption || "Post"}
                        className="w-full h-full object-cover"
                      />
                      {selectedPost.image_urls.length > 1 && (
                        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                          1 / {selectedPost.image_urls.length}
                        </div>
                      )}
                    </div>
                  )}
                {selectedPost.caption && (
                  <p className="text-sm">{selectedPost.caption}</p>
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
    </div>
  );
}
