import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getListing, getListings, getAmenities, getCategories, getLocations, getSizes, getMedia, getMediaByParent } from '../services/api';
import ImageGallery from './ImageGallery';
import CustomDatePicker from './DatePicker';

const REVIEW_TEMPLATES = [
  {
    name: 'Naraa',
    location: 'Ulaanbaatar, Mongolia',
    stay: 'Stayed March 2025',
    rating: 5,
    comment: 'Everything was spotless and exactly as described. {listing} felt even cozier in person and the host was incredibly responsive.',
  },
  {
    name: 'Bat-Erdene',
    location: 'Seoul, South Korea',
    stay: 'Stayed January 2025',
    rating: 4,
    comment: 'Great location with beautiful views. The availability calendar matched reality—we booked confidently and the stay went smoothly.',
  },
  {
    name: 'Ariuka',
    location: 'Tokyo, Japan',
    stay: 'Stayed November 2024',
    rating: 5,
    comment: 'Loved the interior details and private outdoor space. Would recommend {listing} to anyone visiting the area.',
  },
];

const ListingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [amenities, setAmenities] = useState([]);
  const [groupedAmenities, setGroupedAmenities] = useState({});
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [guestCount, setGuestCount] = useState(1);
  const [totalPrice, setTotalPrice] = useState(null);
  const [dateError, setDateError] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [mobileBookingModalOpen, setMobileBookingModalOpen] = useState(false);
  const [relatedListings, setRelatedListings] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(false);

  const blockedDateSet = useMemo(() => {
    if (!listing) return new Set();

    const meta = listing.meta || {};
    const sources = [
      listing.admin_blocked_days,
      listing.host_blocked_days,
      meta?.admin_blocked_days,
      meta?.host_blocked_days,
      meta?.listing_admin_blocked_days,
      meta?.listing_host_blocked_days,
    ];

    const blocked = new Set();

    const addDate = (rawDate) => {
      if (!rawDate) return;
      const value = String(rawDate).trim();
      if (!value) return;

      const normalized = value.includes('T') ? value.split('T')[0] : value;
      if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
        blocked.add(normalized);
        return;
      }

      const parsed = new Date(value);
      if (!Number.isNaN(parsed)) {
        blocked.add(parsed.toISOString().split('T')[0]);
      }
    };

    const parseSource = (source) => {
      if (!source) return;
      if (Array.isArray(source)) {
        source.forEach((entry) => {
          if (typeof entry === 'string' || typeof entry === 'number') {
            addDate(entry);
          } else if (entry && typeof entry === 'object') {
            addDate(entry.date || entry.day || entry.dateString || entry.value);
            if (entry.dates) {
              parseSource(entry.dates);
            }
          }
        });
        return;
      }
      if (typeof source === 'string' || typeof source === 'number') {
        String(source)
          .split(',')
          .map((token) => token.trim())
          .filter(Boolean)
          .forEach(addDate);
        return;
      }
      if (typeof source === 'object') {
        if (Array.isArray(source.dates)) {
          parseSource(source.dates);
        } else if (typeof source.dates === 'string') {
          parseSource(source.dates);
        }
      }
    };

    sources.forEach(parseSource);
    return blocked;
  }, [listing]);

  const isDateSelectable = useCallback(
    (date) => {
      if (!date || !(date instanceof Date)) return true;
      const iso = date.toISOString().split('T')[0];
      return !blockedDateSet.has(iso);
    },
    [blockedDateSet]
  );

  const hasBlockedDateInRange = useCallback(
    (start, end) => {
      if (!start || !end) return false;
      const current = new Date(start);
      current.setHours(0, 0, 0, 0);
      const last = new Date(end);
      last.setHours(0, 0, 0, 0);
      while (current <= last) {
        const iso = current.toISOString().split('T')[0];
        if (blockedDateSet.has(iso)) {
          return true;
        }
        current.setDate(current.getDate() + 1);
      }
      return false;
    },
    [blockedDateSet]
  );

  useEffect(() => {
    if (startDate) {
      const iso = startDate.toISOString().split('T')[0];
      if (blockedDateSet.has(iso)) {
        setStartDate(null);
      }
    }
    if (endDate) {
      const iso = endDate.toISOString().split('T')[0];
      if (blockedDateSet.has(iso)) {
        setEndDate(null);
      }
    }
  }, [blockedDateSet, startDate, endDate]);

  const handleStartDateChange = (date) => {
    setDateError('');
    if (!date) {
      setStartDate(null);
      setEndDate(null);
      return;
    }

    setStartDate(date);

    if (endDate && date > endDate) {
      setEndDate(null);
      return;
    }

    if (endDate && hasBlockedDateInRange(date, endDate)) {
      setEndDate(null);
      setDateError('Selected range includes unavailable dates. Please choose continuous available days.');
    }
  };

  const handleEndDateChange = (date) => {
    setDateError('');
    if (!date) {
      setEndDate(null);
      return;
    }

    if (!startDate) {
      setDateError('Select a check-in date before choosing a check-out date.');
      return;
    }

    if (date < startDate) {
      setDateError('Check-out date must be on or after the check-in date.');
      return;
    }

    if (hasBlockedDateInRange(startDate, date)) {
      setDateError('Selected range includes unavailable dates. Please choose continuous available days.');
      return;
    }

    setEndDate(date);
  };

  const loadRelatedListings = useCallback(
    async (categoryId, currentListingId) => {
      if (!categoryId) {
        setRelatedListings([]);
        return;
      }
      setRelatedLoading(true);
      try {
        const data = await getListings({
          per_page: 6,
          listing_category: categoryId,
          exclude: currentListingId,
        });
        const normalized = Array.isArray(data) ? data : [];
        const filtered = normalized.filter(
          (item) => Number(item?.id) !== Number(currentListingId)
        );
        setRelatedListings(filtered.slice(0, 4));
      } catch (error) {
        console.error('Error loading related listings:', error);
        setRelatedListings([]);
      } finally {
        setRelatedLoading(false);
      }
    },
    []
  );

  const loadListing = async () => {
    setLoading(true);
    try {
      // Fetch listing first - this is critical
      const listingData = await getListing(id);
      if (!listingData) {
        setLoading(false);
        return;
      }

      // Resolve gallery to actual URLs
      let resolvedGallery = [];
      const rawGallery = listingData.listing_gallery;
      if (rawGallery && Array.isArray(rawGallery) && rawGallery.length > 0) {
        // If gallery contains numbers or objects without URL, fetch media details
        const items = await Promise.allSettled(
          rawGallery.map(async (img) => {
            if (typeof img === 'string') return img;
            if (typeof img === 'object' && (img.url || img.source_url || img.guid || img.src)) {
              return img.url || img.source_url || img.guid || img.src;
            }
            const mediaId =
              typeof img === 'number'
                ? img
                : img && (img.id || img.ID || img.media_id || img.image_id || img.attachment_id);
            if (!mediaId) return null;
            try {
              const media = await getMedia(mediaId);
              return (
                media?.source_url ||
                media?.media_details?.sizes?.large?.source_url ||
                media?.guid?.rendered ||
                null
              );
            } catch {
              return null;
            }
          })
        );
        resolvedGallery = items
          .map((r) => (r.status === 'fulfilled' ? r.value : null))
          .filter(Boolean);
      }

      // Always prefer attachments (media whose parent/post_parent is this listing)
      if (listingData.id) {
        try {
          const attachments = await getMediaByParent(listingData.id);
          // Sort by menu_order asc if present
          const sorted = (attachments || []).slice().sort((a, b) => {
            const ao = typeof a.menu_order === 'number' ? a.menu_order : parseInt(a.menu_order || 0, 10) || 0;
            const bo = typeof b.menu_order === 'number' ? b.menu_order : parseInt(b.menu_order || 0, 10) || 0;
            if (ao !== bo) return ao - bo;
            return (parseInt(a.id || a.ID || 0, 10) || 0) - (parseInt(b.id || b.ID || 0, 10) || 0);
          });
          const attachmentUrls = sorted
            .map(
              (att) =>
                att?.source_url ||
                att?.media_details?.sizes?.large?.source_url ||
                att?.guid?.rendered ||
                null
            )
            .filter(Boolean);
          if (attachmentUrls.length > 0) {
            resolvedGallery = attachmentUrls;
          }
        } catch {
          // ignore, fall back to resolvedGallery from rawGallery
        }
      }

      const normalizedListing = {
        ...listingData,
        listing_gallery:
          resolvedGallery && resolvedGallery.length > 0
            ? resolvedGallery
            : listingData.listing_gallery,
      };

      setListing(normalizedListing);

      const primaryCategoryId = extractTermId(listingData.listing_category);
      loadRelatedListings(primaryCategoryId, listingData.id);
      
      // Fetch taxonomies separately with error handling so one failure doesn't break everything
      try {
        const categoriesData = await getCategories();
        setCategories(categoriesData || []);
      } catch (error) {
        console.error('Error loading categories:', error);
        setCategories([]);
      }
      
      try {
        const locationsData = await getLocations();
        setLocations(locationsData || []);
      } catch (error) {
        console.error('Error loading locations:', error);
        setLocations([]);
      }
      
      try {
        const sizesData = await getSizes();
        setSizes(sizesData || []);
      } catch (error) {
        console.error('Error loading sizes:', error);
        setSizes([]);
      }
      
      // Load amenities if listing has amenity data (handle both singular and plural field names)
      const amenityData = listingData.listing_aminity || listingData.listing_aminities;
      if (amenityData && amenityData.length > 0) {
        try {
          // Fetch all amenities to get parent-child relationships
          const allAmenities = await getAmenities();
          
          // Get selected amenity IDs - handle both object and ID formats
          let selectedIds = [];
          let selectedAmenityObjects = [];
          
          if (typeof amenityData[0] === 'object') {
            // If it's an array of objects, extract IDs and keep objects
            selectedIds = amenityData.map(a => a.id || a.term_id).filter(id => id != null);
            selectedAmenityObjects = amenityData;
          } else {
            // If it's an array of IDs (numbers or strings)
            selectedIds = amenityData.map(id => {
              const numId = typeof id === 'string' ? parseInt(id) : id;
              return numId || id;
            }).filter(id => id != null);
          }
          
          // Helper to normalize ID for comparison
          const normalizeId = (id) => {
            if (id == null) return null;
            const num = typeof id === 'string' ? parseInt(id) : id;
            return isNaN(num) ? String(id) : num;
          };
          
          // Helper to check if two IDs match
          const idsMatch = (id1, id2) => {
            if (id1 == null || id2 == null) return false;
            const norm1 = normalizeId(id1);
            const norm2 = normalizeId(id2);
            if (norm1 == null || norm2 == null) return false;
            return norm1 === norm2 || String(norm1) === String(norm2);
          };
          
          // Create normalized set of selected IDs for quick lookup
          const normalizedSelectedIds = new Set();
          selectedIds.forEach(id => {
            const normId = normalizeId(id);
            if (normId != null) {
              normalizedSelectedIds.add(normId);
              normalizedSelectedIds.add(String(normId));
              if (!isNaN(parseInt(normId))) {
                normalizedSelectedIds.add(parseInt(normId));
              }
            }
          });
          
          // Find all selected amenities from the full list
          const selectedAmenities = [];
          const foundIds = new Set();
          
          allAmenities.forEach((amenity) => {
            const amenityId = normalizeId(amenity.id || amenity.term_id);
            if (amenityId != null && normalizedSelectedIds.has(amenityId)) {
              selectedAmenities.push(amenity);
              foundIds.add(amenityId);
              foundIds.add(String(amenityId));
            } else if (amenityId != null) {
              // Also check string and number variations
              const checkVariations = [
                amenityId,
                String(amenityId),
                parseInt(amenityId),
                amenity.id,
                amenity.term_id
              ].filter(v => v != null);
              
              const isSelected = checkVariations.some(vid => 
                normalizedSelectedIds.has(normalizeId(vid)) ||
                selectedIds.some(sid => idsMatch(sid, vid))
              );
              
              if (isSelected && !foundIds.has(amenityId)) {
                selectedAmenities.push(amenity);
                foundIds.add(amenityId);
                foundIds.add(String(amenityId));
              }
            }
          });
          
          // Also include any amenity objects that might not be in allAmenities yet (new features)
          if (selectedAmenityObjects.length > 0) {
            selectedAmenityObjects.forEach(amenityObj => {
              const amenityId = normalizeId(amenityObj.id || amenityObj.term_id);
              if (amenityId != null && !foundIds.has(amenityId)) {
              const exists = selectedAmenities.some(a => {
                  const aId = normalizeId(a.id || a.term_id);
                  return idsMatch(aId, amenityId);
              });
              if (!exists) {
                selectedAmenities.push(amenityObj);
                  foundIds.add(amenityId);
                  foundIds.add(String(amenityId));
                }
              }
            });
          }
          
          setAmenities(selectedAmenities);
          
          // Group amenities by parent - show all selected amenities (both parents and children)
          const grouped = {};
          const processedIds = new Set(); // Track processed amenities to avoid duplicates
          
          // Separate selected amenities into parents and children
          const selectedParents = [];
          const selectedChildren = [];
          
          selectedAmenities.forEach((amenity) => {
            const amenityId = amenity.id || amenity.term_id;
            const parentId = amenity.parent || amenity.parent_id || amenity.parent_term_id || 0;
            
            if (parentId && parentId !== 0 && parentId !== '0') {
              // It's a child
              selectedChildren.push(amenity);
            } else {
              // It's a parent (or standalone)
              selectedParents.push(amenity);
            }
          });
          
          // Process parents first
          selectedParents.forEach((amenity) => {
            const amenityId = amenity.id || amenity.term_id;
            const parentName = amenity.name;
            
            // Find children of this parent that are also selected
            const children = selectedChildren.filter(child => {
              const childParentId = child.parent || child.parent_id || child.parent_term_id || 0;
              const childParentIdNum = typeof childParentId === 'string' ? parseInt(childParentId) : childParentId;
              const amenityIdNum = typeof amenityId === 'string' ? parseInt(amenityId) : amenityId;
              return childParentId === amenityId || 
                     childParentIdNum === amenityIdNum ||
                     String(childParentId) === String(amenityId) ||
                     (childParentIdNum && amenityIdNum && childParentIdNum === amenityIdNum);
            });
            
            if (children.length > 0) {
              // Has selected children, group children under this parent
              // Don't include the parent itself in the children list (parent is shown as heading)
              grouped[parentName] = [...children];
              // Mark parent and children as processed
              processedIds.add(amenityId);
              children.forEach(child => {
                processedIds.add(child.id || child.term_id);
              });
            } else {
              // No selected children, show parent as standalone
              if (!grouped[parentName]) {
                grouped[parentName] = [];
              }
              grouped[parentName].push(amenity);
              processedIds.add(amenityId);
            }
          });
          
          // Process remaining children (those whose parents are not selected)
          selectedChildren.forEach((amenity) => {
            const amenityId = amenity.id || amenity.term_id;
            
            // Skip if already processed
            if (processedIds.has(amenityId)) {
              return;
            }
            
            processedIds.add(amenityId);
            
            const parentId = amenity.parent || amenity.parent_id || amenity.parent_term_id || 0;
            
            // Try to find parent in all amenities by ID
            let parent = allAmenities.find(a => {
              const aId = a.id || a.term_id;
              const aParent = a.parent || a.parent_id || a.parent_term_id || 0;
              return (aId === parentId || 
                      aId === parseInt(parentId) || 
                      String(aId) === String(parentId) ||
                      parseInt(aId) === parseInt(parentId)) && 
                     (aParent === 0 || !aParent || aParent === '0');
            });
            
            // If still not found, try to find by slug (e.g., "activities", "fun-activities")
            if (!parent && amenity.parent_slug) {
              const parentSlug = (amenity.parent_slug || '').toLowerCase();
              parent = allAmenities.find(a => {
                const aSlug = (a.slug || '').toLowerCase();
                const aParent = a.parent || a.parent_id || 0;
                // Match exact slug or if slug contains "activit" (for variations like "fun-activities")
                return (a.slug === amenity.parent_slug || 
                        aSlug === parentSlug ||
                        (aSlug.includes('activit') && parentSlug.includes('activit')) ||
                        (parentSlug.includes('activit') && aSlug.includes('activit')) ||
                        aSlug === 'activities' ||
                        aSlug === 'fun-activities') && 
                       (aParent === 0 || !aParent || aParent === '0');
              });
            }
            
            // If still not found, try to find by name "Activities" (case insensitive) or slug variations
            if (!parent) {
              parent = allAmenities.find(a => {
                const aName = (a.name || '').toLowerCase();
                const aSlug = (a.slug || '').toLowerCase();
                const aParent = a.parent || a.parent_id || 0;
                return (aName === 'activities' || 
                        aName.includes('activit') ||
                        aSlug === 'activities' || 
                        aSlug === 'fun-activities' ||
                        aSlug.includes('activit')) && 
                       (aParent === 0 || !aParent || aParent === '0');
              });
            }
            
            // One more try: search by parent ID in all amenities to find the actual parent (any parent with matching ID)
            if (!parent && parentId) {
              parent = allAmenities.find(a => {
                const aId = a.id || a.term_id;
                return aId === parentId || aId === parseInt(parentId) || String(aId) === String(parentId);
              });
            }
            
            if (parent) {
              const parentName = parent.name;
              if (!grouped[parentName]) {
                grouped[parentName] = [];
              }
              // Only add if not already in the group
              if (!grouped[parentName].some(a => (a.id || a.term_id) === amenityId)) {
                grouped[parentName].push(amenity);
              }
            } else {
              // Parent not found, try to get parent name from amenity object or selected amenities
              let parentName = 'Other';
              
              // First, try to find parent by ID in all amenities (even if it has a parent itself)
              const parentById = allAmenities.find(a => {
                const aId = a.id || a.term_id;
                return aId === parentId || aId === parseInt(parentId) || String(aId) === String(parentId);
              });
              if (parentById) {
                parentName = parentById.name || 'Activities';
              } else {
                // Check if parent is in selected amenities (might be an object with name)
                if (typeof amenityData[0] === 'object') {
                  const parentInSelected = amenityData.find(a => {
                    const aId = a.id || a.term_id;
                    return aId === parentId || aId === parseInt(parentId) || String(aId) === String(parentId);
                  });
                  if (parentInSelected && parentInSelected.name) {
                    parentName = parentInSelected.name;
                  } else if (amenity.parent_name) {
                    parentName = amenity.parent_name;
                  } else if (amenity.parent_slug) {
                    const parentSlug = (amenity.parent_slug || '').toLowerCase();
                    // Try to find the actual parent name from all amenities
                    const potentialParent = allAmenities.find(a => {
                      const aSlug = (a.slug || '').toLowerCase();
                      const aParent = a.parent || a.parent_id || 0;
                      return (a.slug === amenity.parent_slug || 
                              aSlug === parentSlug ||
                              (aSlug.includes('activit') && parentSlug.includes('activit')) ||
                              (parentSlug.includes('activit') && aSlug.includes('activit'))) &&
                             (aParent === 0 || !aParent || aParent === '0');
                    });
                    if (potentialParent) {
                      parentName = potentialParent.name || 'Activities';
                    } else if (parentSlug.includes('activit')) {
                      // If slug contains "activit" but parent not found, try one more search
                      const fallbackParent = allAmenities.find(a => {
                        const aSlug = (a.slug || '').toLowerCase();
                        const aName = (a.name || '').toLowerCase();
                        const aParent = a.parent || a.parent_id || 0;
                        return (aSlug.includes('activit') || aName.includes('activit')) && 
                               (aParent === 0 || !aParent || aParent === '0');
                      });
                      parentName = fallbackParent ? (fallbackParent.name || 'Activities') : 'Activities';
                    }
                  }
                } else if (amenity.parent_name) {
                  parentName = amenity.parent_name;
                } else if (amenity.parent_slug) {
                  const parentSlug = (amenity.parent_slug || '').toLowerCase();
                  // Try to find the actual parent name from all amenities
                  const potentialParent = allAmenities.find(a => {
                    const aSlug = (a.slug || '').toLowerCase();
                    const aParent = a.parent || a.parent_id || 0;
                    return (a.slug === amenity.parent_slug || 
                            aSlug === parentSlug ||
                            (aSlug.includes('activit') && parentSlug.includes('activit')) ||
                            (parentSlug.includes('activit') && aSlug.includes('activit'))) &&
                           (aParent === 0 || !aParent || aParent === '0');
                  });
                  if (potentialParent) {
                    parentName = potentialParent.name || 'Activities';
                  } else if (parentSlug.includes('activit')) {
                    // If slug contains "activit" but parent not found, try one more search
                    const fallbackParent = allAmenities.find(a => {
                      const aSlug = (a.slug || '').toLowerCase();
                      const aName = (a.name || '').toLowerCase();
                      const aParent = a.parent || a.parent_id || 0;
                      return (aSlug.includes('activit') || aName.includes('activit')) && 
                             (aParent === 0 || !aParent || aParent === '0');
                    });
                    parentName = fallbackParent ? (fallbackParent.name || 'Activities') : 'Activities';
                  }
                } else {
                  // Last resort: search all amenities for a parent with this ID that has slug/name containing "activit"
                  const potentialParent = allAmenities.find(a => {
                    const aId = a.id || a.term_id;
                    const aSlug = (a.slug || '').toLowerCase();
                    const aName = (a.name || '').toLowerCase();
                    return (aId === parentId || aId === parseInt(parentId) || String(aId) === String(parentId)) && 
                           (aSlug.includes('activit') || aName.includes('activit') || aSlug === 'fun-activities');
                  });
                  if (potentialParent) {
                    parentName = potentialParent.name || 'Activities';
                  }
                }
              }
              
              if (!grouped[parentName]) {
                grouped[parentName] = [];
              }
              if (!grouped[parentName].some(a => (a.id || a.term_id) === amenityId)) {
                grouped[parentName].push(amenity);
              }
            }
          });
          
          setGroupedAmenities(grouped);
        } catch (error) {
          console.error('❌ AMENITIES DEBUG - Error loading amenities:', error);
        }
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading listing:', error);
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    if (!price) return 'Price on request';
    return `₮${parseFloat(price).toLocaleString()}`;
  };

  const formatTime = (time) => {
    if (!time) return '';
    // Handle time strings like "14:00:45" or "10:00:02"
    // Remove seconds and return "14:00" or "10:00"
    if (typeof time === 'string') {
      const parts = time.split(':');
      if (parts.length >= 2) {
        return `${parts[0]}:${parts[1]}`;
      }
    }
    return time;
  };

  const handleBookingConfirm = () => {
    if (!totalPrice || !startDate || !endDate || !listing) return;
    navigate(`/booking/${listing.id}/confirm`, {
      state: {
        listing: {
          id: listing.id,
          listing_name: listing.listing_name,
          listing_gallery: listing.listing_gallery,
          listing_price: listing.listing_price,
          listing_region: listing.listing_region,
          listing_location: listing.listing_location,
          listing_familiar_location: listing.listing_familiar_location,
          room_number: listing.room_number,
          listing_bed_number: listing.listing_bed_number,
          guest_max_number: listing.guest_max_number,
        },
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        guestCount,
        totalPrice,
      },
    });
  };

  // Helper function to get location display text with parent
  const getLocationDisplay = (term, locationsList) => {
    if (!term || !locationsList) return null;
    
    // API uses 'id' and 'parent' fields directly
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
      
      // If this is a child
      if (parentId && parentId !== 0 && parentId !== '0') {
        // Check if parent is also selected
        const parentIsSelected = isSelected(parentId);
        
        if (parentIsSelected) {
          // Find parent and show "Parent • Child"
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
          // Parent not selected, show child with parent
          const display = getLocationDisplay(term, locationsList);
          if (display && !results.includes(display)) {
            results.push(display);
            processed.add(idStr);
          }
        }
      } else {
        // This is a parent
        // Check if any children are selected
        const hasChildren = selectedTerms.some(t => {
          const tId = getId(t);
          const tParentId = t.parent || t.parent_id || t.parent_term_id || 0;
          return idsEqual(tParentId, termId) && !idsEqual(tId, termId);
        });
        
        if (!hasChildren) {
          // No children selected, show parent
          const display = getLocationDisplay(term, locationsList);
          if (display && !results.includes(display)) {
            results.push(display);
            processed.add(idStr);
          }
        } else {
          // Has children, mark as processed (children will show it)
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
      if (taxonomyType === 'categories' && categories.length > 0) {
        const term = categories.find(t => (t.id || t.term_id) === value);
        return term ? (term.name || term.slug || null) : null;
      }
      if (taxonomyType === 'locations' && locations.length > 0) {
        const term = locations.find(t => {
          const tId = t.id || t.term_id;
          return tId === value || tId === parseInt(value) || String(tId) === String(value);
        });
        if (term) {
          // Use helper function to get parent > child format
          return getLocationDisplay(term, locations);
        }
        return null;
      }
      if (taxonomyType === 'sizes' && sizes.length > 0) {
        const term = sizes.find(t => (t.id || t.term_id) === value);
        return term ? (term.name || term.slug || null) : null;
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
        if (taxonomyType === 'locations' && locations.length > 0) {
          const locationDisplay = getLocationDisplay(firstItem, locations);
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
        if (taxonomyType === 'categories' && categories.length > 0) {
          const term = categories.find(t => (t.id || t.term_id) === firstItem);
          return term ? (term.name || term.slug || null) : null;
        }
        if (taxonomyType === 'locations' && locations.length > 0) {
          const term = locations.find(t => {
            const tId = t.id || t.term_id;
            return tId === firstItem || tId === parseInt(firstItem) || String(tId) === String(firstItem);
          });
          if (term) {
            // Use helper function to get parent > child format
            return getLocationDisplay(term, locations);
          }
          return null;
        }
        if (taxonomyType === 'sizes' && sizes.length > 0) {
          const term = sizes.find(t => (t.id || t.term_id) === firstItem);
          return term ? (term.name || term.slug || null) : null;
        }
        return null;
      }
      
      return String(firstItem);
    }
    
    // Handle objects
    if (typeof value === 'object' && value !== null) {
      // For locations, use helper function to get parent > child format
      if (taxonomyType === 'locations' && locations.length > 0) {
        const locationDisplay = getLocationDisplay(value, locations);
        if (locationDisplay) return locationDisplay;
      }
      return value.name || value.slug || value.title || value.label || null;
    }
    
    // Fallback: convert to string
    const stringValue = String(value);
    return stringValue.trim() || null;
  };

  const extractTermId = (value) => {
    if (!value) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      return Number.isNaN(parsed) ? null : parsed;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return null;
      return extractTermId(value[0]);
    }
    if (typeof value === 'object') {
      return (
        value.id ||
        value.term_id ||
        value.ID ||
        value.term ||
        extractTermId(value.value) ||
        null
      );
    }
    return null;
  };

  const getListingPrimaryImage = (item) => {
    if (!item) return null;
    const gallery = item.listing_gallery;
    const extractFromEntry = (entry) => {
      if (!entry) return null;
      if (typeof entry === 'string') return entry;
      if (typeof entry === 'object') {
        return (
          entry.url ||
          entry.source_url ||
          entry.guid ||
          entry.rendered ||
          entry.src ||
          null
        );
      }
      return null;
    };

    if (Array.isArray(gallery) && gallery.length > 0) {
      const image = extractFromEntry(gallery[0]);
      if (image) return image;
    }

    if (item.featured_media?.source_url) return item.featured_media.source_url;
    if (typeof item.listing_featured_image === 'string') return item.listing_featured_image;

    return null;
  };

  useEffect(() => {
    loadListing();
  }, [id]);

  const maxGuests = Math.max(parseInt(listing?.guest_max_number, 10) || 10, 1);
  const fakeReviews = useMemo(
    () =>
      REVIEW_TEMPLATES.map((review, index) => ({
        ...review,
        id: index,
        comment: review.comment.replace('{listing}', listing?.listing_name || 'this home'),
      })),
    [listing?.listing_name]
  );

  const averageFakeRating = useMemo(() => {
    if (!fakeReviews.length) return null;
    const total = fakeReviews.reduce((sum, review) => sum + (review.rating || 0), 0);
    return (total / fakeReviews.length).toFixed(1);
  }, [fakeReviews]);

  const featuredCategoryId = useMemo(
    () => extractTermId(listing?.listing_category),
    [listing?.listing_category]
  );

  const featuredCategory = useMemo(() => {
    if (!featuredCategoryId || categories.length === 0) return null;
    return (
      categories.find((cat) => {
        const catId = cat.id || cat.term_id;
        return Number(catId) === Number(featuredCategoryId);
      }) || null
    );
  }, [featuredCategoryId, categories]);

  const featuredCategoryName = useMemo(() => {
    if (featuredCategory?.name) return featuredCategory.name;
    return getTaxonomyValue(listing?.listing_category, 'categories');
  }, [featuredCategory, listing?.listing_category]);

  const featuredCategoryDescription = featuredCategory?.description;

  const renderRelatedListingsSection = () => {
    if (!(relatedLoading || relatedListings.length > 0)) {
      return null;
    }

    return (
      <div className="mt-12" id="related-listings-section">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-600">
              More stays
            </p>
            <h2 className="text-2xl font-semibold text-gray-900">
              Other homes in {featuredCategoryName || 'Touresm'}
            </h2>
            <p className="text-sm text-gray-500">
              Because you viewed {listing?.listing_name || 'this listing'}
            </p>
          </div>
          {featuredCategoryId && (
            <Link
              to={`/?category=${featuredCategoryId}`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 hover:text-primary-700"
            >
              View category
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}
        </div>

        {relatedLoading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary-600" />
          </div>
        ) : relatedListings.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-8 text-center text-gray-500">
            No other listings found in this category yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {relatedListings.map((item) => {
              const image = getListingPrimaryImage(item);
              const price = item.listing_price || item.meta?.listing_price;
              return (
                <Link
                  to={`/listing/${item.id}`}
                  key={item.id}
                  className="group overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-gray-100">
                    {image ? (
                      <img
                        src={image}
                        alt={item.listing_name || 'Listing image'}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-400">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {item.listing_name || 'Listing'}
                      </h3>
                      {price && (
                        <span className="text-sm font-semibold text-primary-600">
                          ₮{Number(price).toLocaleString()}
                        </span>
                      )}
                    </div>
                    {item.listing_location && (
                      <p className="mt-1 text-sm text-gray-500">
                        {getTaxonomyValue(item.listing_location, 'locations')}
                      </p>
                    )}
                    <p className="mt-3 text-sm text-gray-600 line-clamp-2">
                      {item.listing_excerpt ||
                        item.listing_description ||
                        'Tap to view more details about this stay.'}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    setGuestCount((prev) => {
      if (prev > maxGuests) return maxGuests;
      if (prev < 1) return 1;
      return prev;
    });
  }, [maxGuests]);

  // Detect mobile screen
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle body overflow when mobile booking modal is open
  useEffect(() => {
    if (mobileBookingModalOpen) {
      document.body.style.overflow = 'hidden';
      document.body.setAttribute('data-booking-modal-open', 'true');
    } else {
      document.body.style.overflow = '';
      document.body.removeAttribute('data-booking-modal-open');
    }
    return () => {
      document.body.style.overflow = '';
      document.body.removeAttribute('data-booking-modal-open');
    };
  }, [mobileBookingModalOpen]);
  
  useEffect(() => {
    if (!listing?.listing_price) {
      setTotalPrice(null);
      return;
    }

    if (!startDate || !endDate) {
      setTotalPrice(null);
      return;
    }

    if (hasBlockedDateInRange(startDate, endDate)) {
      setTotalPrice(null);
      return;
    }

    const nightlyRate = parseFloat(listing.listing_price);
    if (Number.isNaN(nightlyRate)) {
      setTotalPrice(null);
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    const rawDiffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (rawDiffDays < 0) {
      setTotalPrice(null);
      return;
    }

    const nights = Math.max(rawDiffDays, 1);

    setTotalPrice({
      total: nightlyRate * nights,
      nights,
    });
  }, [listing?.listing_price, startDate, endDate, hasBlockedDateInRange]);

  if (loading) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg mb-4">Listing not found.</p>
          <Link
            to="/"
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            ← Back to Listings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 text-primary-600 hover:text-primary-700 font-medium flex items-center"
      >
        <svg
          className="w-5 h-5 mr-2"
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
        Back to Listings
      </button>

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Image Gallery */}
        {listing.listing_gallery && (
          <ImageGallery images={listing.listing_gallery} />
        )}

        <div className="p-8">
          <div className="flex flex-col gap-8 lg:flex-row">
            <div className="flex-1">
          {/* Header */}
          <div className="mb-6">
                <div className="mb-4 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => console.info('Wishlist demo action')}
                      className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700 shadow-sm transition hover:border-gray-300 hover:text-gray-900"
                      title="Save to wishlist (demo)"
                    >
                      <svg
                        className="h-3.5 w-3.5 text-primary-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 6.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                        />
                      </svg>
                      Wishlist
                    </button>
                    <button
                      type="button"
                      onClick={() => console.info('Share demo action')}
                      className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700 shadow-sm transition hover:border-gray-300 hover:text-gray-900"
                      title="Share listing (demo)"
                    >
                      <svg
                        className="h-3.5 w-3.5 text-primary-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 8a3 3 0 10-3-3 3 3 0 003 3zm-6 8a3 3 0 10-3 3 3 3 0 003-3zm9 0a3 3 0 10-3 3 3 3 0 003-3z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8.59 13.51l6.83 3.98M15.41 6.51L8.59 10.49"
                        />
                      </svg>
                      Share
                    </button>
                  </div>
              <div className="flex-1 min-w-0">
                    <h1 className="mb-2 text-4xl font-bold text-gray-900">
                  {listing.listing_name || 'Unnamed Listing'}
                </h1>
                    {(() => {
                      const locationDisplays = getAllLocationDisplays(listing.listing_location, locations);
                      return locationDisplays.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-2 text-lg">
                    <svg
                            className="h-5 w-5 text-gray-600"
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
                          {locationDisplays.map((location, index) => (
                            <span key={index} className="text-gray-600">
                              {location}
                              {index < locationDisplays.length - 1 && <span className="mx-1">•</span>}
                            </span>
                          ))}
                          {listing.listing_familiar_location && (
                            <span className="text-gray-600">
                              {locationDisplays.length > 0 && <span>, </span>}
                              {listing.listing_familiar_location}
                            </span>
                )}
              </div>
                      ) : null;
                    })()}
                    {(() => {
                      const regionDisplays = getAllLocationDisplays(listing.listing_region || listing.listing_location, locations);
                      if (regionDisplays.length === 0 && listing.listing_familiar_location) {
                        return (
                          <div className="flex flex-wrap items-center gap-2 text-lg text-gray-600">
                            <svg
                              className="h-5 w-5 text-gray-600"
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
                            <span>{listing.listing_familiar_location}</span>
                          </div>
                        );
                      }
                      return null;
                    })()}
              </div>
            </div>

                <div className="flex flex-wrap items-center gap-3">
              {listing.listing_category && getTaxonomyValue(listing.listing_category, 'categories') && (
                    <span className="inline-block rounded-full bg-primary-100 px-4 py-2 text-sm font-medium text-primary-800">
                  {getTaxonomyValue(listing.listing_category, 'categories')}
                </span>
              )}
              {listing.listing_social_url && (
                <a
                  href={listing.listing_social_url}
                  target="_blank"
                  rel="noopener noreferrer"
                      className="inline-flex items-center rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                >
                  <svg
                        className="mr-2 h-4 w-4"
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
                  Social Link
                </a>
              )}
                  {listing.listing_video && (
                    <a
                      href={listing.listing_video}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                    >
                      <svg
                        className="mr-2 h-4 w-4"
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
          </div>

          {/* Listing Details */}
          <div className="mb-8">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {listing.room_number && (
                    <div className="flex items-center rounded-lg bg-gray-50 p-4">
                      <div className="mr-4 rounded-lg bg-primary-100 p-3">
                    <svg
                          className="h-6 w-6 text-primary-600"
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
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{listing.room_number}</p>
                    <p className="text-sm text-gray-600">{listing.room_number === 1 ? 'Room' : 'Rooms'}</p>
                  </div>
                </div>
              )}
              {listing.listing_bed_number && (
                    <div className="flex items-center rounded-lg bg-gray-50 p-4">
                      <div className="mr-4 rounded-lg bg-primary-100 p-3">
                    <svg
                          className="h-6 w-6 text-primary-600"
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
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{listing.listing_bed_number}</p>
                    <p className="text-sm text-gray-600">{listing.listing_bed_number === 1 ? 'Bed' : 'Beds'}</p>
                  </div>
                </div>
              )}
              {listing.guest_max_number && (
                    <div className="flex items-center rounded-lg bg-gray-50 p-4">
                      <div className="mr-4 rounded-lg bg-primary-100 p-3">
                    <svg
                          className="h-6 w-6 text-primary-600"
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
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{listing.guest_max_number}</p>
                    <p className="text-sm text-gray-600">{listing.guest_max_number === 1 ? 'Guest' : 'Guests'}</p>
                  </div>
                </div>
              )}
              {listing.listing_size && getTaxonomyValue(listing.listing_size, 'sizes') && (
                    <div className="flex items-center rounded-lg bg-gray-50 p-4">
                      <div className="mr-4 rounded-lg bg-primary-100 p-3">
                    <svg
                          className="h-6 w-6 text-primary-600"
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
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{getTaxonomyValue(listing.listing_size, 'sizes')}</p>
                    <p className="text-sm text-gray-600">Size</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Featured Category Section */}
          {featuredCategoryName && (
            <div className="mb-10 rounded-3xl border border-primary-100 bg-white/90 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.285 3.95a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.285 3.95c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.785.57-1.84-.197-1.54-1.118l1.285-3.95a1 1 0 00-.364-1.118L3.064 9.377c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.285-3.95z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary-600">
                    Featured stay
                  </p>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Guest favourite in {featuredCategoryName}
                  </h2>
                </div>
              </div>
              <p className="mt-3 text-sm text-gray-600">
                Hand-picked by Touresm as a standout stay with consistently high guest feedback.
              </p>
            </div>
          )}

          {/* Description */}
          {listing.listing_description && (
            <div className="mb-8">
                  <h2 className="mb-4 text-2xl font-semibold text-gray-900">Description</h2>
              <div
                    className="prose max-w-none text-gray-700 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: listing.listing_description }}
              />
            </div>
          )}

          {/* Features */}
          {listing.listing_features && (
            <div className="mb-8">
                  <h2 className="mb-4 text-2xl font-semibold text-gray-900">Features</h2>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {Array.isArray(listing.listing_features) ? (
                  listing.listing_features.map((feature, index) => (
                    <div
                      key={index}
                          className="flex items-center rounded-lg bg-gray-50 p-3"
                    >
                      <svg
                            className="mr-2 h-5 w-5 text-primary-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-gray-700">{getTaxonomyValue(feature)}</span>
                    </div>
                  ))
                ) : (
                      <div className="flex items-center rounded-lg bg-gray-50 p-3">
                    <svg
                          className="mr-2 h-5 w-5 text-primary-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-gray-700">{getTaxonomyValue(listing.listing_features)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Amenities */}
          {Object.keys(groupedAmenities).length > 0 && (
            <div className="mb-8">
                  <h2 className="mb-4 text-2xl font-semibold text-gray-900">Amenities</h2>
              <div className="space-y-6">
                {Object.entries(groupedAmenities).map(([parentName, children]) => (
                  <div key={parentName} className="border-b border-gray-200 pb-6 last:border-b-0 last:pb-0">
                        <h3 className="mb-3 text-lg font-semibold text-gray-900">{parentName}</h3>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {children.map((amenity) => (
                        <div
                          key={amenity.id || amenity.term_id}
                              className="flex items-center rounded-lg bg-gray-50 p-3"
                        >
                          <svg
                                className="mr-2 h-4 w-4 flex-shrink-0 text-primary-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                              <span className="text-sm text-gray-700">{amenity.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reviews */}
          {fakeReviews.length > 0 && (
            <div className="mb-8">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">Guest impressions (demo)</h2>
                  {averageFakeRating && (
                    <p className="text-sm text-gray-500">
                      Average rating {averageFakeRating} · {fakeReviews.length} {fakeReviews.length === 1 ? 'review' : 'reviews'}
                    </p>
                  )}
                </div>
                <div className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-3 py-1 text-sm font-semibold text-primary-700">
                  <svg
                    className="h-4 w-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.785.57-1.84-.197-1.54-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  Verified demo
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {fakeReviews.map((review) => (
                  <div key={review.id} className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-lg font-semibold text-primary-700">
                          {review.name
                            .split(' ')
                            .map((part) => part[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-base font-semibold text-gray-900">{review.name}</p>
                          <p className="text-sm text-gray-500">{review.location}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-primary-600">
                        {Array.from({ length: 5 }).map((_, index) => (
                          <svg
                            key={index}
                            className={`h-5 w-5 ${index < review.rating ? 'text-primary-500' : 'text-gray-300'}`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.785.57-1.84-.197-1.54-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                    </div>
                    <p className="mb-2 text-sm font-medium text-gray-500">{review.stay}</p>
                    <p className="text-base leading-relaxed text-gray-700">{review.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

            </div>

            <aside className="w-full lg:w-96">
            <div className="sticky top-24">
                <div className="space-y-6 rounded-2xl border border-gray-200 bg-gray-50 p-6 shadow-sm">
                  <div>
                    {listing.listing_price ? (
                      <>
                        <p className="text-3xl font-bold text-primary-600">
                          {totalPrice ? formatPrice(totalPrice.total) : formatPrice(listing.listing_price)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {totalPrice
                            ? `${formatPrice(listing.listing_price)} × ${totalPrice.nights} night${totalPrice.nights === 1 ? '' : 's'}`
                            : 'Select check-in and check-out dates to see the total price'}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-2xl font-semibold text-gray-900">Price on request</p>
                        <p className="text-sm text-gray-500">Contact the host for pricing</p>
                      </>
                    )}
                    {totalPrice && (
                      <div className="mt-3 rounded-xl border border-primary-100 bg-white px-4 py-2 text-sm text-primary-700 font-semibold">
                        Deposit (30%): {formatPrice(totalPrice.total * 0.3)}
                      </div>
                    )}
        </div>

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="start-date" className="block text-sm font-medium text-gray-700">
                        Start date
                      </label>
                      <CustomDatePicker
                        selected={startDate}
                        onChange={handleStartDateChange}
                        onClear={() => {
                          setStartDate(null);
                          setEndDate(null);
                          setDateError('');
                        }}
                        placeholder="Check-in date"
                        selectsStart
                        startDate={startDate}
                        endDate={endDate}
                        filterDate={isDateSelectable}
                      />
                      {listing.check_in_time && (
                        <p className="mt-1 text-xs text-gray-500">
                          Check-in time: {formatTime(listing.check_in_time)}
                        </p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="end-date" className="block text-sm font-medium text-gray-700">
                        End date
                      </label>
                      <CustomDatePicker
                        selected={endDate}
                        onChange={handleEndDateChange}
                        onClear={() => {
                          setEndDate(null);
                          setDateError('');
                        }}
                        placeholder="Check-out date"
                        selectsEnd
                        startDate={startDate}
                        endDate={endDate}
                        minDate={startDate || new Date()}
                        filterDate={isDateSelectable}
                      />
                      {listing.check_out_time && (
                        <p className="mt-1 text-xs text-gray-500">
                          Check-out time: {formatTime(listing.check_out_time)}
                        </p>
                      )}
                    </div>
                    {dateError && (
                      <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                        {dateError}
                      </div>
                    )}
                    {(listing.check_in_time || listing.check_out_time) && (
                      <div className="rounded-lg border border-gray-200 bg-white p-3">
                        <div className="flex items-center justify-between text-sm">
                          {listing.check_in_time && (
                            <div className="flex items-center">
                              <svg
                                className="mr-2 h-4 w-4 text-primary-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              <span className="text-gray-600">Check-in:</span>
                              <span className="ml-1 font-medium text-gray-900">{formatTime(listing.check_in_time)}</span>
                            </div>
                          )}
                          {listing.check_in_time && listing.check_out_time && (
                            <span className="mx-2 text-gray-300">•</span>
                          )}
                          {listing.check_out_time && (
                            <div className="flex items-center">
                              <svg
                                className="mr-2 h-4 w-4 text-primary-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              <span className="text-gray-600">Check-out:</span>
                              <span className="ml-1 font-medium text-gray-900">{formatTime(listing.check_out_time)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Guests
                      </label>
                      <div className="mt-1 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
                        <button
                          type="button"
                          onClick={() => setGuestCount((prev) => Math.max(prev - 1, 1))}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-lg font-semibold text-gray-600 transition hover:border-gray-300 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-300"
                          aria-label="Decrease guests"
                        >
                          −
                        </button>
                        <div className="text-center">
                          <p className="text-lg font-semibold text-gray-900">{guestCount}</p>
                          <p className="text-xs text-gray-500">{guestCount === 1 ? 'Guest' : 'Guests'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setGuestCount((prev) => Math.min(prev + 1, maxGuests))}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-lg font-semibold text-gray-600 transition hover:border-gray-300 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-300 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Increase guests"
                          disabled={guestCount >= maxGuests}
                        >
                          +
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Maximum {maxGuests} {maxGuests === 1 ? 'guest' : 'guests'} allowed
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!totalPrice}
                    onClick={handleBookingConfirm}
                    className={`inline-flex w-full items-center justify-center rounded-full px-5 py-3 font-semibold text-white shadow-lg shadow-primary-200/60 transition-all duration-200 ${
                      totalPrice
                        ? 'bg-primary-600 hover:bg-primary-700'
                        : 'bg-primary-300 cursor-not-allowed'
                    }`}
                  >
                    Confirm Availability
                  </button>

                  <p className="text-center text-xs text-gray-500">
                    You won’t be charged yet. We’ll confirm your stay within 24 hours of submitting your request.
                  </p>
                </div>
              </div>
            </aside>
          </div>

          {!isMobile && renderRelatedListingsSection()}
          {isMobile && renderRelatedListingsSection()}
        </div>
      </div>

      {/* Mobile Sticky Booking Bar */}
      {isMobile && listing && (
        <>
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40">
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  {listing.listing_price ? (
                    <>
                      <p className="text-xl font-bold text-primary-600">
                        {totalPrice ? formatPrice(totalPrice.total) : formatPrice(listing.listing_price)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {totalPrice
                          ? `${formatPrice(listing.listing_price)} × ${totalPrice.nights} night${totalPrice.nights === 1 ? '' : 's'}`
                          : 'per night'}
                      </p>
                    </>
                  ) : (
                    <p className="text-lg font-semibold text-gray-900">Price on request</p>
                  )}
                </div>
                <button
                  onClick={() => setMobileBookingModalOpen(true)}
                  className="px-6 py-2.5 bg-primary-600 text-white rounded-full font-semibold hover:bg-primary-700 transition-colors"
                >
                  {totalPrice ? 'Book Now' : 'Check Availability'}
                </button>
              </div>
            </div>
          </div>
          {/* Add padding to prevent content from being hidden behind sticky bar */}
          <div className="md:hidden h-20" />
        </>
      )}

      {/* Mobile Booking Modal */}
      {isMobile && mobileBookingModalOpen && listing && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileBookingModalOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 bottom-0 top-4 bg-white rounded-t-3xl shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Booking</p>
                <h3 className="text-lg font-semibold text-gray-900">Select dates & guests</h3>
              </div>
              <button
                type="button"
                onClick={() => setMobileBookingModalOpen(false)}
                className="rounded-full border border-gray-200 p-2 text-gray-500 hover:text-gray-700"
                aria-label="Close booking"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-6 pb-6">
                {/* Price Display */}
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  {listing.listing_price ? (
                    <>
                      <div className="mb-3">
                        <p className="text-2xl font-bold text-primary-600">
                          {totalPrice ? formatPrice(totalPrice.total) : formatPrice(listing.listing_price)}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          {totalPrice
                            ? `${formatPrice(listing.listing_price)} × ${totalPrice.nights} night${totalPrice.nights === 1 ? '' : 's'}`
                            : 'Select dates to see total price'}
                        </p>
                      </div>
                      {totalPrice && (
                        <div className="rounded-lg border-2 border-primary-200 bg-primary-50 px-4 py-3">
                          <p className="text-sm font-semibold text-primary-900 mb-1">Deposit Required</p>
                          <p className="text-lg font-bold text-primary-700">
                            {formatPrice(totalPrice.total * 0.3)}
                            <span className="text-sm font-normal text-primary-600 ml-1">(30% of total)</span>
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-xl font-semibold text-gray-900">Price on request</p>
                      <p className="text-sm text-gray-500">Contact the host for pricing</p>
                    </>
                  )}
                </div>

                {/* Date Pickers */}
                <div>
                  <label htmlFor="mobile-start-date" className="block text-sm font-medium text-gray-700 mb-2">
                    Check-in date
                  </label>
                  <CustomDatePicker
                    selected={startDate}
                    onChange={handleStartDateChange}
                    onClear={() => {
                      setStartDate(null);
                      setEndDate(null);
                      setDateError('');
                    }}
                    placeholder="Select check-in date"
                    selectsStart
                    startDate={startDate}
                    endDate={endDate}
                    filterDate={isDateSelectable}
                  />
                  {listing.check_in_time && (
                    <p className="mt-1 text-xs text-gray-500">
                      Check-in time: {formatTime(listing.check_in_time)}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="mobile-end-date" className="block text-sm font-medium text-gray-700 mb-2">
                    Check-out date
                  </label>
                  <CustomDatePicker
                    selected={endDate}
                    onChange={handleEndDateChange}
                    onClear={() => {
                      setEndDate(null);
                      setDateError('');
                    }}
                    placeholder="Select check-out date"
                    selectsEnd
                    startDate={startDate}
                    endDate={endDate}
                    minDate={startDate || new Date()}
                    filterDate={isDateSelectable}
                  />
                  {listing.check_out_time && (
                    <p className="mt-1 text-xs text-gray-500">
                      Check-out time: {formatTime(listing.check_out_time)}
                    </p>
                  )}
                </div>

                {dateError && (
                  <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                    {dateError}
                  </div>
                )}

                {/* Check-in/Check-out Times */}
                {(listing.check_in_time || listing.check_out_time) && (
                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex items-center justify-between text-sm">
                      {listing.check_in_time && (
                        <div className="flex items-center">
                          <svg
                            className="mr-2 h-4 w-4 text-primary-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <span className="text-gray-600">Check-in:</span>
                          <span className="ml-1 font-medium text-gray-900">{formatTime(listing.check_in_time)}</span>
                        </div>
                      )}
                      {listing.check_in_time && listing.check_out_time && (
                        <span className="mx-2 text-gray-300">•</span>
                      )}
                      {listing.check_out_time && (
                        <div className="flex items-center">
                          <svg
                            className="mr-2 h-4 w-4 text-primary-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <span className="text-gray-600">Check-out:</span>
                          <span className="ml-1 font-medium text-gray-900">{formatTime(listing.check_out_time)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Guest Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Guests
                  </label>
                  <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setGuestCount((prev) => Math.max(prev - 1, 1))}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-lg font-semibold text-gray-600 transition hover:border-gray-300 hover:text-gray-800"
                      aria-label="Decrease guests"
                    >
                      −
                    </button>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-gray-900">{guestCount}</p>
                      <p className="text-xs text-gray-500">{guestCount === 1 ? 'Guest' : 'Guests'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGuestCount((prev) => Math.min(prev + 1, maxGuests))}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-lg font-semibold text-gray-600 transition hover:border-gray-300 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Increase guests"
                      disabled={guestCount >= maxGuests}
                    >
                      +
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Maximum {maxGuests} {maxGuests === 1 ? 'guest' : 'guests'} allowed
                  </p>
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100">
              <button
                type="button"
                disabled={!totalPrice}
                onClick={() => {
                  if (totalPrice) {
                    setMobileBookingModalOpen(false);
                    handleBookingConfirm();
                  }
                }}
                className={`w-full rounded-full px-5 py-3 font-semibold text-white shadow-lg transition-all ${
                  totalPrice
                    ? 'bg-primary-600 hover:bg-primary-700'
                    : 'bg-primary-300 cursor-not-allowed'
                }`}
              >
                {totalPrice ? 'Proceed to Booking' : 'Select dates to continue'}
              </button>
              <p className="mt-2 text-center text-xs text-gray-500">
                You won't be charged yet
              </p>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default ListingDetail;

