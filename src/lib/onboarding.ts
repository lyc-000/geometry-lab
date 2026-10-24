export const WELCOME_STORAGE_KEY = 'pouwu.welcome-seen.v1';

export function shouldShowWelcome(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('welcome') === '1') return true;
    if (params.get('welcome') === '0') return false;
    return window.localStorage.getItem(WELCOME_STORAGE_KEY) !== '1';
  } catch {
    return true;
  }
}

export function markWelcomeSeen(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WELCOME_STORAGE_KEY, '1');
  } catch {
    // Storage can be disabled in private mode; onboarding still works for this session.
  }
}
