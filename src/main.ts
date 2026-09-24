import '@fontsource-variable/fraunces/wght.css';
import './style.css';
import { count } from './analytics';
import { APP_NAME, APP_TAGLINE, REPO_URL } from './config';
import { DrawFormatError, decodeFragment } from './draw';
import { renderCreate } from './ui/create';
import { h, replaceChildren } from './ui/dom';
import { PRIVACY_FRAGMENT, renderPrivacy } from './ui/privacy';
import { renderView } from './ui/view';

const root = document.getElementById('app')!;
let cleanup = () => {};

function route(): void {
  cleanup();
  cleanup = () => {};
  window.scrollTo(0, 0);
  const fragment = location.hash.slice(1);
  if (!fragment) {
    document.title = `${APP_NAME} · ${APP_TAGLINE}`;
    count({ path: '/', title: 'Home' });
    cleanup = renderCreate(root);
    return;
  }
  if (fragment === PRIVACY_FRAGMENT) {
    count({ path: '/privacy', title: 'Privacy' });
    renderPrivacy(root);
    return;
  }
  try {
    cleanup = renderView(root, decodeFragment(fragment), fragment);
    count({ path: '/draw', title: 'Draw page' });
  } catch (err) {
    count({ path: '/invalid-link', title: 'Invalid link' });
    document.title = APP_NAME;
    replaceChildren(
      root,
      h(
        'section',
        { class: 'card' },
        h('h1', {}, 'This link does not work'),
        h('p', {}, err instanceof DrawFormatError ? err.message : 'The link is not valid.'),
        h('a', { class: 'button primary', href: '#' }, 'Make a new draw'),
      ),
    );
  }
}

replaceChildren(
  document.getElementById('footer')!,
  `${APP_NAME} · free and open source (MIT) · no accounts, no cookies · `,
  h('a', { href: `#${PRIVACY_FRAGMENT}` }, 'Privacy'),
  ' · ',
  h('a', { href: REPO_URL, target: '_blank', rel: 'noopener' }, 'Source code on GitHub'),
);
window.addEventListener('hashchange', route);
route();
