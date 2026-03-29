import googleTrends from "google-trends-api";
import {
  EvidenceItem,
  InsightMetric,
  Market,
  ReportSection,
  SourceHealth
} from "@/lib/types";
import {
  average,
  buildGoogleTrendsUrl,
  clamp,
  truncate
} from "@/lib/collectors/shared";

type TimelineEntry = {
  formattedAxisTime: string;
  formattedTime: string;
  hasData?: boolean[];
  isPartial?: boolean;
  time: string;
  value: number[];
};

type RelatedQueriesResponse = {
  default?: {
    rankedList?: Array<{
      rankedKeyword?: Array<{
        formattedValue?: string;
        query?: string;
      }>;
    }>;
  };
};

type InterestOverTimeResponse = {
  default?: {
    timelineData?: TimelineEntry[];
  };
};

export interface TrendSignal {
  score: number;
  direction: "Rising" | "Stable" | "Cooling";
  relatedQueries: string[];
  section: ReportSection;
  sourceHealth: SourceHealth;
}

function parseRelatedQueries(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as RelatedQueriesResponse;
    const rankedLists = parsed.default?.rankedList ?? [];
    const topQueries =
      rankedLists
        .flatMap((list) => list.rankedKeyword ?? [])
        .map((entry) => entry.query?.trim())
        .filter((query): query is string => Boolean(query))
        .filter((query, index, list) => list.indexOf(query) === index)
        .slice(0, 4) ?? [];

    return topQueries;
  } catch {
    return [];
  }
}

function buildFallbackTrendSection(keyword: string, market: Market): TrendSignal {
  const evidence: EvidenceItem[] = [
    {
      id: "trend-fallback-query",
      label: "Google Trends query",
      url: buildGoogleTrendsUrl(keyword, market),
      excerpt: "Live Google Trends collection is currently unavailable. Open the query to inspect the latest curve manually."
    }
  ];

  return {
    score: 50,
    direction: "Stable",
    relatedQueries: [],
    section: {
      score: 50,
      status: "Mixed",
      summary:
        "Google Trends did not return a live timeline for this request, so demand is currently marked as uncertain.",
      metrics: [
        {
          label: "Collector",
          value: "Fallback"
        }
      ],
      bullets: [
        "Trend direction is uncertain until a live Google Trends response succeeds.",
        "Use the linked query to validate seasonality and recent spikes manually."
      ],
      evidence
    },
    sourceHealth: {
      key: "trend",
      label: "Demand trend",
      status: "Fallback",
      detail: "Google Trends lookup did not return a usable timeline."
    }
  };
}

export async function collectTrendSignal(
  keyword: string,
  market: Market
): Promise<TrendSignal> {
  try {
    const timeWindow = {
      endTime: new Date(),
      geo: market,
      keyword,
      startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    };

    const [timelineRaw, relatedQueriesRaw] = await Promise.allSettled([
      googleTrends.interestOverTime(timeWindow),
      googleTrends.relatedQueries(timeWindow)
    ]);

    if (timelineRaw.status !== "fulfilled") {
      return buildFallbackTrendSection(keyword, market);
    }

    const parsed = JSON.parse(timelineRaw.value) as InterestOverTimeResponse;
    const timelineData =
      parsed.default?.timelineData?.filter(
        (entry) => entry.hasData?.[0] && !entry.isPartial && entry.value?.length > 0
      ) ?? [];

    if (timelineData.length < 8) {
      return buildFallbackTrendSection(keyword, market);
    }

    const values = timelineData.map((entry) => entry.value[0]);
    const recentWindow = values.slice(-6);
    const priorWindow = values.slice(-12, -6);
    const recentAverage = average(recentWindow);
    const priorAverage = average(priorWindow);
    const yearAverage = average(values);
    const latest = values[values.length - 1];
    const peak = Math.max(...values);
    const deltaRatio =
      priorAverage > 0 ? (recentAverage - priorAverage) / priorAverage : 0;

    const direction =
      deltaRatio > 0.12 ? "Rising" : deltaRatio < -0.1 ? "Cooling" : "Stable";

    const score = clamp(
      Math.round(52 + deltaRatio * 35 + (yearAverage - 42) * 0.45 + (latest - 50) * 0.12),
      22,
      92
    );

    const relatedQueries =
      relatedQueriesRaw.status === "fulfilled"
        ? parseRelatedQueries(relatedQueriesRaw.value)
        : [];

    const metrics: InsightMetric[] = [
      {
        label: "Recent 6w avg",
        value: recentAverage.toFixed(0)
      },
      {
        label: "Prior 6w avg",
        value: priorAverage.toFixed(0)
      },
      {
        label: "12m avg",
        value: yearAverage.toFixed(0)
      },
      {
        label: "Peak",
        value: peak.toFixed(0)
      }
    ];

    const evidence: EvidenceItem[] = [
      {
        id: "trend-query",
        label: "Google Trends timeline",
        url: buildGoogleTrendsUrl(keyword, market),
        excerpt: `${direction} trend. Latest complete week scored ${latest}; recent 6-week average is ${recentAverage.toFixed(0)}.`
      }
    ];

    if (relatedQueries.length > 0) {
      evidence.push({
        id: "trend-related-query",
        label: "Related searches",
        url: buildGoogleTrendsUrl(keyword, market),
        excerpt: `Live related searches include ${truncate(relatedQueries.join(", "), 88)}.`
      });
    }

    return {
      score,
      direction,
      relatedQueries,
      section: {
        score,
        status: score >= 67 ? "Positive" : score >= 45 ? "Mixed" : "Negative",
        summary: `${direction} search interest on Google Trends over the last 12 months in ${market}.`,
        metrics,
        bullets: [
          `Recent 6-week demand averaged ${recentAverage.toFixed(0)} versus ${priorAverage.toFixed(0)} in the prior 6 weeks.`,
          `The highest weekly interest in the last year reached ${peak}, with a 12-month average of ${yearAverage.toFixed(0)}.`,
          relatedQueries.length > 0
            ? `Related search demand is clustering around ${truncate(relatedQueries.slice(0, 3).join(", "), 72)}.`
            : "Google Trends returned a clean timeline, but no related-query payload was available for this request."
        ],
        evidence
      },
      sourceHealth: {
        key: "trend",
        label: "Demand trend",
        status: "Live",
        detail: `${timelineData.length} weekly points from Google Trends.`
      }
    };
  } catch {
    return buildFallbackTrendSection(keyword, market);
  }
}
