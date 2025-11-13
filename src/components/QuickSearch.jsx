import { useState } from 'react';
import CustomDatePicker from './DatePicker';

const QuickSearch = ({ locations = [], onSearch }) => {
  const [checkInDate, setCheckInDate] = useState(null);
  const [checkOutDate, setCheckOutDate] = useState(null);
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
    setSearchData({ ...searchData, [field]: value });
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
            <select
              value={searchData.location}
              onChange={(e) => handleChange('location', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">All Locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
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
            <input
              type="number"
              min="1"
              max="20"
              value={searchData.guests}
              onChange={(e) => handleChange('guests', parseInt(e.target.value) || 1)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
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

