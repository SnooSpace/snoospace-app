// Backward compatibility wrapper for UniversalFollowersScreen
import UniversalFollowersScreen from "../UniversalFollowersScreen";

export default function FollowersListScreen({ route, navigation }) {
  // Extract memberId from route params and pass as userId with userType="member"
  const memberId = route?.params?.memberId;
  const title = route?.params?.title;

  return UniversalFollowersScreen({
    route: {
      ...route,
      params: {
        ...route?.params,
        userId: memberId,
        userType: "member",
        title,
      },
    },
    navigation,
  });
}
