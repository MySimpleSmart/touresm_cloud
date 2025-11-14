import axios from 'axios';

const API_BASE_URL = 'https://touresm.cloud/wp-json/wp/v2';
const API_NONCE_URL = 'https://touresm.cloud/wp-json/wp/v2';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for WordPress cookie-based auth
});

// Helper function to get current user (needed in interceptor)
const getCurrentUserForAuth = () => {
  const userStr = localStorage.getItem('admin_user');
  return userStr ? JSON.parse(userStr) : null;
};

// Add request interceptor to include authentication
api.interceptors.request.use(
  (config) => {
    // Try JWT token first
    const jwtToken = localStorage.getItem('jwt_token');
    if (jwtToken) {
      config.headers['Authorization'] = `Bearer ${jwtToken}`;
      console.log('Using JWT token for authentication');
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
          console.log('Using Application Password for authentication');
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
  },
  (error) => {
    return Promise.reject(error);
  }
);

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
        // Store JWT token
        localStorage.setItem('jwt_token', jwtResponse.data.token);
        console.log('JWT token obtained and stored');
        
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
      console.log('JWT authentication failed, trying Application Password...', jwtError);
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
      console.log('Application Password authentication failed', appPasswordError);
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
    const response = await api.get(`/touresm-listing/${id}`);
    return response.data;
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
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      
      // Provide user-friendly error messages
      if (error.response.status === 401) {
        const errorData = error.response.data;
        if (errorData && errorData.code === 'rest_cannot_create') {
          throw new Error('Permission denied: You do not have permission to create listings. Please contact your WordPress administrator to grant you Editor or Administrator role.');
        }
        throw new Error('Authentication failed. Please log out and log back in with your Application Password.');
      }
    }
    throw error;
  }
};

export const updateListing = async (id, data) => {
  try {
    // WordPress REST API uses PUT for updates, but some setups use POST
    // Try PUT first, fallback to POST if needed
    try {
      const response = await api.put(`/touresm-listing/${id}`, data);
      return response.data;
    } catch (putError) {
      // If PUT fails with 401, check if it's a permissions issue
      if (putError.response && putError.response.status === 401) {
        const errorData = putError.response.data;
        if (errorData && errorData.code === 'rest_cannot_edit') {
          throw new Error('You do not have permission to edit this listing. Please ensure your WordPress user has Administrator or Editor role, and the custom post type allows editing.');
        }
      }
      // If PUT fails, try POST (some WordPress setups require POST)
      const response = await api.post(`/touresm-listing/${id}`, data);
      return response.data;
    }
  } catch (error) {
    console.error('Error updating listing:', error);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      
      // Provide user-friendly error messages
      if (error.response.status === 401) {
        const errorData = error.response.data;
        if (errorData && errorData.code === 'rest_cannot_edit') {
          throw new Error('Permission denied: You do not have permission to edit listings. Please contact your WordPress administrator to grant you Editor or Administrator role.');
        }
        throw new Error('Authentication failed. Please log out and log back in with your Application Password.');
      }
    }
    throw error;
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

// Bookings
export const getBookings = async (params = {}) => {
  try {
    const response = await api.get('/house_booking', { params });
    return response.data;
  } catch (error) {
    // If endpoint doesn't exist, return empty array instead of throwing
    if (error.response && error.response.status === 404) {
      console.warn('Bookings endpoint not found, returning empty array');
      return [];
    }
    console.error('Error fetching bookings:', error);
    throw error;
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

// Houses (for booking calendar - using the house post type)
export const getHouses = async (params = {}) => {
  try {
    const response = await api.get('/house', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching houses:', error);
    throw error;
  }
};

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

export default api;

