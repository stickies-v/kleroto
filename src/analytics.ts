import { ANALYTICS_URL } from './config';

const LOCAL_HOST = /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|0\.0\.0\.0|\[::1\])$/;
const BOT_WEBDRIVER = '153';

export interface Hit {
  path: string;
  title: string;
  event?: boolean;
}

interface Context {
  referrer: string;
  screenWidth: number;
  bot: boolean;
}

export function hitUrl(hit: Hit, context: Context): string {
  const params = new URLSearchParams({ p: hit.path, t: hit.title, s: String(context.screenWidth) });
  if (hit.event) params.set('e', 'true');
  if (context.referrer) params.set('r', context.referrer);
  if (context.bot) params.set('b', BOT_WEBDRIVER);
  params.set('rnd', Math.random().toString(36).slice(2, 7));
  return `${ANALYTICS_URL}?${params}`;
}

export function mayCount(hostname: string, doNotTrack: boolean): boolean {
  return !doNotTrack && !LOCAL_HOST.test(hostname);
}

let referrerSent = false;

export function count(hit: Hit): void {
  try {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (!mayCount(location.hostname, nav.doNotTrack === '1' || nav.globalPrivacyControl === true)) return;
    const url = hitUrl(hit, {
      referrer: referrerSent ? '' : document.referrer,
      screenWidth: screen.width,
      bot: nav.webdriver,
    });
    referrerSent = true;
    if (!nav.sendBeacon?.(url)) new Image().src = url;
  } catch {
    // Statistics must never break the page.
  }
}
