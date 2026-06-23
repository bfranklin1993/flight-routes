"""
Tests for the Wikipedia "Airlines and destinations" parser.

Run from repo root:
    python -m pytest scripts/tests/ -q
"""

import sys
from pathlib import Path

import pytest

# Make scripts/ importable so `import wikipedia_routes` works from repo root.
SCRIPTS_DIR = Path(__file__).resolve().parent.parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from wikipedia_routes import ParsedRoute, parse_destination_list  # noqa: E402

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


def load_fixture(name: str) -> str:
    return (FIXTURES_DIR / name).read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def ord_routes() -> list[ParsedRoute]:
    return parse_destination_list(load_fixture("ord_section.wikitext"))


@pytest.fixture(scope="module")
def boi_routes() -> list[ParsedRoute]:
    return parse_destination_list(load_fixture("boi_section.wikitext"))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def dests_for(routes, airline):
    return [r for r in routes if r.airline == airline]


def titles_for(routes, airline):
    return {r.dest_title for r in dests_for(routes, airline)}


def find(routes, airline, dest_title):
    matches = [
        r for r in routes if r.airline == airline and r.dest_title == dest_title
    ]
    return matches[0] if matches else None


# ---------------------------------------------------------------------------
# BOI fixture — small domestic
# ---------------------------------------------------------------------------

def test_boi_parses_some_routes(boi_routes):
    assert len(boi_routes) > 10


def test_boi_alaska_destinations(boi_routes):
    titles = titles_for(boi_routes, "Alaska Airlines")
    assert "Hollywood Burbank Airport" in titles
    assert "Harry Reid International Airport" in titles
    assert "Los Angeles International Airport" in titles
    assert "San Francisco International Airport" in titles
    assert "Seattle–Tacoma International Airport" in titles


def test_boi_alaska_seasonal_split(boi_routes):
    # Year-round before the divider
    lax = find(boi_routes, "Alaska Airlines", "Los Angeles International Airport")
    assert lax is not None
    assert lax.seasonal is False
    # After '''Seasonal:''' divider
    anchorage = find(
        boi_routes, "Alaska Airlines", "Ted Stevens Anchorage International Airport"
    )
    assert anchorage is not None
    assert anchorage.seasonal is True


def test_boi_note_extraction(boi_routes):
    # Frontier -> Las Vegas (begins September 10, 2026)
    lv = find(boi_routes, "Frontier Airlines", "Harry Reid International Airport")
    assert lv is not None
    assert lv.note is not None
    assert "begins" in lv.note.lower()
    assert "September 10, 2026" in lv.note
    # The note must not leak into the title
    assert "begins" not in lv.dest_title.lower()
    assert "(" not in lv.dest_title


def test_boi_no_ref_leakage(boi_routes):
    bad = ("cite", "ref", "http", "access-date", "accessdate", "{{", "}}", "<")
    for r in boi_routes:
        for field in (r.airline, r.dest_title):
            low = field.lower()
            for token in bad:
                assert token not in low, f"{token!r} leaked into {field!r}"


# ---------------------------------------------------------------------------
# ORD fixture — large international, refs, seasonal, cargo
# ---------------------------------------------------------------------------

def test_ord_many_routes(ord_routes):
    assert len(ord_routes) > 50


def test_ord_aer_lingus(ord_routes):
    titles = titles_for(ord_routes, "Aer Lingus")
    assert titles == {"Dublin Airport"}


def test_ord_aeromexico_seasonal(ord_routes):
    mex = find(ord_routes, "Aeroméxico", "Mexico City International Airport")
    assert mex is not None
    assert mex.seasonal is False
    gdl = find(ord_routes, "Aeroméxico", "Guadalajara International Airport")
    assert gdl is not None
    assert gdl.seasonal is True


def test_ord_no_ref_leakage(ord_routes):
    bad = ("cite", "ref", "http", "access-date", "accessdate", "{{", "}}", "<")
    for r in ord_routes:
        for field in (r.airline, r.dest_title):
            low = field.lower()
            for token in bad:
                assert token not in low, f"{token!r} leaked into {field!r}"


def test_ord_excludes_cargo(ord_routes):
    # Cargo-only airlines must not appear.
    airlines = {r.airline for r in ord_routes}
    assert "AirBridgeCargo" not in airlines
    assert "Atlas Air" not in airlines
    assert "Turkish Cargo" not in airlines
    # And no cargo-only destination such as Luxembourg via AirBridgeCargo
    for r in ord_routes:
        assert "Cargo" not in r.airline


def test_ord_dest_titles_clean(ord_routes):
    # Spot-check a known left-side title with an em-dash.
    titles = titles_for(ord_routes, "Air Canada")
    assert "Montréal–Trudeau International Airport" in titles
    assert "Toronto Pearson International Airport" in titles
    assert "Vancouver International Airport" in titles


# ---------------------------------------------------------------------------
# Edge cases — small inline wikitext
# ---------------------------------------------------------------------------

def test_bare_wikilink_no_pipe():
    wt = """===Passenger===
{{Airport destination list
| [[Test Air]] | [[Dublin Airport]]
}}"""
    routes = parse_destination_list(wt)
    assert len(routes) == 1
    assert routes[0].airline == "Test Air"
    assert routes[0].dest_title == "Dublin Airport"
    assert routes[0].seasonal is False
    assert routes[0].note is None


def test_self_closing_ref_stripped():
    wt = """===Passenger===
{{Airport destination list
| [[Test Air]] | [[Dublin Airport|Dublin]]<ref name="x"/>
}}"""
    routes = parse_destination_list(wt)
    assert len(routes) == 1
    assert routes[0].dest_title == "Dublin Airport"


def test_seasonal_divider():
    wt = """===Passenger===
{{Airport destination list
| [[Test Air]] | [[A Airport|A]], [[B Airport|B]] <br /> '''Seasonal:''' [[C Airport|C]]
}}"""
    routes = parse_destination_list(wt)
    by_title = {r.dest_title: r for r in routes}
    assert by_title["A Airport"].seasonal is False
    assert by_title["B Airport"].seasonal is False
    assert by_title["C Airport"].seasonal is True


def test_seasonal_variant_divider():
    # '''Seasonal''': (colon outside the bold) should also work.
    wt = """===Passenger===
{{Airport destination list
| [[Test Air]] | [[A Airport|A]] <br /> '''Seasonal''': [[C Airport|C]]
}}"""
    routes = parse_destination_list(wt)
    by_title = {r.dest_title: r for r in routes}
    assert by_title["A Airport"].seasonal is False
    assert by_title["C Airport"].seasonal is True


def test_begins_note_extraction():
    wt = """===Passenger===
{{Airport destination list
| [[Test Air]] | [[A Airport|A]] (begins October 23, 2026)
}}"""
    routes = parse_destination_list(wt)
    assert len(routes) == 1
    assert routes[0].dest_title == "A Airport"
    assert routes[0].note is not None
    assert "begins October 23, 2026" in routes[0].note


def test_cargo_subsection_excluded():
    wt = """===Passenger===
{{Airport destination list
| [[Pax Air]] | [[A Airport|A]]
}}

===Cargo===
{{Airport destination list
| [[Cargo Air]] | [[B Airport|B]]
}}"""
    routes = parse_destination_list(wt)
    airlines = {r.airline for r in routes}
    assert "Pax Air" in airlines
    assert "Cargo Air" not in airlines


def test_pipe_inside_cite_does_not_break_split():
    wt = """===Passenger===
{{Airport destination list
| [[Test Air]] | [[A Airport|A]]<ref>{{cite web|url=http://x.com|title=Hi|date=2020}}</ref>, [[B Airport|B]]
}}"""
    routes = parse_destination_list(wt)
    titles = {r.dest_title for r in routes}
    assert titles == {"A Airport", "B Airport"}


def test_html_comment_stripped():
    wt = """===Passenger===
{{Airport destination list
<!-- some editor note with | pipes | inside -->
| [[Test Air]] | [[A Airport|A]]
}}"""
    routes = parse_destination_list(wt)
    assert len(routes) == 1
    assert routes[0].airline == "Test Air"
    assert routes[0].dest_title == "A Airport"


def test_malformed_row_skipped():
    wt = """===Passenger===
{{Airport destination list
| [[Good Air]] | [[A Airport|A]]
| this row has no destinations
| [[Other Air]] | [[B Airport|B]]
}}"""
    routes = parse_destination_list(wt)
    airlines = {r.airline for r in routes}
    assert "Good Air" in airlines
    assert "Other Air" in airlines


def test_charter_divider():
    wt = """===Passenger===
{{Airport destination list
| [[Test Air]] | [[A Airport|A]] <br /> '''Charter:''' [[C Airport|C]]
}}"""
    routes = parse_destination_list(wt)
    by_title = {r.dest_title: r for r in routes}
    assert by_title["A Airport"].note is None
    assert by_title["C Airport"].note == "charter"


def test_nowrap_template_in_airline():
    wt = """===Passenger===
{{Airport destination list
| {{nowrap|[[Southwest Airlines]]}} | [[A Airport|A]]
}}"""
    routes = parse_destination_list(wt)
    assert len(routes) == 1
    assert routes[0].airline == "Southwest Airlines"
    assert routes[0].dest_title == "A Airport"


def test_underscore_and_whitespace_normalized():
    wt = """===Passenger===
{{Airport destination list
| [[Test Air]] | [[Some_Airport|X]], [[Other   Airport|Y]]
}}"""
    routes = parse_destination_list(wt)
    titles = {r.dest_title for r in routes}
    assert "Some Airport" in titles
    assert "Other Airport" in titles


def test_empty_input_returns_empty():
    assert parse_destination_list("") == []
    assert parse_destination_list("no template here at all") == []


# ---------------------------------------------------------------------------
# Raw wikitable fallback (no {{Airport destination list}} template)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def wikitable_routes() -> list[ParsedRoute]:
    return parse_destination_list(load_fixture("xxx_wikitable_section.wikitext"))


def test_wikitable_fallback_basic(wikitable_routes):
    titles = titles_for(wikitable_routes, "Alaska Airlines")
    assert "Seattle–Tacoma International Airport" in titles
    assert "Portland International Airport" in titles


def test_wikitable_fallback_seasonal(wikitable_routes):
    anchorage = find(
        wikitable_routes,
        "Alaska Airlines",
        "Ted Stevens Anchorage International Airport",
    )
    assert anchorage is not None
    assert anchorage.seasonal is True


def test_wikitable_fallback_note(wikitable_routes):
    atl = find(
        wikitable_routes,
        "Delta Air Lines",
        "Hartsfield–Jackson Atlanta International Airport",
    )
    assert atl is not None
    assert atl.note is not None
    assert "begins March 1, 2027" in atl.note


def test_wikitable_fallback_excludes_cargo(wikitable_routes):
    airlines = {r.airline for r in wikitable_routes}
    assert "FedEx Express" not in airlines


def test_wikitable_fallback_no_ref_leakage(wikitable_routes):
    bad = ("cite", "ref", "http", "access-date", "accessdate", "{{", "}}", "<")
    for r in wikitable_routes:
        for field in (r.airline, r.dest_title):
            low = field.lower()
            for token in bad:
                assert token not in low, f"{token!r} leaked into {field!r}"
