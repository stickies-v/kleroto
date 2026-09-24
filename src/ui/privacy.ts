import { APP_NAME } from '../config';
import { h, replaceChildren } from './dom';

export const PRIVACY_FRAGMENT = 'privacy';

const link = (href: string, text: string) => h('a', { href, target: '_blank', rel: 'noopener' }, text);

export function renderPrivacy(root: HTMLElement): void {
  document.title = `Privacy · ${APP_NAME}`;
  replaceChildren(
    root,
    h('nav', { class: 'top' }, h('a', { href: '#' }, `← Back to ${APP_NAME}`)),
    h(
      'article',
      { class: 'card privacy' },
      h('h1', {}, 'Privacy'),
      h(
        'p',
        { class: 'lead-text' },
        'No accounts, no cookies, and your draws never leave the link. ' +
          `${APP_NAME} counts visits, in a way that does not identify you.`,
      ),
      h('h2', {}, 'Your draws'),
      h(
        'p',
        {},
        'The title and the participants of a draw are in the part of the link after "#". Browsers never send ' +
          `that part to a website, and ${APP_NAME} never sends it anywhere. Only the people you share the link with can see it.`,
      ),
      h('h2', {}, 'Visitor statistics'),
      h(
        'p',
        {},
        `To know whether people use ${APP_NAME}, it counts visits with `,
        link('https://www.goatcounter.com/', 'GoatCounter'),
        ', an open-source analytics service that does not use cookies. Each count contains only:',
      ),
      h(
        'ul',
        {},
        h('li', {}, 'the type of page: the homepage, a draw page or this page, never the draw itself;'),
        h('li', {}, 'that someone created a draw, and with which draw oracle;'),
        h('li', {}, 'the website that linked here, if any;'),
        h('li', {}, 'the screen width.'),
      ),
      h(
        'p',
        {},
        'From the request, GoatCounter also works out the browser, the operating system, the language and the ' +
          'country. It does not store your IP address, and it keeps only totals, such as "12 visits from Belgium today". ' +
          'See ',
        link('https://www.goatcounter.com/privacy', "GoatCounter's privacy policy"),
        ' for the details.',
      ),
      h(
        'p',
        {},
        'If your browser sends "Do Not Track" or "Global Privacy Control", your visits are not counted at all.',
      ),
      h('h2', {}, 'Random numbers'),
      h(
        'p',
        {},
        'Your browser contacts drand (api.drand.sh and its mirrors) and the Bitcoin block explorers mempool.space ' +
          'and blockstream.info, to show the current Bitcoin block and to get the random number of a draw. These ' +
          'requests contain only a round or block number, never your draw. Like any website, these services can ' +
          'see your IP address.',
      ),
      h('h2', {}, 'Hosting'),
      h(
        'p',
        {},
        `GitHub Pages hosts ${APP_NAME}. Like any web host, GitHub can see your IP address when you load the site. See `,
        link(
          'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement',
          "GitHub's privacy statement",
        ),
        '. The fonts are part of the site, so no font service is involved.',
      ),
    ),
  );
}
