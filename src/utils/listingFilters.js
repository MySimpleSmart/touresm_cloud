const parseId = (value) => {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const extractIdsFromSource = (source) => {
  if (!source) return [];

  if (Array.isArray(source)) {
    return source
      .map((item) => {
        if (typeof item === 'number') return item;
        if (typeof item === 'string') return parseId(item);
        if (item && (item.id || item.term_id)) return parseId(item.id || item.term_id);
        return null;
      })
      .filter((id) => id !== null);
  }

  if (typeof source === 'number') return [source];
  if (typeof source === 'string') {
    const parsed = parseId(source);
    return parsed !== null ? [parsed] : [];
  }

  if (source && (source.id || source.term_id)) {
    const parsed = parseId(source.id || source.term_id);
    return parsed !== null ? [parsed] : [];
  }

  return [];
};

export const extractListingLocations = (listing) => {
  const meta = listing?.meta || {};
  const sources = [
    listing?.listing_location,
    meta?.listing_location,
    listing?.listing_region,
    meta?.listing_region,
  ];

  const ids = new Set();
  sources.forEach((source) => {
    extractIdsFromSource(source).forEach((id) => ids.add(id));
  });
  return Array.from(ids);
};

export const extractListingCategories = (listing) => {
  const meta = listing?.meta || {};
  const sources = [listing?.listing_category, meta?.listing_category];
  const ids = new Set();
  sources.forEach((source) => {
    extractIdsFromSource(source).forEach((id) => ids.add(id));
  });
  return Array.from(ids);
};

export const extractListingAmenities = (listing) => {
  const meta = listing?.meta || {};
  const sources = [
    listing?.listing_aminity,
    listing?.listing_aminities,
    meta?.listing_aminity,
    meta?.listing_aminities,
  ];
  const ids = new Set();
  sources.forEach((source) => {
    extractIdsFromSource(source).forEach((id) => ids.add(id));
  });
  return Array.from(ids);
};

export const buildLocationLookup = (locations = []) => {
  const map = new Map();

  const getDescendants = (locId, visited = new Set()) => {
    if (map.has(locId)) return map.get(locId);
    const descendants = new Set([locId]);
    const children = locations.filter((loc) => {
      const parentId = parseId(loc.parent || loc.parent_id || loc.parent_term_id);
      return parentId === locId;
    });

    children.forEach((child) => {
      const childId = parseId(child.id || child.term_id);
      if (!childId || visited.has(childId)) return;
      visited.add(childId);
      const childDescendants = getDescendants(childId, visited);
      childDescendants.forEach((val) => descendants.add(val));
    });

    map.set(locId, descendants);
    return descendants;
  };

  locations.forEach((loc) => {
    const locId = parseId(loc.id || loc.term_id);
    if (!locId) return;
    getDescendants(locId);
  });

  return map;
};

export const matchesLocationFilter = (listing, selectedLocations, locations, lookup) => {
  if (!selectedLocations || (Array.isArray(selectedLocations) && selectedLocations.length === 0)) {
    return true;
  }

  const locationIds = Array.isArray(selectedLocations)
    ? selectedLocations.map(parseId).filter((id) => id !== null)
    : [parseId(selectedLocations)].filter((id) => id !== null);

  if (locationIds.length === 0) return true;

  const locationLookup = lookup || buildLocationLookup(locations);
  const listingLocationIds = extractListingLocations(listing);

  if (listingLocationIds.length === 0) return false;

  return locationIds.some((selectedId) => {
    if (selectedId === null) return false;
    const allowed = locationLookup.get(selectedId) || new Set([selectedId]);
    return listingLocationIds.some((locId) => allowed.has(locId));
  });
};

export const matchesCategoryFilter = (listing, selectedCategories) => {
  if (!selectedCategories || selectedCategories.length === 0) return true;
  const listingCategories = extractListingCategories(listing);
  if (listingCategories.length === 0) return false;

  const selectedIds = selectedCategories.map(parseId).filter((id) => id !== null);
  if (selectedIds.length === 0) return true;

  return listingCategories.some((id) => selectedIds.includes(id));
};

export const matchesAmenitiesFilter = (listing, selectedAmenities) => {
  if (!selectedAmenities || selectedAmenities.length === 0) return true;
  const listingAmenities = extractListingAmenities(listing);
  if (listingAmenities.length === 0) return false;

  const selectedIds = selectedAmenities.map(parseId).filter((id) => id !== null);
  if (selectedIds.length === 0) return true;

  return selectedIds.every((id) => listingAmenities.includes(id));
};

export const getListingNumericValue = (listing, keys = []) => {
  const meta = listing?.meta || {};
  for (const key of keys) {
    const directValue = listing?.[key];
    if (directValue != null) {
      const parsed = parseFloat(directValue);
      if (!Number.isNaN(parsed)) return parsed;
    }
    const metaValue = meta?.[key];
    if (metaValue != null) {
      const parsed = parseFloat(metaValue);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  return null;
};

export const isListingAvailableForRange = (listing, checkIn, checkOut) => {
  if (!checkIn || !checkOut) return true;
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return true;

  const meta = listing?.meta || {};
  const sources = [
    listing?.admin_blocked_days,
    meta?.admin_blocked_days,
    meta?.listing_admin_blocked_days,
    listing?.host_blocked_days,
    meta?.host_blocked_days,
    meta?.listing_host_blocked_days,
  ];

  const blocked = new Set();
  sources
    .filter(Boolean)
    .forEach((str) => {
      str
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean)
        .forEach((date) => blocked.add(date));
    });

  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const dateStr = date.toISOString().split('T')[0];
    if (blocked.has(dateStr)) {
      return false;
    }
  }

  return true;
};

