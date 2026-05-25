import { registerRootComponent } from 'expo';

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
