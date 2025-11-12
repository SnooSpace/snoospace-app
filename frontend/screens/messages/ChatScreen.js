import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getMessages, sendMessage, getConversations } from '../../api/messages';
import { getPublicMemberProfile } from '../../api/members';
import EventBus from '../../utils/EventBus';

const PRIMARY_COLOR = '#6A0DAD';
const TEXT_COLOR = '#1D1D1F';
const LIGHT_TEXT_COLOR = '#8E8E93';

export default function ChatScreen({ route, navigation }) {
  const { conversationId, recipientId } = route.params || {};
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [recipient, setRecipient] = useState(null);
  const [currentConversationId, setCurrentConversationId] = useState(conversationId);
  const flatListRef = useRef(null);
  const subscriptionRef = useRef(null);
  const supabaseRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  
  // Swipe gesture handler
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only respond to horizontal swipes from the left edge
        // Don't interfere with FlatList scrolling
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && 
               Math.abs(gestureState.dx) > 10 &&
               evt.nativeEvent.pageX < 20; // Start from left edge
      },
      onPanResponderRelease: (evt, gestureState) => {
        // If swiped right (positive dx) and far enough, navigate back
        if (gestureState.dx > 100) {
          navigation.goBack();
        }
      },
    })
  ).current;

  // Get or create conversation
  useEffect(() => {
    const initializeConversation = async () => {
      try {
        if (conversationId) {
          setCurrentConversationId(conversationId);
          await loadMessages(conversationId);
        } else if (recipientId) {
          // Need to find or create conversation
          const conversationsRes = await getConversations();
          const existingConv = conversationsRes.conversations?.find(
            conv => conv.otherParticipant.id === recipientId
          );
          
          if (existingConv) {
            setCurrentConversationId(existingConv.id);
            await loadMessages(existingConv.id);
          } else {
            // Will create conversation when first message is sent
            setCurrentConversationId(null);
          }
          
          // Load recipient profile
          const recipientProfile = await getPublicMemberProfile(recipientId);
          setRecipient({
            id: recipientProfile.id,
            name: recipientProfile.full_name || recipientProfile.name,
            username: recipientProfile.username,
            profilePhotoUrl: recipientProfile.profile_photo_url,
          });
        }
      } catch (error) {
        console.error('Error initializing conversation:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeConversation();
  }, [conversationId, recipientId]);

  // Load recipient info if we have conversationId
  useEffect(() => {
    const loadRecipientFromConversation = async () => {
      if (conversationId && !recipient) {
        try {
          const conversationsRes = await getConversations();
          const conv = conversationsRes.conversations?.find(c => c.id === conversationId);
          if (conv) {
            setRecipient(conv.otherParticipant);
          }
        } catch (error) {
          console.error('Error loading recipient:', error);
        }
      }
    };

    loadRecipientFromConversation();
  }, [conversationId]);

  const loadMessages = async (convId) => {
    try {
      const response = await getMessages(convId);
      setMessages(response.messages || []);
      
      // Emit event to refresh unread count (messages are marked as read in getMessages)
      EventBus.emit('messages-read');
      
      // Scroll to bottom after loading
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  // Initialize Supabase client (optional - for realtime updates)
  useEffect(() => {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      // No Supabase config, skip realtime
      return;
    }
    
    (async () => {
      try {
        const mod = await import('@supabase/supabase-js');
        if (mod && mod.createClient) {
          supabaseRef.current = mod.createClient(url, key);
        }
      } catch (err) {
        // Supabase module not installed or failed to load - continue without realtime
        console.log('Supabase not available, realtime updates disabled');
      }
    })();
  }, []);

  // Set up realtime subscription or polling fallback
  useEffect(() => {
    if (!currentConversationId) return;

    // Try to use Supabase realtime if available
    if (supabaseRef.current) {
      // Subscribe to messages table changes
      const channel = supabaseRef.current
        .channel(`messages:${currentConversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${currentConversationId}`,
          },
          (payload) => {
            // Add new message to state
            const newMessage = payload.new;
            setMessages(prev => {
              // Check if message already exists
              if (prev.some(m => m.id === newMessage.id)) {
                return prev;
              }
              return [...prev, {
                id: newMessage.id,
                senderId: newMessage.sender_id,
                senderType: newMessage.sender_type,
                messageText: newMessage.message_text,
                isRead: newMessage.is_read,
                createdAt: newMessage.created_at,
              }];
            });
            
            // Scroll to bottom
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }
        )
        .subscribe();

      subscriptionRef.current = channel;

      return () => {
        if (subscriptionRef.current && supabaseRef.current) {
          supabaseRef.current.removeChannel(subscriptionRef.current);
        }
      };
    } else {
      // Fallback: Poll for new messages every 3 seconds
      const pollForMessages = async () => {
        try {
          const response = await getMessages(currentConversationId, { page: 1, limit: 50 });
          const newMessages = response.messages || [];
          
          setMessages(prev => {
            // Only update if we have new messages
            if (newMessages.length > prev.length) {
              return newMessages;
            }
            return prev;
          });
        } catch (error) {
          console.error('Error polling messages:', error);
        }
      };

      // Poll immediately and then every 3 seconds
      pollForMessages();
      pollingIntervalRef.current = setInterval(pollForMessages, 3000);

      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };
    }
  }, [currentConversationId]);

  const handleSend = async () => {
    if (!messageText.trim() || sending) return;

    const text = messageText.trim();
    setMessageText('');
    setSending(true);

    try {
      let convId = currentConversationId;
      
      // If no conversation exists, create one by sending message
      if (!convId && recipientId) {
        const response = await sendMessage(recipientId, text);
        convId = response.message.conversationId;
        setCurrentConversationId(convId);
        
        // Add message to state optimistically
        setMessages(prev => [...prev, response.message]);
      } else if (convId) {
        const response = await sendMessage(recipientId || recipient?.id, text);
        
        // Add message to state optimistically
        setMessages(prev => [...prev, response.message]);
      }
      
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessageText(text); // Restore text on error
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const renderMessage = ({ item, index }) => {
    const isMyMessage = item.senderId !== (recipient?.id || recipientId);
    const showAvatar = index === 0 || messages[index - 1]?.senderId !== item.senderId;
    
    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer,
        ]}
      >
        {!isMyMessage && showAvatar && (
          <Image
            source={{
              uri: recipient?.profilePhotoUrl || 'https://via.placeholder.com/30',
            }}
            style={styles.messageAvatar}
          />
        )}
        <View
          style={[
            styles.messageBubble,
            isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isMyMessage ? styles.myMessageText : styles.otherMessageText,
            ]}
          >
            {item.messageText}
          </Text>
          <Text
            style={[
              styles.messageTime,
              isMyMessage ? styles.myMessageTime : styles.otherMessageTime,
            ]}
          >
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loading...</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} {...panResponder.panHandlers}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
          {recipient && (
            <>
              <Image
                source={{
                  uri: recipient.profilePhotoUrl || 'https://via.placeholder.com/32',
                }}
                style={styles.headerAvatar}
              />
              <View style={styles.headerInfo}>
                <Text style={styles.headerName} numberOfLines={1}>
                  {recipient.name || 'User'}
                </Text>
                <Text style={styles.headerUsername} numberOfLines={1}>
                  @{recipient.username || 'user'}
                </Text>
              </View>
            </>
          )}
          <View style={{ width: 40 }} />
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Start the conversation!</Text>
            </View>
          }
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={LIGHT_TEXT_COLOR}
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!messageText.trim() || sending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!messageText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="send" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  headerUsername: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-end',
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  myMessageBubble: {
    backgroundColor: PRIMARY_COLOR,
  },
  otherMessageBubble: {
    backgroundColor: '#F2F2F7',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 4,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: TEXT_COLOR,
  },
  messageTime: {
    fontSize: 11,
    alignSelf: 'flex-end',
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherMessageTime: {
    color: LIGHT_TEXT_COLOR,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_COLOR,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 15,
    color: TEXT_COLOR,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PRIMARY_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: LIGHT_TEXT_COLOR,
  },
});

