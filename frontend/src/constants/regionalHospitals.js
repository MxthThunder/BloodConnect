/**
 * Hospitals around Chennai shown as reference pins on the public map.
 *
 * Positions come from OpenStreetMap (c) OpenStreetMap contributors, ODbL, read on 29 Oct 2026 and rounded to about 10 m,
 * so treat them as approximate. `area` is the nearest named place in OpenStreetMap; `osm` is the object id, so an entry
 * can be checked at https://www.openstreetmap.org/<osm>.
 *
 * These are NOT stock-monitored blood banks: no stock, phone number or service is claimed for them.
 */
export const REGIONAL_HOSPITALS = [
  { name: 'Government Kilpauk Medical College Hospital', area: 'Kilpauk', lat: 13.0783, lng: 80.2438, osm: 'node/7252333314' },
  { name: 'Madras Medical Mission Hospital', area: 'Mogappair', lat: 13.0860, lng: 80.1871, osm: 'node/3702797921' },
  { name: 'Tiruvottiyur Government Hospital', area: 'Thiruvottiyur', lat: 13.1576, lng: 80.3013, osm: 'way/907941478' },
  { name: 'Government Hospital, Poonamallee', area: 'Poonamallee', lat: 13.0504, lng: 80.0995, osm: 'way/33630155' },
  { name: 'Sree Balaji Medical College and Hospital', area: 'Chromepet', lat: 12.9549, lng: 80.1382, osm: 'way/180145742' },
  { name: 'Government Hospital, Avadi', area: 'Avadi', lat: 13.1174, lng: 80.0979, osm: 'way/1567143411' },
  { name: 'Gleneagles Global Health City', area: 'Perumbakkam', lat: 12.8981, lng: 80.2062, osm: 'way/765605778' },
  { name: 'Saveetha Medical College Hospital', area: 'Thandalam', lat: 13.0246, lng: 80.0173, osm: 'node/7257421525' },
  { name: 'Chettinad Hospital', area: 'Kelambakkam', lat: 12.7972, lng: 80.2176, osm: 'node/6930405963' },
  { name: 'SRM Medical College Hospital and Research Centre', area: 'Potheri, Kattankulathur', lat: 12.8210, lng: 80.0480, osm: 'node/6934737010' },
  { name: 'District Government Hospital, Tiruvallur', area: 'Tiruvallur', lat: 13.1274, lng: 79.9109, osm: 'way/249317000' },
  { name: 'Chengalpattu Medical College Hospital', area: 'Chengalpattu', lat: 12.6759, lng: 79.9807, osm: 'way/1026902286' },
];

/** Rough box around Chennai and its surrounding districts. Anything outside it is not drawn on this map. */
export const CHENNAI_REGION_BOX = { south: 12.45, north: 13.5, west: 79.6, east: 80.45 };

export const isInChennaiRegion = (lat, lng) => (
  lat >= CHENNAI_REGION_BOX.south && lat <= CHENNAI_REGION_BOX.north
  && lng >= CHENNAI_REGION_BOX.west && lng <= CHENNAI_REGION_BOX.east
);
