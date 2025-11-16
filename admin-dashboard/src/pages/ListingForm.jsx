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
  getMedia,
  getMediaByParent,
  updateMediaItem,
  updateListingMetaField,
} from '../services/api';
import { updatePodsItemFields } from '../services/api';
import ImageGalleryUpload from '../components/ImageGalleryUpload';

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
  const [initialGalleryIds, setInitialGalleryIds] = useState([]);

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
      // silent
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
      setFormData({
        listing_name: listing.listing_name || listing.title?.rendered || '',
        listing_description: listing.listing_description || listing.content?.rendered || '',
        listing_price: listing.listing_price || listing.meta?.listing_price || '',
        listing_location: listing.listing_location || [],
        listing_region: listing.listing_region || [],
        listing_category: listing.listing_category || [],
        listing_size: listing.listing_size || [],
        listing_aminities: listing.listing_aminity || listing.listing_aminities || [],
        listing_social_url: listing.listing_social_url || listing.meta?.listing_social_url || '',
        listing_video: listing.listing_video || listing.meta?.listing_video || '',
        room_number: listing.room_number || listing.meta?.room_number || '',
        listing_bed_number: listing.listing_bed_number || listing.meta?.listing_bed_number || '',
        guest_max_number: listing.guest_max_number || listing.meta?.guest_max_number || '',
        check_in_time: listing.check_in_time || listing.meta?.check_in_time || '',
        check_out_time: listing.check_out_time || listing.meta?.check_out_time || '',
        listing_gallery: normalizedGallery || [],
        parent_location: parentLocation,
        child_location: childLocation,
      });
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
          // Also persist in meta for setups that read from meta (Pods/ACF variations)
          listing_gallery: galleryImageIds,
        },
        // Pods relationship field: array of attachment IDs (drives the backend "Зурагүүд" field)
        listing_gallery: galleryImageIds,
        // Taxonomy terms as arrays of IDs
        listing_category: formatTaxonomy(formData.listing_category),
        listing_size: formatTaxonomy(formData.listing_size),
        listing_location: locationToSave,
        listing_region: locationToSave,
        listing_aminities: formatTaxonomy(formData.listing_aminities),
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
      
      // Ensure Pods field reflects the gallery (so wp-admin Pods UI shows everything)
      try {
        await updatePodsItemFields('touresm-listing', listingId, {
          listing_gallery: galleryImageIds,
        });
      } catch (podsErr) {
        // silent; other methods below will still try to persist
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
      // silent
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

        {/* Gallery Images */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Gallery Images</h2>
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

