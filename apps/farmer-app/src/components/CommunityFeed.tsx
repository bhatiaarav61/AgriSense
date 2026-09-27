/**
 * Community Feed Component
 * Social features: posts, disease reports, market prices, Q&A, success stories
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Image,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';
import { CommunityPost } from '@/services/database';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

interface CommunityFeedProps {
  regionId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  onPostCreated?: (post: CommunityPost) => void;
}

type PostType = 'disease_report' | 'treatment_success' | 'market_price' | 'question' | 'general';

const POST_TYPES: Array<{ value: PostType; label: string; icon: string; color: string }> = [
  { value: 'disease_report', label: 'Disease Report', icon: 'warning', color: '#EF4444' },
  { value: 'treatment_success', label: 'Treatment Success', icon: 'checkmark-circle', color: '#10B981' },
  { value: 'market_price', label: 'Market Price', icon: 'cash', color: '#F59E0B' },
  { value: 'question', label: 'Ask Question', icon: 'help-circle', color: '#3B82F6' },
  { value: 'general', label: 'General', icon: 'chatbubbles', color: '#8B5CF6' },
];

export const CommunityFeed: React.FC<CommunityFeedProps> = ({
  regionId,
  userId,
  userName,
  userAvatar,
  onPostCreated,
}) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [selectedType, setSelectedType] = useState<PostType>('general');
  const [postContent, setPostContent] = useState('');
  const [postImages, setPostImages] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [showComments, setShowComments] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  // Load posts
  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const { getCommunityPosts } = await import('@/services/database');
      const data = await getCommunityPosts(regionId, 20, 0);
      setPosts(data);
    } catch (err) {
      console.error('Failed to load posts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [regionId]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // Create post
  const handleCreatePost = useCallback(async () => {
    if (!postContent.trim() && postImages.length === 0) {
      Alert.alert('Empty Post', 'Please add some content or images');
      return;
    }

    setCreating(true);
    try {
      const { createCommunityPost } = await import('@/services/database');
      const id = await createCommunityPost({
        user_id: userId,
        user_name: userName,
        user_avatar: userAvatar,
        type: selectedType,
        title: postContent.slice(0, 50) + (postContent.length > 50 ? '...' : ''),
        content: postContent,
        image_uris: postImages.length > 0 ? JSON.stringify(postImages) : undefined,
        region_id: regionId,
        location_name: 'Current Location', // Would get from GPS
      });

      // Refresh posts
      await loadPosts();

      // Reset form
      setPostContent('');
      setPostImages([]);
      setShowCreatePost(false);
      setSelectedType('general');

      onPostCreated?.({
        id,
        user_id: userId,
        user_name: userName,
        user_avatar: userAvatar,
        type: selectedType,
        title: postContent.slice(0, 50),
        content: postContent,
        image_uris: postImages.length > 0 ? JSON.stringify(postImages) : undefined,
        region_id: regionId,
        likes_count: 0,
        comments_count: 0,
        is_pinned: 0,
        created_at: new Date().toISOString(),
        synced: 0,
      });
    } catch (err) {
      Alert.alert('Error', 'Failed to create post');
    } finally {
      setCreating(false);
    }
  }, [postContent, postImages, selectedType, userId, userName, userAvatar, regionId, loadPosts, onPostCreated]);

  // Like post
  const handleLike = useCallback((postId: string) => {
    setPosts(prev => prev.map(post => {
      if (post.id === postId) {
        const liked = !post.liked_by_current_user;
        return {
          ...post,
          likes_count: liked ? post.likes_count + 1 : post.likes_count - 1,
          liked_by_current_user: liked,
        };
      }
      return post;
    }));
  }, []);

  // Toggle comments
  const toggleComments = useCallback((postId: string) => {
    setShowComments(prev => prev === postId ? null : postId);
  }, []);

  // Add image
  const addImage = useCallback(async () => {
    if (postImages.length >= 4) {
      Alert.alert('Limit Reached', 'Maximum 4 images per post');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      // Resize for upload
      const resized = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      setPostImages(prev => [...prev, resized.uri]);
    }
  }, [postImages.length]);

  // Remove image
  const removeImage = useCallback((index: number) => {
    setPostImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Format time
  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const getTypeColor = (type: string): string => {
    const typeInfo = POST_TYPES.find(t => t.value === type);
    return typeInfo?.color || theme.primary;
  };

  const getTypeIcon = (type: string): string => {
    const typeInfo = POST_TYPES.find(t => t.value === type);
    return typeInfo?.icon || 'chatbubbles';
  };

  const renderPost = ({ item }: { item: CommunityPost }) => {
    const isExpanded = expandedPosts.has(item.id);
    const showFullContent = isExpanded || item.content.length < 200;

    return (
      <View style={styles.postCard} key={item.id}>
        {/* Header */}
        <View style={styles.postHeader}>
          <View style={styles.postAvatar}>
            {item.user_avatar ? (
              <Image source={{ uri: item.user_avatar }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{item.user_name?.charAt(0).toUpperCase() || 'U'}</Text>
            )}
          </View>
          <View style={styles.postUserInfo}>
            <View style={styles.postUserRow}>
              <Text style={[styles.postUserName, { color: theme.textPrimary }]}>
                {item.user_name}
              </Text>
              <Text style={[styles.postTime, { color: theme.textTertiary }]}>
                {formatTime(item.created_at)}
              </Text>
            </View>
            <View style={styles.postTypeRow}>
              <View
                style={[
                  styles.postTypeBadge,
                  { backgroundColor: `${getTypeColor(item.type)}15` },
                ]}
              >
                <Ionicons
                  name={getTypeIcon(item.type)}
                  size={12}
                  color={getTypeColor(item.type)}
                />
                <Text
                  style={[
                    styles.postTypeText,
                    { color: getTypeColor(item.type) },
                  ]}
                >
                  {POST_TYPES.find(t => t.value === item.type)?.label || item.type}
                </Text>
              </View>
              {item.location_name && (
                <View style={styles.postLocation}>
                  <Ionicons name="location" size={12} color={theme.textTertiary} />
                  <Text style={[styles.postLocationText, { color: theme.textTertiary }]}>
                    {item.location_name}
                  </Text>
                </View>
              )}
            </View>
          </View>
          {item.is_pinned && (
            <Ionicons name="pin" size={18} color={theme.warning} />
          )}
        </View>

        {/* Content */}
        <View style={styles.postContent}>
          <Text style={[styles.postText, { color: theme.textPrimary }]}>
            {showFullContent ? item.content : item.content.slice(0, 200) + '...'}
          </Text>
          {!showFullContent && (
            <TouchableOpacity
              style={styles.expandButton}
              onPress={() => setExpandedPosts(prev => new Set([...prev, item.id]))}
            >
              <Text style={[styles.expandText, { color: theme.primary }]}>Read more</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Images */}
        {item.image_uris && (
          <View style={styles.postImages}>
            {JSON.parse(item.image_uris).map((uri: string, index: number) => (
              <Image key={index} source={{ uri }} style={styles.postImage} />
            ))}
          </View>
        )}

        {/* Disease/Crop Tags */}
        {(item.disease_id || item.crop_id) && (
          <View style={styles.postTags}>
            {item.disease_id && (
              <View style={[styles.tag, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="leaf" size={12} color={theme.error} />
                <Text style={{ color: theme.error, fontSize: 11, fontWeight: '500' }}>
                  {item.disease_id.replace(/_/g, ' ')}
                </Text>
              </View>
            )}
            {item.crop_id && (
              <View style={[styles.tag, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="leaf" size={12} color={theme.primary} />
                <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '500' }}>
                  {item.crop_id}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Actions */}
        <View style={styles.postActions}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              item.liked_by_current_user && styles.actionButtonActive,
            ]}
            onPress={() => handleLike(item.id)}
          >
            <Ionicons
              name={item.liked_by_current_user ? 'heart' : 'heart-outline'}
              size={20}
              color={item.liked_by_current_user ? theme.error : theme.textSecondary}
            />
            <Text
              style={[
                styles.actionText,
                { color: item.liked_by_current_user ? theme.error : theme.textSecondary },
              ]}
            >
              {item.likes_count}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => toggleComments(item.id)}
          >
            <Ionicons
              name={showComments === item.id ? 'chatbubbles' : 'chatbubble-outline'}
              size={20}
              color={showComments === item.id ? theme.primary : theme.textSecondary}
            />
            <Text
              style={[
                styles.actionText,
                { color: showComments === item.id ? theme.primary : theme.textSecondary },
              ]}
            >
              {item.comments_count}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="share" size={20} color={theme.textSecondary} />
            <Text style={[styles.actionText, { color: theme.textSecondary }]}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* Comments Section */}
        {showComments === item.id && (
          <View style={styles.commentsSection}>
            <View style={styles.commentInputRow}>
              <View style={styles.commentAvatar}>
                {userAvatar ? (
                  <Image source={{ uri: userAvatar }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>{userName?.charAt(0).toUpperCase() || 'U'}</Text>
                )}
              </View>
              <View style={styles.commentInputContainer}>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Write a comment..."
                  value={commentText}
                  onChangeText={setCommentText}
                  maxLength={500}
                  multiline
                />
                <TouchableOpacity
                  style={styles.commentSend}
                  onPress={() => {
                    // Submit comment
                    setCommentText('');
                  }}
                >
                  <Ionicons name="send" size={20} color={theme.primary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderCreatePostModal = () => {
    if (!showCreatePost) return null;

    return (
      <Modal visible={showCreatePost} animationType="slide" transparent onRequestClose={() => setShowCreatePost(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
          keyboardVerticalOffset={50}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowCreatePost(false)}>
                <Ionicons name="close" size={28} color={theme.textSecondary} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                Create Post
              </Text>
              <TouchableOpacity
                style={[
                  styles.modalSubmit,
                  (postContent.trim() || postImages.length > 0) && !creating && styles.modalSubmitActive,
                ]}
                onPress={handleCreatePost}
                disabled={creating || (!postContent.trim() && postImages.length === 0)}
              >
                <Text style={styles.modalSubmitText}>
                  {creating ? 'Posting...' : 'Post'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Type Selector */}
            <View style={styles.typeSelector}>
              {POST_TYPES.map(type => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.typeButton,
                    selectedType === type.value && styles.typeButtonSelected,
                    { borderColor: type.color },
                  ]}
                  onPress={() => setSelectedType(type.value)}
                >
                  <Ionicons name={type.icon} size={20} color={selectedType === type.value ? type.color : theme.textSecondary} />
                  <Text
                    style={[
                      styles.typeButtonText,
                      { color: selectedType === type.value ? type.color : theme.textSecondary },
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Text Input */}
            <TextInput
              style={styles.postInput}
              placeholder="What's happening in your field?"
              value={postContent}
              onChangeText={setPostContent}
              multiline
              maxLength={2000}
              placeholderTextColor={theme.textTertiary}
            />

            {/* Images */}
            {postImages.length > 0 && (
              <View style={styles.postImagesPreview}>
                {postImages.map((uri, index) => (
                  <View key={index} style={styles.previewImageWrapper}>
                    <Image source={{ uri }} style={styles.previewImage} />
                    <TouchableOpacity style={styles.removeImage} onPress={() => removeImage(index)}>
                      <Ionicons name="close-circle" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
                {postImages.length < 4 && (
                  <TouchableOpacity style={styles.addImageButton} onPress={addImage}>
                    <Ionicons name="add" size={28} color={theme.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {postImages.length === 0 && (
              <TouchableOpacity style={styles.addImageButton} onPress={addImage}>
                <Ionicons name="add" size={28} color={theme.textSecondary} />
                <Text style={{ color: theme.textSecondary, marginTop: 4, fontSize: 12 }}>Add Photos</Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      {/* Create Post Button */}
      <TouchableOpacity style={styles.createPostButton} onPress={() => setShowCreatePost(true)}>
        <View style={styles.createPostHeader}>
          <View style={styles.createPostAvatar}>
            {userAvatar ? (
              <Image source={{ uri: userAvatar }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{userName?.charAt(0).toUpperCase() || 'U'}</Text>
            )}
          </View>
          <Text style={[styles.createPostPlaceholder, { color: theme.textSecondary }]}>
            Share an update, ask a question, or report a disease
          </Text>
        </View>
        <View style={styles.createPostActions}>
          <TouchableOpacity style={styles.createPostAction} onPress={() => { setSelectedType('disease_report'); setShowCreatePost(true); }}>
            <Ionicons name="warning" size={20} color={theme.error} />
            <Text style={{ color: theme.error, fontSize: 12, fontWeight: '500' }}>Disease</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.createPostAction} onPress={() => { setSelectedType('question'); setShowCreatePost(true); }}>
            <Ionicons name="help-circle" size={20} color={theme.info} />
            <Text style={{ color: theme.info, fontSize: 12, fontWeight: '500' }}>Question</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.createPostAction} onPress={() => { setSelectedType('market_price'); setShowCreatePost(true); }}>
            <Ionicons name="cash" size={20} color={theme.warning} />
            <Text style={{ color: theme.warning, fontSize: 12, fontWeight: '500' }}>Price</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* Posts List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <Ionicons name="refresh" size={32} color={theme.primary} />
          <Text style={{ color: theme.textSecondary, marginTop: 8 }}>Loading community posts...</Text>
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={48} color={theme.textTertiary} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No posts yet in your area
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.textTertiary }]}>
            Be the first to share an update!
          </Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          renderItem={renderPost}
          keyExtractor={item => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={loadPosts} />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={theme.textTertiary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No posts yet in your area
              </Text>
            </View>
          }
        />
      )}

      {renderCreatePostModal()}
    </View>
  );
};

import { RefreshControl } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  createPostButton: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  createPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  createPostAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  createPostPlaceholder: {
    flex: 1,
    fontSize: 15,
  },
  createPostActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  createPostAction: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
  },

  // Post Card
  postCard: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    gap: 12,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  postUserInfo: { flex: 1 },
  postUserRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  postUserName: {
    fontSize: 15,
    fontWeight: '600',
  },
  postTime: {
    fontSize: 12,
  },
  postTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  postTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  postTypeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  postLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  postLocationText: {
    fontSize: 12,
  },
  postContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  postText: {
    fontSize: 14,
    lineHeight: 22,
  },
  expandButton: {
    marginTop: 4,
  },
  expandText: {
    fontSize: 13,
    fontWeight: '500',
  },
  postImages: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  postImage: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  postTags: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  postActions: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  actionButtonActive: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  commentsSection: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    padding: 16,
    backgroundColor: '#F9FAFB',
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  commentInput: {
    flex: 1,
    fontSize: 14,
    maxHeight: 100,
  },
  commentSend: {
    padding: 4,
  },

  // Create Post Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubmit: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 20,
  },
  modalSubmitActive: {
    backgroundColor: '#10B981',
  },
  modalSubmitText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#999',
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  typeButtonSelected: {
    backgroundColor: '#ECFDF5',
  },
  typeButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  postInput: {
    padding: 16,
    fontSize: 15,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  postImagesPreview: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    flexWrap: 'wrap',
  },
  previewImageWrapper: {
    position: 'relative',
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
  },
  removeImage: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageButton: {
    width: 80,
    height: 80,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Loading & Empty
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  listContent: {
    paddingBottom: 100,
  },
});

export default CommunityFeed;