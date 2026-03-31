/** Haversine distance in metres between two lat/lng points */
export function haverDist(la1, ln1, la2, ln2) {
  const R = 6371000, r = Math.PI / 180;
  const dLa = (la2 - la1) * r, dLn = (ln2 - ln1) * r;
  return 2 * R * Math.asin(
    Math.sqrt(Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLn / 2) ** 2)
  );
}

/** Return nearest station in list to given lat/lng */
export function nearestOf(list, lat, lng) {
  let best = list[0], minD = Infinity;
  list.forEach(s => {
    const d = Math.hypot(s.lat - lat, s.lng - lng);
    if (d < minD) { minD = d; best = s; }
  });
  return best;
}
