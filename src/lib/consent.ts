/** Structured IAB TCF data supplied by Google's certified CMP, never a decoded TC string. */
export type ConsentData = {
  cmpId?: number;
  cmpStatus?: string;
  eventStatus?: string;
  gdprApplies?: boolean;
  tcString?: string;
  purpose?: { consents?: Record<number, boolean> };
  vendor?: { consents?: Record<number, boolean> };
};
export type ConsentState = {
  phase: 'pending' | 'resolved' | 'unavailable';
  permitted: boolean;
  canReopen: boolean;
};
type Callback = (data: ConsentData | undefined, success: boolean) => void;
export type ConsentHost = {
  googlefc?: {
    callbackQueue?: { push: (callback: Record<string, () => void>) => unknown };
    showRevocationMessage?: () => void;
  };
  __tcfapi?: (command: string, version: number, callback: Callback) => void;
};

export function consentState(
  data?: ConsentData,
  success = false,
): ConsentState {
  const ready = success && data?.cmpId === 300 && data.cmpStatus === 'loaded';
  const canReopen = !!ready && data?.gdprApplies === true;
  if (!ready || typeof data?.gdprApplies !== 'boolean')
    return { phase: 'unavailable', permitted: false, canReopen: false };
  if (
    !['tcloaded', 'useractioncomplete'].includes(data.eventStatus || '') ||
    (data.gdprApplies && !data.tcString)
  )
    return { phase: 'pending', permitted: false, canReopen };
  // AdSense reads the full CMP TC string itself to select the permitted ad mode.
  // Our additional gate requires explicit storage and Google vendor consent in GDPR regions.
  const permitted =
    data.gdprApplies === false ||
    (data.purpose?.consents?.[1] === true &&
      data.vendor?.consents?.[755] === true);
  return { phase: 'resolved', permitted, canReopen };
}

export function googleConsentAdapter(
  host: ConsentHost,
  update: (state: ConsentState) => void,
) {
  const fc = (host.googlefc ||= {});
  fc.callbackQueue ||= [] as Record<string, () => void>[];
  let subscribed = false;
  let reopening = false;
  let canReopen = false;
  const unavailable = () => {
    canReopen = false;
    update({ phase: 'unavailable', permitted: false, canReopen: false });
  };
  fc.callbackQueue!.push({
    CONSENT_API_READY: () => {
      if (subscribed) return;
      if (!host.__tcfapi) return unavailable();
      subscribed = true;
      try {
        host.__tcfapi('addEventListener', 2, (data, success) => {
          const state = consentState(data, success);
          canReopen = state.canReopen;
          if (
            reopening &&
            state.phase !== 'unavailable' &&
            data?.eventStatus !== 'useractioncomplete'
          )
            update({ ...state, phase: 'pending', permitted: false });
          else {
            if (state.phase !== 'pending') reopening = false;
            update(state);
          }
        });
      } catch {
        unavailable();
      }
    },
  });
  return {
    fail: unavailable,
    open() {
      if (!canReopen) return;
      reopening = true;
      update({ phase: 'pending', permitted: false, canReopen: true });
      fc.callbackQueue!.push({
        CONSENT_API_READY: () => {
          try {
            if (!fc.showRevocationMessage) return unavailable();
            fc.showRevocationMessage();
          } catch {
            unavailable();
          }
        },
      });
    },
  };
}

export function loadGoogleConsent(
  client: string,
  update: (state: ConsentState) => void,
) {
  const host = window as unknown as ConsentHost;
  const adapter = googleConsentAdapter(host, update);
  // AdSense deploys its published European message through its base tag.
  // Auto ads must stay off; manual units are pushed only by the consent-gated controller.
  if (!document.querySelector('#makeatimer-google-tag')) {
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.id = 'makeatimer-google-tag';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
    script.onerror = adapter.fail;
    document.head.append(script);
  }
  return adapter;
}
