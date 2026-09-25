import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  markKnownFeedAsSeen,
  unplayedFeedEvents,
} from "./notification-audio-controller";

const source = readFileSync(
  new URL("./notification-audio-controller.tsx", import.meta.url),
  "utf8",
);

test("notification audio requires activation and serializes deduplicated events", () => {
  assert.match(source, /useNotificationAudio/);
  assert.match(source, /context\.state !== "running"/);
  assert.match(source, /return event\.id/);
  assert.match(source, /localStorage\.setItem/);
  assert.match(source, /new BroadcastChannel/);
  assert.match(source, /lockManager\.request/);
  assert.match(source, /Fail closed/);
  assert.match(source, /while \(queueRef\.current\.length/);
  assert.match(
    source,
    /await playFamily\(item\.family,\s*generation\)/,
  );
  assert.match(source, /role !== Role\.CAJA/);
  assert.match(source, /wakeLock\.request\("screen"\)/);
  assert.match(source, /document\.visibilityState === "visible"/);
});

test("audio is mounted above routes and cancels playback on disable", () => {
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  assert.match(app, /<AuthenticatedAudioBoundary><Router \/><\/AuthenticatedAudioBoundary>/);
  assert.match(app, /<NotificationAudioController[\s\S]*\{children\}[\s\S]*<\/NotificationAudioController>/);
  assert.match(source, /generationRef\.current \+= 1/);
  assert.match(source, /activeSourceRef\.current\?\.stop\(\)/);
  assert.match(source, /queueRef\.current = \[\]/);
  assert.match(source, /feedKeysRef\.current/);
  assert.match(source, /markKnownFeedAsSeen/);
});

test("a feed event arriving in the navigation render remains playable", () => {
  const oldEvent = { id: "old", updatedAt: "2026-08-31T12:00:00.000Z" };
  const newEvent = { id: "new", updatedAt: "2026-08-31T12:00:01.000Z" };
  const seenAfterNavigation = markKnownFeedAsSeen(
    new Set<string>(),
    new Set([oldEvent.id]),
  );

  assert.deepEqual(
    unplayedFeedEvents(
      [oldEvent, newEvent],
      seenAfterNavigation,
      new Set<string>(),
    ),
    [newEvent],
  );
});

test("local operational sounds use the exclusive serialized audio queue", () => {
  assert.match(source, /export function requestAppSound/);
  assert.match(source, /new CustomEvent<\{ family: SoundFamily; eventId\?: string \}>/);
  assert.match(source, /if \(!leaderRef\.current\)/);
  assert.match(source, /if \(contextRef\.current\?\.state !== "running"\) return/);
  assert.match(source, /queueRef\.current\.push\(\{ key, family \}\)/);
  assert.match(source, /void drainQueue\(\)/);
});