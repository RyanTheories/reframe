const QUESTIONS = [
  { n: 1,  text: "Is the thought actually true? Do I have good evidence to support it?", style: "evidence check" },
  { n: 2,  text: "Are there other possible explanations that I have not yet considered?", style: "alternative explanations" },
  { n: 3,  text: "Am I only looking at one side of the situation? What am I leaving out?", style: "alternative explanations" },
  { n: 4,  text: "Am I engaging in emotional reasoning — is the direction of my thoughts strongly influenced by my mood? How would I reason if I were in a positive mood?", style: "emotional reasoning" },
  { n: 5,  text: "Does this thought help me achieve what I would like to achieve? What do I want to achieve?", style: "helpfulness check" },
  { n: 6,  text: "Does this thought help me avoid unnecessary unpleasant feelings?", style: "helpfulness check" },
  { n: 7,  text: "How would someone else judge the situation if they were in my position?", style: "alternative explanations" },
  { n: 8,  text: "How would I judge the situation if I were in the other person's position?", style: "perspective taking" },
  { n: 9,  text: "Are my (negative) judgments based on how I actually behaved, or on how I felt about it?", style: "evidence check" },
  { n: 10, text: "Am I imposing excessively high or impossible demands on myself? Am I trying to achieve something that is impossible?", style: "perfectionism" },
  { n: 11, text: "Am I making assumptions about what other people are thinking?", style: "mind reading" },
  { n: 12, text: "Am I neglecting the positive aspects? What are the positive aspects?", style: "neglecting the positive" },
  { n: 13, text: "Am I focusing too much on certain details and, in doing so, am I overlooking other important things?", style: "selective focus" },
  { n: 14, text: "Am I thinking in all-or-nothing (black-and-white) terms?", style: "all-or-nothing" },
  { n: 15, text: "Am I overestimating my level of responsibility for a negative outcome, even though I have only a limited influence?", style: "over-responsibility" },
  { n: 16, text: "Suppose that what I fear actually happens. What would that mean for me? What would be so terrible about it? Is it something that can be resolved?", style: "catastrophizing" },
  { n: 17, text: "How will things look in X months/years?", style: "time perspective" },
  { n: 18, text: "Am I overestimating the likelihood of a negative event or outcome?", style: "catastrophizing" },
  { n: 19, text: "Am I underestimating my ability to tolerate, cope with, or solve the problem?", style: "underestimating coping" },
  { n: 20, text: "Am I treating one event as though it will keep on happening?", style: "overgeneralization" },
  { n: 21, text: "Do these thoughts help me achieve a goal, or are they merely helping me prevent something?", style: "helpfulness check" },
  { n: 22, text: "Have I made use of the opportunities available to me to influence the course of events myself?", style: "underestimating coping" },
];

// Keyword-based relevance scoring for pre-selecting questions.
const RULES = [
  { q: 14, re: /\b(always|never|everyone|no one|nobody|everything|nothing|all|none|completely|totally|perfect\w*|failure|useless|worthless)\b/i },
  { q: 20, re: /\b(always|never|every time|again and again|constantly|forever)\b/i },
  { q: 10, re: /\b(should|must|have to|need to|perfect\w*|impossible|unrealistic|demand\w*)\b/i },
  { q: 11, re: /\b(they|he|she|everyone|people)\s+(think|thinks|thought|believe|believes|will see|will think|notice|notices|noticed|judge|judges|judging|laugh|laughs|laughing)\b|\b(assume|assumption|expecting me|judging me|laughing at me|staring at me|can tell)\b/i },
  { q: 16, re: /\b(fear|afraid|scared|terrified|panic|dread|worst|disaster|die|collapse|what if)\b/i },
  { q: 18, re: /\b(fear|afraid|scared|worried|going to happen|will happen|probably|surely|doomed)\b/i },
  { q: 19, re: /\b(can'?t cope|can'?t handle|overwhelm\w*|break down|too much for me|not strong enough|too hard)\b/i },
  { q: 15, re: /\b(my fault|blame|responsible|caused (this|it)|because of me|i ruined|i failed (them|her|him|everyone))\b/i },
  { q: 1,  re: /\b(know|certain|sure|obvious|fact|proof|evidence)\b/i },
  { q: 12, re: /\b(only bad|nothing good|never works out|no good|all bad)\b/i },
];

const FEAR_EMOTIONS = ["anxious", "nervous", "worried", "afraid", "scared"];

// Return the 3–5 most relevant question numbers for a hot thought + emotion.
function suggestQuestions(hotThought, emotion) {
  const t = (hotThought || "").toLowerCase();
  const scores = new Map();
  for (const r of RULES) {
    if (r.re.test(hotThought || "")) scores.set(r.q, (scores.get(r.q) || 0) + 2);
  }
  if (FEAR_EMOTIONS.includes((emotion || "").trim().toLowerCase())) {
    for (const n of [16, 18, 19]) scores.set(n, (scores.get(n) || 0) + 1);
  }
  if (/\bi (am|i'?m|feel|felt)\b/.test(t) && /\b(bad|worthless|failure|stupid|ugly|useless)\b/.test(t)) {
    scores.set(4, (scores.get(4) || 0) + 1);
  }
  const picks = [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
  const fallback = [1, 2, 5];
  for (const f of fallback) if (picks.length < 3 && !picks.includes(f)) picks.push(f);
  return picks.slice(0, 5).sort((a, b) => a - b);
}
