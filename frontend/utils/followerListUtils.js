/**
 * Ensures every entry in the list has a boolean isFollowing value.
 * When the server response omits follow status, we call the provided fetcher.
 *
 * @param {Array} list - Normalized user objects [{ id, name, username, avatarUrl, isFollowing? }]
 * @param {(id: string|number) => Promise<boolean>} fetchStatusForUser - async resolver returning whether current user follows id
 * @returns {Promise<Array>} list with isFollowing populated
 */
export async function ensureFollowStatus(list = [], fetchStatusForUser) {
  if (!Array.isArray(list) || list.length === 0) return [];
  const needsStatus =
    typeof fetchStatusForUser === "function" &&
    list.some((item) => typeof item.isFollowing !== "boolean");

  if (!needsStatus) {
    return list.map((item) => ({
      ...item,
      isFollowing: typeof item.isFollowing === "boolean" ? item.isFollowing : false,
    }));
  }

  const statuses = await Promise.all(
    list.map(async (item) => {
      try {
        const isFollowing = await fetchStatusForUser(item.id);
        return { id: item.id, isFollowing: !!isFollowing };
      } catch {
        return { id: item.id, isFollowing: false };
      }
    })
  );

  const statusMap = new Map(statuses.map((entry) => [entry.id, entry.isFollowing]));
  return list.map((item) => ({
    ...item,
    isFollowing: statusMap.get(item.id),
  }));
}

