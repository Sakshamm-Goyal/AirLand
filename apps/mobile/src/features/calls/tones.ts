import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';

/** Ringback (caller) and ringtone (callee). Generated in-repo, see assets/sounds. */
const SOURCES = {
  ringback: require('../../../assets/sounds/ringback.wav'),
  ringtone: require('../../../assets/sounds/ringtone.wav'),
};

let player: AudioPlayer | null = null;
/** Bumped by every play/stop so a slow play() that loses the race never starts a tone nobody can stop. */
let gen = 0;

/** Loop a tone. Voice-call ringback goes to the earpiece unless speaker is on, like a phone call. */
export async function playTone(which: keyof typeof SOURCES, speaker = true) {
  stopTone();
  const mine = gen;
  // ponytail: errors here must never break the call itself; a silent ring is the fallback.
  try {
    await setAudioModeAsync({ playsInSilentMode: true, shouldRouteThroughEarpiece: !speaker, interruptionMode: 'duckOthers' });
    if (mine !== gen) return;
    player = createAudioPlayer(SOURCES[which]);
    player.loop = true;
    player.play();
  } catch {}
}

export function stopTone() {
  gen++;
  player?.remove();
  player = null;
}

/** After the call: give media playback its normal speaker routing back. */
export function resetAudioMode() {
  void setAudioModeAsync({ shouldRouteThroughEarpiece: false }).catch(() => {});
}
