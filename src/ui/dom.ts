type Child = Node | string | number | null | undefined | false;
type Props = Record<string, unknown>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.slice(2), value as EventListener);
    } else if (key === 'class') {
      element.className = String(value);
    } else if (key in element) {
      (element as unknown as Props)[key] = value;
    } else {
      element.setAttribute(key, value === true ? '' : String(value));
    }
  }
  element.append(...toNodes(children));
  return element;
}

export function replaceChildren(parent: Element, ...children: Child[]): void {
  parent.replaceChildren(...toNodes(children));
}

function toNodes(children: Child[]): (Node | string)[] {
  return children
    .filter((child) => child !== null && child !== undefined && child !== false)
    .map((child) => (typeof child === 'number' ? String(child) : (child as Node | string)));
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
