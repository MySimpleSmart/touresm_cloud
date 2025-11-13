import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getListing, getAmenities, getCategories, getLocations, getSizes } from '../services/api';
import ImageGallery from './ImageGallery';

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

  useEffect(() => {
    loadListing();
  }, [id]);

  const loadListing = async () => {
    setLoading(true);
    try {
      // Fetch listing first - this is critical
      const listingData = await getListing(id);
      if (!listingData) {
        setLoading(false);
        return;
      } else {
        setAmenities([]);
      }
      setListing(listingData);
      
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
              // Also include the parent itself if it's selected
              grouped[parentName] = [amenity, ...children];
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

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h1 className="text-4xl font-bold text-gray-900 mb-2">
                  {listing.listing_name || 'Unnamed Listing'}
                </h1>
                {(() => {
                  const locationDisplays = getAllLocationDisplays(listing.listing_location, locations);
                  return locationDisplays.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2 text-lg">
                      <svg
                        className="w-5 h-5 text-gray-600"
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
                  // Show familiar location even if no regular locations
                  const locationDisplays = getAllLocationDisplays(listing.listing_region || listing.listing_location, locations);
                  if (locationDisplays.length === 0 && listing.listing_familiar_location) {
                    return (
                      <div className="flex flex-wrap items-center gap-2 text-lg">
                        <svg
                          className="w-5 h-5 text-gray-600"
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
                        <span className="text-gray-600">{listing.listing_familiar_location}</span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
              <div className="text-right">
                {listing.listing_price ? (
                  <p className="text-3xl font-bold text-primary-600">
                    {formatPrice(listing.listing_price)}
                  </p>
                ) : (
                  <p className="text-gray-500 text-lg">Price on request</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {listing.listing_category && getTaxonomyValue(listing.listing_category, 'categories') && (
                <span className="inline-block bg-primary-100 text-primary-800 px-4 py-2 rounded-full text-sm font-medium">
                  {getTaxonomyValue(listing.listing_category, 'categories')}
                </span>
              )}
              {listing.listing_social_url && (
                <a
                  href={listing.listing_social_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-full text-sm font-medium transition-colors"
                >
                  <svg
                    className="w-4 h-4 mr-2"
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
                  className="inline-flex items-center bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-full text-sm font-medium transition-colors"
                >
                  <svg
                    className="w-4 h-4 mr-2"
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {listing.room_number && (
                <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                  <div className="bg-primary-100 p-3 rounded-lg mr-4">
                    <svg
                      className="w-6 h-6 text-primary-600"
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
                <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                  <div className="bg-primary-100 p-3 rounded-lg mr-4">
                    <svg
                      className="w-6 h-6 text-primary-600"
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
                <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                  <div className="bg-primary-100 p-3 rounded-lg mr-4">
                    <svg
                      className="w-6 h-6 text-primary-600"
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
                <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                  <div className="bg-primary-100 p-3 rounded-lg mr-4">
                    <svg
                      className="w-6 h-6 text-primary-600"
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

          {/* Description */}
          {listing.listing_description && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Description</h2>
              <div
                className="text-gray-700 leading-relaxed prose max-w-none"
                dangerouslySetInnerHTML={{ __html: listing.listing_description }}
              />
            </div>
          )}

          {/* Features */}
          {listing.listing_features && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Features</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.isArray(listing.listing_features) ? (
                  listing.listing_features.map((feature, index) => (
                    <div
                      key={index}
                      className="flex items-center p-3 bg-gray-50 rounded-lg"
                    >
                      <svg
                        className="w-5 h-5 text-primary-600 mr-2"
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
                  <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                    <svg
                      className="w-5 h-5 text-primary-600 mr-2"
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
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Amenities</h2>
              <div className="space-y-6">
                {Object.entries(groupedAmenities).map(([parentName, children]) => (
                  <div key={parentName} className="border-b border-gray-200 pb-6 last:border-b-0 last:pb-0">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">{parentName}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {children.map((amenity) => (
                        <div
                          key={amenity.id || amenity.term_id}
                          className="flex items-center p-3 bg-gray-50 rounded-lg"
                        >
                          <svg
                            className="w-4 h-4 text-primary-600 mr-2 flex-shrink-0"
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
                          <span className="text-gray-700 text-sm">{amenity.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default ListingDetail;

