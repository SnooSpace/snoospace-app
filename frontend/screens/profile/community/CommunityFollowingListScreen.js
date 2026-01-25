// Backward compatibility wrapper for UniversalFollowingScreen
import UniversalFollowingScreen from "../UniversalFollowingScreen";

export default function CommunityFollowingListScreen({ route, navigation }) {
  // Extract communityId from route params and pass as userId with userType="community"
  const communityId = route?.params?.communityId;
  const title = route?.params?.title;

  return UniversalFollowingScreen({
    route: {
      ...route,
      params: {
        ...route?.params,
        userId: communityId,
        userType: "community",
        title,
      },
    },
    navigation,
  });
}
