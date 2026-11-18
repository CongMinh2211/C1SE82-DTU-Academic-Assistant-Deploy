import test from "node:test";
import assert from "node:assert/strict";
import { shouldAutoPlay, speechText } from "../lib/voice-playback";

test("Voice playback requires a submitted request even when both identifiers are empty", () => {
  assert.equal(shouldAutoPlay(true, false, "", "", "answered"), false);
  assert.equal(shouldAutoPlay(true, false, null, undefined, "answered"), false);
});

test("Speech preparation removes adjacent citations and preserves an ordinary room number", () => {
  assert.equal(speechText("**Room 301** [2][12]\n  Building A"), "Room 301 Building A");
});
