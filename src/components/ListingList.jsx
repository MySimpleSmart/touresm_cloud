import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getListings, getCategories, getLocations, getSizes } from '../services/api';
import ListingCard from './ListingCard';
import QuickSearch from './QuickSearch';

const ListingList = () => {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    location: '',
    minPrice: '',
    maxPrice: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadListings();
  }, [filters]);

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
      
      if (filters.location) {
        params.listing_location = filters.location;
      }

      const data = await getListings(params);
      
      // Filter by price on client side if needed
      let filteredData = data;
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
    // Update filters based on quick search
    const newFilters = {
      ...filters,
      location: searchData.location || '',
    };
    setFilters(newFilters);
    
    // TODO: Implement check-in, check-out, and guest filtering when backend is ready
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Quick Search Section */}
      <QuickSearch 
        locations={locations} 
        onSearch={handleQuickSearch}
      />

      {listings.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No listings found. Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {listings.map((listing) => (
            <ListingCard 
              key={listing.id} 
              listing={listing}
              taxonomies={{ categories, locations, sizes }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ListingList;

