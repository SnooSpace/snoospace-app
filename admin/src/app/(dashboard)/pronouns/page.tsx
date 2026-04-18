"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Eye,
  EyeOff,
  RefreshCw,
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
  SheetFooter,
} from "@/components/ui/sheet";
import {
  getPronouns,
  createPronoun,
  updatePronoun,
  deletePronoun,
  reorderPronouns,
  type Pronoun,
} from "@/lib/api";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Sortable Row Component
function SortableRow({
  pronoun,
  onToggle,
  onEdit,
  onDelete,
}: {
  pronoun: Pronoun;
  onToggle: (p: Pronoun) => void;
  onEdit: (p: Pronoun) => void;
  onDelete: (p: Pronoun) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pronoun.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
    position: "relative" as const, // Fix for type issue
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell>
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      </TableCell>
      <TableCell className="font-medium">{pronoun.label}</TableCell>
      <TableCell>
        <Badge variant={pronoun.is_active ? "default" : "secondary"}>
          {pronoun.is_active ? "Active" : "Inactive"}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggle(pronoun)}
            title={pronoun.is_active ? "Hide" : "Show"}
          >
            {pronoun.is_active ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onEdit(pronoun)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(pronoun)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function PronounsPage() {
  const [pronouns, setPronouns] = useState<Pronoun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingPronoun, setEditingPronoun] = useState<Pronoun | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    label: "",
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load pronouns on mount
  useEffect(() => {
    loadPronouns();
  }, []);

  const loadPronouns = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPronouns();
      // Ensure specific order if display_order is available
      const sorted = [...data].sort(
        (a, b) => a.display_order - b.display_order
      );
      setPronouns(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pronouns");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingPronoun(null);
    setFormData({ label: "" });
    setIsSheetOpen(true);
  };

  const handleEdit = (pronoun: Pronoun) => {
    setEditingPronoun(pronoun);
    setFormData({
      label: pronoun.label,
    });
    setIsSheetOpen(true);
  };

  const handleToggleActive = async (pronoun: Pronoun) => {
    try {
      await updatePronoun(pronoun.id, { is_active: !pronoun.is_active });
      setPronouns(
        pronouns.map((p) =>
          p.id === pronoun.id ? { ...p, is_active: !p.is_active } : p
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update pronoun");
    }
  };

  const handleDelete = async (pronoun: Pronoun) => {
    if (!confirm(`Are you sure you want to delete "${pronoun.label}"?`)) {
      return;
    }

    try {
      await deletePronoun(pronoun.id);
      setPronouns(pronouns.filter((p) => p.id !== pronoun.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete pronoun");
    }
  };

  const handleSave = async () => {
    if (!formData.label.trim()) {
      alert("Label is required");
      return;
    }

    setSaving(true);
    try {
      if (editingPronoun) {
        // Update existing
        const updated = await updatePronoun(editingPronoun.id, {
          label: formData.label.trim(),
        });
        setPronouns(
          pronouns.map((p) => (p.id === editingPronoun.id ? updated : p))
        );
      } else {
        // Create new (append to end)
        const maxOrder = Math.max(0, ...pronouns.map((p) => p.display_order));
        const created = await createPronoun({
          label: formData.label.trim(),
          display_order: maxOrder + 1,
        });
        setPronouns([...pronouns, created]);
      }
      setIsSheetOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save pronoun");
    } finally {
      setSaving(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setPronouns((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        const newItems = arrayMove(items, oldIndex, newIndex);

        // Update Backend
        const updates = newItems.map((item, index) => ({
          id: item.id,
          display_order: index + 1,
        }));

        // Fire and forget (optimistic update)
        reorderPronouns(updates).catch((err) => {
          console.error("Failed to reorder:", err);
          // Revert on error? For now, just alert
          alert("Failed to save new order");
          loadPronouns(); // Reload to reset
        });

        return newItems;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pronouns</h1>
          <p className="text-muted-foreground">
            Manage pronouns available for user profiles
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadPronouns} disabled={loading}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <Button onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add Pronoun
            </Button>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>
                  {editingPronoun ? "Edit Pronoun" : "Add Pronoun"}
                </SheetTitle>
                <SheetDescription>
                  {editingPronoun
                    ? "Update the pronoun details below."
                    : "Create a new pronoun option."}
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 py-6">
                <div className="grid gap-2">
                  <Label htmlFor="label">Label *</Label>
                  <Input
                    id="label"
                    placeholder="e.g., He/Him"
                    value={formData.label}
                    onChange={(e) =>
                      setFormData({ ...formData, label: e.target.value })
                    }
                  />
                </div>
              </div>
              <SheetFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsSheetOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!formData.label.trim() || saving}
                >
                  {saving ? "Saving..." : editingPronoun ? "Update" : "Create"}
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
          <Button
            variant="link"
            className="ml-2 text-destructive"
            onClick={loadPronouns}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Pronouns Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Pronouns</CardTitle>
          <CardDescription>
            {pronouns.filter((p) => p.is_active).length} active,{" "}
            {pronouns.filter((p) => !p.is_active).length} inactive. Drag handles
            to reorder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pronouns.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              No pronouns found. Create your first pronoun!
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <SortableContext
                    items={pronouns.map((p) => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {pronouns.map((pronoun) => (
                      <SortableRow
                        key={pronoun.id}
                        pronoun={pronoun}
                        onToggle={handleToggleActive}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                  </SortableContext>
                </TableBody>
              </Table>
            </DndContext>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
