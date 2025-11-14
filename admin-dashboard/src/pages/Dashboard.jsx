import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getListings, getBookings } from '../services/api';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalListings: 0,
    totalBookings: 0,
    pendingBookings: 0,
    loading: true,
  });

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [listings, bookings] = await Promise.all([
          getListings({ per_page: 1 }).catch(() => []),
          getBookings({ per_page: 100 }).catch(() => []),
        ]);

        const pending = (bookings || []).filter(
          (booking) => booking.meta?.booking_status === 'pending'
        );

        setStats({
          totalListings: listings.length > 0 ? parseInt(listings[0].total || 0) : 0,
          totalBookings: (bookings || []).length,
          pendingBookings: pending.length,
          loading: false,
        });
      } catch (error) {
        console.error('Error loading stats:', error);
        setStats((prev) => ({ ...prev, loading: false }));
      }
    };

    loadStats();
  }, []);

  if (stats.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">Welcome to Touresm Admin Dashboard</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-primary-100 rounded-md p-3">
              <span className="text-2xl">🏠</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Listings</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalListings}</p>
            </div>
          </div>
          <div className="mt-4">
            <Link
              to="/listings"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              View all →
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
              <span className="text-2xl">📅</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Bookings</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalBookings}</p>
            </div>
          </div>
          <div className="mt-4">
            <Link
              to="/bookings"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              View calendar →
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-yellow-100 rounded-md p-3">
              <span className="text-2xl">⏳</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending Bookings</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.pendingBookings}</p>
            </div>
          </div>
          <div className="mt-4">
            <Link
              to="/bookings"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Review →
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-4">
          <Link
            to="/listings/new"
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            + Add New Listing
          </Link>
          <Link
            to="/listings"
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Manage Listings
          </Link>
          <Link
            to="/bookings"
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            View Booking Calendar
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

