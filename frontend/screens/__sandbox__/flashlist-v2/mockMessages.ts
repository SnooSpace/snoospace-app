//mockMessages.ts

import { ChatRow } from "./types";

const SAMPLE_TEXTS = [
  "Hey, did you see the update?",
  "Yeah just checked it out, looks solid",
  "Can you send the file again?",
  "On it, give me a sec",
  "That scroll fix worked perfectly",
  "Nice, testing it now",
  "Let's ship it 🚀",
  "Sounds good to me",
];

const SAMPLE_USERS = ["me", "alex", "priya"];

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `msg_${idCounter}`;
}

function randomOf<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generates one "page" of messages going BACKWARDS in time.
// Because our convention is index 0 = newest, older pages get
// appended to the END of the data array, not prepended to the start.
export function generateMessagePage(
  pageIndex: number,
  pageSize: number,
  startTimestamp: number
): ChatRow[] {
  const rows: ChatRow[] = [];
  let ts = startTimestamp;

  for (let i = 0; i < pageSize; i++) {
    ts -= 1000 * 60 * (2 + Math.random() * 8); // a few minutes apart

    const roll = Math.random();
    const senderId = randomOf(SAMPLE_USERS);
    const isOwn = senderId === "me";

    if (roll < 0.15) {
      rows.push({
        id: nextId(),
        type: "media",
        timestamp: ts,
        senderId,
        isOwn,
        mediaKind: Math.random() < 0.7 ? "image" : "video",
        uri: `https://picsum.photos/seed/${nextId()}/600/${
          Math.random() < 0.5 ? 400 : 800
        }`,
        aspectRatio: Math.random() < 0.5 ? 600 / 400 : 600 / 800,
        caption: Math.random() < 0.3 ? "Check this out" : undefined,
      });
    } else if (roll < 0.22) {
      rows.push({
        id: nextId(),
        type: "post",
        timestamp: ts,
        senderId,
        isOwn,
        post: {
          id: nextId(),
          title: "10 tips for smoother React Native lists",
          thumbnailUri: `https://picsum.photos/seed/post${nextId()}/300/200`,
          authorName: "Dev Weekly",
        },
      });
    } else {
      rows.push({
        id: nextId(),
        type: "text",
        timestamp: ts,
        senderId,
        isOwn,
        text: randomOf(SAMPLE_TEXTS),
      });
    }

    // Insert a date separator every ~20 messages for visual variety.
    if (i > 0 && i % 20 === 0) {
      rows.push({
        id: nextId(),
        type: "date",
        timestamp: ts,
        label: new Date(ts).toDateString(),
      });
    }
  }

  return rows;
}

// Simulates a network call. Resolves after a short delay with the next
// page of OLDER messages plus the timestamp cursor to continue from.
export function fetchOlderMessages(
  pageIndex: number,
  beforeTimestamp: number
): Promise<{ rows: ChatRow[]; nextCursor: number; hasMore: boolean }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const rows = generateMessagePage(pageIndex, 30, beforeTimestamp);
      const nextCursor = rows[rows.length - 1]?.timestamp ?? beforeTimestamp;
      resolve({
        rows,
        nextCursor,
        hasMore: pageIndex < 6, // stop after ~6 pages of mock history
      });
    }, 600);
  });
}
