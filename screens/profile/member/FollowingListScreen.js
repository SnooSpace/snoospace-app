// Backward compatibility wrapper for UniversalFollowingScreen
import UniversalFollowingScreen from "../UniversalFollowingScreen";

export default function FollowingListScreen({ route, navigation }) {
  // Extract memberId from route params and pass as userId with userType="member"
  const memberId = route?.params?.memberId;
  const title = route?.params?.title;

  return UniversalFollowingScreen({
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
