import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

const BottomNavigation = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const location = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem('demo_user');
    setIsLoggedIn(!!storedUser);

    // Check if any modal is open (filter or booking)
    const checkModalOpen = () => {
      const filterModalOpen = document.body.getAttribute('data-filter-modal-open') === 'true';
      const bookingModalOpen = document.body.getAttribute('data-booking-modal-open') === 'true';
      setIsModalOpen(filterModalOpen || bookingModalOpen);
    };

    // Initial check
    checkModalOpen();

    // Monitor for changes to the attributes
    const observer = new MutationObserver(checkModalOpen);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-filter-modal-open', 'data-booking-modal-open'],
    });

    // Handle scroll detection (only when modal is not open)
    const handleScroll = () => {
      // Don't show/hide when any modal is open - check current state
      const filterModalOpen = document.body.getAttribute('data-filter-modal-open') === 'true';
      const bookingModalOpen = document.body.getAttribute('data-booking-modal-open') === 'true';
      if (filterModalOpen || bookingModalOpen) {
        return;
      }

      const currentScrollY = window.scrollY;

      // Show when scrolling up, hide when scrolling down
      if (currentScrollY < lastScrollY || currentScrollY < 10) {
        // Scrolling up or at top
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        // Scrolling down and past 100px
        setIsVisible(false);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, [lastScrollY]);

  // Hide bottom nav when modal opens
  useEffect(() => {
    if (isModalOpen) {
      setIsVisible(false);
    } else if (window.scrollY < 10 || window.scrollY < lastScrollY) {
      // Show when modal closes and we're near top or scrolling up
      setIsVisible(true);
    }
  }, [isModalOpen, lastScrollY]);

  const handleLogin = () => {
    // Demo login
    const demoUser = { name: 'Demo User', email: 'demo@touresm.cloud' };
    localStorage.setItem('demo_user', JSON.stringify(demoUser));
    setIsLoggedIn(true);
  };

  const handleExplore = (e) => {
    e.preventDefault();
    // Clear everything and jump to fresh home page
    // Use window.location for a complete reset
    window.location.href = '/';
  };

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/' && !location.search;
    }
    return location.pathname.startsWith(path);
  };

  // Hide bottom nav when modal is open, regardless of scroll
  // Also hide on listing detail page
  const isListingDetail = location.pathname.startsWith('/listing/');
  const shouldShow = !isModalOpen && !isListingDetail && isVisible;

  return (
    <nav
      className={`md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 transition-transform duration-300 ${
        shouldShow ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {/* Explore (Home) */}
        <button
          onClick={handleExplore}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
            isActive('/') ? 'text-primary-600' : 'text-gray-600'
          }`}
        >
          <svg
            className="w-6 h-6 mb-1"
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
          <span className="text-xs font-medium">Explore</span>
        </button>

        {/* Wishlist */}
        <Link
          to="/wishlist"
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
            isActive('/wishlist') ? 'text-primary-600' : 'text-gray-600'
          }`}
        >
          <svg
            className="w-6 h-6 mb-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
          <span className="text-xs font-medium">Wishlist</span>
        </Link>

        {/* Login / Profile */}
        {isLoggedIn ? (
          <Link
            to="/profile"
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              isActive('/profile') ? 'text-primary-600' : 'text-gray-600'
            }`}
          >
            <div className="w-6 h-6 mb-1 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-xs font-semibold text-primary-600">U</span>
            </div>
            <span className="text-xs font-medium">Profile</span>
          </Link>
        ) : (
          <button
            onClick={handleLogin}
            className="flex flex-col items-center justify-center flex-1 h-full transition-colors text-gray-600"
          >
            <svg
              className="w-6 h-6 mb-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span className="text-xs font-medium">Login</span>
          </button>
        )}
      </div>
    </nav>
  );
};

export default BottomNavigation;

