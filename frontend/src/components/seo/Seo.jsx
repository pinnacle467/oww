import { Helmet } from "react-helmet-async";
import { useContent } from "@/context/ContentContext";

// One stop shop for per-page SEO. Resolves the title / description /
// keywords / og:image in this order of precedence:
//
//   1. Explicit prop (caller wants to override for a one-off page)
//   2. CMS content key (`seo.{page}.title`, etc.) — admin editable
//   3. Hard-coded fallback inside this component
//
// `path` is the canonical route (e.g. "/pricing"). The canonical URL is
// always built off a fixed production origin so the social cards/snippets
// the preview hosts never leak.
const PRODUCTION_ORIGIN = "https://oncewerewild.com";
const BRAND_SUFFIX = " | Once Were Wild Travel";

const FALLBACKS = {
  home: {
    title: "Women only travel Australia | Slow group tours & Maleny retreat",
    description:
      "Once Were Wild, small group, women-only journeys across Tasmania, Western Australia and beyond, plus a creative Maleny retreat in the Sunshine Coast hinterland.",
    keywords: "women only travel Australia, women's small group tours, Maleny retreat, slow travel for women",
  },
  pricing: {
    title: "Women's small group tours Australia | Tasmania, WA & Maleny pricing",
    description:
      "All Once Were Wild journeys: 12–23 night small group odysseys through Tasmania and Western Australia, plus the 6 night Maleny creative retreat.",
    keywords: "women's small group tour pricing Australia, Tasmania women's tour, Maleny retreat price",
  },
  gallery: {
    title: "Once Were Wild Travel gallery | Women's tours of Australia & Maleny",
    description:
      "Photographs and short clips from past Once Were Wild journeys, Tasmania, Western Australia, Sunshine Coast hinterland and beyond.",
    keywords: "women's tour photography Australia, Maleny retreat photos, slow travel gallery",
  },
  contact: {
    title: "Contact Once Were Wild Travel | Women's tour and Maleny retreat enquiries",
    description:
      "Speak with the team behind Once Were Wild Travel. Email, phone, the Maleny office address and a quick enquiry form.",
    keywords: "Once Were Wild contact, women's tour enquiry Australia, Maleny retreat enquiry",
  },
};

export function Seo({
  page,           // "home" | "pricing" | "gallery" | "contact"
  path = "/",
  title,
  description,
  keywords,
  image,
  type = "website",
  jsonLd,
  noindex = false,
}) {
  const { content } = useContent();

  const cms = (key) => content?.[`seo.${page}.${key}`] || "";
  const fb = FALLBACKS[page] || {};

  const resolvedTitleBare = title || cms("title") || fb.title || "Once Were Wild Travel";
  // Avoid double-suffixing if the operator already includes the brand.
  const fullTitle = resolvedTitleBare.includes("Once Were Wild")
    ? resolvedTitleBare
    : `${resolvedTitleBare}${BRAND_SUFFIX}`;

  const resolvedDescription = description || cms("description") || fb.description || "";
  const resolvedKeywords = keywords || cms("keywords") || fb.keywords || "";
  const canonical = `${PRODUCTION_ORIGIN}${path}`;
  const ogImage =
    image ||
    cms("og_image") ||
    `${PRODUCTION_ORIGIN}/assets/logo-horizontal-white.png`;

  return (
    <Helmet prioritizeSeoTags>
      <title>{fullTitle}</title>
      {resolvedDescription && <meta name="description" content={resolvedDescription} />}
      {resolvedKeywords && <meta name="keywords" content={resolvedKeywords} />}
      <link rel="canonical" href={canonical} />
      {/* Hreflang — single-locale en-AU site with itself as the default. */}
      <link rel="alternate" hrefLang="en-AU" href={canonical} />
      <link rel="alternate" hrefLang="x-default" href={canonical} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      <meta property="og:title" content={fullTitle} />
      {resolvedDescription && <meta property="og:description" content={resolvedDescription} />}
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:locale" content="en_AU" />
      <meta property="og:site_name" content="Once Were Wild Travel" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      {resolvedDescription && <meta name="twitter:description" content={resolvedDescription} />}
      <meta name="twitter:image" content={ogImage} />

      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
}

export default Seo;
