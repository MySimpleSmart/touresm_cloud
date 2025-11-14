import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getListing,
  createListing,
  updateListing,
  getCategories,
  getLocations,
  getAmenities,
  getSizes,
} from '../services/api';

const ListingForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    listing_name: '',
    listing_description: '',
    listing_price: '',
    listing_location: [],
    listing_region: [],
    listing_category: [],
    listing_size: [],
    listing_aminities: [],
    listing_social_url: '',
    listing_video: '',
    room_number: '',
    listing_bed_number: '',
    guest_max_number: '',
    check_in_time: '',
    check_out_time: '',
    listing_gallery: [],
    // Location fields
    parent_location: null,
    child_location: null,
  });

  const [taxonomies, setTaxonomies] = useState({
    categories: [],
    locations: [],
    amenities: [],
    sizes: [],
  });

  useEffect(() => {
    const initialize = async () => {
      const taxData = await loadTaxonomies();
      // Update taxonomies state before loading listing
      setTaxonomies(taxData);
      if (isEdit) {
        // Use a small delay to ensure state is updated
        setTimeout(() => {
          loadListing();
        }, 100);
      }
    };
    initialize();
  }, [id]);

  const loadTaxonomies = async () => {
    try {
      const [categories, locations, amenities, sizes] = await Promise.all([
        getCategories().catch(() => []),
        getLocations().catch(() => []),
        getAmenities().catch(() => []),
        getSizes().catch(() => []),
      ]);
      const taxData = { 
        categories: categories || [], 
        locations: locations || [], 
        amenities: amenities || [], 
        sizes: sizes || [] 
      };
      setTaxonomies(taxData);
      return taxData;
    } catch (err) {
      console.error('Error loading taxonomies:', err);
      const emptyData = { categories: [], locations: [], amenities: [], sizes: [] };
      setTaxonomies(emptyData);
      return emptyData;
    }
  };

  // Helper function to extract ID from taxonomy value (handles various formats)
  const extractTaxonomyId = (value) => {
    if (!value) return null;
    if (Array.isArray(value)) {
      if (value.length === 0) return null;
      const first = value[0];
      if (typeof first === 'number') return first;
      if (typeof first === 'object' && first !== null) {
        return first.id || first.term_id || null;
      }
      if (typeof first === 'string') {
        const num = parseInt(first);
        return isNaN(num) ? null : num;
      }
      return null;
    }
    if (typeof value === 'number') return value;
    if (typeof value === 'object' && value !== null) {
      return value.id || value.term_id || null;
    }
    if (typeof value === 'string') {
      const num = parseInt(value);
      return isNaN(num) ? null : num;
    }
    return null;
  };

  // Organize locations into parents and children
  const organizeLocations = () => {
    if (!taxonomies.locations || taxonomies.locations.length === 0) {
      return { parents: [], childrenMap: {} };
    }

    const parents = [];
    const childrenMap = {};

    taxonomies.locations.forEach((loc) => {
      const parentId = loc.parent || loc.parent_id || loc.parent_term_id || 0;
      const locId = loc.id || loc.term_id;

      if (parentId && parentId !== 0 && parentId !== '0') {
        // It's a child
        const parentKey = String(parentId);
        if (!childrenMap[parentKey]) {
          childrenMap[parentKey] = [];
        }
        childrenMap[parentKey].push(loc);
      } else {
        // It's a parent
        parents.push(loc);
      }
    });

    return { parents, childrenMap };
  };

  // Get children for selected parent
  const getChildrenForParent = (parentId) => {
    if (!parentId) return [];
    const { childrenMap } = organizeLocations();
    return childrenMap[String(parentId)] || [];
  };

  // Organize amenities into parents and children
  const organizeAmenities = () => {
    if (!taxonomies.amenities || taxonomies.amenities.length === 0) {
      return { parents: [], childrenMap: {} };
    }

    const parents = [];
    const childrenMap = {};

    taxonomies.amenities.forEach((amenity) => {
      const parentId = amenity.parent || amenity.parent_id || amenity.parent_term_id || 0;
      const amenityId = amenity.id || amenity.term_id;

      if (parentId && parentId !== 0 && parentId !== '0') {
        // It's a child
        const parentKey = String(parentId);
        if (!childrenMap[parentKey]) {
          childrenMap[parentKey] = [];
        }
        childrenMap[parentKey].push(amenity);
      } else {
        // It's a parent
        parents.push(amenity);
      }
    });

    return { parents, childrenMap };
  };

  // Get children for selected parent amenity
  const getChildrenForParentAmenity = (parentId) => {
    if (!parentId) return [];
    const { childrenMap } = organizeAmenities();
    return childrenMap[String(parentId)] || [];
  };

  // Check if amenity is selected
  const isAmenitySelected = (amenityId) => {
    if (!formData.listing_aminities || formData.listing_aminities.length === 0) return false;
    return formData.listing_aminities.some((amenity) => {
      const id = extractTaxonomyId(amenity);
      return id === amenityId || String(id) === String(amenityId);
    });
  };

  // Handle amenity selection
  const handleAmenityToggle = (amenityId, isParent = false) => {
    const currentAmenities = formData.listing_aminities || [];
    const isSelected = isAmenitySelected(amenityId);

    if (isSelected) {
      // Remove amenity
      const updated = currentAmenities.filter((amenity) => {
        const id = extractTaxonomyId(amenity);
        return id !== amenityId && String(id) !== String(amenityId);
      });
      setFormData((prev) => ({ ...prev, listing_aminities: updated }));
    } else {
      // Add amenity
      const newAmenity = { id: amenityId };
      setFormData((prev) => ({
        ...prev,
        listing_aminities: [...currentAmenities, newAmenity],
      }));
    }
  };

  const loadListing = async () => {
    try {
      setLoading(true);
      const listing = await getListing(id);
      
      // Ensure taxonomies are loaded
      let locationsData = taxonomies.locations || [];
      let amenitiesData = taxonomies.amenities || [];
      if (!locationsData || locationsData.length === 0 || !amenitiesData || amenitiesData.length === 0) {
        const taxData = await loadTaxonomies();
        locationsData = (taxData && taxData.locations) ? taxData.locations : [];
        amenitiesData = (taxData && taxData.amenities) ? taxData.amenities : [];
        if (taxData) {
          setTaxonomies(taxData);
        }
      }
      
      // Extract parent and child from location data
      let parentLocation = null;
      let childLocation = null;
      const locationData = listing.listing_location || listing.listing_region || [];
      
      if (locationData && locationData.length > 0 && locationsData && locationsData.length > 0) {
        const locationValue = Array.isArray(locationData) ? locationData[0] : locationData;
        const locationId = extractTaxonomyId(locationValue);
        
        if (locationId) {
          // Find the location in taxonomies
          const location = locationsData.find((loc) => {
            const locId = loc.id || loc.term_id;
            return locId === locationId || String(locId) === String(locationId) || parseInt(locId) === parseInt(locationId);
          });
          
          if (location) {
            const parentId = location.parent || location.parent_id || location.parent_term_id || 0;
            const normalizedParentId = parentId ? (typeof parentId === 'string' ? parseInt(parentId) : parentId) : 0;
            
            if (normalizedParentId && normalizedParentId !== 0) {
              // It's a child location
              childLocation = locationId;
              parentLocation = normalizedParentId;
            } else {
              // It's a parent location
              parentLocation = locationId;
            }
          }
        }
      }
      
      // Map listing data to form data
      setFormData({
        listing_name: listing.listing_name || '',
        listing_description: listing.listing_description || '',
        listing_price: listing.listing_price || '',
        listing_location: listing.listing_location || [],
        listing_region: listing.listing_region || [],
        listing_category: listing.listing_category || [],
        listing_size: listing.listing_size || [],
        listing_aminities: listing.listing_aminity || listing.listing_aminities || [],
        listing_social_url: listing.listing_social_url || '',
        listing_video: listing.listing_video || '',
        room_number: listing.room_number || '',
        listing_bed_number: listing.listing_bed_number || '',
        guest_max_number: listing.guest_max_number || '',
        check_in_time: listing.check_in_time || '',
        check_out_time: listing.check_out_time || '',
        listing_gallery: listing.listing_gallery || [],
        parent_location: parentLocation,
        child_location: childLocation,
      });
    } catch (err) {
      setError('Failed to load listing. Please try again.');
      console.error('Error loading listing:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTaxonomyChange = (taxonomyName, value) => {
    setFormData((prev) => ({
      ...prev,
      [taxonomyName]: Array.isArray(value) ? value : [value],
    }));
  };

  const handleLocationChange = (type, value) => {
    if (type === 'parent') {
      setFormData((prev) => ({
        ...prev,
        parent_location: value ? parseInt(value) : null,
        child_location: null, // Reset child when parent changes
      }));
    } else if (type === 'child') {
      setFormData((prev) => ({
        ...prev,
        child_location: value ? parseInt(value) : null,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      // Combine parent and child location into listing_location
      const locationToSave = formData.child_location 
        ? [formData.child_location]
        : formData.parent_location 
        ? [formData.parent_location]
        : [];

      // Format taxonomy terms as arrays of IDs
      const formatTaxonomy = (value) => {
        if (!value || (Array.isArray(value) && value.length === 0)) return [];
        if (Array.isArray(value)) {
          return value.map(item => {
            if (typeof item === 'number') return item;
            if (typeof item === 'object' && item !== null) {
              return item.id || item.term_id || null;
            }
            if (typeof item === 'string') {
              const num = parseInt(item);
              return isNaN(num) ? null : num;
            }
            return null;
          }).filter(id => id !== null);
        }
        const id = extractTaxonomyId(value);
        return id ? [id] : [];
      };

      // Prepare data for WordPress REST API
      const submitData = {
        title: formData.listing_name,
        content: formData.listing_description,
        status: 'publish',
        meta: {
          listing_name: formData.listing_name,
          listing_description: formData.listing_description,
          listing_price: formData.listing_price,
          listing_social_url: formData.listing_social_url,
          listing_video: formData.listing_video,
          room_number: formData.room_number,
          listing_bed_number: formData.listing_bed_number,
          guest_max_number: formData.guest_max_number,
          check_in_time: formData.check_in_time,
          check_out_time: formData.check_out_time,
          listing_gallery: formData.listing_gallery,
        },
        // Taxonomy terms as arrays of IDs
        listing_category: formatTaxonomy(formData.listing_category),
        listing_size: formatTaxonomy(formData.listing_size),
        listing_location: locationToSave,
        listing_region: locationToSave,
        listing_aminities: formatTaxonomy(formData.listing_aminities),
      };

      if (isEdit) {
        await updateListing(id, submitData);
      } else {
        await createListing(submitData);
      }
      navigate('/listings');
    } catch (err) {
      // Show user-friendly error message
      if (err.message) {
        setError(err.message);
      } else if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else {
        setError('Failed to save listing. Please check your permissions and try again.');
      }
      console.error('Error saving listing:', err);
      if (err.response) {
        console.error('Response data:', err.response.data);
        console.error('Response status:', err.response.status);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {isEdit ? 'Edit Listing' : 'Create New Listing'}
        </h1>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* Basic Information */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Listing Name *
              </label>
              <input
                type="text"
                name="listing_name"
                value={formData.listing_name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                name="listing_description"
                value={formData.listing_description}
                onChange={handleChange}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price per Night *
              </label>
              <input
                type="number"
                name="listing_price"
                value={formData.listing_price}
                onChange={handleChange}
                required
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Taxonomies */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Categories & Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={extractTaxonomyId(formData.listing_category) || ''}
                onChange={(e) => handleTaxonomyChange('listing_category', e.target.value ? [{ id: parseInt(e.target.value) }] : [])}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select Category</option>
                {taxonomies.categories.map((cat) => {
                  const catId = cat.id || cat.term_id;
                  return (
                    <option key={catId} value={catId}>
                      {cat.name}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Size
              </label>
              <select
                value={extractTaxonomyId(formData.listing_size) || ''}
                onChange={(e) => handleTaxonomyChange('listing_size', e.target.value ? [{ id: parseInt(e.target.value) }] : [])}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select Size</option>
                {taxonomies.sizes.map((size) => {
                  const sizeId = size.id || size.term_id;
                  return (
                    <option key={sizeId} value={sizeId}>
                      {size.name}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Parent Location
              </label>
              <select
                value={formData.parent_location || ''}
                onChange={(e) => handleLocationChange('parent', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select Parent Location</option>
                {organizeLocations().parents.map((loc) => {
                  const locId = loc.id || loc.term_id;
                  return (
                    <option key={locId} value={locId}>
                      {loc.name}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Child Location
              </label>
              <select
                value={formData.child_location || ''}
                onChange={(e) => handleLocationChange('child', e.target.value)}
                disabled={!formData.parent_location}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">Select Child Location (optional)</option>
                {formData.parent_location && getChildrenForParent(formData.parent_location).map((loc) => {
                  const locId = loc.id || loc.term_id;
                  return (
                    <option key={locId} value={locId}>
                      {loc.name}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>

        {/* Property Details */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Property Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rooms
              </label>
              <input
                type="number"
                name="room_number"
                value={formData.room_number}
                onChange={handleChange}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Beds
              </label>
              <input
                type="number"
                name="listing_bed_number"
                value={formData.listing_bed_number}
                onChange={handleChange}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Guests
              </label>
              <input
                type="number"
                name="guest_max_number"
                value={formData.guest_max_number}
                onChange={handleChange}
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Amenities */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Amenities</h2>
          <div className="border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto">
            {organizeAmenities().parents.map((parent) => {
              const parentId = parent.id || parent.term_id;
              const children = getChildrenForParentAmenity(parentId);
              const isParentSelected = isAmenitySelected(parentId);

              return (
                <div key={parentId} className="mb-4 last:mb-0">
                  {/* Parent Amenity */}
                  <label className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isParentSelected}
                      onChange={() => handleAmenityToggle(parentId, true)}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <span className="ml-3 text-sm font-semibold text-gray-900">
                      {parent.name}
                    </span>
                  </label>

                  {/* Child Amenities */}
                  {children.length > 0 && (
                    <div className="ml-7 mt-1 space-y-1">
                      {children.map((child) => {
                        const childId = child.id || child.term_id;
                        const isChildSelected = isAmenitySelected(childId);

                        return (
                          <label
                            key={childId}
                            className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={isChildSelected}
                              onChange={() => handleAmenityToggle(childId, false)}
                              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                            />
                            <span className="ml-3 text-sm text-gray-700">
                              {child.name}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {organizeAmenities().parents.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No amenities available
              </p>
            )}
          </div>
        </div>

        {/* Check-in/Check-out Times */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Check-in & Check-out</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Check-in Time
              </label>
              <input
                type="time"
                name="check_in_time"
                value={formData.check_in_time}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Check-out Time
              </label>
              <input
                type="time"
                name="check_out_time"
                value={formData.check_out_time}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>

        {/* URLs */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Links</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Social URL
              </label>
              <input
                type="url"
                name="listing_social_url"
                value={formData.listing_social_url}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Video URL
              </label>
              <input
                type="url"
                name="listing_video"
                value={formData.listing_video}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 pt-4 border-t">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : isEdit ? 'Update Listing' : 'Create Listing'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/listings')}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default ListingForm;

