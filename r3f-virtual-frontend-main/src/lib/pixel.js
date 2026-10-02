/**
 * Safely track custom Meta (Facebook) Pixel events.
 * @param {string} eventName - The name of the custom event (e.g., 'StartSession')
 * @param {Object} [properties] - Optional metadata parameters for the event
 */
export function trackCustomEvent(eventName, properties = {}) {
  if (typeof window !== 'undefined' && window.fbq) {
    try {
      window.fbq('trackCustom', eventName, properties);
      console.log(`[Meta Pixel] Custom event tracked: ${eventName}`, properties);
    } catch (err) {
      console.error('[Meta Pixel] Error tracking custom event:', err);
    }
  }
}

/**
 * Safely track standard Meta (Facebook) Pixel events.
 * @param {string} eventName - The standard event name (e.g., 'Lead', 'CompleteRegistration')
 * @param {Object} [properties] - Optional metadata parameters for the event
 */
export function trackStandardEvent(eventName, properties = {}) {
  if (typeof window !== 'undefined' && window.fbq) {
    try {
      window.fbq('track', eventName, properties);
      console.log(`[Meta Pixel] Standard event tracked: ${eventName}`, properties);
    } catch (err) {
      console.error('[Meta Pixel] Error tracking standard event:', err);
    }
  }
}
