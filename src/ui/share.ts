import qrcode from 'qrcode-generator';
import { h } from './dom';

export function sharePanel(url: string): HTMLElement {
  const input = h('input', { class: 'link-input', readOnly: true, value: url, onfocus: selectAll });
  const copyButton = h('button', { type: 'button', class: 'button primary' }, 'Copy link');
  copyButton.addEventListener('click', async () => {
    await copyText(url);
    copyButton.textContent = 'Copied!';
    setTimeout(() => (copyButton.textContent = 'Copy link'), 2000);
  });

  const qr = qrSvg(url);
  const qrBox = h('div', { class: 'qr', hidden: true });
  if (qr) qrBox.append(qr);
  const qrButton = qr
    ? h('button', { type: 'button', class: 'button', onclick: () => (qrBox.hidden = !qrBox.hidden) }, 'QR code')
    : null;
  const nativeShare =
    'share' in navigator
      ? h(
          'button',
          { type: 'button', class: 'button', onclick: () => navigator.share({ url }).catch(() => undefined) },
          'Share…',
        )
      : null;

  return h(
    'div',
    { class: 'share' },
    h('div', { class: 'link-row' }, input),
    h('div', { class: 'button-row' }, copyButton, nativeShare, qrButton),
    qrBox,
  );
}

function selectAll(event: Event): void {
  (event.target as HTMLInputElement).select();
}

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const scratch = h('textarea', { value: text });
    document.body.append(scratch);
    scratch.select();
    document.execCommand('copy');
    scratch.remove();
  }
}

function qrSvg(text: string): SVGSVGElement | null {
  const code = qrcode(0, 'L');
  try {
    code.addData(text);
    code.make();
  } catch {
    return null;
  }
  const size = code.getModuleCount();
  const margin = 2;
  let path = '';
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (code.isDark(row, col)) path += `M${col + margin} ${row + margin}h1v1h-1z`;
    }
  }
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  const total = size + 2 * margin;
  svg.setAttribute('viewBox', `0 0 ${total} ${total}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'QR code of the draw link');
  const background = document.createElementNS(svgNs, 'rect');
  background.setAttribute('width', String(total));
  background.setAttribute('height', String(total));
  background.setAttribute('fill', '#fff');
  const modules = document.createElementNS(svgNs, 'path');
  modules.setAttribute('d', path);
  modules.setAttribute('fill', '#000');
  svg.append(background, modules);
  return svg;
}
