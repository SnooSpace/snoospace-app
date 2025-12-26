/**
 * Admin Panel API Client
 * Handles communication with the SnooSpace backend
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
console.log("[API] API_URL:", API_URL, "env:", process.env.NEXT_PUBLIC_API_URL);

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

// ============================================
// USER API
// ============================================

export interface User {
  id: number;
  type: "member" | "community";
  name: string;
  username: string;
  email: string;
  phone: string | null;
  secondary_phone?: string | null;
  profile_photo_url: string | null;
  location: string | null;
  pronouns: string[] | null;
  bio: string | null;
  interests: string[] | null;
  category?: string | null;
  head1_name?: string | null;
  head1_phone?: string | null;
  head2_name?: string | null;
  head2_phone?: string | null;
  heads?: Array<{
    name: string;
    phone: string | null;
    profile_pic_url: string | null;
    is_primary: boolean;
  }>;
  is_active: boolean;
  created_at: string;
  follower_count: number;
  following_count?: number;
  post_count?: number;
}

export interface UsersResponse {
  success: boolean;
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface GetUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: "all" | "member" | "community";
  status?: "all" | "active" | "banned";
}

// Get all users with pagination and filters
export async function getUsers(
  params: GetUsersParams = {}
): Promise<UsersResponse> {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.set("page", params.page.toString());
  if (params.limit) queryParams.set("limit", params.limit.toString());
  if (params.search) queryParams.set("search", params.search);
  if (params.type) queryParams.set("type", params.type);
  if (params.status) queryParams.set("status", params.status);

  const queryString = queryParams.toString();
  const endpoint = `/admin/users${queryString ? `?${queryString}` : ""}`;

  return apiRequest<UsersResponse>(endpoint);
}

// Get single user by ID
export async function getUserById(
  id: number,
  type: "member" | "community"
): Promise<User> {
  const data = await apiRequest<{ success: boolean; user: User }>(
    `/admin/users/${id}?type=${type}`
  );
  return data.user;
}

// Update user (ban/unban)
export async function updateUser(
  id: number,
  type: "member" | "community",
  updates: { is_active: boolean }
): Promise<{ success: boolean; message: string }> {
  return apiRequest(`/admin/users/${id}?type=${type}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

// Delete user
export async function deleteUser(
  id: number,
  type: "member" | "community",
  hard: boolean = false
): Promise<{ success: boolean; message: string }> {
  return apiRequest(`/admin/users/${id}?type=${type}&hard=${hard}`, {
    method: "DELETE",
  });
}

// ============================================
// FOLLOWERS/FOLLOWING API
// ============================================

export interface FollowUser {
  id: number;
  follower_id?: number;
  follower_type?: string;
  following_id?: number;
  following_type?: string;
  follower_name?: string;
  follower_username?: string;
  follower_photo_url?: string;
  following_name?: string;
  following_username?: string;
  following_photo_url?: string;
  created_at: string;
}

// Get followers list for a user
export async function getFollowers(
  userId: number,
  userType: "member" | "community"
): Promise<{ followers: FollowUser[] }> {
  return apiRequest(`/followers/${userId}/${userType}`);
}

// Get following list for a user
export async function getFollowing(
  userId: number,
  userType: "member" | "community"
): Promise<{ following: FollowUser[] }> {
  return apiRequest(`/following/${userId}/${userType}`);
}

// ============================================
// POSTS API
// ============================================

export interface Post {
  id: number;
  author_id: number;
  author_type: "member" | "community" | "sponsor" | "venue";
  caption: string | null;
  image_urls: string[];
  like_count: number;
  comment_count: number;
  created_at: string;
  author_name: string | null;
  author_username: string | null;
  author_photo_url: string | null;
}

export interface PostsResponse {
  success: boolean;
  posts: Post[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface GetPostsParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: "all" | "member" | "community";
}

// Get all posts with pagination and filters
export async function getPosts(
  params: GetPostsParams = {}
): Promise<PostsResponse> {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.set("page", params.page.toString());
  if (params.limit) queryParams.set("limit", params.limit.toString());
  if (params.search) queryParams.set("search", params.search);
  if (params.type) queryParams.set("type", params.type);

  const query = queryParams.toString();
  return apiRequest(`/admin/posts${query ? `?${query}` : ""}`);
}

// Get posts by a specific user (admin endpoint)
export async function getUserPosts(
  userId: number,
  userType: "member" | "community"
): Promise<{ posts: Post[] }> {
  return apiRequest(`/admin/posts/${userId}/${userType}`);
}

// Delete a post (admin)
export async function deletePost(
  postId: number
): Promise<{ success: boolean; message: string }> {
  return apiRequest(`/admin/posts/${postId}`, {
    method: "DELETE",
  });
}

// Post Like interface
export interface PostLike {
  id: number;
  liker_id: number;
  liker_type: string;
  liker_name: string | null;
  liker_username: string | null;
  liker_photo_url: string | null;
  created_at: string;
}

// Post Comment interface
export interface PostComment {
  id: number;
  post_id: number;
  commenter_id: number;
  commenter_type: string;
  commenter_name: string | null;
  commenter_username: string | null;
  commenter_photo_url: string | null;
  comment_text: string;
  parent_comment_id: number | null;
  created_at: string;
}

// Get post likes (admin)
export async function getPostLikes(
  postId: number
): Promise<{ likes: PostLike[] }> {
  return apiRequest(`/admin/posts/${postId}/likes`);
}

// Get post comments (admin)
export async function getPostComments(
  postId: number
): Promise<{ comments: PostComment[] }> {
  return apiRequest(`/admin/posts/${postId}/comments`);
}

// Delete a comment (admin)
export async function deleteComment(
  commentId: number
): Promise<{ success: boolean; message: string }> {
  return apiRequest(`/admin/comments/${commentId}`, {
    method: "DELETE",
  });
}
