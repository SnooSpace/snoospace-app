---
description: Fix keyboard-aware bottom toolbar/input bar padding issues
---

# Fixing Keyboard-Aware Bottom Toolbar Issues

This workflow fixes common issues with bottom toolbars/input bars that need to move with the keyboard:

- Toolbar padding not resetting after keyboard dismissal
- Gap between toolbar and keyboard
- Toolbar sinking below home indicator

## Prerequisites

1. Install dependency:

```bash
npx expo install react-native-keyboard-controller
```

2. Add `KeyboardProvider` wrapper in `App.js`:

```javascript
import { KeyboardProvider } from "react-native-keyboard-controller";

export default function App() {
  return (
    <SafeAreaProvider>
      <KeyboardProvider>{/* rest of app */}</KeyboardProvider>
    </SafeAreaProvider>
  );
}
```

## Solution: Use KeyboardAwareToolbar Component

### The Component (`components/KeyboardAwareToolbar.js`)

```javascript
import React from "react";
import { StyleSheet } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const KeyboardAwareToolbar = ({ children, style }) => {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardStickyView
      offset={{
        closed: -insets.bottom, // NEGATIVE = push UP above home indicator
        opened: 0, // No gap when keyboard is open
      }}
      style={[styles.container, style]}
    >
      {children}
    </KeyboardStickyView>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
  },
});

export default KeyboardAwareToolbar;
```

### Usage in Screen

**Critical:** Place `KeyboardAwareToolbar` OUTSIDE of `KeyboardAvoidingView`:

```javascript
// ❌ WRONG - toolbar inside KeyboardAvoidingView causes conflicts
<KeyboardAvoidingView>
  <ScrollView>...</ScrollView>
  <KeyboardAwareToolbar>...</KeyboardAwareToolbar>
</KeyboardAvoidingView>

// ✅ CORRECT - toolbar as sibling to KeyboardAvoidingView
<View style={{ flex: 1 }}>
  <KeyboardAvoidingView>
    <ScrollView>...</ScrollView>
  </KeyboardAvoidingView>
  <KeyboardAwareToolbar>
    <View style={styles.toolbarContent}>
      {/* your toolbar content */}
    </View>
  </KeyboardAwareToolbar>
</View>
```

## Key Learnings

| Issue                                        | Cause                                                | Fix                                                     |
| -------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------- |
| Padding not resetting after keyboard dismiss | JS-thread state updates lag behind native animations | Use `KeyboardStickyView` which runs on UI thread        |
| Gap between toolbar and keyboard             | `offset.opened > 0` or extra padding in styles       | Set `offset.opened: 0`                                  |
| Toolbar sinking below home indicator         | `offset.closed` positive value                       | Use **negative** value: `offset.closed: -insets.bottom` |
| Two systems fighting                         | `KeyboardAvoidingView` + custom keyboard handling    | Move toolbar **outside** `KeyboardAvoidingView`         |

## Note on Offset Direction

The `offset` prop uses **transform translation**:

- **Positive** values push the view **DOWN**
- **Negative** values push the view **UP**

So to lift the toolbar above the home indicator: use `-insets.bottom`
