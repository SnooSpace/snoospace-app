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
  Check,
  X,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getCommunityCategories,
  createCommunityCategory,
  updateCommunityCategory,
  deleteCommunityCategory,
  type Category,
  type CommunityCategory,
} from "@/lib/api";

export default function CategoriesPage() {
  // Discover Categories State
  const [categories, setCategories] = useState<Category[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(true);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [isDiscoverSheetOpen, setIsDiscoverSheetOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [discoverFormData, setDiscoverFormData] = useState({
    name: "",
    slug: "",
    icon_name: "",
    description: "",
  });

  // Community Categories State
  const [communityCategories, setCommunityCategories] = useState<
    CommunityCategory[]
  >([]);
  const [communityCounts, setCommunityCounts] = useState({
    approved: 0,
    pending: 0,
    rejected: 0,
  });
  const [communityLoading, setCommunityLoading] = useState(true);
  const [communityError, setCommunityError] = useState<string | null>(null);
  const [isCommunitySheetOpen, setIsCommunitySheetOpen] = useState(false);
  const [editingCommunityCategory, setEditingCommunityCategory] =
    useState<CommunityCategory | null>(null);
  const [communityFormData, setCommunityFormData] = useState({ name: "" });

  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("discover");

  // Load data on mount
  useEffect(() => {
    loadDiscoverCategories();
    loadCommunityCategories();
  }, []);

  // ==========================================
  // DISCOVER CATEGORIES FUNCTIONS
  // ==========================================

  const loadDiscoverCategories = async () => {
    setDiscoverLoading(true);
    setDiscoverError(null);
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (err) {
      setDiscoverError(
        err instanceof Error ? err.message : "Failed to load categories",
      );
    } finally {
      setDiscoverLoading(false);
    }
  };

  const handleDiscoverAdd = () => {
    setEditingCategory(null);
    setDiscoverFormData({ name: "", slug: "", icon_name: "", description: "" });
    setIsDiscoverSheetOpen(true);
  };

  const handleDiscoverEdit = (category: Category) => {
    setEditingCategory(category);
    setDiscoverFormData({
      name: category.name,
      slug: category.slug,
      icon_name: category.icon_name || "",
      description: category.description || "",
    });
    setIsDiscoverSheetOpen(true);
  };

  const handleDiscoverToggleActive = async (category: Category) => {
    try {
      await updateCategory(category.id, { is_active: !category.is_active });
      setCategories(
        categories.map((cat) =>
          cat.id === category.id ? { ...cat, is_active: !cat.is_active } : cat,
        ),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update category");
    }
  };

  const handleDiscoverDelete = async (category: Category) => {
    if (!confirm(`Are you sure you want to delete "${category.name}"?`)) return;
    try {
      await deleteCategory(category.id);
      setCategories(categories.filter((cat) => cat.id !== category.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete category");
    }
  };

  const handleDiscoverSave = async () => {
    if (!discoverFormData.name.trim()) {
      alert("Name is required");
      return;
    }
    setSaving(true);
    try {
      if (editingCategory) {
        const updated = await updateCategory(editingCategory.id, {
          name: discoverFormData.name.trim(),
          slug:
            discoverFormData.slug.trim() || generateSlug(discoverFormData.name),
          icon_name: discoverFormData.icon_name.trim() || undefined,
          description: discoverFormData.description.trim() || undefined,
        });
        setCategories(
          categories.map((cat) =>
            cat.id === editingCategory.id ? updated : cat,
          ),
        );
      } else {
        const created = await createCategory({
          name: discoverFormData.name.trim(),
          slug: discoverFormData.slug.trim() || undefined,
          icon_name: discoverFormData.icon_name.trim() || undefined,
          description: discoverFormData.description.trim() || undefined,
          display_order: categories.length + 1,
        });
        setCategories([...categories, created]);
      }
      setIsDiscoverSheetOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // COMMUNITY CATEGORIES FUNCTIONS
  // ==========================================

  const loadCommunityCategories = async () => {
    setCommunityLoading(true);
    setCommunityError(null);
    try {
      const data = await getCommunityCategories();
      setCommunityCategories(data.categories);
      setCommunityCounts(data.counts);
    } catch (err) {
      setCommunityError(
        err instanceof Error
          ? err.message
          : "Failed to load community categories",
      );
    } finally {
      setCommunityLoading(false);
    }
  };

  const handleCommunityAdd = () => {
    setEditingCommunityCategory(null);
    setCommunityFormData({ name: "" });
    setIsCommunitySheetOpen(true);
  };

  const handleCommunityEdit = (category: CommunityCategory) => {
    setEditingCommunityCategory(category);
    setCommunityFormData({ name: category.name });
    setIsCommunitySheetOpen(true);
  };

  const handleCommunityApprove = async (category: CommunityCategory) => {
    try {
      const updated = await updateCommunityCategory(category.id, {
        status: "approved",
      });
      setCommunityCategories(
        communityCategories.map((c) => (c.id === category.id ? updated : c)),
      );
      setCommunityCounts({
        ...communityCounts,
        approved: communityCounts.approved + 1,
        pending: communityCounts.pending - 1,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to approve category");
    }
  };

  const handleCommunityReject = async (category: CommunityCategory) => {
    try {
      const updated = await updateCommunityCategory(category.id, {
        status: "rejected",
      });
      setCommunityCategories(
        communityCategories.map((c) => (c.id === category.id ? updated : c)),
      );
      setCommunityCounts({
        ...communityCounts,
        rejected: communityCounts.rejected + 1,
        pending: communityCounts.pending - 1,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reject category");
    }
  };

  const handleCommunityToggleActive = async (category: CommunityCategory) => {
    try {
      const updated = await updateCommunityCategory(category.id, {
        is_active: !category.is_active,
      });
      setCommunityCategories(
        communityCategories.map((c) => (c.id === category.id ? updated : c)),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to toggle category");
    }
  };

  const handleCommunityDelete = async (category: CommunityCategory) => {
    if (!confirm(`Are you sure you want to delete "${category.name}"?`)) return;
    try {
      await deleteCommunityCategory(category.id);
      setCommunityCategories(
        communityCategories.filter((c) => c.id !== category.id),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete category");
    }
  };

  const handleCommunitySave = async () => {
    if (!communityFormData.name.trim()) {
      alert("Name is required");
      return;
    }
    setSaving(true);
    try {
      if (editingCommunityCategory) {
        const updated = await updateCommunityCategory(
          editingCommunityCategory.id,
          { name: communityFormData.name.trim() },
        );
        setCommunityCategories(
          communityCategories.map((c) =>
            c.id === editingCommunityCategory.id ? updated : c,
          ),
        );
      } else {
        const created = await createCommunityCategory({
          name: communityFormData.name.trim(),
        });
        setCommunityCategories([...communityCategories, created]);
        setCommunityCounts({
          ...communityCounts,
          approved: communityCounts.approved + 1,
        });
      }
      setIsCommunitySheetOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  if (discoverLoading && communityLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
        <p className="text-muted-foreground">
          Manage Discover and Community categories
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="discover">Discover Categories</TabsTrigger>
          <TabsTrigger value="community">
            Community Categories
            {communityCounts.pending > 0 && (
              <Badge variant="destructive" className="ml-2">
                {communityCounts.pending}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ==========================================
            DISCOVER CATEGORIES TAB
        ========================================== */}
        <TabsContent value="discover" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Categories that appear on the Discover feed
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={loadDiscoverCategories}
                disabled={discoverLoading}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${discoverLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              <Sheet
                open={isDiscoverSheetOpen}
                onOpenChange={setIsDiscoverSheetOpen}
              >
                <Button onClick={handleDiscoverAdd}>
                  <Plus className="mr-2 h-4 w-4" /> Add Category
                </Button>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>
                      {editingCategory ? "Edit Category" : "Add Category"}
                    </SheetTitle>
                    <SheetDescription>
                      {editingCategory
                        ? "Update the category details below."
                        : "Create a new discover category."}
                    </SheetDescription>
                  </SheetHeader>
                  <div className="grid gap-4 py-6">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        placeholder="e.g., Music Events"
                        value={discoverFormData.name}
                        onChange={(e) =>
                          setDiscoverFormData({
                            ...discoverFormData,
                            name: e.target.value,
                            slug: editingCategory
                              ? discoverFormData.slug
                              : generateSlug(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="slug">Slug</Label>
                      <Input
                        id="slug"
                        placeholder="music-events"
                        value={discoverFormData.slug}
                        onChange={(e) =>
                          setDiscoverFormData({
                            ...discoverFormData,
                            slug: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="icon">Icon Name (Ionicons)</Label>
                      <Input
                        id="icon"
                        placeholder="musical-notes-outline"
                        value={discoverFormData.icon_name}
                        onChange={(e) =>
                          setDiscoverFormData({
                            ...discoverFormData,
                            icon_name: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="description">Description</Label>
                      <Input
                        id="description"
                        placeholder="Optional description..."
                        value={discoverFormData.description}
                        onChange={(e) =>
                          setDiscoverFormData({
                            ...discoverFormData,
                            description: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <SheetFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsDiscoverSheetOpen(false)}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleDiscoverSave}
                      disabled={!discoverFormData.name.trim() || saving}
                    >
                      {saving
                        ? "Saving..."
                        : editingCategory
                          ? "Update"
                          : "Create"}
                    </Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          {discoverError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
              {discoverError}
              <Button
                variant="link"
                className="ml-2 text-destructive"
                onClick={loadDiscoverCategories}
              >
                Retry
              </Button>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>All Discover Categories</CardTitle>
              <CardDescription>
                {categories.filter((c) => c.is_active).length} active,{" "}
                {categories.filter((c) => !c.is_active).length} inactive
              </CardDescription>
            </CardHeader>
            <CardContent>
              {categories.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  No categories yet. Create your first category!
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Icon</TableHead>
                      <TableHead>Events</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell>
                          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                        </TableCell>
                        <TableCell className="font-medium">
                          {category.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {category.slug}
                        </TableCell>
                        <TableCell>
                          {category.icon_name ? (
                            <code className="rounded bg-muted px-2 py-1 text-xs">
                              {category.icon_name}
                            </code>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {category.event_count || 0}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              category.is_active ? "default" : "secondary"
                            }
                          >
                            {category.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                handleDiscoverToggleActive(category)
                              }
                              title={category.is_active ? "Hide" : "Show"}
                            >
                              {category.is_active ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDiscoverEdit(category)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDiscoverDelete(category)}
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
        </TabsContent>

        {/* ==========================================
            COMMUNITY CATEGORIES TAB
        ========================================== */}
        <TabsContent value="community" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Categories for community signup ({communityCounts.approved}{" "}
              approved, {communityCounts.pending} pending)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={loadCommunityCategories}
                disabled={communityLoading}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${communityLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              <Sheet
                open={isCommunitySheetOpen}
                onOpenChange={setIsCommunitySheetOpen}
              >
                <Button onClick={handleCommunityAdd}>
                  <Plus className="mr-2 h-4 w-4" /> Add Category
                </Button>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>
                      {editingCommunityCategory
                        ? "Edit Category"
                        : "Add Category"}
                    </SheetTitle>
                    <SheetDescription>
                      {editingCommunityCategory
                        ? "Update the category name."
                        : "Create a new community category."}
                    </SheetDescription>
                  </SheetHeader>
                  <div className="grid gap-4 py-6">
                    <div className="grid gap-2">
                      <Label htmlFor="community-name">Name *</Label>
                      <Input
                        id="community-name"
                        placeholder="e.g., Photography"
                        value={communityFormData.name}
                        onChange={(e) =>
                          setCommunityFormData({ name: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <SheetFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsCommunitySheetOpen(false)}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCommunitySave}
                      disabled={!communityFormData.name.trim() || saving}
                    >
                      {saving
                        ? "Saving..."
                        : editingCommunityCategory
                          ? "Update"
                          : "Create"}
                    </Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          {communityError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
              {communityError}
              <Button
                variant="link"
                className="ml-2 text-destructive"
                onClick={loadCommunityCategories}
              >
                Retry
              </Button>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>All Community Categories</CardTitle>
              <CardDescription>
                Categories that communities can choose during signup
              </CardDescription>
            </CardHeader>
            <CardContent>
              {communityCategories.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  No community categories yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {communityCategories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell className="font-medium">
                          {category.name}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              category.status === "approved"
                                ? "default"
                                : category.status === "pending"
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {category.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              category.is_active ? "outline" : "secondary"
                            }
                          >
                            {category.is_active ? "Yes" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {category.status === "pending" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    handleCommunityApprove(category)
                                  }
                                  title="Approve"
                                  className="text-green-600 hover:text-green-600"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    handleCommunityReject(category)
                                  }
                                  title="Reject"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                handleCommunityToggleActive(category)
                              }
                              title={
                                category.is_active ? "Deactivate" : "Activate"
                              }
                            >
                              {category.is_active ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCommunityEdit(category)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCommunityDelete(category)}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
