import { useState } from 'react';
import CustomDatePicker from './DatePicker';
import LocationDropdown from './LocationDropdown';

const QuickSearch = ({ locations = [], onSearch }) => {
  const [checkInDate, setCheckInDate] = useState(null);
  const [checkOutDate, setCheckOutDate] = useState(null);
  const [guestsInput, setGuestsInput] = useState('1');
  const [searchData, setSearchData] = useState({
    location: '',
    checkIn: '',
    checkOut: '',
    guests: 1,
  });


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
    if (onSearch) {
      onSearch(searchData);
    }
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
    <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Find Your Perfect Stay</h2>
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col md:flex-row gap-4 items-end">
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

          {/* Search Button */}
          <div className="w-full md:w-auto flex gap-2">
            <button
              type="button"
              onClick={clearAll}
              className="w-full md:w-auto px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors whitespace-nowrap"
            >
              Clear
            </button>
            <button
              type="submit"
              className="w-full md:w-auto px-8 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors shadow-md hover:shadow-lg whitespace-nowrap"
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

