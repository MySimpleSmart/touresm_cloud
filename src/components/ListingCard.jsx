import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';

const ListingCard = ({ listing, taxonomies = {} }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const getImageUrl = (image) => {
    if (!image) return null;
    if (typeof image === 'string') return image;
    if (typeof image === 'object') {
      // WordPress media object structure
      return image.url || image.source_url || image.guid || image.src || null;
    }
    return null;
  };

  // Memoize images array to prevent recalculation on every render
  const images = useMemo(() => {
    if (listing.listing_gallery) {
      let gallery = listing.listing_gallery;
      if (!Array.isArray(gallery)) {
        gallery = [gallery];
      }
      const imageUrls = gallery.map(getImageUrl).filter(url => url !== null);
      if (imageUrls.length > 0) return imageUrls;
    }
    // Use data URI as fallback instead of external URL
    return ['data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2U1ZTdlYiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4='];
  }, [listing.listing_gallery]);

  // Reset image index when listing changes
  useEffect(() => {
    setCurrentImageIndex(0);
  }, [listing.id]);

  const placeholderImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2U1ZTdlYiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';

  const handleImageError = (e) => {
    e.target.src = placeholderImage;
    e.target.onerror = null;
  };

  const nextImage = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (images.length > 1) {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }
  };

  const prevImage = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (images.length > 1) {
      setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
    }
  };

  const formatPrice = (price) => {
    if (!price) return 'Price on request';
    return `₮${parseFloat(price).toLocaleString()}`;
  };

  // Helper function to get location display text with parent
  const getLocationDisplay = (term, locationsList) => {
    if (!term || !locationsList) return null;
    
    const termId = term.id || term.term_id;
    const parentId = term.parent || term.parent_id || term.parent_term_id || 0;
    
    // If this term has a parent, find and display it
    if (parentId && parentId !== 0 && parentId !== '0') {
      // Try multiple ways to find parent
      const parentTerm = locationsList.find(t => {
        const tId = t.id || t.term_id;
        return tId === parentId || 
               tId === parseInt(parentId) || 
               String(tId) === String(parentId) ||
               tId === Number(parentId) ||
               parseInt(tId) === parseInt(parentId);
      });
      if (parentTerm) {
        return `${parentTerm.name || parentTerm.slug} • ${term.name || term.slug}`;
      }
    }
    
    // If this term doesn't have a parent, check if it's a parent itself
    // (i.e., if any other location has this term as its parent)
    const childLocations = locationsList.filter(t => {
      const tParentId = t.parent || t.parent_id || t.parent_term_id || 0;
      return (tParentId === termId || 
              tParentId === parseInt(termId) || 
              String(tParentId) === String(termId) ||
              parseInt(tParentId) === parseInt(termId)) &&
             (t.id || t.term_id) !== termId; // Don't match itself
    });
    
    // If this is a parent with children, just show the parent name
    // (children will be shown separately if they're selected)
    if (childLocations.length > 0) {
      return term.name || term.slug || null;
    }
    
    return term.name || term.slug || null;
  };

  // Helper function to get all location displays from an array
  const getAllLocationDisplays = (value, locationsList) => {
    if (!value || !locationsList || locationsList.length === 0) {
      return [];
    }
    
    // Simple ID comparison helper
    const getId = (item) => {
      if (typeof item === 'number') return item;
      if (typeof item === 'string' && !isNaN(item)) return parseInt(item);
      if (item && typeof item === 'object') return item.id || item.term_id;
      return null;
    };
    
    const idsEqual = (id1, id2) => {
      if (id1 == null || id2 == null) return false;
      const num1 = typeof id1 === 'string' ? parseInt(id1) : id1;
      const num2 = typeof id2 === 'string' ? parseInt(id2) : id2;
      if (isNaN(num1) || isNaN(num2)) return String(id1) === String(id2);
      return num1 === num2;
    };
    
    // Step 1: Collect ALL selected terms - SIMPLIFIED
    const selectedTerms = [];
    const seenIds = new Set();
    
    const addTerm = (term) => {
      if (!term) return;
      const termId = getId(term);
      if (termId == null) {
        // If no ID, still add it
        selectedTerms.push(term);
        return;
      }
      
      // Check if we've seen this ID
      const idStr = String(termId);
      if (!seenIds.has(idStr)) {
        seenIds.add(idStr);
        selectedTerms.push(term);
      }
    };
    
    // Handle arrays
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          // It's already a term object
          addTerm(item);
        } else {
          // It's an ID, find the term
          const itemId = getId(item);
          if (itemId != null) {
            const foundTerm = locationsList.find(t => idsEqual(getId(t), itemId));
            if (foundTerm) {
              addTerm(foundTerm);
            }
          }
        }
      });
    } else {
      // Single value
      if (typeof value === 'object' && value !== null) {
        addTerm(value);
      } else {
        const itemId = getId(value);
        if (itemId != null) {
          const foundTerm = locationsList.find(t => idsEqual(getId(t), itemId));
          if (foundTerm) {
            addTerm(foundTerm);
          }
        }
      }
    }
    
    if (selectedTerms.length === 0) {
      return [];
    }
    
    // Step 2: Create a simple lookup set
    const selectedIds = new Set();
    selectedTerms.forEach(t => {
      const id = getId(t);
      if (id != null) {
        selectedIds.add(String(id));
        selectedIds.add(id);
        if (!isNaN(parseInt(id))) {
          selectedIds.add(parseInt(id));
        }
      }
    });
    
    const isSelected = (checkId) => {
      if (checkId == null) return false;
      return selectedIds.has(String(checkId)) || 
             selectedIds.has(checkId) ||
             selectedIds.has(parseInt(checkId)) ||
             selectedTerms.some(t => idsEqual(getId(t), checkId));
    };
    
    // Step 3: Process and display
    const results = [];
    const processed = new Set();
    
    selectedTerms.forEach((term) => {
      const termId = getId(term);
      if (termId == null) {
        return;
      }
      
      const idStr = String(termId);
      if (processed.has(idStr)) {
        return;
      }
      
      const parentId = term.parent || term.parent_id || term.parent_term_id || 0;
      
      if (parentId && parentId !== 0 && parentId !== '0') {
        const parentIsSelected = isSelected(parentId);
        
        if (parentIsSelected) {
          const parentTerm = locationsList.find(t => idsEqual(getId(t), parentId));
          if (parentTerm) {
            const display = `${parentTerm.name || parentTerm.slug} • ${term.name || term.slug}`;
            if (!results.includes(display)) {
              results.push(display);
              processed.add(idStr);
              processed.add(String(parentId));
            }
          }
        } else {
          const display = getLocationDisplay(term, locationsList);
          if (display && !results.includes(display)) {
            results.push(display);
            processed.add(idStr);
          }
        }
      } else {
        const hasChildren = selectedTerms.some(t => {
          const tId = getId(t);
          const tParentId = t.parent || t.parent_id || t.parent_term_id || 0;
          return idsEqual(tParentId, termId) && !idsEqual(tId, termId);
        });
        
        if (!hasChildren) {
          const display = getLocationDisplay(term, locationsList);
          if (display && !results.includes(display)) {
            results.push(display);
            processed.add(idStr);
          }
        } else {
          processed.add(idStr);
        }
      }
    });
    
    return results;
  };

  const getTaxonomyValue = (value, taxonomyType = null) => {
    // Handle null, undefined, or empty
    if (!value) return null;
    
    // Handle strings
    if (typeof value === 'string') {
      // If it's an empty string or just whitespace, return null
      return value.trim() || null;
    }
    
    // Handle numbers (IDs) - try to resolve from taxonomies
    if (typeof value === 'number') {
      if (taxonomyType && taxonomies[taxonomyType]) {
        const term = taxonomies[taxonomyType].find(t => {
          const tId = t.id || t.term_id;
          return tId === value || tId === parseInt(value) || String(tId) === String(value);
        });
        if (term) {
          // For locations, use helper function to get parent > child format
          if (taxonomyType === 'locations') {
            return getLocationDisplay(term, taxonomies[taxonomyType]);
          }
          return term.name || term.slug || null;
        }
      }
      return null;
    }
    
    // Handle arrays
    if (Array.isArray(value)) {
      if (value.length === 0) return null;
      
      // Get first item
      const firstItem = value[0];
      
      // If first item is an object, extract name or slug
      if (typeof firstItem === 'object' && firstItem !== null) {
        // For locations, use helper function to get parent > child format
        if (taxonomyType === 'locations' && taxonomies[taxonomyType]) {
          const locationDisplay = getLocationDisplay(firstItem, taxonomies[taxonomyType]);
          if (locationDisplay) return locationDisplay;
        }
        return firstItem.name || firstItem.slug || firstItem.title || null;
      }
      
      // If first item is a string, return it
      if (typeof firstItem === 'string') {
        return firstItem.trim() || null;
      }
      
      // If first item is a number (ID), try to resolve
      if (typeof firstItem === 'number') {
        if (taxonomyType && taxonomies[taxonomyType]) {
          const term = taxonomies[taxonomyType].find(t => {
            const tId = t.id || t.term_id;
            return tId === firstItem || tId === parseInt(firstItem) || String(tId) === String(firstItem);
          });
          if (term) {
            // For locations, use helper function to get parent > child format
            if (taxonomyType === 'locations') {
              return getLocationDisplay(term, taxonomies[taxonomyType]);
            }
            return term.name || term.slug || null;
          }
        }
        return null;
      }
      
      return String(firstItem);
    }
    
    // Handle objects
    if (typeof value === 'object' && value !== null) {
      // For locations, use helper function to get parent > child format
      if (taxonomyType === 'locations' && taxonomies[taxonomyType]) {
        const locationDisplay = getLocationDisplay(value, taxonomies[taxonomyType]);
        if (locationDisplay) return locationDisplay;
      }
      return value.name || value.slug || value.title || value.label || null;
    }
    
    // Fallback: convert to string
    const stringValue = String(value);
    return stringValue.trim() || null;
  };

  return (
    <Link
      to={`/listing/${listing.id}`}
      className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden group flex flex-col h-full"
    >
      <div className="relative h-48 overflow-hidden group/image-gallery">
        {/* Main Gallery Image */}
        <img
          key={`${listing.id}-${currentImageIndex}`}
          src={images[currentImageIndex] || placeholderImage}
          alt={`${listing.listing_name || 'Listing'} - Image ${currentImageIndex + 1}`}
          className="w-full h-full object-cover group-hover:scale-110 transition-all duration-300"
          onError={handleImageError}
          style={{ opacity: 1 }}
        />
        
        {/* Navigation Arrows - Show on hover if multiple images */}
        {images.length > 1 && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 opacity-0 group-hover/image-gallery:opacity-100 transition-opacity shadow-md"
              aria-label="Previous image"
            >
              <svg
                className="w-5 h-5 text-gray-800"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <button
              onClick={nextImage}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 opacity-0 group-hover/image-gallery:opacity-100 transition-opacity shadow-md"
              aria-label="Next image"
            >
              <svg
                className="w-5 h-5 text-gray-800"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </>
        )}

        {/* Image Counter Dots */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex space-x-1">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCurrentImageIndex(index);
                }}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  index === currentImageIndex
                    ? 'bg-white w-6'
                    : 'bg-white bg-opacity-50 hover:bg-opacity-75'
                }`}
                aria-label={`Go to image ${index + 1}`}
              />
            ))}
          </div>
        )}

        {/* Category Badge */}
        {listing.listing_category && getTaxonomyValue(listing.listing_category, 'categories') && (
          <span className="absolute top-3 left-3 bg-primary-600 text-white px-3 py-1 rounded-full text-sm font-medium z-10">
            {getTaxonomyValue(listing.listing_category, 'categories')}
          </span>
        )}
      </div>
      <div className="p-5 flex flex-col flex-1">
        <h3 className="text-xl font-semibold text-gray-900 mb-2 line-clamp-1">
          {listing.listing_name || 'Unnamed Listing'}
        </h3>
        {(() => {
          const locationValue = listing.listing_region || listing.listing_location;
          const locationDisplays = getAllLocationDisplays(locationValue, taxonomies.locations || []);
          return locationDisplays.length > 0 ? (
            <p className="text-gray-600 mb-3 flex items-center flex-wrap gap-1">
              <svg
                className="w-4 h-4 mr-1 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="line-clamp-1">
                {locationDisplays.map((location, index) => (
                  <span key={index}>
                    {location}
                    {index < locationDisplays.length - 1 && <span className="mx-1">•</span>}
                  </span>
                ))}
                {listing.listing_familiar_location && (
                  <span>
                    {locationDisplays.length > 0 && <span>, </span>}
                    {listing.listing_familiar_location}
                  </span>
                )}
              </span>
            </p>
          ) : null;
        })()}
        {(() => {
          // Show familiar location even if no regular locations
          const locationDisplays = getAllLocationDisplays(listing.listing_region || listing.listing_location, taxonomies.locations || []);
          if (locationDisplays.length === 0 && listing.listing_familiar_location) {
            return (
              <p className="text-gray-600 mb-3 flex items-center flex-wrap gap-1">
                <svg
                  className="w-4 h-4 mr-1 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span className="line-clamp-1">{listing.listing_familiar_location}</span>
              </p>
            );
          }
          return null;
        })()}
        {listing.listing_description && (
          <p className="text-gray-600 text-sm mb-4 line-clamp-2">
            {listing.listing_description}
          </p>
        )}
        
        {/* Social / Video Links */}
        {(listing.listing_social_url || listing.listing_video) && (
          <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {listing.listing_social_url && (
            <a
              href={listing.listing_social_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded-full bg-primary-50 text-primary-700 hover:bg-primary-100 px-3 py-1 font-medium transition-colors"
            >
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
              View Social
            </a>
            )}
            {listing.listing_video && (
              <a
                href={listing.listing_video}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded-full bg-primary-50 text-primary-700 hover:bg-primary-100 px-3 py-1 font-medium transition-colors"
              >
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 6h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z"
                  />
                </svg>
                Watch Video
              </a>
            )}
          </div>
        )}
        
        {/* Listing Details */}
        <div className="flex flex-wrap gap-4 mb-4 text-sm text-gray-600">
          {listing.room_number && (
            <div className="flex items-center">
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              <span>{listing.room_number} {listing.room_number === 1 ? 'room' : 'rooms'}</span>
            </div>
          )}
          {listing.listing_bed_number && (
            <div className="flex items-center">
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
              <span>{listing.listing_bed_number} {listing.listing_bed_number === 1 ? 'bed' : 'beds'}</span>
            </div>
          )}
          {listing.guest_max_number && (
            <div className="flex items-center">
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <span>Up to {listing.guest_max_number} {listing.guest_max_number === 1 ? 'guest' : 'guests'}</span>
            </div>
          )}
          {listing.listing_size && getTaxonomyValue(listing.listing_size, 'sizes') && (
            <div className="flex items-center">
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              </svg>
              <span>{getTaxonomyValue(listing.listing_size, 'sizes')}</span>
            </div>
          )}
        </div>

        <div className="mt-auto pt-4 border-t border-gray-200 flex items-center justify-between gap-3">
            {listing.listing_price ? (
              <div className="flex flex-col leading-tight">
                <p className="text-2xl font-bold text-primary-600">
                  {formatPrice(listing.listing_price)}
                </p>
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  per night
                </span>
              </div>
            ) : (
              <p className="text-gray-500">Price on request</p>
            )}
          <span className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 group-hover:bg-primary-700 group-hover:shadow-md">
            View Details
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
};

export default ListingCard;

