import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getListings, deleteListing } from '../services/api';

const Listings = () => {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadListings();
  }, []);

  const loadListings = async () => {
    try {
      setLoading(true);
      const data = await getListings({ per_page: 100 });
      setListings(data);
      setError('');
    } catch (err) {
      setError('Failed to load listings. Please try again.');
      console.error('Error loading listings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) {
      return;
    }

    try {
      await deleteListing(id);
      setListings(listings.filter((listing) => listing.id !== id));
    } catch (err) {
      alert('Failed to delete listing. Please try again.');
      console.error('Error deleting listing:', err);
    }
  };

  const getImageUrl = (listing) => {
    if (listing.listing_gallery && listing.listing_gallery.length > 0) {
      const firstImage = listing.listing_gallery[0];
      if (typeof firstImage === 'string') return firstImage;
      if (typeof firstImage === 'object') {
        return firstImage.url || firstImage.source_url || firstImage.guid || null;
      }
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Listings</h1>
          <p className="mt-2 text-gray-600">Manage your property listings</p>
        </div>
        <Link
          to="/listings/new"
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          + Add New Listing
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {listings.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-600 mb-4">No listings found.</p>
          <Link
            to="/listings/new"
            className="inline-block px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Create Your First Listing
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((listing) => {
            const imageUrl = getImageUrl(listing);
            return (
              <div key={listing.id} className="bg-white rounded-lg shadow overflow-hidden">
                {imageUrl && (
                  <div className="h-48 bg-gray-200 overflow-hidden">
                    <img
                      src={imageUrl}
                      alt={listing.listing_name || 'Listing'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {listing.listing_name || 'Unnamed Listing'}
                  </h3>
                  {listing.listing_price && (
                    <p className="text-primary-600 font-bold mb-2">
                      ${parseFloat(listing.listing_price).toLocaleString()}/night
                    </p>
                  )}
                  <div className="flex gap-2 mt-4">
                    <Link
                      to={`/listings/edit/${listing.id}`}
                      className="flex-1 text-center px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(listing.id, listing.listing_name)}
                      className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Listings;

