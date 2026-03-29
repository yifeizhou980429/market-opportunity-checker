import {
  EvidenceItem,
  InsightMetric,
  Market,
  ReportSection,
  SourceHealth
} from "@/lib/types";
import {
  buildPullpushCommentUrl,
  clamp,
  dedupeBy,
  fetchJson,
  truncate
} from "@/lib/collectors/shared";

type PullpushComment = {
  body?: string;
  permalink?: string;
  score?: number;
  subreddit_name_prefixed?: string;
  ups?: number;
};

type PullpushResponse = {
  data?: PullpushComment[];
};

type ReviewSnippet = {
  score: number;
  subreddit: string;
  text: string;
  url: string;
};

type ThemeDefinition = {
  label: string;
  match: string[];
  recommendation: string;
};

const ISSUE_TERMS = [
  "awkward",
  "budget",
  "clean",
  "cheap",
  "cost",
  "drain",
  "durable",
  "expensive",
  "fit",
  "fold",
  "hold up",
  "leak",
  "price",
  "problem",
  "quality",
  "setup",
  "shower",
  "small",
  "space",
  "sturdy"
];

const THEME_DEFINITIONS: ThemeDefinition[] = [
  {
    label: "Setup and drainage friction",
    match: ["drain", "draining", "cleanup", "clean", "empty", "setup", "fold"],
    recommendation: "Lead with faster drainage and easier setup in small spaces."
  },
  {
    label: "Size and space constraints",
    match: ["space", "shower", "small", "fit", "size", "room"],
    recommendation: "Position around compact setups, footprint clarity, and exact dimensions."
  },
  {
    label: "Durability and build quality concerns",
    match: ["leak", "durable", "durability", "cheap", "quality", "sturdy", "hold up"],
    recommendation: "Emphasize sturdier materials, insulation, and durability proof."
  },
  {
    label: "Price and value hesitation",
    match: ["budget", "price", "cost", "expensive", "worth"],
    recommendation: "Either defend a premium build or simplify into a sharper budget-friendly offer."
  }
];

export interface ReviewSignal {
  painPointScore: number;
  sampleCount: number;
  themes: ThemeDefinition[];
  section: ReportSection;
  sourceHealth: SourceHealth;
}

function buildCommentQueries(keyword: string): string[] {
  return [
    `"${keyword}"`,
    `"${keyword}" review problem`,
    `"${keyword}" setup drain size quality`
  ];
}

function sanitizeSentence(sentence: string): string {
  return sentence
    .replace(/\[[^\]]+\]\((https?:\/\/[^\s)]+)\)/gi, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitIntoSentences(text: string): string[] {
  return text
    .split(/[\n\r]+|(?<=[.!?])\s+/)
    .map((sentence) => sanitizeSentence(sentence))
    .filter(Boolean);
}

function sentenceScore(sentence: string): number {
  const lower = sentence.toLowerCase();

  return ISSUE_TERMS.reduce((score, term) => {
    return lower.includes(term) ? score + 1 : score;
  }, 0);
}

function classifyTheme(sentence: string): ThemeDefinition | null {
  const lower = sentence.toLowerCase();
  return (
    THEME_DEFINITIONS.find((theme) =>
      theme.match.some((needle) => lower.includes(needle))
    ) ?? null
  );
}

function buildFallbackReviewSignal(keyword: string, market: Market): ReviewSignal {
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(`site:reddit.com "${keyword}" review`)}`;

  return {
    painPointScore: 35,
    sampleCount: 0,
    themes: [],
    section: {
      score: 35,
      status: "Negative",
      summary:
        "Public discussion was too thin or too noisy to extract reliable live pain-point language for this request.",
      metrics: [
        {
          label: "Collector",
          value: "Fallback"
        }
      ],
      bullets: [
        "The review collector could not find enough clean, issue-oriented community snippets.",
        "Use the linked search query to inspect discussion manually before trusting a pain-point angle."
      ],
      evidence: [
        {
          id: "reviews-fallback-search",
          label: "Community search",
          url: searchUrl,
          excerpt: "Open a live search for forum and Reddit discussion around this keyword."
        }
      ]
    },
    sourceHealth: {
      key: "reviews",
      label: "Discussion snippets",
      status: "Fallback",
      detail: "Not enough clean discussion snippets survived the filter."
    }
  };
}

export async function collectReviewSignal(
  keyword: string,
  market: Market
): Promise<ReviewSignal> {
  try {
    const queries = buildCommentQueries(keyword);
    const responses = await Promise.allSettled(
      queries.map((query) => fetchJson<PullpushResponse>(buildPullpushCommentUrl(query)))
    );

    const snippets = responses.flatMap((result, index) => {
      if (result.status !== "fulfilled") {
        return [];
      }

      return (result.value.data ?? []).flatMap((item) => {
        const text = item.body ?? "";
        const scoreBoost = (item.score ?? item.ups ?? 0) + (queries.length - index);

        return splitIntoSentences(text)
          .filter((sentence) => sentence.length >= 45 && sentence.length <= 220)
          .filter((sentence) => sentenceScore(sentence) >= 1)
          .map((sentence) => ({
            score: scoreBoost + sentenceScore(sentence),
            subreddit: item.subreddit_name_prefixed ?? "r/reddit",
            text: sentence,
            url: item.permalink
              ? `https://www.reddit.com${item.permalink}`
              : "https://www.reddit.com/search/?q=" + encodeURIComponent(keyword)
          }));
      });
    });

    const cleaned = dedupeBy(
      snippets
        .filter((snippet) => !/order page|buyer's guide|comparison site|amazon\.com|shopthis\.store/i.test(snippet.text))
        .sort((left, right) => right.score - left.score),
      (snippet) => snippet.text.toLowerCase()
    )
      .filter((snippet) => classifyTheme(snippet.text) !== null)
      .slice(0, 8);

    if (cleaned.length < 2) {
      return buildFallbackReviewSignal(keyword, market);
    }

    const themed = cleaned
      .map((snippet) => ({
        snippet,
        theme: classifyTheme(snippet.text)
      }))
      .filter((entry) => entry.theme !== null) as Array<{
      snippet: ReviewSnippet;
      theme: ThemeDefinition;
    }>;

    const themeMap = new Map<string, { definition: ThemeDefinition; count: number }>();
    themed.forEach(({ theme }) => {
      themeMap.set(theme.label, {
        count: (themeMap.get(theme.label)?.count ?? 0) + 1,
        definition: theme
      });
    });

    const topThemes = [...themeMap.values()]
      .sort((left, right) => right.count - left.count)
      .slice(0, 3)
      .map((entry) => entry.definition);

    const painPointScore = clamp(
      34 + Math.min(cleaned.length, 6) * 6 + topThemes.length * 8,
      22,
      86
    );

    const metrics: InsightMetric[] = [
      {
        label: "Snippets kept",
        value: String(cleaned.length)
      },
      {
        label: "Themes",
        value: String(topThemes.length)
      },
      {
        label: "Market",
        value: market
      }
    ];

    const evidence: EvidenceItem[] = cleaned.slice(0, 3).map((snippet, index) => ({
      id: `review-snippet-${index + 1}`,
      label: `${snippet.subreddit}`,
      url: snippet.url,
      excerpt: truncate(snippet.text, 120)
    }));

    return {
      painPointScore,
      sampleCount: cleaned.length,
      themes: topThemes,
      section: {
        score: painPointScore,
        status: painPointScore >= 67 ? "Positive" : painPointScore >= 45 ? "Mixed" : "Negative",
        summary: `Filtered ${cleaned.length} live community snippets into reusable pain-point language from public discussion threads.`,
        metrics,
        bullets:
          topThemes.length > 0
            ? topThemes.map(
                (theme) =>
                  `${theme.label}. ${theme.recommendation}`
              )
            : [
                "Live discussion exists, but the snippets are too fragmented to cluster into stable themes."
              ],
        evidence
      },
      sourceHealth: {
        key: "reviews",
        label: "Discussion snippets",
        status: "Live",
        detail: `${cleaned.length} filtered discussion snippets from public community threads.`
      }
    };
  } catch {
    return buildFallbackReviewSignal(keyword, market);
  }
}
