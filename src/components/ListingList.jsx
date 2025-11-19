import { useState, useEffect } from 'react';
import { getListings, getCategories, getLocations, getSizes } from '../services/api';
import ListingCard from './ListingCard';
import QuickSearch from './QuickSearch';
import {
  matchesLocationFilter,
  buildLocationLookup,
  isListingAvailableForRange,
  matchesCategoryFilter,
} from '../utils/listingFilters';
import AdvancedSearch from './AdvancedSearch';

const initialFiltersState = {
  search: '',
  category: '',
  location: '',
  minPrice: '',
  maxPrice: '',
  checkIn: '',
  checkOut: '',
};

const ListingList = () => {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [filters, setFilters] = useState(initialFiltersState);
  const [quickFilters, setQuickFilters] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadListings();
  }, [filters, locations]);

  const loadData = async () => {
    try {
      const [listingsData, categoriesData, locationsData, sizesData] = await Promise.all([
        getListings(),
        getCategories(),
        getLocations(),
        getSizes(),
      ]);
      setListings(listingsData);
      setCategories(categoriesData);
      setLocations(locationsData);
      setSizes(sizesData);
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  const loadListings = async () => {
    setLoading(true);
    try {
      const params = {};
      
      if (filters.search) {
        params.search = filters.search;
      }
      
      if (filters.category) {
        params.listing_category = filters.category;
      }
      
      const allListings = await getListings(params);
      const locationLookup = buildLocationLookup(locations);

      let filteredData = allListings.filter((listing) =>
        matchesLocationFilter(listing, filters.location, locations, locationLookup)
      );
      if (filters.minPrice) {
        filteredData = filteredData.filter(
          (listing) => listing.listing_price && listing.listing_price >= parseFloat(filters.minPrice)
        );
      }
      if (filters.maxPrice) {
        filteredData = filteredData.filter(
          (listing) => listing.listing_price && listing.listing_price <= parseFloat(filters.maxPrice)
        );
      }

      if (filters.checkIn && filters.checkOut) {
        filteredData = filteredData.filter((listing) =>
          isListingAvailableForRange(listing, filters.checkIn, filters.checkOut)
        );
      }
      
      setListings(filteredData);
      setLoading(false);
    } catch (error) {
      console.error('Error loading listings:', error);
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters({ ...filters, ...newFilters });
  };

  const handleQuickSearch = (searchData) => {
    setFilters({
      ...initialFiltersState,
      location: searchData.location || '',
      checkIn: searchData.checkIn || '',
      checkOut: searchData.checkOut || '',
    });

    setQuickFilters({
      locations: searchData.location ? [String(searchData.location)] : [],
      checkIn: searchData.checkIn || '',
      checkOut: searchData.checkOut || '',
    });
  };

  if (loading && listings.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  const renderDefaultGrid = () => {
    if (listings.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No listings found. Try adjusting your filters.</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {listings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            taxonomies={{ categories, locations, sizes }}
          />
        ))}
      </div>
    );
  };

  return quickFilters ? (
    <AdvancedSearch
      embedded
      quickFilters={quickFilters}
      onClose={() => {
        setQuickFilters(null);
        setFilters(initialFiltersState);
      }}
      listingsSeed={listings}
      taxonomySeed={{ categories, locations }}
    />
  ) : (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <QuickSearch locations={locations} onSearch={handleQuickSearch} />
      {renderDefaultGrid()}
    </div>
  );
};

export default ListingList;

