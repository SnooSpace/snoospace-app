---
description: How to implement YouTube/Reddit-style threaded reply connectors with local ownership model
---

# Threaded Replies Connector Pattern

This workflow describes how to implement hierarchical threaded reply connectors where each reply owns its own connector rendering.

## Core Principles

1. **No global spine** - Each reply renders only its own connectors
2. **Local ownership** - Reply renders: curved elbow, vertical continuation (if next sibling exists), ancestor pass-through lines (if nested)
3. **Sibling-based continuation** - Vertical line only extends if `hasMoreSiblings` returns true
4. **Ancestor pass-through** - Nested replies render vertical lines at ancestor positions where siblings continue

## Key Files

- `frontend/screens/home/PromptRepliesScreen.js` - Main implementation
- `frontend/constants/theme.js` - SPACING.xl controls gap bridging distance

## Implementation Steps

### 1. Define Layout Constants

```javascript
const INDENT_SIZE = 24;
const CONNECTOR_WIDTH = 24;
const ELBOW_RADIUS = 8;
const REPLY_AVATAR_SIZE = 28;
const REPLY_PADDING = SPACING.m;
const CONNECTOR_COLOR = "rgba(0,0,0,0.12)";
```

### 2. Create Sibling Detection Functions

- `hasMoreSiblings(replyId, depth)` - Check if next sibling exists
- `isFirstSibling(replyId, depth)` - Check if no previous sibling
- `hasAncestorSiblingAfter(replyId, ancestorDepth)` - Check if ancestor siblings continue

### 3. Calculate Reply Position

```javascript
const leftMargin = CONNECTOR_WIDTH + depth * INDENT_SIZE;
const avatarCenterY = REPLY_PADDING + REPLY_AVATAR_SIZE / 2;
```

### 4. Render Curved Elbow

- Vertical segment: top=0 (or -SPACING.xl if hasPrevSibling) to curve start
- Curved corner: 8px radius border-bottom-left
- Horizontal segment: from curve to avatar center

### 5. Render Vertical Continuation

Only if `hasNextSibling && !isCollapsed`:

```javascript
<View
  style={{
    position: "absolute",
    left: 0,
    top: avatarCenterY + ELBOW_RADIUS,
    bottom: -SPACING.s,
    width: 1,
    backgroundColor: CONNECTOR_COLOR,
  }}
/>
```

### 6. Render Ancestor Pass-Through Lines (for depth > 0)

```javascript
for (let ancestorDepth = 0; ancestorDepth < depth; ancestorDepth++) {
  if (hasAncestorSiblingAfter(item.id, ancestorDepth)) {
    const ancestorLeft = -(depth - ancestorDepth) * INDENT_SIZE;
    // Render vertical line at ancestorLeft
  }
}
```

### 7. Required Styles

```javascript
replyItemContainer: {
  position: "relative",
  overflow: "visible", // Critical for connectors to extend past bounds
},
```

## Troubleshooting

| Issue                          | Solution                                                          |
| ------------------------------ | ----------------------------------------------------------------- |
| Gap between sibling replies    | Increase SPACING.xl (controls upward extension)                   |
| Gap when nested replies expand | Check `hasAncestorSiblingAfter` and pass-through line positioning |
| Lines clipped                  | Add `overflow: "visible"` to container                            |

## Reference

See detailed walkthrough: `C:\Users\sanja\.gemini\antigravity\brain\0fb05500-2c96-46d4-ba16-9493917261a7\walkthrough.md`
