import { supabaseAdmin } from "../config.js";
import { withTimeout } from "./timeout.js";

export type SeoEventType = "page_view" | "signup" | "lead_created" | "lead_purchased";
export type SeoRole = "client" | "professional" | "admin";

export interface SeoConversionInput {
  event_type: SeoEventType;
  user_id?: string | null;
  role?: SeoRole | null;
  landing_path?: string | null;
  service_slug?: string | null;
  service_category?: string | null;
  service_city?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  lead_id?: string | null;
  lead_purchase_id?: string | null;
  price_coins?: number | null;
  revenue_brl?: number | null;
  metadata?: Record<string, unknown>;
}

export interface SeoAttribution {
  landing_path?: string | null;
  service_slug?: string | null;
  service_category?: string | null;
  service_city?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
}

function cleanText(value: unknown, maxLength = 500): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  if (!clean) return null;
  return clean.slice(0, maxLength);
}

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function inferSeoService(input: Pick<SeoAttribution, "landing_path" | "service_slug" | "service_category" | "service_city" | "utm_content">): SeoAttribution {
  const explicitSlug = cleanText(input.service_slug, 180);
  const landingPath = cleanText(input.landing_path, 500);
  const utmContent = cleanText(input.utm_content, 200);
  const candidates = [explicitSlug, landingPath, utmContent].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const normalized = candidate
      .replace(/^https?:\/\/[^/]+/i, "")
      .replace(/^\/+/, "")
      .replace(/^servicos\//i, "")
      .split("?")[0]
      .split("#")[0]
      .trim();

    const match = normalized.match(/^([a-z0-9-]+)-em-([a-z0-9-]+)$/i);
    if (match) {
      return {
        service_slug: match[0].toLowerCase(),
        service_category: cleanText(input.service_category, 160) ?? titleFromSlug(match[1].toLowerCase()),
        service_city: cleanText(input.service_city, 160) ?? titleFromSlug(match[2].toLowerCase()),
      };
    }
  }

  return {
    service_slug: explicitSlug,
    service_category: cleanText(input.service_category, 160),
    service_city: cleanText(input.service_city, 160),
  };
}

export function seoAttributionFromRecord(record: Record<string, unknown> | undefined | null): SeoAttribution {
  if (!record) return {};
  return {
    landing_path: cleanText(record.seo_landing_path ?? record.landing_path, 500),
    service_slug: cleanText(record.seo_service_slug ?? record.service_slug, 180),
    service_category: cleanText(record.seo_service_category ?? record.service_category, 160),
    service_city: cleanText(record.seo_service_city ?? record.service_city, 160),
    utm_source: cleanText(record.utm_source, 100),
    utm_medium: cleanText(record.utm_medium, 100),
    utm_campaign: cleanText(record.utm_campaign, 200),
    utm_content: cleanText(record.utm_content, 200),
  };
}

async function resolveRole(userId: string | null | undefined, role: SeoRole | null | undefined): Promise<SeoRole | null> {
  if (role) return role;
  if (!userId) return null;

  const { data, error } = await withTimeout(
    supabaseAdmin.from("profiles").select("role").eq("id", userId).maybeSingle(),
    8000
  );
  if (error) {
    console.error("[seo] falha ao resolver role:", error.message);
    return null;
  }
  const profileRole = data?.role;
  return profileRole === "client" || profileRole === "professional" || profileRole === "admin"
    ? profileRole
    : null;
}

export async function trackSeoConversionEvent(input: SeoConversionInput): Promise<boolean> {
  try {
    const inferred = inferSeoService(input);
    const role = await resolveRole(input.user_id, input.role);
    const payload = {
      event_type: input.event_type,
      user_id: input.user_id ?? null,
      role,
      landing_path: cleanText(input.landing_path, 500),
      service_slug: inferred.service_slug ?? null,
      service_category: inferred.service_category ?? null,
      service_city: inferred.service_city ?? null,
      utm_source: cleanText(input.utm_source, 100),
      utm_medium: cleanText(input.utm_medium, 100),
      utm_campaign: cleanText(input.utm_campaign, 200),
      utm_content: cleanText(input.utm_content, 200),
      lead_id: input.lead_id ?? null,
      lead_purchase_id: input.lead_purchase_id ?? null,
      price_coins: input.price_coins ?? null,
      revenue_brl: input.revenue_brl ?? null,
      metadata: input.metadata ?? {},
    };

    const { error } = await withTimeout(
      supabaseAdmin.from("seo_conversion_events").insert(payload),
      8000
    );
    if (error) {
      console.error("[seo] falha ao gravar evento:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[seo] erro inesperado no tracking:", err instanceof Error ? err.message : String(err));
    return false;
  }
}
