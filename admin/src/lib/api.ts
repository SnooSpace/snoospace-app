/**
 * Admin Panel API Client
 * Handles communication with the SnooSpace backend
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Get auth token from localStorage
function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_token");
}

// Make authenticated API request
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "API request failed");
  }

  return data;
}

// ============================================
// CATEGORY API
// ============================================

export interface Category {
  id: number;
  name: string;
  slug: string;
  icon_name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  visible_from: string | null;
  visible_until: string | null;
  created_at: string;
  updated_at: string;
  event_count?: number;
}

export interface CategoryResponse {
  success: boolean;
  categories: Category[];
}

export interface SingleCategoryResponse {
  success: boolean;
  category: Category;
}

// Get all categories (admin view - includes inactive)
export async function getCategories(): Promise<Category[]> {
  const data = await apiRequest<CategoryResponse>("/admin/categories");
  return data.categories;
}

// Create a new category
export async function createCategory(category: {
  name: string;
  slug?: string;
  icon_name?: string;
  description?: string;
  display_order?: number;
  is_active?: boolean;
}): Promise<Category> {
  const data = await apiRequest<SingleCategoryResponse>("/admin/categories", {
    method: "POST",
    body: JSON.stringify({
      ...category,
      slug:
        category.slug ||
        category.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    }),
  });
  return data.category;
}

// Update a category
export async function updateCategory(
  id: number,
  updates: Partial<Category>
): Promise<Category> {
  const data = await apiRequest<SingleCategoryResponse>(
    `/admin/categories/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(updates),
    }
  );
  return data.category;
}

// Delete a category
export async function deleteCategory(id: number): Promise<void> {
  await apiRequest(`/admin/categories/${id}`, {
    method: "DELETE",
  });
}

// Reorder categories
export async function reorderCategories(
  order: { id: number; display_order: number }[]
): Promise<void> {
  await apiRequest("/admin/categories/reorder", {
    method: "POST",
    body: JSON.stringify({ order }),
  });
}

// ============================================
// INTEREST API
// ============================================

export interface Interest {
  id: number;
  label: string;
  icon_name: string | null;
  display_order: number;
  is_active: boolean;
  user_type: string;
  created_at: string;
}

export interface InterestResponse {
  success: boolean;
  interests: Interest[];
}

// Get all interests (admin view)
export async function getInterests(): Promise<Interest[]> {
  const data = await apiRequest<InterestResponse>("/admin/interests");
  return data.interests;
}

// Create interest
export async function createInterest(interest: {
  label: string;
  icon_name?: string;
  display_order?: number;
  user_type?: string;
}): Promise<Interest> {
  const data = await apiRequest<{ success: boolean; interest: Interest }>(
    "/admin/interests",
    {
      method: "POST",
      body: JSON.stringify(interest),
    }
  );
  return data.interest;
}

// Update interest
export async function updateInterest(
  id: number,
  updates: Partial<Interest>
): Promise<Interest> {
  const data = await apiRequest<{ success: boolean; interest: Interest }>(
    `/admin/interests/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(updates),
    }
  );
  return data.interest;
}

// Delete interest
export async function deleteInterest(id: number): Promise<void> {
  await apiRequest(`/admin/interests/${id}`, {
    method: "DELETE",
  });
}
