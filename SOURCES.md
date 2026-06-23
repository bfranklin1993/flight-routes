# Data Sources

nonstoproutes.com combines several public data sources. Each route file under
`public/data/routes/` records its provenance in a `sources` array (e.g.
`["bts"]`, `["bts","wikipedia"]`, or `["wikipedia"]`).

## BTS T-100 (passenger volumes and frequencies)

U.S. Bureau of Transportation Statistics, Air Carrier Statistics (Form 41
Traffic), T-100 Domestic and International Segment data. Annual passenger
counts and flight frequencies are derived from this dataset.

- Source: https://www.transtats.bts.gov
- Status: U.S. Government work, public domain.

## OurAirports (airport metadata)

Airport names, cities, regions, coordinates, and Wikipedia article links.

- Source: https://ourairports.com / https://github.com/davidmegginson/ourairports-data
- License: Released into the public domain (CC0 / dedicated to the public domain).

## Wikipedia (route presence)

The presence of nonstop routes (which airlines fly where), including some
routes not yet reflected in BTS volume data, is extracted from the "Airlines
and destinations" section of English Wikipedia airport articles. We extract
factual route-presence data into our own data structures; we do not reproduce
Wikipedia article text.

- Source: https://en.wikipedia.org
- License: Wikipedia text is available under Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0). Wikipedia and its contributors are credited here as the source of route-presence facts.
