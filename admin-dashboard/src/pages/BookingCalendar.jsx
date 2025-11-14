import { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { getHouses, updateHouseDates, getBookings } from '../services/api';

const BookingCalendar = () => {
  const [houses, setHouses] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({
    startDate: null,
    endDate: null,
    houseSize: '',
    houseSearch: '',
  });

  const [selectedMonth, setSelectedMonth] = useState(new Date());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [housesData, bookingsData] = await Promise.all([
        getHouses({ per_page: 100 }),
        getBookings({ per_page: 100 }),
      ]);
      setHouses(housesData);
      setBookings(bookingsData);
      setError('');
    } catch (err) {
      setError('Failed to load data. Please try again.');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getAvailableDates = (house) => {
    const datesStr = house.meta?.available_dates || '';
    if (!datesStr) return [];
    return datesStr.split(',').map((d) => d.trim()).filter(Boolean);
  };

  const getBookingsForHouse = (houseId) => {
    return bookings.filter((booking) => {
      const bookingData = booking.meta?.booking_data;
      return bookingData && bookingData.house_name === houses.find((h) => h.id === houseId)?.title?.rendered;
    });
  };

  const filteredHouses = houses.filter((house) => {
    if (filters.houseSize && house.meta?.house_size !== filters.houseSize) {
      return false;
    }
    if (filters.houseSearch) {
      const searchTerm = filters.houseSearch.toLowerCase();
      const title = house.title?.rendered?.toLowerCase() || '';
      return title.includes(searchTerm);
    }
    return true;
  });

  const getDateStatus = (date, availableDates, houseBookings) => {
    const dateStr = date.toISOString().split('T')[0];
    const isAvailable = availableDates.includes(dateStr);
    
    // Check if there's a booking for this date
    const hasBooking = houseBookings.some((booking) => {
      const bookingData = booking.meta?.booking_data;
      if (!bookingData) return false;
      
      const checkin = new Date(bookingData.checkin);
      const checkout = new Date(bookingData.checkout);
      const currentDate = new Date(dateStr);
      
      return currentDate >= checkin && currentDate <= checkout;
    });

    if (hasBooking) return 'booked';
    if (isAvailable) return 'available';
    return 'unavailable';
  };

  const generateCalendarDays = (year, month) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Booking Calendar</h1>
        <p className="mt-2 text-gray-600">Manage house availability and bookings</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <DatePicker
              selected={filters.startDate}
              onChange={(date) => setFilters({ ...filters, startDate: date })}
              dateFormat="yyyy-MM-dd"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              placeholderText="Select start date"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <DatePicker
              selected={filters.endDate}
              onChange={(date) => setFilters({ ...filters, endDate: date })}
              dateFormat="yyyy-MM-dd"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              placeholderText="Select end date"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              House Size
            </label>
            <select
              value={filters.houseSize}
              onChange={(e) => setFilters({ ...filters, houseSize: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">All Sizes</option>
              <option value="Large">Large</option>
              <option value="Medium">Medium</option>
              <option value="Small">Small</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search House
            </label>
            <input
              type="text"
              value={filters.houseSearch}
              onChange={(e) => setFilters({ ...filters, houseSearch: e.target.value })}
              placeholder="Search by name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>
      </div>

      {/* Calendar View */}
      <div className="space-y-6">
        {filteredHouses.map((house) => {
          const availableDates = getAvailableDates(house);
          const houseBookings = getBookingsForHouse(house.id);
          const currentYear = selectedMonth.getFullYear();
          const currentMonth = selectedMonth.getMonth();
          const calendarDays = generateCalendarDays(currentYear, currentMonth);

          return (
            <div key={house.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {house.title?.rendered || 'Unnamed House'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Size: {house.meta?.house_size || 'N/A'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const newDate = new Date(selectedMonth);
                      newDate.setMonth(newDate.getMonth() - 1);
                      setSelectedMonth(newDate);
                    }}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                  >
                    ←
                  </button>
                  <button
                    onClick={() => {
                      const newDate = new Date(selectedMonth);
                      newDate.setMonth(newDate.getMonth() + 1);
                      setSelectedMonth(newDate);
                    }}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                  >
                    →
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-lg font-medium text-gray-900">
                  {monthNames[currentMonth]} {currentYear}
                </h4>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1 mb-4">
                {dayNames.map((day) => (
                  <div key={day} className="text-center text-sm font-medium text-gray-600 py-2">
                    {day}
                  </div>
                ))}
                {calendarDays.map((date, index) => {
                  if (!date) {
                    return <div key={index} className="h-10"></div>;
                  }

                  const status = getDateStatus(date, availableDates, houseBookings);
                  const statusColors = {
                    available: 'bg-green-100 text-green-800 border-green-300',
                    unavailable: 'bg-red-100 text-red-800 border-red-300',
                    booked: 'bg-yellow-100 text-yellow-800 border-yellow-300',
                  };

                  return (
                    <div
                      key={index}
                      className={`h-10 flex items-center justify-center text-sm border rounded ${statusColors[status] || 'bg-gray-50 text-gray-600'}`}
                      title={status}
                    >
                      {date.getDate()}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
                  <span>Unavailable</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
                  <span>Booked</span>
                </div>
              </div>

              {/* Bookings List */}
              {houseBookings.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <h5 className="font-medium text-gray-900 mb-2">Recent Bookings:</h5>
                  <div className="space-y-2">
                    {houseBookings.slice(0, 3).map((booking) => {
                      const bookingData = booking.meta?.booking_data;
                      if (!bookingData) return null;
                      return (
                        <div key={booking.id} className="text-sm text-gray-600">
                          {bookingData.checkin} - {bookingData.checkout} ({bookingData.guests} guests)
                          <span className={`ml-2 px-2 py-1 rounded text-xs ${
                            booking.meta?.booking_status === 'confirmed' ? 'bg-green-100 text-green-800' :
                            booking.meta?.booking_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {booking.meta?.booking_status || 'pending'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredHouses.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-600">No houses found matching the filters.</p>
        </div>
      )}
    </div>
  );
};

export default BookingCalendar;

