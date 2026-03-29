import { Market } from "@/lib/types";

const STOPWORDS = new Set([
  "a",
  "about",
  "after",
  "all",
  "also",
  "and",
  "athlete",
  "athletes",
  "bath",
  "best",
  "brand",
  "built",
  "buy",
  "cold",
  "cover",
  "day",
  "delivery",
  "foldable",
  "for",
  "free",
  "from",
  "hot",
  "ice",
  "in",
  "is",
  "it",
  "large",
  "lid",
  "new",
  "opens",
  "of",
  "on",
  "or",
  "portable",
  "plunge",
  "recovery",
  "sale",
  "shipping",
  "size",
  "soaking",
  "storage",
  "tab",
  "the",
  "therapy",
  "to",
  "tub",
  "used",
  "window",
  "with",
  "xxl"
]);

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function average(numbers: number[]): number {
  if (numbers.length === 0) {
    return 0;
  }

  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

export function percentile(numbers: number[], percentileValue: number): number {
  if (numbers.length === 0) {
    return 0;
  }

  const sorted = [...numbers].sort((left, right) => left - right);
  const index = (sorted.length - 1) * percentileValue;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sorted[lower];
  }

  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function median(numbers: number[]): number {
  return percentile(numbers, 0.5);
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function dedupeBy<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = getKey(item);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "accept-language": "en-US,en;q=0.9",
      "user-agent": USER_AGENT
    },
    signal: AbortSignal.timeout(12000)
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status})`);
  }

  return response.text();
}

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "accept-language": "en-US,en;q=0.9",
      "user-agent": USER_AGENT
    },
    signal: AbortSignal.timeout(12000)
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status})`);
  }

  return (await response.json()) as T;
}

export function buildGoogleTrendsUrl(keyword: string, market: Market): string {
  return `https://trends.google.com/trends/explore?q=${encodeURIComponent(keyword)}&geo=${market}`;
}

export function buildEbaySearchUrl(keyword: string, market: Market): string {
  const domain = market === "AU" ? "https://www.ebay.com.au" : "https://www.ebay.com";
  return `${domain}/shop/${slugify(keyword)}?_nkw=${encodeURIComponent(keyword)}`;
}

export function buildPullpushCommentUrl(query: string, size = 12): string {
  return `https://api.pullpush.io/reddit/search/comment/?q=${encodeURIComponent(query)}&size=${size}`;
}

export function formatMoney(currency: string, amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format(amount);
}
