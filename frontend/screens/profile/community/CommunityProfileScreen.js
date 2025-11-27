import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  FlatList,
  TextInput,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions, useFocusEffect } from '@react-navigation/native';
import { clearAuthSession, getAuthToken, getAuthEmail } from '../../../api/auth';
import { deleteAccount as apiDeleteAccount } from '../../../api/account';
import { apiGet, apiPost, apiDelete } from '../../../api/client';
import { getCommunityProfile, updateCommunityProfile, updateCommunityHeads } from '../../../api/communities';
import { launchImageLibraryAsync, requestMediaLibraryPermissionsAsync, MediaTypeOptions } from 'expo-image-picker';
import { uploadImage } from '../../../api/cloudinary';
import PostCard from '../../../components/PostCard';
import { mockData } from '../../../data/mockData';
import HeadsEditorModal from '../../../components/modals/HeadsEditorModal';
import CommentsModal from '../../../components/CommentsModal';
import SettingsModal from '../../../components/modals/SettingsModal';
import EventBus from '../../../utils/EventBus';
import MentionTextRenderer from '../../../components/MentionTextRenderer';

const { width: screenWidth } = Dimensions.get('window');

const formatPhoneNumber = (value) => {
  if (!value) return '';
  const digits = String(value).replace(/[^0-9]/g, '');
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digits || String(value);
};

const PRIMARY_COLOR = '#5f27cd';
const TEXT_COLOR = '#1D1D1F';
const LIGHT_TEXT_COLOR = '#8E8E93';

export default function CommunityProfileScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadCompleted, setInitialLoadCompleted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [headsModalVisible, setHeadsModalVisible] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [postModalVisible, setPostModalVisible] = useState(false);
  const [commentsModalState, setCommentsModalState] = useState({ visible: false, postId: null });
  const pendingPostUpdateRef = useRef(null);
  const hasInitialLoadRef = useRef(false);
  const initialLoadCompletedRef = useRef(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      await loadProfile();
      if (isMounted) {
        hasInitialLoadRef.current = true;
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [loadProfile]);

  useFocusEffect(
    useCallback(() => {
      if (hasInitialLoadRef.current) {
        loadProfile(true);
      }
    }, [loadProfile])
  );

  // Listen for follow updates to refresh follower and following counts
  useEffect(() => {
    const handleFollowUpdate = (data) => {
      if (!profile) return;
      
      // Case 1: Someone followed/unfollowed the current community (update follower_count)
      if (data?.communityId && data.communityId === profile.id) {
        setProfile((prev) => {
          if (!prev) return prev;
          const change = data.isFollowing ? 1 : -1;
          return {
            ...prev,
            follower_count: Math.max(0, (prev.follower_count || 0) + change),
          };
        });
      }
      
      // Case 2: Current community followed/unfollowed someone (update following_count)
      if (data?.followerId && data?.followerType === 'community' && data.followerId === profile.id) {
        setProfile((prev) => {
          if (!prev) return prev;
          const change = data.isFollowing ? 1 : -1;
          return {
            ...prev,
            following_count: Math.max(0, (prev.following_count || 0) + change),
          };
        });
      }
    };

    EventBus.on('follow-updated', handleFollowUpdate);
    return () => {
      EventBus.off('follow-updated', handleFollowUpdate);
    };
  }, [profile]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = await getAuthToken();
        const email = await getAuthEmail();
        if (token && email && mounted) {
          const profileResponse = await apiPost('/auth/get-user-profile', { email }, 10000, token);
          if (profileResponse?.profile?.id && mounted) {
            setCurrentUserId(profileResponse.profile.id);
          }
        }
      } catch (error) {
        console.error('Failed to load current user info:', error);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Listen for post like/comment updates to refresh posts immediately
  useEffect(() => {
    const handlePostLikeUpdate = (payload) => {
      if (!payload?.postId) return;
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === payload.postId
            ? {
                ...post,
                is_liked: payload.isLiked,
                isLiked: payload.isLiked,
                like_count:
                  typeof payload.likeCount === 'number'
                    ? payload.likeCount
                    : post.like_count,
                comment_count:
                  typeof payload.commentCount === 'number'
                    ? payload.commentCount
                    : post.comment_count,
              }
            : post
        )
      );
    };

    const handlePostCommentUpdate = (payload) => {
      if (!payload?.postId) return;
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === payload.postId
            ? {
                ...post,
                comment_count:
                  typeof payload.commentCount === 'number'
                    ? payload.commentCount
                    : post.comment_count,
              }
            : post
        )
      );
    };

    const unsubscribeLike = EventBus.on('post-like-updated', handlePostLikeUpdate);
    const unsubscribeComment = EventBus.on('post-comment-updated', handlePostCommentUpdate);

    return () => {
      if (unsubscribeLike) unsubscribeLike();
      if (unsubscribeComment) unsubscribeComment();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = EventBus.on('post-created', () => {
      loadProfile();
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [loadProfile]);

  const loadProfile = useCallback(async (isRefresh = false) => {
    try {
      if (!initialLoadCompletedRef.current) {
        setLoading(true);
      }
      if (isRefresh) {
        setRefreshing(true);
      }
      const token = await getAuthToken();

      // Fetch profile using communities/profile endpoint to get full profile with heads
      let role = 'community';
      let fullProfile = null;
      try {
        const profileRes = await getCommunityProfile();
        fullProfile = profileRes?.profile || null;
        role = 'community';
      } catch (e) {
        try {
          const email = await AsyncStorage.getItem('auth_email');
          const profRes = await apiPost('/auth/get-user-profile', email ? { email } : {}, 15000, token);
          role = profRes?.role || 'community';
          fullProfile = profRes?.profile || null;
        } catch {}
      }

      if (!fullProfile) {
        const communityProfile = mockData.communities[0];
        const categoriesFallback = Array.isArray(communityProfile.categories) && communityProfile.categories.length
          ? communityProfile.categories
          : (communityProfile.category ? [communityProfile.category] : []);
        communityProfile.categories = categoriesFallback;
        communityProfile.category = categoriesFallback[0] || communityProfile.category || '';
        const communityPosts = mockData.posts.filter(p => p.author_type === 'community' && p.author_id === communityProfile.id);
        setProfile(communityProfile);
        setPosts(communityPosts);
        return;
      }

      const userId = fullProfile.id;
      const userType = role || 'community';

      // Fetch follow counts
      let followerCount = 0;
      let followingCount = 0;
      try {
        const counts = await apiGet(`/follow/counts/${userId}/${userType}`, 15000, token);
        const followersRaw = counts?.followers_count ?? counts?.followers;
        const followingRaw = counts?.following_count ?? counts?.following;
        followerCount =
          typeof followersRaw === 'number'
            ? followersRaw
            : parseInt(followersRaw || '0', 10) || 0;
        followingCount =
          typeof followingRaw === 'number'
            ? followingRaw
            : parseInt(followingRaw || '0', 10) || 0;
      } catch {}

      // Fetch posts by this user
      let userPosts = [];
      try {
        const postsRes = await apiGet(`/posts/user/${userId}/${userType}`, 15000, token);
        userPosts = Array.isArray(postsRes?.posts) ? postsRes.posts : [];
      } catch {}

      const normalizedCategories = (() => {
        if (Array.isArray(fullProfile?.categories)) return fullProfile.categories;
        if (fullProfile?.categories && typeof fullProfile.categories === 'string') {
          try {
            const parsed = JSON.parse(fullProfile.categories);
            if (Array.isArray(parsed)) return parsed;
          } catch (err) {
            // ignore parse errors
          }
        }
        return fullProfile?.category ? [fullProfile.category] : [];
      })();

      const primaryPhone =
        fullProfile?.phone ??
        fullProfile?.primary_phone ??
        fullProfile?.primaryPhone ??
        fullProfile?.phone_primary ??
        "";
      const secondaryPhone =
        fullProfile?.secondary_phone ??
        fullProfile?.secondaryPhone ??
        fullProfile?.secondary_phone_number ??
        fullProfile?.secondaryPhoneNumber ??
        fullProfile?.phone_secondary ??
        "";

      const mappedProfile = {
        id: userId,
        name: fullProfile?.name || 'Community',
        username: fullProfile?.username || '',
        bio: fullProfile?.bio || '',
        email: fullProfile?.email || '',
        phone: String(primaryPhone || ''),
        secondary_phone: String(secondaryPhone || ''),
        categories: normalizedCategories,
        location: fullProfile?.location || '',
        logo_url: fullProfile?.logo_url || '',
        banner_url: fullProfile?.banner_url || null,
        sponsor_types: fullProfile?.sponsor_types || [],
        heads: fullProfile?.heads || [],
        follower_count: followerCount,
        following_count: followingCount,
        post_count: userPosts.length,
      };
      console.log(
        "[CommunityProfile] phones",
        {
          rawPhone: fullProfile?.phone,
          rawPrimary: fullProfile?.primary_phone ?? fullProfile?.primaryPhone,
          rawSecondary:
            fullProfile?.secondary_phone ??
            fullProfile?.secondaryPhone ??
            fullProfile?.secondary_phone_number,
        },
        { mappedPhone: mappedProfile.phone, mappedSecondary: mappedProfile.secondary_phone }
      );
      mappedProfile.category = mappedProfile.categories[0] || '';

      setProfile(mappedProfile);
      setPosts(userPosts);
    } catch (error) {
      const communityProfile = mockData.communities[0];
      const categoriesFallback = Array.isArray(communityProfile.categories) && communityProfile.categories.length
        ? communityProfile.categories
        : (communityProfile.category ? [communityProfile.category] : []);
      communityProfile.categories = categoriesFallback;
      communityProfile.category = categoriesFallback[0] || communityProfile.category || '';
      const communityPosts = mockData.posts.filter(p => p.author_type === 'community' && p.author_id === communityProfile.id);
      setProfile(communityProfile);
      setPosts(communityPosts);
    } finally {
      if (!initialLoadCompletedRef.current) {
        setLoading(false);
        initialLoadCompletedRef.current = true;
        setInitialLoadCompleted(true);
      }
      setRefreshing(false);
    }
  }, []);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              setShowSettingsModal(false);
              await clearAuthSession();
              await AsyncStorage.multiRemove(['accessToken', 'userData', 'auth_token', 'auth_email', 'pending_otp']);
              let rootNavigator = navigation;
              if (navigation.getParent) {
                const parent = navigation.getParent();
                if (parent) {
                  rootNavigator = parent.getParent ? parent.getParent() : parent;
                }
              }
              rootNavigator.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'Landing' }],
                })
              );
            } catch (error) {
              Alert.alert('Error', 'Failed to logout properly');
            }
          },
        },
      ]
    );
  };

  const handleBannerAction = () => {
    if (!profile) return;
    const options = [
      { text: 'Change banner', onPress: () => pickBannerImage() },
    ];
    if (profile.banner_url) {
      options.push({ text: 'Remove banner', onPress: removeBanner });
    }
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Banner', 'Update your community banner', options);
  };

  const pickBannerImage = async () => {
    try {
      const perm = await requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission required', 'Allow photo access to change banner');
        return;
      }
      const picker = await launchImageLibraryAsync({ mediaTypes: MediaTypeOptions.Images, allowsEditing: true, aspect: [3, 1], quality: 0.85 });
      if (picker.canceled || !picker.assets || !picker.assets[0]) return;
      setBannerUploading(true);
      const uri = picker.assets[0].uri;
      const secureUrl = await uploadImage(uri);
      await updateCommunityProfile({ banner_url: secureUrl });
      setProfile(prev => prev ? { ...prev, banner_url: secureUrl } : prev);
    } catch (e) {
      Alert.alert('Update failed', e?.message || 'Could not update banner');
    } finally {
      setBannerUploading(false);
    }
  };

  const removeBanner = async () => {
    if (!profile?.banner_url) return;
    try {
      setBannerUploading(true);
      await updateCommunityProfile({ banner_url: null });
      setProfile(prev => prev ? { ...prev, banner_url: null } : prev);
    } catch (e) {
      Alert.alert('Update failed', e?.message || 'Could not remove banner');
    } finally {
      setBannerUploading(false);
    }
  };

  const handleHeadsSave = async (nextHeads) => {
    try {
      await updateCommunityHeads(nextHeads);
      await loadProfile();
      setHeadsModalVisible(false);
    } catch (e) {
      Alert.alert('Update failed', e?.message || 'Could not update heads');
    }
  };

  const handleHeadPress = (head) => {
    if (head?.member_id) {
      // Check if it's the current user's own profile
      const isOwnProfile = currentUserId && head.member_id === currentUserId;
      if (isOwnProfile) {
        // Navigate to own profile screen
        const root = navigation.getParent()?.getParent();
        if (root) {
          root.navigate('MemberHome', {
            screen: 'Profile',
            params: {
              screen: 'MemberProfile'
            }
          });
        } else {
          // Fallback navigation
          navigation.navigate('MemberProfile');
        }
      } else {
        // Navigate to MemberPublicProfile within Community's Profile stack
        navigation.navigate('MemberPublicProfile', { memberId: head.member_id });
      }
    }
  };

  const postsCount = (profile?.posts_count ?? profile?.post_count ?? 0);
  const followersCount = (profile?.followers_count ?? profile?.follower_count ?? 0);
  const followingCount = (profile?.following_count ?? profile?.following ?? 0);

  const openPostModal = (post) => {
    // Normalize is_liked field - only use is_liked, ignore isLiked completely
    const normalizedIsLiked = post.is_liked === true;
    const normalizedPost = {
      ...post,
      is_liked: normalizedIsLiked,
      isLiked: normalizedIsLiked,
    };
    setSelectedPost(normalizedPost);
    setPostModalVisible(true);
  };

  const closePostModal = () => {
    const pending = pendingPostUpdateRef.current;
    if (pending && pending.postId != null) {
      setPosts((prevPosts) =>
        prevPosts.map((p) =>
          p.id === pending.postId
            ? {
                ...p,
                is_liked: pending.is_liked,
                isLiked: pending.is_liked,
                like_count: pending.like_count,
              }
            : p
        )
      );
      pendingPostUpdateRef.current = null;
    }
    setPostModalVisible(false);
    setSelectedPost(null);
  };

  const openCommentsModal = useCallback((postId) => {
    if (postId) {
      setCommentsModalState({ visible: true, postId });
    }
  }, []);

  const closeCommentsModal = useCallback(() => {
    setCommentsModalState({ visible: false, postId: null });
  }, []);

  const updatePostsGlobalState = (postId, isLiked, likes) => {
    setPosts((prevPosts) =>
      prevPosts.map((p) =>
        p.id === postId ? { ...p, isLiked, is_liked: isLiked, like_count: likes } : p
      )
    );
  };

  const handlePostLike = (postId, isLiked, likeCount) => {
    pendingPostUpdateRef.current = { postId, is_liked: isLiked, like_count: likeCount };
  };

  const handlePostComment = (postId) => {
    openCommentsModal(postId);
  };

  if (!initialLoadCompleted && (loading || !profile)) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadProfile(true)}
            colors={[PRIMARY_COLOR]}
            tintColor={PRIMARY_COLOR}
          />
        }
      >
        <View style={styles.bannerContainer}>
          {profile.banner_url ? (
            <Image source={{ uri: profile.banner_url }} style={styles.bannerImage} />
          ) : (
            <View style={[styles.bannerImage, styles.bannerPlaceholder]}>
              <Text style={styles.bannerPlaceholderText}>Add a banner (1200 x 400 recommended)</Text>
            </View>
          )}
          <TouchableOpacity style={styles.bannerEdit} onPress={handleBannerAction}>
            {bannerUploading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="camera" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.summarySection}>
          <View style={styles.topBar}>
            <Text style={styles.handle}>{profile.username ? `@${profile.username}` : profile.name}</Text>
            <View style={styles.iconButtons}>
              <TouchableOpacity
                onPress={() => setShowSettingsModal(true)}
                style={styles.iconButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="settings-outline" size={22} color={TEXT_COLOR} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.profileHeader}>
            <View style={styles.avatarWrapper}>
              <Image
                source={{
                  uri: profile.logo_url && /^https?:\/\//.test(profile.logo_url)
                    ? profile.logo_url
                    : `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || 'Community')}&background=5f27cd&color=FFFFFF&size=120&bold=true`,
                }}
                style={styles.avatar}
              />
            </View>
            <Text style={styles.communityName}>{profile.name}</Text>
            {Array.isArray(profile.categories) && profile.categories.length > 0 && (
              <View style={styles.categoriesRow}>
                {profile.categories.map((cat) => (
                  <View key={cat} style={styles.categoryChip}>
                    <Text style={styles.categoryChipText}>{cat}</Text>
                  </View>
                ))}
              </View>
            )}

            {!!profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{postsCount}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            <TouchableOpacity
              style={styles.statItem}
              onPress={() => navigation.navigate('CommunityFollowersList', {
                communityId: profile.id,
                title: 'Followers',
              })}
            >
              <Text style={styles.statNumber}>{followersCount}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.statItem}
              onPress={() => navigation.navigate('CommunityFollowingList', {
                communityId: profile.id,
                title: 'Following',
              })}
            >
              <Text style={styles.statNumber}>{followingCount}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.editProfileButton}
            onPress={() => navigation.navigate('EditCommunityProfile', { profile })}
          >
            <Text style={styles.editProfileText}>Edit Profile</Text>
          </TouchableOpacity>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Community Heads</Text>
              <TouchableOpacity onPress={() => setHeadsModalVisible(true)}>
                <Ionicons name="pencil" size={20} color={PRIMARY_COLOR} />
              </TouchableOpacity>
            </View>
            {profile.heads && profile.heads.length > 0 ? (
              profile.heads.map((head, index) => {
                const canNavigate = !!head.member_id;
                return (
                  <TouchableOpacity
                    key={head.id || index}
                    onPress={() => handleHeadPress(head)}
                    disabled={!canNavigate}
                    style={[styles.headRow, !canNavigate && { opacity: 0.85 }]}
                  >
                    <Image
                      source={{
                        uri:
                          head.profile_pic_url ||
                          head.member_photo_url ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(head.name || 'Head')}&background=5f27cd&color=FFFFFF&size=64&bold=true`,
                      }}
                      style={styles.headAvatar}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.headName}>{head.name}</Text>
                      {head.is_primary && <Text style={styles.primaryTag}>Primary</Text>}
                      {head.email && <Text style={styles.headSub}>{head.email}</Text>}
                      {head.phone && <Text style={styles.headSub}>{formatPhoneNumber(head.phone)}</Text>}
                    </View>
                    {canNavigate && (
                      <Ionicons name="chevron-forward" size={18} color={LIGHT_TEXT_COLOR} />
                    )}
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text style={styles.emptyText}>No heads added yet</Text>
            )}
          </View>

          {profile.sponsor_types && profile.sponsor_types.length > 0 && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Looking for Sponsors</Text>
              <View style={styles.sponsorTypesList}>
                {profile.sponsor_types.map((type, index) => (
                  <View key={index} style={styles.sponsorTypeTag}>
                    <Text style={styles.sponsorTypeText}>{type}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        <View style={styles.postsSection}>
          <Text style={styles.sectionTitle}>Community Posts</Text>
          {posts.length > 0 ? (
            <View style={styles.postsGrid}>
              {posts.map((item, index) => {
                const gap = 10;
                const itemSize = (screenWidth - 40 - gap * 2) / 3;
                return (
                  <TouchableOpacity
                    key={item.id.toString()}
                    style={{
                      width: itemSize,
                      height: itemSize,
                      marginRight: (index + 1) % 3 === 0 ? 0 : gap,
                      marginBottom: gap,
                    }}
                    onPress={() => openPostModal(item)}
                  >
                    {(() => {
                      let firstImageUrl = null;
                      if (item?.image_urls) {
                        if (Array.isArray(item.image_urls)) {
                          const flatUrls = item.image_urls.flat();
                          firstImageUrl = flatUrls.find(u => typeof u === 'string' && u.startsWith('http'));
                        } else if (typeof item.image_urls === 'string' && item.image_urls.startsWith('http')) {
                          firstImageUrl = item.image_urls;
                        }
                      }
                      return firstImageUrl ? (
                        <Image
                          source={{ uri: firstImageUrl }}
                          style={{ width: '100%', height: '100%', backgroundColor: '#E5E5EA' }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={{ width: '100%', height: '100%', backgroundColor: '#E5E5EA', justifyContent: 'center', alignItems: 'center' }}>
                          <Ionicons name="image-outline" size={30} color={LIGHT_TEXT_COLOR} />
                        </View>
                      );
                    })()}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyPostsContainer}>
              <Text style={styles.emptyPostsText}>No posts yet</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <SettingsModal
        visible={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onNotificationsPress={() =>
          Alert.alert('Notifications', 'Notifications settings will be implemented soon!')
        }
        onPrivacyPress={() =>
          Alert.alert('Privacy', 'Privacy settings will be implemented soon!')
        }
        onHelpPress={() =>
          Alert.alert('Help', 'Help & Support will be implemented soon!')
        }
        onLogoutPress={handleLogout}
        onDeleteAccountPress={() => setShowDeleteModal(true)}
        textColor={TEXT_COLOR}
        lightTextColor={LIGHT_TEXT_COLOR}
      />

      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delete Account</Text>
              <TouchableOpacity onPress={() => setShowDeleteModal(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={TEXT_COLOR} />
              </TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
              <Text style={{ color: LIGHT_TEXT_COLOR, marginBottom: 12 }}>This is permanent and cannot be undone. Type "delete" to confirm.</Text>
              <TextInput
                value={deleteInput}
                onChangeText={setDeleteInput}
                placeholder="Type delete"
                autoCapitalize="none"
                style={{ borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16 }}
              />
              <TouchableOpacity
                disabled={deleting || deleteInput.trim().toLowerCase() !== 'delete'}
                onPress={async () => {
                  if (deleteInput.trim().toLowerCase() !== 'delete') return;
                  setDeleting(true);
                  try {
                    await apiDeleteAccount();
                    await clearAuthSession();
                    setShowDeleteModal(false);
                    navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
                  } catch (e) {
                    Alert.alert('Delete failed', e?.message || 'Could not delete account');
                  } finally {
                    setDeleting(false);
                  }
                }}
                style={{ backgroundColor: deleteInput.trim().toLowerCase() === 'delete' ? '#FF3B30' : '#FFAAA3', paddingVertical: 12, borderRadius: 10, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>{deleting ? 'Deleting...' : 'Delete Account'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <HeadsEditorModal
        visible={headsModalVisible}
        initialHeads={profile.heads || []}
        onCancel={() => setHeadsModalVisible(false)}
        onSave={handleHeadsSave}
        maxHeads={5}
      />

      {selectedPost && (
        <PostModal
          visible={postModalVisible}
          post={selectedPost}
          onClose={closePostModal}
          profile={profile}
          onLikeUpdate={handlePostLike}
          onOpenComments={openCommentsModal}
          onCloseComments={closeCommentsModal}
          navigation={navigation}
        />
      )}

      <CommentsModal
        visible={commentsModalState.visible}
        postId={commentsModalState.postId}
        onClose={closeCommentsModal}
        onCommentCountChange={(postId) => {
          // Update comment count in posts
          setPosts((prevPosts) =>
            prevPosts.map((p) =>
              p.id === postId
                ? { ...p, comment_count: (p.comment_count || 0) + 1 }
                : p
            )
          );
        }}
        navigation={navigation}
      />
    </SafeAreaView>
  );
}

// PostModal Component
const PostModal = ({
  visible,
  post,
  onClose,
  profile: profileProp,
  onLikeUpdate,
  onOpenComments,
  onCloseComments,
  navigation,
}) => {
  const initialIsLiked = post?.is_liked === true;
  const [likes, setLikes] = useState(post?.like_count || 0);
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [commentCount, setCommentCount] = useState(post?.comment_count || 0);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [localCommentsVisible, setLocalCommentsVisible] = useState(false);
  const justUpdatedRef = useRef(false);

  useEffect(() => {
    if (!visible) return;
    if (justUpdatedRef.current) {
      justUpdatedRef.current = false;
      return;
    }
    const newIsLiked = post?.is_liked === true;
    setIsLiked(newIsLiked);
    setLikes(post?.like_count || 0);
    setCommentCount(post?.comment_count || 0);
  }, [
    post?.is_liked,
    post?.isLiked,
    post?.like_count,
    post?.comment_count,
    visible,
  ]);

  useEffect(() => {
    if (!visible) {
      setShowDeleteMenu(false);
    }
  }, [visible]);

  const isOwnPost = () => {
    return (
      post?.author_id === profileProp?.id && post?.author_type === 'community'
    );
  };

  const handleDeletePost = async () => {
    if (!post?.id) return;
    if (!isOwnPost()) {
      Alert.alert('Error', 'You can only delete your own posts');
      setShowDeleteMenu(false);
      return;
    }
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => setShowDeleteMenu(false),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const token = await getAuthToken();
              await apiDelete(`/posts/${post.id}`, null, 15000, token);
              if (onCloseComments) onCloseComments();
              onClose();
              Alert.alert('Success', 'Post deleted successfully');
            } catch (error) {
              console.error('Error deleting post:', error);
              Alert.alert('Error', error?.message || 'Failed to delete post');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleLikeToggle = async () => {
    if (isLiking) return;
    setIsLiking(true);
    justUpdatedRef.current = true;
    try {
      const token = await getAuthToken();
      if (isLiked) {
        await apiDelete(`/posts/${post.id}/like`, null, 15000, token);
        setLikes((prev) => {
          const newCount = prev - 1;
          if (onLikeUpdate) {
            onLikeUpdate(post.id, false, newCount);
          }
          // Emit event for other screens to update
          EventBus.emit("post-like-updated", {
            postId: post.id,
            isLiked: false,
            likeCount: newCount,
            commentCount: commentCount,
          });
          return newCount;
        });
        setIsLiked(false);
      } else {
        await apiPost(`/posts/${post.id}/like`, {}, 15000, token);
        setLikes((prev) => {
          const newCount = prev + 1;
          if (onLikeUpdate) {
            onLikeUpdate(post.id, true, newCount);
          }
          // Emit event for other screens to update
          EventBus.emit("post-like-updated", {
            postId: post.id,
            isLiked: true,
            likeCount: newCount,
            commentCount: commentCount,
          });
          return newCount;
        });
        setIsLiked(true);
      }
    } catch (error) {
      console.error('Error liking post:', error);
      // Silently handle "Post already liked" and "Post not liked" errors
      const errorMessage = error?.message || '';
      if (errorMessage.includes('already liked') || errorMessage.includes('not liked')) {
        // These are expected errors when double-clicking, just ignore
        justUpdatedRef.current = false;
        return;
      }
      // Only show alert for unexpected errors
      // Alert.alert('Error', error?.message || 'Failed to like post');
      justUpdatedRef.current = false;
    } finally {
      setIsLiking(false);
      setTimeout(() => {
        justUpdatedRef.current = false;
      }, 100);
    }
  };

  if (!post) return null;
  const images = Array.isArray(post.image_urls)
    ? post.image_urls
        .flat()
        .filter((u) => typeof u === 'string' && u.startsWith('http'))
    : [];

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentPostId, setCurrentPostId] = useState(post?.id);
  useEffect(() => {
    if (post?.id && post.id !== currentPostId) {
      setCurrentPostId(post.id);
    }
  }, [post?.id]);

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <SafeAreaView style={postModalStyles.postModalSafeArea}>
        <View style={postModalStyles.postModalContainer}>
          <View style={postModalStyles.postModalHeader}>
            <View style={postModalStyles.postModalHeaderTop}>
              <TouchableOpacity
                onPress={onClose}
                style={postModalStyles.postModalBackButton}
              >
                <Ionicons name="arrow-back" size={24} color="#000" />
              </TouchableOpacity>
              <Text style={postModalStyles.postModalHeaderTitle}>Posts</Text>
              <TouchableOpacity
                style={postModalStyles.postModalMoreButton}
                onPress={() => {
                  if (isOwnPost()) {
                    setShowDeleteMenu(true);
                  }
                }}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color="#000" />
              </TouchableOpacity>
            </View>
            <View style={postModalStyles.postModalHeaderUserInfo}>
              <Image
                source={{
                  uri:
                    post.author_photo_url ||
                    post.author_logo_url ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      post.author_name || post.author_username || 'Community'
                    )}&background=5f27cd&color=FFFFFF`,
                }}
                style={postModalStyles.postModalHeaderAvatar}
              />
              <View style={postModalStyles.postModalHeaderText}>
                <Text style={postModalStyles.postModalHeaderUsername}>
                  {post.author_username || post.author_name || 'Community'}
                </Text>
                <Text style={postModalStyles.postModalHeaderDate}>
                  {formatDate(post.created_at)}
                </Text>
              </View>
            </View>
          </View>

          <ScrollView
            style={postModalStyles.postModalScrollView}
            showsVerticalScrollIndicator={false}
          >
            <View style={postModalStyles.postModalImageWrapper}>
              {images.length > 0 && (
                <>
                  <FlatList
                    data={images}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(_, idx) => idx.toString()}
                    onMomentumScrollEnd={(e) => {
                      const index = Math.round(
                        e.nativeEvent.contentOffset.x / screenWidth
                      );
                      setCurrentImageIndex(index);
                    }}
                    renderItem={({ item }) => (
                      <View style={postModalStyles.postModalImageFrame}>
                        <Image
                          source={{ uri: item }}
                          style={postModalStyles.postModalImage}
                          resizeMode="cover"
                        />
                      </View>
                    )}
                    style={postModalStyles.modalImageCarousel}
                  />
                  {images.length > 1 && (
                    <View style={postModalStyles.postModalImageIndicator}>
                      <Text style={postModalStyles.postModalImageIndicatorText}>
                        {currentImageIndex + 1}/{images.length}
                      </Text>
                    </View>
                  )}
                  {images.length > 1 && (
                    <View style={postModalStyles.postModalImageDots}>
                      {images.map((_, idx) => (
                        <View
                          key={idx}
                          style={[
                            postModalStyles.postModalDot,
                            idx === currentImageIndex &&
                              postModalStyles.postModalDotActive,
                          ]}
                        />
                      ))}
                    </View>
                  )}
                </>
              )}
            </View>

            <View style={postModalStyles.postModalActionsRow}>
              <TouchableOpacity
                onPress={handleLikeToggle}
                style={postModalStyles.modalActionButton}
                disabled={isLiking}
              >
                <Ionicons
                  name={isLiked ? 'heart' : 'heart-outline'}
                  size={28}
                  color={isLiked ? '#FF3040' : '#000'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setLocalCommentsVisible(true);
                }}
                style={postModalStyles.modalActionButton}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons
                    name="chatbubble-outline"
                    size={26}
                    color="#000"
                  />
                  {commentCount > 0 && (
                    <Text style={postModalStyles.postModalCommentCount}>
                      {commentCount}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            </View>

            {likes > 0 && (
              <View style={postModalStyles.postModalLikesSection}>
                <Text style={postModalStyles.postModalLikesText}>
                  {likes === 1 ? '1 like' : `${likes} likes`}
                </Text>
              </View>
            )}

            <View style={postModalStyles.postModalCaptionSection}>
              <MentionTextRenderer
                prefix={
                  <Text style={postModalStyles.postModalCaptionUsername}>
                    {post.author_username || post.author_name || 'Community'}
                  </Text>
                }
                text={post.caption || ''}
                taggedEntities={post?.tagged_entities}
                textStyle={postModalStyles.postModalCaption}
                mentionStyle={postModalStyles.postModalCaptionMention}
                onMentionPress={(entity) => {
                  if (!entity?.id) return;
                  const type = (entity.type || 'member').toLowerCase();
                  if (type === 'member') {
                    navigation.navigate('MemberPublicProfile', { memberId: entity.id });
                  } else if (type === 'community') {
                    navigation.navigate('CommunityPublicProfile', { communityId: entity.id });
                  } else if (type === 'sponsor') {
                    Alert.alert('Coming soon', 'Sponsor profile navigation will be available soon.');
                  } else if (type === 'venue') {
                    Alert.alert('Coming soon', 'Venue profile navigation will be available soon.');
                  }
                }}
              />
            </View>

            {commentCount > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setLocalCommentsVisible(true);
                }}
                style={postModalStyles.postModalViewCommentsButton}
              >
                <Text style={postModalStyles.postModalViewCommentsText}>
                  View all {commentCount}{' '}
                  {commentCount === 1 ? 'comment' : 'comments'}
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        <Modal
          visible={showDeleteMenu}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowDeleteMenu(false)}
        >
          <TouchableOpacity
            style={postModalStyles.deleteMenuOverlay}
            activeOpacity={1}
            onPress={() => setShowDeleteMenu(false)}
          >
            <View style={postModalStyles.deleteMenuContainer}>
              <TouchableOpacity
                style={[
                  postModalStyles.deleteMenuOption,
                  deleting && postModalStyles.deleteMenuOptionDisabled,
                ]}
                onPress={handleDeletePost}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#FF3B30" />
                ) : (
                  <>
                    <Ionicons
                      name="trash-outline"
                      size={20}
                      color="#FF3B30"
                    />
                    <Text style={postModalStyles.deleteMenuOptionText}>
                      Delete Post
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={postModalStyles.deleteMenuOption}
                onPress={() => setShowDeleteMenu(false)}
              >
                <Text style={postModalStyles.deleteMenuCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
      <CommentsModal
        visible={localCommentsVisible}
        postId={post?.id}
        onClose={() => setLocalCommentsVisible(false)}
        onCommentCountChange={(newCount) => setCommentCount(newCount)}
        isNestedModal={true}
        navigation={navigation}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  bannerContainer: {
    width: '100%',
    height: 180,
    backgroundColor: '#EFEFF4',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerPlaceholder: {
    backgroundColor: '#E5E5EA',
  },
  bannerEdit: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    padding: 8,
  },
  summarySection: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  handle: {
    fontSize: 18,
    color: LIGHT_TEXT_COLOR,
  },
  iconButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    padding: 6,
    borderRadius: 10,
  },
  profileHeader: {
    alignItems: 'center',
    gap: 8,
    marginTop: -50,
    marginBottom: 16,
  },
  avatarWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    backgroundColor: '#E5E5EA',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
  },
  communityName: {
    fontSize: 26,
    fontWeight: '700',
    color: TEXT_COLOR,
  },
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  categoryChip: {
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  categoryChipText: {
    fontSize: 13,
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: 13,
    color: LIGHT_TEXT_COLOR,
  },
  bio: {
    fontSize: 14,
    lineHeight: 22,
    color: TEXT_COLOR,
    textAlign: 'center',
    marginTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_COLOR,
  },
  statLabel: {
    fontSize: 13,
    color: LIGHT_TEXT_COLOR,
    marginTop: 4,
  },
  editProfileButton: {
    alignSelf: 'center',
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 16,
    marginBottom: 20,
  },
  editProfileText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  sponsorTypesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sponsorTypeTag: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sponsorTypeText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  headAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F2F2F7',
  },
  headName: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  primaryTag: {
    fontSize: 12,
    color: PRIMARY_COLOR,
    fontWeight: '600',
    marginTop: 2,
  },
  headSub: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginTop: 2,
  },
  emptyText: {
    color: LIGHT_TEXT_COLOR,
    fontSize: 14,
  },
  postsSection: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_COLOR,
  },
  closeButton: {
    padding: 5,
  },
  bannerPlaceholderText: {
    color: '#8E8E93',
    fontSize: 12,
    textAlign: 'center',
  },
  emptyPostsContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyPostsText: {
    color: LIGHT_TEXT_COLOR,
    fontSize: 14,
  },
});

const postModalStyles = StyleSheet.create({
  postModalSafeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  postModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  postModalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  postModalHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  postModalBackButton: {
    padding: 8,
    marginLeft: -8,
  },
  postModalHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  postModalHeaderUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postModalHeaderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  postModalHeaderText: {
    flex: 1,
  },
  postModalHeaderUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  postModalHeaderDate: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  postModalMoreButton: {
    padding: 8,
    marginLeft: 8,
  },
  postModalScrollView: {
    flex: 1,
  },
  postModalImageWrapper: {
    width: screenWidth,
    height: screenWidth,
    backgroundColor: '#000',
    position: 'relative',
  },
  modalImageCarousel: {
    width: screenWidth,
    height: screenWidth,
  },
  postModalImageFrame: {
    width: screenWidth,
    height: screenWidth,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  postModalImage: {
    width: screenWidth,
    height: screenWidth,
  },
  postModalImageIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  postModalImageIndicatorText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  postModalImageDots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  postModalDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  postModalDotActive: {
    backgroundColor: '#FFFFFF',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  postModalActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalActionButton: {
    padding: 8,
    marginRight: 16,
  },
  postModalCommentCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginLeft: 6,
  },
  postModalLikesSection: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  postModalLikesText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  postModalCaptionSection: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  postModalCaption: {
    fontSize: 14,
    color: '#000',
    lineHeight: 20,
  },
  postModalCaptionMention: {
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
  postModalCaptionUsername: {
    fontWeight: '600',
    color: '#000',
  },
  postModalViewCommentsButton: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  postModalViewCommentsText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  deleteMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  deleteMenuContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  deleteMenuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  deleteMenuOptionDisabled: {
    opacity: 0.5,
  },
  deleteMenuOptionText: {
    fontSize: 18,
    color: '#FF3B30',
    fontWeight: '600',
    marginLeft: 12,
  },
  deleteMenuCancelText: {
    fontSize: 18,
    color: '#000',
    fontWeight: '600',
  },
});
