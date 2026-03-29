/**
 * Generate points along a great circle arc between two coordinates.
 * Returns an array of [lng, lat] pairs for use with Mapbox GeoJSON.
 */
export function greatCircleArc(
  start: [number, number],
  end: [number, number],
  numPoints: number = 50
): [number, number][] {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const lat1 = toRad(start[1]);
  const lon1 = toRad(start[0]);
  const lat2 = toRad(end[1]);
  const lon2 = toRad(end[0]);

  const d = 2 * Math.asin(
    Math.sqrt(
      Math.sin((lat2 - lat1) / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2
    )
  );

  if (d === 0) return [start, end];

  const points: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    const lat = toDeg(Math.atan2(z, Math.sqrt(x ** 2 + y ** 2)));
    const lon = toDeg(Math.atan2(y, x));
    points.push([lon, lat]);
  }

  return points;
}
