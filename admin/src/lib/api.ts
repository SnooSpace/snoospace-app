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
  options: RequestInit = {},
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
  updates: Partial<Category>,
): Promise<Category> {
  const data = await apiRequest<SingleCategoryResponse>(
    `/admin/categories/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(updates),
    },
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
  order: { id: number; display_order: number }[],
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
    },
  );
  return data.interest;
}

// Update interest
export async function updateInterest(
  id: number,
  updates: Partial<Interest>,
): Promise<Interest> {
  const data = await apiRequest<{ success: boolean; interest: Interest }>(
    `/admin/interests/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(updates),
    },
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
// PRONOUN API
// ============================================

export interface Pronoun {
  id: number;
  label: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface PronounResponse {
  success: boolean;
  pronouns: Pronoun[];
}

// Get all pronouns (admin view)
export async function getPronouns(): Promise<Pronoun[]> {
  const data = await apiRequest<PronounResponse>("/admin/pronouns");
  return data.pronouns;
}

// Create pronoun
export async function createPronoun(pronoun: {
  label: string;
  display_order?: number;
}): Promise<Pronoun> {
  const data = await apiRequest<{ success: boolean; pronoun: Pronoun }>(
    "/admin/pronouns",
    {
      method: "POST",
      body: JSON.stringify(pronoun),
    },
  );
  return data.pronoun;
}

// Update pronoun
export async function updatePronoun(
  id: number,
  updates: Partial<Pronoun>,
): Promise<Pronoun> {
  const data = await apiRequest<{ success: boolean; pronoun: Pronoun }>(
    `/admin/pronouns/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(updates),
    },
  );
  return data.pronoun;
}

// Delete pronoun
export async function deletePronoun(id: number): Promise<void> {
  await apiRequest(`/admin/pronouns/${id}`, {
    method: "DELETE",
  });
}

// Reorder pronouns
export async function reorderPronouns(
  order: { id: number; display_order: number }[],
): Promise<void> {
  await apiRequest("/admin/pronouns/reorder", {
    method: "POST",
    body: JSON.stringify({ order }),
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
  params: GetUsersParams = {},
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
  type: "member" | "community",
): Promise<User> {
  const data = await apiRequest<{ success: boolean; user: User }>(
    `/admin/users/${id}?type=${type}`,
  );
  return data.user;
}

// Update user (ban/unban)
export async function updateUser(
  id: number,
  type: "member" | "community",
  updates: { is_active: boolean },
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
  hard: boolean = false,
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
  userType: "member" | "community",
): Promise<{ followers: FollowUser[] }> {
  return apiRequest(`/followers/${userId}/${userType}`);
}

// Get following list for a user
export async function getFollowing(
  userId: number,
  userType: "member" | "community",
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
  params: GetPostsParams = {},
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
  userType: "member" | "community",
): Promise<{ posts: Post[] }> {
  return apiRequest(`/admin/posts/${userId}/${userType}`);
}

// Delete a post (admin)
export async function deletePost(
  postId: number,
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
  postId: number,
): Promise<{ likes: PostLike[] }> {
  return apiRequest(`/admin/posts/${postId}/likes`);
}

// Get post comments (admin)
export async function getPostComments(
  postId: number,
): Promise<{ comments: PostComment[] }> {
  return apiRequest(`/admin/posts/${postId}/comments`);
}

// Delete a comment (admin)
export async function deleteComment(
  commentId: number,
): Promise<{ success: boolean; message: string }> {
  return apiRequest(`/admin/comments/${commentId}`, {
    method: "DELETE",
  });
}

// ============================================
// SPONSOR TYPES API
// ============================================

export interface SponsorType {
  id: number;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  usage_count?: number;
}

// Get all sponsor types (admin - includes inactive and usage count)
export async function getSponsorTypes(): Promise<SponsorType[]> {
  const data = await apiRequest<{
    success: boolean;
    sponsorTypes: SponsorType[];
  }>("/admin/sponsor-types");
  return data.sponsorTypes;
}

// Create a new sponsor type
export async function createSponsorType(sponsorType: {
  name: string;
  display_order?: number;
  is_active?: boolean;
}): Promise<SponsorType> {
  const data = await apiRequest<{ success: boolean; sponsorType: SponsorType }>(
    "/admin/sponsor-types",
    {
      method: "POST",
      body: JSON.stringify(sponsorType),
    },
  );
  return data.sponsorType;
}

// Update a sponsor type
export async function updateSponsorType(
  id: number,
  updates: Partial<SponsorType>,
): Promise<SponsorType> {
  const data = await apiRequest<{ success: boolean; sponsorType: SponsorType }>(
    `/admin/sponsor-types/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(updates),
    },
  );
  return data.sponsorType;
}

// Delete a sponsor type
export async function deleteSponsorType(
  id: number,
): Promise<{ success: boolean; message: string }> {
  return apiRequest(`/admin/sponsor-types/${id}`, {
    method: "DELETE",
  });
}

// ============================================
// EVENTS API
// ============================================

export interface TicketType {
  id: number;
  name: string;
  description: string | null;
  base_price: string | number;
  total_quantity: number | null;
}

export interface Highlight {
  icon_name: string;
  title: string;
  description: string | null;
}

export interface ThingToKnow {
  icon_name: string;
  label: string;
}

export interface FeaturedAccount {
  display_name: string;
  role: string | null;
  profile_photo_url: string | null;
}

export interface Banner {
  image_url: string;
}

export interface Event {
  id: number;
  title: string;
  description: string | null;
  banner_url: string | null;
  start_datetime: string;
  end_datetime: string;
  location_url: string | null;
  is_cancelled: boolean;
  created_at: string;
  community_id: number;
  community_name: string;
  community_username: string;
  community_logo_url: string | null;
  attendee_count: number;
  status: "upcoming" | "ongoing" | "completed" | "cancelled";
  gallery_images: { image_url: string }[];
  highlights: Highlight[];
  things_to_know: ThingToKnow[];
  featured_accounts: FeaturedAccount[];
  ticket_types: TicketType[];
  banners: Banner[];
}

export interface EventStats {
  total: number;
  upcoming: number;
  ongoing: number;
  completed: number;
  cancelled: number;
}

export interface EventsResponse {
  success: boolean;
  events: Event[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface GetEventsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: "all" | "upcoming" | "ongoing" | "completed" | "cancelled";
  communityId?: number;
}

// Get event stats for dashboard
export async function getEventStats(): Promise<EventStats> {
  const data = await apiRequest<{ success: boolean; stats: EventStats }>(
    "/admin/events/stats",
  );
  return data.stats;
}

// Get all events with pagination and filters
export async function getEvents(
  params: GetEventsParams = {},
): Promise<EventsResponse> {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.set("page", params.page.toString());
  if (params.limit) queryParams.set("limit", params.limit.toString());
  if (params.search) queryParams.set("search", params.search);
  if (params.status) queryParams.set("status", params.status);
  if (params.communityId)
    queryParams.set("communityId", params.communityId.toString());

  const query = queryParams.toString();
  return apiRequest(`/admin/events${query ? `?${query}` : ""}`);
}

// Get single event by ID
export async function getEventById(id: number): Promise<Event> {
  const data = await apiRequest<{ success: boolean; event: Event }>(
    `/admin/events/${id}`,
  );
  return data.event;
}

// Delete an event
export async function deleteEvent(
  id: number,
): Promise<{ success: boolean; message: string }> {
  return apiRequest(`/admin/events/${id}`, {
    method: "DELETE",
  });
}

// Cancel an event
export async function cancelEvent(
  id: number,
): Promise<{ success: boolean; message: string; event: Event }> {
  return apiRequest(`/admin/events/${id}/cancel`, {
    method: "PATCH",
  });
}

// ============================================
// ANALYTICS API
// ============================================

export interface OverviewStats {
  totalUsers: number;
  totalMembers: number;
  totalCommunities: number;
  totalSponsors: number;
  totalVenues: number;
  totalEvents: number;
  totalPosts: number;
}

export interface UserAnalytics {
  byType: {
    members: number;
    communities: number;
    sponsors: number;
    venues: number;
  };
  growth: Array<{ date: string; members: number; communities: number }>;
  recentSignups: Array<{
    id: number;
    name: string;
    type: string;
    created_at: string;
    photo_url: string | null;
  }>;
}

export interface EventAnalytics {
  byStatus: {
    upcoming: number;
    ongoing: number;
    completed: number;
    cancelled: number;
  };
  ticketsSold: number;
  recentEvents: Array<{
    id: number;
    title: string;
    start_datetime: string;
    community_name: string;
    attendee_count: number;
  }>;
}

export interface EngagementAnalytics {
  posts: { total: number; today: number; thisWeek: number };
  comments: { total: number; today: number; thisWeek: number };
  likes: { total: number; today: number; thisWeek: number };
  trend: Array<{
    date: string;
    posts: number;
    comments: number;
    likes: number;
  }>;
}

// Get overview stats for dashboard
export async function getOverviewStats(): Promise<OverviewStats> {
  const data = await apiRequest<{ success: boolean; stats: OverviewStats }>(
    "/admin/analytics/overview",
  );
  return data.stats;
}

// Get user analytics with growth data
export async function getUserAnalytics(
  period: string = "30d",
): Promise<UserAnalytics> {
  const data = await apiRequest<{ success: boolean; analytics: UserAnalytics }>(
    `/admin/analytics/users?period=${period}`,
  );
  return data.analytics;
}

// Get event analytics
export async function getEventAnalytics(
  period: string = "30d",
): Promise<EventAnalytics> {
  const data = await apiRequest<{
    success: boolean;
    analytics: EventAnalytics;
  }>(`/admin/analytics/events?period=${period}`);
  return data.analytics;
}

// Get engagement analytics
export async function getEngagementAnalytics(
  period: string = "30d",
): Promise<EngagementAnalytics> {
  const data = await apiRequest<{
    success: boolean;
    analytics: EngagementAnalytics;
  }>(`/admin/analytics/engagement?period=${period}`);
  return data.analytics;
}

// Advanced Analytics Types
export interface AdvancedAnalytics {
  activeUsers: {
    dau: number;
    wau: number;
    mau: number;
    trend: Array<{ date: string; activeUsers: number }>;
  };
  retention: {
    d1: { cohortSize: number; retainedCount: number; rate: number };
    d7: { cohortSize: number; retainedCount: number; rate: number };
    d30: { cohortSize: number; retainedCount: number; rate: number };
  };
  geographic: {
    byLocation: Array<{ country: string; city: string; count: number }>;
    byCountry: Array<{ country: string; count: number }>;
  };
  devices: {
    byPlatform: Array<{
      platform: string;
      userCount: number;
      sessionCount: number;
    }>;
    byOS: Array<{ platform: string; osVersion: string; count: number }>;
  };
}

// Get advanced analytics (DAU/WAU/MAU, retention, geo, devices)
export async function getAdvancedAnalytics(): Promise<AdvancedAnalytics> {
  const data = await apiRequest<{
    success: boolean;
    analytics: AdvancedAnalytics;
  }>("/admin/analytics/advanced");
  return data.analytics;
}

// ============================================
// MODERATION API
// ============================================

export interface Report {
  id: number;
  reporter_id: number;
  reporter_type: string;
  reported_id: number;
  reported_type: string;
  reason: string;
  description: string | null;
  status: "pending" | "reviewed" | "resolved" | "dismissed";
  resolved_by: number | null;
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  reporter_name: string | null;
  resolved_by_email: string | null;
}

export interface ReportStats {
  pending: number;
  reviewed: number;
  resolved: number;
  dismissed: number;
  total: number;
}

export interface UserRestriction {
  id: number;
  user_id: number;
  user_type: string;
  restriction_type: "ban" | "suspend" | "warn";
  reason: string;
  expires_at: string | null;
  created_by: number;
  created_at: string;
  revoked_at: string | null;
  revoked_by: number | null;
  user_name: string | null;
  created_by_email: string | null;
}

export interface AuditLogEntry {
  id: number;
  admin_id: number;
  action: string;
  target_type: string | null;
  target_id: number | null;
  details: Record<string, unknown> | null;
  created_at: string;
  admin_email: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Reports
export async function getReports(params?: {
  status?: string;
  type?: string;
  page?: number;
  limit?: number;
}): Promise<{
  reports: Report[];
  pagination: PaginatedResponse<Report>["pagination"];
}> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.type) query.set("type", params.type);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));

  const data = await apiRequest<{
    success: boolean;
    reports: Report[];
    pagination: PaginatedResponse<Report>["pagination"];
  }>(`/admin/reports?${query.toString()}`);
  return { reports: data.reports, pagination: data.pagination };
}

export async function getReportStats(): Promise<ReportStats> {
  const data = await apiRequest<{ success: boolean; stats: ReportStats }>(
    "/admin/reports/stats",
  );
  return data.stats;
}

export async function resolveReport(
  id: number,
  status: "resolved" | "dismissed",
  notes?: string,
): Promise<Report> {
  const data = await apiRequest<{ success: boolean; report: Report }>(
    `/admin/reports/${id}/resolve`,
    {
      method: "POST",
      body: JSON.stringify({ status, resolution_notes: notes }),
    },
  );
  return data.report;
}

// Restrictions
export async function getRestrictions(params?: {
  user_type?: string;
  active_only?: boolean;
  page?: number;
  limit?: number;
}): Promise<{
  restrictions: UserRestriction[];
  pagination: PaginatedResponse<UserRestriction>["pagination"];
}> {
  const query = new URLSearchParams();
  if (params?.user_type) query.set("user_type", params.user_type);
  if (params?.active_only !== undefined)
    query.set("active_only", String(params.active_only));
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));

  const data = await apiRequest<{
    success: boolean;
    restrictions: UserRestriction[];
    pagination: PaginatedResponse<UserRestriction>["pagination"];
  }>(`/admin/restrictions?${query.toString()}`);
  return { restrictions: data.restrictions, pagination: data.pagination };
}

export async function restrictUser(data: {
  user_id: number;
  user_type: string;
  restriction_type: "ban" | "suspend" | "warn";
  reason: string;
  expires_at?: string;
}): Promise<UserRestriction> {
  const result = await apiRequest<{
    success: boolean;
    restriction: UserRestriction;
  }>("/admin/restrictions", { method: "POST", body: JSON.stringify(data) });
  return result.restriction;
}

export async function revokeRestriction(id: number): Promise<UserRestriction> {
  const data = await apiRequest<{
    success: boolean;
    restriction: UserRestriction;
  }>(`/admin/restrictions/${id}/revoke`, { method: "POST" });
  return data.restriction;
}

// Audit Log
export async function getAuditLog(params?: {
  admin_id?: number;
  action?: string;
  page?: number;
  limit?: number;
}): Promise<{
  logs: AuditLogEntry[];
  pagination: PaginatedResponse<AuditLogEntry>["pagination"];
}> {
  const query = new URLSearchParams();
  if (params?.admin_id) query.set("admin_id", String(params.admin_id));
  if (params?.action) query.set("action", params.action);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));

  const data = await apiRequest<{
    success: boolean;
    logs: AuditLogEntry[];
    pagination: PaginatedResponse<AuditLogEntry>["pagination"];
  }>(`/admin/audit-log?${query.toString()}`);
  return { logs: data.logs, pagination: data.pagination };
}

// ============================================
// COLLEGE & CAMPUS API
// ============================================

export interface College {
  id: string;
  name: string;
  abbreviation: string | null;
  website: string | null;
  logo_url: string | null;
  status: "pending" | "approved";
  created_at: string;
  campus_count: number;
  community_count: number;
}

export interface Campus {
  id: string;
  college_id: string;
  campus_name: string;
  city: string;
  state: string | null;
  area: string | null;
  address: string | null;
  location_url: string | null;
  geo_location: string | null;
  status: "pending" | "active";
  created_at: string;
  community_count: number;
}

export interface CollegesResponse {
  success: boolean;
  colleges: College[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface GetCollegesParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: "all" | "pending" | "approved";
}

// Get all colleges with filters
export async function getColleges(
  params: GetCollegesParams = {},
): Promise<CollegesResponse> {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.set("page", params.page.toString());
  if (params.limit) queryParams.set("limit", params.limit.toString());
  if (params.search) queryParams.set("search", params.search);
  if (params.status) queryParams.set("status", params.status);

  const query = queryParams.toString();
  return apiRequest(`/admin/colleges${query ? `?${query}` : ""}`);
}

// Create college
export async function createCollege(college: {
  name: string;
  abbreviation?: string;
  website?: string;
  logo_url?: string;
}): Promise<{ success: boolean; college: College }> {
  return apiRequest("/admin/colleges", {
    method: "POST",
    body: JSON.stringify(college),
  });
}

// Update college
export async function updateCollege(
  id: string,
  updates: Partial<College>,
): Promise<{ success: boolean; college: College }> {
  return apiRequest(`/admin/colleges/${id}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

// Delete college
export async function deleteCollege(id: string): Promise<{ success: boolean }> {
  return apiRequest(`/admin/colleges/${id}`, { method: "DELETE" });
}

// Get campuses for a college
export async function getCampuses(
  collegeId: string,
): Promise<{ success: boolean; campuses: Campus[] }> {
  return apiRequest(`/admin/colleges/${collegeId}/campuses`);
}

// Create campus
export async function createCampus(campus: {
  college_id: string;
  campus_name: string;
  city: string;
  state?: string;
  area?: string;
  address?: string;
  location_url?: string;
}): Promise<{ success: boolean; campus: Campus }> {
  return apiRequest("/admin/campuses", {
    method: "POST",
    body: JSON.stringify(campus),
  });
}

// Update campus
export async function updateCampus(
  id: string,
  updates: Partial<Campus>,
): Promise<{ success: boolean; campus: Campus }> {
  return apiRequest(`/admin/campuses/${id}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

// Delete campus
export async function deleteCampus(id: string): Promise<{ success: boolean }> {
  return apiRequest(`/admin/campuses/${id}`, { method: "DELETE" });
}

// Get pending count for notification badge
export async function getCollegePendingCount(): Promise<{
  success: boolean;
  pending: { colleges: number; campuses: number; total: number };
}> {
  return apiRequest("/admin/colleges/pending-count");
}

// Upload college logo
export async function uploadCollegeLogo(
  base64Image: string,
): Promise<{ success: boolean; data: { url: string; public_id: string } }> {
  return apiRequest("/admin/upload/college-logo", {
    method: "POST",
    body: JSON.stringify({ image: base64Image }),
  });
}
