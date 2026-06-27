// Once Were Wild — central content source.
// COPY_PLACEHOLDER markers note where the client may refine wording.
// Pricing and journey details below are taken from the live oncewerewild.com pages.

export const BRAND = {
  name: "Once Were Wild",
  sub: "Travel",
  tagline: "Rediscover the woman who was always wild at heart.",
  domain: "oncewerewild.com",
};

export const NAV_LINKS = [
  { label: "Home", to: "/" },
  { label: "Journeys", to: "/pricing" },
  { label: "Gallery", to: "/gallery" },
  { label: "About", to: "/about" },
];

export const HERO_SLIDES = [
  // ADMIN: Replace these images via the admin panel at /admin/hero
  { src: "/assets/images/hero/hero-01.webp", alt: "Lone tree wrapped in morning fog across the Maleny hinterland" },
  { src: "/assets/images/hero/hero-02.webp", alt: "A woman pausing to take in a wide rocky coastal view" },
  { src: "/assets/images/hero/hero-03.webp", alt: "A woman among tall gum trees in a tranquil forest" },
  { src: "/assets/images/hero/hero-04.webp", alt: "Friends resting together on a timber verandah at golden hour" },
  { src: "/assets/images/hero/hero-05.webp", alt: "A quiet passage opening toward the ocean" },
];

export const MANIFESTO = {
  eyebrow: "Our Belief",
  heading: "There is a version of you who has been waiting.",
  body: [
    "She has earned every grey hair, every passport stamp, every hard won lesson. She is ready to move.",
    "We design personal, unprocessed and unrushed journeys that invite you to rediscover your inner wild. Grounded in connection and shaped by untamed roads and shared tables, we turn a lifetime of lived travel into your next unforgettable story.",
    "We do not do tourist tracks or checkbox travel. We curate intimate, small group journeys for women ready to step out of their comfort zones and dive into the world.",
  ],
  pullQuote: "This is travel lived, and life truly loved.",
};

export const PILLARS = [
  {
    title: "Small Group Journeys",
    desc: "Carefully curated adventures for women who want depth over distance, and meaning over mere sightseeing.",
    img: "/assets/images/hero/hero-03.webp", // ADMIN: replace via /admin
    to: "/pricing",
    cta: "View journeys",
  },
  {
    title: "Maleny Retreats",
    desc: "Nestled in the Sunshine Coast hinterland, our Maleny retreats are spaces to breathe, to create, and to return to yourself.",
    img: "/assets/images/pillar-retreat.webp",
    to: "/pricing",
    cta: "Discover the retreat",
  },
  {
    title: "Corporate and Custom",
    desc: "Your team, your story, your experience. We build journeys from scratch around what matters to your people.",
    img: "/assets/images/pillar-corporate.webp",
    to: "/contact",
    cta: "Start a conversation",
  },
];

export const MALENY = {
  eyebrow: "Immersive Retreats",
  heading: "Maleny, where you arrive and exhale.",
  body: "Tucked behind the Sunshine Coast and rising 425 metres above the sea, Maleny and Montville are the calm behind the coast, the green behind the gold. A six night immersion of making, moving and nourishing, never rushed, always intentional. You simply arrive, and breathe out.",
  tags: ["create", "explore", "feel", "taste", "transform"],
  img: "/assets/images/pillar-retreat.webp",
};

export const TESTIMONIALS = [
  { quote: "Your awesome guides, Barbara and Adele, effervescent and meticulous in equal measure.", author: "A travelling guest" },
  { quote: "Barbara and Adele, your exceptional guides, combine lively energy with a meticulous approach to travel.", author: "Western Australia journey" },
  { quote: "I came to wander and I left changed. The pace, the women, the land. All of it stayed with me.", author: "Maleny retreat guest" }, // COPY_PLACEHOLDER
  { quote: "Nothing to organise, nothing to prove. Just space to feel like myself again.", author: "Creative immersion guest" }, // COPY_PLACEHOLDER
];

export const CHARITY_TEASER = {
  eyebrow: "Giving Back",
  heading: "We believe travel has the power to change lives.",
  body: "Not just those of our guests. A share of every journey returns to the communities and wild places that shape our stories, so the roads that move us also lift the people who call them home.",
  images: ["/assets/images/charity/charity-01.webp", "/assets/images/charity/charity-02.webp", "/assets/images/charity/charity-03.webp"],
};

// Real journeys and pricing from oncewerewild.com
export const JOURNEYS = [
  {
    id: "maleny",
    name: "Maleny Creative Immersion",
    region: "Sunshine Coast Hinterland",
    nights: "6 nights",
    dates: "22 to 28 November 2026, or 28 November to 4 December 2026",
    priceFrom: "From $4,200",
    priceUnit: "per person, twin share",
    priceNote: "Single from $4,750 per person",
    popular: false,
    summary: "A curated small group immersion blending art, nature, rest and shared experience.",
    includes: [
      "Premium, peaceful accommodation",
      "Bespoke dining by an accomplished chef",
      "Australian wines paired with dinner",
      "Master artisan creative workshops",
      "Guided hinterland walks and experiences",
      "All transportation and daily flow",
    ],
    cta: "Enquire about Maleny",
  },
  {
    id: "small-group",
    name: "Slow and Soulful Journeys",
    region: "Tasmania and Western Australia",
    nights: "12 to 23 nights",
    dates: "January and February 2027",
    priceFrom: "From $7,950",
    priceUnit: "per person, 12 night tours",
    priceNote: "Full 23 night odyssey from $15,200, GST included",
    popular: true,
    summary: "Intimate small group odysseys across Australia's most breathtaking states, six to eight women.",
    includes: [
      "Twin share accommodation throughout",
      "Meals as specified, wine with dinner",
      "All experiences unless marked optional",
      "Farm to table cuisine and local wines",
      "Wildlife, wilderness and cultural discovery",
      "Effervescent, meticulous hosting",
    ],
    cta: "Enquire about a journey",
  },
  {
    id: "corporate",
    name: "Corporate and Custom",
    region: "Designed around your people",
    nights: "Tailored",
    dates: "By arrangement",
    priceFrom: "Enquire",
    priceUnit: "bespoke quotation",
    priceNote: "Custom small group Australian journeys, minimum 7 nights",
    popular: false,
    summary: "Step out of the noise and into the rainforest. All inclusive retreats built for your team.",
    includes: [
      "Fully hosted, seamless planning",
      "Custom itinerary from scratch",
      "Private group, families or teams",
      "Maleny corporate rainforest retreats",
      "Celebrations and milestone journeys",
      "Flexible dates and group sizes",
    ],
    cta: "Start a conversation",
  },
];

export const PRICING_FINE_PRINT =
  "A 20 percent deposit secures your place. The balance is due 60 days prior to departure. Cancellations from booking to 60 days prior incur a $500 fee. Cancellations within 60 days are non refundable unless we are able to rebook your place, where a $500 fee applies. Travel insurance is strongly advised."; // From oncewerewild.com policy

export const FAQS = [
  { q: "Who travels with Once Were Wild?", a: "Our journeys are designed for women, often 45 and beyond, who are curious, independent and ready to step gently out of the everyday. Groups stay small, usually six to eight, so connection comes easily." },
  { q: "What is included in the price?", a: "Most journeys are all inclusive of accommodation, meals as specified, wine with dinner, guided experiences and transport. Each journey page lists exactly what is covered so there are no surprises." },
  { q: "How do I secure my place?", a: "A 20 percent deposit reserves your spot. The balance is due 60 days before departure. We will guide you gently through every step once you register your interest." },
  { q: "Can you cater for dietary needs?", a: "We thoughtfully accommodate most dietary needs. As our shared menus include animal proteins we cannot cater for vegan diets on the standard retreat, though a dedicated vegan retreat can be arranged with enough interest." },
  { q: "Do you arrange corporate and private journeys?", a: "Yes. We build custom small group journeys and corporate retreats from scratch, designed entirely around your people, your story and your dates." },
  { q: "Is travel insurance required?", a: "Travel insurance is strongly advised for every guest, to protect you from unexpected situations that may require a change of plans at short notice." },
];

export const GALLERY_CATEGORIES = ["Maleny Retreats", "Across Australia", "Across the World"];

export const GALLERY_ITEMS = [
  // ADMIN: Manage all gallery media via the admin panel at /admin/gallery
  { src: "/assets/images/gallery/gallery-01.webp", caption: "A quiet moment above the bay", category: "Across Australia" },
  { src: "/assets/images/gallery/gallery-02.webp", caption: "Standing where the lake meets the range", category: "Across Australia" },
  { src: "/assets/images/gallery/gallery-03.webp", caption: "Among the old gum trees", category: "Maleny Retreats" },
  { src: "/assets/images/gallery/gallery-04.webp", caption: "Coastline walk, Broken Head", category: "Across Australia" },
  { src: "/assets/images/gallery/gallery-05.webp", caption: "Walking the green roads together", category: "Across the World" },
  { src: "/assets/images/gallery/gallery-06.webp", caption: "Into the wild woodland", category: "Across Australia" },
  { src: "/assets/images/gallery/gallery-07.webp", caption: "Hands shaping clay in the studio", category: "Maleny Retreats" },
  { src: "/assets/images/gallery/gallery-08.webp", caption: "A creative workshop in progress", category: "Maleny Retreats" },
  { src: "/assets/images/pillar-retreat.webp", caption: "The hinterland garden at rest", category: "Maleny Retreats" },
  { src: "/assets/images/charity/charity-01.webp", caption: "Stillness and breath", category: "Across the World" },
];

export const CHARITY = {
  hero: "/assets/images/charity/charity-01.webp",
  heading: "Travel that leaves the world a little softer.",
  intro: "We believe the roads that move us should also lift the people and places we pass through. A share of every journey returns to the communities and wild landscapes that shape our stories.", // COPY_PLACEHOLDER
  stats: [
    { value: 12, suffix: "+", label: "Communities supported" },
    { value: 40, suffix: "", label: "Journeys gifted" },
    { value: 8, suffix: "", label: "Wild places protected" },
    { value: 100, suffix: "%", label: "Hearts in it" },
  ],
  stories: [
    { title: "Walking softly on Country", body: "We partner with local guides and First Nations storytellers, returning a portion of every itinerary to the communities who hold these landscapes.", img: "/assets/images/gallery/gallery-06.webp" }, // COPY_PLACEHOLDER
    { title: "Lifting women, together", body: "Each season we gift retreat places to women navigating hardship, because the right pause at the right moment can change a life.", img: "/assets/images/gallery/gallery-05.webp" }, // COPY_PLACEHOLDER
    { title: "Caring for wild places", body: "From hinterland restoration to coastline care, we give back to the wild places that give us so much.", img: "/assets/images/gallery/gallery-03.webp" }, // COPY_PLACEHOLDER
  ],
};

export const INQUIRY_TYPES = [
  "Small Group Journey",
  "Maleny Retreat",
  "Corporate Retreat",
  "General Inquiry",
];

export const REFERRAL_SOURCES = [
  "Instagram",
  "Facebook",
  "A friend",
  "Search engine",
  "A previous journey",
  "Other",
];
