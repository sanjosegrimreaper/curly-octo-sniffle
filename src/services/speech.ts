import * as Speech from 'expo-speech';

import { LANGUAGES, type Lang } from '@/i18n/languages';
import { useSettings } from '@/state/settings';

let voiceCache: Speech.Voice[] | null = null;

async function voices() {
  if (voiceCache) return voiceCache;
  try {
    voiceCache = await Speech.getAvailableVoicesAsync();
  } catch {
    voiceCache = [];
  }
  return voiceCache;
}

/** True when the device has (or probably has) a voice for this language. */
export async function hasVoiceFor(lang: Lang) {
  const list = await voices();
  // Some platforms (web, some Android builds) return an empty list but still speak — assume yes then.
  if (list.length === 0) return true;
  const prefix = lang === 'zh-Hans' ? 'zh' : lang;
  return list.some((v) => v.language?.toLowerCase().startsWith(prefix.toLowerCase()));
}

export async function speak(text: string, lang: Lang, onDone?: () => void) {
  Speech.stop();
  const ok = await hasVoiceFor(lang);
  if (!ok) return false;
  Speech.speak(text, {
    language: LANGUAGES[lang].intlTag,
    rate: useSettings.getState().speechRate,
    onDone,
    onStopped: onDone,
    onError: onDone,
  });
  return true;
}

export function stopSpeaking() {
  Speech.stop();
}
