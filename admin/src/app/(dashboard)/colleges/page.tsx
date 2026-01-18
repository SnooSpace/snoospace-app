"use client";

import { useState, useEffect } from "react";
import { ImageCropper } from "@/components/ui/image-cropper";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Building2,
  MapPin,
  CheckCircle,
  Clock,
  Upload,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  getColleges,
  createCollege,
  updateCollege,
  deleteCollege,
  getCampuses,
  createCampus,
  updateCampus,
  deleteCampus,
  uploadCollegeLogo,
  type College,
  type Campus,
} from "@/lib/api";

export default function CollegesPage() {
  const [colleges, setColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "approved"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  // College sheet
  const [isCollegeSheetOpen, setIsCollegeSheetOpen] = useState(false);
  const [editingCollege, setEditingCollege] = useState<College | null>(null);
  const [collegeForm, setCollegeForm] = useState({
    name: "",
    abbreviation: "",
    website: "",
    logo_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Cropper state
  const [cropperOpen, setCropperOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);

  // File upload - opens cropper first
  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB");
      return;
    }

    // Convert to base64 and open cropper
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });

    setImageToCrop(base64);
    setCropperOpen(true);

    // Reset file input so the same file can be selected again
    e.target.value = "";
  };

  // Handle cropped image upload
  const handleCroppedImage = async (croppedBase64: string) => {
    setCropperOpen(false);
    setImageToCrop(null);
    setUploadingLogo(true);

    try {
      const result = await uploadCollegeLogo(croppedBase64);
      setCollegeForm({ ...collegeForm, logo_url: result.data.url });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to upload logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleCropperClose = () => {
    setCropperOpen(false);
    setImageToCrop(null);
  };

  // Campus sheet
  const [isCampusSheetOpen, setIsCampusSheetOpen] = useState(false);
  const [editingCampus, setEditingCampus] = useState<Campus | null>(null);
  const [campusForCollege, setCampusForCollege] = useState<College | null>(
    null,
  );
  const [campusForm, setCampusForm] = useState({
    campus_name: "",
    city: "",
    state: "",
    area: "",
    address: "",
    location_url: "",
  });

  // Expanded colleges (for showing campuses)
  const [expandedColleges, setExpandedColleges] = useState<Set<string>>(
    new Set(),
  );
  const [campusesCache, setCampusesCache] = useState<Record<string, Campus[]>>(
    {},
  );
  const [loadingCampuses, setLoadingCampuses] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    loadColleges();
  }, [statusFilter]);

  const loadColleges = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getColleges({
        status: statusFilter,
        search: searchQuery || undefined,
      });
      setColleges(data.colleges);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load colleges");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadColleges();
  };

  const toggleExpanded = async (collegeId: string) => {
    const newExpanded = new Set(expandedColleges);
    if (newExpanded.has(collegeId)) {
      newExpanded.delete(collegeId);
    } else {
      newExpanded.add(collegeId);
      // Load campuses if not cached
      if (!campusesCache[collegeId]) {
        setLoadingCampuses((prev) => new Set(prev).add(collegeId));
        try {
          const data = await getCampuses(collegeId);
          setCampusesCache((prev) => ({ ...prev, [collegeId]: data.campuses }));
        } catch (err) {
          console.error("Failed to load campuses:", err);
        } finally {
          setLoadingCampuses((prev) => {
            const next = new Set(prev);
            next.delete(collegeId);
            return next;
          });
        }
      }
    }
    setExpandedColleges(newExpanded);
  };

  // College handlers
  const handleAddCollege = () => {
    setEditingCollege(null);
    setCollegeForm({ name: "", abbreviation: "", website: "", logo_url: "" });
    setIsCollegeSheetOpen(true);
  };

  const handleEditCollege = (college: College) => {
    setEditingCollege(college);
    setCollegeForm({
      name: college.name,
      abbreviation: college.abbreviation || "",
      website: college.website || "",
      logo_url: college.logo_url || "",
    });
    setIsCollegeSheetOpen(true);
  };

  const handleSaveCollege = async () => {
    if (!collegeForm.name.trim()) {
      alert("Name is required");
      return;
    }
    setSaving(true);
    try {
      if (editingCollege) {
        const result = await updateCollege(editingCollege.id, {
          name: collegeForm.name.trim(),
          abbreviation: collegeForm.abbreviation.trim() || null,
          website: collegeForm.website.trim() || null,
          logo_url: collegeForm.logo_url.trim() || null,
        });
        setColleges(
          colleges.map((c) =>
            c.id === editingCollege.id ? result.college : c,
          ),
        );
      } else {
        const result = await createCollege({
          name: collegeForm.name.trim(),
          abbreviation: collegeForm.abbreviation.trim() || undefined,
          website: collegeForm.website.trim() || undefined,
          logo_url: collegeForm.logo_url.trim() || undefined,
        });
        setColleges([...colleges, result.college]);
      }
      setIsCollegeSheetOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save college");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCollege = async (college: College) => {
    if (
      !confirm(`Delete "${college.name}"? This will also delete all campuses.`)
    )
      return;
    try {
      await deleteCollege(college.id);
      setColleges(colleges.filter((c) => c.id !== college.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete college");
    }
  };

  const handleApproveCollege = async (college: College) => {
    try {
      const result = await updateCollege(college.id, { status: "approved" });
      setColleges(
        colleges.map((c) => (c.id === college.id ? result.college : c)),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to approve college");
    }
  };

  // Campus handlers
  const handleAddCampus = (college: College) => {
    setEditingCampus(null);
    setCampusForCollege(college);
    setCampusForm({
      campus_name: "",
      city: "",
      state: "",
      area: "",
      address: "",
      location_url: "",
    });
    setIsCampusSheetOpen(true);
  };

  const handleEditCampus = (campus: Campus, college: College) => {
    setEditingCampus(campus);
    setCampusForCollege(college);
    setCampusForm({
      campus_name: campus.campus_name,
      city: campus.city,
      state: campus.state || "",
      area: campus.area || "",
      address: campus.address || "",
      location_url: campus.location_url || "",
    });
    setIsCampusSheetOpen(true);
  };

  const handleSaveCampus = async () => {
    if (!campusForm.campus_name.trim() || !campusForm.city.trim()) {
      alert("Campus name and city are required");
      return;
    }
    if (!campusForCollege) return;

    setSaving(true);
    try {
      if (editingCampus) {
        const result = await updateCampus(editingCampus.id, {
          campus_name: campusForm.campus_name.trim(),
          city: campusForm.city.trim(),
          state: campusForm.state.trim() || null,
          area: campusForm.area.trim() || null,
          address: campusForm.address.trim() || null,
          location_url: campusForm.location_url.trim() || null,
        });
        setCampusesCache((prev) => ({
          ...prev,
          [campusForCollege.id]: prev[campusForCollege.id].map((c) =>
            c.id === editingCampus.id ? result.campus : c,
          ),
        }));
      } else {
        const result = await createCampus({
          college_id: campusForCollege.id,
          campus_name: campusForm.campus_name.trim(),
          city: campusForm.city.trim(),
          state: campusForm.state.trim() || undefined,
          area: campusForm.area.trim() || undefined,
          address: campusForm.address.trim() || undefined,
          location_url: campusForm.location_url.trim() || undefined,
        });
        setCampusesCache((prev) => ({
          ...prev,
          [campusForCollege.id]: [
            ...(prev[campusForCollege.id] || []),
            result.campus,
          ],
        }));
        // Update campus count
        setColleges(
          colleges.map((c) =>
            c.id === campusForCollege.id
              ? { ...c, campus_count: c.campus_count + 1 }
              : c,
          ),
        );
      }
      setIsCampusSheetOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save campus");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCampus = async (campus: Campus, college: College) => {
    if (!confirm(`Delete "${campus.campus_name}"?`)) return;
    try {
      await deleteCampus(campus.id);
      setCampusesCache((prev) => ({
        ...prev,
        [college.id]: prev[college.id].filter((c) => c.id !== campus.id),
      }));
      setColleges(
        colleges.map((c) =>
          c.id === college.id
            ? { ...c, campus_count: Math.max(0, c.campus_count - 1) }
            : c,
        ),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete campus");
    }
  };

  const handleActivateCampus = async (campus: Campus, college: College) => {
    try {
      const result = await updateCampus(campus.id, { status: "active" });
      setCampusesCache((prev) => ({
        ...prev,
        [college.id]: prev[college.id].map((c) =>
          c.id === campus.id ? result.campus : c,
        ),
      }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to activate campus");
    }
  };

  if (loading && colleges.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Colleges & Campuses
          </h1>
          <p className="text-muted-foreground">
            Manage colleges and their campus locations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadColleges} disabled={loading}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button onClick={handleAddCollege}>
            <Plus className="mr-2 h-4 w-4" />
            Add College
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search colleges..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>Search</Button>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
          <Button
            variant="link"
            className="ml-2 text-destructive"
            onClick={loadColleges}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Colleges List */}
      <Card>
        <CardHeader>
          <CardTitle>All Colleges</CardTitle>
          <CardDescription>
            {colleges.filter((c) => c.status === "approved").length} approved,{" "}
            {colleges.filter((c) => c.status === "pending").length} pending
          </CardDescription>
        </CardHeader>
        <CardContent>
          {colleges.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              No colleges found. Add your first college!
            </div>
          ) : (
            <div className="space-y-2">
              {colleges.map((college) => (
                <Collapsible
                  key={college.id}
                  open={expandedColleges.has(college.id)}
                  onOpenChange={() => toggleExpanded(college.id)}
                >
                  <div className="rounded-lg border">
                    {/* College Row */}
                    <div className="flex items-center gap-4 p-4">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          {expandedColleges.has(college.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{college.name}</span>
                          {college.abbreviation && (
                            <Badge variant="outline">
                              {college.abbreviation}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {college.campus_count} campus
                          {college.campus_count !== 1 ? "es" : ""} ·{" "}
                          {college.community_count} communities
                        </div>
                      </div>
                      <Badge
                        variant={
                          college.status === "approved"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {college.status === "approved" ? (
                          <>
                            <CheckCircle className="mr-1 h-3 w-3" /> Approved
                          </>
                        ) : (
                          <>
                            <Clock className="mr-1 h-3 w-3" /> Pending
                          </>
                        )}
                      </Badge>
                      <div className="flex gap-1">
                        {college.status === "pending" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleApproveCollege(college)}
                          >
                            Approve
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditCollege(college)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDeleteCollege(college)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Campuses */}
                    <CollapsibleContent>
                      <div className="border-t bg-muted/30 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="text-sm font-medium">Campuses</h4>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAddCampus(college)}
                          >
                            <Plus className="mr-1 h-3 w-3" /> Add Campus
                          </Button>
                        </div>
                        {loadingCampuses.has(college.id) ? (
                          <div className="py-4 text-center text-muted-foreground">
                            Loading...
                          </div>
                        ) : campusesCache[college.id]?.length === 0 ? (
                          <div className="py-4 text-center text-muted-foreground">
                            No campuses yet
                          </div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Campus Name</TableHead>
                                <TableHead>City</TableHead>
                                <TableHead>Area</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Communities</TableHead>
                                <TableHead className="text-right">
                                  Actions
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {campusesCache[college.id]?.map((campus) => (
                                <TableRow key={campus.id}>
                                  <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                      <MapPin className="h-4 w-4 text-muted-foreground" />
                                      {campus.campus_name}
                                    </div>
                                  </TableCell>
                                  <TableCell>{campus.city}</TableCell>
                                  <TableCell>{campus.area || "—"}</TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={
                                        campus.status === "active"
                                          ? "default"
                                          : "secondary"
                                      }
                                    >
                                      {campus.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {campus.community_count}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                      {campus.status === "pending" && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            handleActivateCampus(
                                              campus,
                                              college,
                                            )
                                          }
                                        >
                                          Activate
                                        </Button>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() =>
                                          handleEditCampus(campus, college)
                                        }
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive"
                                        onClick={() =>
                                          handleDeleteCampus(campus, college)
                                        }
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
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* College Sheet */}
      <Sheet open={isCollegeSheetOpen} onOpenChange={setIsCollegeSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {editingCollege ? "Edit College" : "Add College"}
            </SheetTitle>
            <SheetDescription>
              {editingCollege
                ? "Update college details"
                : "Add a new college to the system"}
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 px-4 py-6">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="e.g., VIT University"
                value={collegeForm.name}
                onChange={(e) =>
                  setCollegeForm({ ...collegeForm, name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="abbreviation">Abbreviation</Label>
              <Input
                id="abbreviation"
                placeholder="e.g., VIT"
                value={collegeForm.abbreviation}
                onChange={(e) =>
                  setCollegeForm({
                    ...collegeForm,
                    abbreviation: e.target.value,
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                placeholder="https://www.vit.ac.in"
                value={collegeForm.website}
                onChange={(e) =>
                  setCollegeForm({ ...collegeForm, website: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Logo</Label>
              {collegeForm.logo_url ? (
                <div className="relative inline-block">
                  <img
                    src={collegeForm.logo_url}
                    alt="College logo"
                    className="h-24 w-24 rounded-lg border object-cover"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -right-2 -top-2 h-6 w-6"
                    onClick={() =>
                      setCollegeForm({ ...collegeForm, logo_url: "" })
                    }
                    type="button"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    id="logo-upload"
                    className="hidden"
                    onChange={handleLogoSelect}
                    disabled={uploadingLogo}
                  />
                  <label htmlFor="logo-upload">
                    <Button
                      variant="outline"
                      className="cursor-pointer"
                      disabled={uploadingLogo}
                      asChild
                    >
                      <span>
                        <Upload className="mr-2 h-4 w-4" />
                        {uploadingLogo ? "Uploading..." : "Upload Logo"}
                      </span>
                    </Button>
                  </label>
                </div>
              )}
            </div>
          </div>
          <SheetFooter className="px-4 pb-4">
            <Button
              variant="outline"
              onClick={() => setIsCollegeSheetOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveCollege}
              disabled={
                !collegeForm.name.trim() ||
                saving ||
                !!(
                  editingCollege &&
                  collegeForm.name === editingCollege.name &&
                  collegeForm.abbreviation ===
                    (editingCollege.abbreviation || "") &&
                  collegeForm.website === (editingCollege.website || "") &&
                  collegeForm.logo_url === (editingCollege.logo_url || "")
                )
              }
            >
              {saving ? "Saving..." : editingCollege ? "Update" : "Create"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Campus Sheet */}
      <Sheet open={isCampusSheetOpen} onOpenChange={setIsCampusSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {editingCampus ? "Edit Campus" : "Add Campus"}
            </SheetTitle>
            <SheetDescription>
              {campusForCollege
                ? `Campus for ${campusForCollege.name}`
                : "Add a new campus"}
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 py-6">
            <div className="grid gap-2">
              <Label htmlFor="campus_name">Campus Name *</Label>
              <Input
                id="campus_name"
                placeholder="e.g., Vellore Campus"
                value={campusForm.campus_name}
                onChange={(e) =>
                  setCampusForm({ ...campusForm, campus_name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                placeholder="e.g., Vellore"
                value={campusForm.city}
                onChange={(e) =>
                  setCampusForm({ ...campusForm, city: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                placeholder="e.g., Tamil Nadu"
                value={campusForm.state}
                onChange={(e) =>
                  setCampusForm({ ...campusForm, state: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="area">Area (Optional)</Label>
              <Input
                id="area"
                placeholder="e.g., Katpadi"
                value={campusForm.area}
                onChange={(e) =>
                  setCampusForm({ ...campusForm, area: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Address (Optional)</Label>
              <Input
                id="address"
                placeholder="Full address"
                value={campusForm.address}
                onChange={(e) =>
                  setCampusForm({ ...campusForm, address: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="location_url">Location URL</Label>
              <Input
                id="location_url"
                placeholder="Google Maps URL"
                value={campusForm.location_url}
                onChange={(e) =>
                  setCampusForm({ ...campusForm, location_url: e.target.value })
                }
              />
            </div>
          </div>
          <SheetFooter>
            <Button
              variant="outline"
              onClick={() => setIsCampusSheetOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveCampus}
              disabled={
                !campusForm.campus_name.trim() ||
                !campusForm.city.trim() ||
                saving
              }
            >
              {saving ? "Saving..." : editingCampus ? "Update" : "Create"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Image Cropper Modal */}
      {imageToCrop && (
        <ImageCropper
          imageSrc={imageToCrop}
          open={cropperOpen}
          onClose={handleCropperClose}
          onCropComplete={handleCroppedImage}
          aspectRatio={1}
          cropShape="rect"
        />
      )}
    </div>
  );
}
