# DiscoverGrid V1 (Backup)

This folder contains the original DiscoverGrid component that was used before the category-based Discover Feed V2.

## What is this?

The original DiscoverGrid displayed a mixed grid of posts and events in a pattern:

- Row A: Event (2 cols) + Post (1 col)
- Row B: 3 posts
- Row A': Post (1 col) + Event (2 cols)
- Repeats...

## When to use this?

This backup is kept for when the app has enough user-generated content (posts) to show a mixed discovery feed. Once the app has sufficient posts, you can switch back to using this component or create a hybrid approach.

## Original file

The `index.js` file in this folder is a copy of the original `DiscoverGrid.js` from December 2024.

## Current Discover Feed

The new Discover Feed V2 (`DiscoverFeedV2.js`) uses category-based horizontal carousels to display events, which is better for a new app with limited content.
