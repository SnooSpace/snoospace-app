import { apiPut, apiDelete } from "../api/client";
import { getAuthToken } from "../api/auth";

export const postService = {
  /**
   * Update a post
   * @param {string} postId - The ID of the post to update
   * @param {Object} updates - The updates to apply (e.g., { question: "New text", expires_at: "..." })
   * @returns {Promise<Object>} The updated post object
   */
  updatePost: async (postId, updates) => {
    try {
      const token = await getAuthToken();

      if (!token) {
        throw new Error("Authentication required");
      }

      const response = await apiPut(
        `/posts/${postId}`,
        { updates },
        15000,
        token,
      );

      if (response.error) {
        throw new Error(response.error);
      }

      return response;
    } catch (error) {
      console.error("[postService] updatePost error:", error);
      throw error;
    }
  },

  /**
   * Delete a post
   * @param {string} postId - The ID of the post to delete
   * @returns {Promise<Object>} Success message
   */
  deletePost: async (postId) => {
    try {
      const token = await getAuthToken();

      if (!token) {
        throw new Error("Authentication required");
      }

      const response = await apiDelete(
        `/posts/${postId}`,
        null, // No body for delete
        15000,
        token,
      );

      if (response.error) {
        throw new Error(response.error);
      }

      return response;
    } catch (error) {
      console.error("[postService] deletePost error:", error);
      throw error;
    }
  },
};
