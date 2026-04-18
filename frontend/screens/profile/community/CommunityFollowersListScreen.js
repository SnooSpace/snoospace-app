// Backward compatibility wrapper for UniversalFollowersScreen
import UniversalFollowersScreen from "../UniversalFollowersScreen";

export default function CommunityFollowersListScreen({ route, navigation }) {
  // Extract communityId from route params and pass as userId with userType="community"
  const communityId = route?.params?.communityId;
  const title = route?.params?.title;

  return UniversalFollowersScreen({
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
