"use client";

import { useState, useEffect } from "react";
import {
  Search,
  RefreshCw,
  Eye,
  Trash2,
  XCircle,
  CalendarDays,
  MapPin,
  Users,
  Clock,
  ChevronLeft,
  ChevronRight,
  Building2,
  Image as ImageIcon,
  Star,
  Info,
  User,
  Tag,
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
  getEvents,
  getEventStats,
  deleteEvent,
  cancelEvent,
  getEventById,
  type Event,
  type EventStats,
  type GetEventsParams,
} from "@/lib/api";

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "upcoming" | "ongoing" | "completed" | "cancelled"
  >("all");

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 15;

  useEffect(() => {
    loadEvents();
    loadStats();
  }, [page, statusFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      loadEvents();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadStats = async () => {
    try {
      const data = await getEventStats();
      setStats(data);
    } catch (err) {
      console.error("Error loading stats:", err);
    }
  };

  const loadEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: GetEventsParams = {
        page,
        limit,
        search: search.trim(),
        status: statusFilter,
      };
      const data = await getEvents(params);
      setEvents(data.events);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  const handleViewEvent = async (event: Event) => {
    setSelectedEvent(event);
    setIsSheetOpen(true);
    setDetailLoading(true);

    try {
      // Fetch full event details
      const fullEvent = await getEventById(event.id);
      setSelectedEvent(fullEvent);
    } catch (err) {
      console.error("Error loading event details:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCancelEvent = async (event: Event) => {
    if (event.is_cancelled) return;
    if (!confirm(`Are you sure you want to cancel "${event.title}"?`)) {
      return;
    }

    try {
      await cancelEvent(event.id);
      // Update local state
      setEvents(
        events.map((e) =>
          e.id === event.id
            ? { ...e, is_cancelled: true, status: "cancelled" }
            : e
        )
      );
      if (selectedEvent?.id === event.id) {
        setSelectedEvent({
          ...selectedEvent,
          is_cancelled: true,
          status: "cancelled",
        });
      }
      loadStats();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to cancel event");
    }
  };

  const handleDeleteEvent = async (event: Event) => {
    if (
      !confirm(
        `Are you sure you want to permanently delete "${event.title}"? This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await deleteEvent(event.id);
      setEvents(events.filter((e) => e.id !== event.id));
      setIsSheetOpen(false);
      loadStats();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete event");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "upcoming":
        return (
          <Badge variant="default" className="bg-blue-500">
            Upcoming
          </Badge>
        );
      case "ongoing":
        return (
          <Badge variant="default" className="bg-green-500">
            Ongoing
          </Badge>
        );
      case "completed":
        return <Badge variant="secondary">Completed</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
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
          <h1 className="text-3xl font-bold tracking-tight">Events</h1>
          <p className="text-muted-foreground">
            Manage all events across communities
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            loadEvents();
            loadStats();
          }}
          disabled={loading}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Events
              </CardTitle>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">
                {stats.upcoming}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ongoing</CardTitle>
              <Clock className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                {stats.ongoing}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {stats.cancelled}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by event title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(
                  v as
                    | "all"
                    | "upcoming"
                    | "ongoing"
                    | "completed"
                    | "cancelled"
                );
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="ongoing">Ongoing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
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
            onClick={loadEvents}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Events Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Events</CardTitle>
          <CardDescription>
            Showing {events.length} of {total} events
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && events.length === 0 ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : events.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              No events found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Community</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attendees</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-16 rounded-md bg-muted overflow-hidden flex items-center justify-center">
                          {event.banner_url ? (
                            <img
                              src={event.banner_url}
                              alt={event.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium line-clamp-1">
                            {event.title}
                          </div>
                          {event.location_url && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              <span className="line-clamp-1">
                                View Location
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage
                            src={event.community_logo_url || undefined}
                          />
                          <AvatarFallback className="text-xs">
                            {getInitials(event.community_name || "C")}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{event.community_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatDate(event.start_datetime)}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(event.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{event.attendee_count}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewEvent(event)}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {!event.is_cancelled && event.status === "upcoming" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCancelEvent(event)}
                            title="Cancel Event"
                            className="text-orange-600 hover:text-orange-600"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteEvent(event)}
                          className="text-destructive hover:text-destructive"
                          title="Delete Event"
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

      {/* Event Details Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="overflow-y-auto px-6 pb-8 sm:max-w-lg">
          {selectedEvent && (
            <>
              <SheetHeader>
                <SheetTitle className="line-clamp-2">
                  {selectedEvent.title}
                </SheetTitle>
                <SheetDescription>
                  {getStatusBadge(selectedEvent.status)}
                </SheetDescription>
              </SheetHeader>

              {detailLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : (
                <div className="mt-6 space-y-6">
                  {/* Banner Image */}
                  {/* Banner Images */}
                  {selectedEvent.banners && selectedEvent.banners.length > 0 ? (
                    <div className="flex gap-2 overflow-x-auto pb-2 snap-x scrollbar-hide">
                      {selectedEvent.banners.map((banner, index) => (
                        <div
                          key={index}
                          className="flex-none w-full snap-center rounded-lg overflow-hidden"
                        >
                          <img
                            src={banner.image_url}
                            alt={`${selectedEvent.title} banner ${index + 1}`}
                            className="w-full h-48 object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    selectedEvent.banner_url && (
                      <div className="rounded-lg overflow-hidden">
                        <img
                          src={selectedEvent.banner_url}
                          alt={selectedEvent.title}
                          className="w-full h-40 object-cover"
                        />
                      </div>
                    )
                  )}

                  {/* Community */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={selectedEvent.community_logo_url || undefined}
                      />
                      <AvatarFallback>
                        {getInitials(selectedEvent.community_name || "C")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">
                        {selectedEvent.community_name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        @{selectedEvent.community_username}
                      </div>
                    </div>
                  </div>

                  {/* Date & Time */}
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Clock className="h-4 w-4" /> Date & Time
                    </h4>
                    <div className="text-sm text-muted-foreground">
                      <div>
                        Start: {formatDateTime(selectedEvent.start_datetime)}
                      </div>
                      <div>
                        End: {formatDateTime(selectedEvent.end_datetime)}
                      </div>
                    </div>
                  </div>

                  {/* Location */}
                  {selectedEvent.location_url && (
                    <div className="space-y-2">
                      <h4 className="font-semibold flex items-center gap-2">
                        <MapPin className="h-4 w-4" /> Location
                      </h4>
                      <a
                        href={selectedEvent.location_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        Open in Google Maps
                      </a>
                    </div>
                  )}

                  {/* Description */}
                  {selectedEvent.description && (
                    <div className="space-y-2">
                      <h4 className="font-semibold">Description</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {selectedEvent.description}
                      </p>
                    </div>
                  )}

                  {/* Attendees */}
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4" /> Attendees
                    </h4>
                    <div className="text-2xl font-bold">
                      {selectedEvent.attendee_count}
                    </div>
                  </div>

                  {/* Ticket Types */}
                  {selectedEvent.ticket_types &&
                    selectedEvent.ticket_types.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Tag className="h-4 w-4" /> Tickets
                        </h4>
                        <div className="space-y-2">
                          {selectedEvent.ticket_types.map((ticket, index) => (
                            <div
                              key={index}
                              className="flex justify-between items-center p-2 rounded bg-muted/50"
                            >
                              <div>
                                <div className="font-medium">{ticket.name}</div>
                                {ticket.description && (
                                  <div className="text-xs text-muted-foreground">
                                    {ticket.description}
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <Badge variant="secondary">
                                  {Number(ticket.base_price) === 0
                                    ? "Free"
                                    : `₹${ticket.base_price}`}
                                </Badge>
                                {ticket.total_quantity && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Qty: {ticket.total_quantity}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Highlights */}
                  {selectedEvent.highlights &&
                    selectedEvent.highlights.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Star className="h-4 w-4" /> Highlights
                        </h4>
                        <div className="grid grid-cols-1 gap-2">
                          {selectedEvent.highlights.map((item, index) => (
                            <div
                              key={index}
                              className="p-3 rounded-lg border bg-card text-card-foreground shadow-sm"
                            >
                              <div className="font-medium flex items-center gap-2">
                                <Star className="h-3 w-3 text-yellow-500" />{" "}
                                {item.title}
                              </div>
                              {item.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Things to Know */}
                  {selectedEvent.things_to_know &&
                    selectedEvent.things_to_know.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Info className="h-4 w-4" /> Things to Know
                        </h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                          {selectedEvent.things_to_know.map((item, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="mt-1">•</span>
                              <span>{item.label}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {/* Featured Accounts */}
                  {selectedEvent.featured_accounts &&
                    selectedEvent.featured_accounts.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold flex items-center gap-2">
                          <User className="h-4 w-4" /> Featured
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedEvent.featured_accounts.map(
                            (account, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-2 p-2 rounded-lg border bg-card text-card-foreground shadow-sm pr-4"
                              >
                                <Avatar className="h-8 w-8">
                                  <AvatarImage
                                    src={account.profile_photo_url || undefined}
                                  />
                                  <AvatarFallback>
                                    {getInitials(account.display_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="text-sm font-medium">
                                    {account.display_name}
                                  </div>
                                  {account.role && (
                                    <div className="text-xs text-muted-foreground">
                                      {account.role}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}

                  {/* Gallery */}
                  {selectedEvent.gallery_images &&
                    selectedEvent.gallery_images.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold">Gallery</h4>
                        <div className="grid grid-cols-3 gap-2">
                          {selectedEvent.gallery_images.map((img, index) => (
                            <div
                              key={index}
                              className="rounded overflow-hidden aspect-square"
                            >
                              <img
                                src={img.image_url}
                                alt={`Gallery ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t">
                    {!selectedEvent.is_cancelled &&
                      selectedEvent.status === "upcoming" && (
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleCancelEvent(selectedEvent)}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Cancel Event
                        </Button>
                      )}
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => handleDeleteEvent(selectedEvent)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Event
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
