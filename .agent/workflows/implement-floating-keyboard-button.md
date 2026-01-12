---
description: Implement a floating action button that sticks to the keyboard
---

This workflow describes how to implement a button that sits at the bottom of the screen and floats up with the keyboard using `KeyboardStickyView`.

1. **Install/Verify Dependencies**: Ensure `react-native-keyboard-controller` and `react-native-safe-area-context` are installed.

2. **Add Imports**:

   ```javascript
   import { KeyboardStickyView } from "react-native-keyboard-controller";
   import { useSafeAreaInsets } from "react-native-safe-area-context"; // Optional, for safe area handling
   ```

3. **Remove KeyboardAvoidingView**: If the screen is currently wrapped in `KeyboardAvoidingView`, remove it. The `KeyboardStickyView` handles the interaction.

4. **Update Main ScrollView**:
   Add bottom padding to the `ScrollView`'s `contentContainerStyle` to prevent the last items from being hidden behind the floating button.

   ```javascript
   <ScrollView
     contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }} // Adjust padding as needed
     keyboardShouldPersistTaps="handled"
   >
     {/* Content */}
   </ScrollView>
   ```

5. **Implement Sticky Footer**:
   Place the `KeyboardStickyView` outside the `ScrollView` (usually as a direct child of `SafeAreaView` or the main container).

   ```javascript
   <KeyboardStickyView
     offset={{
       closed: 0, // Adjust if you need it to sit higher when closed
       opened: 0, // Adjust if you need it to sit higher than the keyboard
     }}
     style={styles.stickyFooter}
   >
     <View style={styles.footer}>
       {/* Your Button Component */}
       <TouchableOpacity>
         <Text>Button</Text>
       </TouchableOpacity>
     </View>
   </KeyboardStickyView>
   ```

6. **Add Styles**:
   ```javascript
   const styles = StyleSheet.create({
     stickyFooter: {
       position: "absolute",
       bottom: 0,
       left: 0,
       right: 0,
     },
     footer: {
       padding: 20,
       paddingBottom: 50, // desired bottom padding when keyboard is closed
       backgroundColor: COLORS.background, // Ensure background is set to cover content
     },
   });
   ```
