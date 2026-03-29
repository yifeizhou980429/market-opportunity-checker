import { load } from "cheerio";
import {
  EvidenceItem,
  InsightMetric,
  Market,
  PriceMapSection,
  ReportSection,
  SourceHealth
} from "@/lib/types";
import {
  buildEbaySearchUrl,
  clamp,
  dedupeBy,
  fetchText,
  formatMoney,
  median,
  percentile,
  tokenize,
  truncate
} from "@/lib/collectors/shared";

type ListingSample = {
  condition: string;
  location: string;
  price: number;
  shipping: number | null;
  text: string;
  title: string;
  url: string;
};

export interface MarketSignal {
  competitionScore: number;
  pricingRoomScore: number;
  priceSpreadRatio: number;
  sampleSize: number;
  titleTokens: string[];
  competitionSection: ReportSection;
  priceMapSection: PriceMapSection;
  sourceHealth: SourceHealth;
}

const CONDITION_MARKERS = [
  "Brand New",
  "Pre-Owned",
  "New without tags",
  "Open box",
  "Used",
  "New"
];

function extractPrice(text: string): number | null {
  const match = text.match(/\$(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)/);

  if (!match) {
    return null;
  }

  return Number.parseFloat(match[1].replace(/,/g, ""));
}

function extractShipping(text: string): number | null {
  if (/free delivery/i.test(text)) {
    return 0;
  }

  const match = text.match(/\+\$?(\d{1,4}(?:,\d{3})*(?:\.\d{2})?) delivery/i);
  return match ? Number.parseFloat(match[1].replace(/,/g, "")) : null;
}

function extractCondition(text: string): string {
  return CONDITION_MARKERS.find((marker) => text.includes(marker)) ?? "Unknown condition";
}

function extractLocation(text: string): string {
  const match = text.match(/Located in ([A-Za-z ]+)/i);
  return match?.[1]?.trim() ?? "Unknown location";
}

function extractTitle(text: string): string {
  const marker =
    CONDITION_MARKERS.map((candidate) => ({
      candidate,
      index: text.indexOf(candidate)
    }))
      .filter((candidate) => candidate.index > 0)
      .sort((left, right) => left.index - right.index)[0]?.index ?? text.length;

  return text
    .slice(0, marker)
    .replace(/^NEW LOW PRICE/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractListings(html: string): ListingSample[] {
  const $ = load(html);
  const cards = $(".s-card")
    .map((_, element) => {
      const text = $(element).text().replace(/\s+/g, " ").trim();
      const url = $(element).find("a[href*='/itm/']").last().attr("href");
      const titleFromLink = $(element)
        .find("a[href*='/itm/']")
        .last()
        .text()
        .replace(/\s+/g, " ")
        .replace(/opens in a new window or tab/gi, "")
        .trim();
      const price = extractPrice(text);

      if (!url || !price || text.includes("Shop on eBay")) {
        return null;
      }

      const title =
        titleFromLink && titleFromLink !== "Shop on eBay"
          ? titleFromLink
          : extractTitle(text);

      if (!title || title.length < 12) {
        return null;
      }

      return {
        condition: extractCondition(text),
        location: extractLocation(text),
        price,
        shipping: extractShipping(text),
        text,
        title,
        url
      };
    })
    .get()
    .filter((listing): listing is ListingSample => Boolean(listing));

  return dedupeBy(cards, (item) => item.url).slice(0, 12);
}

function buildFallbackSignal(keyword: string, market: Market): MarketSignal {
  const searchUrl = buildEbaySearchUrl(keyword, market);

  return {
    competitionScore: 45,
    pricingRoomScore: 45,
    priceSpreadRatio: 0,
    sampleSize: 0,
    titleTokens: [],
    competitionSection: {
      score: 45,
      status: "Mixed",
      summary: "Live marketplace sampling is unavailable right now, so competition is marked as uncertain.",
      metrics: [
        {
          label: "Collector",
          value: "Fallback"
        }
      ],
      bullets: [
        "The report could not parse live marketplace cards from eBay for this run.",
        "Use the linked search page to inspect seller density, titles, and offer repetition manually."
      ],
      evidence: [
        {
          id: "market-fallback-search",
          label: "eBay search",
          url: searchUrl,
          excerpt: "Open the live search results to inspect current listings and pricing manually."
        }
      ]
    },
    priceMapSection: {
      low: 0,
      mid: 0,
      high: 0,
      currency: market === "AU" ? "AUD" : "USD",
      sampleSize: 0,
      summary: "Price sampling is unavailable until the live marketplace collector succeeds.",
      metrics: [
        {
          label: "Sample size",
          value: "0"
        }
      ],
      evidence: [
        {
          id: "price-fallback-search",
          label: "eBay search",
          url: searchUrl,
          excerpt: "Live price sampling was not available for this request."
        }
      ]
    },
    sourceHealth: {
      key: "market",
      label: "Live listings",
      status: "Fallback",
      detail: "eBay parsing failed for this request."
    }
  };
}

export async function collectMarketSignal(
  keyword: string,
  market: Market
): Promise<MarketSignal> {
  const searchUrl = buildEbaySearchUrl(keyword, market);
  const currency = market === "AU" ? "AUD" : "USD";

  try {
    const html = await fetchText(searchUrl);
    const listings = extractListings(html);

    if (listings.length < 4) {
      return buildFallbackSignal(keyword, market);
    }

    const activeListings =
      listings.filter((listing) => !/pre-owned|used/i.test(listing.condition)).length >= 6
        ? listings.filter((listing) => !/pre-owned|used/i.test(listing.condition))
        : listings;

    const prices = activeListings.map((listing) => listing.price);
    const low = Math.round(percentile(prices, 0.25));
    const mid = Math.round(median(prices));
    const high = Math.round(percentile(prices, 0.75));
    const priceSpreadRatio = mid > 0 ? (high - low) / mid : 0;

    const keywordTokens = new Set(tokenize(keyword));
    const tokenCounts = new Map<string, number>();

    listings.forEach((listing) => {
      const seenInTitle = new Set<string>();

      tokenize(listing.title)
        .filter((token) => !keywordTokens.has(token))
        .forEach((token) => {
          if (seenInTitle.has(token)) {
            return;
          }

          seenInTitle.add(token);
          tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
        });
    });

    const topTokens = [...tokenCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 4);

    const similarityPressure =
      topTokens.length > 0
        ? topTokens.reduce((sum, [, count]) => sum + count / listings.length, 0) /
          topTokens.length
        : 0.25;

    const competitionScore = clamp(
      Math.round(74 - similarityPressure * 42 + priceSpreadRatio * 24),
      20,
      88
    );

    const pricingRoomScore = clamp(
      Math.round(36 + priceSpreadRatio * 105 - similarityPressure * 10 + Math.min(listings.length, 10)),
      18,
      90
    );

    const repeatedTokenLabel =
      topTokens.length > 0
        ? topTokens.map(([token]) => token).join(", ")
        : "no dominant title pattern";

    const evidence: EvidenceItem[] = activeListings.slice(0, 3).map((listing, index) => ({
      id: `market-item-${index + 1}`,
      label: truncate(listing.title, 54),
      url: listing.url,
      excerpt: `${formatMoney(currency, listing.price)}${listing.shipping === 0 ? " · free delivery" : listing.shipping ? ` · +${formatMoney(currency, listing.shipping)} delivery` : ""} · ${listing.condition}`
    }));

    const competitionMetrics: InsightMetric[] = [
      {
        label: "Listings sampled",
        value: String(listings.length)
      },
      {
        label: "Price spread",
        value: `${Math.round(priceSpreadRatio * 100)}%`
      },
      {
        label: "Repeated tokens",
        value: repeatedTokenLabel
      }
    ];

    const priceMetrics: InsightMetric[] = [
      {
        label: "Low band",
        value: formatMoney(currency, low)
      },
      {
        label: "Median",
        value: formatMoney(currency, mid)
      },
      {
        label: "High band",
        value: formatMoney(currency, high)
      }
    ];

    return {
      competitionScore,
      pricingRoomScore,
      priceSpreadRatio,
      sampleSize: listings.length,
      titleTokens: topTokens.map(([token]) => token),
      competitionSection: {
        score: competitionScore,
        status: competitionScore >= 67 ? "Positive" : competitionScore >= 45 ? "Mixed" : "Negative",
        summary: `Sampled ${listings.length} live marketplace listings from eBay ${market}. Titles are clustering around ${repeatedTokenLabel}.`,
        metrics: competitionMetrics,
        bullets: [
          "A higher competition score here means there is still some room to differentiate before the category fully commoditizes.",
          topTokens.length > 0
            ? `The most repeated title language is ${repeatedTokenLabel}, which suggests feature-led seller positioning.`
            : "Live listing titles are too fragmented to show a single dominant copy pattern.",
          `Current visible market pricing spans roughly from ${formatMoney(currency, low)} to ${formatMoney(currency, high)} in the sampled set.`
        ],
        evidence
      },
      priceMapSection: {
        low,
        mid,
        high,
        currency,
        sampleSize: activeListings.length,
        summary: `The sampled eBay set currently clusters around ${formatMoney(currency, mid)}, with a live visible band from ${formatMoney(currency, low)} to ${formatMoney(currency, high)}.`,
        metrics: priceMetrics,
        evidence
      },
      sourceHealth: {
        key: "market",
        label: "Live listings",
        status: "Live",
        detail: `${listings.length} eBay listings parsed successfully.`
      }
    };
  } catch {
    return buildFallbackSignal(keyword, market);
  }
}
