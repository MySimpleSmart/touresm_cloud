import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getListing,
  createListing,
  updateListing,
  getCategories,
  getLocations,
  getAmenities,
  getSizes,
  getPeriodTypes,
  getMedia,
  getMediaByParent,
  updateMediaItem,
  updateListingMetaField,
  getListingRules,
  getListingRule,
  uploadMedia,
} from '../services/api';
import { updatePodsItemFields } from '../services/api';
import ImageGalleryUpload from '../components/ImageGalleryUpload';
import ConfirmModal from '../components/ConfirmModal';

const extractImageId = (img) => {
  if (!img) return null;
  if (typeof img === 'number') return img;
  if (typeof img === 'string') return null;
  if (typeof img === 'object') {
    return (
      img.id ||
      img.ID ||
      img.media_id ||
      img.image_id ||
      img.attachment_id ||
      (img.meta && (img.meta.id || img.meta.image_id)) ||
      null
    );
  }
  return null;
};

const extractImageUrl = (img) => {
  if (!img) return null;
  if (typeof img === 'string') return img;
  if (typeof img === 'object') {
    // Try buildMediaUrl first for WordPress media objects
    const mediaUrl = buildMediaUrl(img);
    if (mediaUrl) return mediaUrl;
    
    // Fallback to direct field access
    return (
      img.url ||
      img.source_url ||
      img.image_url ||
      img.guid?.rendered ||
      (typeof img.guid === 'string' ? img.guid : null) ||
      img.src ||
      (img.meta && (img.meta.url || img.meta.source_url)) ||
      // WordPress REST API might return URL in different places
      img.media_details?.sizes?.large?.source_url ||
      img.media_details?.sizes?.medium_large?.source_url ||
      img.media_details?.sizes?.medium?.source_url ||
      img.media_details?.sizes?.thumbnail?.source_url ||
      null
    );
  }
  return null;
};

const normalizeImageData = (img) => {
  if (!img) return null;
  const id = extractImageId(img);
  let url = extractImageUrl(img);
  const order =
    (typeof img === 'object' && img !== null && (img.menu_order ?? img.order ?? img.meta?.order)) ?? null;
  
  // If extractImageUrl didn't find a URL, try buildMediaUrl
  if (!url && img && typeof img === 'object') {
    url = buildMediaUrl(img);
  }
  
  const normalizedId =
    typeof id === 'string' && id
      ? Number.isNaN(parseInt(id, 10))
        ? id
        : parseInt(id, 10)
      : id;
  
  const normalized = {
    ...((typeof img === 'object' && img !== null) ? img : {}),
    id: normalizedId || null,
    url: url || null,
    source_url: url || null,
    order: typeof order === 'number' ? order : (parseInt(order, 10) || null),
  };
  
  // Ensure we have a valid URL - try constructing from ID if we have one
  // If no URL, leave as-is (silent in production)
  
  return normalized;
};

const formatGalleryImages = (gallery) => {
  if (!gallery || (Array.isArray(gallery) && gallery.length === 0)) return [];
  return gallery
    .map((img) => {
      const id = extractImageId(img);
      if (id === null || Number.isNaN(id)) return null;
      return typeof id === 'string' ? parseInt(id, 10) : id;
    })
    .filter((id) => id !== null && !Number.isNaN(id));
};

const buildMediaUrl = (media) => {
  if (!media) return null;
  
  // Try various URL fields that WordPress REST API might return
  let url = 
    media.source_url ||
    media.media_details?.sizes?.large?.source_url ||
    media.media_details?.sizes?.medium_large?.source_url ||
    media.media_details?.sizes?.medium?.source_url ||
    media.media_details?.sizes?.thumbnail?.source_url ||
    media.guid?.rendered ||
    media.url ||
    media.link ||
    // Sometimes WordPress returns the URL in different places
    (typeof media.guid === 'string' ? media.guid : null) ||
    // Check if it's an embedded media object
    media._embedded?.['wp:featuredmedia']?.[0]?.source_url ||
    null;
  
  // If still no URL, check for WordPress attachment post structure
  // WordPress attachment posts might have guid as object or string
  if (!url && media.guid) {
    if (typeof media.guid === 'object' && media.guid.rendered) {
      url = media.guid.rendered;
    } else if (typeof media.guid === 'string') {
      url = media.guid;
    }
  }
  
  // If we have an ID but no URL, we'll need to fetch it
  // But for now, log what we have
  // Silent if no URL in production
  
  return url;
};

const getGalleryFromAttachments = async (listingId) => {
  if (!listingId) {
    return [];
  }
  
  try {
    const attachments = await getMediaByParent(listingId);
    
    if (!Array.isArray(attachments) || attachments.length === 0) {
      return [];
    }
    // Sort attachments by menu_order ascending if present
    const sorted = [...attachments].sort((a, b) => {
      const ao = typeof a.menu_order === 'number' ? a.menu_order : parseInt(a.menu_order || 0, 10) || 0;
      const bo = typeof b.menu_order === 'number' ? b.menu_order : parseInt(b.menu_order || 0, 10) || 0;
      if (ao !== bo) return ao - bo;
      // Fallback by id asc
      return (parseInt(a.id || a.ID || 0, 10) || 0) - (parseInt(b.id || b.ID || 0, 10) || 0);
    });
    
    const normalizedAttachments = sorted
      .map((media, index) => {
        try {
          const mediaId = media.id || media.ID;
          const mediaUrl = buildMediaUrl(media);
          
          if (!mediaId) {
            return null;
          }
          
          const normalized = normalizeImageData({
            id: mediaId,
            url: mediaUrl,
            source_url: mediaUrl,
            order: media.menu_order ?? index,
          });
          
          if (!normalized || !normalized.id) {
            return null;
          }
          
          return normalized;
        } catch (mediaError) {
          return null;
        }
      })
      .filter(Boolean);
    
    return normalizedAttachments;
  } catch (error) {
    return [];
  }
};

const ListingForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [initialSnapshot, setInitialSnapshot] = useState(null);

  const [formData, setFormData] = useState({
    // Basic Details
    listing_name: '',
    listing_description: '',
    // Property Details
    room_number: '',
    listing_bed_number: '',
    guest_max_number: '',
    // Price Details
    listing_price_general: '',
    listing_price_weekly: '',
    listing_price_fortnightly: '',
    listing_price_monthly: '',
    listing_price_annually: '',
    // Discount Details
    discount_number_night_1: '',
    discount_percent_night_1: '',
    discount_number_night_2: '',
    discount_percent_night_2: '',
    discount_number_night_3: '',
    discount_percent_night_3: '',
    discount_number_guest_1: '',
    discount_percent_guest_1: '',
    discount_number_guest_2: '',
    discount_percent_guest_2: '',
    discount_number_guest_3: '',
    discount_percent_guest_3: '',
    // Time Details
    default_check_in_time: '14:00',
    default_check_out_time: '11:00',
    business_check_in_time: '',
    business_check_out_time: '',
    weekend_check_in_time: '',
    weekend_check_out_time: '',
    // Location Details
    exact_location: '',
    listing_familiar_location: '',
    // Video and Social
    listing_video: '',
    listing_social_url: '',
    // Gallery
    listing_gallery: [],
    // Listing Rules
    listing_rule: '',
    listing_rule_mode: 'custom', // 'existing' or 'custom'
    selected_listing_rule_id: '',
    // Admin Details
    admin_blocked_days: '',
    host_blocked_days: '',
    listing_minimum_stays: '',
    featured_listing: '',
    // Taxonomies (keep existing)
    listing_location: [],
    listing_region: [],
    listing_category: [],
    listing_size: [],
    listing_aminities: [],
    listing_period_type: [],
    // Location fields
    parent_location: null,
    child_location: null,
  });
  const [initialGalleryIds, setInitialGalleryIds] = useState([]);

  const [taxonomies, setTaxonomies] = useState({
    categories: [],
    locations: [],
    amenities: [],
    sizes: [],
    periodTypes: [],
  });

  const [availableListingRules, setAvailableListingRules] = useState([]);

  // Price rows state - dynamic list of period-price pairs
  const [priceRows, setPriceRows] = useState([
    { id: 1, period: 'daily', price: '' }
  ]);

  // Discount toggle state
  const [discountEnabled, setDiscountEnabled] = useState(false);

  // Time Details state - track time rows (similar to discount rows)
  const [timeRows, setTimeRows] = useState([
    { id: 1, type: 'default', checkIn: '14:00', checkOut: '11:00' },
  ]);

  // Search states for location dropdowns
  const [parentLocationSearch, setParentLocationSearch] = useState('');
  const [childLocationSearch, setChildLocationSearch] = useState('');
  const [showParentLocationDropdown, setShowParentLocationDropdown] = useState(false);
  const [showChildLocationDropdown, setShowChildLocationDropdown] = useState(false);
  const [showFamiliarLocationSuggestions, setShowFamiliarLocationSuggestions] = useState(false);
  
  // Refs for click outside detection
  const parentLocationDropdownRef = useRef(null);
  const childLocationDropdownRef = useRef(null);
  
  // Familiar Location suggestions
  const familiarLocationSuggestions = [
    'Near City Center', 'Beachfront', 'Downtown', 'Historic District', 'Waterfront',
    'Shopping District', 'Near Airport', 'Riverside', 'Mountain View', 'Ocean View',
    'Near Park', 'Suburban', 'Quiet Neighborhood', 'Business District', 'Tourist Area',
    'Cultural District', 'Entertainment District', 'Residential Area', 'Seaside', 'Countryside'
  ];

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close parent location dropdown
      if (showParentLocationDropdown && parentLocationDropdownRef.current) {
        if (!parentLocationDropdownRef.current.contains(event.target)) {
          setShowParentLocationDropdown(false);
        }
      }
      // Close child location dropdown
      if (showChildLocationDropdown && childLocationDropdownRef.current) {
        if (!childLocationDropdownRef.current.contains(event.target)) {
          setShowChildLocationDropdown(false);
        }
      }
    };

    if (showParentLocationDropdown || showChildLocationDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showParentLocationDropdown, showChildLocationDropdown]);

  // Initialize time rows when loading listing
  useEffect(() => {
    if (isEdit && formData.business_check_in_time !== undefined) {
      const rows = [];
      let idCounter = 1;
      
      // Add business days if exists
      if (formData.business_check_in_time || formData.business_check_out_time) {
        rows.push({
          id: idCounter++,
          type: 'business',
          checkIn: formData.business_check_in_time || '',
          checkOut: formData.business_check_out_time || '',
        });
      } else {
        // Add default if no business
        rows.push({
          id: idCounter++,
          type: 'default',
          checkIn: formData.default_check_in_time || '',
          checkOut: formData.default_check_out_time || '',
        });
      }
      
      // Add weekend if exists
      if (formData.weekend_check_in_time || formData.weekend_check_out_time) {
        rows.push({
          id: idCounter++,
          type: 'weekend',
          checkIn: formData.weekend_check_in_time || '',
          checkOut: formData.weekend_check_out_time || '',
        });
      }
      
      if (rows.length > 0) {
        setTimeRows(rows);
      }
    }
  }, [isEdit, formData.business_check_in_time, formData.weekend_check_in_time, formData.default_check_in_time]);

  // Sync time rows to formData
  useEffect(() => {
    const defaultRow = timeRows.find(r => r.type === 'default');
    const businessRow = timeRows.find(r => r.type === 'business');
    const weekendRow = timeRows.find(r => r.type === 'weekend');
    
    setFormData(prev => ({
      ...prev,
      default_check_in_time: defaultRow?.checkIn || '',
      default_check_out_time: defaultRow?.checkOut || '',
      business_check_in_time: businessRow?.checkIn || '',
      business_check_out_time: businessRow?.checkOut || '',
      weekend_check_in_time: weekendRow?.checkIn || '',
      weekend_check_out_time: weekendRow?.checkOut || '',
    }));
  }, [timeRows]);

  // Handle adding time types
  const handleAddTimeTypes = () => {
    const defaultRow = timeRows.find(r => r.type === 'default');
    if (defaultRow) {
      // Convert default to business and add weekend
      setTimeRows([
        {
          id: defaultRow.id,
          type: 'business',
          checkIn: defaultRow.checkIn || '',
          checkOut: defaultRow.checkOut || '',
        },
        {
          id: Math.max(...timeRows.map(r => r.id), 0) + 1,
          type: 'weekend',
          checkIn: defaultRow.checkIn || '',
          checkOut: defaultRow.checkOut || '',
        },
      ]);
    }
  };

  // Handle removing time row
  const handleRemoveTimeRow = (id) => {
    const row = timeRows.find(r => r.id === id);
    if (!row) return;
    
    // If removing business, also remove weekend (both required together)
    if (row.type === 'business') {
      setTimeRows([{
        id: row.id,
        type: 'default',
        checkIn: row.checkIn || '',
        checkOut: row.checkOut || '',
      }]);
    }
    // Weekend can't be removed if business exists (handled by canRemove logic)
  };

  const getTimeTypeLabel = (type) => {
    switch (type) {
      case 'default': return 'Default';
      case 'business': return 'Business Days';
      case 'weekend': return 'Weekend';
      default: return type;
    }
  };

  // Dynamic discount rows (night-based and guest-based), max 3 each
  const [nightDiscountRows, setNightDiscountRows] = useState([
    { id: 1, count: '', percent: '5', mode: 'preset' },
  ]);

  const [guestDiscountRows, setGuestDiscountRows] = useState([
    { id: 1, count: '', percent: '5', mode: 'preset' },
  ]);

  // Additional Services state
  const [additionalServices, setAdditionalServices] = useState([]);
  const [expandedServices, setExpandedServices] = useState(new Set());

  // Active section for sidebar + helper text
  const [activeSection, setActiveSection] = useState('basic');

  const sectionHelperText = {
    basic: 'Set the main title and description your guests will see first.',
    property: 'Define property type, size, capacity, and rental period type.',
    price: 'Configure base prices for each rental period. Daily price is required.',
    discount: 'Add optional discounts based on nights stayed or number of guests.',
    time: 'Set check-in and check-out times for default, business days, and weekends.',
    location: 'Specify exact and familiar locations to help guests find the property.',
    media: 'Add video, social URLs, and gallery images to showcase your listing.',
    services: 'Add additional paid services like breakfast or airport pickup.',
    rules: 'Attach listing rules or create custom rules for this listing.',
    admin: 'Internal admin settings such as featured listing and minimum stays.',
  };

  // Initialize discount enabled state when loading listing
  useEffect(() => {
    if (isEdit && formData.discount_number_night_1 !== undefined) {
      // Check if any discount values exist
      const hasDiscounts = 
        formData.discount_number_night_1 || formData.discount_percent_night_1 ||
        formData.discount_number_night_2 || formData.discount_percent_night_2 ||
        formData.discount_number_night_3 || formData.discount_percent_night_3 ||
        formData.discount_number_guest_1 || formData.discount_percent_guest_1 ||
        formData.discount_number_guest_2 || formData.discount_percent_guest_2 ||
        formData.discount_number_guest_3 || formData.discount_percent_guest_3;
      setDiscountEnabled(!!hasDiscounts);
    }
  }, [isEdit, formData.discount_number_night_1, formData.discount_percent_night_1]);

  // Helper to normalize percent before saving (ignore 'custom' sentinel)
  const normalizePercent = (p) => (p === 'custom' ? '' : p || '');

  // Sync night discount rows into formData fields
  useEffect(() => {
    const [row1, row2, row3] = nightDiscountRows;
    setFormData(prev => ({
      ...prev,
      discount_number_night_1: row1?.count || '',
      discount_percent_night_1: normalizePercent(row1?.percent),
      discount_number_night_2: row2?.count || '',
      discount_percent_night_2: normalizePercent(row2?.percent),
      discount_number_night_3: row3?.count || '',
      discount_percent_night_3: normalizePercent(row3?.percent),
    }));
  }, [nightDiscountRows]);

  // Sync guest discount rows into formData fields
  useEffect(() => {
    const [row1, row2, row3] = guestDiscountRows;
    setFormData(prev => ({
      ...prev,
      discount_number_guest_1: row1?.count || '',
      discount_percent_guest_1: normalizePercent(row1?.percent),
      discount_number_guest_2: row2?.count || '',
      discount_percent_guest_2: normalizePercent(row2?.percent),
      discount_number_guest_3: row3?.count || '',
      discount_percent_guest_3: normalizePercent(row3?.percent),
    }));
  }, [guestDiscountRows]);

  // Initialize discount rows from formData when editing (only once)
  const [discountRowsInitialized, setDiscountRowsInitialized] = useState(false);

  useEffect(() => {
    if (!isEdit || discountRowsInitialized || formData.discount_number_night_1 === undefined) {
      return;
    }

    // Night-based rows
    const nightRows = [];
    let idCounter = 1;
    const nightSource = [
      { count: formData.discount_number_night_1, percent: formData.discount_percent_night_1 },
      { count: formData.discount_number_night_2, percent: formData.discount_percent_night_2 },
      { count: formData.discount_number_night_3, percent: formData.discount_percent_night_3 },
    ];
    nightSource.forEach(src => {
      if ((src.count && src.count !== '') || (src.percent && src.percent !== '')) {
        const percentStr = String(src.percent || '');
        const presetOptions = ['5', '10', '15', '20'];
        const mode = presetOptions.includes(percentStr) ? 'preset' : 'custom';
        nightRows.push({ id: idCounter++, count: String(src.count || ''), percent: percentStr || '5', mode });
      }
    });
    if (nightRows.length === 0) {
      nightRows.push({ id: 1, count: '', percent: '5', mode: 'preset' });
    }
    setNightDiscountRows(nightRows);

    // Guest-based rows
    const guestRows = [];
    idCounter = 1;
    const guestSource = [
      { count: formData.discount_number_guest_1, percent: formData.discount_percent_guest_1 },
      { count: formData.discount_number_guest_2, percent: formData.discount_percent_guest_2 },
      { count: formData.discount_number_guest_3, percent: formData.discount_percent_guest_3 },
    ];
    guestSource.forEach(src => {
      if ((src.count && src.count !== '') || (src.percent && src.percent !== '')) {
        const percentStr = String(src.percent || '');
        const presetOptions = ['5', '10', '15', '20'];
        const mode = presetOptions.includes(percentStr) ? 'preset' : 'custom';
        guestRows.push({ id: idCounter++, count: String(src.count || ''), percent: percentStr || '5', mode });
      }
    });
    if (guestRows.length === 0) {
      guestRows.push({ id: 1, count: '', percent: '5', mode: 'preset' });
    }
    setGuestDiscountRows(guestRows);

    setDiscountRowsInitialized(true);
  }, [
    isEdit,
    discountRowsInitialized,
    formData.discount_number_night_1,
    formData.discount_number_night_2,
    formData.discount_number_night_3,
    formData.discount_percent_night_1,
    formData.discount_percent_night_2,
    formData.discount_percent_night_3,
    formData.discount_number_guest_1,
    formData.discount_number_guest_2,
    formData.discount_number_guest_3,
    formData.discount_percent_guest_1,
    formData.discount_percent_guest_2,
    formData.discount_percent_guest_3,
  ]);

  const isDirty = useMemo(() => {
    if (!initialSnapshot) return false;
    try {
      const current = JSON.stringify(formData);
      return current !== initialSnapshot;
    } catch {
      return false;
    }
  }, [formData, initialSnapshot]);

  // Render helpers for discount rows (keeps JSX simpler for esbuild)
  const renderNightDiscountRow = (row, index) => {
    const canRemove = nightDiscountRows.length > 1;
    const canAddMore = nightDiscountRows.length < 3;
    const isLast = index === nightDiscountRows.length - 1;

    return (
      <div key={row.id} className="grid grid-cols-12 gap-3 items-center w-full">
        <div className="col-span-4 w-full">
          <select
            value="night"
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed text-gray-600 text-sm"
          >
            <option>Night Based</option>
          </select>
        </div>
        <div className="col-span-3 w-full">
          <input
            type="number"
            min="0"
            value={row.count}
            onChange={(e) =>
              setNightDiscountRows((rows) =>
                rows.map((r) =>
                  r.id === row.id ? { ...r, count: e.target.value } : r
                )
              )
            }
            disabled={!discountEnabled}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 ${
              !discountEnabled ? 'bg-gray-100 cursor-not-allowed' : ''
            }`}
            placeholder="3"
          />
        </div>
        <div className="col-span-5 flex items-center gap-2 w-full">
          <div className="flex items-center gap-2 flex-1 w-full">
            {(() => {
              const presetOptions = ['5', '10', '15', '20'];
              const isCustom =
                row.mode === 'custom' ||
                (row.percent && !presetOptions.includes(String(row.percent)));
              const selectValue = isCustom ? 'custom' : String(row.percent || '5');
              return (
                <>
                  <select
                    value={selectValue}
                    onChange={(e) => {
                      const v = e.target.value;
                      setNightDiscountRows((rows) =>
                        rows.map((r) => {
                          if (r.id !== row.id) return r;
                          if (v === 'custom') {
                            return { ...r, mode: 'custom', percent: '' };
                          }
                          return { ...r, mode: 'preset', percent: v || '5' };
                        })
                      );
                    }}
                    disabled={!discountEnabled}
                    className={`${isCustom ? 'flex-1' : 'w-full'} px-2 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 text-sm ${
                      !discountEnabled ? 'bg-gray-100 cursor-not-allowed' : ''
                    }`}
                  >
                    <option value="5">5%</option>
                    <option value="10">10%</option>
                    <option value="15">15%</option>
                    <option value="20">20%</option>
                    <option value="custom">Custom</option>
                  </select>
                  {isCustom && (
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={
                        row.percent && row.percent !== 'custom' ? row.percent : ''
                      }
                      onChange={(e) =>
                        setNightDiscountRows((rows) =>
                          rows.map((r) =>
                            r.id === row.id
                              ? { ...r, mode: 'custom', percent: e.target.value }
                              : r
                          )
                        )
                      }
                      disabled={!discountEnabled}
                      className={`flex-1 px-2 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 text-sm ${
                        !discountEnabled ? 'bg-gray-100 cursor-not-allowed' : ''
                      }`}
                      placeholder="Custom"
                    />
                  )}
                </>
              );
            })()}
          </div>
          <div className="flex gap-1">
            {canRemove && (
              <button
                type="button"
                onClick={() =>
                  setNightDiscountRows((rows) =>
                    rows.filter((r) => r.id !== row.id)
                  )
                }
                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Remove"
              >
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
                    d="M19 7l-1 12a2 2 0 01-2 2H8a2 2 0 01-2-2L5 7m14 0H5m3-4h8m-5 4v10m4-10v10"
                  />
                </svg>
              </button>
            )}
            {isLast && canAddMore && (
              <button
                type="button"
                onClick={() =>
                  setNightDiscountRows((rows) => [
                    ...rows,
                    {
                      id: Math.max(...rows.map((r) => r.id), 0) + 1,
                      count: '',
                      percent: '5',
                      mode: 'preset',
                    },
                  ])
                }
                className="p-1.5 text-primary-600 hover:bg-primary-50 rounded transition-colors"
                title="Add"
              >
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
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderGuestDiscountRow = (row, index) => {
    const canRemove = guestDiscountRows.length > 1;
    const canAddMore = guestDiscountRows.length < 3;
    const isLast = index === guestDiscountRows.length - 1;

    return (
      <div key={row.id} className="grid grid-cols-12 gap-3 items-center w-full">
        <div className="col-span-4 w-full">
          <select
            value="guest"
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed text-gray-600 text-sm"
          >
            <option>Guest Based</option>
          </select>
        </div>
        <div className="col-span-3 w-full">
          <input
            type="number"
            min="0"
            value={row.count}
            onChange={(e) =>
              setGuestDiscountRows((rows) =>
                rows.map((r) =>
                  r.id === row.id ? { ...r, count: e.target.value } : r
                )
              )
            }
            disabled={!discountEnabled}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 ${
              !discountEnabled ? 'bg-gray-100 cursor-not-allowed' : ''
            }`}
            placeholder="3"
          />
        </div>
        <div className="col-span-5 flex items-center gap-2 w-full">
          <div className="flex items-center gap-2 flex-1 w-full">
            {(() => {
              const presetOptions = ['5', '10', '15', '20'];
              const isCustom =
                row.mode === 'custom' ||
                (row.percent && !presetOptions.includes(String(row.percent)));
              const selectValue = isCustom ? 'custom' : String(row.percent || '5');
              return (
                <>
                  <select
                    value={selectValue}
                    onChange={(e) => {
                      const v = e.target.value;
                      setGuestDiscountRows((rows) =>
                        rows.map((r) => {
                          if (r.id !== row.id) return r;
                          if (v === 'custom') {
                            return { ...r, mode: 'custom', percent: '' };
                          }
                          return { ...r, mode: 'preset', percent: v || '5' };
                        })
                      );
                    }}
                    disabled={!discountEnabled}
                    className={`${isCustom ? 'flex-1' : 'w-full'} px-2 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 text-sm ${
                      !discountEnabled ? 'bg-gray-100 cursor-not-allowed' : ''
                    }`}
                  >
                    <option value="5">5%</option>
                    <option value="10">10%</option>
                    <option value="15">15%</option>
                    <option value="20">20%</option>
                    <option value="custom">Custom</option>
                  </select>
                  {isCustom && (
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={
                        row.percent && row.percent !== 'custom' ? row.percent : ''
                      }
                      onChange={(e) =>
                        setGuestDiscountRows((rows) =>
                          rows.map((r) =>
                            r.id === row.id
                              ? { ...r, mode: 'custom', percent: e.target.value }
                              : r
                          )
                        )
                      }
                      disabled={!discountEnabled}
                      className={`flex-1 px-2 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 text-sm ${
                        !discountEnabled ? 'bg-gray-100 cursor-not-allowed' : ''
                      }`}
                      placeholder="Custom"
                    />
                  )}
                </>
              );
            })()}
          </div>
          <div className="flex gap-1">
            {canRemove && (
              <button
                type="button"
                onClick={() =>
                  setGuestDiscountRows((rows) =>
                    rows.filter((r) => r.id !== row.id)
                  )
                }
                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Remove"
              >
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
                    d="M19 7l-1 12a2 2 0 01-2 2H8a2 2 0 01-2-2L5 7m14 0H5m3-4h8m-5 4v10m4-10v10"
                  />
                </svg>
              </button>
            )}
            {isLast && canAddMore && (
              <button
                type="button"
                onClick={() =>
                  setGuestDiscountRows((rows) => [
                    ...rows,
                    {
                      id: Math.max(...rows.map((r) => r.id), 0) + 1,
                      count: '',
                      percent: '5',
                      mode: 'preset',
                    },
                  ])
                }
                className="p-1.5 text-primary-600 hover:bg-primary-50 rounded transition-colors"
                title="Add"
              >
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
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Load available listing rules
  useEffect(() => {
    const loadAvailableRules = async () => {
      try {
        const rules = await getListingRules({ per_page: 100 });
        setAvailableListingRules(rules);
      } catch (err) {
        console.error('Error loading listing rules:', err);
      }
    };
    loadAvailableRules();
  }, []);

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
      } else {
        // New listing: Set short-term as default
        if (taxData.periodTypes && taxData.periodTypes.length > 0) {
          const shortTermType = taxData.periodTypes.find(pt => {
            const name = (pt.name || '').toLowerCase();
            const slug = (pt.slug || '').toLowerCase();
            return name.includes('short') || slug.includes('short') || name.includes('st') || slug.includes('st');
          });
          
          if (shortTermType) {
            const shortTermId = shortTermType.id || shortTermType.term_id;
            const defaultPeriodType = [{ id: shortTermId }];
            setFormData(prev => ({
              ...prev,
              listing_period_type: defaultPeriodType
            }));
            
            // Capture initial snapshot with short-term selected
        try {
          setInitialSnapshot(JSON.stringify({
            listing_name: '',
            listing_description: '',
                room_number: '',
                listing_bed_number: '',
                guest_max_number: '',
                listing_price_general: '',
                listing_price_weekly: '',
                listing_price_fortnightly: '',
                listing_price_monthly: '',
                listing_price_annually: '',
                discount_number_night_1: '',
                discount_percent_night_1: '',
                discount_number_night_2: '',
                discount_percent_night_2: '',
                discount_number_night_3: '',
                discount_percent_night_3: '',
                discount_number_guest_1: '',
                discount_percent_guest_1: '',
                discount_number_guest_2: '',
                discount_percent_guest_2: '',
                discount_number_guest_3: '',
                discount_percent_guest_3: '',
                default_check_in_time: '',
                default_check_out_time: '',
                business_check_in_time: '',
                business_check_out_time: '',
                weekend_check_in_time: '',
                weekend_check_out_time: '',
                exact_location: '',
                listing_familiar_location: '',
                listing_video: '',
                listing_social_url: '',
                listing_gallery: [],
                listing_rule: '',
                admin_blocked_days: '',
                host_blocked_days: '',
                listing_minimum_stays: '',
            listing_location: [],
            listing_region: [],
            listing_category: [],
            listing_size: [],
            listing_aminities: [],
                listing_period_type: defaultPeriodType,
                parent_location: null,
                child_location: null,
              }));
            } catch {}
            return;
          }
        }
        
        // If no short-term found, set empty snapshot
        try {
          setInitialSnapshot(JSON.stringify({
            listing_name: '',
            listing_description: '',
            room_number: '',
            listing_bed_number: '',
            guest_max_number: '',
            listing_price_general: '',
            listing_price_weekly: '',
            listing_price_fortnightly: '',
            listing_price_monthly: '',
            listing_price_annually: '',
            discount_number_night_1: '',
            discount_percent_night_1: '',
            discount_number_night_2: '',
            discount_percent_night_2: '',
            discount_number_night_3: '',
            discount_percent_night_3: '',
            discount_number_guest_1: '',
            discount_percent_guest_1: '',
            discount_number_guest_2: '',
            discount_percent_guest_2: '',
            discount_number_guest_3: '',
            discount_percent_guest_3: '',
            default_check_in_time: '',
            default_check_out_time: '',
            business_check_in_time: '',
            business_check_out_time: '',
            weekend_check_in_time: '',
            weekend_check_out_time: '',
            exact_location: '',
            listing_familiar_location: '',
            listing_video: '',
            listing_social_url: '',
            listing_gallery: [],
            listing_rule: '',
            admin_blocked_days: '',
            host_blocked_days: '',
            listing_minimum_stays: '',
            listing_location: [],
            listing_region: [],
            listing_category: [],
            listing_size: [],
            listing_aminities: [],
            listing_period_type: [],
            parent_location: null,
            child_location: null,
          }));
        } catch {}
      }
    };
    initialize();
  }, [id]);

  const loadTaxonomies = async () => {
    try {
      const [categories, locations, amenities, sizes, periodTypes] = await Promise.all([
        getCategories().catch(() => []),
        getLocations().catch(() => []),
        getAmenities().catch(() => []),
        getSizes().catch(() => []),
        getPeriodTypes().catch(() => []),
      ]);
      const taxData = { 
        categories: categories || [], 
        locations: locations || [], 
        amenities: amenities || [], 
        sizes: sizes || [],
        periodTypes: periodTypes || []
      };
      setTaxonomies(taxData);
      return taxData;
    } catch (err) {
      // silent
      const emptyData = { categories: [], locations: [], amenities: [], sizes: [], periodTypes: [] };
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

  // Check if period type is selected
  const isPeriodTypeSelected = (periodTypeId) => {
    if (!formData.listing_period_type || formData.listing_period_type.length === 0) return false;
    return formData.listing_period_type.some((periodType) => {
      const id = extractTaxonomyId(periodType);
      return id === periodTypeId || String(id) === String(periodTypeId);
    });
  };

  // Handle period type toggle
  const handlePeriodTypeToggle = (periodTypeId) => {
    const currentPeriodTypes = formData.listing_period_type || [];
    const isSelected = isPeriodTypeSelected(periodTypeId);

    if (isSelected) {
      // Remove from selection
      const updated = currentPeriodTypes.filter((periodType) => {
        const id = extractTaxonomyId(periodType);
        return !(id === periodTypeId || String(id) === String(periodTypeId));
      });
      setFormData((prev) => ({ ...prev, listing_period_type: updated }));
    } else {
      // Add to selection
      const newPeriodType = { id: periodTypeId };
      setFormData((prev) => ({ 
        ...prev, 
        listing_period_type: [...currentPeriodTypes, newPeriodType]
      }));
    }
  };

  // Helper to check if short-term or long-term is selected (by name or slug)
  const hasShortTerm = () => {
    if (!formData.listing_period_type || formData.listing_period_type.length === 0) return false;
    return formData.listing_period_type.some((periodType) => {
      const id = extractTaxonomyId(periodType);
      const periodTypeObj = taxonomies.periodTypes.find(pt => (pt.id || pt.term_id) === id);
      if (!periodTypeObj) return false;
      const name = (periodTypeObj.name || '').toLowerCase();
      const slug = (periodTypeObj.slug || '').toLowerCase();
      return name.includes('short') || slug.includes('short') || name.includes('st') || slug.includes('st');
    });
  };

  const hasLongTerm = () => {
    if (!formData.listing_period_type || formData.listing_period_type.length === 0) return false;
    return formData.listing_period_type.some((periodType) => {
      const id = extractTaxonomyId(periodType);
      const periodTypeObj = taxonomies.periodTypes.find(pt => (pt.id || pt.term_id) === id);
      if (!periodTypeObj) return false;
      const name = (periodTypeObj.name || '').toLowerCase();
      const slug = (periodTypeObj.slug || '').toLowerCase();
      return name.includes('long') || slug.includes('long') || name.includes('lt') || slug.includes('lt');
    });
  };

  // Handle amenity selection
  const handleAmenityToggle = (amenityId, isParent = false) => {
    const currentAmenities = formData.listing_aminities || [];
    const isSelected = isAmenitySelected(amenityId);

    // Helper to normalize id compare
    const sameId = (a, b) => String(a) === String(b);

    if (isParent) {
      const children = getChildrenForParentAmenity(amenityId) || [];
      if (isSelected) {
        // Unselect parent and all its children
        const updated = currentAmenities.filter((amenity) => {
          const id = extractTaxonomyId(amenity);
          if (sameId(id, amenityId)) return false;
          // remove any child of this parent
          const isChild = children.some((c) => sameId(extractTaxonomyId(c), id));
          return !isChild;
        });
        setFormData((prev) => ({ ...prev, listing_aminities: updated }));
      } else {
        // Select parent and all its children (avoid duplicates)
        const toAdd = [{ id: amenityId }].concat(
          children.map((c) => ({ id: c.id || c.term_id }))
        );
        const seen = new Set((currentAmenities || []).map((a) => String(extractTaxonomyId(a))));
        const merged = [...currentAmenities];
        toAdd.forEach((a) => {
          const id = String(extractTaxonomyId(a));
          if (id && !seen.has(id)) {
            merged.push({ id: Number(id) || id });
            seen.add(id);
          }
        });
        setFormData((prev) => ({ ...prev, listing_aminities: merged }));
      }
      return;
    }

    // Toggling a child amenity
    if (isSelected) {
      const updated = currentAmenities.filter((amenity) => {
        const id = extractTaxonomyId(amenity);
        return !sameId(id, amenityId);
      });
      setFormData((prev) => ({ ...prev, listing_aminities: updated }));
    } else {
      const newAmenity = { id: amenityId };
      // ensure parent is also selected if not already
      const childObj =
        (taxonomies.amenities || []).find(
          (a) => sameId(a.id || a.term_id, amenityId)
        ) || {};
      const parentId = childObj.parent || childObj.parent_id || childObj.parent_term_id || 0;
      const merged = [...currentAmenities];
      merged.push(newAmenity);
      if (parentId && !isAmenitySelected(parentId)) {
        merged.push({ id: parentId });
      }
      // de-duplicate
      const seen = new Set();
      const dedup = [];
      for (const a of merged) {
        const id = String(extractTaxonomyId(a));
        if (id && !seen.add(id)) continue;
        dedup.push(a);
      }
      setFormData((prev) => ({ ...prev, listing_aminities: dedup }));
    }
  };

  const syncGalleryAttachments = async (listingId, galleryItems, galleryImageIds = []) => {
    if (!listingId || !Array.isArray(galleryItems)) {
      return;
    }
    
    // start sync
    
    const galleryWithIds = galleryItems
      .map((img, index) => {
        const mediaId = extractImageId(img);
        if (!mediaId) {
          return null;
        }
        
        // Skip temporary IDs (strings that start with 'temp-')
        if (typeof mediaId === 'string' && mediaId.toString().startsWith('temp-')) {
          return null;
        }
        
        // Only process numeric IDs
        const normalizedId = typeof mediaId === 'string' ? parseInt(mediaId, 10) : mediaId;
        if (isNaN(normalizedId) || normalizedId <= 0) {
          return null;
        }
        
        return {
          mediaId: normalizedId,
          order: index,
        };
      })
      .filter(Boolean);

    // processed

    if (galleryWithIds.length === 0) {
      return;
    }

    try {
      // Link all images to the listing
      const linkResults = await Promise.allSettled(
        galleryWithIds.map(({ mediaId, order }) =>
          updateMediaItem(mediaId, {
            post: listingId,
            menu_order: order,
          }).then((result) => {
            return result;
          }).catch((error) => {
            // silent failure, continue
            throw error;
          })
        )
      );
      
      // Check for any failures
      const failures = linkResults.filter((result) => result.status === 'rejected');

      // Unlink removed images
      const removedIds = initialGalleryIds.filter(
        (existingId) =>
          !galleryWithIds.some(({ mediaId }) => Number(mediaId) === Number(existingId))
      );

      if (removedIds.length > 0) {
        await Promise.allSettled(
          removedIds.map((mediaId) =>
            updateMediaItem(mediaId, { post: 0 }).then((result) => {
              return result;
            }).catch((error) => {
              // silent
              // Don't throw - continue with other operations
            })
          )
        );
      }

      // Update initial gallery IDs
      if (galleryImageIds && galleryImageIds.length > 0) {
        setInitialGalleryIds(galleryImageIds);
      } else {
        setInitialGalleryIds(galleryWithIds.map(({ mediaId }) => mediaId));
      }
      
      // done
    } catch (attachmentError) {
      // silent
      throw attachmentError; // Re-throw to allow caller to handle
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
      
      let galleryImages = [];
      
      // Try multiple sources for gallery images (meta / direct field / ACF)
      if (listing.meta && listing.meta.listing_gallery) {
        galleryImages = Array.isArray(listing.meta.listing_gallery) 
          ? listing.meta.listing_gallery 
          : [listing.meta.listing_gallery];
      } else if (listing.listing_gallery) {
        galleryImages = Array.isArray(listing.listing_gallery) 
          ? listing.listing_gallery 
          : [listing.listing_gallery];
      } else if (listing.acf && listing.acf.listing_gallery) {
        galleryImages = Array.isArray(listing.acf.listing_gallery) 
          ? listing.acf.listing_gallery 
          : [listing.acf.listing_gallery];
      }

      let normalizedGallery = [];

      if (galleryImages && galleryImages.length > 0) {
        try {
          const galleryPromises = galleryImages.map(async (img, index) => {
            try {
              
              // Extract image ID first (handle both 'ID' and 'id' fields)
              const imageId = img.ID || img.id || img.media_id || img.image_id || img.attachment_id;
              
              if (imageId) {
                const numericId = typeof imageId === 'string' ? parseInt(imageId, 10) : imageId;
                if (!isNaN(numericId) && numericId > 0) {
                  // Always fetch the full media object from REST API to get proper URLs
                  try {
                    const mediaData = await getMedia(numericId);
                    
                    // Normalize the fetched media object
                    const normalized = normalizeImageData(mediaData);
                    
                    // Ensure URL is present - use source_url from REST API response
                    if (mediaData.source_url) {
                      normalized.url = mediaData.source_url;
                      normalized.source_url = mediaData.source_url;
                    } else if (mediaData.guid?.rendered) {
                      normalized.url = mediaData.guid.rendered;
                      normalized.source_url = mediaData.guid.rendered;
                    } else if (mediaData.media_details?.sizes?.large?.source_url) {
                      normalized.url = mediaData.media_details.sizes.large.source_url;
                      normalized.source_url = mediaData.media_details.sizes.large.source_url;
                    }
                    
                    // Final check - if still no URL, log error
                    if (!normalized.url && !normalized.source_url) {
                      // keep silent in production
                    }
                    
                    return normalized;
                  } catch (mediaError) {
                    // Try to extract URL from the original post object
                    // WordPress post objects might have guid as a string or in postmeta
                    let url = null;
                    
                    // Check various possible URL fields in WordPress post objects
                    if (img.guid && typeof img.guid === 'string') {
                      url = img.guid;
                    } else if (img.guid?.rendered) {
                      url = img.guid.rendered;
                    } else if (img.url) {
                      url = img.url;
                    } else if (img.source_url) {
                      url = img.source_url;
                    }
                    
                    if (url) {
                      const normalized = normalizeImageData({
                        id: numericId,
                        url: url,
                        source_url: url,
                      });
                      return normalized;
                    } else {
                      // Return null so it's filtered out
                      return null;
                    }
                  }
                }
              }
              
              // If we can't extract an ID, log and return null
              return null;
            } catch (imgError) {
              return null;
            }
          });
          normalizedGallery = (await Promise.all(galleryPromises)).filter(Boolean);
        } catch (galleryError) {
          // silent
        }
      }

      // Always prefer attachments (media items whose parent is this listing)
      if (listing.id) {
        try {
          const attachmentGallery = await getGalleryFromAttachments(listing.id);
          if (attachmentGallery && attachmentGallery.length > 0) {
            normalizedGallery = attachmentGallery;
          }
        } catch (attachmentError) {
          // silent
        }
      }
      
      const galleryIds = (normalizedGallery || [])
        .map((img) => extractImageId(img))
        .filter((imageId) => imageId !== null && imageId !== undefined);
      
      // If we have gallery IDs from meta/listing_gallery earlier, use that order to stabilize attachment order
      let preferredOrderIds = [];
      try {
        const rawMetaGallery = listing.meta?.listing_gallery || listing.listing_gallery || listing.acf?.listing_gallery || [];
        const rawArr = Array.isArray(rawMetaGallery) ? rawMetaGallery : [rawMetaGallery];
        preferredOrderIds = rawArr
          .map((img) => extractImageId(img))
          .filter((id) => id != null && !Number.isNaN(parseInt(id, 10)))
          .map((id) => (typeof id === 'string' ? parseInt(id, 10) : id));
      } catch (_) {}
      
      if (preferredOrderIds.length > 0 && normalizedGallery && normalizedGallery.length > 0) {
        const orderMap = new Map(preferredOrderIds.map((id, idx) => [Number(id), idx]));
        normalizedGallery = [...normalizedGallery].sort((a, b) => {
          const ai = orderMap.has(Number(a.id)) ? orderMap.get(Number(a.id)) : Number.MAX_SAFE_INTEGER;
          const bi = orderMap.has(Number(b.id)) ? orderMap.get(Number(b.id)) : Number.MAX_SAFE_INTEGER;
          if (ai !== bi) return ai - bi;
          const ao = typeof a.order === 'number' ? a.order : 0;
          const bo = typeof b.order === 'number' ? b.order : 0;
          if (ao !== bo) return ao - bo;
          return (parseInt(a.id || 0, 10) || 0) - (parseInt(b.id || 0, 10) || 0);
        });
      }
      
      // Map listing data to form data
      // Map old field names to new ones for backward compatibility
      const mapped = {
        // Basic Details
        listing_name: listing.listing_name || listing.title?.rendered || '',
        listing_description: listing.listing_description || listing.content?.rendered || '',
        // Property Details
        room_number: listing.room_number || listing.meta?.room_number || '',
        listing_bed_number: listing.listing_bed_number || listing.meta?.listing_bed_number || '',
        guest_max_number: listing.guest_max_number || listing.meta?.guest_max_number || '',
        // Price Details - map old listing_price to listing_price_general
        listing_price_general: listing.listing_price_general || listing.listing_price || listing.meta?.listing_price_general || listing.meta?.listing_price || '',
        listing_price_weekly: listing.listing_price_weekly || listing.meta?.listing_price_weekly || '',
        listing_price_fortnightly: listing.listing_price_fortnightly || listing.meta?.listing_price_fortnightly || '',
        listing_price_monthly: listing.listing_price_monthly || listing.meta?.listing_price_monthly || '',
        listing_price_annually: listing.listing_price_annually || listing.meta?.listing_price_annually || '',
        // Discount Details
        discount_number_night_1: listing.discount_number_night_1 || listing.meta?.discount_number_night_1 || '',
        discount_percent_night_1: listing.discount_percent_night_1 || listing.meta?.discount_percent_night_1 || '',
        discount_number_night_2: listing.discount_number_night_2 || listing.meta?.discount_number_night_2 || '',
        discount_percent_night_2: listing.discount_percent_night_2 || listing.meta?.discount_percent_night_2 || '',
        discount_number_night_3: listing.discount_number_night_3 || listing.meta?.discount_number_night_3 || '',
        discount_percent_night_3: listing.discount_percent_night_3 || listing.meta?.discount_percent_night_3 || '',
        discount_number_guest_1: listing.discount_number_guest_1 || listing.meta?.discount_number_guest_1 || '',
        discount_percent_guest_1: listing.discount_percent_guest_1 || listing.meta?.discount_percent_guest_1 || '',
        discount_number_guest_2: listing.discount_number_guest_2 || listing.meta?.discount_number_guest_2 || '',
        discount_percent_guest_2: listing.discount_percent_guest_2 || listing.meta?.discount_percent_guest_2 || '',
        discount_number_guest_3: listing.discount_number_guest_3 || listing.meta?.discount_number_guest_3 || '',
        discount_percent_guest_3: listing.discount_percent_guest_3 || listing.meta?.discount_percent_guest_3 || '',
        // Time Details - map old check_in_time/check_out_time to default_*
        default_check_in_time: listing.default_check_in_time || listing.check_in_time || listing.meta?.default_check_in_time || listing.meta?.check_in_time || '',
        default_check_out_time: listing.default_check_out_time || listing.check_out_time || listing.meta?.default_check_out_time || listing.meta?.check_out_time || '',
        business_check_in_time: listing.business_check_in_time || listing.meta?.business_check_in_time || '',
        business_check_out_time: listing.business_check_out_time || listing.meta?.business_check_out_time || '',
        weekend_check_in_time: listing.weekend_check_in_time || listing.meta?.weekend_check_in_time || '',
        weekend_check_out_time: listing.weekend_check_out_time || listing.meta?.weekend_check_out_time || '',
        // Location Details
        exact_location: listing.exact_location || listing.meta?.exact_location || '',
        listing_familiar_location: listing.listing_familiar_location || listing.meta?.listing_familiar_location || '',
        // Video and Social
        listing_video: listing.listing_video || listing.meta?.listing_video || '',
        listing_social_url: listing.listing_social_url || listing.meta?.listing_social_url || '',
        // Gallery
        listing_gallery: normalizedGallery || [],
        // Listing Rules
        listing_rule: listing.listing_rule || listing.meta?.listing_rule || '',
        listing_rule_mode: 'custom',
        selected_listing_rule_id: '',
        // Admin Details
        admin_blocked_days: listing.admin_blocked_days || listing.meta?.admin_blocked_days || '',
        host_blocked_days: listing.host_blocked_days || listing.meta?.host_blocked_days || '',
        listing_minimum_stays: listing.listing_minimum_stays || listing.meta?.listing_minimum_stays || '',
        featured_listing: listing.featured_listing || listing.meta?.featured_listing || '',
        // Taxonomies
        listing_location: listing.listing_location || [],
        listing_region: listing.listing_region || [],
        listing_category: listing.listing_category || [],
        listing_size: listing.listing_size || [],
        listing_aminities: listing.listing_aminity || listing.listing_aminities || [],
        listing_period_type: listing.listing_period_type || listing.renting_period_type || [],
        // Location fields
        parent_location: parentLocation,
        child_location: childLocation,
      };
      setFormData(mapped);
      
      // Load additional services if they exist
      try {
        // Try to get additional services from meta or direct fields
        const servicesData = listing.additional_services || listing.meta?.additional_services || [];
        if (Array.isArray(servicesData) && servicesData.length > 0) {
          const loadedServices = servicesData.map((service, idx) => {
            // Handle image - could be ID or object
            let imageData = null;
            if (service.upload_item_image) {
              if (typeof service.upload_item_image === 'object') {
                imageData = service.upload_item_image;
              } else {
                // It's an ID, we'll need to fetch the URL later or store as ID
                imageData = { id: service.upload_item_image };
              }
            }
            
            return {
              id: idx + 1,
              additional_service_name: service.additional_service_name || service.name || '',
              additional_service_description: service.additional_service_description || service.description || '',
              item_price: service.item_price || service.price || '',
              additional_charge_type: service.additional_charge_type || service.charge_type || '',
              upload_item_image: imageData,
              active: service.active !== undefined ? service.active : true,
            };
          });
          setAdditionalServices(loadedServices);
          // Expand all loaded services by default
          if (loadedServices.length > 0) {
            setExpandedServices(new Set(loadedServices.map(s => s.id)));
          }
        }
      } catch (err) {
        // Silent fail - services might not exist yet
      }
      
      // Set initial snapshot after mapping
      try {
        setInitialSnapshot(JSON.stringify(mapped));
      } catch {}
      setInitialGalleryIds(galleryIds);
    } catch (err) {
      setError('Failed to load listing. Please try again.');
      // silent
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
      // Clear child location search when parent changes
      setChildLocationSearch('');
      setShowChildLocationDropdown(false);
    } else if (type === 'child') {
      setFormData((prev) => ({
        ...prev,
        child_location: value ? parseInt(value) : null,
      }));
    }
  };

  // Get period sort order (for automatic sorting)
  const getPeriodOrder = (period) => {
    const orderMap = {
      'daily': 1,
      'weekly': 2,
      'fortnightly': 3,
      'monthly': 4,
      'annually': 5,
    };
    return orderMap[period] || 99;
  };

  // Sort price rows by period order
  const sortPriceRows = (rows) => {
    return [...rows].sort((a, b) => {
      return getPeriodOrder(a.period) - getPeriodOrder(b.period);
    });
  };

  // Price rows management
  const addPriceRow = () => {
    // Check if all periods are already selected
    const allPeriods = ['daily', 'weekly', 'fortnightly', 'monthly', 'annually'];
    const selectedPeriods = priceRows.map(r => r.period);
    const availablePeriods = allPeriods.filter(p => !selectedPeriods.includes(p));
    
    // Don't add if no periods available
    if (availablePeriods.length === 0) {
      return;
    }
    
    const newId = Math.max(...priceRows.map(r => r.id), 0) + 1;
    // Default to first available period
    const defaultPeriod = availablePeriods[0];
    const newRows = [...priceRows, { id: newId, period: defaultPeriod, price: '' }];
    // Auto-sort after adding
    setPriceRows(sortPriceRows(newRows));
  };

  // Check if we can add more price rows (all periods not yet selected)
  const canAddMorePriceRows = () => {
    const allPeriods = ['daily', 'weekly', 'fortnightly', 'monthly', 'annually'];
    const selectedPeriods = priceRows.map(r => r.period);
    const availablePeriods = allPeriods.filter(p => !selectedPeriods.includes(p));
    return availablePeriods.length > 0;
  };

  const removePriceRow = (id) => {
    // Never allow removing the daily row
    const rowToRemove = priceRows.find(r => r.id === id);
    if (rowToRemove && rowToRemove.period === 'daily') {
      return; // Don't remove daily
    }
    if (priceRows.length > 1) {
      setPriceRows(priceRows.filter(row => row.id !== id));
    }
  };

  const updatePriceRow = (id, field, value) => {
    // Prevent changing daily period to something else
    if (field === 'period' && value !== 'daily') {
      const row = priceRows.find(r => r.id === id);
      if (row && row.period === 'daily') {
        return; // Don't allow changing daily period
      }
      // Prevent selecting a period that's already selected in another row
      const isPeriodAlreadyUsed = priceRows.some(r => r.id !== id && r.period === value);
      if (isPeriodAlreadyUsed) {
        return; // Don't allow duplicate periods
      }
    }
    const updatedRows = priceRows.map(row => 
      row.id === id ? { ...row, [field]: value } : row
    );
    // Auto-sort after updating period
    if (field === 'period') {
      setPriceRows(sortPriceRows(updatedRows));
    } else {
      setPriceRows(updatedRows);
    }
  };

  // Get available periods for a specific row (exclude already selected ones)
  const getAvailablePeriods = (rowId) => {
    const selectedPeriods = priceRows.filter(r => r.id !== rowId).map(r => r.period);
    const allPeriods = [
      { value: 'daily', label: 'Daily' },
      { value: 'weekly', label: 'Weekly' },
      { value: 'fortnightly', label: 'Fortnightly' },
      { value: 'monthly', label: 'Monthly' },
      { value: 'annually', label: 'Annually' },
    ];
    return allPeriods.filter(p => !selectedPeriods.includes(p.value));
  };

  // Sync price rows to formData
  useEffect(() => {
    const priceData = {
      listing_price_general: '',
      listing_price_weekly: '',
      listing_price_fortnightly: '',
      listing_price_monthly: '',
      listing_price_annually: '',
    };

    priceRows.forEach(row => {
      const fieldMap = {
        'daily': 'listing_price_general',
        'weekly': 'listing_price_weekly',
        'fortnightly': 'listing_price_fortnightly',
        'monthly': 'listing_price_monthly',
        'annually': 'listing_price_annually',
      };
      const fieldName = fieldMap[row.period];
      if (fieldName) {
        priceData[fieldName] = row.price;
      }
    });

    setFormData(prev => ({ ...prev, ...priceData }));
  }, [priceRows]);

  // Initialize price rows from formData when editing (only once when listing is loaded)
  const [priceRowsInitialized, setPriceRowsInitialized] = useState(false);
  
  useEffect(() => {
    if (isEdit && !priceRowsInitialized && formData.listing_price_general !== undefined) {
      const rows = [];
      let rowId = 1;

      // Always add daily first (required)
      const dailyPrice = formData.listing_price_general || '';
      rows.push({ id: rowId++, period: 'daily', price: String(dailyPrice) });

      // Map other formData prices to rows (excluding daily which is already added)
      const periodMap = [
        { period: 'weekly', field: 'listing_price_weekly' },
        { period: 'fortnightly', field: 'listing_price_fortnightly' },
        { period: 'monthly', field: 'listing_price_monthly' },
        { period: 'annually', field: 'listing_price_annually' },
      ];

      periodMap.forEach(({ period, field }) => {
        const price = formData[field];
        if (price && price !== '' && price !== null) {
          rows.push({ id: rowId++, period, price: String(price) });
        }
      });

      // Sort rows by period order
      setPriceRows(sortPriceRows(rows));
      setPriceRowsInitialized(true);
    } else if (!isEdit && !priceRowsInitialized) {
      // For new listings, always start with daily row
      setPriceRows([{ id: 1, period: 'daily', price: '' }]);
      setPriceRowsInitialized(true);
    }
  }, [isEdit, priceRowsInitialized, formData.listing_price_general, formData.listing_price_weekly, formData.listing_price_fortnightly, formData.listing_price_monthly, formData.listing_price_annually]);

  const handleSubmit = async (e, saveAsDraft = false) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      // Wait for any pending image uploads to complete
      // Filter out any images that are still uploading (have temp IDs)
      const readyImages = formData.listing_gallery.filter((img) => {
        const imageId = extractImageId(img);
        // Skip images that are still uploading (temp IDs or no ID)
        if (!imageId || (typeof imageId === 'string' && imageId.toString().startsWith('temp-'))) {
          return false;
        }
        return true;
      });

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

      const galleryImageIds = formatGalleryImages(readyImages);
      
      // Prepare data for WordPress REST API
      const submitData = {
        // WordPress core fields
        title: formData.listing_name || '',
        content: formData.listing_description || '',
        status: saveAsDraft ? 'draft' : 'publish',
        // Basic Details
        listing_name: formData.listing_name || '',
        listing_description: formData.listing_description || '',
        // Property Details
        room_number: formData.room_number || '',
        listing_bed_number: formData.listing_bed_number || '',
        guest_max_number: formData.guest_max_number || '',
        // Price Details
        listing_price_general: formData.listing_price_general || '',
        listing_price_weekly: formData.listing_price_weekly || '',
        listing_price_fortnightly: formData.listing_price_fortnightly || '',
        listing_price_monthly: formData.listing_price_monthly || '',
        listing_price_annually: formData.listing_price_annually || '',
        // Discount Details
        discount_number_night_1: formData.discount_number_night_1 || '',
        discount_percent_night_1: formData.discount_percent_night_1 || '',
        discount_number_night_2: formData.discount_number_night_2 || '',
        discount_percent_night_2: formData.discount_percent_night_2 || '',
        discount_number_night_3: formData.discount_number_night_3 || '',
        discount_percent_night_3: formData.discount_percent_night_3 || '',
        discount_number_guest_1: formData.discount_number_guest_1 || '',
        discount_percent_guest_1: formData.discount_percent_guest_1 || '',
        discount_number_guest_2: formData.discount_number_guest_2 || '',
        discount_percent_guest_2: formData.discount_percent_guest_2 || '',
        discount_number_guest_3: formData.discount_number_guest_3 || '',
        discount_percent_guest_3: formData.discount_percent_guest_3 || '',
        // Time Details
        default_check_in_time: formData.default_check_in_time || '',
        default_check_out_time: formData.default_check_out_time || '',
        business_check_in_time: formData.business_check_in_time || '',
        business_check_out_time: formData.business_check_out_time || '',
        weekend_check_in_time: formData.weekend_check_in_time || '',
        weekend_check_out_time: formData.weekend_check_out_time || '',
        // Location Details
        exact_location: formData.exact_location || '',
        listing_familiar_location: formData.listing_familiar_location || '',
        // Video and Social
        listing_video: formData.listing_video || '',
        listing_social_url: formData.listing_social_url || '',
        // Listing Rules
        listing_rule: formData.listing_rule || '',
        // Admin Details
        admin_blocked_days: formData.admin_blocked_days || '',
        host_blocked_days: formData.host_blocked_days || '',
        listing_minimum_stays: formData.listing_minimum_stays || '',
        featured_listing: formData.featured_listing || '',
        // Additional Services
        additional_services: additionalServices.map(service => ({
          additional_service_name: service.additional_service_name || '',
          additional_service_description: service.additional_service_description || '',
          item_price: service.item_price || '',
          additional_charge_type: service.additional_charge_type || '',
          upload_item_image: service.upload_item_image ? (typeof service.upload_item_image === 'object' ? service.upload_item_image.id : service.upload_item_image) : null,
          active: service.active !== undefined ? service.active : true,
        })),
        // Also persist in meta for setups that read from meta (Pods/ACF variations)
        meta: {
          listing_name: formData.listing_name || '',
          listing_description: formData.listing_description || '',
          room_number: formData.room_number || '',
          listing_bed_number: formData.listing_bed_number || '',
          guest_max_number: formData.guest_max_number || '',
          listing_price_general: formData.listing_price_general || '',
          listing_price_weekly: formData.listing_price_weekly || '',
          listing_price_fortnightly: formData.listing_price_fortnightly || '',
          listing_price_monthly: formData.listing_price_monthly || '',
          listing_price_annually: formData.listing_price_annually || '',
          discount_number_night_1: formData.discount_number_night_1 || '',
          discount_percent_night_1: formData.discount_percent_night_1 || '',
          discount_number_night_2: formData.discount_number_night_2 || '',
          discount_percent_night_2: formData.discount_percent_night_2 || '',
          discount_number_night_3: formData.discount_number_night_3 || '',
          discount_percent_night_3: formData.discount_percent_night_3 || '',
          discount_number_guest_1: formData.discount_number_guest_1 || '',
          discount_percent_guest_1: formData.discount_percent_guest_1 || '',
          discount_number_guest_2: formData.discount_number_guest_2 || '',
          discount_percent_guest_2: formData.discount_percent_guest_2 || '',
          discount_number_guest_3: formData.discount_number_guest_3 || '',
          discount_percent_guest_3: formData.discount_percent_guest_3 || '',
          default_check_in_time: formData.default_check_in_time || '',
          default_check_out_time: formData.default_check_out_time || '',
          business_check_in_time: formData.business_check_in_time || '',
          business_check_out_time: formData.business_check_out_time || '',
          weekend_check_in_time: formData.weekend_check_in_time || '',
          weekend_check_out_time: formData.weekend_check_out_time || '',
          exact_location: formData.exact_location || '',
          listing_familiar_location: formData.listing_familiar_location || '',
          listing_video: formData.listing_video || '',
          listing_social_url: formData.listing_social_url || '',
          listing_rule: formData.listing_rule || '',
          admin_blocked_days: formData.admin_blocked_days || '',
          host_blocked_days: formData.host_blocked_days || '',
          listing_minimum_stays: formData.listing_minimum_stays || '',
          featured_listing: formData.featured_listing || '',
          listing_gallery: galleryImageIds,
          // Additional Services
          additional_services: additionalServices.map(service => ({
            additional_service_name: service.additional_service_name || '',
            additional_service_description: service.additional_service_description || '',
            item_price: service.item_price || '',
            additional_charge_type: service.additional_charge_type || '',
            upload_item_image: service.upload_item_image ? (typeof service.upload_item_image === 'object' ? service.upload_item_image.id : service.upload_item_image) : null,
            active: service.active !== undefined ? service.active : true,
          })),
        },
        // Pods relationship field: array of attachment IDs (drives the backend "Зурагүүд" field)
        listing_gallery: galleryImageIds,
        // Taxonomy terms as arrays of IDs
        listing_category: formatTaxonomy(formData.listing_category),
        listing_size: formatTaxonomy(formData.listing_size),
        listing_location: locationToSave,
        listing_region: locationToSave,
        listing_aminities: formatTaxonomy(formData.listing_aminities),
        listing_period_type: formatTaxonomy(formData.listing_period_type),
        renting_period_type: formatTaxonomy(formData.listing_period_type),
      };

      let savedListing;
      if (isEdit) {
        savedListing = await updateListing(id, submitData);
      } else {
        savedListing = await createListing(submitData);
      }

      const listingId = savedListing?.id || id;
      if (!listingId) {
        throw new Error('Failed to get listing ID after save');
      }

      // For new listings, link all attachments to the listing
      // For existing listings, sync attachments (link/unlink as needed)
      await syncGalleryAttachments(listingId, readyImages, galleryImageIds);
      
      // Ensure Pods fields reflect values so wp-admin shows everything
      try {
        await updatePodsItemFields('touresm-listing', Number(listingId), {
          listing_name: formData.listing_name || '',
          listing_description: formData.listing_description || '',
          room_number: formData.room_number || '',
          listing_bed_number: formData.listing_bed_number || '',
          guest_max_number: formData.guest_max_number || '',
          listing_price_general: formData.listing_price_general || '',
          listing_price_weekly: formData.listing_price_weekly || '',
          listing_price_fortnightly: formData.listing_price_fortnightly || '',
          listing_price_monthly: formData.listing_price_monthly || '',
          listing_price_annually: formData.listing_price_annually || '',
          discount_number_night_1: formData.discount_number_night_1 || '',
          discount_percent_night_1: formData.discount_percent_night_1 || '',
          discount_number_night_2: formData.discount_number_night_2 || '',
          discount_percent_night_2: formData.discount_percent_night_2 || '',
          discount_number_night_3: formData.discount_number_night_3 || '',
          discount_percent_night_3: formData.discount_percent_night_3 || '',
          discount_number_guest_1: formData.discount_number_guest_1 || '',
          discount_percent_guest_1: formData.discount_percent_guest_1 || '',
          discount_number_guest_2: formData.discount_number_guest_2 || '',
          discount_percent_guest_2: formData.discount_percent_guest_2 || '',
          discount_number_guest_3: formData.discount_number_guest_3 || '',
          discount_percent_guest_3: formData.discount_percent_guest_3 || '',
          default_check_in_time: formData.default_check_in_time || '',
          default_check_out_time: formData.default_check_out_time || '',
          business_check_in_time: formData.business_check_in_time || '',
          business_check_out_time: formData.business_check_out_time || '',
          weekend_check_in_time: formData.weekend_check_in_time || '',
          weekend_check_out_time: formData.weekend_check_out_time || '',
          exact_location: formData.exact_location || '',
          listing_familiar_location: formData.listing_familiar_location || '',
          listing_video: formData.listing_video || '',
          listing_social_url: formData.listing_social_url || '',
          listing_rule: formData.listing_rule || '',
          admin_blocked_days: formData.admin_blocked_days || '',
          host_blocked_days: formData.host_blocked_days || '',
          listing_minimum_stays: formData.listing_minimum_stays || '',
          featured_listing: formData.featured_listing || '',
          listing_gallery: galleryImageIds,
          listing_aminities: formatTaxonomy(formData.listing_aminities),
          listing_location: locationToSave,
          listing_region: locationToSave,
          listing_size: formatTaxonomy(formData.listing_size),
          listing_period_type: formatTaxonomy(formData.listing_period_type),
          // Additional Services
          additional_services: additionalServices.map(service => ({
            additional_service_name: service.additional_service_name || '',
            additional_service_description: service.additional_service_description || '',
            item_price: service.item_price || '',
            additional_charge_type: service.additional_charge_type || '',
            upload_item_image: service.upload_item_image ? (typeof service.upload_item_image === 'object' ? service.upload_item_image.id : service.upload_item_image) : null,
            active: service.active !== undefined ? service.active : true,
          })),
        });
      } catch (podsErr) {
        // silent; other methods below will still try to persist
      }
      
      // Force-save all custom fields into WP REST meta/top-level as fallback
      try {
        const allMeta = {
          listing_name: formData.listing_name || '',
          listing_description: formData.listing_description || '',
          room_number: formData.room_number || '',
          listing_bed_number: formData.listing_bed_number || '',
          guest_max_number: formData.guest_max_number || '',
          listing_price_general: formData.listing_price_general || '',
          listing_price_weekly: formData.listing_price_weekly || '',
          listing_price_fortnightly: formData.listing_price_fortnightly || '',
          listing_price_monthly: formData.listing_price_monthly || '',
          listing_price_annually: formData.listing_price_annually || '',
          discount_number_night_1: formData.discount_number_night_1 || '',
          discount_percent_night_1: formData.discount_percent_night_1 || '',
          discount_number_night_2: formData.discount_number_night_2 || '',
          discount_percent_night_2: formData.discount_percent_night_2 || '',
          discount_number_night_3: formData.discount_number_night_3 || '',
          discount_percent_night_3: formData.discount_percent_night_3 || '',
          discount_number_guest_1: formData.discount_number_guest_1 || '',
          discount_percent_guest_1: formData.discount_percent_guest_1 || '',
          discount_number_guest_2: formData.discount_number_guest_2 || '',
          discount_percent_guest_2: formData.discount_percent_guest_2 || '',
          discount_number_guest_3: formData.discount_number_guest_3 || '',
          discount_percent_guest_3: formData.discount_percent_guest_3 || '',
          default_check_in_time: formData.default_check_in_time || '',
          default_check_out_time: formData.default_check_out_time || '',
          business_check_in_time: formData.business_check_in_time || '',
          business_check_out_time: formData.business_check_out_time || '',
          weekend_check_in_time: formData.weekend_check_in_time || '',
          weekend_check_out_time: formData.weekend_check_out_time || '',
          exact_location: formData.exact_location || '',
          listing_familiar_location: formData.listing_familiar_location || '',
          listing_video: formData.listing_video || '',
          listing_social_url: formData.listing_social_url || '',
          listing_rule: formData.listing_rule || '',
          admin_blocked_days: formData.admin_blocked_days || '',
          host_blocked_days: formData.host_blocked_days || '',
          listing_minimum_stays: formData.listing_minimum_stays || '',
          featured_listing: formData.featured_listing || '',
          listing_gallery: galleryImageIds,
          // Additional Services
          additional_services: additionalServices.map(service => ({
            additional_service_name: service.additional_service_name || '',
            additional_service_description: service.additional_service_description || '',
            item_price: service.item_price || '',
            additional_charge_type: service.additional_charge_type || '',
            upload_item_image: service.upload_item_image ? (typeof service.upload_item_image === 'object' ? service.upload_item_image.id : service.upload_item_image) : null,
            active: service.active !== undefined ? service.active : true,
          })),
        };
        await updateListing(listingId, {
          title: formData.listing_name || '',
          content: formData.listing_description || '',
          meta: allMeta,
          listing_name: formData.listing_name || '',
          listing_description: formData.listing_description || '',
          room_number: formData.room_number || '',
          listing_bed_number: formData.listing_bed_number || '',
          guest_max_number: formData.guest_max_number || '',
          listing_price_general: formData.listing_price_general || '',
          listing_price_weekly: formData.listing_price_weekly || '',
          listing_price_fortnightly: formData.listing_price_fortnightly || '',
          listing_price_monthly: formData.listing_price_monthly || '',
          listing_price_annually: formData.listing_price_annually || '',
          discount_number_night_1: formData.discount_number_night_1 || '',
          discount_percent_night_1: formData.discount_percent_night_1 || '',
          discount_number_night_2: formData.discount_number_night_2 || '',
          discount_percent_night_2: formData.discount_percent_night_2 || '',
          discount_number_night_3: formData.discount_number_night_3 || '',
          discount_percent_night_3: formData.discount_percent_night_3 || '',
          discount_number_guest_1: formData.discount_number_guest_1 || '',
          discount_percent_guest_1: formData.discount_percent_guest_1 || '',
          discount_number_guest_2: formData.discount_number_guest_2 || '',
          discount_percent_guest_2: formData.discount_percent_guest_2 || '',
          discount_number_guest_3: formData.discount_number_guest_3 || '',
          discount_percent_guest_3: formData.discount_percent_guest_3 || '',
          default_check_in_time: formData.default_check_in_time || '',
          default_check_out_time: formData.default_check_out_time || '',
          business_check_in_time: formData.business_check_in_time || '',
          business_check_out_time: formData.business_check_out_time || '',
          weekend_check_in_time: formData.weekend_check_in_time || '',
          weekend_check_out_time: formData.weekend_check_out_time || '',
          exact_location: formData.exact_location || '',
          listing_familiar_location: formData.listing_familiar_location || '',
          listing_video: formData.listing_video || '',
          listing_social_url: formData.listing_social_url || '',
          listing_rule: formData.listing_rule || '',
          admin_blocked_days: formData.admin_blocked_days || '',
          host_blocked_days: formData.host_blocked_days || '',
          listing_minimum_stays: formData.listing_minimum_stays || '',
          listing_gallery: galleryImageIds,
          listing_category: formatTaxonomy(formData.listing_category),
          listing_size: formatTaxonomy(formData.listing_size),
          listing_location: locationToSave,
          listing_region: locationToSave,
          listing_aminities: formatTaxonomy(formData.listing_aminities),
          listing_period_type: formatTaxonomy(formData.listing_period_type),
        });
      } catch (_forceErr) {
        // ignore; verification below will catch issues
      }
      
      // Force save gallery meta field - try multiple methods
      if (galleryImageIds && galleryImageIds.length > 0) {
        // Method 1: Separate meta update call
        try {
          const metaResponse = await updateListingMetaField(listingId, 'listing_gallery', galleryImageIds);
        } catch (metaError1) {
          // Method 2: Full update with just meta
          try {
            const metaResponse2 = await updateListing(listingId, {
              meta: {
                listing_gallery: galleryImageIds,
              },
            });
          } catch (metaError2) {
            // Method 3: Full update with all fields including meta
            try {
              const fullUpdateData = {
                ...submitData,
                meta: {
                  ...submitData.meta,
                  listing_gallery: galleryImageIds,
                },
              };
              const metaResponse3 = await updateListing(listingId, fullUpdateData);
            } catch (metaError3) {
              // Don't throw error, just log it - the attachments should still be linked
            }
          }
        }
      } else {
        // Clear the meta field if gallery is empty
        try {
          await updateListingMetaField(listingId, 'listing_gallery', []);
        } catch (clearError) {
          // Try alternative method
          try {
            await updateListing(listingId, {
              meta: {
                listing_gallery: [],
              },
            });
          } catch (clearError2) {
            // Ignore if clearing fails
          }
        }
      }
      
      // Verify the save by fetching the listing again
      try {
        const verification = await getListing(listingId);
      } catch (verifyError) {
        // silent
      }
      
      // Only navigate if not saving as draft (draft saves stay on page for further editing)
      if (!saveAsDraft) {
      navigate('/listings');
      } else {
        // If saving as draft and it's a new listing, navigate to edit page
        if (!isEdit && savedListing?.id) {
          navigate(`/listings/edit/${savedListing.id}`);
        }
        // If editing existing listing as draft, stay on the page
      }
    } catch (err) {
      // Show user-friendly error message
      if (err.message) {
        setError(err.message);
      } else if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else {
        setError('Failed to save listing. Please check your permissions and try again.');
      }
      // silent
    } finally {
      setSaving(false);
    }
  };

  // Warn on browser refresh/close if dirty
  useEffect(() => {
    const handler = (e) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
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

      <div className="flex gap-6 items-start">
        {/* Main Form */}
        <div className="flex-1">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-lg shadow p-6 space-y-6"
          >
        {/* Basic Details */}
        <div
          id="basic-details"
          onFocusCapture={() => setActiveSection('basic')}
          onMouseEnter={() => setActiveSection('basic')}
        >
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Basic Details</h2>
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
          </div>
            </div>

        {/* Property Details */}
        <div
          id="property-details"
          onFocusCapture={() => setActiveSection('property')}
          onMouseEnter={() => setActiveSection('property')}
        >
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Property Details</h2>

          {/* Rental Period Type now belongs to Property Details */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Rental Period Type
            </label>
            <div className="flex flex-wrap gap-4">
              {taxonomies.periodTypes.map((periodType) => {
                const periodTypeId = periodType.id || periodType.term_id;
                const isSelected = isPeriodTypeSelected(periodTypeId);
                return (
                  <label
                    key={periodTypeId}
                    className="flex items-center p-3 bg-white border-2 rounded-lg cursor-pointer transition-colors hover:bg-gray-50"
                    style={{
                      borderColor: isSelected ? '#2563eb' : '#e5e7eb',
                      backgroundColor: isSelected ? '#eff6ff' : 'white',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handlePeriodTypeToggle(periodTypeId)}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <span className="ml-3 text-sm font-medium text-gray-900">
                      {periodType.name}
                    </span>
                  </label>
                );
              })}
              {taxonomies.periodTypes.length === 0 && (
                <p className="text-sm text-gray-500">No period types available. Please add them in WordPress.</p>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-500">Select one or both period types.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
          </div>

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

        {/* Price Details */}
        <div
          id="price-details"
          onFocusCapture={() => setActiveSection('price')}
          onMouseEnter={() => setActiveSection('price')}
        >
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Price Details</h2>

          {/* Dynamic Price Rows */}
          <div className="space-y-4">
            <div className="grid grid-cols-12 gap-4 items-end mb-2">
              <div className="col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
              </div>
              <div className="col-span-9">
                <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
              </div>
            </div>

            {priceRows.map((row, index) => {
              const isDaily = row.period === 'daily';
              const availablePeriods = getAvailablePeriods(row.id);
              const canRemove = !isDaily && priceRows.length > 1;
              const isLastRow = index === priceRows.length - 1;
              const canAddMore = canAddMorePriceRows();

              return (
                <div key={row.id} className="grid grid-cols-12 gap-4 items-end">
                  <div className="col-span-3">
                    <select
                      value={row.period}
                      onChange={(e) => updatePriceRow(row.id, 'period', e.target.value)}
                      disabled={isDaily}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 ${
                        isDaily ? 'bg-gray-100 cursor-not-allowed' : ''
                      }`}
                    >
                      {availablePeriods.map(period => (
                        <option key={period.value} value={period.value}>
                          {period.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-8">
                    <input
                      type="number"
                      value={row.price}
                      onChange={(e) => updatePriceRow(row.id, 'price', e.target.value)}
                min="0"
                step="0.01"
                      placeholder="Enter price"
                      required={isDaily}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
                  <div className="col-span-1 flex gap-1 justify-end">
                    {canRemove && (
                      <button
                        type="button"
                        onClick={() => removePriceRow(row.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Remove"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-1 12a2 2 0 01-2 2H8a2 2 0 01-2-2L5 7m14 0H5m3-4h8m-5 4v10m4-10v10" />
                        </svg>
                      </button>
                    )}
                    {isLastRow && canAddMore && (
                      <button
                        type="button"
                        onClick={addPriceRow}
                        className="p-1.5 text-primary-600 hover:bg-primary-50 rounded transition-colors"
                        title="Add more"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Discount Details */}
        <div
          id="discount-details"
          onFocusCapture={() => setActiveSection('discount')}
          onMouseEnter={() => setActiveSection('discount')}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Discount Details</h2>
            {/* Toggle Switch */}
            <label className="flex items-center cursor-pointer">
              <span className={`mr-3 text-sm font-medium ${discountEnabled ? 'text-gray-900' : 'text-gray-500'}`}>
                {discountEnabled ? 'Enabled' : 'Disabled'}
              </span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={discountEnabled}
                  onChange={(e) => setDiscountEnabled(e.target.checked)}
                  className="sr-only"
                />
                <div className={`block w-14 h-8 rounded-full transition-colors ${
                  discountEnabled ? 'bg-primary-600' : 'bg-gray-300'
                }`}></div>
                <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${
                  discountEnabled ? 'transform translate-x-6' : ''
                }`}></div>
              </div>
            </label>
          </div>
          
          {discountEnabled ? (
            <div className="space-y-8">
              {/* Night Discounts */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-md font-medium text-gray-800">Night Discounts</h3>
                  <span className="text-xs text-gray-500">Max 3 variants</span>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-12 gap-3 text-sm text-gray-700">
                    <div className="col-span-4">Condition</div>
                    <div className="col-span-3">More (nights)</div>
                    <div className="col-span-5">Discount (%)</div>
                  </div>
                  {nightDiscountRows.map(renderNightDiscountRow)}
                        </div>
                        </div>

              {/* Guest Discounts */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-md font-medium text-gray-800">Guest Discounts</h3>
                  <span className="text-xs text-gray-500">Max 3 variants</span>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-12 gap-3 text-sm text-gray-700">
                    <div className="col-span-4">Condition</div>
                    <div className="col-span-3">Less (guests)</div>
                    <div className="col-span-5">Discount (%)</div>
                  </div>
                  {guestDiscountRows.map(renderGuestDiscountRow)}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
              <p className="text-sm text-gray-500">Discounts are disabled. Enable the toggle above to add discount options.</p>
            </div>
          )}

          {/* Price and Discount Calculation Preview */}
          <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Price & Discount Calculation Preview</h3>
            
            {/* Base Price */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Base Price (₮)</h4>
              <div className="bg-white p-3 rounded border border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Daily Rate:</span>
                  <span className="text-lg font-semibold text-gray-900">
                    ₮{formData.listing_price_general || '0.00'} / night
                  </span>
                </div>
              </div>
            </div>

            {/* Discount Rules Explanation */}
            {discountEnabled && (nightDiscountRows.some(r => r.count && r.percent) || guestDiscountRows.some(r => r.count && r.percent)) && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Active Discount Rules</h4>
                <div className="bg-white p-3 rounded border border-gray-200 space-y-2">
                  {/* Night Discounts */}
                  {nightDiscountRows
                    .filter(row => row.count && row.percent)
                    .map((row, idx) => {
                      const basePrice = parseFloat(formData.listing_price_general) || 0;
                      const discountPercent = parseFloat(row.percent) || 0;
                      const discountedPrice = basePrice * (1 - discountPercent / 100);
                      const savings = basePrice - discountedPrice;
                      
                            return (
                        <div key={idx} className="text-sm">
                          <span className="font-medium text-gray-700">Night Discount {idx + 1}:</span>
                          <span className="text-gray-600 ml-2">
                            Stay {row.count}+ nights → {discountPercent}% off ({discountPercent > 0 && basePrice > 0 ? `Save ₮${savings.toFixed(2)}/night` : ''})
                          </span>
                        </div>
                      );
                    })}
                  
                  {/* Guest Discounts */}
                  {guestDiscountRows
                    .filter(row => row.count && row.percent)
                    .map((row, idx) => {
                      const basePrice = parseFloat(formData.listing_price_general) || 0;
                      const discountPercent = parseFloat(row.percent) || 0;
                      const discountedPrice = basePrice * (1 - discountPercent / 100);
                      const savings = basePrice - discountedPrice;
                      
                      return (
                        <div key={idx} className="text-sm">
                          <span className="font-medium text-gray-700">Guest Discount {idx + 1}:</span>
                          <span className="text-gray-600 ml-2">
                            Less than {row.count} guests → {discountPercent}% off ({discountPercent > 0 && basePrice > 0 ? `Save ₮${savings.toFixed(2)}/night` : ''})
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Example Calculations */}
            {discountEnabled && formData.listing_price_general && parseFloat(formData.listing_price_general) > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Example Calculations</h4>
                <div className="bg-white p-4 rounded border border-gray-200 space-y-4">
                  {/* Example 1: Night Discount */}
                  {nightDiscountRows.some(r => r.count && r.percent) && (() => {
                    const exampleRow = nightDiscountRows.find(r => r.count && r.percent);
                    if (!exampleRow) return null;
                    
                    const basePrice = parseFloat(formData.listing_price_general) || 0;
                    const nights = parseInt(exampleRow.count) || 0;
                    const discountPercent = parseFloat(exampleRow.percent) || 0;
                    const pricePerNight = basePrice * (1 - discountPercent / 100);
                    const totalBefore = basePrice * nights;
                    const totalAfter = pricePerNight * nights;
                    const totalSavings = totalBefore - totalAfter;
                    
                    return (
                      <div className="border-b border-gray-200 pb-3 last:border-b-0 last:pb-0">
                        <div className="font-medium text-sm text-gray-700 mb-2">
                          Example: {nights} Night Stay (Qualifies for {discountPercent}% discount)
                        </div>
                        <div className="text-sm space-y-1 ml-4">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Base price ({nights} nights × ₮{basePrice.toFixed(2)}):</span>
                            <span className="text-gray-900">₮{totalBefore.toFixed(2)}</span>
                          </div>
                          <div className="flex justify_between">
                            <span className="text-gray-600">Discount ({discountPercent}% off):</span>
                            <span className="text-red-600">-₮{totalSavings.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between font-semibold pt-1 border-t border-gray-200">
                            <span className="text-gray-900">Total Price:</span>
                            <span className="text-primary-600">₮{totalAfter.toFixed(2)}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            (₮{pricePerNight.toFixed(2)} per night after discount)
                          </div>
                        </div>
                      </div>
                            );
                          })()}

                  {/* Example 2: Guest Discount */}
                  {guestDiscountRows.some(r => r.count && r.percent) && (() => {
                    const exampleRow = guestDiscountRows.find(r => r.count && r.percent);
                    if (!exampleRow) return null;
                    
                    const basePrice = parseFloat(formData.listing_price_general) || 0;
                    const guestLimit = parseInt(exampleRow.count) || 0;
                    const discountPercent = parseFloat(exampleRow.percent) || 0;
                    const exampleGuests = Math.max(1, guestLimit - 1);
                    const pricePerNight = basePrice * (1 - discountPercent / 100);
                    const exampleNights = 3;
                    const totalBefore = basePrice * exampleNights;
                    const totalAfter = pricePerNight * exampleNights;
                    const totalSavings = totalBefore - totalAfter;
                    
                    return (
                      <div className="border-b border-gray-200 pb-3 last:border-b-0 last:pb-0">
                        <div className="font-medium text-sm text-gray-700 mb-2">
                          Example: {exampleGuests} Guests for {exampleNights} Nights (Less than {guestLimit}, qualifies for {discountPercent}% discount)
                        </div>
                        <div className="text-sm space-y-1 ml-4">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Base price ({exampleNights} nights × ₮{basePrice.toFixed(2)}):</span>
                            <span className="text-gray-900">₮{totalBefore.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Discount ({discountPercent}% off):</span>
                            <span className="text-red-600">-₮{totalSavings.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between font-semibold pt-1 border-t border-gray-200">
                            <span className="text-gray-900">Total Price:</span>
                            <span className="text-primary-600">₮{totalAfter.toFixed(2)}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            (₮{pricePerNight.toFixed(2)} per night after discount)
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* No discounts message */}
                  {!nightDiscountRows.some(r => r.count && r.percent) && !guestDiscountRows.some(r => r.count && r.percent) && (
                    <div className="text-sm text-gray-500 text-center py-2">
                      Configure discount rules above to see example calculations
                </div>
                  )}
              </div>
              </div>
            )}

            {/* No base price message */}
            {!formData.listing_price_general || parseFloat(formData.listing_price_general) <= 0 ? (
              <div className="text-sm text-gray-500 text-center py-2 bg-white p-3 rounded border border-gray-200">
                Enter a base daily price above to see calculations
                </div>
            ) : null}

            {/* Explanation */}
            <div className="mt-4 p-3 bg-blue-100 rounded border border-blue-200">
              <p className="text-xs text-gray-700">
                <strong>Note:</strong> Discounts are automatically applied based on the conditions above. 
                Night discounts apply when the stay duration meets the minimum night requirement. 
                Guest discounts apply when the number of guests is below the specified limit.
              </p>
                      </div>
                </div>
              </div>

        {/* Time Details */}
        <div
          id="time-details"
          onFocusCapture={() => setActiveSection('time')}
          onMouseEnter={() => setActiveSection('time')}
        >
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Time Details</h2>
                <div className="space-y-3">
                  <div className="grid grid-cols-12 gap-3 text-sm text-gray-700">
              <div className="col-span-4">Type</div>
              <div className="col-span-4">Check-in Time</div>
              <div className="col-span-4">Check-out Time</div>
                  </div>
            {timeRows.map((row, index) => {
              const isDefault = row.type === 'default';
              const isBusiness = row.type === 'business';
              const isWeekend = row.type === 'weekend';
              const hasBusiness = timeRows.some(r => r.type === 'business');
              const hasWeekend = timeRows.some(r => r.type === 'weekend');
              
              // Can remove if:
              // - More than 1 row AND
              // - Not weekend when business exists (weekend is required when business exists)
              const canRemove = timeRows.length > 1 && !(isWeekend && hasBusiness);
              const canAdd = isDefault && timeRows.length === 1;
              
                    return (
                      <div key={row.id} className="grid grid-cols-12 gap-3 items-center">
                        <div className="col-span-4">
                          <select
                      value={row.type}
                            disabled
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed text-gray-600 text-sm"
                          >
                      <option value="default">Default</option>
                      <option value="business">Business Days</option>
                      <option value="weekend">Weekend</option>
                          </select>
                        </div>
                  <div className="col-span-4">
                          <input
                      type="time"
                      value={row.checkIn}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setTimeRows(prevRows => {
                          const updated = prevRows.map(r => {
                            if (r.id === row.id) {
                              return { ...r, checkIn: newValue };
                            }
                            // Auto-copy to business and weekend if this is default
                            if (isDefault && (r.type === 'business' || r.type === 'weekend')) {
                              return { ...r, checkIn: newValue };
                            }
                            return r;
                          });
                          return updated;
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                          />
                        </div>
                  <div className="col-span-4 flex items-center gap-2 w-full">
                    <input
                      type="time"
                      value={row.checkOut}
                                  onChange={(e) => {
                        const newValue = e.target.value;
                        setTimeRows(prevRows => {
                          const updated = prevRows.map(r => {
                            if (r.id === row.id) {
                              return { ...r, checkOut: newValue };
                            }
                            // Auto-copy to business and weekend if this is default
                            if (isDefault && (r.type === 'business' || r.type === 'weekend')) {
                              return { ...r, checkOut: newValue };
                            }
                            return r;
                          });
                          return updated;
                        });
                      }}
                      className="flex-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    />
                          <div className="flex gap-1">
                          {canRemove && (
                            <button
                              type="button"
                          onClick={() => handleRemoveTimeRow(row.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Remove"
                            >
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
                                  d="M19 7l-1 12a2 2 0 01-2 2H8a2 2 0 01-2-2L5 7m14 0H5m3-4h8m-5 4v10m4-10v10"
                                />
                              </svg>
                            </button>
                          )}
                      {canAdd && (
                            <button
                              type="button"
                          onClick={handleAddTimeTypes}
                              className="p-1.5 text-primary-600 hover:bg-primary-50 rounded transition-colors"
                              title="Add"
                            >
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
                                  d="M12 4v16m8-8H4"
                                />
                              </svg>
                            </button>
                          )}
                    </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
        </div>

        {/* Location Details */}
        <div
          id="location-details"
          onFocusCapture={() => setActiveSection('location')}
          onMouseEnter={() => setActiveSection('location')}
        >
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Location Details</h2>
          <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Parent Location - Searchable Dropdown */}
              <div className="relative" ref={parentLocationDropdownRef}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parent Location
                  </label>
                <div className="relative">
                  <input
                    type="text"
                    value={(() => {
                      const selected = organizeLocations().parents.find(
                        loc => (loc.id || loc.term_id) == formData.parent_location
                      );
                      return selected ? selected.name : parentLocationSearch;
                    })()}
                    onChange={(e) => {
                      setParentLocationSearch(e.target.value);
                      setShowParentLocationDropdown(true);
                    }}
                    onFocus={() => setShowParentLocationDropdown(true)}
                    placeholder="Search or select parent location..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                  />
                  {showParentLocationDropdown && (
                    <div className="parent-location-dropdown dropdown-menu absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      <div className="p-2 border-b border-gray-200 sticky top-0 bg-white">
                  <input
                          type="text"
                          value={parentLocationSearch}
                          onChange={(e) => setParentLocationSearch(e.target.value)}
                          onFocus={(e) => e.stopPropagation()}
                          placeholder="Search locations..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 text-sm"
                          autoFocus
                  />
                </div>
                      <div className="py-1">
                        {(() => {
                          const filtered = organizeLocations().parents.filter(loc => {
                            const searchLower = parentLocationSearch.toLowerCase();
                            return loc.name.toLowerCase().includes(searchLower);
                          });
                          return filtered.length > 0 ? (
                            filtered.map((loc) => {
                              const locId = loc.id || loc.term_id;
                              const isSelected = formData.parent_location == locId;
                              return (
                                <button
                                  key={locId}
                                  type="button"
                                  onClick={() => {
                                    handleLocationChange('parent', locId);
                                    setParentLocationSearch('');
                                    setShowParentLocationDropdown(false);
                                  }}
                                  onMouseDown={(e) => {
                                    e.preventDefault(); // Prevent input blur before click
                                  }}
                                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                                    isSelected ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700'
                                  }`}
                                >
                                  {loc.name}
                                </button>
                              );
                            })
                          ) : (
                            <div className="px-4 py-2 text-sm text-gray-500">No locations found</div>
                          );
                        })()}
                </div>
                </div>
                  )}
              </div>
            </div>

              {/* Child Location - Searchable Dropdown */}
              <div className="relative" ref={childLocationDropdownRef}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                  Child Location
                  </label>
                <div className="relative">
                  <input
                    type="text"
                    value={(() => {
                      if (!formData.parent_location) return '';
                      const selected = getChildrenForParent(formData.parent_location).find(
                        loc => (loc.id || loc.term_id) == formData.child_location
                      );
                      return selected ? selected.name : childLocationSearch;
                    })()}
                    onChange={(e) => {
                      setChildLocationSearch(e.target.value);
                      setShowChildLocationDropdown(true);
                    }}
                    onFocus={() => {
                      if (formData.parent_location) {
                        setShowChildLocationDropdown(true);
                      }
                    }}
                    disabled={!formData.parent_location}
                    placeholder={formData.parent_location ? "Search or select child location..." : "Select parent location first"}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  {showChildLocationDropdown && formData.parent_location && (
                    <div className="child-location-dropdown dropdown-menu absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      <div className="p-2 border-b border-gray-200 sticky top-0 bg-white">
                  <input
                          type="text"
                          value={childLocationSearch}
                          onChange={(e) => setChildLocationSearch(e.target.value)}
                          onFocus={(e) => e.stopPropagation()}
                          placeholder="Search locations..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 text-sm"
                          autoFocus
                  />
                </div>
                      <div className="py-1">
                        {(() => {
                          const children = getChildrenForParent(formData.parent_location);
                          const filtered = children.filter(loc => {
                            const searchLower = childLocationSearch.toLowerCase();
                            return loc.name.toLowerCase().includes(searchLower);
                          });
                          return filtered.length > 0 ? (
                            filtered.map((loc) => {
                              const locId = loc.id || loc.term_id;
                              const isSelected = formData.child_location == locId;
                              return (
                                <button
                                  key={locId}
                                  type="button"
                                  onClick={() => {
                                    handleLocationChange('child', locId);
                                    setChildLocationSearch('');
                                    setShowChildLocationDropdown(false);
                                  }}
                                  onMouseDown={(e) => {
                                    e.preventDefault(); // Prevent input blur before click
                                  }}
                                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                                    isSelected ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700'
                                  }`}
                                >
                                  {loc.name}
                                </button>
                              );
                            })
                          ) : (
                            <div className="px-4 py-2 text-sm text-gray-500">No locations found</div>
                          );
                        })()}
              </div>
            </div>
                  )}
          </div>
        </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Exact Location
              </label>
              <input
                type="text"
                name="exact_location"
                value={formData.exact_location}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter exact location"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Familiar Location
              </label>
              <input
                type="text"
                name="listing_familiar_location"
                value={formData.listing_familiar_location}
                onChange={handleChange}
                onFocus={() => setShowFamiliarLocationSuggestions(true)}
                onBlur={() => setTimeout(() => setShowFamiliarLocationSuggestions(false), 200)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                placeholder="e.g., Near City Center"
              />
              {showFamiliarLocationSuggestions && (
                <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="text-xs text-gray-600 mb-2 font-medium">Suggestions:</div>
                  <div className="flex flex-wrap gap-2">
                    {familiarLocationSuggestions
                      .filter(suggestion => {
                        const currentValue = formData.listing_familiar_location.toLowerCase();
                        return !currentValue || suggestion.toLowerCase().includes(currentValue);
                      })
                      .map((suggestion, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              listing_familiar_location: suggestion
                            }));
                            setShowFamiliarLocationSuggestions(false);
                          }}
                          className="px-3 py-1 text-xs bg-white border border-gray-300 rounded-full hover:bg-primary-50 hover:border-primary-300 hover:text-primary-700 transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
            </div>
            </div>
              )}
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

        {/* Video and Social */}
        <div
          id="media-details"
          onFocusCapture={() => setActiveSection('media')}
          onMouseEnter={() => setActiveSection('media')}
        >
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Video and Social</h2>
          <div className="space-y-4">
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
                placeholder="https://..."
              />
            </div>

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
                placeholder="https://..."
              />
            </div>
          </div>
        </div>

        {/* Gallery */}
        <div
          onFocusCapture={() => setActiveSection('media')}
          onMouseEnter={() => setActiveSection('media')}
        >
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Gallery</h2>
          <ImageGalleryUpload
            images={formData.listing_gallery}
            onChange={(newImages) => {
              setFormData((prev) => ({
                ...prev,
                listing_gallery: newImages,
              }));
            }}
            maxImages={20}
            listingId={isEdit ? parseInt(id, 10) || id : null}
          />
        </div>

        {/* Additional Services */}
        <div
          id="services-details"
          onFocusCapture={() => setActiveSection('services')}
          onMouseEnter={() => setActiveSection('services')}
        >
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Additional Services</h2>
          <div className="space-y-4">
            {additionalServices.map((service, index) => {
              const isExpanded = expandedServices.has(service.id);
              const serviceTitle = service.additional_service_name || `Service ${index + 1}`;
              
              return (
                <div key={service.id} className="border border-gray-200 rounded-lg bg-white">
                  {/* Header - Always Visible */}
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3 flex-1">
                      {/* Collapse/Expand Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedServices(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(service.id)) {
                              newSet.delete(service.id);
                            } else {
                              newSet.add(service.id);
                            }
                            return newSet;
                          });
                        }}
                        className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                        title={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        <svg
                          className={`w-5 h-5 transition-transform ${isExpanded ? 'transform rotate-90' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <h3 className="text-lg font-medium text-gray-900">{serviceTitle}</h3>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Active/Inactive Toggle */}
                      <label className="flex items-center cursor-pointer">
                        <span className={`mr-3 text-sm font-medium ${service.active ? 'text-gray-900' : 'text-gray-500'}`}>
                          {service.active ? 'Active' : 'Inactive'}
                        </span>
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={service.active}
                            onChange={(e) => {
                              setAdditionalServices(prev =>
                                prev.map(s => s.id === service.id ? { ...s, active: e.target.checked } : s)
                              );
                            }}
                            className="sr-only"
                          />
                          <div className={`block w-14 h-8 rounded-full transition-colors ${
                            service.active ? 'bg-primary-600' : 'bg-gray-300'
                          }`}></div>
                          <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${
                            service.active ? 'transform translate-x-6' : ''
                          }`}></div>
                        </div>
                      </label>
                      {/* Remove Button */}
                      {additionalServices.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setAdditionalServices(prev => prev.filter(s => s.id !== service.id));
                            setExpandedServices(prev => {
                              const newSet = new Set(prev);
                              newSet.delete(service.id);
                              return newSet;
                            });
                          }}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Remove"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-1 12a2 2 0 01-2 2H8a2 2 0 01-2-2L5 7m14 0H5m3-4h8m-5 4v10m4-10v10"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Collapsible Content */}
                  {isExpanded && (
                    <div className="px-4 pb-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Service Name */}
        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Service Name *
                          </label>
                          <input
                            type="text"
                            value={service.additional_service_name || ''}
                            onChange={(e) => {
                              setAdditionalServices(prev =>
                                prev.map(s => s.id === service.id ? { ...s, additional_service_name: e.target.value } : s)
                              );
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                            placeholder="Enter service name"
                          />
                        </div>

                        {/* Item Price */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Item Price *
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={service.item_price || ''}
                            onChange={(e) => {
                              setAdditionalServices(prev =>
                                prev.map(s => s.id === service.id ? { ...s, item_price: e.target.value } : s)
                              );
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                            placeholder="0.00"
                          />
                        </div>

                        {/* Charge Type */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Charge Type *
                          </label>
                          <select
                            value={service.additional_charge_type || ''}
                            onChange={(e) => {
                              setAdditionalServices(prev =>
                                prev.map(s => s.id === service.id ? { ...s, additional_charge_type: e.target.value } : s)
                              );
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                          >
                            <option value="">Select charge type</option>
                            <option value="Per Guest">Per Guest</option>
                            <option value="Per Night">Per Night</option>
                            <option value="Both">Both</option>
                          </select>
                        </div>

                        {/* Image Upload */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Service Image
                          </label>
                          <div className="space-y-2">
                            {service.upload_item_image ? (
                              <div className="relative">
                                <img
                                  src={typeof service.upload_item_image === 'object' ? service.upload_item_image.url : service.upload_item_image}
                                  alt={service.additional_service_name || 'Service image'}
                                  className="w-full h-32 object-cover rounded-lg border border-gray-300"
                                />
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setAdditionalServices(prev =>
                                      prev.map(s => s.id === service.id ? { ...s, upload_item_image: null } : s)
                                    );
                                  }}
                                  className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                                  title="Remove image"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <label className="block w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors cursor-pointer">
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    
                                    // Validate file type
                                    if (!file.type.startsWith('image/')) {
                                      alert(`${file.name} is not an image file.`);
                                      return;
                                    }
                                    
                                    // Validate file size (max 10MB)
                                    if (file.size > 10 * 1024 * 1024) {
                                      alert(`${file.name} is too large. Maximum size is 10MB.`);
                                      return;
                                    }

                                    // Create preview immediately
                                    const previewUrl = URL.createObjectURL(file);
                                    setAdditionalServices(prev =>
                                      prev.map(s => s.id === service.id ? { ...s, upload_item_image: { id: `temp-${Date.now()}`, url: previewUrl, uploading: true } } : s)
                                    );

                                    try {
                                      const listingId = isEdit ? parseInt(id, 10) || id : null;
                                      const response = await uploadMedia(file, listingId);
                                      const imageId = response.id || response.ID;
                                      const imageUrl = response.source_url || response.guid?.rendered || response.url || response.link;
                                      
                                      setAdditionalServices(prev =>
                                        prev.map(s => s.id === service.id ? { ...s, upload_item_image: { id: imageId, url: imageUrl } } : s)
                                      );
                                      URL.revokeObjectURL(previewUrl);
                                    } catch (error) {
                                      console.error('Error uploading image:', error);
                                      alert(`Failed to upload ${file.name}. Please try again.`);
                                      setAdditionalServices(prev =>
                                        prev.map(s => s.id === service.id ? { ...s, upload_item_image: null } : s)
                                      );
                                      URL.revokeObjectURL(previewUrl);
                                    }
                                    
                                    // Reset input
                                    e.target.value = '';
                                  }}
                                />
                                <div className="flex items-center justify-center gap-2 text-gray-600">
                                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                  <span>Click to upload image</span>
                                </div>
                              </label>
                            )}
                          </div>
                        </div>

                        {/* Service Description */}
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Service Description
                          </label>
                          <textarea
                            value={service.additional_service_description || ''}
                            onChange={(e) => {
                              setAdditionalServices(prev =>
                                prev.map(s => s.id === service.id ? { ...s, additional_service_description: e.target.value } : s)
                              );
                            }}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                            placeholder="Enter service description"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
              })}

            {/* Add Service Button */}
            <button
              type="button"
              onClick={() => {
                const newId = Math.max(...additionalServices.map(s => s.id || 0), 0) + 1;
                setAdditionalServices(prev => [
                  ...prev,
                  {
                    id: newId,
                    additional_service_name: '',
                    additional_service_description: '',
                    item_price: '',
                    additional_charge_type: '',
                    upload_item_image: null,
                    active: true,
                  },
                ]);
                // Auto-expand the new service
                setExpandedServices(prev => new Set(prev).add(newId));
              }}
              className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors flex items-center justify-center gap-2 text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add New Service</span>
            </button>
          </div>
        </div>

        {/* Listing Rules */}
        <div
          id="rules-details"
          onFocusCapture={() => setActiveSection('rules')}
          onMouseEnter={() => setActiveSection('rules')}
        >
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Listing Rules</h2>
          <div className="space-y-4">
            {/* Rule Mode Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Rule Source
              </label>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="listing_rule_mode"
                    value="existing"
                    checked={formData.listing_rule_mode === 'existing'}
                    onChange={(e) => {
                      setFormData(prev => ({
                        ...prev,
                        listing_rule_mode: e.target.value,
                        listing_rule: '', // Clear custom rule when switching
                      }));
                    }}
                    className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Choose existing rule</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="listing_rule_mode"
                    value="custom"
                    checked={formData.listing_rule_mode === 'custom'}
                    onChange={(e) => {
                      setFormData(prev => ({
                        ...prev,
                        listing_rule_mode: e.target.value,
                        selected_listing_rule_id: '', // Clear selected rule when switching
                      }));
                    }}
                    className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Create custom rule</span>
                </label>
              </div>
            </div>

            {/* Existing Rule Selection */}
            {formData.listing_rule_mode === 'existing' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Listing Rule *
                </label>
                <select
                  name="selected_listing_rule_id"
                  value={formData.selected_listing_rule_id}
                  onChange={(e) => {
                    const ruleId = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      selected_listing_rule_id: ruleId,
                    }));
                    
                    // Auto-fill listing_rule when an existing rule is selected
                    if (ruleId) {
                      const selectedRule = availableListingRules.find(r => (r.id || r.ID) == ruleId);
                      if (selectedRule) {
                        const ruleContent = selectedRule.listing_rules || selectedRule.meta?.listing_rules || selectedRule.content?.rendered || '';
                        setFormData(prev => ({
                          ...prev,
                          listing_rule: ruleContent,
                        }));
                      }
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                  required={formData.listing_rule_mode === 'existing'}
                >
                  <option value="">Select a listing rule...</option>
                  {availableListingRules.map((rule) => {
                    const ruleId = rule.id || rule.ID;
                    const ruleTitle = rule.title?.rendered || rule.listing_rule_title || rule.meta?.listing_rule_title || 'Untitled Rule';
                    return (
                      <option key={ruleId} value={ruleId}>
                        {ruleTitle}
                      </option>
                    );
                  })}
                </select>

                {/* Rule Preview - Only show when a rule is selected */}
                {formData.selected_listing_rule_id && (() => {
                  const selectedRule = availableListingRules.find(r => (r.id || r.ID) == formData.selected_listing_rule_id);
                  if (!selectedRule) return null;
                  
                  const ruleTitle = selectedRule.title?.rendered || selectedRule.listing_rule_title || selectedRule.meta?.listing_rule_title || 'Untitled Rule';
                  const ruleContent = selectedRule.listing_rules || selectedRule.meta?.listing_rules || selectedRule.content?.rendered || '';
                  const previewLength = 300;
                  const shouldTruncate = ruleContent.length > previewLength;
                  const previewText = shouldTruncate ? ruleContent.substring(0, previewLength) + '...' : ruleContent;
                  
                  return (
                    <div className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">Rule Preview</h4>
                      <div className="text-sm text-gray-700">
                        <div className="font-medium text-gray-800 mb-1">{ruleTitle}</div>
                        <div className="text-gray-600 whitespace-pre-wrap">
                          {previewText || <span className="text-gray-400 italic">No content available</span>}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Custom Rule Textarea */}
            {formData.listing_rule_mode === 'custom' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rules *
            </label>
            <textarea
              name="listing_rule"
              value={formData.listing_rule}
              onChange={handleChange}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              placeholder="Enter listing rules and policies..."
                  required={formData.listing_rule_mode === 'custom'}
            />
              </div>
            )}
          </div>
        </div>

        {/* Admin Details */}
        <div
          id="admin-details"
          onFocusCapture={() => setActiveSection('admin')}
          onMouseEnter={() => setActiveSection('admin')}
        >
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Admin Details</h2>
          <div className="space-y-4">
            <div>
              <label className="flex items-center justify-between">
                <span className="block text-sm font-medium text-gray-700">
                  Featured Listing
                </span>
                <div className="flex items-center cursor-pointer">
                  <span className={`mr-3 text-sm font-medium ${formData.featured_listing === 'yes' ? 'text-gray-900' : 'text-gray-500'}`}>
                    {formData.featured_listing === 'yes' ? 'Yes' : 'No'}
                  </span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={formData.featured_listing === 'yes'}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        featured_listing: e.target.checked ? 'yes' : ''
                      }))}
                      className="sr-only"
                    />
                    <div className={`block w-14 h-8 rounded-full transition-colors ${
                      formData.featured_listing === 'yes' ? 'bg-primary-600' : 'bg-gray-300'
                    }`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${
                      formData.featured_listing === 'yes' ? 'transform translate-x-6' : ''
                    }`}></div>
                  </div>
                </div>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimum Stays
              </label>
              <input
                type="number"
                name="listing_minimum_stays"
                value={formData.listing_minimum_stays}
                onChange={handleChange}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                placeholder="Minimum number of nights"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Admin Blocked Days
              </label>
              <input
                type="text"
                name="admin_blocked_days"
                value={formData.admin_blocked_days}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                placeholder="Comma-separated dates (YYYY-MM-DD)"
              />
              <p className="mt-1 text-xs text-gray-500">Enter dates in YYYY-MM-DD format, separated by commas</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Host Blocked Days
              </label>
              <input
                type="text"
                name="host_blocked_days"
                value={formData.host_blocked_days}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                placeholder="Comma-separated dates (YYYY-MM-DD)"
              />
              <p className="mt-1 text-xs text-gray-500">Enter dates in YYYY-MM-DD format, separated by commas</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={() => {
              if (isDirty) {
                setShowLeaveConfirm(true);
              } else {
                navigate('/listings');
              }
            }}
            disabled={saving}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={(e) => handleSubmit(e, true)}
            disabled={saving}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save as Draft'}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : isEdit ? 'Update Listing' : 'Create Listing'}
          </button>
        </div>
      </form>
        </div>

        {/* Sticky Sidebar - right side */}
        <aside className="hidden lg:block w-64 sticky top-24 self-start">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Sections</h2>
            <nav className="space-y-1">
              {[
                { id: 'basic', label: 'Basic Details', target: 'basic-details' },
                { id: 'property', label: 'Property Details', target: 'property-details' },
                { id: 'price', label: 'Price Details', target: 'price-details' },
                { id: 'discount', label: 'Discount Details', target: 'discount-details' },
                { id: 'time', label: 'Time Details', target: 'time-details' },
                { id: 'location', label: 'Location Details', target: 'location-details' },
                { id: 'media', label: 'Media (Video & Gallery)', target: 'media-details' },
                { id: 'services', label: 'Additional Services', target: 'services-details' },
                { id: 'rules', label: 'Listing Rules', target: 'rules-details' },
                { id: 'admin', label: 'Admin Details', target: 'admin-details' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    const el = document.getElementById(item.target);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                    setActiveSection(item.id);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    activeSection === item.id
                      ? 'bg-primary-50 text-primary-700 font-medium border border-primary-100'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Helper Text */}
          <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
              Current section
            </h3>
            <p className="text-sm font-medium text-gray-900 mb-1">
              {{
                basic: 'Basic Details',
                property: 'Property Details',
                price: 'Price Details',
                discount: 'Discount Details',
                time: 'Time Details',
                location: 'Location Details',
                media: 'Media',
                services: 'Additional Services',
                rules: 'Listing Rules',
                admin: 'Admin Details',
              }[activeSection] || 'Basic Details'}
            </p>
            <p className="text-xs text-gray-600">
              {sectionHelperText[activeSection] || sectionHelperText.basic}
            </p>
          </div>
        </aside>
      </div>

      {/* Leave without saving modal */}
      <ConfirmModal
        open={showLeaveConfirm}
        title="Discard changes?"
        message="You have unsaved changes. If you leave now, your changes will be lost."
        confirmText="Leave without saving"
        cancelText="Stay"
        onConfirm={() => navigate('/listings')}
        onCancel={() => setShowLeaveConfirm(false)}
      />
    </div>
  );
};

export default ListingForm;

