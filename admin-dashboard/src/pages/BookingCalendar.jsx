import { useState, useEffect, useRef } from 'react';
import { getHouses, updateHouseDate, removeHouseDate, getListing } from '../services/api';

const BookingCalendar = () => {
  const [houses, setHouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [houseSearch, setHouseSearch] = useState('');
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [pendingRemove, setPendingRemove] = useState(null);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [pendingBlock, setPendingBlock] = useState(null);

  // Drag selection state
  const [isDragging, setIsDragging] = useState(false);
  const [startRow, setStartRow] = useState(null);
  const [startCell, setStartCell] = useState(null);
  const [selectedHouseId, setSelectedHouseId] = useState(null);
  const [selectedAction, setSelectedAction] = useState(null);
  const [selectedDates, setSelectedDates] = useState(new Set());
  const [selectedCells, setSelectedCells] = useState(new Set());
  const [dragStartPos, setDragStartPos] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const housesData = await getHouses({ per_page: 100 });
      setHouses(housesData);
      if (housesData.length === 0) {
        setError('No houses or listings found. Please create some listings first.');
      }
    } catch (err) {
      const errorMessage = err.message || 'Failed to load data. Please try again.';
      setError(errorMessage);
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getAdminBlockedDates = (house) => {
    const datesStr = house.admin_blocked_days || 
                    house.meta?.admin_blocked_days || 
                    house.meta?.listing_admin_blocked_days || 
                    '';
    if (!datesStr) return [];
    return datesStr.split(',').map((d) => d.trim()).filter(Boolean);
  };

  const getHostBlockedDates = (house) => {
    const datesStr = house.host_blocked_days || 
                    house.meta?.host_blocked_days || 
                    house.meta?.listing_host_blocked_days || 
                    '';
    if (!datesStr) return [];
    return datesStr.split(',').map((d) => d.trim()).filter(Boolean);
  };

  const getCategoryLabel = (house) => {
    const meta = house.meta || {};
    const sources = [
      house.listing_category,
      meta.listing_category,
      meta.listing_category_name,
      meta.listing_category_label,
    ];

    for (const source of sources) {
      if (!source) continue;
      if (typeof source === 'string') return source;
      if (Array.isArray(source) && source.length > 0) {
        const item = source[0];
        if (typeof item === 'string') return item;
        if (item && (item.name || item.label || item.title)) {
          return item.name || item.label || item.title;
        }
      }
      if (source && typeof source === 'object') {
        if (source.name || source.label || source.title) {
          return source.name || source.label || source.title;
        }
      }
    }
    return null;
  };

  const filteredHouses = houses.filter((house) => {
    if (houseSearch) {
      const searchTerm = houseSearch.toLowerCase();
      const title = (house.title?.rendered || house.title || '').toLowerCase();
      return title.includes(searchTerm);
    }
    return true;
  });

  // Generate month options (previous month + current + next 11)
  const getMonthOptions = () => {
    const options = [];
    const currentMonth = new Date(selectedMonth);
    
    // Previous month
    const prevMonth = new Date(currentMonth);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    options.push({
      value: `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`,
      label: prevMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    });

    // Current month and next 11 months
    for (let i = 0; i < 12; i++) {
      const month = new Date(currentMonth);
      month.setMonth(month.getMonth() + i);
      options.push({
        value: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`,
        label: month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      });
    }

    return options;
  };

  // Get days in selected month
  const getDaysInMonth = () => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  // Format date as YYYY-MM-DD
  const formatDate = (year, month, day) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  // Get date status for a cell
  // Logic: Dates in admin_blocked_days = Admin blocked (gray)
  // Dates in host_blocked_days = Host blocked (red)
  // Dates NOT in either = Available (green)
  const getDateStatus = (house, dateStr) => {
    const adminDates = getAdminBlockedDates(house);
    const hostDates = getHostBlockedDates(house);
    const isAdminBlocked = adminDates.includes(dateStr);
    const isHostBlocked = hostDates.includes(dateStr);
    
    // Priority: Host blocked takes precedence (red)
    if (isHostBlocked) {
      return 'host'; // Host blocked (red)
    }
    if (isAdminBlocked) {
      return 'admin'; // Admin blocked (gray)
    }
    return 'available'; // Open for booking (green) - not in either blocked list
  };

  // Handle month change
  const handleMonthChange = (e) => {
    const [year, month] = e.target.value.split('-').map(Number);
    setSelectedMonth(new Date(year, month - 1, 1));
  };

  // Handle mouse down on date cell
  const handleMouseDown = (e, houseId, dateStr, action) => {
    if (e.target.closest('td') && e.target.closest('td').cellIndex !== 0) {
      const cell = e.target.closest('td');
      e.preventDefault(); // Prevent text selection
      
      // Store initial position for drag threshold
      setDragStartPos({ x: e.clientX, y: e.clientY });
      setStartRow(cell.parentElement);
      setStartCell(cell);
      setSelectedHouseId(houseId);
      setSelectedAction(action);
      setSelectedDates(new Set([dateStr]));
      setSelectedCells(new Set([cell]));
      cell.classList.add('selected');
      
      // Don't set isDragging immediately - wait for mouse move
      // This prevents accidental drags from single clicks
    }
  };


  // Handle mouse over during drag - only works when actively dragging AND mouse is down
  const handleMouseOver = (e, houseId, dateStr, action) => {
    // Only process if we're actively dragging and mouse button is still down
    if (!isDragging || !dragStartPos) return;
    
    // Check if mouse button is still pressed
    if (e.buttons === 0) {
      // Mouse button released, stop dragging
      setIsDragging(false);
      return;
    }
    
    const cell = e.target.closest('td');
    if (cell && cell.cellIndex !== 0 && startRow && cell.parentElement === startRow) {
      const span = cell.querySelector('span');
      if (span && span.getAttribute('data-action') === selectedAction) {
        if (!selectedCells.has(cell)) {
          setSelectedCells((prev) => new Set([...prev, cell]));
          setSelectedDates((prev) => new Set([...prev, dateStr]));
          cell.classList.add('selected');
        }
      }
    }
  };


  // Use refs to store latest values for event handlers
  const dragStateRef = useRef({ isDragging, selectedDates, selectedHouseId, selectedAction, selectedCells, startRow, startCell });
  
  useEffect(() => {
    dragStateRef.current = { isDragging, selectedDates, selectedHouseId, selectedAction, selectedCells, startRow, startCell };
  }, [isDragging, selectedDates, selectedHouseId, selectedAction, selectedCells, startRow, startCell]);

  // Add global mouse move and mouse up listeners
  useEffect(() => {
    if (!dragStartPos) return;
    
    let isMouseDown = true;
    
    const handleGlobalMouseMove = (e) => {
      if (!isMouseDown) return; // Stop processing if mouse is up
      
      const state = dragStateRef.current;
      if (dragStartPos && state.startRow && !state.isDragging) {
        const deltaX = Math.abs(e.clientX - dragStartPos.x);
        const deltaY = Math.abs(e.clientY - dragStartPos.y);
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (distance > 5) {
          setIsDragging(true);
        }
      }
    };
    
    const handleGlobalMouseUp = async (e) => {
      // Immediately stop all drag processing
      isMouseDown = false;
      
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      
      const state = dragStateRef.current;
      
      // Check if we were dragging before stopping
      const wasDragging = state.isDragging;
      setIsDragging(false);
      
      if (wasDragging && state.selectedDates.size > 0 && state.selectedHouseId && state.selectedAction) {
        const datesArray = Array.from(state.selectedDates);
        
        if (state.startRow) {
          state.startRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        
        if (state.selectedAction === 'add') {
          // Add dates to available_dates = BLOCK them (make unavailable)
          // Need to ask: Admin or Host?
          setPendingBlock({
            houseId: state.selectedHouseId,
            dates: datesArray,
          });
          setShowBlockConfirm(true);
        } else {
          // Remove dates from blocked days = UNBLOCK them (make available)
          // No need to ask, just unblock from both admin and host
          try {
            await removeHouseDate(state.selectedHouseId, datesArray, false);
            setError('');
            setHouses(prevHouses => {
              return prevHouses.map(house => {
                if (house.id === state.selectedHouseId) {
                  const adminDatesStr = house.admin_blocked_days || house.meta?.admin_blocked_days || '';
                  const adminDates = adminDatesStr ? adminDatesStr.split(',').map(d => d.trim()).filter(Boolean) : [];
                  const updatedAdminDates = adminDates.filter(date => !datesArray.includes(date));
                  
                  const hostDatesStr = house.host_blocked_days || house.meta?.host_blocked_days || '';
                  const hostDates = hostDatesStr ? hostDatesStr.split(',').map(d => d.trim()).filter(Boolean) : [];
                  const updatedHostDates = hostDates.filter(date => !datesArray.includes(date));
                  
                  return {
                    ...house,
                    admin_blocked_days: updatedAdminDates.join(','),
                    host_blocked_days: updatedHostDates.join(','),
                    meta: {
                      ...house.meta,
                      admin_blocked_days: updatedAdminDates.join(','),
                      host_blocked_days: updatedHostDates.join(','),
                    },
                  };
                }
                return house;
              });
            });
          } catch (err) {
            console.error('Error unblocking dates:', err);
            setError(`Failed to unblock dates: ${err.message || 'Please try again.'}`);
            await loadData();
          }
        }
      } else if (dragStartPos && state.startCell && !state.isDragging) {
        const cell = state.startCell;
        const span = cell.querySelector('span');
        if (span) {
          const houseId = parseInt(span.getAttribute('data-id'));
          const dateStr = span.getAttribute('data-date');
          const action = span.getAttribute('data-action');
          
          if (action === 'add') {
            // Add date to available_dates = BLOCK it (make unavailable)
            // Need to ask: Admin or Host?
            setPendingBlock({
              houseId: houseId,
              dates: [dateStr],
            });
            setShowBlockConfirm(true);
          } else {
            // Remove date from blocked days = UNBLOCK it (make available)
            // No need to ask, just unblock from both admin and host
            try {
              await removeHouseDate(houseId, [dateStr], false);
              setError('');
              setHouses(prevHouses => {
                return prevHouses.map(house => {
                  if (house.id === houseId) {
                    const adminDatesStr = house.admin_blocked_days || house.meta?.admin_blocked_days || '';
                    const adminDates = adminDatesStr ? adminDatesStr.split(',').map(d => d.trim()).filter(Boolean) : [];
                    const updatedAdminDates = adminDates.filter(date => date !== dateStr);
                    
                    const hostDatesStr = house.host_blocked_days || house.meta?.host_blocked_days || '';
                    const hostDates = hostDatesStr ? hostDatesStr.split(',').map(d => d.trim()).filter(Boolean) : [];
                    const updatedHostDates = hostDates.filter(date => date !== dateStr);
                    
                    return {
                      ...house,
                      admin_blocked_days: updatedAdminDates.join(','),
                      host_blocked_days: updatedHostDates.join(','),
                      meta: {
                        ...house.meta,
                        admin_blocked_days: updatedAdminDates.join(','),
                        host_blocked_days: updatedHostDates.join(','),
                      },
                    };
                  }
                  return house;
                });
              });
            } catch (err) {
              console.error('Error unblocking date:', err);
              setError(`Failed to unblock date: ${err.message || 'Please try again.'}`);
            }
          }
        }
      }

      setIsDragging(false);
      setStartRow(null);
      setStartCell(null);
      setDragStartPos(null);
      setSelectedHouseId(null);
      setSelectedAction(null);
      setSelectedDates(new Set());
      state.selectedCells.forEach((cell) => cell.classList.remove('selected'));
      setSelectedCells(new Set());
    };
    
    document.addEventListener('mousemove', handleGlobalMouseMove, true);
    document.addEventListener('mouseup', handleGlobalMouseUp, true);
    
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove, true);
      document.removeEventListener('mouseup', handleGlobalMouseUp, true);
    };
  }, [dragStartPos]);

  // Handle block confirmation (when making dates unavailable)
  const handleBlockConfirm = async (isOwner) => {
    if (pendingBlock) {
      try {
        await updateHouseDate(pendingBlock.houseId, pendingBlock.dates, isOwner);
        setError('');
        
        // Reload the specific listing to get the actual saved data
        try {
          const updatedListing = await getListing(pendingBlock.houseId);
          
          // Map the listing to house structure
          const adminDates = updatedListing.admin_blocked_days || 
                            updatedListing.meta?.admin_blocked_days || 
                            updatedListing.meta?.listing_admin_blocked_days || 
                            '';
          const hostDates = updatedListing.host_blocked_days || 
                           updatedListing.meta?.host_blocked_days || 
                           updatedListing.meta?.listing_host_blocked_days || 
                           '';
          
          const updatedHouse = {
            id: updatedListing.id,
            title: updatedListing.title,
            admin_blocked_days: adminDates,
            host_blocked_days: hostDates,
            meta: {
              admin_blocked_days: adminDates,
              host_blocked_days: hostDates,
              house_size: updatedListing.meta?.house_size || updatedListing.meta?.listing_size || '',
            },
          };
          
          // Update local state with the verified data
          setHouses(prevHouses => {
            return prevHouses.map(house => {
              if (house.id === pendingBlock.houseId) {
                return updatedHouse;
              }
              return house;
            });
          });
        } catch (reloadError) {
          console.warn('Could not reload listing, using local update:', reloadError);
          // Fallback to local state update if reload fails
          setHouses(prevHouses => {
            return prevHouses.map(house => {
              if (house.id === pendingBlock.houseId) {
                const fieldName = isOwner ? 'host_blocked_days' : 'admin_blocked_days';
                const currentDatesStr = house[fieldName] || house.meta?.[fieldName] || '';
                const currentDates = currentDatesStr ? currentDatesStr.split(',').map(d => d.trim()).filter(Boolean) : [];
                const datesToAdd = pendingBlock.dates.filter(date => !currentDates.includes(date));
                const updatedDates = [...currentDates, ...datesToAdd];
                const updatedHouse = {
                  ...house,
                  [fieldName]: updatedDates.join(','),
                  meta: {
                    ...house.meta,
                    [fieldName]: updatedDates.join(','),
                  },
                };
                return updatedHouse;
              }
              return house;
            });
          });
        }
      } catch (err) {
        console.error('Error blocking dates:', err);
        setError(`Failed to block dates: ${err.message || 'Please try again.'}`);
        await loadData();
      }
    }
    setShowBlockConfirm(false);
    setPendingBlock(null);
  };

  const daysInMonth = getDaysInMonth();
  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();
  const monthName = selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-hidden">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Booking Calendar</h1>
        <p className="mt-2 text-gray-600">Manage house availability and bookings</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Calendar Header */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex flex-wrap items-center gap-4">
          <div>
              <label htmlFor="month-select" className="block text-sm font-medium text-gray-700 mb-1">
                Select Month:
            </label>
            <select
                id="month-select"
                value={`${year}-${String(month + 1).padStart(2, '0')}`}
                onChange={handleMonthChange}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              >
                {getMonthOptions().map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
            </select>
          </div>

          <div>
              <label htmlFor="house-search" className="block text-sm font-medium text-gray-700 mb-1">
                Search House:
            </label>
            <input
                id="house-search"
              type="text"
                value={houseSearch}
                onChange={(e) => setHouseSearch(e.target.value)}
                placeholder="Enter house name..."
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
            />
        </div>
      </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-lime-50 px-3 py-1.5 text-xs font-medium text-lime-700 ring-1 ring-inset ring-lime-200">
              <span className="h-2 w-2 rounded-full bg-lime-500" />
              Available (Open for booking)
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-200">
              <span className="h-2 w-2 rounded-full bg-gray-500" />
              Admin Blocked
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              Host Blocked
            </span>
                </div>
              </div>

        <h3 className="text-xl font-semibold text-gray-900">{monthName}</h3>
              </div>

      {/* Calendar Table */}
      <style>{`
        .date-cell.selected {
          background-color: #d3f2c7 !important;
        }
        .date-cell.selected .date-indicator {
          background-color: #14532d !important;
          color: #fff !important;
        }
      `}</style>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden">
        <div className="max-h-[calc(100vh-340px)] overflow-auto bg-gray-50/60">
          <table className="min-w-full text-sm text-gray-700">
            <thead className="sticky top-0 z-20 shadow-sm">
              <tr className="bg-gray-100/90 text-[11px] uppercase tracking-wide text-gray-500">
                <th className="sticky left-0 z-30 bg-gray-100/90 px-5 py-4 text-left font-semibold text-gray-700 border-r border-gray-200 min-w-[220px]">
                  House Name
                </th>
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1;
                  const date = new Date(year, month, day);
                  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                  return (
                    <th
                      key={day}
                      className="px-3 py-3 text-center font-semibold border-l border-gray-200 min-w-[56px]"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[13px] text-gray-900">{day}</span>
                        <span className="text-[11px] text-gray-500 font-medium">{dayName}</span>
                    </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
            {filteredHouses.map((house) => {
                const adminDates = getAdminBlockedDates(house);
                const hostDates = getHostBlockedDates(house);
              const categoryLabel = getCategoryLabel(house);
              const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
              const adminCount = adminDates.filter((date) => date.startsWith(monthPrefix)).length;
              const hostCount = hostDates.filter((date) => date.startsWith(monthPrefix)).length;
              const totalBlockedSet = new Set([
                ...adminDates.filter((date) => date.startsWith(monthPrefix)),
                ...hostDates.filter((date) => date.startsWith(monthPrefix)),
              ]);
              const blockedDays = totalBlockedSet.size;
              const availableDays = Math.max(daysInMonth - blockedDays, 0);

                      return (
                  <tr key={house.id} className="bg-white hover:bg-gray-50/80">
                    <td className="sticky left-0 z-10 bg-white/95 backdrop-blur px-5 py-4 border-r border-gray-100">
                      <div className="flex flex-col gap-2">
                        <a
                          href={`https://touresm.cloud/house-form/?edit_house_id=${house.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-semibold text-gray-900 hover:text-primary-600 transition-colors"
                        >
                          {house.title?.rendered || house.title || 'Unnamed House'}
                        </a>
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          {categoryLabel && (
                            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">
                              {categoryLabel}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 rounded-full bg-lime-50 px-2 py-0.5 font-medium text-lime-700 ring-1 ring-inset ring-lime-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-lime-500" />
                            <span className="text-[10px] font-semibold" title="Available days this month">
                              {availableDays}
                            </span>
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            <span className="text-[10px] font-semibold" title="Blocked days this month">
                              {blockedDays}
                            </span>
                          </span>
                </div>
                        {(house.meta?.house_size || house.meta?.listing_size) && (
                          <div className="inline-flex items-center gap-2 text-xs text-gray-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                            Size {house.meta?.house_size || house.meta?.listing_size}
                </div>
                        )}
              </div>
                    </td>
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const day = i + 1;
                      const dateStr = formatDate(year, month, day);
                      const status = getDateStatus(house, dateStr);
                      const isBlocked = adminDates.includes(dateStr) || hostDates.includes(dateStr);
                      const action = isBlocked ? 'remove' : 'add';

                      const cellBase =
                        'date-cell relative px-2 py-4 text-center border-l border-gray-100 cursor-pointer transition-all duration-150';
                      const indicatorBase =
                        'date-indicator inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold ring-1 ring-inset transition-all duration-150';

                      const statusStyles = {
                        available: 'bg-lime-50 text-lime-700 ring-lime-200',
                        admin: 'bg-gray-200 text-gray-700 ring-gray-300',
                        host: 'bg-rose-500/90 text-white ring-rose-400 shadow-sm shadow-rose-200/60',
                      };

                      return (
                        <td
                          key={day}
                          className={`${cellBase} ${
                            status === 'available'
                              ? 'bg-white hover:bg-lime-50/60'
                              : status === 'host'
                                ? 'bg-rose-50/70 hover:bg-rose-100/80'
                                : 'bg-gray-50/80 hover:bg-gray-100/80'
                          }`}
                          onMouseDown={(e) => handleMouseDown(e, house.id, dateStr, action)}
                          onMouseOver={(e) => handleMouseOver(e, house.id, dateStr, action)}
                        >
                          <span
                            className={`${indicatorBase} ${
                              statusStyles[status] || statusStyles.available
                            }`}
                            data-id={house.id}
                            data-date={dateStr}
                            data-action={action}
                          >
                            {status === 'available' ? '✓' : '×'}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
          );
        })}
            </tbody>
          </table>
        </div>
      </div>

      {filteredHouses.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center mt-6">
          <p className="text-gray-600">No houses found matching the search.</p>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {showBlockConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowBlockConfirm(false)} />
          <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Admin or Host?</h3>
              <button
                type="button"
                onClick={() => setShowBlockConfirm(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                aria-label="Close modal"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-700 mb-2">Who is blocking these dates?</p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li><strong>Admin:</strong> Blocks dates as unavailable (Admin-blocked)</li>
                <li><strong>Host:</strong> Blocks dates as unavailable (Host-blocked)</li>
              </ul>
            </div>
            <div className="p-4 border-t border-gray-100 flex flex-wrap gap-3 justify-end">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowBlockConfirm(false);
                }}
                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleBlockConfirm(false); // Admin = false
                }}
                className="px-4 py-2 rounded-lg bg-[#dde5b6] text-[#386641] hover:bg-[#c9d19a] transition-colors"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleBlockConfirm(true); // Host = true
                }}
                className="px-4 py-2 rounded-lg bg-[#c1121f] text-white hover:bg-[#a00f1a] transition-colors"
              >
                Host
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingCalendar;
