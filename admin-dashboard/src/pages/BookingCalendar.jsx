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
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#dde5b6] border border-[#386641]"></div>
              <span className="text-sm text-gray-700">Available (Open for booking)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-gray-300 border border-gray-400"></div>
              <span className="text-sm text-gray-700">Admin Blocked</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#c1121f] border border-[#c1121f]"></div>
              <span className="text-sm text-gray-700">Host Blocked</span>
            </div>
          </div>
        </div>

        <h3 className="text-xl font-semibold text-gray-900">{monthName}</h3>
      </div>

      {/* Calendar Table */}
      <style>{`
        .date-cell.selected {
          background-color: #a7c957 !important;
        }
        .date-cell.selected .date-indicator {
          background-color: #fff !important;
          color: #386641 !important;
        }
        .date-cell:hover {
          background-color: #f8f9fa;
        }
        .calendar-table {
          user-select: none;
        }
        .calendar-scroll-container {
          max-height: calc(100vh - 300px);
          overflow-y: auto;
          overflow-x: auto;
          position: relative;
          width: 100%;
        }
        .calendar-scroll-container table {
          min-width: max-content;
          width: 100%;
        }
        .calendar-wrapper {
          width: 100%;
          overflow: hidden;
        }
      `}</style>
      <div className="bg-white rounded-lg shadow calendar-wrapper">
        <div className="calendar-scroll-container">
          <table className="border-collapse calendar-table" style={{ minWidth: 'max-content' }}>
          <thead>
            <tr className="bg-gray-50">
              <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-sm font-semibold text-gray-900 border-b border-r min-w-[200px]">
                House Name
              </th>
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const date = new Date(year, month, day);
                const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
          return (
                  <th
                    key={day}
                    className="px-2 py-3 text-center text-xs font-medium text-gray-600 border-b border-r min-w-[50px]"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold">{day}</span>
                      <span className="text-gray-500">{dayName}</span>
                </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredHouses.map((house) => {
              const adminDates = getAdminBlockedDates(house);
              const hostDates = getHostBlockedDates(house);

                  return (
                <tr key={house.id} className="hover:bg-gray-50">
                  <td className="sticky left-0 z-10 bg-white px-4 py-3 border-b border-r">
                    <div className="flex flex-col">
                      <a
                        href={`https://touresm.cloud/house-form/?edit_house_id=${house.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-primary-600 hover:text-primary-800"
                      >
                        {house.title?.rendered || house.title || 'Unnamed House'}
                      </a>
                      {(house.meta?.house_size || house.meta?.listing_size) && (
                        <span className="text-xs text-gray-500 mt-1">
                          {house.meta?.house_size || house.meta?.listing_size}
                        </span>
                      )}
                    </div>
                  </td>
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1;
                    const dateStr = formatDate(year, month, day);
                    const status = getDateStatus(house, dateStr);
                    // If date is blocked (in admin_blocked_days or host_blocked_days), action is 'remove' (to unblock)
                    // If date is available (not in either), action is 'add' (to block)
                    const isBlocked = adminDates.includes(dateStr) || hostDates.includes(dateStr);
                    const action = isBlocked ? 'remove' : 'add';

                    let cellClass = 'date-cell px-2 py-3 text-center border-b border-r cursor-pointer transition-colors';
                    let indicatorClass = 'date-indicator inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium transition-colors';
                    let indicatorText = '×';

                    if (status === 'available') {
                      // Available = open for booking (green)
                      cellClass += ' available';
                      indicatorClass += ' bg-[#dde5b6] text-[#386641]';
                      indicatorText = '✓';
                    } else if (status === 'host') {
                      // Host blocked (red with ×)
                      cellClass += ' host';
                      indicatorClass += ' bg-[#c1121f] text-white';
                      indicatorText = '×';
                    } else if (status === 'admin') {
                      // Admin blocked (gray with ×)
                      cellClass += ' admin';
                      indicatorClass += ' bg-gray-300 text-gray-700';
                      indicatorText = '×';
                    }

                      return (
                      <td
                        key={day}
                        className={cellClass}
                        onMouseDown={(e) => handleMouseDown(e, house.id, dateStr, action)}
                        onMouseOver={(e) => handleMouseOver(e, house.id, dateStr, action)}
                      >
                        <span
                          className={indicatorClass}
                          data-id={house.id}
                          data-date={dateStr}
                          data-action={action}
                        >
                          {indicatorText}
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
          <div className="relative w-full max-w-md mx-4 bg-white rounded-lg shadow-xl">
            <div className="p-5 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Admin or Host?</h3>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-700 mb-2">Who is blocking these dates?</p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li><strong>Admin:</strong> Blocks dates as unavailable (Admin-blocked)</li>
                <li><strong>Host:</strong> Blocks dates as unavailable (Host-blocked)</li>
              </ul>
            </div>
            <div className="p-4 border-t flex gap-3 justify-end">
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
