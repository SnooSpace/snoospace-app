"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Check,
  X,
  GripVertical,
  Eye,
  EyeOff,
  Users,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  getSponsorTypes,
  createSponsorType,
  updateSponsorType,
  deleteSponsorType,
  type SponsorType,
} from "@/lib/api";

export default function SponsorTypesPage() {
  const [sponsorTypes, setSponsorTypes] = useState<SponsorType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<SponsorType | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);

  useEffect(() => {
    loadSponsorTypes();
  }, []);

  const loadSponsorTypes = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSponsorTypes();
      setSponsorTypes(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load sponsor types"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setFormName("");
    setFormIsActive(true);
    setIsAddDialogOpen(true);
  };

  const handleEdit = (type: SponsorType) => {
    setSelectedType(type);
    setFormName(type.name);
    setFormIsActive(type.is_active);
    setIsEditDialogOpen(true);
  };

  const handleSubmitAdd = async () => {
    if (!formName.trim()) {
      alert("Name is required");
      return;
    }
    setFormSubmitting(true);
    try {
      await createSponsorType({
        name: formName.trim(),
        is_active: formIsActive,
      });
      setIsAddDialogOpen(false);
      loadSponsorTypes();
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to create sponsor type"
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleSubmitEdit = async () => {
    if (!selectedType || !formName.trim()) return;
    setFormSubmitting(true);
    try {
      await updateSponsorType(selectedType.id, {
        name: formName.trim(),
        is_active: formIsActive,
      });
      setIsEditDialogOpen(false);
      loadSponsorTypes();
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to update sponsor type"
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleActive = async (type: SponsorType) => {
    try {
      await updateSponsorType(type.id, { is_active: !type.is_active });
      loadSponsorTypes();
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to update sponsor type"
      );
    }
  };

  const handleDelete = async (type: SponsorType) => {
    if (
      !confirm(
        `Are you sure you want to delete "${type.name}"? This cannot be undone.`
      )
    ) {
      return;
    }
    try {
      await deleteSponsorType(type.id);
      loadSponsorTypes();
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to delete sponsor type"
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sponsor Types</h1>
          <p className="text-muted-foreground">
            Manage sponsor types that communities can select
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={loadSponsorTypes}
            variant="outline"
            disabled={loading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Type
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Sponsor Types</CardTitle>
          <CardDescription>
            {sponsorTypes.length} sponsor types configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">{error}</div>
          ) : sponsorTypes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No sponsor types found. Add your first one!
            </div>
          ) : (
            <div className="space-y-2">
              {sponsorTypes.map((type) => (
                <div
                  key={type.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    !type.is_active ? "opacity-50 bg-muted/30" : "bg-card"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                    <div>
                      <div className="font-medium">{type.name}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Users className="h-3 w-3" />
                        {type.usage_count || 0} communities
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={type.is_active ? "default" : "secondary"}>
                      {type.is_active ? "Active" : "Hidden"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleActive(type)}
                      title={type.is_active ? "Hide" : "Show"}
                    >
                      {type.is_active ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(type)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(type)}
                      disabled={(type.usage_count || 0) > 0}
                      title={
                        (type.usage_count || 0) > 0
                          ? "Cannot delete: used by communities"
                          : "Delete"
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Sponsor Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g., Energy Drinks"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="active"
                checked={formIsActive}
                onCheckedChange={setFormIsActive}
              />
              <Label htmlFor="active">Active (visible to users)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddDialogOpen(false)}
              disabled={formSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmitAdd} disabled={formSubmitting}>
              {formSubmitting ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sponsor Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="edit-active"
                checked={formIsActive}
                onCheckedChange={setFormIsActive}
              />
              <Label htmlFor="edit-active">Active (visible to users)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={formSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmitEdit} disabled={formSubmitting}>
              {formSubmitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
