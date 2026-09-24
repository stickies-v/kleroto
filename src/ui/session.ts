const CREATED_KEY = 'kleroto:created';
const REVEALED_PREFIX = 'kleroto:revealed:';

export function markCreated(fragment: string): void {
  try {
    sessionStorage.setItem(CREATED_KEY, fragment);
  } catch {
    // Storage is optional.
  }
}

export function takeCreated(fragment: string): boolean {
  try {
    const created = sessionStorage.getItem(CREATED_KEY) === fragment;
    if (created) sessionStorage.removeItem(CREATED_KEY);
    return created;
  } catch {
    return false;
  }
}

export function wasRevealed(resultKey: string): boolean {
  try {
    return localStorage.getItem(REVEALED_PREFIX + resultKey) !== null;
  } catch {
    return false;
  }
}

export function markRevealed(resultKey: string): void {
  try {
    localStorage.setItem(REVEALED_PREFIX + resultKey, '1');
  } catch {
    // Storage is optional.
  }
}
