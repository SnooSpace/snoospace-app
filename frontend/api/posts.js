import { apiGet } from './client';
import { getAuthToken } from './auth';

export async function getPostById(postId) {
  if (!postId) throw new Error('postId is required');
  const token = await getAuthToken();
  return apiGet(`/posts/${postId}`, 15000, token);
}


