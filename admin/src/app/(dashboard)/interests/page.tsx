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
  getInterests,
  createInterest,
  updateInterest,
  deleteInterest,
  type Interest,
} from "@/lib/api";

export default function InterestsPage() {
  const [interests, setInterests] = useState<Interest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingInterest, setEditingInterest] = useState<Interest | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    label: "",
    icon_name: "",
    user_type: "all",
  });

  // Load interests on mount
  useEffect(() => {
    loadInterests();
  }, []);

  const loadInterests = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getInterests();
      setInterests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load interests");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingInterest(null);
    setFormData({ label: "", icon_name: "", user_type: "all" });
    setIsSheetOpen(true);
  };

  const handleEdit = (interest: Interest) => {
    setEditingInterest(interest);
    setFormData({
      label: interest.label,
      icon_name: interest.icon_name || "",
      user_type: interest.user_type || "all",
    });
    setIsSheetOpen(true);
  };

  const handleToggleActive = async (interest: Interest) => {
    try {
      await updateInterest(interest.id, { is_active: !interest.is_active });
      setInterests(
        interests.map((i) =>
          i.id === interest.id ? { ...i, is_active: !i.is_active } : i
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update interest");
    }
  };

  const handleDelete = async (interest: Interest) => {
    if (!confirm(`Are you sure you want to delete "${interest.label}"?`)) {
      return;
    }

    try {
      await deleteInterest(interest.id);
      setInterests(interests.filter((i) => i.id !== interest.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete interest");
    }
  };

  const handleSave = async () => {
    if (!formData.label.trim()) {
      alert("Label is required");
      return;
    }

    setSaving(true);
    try {
      if (editingInterest) {
        // Update existing
        const updated = await updateInterest(editingInterest.id, {
          label: formData.label.trim(),
          icon_name: formData.icon_name.trim() || null,
          user_type: formData.user_type,
        });
        setInterests(
          interests.map((i) => (i.id === editingInterest.id ? updated : i))
        );
      } else {
        // Create new
        const created = await createInterest({
          label: formData.label.trim(),
          icon_name: formData.icon_name.trim() || undefined,
          user_type: formData.user_type,
          display_order: interests.length + 1,
        });
        setInterests([...interests, created]);
      }
      setIsSheetOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save interest");
    } finally {
      setSaving(false);
    }
  };

  const getUserTypeLabel = (type: string) => {
    switch (type) {
      case "member":
        return "Members Only";
      case "community":
        return "Communities Only";
      default:
        return "All Users";
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
          <h1 className="text-3xl font-bold tracking-tight">
            Signup Interests
          </h1>
          <p className="text-muted-foreground">
            Manage interests that users can select during signup
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadInterests} disabled={loading}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <Button onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add Interest
            </Button>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>
                  {editingInterest ? "Edit Interest" : "Add Interest"}
                </SheetTitle>
                <SheetDescription>
                  {editingInterest
                    ? "Update the interest details below."
                    : "Create a new signup interest."}
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 py-6">
                <div className="grid gap-2">
                  <Label htmlFor="label">Label *</Label>
                  <Input
                    id="label"
                    placeholder="e.g., Technology"
                    value={formData.label}
                    onChange={(e) =>
                      setFormData({ ...formData, label: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="icon">Icon Name (Ionicons)</Label>
                  <Input
                    id="icon"
                    placeholder="laptop-outline"
                    value={formData.icon_name}
                    onChange={(e) =>
                      setFormData({ ...formData, icon_name: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Use Ionicons names from ionicons.com
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="user_type">User Type</Label>
                  <select
                    id="user_type"
                    value={formData.user_type}
                    onChange={(e) =>
                      setFormData({ ...formData, user_type: e.target.value })
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="all">All Users</option>
                    <option value="member">Members Only</option>
                    <option value="community">Communities Only</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Which user types will see this interest during signup
                  </p>
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
                  {saving ? "Saving..." : editingInterest ? "Update" : "Create"}
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
            onClick={loadInterests}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Interests Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Interests</CardTitle>
          <CardDescription>
            {interests.filter((i) => i.is_active).length} active,{" "}
            {interests.filter((i) => !i.is_active).length} inactive
          </CardDescription>
        </CardHeader>
        <CardContent>
          {interests.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              No interests yet. Create your first interest!
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Icon</TableHead>
                  <TableHead>User Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {interests.map((interest) => (
                  <TableRow key={interest.id}>
                    <TableCell>
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    </TableCell>
                    <TableCell className="font-medium">
                      {interest.label}
                    </TableCell>
                    <TableCell>
                      {interest.icon_name ? (
                        <code className="rounded bg-muted px-2 py-1 text-xs">
                          {interest.icon_name}
                        </code>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {getUserTypeLabel(interest.user_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={interest.is_active ? "default" : "secondary"}
                      >
                        {interest.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleActive(interest)}
                          title={interest.is_active ? "Hide" : "Show"}
                        >
                          {interest.is_active ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(interest)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(interest)}
                          className="text-destructive hover:text-destructive"
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
    </div>
  );
}
