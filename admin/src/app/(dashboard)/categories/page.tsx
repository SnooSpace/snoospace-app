"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, GripVertical, Eye, EyeOff } from "lucide-react";
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
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";

// Mock categories data (will be replaced with API calls)
const mockCategories = [
  {
    id: 1,
    name: "Christmas Parties",
    slug: "christmas-parties",
    icon_name: "gift-outline",
    display_order: 1,
    is_active: true,
  },
  {
    id: 2,
    name: "New Year Parties",
    slug: "new-year-parties",
    icon_name: "sparkles-outline",
    display_order: 2,
    is_active: true,
  },
  {
    id: 3,
    name: "Music Events",
    slug: "music-events",
    icon_name: "musical-notes-outline",
    display_order: 3,
    is_active: true,
  },
  {
    id: 4,
    name: "Food & Dining",
    slug: "food-dining",
    icon_name: "restaurant-outline",
    display_order: 4,
    is_active: true,
  },
  {
    id: 5,
    name: "Sports & Fitness",
    slug: "sports-fitness",
    icon_name: "fitness-outline",
    display_order: 5,
    is_active: true,
  },
  {
    id: 6,
    name: "Art & Culture",
    slug: "art-culture",
    icon_name: "color-palette-outline",
    display_order: 6,
    is_active: false,
  },
];

interface Category {
  id: number;
  name: string;
  slug: string;
  icon_name: string;
  display_order: number;
  is_active: boolean;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>(mockCategories);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    icon_name: "",
  });

  const handleAdd = () => {
    setEditingCategory(null);
    setFormData({ name: "", slug: "", icon_name: "" });
    setIsSheetOpen(true);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug,
      icon_name: category.icon_name,
    });
    setIsSheetOpen(true);
  };

  const handleToggleActive = (id: number) => {
    setCategories(
      categories.map((cat) =>
        cat.id === id ? { ...cat, is_active: !cat.is_active } : cat
      )
    );
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this category?")) {
      setCategories(categories.filter((cat) => cat.id !== id));
    }
  };

  const handleSave = () => {
    if (editingCategory) {
      // Update existing
      setCategories(
        categories.map((cat) =>
          cat.id === editingCategory.id ? { ...cat, ...formData } : cat
        )
      );
    } else {
      // Add new
      const newCategory: Category = {
        id: Math.max(...categories.map((c) => c.id)) + 1,
        name: formData.name,
        slug: formData.slug || formData.name.toLowerCase().replace(/\s+/g, "-"),
        icon_name: formData.icon_name || "pricetags-outline",
        display_order: categories.length + 1,
        is_active: true,
      };
      setCategories([...categories, newCategory]);
    }
    setIsSheetOpen(false);
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Discover Categories
          </h1>
          <p className="text-muted-foreground">
            Manage categories that appear on the Discover feed
          </p>
        </div>
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add Category
            </Button>
          </SheetTrigger>
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
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Music Events"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      name: e.target.value,
                      slug: generateSlug(e.target.value),
                    });
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  placeholder="music-events"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="icon">Icon Name (Ionicons)</Label>
                <Input
                  id="icon"
                  placeholder="musical-notes-outline"
                  value={formData.icon_name}
                  onChange={(e) =>
                    setFormData({ ...formData, icon_name: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Use Ionicons names from ionicons.com
                </p>
              </div>
            </div>
            <SheetFooter>
              <Button variant="outline" onClick={() => setIsSheetOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!formData.name}>
                {editingCategory ? "Update" : "Create"}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* Categories Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Categories</CardTitle>
          <CardDescription>
            {categories.filter((c) => c.is_active).length} active,{" "}
            {categories.filter((c) => !c.is_active).length} inactive
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Icon</TableHead>
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
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {category.slug}
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-2 py-1 text-xs">
                      {category.icon_name}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={category.is_active ? "default" : "secondary"}
                    >
                      {category.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleActive(category.id)}
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
                        onClick={() => handleEdit(category)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(category.id)}
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
        </CardContent>
      </Card>
    </div>
  );
}
