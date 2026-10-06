/** Great-circle distance in miles (haversine). Used only on the phone to sort nearby stores. */
export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Sorts places by distance from `here` when given (places without coordinates go last,
 * in county order); otherwise by county, then city, then name.
 */
export function sortPlaces<T extends { lat: number | null; lng: number | null; county: string; city: string; name: string }>(
  places: readonly T[],
  here: { lat: number; lng: number } | null,
): { place: T; miles: number | null }[] {
  const byCounty = (a: T, b: T) =>
    a.county.localeCompare(b.county) || a.city.localeCompare(b.city) || a.name.localeCompare(b.name);
  const rows = places.map((place) => ({
    place,
    miles: here && place.lat !== null && place.lng !== null ? milesBetween(here, { lat: place.lat, lng: place.lng }) : null,
  }));
  return rows.sort((a, b) => {
    if (a.miles !== null && b.miles !== null) return a.miles - b.miles;
    if (a.miles !== null) return -1;
    if (b.miles !== null) return 1;
    return byCounty(a.place, b.place);
  });
}
