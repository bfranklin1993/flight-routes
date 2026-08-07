---
target: nonstoproutes.com
total_score: 18
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
timestamp: 2026-08-06T01-10-58Z
slug: nonstoproutes-com
---
# Critique: nonstoproutes.com

Method: dual-agent (A: design review a948ca514d3f8315a · B: detector/browser evidence ad2ae236fecfca141), plus independent parent verification of the P0.

## Design Health Score — 18/40 (Poor)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | Map shows zero routes on load and never says so. No aria-live anywhere. |
| 2 | Match System / Real World | 3 | Solari board, boarding pass, IATA codes are excellent domain matches. "Flight Time" is an undisclosed estimate (miles/500 + 0.5). |
| 3 | User Control and Freedom | 2 | Airline filter is single-select. No reset/recenter. No keyboard close on detail panel. |
| 4 | Consistency and Standards | 1 | Three unrelated visual systems. Two totals for the same airport (258 in meta, 252 in list). Two font stacks on body. |
| 5 | Error Prevention | 2 | Typing "ORD" returns 7 wrong airports (Hartford, Bedford, Bradford, Concord, Cordova...) via substring match. |
| 6 | Recognition Rather Than Recall | 1 | No legend. 38 of 49 carriers render identical grey. Airline meaning lives in a hover-only title attribute. |
| 7 | Flexibility and Efficiency | 2 | URL-per-airport is good. Filter/view/sort state not in URL, so a filtered view can't be shared. |
| 8 | Aesthetic and Minimalist Design | 2 | Solari board and boarding pass are excellent. Default view is 8-49 floating pills over someone else's basemap. |
| 9 | Error Recovery | 1 | The catastrophic failure produces no error state at all. Zero-result search renders nothing. |
| 10 | Help and Documentation | 3 | /how-it-works is honest and well-written. Entry point is 12px gray text over a map. |
| **Total** | | **18/40** | **Poor** |

No heuristic scored n/a; applicable maximum 40.

## Design Specificity Verdict

Split, and it runs the wrong way. The surfaces behind a click are genuinely authored: the Solari split-flap departure board (scanline texture, amber #f5c542 with glow, 31/DAY in Courier) and the boarding-pass detail panel (dashed perforation, ORD --> LGA at 4xl). Nobody's template produces those.

The surface everyone sees is category-interchangeable: unmodified OpenFreeMap basemap + Inter + white pills + 12px gray footer. Swap the labels and it's a COVID dashboard or a store locator. And right now that default surface renders no product data at all, which makes it maximally interchangeable.

Three unrelated visual systems coexist: map chrome (white/gray/Inter), Solari board (near-black/amber/Courier), and /how-it-works (cream #FBFAF6, orange #C23E0E, mono eyebrow). The third is the best-designed surface in the product and shares zero DNA with the other two. Orange, the owner's stated favorite color, appears only on the page nobody visits.

Deterministic scan: 1 finding, `overused-font` at globals.css:25. Location wrong (flagged the Arial scaffolding line), substance correct: layout.tsx imports Inter and applies it to body. Also confirmed dead scaffolding: `--font-geist-sans`/`--font-geist-mono` referenced in globals.css but defined nowhere.

## Priority Issues

### [P0] The map renders zero routes on cold load of every /{iata} page

Verified three independent ways: Assessment A proved it by delaying the route JSON 8s (routes then render perfectly); Assessment B reproduced it 4/4 with byte-identical screenshots; the parent agent reproduced it 3/3 independently (cold-load screenshot exactly 798,547 bytes every run, +586KB after clicking any airline pill).

Root cause, FlightMap.tsx:236 — `if (!map || !readyRef.current) return;`. `readyRef` is set true inside `map.on("load")` at line 198. The route-data effect depends on `[routeData, selectedAirline]`, which changes exactly once (null to data). Route JSON is a 25KB same-origin static file served from the Vercel CDN in ~400ms; the MapLibre style, glyphs, sprites and first tile batch come cross-origin from tiles.openfreemap.org and resolve later. The CDN wins essentially every time, the effect bails on the guard, and because `readyRef` is a ref, mutating it triggers no re-render, so the effect never runs again. Identical bug at line 291 for the selectedRoute highlight.

Why it matters: 749 SEO pages were just shipped to drive strangers to a map that shows nothing. It fails silently (zero console errors, zero failed requests), so it reads as "broken site" rather than "slow site." It self-heals the moment any other state change re-triggers the effect, which makes it look intermittent in casual testing. It is not intermittent; it is deterministic in production.

Fix: extract the effect body into `applyRouteData()`, call it from both the effect and the `map.on("load")` handler, guarded by `map.isStyleLoaded()`. Same treatment at line 291. Add a regression test that throttles /data/routes/* to 0ms and asserts a non-empty feature count on route-arcs after load.

### [P0] Airline identity is carried by colour alone, and the colour channel is broken

Three compounding failures:
1. `src/lib/airlines.ts` maps 11 airlines to brand colours; everything else falls back to `#6B7280`. ORD serves 49 carriers, so 38 of 49 render identical grey on arcs, dots and chips.
2. The four largest carriers are four near-identical dark blues: United #0051C3, Delta #003366, JetBlue #003876, Alaska #00467F. Measured CIE76 dE: 4 of 66 pairs are already confusable with normal colour vision; 6 pairs under protanopia, 6 under deuteranopia. Allegiant vs Hawaiian collapses to dE 1.6 under protanopia.
3. Nothing else carries the signal. Arcs are uniform 1.5px at 0.6 opacity regardless of carrier or volume. Dots are uniform radius. The list's airline indicators are 10px circles whose only fallback is a `title` tooltip, which does not exist on touch. No legend on any surface.

The owner is partially colourblind. This is his product and he cannot read his own map. Separately, the app's one filtering affordance produces a result no user can verify: click Delta, get dark blue lines; click United, get dark blue lines.

Fix, in order: (1) encode volume in line width from the `weekly_flights` already sitting unused in the route objects — this adds a non-colour channel and makes the map informative rather than a topology diagram; (2) rebuild the palette on a colourblind-safe basis, at most 6-7 distinguishable hues, anchored on the orange #C23E0E already in the product's vocabulary, with everything beyond the top carriers in an explicitly labelled "Other carriers" bucket; (3) add a persistent legend and name the carrier in-canvas when filtered.

### [P1] 258 invisible tab stops precede every interactive control on /{iata}

The `sr-only` SEO block in `[iata]/page.tsx:105-113` is fully focusable and comes first in DOM order. Measured on live /ord: 280 total tab stops, of which 1-258 are invisible clipped links. A keyboard user presses Tab 258 times with nothing visibly focused before reaching the search field. No skip link exists (0 nav, 0 header, 1 main).

The homepage inverts the same problem at smaller scale: the search input, the primary control of the entire product, is the tenth tab stop, behind the map canvas and four third-party attribution links.

Separately, `AirportSearch.tsx` has no combobox semantics at all: no role, no aria-expanded, aria-controls, aria-autocomplete or aria-activedescendant, no listbox/option roles, and zero label elements in the document (accessible name comes from placeholder only). Results are `<li onMouseDown>`, not buttons or links. And `outline-none` at line 117 means the search input has no visible focus indicator, confirmed by pixel diff.

Also: typing "ORD" then pressing Enter does nothing unless you first press ArrowDown, because `highlightIndex` resets to -1 on every keystroke (line 54) and the Enter handler requires `highlightIndex >= 0`.

Fix: add a skip link as the first focusable element, move the sr-only block after RouteExplorer in DOM order and wrap it in `<nav aria-label="All destinations">`, wire real combobox ARIA, restore a visible focus ring, and make bare Enter select the first result.

### [P1] The map never fits the routes; fixed zoom 4.5 cuts off the answer

`FlightMap.tsx:281` hard-codes `flyTo({ zoom: 4.5 })` for every airport regardless of route geography. On /ord the international routes run off all four edges. On /hnl the result is a screen of ocean with lines radiating to nowhere and not one destination dot visible. The page's own h1 promises "all 258 nonstop destinations."

Fix: replace with `fitBounds` computed from origin plus all destination coordinates, asymmetric top padding to clear the pill stack, maxZoom 6, and re-fit when selectedAirline changes.

### [P1] Mobile: pills collide with list content, footer collides with attribution

At 390x844 the airline pill stack wraps to three rows and lands on top of "252 nonstop destinations" and the entire sort control row, because `DestinationList.tsx:69` uses a fixed `pt-28` assuming two rows of chrome. Measured collision in map view: attribution at x=10 y=790 370x44, footer at x=12 y=800 378x36, overlap true. Both strings render illegibly on top of each other, which also obscures the OSM attribution (a licensing-visibility issue, not just cosmetic).

Fix: measure chrome height via ref, or make AirlineFilters a single horizontally-scrolling row under 768px. Move the footer into a blurred bar above the attribution and raise it to text-gray-600 minimum.

## Contrast failures (8 distinct text styles, measured from rendered colours)

| Element | Ratio | Verdict |
|---|---|---|
| Footer "Route data: US DOT / BTS" 12px | 2.60 | FAIL |
| List destination state code ("NY") 12px, on all 252 rows | 3.60 | FAIL |
| List "+N" more-airlines indicator 10px | 3.60 | FAIL |
| Inactive sort buttons 12px/600 | 2.97 | FAIL |
| "+41 more" pill 12px/600 | 4.35 | FAIL (marginal) |
| Detail panel "Airline" column header 10px | 3.21 | FAIL |
| Detail panel "Distance"/"Flight time" labels 10px | 3.53 | FAIL |
| Detail panel "#" flight-number prefix 12px | 3.29 | FAIL |

Note: the footer sits directly on the map canvas with no scrim, so its true ratio varies with pan and zoom. That variability is itself the defect.

Discarded false positive: an earlier sweep reported /ord body prose at 1.25:1 across 157 nodes. That content is inside `<section className="sr-only">` and is never painted. Not a real failure.

## Cognitive Load — 5 of 8 fail

FAIL: single focus, grouping, visual hierarchy, minimal choices, working memory. PASS: chunking, one-thing-at-a-time. PARTIAL: progressive disclosure.

Decision points over 4 options: airline pills at 8 collapsed / 49 expanded (the expanded state occupies roughly the top third of a 1440x900 viewport, and at 390px would consume most of the screen with no scroll container, no search and no grouping); search dropdown at 8 results of which 7 are typically wrong for an IATA query.

## Persona Red Flags

**Sam (accessibility / colourblind — the owner):** four dark blues in one perceptual bucket; 38 of 49 carriers identical grey; 10px colour dots with hover-only tooltips; selected-pill state for grey-default carriers is a grey pill on a grey ring, reading as disabled rather than active; 258 invisible tab stops; no combobox ARIA; map canvas carries MapLibre's default aria-label="Map" so every destination, arc and frequency is unreachable non-visually; the list view is the only accessible path to the data and its toggle only exists after route data loads.

**Jordan (first-timer):** homepage has no h1 and in fact zero headings of any level; no headline, no value proposition, no sample airport; the only instruction in the viewport is a placeholder that vanishes on first keystroke. Typing "ORD" returns seven wrong airports. Then the map is empty, which to someone with no prior belief that the site works reads as "there are no flights" rather than "this is a bug." Mistyping produces no "no airports found" at all. And three different totals appear for one airport (252 in the list, 258 in the meta description, "#1 of 258" in the detail panel) because DestinationList filters to weekly_flights > 0 while the rank and SEO copy index the unfiltered array.

**Casey (mobile):** pills cover the sort controls, so 252 results cannot be reordered; "+41 more" expands to 49 pills with no scroll container; airline dots are 10px with hover-only tooltips that never fire on touch; footer is unreadable so both trust signals (data source, recency) are invisible; 9 airline pills are 24px tall and map controls are 29x29, all under the 44px minimum.

## Minor Observations

- globals.css lines 3-26 are unremoved create-next-app scaffolding: a prefers-color-scheme dark block setting variables no component uses, a @theme inline referencing nonexistent --font-geist-* variables, and `body { font-family: Arial, Helvetica }` contradicting the Inter class applied in layout.tsx. There are no design tokens in this product, only leftover boilerplate plus per-component literals.
- The `dark` prop is drilled three levels as a boolean derived from `view === "list" && !!routeData`. A theme system implemented as prop drilling with light/dark class pairs written inline at each site. It will not survive the next surface.
- `estimateFlightTime` (miles/500 + 0.5) is duplicated verbatim in DestinationList.tsx:13 and RouteDetailPanel.tsx:28, and rendered as "1h 58m" in one and "~1h 58m" in the other. Pick one, mark it an estimate in both, move it to src/lib.
- RouteDetailPanel uses #1a1a2e/#16213e while the Solari board 12px beneath it uses #2a2a2a/#1a1a1a. Two dark palettes stacked in one panel.
- The detail panel rank is computed with findIndex over source order, not the sorted order the user is looking at, so "#1 of 258" is not guaranteed to correspond to anything on screen.
- No og:image on any of the 749 pages. Every share posts as a bare text card. For a product whose entire appeal is a striking visual, a per-airport generated OG image (the route starburst plus "252 nonstop destinations from ORD") is the highest-leverage distribution asset available, and @vercel/og can build it from data already on the page.
- Largest asset is the MapLibre chunk at 283KB transferred / 1.05MB decoded, 53% of measured transfer. Cross-origin tile bytes are unmeasurable (no Timing-Allow-Origin), so real totals are higher than the 539KB measured.
- Infrastructure is solid: /zzz correctly 404s, x-nextjs-prerender: 1 and x-vercel-cache: HIT on /ord, zero 4xx/5xx, zero failed requests, no horizontal scroll at either breakpoint. Every problem is in the rendering layer.

## Questions to Consider

1. The Solari board is the best thing in this product and it is the fallback view. What happens if you invert that on /{iata} — board by default, map on toggle? The board answers the search query immediately, above the fold, in a look nobody else has.
2. What is the map for, if not to show volume? The dataset's whole advantage over a schedule scraper is that it records what actually flew, with real passenger counts, and the map currently throws all of that away to render a uniform topology diagram.
3. Why is orange only on the page nobody visits? /how-it-works is the one surface with a point of view. A cream-and-graphite basemap with orange arcs for the dominant carrier is one decision away from distinctive, and it solves the colourblind problem in the same move.
4. A reverse view (pick a destination, see which US airports reach it nonstop) would double the SEO surface using the identical dataset and answers the comparative questions people actually have.
5. If the data lag is the thesis, why is it a footnote in 12px gray at the bottom of a map?
