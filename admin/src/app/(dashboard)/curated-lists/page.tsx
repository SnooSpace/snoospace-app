"use client";

import { useState, useEffect } from "react";
import {
  FolderKanban,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  Sparkles,
  RefreshCw,
  Eye,
  CheckCircle,
  XCircle,
  Link as LinkIcon
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  getCuratedLists,
  getCuratedListById,
  createCuratedList,
  updateCuratedList,
  deleteCuratedList,
  addEventToCuratedList,
  removeEventFromCuratedList,
  type CuratedList,
  type CuratedListEvent,
} from "@/lib/api";

export default function CuratedListsPage() {
  const [lists, setLists] = useState<CuratedList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create / Edit modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingList, setEditingList] = useState<CuratedList | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    subtitle: "",
    cover_url: "",
    display_order: 0,
    is_active: true,
  });

  // Manage events sheet state
  const [selectedList, setSelectedList] = useState<CuratedList | null>(null);
  const [isEventsSheetOpen, setIsEventsSheetOpen] = useState(false);
  const [newEventId, setNewEventId] = useState("");
  const [newEventOrder, setNewEventOrder] = useState("0");
  const [addingEvent, setAddingEvent] = useState(false);

  useEffect(() => {
    loadLists();
  }, []);

  const loadLists = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCuratedLists();
      setLists(data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load curated lists");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setFormData({
      title: "",
      subtitle: "",
      cover_url: "",
      display_order: lists.length,
      is_active: true,
    });
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (list: CuratedList) => {
    setEditingList(list);
    setFormData({
      title: list.title,
      subtitle: list.subtitle || "",
      cover_url: list.cover_url || "",
      display_order: list.display_order,
      is_active: list.is_active,
    });
    setIsEditOpen(true);
  };

  const handleSaveCreate = async () => {
    if (!formData.title.trim()) return;
    try {
      await createCuratedList({
        title: formData.title,
        subtitle: formData.subtitle || undefined,
        cover_url: formData.cover_url || undefined,
        display_order: Number(formData.display_order) || 0,
        is_active: formData.is_active,
      });
      setIsCreateOpen(false);
      loadLists();
    } catch (err: any) {
      alert(err.message || "Failed to create curated list");
    }
  };

  const handleSaveEdit = async () => {
    if (!editingList || !formData.title.trim()) return;
    try {
      await updateCuratedList(editingList.id, {
        title: formData.title,
        subtitle: formData.subtitle || undefined,
        cover_url: formData.cover_url || undefined,
        display_order: Number(formData.display_order) || 0,
        is_active: formData.is_active,
      });
      setIsEditOpen(false);
      setEditingList(null);
      loadLists();
    } catch (err: any) {
      alert(err.message || "Failed to update curated list");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this curated list?")) return;
    try {
      await deleteCuratedList(id);
      loadLists();
    } catch (err: any) {
      alert(err.message || "Failed to delete curated list");
    }
  };

  const handleToggleActive = async (list: CuratedList) => {
    try {
      await updateCuratedList(list.id, { is_active: !list.is_active });
      setLists(
        lists.map((l) =>
          l.id === list.id ? { ...l, is_active: !l.is_active } : l
        )
      );
    } catch (err: any) {
      alert(err.message || "Failed to update status");
    }
  };

  const handleOpenManageEvents = async (list: CuratedList) => {
    try {
      const detailed = await getCuratedListById(list.id);
      setSelectedList(detailed);
      setIsEventsSheetOpen(true);
      setNewEventId("");
      setNewEventOrder("0");
    } catch (err: any) {
      alert(err.message || "Failed to load list details");
    }
  };

  const handleAddEvent = async () => {
    if (!selectedList || !newEventId.trim()) return;
    try {
      setAddingEvent(true);
      const eventIdNum = parseInt(newEventId.trim(), 10);
      if (isNaN(eventIdNum)) {
        alert("Please enter a valid numeric Event ID");
        return;
      }
      await addEventToCuratedList(
        selectedList.id,
        eventIdNum,
        parseInt(newEventOrder, 10) || 0
      );
      const updated = await getCuratedListById(selectedList.id);
      setSelectedList(updated);
      setNewEventId("");
      loadLists();
    } catch (err: any) {
      alert(err.message || "Failed to add event");
    } finally {
      setAddingEvent(false);
    }
  };

  const handleRemoveEvent = async (eventId: number) => {
    if (!selectedList) return;
    try {
      await removeEventFromCuratedList(selectedList.id, eventId);
      const updated = await getCuratedListById(selectedList.id);
      setSelectedList(updated);
      loadLists();
    } catch (err: any) {
      alert(err.message || "Failed to remove event");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Curated Lists</h1>
          <p className="text-muted-foreground">
            Author and manage editorial roundups and curated event collections for the Explore feed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={loadLists}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={handleOpenCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Create List
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 p-4 text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Collections ({lists.length})</CardTitle>
          <CardDescription>
            Active collections appear in the mobile app Explore feed ordered by priority
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center text-muted-foreground">
              Loading curated lists...
            </div>
          ) : lists.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              No curated lists created yet. Click "Create List" to start one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Order</TableHead>
                  <TableHead>Collection</TableHead>
                  <TableHead>Subtitle</TableHead>
                  <TableHead className="w-24">Events</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lists.map((list) => (
                  <TableRow key={list.id}>
                    <TableCell className="font-mono text-xs">
                      {list.display_order}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {list.cover_url ? (
                          <img
                            src={list.cover_url}
                            alt=""
                            className="h-10 w-16 rounded object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-16 items-center justify-center rounded bg-muted">
                            <Sparkles className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium">{list.title}</div>
                          <div className="text-xs text-muted-foreground">
                            ID: {list.id}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {list.subtitle || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="gap-1">
                        <Calendar className="h-3 w-3" />
                        {list.event_count || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={list.is_active}
                        onCheckedChange={() => handleToggleActive(list)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenManageEvents(list)}
                          className="gap-1.5"
                        >
                          <LinkIcon className="h-3.5 w-3.5" /> Events
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(list)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(list.id)}
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
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Curated List</DialogTitle>
            <DialogDescription>
              Add a new editorial collection or guide for the Explore feed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-title">Title *</Label>
              <Input
                id="create-title"
                placeholder="e.g. Best Tech Mixers in Bangalore"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-subtitle">Subtitle</Label>
              <Input
                id="create-subtitle"
                placeholder="e.g. Hand-picked hackathons & meetups for creators"
                value={formData.subtitle}
                onChange={(e) =>
                  setFormData({ ...formData, subtitle: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-cover">Cover Image URL</Label>
              <Input
                id="create-cover"
                placeholder="https://..."
                value={formData.cover_url}
                onChange={(e) =>
                  setFormData({ ...formData, cover_url: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-order">Display Order</Label>
                <Input
                  id="create-order"
                  type="number"
                  value={formData.display_order}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      display_order: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="flex items-center space-x-2 pt-8">
                <Switch
                  id="create-active"
                  checked={formData.is_active}
                  onCheckedChange={(val) =>
                    setFormData({ ...formData, is_active: val })
                  }
                />
                <Label htmlFor="create-active">Active</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCreate}>Create List</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Curated List</DialogTitle>
            <DialogDescription>
              Update collection title, cover, or display order.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-subtitle">Subtitle</Label>
              <Input
                id="edit-subtitle"
                value={formData.subtitle}
                onChange={(e) =>
                  setFormData({ ...formData, subtitle: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-cover">Cover Image URL</Label>
              <Input
                id="edit-cover"
                value={formData.cover_url}
                onChange={(e) =>
                  setFormData({ ...formData, cover_url: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-order">Display Order</Label>
                <Input
                  id="edit-order"
                  type="number"
                  value={formData.display_order}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      display_order: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="flex items-center space-x-2 pt-8">
                <Switch
                  id="edit-active"
                  checked={formData.is_active}
                  onCheckedChange={(val) =>
                    setFormData({ ...formData, is_active: val })
                  }
                />
                <Label htmlFor="edit-active">Active</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Events Sheet */}
      <Sheet open={isEventsSheetOpen} onOpenChange={setIsEventsSheetOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Manage Collection Events</SheetTitle>
            <SheetDescription>
              {selectedList?.title}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 py-6">
            {/* Add Event Form */}
            <Card className="p-4 bg-muted/30">
              <div className="space-y-3">
                <Label className="text-sm font-medium">Add Event by ID</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Event ID (e.g. 104)"
                    value={newEventId}
                    onChange={(e) => setNewEventId(e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Order"
                    type="number"
                    value={newEventOrder}
                    onChange={(e) => setNewEventOrder(e.target.value)}
                    className="w-20"
                  />
                  <Button
                    onClick={handleAddEvent}
                    disabled={addingEvent || !newEventId.trim()}
                  >
                    {addingEvent ? "Adding..." : "Add"}
                  </Button>
                </div>
              </div>
            </Card>

            {/* Event List */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Attached Events ({(selectedList?.events || []).length})
              </h3>
              {(!selectedList?.events || selectedList.events.length === 0) ? (
                <div className="py-8 text-center text-sm text-muted-foreground border rounded-lg border-dashed">
                  No events added to this collection yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedList.events.map((ev) => (
                    <div
                      key={ev.link_id}
                      className="flex items-center justify-between rounded-lg border p-3 bg-card"
                    >
                      <div className="flex items-center gap-3">
                        {ev.banner_url ? (
                          <img
                            src={ev.banner_url}
                            alt=""
                            className="h-10 w-12 rounded object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-12 items-center justify-center rounded bg-muted text-xs">
                            No Img
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-sm line-clamp-1">
                            {ev.title}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Event #{ev.event_id} • Order: {ev.display_order}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive h-8 w-8"
                        onClick={() => handleRemoveEvent(ev.event_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
