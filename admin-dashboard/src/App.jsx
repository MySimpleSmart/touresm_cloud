import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Listings from './pages/Listings';
import ListingForm from './pages/ListingForm';
import BookingCalendar from './pages/BookingCalendar';
import BookingTable from './pages/BookingConfirmationTable';
import AllHosts from './pages/AllHosts';
import AllUsers from './pages/AllUsers';
import Reports from './pages/Reports';
import News from './pages/News';
import Banner from './pages/Banner';
import MyProfile from './pages/MyProfile';
import Messages from './pages/Messages';
import Settings from './pages/Settings';
import Layout from './components/Layout';
import { isAuthenticated } from './utils/auth';

function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    setAuthenticated(isAuthenticated());
    setAuthChecked(true);
  }, []);

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login onLogin={() => setAuthenticated(true)} />} />
        <Route
          path="/"
          element={
            authenticated ? (
              <Layout>
                <Dashboard />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/listings"
          element={
            authenticated ? (
              <Layout>
                <Listings />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/listings/new"
          element={
            authenticated ? (
              <Layout>
                <ListingForm />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/listings/edit/:id"
          element={
            authenticated ? (
              <Layout>
                <ListingForm />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/bookings"
          element={
            authenticated ? (
              <Layout>
                <BookingCalendar />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/booking-table"
          element={
            authenticated ? (
              <Layout>
                <BookingTable />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/profile"
          element={
            authenticated ? (
              <Layout>
                <MyProfile />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/messages"
          element={
            authenticated ? (
              <Layout>
                <Messages />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/settings"
          element={
            authenticated ? (
              <Layout>
                <Settings />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/hosts"
          element={
            authenticated ? (
              <Layout>
                <AllHosts />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/users"
          element={
            authenticated ? (
              <Layout>
                <AllUsers />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/reports"
          element={
            authenticated ? (
              <Layout>
                <Reports />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/news"
          element={
            authenticated ? (
              <Layout>
                <News />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/banner"
          element={
            authenticated ? (
              <Layout>
                <Banner />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;

