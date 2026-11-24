import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';

/** Ringback (caller) and ringtone (callee). Generated in-repo, see assets/sounds. */
const SOURCES = {
  ringback: require('../../../assets/sounds/ringback.wav'),
  ringtone: require('../../../assets/sounds/ringtone.wav'),
};
type Tone = keyof typeof SOURCES;

// One long-lived player per tone, paused when not ringing. Creating/removing players per call leaked on Android:
// remove() detaches the JS object but doesn't stop a looping ExoPlayer, so the ring kept going after Cancel.
const players: Partial<Record<Tone, AudioPlayer>> = {};
const get = (t: Tone) => {
  players[t] ??= createAudioPlayer(SOURCES[t]);
  return players[t];
};

/** Bumped by every play/stop so a slow play() that loses the race never starts a tone nobody stops. */
let gen = 0;

/** Loop a tone. Voice-call ringback goes to the earpiece unless speaker is on, like a phone call. */
export async function playTone(which: Tone, speaker = true) {
  stopTone();
  const mine = gen;
  // ponytail: errors here must never break the call itself; a silent ring is the fallback.
  try {
    await setAudioModeAsync({ playsInSilentMode: true, shouldRouteThroughEarpiece: !speaker, interruptionMode: 'duckOthers' });
    if (mine !== gen) return;
    const p = get(which);
    p.loop = true;
    await p.seekTo(0);
    if (mine !== gen) return;
    p.play();
  } catch {}
}

export function stopTone() {
  gen++;
  for (const p of Object.values(players)) {
    try {
      p.pause();
    } catch {}
  }
}

/** After the call: give media playback its normal speaker routing back. */
export function resetAudioMode() {
  void setAudioModeAsync({ shouldRouteThroughEarpiece: false }).catch(() => {});
}
