//types.ts

// Discriminated union for all chat row types.
// Keeping `type` as a literal on every variant lets FlashList's getItemType
// give each shape its own recycle pool — critical for avoiding the
// "flick out and back in" glitch when structurally different rows
// (e.g. a date separator vs a media bubble) get recycled into each other.

export type BaseMessage = {
  id: string; // stable, unique — used as keyExtractor return value
  timestamp: number;
};

export type TextMessage = BaseMessage & {
  type: "text";
  senderId: string;
  isOwn: boolean;
  text: string;
};

export type MediaMessage = BaseMessage & {
  type: "media";
  senderId: string;
  isOwn: boolean;
  mediaKind: "image" | "video";
  uri: string;
  // Real aspect ratio should come from your API/upload metadata.
  // Never leave this undefined — unknown aspect ratio is the #1 cause
  // of layout jumps that look like flicker while scrolling fast.
  aspectRatio: number;
  caption?: string;
};

export type PostShareMessage = BaseMessage & {
  type: "post";
  senderId: string;
  isOwn: boolean;
  post: {
    id: string;
    title: string;
    thumbnailUri: string;
    authorName: string;
  };
};

export type DateSeparator = BaseMessage & {
  type: "date";
  label: string; // e.g. "Today", "Tuesday, Aug 2"
};

export type ChatRow = TextMessage | MediaMessage | PostShareMessage | DateSeparator;

// Used for getItemType — keep this cheap, it's called very frequently.
export function getRowType(row: ChatRow): string {
  return row.type;
}
