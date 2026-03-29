# market-opportunity-checker

A lightweight MVP for deciding whether a product category is worth a small e-commerce test.

## Current MVP

The app now supports:

- workspace-style split layout
- `US` and `AU` market selection
- one-click opportunity brief generation
- live demand collection from Google Trends
- live price and listing sampling from eBay
- live public discussion sampling for pain points
- structured output for demand, competition, price map, pain points, opportunity angle, and verdict
- a fact-first base report with optional Gemini deep analysis on demand

## Architecture

The current flow is:

1. `app/page.tsx` collects `keyword + market + optional price band`
2. `app/api/analyze/route.ts` validates the request
3. `lib/collectors/trends.ts` pulls live Google Trends demand data
4. `lib/collectors/market.ts` samples live eBay listings for pricing and competition
5. `lib/collectors/reviews.ts` filters live public discussion snippets for pain points
6. `lib/analyze.ts` turns those signals into a structured report and verdict
7. `lib/llm.ts` keeps the base summary deterministic and only calls Gemini for on-demand deep analysis
8. `app/api/analyze/deep/route.ts` accepts the current report and returns an optional AI synthesis layer
9. the workbench UI renders the brief in a left-control / right-intelligence layout

This is still an MVP, but it no longer relies on static mock collectors. The report now uses live web signals with graceful fallback behavior when a source fails.

## Quick start

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Environment

Copy `.env.example` to `.env.local` if you want the optional Gemini deep-analysis button to use a real model:

```bash
GEMINI_API_KEY=
GOOGLE_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
```

Use either `GEMINI_API_KEY` or `GOOGLE_API_KEY`. If neither is set, the base report still works and the deep-analysis route falls back to deterministic structured copy.

## Next step after this MVP

- add richer competitor sources beyond eBay
- improve community-source filtering and pain-point clustering
- decide whether to persist reports or keep the tool single-shot
