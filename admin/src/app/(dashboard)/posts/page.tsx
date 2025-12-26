"use client";

import { useState, useEffect } from "react";
import {
  Search,
  RefreshCw,
  Heart,
  MessageCircle,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Trash2,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getPosts,
  deletePost,
  getPostLikes,
  getPostComments,
  deleteComment,
  type Post,
  type GetPostsParams,
  type PostLike,
  type PostComment,
} from "@/lib/api";

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState("details");

  // Likes and Comments
  const [likes, setLikes] = useState<PostLike[]>([]);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [likesLoading, setLikesLoading] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "member" | "community">(
    "all"
  );

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  useEffect(() => {
    loadPosts();
  }, [page, typeFilter]);

  const loadPosts = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: GetPostsParams = {
        page,
        limit,
        type: typeFilter,
      };
      if (search.trim()) {
        params.search = search.trim();
      }
      const data = await getPosts(params);
      setPosts(data.posts);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load posts");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadPosts();
  };

  const handleViewPost = (post: Post) => {
    setSelectedPost(post);
    setCurrentImageIndex(0);
    setActiveTab("details");
    setLikes([]);
    setComments([]);
    setIsDialogOpen(true);
  };

  const loadLikes = async (postId: number) => {
    setLikesLoading(true);
    try {
      const data = await getPostLikes(postId);
      console.log("Likes API response:", data);
      setLikes(data.likes || []);
    } catch (err) {
      console.error("Error loading likes:", err);
      setLikes([]);
    } finally {
      setLikesLoading(false);
    }
  };

  const loadComments = async (postId: number) => {
    setCommentsLoading(true);
    try {
      const data = await getPostComments(postId);
      console.log("Comments API response:", data);
      setComments(data.comments || []);
    } catch (err) {
      console.error("Error loading comments:", err);
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!confirm("Delete this comment?")) return;
    try {
      await deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      // Update the comment count in selectedPost
      if (selectedPost) {
        setSelectedPost({
          ...selectedPost,
          comment_count: Math.max(0, (selectedPost.comment_count || 0) - 1),
        });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete comment");
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (selectedPost) {
      if (value === "likes" && (!likes || likes.length === 0)) {
        loadLikes(selectedPost.id);
      } else if (value === "comments" && (!comments || comments.length === 0)) {
        loadComments(selectedPost.id);
      }
    }
  };

  const handleDeletePost = async (postId: number) => {
    if (
      !confirm(
        "Are you sure you want to delete this post? This action cannot be undone."
      )
    ) {
      return;
    }
    try {
      await deletePost(postId);
      setIsDialogOpen(false);
      setSelectedPost(null);
      loadPosts(); // Refresh the grid
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete post");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Posts</h1>
          <p className="text-muted-foreground">
            View all posts from members and communities
          </p>
        </div>
        <Button onClick={loadPosts} variant="outline" disabled={loading}>
          <RefreshCw
            className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-1 min-w-[200px] gap-2">
              <Input
                placeholder="Search by caption..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button onClick={handleSearch}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <Select
              value={typeFilter}
              onValueChange={(value: "all" | "member" | "community") => {
                setTypeFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="member">Members</SelectItem>
                <SelectItem value="community">Communities</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Posts Grid */}
      <Card>
        <CardHeader>
          <CardTitle>All Posts</CardTitle>
          <CardDescription>{total} posts total</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">{error}</div>
          ) : posts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No posts found
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="group relative aspect-square bg-muted rounded-lg overflow-hidden cursor-pointer"
                    onClick={() => handleViewPost(post)}
                  >
                    {/* Post Image */}
                    {post.image_urls && post.image_urls.length > 0 ? (
                      <img
                        src={post.image_urls[0]}
                        alt={post.caption || "Post image"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}

                    {/* Multiple Images Indicator */}
                    {post.image_urls && post.image_urls.length > 1 && (
                      <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md">
                        {post.image_urls.length} images
                      </div>
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                      <div className="flex gap-4 mb-2">
                        <div className="flex items-center gap-1">
                          <Heart className="h-5 w-5" />
                          <span>{post.like_count || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageCircle className="h-5 w-5" />
                          <span>{post.comment_count || 0}</span>
                        </div>
                      </div>
                      <div className="text-xs opacity-75">
                        @{post.author_username || "unknown"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Post Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Post Details</DialogTitle>
          </DialogHeader>
          {selectedPost && (
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="likes">
                  Likes ({selectedPost.like_count || 0})
                </TabsTrigger>
                <TabsTrigger value="comments">
                  Comments ({selectedPost.comment_count || 0})
                </TabsTrigger>
              </TabsList>

              {/* Details Tab */}
              <TabsContent value="details" className="space-y-4">
                {/* Author Info */}
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage
                      src={selectedPost.author_photo_url || undefined}
                    />
                    <AvatarFallback>
                      {getInitials(selectedPost.author_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">
                      {selectedPost.author_name || "Unknown"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      @{selectedPost.author_username || "unknown"}
                    </div>
                  </div>
                  <Badge
                    variant={
                      selectedPost.author_type === "member"
                        ? "default"
                        : "secondary"
                    }
                    className="ml-auto"
                  >
                    {selectedPost.author_type === "member"
                      ? "Member"
                      : "Community"}
                  </Badge>
                </div>

                {/* Image Carousel */}
                {selectedPost.image_urls &&
                  selectedPost.image_urls.length > 0 && (
                    <div className="relative">
                      <img
                        src={selectedPost.image_urls[currentImageIndex]}
                        alt={`Image ${currentImageIndex + 1}`}
                        className="w-full rounded-lg max-h-[300px] object-contain bg-muted"
                      />
                      {selectedPost.image_urls.length > 1 && (
                        <>
                          <button
                            onClick={() =>
                              setCurrentImageIndex((prev) =>
                                prev === 0
                                  ? selectedPost.image_urls.length - 1
                                  : prev - 1
                              )
                            }
                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 text-white p-2 rounded-full hover:bg-black/80"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() =>
                              setCurrentImageIndex((prev) =>
                                prev === selectedPost.image_urls.length - 1
                                  ? 0
                                  : prev + 1
                              )
                            }
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 text-white p-2 rounded-full hover:bg-black/80"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                            {currentImageIndex + 1} /{" "}
                            {selectedPost.image_urls.length}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                {/* Caption */}
                {selectedPost.caption && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm whitespace-pre-wrap">
                      {selectedPost.caption}
                    </p>
                  </div>
                )}

                {/* Date */}
                <div className="text-xs text-muted-foreground">
                  Posted on {formatDate(selectedPost.created_at)}
                </div>

                {/* Delete Button */}
                <div className="pt-4 border-t">
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => handleDeletePost(selectedPost.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Post
                  </Button>
                </div>
              </TabsContent>

              {/* Likes Tab */}
              <TabsContent value="likes">
                {likesLoading ? (
                  <div className="flex justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !likes || likes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No likes yet
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {likes.map((like) => (
                      <div
                        key={like.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage
                            src={like.liker_photo_url || undefined}
                          />
                          <AvatarFallback>
                            {getInitials(like.liker_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {like.liker_name || "Unknown"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            @{like.liker_username || "unknown"}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {like.liker_type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Comments Tab */}
              <TabsContent value="comments">
                {commentsLoading ? (
                  <div className="flex justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !comments || comments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No comments yet
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="p-3 rounded-lg bg-muted/30 border"
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage
                              src={comment.commenter_photo_url || undefined}
                            />
                            <AvatarFallback>
                              {getInitials(comment.commenter_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {comment.commenter_name || "Unknown"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                @{comment.commenter_username}
                              </span>
                            </div>
                            <p className="text-sm mt-1 whitespace-pre-wrap">
                              {comment.comment_text}
                            </p>
                            <div className="text-xs text-muted-foreground mt-1">
                              {formatDate(comment.created_at)}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteComment(comment.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
