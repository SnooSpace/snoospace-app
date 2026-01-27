/**
 * VideoContext - Global Video Playback Controller
 *
 * Orchestrates video playback across the app to ensure:
 * - Only ONE video plays at a time (Instagram-like behavior)
 * - Proper cleanup when switching between videos
 * - App state management (background/foreground)
 * - Memory management through aggressive unloading
 */
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { AppState } from "react-native";

const VideoContext = createContext(null);

export const useVideoContext = () => {
  const context = useContext(VideoContext);
  if (!context) {
    // Return a safe default for components used outside provider
    return {
      activeVideoId: null,
      setActiveVideo: () => {},
      pauseAll: () => {},
      isVideoActive: () => false,
      registerVideo: () => () => {},
    };
  }
  return context;
};

export const VideoProvider = ({ children }) => {
  // Currently playing video ID
  const [activeVideoId, setActiveVideoId] = useState(null);

  // Track if app is in foreground
  const [isAppActive, setIsAppActive] = useState(true);

  // Store previous active video (for resuming after fullscreen)
  const previousActiveIdRef = useRef(null);

  // Registry of all mounted video refs for cleanup
  const videoRegistryRef = useRef(new Map());

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const isActive = nextState === "active";
      setIsAppActive(isActive);

      if (!isActive) {
        // App going to background - pause all videos
        pauseAllVideos();
      }
    });

    return () => subscription?.remove();
  }, []);

  // Set active video (the one that should be playing)
  const setActiveVideo = useCallback(
    (videoId) => {
      if (videoId === activeVideoId) return;

      console.log("[VideoContext] Setting active video:", videoId);
      previousActiveIdRef.current = activeVideoId;
      setActiveVideoId(videoId);
    },
    [activeVideoId],
  );

  // Pause all videos (for app background, modal open, etc.)
  const pauseAllVideos = useCallback(() => {
    console.log("[VideoContext] Pausing all videos");
    setActiveVideoId(null);
  }, []);

  // Check if a specific video should be playing
  const isVideoActive = useCallback(
    (videoId) => {
      return isAppActive && activeVideoId === videoId;
    },
    [isAppActive, activeVideoId],
  );

  // Register a video component (for cleanup tracking)
  const registerVideo = useCallback((videoId, ref) => {
    videoRegistryRef.current.set(videoId, ref);
    return () => {
      videoRegistryRef.current.delete(videoId);
    };
  }, []);

  // Resume previous video (after closing fullscreen modal)
  const resumePreviousVideo = useCallback(() => {
    if (previousActiveIdRef.current) {
      setActiveVideoId(previousActiveIdRef.current);
    }
  }, []);

  const value = {
    activeVideoId,
    setActiveVideo,
    pauseAll: pauseAllVideos,
    isVideoActive,
    registerVideo,
    resumePreviousVideo,
    isAppActive,
  };

  return (
    <VideoContext.Provider value={value}>{children}</VideoContext.Provider>
  );
};

export default VideoContext;
