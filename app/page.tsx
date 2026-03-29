"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  DetailedAnalysis,
  Market,
  OpportunityReport,
  PriceMapSection,
  ReportSection,
  SourceHealth
} from "@/lib/types";

const DEMO_SCENARIOS = [
  {
    label: "Recovery",
    market: "US" as Market,
    keyword: "portable ice bath",
    priceBand: "80-140",
    thesis: "Rising demand with premium room if setup friction is solved."
  },
  {
    label: "Pets",
    market: "US" as Market,
    keyword: "dog calming bed",
    priceBand: "45-90",
    thesis: "Crowded language, but emotional positioning can still separate."
  },
  {
    label: "Beauty",
    market: "AU" as Market,
    keyword: "beauty fridge",
    priceBand: "90-180",
    thesis: "Lifestyle-led category where price band and design signal matter."
  }
];

const LOADING_STEPS = [
  "Scanning the demand curve",
  "Sampling live listings",
  "Distilling customer pain points",
  "Scoring the test opportunity"
];

const SCORECARD_LABELS: Record<keyof OpportunityReport["scorecard"], string> = {
  demand: "Demand",
  competition: "Competition",
  pricingRoom: "Pricing room",
  painPointSolvability: "Pain-point clarity",
  evidenceQuality: "Evidence quality"
};

function scoreTone(score: number) {
  if (score >= 70) {
    return "good";
  }

  if (score >= 45) {
    return "mixed";
  }

  return "bad";
}

function sourceTone(status: SourceHealth["status"]) {
  if (status === "Live") {
    return "good";
  }

  if (status === "Fallback") {
    return "mixed";
  }

  return "bad";
}

function formatCurrency(section: PriceMapSection, value: number) {
  if (section.sampleSize === 0 || value <= 0) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: section.currency
  }).format(value);
}

function formatPriceWindow(section: PriceMapSection) {
  if (section.sampleSize === 0) {
    return "Unavailable";
  }

  return `${formatCurrency(section, section.low)} to ${formatCurrency(section, section.high)}`;
}

function MetricPills({
  items
}: {
  items: OpportunityReport["demand"]["metrics"];
}) {
  return (
    <div className="metric-pill-row">
      {items.map((item) => (
        <div key={`${item.label}-${item.value}`} className="metric-pill">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function EvidenceList({ items }: { items: OpportunityReport["demand"]["evidence"] }) {
  return (
    <div className="evidence-list">
      {items.map((item) => (
        <a
          key={item.id}
          className="evidence-item"
          href={item.url}
          target="_blank"
          rel="noreferrer"
        >
          <span>{item.label}</span>
          <small>{item.excerpt}</small>
        </a>
      ))}
    </div>
  );
}

function SectionCard({
  title,
  section
}: {
  title: string;
  section: ReportSection;
}) {
  return (
    <section className="intel-card">
      <div className="intel-card-header">
        <div>
          <p className="eyebrow">{title}</p>
          <h3>{section.summary}</h3>
        </div>
        <div className={`score-badge ${scoreTone(section.score)}`}>{section.score}</div>
      </div>
      <MetricPills items={section.metrics} />
      <ul className="detail-list">
        {section.bullets.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <EvidenceList items={section.evidence} />
    </section>
  );
}

function PriceCard({ section }: { section: PriceMapSection }) {
  return (
    <section className="intel-card">
      <div className="intel-card-header">
        <div>
          <p className="eyebrow">Price map</p>
          <h3>{section.summary}</h3>
        </div>
      </div>
      <MetricPills items={section.metrics} />
      <div className="price-grid">
        <div>
          <span>Low</span>
          <strong>{formatCurrency(section, section.low)}</strong>
        </div>
        <div>
          <span>Median</span>
          <strong>{formatCurrency(section, section.mid)}</strong>
        </div>
        <div>
          <span>High</span>
          <strong>{formatCurrency(section, section.high)}</strong>
        </div>
      </div>
      <EvidenceList items={section.evidence} />
    </section>
  );
}

function DemoScenarioStrip({
  onSelect
}: {
  onSelect: (scenario: (typeof DEMO_SCENARIOS)[number]) => void;
}) {
  return (
    <div className="scenario-grid">
      {DEMO_SCENARIOS.map((scenario) => (
        <button
          key={`${scenario.market}-${scenario.keyword}`}
          type="button"
          className="scenario-card"
          onClick={() => onSelect(scenario)}
        >
          <span className="scenario-label">{scenario.label}</span>
          <strong>{scenario.keyword}</strong>
          <small>
            {scenario.market}
            {scenario.priceBand ? ` · ${scenario.priceBand}` : ""}
          </small>
          <p>{scenario.thesis}</p>
        </button>
      ))}
    </div>
  );
}

function LoadingBrief({
  keyword,
  market,
  priceBand,
  activeStep
}: {
  keyword: string;
  market: Market;
  priceBand: string;
  activeStep: number;
}) {
  return (
    <section className="loading-brief">
      <div className="loading-hero">
        <div>
          <p className="eyebrow">Generating brief</p>
          <h2>{keyword.trim() || "New category read"}</h2>
          <p className="summary compact">
            Pulling live demand, listing, and customer-language signals for {market}
            {priceBand.trim() ? ` with a reference price band of ${priceBand.trim()}.` : "."}
          </p>
        </div>
        <div className="loading-orb" aria-hidden="true" />
      </div>

      <div className="loading-step-grid">
        {LOADING_STEPS.map((step, index) => (
          <div
            key={step}
            className={`loading-step-card ${index <= activeStep ? "active" : ""}`}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{step}</strong>
          </div>
        ))}
      </div>

      <div className="loading-preview-grid">
        {["Demand", "Competition", "Customer pain points"].map((title) => (
          <div key={title} className="loading-preview-card">
            <span>{title}</span>
            <div className="loading-line long" />
            <div className="loading-line" />
            <div className="loading-line short" />
          </div>
        ))}
      </div>
    </section>
  );
}

function SnapshotStrip({ report }: { report: OpportunityReport }) {
  const snapshotItems = [
    {
      label: "Best angle",
      value: report.opportunityAngle.bullets[0] ?? report.opportunityAngle.summary
    },
    {
      label: "Loudest pain point",
      value: report.painPoints.bullets[0] ?? report.painPoints.summary
    },
    {
      label: "Visible price window",
      value: formatPriceWindow(report.priceMap)
    },
    {
      label: "Primary caution",
      value: report.redFlags[0] ?? report.limitations[0]
    }
  ];

  return (
    <div className="snapshot-grid">
      {snapshotItems.map((item) => (
        <section key={item.label} className="snapshot-card">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </section>
      ))}
    </div>
  );
}

function AiAnalysisPanel({
  analysis,
  loading,
  error,
  onRun
}: {
  analysis: DetailedAnalysis | null;
  loading: boolean;
  error: string;
  onRun: () => Promise<void>;
}) {
  return (
    <>
      <section className="intel-card intel-wide ai-launch-card">
        <div>
          <p className="eyebrow">AI deep analysis</p>
          <h3>Facts first. Synthesis only when you want it.</h3>
          <p className="summary compact">
            The base report stays evidence-led and rule-scored. Click once to ask
            Gemini for a more opinionated read on entry angle, test setup, and
            risks using the current report.
          </p>
        </div>

        <div className="ai-launch-actions">
          <button
            type="button"
            className="primary-button ai-primary-button"
            onClick={onRun}
            disabled={loading}
          >
            {loading
              ? "Running AI deep analysis..."
              : analysis
                ? "Refresh AI deep analysis"
                : "Run AI deep analysis"}
          </button>
          <p className="microcopy">
            This does not recollect the web. It only synthesizes the report already
            on screen.
          </p>
          {error ? <p className="error-text">{error}</p> : null}
        </div>
      </section>

      {analysis ? (
        <section className="intel-card intel-wide">
          <div className="intel-card-header">
            <div>
              <p className="eyebrow">AI readout</p>
              <h3>{analysis.headline}</h3>
            </div>
            <span className={`status-pill ${analysis.mode === "AI" ? "good" : "mixed"}`}>
              {analysis.mode === "AI" ? "Gemini" : "Fallback"}
            </span>
          </div>

          <div className="ai-analysis-grid">
            <div className="ai-analysis-block">
              <h4>Market read</h4>
              <p>{analysis.marketRead}</p>
            </div>
            <div className="ai-analysis-block">
              <h4>Entry angle</h4>
              <p>{analysis.entryAngle}</p>
            </div>
            <div className="ai-analysis-block">
              <h4>Test plan</h4>
              <ul className="detail-list">
                {analysis.testPlan.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="ai-analysis-block">
              <h4>Risk notes</h4>
              <ul className="detail-list">
                {analysis.riskNotes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}

function SourceStatusPanel({ report }: { report: OpportunityReport | null }) {
  if (!report) {
    return (
      <div className="status-list">
        {[
          ["Demand trend", "Google Trends timeline will land here."],
          ["Live listings", "eBay price and title sampling will land here."],
          ["Discussion snippets", "Public comment extraction will land here."]
        ].map(([title, detail]) => (
          <div key={title} className="status-item placeholder">
            <div>
              <strong>{title}</strong>
              <small>{detail}</small>
            </div>
            <span className="status-pill mixed">Standby</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="status-list">
      {report.sourceHealth.map((item) => (
        <div key={item.key} className="status-item">
          <div>
            <strong>{item.label}</strong>
            <small>{item.detail}</small>
          </div>
          <span className={`status-pill ${sourceTone(item.status)}`}>{item.status}</span>
        </div>
      ))}
    </div>
  );
}

function ScoreStack({ report }: { report: OpportunityReport | null }) {
  if (!report) {
    return (
      <div className="empty-stack">
        <p>Run one keyword to populate the decision engine.</p>
      </div>
    );
  }

  return (
    <div className="score-stack">
      {Object.entries(report.scorecard).map(([key, value]) => (
        <div key={key} className="score-row">
          <div className="score-row-label">
            <span>{SCORECARD_LABELS[key as keyof OpportunityReport["scorecard"]]}</span>
            <strong>{value}</strong>
          </div>
          <div className="score-track">
            <div
              className={`score-fill ${scoreTone(value)}`}
              style={{ width: `${value}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyBrief() {
  return (
    <section className="empty-brief">
      <p className="eyebrow">Opportunity brief</p>
      <h2>Run a live market read.</h2>
      <p>
        This workspace will fill with demand trend, listing price bands, public
        discussion snippets, and a verdict once you submit a category.
      </p>
      <div className="empty-grid">
        <div className="ghost-card">
          <strong>Demand</strong>
          <small>Google Trends, 12-month direction, related searches</small>
        </div>
        <div className="ghost-card">
          <strong>Market</strong>
          <small>eBay listings, title repetition, visible price spread</small>
        </div>
        <div className="ghost-card">
          <strong>Customer language</strong>
          <small>Filtered public discussion snippets and pain points</small>
        </div>
      </div>
    </section>
  );
}

function ReportView({
  report,
  aiAnalysis,
  aiLoading,
  aiError,
  copied,
  onCopySummary,
  onRunAiAnalysis
}: {
  report: OpportunityReport;
  aiAnalysis: DetailedAnalysis | null;
  aiLoading: boolean;
  aiError: string;
  copied: boolean;
  onCopySummary: () => Promise<void>;
  onRunAiAnalysis: () => Promise<void>;
}) {
  const generatedAt = useMemo(
    () =>
      new Intl.DateTimeFormat("en-AU", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(report.generatedAt)),
    [report.generatedAt]
  );

  return (
    <div className="brief-shell">
      <section className="brief-hero">
        <div className="brief-copy">
          <p className="eyebrow">Opportunity brief</p>
          <h1>{report.keyword}</h1>
          <p className="summary">{report.executiveSummary}</p>
          <div className="brief-actions">
            <button type="button" className="secondary-button" onClick={onCopySummary}>
              {copied ? "Summary copied" : "Copy summary"}
            </button>
            <span className="brief-action-note">Useful for demo decks, DMs, and notes.</span>
          </div>
        </div>

        <div className={`verdict-card ${scoreTone(report.score)}`}>
          <span>Verdict</span>
          <strong>{report.verdict}</strong>
          <small>{report.verdictReason}</small>
        </div>
      </section>

      <div className="hero-metrics">
        <div className="hero-metric">
          <span>Market</span>
          <strong>{report.market}</strong>
        </div>
        <div className="hero-metric">
          <span>Run mode</span>
          <strong>{report.analysisMode}</strong>
        </div>
        <div className="hero-metric">
          <span>Total score</span>
          <strong>{report.score}/100</strong>
        </div>
        <div className="hero-metric">
          <span>Generated</span>
          <strong>{generatedAt}</strong>
        </div>
      </div>

      <SnapshotStrip report={report} />

      <div className="intel-grid">
        <AiAnalysisPanel
          analysis={aiAnalysis}
          loading={aiLoading}
          error={aiError}
          onRun={onRunAiAnalysis}
        />
        <SectionCard title="Demand" section={report.demand} />
        <SectionCard title="Competition" section={report.competition} />
        <PriceCard section={report.priceMap} />
        <SectionCard title="Customer language" section={report.painPoints} />

        <section className="intel-card intel-wide">
          <div className="intel-card-header">
            <div>
              <p className="eyebrow">Opportunity angle</p>
              <h3>{report.opportunityAngle.summary}</h3>
            </div>
          </div>
          <ul className="detail-list">
            {report.opportunityAngle.bullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <EvidenceList items={report.opportunityAngle.evidence} />
        </section>

        <section className="intel-card intel-wide">
          <div className="intel-card-header">
            <div>
              <p className="eyebrow">Flags and limits</p>
              <h3>What should make you cautious in this run</h3>
            </div>
          </div>
          <div className="flag-grid">
            <div>
              <h4>Red flags</h4>
              <ul className="detail-list">
                {report.redFlags.length > 0 ? (
                  report.redFlags.map((item) => <li key={item}>{item}</li>)
                ) : (
                  <li>No hard red flags surfaced in this run.</li>
                )}
              </ul>
            </div>
            <div>
              <h4>Current limits</h4>
              <ul className="detail-list">
                {report.limitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [keyword, setKeyword] = useState("portable ice bath");
  const [market, setMarket] = useState<Market>("US");
  const [priceBand, setPriceBand] = useState("");
  const [report, setReport] = useState<OpportunityReport | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<DetailedAnalysis | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  useEffect(() => {
    if (!loading) {
      setLoadingStep(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setLoadingStep((current) => (current + 1) % LOADING_STEPS.length);
    }, 1100);

    return () => window.clearInterval(intervalId);
  }, [loading]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setAiError("");
    setCopied(false);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          keyword,
          market,
          priceBand
        })
      });

      const payload = (await response.json()) as OpportunityReport | { error: string };

      if ("error" in payload) {
        throw new Error(payload.error || "Unable to generate the report.");
      }

      if (!response.ok) {
        throw new Error("Unable to generate the report.");
      }

      setReport(payload);
      setAiAnalysis(null);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to generate the report."
      );
      setReport(null);
      setAiAnalysis(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleRunAiAnalysis() {
    if (!report) {
      return;
    }

    setAiLoading(true);
    setAiError("");

    try {
      const response = await fetch("/api/analyze/deep", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          report
        })
      });

      const payload = (await response.json()) as DetailedAnalysis | { error: string };

      if ("error" in payload) {
        throw new Error(payload.error || "Unable to generate AI analysis.");
      }

      if (!response.ok) {
        throw new Error("Unable to generate AI analysis.");
      }

      setAiAnalysis(payload);
    } catch (caughtError) {
      setAiError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to generate AI analysis."
      );
    } finally {
      setAiLoading(false);
    }
  }

  async function handleCopySummary() {
    if (!report) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        [
          `${report.keyword} (${report.market})`,
          `Verdict: ${report.verdict}`,
          `Score: ${report.score}/100`,
          report.executiveSummary,
          `Best angle: ${report.opportunityAngle.bullets[0] ?? report.opportunityAngle.summary}`
        ].join("\n")
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  function applyScenario(scenario: (typeof DEMO_SCENARIOS)[number]) {
    setKeyword(scenario.keyword);
    setMarket(scenario.market);
    setPriceBand(scenario.priceBand);
  }

  return (
    <main className="workbench-page">
      <div className="app-frame">
        <header className="topbar">
          <div>
            <p className="eyebrow">Market Opportunity Checker</p>
            <h1 className="topbar-title">Fact-first category validation workbench</h1>
          </div>
          <div className="topbar-chips">
            <span>Google Trends</span>
            <span>eBay listings</span>
            <span>Public discussion</span>
            <span>AI on demand</span>
          </div>
        </header>

        <div className="workspace-grid">
          <aside className="control-column">
            <section className="panel intake-panel">
              <div className="panel-heading">
                <p className="eyebrow">Control deck</p>
                <h2>Run a new opportunity brief</h2>
              </div>

              <form onSubmit={handleSubmit} className="intake-form">
                <label className="field">
                  <span>Keyword or category</span>
                  <textarea
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    placeholder="portable ice bath"
                    rows={3}
                  />
                </label>

                <div className="field-row">
                  <label className="field">
                    <span>Market</span>
                    <select
                      value={market}
                      onChange={(event) => setMarket(event.target.value as Market)}
                    >
                      <option value="US">US</option>
                      <option value="AU">AU</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>Optional price band</span>
                    <input
                      value={priceBand}
                      onChange={(event) => setPriceBand(event.target.value)}
                      placeholder="80-120"
                    />
                  </label>
                </div>

                <div className="panel-subhead">
                  <span>Demo scenarios</span>
                  <small>One click to preload a good walkthrough case.</small>
                </div>
                <DemoScenarioStrip onSelect={applyScenario} />

                <button className="primary-button" type="submit" disabled={loading}>
                  {loading ? "Running live collectors..." : "Generate live brief"}
                </button>

                <p className="microcopy">
                  The first layer is fact-first and rule-scored. AI deep analysis is
                  optional and runs only when you click it.
                </p>

                {error ? <p className="error-text">{error}</p> : null}
              </form>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <p className="eyebrow">Collector status</p>
                <h2>Source health</h2>
              </div>
              <SourceStatusPanel report={report} />
            </section>

            <section className="panel">
              <div className="panel-heading">
                <p className="eyebrow">Decision engine</p>
                <h2>Score stack</h2>
              </div>
              <ScoreStack report={report} />
            </section>

            <section className="panel engine-panel">
              <div className="engine-grid">
                <div className="engine-chip">
                  <span>collectors</span>
                  <strong>live web</strong>
                </div>
                <div className="engine-chip">
                  <span>base layer</span>
                  <strong>fact-first</strong>
                </div>
                <div className="engine-chip">
                  <span>ai layer</span>
                  <strong>on demand</strong>
                </div>
              </div>
            </section>
          </aside>

          <section className="insight-column">
            {loading ? (
              <LoadingBrief
                keyword={keyword}
                market={market}
                priceBand={priceBand}
                activeStep={loadingStep}
              />
            ) : report ? (
              <ReportView
                report={report}
                aiAnalysis={aiAnalysis}
                aiLoading={aiLoading}
                aiError={aiError}
                copied={copied}
                onCopySummary={handleCopySummary}
                onRunAiAnalysis={handleRunAiAnalysis}
              />
            ) : (
              <EmptyBrief />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
