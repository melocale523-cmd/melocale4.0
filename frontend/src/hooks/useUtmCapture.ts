import { useEffect } from 'react';

export const UTM_STORAGE_KEY = 'melocale_utm';

interface StoredUtm {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
}

const PAID_SOURCES = ['meta', 'facebook', 'fb', 'instagram', 'ig'];

export function useUtmCapture() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const source = params.get('utm_source');
    if (!source) return;

    const utm: StoredUtm = {
      source,
      medium: params.get('utm_medium'),
      campaign: params.get('utm_campaign'),
      content: params.get('utm_content'),
    };
    sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
  }, []);
}

/** Resolve a origem do cadastro no momento do submit. Indicação > Meta Ads > orgânico. */
export function resolveSignupOrigin(): 'meta_ads' | 'referral' | 'organic' {
  if (sessionStorage.getItem('melocale_ref')) return 'referral';

  const raw = sessionStorage.getItem(UTM_STORAGE_KEY);
  if (raw) {
    try {
      const utm: StoredUtm = JSON.parse(raw);
      if (utm.source && PAID_SOURCES.includes(utm.source.toLowerCase())) {
        return 'meta_ads';
      }
    } catch {
      // JSON malformado — cai pra orgânico
    }
  }
  return 'organic';
}
