import { useEffect, useMemo, useState } from 'react';
import {
  getListings,
  getCategories,
  getLocations,
  getAmenities,
} from '../services/api';
import ListingCard from './ListingCard';
import QuickSearch from './QuickSearch';
import {
  buildLocationLookup,
  matchesLocationFilter,
  matchesCategoryFilter,
  matchesAmenitiesFilter,
  isListingAvailableForRange,
  getListingNumericValue,
} from '../utils/listingFilters';

const PRICE_MIN = 0;
const PRICE_MAX = 1000000;
const PRICE_STEP = 10000;

const formatDateLabel = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date)) return dateStr;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
const AdvancedSearch = ({
  embedded = false,
  quickFilters,
  onClose,
  listingsSeed,
  taxonomySeed = {},
}) => {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [amenities, setAmenities] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    categories: [],
    locations: [],
    minPrice: 0,
    maxPrice: 1000000,
    minRooms: '',
    minBeds: '',
    minGuests: '',
    amenities: [],
    checkIn: '',
    checkOut: '',
  });
  const [isMobile, setIsMobile] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [showStickyFilter, setShowStickyFilter] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);

  const loadData = async () => {
    try {
      setLoading(true);
      const [listingsData, categoriesData, locationsData, amenitiesData] =
        await Promise.all([
          getListings({ per_page: 100 }),
          getCategories(),
          getLocations(),
          getAmenities(),
        ]);
      setListings(listingsData);
      setCategories(categoriesData);
      setLocations(locationsData);
      setAmenities(amenitiesData);
    } catch (error) {
      console.error('Error loading advanced search data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (embedded && listingsSeed) {
      setListings(listingsSeed);
      setCategories(taxonomySeed.categories || []);
      setLocations(taxonomySeed.locations || []);
      getAmenities()
        .then(setAmenities)
        .catch((err) => {
          console.error('Error fetching amenities:', err);
          setAmenities([]);
        })
        .finally(() => setLoading(false));
    } else {
      loadData();
    }
  }, [embedded, listingsSeed, taxonomySeed]);

  const locationLookup = useMemo(() => buildLocationLookup(locations), [locations]);

  const groupedLocations = useMemo(() => {
    const parents = [];
    const childrenMap = {};

    locations.forEach((loc) => {
      const parentId = loc.parent || loc.parent_id || loc.parent_term_id || 0;
      const normalizedParent = String(parentId);
      if (parentId && parentId !== 0 && parentId !== '0') {
        if (!childrenMap[normalizedParent]) {
          childrenMap[normalizedParent] = [];
        }
        childrenMap[normalizedParent].push(loc);
      } else {
        parents.push(loc);
      }
    });

    return { parents, childrenMap };
  }, [locations]);

  useEffect(() => {
    if (!quickFilters) return;
    setFilters((prev) => ({
      ...prev,
      locations: quickFilters.locations || [],
      checkIn: quickFilters.checkIn || '',
      checkOut: quickFilters.checkOut || '',
      minGuests: quickFilters.minGuests || '',
      categories: quickFilters.categories || [],
    }));
  }, [quickFilters]);

  useEffect(() => {
    const updateIsMobile = () => {
      if (typeof window === 'undefined') return;
      setIsMobile(window.matchMedia('(max-width: 768px)').matches);
    };
    updateIsMobile();
    window.addEventListener('resize', updateIsMobile);
    return () => window.removeEventListener('resize', updateIsMobile);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setMobileFiltersOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (mobileFiltersOpen) {
      document.body.style.overflow = 'hidden';
      document.body.setAttribute('data-filter-modal-open', 'true');
    } else {
      document.body.style.overflow = '';
      document.body.removeAttribute('data-filter-modal-open');
    }
    return () => {
      document.body.style.overflow = '';
      document.body.removeAttribute('data-filter-modal-open');
    };
  }, [mobileFiltersOpen]);

  // Handle sticky filter button on scroll (mobile only)
  useEffect(() => {
    if (!isMobile) {
      setShowStickyFilter(false);
      return;
    }

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Show sticky filter when scrolled down past 100px
      if (currentScrollY > 100) {
        setShowStickyFilter(true);
      } else {
        setShowStickyFilter(false);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMobile, lastScrollY]);

  const filteredListings = useMemo(() => {
    return listings.filter((listing) => {
      if (filters.search) {
        const searchTarget =
          (listing?.title?.rendered ||
            listing?.title ||
            listing?.meta?.listing_name ||
            '')
            .toString()
            .toLowerCase();
        if (!searchTarget.includes(filters.search.toLowerCase())) {
          return false;
        }
      }

      if (!matchesCategoryFilter(listing, filters.categories)) {
        return false;
      }

      if (
        !matchesLocationFilter(
          listing,
          filters.locations,
          locations,
          locationLookup
        )
      ) {
        return false;
      }

      const price = getListingNumericValue(listing, ['listing_price', 'price']);
      if (
        filters.minPrice > PRICE_MIN &&
        (price === null || price < Number(filters.minPrice))
      ) {
        return false;
      }
      if (
        filters.maxPrice < PRICE_MAX &&
        (price === null || price > Number(filters.maxPrice))
      ) {
        return false;
      }

      const rooms = getListingNumericValue(listing, [
        'room_number',
        'listing_room_number',
        'rooms',
      ]);
      if (filters.minRooms && (rooms === null || rooms < Number(filters.minRooms))) {
        return false;
      }

      const beds = getListingNumericValue(listing, [
        'listing_bed_number',
        'beds',
      ]);
      if (filters.minBeds && (beds === null || beds < Number(filters.minBeds))) {
        return false;
      }

      const guests = getListingNumericValue(listing, [
        'guest_max_number',
        'guests',
        'listing_guest_max_number',
      ]);
      if (filters.minGuests && filters.minGuests !== '') {
        const minGuestsNum = Number(filters.minGuests);
        if (guests === null || guests < minGuestsNum) {
          return false;
        }
      }

      if (!matchesAmenitiesFilter(listing, filters.amenities)) {
        return false;
      }

      if (
        filters.checkIn &&
        filters.checkOut &&
        !isListingAvailableForRange(listing, filters.checkIn, filters.checkOut)
      ) {
        return false;
      }

      return true;
    });
  }, [listings, filters, locations, locationLookup]);

  const toggleFilterValue = (field, value) => {
    setFilters((prev) => {
      const existing = new Set(prev[field] || []);
      if (existing.has(value)) {
        existing.delete(value);
      } else {
        existing.add(value);
      }
      return {
        ...prev,
        [field]: Array.from(existing),
      };
    });
  };

  const handleInputChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleNumericInput = (field, value) => {
    if (value === '' || /^[0-9]*$/.test(value)) {
      handleInputChange(field, value);
    }
  };

  const clearFilters = () => {
    // Reset all filters to initial state
    const resetFilters = {
      search: '',
      categories: [],
      locations: [],
      minPrice: PRICE_MIN,
      maxPrice: PRICE_MAX,
      minRooms: '',
      minBeds: '',
      minGuests: '',
      amenities: [],
      checkIn: '',
      checkOut: '',
    };
    
    setFilters(resetFilters);
    
    // Clear URL parameters if present
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.search) {
        url.search = '';
        window.history.replaceState({}, '', url.toString());
      }
    }
    
    // If embedded, reload all listings to show everything (not just listingsSeed)
    if (embedded) {
      loadData();
    }
  };

  const renderCategoryFilters = () => (
    <div>
      <h4 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">
        Categories
      </h4>
      <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
        {categories.map((category) => (
          <label key={category.id} className="flex items-center space-x-3 text-gray-700 text-sm">
            <input
              type="checkbox"
              checked={filters.categories.includes(String(category.id))}
              onChange={() => toggleFilterValue('categories', String(category.id))}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span>{category.name}</span>
          </label>
        ))}
      </div>
    </div>
  );

  const renderLocationFilters = () => (
    <div>
      <h4 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">
        Locations
      </h4>
      <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
        {groupedLocations.parents.map((parent) => {
          const parentId = String(parent.id || parent.term_id);
          const children = groupedLocations.childrenMap[parentId] || [];
          return (
            <div key={parentId}>
              <label className="flex items-center space-x-3 text-gray-800 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={filters.locations.includes(parentId)}
                  onChange={() => handleLocationToggle(parentId)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span>{parent.name}</span>
              </label>
              {children.length > 0 && (
                <div className="ml-6 mt-2 space-y-2">
                  {children.map((child) => {
                    const childId = String(child.id || child.term_id);
                    return (
                      <label
                        key={childId}
                        className="flex items-center space-x-2 text-gray-600 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={filters.locations.includes(childId)}
                          onChange={() => handleLocationToggle(childId)}
                          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span>{child.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const groupedAmenities = useMemo(() => {
    const parents = [];
    const childrenMap = {};

    amenities.forEach((amenity) => {
      const parentId = amenity.parent || amenity.parent_id || amenity.parent_term_id || 0;
      const normalizedParent = String(parentId);
      if (parentId && parentId !== 0 && normalizedParent !== '0') {
        if (!childrenMap[normalizedParent]) {
          childrenMap[normalizedParent] = [];
        }
        childrenMap[normalizedParent].push(amenity);
      } else {
        parents.push(amenity);
      }
    });

    return { parents, childrenMap };
  }, [amenities]);

  const locationParentMap = useMemo(() => {
    const map = new Map();
    locations.forEach((loc) => {
      const childId = String(loc.id || loc.term_id);
      const parentId = loc.parent || loc.parent_id || loc.parent_term_id || 0;
      if (childId && parentId && parentId !== 0 && parentId !== '0') {
        map.set(childId, String(parentId));
      }
    });
    return map;
  }, [locations]);

  const amenityParentMap = useMemo(() => {
    const map = new Map();
    amenities.forEach((amenity) => {
      const childId = String(amenity.id || amenity.term_id);
      const parentId = amenity.parent || amenity.parent_id || amenity.parent_term_id || 0;
      if (childId && parentId && parentId !== 0 && parentId !== '0') {
        map.set(childId, String(parentId));
      }
    });
    return map;
  }, [amenities]);

  const getLocationDescendants = (id) => {
    const numericId = Number(id);
    if (Number.isNaN(numericId)) return [String(id)];
    const descendants = locationLookup.get(numericId);
    if (!descendants || descendants.size === 0) {
      return [String(id)];
    }
    return Array.from(descendants).map((val) => String(val));
  };

  const addLocationAncestors = (id, selectedSet) => {
    let parentId = locationParentMap.get(String(id));
    while (parentId) {
      selectedSet.add(parentId);
      parentId = locationParentMap.get(parentId);
    }
  };

  const pruneLocationAncestors = (id, selectedSet) => {
    let parentId = locationParentMap.get(String(id));
    while (parentId) {
      const childNodes = groupedLocations.childrenMap[parentId] || [];
      const hasSelectedChild = childNodes.some((child) => {
        const childId = String(child.id || child.term_id);
        return selectedSet.has(childId);
      });
      if (!hasSelectedChild) {
        selectedSet.delete(parentId);
        parentId = locationParentMap.get(parentId);
      } else {
        break;
      }
    }
  };

  const handleLocationToggle = (targetId) => {
    const normalizedId = String(targetId);
    setFilters((prev) => {
      const next = new Set(prev.locations || []);
      const descendants = getLocationDescendants(normalizedId);
      const isFullySelected = descendants.every((val) => next.has(val));

      if (isFullySelected) {
        descendants.forEach((val) => next.delete(val));
        pruneLocationAncestors(normalizedId, next);
      } else {
        descendants.forEach((val) => next.add(val));
        addLocationAncestors(normalizedId, next);
      }

      return {
        ...prev,
        locations: Array.from(next),
      };
    });
  };

  const handleQuickSearchFilters = (data) => {
    setFilters((prev) => {
      const guestsValue = data.guests != null ? Number(data.guests) : null;
      return {
        ...prev,
        locations: data.location ? [String(data.location)] : [],
        checkIn: data.checkIn || '',
        checkOut: data.checkOut || '',
        minGuests: guestsValue && guestsValue >= 1 ? String(guestsValue) : '',
      };
    });
  };

  const getAmenityDescendants = (id) => {
    const target = String(id);
    const stack = [target];
    const collected = new Set();

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || collected.has(current)) continue;
      collected.add(current);
      const children = groupedAmenities.childrenMap[current] || [];
      children.forEach((child) => {
        const childId = String(child.id || child.term_id);
        if (childId) stack.push(childId);
      });
    }

    return Array.from(collected);
  };

  const addAmenityAncestors = (id, selectedSet) => {
    let parentId = amenityParentMap.get(String(id));
    while (parentId) {
      selectedSet.add(parentId);
      parentId = amenityParentMap.get(parentId);
    }
  };

  const pruneAmenityAncestors = (id, selectedSet) => {
    let parentId = amenityParentMap.get(String(id));
    while (parentId) {
      const childNodes = groupedAmenities.childrenMap[parentId] || [];
      const hasSelectedChild = childNodes.some((child) => {
        const childId = String(child.id || child.term_id);
        return selectedSet.has(childId);
      });
      if (!hasSelectedChild) {
        selectedSet.delete(parentId);
        parentId = amenityParentMap.get(parentId);
      } else {
        break;
      }
    }
  };

  const handleAmenityToggle = (targetId) => {
    const normalizedId = String(targetId);
    setFilters((prev) => {
      const next = new Set(prev.amenities || []);
      const descendants = getAmenityDescendants(normalizedId);
      const isFullySelected = descendants.every((val) => next.has(val));

      if (isFullySelected) {
        descendants.forEach((val) => next.delete(val));
        pruneAmenityAncestors(normalizedId, next);
      } else {
        descendants.forEach((val) => next.add(val));
        addAmenityAncestors(normalizedId, next);
      }

      return {
        ...prev,
        amenities: Array.from(next),
      };
    });
  };

  const renderAmenityFilters = () => (
    <div>
      <h4 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">
        Amenities
      </h4>
      <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
        {groupedAmenities.parents.map((parent) => {
          const parentId = String(parent.id || parent.term_id);
          const children = groupedAmenities.childrenMap[parentId] || [];
          return (
            <div key={parentId}>
              <label className="flex items-center space-x-3 text-gray-800 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={filters.amenities.includes(parentId)}
                  onChange={() => handleAmenityToggle(parentId)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span>{parent.name}</span>
              </label>
              {children.length > 0 && (
                <div className="ml-6 mt-2 space-y-2">
                  {children.map((child) => {
                    const childId = String(child.id || child.term_id);
                    return (
                      <label
                        key={childId}
                        className="flex items-center space-x-2 text-gray-600 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={filters.amenities.includes(childId)}
                          onChange={() => handleAmenityToggle(childId)}
                          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span>{child.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderFilterForm = ({ hideClearAction = false } = {}) => (
    <div className="space-y-8">
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2 uppercase tracking-wide">
          Keyword
        </label>
        <input
          type="text"
          value={filters.search}
          onChange={(e) => handleInputChange('search', e.target.value)}
          placeholder="Search by listing name..."
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
        />
      </div>

      {renderCategoryFilters()}

      {renderLocationFilters()}

      <div>
        <label className="block text-sm font-semibold text-gray-900 uppercase tracking-wide">
          Price Range (₮)
        </label>
        <p className="text-base font-semibold text-gray-900 mt-1">
          ₮{Math.min(filters.minPrice, filters.maxPrice).toLocaleString()} – ₮
          {Math.max(filters.minPrice, filters.maxPrice).toLocaleString()}
        </p>
        <div className="mt-4 space-y-4">
          <div className="price-range-slider relative h-10 flex items-center">
            <div className="absolute inset-x-0 h-1 bg-gray-200 rounded-full" />
            <div
              className="absolute h-1 bg-primary-500 rounded-full"
              style={{
                left: `${sliderMinPercent}%`,
                right: `${100 - sliderMaxPercent}%`,
              }}
            />
            <input
              type="range"
              min={PRICE_MIN}
              max={PRICE_MAX}
              step={PRICE_STEP}
              value={Number(filters.minPrice)}
              onChange={(e) => handleMinPriceSlider(Number(e.target.value))}
              className="slider-thumb thumb-left"
              aria-label="Minimum price"
            />
            <input
              type="range"
              min={PRICE_MIN}
              max={PRICE_MAX}
              step={PRICE_STEP}
              value={Number(filters.maxPrice)}
              onChange={(e) => handleMaxPriceSlider(Number(e.target.value))}
              className="slider-thumb thumb-right"
              aria-label="Maximum price"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                Min
              </label>
              <input
                type="number"
                min={PRICE_MIN}
                max={filters.maxPrice}
                value={filters.minPrice}
                onChange={(e) =>
                  handleMinPriceSlider(e.target.value === '' ? PRICE_MIN : Number(e.target.value))
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                Max
              </label>
              <input
                type="number"
                min={filters.minPrice}
                max={PRICE_MAX}
                value={filters.maxPrice}
                onChange={(e) =>
                  handleMaxPriceSlider(e.target.value === '' ? PRICE_MAX : Number(e.target.value))
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-100"
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2">
          Date Range
        </label>
        <div className="grid grid-cols-2 gap-4">
          <input
            type="date"
            value={filters.checkIn}
            onChange={(e) => handleInputChange('checkIn', e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-100"
          />
          <input
            type="date"
            value={filters.checkOut}
            min={filters.checkIn || undefined}
            onChange={(e) => handleInputChange('checkOut', e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-100"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-900 mb-2 uppercase tracking-wide">
            Rooms
          </label>
          <input
            type="text"
            value={filters.minRooms}
            onChange={(e) => handleNumericInput('minRooms', e.target.value)}
            placeholder="Min"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-100"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-900 mb-2 uppercase tracking-wide">
            Beds
          </label>
          <input
            type="text"
            value={filters.minBeds}
            onChange={(e) => handleNumericInput('minBeds', e.target.value)}
            placeholder="Min"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-100"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-900 mb-2 uppercase tracking-wide">
            Guests
          </label>
          <input
            type="text"
            value={filters.minGuests}
            onChange={(e) => handleNumericInput('minGuests', e.target.value)}
            placeholder="Min"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-100"
          />
        </div>
      </div>

      {renderAmenityFilters()}

      {!hideClearAction && (
        <div className="pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={clearFilters}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-60"
            disabled={!hasActiveFilters}
          >
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );

  const hasActiveFilters =
    filters.search ||
    filters.categories.length > 0 ||
    filters.locations.length > 0 ||
    filters.minPrice > PRICE_MIN ||
    filters.maxPrice < PRICE_MAX ||
    filters.minRooms ||
    filters.minBeds ||
    filters.minGuests ||
    filters.amenities.length > 0 ||
    filters.checkIn ||
    filters.checkOut;

  const locationLabelMap = useMemo(() => {
    const map = new Map();
    locations.forEach((loc) => {
      map.set(String(loc.id || loc.term_id), loc);
    });
    return map;
  }, [locations]);

  const categoryLabelMap = useMemo(() => {
    const map = new Map();
    categories.forEach((cat) => map.set(String(cat.id || cat.term_id), cat.name));
    return map;
  }, [categories]);

  const amenityLabelMap = useMemo(() => {
    const map = new Map();
    amenities.forEach((amenity) => map.set(String(amenity.id || amenity.term_id), amenity.name));
    return map;
  }, [amenities]);

  const activeChips = [];
  if (filters.search) {
    activeChips.push(`Search: ${filters.search}`);
  }
  if (filters.locations.length) {
    const names = filters.locations
      .map((id) => locationLabelMap.get(String(id))?.name)
      .filter(Boolean);
    if (names.length) {
      activeChips.push(`Locations: ${names.join(', ')}`);
    }
  }
  if (filters.categories.length) {
    const names = filters.categories
      .map((id) => categoryLabelMap.get(String(id)))
      .filter(Boolean);
    if (names.length) {
      activeChips.push(`Categories: ${names.join(', ')}`);
    }
  }
  if (filters.minRooms) {
    activeChips.push(`Rooms ≥ ${filters.minRooms}`);
  }
  if (filters.minBeds) {
    activeChips.push(`Beds ≥ ${filters.minBeds}`);
  }
  if (filters.minGuests) {
    activeChips.push(`Guests ≥ ${filters.minGuests}`);
  }
  if (filters.amenities.length) {
    const names = filters.amenities
      .map((id) => amenityLabelMap.get(String(id)))
      .filter(Boolean);
    if (names.length) {
      activeChips.push(`Amenities: ${names.join(', ')}`);
    }
  }
  if (filters.minPrice > PRICE_MIN || filters.maxPrice < PRICE_MAX) {
    activeChips.push(
      `₮${filters.minPrice.toLocaleString()} - ₮${filters.maxPrice.toLocaleString()}`
    );
  }
  if (filters.checkIn && filters.checkOut) {
    activeChips.push(
      `Dates: ${formatDateLabel(filters.checkIn)} – ${formatDateLabel(filters.checkOut)}`
    );
  } else if (filters.checkIn) {
    activeChips.push(`From: ${formatDateLabel(filters.checkIn)}`);
  } else if (filters.checkOut) {
    activeChips.push(`Until: ${formatDateLabel(filters.checkOut)}`);
  }
  const appliedFiltersCount = activeChips.length;

  const handleMinPriceSlider = (value) => {
    const numeric = Math.max(PRICE_MIN, Math.min(Number(value), PRICE_MAX));
    setFilters((prev) => {
      const maxPrice =
        typeof prev.maxPrice === 'number' ? prev.maxPrice : Number(prev.maxPrice) || PRICE_MAX;
      const nextMin = Math.min(numeric, maxPrice);
      return { ...prev, minPrice: nextMin };
    });
  };

  const handleMaxPriceSlider = (value) => {
    const numeric = Math.max(PRICE_MIN, Math.min(Number(value), PRICE_MAX));
    setFilters((prev) => {
      const minPrice =
        typeof prev.minPrice === 'number' ? prev.minPrice : Number(prev.minPrice) || PRICE_MIN;
      const nextMax = Math.max(numeric, minPrice);
      return { ...prev, maxPrice: nextMax };
    });
  };

  const sliderMinPercent = ((filters.minPrice - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100;
  const sliderMaxPercent = ((filters.maxPrice - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100;

  return (
    <section
      className={`${
        embedded
          ? 'max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8'
          : 'max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-10'
      }`}
    >
      {!embedded && (
        <div className="mb-8">
          <QuickSearch locations={locations} onSearch={handleQuickSearchFilters} />
        </div>
      )}

      <div className="pb-8 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Advanced Search</h1>
            {!embedded && (
              <p className="text-gray-600">
                Use the filters to narrow down listings by location, category, price, and amenities.
              </p>
            )}
          </div>
          {embedded && (
            <button
              type="button"
              onClick={() => {
                clearFilters();
                if (onClose) onClose();
              }}
              className="hidden lg:inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {isMobile && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:border-gray-300"
          >
            <svg
              className="w-4 h-4 text-primary-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4h18M6 8h12M9 12h6m2 4H7"
              />
            </svg>
            Filters {appliedFiltersCount ? `(${appliedFiltersCount})` : ''}
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-semibold text-primary-600 underline-offset-2 hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8">
        {!isMobile && (
          <aside className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 h-fit">
            {renderFilterForm()}
          </aside>
        )}

        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500 uppercase tracking-wide font-semibold">
                Results
              </p>
              <h2 className="text-2xl font-bold text-gray-900">
                {loading ? 'Loading...' : `${filteredListings.length} listings`}
              </h2>
            </div>
          </div>

          {activeChips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeChips.map((chip, index) => (
                <span
                  key={`${chip}-${index}`}
                  className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-12 text-center">
              <p className="text-lg font-semibold text-gray-900 mb-2">No listings found</p>
              <p className="text-gray-500">
                Try adjusting your filters or clearing them to see more results.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  taxonomies={{ categories, locations }}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {isMobile && mobileFiltersOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileFiltersOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 bottom-0 top-4 bg-white rounded-t-3xl shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Filters</p>
                <h3 className="text-lg font-semibold text-gray-900">Refine search</h3>
              </div>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="rounded-full border border-gray-200 p-2 text-gray-500 hover:text-gray-700"
                aria-label="Close filters"
              >
                ✕
              </button>
            </div>
            {activeChips.length > 0 && (
              <div className="px-5 pt-4 pb-2 border-b border-gray-100">
                <p className="text-xs text-gray-500 font-semibold mb-2 uppercase tracking-wide">Active Filters</p>
                <div className="flex flex-wrap gap-2">
                  {activeChips.map((chip, index) => (
                    <span
                      key={`mobile-chip-${chip}-${index}`}
                      className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-8 pb-6">{renderFilterForm({ hideClearAction: true })}</div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
              <button
                type="button"
                onClick={clearFilters}
                className="w-1/3 rounded-full border border-gray-200 bg-white py-2 font-semibold text-gray-700 disabled:opacity-50"
                disabled={!hasActiveFilters}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="flex-1 rounded-full bg-primary-600 py-2 font-semibold text-white hover:bg-primary-700 transition-colors"
              >
                Show {loading ? '' : filteredListings.length} results
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Filter Button (Mobile) */}
      {isMobile && showStickyFilter && !mobileFiltersOpen && (
        <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 shadow-md px-4 py-3">
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full border-2 border-primary-200 bg-white px-4 py-2.5 text-sm font-semibold text-primary-700 shadow-sm hover:border-primary-300 hover:bg-primary-50 transition-colors"
          >
            <svg
              className="w-4 h-4 text-primary-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4h18M6 8h12M9 12h6m2 4H7"
              />
            </svg>
            Filters {appliedFiltersCount ? `(${appliedFiltersCount})` : ''}
          </button>
        </div>
      )}
    </section>
  );
};

export default AdvancedSearch;

