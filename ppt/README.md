# PPT Generator — Computer Organization and Architecture

Standalone Node.js slide-deck generator built on [PptxGenJS](https://gitbrent.github.io/PptxGenJS/).

---

## Folder Structure

```
ppt/
├── slideHelpers.js   ← All slide-type functions + design constants
├── generate.js       ← Main script — edit this to build your deck
├── package.json      ← CJS package (separate from the ESM backend)
├── banner.jpg        ← Place your banner image here  ⚠️ REQUIRED
└── README.md
```

Output is saved to: `output/<name>.pptx` (created automatically).

---

## Quick Start

```bash
# 1 — Install dependencies (only once)
cd ppt
npm install

# 2 — Copy your banner image
#     The banner must be named banner.jpg and placed in the ppt/ folder.

# 3 — Generate the demo deck
node generate.js my-lecture

# Output → ../output/my-lecture.pptx
```

---

## Building a Real Lecture Deck

Open `generate.js` and:

1. Set `HOUR_LABEL`, `TOPIC`, and `SUBTITLE` at the top.
2. Call the slide builder functions in the order you want the slides to appear.
3. Replace all placeholder text with real lecture content.
4. Run `node generate.js <output-name>`.

---

## Available Slide Types

| Function | Best Used For |
|---|---|
| `addTitleSlide` | Cover / opening slide |
| `addOverviewSlide` | Agenda + outcomes sidebar |
| `addSessionPlanSlide` | Agenda only (no sidebar) |
| `addLearningOutcomesSlide` | Full-page outcomes card |
| `addIntroSlide` | Introduction + 4 info cards |
| `addSinglePanelBulletSlide` | Bullet list on a light card |
| `addSinglePanelHighlightSlide` | Code / formula on a dark card |
| `addTwoPanelSlide` | Theory (left) + code/example (right) |
| `addTableSlide` | Comparison or reference table |
| `addStepsSlide` | Step-by-step horizontal cards |
| `addListCardSlide` | Properties / rules / notes |
| `addPracticeSlide` | Practice problems |
| `addSummarySlide` | 2×N summary grid |
| `addThankYouSlide` | Closing slide (dark navy) |

---

## Design Tokens (in `slideHelpers.js`)

| Constant | Value | Usage |
|---|---|---|
| `NAVY` | `1B2A4A` | Primary accent, button backgrounds |
| `NAVY_DARK` | `10192E` | Headings, strong text |
| `ORANGE` | `F2A22B` | Highlights on dark backgrounds |
| `ORANGE_DARK` | `D6821A` | Kicker labels, numbered badges |
| `CARD_BG` | `EEF1F6` | Light card background |
| `GRAY_TEXT` | `4A5568` | Body / description text |
