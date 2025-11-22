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

  // Normalize selected location IDs to numbers for consistent comparison
  const locationIds = Array.isArray(selectedLocations)
    ? selectedLocations.map(parseId).filter((id) => id !== null)
    : [parseId(selectedLocations)].filter((id) => id !== null);

  if (locationIds.length === 0) return true;

  const locationLookup = lookup || buildLocationLookup(locations);
  const listingLocationIdsRaw = extractListingLocations(listing);
  
  // Normalize listing location IDs to numbers for consistent comparison
  const listingLocationIds = listingLocationIdsRaw.map(parseId).filter((id) => id !== null);

  if (listingLocationIds.length === 0) return false;

  // Build a set of parent IDs that have explicitly selected children
  // This helps us know when to exclude children from parent matching
  const parentsWithExplicitChildren = new Set();
  const selectedIdsSet = new Set(locationIds);
  const selectedParents = new Set();
  
  // First pass: identify which parents have explicitly selected children, and which are parents
  locations.forEach((loc) => {
    const childId = parseId(loc.id || loc.term_id);
    const parentId = parseId(loc.parent || loc.parent_id || loc.parent_term_id);
    
    // If this location is a parent (no parent_id), mark it
    if (childId !== null && (parentId === null || parentId === 0)) {
      if (selectedIdsSet.has(childId)) {
        selectedParents.add(childId);
      }
    }
    
    // If a child is explicitly selected, mark its parent as having explicit children
    if (childId !== null && parentId !== null && parentId !== 0 && selectedIdsSet.has(childId)) {
      parentsWithExplicitChildren.add(parentId);
    }
  });

  // Convert listing location IDs to Set for efficient lookup
  const listingLocationIdsSet = new Set(listingLocationIds);

  // Check if listing matches any selected location
  // For each selected location, check if the listing matches
  for (const selectedId of locationIds) {
    if (selectedId === null) continue;
    
    // Check if this selectedId is a parent location
    const isParent = selectedParents.has(selectedId);
    const hasExplicitChildren = parentsWithExplicitChildren.has(selectedId);
    
    // Special handling: if this is a parent location AND has explicitly selected children,
    // only match listings directly assigned to the parent (exclude all children)
    // This prevents parent from overriding child constraint when both are selected
    if (isParent && hasExplicitChildren) {
      // Only match listings directly assigned to this parent, not its children
      if (listingLocationIdsSet.has(selectedId)) {
        return true;
      }
      continue;
    }
    
    // Normal case: use location lookup (includes descendants for parents, direct match for children/standalone locations)
    // If lookup exists, it includes all descendants for parents
    // If lookup doesn't exist, fall back to direct match (for locations not in the lookup)
    const allowed = locationLookup.get(selectedId);
    if (allowed) {
      // Check if any of the listing's locations match the allowed set (includes descendants for parents)
      for (const locId of listingLocationIds) {
        if (allowed.has(locId)) {
          return true;
        }
      }
    } else {
      // Fallback: direct match only (shouldn't happen if lookup is built correctly)
      if (listingLocationIdsSet.has(selectedId)) {
        return true;
      }
    }
  }
  
  return false;
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

