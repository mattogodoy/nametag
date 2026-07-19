// lib/map/types.ts

/** One plottable point: a geocoded address or a vCard GEO location. */
export interface MapMarker {
  /** "addr_<addressId>" or "loc_<locationId>", used by /map?focus= deep links */
  id: string;
  source: 'address' | 'location';
  personId: string;
  personName: string;
  latitude: number;
  longitude: number;
  /** Address/location type or label, e.g. "home" */
  label: string;
  city: string | null;
  country: string | null;
  groupIds: string[];
}

export interface MapGroup {
  id: string;
  name: string;
}

export interface MapMarkersResponse {
  markers: MapMarker[];
  groups: MapGroup[];
  pendingCount: number;
  failedCount: number;
  /** The user's geocoding privacy toggle, used by the map's empty state */
  geocodingEnabled: boolean;
}
