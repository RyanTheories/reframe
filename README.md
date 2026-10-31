# Reframe 🧠

A mobile-first CBT **thought-record companion** — your private space to catch a difficult moment, challenge the thought behind it, and reframe it.

**100% local.** No backend, no accounts, no network calls, no AI. Everything lives in your browser's `localStorage` under a single key, and there's a *Delete all data* button in Settings.

## Run it

```bash
./run.sh          # or: python3 -m http.server 5173
```

Then open **http://localhost:5173** on your phone (or resize your browser to phone width — the design is mobile-first).

No dependencies. No build step. Plain HTML + CSS + JS.

## What's inside

**Quick capture** — log an emotion + intensity in under 15 seconds. Saved as a draft; History shows a *Complete* button that opens the full guided flow with your draft pre-filled.

**Guided thought record (4 steps)** — the classic CBT schema:
1. **Situation & emotion** — date, what happened, emotion (with suggestions), intensity slider
2. **Thoughts** — automatic thoughts, the *hot thought* (one sentence), "feels true" slider
3. **Challenge** — all 22 critical questions; the app pre-selects the 3–5 most relevant based on keywords in your hot thought and the emotion (e.g. *always/never* → all-or-nothing + overgeneralization; *should/perfect* → perfectionism; *they think* → mind reading; fear words → catastrophizing)
4. **New thought & re-rate** — a more balanced thought, re-rate belief and emotion, optional action plan. Live feedback shows the belief shift, and if it's under 10 points you get a gentle nudge toward one more unanswered question.

**History** — reverse-chronological, free-text search across situation/thoughts/emotion, full detail expansion, per-record delete/edit, **Export PDF** (classic layout, print dialog, fits one page) and **Copy as text**.

**Insights** — stat cards (records, average emotion-intensity drop, average belief drop, day streak), before/after bar chart, most-challenged thinking styles, top recurring hot thoughts (2+ occurrences, case-insensitive), and a 28-day activity strip.

**Voice input** — 🎙️ buttons next to situation, automatic thoughts and hot thought via the Web Speech API (hidden if unavailable).

**Privacy blur** — the toggle in the header blurs all personal text until you hover. Because this is therapy data, and it stays in this browser.

## Data shape

Single `localStorage` key: `reframe.data.v1`

```json
{ "privacy": false, "records": [ { "id": "...", "date": "YYYY-MM-DD", "draft": false, ... } ] }
```

## Sources

Built from the Psyvel *thought record* schema and *critical questions* (English) forms.
