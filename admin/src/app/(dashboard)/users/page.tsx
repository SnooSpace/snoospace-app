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
  User,
  MapPin,
  Mail,
  Phone,
  Calendar,
  ChevronLeft,
  ChevronRight,
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
  getUsers,
  updateUser,
  deleteUser,
  type User,
  type GetUsersParams,
} from "@/lib/api";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

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
    setIsSheetOpen(true);
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
                          <User className="mr-1 h-3 w-3" />
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
        <SheetContent className="overflow-y-auto">
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

              <div className="mt-6 space-y-6">
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
                        {selectedUser.phone}
                      </div>
                    )}
                    {selectedUser.location && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        {formatLocation(selectedUser.location)}
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

                {/* Head Names (Communities only) */}
                {selectedUser.type === "community" &&
                  (selectedUser.head1_name || selectedUser.head2_name) && (
                    <div className="space-y-2">
                      <h4 className="font-semibold">Heads / Organizers</h4>
                      <div className="space-y-1 text-sm">
                        {selectedUser.head1_name && (
                          <div className="text-muted-foreground">
                            {selectedUser.head1_name}
                            {selectedUser.head1_phone &&
                              ` • ${selectedUser.head1_phone}`}
                          </div>
                        )}
                        {selectedUser.head2_name && (
                          <div className="text-muted-foreground">
                            {selectedUser.head2_name}
                            {selectedUser.head2_phone &&
                              ` • ${selectedUser.head2_phone}`}
                          </div>
                        )}
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
                    <div>
                      <div className="text-2xl font-bold">
                        {selectedUser.follower_count || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Followers
                      </div>
                    </div>
                    {selectedUser.type === "member" && (
                      <div>
                        <div className="text-2xl font-bold">
                          {selectedUser.following_count || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Following
                        </div>
                      </div>
                    )}
                    <div>
                      <div className="text-2xl font-bold">
                        {selectedUser.post_count || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Posts</div>
                    </div>
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
    </div>
  );
}
