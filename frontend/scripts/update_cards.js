const fs = require('fs');

const file = "c:/Users/sanja/OneDrive/Documents/Harshith/SnooSpace/frontend/screens/profile/member/EditProfileScreen.js";
let content = fs.readFileSync(file, 'utf8');

// 1. Add BlurView import
if (!content.includes('import { BlurView }')) {
  content = content.replace(
    /import \{ SafeAreaView \} from "react-native-safe-area-context";/,
    'import { SafeAreaView } from "react-native-safe-area-context";\nimport { BlurView } from "expo-blur";'
  );
}

// 2. Replace start and end of Card 1
content = content.replace(
  /\{\/\* Card 1: The Basics \*\/\}\s*<View style=\{styles\.card\}>\s*\{renderSectionHeader\("THE BASICS", User\)\}/,
  `{/* Card 1: The Basics */}
        <View style={styles.card}>
          <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
          <View style={styles.cardContent}>
            {renderSectionHeader("THE BASICS", User)}`
);

// End 1
content = content.replace(
  /(\s*)\{\/\* Card 2: About Me \*\/\}/,
  `$1  </View>
        </View>

$1{/* Card 2: About Me */}`
);

// 3. Replace start and end of Card 2
content = content.replace(
  /\{\/\* Card 2: About Me \*\/\}\s*<View style=\{styles\.card\}>\s*\{renderSectionHeader\("ABOUT ME", NotebookText\)\}/,
  `{/* Card 2: About Me */}
        <View style={styles.card}>
          <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
          <View style={styles.cardContent}>
            {renderSectionHeader("ABOUT ME", NotebookText)}`
);

// End 2
content = content.replace(
  /(\s*)\{\/\* Card 3: Occupation \*\/\}/,
  `$1  </View>
        </View>

$1{/* Card 3: Occupation */}`
);

// 4. Replace start and end of Card 3
content = content.replace(
  /\{\/\* Card 3: Occupation \*\/\}\s*<View style=\{styles\.card\}>\s*\{renderSectionHeader\("OCCUPATION", Briefcase\)\}/,
  `{/* Card 3: Occupation */}
        <View style={styles.card}>
          <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
          <View style={styles.cardContent}>
            {renderSectionHeader("OCCUPATION", Briefcase)}`
);

// End 3
content = content.replace(
  /(\s*)\{\/\* Card 5: My Vibes \(Scalable Redesign\) \*\/\}/,
  `$1  </View>
        </View>

$1{/* Card 5: My Vibes (Scalable Redesign) */}`
);

// 5. Replace start and end of Card 5
content = content.replace(
  /\{\/\* Card 5: My Vibes \(Scalable Redesign\) \*\/\}\s*<View style=\{styles\.card\}>\s*\{renderSectionHeader\("MY VIBES", RollerCoaster\)\}/,
  `{/* Card 5: My Vibes (Scalable Redesign) */}
        <View style={styles.card}>
          <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
          <View style={styles.cardContent}>
            {renderSectionHeader("MY VIBES", RollerCoaster)}`
);

// End 5
content = content.replace(
  /(\s*)\{\/\* Card 6: Private Details \*\/\}/,
  `$1  </View>
        </View>

$1{/* Card 6: Private Details */}`
);

// 6. Replace start and end of Card 6
content = content.replace(
  /\{\/\* Card 6: Private Details \*\/\}\s*<View style=\{styles\.card\}>\s*\{renderSectionHeader\("PRIVATE DETAILS", Lock\)\}/,
  `{/* Card 6: Private Details */}
        <View style={styles.card}>
          <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
          <View style={styles.cardContent}>
            {renderSectionHeader("PRIVATE DETAILS", Lock)}`
);

// End 6 (matches the closing tags before the keyboard scroll view closes)
content = content.replace(
  /<\/View>\n\n\s*<View style=\{\{ height: 0 \}\} \/>/,
  `          </View>
        </View>
      </View>

        <View style={{ height: 0 }} />`
);
// Wait, closing Card 6:
// The original code was:
//           <View style={styles.inputGroupLast}>
//            ...
//           </View>
//         </View>
//
//         <View style={{ height: 0 }} />
//
// So it currently has two `</View>`s at the end. We need it to be:
//           </View>
//         </View>  <-- End of Card 6 cardContent
//       </View>    <-- End of Card 6 root view
//
//         <View style={{ height: 0 }} />

content = content.replace(
  /<View style=\{\{ height: 0 \}\} \/>/,
  `</View>\n        <View style={{ height: 0 }} />` // We just append one extra closing view before the spacer
);

// 7. Styles update
const newStylesCard = `card: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 24,
    ...Platform.select({
      ios: {
        ...SHADOWS.xl,
        shadowOpacity: 0.1,
        shadowRadius: 24,
      },
      android: {
        elevation: 0,
      },
    }),
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    overflow: "hidden",
  },
  cardContent: {
    padding: 24,
  },`;

content = content.replace(
  /card:\s*\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\},/,
  newStylesCard
);

fs.writeFileSync(file, content, 'utf8');
console.log("Updated EditProfileScreen.js");
