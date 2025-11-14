import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

const LocationDropdown = ({ locations = [], value, onChange, placeholder = "All Locations", className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredParentId, setHoveredParentId] = useState(null);
  const [submenuPosition, setSubmenuPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef(null);
  const submenuRef = useRef(null);
  const searchInputRef = useRef(null);
  const parentButtonRefs = useRef({});
  
  // Determine padding based on className
  const paddingClass = className.includes('py-2') ? 'py-2' : 'py-3';

  // Filter locations based on search query
  const filterLocations = (locList, query) => {
    if (!query.trim()) return locList;
    const lowerQuery = query.toLowerCase();
    return locList.filter(loc => {
      const name = (loc.name || loc.slug || '').toLowerCase();
      return name.includes(lowerQuery);
    });
  };

  // Organize locations: parents with their children
  const organizedLocations = (() => {
    if (!locations || locations.length === 0) return { parents: [], childrenMap: {} };
    
    const parents = [];
    const childrenMap = {};
    
    locations.forEach((loc) => {
      const parentId = loc.parent || loc.parent_id || loc.parent_term_id || 0;
      const locId = loc.id || loc.term_id;
      
      // Normalize IDs to strings for consistent matching
      const normalizedParentId = parentId ? String(parentId) : '0';
      
      if (normalizedParentId !== '0' && normalizedParentId !== '') {
        // It's a child - store with both string and number keys for matching
        if (!childrenMap[normalizedParentId]) {
          childrenMap[normalizedParentId] = [];
        }
        childrenMap[normalizedParentId].push(loc);
        // Also store with numeric key if parentId is a number
        if (!isNaN(parseInt(normalizedParentId))) {
          const numKey = parseInt(normalizedParentId);
          if (!childrenMap[numKey]) {
            childrenMap[numKey] = [];
          }
          if (!childrenMap[numKey].includes(loc)) {
            childrenMap[numKey].push(loc);
          }
        }
      } else {
        // It's a parent
        parents.push(loc);
      }
    });
    
    // Apply search filter
    if (!searchQuery.trim()) {
      // No search query - return all locations
      return { parents, childrenMap, matchingChildren: [] };
    }
    
    const lowerQuery = searchQuery.toLowerCase();
    const filteredParents = filterLocations(parents, searchQuery);
    const filteredChildrenMap = {};
    const matchedParentIds = new Set();
    const matchingChildren = []; // Children that match search (to show directly with parent text)
    
    // Track which parents matched the search
    filteredParents.forEach(parent => {
      const parentId = parent.id || parent.term_id;
      matchedParentIds.add(String(parentId));
      matchedParentIds.add(parentId);
    });
    
    // For each parent, if it matched the search, show all its children in submenu
    // If parent didn't match but has matching children, add children to direct list with parent info
    Object.keys(childrenMap).forEach(key => {
      const parentMatched = matchedParentIds.has(key) || matchedParentIds.has(String(key));
      
      if (parentMatched) {
        // Parent matched - show all children in submenu
        filteredChildrenMap[key] = childrenMap[key];
      } else {
        // Parent didn't match - check if children match
        const children = childrenMap[key];
        const matching = filterLocations(children, searchQuery);
        
        if (matching.length > 0) {
          // Find the parent location object
          const parentLoc = parents.find(p => {
            const pId = p.id || p.term_id;
            return String(pId) === key || pId == key;
          });
          
          // Add matching children to direct list with parent info
          matching.forEach(child => {
            matchingChildren.push({
              ...child,
              parentInfo: parentLoc
            });
          });
        }
      }
    });
    
    return { parents: filteredParents, childrenMap: filteredChildrenMap, matchingChildren };
  })();

  const selectedLocation = locations.find(loc => (loc.id || loc.term_id) == value);
  
  // Find parent location if selected location is a child
  const selectedParentLocation = selectedLocation ? (() => {
    const parentId = selectedLocation.parent || selectedLocation.parent_id || selectedLocation.parent_term_id || 0;
    if (parentId && parentId !== 0 && parentId !== '0') {
      return locations.find(loc => {
        const locId = loc.id || loc.term_id;
        return locId == parentId || locId === parentId || String(locId) === String(parentId);
      });
    }
    return null;
  })() : null;

  const handleSelect = (locationId) => {
    onChange(locationId);
    setIsOpen(false);
    setHoveredParentId(null);
    setSearchQuery(''); // Clear search when selecting
  };

  const handleOpen = () => {
    setIsOpen(true);
    // Focus search input when dropdown opens
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        searchInputRef.current.select();
      }
    }, 100);
  };

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setHoveredParentId(null);
    setSearchQuery('');
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        if (submenuRef.current && !submenuRef.current.contains(event.target)) {
          handleClose();
        }
      }
    };

    const updateSubmenuPosition = () => {
      if (hoveredParentId) {
        const parentButton = parentButtonRefs.current[hoveredParentId];
        if (parentButton) {
          const rect = parentButton.getBoundingClientRect();
          setSubmenuPosition({
            top: rect.top,
            left: rect.right + 4,
          });
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', updateSubmenuPosition, true);
      window.addEventListener('resize', updateSubmenuPosition);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', updateSubmenuPosition, true);
      window.removeEventListener('resize', updateSubmenuPosition);
    };
  }, [isOpen, hoveredParentId, handleClose]);

  const handleInputChange = (e) => {
    const inputValue = e.target.value;
    setSearchQuery(inputValue);
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  const handleInputFocus = () => {
    if (!isOpen) {
      setIsOpen(true);
    }
    // Clear selection and search when focusing to allow new search
    if (value) {
      onChange('');
    }
    setSearchQuery('');
  };

  const handleClearSearch = (e) => {
    e.stopPropagation();
    setSearchQuery('');
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleParentHover = (parentId, event) => {
    setHoveredParentId(parentId);
    
    // Calculate submenu position based on the parent button's position
    const parentButton = parentButtonRefs.current[parentId];
    if (parentButton) {
      const rect = parentButton.getBoundingClientRect();
      setSubmenuPosition({
        top: rect.top,
        left: rect.right + 4, // 4px gap (ml-1)
      });
    }
  };

  const handleParentLeave = (parentId) => {
    // Small delay to allow moving to submenu
    const timeoutId = setTimeout(() => {
      setHoveredParentId((current) => {
        // Only clear if it's still this parent (user didn't move to submenu)
        if (current === parentId || current === String(parentId)) {
          return null;
        }
        return current;
      });
    }, 200);
    
    // Store timeout to clear if needed
    return () => clearTimeout(timeoutId);
  };

  const handleSubmenuEnter = (parentId) => {
    setHoveredParentId(parentId);
  };

  const handleSubmenuLeave = () => {
    setHoveredParentId(null);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Input field that acts as both display and search */}
      <div className="relative">
        {!isOpen && selectedLocation && selectedParentLocation ? (
          // Show child with parent as small text when closed - same height as input
          <div
            onClick={handleInputFocus}
            className={`w-full px-4 ${paddingClass} pr-10 border border-gray-300 rounded-lg bg-white hover:border-gray-400 transition-colors cursor-text flex items-center ${className}`}
          >
            <span className="text-gray-900">{selectedLocation.name}</span>
            <span className="text-xs text-gray-500 ml-2">({selectedParentLocation.name})</span>
          </div>
        ) : (
          <input
            ref={searchInputRef}
            type="text"
            value={isOpen ? searchQuery : (selectedLocation ? selectedLocation.name : '')}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={(e) => {
              // Don't close if clicking on dropdown items
              setTimeout(() => {
                if (!dropdownRef.current?.contains(document.activeElement) && 
                    !submenuRef.current?.contains(document.activeElement)) {
                  handleClose();
                }
              }, 200);
            }}
            placeholder={isOpen ? "Search locations..." : placeholder}
            className={`w-full px-4 ${paddingClass} ${isOpen && searchQuery ? 'pr-20' : 'pr-10'} border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white hover:border-gray-400 transition-colors ${className}`}
          />
        )}
        {/* Clear search icon - only show when open and has search query */}
        {isOpen && searchQuery && (
          <button
            type="button"
            onClick={handleClearSearch}
            className="absolute right-8 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Clear search"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
        <svg
          className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {/* All Locations option - only show if search is empty */}
          {!searchQuery.trim() && (
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                !value ? 'bg-primary-50 text-primary-600 font-medium' : 'text-gray-900'
              }`}
            >
              {placeholder}
            </button>
          )}

          {/* Parent locations */}
          {organizedLocations.parents.map((parent) => {
            const parentId = parent.id || parent.term_id;
            // Check for children using both string and number keys
            const hasChildren = organizedLocations.childrenMap[String(parentId)]?.length > 0 || 
                               organizedLocations.childrenMap[parentId]?.length > 0 ||
                               (typeof parentId === 'number' && organizedLocations.childrenMap[String(parentId)]?.length > 0);
            const isHovered = hoveredParentId === parentId || hoveredParentId === String(parentId);
            const isSelected = value == parentId;

            return (
              <div
                key={parentId}
                className="relative group"
                onMouseLeave={hasChildren ? () => handleParentLeave(parentId) : undefined}
              >
                <button
                  ref={(el) => {
                    if (el) parentButtonRefs.current[parentId] = el;
                  }}
                  type="button"
                  onClick={() => handleSelect(parentId)}
                  onMouseEnter={(e) => hasChildren && handleParentHover(parentId, e)}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center justify-between ${
                    isSelected ? 'bg-primary-50 text-primary-600 font-medium' : 'text-gray-900'
                  }`}
                >
                  <span>{parent.name}</span>
                  {hasChildren && (
                    <svg
                      className="w-4 h-4 text-gray-400"
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
                  )}
                </button>

                {/* Sub-dropdown for children - rendered outside scrollable container using portal */}
                {hasChildren && isHovered && typeof document !== 'undefined' && createPortal(
                  <div
                    ref={submenuRef}
                    className="fixed w-64 bg-white border border-gray-200 rounded-lg shadow-xl z-[60] max-h-96 overflow-y-auto"
                    onMouseEnter={() => handleSubmenuEnter(parentId)}
                    onMouseLeave={handleSubmenuLeave}
                    style={{
                      minWidth: '16rem',
                      top: `${submenuPosition.top}px`,
                      left: `${submenuPosition.left}px`,
                    }}
                  >
                    {(organizedLocations.childrenMap[String(parentId)] || organizedLocations.childrenMap[parentId] || []).map((child) => {
                      const childId = child.id || child.term_id;
                      const isChildSelected = value == childId;

                      return (
                        <button
                          key={childId}
                          type="button"
                          onClick={() => handleSelect(childId)}
                          className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                            isChildSelected ? 'bg-primary-50 text-primary-600 font-medium' : 'text-gray-900'
                          }`}
                        >
                          {child.name}
                        </button>
                      );
                    })}
                  </div>,
                  document.body
                )}
              </div>
            );
          })}

          {/* Matching children (when child matches search but parent doesn't) */}
          {organizedLocations.matchingChildren.map((child) => {
            const childId = child.id || child.term_id;
            const isSelected = value == childId;
            const parentName = child.parentInfo?.name || '';

            return (
              <button
                key={childId}
                type="button"
                onClick={() => handleSelect(childId)}
                className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                  isSelected ? 'bg-primary-50 text-primary-600 font-medium' : 'text-gray-900'
                }`}
              >
                <div className="flex flex-col">
                  <span>{child.name}</span>
                  {parentName && (
                    <span className="text-xs text-gray-500 mt-0.5">{parentName}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LocationDropdown;

