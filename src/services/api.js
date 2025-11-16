import axios from 'axios';

const API_BASE_URL = 'https://touresm.cloud/wp-json/wp/v2';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Fetch all listings
export const getListings = async (params = {}) => {
  try {
    const response = await api.get('/touresm-listing', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching listings:', error);
    throw error;
  }
};

// Fetch single listing by ID
export const getListing = async (id) => {
  try {
    const response = await api.get(`/touresm-listing/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching listing:', error);
    throw error;
  }
};

let taxonomyIndex = null;
let taxonomyIndexPromise = null;

const loadTaxonomyIndex = async () => {
  if (taxonomyIndex) return taxonomyIndex;
  if (taxonomyIndexPromise) return taxonomyIndexPromise;

  taxonomyIndexPromise = api
    .get('/taxonomies', {
      params: {
        per_page: 100,
      },
    })
    .then(response => {
      taxonomyIndex = response.data || {};
      return taxonomyIndex;
    })
    .catch(error => {
      console.error('Error fetching taxonomies index:', error);
      taxonomyIndex = {};
      return taxonomyIndex;
    })
    .finally(() => {
      taxonomyIndexPromise = null;
    });

  return taxonomyIndexPromise;
};

const taxonomyExists = async (taxonomy) => {
  const index = await loadTaxonomyIndex();
  if (!index) return false;

  if (Array.isArray(index)) {
    return index.some(item => item?.slug === taxonomy);
  }

  return Boolean(index[taxonomy]);
};

// Fetch taxonomy terms - request all in one call (taxonomies are typically small)
export const getTaxonomyTerms = async (taxonomy) => {
  try {
    const response = await api.get(`/${taxonomy}`, {
      params: {
        per_page: 100 // Request up to 100 terms in one call (should be enough for taxonomies)
      }
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching ${taxonomy}:`, error);
    throw error;
  }
};

// Fetch categories
export const getCategories = async () => {
  return getTaxonomyTerms('listing_category');
};

// Fetch locations (using listing_region taxonomy, with fallback to listing_location)
export const getLocations = async () => {
  try {
    const hasListingRegion = await taxonomyExists('listing_region');
    if (hasListingRegion) {
      return await getTaxonomyTerms('listing_region');
    }
  } catch (error) {
    // If listing_region fetch failed for other reasons, fall back below
  }

  try {
    return await getTaxonomyTerms('listing_location');
  } catch (fallbackError) {
    console.error('Error fetching locations:', fallbackError);
    return [];
  }
};

// Fetch amenities (try plural first, then singular as fallback)
export const getAmenities = async () => {
  try {
    // Try plural first (as per README)
    return await getTaxonomyTerms('listing_aminities');
  } catch (error) {
    // Fallback to singular if plural fails
    try {
      return await getTaxonomyTerms('listing_aminity');
    } catch (fallbackError) {
      console.error('Error fetching amenities:', fallbackError);
      // Return empty array instead of throwing to prevent app crash
      return [];
    }
  }
};

// Fetch sizes
export const getSizes = async () => {
  return getTaxonomyTerms('listing_size');
};

export default api;

// Additional media helpers for resolving gallery image URLs
export const getMedia = async (id) => {
  try {
    const response = await api.get(`/media/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching media:', error);
    throw error;
  }
};

export const getMediaByParent = async (parentId, params = {}) => {
  try {
    const response = await api.get('/media', {
      params: {
        parent: parentId,
        per_page: 100,
        ...params,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching media by parent:', error);
    throw error;
  }
};

