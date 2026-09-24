import type { Draw } from '../draw';
import { manualSteps, type ManualStep } from '../manual';
import type { DrawResult } from '../result';
import { h, replaceChildren } from './dom';
import { copyText } from './share';

export function commandsPanel(draw: Draw, link: string) {
  const list = h('ol', { class: 'commands' });
  const render = (result: DrawResult | null) =>
    replaceChildren(list, ...manualSteps(draw, link, result).map((step) => stepItem(step, result !== null)));
  render(null);

  const element = h(
    'details',
    { class: 'raw' },
    h('summary', {}, 'Check it yourself on the command line'),
    h(
      'p',
      { class: 'hint' },
      'Run these commands in a terminal on macOS or Linux. They use only standard tools ' +
        '(sh, shasum, curl and sort, plus python3 for the optional step). Each step shows the output that you must get.',
    ),
    list,
  );
  return { element, setResult: render };
}

function stepItem(step: ManualStep, drawn: boolean): HTMLLIElement {
  const copyButton = h('button', { type: 'button', class: 'button subtle copy' }, 'Copy');
  copyButton.addEventListener('click', async () => {
    await copyText(step.command);
    copyButton.textContent = 'Copied!';
    setTimeout(() => (copyButton.textContent = 'Copy'), 2000);
  });
  return h(
    'li',
    {},
    h('h3', {}, step.title),
    h('p', {}, step.text),
    h('div', { class: 'command' }, h('pre', {}, step.command), copyButton),
    step.expected !== undefined ? h('p', { class: 'output-label' }, 'Expected output:') : null,
    step.expected !== undefined ? h('pre', { class: 'expected' }, step.expected) : null,
    step.afterDraw && !drawn ? h('p', { class: 'hint' }, 'The output is known after the draw.') : null,
  );
}
