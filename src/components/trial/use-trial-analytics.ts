/**
 * Lightweight analytics event tracker for the trial signup funnel.
 *
 * Emits structured events that any analytics provider (Segment, PostHog,
 * Mixpanel, GA4, etc.) can consume. Currently logs to console and pushes
 * to `window.dataLayer` (GTM-compatible) when available.
 *
 * Replace the `dispatch` implementation to forward to your provider SDK.
 */

export type FunnelStep =
  | "page_view"
  | "role_selected"
  | "role_changed"
  | "form_started"
  | "consent_toggled"
  | "signup_submitted"
  | "signup_succeeded"
  | "signup_failed"
  | "confirmation_viewed"
  | "signin_clicked";

export interface AnalyticsEvent {
  event: FunnelStep;
  properties: Record<string, unknown>;
  timestamp: string;
}

/** Central dispatch — swap this for your real provider */
function dispatch(evt: AnalyticsEvent) {
  // Console (dev only)
  if (import.meta.env.DEV) {
    console.info("[trial-analytics]", evt.event, evt.properties);
  }

  // GTM dataLayer
  if (typeof window !== "undefined" && Array.isArray((window as any).dataLayer)) {
    (window as any).dataLayer.push({
      event: `trial_${evt.event}`,
      ...evt.properties,
      _timestamp: evt.timestamp,
    });
  }

  // Custom event for any listener (PostHog, Segment, etc.)
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("ff_trial_analytics", { detail: evt }),
    );
  }
}

function now() {
  return new Date().toISOString();
}

/** Track a trial funnel event */
export function trackTrialEvent(
  event: FunnelStep,
  properties: Record<string, unknown> = {},
) {
  dispatch({ event, properties, timestamp: now() });
}

/**
 * React hook for trial funnel analytics.
 * Returns a stable `track` function (no re-renders).
 */
export function useTrialAnalytics() {
  return { track: trackTrialEvent };
}
