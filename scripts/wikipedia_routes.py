"""
Parse the "Airlines and destinations" section of a Wikipedia airport article
into structured passenger routes.

The parser is PURE: no network, no file I/O. A small fetch helper for grabbing
new fixtures lives under ``if __name__ == "__main__"`` only and is never imported
by the parser.

Usage (parser):
    from wikipedia_routes import parse_destination_list
    routes = parse_destination_list(section_wikitext)
"""

import re
from dataclasses import dataclass


@dataclass
class ParsedRoute:
    airline: str          # airline article/name, e.g. "Aer Lingus"
    dest_title: str       # destination Wikipedia article TITLE (left of the wikilink)
    seasonal: bool        # True if after a '''Seasonal:''' divider in the cell
    note: str | None      # parenthetical/marker annotation, else None


# Markers that, when found in a destination's annotation, we keep as a note.
_NOTE_KEYWORDS = ("begins", "ends", "resumes", "suspended", "charter", "starts")


# ---------------------------------------------------------------------------
# Cleaning helpers
# ---------------------------------------------------------------------------

def _strip_balanced_braces(text: str) -> str:
    """Remove ``{{ ... }}`` template calls, handling nesting and inner pipes."""
    out = []
    depth = 0
    i = 0
    n = len(text)
    while i < n:
        if text[i : i + 2] == "{{":
            depth += 1
            i += 2
            continue
        if text[i : i + 2] == "}}":
            if depth > 0:
                depth -= 1
            i += 2
            continue
        if depth == 0:
            out.append(text[i])
        i += 1
    return "".join(out)


def _unwrap_nowrap(text: str) -> str:
    """Replace ``{{nowrap|X}}`` (and ``{{Nowrap|X}}``) with its inner content X
    so the wikilink it protects survives template stripping. Handles a single
    level of nesting by repeating until stable."""
    pattern = re.compile(r"\{\{\s*nowrap\s*\|([^{}]*)\}\}", flags=re.IGNORECASE)
    prev = None
    while prev != text:
        prev = text
        text = pattern.sub(lambda m: m.group(1), text)
    return text


def _strip_refs_and_comments(text: str) -> str:
    """Strip <ref>...</ref>, self-closing <ref/>, HTML comments, and {{cite}}/
    {{...}} templates (which may contain pipes) BEFORE any cell splitting."""
    # HTML comments first (may contain pipes / braces / refs).
    text = re.sub(r"<!--.*?-->", "", text, flags=re.DOTALL)
    # Preserve wikilinks wrapped in {{nowrap|...}} before brace stripping.
    text = _unwrap_nowrap(text)
    # Self-closing refs FIRST: <ref ... />. Must precede the paired-ref strip,
    # otherwise the paired pattern mistakes "<ref name=x/>" for an opening tag
    # and its .*? greedily swallows content up to the next genuine </ref>.
    text = re.sub(r"<ref\b[^>]*?/\s*>", "", text, flags=re.IGNORECASE)
    # Paired ref tags (non-greedy, dot-all). Also handles <ref name="x">...</ref>.
    text = re.sub(r"<ref\b[^>]*?>.*?</ref>", "", text, flags=re.DOTALL | re.IGNORECASE)
    # {{citation needed}}, {{cite ...}} and any other remaining templates with
    # balanced (possibly nested) braces. Done last so cite-internal pipes go away.
    text = _strip_balanced_braces(text)
    return text


def _split_top_level(text: str, sep: str, track_parens: bool = False) -> list[str]:
    """Split ``text`` on ``sep`` (single char) only at the top level, i.e. not
    inside ``[[...]]`` wikilinks, ``{{...}}`` templates, or HTML tags ``<...>``.

    When ``track_parens`` is True, also avoid splitting inside ``(...)`` so that
    commas within an annotation like ``(begins October 23, 2026)`` are kept."""
    parts = []
    buf = []
    bracket = 0   # [[ ]] depth (counted in single brackets)
    brace = 0     # {{ }} depth (counted in single braces)
    angle = 0     # < > depth
    paren = 0     # ( ) depth
    i = 0
    n = len(text)
    while i < n:
        two = text[i : i + 2]
        ch = text[i]
        if two == "[[":
            bracket += 1
            buf.append(two)
            i += 2
            continue
        if two == "]]":
            if bracket > 0:
                bracket -= 1
            buf.append(two)
            i += 2
            continue
        if two == "{{":
            brace += 1
            buf.append(two)
            i += 2
            continue
        if two == "}}":
            if brace > 0:
                brace -= 1
            buf.append(two)
            i += 2
            continue
        if ch == "<":
            angle += 1
            buf.append(ch)
            i += 1
            continue
        if ch == ">":
            if angle > 0:
                angle -= 1
            buf.append(ch)
            i += 1
            continue
        if track_parens and ch == "(":
            paren += 1
            buf.append(ch)
            i += 1
            continue
        if track_parens and ch == ")":
            if paren > 0:
                paren -= 1
            buf.append(ch)
            i += 1
            continue
        if ch == sep and bracket == 0 and brace == 0 and angle == 0 and paren == 0:
            parts.append("".join(buf))
            buf = []
            i += 1
            continue
        buf.append(ch)
        i += 1
    parts.append("".join(buf))
    return parts


def _normalize_title(title: str) -> str:
    """Underscores -> spaces, collapse internal whitespace, strip."""
    title = title.replace("_", " ")
    title = re.sub(r"\s+", " ", title)
    return title.strip()


def _extract_airline_name(cell: str) -> str | None:
    """Pull the airline article/name from a cell that may be wrapped in
    {{nowrap|...}} and contain a [[...]] wikilink."""
    cell = cell.strip()
    if not cell:
        return None
    # Unwrap any remaining {{nowrap|...}} style wrappers by taking inner content.
    # (Most templates were already stripped, but nowrap wraps a wikilink we want.)
    nowrap = re.search(r"\{\{\s*nowrap\s*\|(.*)\}\}", cell, flags=re.IGNORECASE | re.DOTALL)
    if nowrap:
        cell = nowrap.group(1).strip()
    m = re.search(r"\[\[([^\]]+)\]\]", cell)
    if m:
        inner = m.group(1)
        # [[Article|Display]] -> Article (left side)
        name = inner.split("|", 1)[0]
        return _normalize_title(name)
    # Plain text airline name (rare).
    name = _normalize_title(cell)
    return name or None


# Divider patterns. Matches '''Seasonal:''' and '''Seasonal''': variants:
# opening bold, the word, an optional colon (inside the bold), the closing
# bold, then an optional colon (outside the bold).
_SEASONAL_RE = re.compile(r"'''\s*Seasonal\s*:?\s*'''\s*:?", flags=re.IGNORECASE)
_CHARTER_RE = re.compile(r"'''\s*Charter\s*:?\s*'''\s*:?", flags=re.IGNORECASE)


def _parse_dest_token(token: str) -> tuple[str, str | None] | None:
    """Given a single destination token (one wikilink plus trailing annotation),
    return (dest_title, note) or None if no wikilink is present."""
    m = re.search(r"\[\[([^\]]+)\]\]", token)
    if not m:
        return None
    inner = m.group(1)
    title = inner.split("|", 1)[0]
    title = _normalize_title(title)
    if not title:
        return None

    # Everything after the wikilink may carry an annotation, e.g.
    # "(begins October 23, 2026)" or "(all suspended)".
    after = token[m.end():]
    note = None
    for paren in re.findall(r"\(([^)]*)\)", after):
        candidate = paren.strip()
        if any(kw in candidate.lower() for kw in _NOTE_KEYWORDS):
            note = candidate
            break
    return title, note


def _parse_dest_cell(cell: str) -> list[tuple[str, bool, str | None]]:
    """Parse a destinations cell into (dest_title, seasonal, note) tuples.

    Handles '''Seasonal:''' / '''Charter:''' dividers (which may be preceded by
    <br />) and splits the remaining destinations on top-level commas.
    """
    results: list[tuple[str, bool, str | None]] = []

    # Walk the cell, tracking the active divider state. We split into segments at
    # each Seasonal/Charter divider. Find all divider positions.
    dividers = []  # (pos, kind)
    for mt in _SEASONAL_RE.finditer(cell):
        dividers.append((mt.start(), mt.end(), "seasonal"))
    for mt in _CHARTER_RE.finditer(cell):
        dividers.append((mt.start(), mt.end(), "charter"))
    dividers.sort()

    segments = []  # (text, kind) where kind in {"normal","seasonal","charter"}
    if not dividers:
        segments.append((cell, "normal"))
    else:
        # Text before the first divider is "normal".
        first_start = dividers[0][0]
        head = cell[:first_start]
        if head.strip():
            segments.append((head, "normal"))
        for idx, (start, end, kind) in enumerate(dividers):
            seg_end = dividers[idx + 1][0] if idx + 1 < len(dividers) else len(cell)
            seg_text = cell[end:seg_end]
            segments.append((seg_text, kind))

    for seg_text, kind in segments:
        # Drop <br /> and similar tags within the segment.
        seg_text = re.sub(r"<br\s*/?>", " ", seg_text, flags=re.IGNORECASE)
        for token in _split_top_level(seg_text, ",", track_parens=True):
            token = token.strip()
            if not token:
                continue
            parsed = _parse_dest_token(token)
            if parsed is None:
                continue
            title, note = parsed
            seasonal = kind == "seasonal"
            if kind == "charter" and note is None:
                note = "charter"
            results.append((title, seasonal, note))
    return results


# ---------------------------------------------------------------------------
# Section / subsection extraction
# ---------------------------------------------------------------------------

def _extract_passenger_subsection(section_wikitext: str) -> str:
    """Return only the Passenger subsection body. Excludes Cargo and any other
    ===...=== subsection. If no ===Passenger=== heading exists, fall back to the
    whole text up to the first ===Cargo=== heading (some articles omit the
    Passenger heading)."""
    # Find the Passenger heading.
    m = re.search(r"^===+\s*Passenger\s*===+\s*$", section_wikitext, flags=re.MULTILINE | re.IGNORECASE)
    if m:
        start = m.end()
    else:
        start = 0
    # End at the next subsection heading (===...===) after start.
    rest = section_wikitext[start:]
    end_m = re.search(r"^===+\s*[^=].*?===+\s*$", rest, flags=re.MULTILINE)
    if end_m:
        return rest[: end_m.start()]
    return rest


def _extract_destination_template(text: str) -> str | None:
    """Return the inner body of the first {{Airport destination list ...}}
    template (between the opening name and the closing braces), or None."""
    # Strip comments so a template name mentioned inside <!-- ... --> is ignored.
    text = re.sub(r"<!--.*?-->", "", text, flags=re.DOTALL)
    m = re.search(r"\{\{\s*Airport destination list", text, flags=re.IGNORECASE)
    if not m:
        return None
    # Walk braces from the opening to find the matching close.
    start = m.start()
    depth = 0
    i = start
    n = len(text)
    while i < n:
        if text[i : i + 2] == "{{":
            depth += 1
            i += 2
            continue
        if text[i : i + 2] == "}}":
            depth -= 1
            i += 2
            if depth == 0:
                inner = text[start + 2 : i - 2]
                # Drop the leading "Airport destination list" token.
                inner = re.sub(r"^\s*Airport destination list", "", inner, flags=re.IGNORECASE)
                return inner
        else:
            i += 1
    return None


def _parse_template_rows(template_inner: str) -> list[ParsedRoute]:
    """Parse the inner body of an {{Airport destination list}} template."""
    routes: list[ParsedRoute] = []
    cleaned = _strip_refs_and_comments(template_inner)

    # Rows are separated at the top level by leading "|". Because cells within a
    # row are ALSO pipe-separated, we treat the template body as one stream of
    # top-level pipe cells and pair them up. The template grammar is:
    #   | param=value (ignored)
    #   | Airline | destinations [| refs]
    # We detect airline cells (contain a wikilink and are not "key=value" params).
    cells = _split_top_level(cleaned, "|")

    # The first element before any pipe is template-leading junk.
    cells = [c for c in cells]

    # Build rows: an airline cell starts a row; the NEXT non-param cell is its
    # destinations. Anything after that (refs column) is ignored until the next
    # airline cell.
    i = 0
    # Skip the leading chunk (before the first pipe) which is template params/whitespace.
    if cells:
        cells = cells[1:]
    n = len(cells)
    while i < n:
        cell = cells[i]
        # An airline cell must contain a wikilink and not be a "key=value" param.
        if "[[" not in cell or "=" in cell.split("[[")[0]:
            i += 1
            continue
        airline = _extract_airline_name(cell)
        if airline is None:
            i += 1
            continue
        # The destinations cell is the next cell.
        if i + 1 < n:
            dest_cell = cells[i + 1]
            dests = _parse_dest_cell(dest_cell)
            for title, seasonal, note in dests:
                routes.append(
                    ParsedRoute(
                        airline=airline,
                        dest_title=title,
                        seasonal=seasonal,
                        note=note,
                    )
                )
            i += 2
        else:
            i += 1
    return routes


# ---------------------------------------------------------------------------
# Raw wikitable fallback
# ---------------------------------------------------------------------------

def _parse_wikitable_fallback(passenger_text: str) -> list[ParsedRoute]:
    """Best-effort parse of a raw ``{| class="wikitable" ... |}`` table where the
    template form is absent. Rows look like ``| Airline || destinations``."""
    routes: list[ParsedRoute] = []
    # Strip comments first so commented-out "{| ... |}" examples are ignored.
    passenger_text = re.sub(r"<!--.*?-->", "", passenger_text, flags=re.DOTALL)
    # Grab the first wikitable block (non-greedy, but tables don't nest here).
    m = re.search(r"\{\|.*?\n\|\}", passenger_text, flags=re.DOTALL)
    if not m:
        return routes
    table = m.group(0)
    table = _strip_refs_and_comments(table)
    # Rows are separated by "|-".
    raw_rows = re.split(r"^\s*\|-.*$", table, flags=re.MULTILINE)
    for raw in raw_rows:
        raw = raw.strip()
        if not raw:
            continue
        # Skip header rows (start with !) and the table opening/closing lines.
        # Collect cell text: cells are introduced by leading "|" or separated by "||".
        # Normalize: drop a leading "{|" opener if present.
        if raw.startswith("{|") or raw.startswith("|}"):
            # First/last fragments contain table attrs / close; may still hold a row.
            raw = re.sub(r"^\{\|[^\n]*\n?", "", raw)
            raw = re.sub(r"\|\}\s*$", "", raw)
            raw = raw.strip()
            if not raw:
                continue
        if raw.startswith("!"):
            continue
        # Within a data row, split into cells on "||" and leading "|" per line.
        # Flatten line-based "|" cells and inline "||" cells.
        line_cells: list[str] = []
        for line in raw.split("\n"):
            line = line.strip()
            if not line:
                continue
            if line.startswith("!"):
                continue
            if line.startswith("|"):
                line = line[1:]
            for c in line.split("||"):
                line_cells.append(c.strip())
        line_cells = [c for c in line_cells if c]
        if len(line_cells) < 2:
            continue
        airline = _extract_airline_name(line_cells[0])
        if airline is None:
            continue
        dest_cell = line_cells[1]
        for title, seasonal, note in _parse_dest_cell(dest_cell):
            routes.append(
                ParsedRoute(
                    airline=airline,
                    dest_title=title,
                    seasonal=seasonal,
                    note=note,
                )
            )
    return routes


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def parse_destination_list(section_wikitext: str) -> list[ParsedRoute]:
    """Parse the passenger routes out of an "Airlines and destinations" section.

    Pure function. Excludes the Cargo subsection. Supports both the
    {{Airport destination list}} template and a raw wikitable fallback.
    """
    if not section_wikitext or not section_wikitext.strip():
        return []

    passenger = _extract_passenger_subsection(section_wikitext)

    template_inner = _extract_destination_template(passenger)
    if template_inner is not None:
        try:
            return _parse_template_rows(template_inner)
        except Exception:
            # Resilient: never crash the caller on a malformed template.
            return []

    # Fallback: raw wikitable.
    try:
        return _parse_wikitable_fallback(passenger)
    except Exception:
        return []


# ===========================================================================
# Everything below is the ORCHESTRATION layer around the pure parser above:
# fetch from the MediaWiki API, resolve destination titles to IATA codes,
# merge route presence additively into the existing BTS route files, and run
# the whole thing robustly with loud failure on systemic problems.
#
# The parser above stays pure (no network, no file I/O). These helpers are not
# imported by the parser and may depend on requests / pandas / process_data.
# ===========================================================================

import json
import os
import sys
import time
import unicodedata
import urllib.parse
from collections import Counter
from datetime import date
from pathlib import Path

USER_AGENT = (
    "nonstoproutes-data-bot/1.0 "
    "(https://nonstoproutes.com; brian.mcgovern.franklin@gmail.com) "
    "python-requests"
)

WIKI_API = "https://en.wikipedia.org/w/api.php"
SECTION_HEADING = "Airlines and destinations"

# Politeness / resilience knobs.
REQUEST_TIMEOUT = 30        # seconds per HTTP request
POLITE_SLEEP = 1.0          # seconds between successful API calls
MAX_RETRIES = 4             # retry attempts on transient failures
MAXLAG = 5                  # MediaWiki maxlag (seconds)

_SCRIPT_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _SCRIPT_DIR.parent
_ROUTES_DIR = _REPO_ROOT / "public" / "data" / "routes"
_REPORT_PATH = _SCRIPT_DIR / ".wiki_report.json"


class FetchFailed(Exception):
    """Raised when a fetch fails permanently after exhausting retries.

    The caller counts this as a failed fetch (it does NOT crash the run)."""


# ---------------------------------------------------------------------------
# Title normalization + IATA <-> Wikipedia title maps
# ---------------------------------------------------------------------------

def normalize_title(s: str) -> str:
    """Normalize a Wikipedia title for robust matching.

    Unquote percent-escapes, underscores -> spaces, collapse internal
    whitespace, strip, casefold. Used to key the title -> IATA map and to look
    up destination links from the parser.
    """
    if s is None:
        return ""
    # NFKC first so accent/dash encoding variants (e.g. composed vs decomposed
    # "Cancún", or compatibility dash codepoints) collapse to one canonical form
    # before any other transformation. Applied identically on both sides (map
    # build and lookup).
    s = unicodedata.normalize("NFKC", str(s))
    s = urllib.parse.unquote(s)
    s = s.replace("_", " ")
    # Collapse punctuation that differs across sources (OurAirports vs the
    # Wikipedia article title) into spaces so e.g. "Austin-Bergstrom",
    # "Austin–Bergstrom" (en-dash) and "Dallas/Fort Worth" all match.
    # ‐-― = unicode hyphen/dash range; also ASCII hyphen and slash.
    s = re.sub(r"[‐-―\-/]", " ", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip().casefold()


def _title_from_wikipedia_link(link: str) -> str | None:
    """Extract the article title from an OurAirports wikipedia_link.

    Takes the part after '/wiki/', unquotes it, underscores -> spaces, strips.
    Keeps unicode as-is (e.g. en-dash in airport names). Returns None if the
    link has no '/wiki/' segment.
    """
    if not link or not isinstance(link, str):
        return None
    marker = "/wiki/"
    idx = link.find(marker)
    if idx == -1:
        return None
    raw = link[idx + len(marker):]
    # Drop any anchor / query that may follow the title.
    raw = raw.split("#", 1)[0].split("?", 1)[0]
    title = urllib.parse.unquote(raw).replace("_", " ").strip()
    return title or None


def _load_ourairports_csv():
    """Read the raw OurAirports CSV (downloading via process_data if missing).

    Returns a pandas DataFrame with the full set of columns (we need
    ``wikipedia_link`` and ``type``, which download_ourairports() drops).
    """
    import process_data  # local import: keep parser dependency-free
    import pandas as pd

    path = process_data.RAW_DIR / "airports.csv"
    if not path.exists():
        # Trigger the download (download_ourairports writes the CSV when absent).
        process_data.download_ourairports()
    return pd.read_csv(path)


# Airport "type" ranking for collision tie-breaking (larger wins).
_TYPE_RANK = {"large_airport": 2, "medium_airport": 1}


def build_title_maps() -> tuple[dict[str, str], dict[str, str]]:
    """Build IATA <-> Wikipedia title maps from OurAirports.

    Returns ``(iata_to_title, title_to_iata)`` where:
      - ``iata_to_title`` maps IATA -> raw article title (med/large airports
        that have both an IATA code and a wikipedia_link).
      - ``title_to_iata`` maps NORMALIZED title -> IATA (reverse map, for
        resolving destination links). On a normalized-title collision the
        larger airport type wins; collisions are logged.
    """
    import pandas as pd

    df = _load_ourairports_csv()
    df = df[df["type"].isin(["medium_airport", "large_airport"])]
    df = df[df["iata_code"].notna() & (df["iata_code"].astype(str) != "")]

    iata_to_title: dict[str, str] = {}
    title_to_iata: dict[str, str] = {}
    title_rank: dict[str, int] = {}  # normalized title -> winning type rank
    collisions = 0

    for _, row in df.iterrows():
        link = row.get("wikipedia_link")
        if not isinstance(link, str) or not link:
            continue
        title = _title_from_wikipedia_link(link)
        if not title:
            continue
        iata = str(row["iata_code"]).strip()
        if not iata:
            continue
        rank = _TYPE_RANK.get(row["type"], 0)

        iata_to_title[iata] = title

        norm = normalize_title(title)
        if not norm:
            continue
        if norm in title_to_iata and title_to_iata[norm] != iata:
            collisions += 1
            # Prefer the larger airport type on collision.
            if rank > title_rank.get(norm, 0):
                title_to_iata[norm] = iata
                title_rank[norm] = rank
        else:
            title_to_iata[norm] = iata
            title_rank[norm] = rank

    if collisions:
        print(f"  [maps] {collisions} normalized-title collisions resolved by airport size")
    return iata_to_title, title_to_iata


def build_airport_lookup() -> dict[str, dict]:
    """Build an IATA -> airport-metadata lookup from process_data's frame.

    Uses ``process_data.download_ourairports()`` so the metadata shape matches
    the route files (iata, name, city, region_label, lat, lon).
    """
    import process_data
    frame = process_data.download_ourairports()
    return frame.set_index("iata").to_dict("index")


# ---------------------------------------------------------------------------
# Fetch (polite + resilient)
# ---------------------------------------------------------------------------

def _slice_airlines_section(wikitext: str) -> str | None:
    """Slice the '==Airlines and destinations==' section out of full page
    wikitext, from that heading up to the next top-level '==Heading==' line.

    Returns the slice (still containing ===Passenger===/===Cargo===
    subsections), or None if the section is absent.
    """
    if not wikitext:
        return None
    lines = wikitext.split("\n")
    top_heading = re.compile(r"^==[^=].*==\s*$")
    target = SECTION_HEADING.strip().lower()
    start = None
    for i, line in enumerate(lines):
        m = top_heading.match(line)
        if not m:
            continue
        # Heading text without the surrounding '==' markers.
        text = line.strip().strip("=").strip().lower()
        if text == target:
            start = i
            break
    if start is None:
        return None
    # Find the next top-level heading after the start line.
    end = len(lines)
    for j in range(start + 1, len(lines)):
        if top_heading.match(lines[j]):
            end = j
            break
    return "\n".join(lines[start:end])


def fetch_airport_section(title: str, session) -> str | None:
    """Fetch and slice the 'Airlines and destinations' section for an article.

    One MediaWiki ``action=parse&prop=wikitext`` call (with redirects), then
    slice out the target section. Returns the section wikitext, or None if the
    page or section is absent.

    Raises ``FetchFailed`` if the request fails permanently after retries
    (HTTP 429/503/5xx, connection errors, or MediaWiki maxlag) so the caller
    can count it as a failed fetch without crashing the whole run.
    """
    import requests

    params = {
        "action": "parse",
        "page": title,
        "prop": "wikitext",
        "format": "json",
        "redirects": 1,
        "maxlag": MAXLAG,
    }

    backoff = 2.0
    last_err = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = session.get(WIKI_API, params=params, timeout=REQUEST_TIMEOUT)
        except requests.RequestException as e:
            last_err = e
            _sleep_backoff(None, backoff, attempt)
            backoff *= 2
            continue

        # Retry transient HTTP statuses, honoring Retry-After if present.
        if resp.status_code in (429, 503) or 500 <= resp.status_code < 600:
            last_err = f"HTTP {resp.status_code}"
            _sleep_backoff(resp.headers.get("Retry-After"), backoff, attempt)
            backoff *= 2
            continue

        try:
            data = resp.json()
        except ValueError as e:
            last_err = e
            _sleep_backoff(None, backoff, attempt)
            backoff *= 2
            continue

        # MediaWiki maxlag error: {"error":{"code":"maxlag", ...}}
        err = data.get("error")
        if err and err.get("code") == "maxlag":
            last_err = "maxlag"
            _sleep_backoff(resp.headers.get("Retry-After"), backoff, attempt)
            backoff *= 2
            continue
        if err:
            # Page-missing / invalid-title etc.: not a transient failure.
            code = err.get("code")
            if code in ("missingtitle", "nosuchsection", "invalidtitle"):
                return None
            # Unknown API error: treat as a soft miss rather than crashing.
            return None

        wikitext = (
            data.get("parse", {}).get("wikitext", {}).get("*")
            if isinstance(data.get("parse"), dict)
            else None
        )
        return _slice_airlines_section(wikitext)

    raise FetchFailed(f"fetch failed for {title!r} after {MAX_RETRIES} attempts: {last_err}")


def _sleep_backoff(retry_after, backoff: float, attempt: int) -> None:
    """Sleep before a retry, honoring a Retry-After header when present."""
    delay = backoff
    if retry_after:
        try:
            delay = max(delay, float(retry_after))
        except (TypeError, ValueError):
            pass
    time.sleep(delay)


# ---------------------------------------------------------------------------
# Resolve destination titles to IATA codes
# ---------------------------------------------------------------------------

def resolve_destinations(
    parsed: list[ParsedRoute],
    origin_iata: str,
    title_to_iata: dict[str, str],
) -> tuple[list[dict], list[str]]:
    """Resolve parsed routes' destination titles to IATA codes.

    Returns ``(resolved, unresolved_titles)`` where each resolved record is
    ``{dest_iata, airline, seasonal, note}``. Self-references (dest == origin)
    are dropped. Unresolved destination titles are collected for reporting.
    """
    resolved: list[dict] = []
    unresolved: list[str] = []
    origin = origin_iata.upper()
    for pr in parsed:
        norm = normalize_title(pr.dest_title)
        dest_iata = title_to_iata.get(norm)
        if not dest_iata:
            unresolved.append(pr.dest_title)
            continue
        if dest_iata.upper() == origin:
            continue
        resolved.append({
            "dest_iata": dest_iata,
            "airline": pr.airline,
            "seasonal": pr.seasonal,
            "note": pr.note,
        })
    return resolved, unresolved


_REDIRECT_BATCH = 50  # MediaWiki titles= cap per query is 50 for non-bots.


def _wiki_api_get(params: dict, session) -> dict | None:
    """One polite + resilient MediaWiki GET. Returns parsed JSON, or None if the
    request fails permanently (after retries) or returns a non-transient API
    error. Mirrors the retry/backoff/maxlag logic in fetch_airport_section."""
    import requests

    backoff = 2.0
    last_err = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = session.get(WIKI_API, params=params, timeout=REQUEST_TIMEOUT)
        except requests.RequestException as e:
            last_err = e
            _sleep_backoff(None, backoff, attempt)
            backoff *= 2
            continue

        if resp.status_code in (429, 503) or 500 <= resp.status_code < 600:
            last_err = f"HTTP {resp.status_code}"
            _sleep_backoff(resp.headers.get("Retry-After"), backoff, attempt)
            backoff *= 2
            continue

        try:
            parsed = resp.json()
        except ValueError as e:
            last_err = e
            _sleep_backoff(None, backoff, attempt)
            backoff *= 2
            continue

        err = parsed.get("error")
        if err and err.get("code") == "maxlag":
            last_err = "maxlag"
            _sleep_backoff(resp.headers.get("Retry-After"), backoff, attempt)
            backoff *= 2
            continue
        if err:
            # Non-transient API error: skip (don't crash).
            print(f"  [redirects] API error {err.get('code')!r}", file=sys.stderr)
            return None
        return parsed

    print(f"  [redirects] request failed after retries: {last_err}", file=sys.stderr)
    return None


def resolve_redirects(
    titles: set[str],
    session,
    title_to_iata: dict[str, str],
) -> dict[str, str]:
    """Recover IATA codes for destination titles that don't string-match the
    canonical OurAirports article title, by reconciling Wikipedia redirects.

    Two directions are handled in one query per batch:

    1. FORWARD: the destination link is itself a redirect (e.g. a variant form
       that redirects to a canonical article). ``query.redirects`` /
       ``query.normalized`` give the from->to chain to the canonical title; if
       that canonical title is in ``title_to_iata`` we resolve it.

    2. REVERSE (the common case in practice): the destination link IS the
       current canonical article (e.g. "Cancún International Airport",
       "Dulles International Airport", "Haneda Airport"), while the OurAirports
       title is a now-stale REDIRECT into it ("Cancun International Airport",
       "Washington Dulles International Airport", "Tokyo International Airport").
       ``prop=redirects`` lists every title that redirects INTO the destination
       article; if any of those redirect-sources is in ``title_to_iata`` we
       resolve the destination to that IATA.

    Args:
        titles: a set of RAW (un-normalized) destination titles that failed to
            resolve against ``title_to_iata``.
        session: a requests.Session (polite User-Agent already set).
        title_to_iata: the existing NORMALIZED title -> IATA map.

    Returns ``{normalized_original_title: iata}`` for the titles that newly
    resolve. Titles that still can't be mapped are omitted. A failed batch is
    skipped (logged) rather than crashing the run.
    """
    out: dict[str, str] = {}
    title_list = [t for t in titles if t and t.strip()]
    if not title_list:
        return out

    for start in range(0, len(title_list), _REDIRECT_BATCH):
        batch = title_list[start:start + _REDIRECT_BATCH]

        # Accumulate per-batch state. prop=redirects can paginate via
        # rdcontinue when many redirect-sources exist across the 50 titles.
        forward_hop: dict[str, str] = {}        # from-title -> to-title (lower-effort chain)
        reverse_iata: dict[str, str] = {}       # canonical page title -> IATA (from redirect sources)
        cont: dict | None = None

        while True:
            params = {
                "action": "query",
                "format": "json",
                "redirects": 1,
                "maxlag": MAXLAG,
                "prop": "redirects",
                "rdlimit": "max",
                "rdnamespace": 0,
                "titles": "|".join(batch),
            }
            if cont:
                params.update(cont)

            data = _wiki_api_get(params, session)
            if data is None:
                break  # skip this batch; partial state below is still usable

            query = data.get("query", {}) if isinstance(data.get("query"), dict) else {}

            # FORWARD chains (only present on the first page; harmless to repeat).
            for entry in (query.get("normalized") or []):
                frm, to = entry.get("from"), entry.get("to")
                if frm is not None and to is not None:
                    forward_hop[frm] = to
            for entry in (query.get("redirects") or []):
                frm, to = entry.get("from"), entry.get("to")
                if frm is not None and to is not None:
                    forward_hop[frm] = to

            # REVERSE: for each canonical page, scan the titles that redirect in.
            pages = query.get("pages", {})
            if isinstance(pages, dict):
                for page in pages.values():
                    page_title = page.get("title")
                    if not page_title:
                        continue
                    for rd in (page.get("redirects") or []):
                        src = rd.get("title")
                        if not src:
                            continue
                        iata = title_to_iata.get(normalize_title(src))
                        if iata and page_title not in reverse_iata:
                            reverse_iata[page_title] = iata

            cont = data.get("continue")
            if not cont:
                break
            time.sleep(POLITE_SLEEP)

        # Resolve each requested title: follow forward hops to its canonical
        # title, then try direct map, then the reverse-redirect map.
        for original in batch:
            final = original
            seen = set()
            while final in forward_hop and final not in seen:
                seen.add(final)
                final = forward_hop[final]
            iata = title_to_iata.get(normalize_title(final)) or reverse_iata.get(final)
            if iata:
                out[normalize_title(original)] = iata

        time.sleep(POLITE_SLEEP)

    return out


# ---------------------------------------------------------------------------
# Merge (additive + provenance)
# ---------------------------------------------------------------------------

def _dedupe_sources(sources) -> list[str]:
    """Return a deduped, order-preserving list of provenance sources."""
    seen = []
    for s in sources or []:
        if s not in seen:
            seen.append(s)
    return seen


def merge_wikipedia(
    origin_iata: str,
    resolved: list[dict],
    airport_lookup: dict[str, dict],
    today: str,
) -> dict | None:
    """Merge resolved Wikipedia routes additively into an existing route file.

    Returns a stats dict ``{existing_confirmed, new_routes_added,
    new_dests_skipped_no_coords}`` or None if the airport has no existing
    route file (we only annotate airports the site already has).

    Never deletes or modifies BTS volume data. Idempotent: re-running adds no
    duplicate routes / airlines / sources.
    """
    import pandas as pd

    path = _ROUTES_DIR / f"{origin_iata.lower()}.json"
    if not path.exists():
        return None

    data = json.loads(path.read_text(encoding="utf-8"))
    routes = data.get("routes", [])

    # Index existing routes by destination IATA.
    existing_by_iata: dict[str, dict] = {}
    for r in routes:
        dest = r.get("destination", {})
        iata = dest.get("iata")
        if iata:
            existing_by_iata[iata] = r

    # Group resolved Wikipedia records by destination IATA.
    wiki_by_iata: dict[str, list[dict]] = {}
    for rec in resolved:
        wiki_by_iata.setdefault(rec["dest_iata"], []).append(rec)

    existing_confirmed = 0
    new_routes_added = 0
    new_dests_skipped_no_coords = 0

    origin_info = data.get("airport", {})
    origin_lat = origin_info.get("lat")
    origin_lon = origin_info.get("lon")

    for dest_iata, recs in wiki_by_iata.items():
        seasonal_all = all(rec["seasonal"] for rec in recs)
        if dest_iata in existing_by_iata:
            # Existing route: record provenance only (don't touch airlines).
            # A route is BTS unless it was created wiki-only (no volume + an
            # explicit wikipedia-only source). This keeps re-runs idempotent:
            # we never fabricate "bts" for a route we ourselves added.
            route = existing_by_iata[dest_iata]
            raw_sources = route.get("sources")
            is_wiki_only = (
                raw_sources == ["wikipedia"]
                or (route.get("total_annual_passengers", 0) == 0
                    and raw_sources is not None
                    and "bts" not in raw_sources)
            )
            base = raw_sources if raw_sources is not None else ["bts"]
            sources = _dedupe_sources(base)
            if not is_wiki_only and "bts" not in sources:
                sources.insert(0, "bts")
            if "wikipedia" not in sources:
                sources.append("wikipedia")
            route["sources"] = sources
            existing_confirmed += 1
            continue

        # New / unreported route: build a fresh entry from OurAirports metadata.
        info = airport_lookup.get(dest_iata)
        if not info or pd.isna(info.get("lat")) or pd.isna(info.get("lon")):
            new_dests_skipped_no_coords += 1
            continue

        # One airline entry per distinct Wikipedia airline name.
        airline_names = []
        for rec in recs:
            name = rec["airline"]
            if name and name not in airline_names:
                airline_names.append(name)
        airlines = [
            {"code": "", "name": name, "weekly_flights": 0, "annual_passengers": 0}
            for name in airline_names
        ]

        dest_lat = round(info["lat"], 4)
        dest_lon = round(info["lon"], 4)
        distance = None
        if origin_lat is not None and origin_lon is not None:
            import process_data
            distance = process_data.haversine_miles(
                origin_lat, origin_lon, info["lat"], info["lon"]
            )

        new_route = {
            "destination": {
                "iata": dest_iata,
                "name": info["name"],
                "city": str(info["city"]) if pd.notna(info.get("city")) else dest_iata,
                "region": str(info["region_label"]) if pd.notna(info.get("region_label")) else "",
                "lat": dest_lat,
                "lon": dest_lon,
            },
            "airlines": airlines,
            "distance_miles": distance if distance is not None else 0,
            "total_annual_passengers": 0,
            "sources": ["wikipedia"],
            "seasonal": bool(seasonal_all),
        }
        # Attach a note if any record carries one.
        note = next((rec["note"] for rec in recs if rec.get("note")), None)
        if note:
            new_route["note"] = note

        routes.append(new_route)
        existing_by_iata[dest_iata] = new_route
        new_routes_added += 1

    # Keep routes sorted by volume desc (new wiki-only routes at 0 sort last).
    routes.sort(key=lambda r: r.get("total_annual_passengers", 0), reverse=True)
    data["routes"] = routes
    data["wikipedia_updated"] = today

    path.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")

    return {
        "existing_confirmed": existing_confirmed,
        "new_routes_added": new_routes_added,
        "new_dests_skipped_no_coords": new_dests_skipped_no_coords,
    }


# ---------------------------------------------------------------------------
# Orchestration with loud failure
# ---------------------------------------------------------------------------

def _discover_target_airports() -> list[str]:
    """Default target set: every airport with a public/data/routes/*.json file."""
    if not _ROUTES_DIR.exists():
        return []
    return sorted(p.stem.upper() for p in _ROUTES_DIR.glob("*.json"))


def _parse_cli_args(argv: list[str]) -> tuple[list[str] | None, int | None]:
    """Parse --airports and --limit from argv. Returns (airports, limit)."""
    airports = None
    limit = None
    i = 0
    while i < len(argv):
        arg = argv[i]
        if arg == "--airports":
            i += 1
            if i < len(argv):
                airports = [a.strip().upper() for a in argv[i].split(",") if a.strip()]
        elif arg.startswith("--airports="):
            airports = [a.strip().upper() for a in arg.split("=", 1)[1].split(",") if a.strip()]
        elif arg == "--limit":
            i += 1
            if i < len(argv):
                limit = int(argv[i])
        elif arg.startswith("--limit="):
            limit = int(arg.split("=", 1)[1])
        i += 1
    return airports, limit


def main(argv: list[str] | None = None) -> int:
    import requests

    argv = list(sys.argv[1:]) if argv is None else argv
    cli_airports, limit = _parse_cli_args(argv)

    # Target selection: --airports > WIKI_AIRPORTS env > all route files.
    if cli_airports:
        targets = cli_airports
    elif os.environ.get("WIKI_AIRPORTS"):
        targets = [a.strip().upper() for a in os.environ["WIKI_AIRPORTS"].split(",") if a.strip()]
    else:
        targets = _discover_target_airports()

    if limit is not None:
        targets = targets[:limit]

    if cli_airports or os.environ.get("WIKI_AIRPORTS") or limit is not None:
        print(f"LIMITED RUN: only {len(targets)} airports ({', '.join(targets[:20])}"
              f"{'...' if len(targets) > 20 else ''})")

    if not targets:
        print("ERROR: no target airports found (no route files?).", file=sys.stderr)
        return 1

    print(f"Building IATA <-> Wikipedia title maps and airport lookup...")
    iata_to_title, title_to_iata = build_title_maps()
    airport_lookup = build_airport_lookup()
    print(f"  {len(iata_to_title)} airports with Wikipedia links; "
          f"{len(title_to_iata)} normalized titles.")

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})
    today = date.today().isoformat()

    # Tallies.
    attempted = 0
    fetched_ok = 0
    no_section = 0
    fetch_failed = 0
    parse_empty = 0
    no_route_file = 0
    total_resolved = 0
    total_new_routes = 0
    total_existing_confirmed = 0
    total_skipped_no_coords = 0
    unresolved_counter: Counter[str] = Counter()

    n = len(targets)

    # ----- Pass 1: fetch + parse, store parsed routes, accumulate the set of
    # distinct destination titles that don't already resolve. Each airport's
    # wikitext is fetched exactly once here. -----
    parsed_by_iata: dict[str, list[ParsedRoute]] = {}
    unresolved_titles: set[str] = set()  # raw titles not in title_to_iata yet

    for idx, iata in enumerate(targets, 1):
        attempted += 1
        title = iata_to_title.get(iata)
        if not title:
            # No Wikipedia article known for this IATA; nothing to fetch.
            no_section += 1
            continue
        try:
            section = fetch_airport_section(title, session)
        except FetchFailed as e:
            fetch_failed += 1
            print(f"[{idx}/{n}] {iata} ({title}): FETCH FAILED - {e}", file=sys.stderr)
            time.sleep(POLITE_SLEEP)
            continue
        except Exception as e:  # never let one airport kill the run
            fetch_failed += 1
            print(f"[{idx}/{n}] {iata} ({title}): unexpected error - {e}", file=sys.stderr)
            time.sleep(POLITE_SLEEP)
            continue

        if section is None:
            no_section += 1
            time.sleep(POLITE_SLEEP)
            continue

        fetched_ok += 1

        try:
            parsed = parse_destination_list(section)
        except Exception as e:  # resilient per-airport
            print(f"[{idx}/{n}] {iata}: parse error - {e}", file=sys.stderr)
            time.sleep(POLITE_SLEEP)
            continue

        if not parsed:
            parse_empty += 1
            time.sleep(POLITE_SLEEP)
            continue

        parsed_by_iata[iata] = parsed
        for pr in parsed:
            if normalize_title(pr.dest_title) not in title_to_iata:
                unresolved_titles.add(pr.dest_title)

        time.sleep(POLITE_SLEEP)

    # ----- Redirect pass: resolve the unresolved titles via the MediaWiki API
    # (follow redirects/normalizations to canonical titles) and AUGMENT the
    # title_to_iata map with whatever newly resolves. -----
    if unresolved_titles:
        print(f"\nResolving {len(unresolved_titles)} unresolved destination "
              f"titles via Wikipedia redirects...")
        try:
            recovered = resolve_redirects(unresolved_titles, session, title_to_iata)
        except Exception as e:  # never let the redirect pass kill the run
            print(f"  [redirects] pass failed: {e}", file=sys.stderr)
            recovered = {}
        # Merge recovered {normalized_title: iata} into the lookup map.
        for norm_title, dest_iata in recovered.items():
            title_to_iata.setdefault(norm_title, dest_iata)
        print(f"  recovered {len(recovered)} titles via redirect resolution.")

    # ----- Pass 2: resolve (against the augmented map) + merge. No fetching. ---
    for idx, iata in enumerate(targets, 1):
        parsed = parsed_by_iata.get(iata)
        if not parsed:
            continue
        try:
            resolved, unresolved = resolve_destinations(parsed, iata, title_to_iata)
            unresolved_counter.update(unresolved)
            total_resolved += len(resolved)

            stats = merge_wikipedia(iata, resolved, airport_lookup, today)
            if stats is None:
                no_route_file += 1
            else:
                total_new_routes += stats["new_routes_added"]
                total_existing_confirmed += stats["existing_confirmed"]
                total_skipped_no_coords += stats["new_dests_skipped_no_coords"]
                if stats["new_routes_added"] or stats["existing_confirmed"]:
                    print(f"[{idx}/{n}] {iata}: {len(resolved)} resolved, "
                          f"+{stats['new_routes_added']} new, "
                          f"{stats['existing_confirmed']} confirmed")
        except Exception as e:  # resilient per-airport
            print(f"[{idx}/{n}] {iata}: processing error - {e}", file=sys.stderr)

    # ----- Summary -----
    top_unresolved = unresolved_counter.most_common(15)
    summary = {
        "airports_attempted": attempted,
        "fetched_ok": fetched_ok,
        "no_section": no_section,
        "fetch_failed": fetch_failed,
        "parse_empty": parse_empty,
        "no_route_file": no_route_file,
        "total_resolved_routes": total_resolved,
        "total_new_routes_added": total_new_routes,
        "total_existing_confirmed": total_existing_confirmed,
        "total_dests_skipped_no_coords": total_skipped_no_coords,
        "top_unresolved_titles": top_unresolved,
        "generated": today,
    }

    print("\n" + "=" * 60)
    print("WIKIPEDIA ROUTE REFRESH SUMMARY")
    print("=" * 60)
    print(f"Airports attempted : {attempted}")
    print(f"  fetched ok       : {fetched_ok}")
    print(f"  no section/page  : {no_section}")
    print(f"  fetch failed     : {fetch_failed}")
    print(f"  parsed empty     : {parse_empty}")
    print(f"  no route file    : {no_route_file}")
    print(f"Total resolved routes        : {total_resolved}")
    print(f"Total new routes added       : {total_new_routes}")
    print(f"Total existing confirmed     : {total_existing_confirmed}")
    print(f"Dests skipped (no coords)    : {total_skipped_no_coords}")
    if top_unresolved:
        print("\nTop unresolved destination titles (improve coverage):")
        for title, count in top_unresolved:
            print(f"  {count:>4}x  {title}")
    print("=" * 60)

    try:
        _REPORT_PATH.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    except OSError as e:
        print(f"WARNING: could not write report: {e}", file=sys.stderr)

    # ----- Loud failure on systemic problems -----
    if fetched_ok == 0:
        print("FAILURE: zero airports fetched successfully.", file=sys.stderr)
        return 1
    if attempted > 0 and fetch_failed > attempted * 0.5:
        print(f"FAILURE: {fetch_failed}/{attempted} airports failed to fetch (>50%).",
              file=sys.stderr)
        return 1
    if total_resolved == 0:
        print("FAILURE: zero routes resolved across the whole run.", file=sys.stderr)
        return 1

    print("OK: run completed successfully.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
