import React, { useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNotifications } from "../../context/NotificationsContext";
import { followMember, unfollowMember } from "../../api/members";

export default function NotificationsScreen({ navigation }) {
  const { items, unread, loading, loadMore, markAllRead } = useNotifications();

  // Group notifications by user and type
  const groupedNotifications = React.useMemo(() => {
    const TIME_WINDOW = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const grouped = [];

    let i = 0;
    while (i < items.length) {
      const current = items[i];
      const group = {
        items: [current],
        type: current.type,
        actorId: current.actor_id,
        actorType: current.actor_type,
        latestTimestamp: current.created_at,
        payload: current.payload || {},
      };

      // Only group 'like' notifications
      if (current.type === "like") {
        let j = i + 1;
        while (j < items.length) {
          const next = items[j];
          const timeDiff =
            new Date(current.created_at) - new Date(next.created_at);

          if (
            next.type === "like" &&
            next.actor_id === current.actor_id &&
            next.actor_type === current.actor_type &&
            timeDiff <= TIME_WINDOW
          ) {
            group.items.push(next);
            j++;
          } else {
            break;
          }
        }
        i = j;
      } else {
        i++;
      }

      grouped.push(group);
    }

    return grouped;
  }, [items]);

  useEffect(() => {
    const t = setTimeout(() => {
      markAllRead();
    }, 500);
    return () => clearTimeout(t);
  }, [markAllRead]);

  const navigateToProfile = (actorId, actorType) => {
    if (actorType === "member") {
      navigation.navigate("MemberPublicProfile", { memberId: actorId });
    } else if (actorType === "community") {
      navigation.navigate("CommunityPublicProfile", { communityId: actorId });
    } else if (actorType === "sponsor") {
      // Navigate to sponsor profile if you have one
      navigation.navigate("SponsorProfile", { sponsorId: actorId });
    } else if (actorType === "venue") {
      // Navigate to venue profile if you have one
      navigation.navigate("VenueProfile", { venueId: actorId });
    }
  };

  const renderItem = ({ item: group }) => {
    const firstItem = group.items[0];
    const payload = firstItem.payload || {};
    const count = group.items.length;

    // Helper to navigate to event
    const navigateToEvent = (eventId) => {
      if (eventId) {
        navigation.navigate("EventDetailsScreen", { eventId });
      }
    };

    // Helper to get avatar source
    const getAvatarSource = () =>
      payload.actorAvatar
        ? { uri: payload.actorAvatar }
        : require("../../assets/icon.png");

    if (group.type === "follow") {
      return (
        <TouchableOpacity
          style={styles.row}
          onPress={() =>
            navigateToProfile(firstItem.actor_id, firstItem.actor_type)
          }
        >
          <Image source={getAvatarSource()} style={styles.avatar} />
          <View style={styles.rowBody}>
            <Text style={styles.title}>
              <Text style={styles.bold}>{payload.actorName || "Someone"}</Text>{" "}
              started following you
            </Text>
            <Text style={styles.time}>
              {new Date(firstItem.created_at).toLocaleString()}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    if (group.type === "like") {
      const likeText =
        count > 1 ? `liked ${count} of your posts` : "liked your post";
      return (
        <TouchableOpacity
          style={styles.row}
          onPress={() =>
            navigateToProfile(firstItem.actor_id, firstItem.actor_type)
          }
        >
          <Image source={getAvatarSource()} style={styles.avatar} />
          <View style={styles.rowBody}>
            <Text style={styles.title}>
              <Text style={styles.bold}>{payload.actorName || "Someone"}</Text>{" "}
              {likeText}
            </Text>
            <Text style={styles.time}>
              {new Date(firstItem.created_at).toLocaleString()}
            </Text>
          </View>
          <Ionicons
            name="heart"
            size={20}
            color="#FF3B30"
            style={styles.icon}
          />
        </TouchableOpacity>
      );
    }

    if (group.type === "comment") {
      const commentPreview = payload.commentText || "commented on your post";
      return (
        <TouchableOpacity
          style={styles.row}
          onPress={() =>
            navigateToProfile(firstItem.actor_id, firstItem.actor_type)
          }
        >
          <Image source={getAvatarSource()} style={styles.avatar} />
          <View style={styles.rowBody}>
            <Text style={styles.title}>
              <Text style={styles.bold}>{payload.actorName || "Someone"}</Text>{" "}
              commented: {commentPreview}
            </Text>
            <Text style={styles.time}>
              {new Date(firstItem.created_at).toLocaleString()}
            </Text>
          </View>
          <Ionicons
            name="chatbubble"
            size={18}
            color="#007AFF"
            style={styles.icon}
          />
        </TouchableOpacity>
      );
    }

    if (group.type === "tag") {
      return (
        <TouchableOpacity
          style={styles.row}
          onPress={() =>
            navigateToProfile(firstItem.actor_id, firstItem.actor_type)
          }
        >
          <Image source={getAvatarSource()} style={styles.avatar} />
          <View style={styles.rowBody}>
            <Text style={styles.title}>
              <Text style={styles.bold}>{payload.actorName || "Someone"}</Text>{" "}
              tagged you in a {payload.commentId ? "comment" : "post"}
            </Text>
            <Text style={styles.time}>
              {new Date(firstItem.created_at).toLocaleString()}
            </Text>
          </View>
          <Ionicons name="at" size={18} color="#34C759" style={styles.icon} />
        </TouchableOpacity>
      );
    }

    // EVENT REGISTRATION (for communities) - with collapsible logic
    if (group.type === "event_registration") {
      // Check if should be collapsed (30 min passed)
      const collapseAfter = payload.collapseAfter
        ? new Date(payload.collapseAfter)
        : null;
      const shouldCollapse =
        collapseAfter && new Date() > collapseAfter && count > 1;

      if (shouldCollapse) {
        return (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigateToEvent(payload.eventId)}
          >
            <View
              style={[
                styles.avatar,
                styles.iconContainer,
                { backgroundColor: "#34C75920" },
              ]}
            >
              <Ionicons name="ticket" size={22} color="#34C759" />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.title}>
                <Text style={styles.bold}>{count} people</Text> registered for "
                {payload.eventTitle}"
              </Text>
              <Text style={styles.time}>
                {new Date(firstItem.created_at).toLocaleString()}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color="#8E8E93"
              style={styles.icon}
            />
          </TouchableOpacity>
        );
      }

      return (
        <TouchableOpacity
          style={styles.row}
          onPress={() => navigateToEvent(payload.eventId)}
        >
          <Image source={getAvatarSource()} style={styles.avatar} />
          <View style={styles.rowBody}>
            <Text style={styles.title}>
              <Text style={styles.bold}>{payload.memberName || "Someone"}</Text>{" "}
              registered for "{payload.eventTitle}"
            </Text>
            <Text style={styles.time}>
              {new Date(firstItem.created_at).toLocaleString()}
            </Text>
          </View>
          <Ionicons
            name="ticket"
            size={18}
            color="#34C759"
            style={styles.icon}
          />
        </TouchableOpacity>
      );
    }

    // EVENT UPDATED
    if (group.type === "event_updated") {
      const changedText = payload.changedFields?.join(", ") || "details";
      return (
        <TouchableOpacity
          style={styles.row}
          onPress={() => navigateToEvent(payload.eventId)}
        >
          <View
            style={[
              styles.avatar,
              styles.iconContainer,
              { backgroundColor: "#FF950020" },
            ]}
          >
            <Ionicons name="create" size={22} color="#FF9500" />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.title}>
              <Text style={styles.bold}>{payload.communityName}</Text> updated{" "}
              {changedText} for "{payload.eventTitle}"
            </Text>
            <Text style={styles.time}>
              {new Date(firstItem.created_at).toLocaleString()}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    // EVENT RESCHEDULED
    if (group.type === "event_rescheduled") {
      const newDate = payload.newStartDateTime
        ? new Date(payload.newStartDateTime).toLocaleDateString("en-IN", {
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
          })
        : "TBD";
      return (
        <TouchableOpacity
          style={styles.row}
          onPress={() => navigateToEvent(payload.eventId)}
        >
          <View
            style={[
              styles.avatar,
              styles.iconContainer,
              { backgroundColor: "#FF3B3020" },
            ]}
          >
            <Ionicons name="calendar" size={22} color="#FF3B30" />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.title}>
              <Text style={styles.bold}>{payload.communityName}</Text>{" "}
              rescheduled "{payload.eventTitle}"
            </Text>
            <Text style={styles.subtitle}>New date: {newDate}</Text>
            <Text style={styles.time}>
              {new Date(firstItem.created_at).toLocaleString()}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    // EVENT REMINDERS (24h and 1h)
    if (
      group.type === "event_reminder_24h" ||
      group.type === "event_reminder_1h"
    ) {
      const isOnehour = group.type === "event_reminder_1h";
      const reminderText = isOnehour ? "starts in 1 hour!" : "is tomorrow!";
      return (
        <TouchableOpacity
          style={styles.row}
          onPress={() => navigateToEvent(payload.eventId)}
        >
          <View
            style={[
              styles.avatar,
              styles.iconContainer,
              { backgroundColor: "#007AFF20" },
            ]}
          >
            <Ionicons
              name={isOnehour ? "alarm" : "calendar"}
              size={22}
              color="#007AFF"
            />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.title}>
              <Text style={styles.bold}>{payload.eventTitle}</Text>{" "}
              {reminderText}
            </Text>
            {payload.eventDate && payload.eventTime && (
              <Text style={styles.subtitle}>
                {payload.eventDate} at {payload.eventTime}
              </Text>
            )}
            <Text style={styles.time}>
              {new Date(firstItem.created_at).toLocaleString()}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    // TICKETS SOLD OUT
    if (group.type === "tickets_sold_out") {
      return (
        <TouchableOpacity
          style={styles.row}
          onPress={() => navigateToEvent(payload.eventId)}
        >
          <View
            style={[
              styles.avatar,
              styles.iconContainer,
              { backgroundColor: "#8E8E9320" },
            ]}
          >
            <Ionicons name="alert-circle" size={22} color="#8E8E93" />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.title}>
              Tickets for{" "}
              <Text style={styles.bold}>"{payload.eventTitle}"</Text> are now
              sold out
            </Text>
            <Text style={styles.time}>
              {new Date(firstItem.created_at).toLocaleString()}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    // REFUND PROCESSED
    if (group.type === "refund_processed") {
      return (
        <TouchableOpacity
          style={styles.row}
          onPress={() => navigateToEvent(payload.eventId)}
        >
          <View
            style={[
              styles.avatar,
              styles.iconContainer,
              { backgroundColor: "#34C75920" },
            ]}
          >
            <Ionicons name="cash" size={22} color="#34C759" />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.title}>
              Your refund of{" "}
              <Text style={styles.bold}>
                ₹{payload.refundAmount?.toLocaleString("en-IN")}
              </Text>{" "}
              has been processed
            </Text>
            <Text style={styles.subtitle}>For: {payload.eventTitle}</Text>
            <Text style={styles.time}>
              {new Date(firstItem.created_at).toLocaleString()}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    // EVENT DELETED
    if (group.type === "event_deleted") {
      return (
        <View style={styles.row}>
          <View
            style={[
              styles.avatar,
              styles.iconContainer,
              { backgroundColor: "#FF3B3020" },
            ]}
          >
            <Ionicons name="trash" size={22} color="#FF3B30" />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.title}>
              The event <Text style={styles.bold}>"{payload.eventTitle}"</Text>{" "}
              has been deleted
            </Text>
            <Text style={styles.time}>
              {new Date(firstItem.created_at).toLocaleString()}
            </Text>
          </View>
        </View>
      );
    }

    // EVENT CANCELLED
    if (group.type === "event_cancelled") {
      return (
        <View style={styles.row}>
          <View
            style={[
              styles.avatar,
              styles.iconContainer,
              { backgroundColor: "#FF950020" },
            ]}
          >
            <Ionicons name="close-circle" size={22} color="#FF9500" />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.title}>
              <Text style={styles.bold}>{payload.community_name}</Text>{" "}
              cancelled "{payload.event_title}"
            </Text>
            <Text style={styles.time}>
              {new Date(firstItem.created_at).toLocaleString()}
            </Text>
          </View>
        </View>
      );
    }

    // TICKET GIFTED - Member received free tickets
    if (group.type === "ticket_gifted") {
      return (
        <TouchableOpacity
          style={styles.row}
          onPress={() => navigateToEvent(payload.referenceId)}
        >
          <View
            style={[
              styles.avatar,
              styles.iconContainer,
              { backgroundColor: "#FF69B420" },
            ]}
          >
            <Ionicons name="gift" size={22} color="#FF69B4" />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.title}>
              <Text style={styles.bold}>
                {payload.title || "🎁 Gift Received!"}
              </Text>
            </Text>
            <Text style={styles.subtitle}>{payload.message}</Text>
            <Text style={styles.time}>
              {new Date(firstItem.created_at).toLocaleString()}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color="#8E8E93"
            style={styles.icon}
          />
        </TouchableOpacity>
      );
    }

    // EVENT INVITE - Member invited to paid event
    if (group.type === "event_invite") {
      return (
        <TouchableOpacity
          style={styles.row}
          onPress={() => navigateToEvent(payload.referenceId)}
        >
          <View
            style={[
              styles.avatar,
              styles.iconContainer,
              { backgroundColor: "#007AFF20" },
            ]}
          >
            <Ionicons name="mail" size={22} color="#007AFF" />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.title}>
              <Text style={styles.bold}>
                {payload.title || "You're Invited!"}
              </Text>
            </Text>
            <Text style={styles.subtitle}>{payload.message}</Text>
            <Text style={styles.time}>
              {new Date(firstItem.created_at).toLocaleString()}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color="#8E8E93"
            style={styles.icon}
          />
        </TouchableOpacity>
      );
    }

    // GIFT REVOKED - Member's ticket was revoked
    if (group.type === "gift_revoked") {
      return (
        <View style={styles.row}>
          <View
            style={[
              styles.avatar,
              styles.iconContainer,
              { backgroundColor: "#FF3B3020" },
            ]}
          >
            <Ionicons name="close-circle" size={22} color="#FF3B30" />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.title}>
              <Text style={styles.bold}>
                {payload.title || "Ticket Revoked"}
              </Text>
            </Text>
            <Text style={styles.subtitle}>{payload.message}</Text>
            <Text style={styles.time}>
              {new Date(firstItem.created_at).toLocaleString()}
            </Text>
          </View>
        </View>
      );
    }

    // INVITE REQUEST - Community received invite request
    if (group.type === "invite_request") {
      return (
        <TouchableOpacity
          style={styles.row}
          onPress={() => navigateToEvent(payload.referenceId)}
        >
          <View
            style={[
              styles.avatar,
              styles.iconContainer,
              { backgroundColor: "#FF950020" },
            ]}
          >
            <Ionicons name="hand-left" size={22} color="#FF9500" />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.title}>
              <Text style={styles.bold}>
                {payload.title || "Invite Request"}
              </Text>
            </Text>
            <Text style={styles.subtitle}>{payload.message}</Text>
            <Text style={styles.time}>
              {new Date(firstItem.created_at).toLocaleString()}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color="#8E8E93"
            style={styles.icon}
          />
        </TouchableOpacity>
      );
    }

    // INVITE APPROVED - Member's invite request was approved
    if (group.type === "invite_approved") {
      return (
        <TouchableOpacity
          style={styles.row}
          onPress={() => navigateToEvent(payload.referenceId)}
        >
          <View
            style={[
              styles.avatar,
              styles.iconContainer,
              { backgroundColor: "#34C75920" },
            ]}
          >
            <Ionicons name="checkmark-circle" size={22} color="#34C759" />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.title}>
              <Text style={styles.bold}>
                {payload.title || "Invite Approved!"}
              </Text>
            </Text>
            <Text style={styles.subtitle}>{payload.message}</Text>
            <Text style={styles.time}>
              {new Date(firstItem.created_at).toLocaleString()}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color="#8E8E93"
            style={styles.icon}
          />
        </TouchableOpacity>
      );
    }

    // INVITE DECLINED - Member's invite request was declined
    if (group.type === "invite_declined") {
      return (
        <View style={styles.row}>
          <View
            style={[
              styles.avatar,
              styles.iconContainer,
              { backgroundColor: "#8E8E9320" },
            ]}
          >
            <Ionicons name="remove-circle" size={22} color="#8E8E93" />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.title}>
              <Text style={styles.bold}>
                {payload.title || "Invite Declined"}
              </Text>
            </Text>
            <Text style={styles.subtitle}>{payload.message}</Text>
            <Text style={styles.time}>
              {new Date(firstItem.created_at).toLocaleString()}
            </Text>
          </View>
        </View>
      );
    }

    // TICKET GIFTED - Navigate to chat to see the ticket card
    if (group.type === "ticket_gifted" || group.type === "event_invite") {
      const hasConversation = payload.conversationId;
      return (
        <TouchableOpacity
          style={styles.row}
          onPress={() => {
            if (hasConversation) {
              // Navigate to chat with the community that sent the ticket
              navigation.navigate("Chat", {
                conversationId: payload.conversationId,
              });
            } else {
              // Fallback to event details
              navigateToEvent(payload.eventId || firstItem.reference_id);
            }
          }}
        >
          <View
            style={[
              styles.avatar,
              styles.iconContainer,
              { backgroundColor: "#007AFF20" },
            ]}
          >
            <Ionicons name="ticket" size={22} color="#007AFF" />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.title}>
              <Text style={styles.bold}>
                {payload.title || "🎫 You received a ticket!"}
              </Text>
            </Text>
            <Text style={styles.subtitle}>{payload.message}</Text>
            <Text style={styles.time}>
              {new Date(firstItem.created_at).toLocaleString()}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color="#8E8E93"
            style={styles.icon}
          />
        </TouchableOpacity>
      );
    }

    // Fallback for unknown types
    return null;
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color="#1D1D1F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>
      <FlatList
        data={groupedNotifications}
        renderItem={renderItem}
        keyExtractor={(group, index) => `group-${index}-${group.items[0]?.id}`}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>No notifications</Text> : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    color: "#1D1D1F",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  iconContainer: { alignItems: "center", justifyContent: "center" },
  rowBody: { flex: 1 },
  title: { color: "#1D1D1F" },
  subtitle: { color: "#8E8E93", fontSize: 13, marginTop: 2 },
  bold: { fontWeight: "600" },
  time: { color: "#8E8E93", fontSize: 12, marginTop: 4 },
  icon: { marginLeft: 8 },
  empty: { textAlign: "center", marginTop: 40, color: "#8E8E93" },
});
