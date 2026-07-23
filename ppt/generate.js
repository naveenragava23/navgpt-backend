// ppt/generate.js
// ─────────────────────────────────────────────────────────────────────────────
// Scaffold / demo generation script.
//
// Usage:
//   node generate.js [outputFileName]
//
// Output: ../output/<outputFileName>.pptx  (default: lecture.pptx)
//
// To build a real lecture deck, edit this file:
//   1. Change the LECTURE_* constants at the top.
//   2. Call the slide builder functions in sequence.
//   3. Run: node generate.js my-lecture-title
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

const path   = require("path");
const PptxGenJS = require("pptxgenjs");
const {
  addTitleSlide,
  addOverviewSlide,
  addSessionPlanSlide,
  addLearningOutcomesSlide,
  addIntroSlide,
  addSinglePanelBulletSlide,
  addSinglePanelHighlightSlide,
  addTwoPanelSlide,
  addTableSlide,
  addStepsSlide,
  addListCardSlide,
  addPracticeSlide,
  addSummarySlide,
  addThankYouSlide,
} = require("./slideHelpers");

// ── Output ──────────────────────────────────────────────────────────────────
const outName = process.argv[2] || "lecture";
const outDir  = path.join(__dirname, "..", "output");
const outPath = path.join(outDir, `${outName}.pptx`);

// ── Lecture metadata ─────────────────────────────────────────────────────────
// Edit these constants to match the lecture you are building.
const HOUR_LABEL = "Hour 1";                          // e.g. "Hour 3", "Unit 2 · Lecture 4"
const TOPIC      = "Your Lecture Topic Here";         // Main title shown on cover slide
const SUBTITLE   = "A one-line subtitle or tagline";  // Shown below the title on the cover

// ── Build the deck ───────────────────────────────────────────────────────────
(async () => {
  // Ensure the output folder exists
  const fs = require("fs");
  fs.mkdirSync(outDir, { recursive: true });

  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE"; // 16:9 widescreen (13.333" × 7.5")

  // ── 1. Cover / Title slide ──────────────────────────────────────────────
  addTitleSlide(pres, HOUR_LABEL, TOPIC, SUBTITLE);

  // ── 2. Overview (agenda + outcomes sidebar) ─────────────────────────────
  //    items: [[section title, one-line description], ...]
  //    outcomes: short learning outcome strings
  addOverviewSlide(
    pres,
    [
      ["Introduction",         "Context and motivation for this topic"],
      ["Core Concepts",        "Key definitions and principles explained"],
      ["Worked Examples",      "Step-by-step examples with full solutions"],
      ["Practice Problems",    "Hands-on problems to reinforce understanding"],
    ],
    [
      "Define and explain the core concepts",
      "Apply the principles to solve structured problems",
      "Analyse real-world examples critically",
      "Connect this topic to broader course themes",
    ]
  );

  // ── 3. Learning Outcomes (full-width card) ──────────────────────────────
  addLearningOutcomesSlide(pres, [
    "Clearly define and explain the key terms introduced in this session",
    "Solve standard problems by applying the correct procedure",
    "Identify common pitfalls and how to avoid them",
    "Relate this topic to previously covered material",
  ]);

  // ── 4. Introduction cards (paragraph + 4 info cards) ───────────────────
  addIntroSlide(
    pres,
    "Introduction",         // kicker label (shown in small orange caps)
    "Background & Motivation",
    "Write a 2-3 sentence paragraph here that sets the scene, explains why this topic matters, and prepares students for the deeper dive to follow.",
    [
      { t: "Card One",   d: "A short explanatory paragraph or bullet list for this card." },
      { t: "Card Two",   d: "A short explanatory paragraph or bullet list for this card." },
      { t: "Card Three", d: "A short explanatory paragraph or bullet list for this card." },
      { t: "Card Four",  d: "A short explanatory paragraph or bullet list for this card." },
    ]
  );

  // ── 5. Bullet slide (light card) ────────────────────────────────────────
  addSinglePanelBulletSlide(
    pres,
    "Core Concepts",
    "Key Definitions",
    "Fundamental Terms You Need to Know",
    [
      "First key term: its precise definition and why it is important.",
      "Second key term: its precise definition and how it differs from the first.",
      "Third key term: a concrete example to make the definition tangible.",
      "Fourth key term: connection to the broader topic or real-world use.",
      "Fifth key term: any edge cases or common misconceptions to watch out for.",
    ]
  );

  // ── 6. Highlight slide (dark navy card — code / formula / key fact) ─────
  addSinglePanelHighlightSlide(
    pres,
    "Core Concepts",
    "The Central Formula or Rule",
    "FORMAL STATEMENT",
    // Use \n for line breaks inside the monospaced body
    "Line 1: write the formula, rule, or pseudocode here.\n" +
    "Line 2: explain the first variable or term.\n" +
    "Line 3: explain the second variable or term.\n" +
    "Line 4: state the constraint or condition when it applies.\n" +
    "Line 5: give a one-line worked example."
  );

  // ── 7. Two-panel slide (theory left, code/example right) ────────────────
  addTwoPanelSlide(
    pres,
    "Core Concepts",
    "Theory Meets Practice",
    "Why It Works",
    [
      "First reason or principle that underpins this concept.",
      "Second reason — connect it to hardware or software behaviour.",
      "Third reason — any trade-offs or design decisions involved.",
      "Fourth reason — how this differs from alternatives.",
    ],
    "EXAMPLE",
    "// Replace this block with a code snippet,\n" +
    "// worked calculation, or detailed example.\n\n" +
    "Input  : ...\n" +
    "Step 1 : ...\n" +
    "Step 2 : ...\n" +
    "Output : ..."
  );

  // ── 8. Table slide ───────────────────────────────────────────────────────
  addTableSlide(
    pres,
    "Comparison",
    "Feature Comparison Table",
    "Use this table to compare the key properties of the approaches discussed above.",
    ["Feature", "Approach A", "Approach B", "Notes"],
    [
      ["Feature 1", "Value A1", "Value B1", "Brief note"],
      ["Feature 2", "Value A2", "Value B2", "Brief note"],
      ["Feature 3", "Value A3", "Value B3", "Brief note"],
      ["Feature 4", "Value A4", "Value B4", "Brief note"],
    ]
  );

  // ── 9. Steps slide (horizontal alternating cards) ────────────────────────
  addStepsSlide(
    pres,
    "Procedure",
    "Step-by-Step Process",
    "Follow these steps to solve problems of this type:",
    [
      { t: "Step One",   d: "Describe what to do in this first step and why it is needed." },
      { t: "Step Two",   d: "Describe the second action, including any decision points." },
      { t: "Step Three", d: "Describe the third action with a concrete mini-example." },
      { t: "Step Four",  d: "Describe the final action and how to verify the result." },
    ]
  );

  // ── 10. List card slide (properties / rules) ─────────────────────────────
  addListCardSlide(
    pres,
    "Properties",
    "Important Rules & Constraints",
    "Keep the following rules in mind when applying this technique:",
    [
      "Rule 1 — State the rule clearly and concisely with its condition.",
      "Rule 2 — Another rule, with a note on when it applies or may be relaxed.",
      "Rule 3 — A constraint that is commonly overlooked in practice.",
      "Rule 4 — An edge case or exception that students often miss.",
      "Rule 5 — A heuristic or best-practice that simplifies the work.",
    ]
  );

  // ── 11. Practice problems ─────────────────────────────────────────────────
  addPracticeSlide(
    pres,
    "Work through the following problems independently. Hints are available on request.",
    [
      "Q1.  State the problem clearly in one or two sentences.",
      "Q2.  Pose a follow-up problem that builds on Q1.",
      "Q3.  A slightly harder variant that tests edge-case understanding.",
      "Q4.  An open-ended design or analysis question.",
    ]
  );

  // ── 12. Summary grid ─────────────────────────────────────────────────────
  addSummarySlide(pres, [
    ["Key Takeaway 1", "One concise sentence capturing the core message of this takeaway."],
    ["Key Takeaway 2", "One concise sentence capturing the core message of this takeaway."],
    ["Key Takeaway 3", "One concise sentence capturing the core message of this takeaway."],
    ["Key Takeaway 4", "One concise sentence capturing the core message of this takeaway."],
  ]);

  // ── 13. Thank-you slide ───────────────────────────────────────────────────
  addThankYouSlide(pres, TOPIC);

  // ── Save ──────────────────────────────────────────────────────────────────
  await pres.writeFile({ fileName: outPath });
  console.log(`✅  Saved: ${outPath}`);
})();
