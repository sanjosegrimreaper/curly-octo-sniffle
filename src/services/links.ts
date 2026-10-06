import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { getPack } from '@/data/pack';

let allowlist: Set<string> | null = null;

function collectUrls(value: unknown, out: Set<string>) {
  if (typeof value === 'string') {
    if (/^https:\/\//.test(value)) {
      try {
        out.add(new URL(value).hostname.replace(/^www\./, ''));
      } catch {
        // not a URL
      }
    }
  } else if (Array.isArray(value)) {
    value.forEach((v) => collectUrls(v, out));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((v) => collectUrls(v, out));
  }
}

/** Every https domain that appears in the verified pack (and only those) may be opened. */
export function allowedDomains() {
  if (!allowlist) {
    const set = new Set<string>();
    const pack = getPack();
    pack.region.partnerDomains.forEach((d) => set.add(d.replace(/^www\./, '')));
    collectUrls(pack, set);
    allowlist = set;
  }
  return allowlist;
}

export function isAllowed(url: string) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.replace(/^www\./, '');
    const domains = allowedDomains();
    return [...domains].some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

export async function openExternal(url: string): Promise<boolean> {
  if (!isAllowed(url)) return false;
  try {
    if (Platform.OS === 'web') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return true;
    }
    await WebBrowser.openBrowserAsync(url, { readerMode: false, enableBarCollapsing: true });
    return true;
  } catch {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      return false;
    }
  }
}

/** Digits only, keeps a leading +. */
export function telUrl(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export async function call(phone: string) {
  try {
    await Linking.openURL(telUrl(phone));
    return true;
  } catch {
    return false;
  }
}

export function mapsUrl(address: string, lat?: number | null, lng?: number | null) {
  const q = encodeURIComponent(address);
  if (Platform.OS === 'ios') return lat != null && lng != null ? `maps:?q=${q}&ll=${lat},${lng}` : `maps:?q=${q}`;
  if (Platform.OS === 'android') return `geo:${lat ?? 0},${lng ?? 0}?q=${q}`;
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export async function directions(address: string, lat?: number | null, lng?: number | null) {
  try {
    await Linking.openURL(mapsUrl(address, lat, lng));
    return true;
  } catch {
    return false;
  }
}

export async function email(to: string, subject: string, body: string) {
  try {
    await Linking.openURL(`mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    return true;
  } catch {
    return false;
  }
}
