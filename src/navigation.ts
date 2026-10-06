import { router, type Href } from 'expo-router';

/**
 * Leaves a flow (onboarding, start over, clear data) without leaving it under the new screen:
 * pops the root stack first, so Android back / iOS swipe can't return to finished steps.
 */
export function startFresh(path: Href) {
  try {
    if (router.canDismiss()) router.dismissAll();
  } catch {
    // nothing to dismiss
  }
  router.replace(path);
}
