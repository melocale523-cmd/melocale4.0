import { useEffect } from 'react';
import { API_URL } from '../lib/api';

export const UTM_STORAGE_KEY = 'melocale_utm';
const LANDING_PATH_KEY = 'melocale_landing_path';

export interface StoredUtm {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
}

export interface SeoAttribution {
  origin: 'meta_ads' | 'referral' | 'organic';
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  landing_path?: string;
  service_slug?: string;
  service_category?: string;
  service_city?: string;
}

const PAID_SOURCES = ['meta', 'facebook', 'fb', 'instagram', 'ig'];

export function useUtmCapture() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const source = params.get('utm_source');
    sessionStorage.setItem(LANDING_PATH_KEY, window.location.pathname);

    if (source) {
      const utm: StoredUtm = {
        source,
        medium: params.get('utm_medium'),
        campaign: params.get('utm_campaign'),
        content: params.get('utm_content'),
      };
      sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
      sessionStorage.setItem(LANDING_PATH_KEY, window.location.pathname);
    }

    const attribution = getSeoAttribution();
    if (!attribution.landing_path?.startsWith('/servicos')) return;

    const pageViewKey = `melocale_seo_page_view:${attribution.landing_path}:${attribution.utm_source ?? ''}:${attribution.utm_campaign ?? ''}`;
    if (sessionStorage.getItem(pageViewKey)) return;
    sessionStorage.setItem(pageViewKey, '1');

    fetch(`${API_URL}/api/track/seo-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'page_view',
        ...attribution,
      }),
      keepalive: true,
    }).catch(() => {});
  }, []);
}

export function getStoredUtm(): StoredUtm {
  try {
    const raw = sessionStorage.getItem(UTM_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as StoredUtm;
  } catch {
    // Ignore unavailable storage or invalid data.
  }
  return { source: null, medium: null, campaign: null, content: null };
}

function titleFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function parseSeoService(value?: string | null): Pick<SeoAttribution, 'service_slug' | 'service_category' | 'service_city'> {
  if (!value) return {};
  const normalized = value
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/^\/+/, '')
    .replace(/^servicos\//i, '')
    .split('?')[0]
    .split('#')[0]
    .trim();
  const match = normalized.match(/^([a-z0-9-]+)-em-([a-z0-9-]+)$/i);
  if (!match) return {};
  return {
    service_slug: match[0].toLowerCase(),
    service_category: titleFromSlug(match[1].toLowerCase()),
    service_city: titleFromSlug(match[2].toLowerCase()),
  };
}

export function getSeoAttribution(): SeoAttribution {
  const utm = getStoredUtm();
  const landingPath = sessionStorage.getItem(LANDING_PATH_KEY) || window.location.pathname || undefined;
  const serviceFromLanding = parseSeoService(landingPath);
  const service = serviceFromLanding.service_slug ? serviceFromLanding : parseSeoService(utm.content);

  return {
    origin: resolveSignupOrigin(),
    utm_source: utm.source || undefined,
    utm_medium: utm.medium || undefined,
    utm_campaign: utm.campaign || undefined,
    utm_content: utm.content || undefined,
    landing_path: landingPath,
    ...service,
  };
}

export function getSeoMetadata(): Record<string, string> {
  const attribution = getSeoAttribution();
  const metadata: Record<string, string> = {};
  if (attribution.landing_path) metadata.seo_landing_path = attribution.landing_path;
  if (attribution.service_slug) metadata.seo_service_slug = attribution.service_slug;
  if (attribution.service_category) metadata.seo_service_category = attribution.service_category;
  if (attribution.service_city) metadata.seo_service_city = attribution.service_city;
  if (attribution.utm_source) metadata.utm_source = attribution.utm_source;
  if (attribution.utm_medium) metadata.utm_medium = attribution.utm_medium;
  if (attribution.utm_campaign) metadata.utm_campaign = attribution.utm_campaign;
  if (attribution.utm_content) metadata.utm_content = attribution.utm_content;
  if (attribution.origin) metadata.signup_origin = attribution.origin;
  return metadata;
}

export const getSignupAttribution = getSeoAttribution;

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
      // Malformed JSON falls back to organic.
    }
  }
  return 'organic';
}
