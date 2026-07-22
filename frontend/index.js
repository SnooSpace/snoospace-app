import { registerRootComponent } from 'expo';
// ── 1.1 Screen Freeze — must run before ANY navigator mounts ─────────────────
// enableFreeze(true) tells react-native-screens to freeze (suspend) background
// stack screens so their effects and re-renders stop running while they are
// inactive. This is the single highest-leverage change in Phase 1.
import { enableFreeze } from 'react-native-screens';
enableFreeze(true);


import App from './App';

// Suppress console.log in production to avoid JS thread overhead
// console.warn and console.error are preserved for crash reporting
if (!__DEV__) {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
