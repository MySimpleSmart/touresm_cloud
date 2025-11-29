import axios from 'axios';

const API_BASE_URL = 'https://touresm.cloud/wp-json/wp/v2';
const API_NONCE_URL = 'https://touresm.cloud/wp-json/wp/v2';
const PODS_API_BASE_URL = 'https://touresm.cloud/wp-json';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for WordPress cookie-based auth
});

// Create separate axios instance for PODS endpoints (may be at root level)
const podsApi = axios.create({
  baseURL: PODS_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Helper function to get current user (needed in interceptor)
const getCurrentUserForAuth = () => {
  const userStr = localStorage.getItem('admin_user');
  return userStr ? JSON.parse(userStr) : null;
};

// Add request interceptor to include authentication
const requestInterceptor = (config) => {
  // Don't override Content-Type for FormData (file uploads)
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  
  // Try JWT token first
  const jwtToken = localStorage.getItem('jwt_token');
  if (jwtToken) {
    config.headers['Authorization'] = `Bearer ${jwtToken}`;
  }
  
  // If no JWT token, try Application Password (Basic Auth)
  if (!jwtToken) {
    const storedAuth = localStorage.getItem('wp_auth_credentials');
    if (storedAuth) {
      try {
        const { username, password } = JSON.parse(storedAuth);
        config.auth = {
          username,
          password,
        };
      } catch (e) {
        // Ignore if credentials can't be parsed
      }
    }
  }
  
  // Also try nonce for compatibility
  const nonce = localStorage.getItem('wp_rest_nonce');
  if (nonce) {
    config.headers['X-WP-Nonce'] = nonce;
  }
  
  return config;
};

api.interceptors.request.use(requestInterceptor);
podsApi.interceptors.request.use(requestInterceptor);

// Add response interceptor to handle token refresh if needed
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If 401 and we have JWT token, it might be expired
    if (error.response?.status === 401 && localStorage.getItem('jwt_token') && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Try to refresh token or re-authenticate
      const storedAuth = localStorage.getItem('wp_auth_credentials');
      if (storedAuth) {
        try {
          const { username, password } = JSON.parse(storedAuth);
          // Try to get new JWT token
          const jwtResponse = await axios.post(
            `${API_BASE_URL.replace('/wp/v2', '')}/jwt-auth/v1/token`,
            { username, password }
          );
          
          if (jwtResponse.data?.token) {
            localStorage.setItem('jwt_token', jwtResponse.data.token);
            originalRequest.headers['Authorization'] = `Bearer ${jwtResponse.data.token}`;
            return api(originalRequest);
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
        }
      }
    }
    
    return Promise.reject(error);
  }
);

// Authentication
export const login = async (username, password) => {
  try {
    // Try JWT authentication first (if JWT plugin is installed)
    try {
      const jwtResponse = await axios.post(
        `${API_BASE_URL.replace('/wp/v2', '')}/jwt-auth/v1/token`,
        {
          username,
          password,
        }
      );
      
      if (jwtResponse.data && jwtResponse.data.token) {
        localStorage.setItem('jwt_token', jwtResponse.data.token);
        
        // Store user info
        const userData = jwtResponse.data.user || {
          id: jwtResponse.data.user_id || 1,
          username: username,
          name: jwtResponse.data.user_display_name || username,
          email: jwtResponse.data.user_email || `${username}@touresm.cloud`,
          roles: jwtResponse.data.user?.roles || [],
        };
        localStorage.setItem('admin_user', JSON.stringify(userData));
        
        // Also store credentials as fallback
        localStorage.setItem('wp_auth_credentials', JSON.stringify({ username, password }));
        
        return userData;
      }
    } catch (jwtError) {
      console.error('JWT authentication failed, trying Application Password...', jwtError);
    }
    
    // Try Application Password authentication (WordPress 5.6+)
    // Application Passwords work with Basic Auth
    try {
      const response = await axios.get(
        `${API_BASE_URL}/users/me`,
        {
          auth: {
            username,
            password, // This should be the Application Password
          },
        }
      );
      
      // Store auth info
      if (response.data) {
        // Check user capabilities
        const userData = response.data;
        const userRoles = userData.capabilities || {};
        const isAdmin = userData.roles?.includes('administrator') || userRoles.administrator;
        const isEditor = userData.roles?.includes('editor') || userRoles.editor;
        
        if (!isAdmin && !isEditor) {
          throw new Error('Your account does not have permission to access the admin dashboard. You need Administrator or Editor role.');
        }
        
        localStorage.setItem('admin_user', JSON.stringify(userData));
        // Store credentials for API authentication (Application Password)
        localStorage.setItem('wp_auth_credentials', JSON.stringify({ username, password }));
        return userData;
      }
    } catch (appPasswordError) {
      console.error('Application Password authentication failed', appPasswordError);
      // If it's a 401, the credentials are wrong
      if (appPasswordError.response && appPasswordError.response.status === 401) {
        throw new Error('Invalid username or application password. Please check your credentials.');
      }
      // Re-throw if it's a permission error
      if (appPasswordError.message && appPasswordError.message.includes('permission')) {
        throw appPasswordError;
      }
    }
    
    throw new Error('Authentication failed. Please check your username and application password.');
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

export const logout = () => {
  localStorage.removeItem('admin_user');
  localStorage.removeItem('wp_rest_nonce');
  localStorage.removeItem('wp_auth_credentials');
  localStorage.removeItem('jwt_token');
  window.location.href = '/login';
};

export const getCurrentUser = () => {
  const userStr = localStorage.getItem('admin_user');
  return userStr ? JSON.parse(userStr) : null;
};

// Listings CRUD
export const getListings = async (params = {}) => {
  try {
    const response = await api.get('/touresm-listing', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching listings:', error);
    throw error;
  }
};

export const getListing = async (id) => {
  try {
    // Get the full listing with _embed to include related resources
    // Don't use _fields as it might exclude meta fields if they're not registered with show_in_rest
    const response = await api.get(`/touresm-listing/${id}`, {
      params: { 
        _embed: true,
        // Include context=edit to get more data (requires authentication)
        context: 'edit',
      },
    });
    
    let listingData = response.data;
    
    // WordPress REST API may not return custom meta fields unless they're registered with show_in_rest
    // Check if meta field is missing and try alternative approaches
    if (!listingData.meta || !listingData.meta.listing_gallery) {
      try {
        // Try without context=edit (some setups don't support it)
        const altResponse = await api.get(`/touresm-listing/${id}`, {
          params: { _embed: true },
        });
        listingData = altResponse.data;
      } catch (altError) {
        // silent
      }
    }
    
    // Ensure blocked days fields are accessible - check all possible locations
    // This is critical for calendar to show Host vs Admin blocking correctly
    if (listingData.meta) {
      if (!listingData.meta.admin_blocked_days) {
        listingData.meta.admin_blocked_days = listingData.admin_blocked_days || 
                                              listingData.meta?.listing_admin_blocked_days || 
                                              '';
      }
      if (!listingData.meta.host_blocked_days) {
        listingData.meta.host_blocked_days = listingData.host_blocked_days || 
                                             listingData.meta?.listing_host_blocked_days || 
                                             '';
      }
    }
    
    return listingData;
  } catch (error) {
    console.error('Error fetching listing:', error);
    throw error;
  }
};

export const createListing = async (data) => {
  try {
    const response = await api.post('/touresm-listing', data);
    return response.data;
  } catch (error) {
    console.error('Error creating listing:', error);
    if (error.response && error.response.status === 401) {
      const errorData = error.response.data;
      if (errorData && errorData.code === 'rest_cannot_create') {
        throw new Error('Permission denied: You do not have permission to create listings. Please contact your WordPress administrator to grant you Editor or Administrator role.');
      }
      throw new Error('Authentication failed. Please log out and log back in with your Application Password.');
    }
    throw error;
  }
};

export const updateListing = async (id, data) => {
  try {
    try {
      const response = await api.put(`/touresm-listing/${id}`, data);
      return response.data;
    } catch (putError) {
      if (putError.response && putError.response.status === 401) {
        const errorData = putError.response.data;
        if (errorData && errorData.code === 'rest_cannot_edit') {
          throw new Error('You do not have permission to edit this listing. Please ensure your WordPress user has Administrator or Editor role, and the custom post type allows editing.');
        }
      }
      const response = await api.post(`/touresm-listing/${id}`, data);
      return response.data;
    }
  } catch (error) {
    console.error('Error updating listing:', error);
    if (error.response && error.response.status === 401) {
      const errorData = error.response.data;
      if (errorData && errorData.code === 'rest_cannot_edit') {
        throw new Error('Permission denied: You do not have permission to edit listings. Please contact your WordPress administrator to grant you Editor or Administrator role.');
      }
      throw new Error('Authentication failed. Please log out and log back in with your Application Password.');
    }
    throw error;
  }
};

// Listing Rules CRUD - Use /wp/v2/listing_rules directly (like touresm-listing)
export const getListingRules = async (params = {}) => {
  try {
    const response = await api.get('/listing_rules', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching listing rules:', error);
    throw error;
  }
};

export const getListingRule = async (id) => {
  try {
    const response = await api.get(`/listing_rules/${id}`, {
      params: { context: 'edit' },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching listing rule:', error);
    throw error;
  }
};

export const createListingRule = async (data) => {
  try {
    const response = await api.post('/listing_rules', data);
    return response.data;
  } catch (error) {
    console.error('Error creating listing rule:', error);
    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', error.response.data);
    }
    throw error;
  }
};

export const updateListingRule = async (id, data) => {
  try {
    try {
      const response = await api.put(`/listing_rules/${id}`, data);
      return response.data;
    } catch (putError) {
      // Try POST if PUT fails
      const response = await api.post(`/listing_rules/${id}`, data);
      return response.data;
    }
  } catch (error) {
    console.error('Error updating listing rule:', error);
    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', error.response.data);
    }
    throw error;
  }
};

export const deleteListingRule = async (id) => {
  try {
    const response = await api.delete(`/listing_rules/${id}`, {
      params: { force: true },
    });
    return response.data;
  } catch (error) {
    console.error('Error deleting listing rule:', error);
    if (error.response) {
      console.error('Error response:', error.response.data);
    }
    throw error;
  }
};

// Update listing rule meta fields (similar to updateListingMetaField)
export const updateListingRuleMetaField = async (ruleId, metaKey, metaValue) => {
  try {
    // Try updating via POST with meta object
    const response = await api.post(`/listing_rules/${ruleId}`, {
      meta: {
        [metaKey]: metaValue,
      },
    });
    return response.data;
  } catch (error) {
    console.error(`Error updating listing rule meta field ${metaKey}:`, error);
    // Try PUT as fallback
    try {
      const response = await api.put(`/listing_rules/${ruleId}`, {
        meta: {
          [metaKey]: metaValue,
        },
      });
      return response.data;
    } catch (putError) {
      console.error(`Error updating listing rule meta field ${metaKey} via PUT:`, putError);
      throw putError;
    }
  }
};

export const deleteListing = async (id) => {
  try {
    const response = await api.delete(`/touresm-listing/${id}`, {
      params: { force: true },
    });
    return response.data;
  } catch (error) {
    console.error('Error deleting listing:', error);
    throw error;
  }
};

// Media/Image Upload
export const uploadMedia = async (file, parentId = null, onUploadProgress) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    if (parentId) {
      formData.append('post', parentId);
    }
    
    const response = await api.post('/media', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: typeof onUploadProgress === 'function' ? onUploadProgress : undefined,
    });
    
    const mediaData = response.data;
    return {
      id: mediaData.id || mediaData.ID,
      source_url: mediaData.source_url || mediaData.guid?.rendered || mediaData.url || mediaData.link,
      url: mediaData.source_url || mediaData.guid?.rendered || mediaData.url || mediaData.link,
      ...mediaData,
    };
  } catch (error) {
    console.error('Error uploading media:', error);
    throw error;
  }
};

export const deleteMedia = async (id) => {
  try {
    const response = await api.delete(`/media/${id}`, {
      params: { force: true },
    });
    return response.data;
  } catch (error) {
    console.error('Error deleting media:', error);
    throw error;
  }
};

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

export const updateMediaItem = async (id, data) => {
  try {
    // WordPress REST API uses POST for media updates
    // The 'post' field should map to 'post_parent' in WordPress
    const updateData = { ...data };
    if (data.post !== undefined) {
      // WordPress REST API expects 'post' to be the parent post ID
      // Some setups might need 'post_parent' instead
      updateData.post_parent = data.post;
      updateData.post = data.post;
    }
    
    // WordPress REST API might need the data in a specific format
    // Try POST first (WordPress standard for media updates)
    const response = await api.post(`/media/${id}`, updateData);
    return response.data;
  } catch (error) {
    // Try PUT as fallback
    // Try PUT as fallback
    try {
      const updateData = { ...data };
      if (data.post !== undefined) {
        updateData.post_parent = data.post;
        updateData.post = data.post;
      }
      const response = await api.put(`/media/${id}`, updateData);
      return response.data;
    } catch (putError) {
      throw putError;
    }
  }
};

// Force update listing meta field (separate call to ensure it's saved)
export const updateListingMetaField = async (listingId, metaKey, metaValue) => {
  try {
    // Try updating just the meta field via POST
    const response = await api.post(`/touresm-listing/${listingId}`, {
      meta: {
        [metaKey]: metaValue,
      },
    });
    return response.data;
  } catch (error) {
    console.error(`Error updating meta field ${metaKey}:`, error);
    // Try PUT as fallback
    try {
      const response = await api.put(`/touresm-listing/${listingId}`, {
        meta: {
          [metaKey]: metaValue,
        },
      });
      return response.data;
    } catch (putError) {
      console.error(`Error updating meta field ${metaKey} via PUT:`, putError);
      throw putError;
    }
  }
};

// Pods REST: update fields for a Pods item (ensures wp-admin Pods UI reflects changes)
export const updatePodsItemFields = async (podSlug, itemId, fields) => {
  try {
    const podsBase = API_BASE_URL.replace('/wp/v2', '/pods/v1');
    const url = `${podsBase}/items/${podSlug}/${itemId}`;
    
    // Create axios instance with same auth as main api
    const podsApi = axios.create({
      baseURL: podsBase,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });
    
    // Add authentication
    const jwtToken = localStorage.getItem('jwt_token');
    if (jwtToken) {
      podsApi.defaults.headers.common['Authorization'] = `Bearer ${jwtToken}`;
    } else {
      const storedAuth = localStorage.getItem('wp_auth_credentials');
      if (storedAuth) {
        try {
          const { username, password } = JSON.parse(storedAuth);
          podsApi.defaults.auth = { username, password };
        } catch (e) {
          // Ignore
        }
      }
    }
    
    const response = await podsApi.post(`/items/${podSlug}/${itemId}`, { fields });
    return response.data;
  } catch (error) {
    // 404 is expected if PODS REST API is not enabled - silently fail and let caller handle fallback
    if (error.response?.status === 404) {
      throw error; // Re-throw for caller to handle fallback
    }
    // Only log unexpected errors
    console.error('Error updating Pods fields:', error);
    if (error.response) {
      console.error('PODS error response:', error.response.data);
    }
    throw error;
  }
};

// Taxonomies
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

export const getTaxonomyTerms = async (taxonomy) => {
  try {
    const response = await api.get(`/${taxonomy}`, {
      params: { per_page: 100 },
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching ${taxonomy}:`, error);
    return [];
  }
};

export const getCategories = () => getTaxonomyTerms('listing_category');

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

export const getSizes = () => getTaxonomyTerms('listing_size');

// Fetch period types (renting_period_type)
export const getPeriodTypes = () => getTaxonomyTerms('renting_period_type');

// Bookings
export const getBookings = async (params = {}) => {
  try {
    const response = await api.get('/house_booking', { params });
    return response.data;
  } catch (error) {
    // If endpoint doesn't exist, return empty array instead of throwing
    if (error.response && error.response.status === 404) {
      return [];
    }
    // Silently return empty array for bookings endpoint not found
    return [];
  }
};

export const getBooking = async (id) => {
  try {
    const response = await api.get(`/house_booking/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching booking:', error);
    throw error;
  }
};

export const updateBookingStatus = async (id, status) => {
  try {
    const response = await api.post(`/house_booking/${id}`, {
      meta: {
        booking_status: status,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error updating booking status:', error);
    throw error;
  }
};

// Track whether we're using houses or listings
let usingListingsFallback = false;
let podsAvailable = true;

const updatePodsFieldsIfAvailable = async (itemId, fields) => {
  if (!podsAvailable) return;
  try {
    await updatePodsItemFields('touresm-listing', itemId, fields);
  } catch (error) {
    if (error?.response?.status === 404) {
      podsAvailable = false;
    } else {
      console.warn('Warning: Could not save Pods fields:', error);
    }
  }
};

// Houses (for booking calendar - uses listings endpoint)
export const getHouses = async (params = {}) => {
  try {
    // Request with context=edit to get meta fields (requires authentication)
    const listingsResponse = await api.get('/touresm-listing', { 
      params: {
        ...params,
        context: 'edit',
        _embed: true,
      }
    });
    usingListingsFallback = true;
    
    // Map listings to house-like structure for calendar compatibility
    // Always fetch individually for listings with blocked dates to ensure fields are loaded
    const houses = await Promise.all(
      listingsResponse.data.map(async (listing) => {
        const hasBlockedDates = listing.admin_blocked_days || listing.meta?.admin_blocked_days || 
                                listing.host_blocked_days || listing.meta?.host_blocked_days;
        
        // If listing has blocked dates, always fetch individually to get the fields
        // This ensures we have the correct Host vs Admin status
        let adminDates = '';
        let hostDates = '';
        if (hasBlockedDates) {
          try {
            const individualListing = await getListing(listing.id);
            adminDates = individualListing.admin_blocked_days || 
                        individualListing.meta?.admin_blocked_days || 
                        individualListing.meta?.listing_admin_blocked_days || 
                        '';
            hostDates = individualListing.host_blocked_days || 
                       individualListing.meta?.host_blocked_days || 
                       individualListing.meta?.listing_host_blocked_days || 
                       '';
          } catch (fetchError) {
            // If individual fetch fails, try from bulk response
            adminDates = listing.admin_blocked_days || 
                        listing.meta?.admin_blocked_days || 
                        listing.meta?.listing_admin_blocked_days || 
                        '';
            hostDates = listing.host_blocked_days || 
                       listing.meta?.host_blocked_days || 
                       listing.meta?.listing_host_blocked_days || 
                       '';
          }
        } else {
          // No blocked dates, use empty strings
          adminDates = listing.admin_blocked_days || 
                      listing.meta?.admin_blocked_days || 
                      listing.meta?.listing_admin_blocked_days || 
                      '';
          hostDates = listing.host_blocked_days || 
                     listing.meta?.host_blocked_days || 
                     listing.meta?.listing_host_blocked_days || 
                     '';
        }
        
        return {
          id: listing.id,
          title: listing.title,
          admin_blocked_days: adminDates,
          host_blocked_days: hostDates,
          meta: {
            admin_blocked_days: adminDates,
            host_blocked_days: hostDates,
            house_size: listing.meta?.house_size || listing.meta?.listing_size || '',
          },
        };
      })
    );
    
    return houses;
  } catch (error) {
    console.error('Error fetching listings for calendar:', error);
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      if (status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      } else {
        throw new Error(`Failed to load listings: ${data?.message || data?.code || status}`);
      }
    } else if (error.request) {
      throw new Error('No response from server. Please check your connection.');
    } else {
      throw new Error(`Error: ${error.message}`);
    }
  }
};

// Check if we're using listings fallback
export const isUsingListingsFallback = () => usingListingsFallback;

export const getHouse = async (id) => {
  try {
    const response = await api.get(`/house/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching house:', error);
    throw error;
  }
};

export const updateHouseDates = async (id, dates) => {
  try {
    const response = await api.post(`/house/${id}`, {
      meta: {
        available_dates: dates,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error updating house dates:', error);
    throw error;
  }
};

// Update house dates (uses listings endpoint with admin_blocked_days and host_blocked_days fields)
export const updateHouseDate = async (houseId, dates, isOwner = false) => {
  try {
    // Get current listing to merge dates
    const listing = await getListing(houseId);
    
    // Determine which field to update based on isOwner
    const fieldName = isOwner ? 'host_blocked_days' : 'admin_blocked_days';
    const currentDatesStr = listing[fieldName] || listing.meta?.[fieldName] || listing.meta?.[`listing_${fieldName}`] || '';
    const currentDates = currentDatesStr ? currentDatesStr.split(',').map(d => d.trim()).filter(Boolean) : [];
    
    // Add new dates that aren't already present
    const datesToAdd = dates.filter(date => !currentDates.includes(date));
    const updatedDates = [...currentDates, ...datesToAdd];
    const datesString = updatedDates.join(',');
    
    // Prepare update data
    const updateData = {
      [fieldName]: datesString,
      meta: {
        [fieldName]: datesString,
      },
    };
    
    // Update using the field directly
    // Method 1: Update as top-level field (most reliable)
    try {
      await updateListing(houseId, updateData);
      // Also ensure field is saved separately via meta
      try {
        await updateListingMetaField(houseId, fieldName, datesString);
      } catch (metaError) {
        console.warn(`Warning: Could not save ${fieldName} via meta field:`, metaError);
        // Don't throw - main save succeeded
      }
    } catch (e1) {
      // Method 2: Update via meta field only
      try {
        await updateListingMetaField(houseId, fieldName, datesString);
      } catch (e2) {
        throw new Error(`Failed to save dates: ${e2.message || 'Unknown error'}`);
      }
    }

    // Method 3: Ensure Pods data is updated so wp-admin shows correct values
    await updatePodsFieldsIfAvailable(houseId, { [fieldName]: datesString });
    
    return { success: true };
  } catch (error) {
    console.error('Error updating listing dates:', error);
    throw new Error(`Failed to update dates: ${error.message || 'Unknown error'}`);
  }
};

// Remove house dates (uses listings endpoint with admin_blocked_days and host_blocked_days fields)
// When unblocking dates: remove from both admin_blocked_days and host_blocked_days
export const removeHouseDate = async (houseId, dates, isOwner = false) => {
  try {
    // Get current listing to remove dates
    const listing = await getListing(houseId);
    
    // Remove from admin_blocked_days
    const adminDatesStr = listing.admin_blocked_days || listing.meta?.admin_blocked_days || listing.meta?.listing_admin_blocked_days || '';
    const adminDates = adminDatesStr ? adminDatesStr.split(',').map(d => d.trim()).filter(Boolean) : [];
    const updatedAdminDates = adminDates.filter(date => !dates.includes(date));
    const updatedAdminDatesString = updatedAdminDates.join(',');
    
    // Remove from host_blocked_days
    const hostDatesStr = listing.host_blocked_days || listing.meta?.host_blocked_days || listing.meta?.listing_host_blocked_days || '';
    const hostDates = hostDatesStr ? hostDatesStr.split(',').map(d => d.trim()).filter(Boolean) : [];
    const updatedHostDates = hostDates.filter(date => !dates.includes(date));
    const updatedHostDatesString = updatedHostDates.join(',');
    
    // Prepare update data
    const updateData = {
      admin_blocked_days: updatedAdminDatesString,
      host_blocked_days: updatedHostDatesString,
      meta: {
        admin_blocked_days: updatedAdminDatesString,
        host_blocked_days: updatedHostDatesString,
      },
    };
    
    // Update using the fields directly
    // Method 1: Update as top-level fields (most reliable)
    try {
      await updateListing(houseId, updateData);
      // Also ensure fields are saved separately via meta
      try {
        await updateListingMetaField(houseId, 'admin_blocked_days', updatedAdminDatesString);
        await updateListingMetaField(houseId, 'host_blocked_days', updatedHostDatesString);
      } catch (metaError) {
        console.warn('Warning: Could not save blocked days via meta field:', metaError);
        // Don't throw - main save succeeded
      }
    } catch (e1) {
      // Method 2: Update via meta field only
      try {
        await updateListingMetaField(houseId, 'admin_blocked_days', updatedAdminDatesString);
        await updateListingMetaField(houseId, 'host_blocked_days', updatedHostDatesString);
      } catch (e2) {
        throw new Error(`Failed to remove dates: ${e2.message || 'Unknown error'}`);
      }
    }

    // Method 3: Ensure Pods data is updated so wp-admin shows correct values
    await updatePodsFieldsIfAvailable(houseId, {
      admin_blocked_days: updatedAdminDatesString,
      host_blocked_days: updatedHostDatesString,
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error removing listing dates:', error);
    throw new Error(`Failed to remove dates: ${error.message || 'Unknown error'}`);
  }
};

export default api;


