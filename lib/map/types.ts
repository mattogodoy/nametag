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
  /** State/Province (address region), null for GEO locations */
  region: string | null;
  /** Full address as a single line for the marker popup; null for GEO locations */
  addressText: string | null;
  country: string | null;
  groupIds: string[];
  /** Whether the contact has a photo, used to render a photo thumbnail marker instead of a dot */
  hasPhoto: boolean;
  /** First group's color (in returned order), like the network graph; null falls back to the default dot color */
  groupColor: string | null;
}

export interface MapGroup {
  id: string;
  name: string;
  color: string | null;
}

/** A contact with at least one address the geocoder could not locate */
export interface UnlocatedPerson {
  personId: string;
  personName: string;
  failedCount: number;
}

export interface MapMarkersResponse {
  markers: MapMarker[];
  groups: MapGroup[];
  pendingCount: number;
  failedCount: number;
  /** Contacts with failed addresses, name-sorted, for the map's unlocated drawer */
  unlocatedPeople: UnlocatedPerson[];
  /** The user's geocoding privacy toggle, used by the map's empty state */
  geocodingEnabled: boolean;
}
