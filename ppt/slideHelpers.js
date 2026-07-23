// ppt/slideHelpers.js
// ─────────────────────────────────────────────────────────────────────────────
// Reusable slide builder helpers for the COA lecture deck.
// All coordinates are in inches on a 13.333 × 7.5 slide (16:9 widescreen).
// ─────────────────────────────────────────────────────────────────────────────

const NAVY       = "1B2A4A";
const NAVY_DARK  = "10192E";
const ORANGE     = "F2A22B";
const ORANGE_DARK= "D6821A";
const WHITE      = "FFFFFF";
const GRAY_TEXT  = "4A5568";
const CARD_BG    = "EEF1F6";

const FOOTER_TEXT = "Assistant Professor - Naveen Kumar M";
const COURSE      = "Computer Organization and Architecture";
const SW = 13.333, SH = 7.5;

// ── Banner dimensions ── (aspect ratio of banner.jpg: 873 × 286 px)
const BANNER_W = 7.4;
const BANNER_H = BANNER_W * (286 / 873);
// Place banner.jpg in the same ppt/ folder, or update this path.
const BANNER_PATH = `${__dirname}/banner.jpg`;

// ─── Primitives ────────────────────────────────────────────────────────────

function newSlide(pres) {
  const slide = pres.addSlide();
  slide.background = { color: WHITE };
  return slide;
}

function addFooter(slide, skipLine = false) {
  if (!skipLine) {
    slide.addShape("line", {
      x: 0.5, y: SH - 0.45, w: SW - 1, h: 0,
      line: { color: "D9DEE6", width: 0.75 },
    });
  }
  slide.addText(FOOTER_TEXT, {
    x: 0.5, y: SH - 0.42, w: 7, h: 0.32,
    fontFace: "Calibri", fontSize: 10.5, color: GRAY_TEXT,
    italic: true, align: "left", margin: 0,
  });
  slide.addText(COURSE, {
    x: SW - 5.5, y: SH - 0.42, w: 5.0, h: 0.32,
    fontFace: "Calibri", fontSize: 10.5, color: GRAY_TEXT,
    italic: true, align: "right", margin: 0,
  });
}

function sectionTitle(slide, kicker, title) {
  slide.addText(kicker.toUpperCase(), {
    x: 0.6, y: 0.42, w: 11.5, h: 0.35,
    fontFace: "Calibri", fontSize: 14, color: ORANGE_DARK,
    bold: true, charSpacing: 2, margin: 0,
  });
  slide.addText(title, {
    x: 0.6, y: 0.72, w: 12.1, h: 0.85,
    fontFace: "Calibri", fontSize: 27, color: NAVY_DARK,
    bold: true, margin: 0,
  });
}

// ─── Slide Types ────────────────────────────────────────────────────────────

/**
 * Title / cover slide.
 * @param {string} hourLabel  e.g. "Hour 1" or "Unit 2 · Lecture 3"
 * @param {string} title      Main topic title
 * @param {string} subtitle   One-line subtitle / description
 */
function addTitleSlide(pres, hourLabel, title, subtitle) {
  const slide = newSlide(pres);
  slide.addImage({
    path: BANNER_PATH,
    x: (SW - BANNER_W) / 2, y: 0.3,
    w: BANNER_W, h: BANNER_H,
  });
  slide.addShape("rect", {
    x: 0, y: 0.3 + BANNER_H + 0.28, w: SW, h: 0.02,
    fill: { color: "E3E7EE" },
  });
  slide.addText("COURSE: COMPUTER ORGANIZATION AND ARCHITECTURE", {
    x: 0, y: 0.3 + BANNER_H + 0.5, w: SW, h: 0.4,
    fontFace: "Calibri", fontSize: 14, color: ORANGE_DARK,
    bold: true, align: "center", charSpacing: 1.5, margin: 0,
  });
  slide.addText(title, {
    x: 0.5, y: 0.3 + BANNER_H + 0.92, w: SW - 1, h: 1.5,
    fontFace: "Calibri", fontSize: 34, color: NAVY_DARK,
    bold: true, align: "center", margin: 0, valign: "top",
  });
  slide.addText(subtitle, {
    x: 0.5, y: 0.3 + BANNER_H + 2.35, w: SW - 1, h: 0.5,
    fontFace: "Calibri", fontSize: 17, color: GRAY_TEXT,
    align: "center", margin: 0,
  });
  slide.addShape("roundRect", {
    x: SW / 2 - 1.1, y: 0.3 + BANNER_H + 2.95, w: 2.2, h: 0.42,
    rectRadius: 0.21, fill: { color: NAVY }, line: { type: "none" },
  });
  slide.addText(hourLabel.toUpperCase(), {
    x: SW / 2 - 1.1, y: 0.3 + BANNER_H + 2.95, w: 2.2, h: 0.42,
    fontFace: "Calibri", fontSize: 12, color: WHITE,
    bold: true, align: "center", valign: "middle", charSpacing: 1, margin: 0,
  });
  addFooter(slide, true);
  slide.addShape("line", {
    x: 0.5, y: SH - 0.45, w: SW - 1, h: 0,
    line: { color: "D9DEE6", width: 0.75 },
  });
}

/**
 * Overview / agenda slide — left numbered list + right outcomes card.
 * @param {Array<[string,string]>} items   [[title, description], ...]
 * @param {string[]} outcomes              Learning outcome bullet strings
 */
function addOverviewSlide(pres, items, outcomes) {
  const slide = newSlide(pres);
  sectionTitle(slide, "Session Plan", "What We'll Cover Today");
  const startY = 1.7, rowH = 0.98;
  items.forEach((it, i) => {
    const y = startY + i * rowH;
    slide.addShape("roundRect", { x: 0.7, y, w: 0.65, h: 0.65, rectRadius: 0.1, fill: { color: NAVY }, line: { type: "none" } });
    slide.addText(String(i + 1).padStart(2, "0"), { x: 0.7, y, w: 0.65, h: 0.65, fontFace: "Calibri", fontSize: 17, color: WHITE, bold: true, align: "center", valign: "middle", margin: 0 });
    slide.addText(it[0], { x: 1.6, y: y - 0.02, w: 6.2, h: 0.4, fontFace: "Calibri", fontSize: 15, color: NAVY_DARK, bold: true, margin: 0 });
    slide.addText(it[1], { x: 1.6, y: y + 0.33, w: 6.2, h: 0.42, fontFace: "Calibri", fontSize: 12, color: GRAY_TEXT, margin: 0 });
  });
  slide.addShape("roundRect", { x: 8.4, y: 1.7, w: 4.3, h: 4.75, rectRadius: 0.1, fill: { color: CARD_BG }, line: { type: "none" } });
  slide.addText("BY THE END, YOU WILL BE ABLE TO", {
    x: 8.75, y: 1.95, w: 3.6, h: 0.6,
    fontFace: "Calibri", fontSize: 12.5, color: ORANGE_DARK, bold: true, charSpacing: 1, margin: 0,
  });
  slide.addText(outcomes.map((o, i) => ({
    text: o,
    options: { bullet: { code: "25CF", indent: 14 }, breakLine: i !== outcomes.length - 1, paraSpaceAfter: 14 },
  })), { x: 8.75, y: 2.55, w: 3.65, h: 3.8, fontFace: "Calibri", fontSize: 13, color: NAVY_DARK, valign: "top", margin: 0 });
  addFooter(slide);
}

/**
 * Intro slide — paragraph text + row of info cards.
 * @param {Object[]} cards  [{ t: "Card Title", d: "Card description text" }, ...]
 */
function addIntroSlide(pres, kicker, title, introText, cards) {
  const slide = newSlide(pres);
  sectionTitle(slide, kicker, title);
  slide.addText(introText, { x: 0.6, y: 1.65, w: 12.1, h: 0.9, fontFace: "Calibri", fontSize: 14.5, color: GRAY_TEXT, margin: 0 });
  const cx = 0.6, cw = 2.95, gap = 0.25, cy = 2.85, ch = 3.5;
  cards.forEach((card, i) => {
    const x = cx + i * (cw + gap);
    slide.addShape("roundRect", { x, y: cy, w: cw, h: ch, rectRadius: 0.08, fill: { color: CARD_BG }, line: { type: "none" } });
    slide.addShape("roundRect", { x, y: cy, w: cw, h: 0.55, rectRadius: 0.08, fill: { color: NAVY }, line: { type: "none" } });
    slide.addShape("rect", { x, y: cy + 0.3, w: cw, h: 0.25, fill: { color: NAVY }, line: { type: "none" } });
    slide.addText(card.t, { x, y: cy, w: cw, h: 0.55, fontFace: "Calibri", fontSize: 14, color: WHITE, bold: true, align: "center", valign: "middle", margin: 0 });
    slide.addText(card.d, { x: x + 0.2, y: cy + 0.75, w: cw - 0.4, h: ch - 0.95, fontFace: "Calibri", fontSize: 12, color: NAVY_DARK, align: "left", valign: "top", margin: 0 });
  });
  addFooter(slide);
}

/**
 * Session plan / agenda-only slide (no outcomes sidebar).
 * @param {Array<[string,string]>} items  [[title, description], ...]
 */
function addSessionPlanSlide(pres, items) {
  const slide = newSlide(pres);
  sectionTitle(slide, "Session Plan", "What We'll Cover Today");
  const startY = 1.85, rowH = 0.92;
  items.forEach((it, i) => {
    const y = startY + i * rowH;
    slide.addShape("roundRect", { x: 1.4, y, w: 0.7, h: 0.7, rectRadius: 0.1, fill: { color: NAVY }, line: { type: "none" } });
    slide.addText(String(i + 1).padStart(2, "0"), { x: 1.4, y, w: 0.7, h: 0.7, fontFace: "Calibri", fontSize: 18, color: WHITE, bold: true, align: "center", valign: "middle", margin: 0 });
    slide.addText(it[0], { x: 2.35, y: y - 0.02, w: 9.4, h: 0.4, fontFace: "Calibri", fontSize: 17, color: NAVY_DARK, bold: true, margin: 0 });
    slide.addText(it[1], { x: 2.35, y: y + 0.36, w: 9.4, h: 0.4, fontFace: "Calibri", fontSize: 13, color: GRAY_TEXT, margin: 0 });
  });
  addFooter(slide);
}

/**
 * Learning outcomes — full-width card with bullet list.
 * @param {string[]} outcomes
 */
function addLearningOutcomesSlide(pres, outcomes) {
  const slide = newSlide(pres);
  sectionTitle(slide, "Learning Outcomes", "By the End of This Hour, You Will Be Able To");
  slide.addShape("roundRect", { x: 1.2, y: 1.85, w: 10.9, h: 4.6, rectRadius: 0.1, fill: { color: CARD_BG }, line: { type: "none" } });
  slide.addText(outcomes.map((o, i) => ({
    text: o,
    options: { bullet: { code: "25CF", indent: 18 }, breakLine: i !== outcomes.length - 1, paraSpaceAfter: 24 },
  })), { x: 1.6, y: 2.2, w: 10.1, h: 3.9, fontFace: "Calibri", fontSize: 17, color: NAVY_DARK, valign: "top", margin: 0 });
  addFooter(slide);
}

/**
 * Single-panel light card with a heading + bullet list.
 */
function addSinglePanelBulletSlide(pres, kicker, title, heading, bullets) {
  const slide = newSlide(pres);
  sectionTitle(slide, kicker, title);
  slide.addShape("roundRect", { x: 1.0, y: 1.75, w: 11.3, h: 4.75, rectRadius: 0.1, fill: { color: CARD_BG }, line: { type: "none" } });
  slide.addText(heading, { x: 1.4, y: 2.0, w: 10.5, h: 0.5, fontFace: "Calibri", fontSize: 18, bold: true, color: NAVY_DARK, margin: 0 });
  slide.addText(bullets.map((o, i) => ({
    text: o,
    options: { bullet: { code: "25CF", indent: 18 }, breakLine: i !== bullets.length - 1, paraSpaceAfter: 18 },
  })), { x: 1.4, y: 2.65, w: 10.5, h: 3.7, fontFace: "Calibri", fontSize: 15, color: GRAY_TEXT, valign: "top", margin: 0 });
  addFooter(slide);
}

/**
 * Single-panel dark (navy) highlight card — great for code, formulas, key facts.
 * @param {string} body  Monospaced body text
 */
function addSinglePanelHighlightSlide(pres, kicker, title, heading, body) {
  const slide = newSlide(pres);
  sectionTitle(slide, kicker, title);
  slide.addShape("roundRect", { x: 1.0, y: 1.75, w: 11.3, h: 4.75, rectRadius: 0.1, fill: { color: NAVY }, line: { type: "none" } });
  slide.addText(heading, { x: 1.4, y: 2.0, w: 10.5, h: 0.45, fontFace: "Calibri", fontSize: 15, color: ORANGE, bold: true, charSpacing: 1, margin: 0 });
  slide.addText(body, { x: 1.4, y: 2.55, w: 10.5, h: 3.8, fontFace: "Consolas", fontSize: 15, color: WHITE, valign: "top", lineSpacingMultiple: 1.35, margin: 0 });
  addFooter(slide);
}

/**
 * Two-panel slide — light card on the left (bullets), dark card on the right (code/text).
 */
function addTwoPanelSlide(pres, kicker, title, leftHeading, leftBullets, rightHeading, rightBody) {
  const slide = newSlide(pres);
  sectionTitle(slide, kicker, title);
  slide.addShape("roundRect", { x: 0.6, y: 1.7, w: 5.9, h: 4.85, rectRadius: 0.1, fill: { color: CARD_BG }, line: { type: "none" } });
  slide.addText(leftHeading, { x: 0.95, y: 1.95, w: 5.3, h: 0.45, fontFace: "Calibri", fontSize: 16, bold: true, color: NAVY_DARK, margin: 0 });
  slide.addText(leftBullets.map((o, i) => ({
    text: o,
    options: { bullet: { code: "25CF", indent: 14 }, breakLine: i !== leftBullets.length - 1, paraSpaceAfter: 12 },
  })), { x: 0.95, y: 2.5, w: 5.3, h: 3.9, fontFace: "Calibri", fontSize: 13, color: GRAY_TEXT, valign: "top", margin: 0 });
  slide.addShape("roundRect", { x: 6.85, y: 1.7, w: 5.9, h: 4.85, rectRadius: 0.1, fill: { color: NAVY }, line: { type: "none" } });
  slide.addText(rightHeading, { x: 7.2, y: 1.95, w: 5.2, h: 0.4, fontFace: "Calibri", fontSize: 14, color: ORANGE, bold: true, charSpacing: 1, margin: 0 });
  slide.addText(rightBody, { x: 7.2, y: 2.45, w: 5.2, h: 3.95, fontFace: "Consolas", fontSize: 13.5, color: WHITE, valign: "top", lineSpacingMultiple: 1.3, margin: 0 });
  addFooter(slide);
}

/**
 * Table slide.
 * @param {string[]}   headers  Column header strings
 * @param {Object[][]} rows     pptxgenjs table row objects (each cell can be a string or { text, options })
 */
function addTableSlide(pres, kicker, title, introText, headers, rows) {
  const slide = newSlide(pres);
  sectionTitle(slide, kicker, title);
  let ty = 1.7;
  if (introText) {
    slide.addText(introText, { x: 0.6, y: 1.65, w: 12.1, h: 0.55, fontFace: "Calibri", fontSize: 13.5, color: GRAY_TEXT, margin: 0 });
    ty = 2.35;
  }
  const headerRow = headers.map(h => ({ text: h, options: { bold: true, color: WHITE, fill: { color: NAVY } } }));
  slide.addTable([headerRow, ...rows], {
    x: 0.6, y: ty, w: 12.1, h: SH - ty - 0.7,
    fontFace: "Calibri", fontSize: 13, color: NAVY_DARK,
    border: { type: "solid", color: "D9DEE6", pt: 0.5 },
    autoPage: false, valign: "middle", fill: { color: WHITE },
  });
  addFooter(slide);
}

/**
 * Horizontal step-by-step cards (alternating light/dark).
 * @param {Object[]} steps  [{ t: "Step Title", d: "Step description" }, ...]
 */
function addStepsSlide(pres, kicker, title, introText, steps) {
  const slide = newSlide(pres);
  sectionTitle(slide, kicker, title);
  slide.addText(introText, { x: 0.6, y: 1.65, w: 12.1, h: 0.5, fontFace: "Calibri", fontSize: 14, color: GRAY_TEXT, margin: 0 });
  const cw = (12.1 - (steps.length - 1) * 0.25) / steps.length;
  const cx = 0.6, cy = 2.5, ch = 4.05;
  steps.forEach((s, i) => {
    const x = cx + i * (cw + 0.25);
    slide.addShape("roundRect", { x, y: cy, w: cw, h: ch, rectRadius: 0.08, fill: { color: i % 2 === 0 ? CARD_BG : NAVY }, line: { type: "none" } });
    slide.addShape("roundRect", { x: x + 0.2, y: cy + 0.25, w: 0.5, h: 0.5, rectRadius: 0.25, fill: { color: ORANGE_DARK }, line: { type: "none" } });
    slide.addText(String(i + 1), { x: x + 0.2, y: cy + 0.25, w: 0.5, h: 0.5, fontFace: "Calibri", fontSize: 15, color: WHITE, bold: true, align: "center", valign: "middle", margin: 0 });
    slide.addText(s.t, { x: x + 0.2, y: cy + 0.95, w: cw - 0.4, h: 0.75, fontFace: "Calibri", fontSize: 13.5, bold: true, color: i % 2 === 0 ? NAVY_DARK : WHITE, valign: "top", margin: 0 });
    slide.addText(s.d, { x: x + 0.2, y: cy + 1.75, w: cw - 0.4, h: ch - 2.0, fontFace: "Calibri", fontSize: 11.5, color: i % 2 === 0 ? GRAY_TEXT : "D8DEEA", valign: "top", margin: 0 });
  });
  addFooter(slide);
}

/**
 * Full-width light card with a flat bullet list — good for properties, rules, notes.
 */
function addListCardSlide(pres, kicker, title, introText, items) {
  const slide = newSlide(pres);
  sectionTitle(slide, kicker, title);
  if (introText) slide.addText(introText, { x: 0.6, y: 1.65, w: 12.1, h: 0.45, fontFace: "Calibri", fontSize: 14, color: GRAY_TEXT, margin: 0 });
  slide.addShape("roundRect", { x: 0.6, y: 2.25, w: 12.1, h: 4.2, rectRadius: 0.1, fill: { color: CARD_BG }, line: { type: "none" } });
  slide.addText(items.map((p, i) => ({
    text: p,
    options: { bullet: { code: "25CF", indent: 16 }, breakLine: i !== items.length - 1, paraSpaceAfter: 16 },
  })), { x: 1.0, y: 2.55, w: 11.4, h: 3.65, fontFace: "Calibri", fontSize: 15, color: NAVY_DARK, valign: "top", margin: 0 });
  addFooter(slide);
}

/**
 * Practice problems slide.
 * @param {string[]} problems  Numbered problem strings
 */
function addPracticeSlide(pres, introText, problems) {
  const slide = newSlide(pres);
  sectionTitle(slide, "Your Turn", "Practice Problems");
  slide.addText(introText, { x: 0.6, y: 1.65, w: 12, h: 0.4, fontFace: "Calibri", fontSize: 14.5, color: GRAY_TEXT, margin: 0 });
  slide.addShape("roundRect", { x: 0.6, y: 2.25, w: 12.1, h: 4.2, rectRadius: 0.1, fill: { color: CARD_BG }, line: { type: "none" } });
  slide.addText(problems.map((p, i) => ({
    text: p,
    options: { breakLine: i !== problems.length - 1, paraSpaceAfter: 16 },
  })), { x: 1.0, y: 2.55, w: 11.4, h: 3.6, fontFace: "Calibri", fontSize: 14.5, color: NAVY_DARK, valign: "top", margin: 0 });
  addFooter(slide);
}

/**
 * Summary grid — 2 × N numbered key-takeaway cards.
 * @param {Array<[string,string]>} points  [[short title, description], ...]  (max 6 looks best)
 */
function addSummarySlide(pres, points) {
  const slide = newSlide(pres);
  sectionTitle(slide, "Wrap Up", "Summary & Key Takeaways");
  const cx = 0.6, cw = 5.95, gapX = 0.3, cy = 1.75, ch = 1.75, gapY = 0.25;
  points.forEach((p, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = cx + col * (cw + gapX), y = cy + row * (ch + gapY);
    slide.addShape("roundRect", { x, y, w: cw, h: ch, rectRadius: 0.08, fill: { color: CARD_BG }, line: { type: "none" } });
    slide.addShape("roundRect", { x: x + 0.25, y: y + 0.25, w: 0.5, h: 0.5, rectRadius: 0.25, fill: { color: ORANGE_DARK }, line: { type: "none" } });
    slide.addText(String(i + 1), { x: x + 0.25, y: y + 0.25, w: 0.5, h: 0.5, fontFace: "Calibri", fontSize: 15, color: WHITE, bold: true, align: "center", valign: "middle", margin: 0 });
    slide.addText(p[0], { x: x + 0.95, y: y + 0.2, w: cw - 1.2, h: 0.4, fontFace: "Calibri", fontSize: 15, bold: true, color: NAVY_DARK, margin: 0 });
    slide.addText(p[1], { x: x + 0.95, y: y + 0.62, w: cw - 1.2, h: 1.0, fontFace: "Calibri", fontSize: 12, color: GRAY_TEXT, valign: "top", margin: 0 });
  });
  addFooter(slide);
}

/**
 * Thank-you / closing slide (dark navy background).
 * @param {string} topicTitle  Echoes the lecture topic under the divider line
 */
function addThankYouSlide(pres, topicTitle) {
  const slide = pres.addSlide();
  slide.background = { color: NAVY };
  slide.addText("Thank You", {
    x: 0.5, y: 2.5, w: SW - 1, h: 1.0,
    fontFace: "Calibri", fontSize: 44, color: WHITE, bold: true, align: "center", margin: 0,
  });
  slide.addText("Questions & Discussion", {
    x: 0.5, y: 3.45, w: SW - 1, h: 0.6,
    fontFace: "Calibri", fontSize: 20, color: ORANGE, align: "center", margin: 0,
  });
  slide.addShape("line", {
    x: SW / 2 - 1.2, y: 4.4, w: 2.4, h: 0,
    line: { color: ORANGE, width: 1.5 },
  });
  slide.addText(topicTitle, {
    x: 0.5, y: 4.65, w: SW - 1, h: 0.4,
    fontFace: "Calibri", fontSize: 14, color: "C7D0E0", align: "center", margin: 0,
  });
  slide.addText(COURSE, {
    x: 0.5, y: 5.0, w: SW - 1, h: 0.4,
    fontFace: "Calibri", fontSize: 13, color: "C7D0E0", align: "center", margin: 0,
  });
  slide.addText(FOOTER_TEXT, {
    x: 0.5, y: 5.32, w: SW - 1, h: 0.4,
    fontFace: "Calibri", fontSize: 13, color: "C7D0E0", italic: true, align: "center", margin: 0,
  });
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  // Constants (re-exported so content scripts can reference them)
  NAVY, NAVY_DARK, ORANGE, ORANGE_DARK, WHITE, GRAY_TEXT, CARD_BG,
  FOOTER_TEXT, COURSE, SW, SH, BANNER_PATH,

  // Slide builders
  addTitleSlide,
  addOverviewSlide,
  addIntroSlide,
  addSessionPlanSlide,
  addLearningOutcomesSlide,
  addSinglePanelBulletSlide,
  addSinglePanelHighlightSlide,
  addTwoPanelSlide,
  addTableSlide,
  addStepsSlide,
  addListCardSlide,
  addPracticeSlide,
  addSummarySlide,
  addThankYouSlide,
};
