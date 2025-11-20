import { useEffect, useMemo, useState } from 'react';
import CustomDatePicker from './DatePicker';
import LocationDropdown from './LocationDropdown';

const QuickSearch = ({ locations = [], onSearch }) => {
  const [checkInDate, setCheckInDate] = useState(null);
  const [checkOutDate, setCheckOutDate] = useState(null);
  const [guestsInput, setGuestsInput] = useState('1');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [searchData, setSearchData] = useState({
    location: '',
    checkIn: '',
    checkOut: '',
    guests: 1,
  });

  useEffect(() => {
    const updateIsMobile = () => {
      setIsMobile(window.matchMedia('(max-width: 768px)').matches);
    };
    updateIsMobile();
    window.addEventListener('resize', updateIsMobile);
    return () => window.removeEventListener('resize', updateIsMobile);
  }, []);

  const formatSummaryDate = (date, fallback = 'Add dates') => {
    if (!date) return fallback;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const locationLabel = useMemo(() => {
    const fallback = 'Anywhere';
    const rawValue = searchData.location;
    if (!rawValue) return fallback;

    if (typeof rawValue === 'object') {
      return rawValue.name || rawValue.label || rawValue.slug || fallback;
    }

    const matched = locations.find((loc) => {
      const locId = loc.id || loc.term_id;
      if (locId == null) return false;
      return String(locId) === String(rawValue);
    });
    return matched?.name || matched?.slug || fallback;
  }, [searchData.location, locations]);

  const checkInLabel = formatSummaryDate(checkInDate);
  const checkOutLabel = formatSummaryDate(checkOutDate);
  const guestsLabel = `${searchData.guests || 1} guest${(searchData.guests || 1) > 1 ? 's' : ''}`;

  const handleDateChange = (field, date) => {
    if (field === 'checkIn') {
      setCheckInDate(date);
      setSearchData({ 
        ...searchData, 
        checkIn: date ? date.toISOString().split('T')[0] : '',
        checkOut: checkOutDate && date && checkOutDate < date ? '' : searchData.checkOut
      });
      // Reset check-out if it's before new check-in
      if (checkOutDate && date && checkOutDate < date) {
        setCheckOutDate(null);
      }
    } else {
      setCheckOutDate(date);
      setSearchData({ 
        ...searchData, 
        checkOut: date ? date.toISOString().split('T')[0] : '' 
      });
    }
  };

  const handleChange = (field, value) => {
    if (field === 'guests') {
      setSearchData({ ...searchData, [field]: value });
      setGuestsInput(String(value));
    } else {
    setSearchData({ ...searchData, [field]: value });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (checkInDate && checkOutDate && checkOutDate < checkInDate) {
      return;
    }
    if (onSearch) {
      onSearch(searchData);
    }
    setMobileOpen(false);
  };

  const clearCheckIn = () => {
    setCheckInDate(null);
    setSearchData({ ...searchData, checkIn: '' });
  };

  const clearCheckOut = () => {
    setCheckOutDate(null);
    setSearchData({ ...searchData, checkOut: '' });
  };

  const clearAll = () => {
    setCheckInDate(null);
    setCheckOutDate(null);
    setGuestsInput('1');
    setSearchData({
      location: '',
      checkIn: '',
      checkOut: '',
      guests: 1,
    });
  };

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-6 mb-8 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Find Your Perfect Stay</h2>
        <button
          type="button"
          className="md:hidden text-sm font-semibold text-primary-600"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? 'Hide' : 'Details'}
        </button>
      </div>

      {isMobile && (
        <button
          type="button"
          className="w-full md:hidden rounded-2xl border-2 border-blue-200 bg-white px-4 py-3 shadow-sm flex items-center justify-between text-left"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-expanded={mobileOpen}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-600">
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
                  d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Start your search</p>
              <p className="text-xs text-gray-500">
                {locationLabel} · {checkInLabel} → {checkOutLabel} · {guestsLabel}
              </p>
            </div>
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${mobileOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      <form onSubmit={handleSubmit} className="mt-4">
        <div
          className={`flex flex-col md:flex-row gap-4 items-end transition-all duration-200 ${
            !isMobile || mobileOpen ? 'mt-4' : 'hidden md:flex'
          }`}
        >
          {/* Location - 40% */}
          <div className="w-full md:w-[40%]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location
            </label>
            <LocationDropdown
              locations={locations}
              value={searchData.location}
              onChange={(value) => handleChange('location', value)}
              placeholder="All Locations"
              mobile={isMobile}
            />
          </div>

          {/* Check In - 25% */}
          <div className="w-full md:w-[25%]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Check In
            </label>
            <CustomDatePicker
              selected={checkInDate}
              onChange={(date) => handleDateChange('checkIn', date)}
              onClear={clearCheckIn}
              placeholder="Add dates"
              selectsStart
              startDate={checkInDate}
              endDate={checkOutDate}
            />
          </div>

          {/* Check Out - 25% */}
          <div className="w-full md:w-[25%]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Check Out
            </label>
            <CustomDatePicker
              selected={checkOutDate}
              onChange={(date) => handleDateChange('checkOut', date)}
              onClear={clearCheckOut}
              placeholder="Add dates"
              minDate={checkInDate || new Date()}
              selectsEnd
              startDate={checkInDate}
              endDate={checkOutDate}
            />
          </div>

          {/* Guest Number - 10% */}
          <div className="w-full md:w-[10%]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Guests
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-3">
              <button
                type="button"
                onClick={() => {
                  const newValue = Math.max(searchData.guests - 1, 1);
                  setSearchData({ ...searchData, guests: newValue });
                  setGuestsInput(String(newValue));
                }}
                className="flex h-6 w-6 items-center justify-center rounded border border-gray-300 text-sm font-medium text-gray-600 transition hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-300"
                aria-label="Decrease guests"
              >
                −
              </button>
            <input
              type="number"
              min="1"
              max="20"
                value={guestsInput}
                onChange={(e) => {
                  const inputValue = e.target.value;
                  setGuestsInput(inputValue);
                  if (inputValue === '') {
                    return;
                  }
                  const numValue = parseInt(inputValue, 10);
                  if (!isNaN(numValue) && numValue >= 1 && numValue <= 20) {
                    setSearchData({ ...searchData, guests: numValue });
                  }
                }}
                onBlur={(e) => {
                  const inputValue = e.target.value;
                  const numValue = parseInt(inputValue, 10);
                  if (inputValue === '' || isNaN(numValue) || numValue < 1) {
                    setGuestsInput('1');
                    setSearchData({ ...searchData, guests: 1 });
                  } else if (numValue > 20) {
                    setGuestsInput('20');
                    setSearchData({ ...searchData, guests: 20 });
                  } else {
                    setGuestsInput(String(numValue));
                  }
                }}
                className="flex-1 text-center text-base font-medium text-gray-900 border-0 focus:ring-0 focus:outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                style={{ background: 'transparent', width: '3rem' }}
              />
              <button
                type="button"
                onClick={() => {
                  const newValue = Math.min(searchData.guests + 1, 20);
                  setSearchData({ ...searchData, guests: newValue });
                  setGuestsInput(String(newValue));
                }}
                disabled={searchData.guests >= 20}
                className="flex h-6 w-6 items-center justify-center rounded border border-gray-300 text-sm font-medium text-gray-600 transition hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-300 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Increase guests"
              >
                +
              </button>
            </div>
          </div>

          <div className="w-full md:w-auto flex flex-col sm:flex-row gap-2 md:items-center">
            <button
              type="button"
              onClick={clearAll}
              className="w-full md:w-auto px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors whitespace-nowrap"
            >
              Clear
            </button>
            <button
              type="submit"
              className="w-full md:w-auto px-8 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors whitespace-nowrap"
            >
              Search
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default QuickSearch;

