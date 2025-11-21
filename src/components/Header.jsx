import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCategories } from '../services/api';

const Header = () => {
  const [categories, setCategories] = useState([]);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('Demo User');

  useEffect(() => {
    loadCategories();
    // Check if user is logged in (demo - you can enhance this)
    const storedUser = localStorage.getItem('demo_user');
    if (storedUser) {
      setIsLoggedIn(true);
      setUserName(JSON.parse(storedUser).name || 'Demo User');
    }
  }, []);

  const loadCategories = async () => {
    try {
      const data = await getCategories();
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const handleLogin = () => {
    // Demo login - just set a flag
    const demoUser = { name: 'Demo User', email: 'demo@touresm.cloud' };
    localStorage.setItem('demo_user', JSON.stringify(demoUser));
    setIsLoggedIn(true);
    setUserMenuOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('demo_user');
    setIsLoggedIn(false);
    setUserMenuOpen(false);
  };

  return (
    <header className="hidden md:block bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo - Hidden on mobile */}
          <Link to="/" className="hidden md:flex items-center space-x-3">
            <img 
              src="/1_touresm_logo.svg" 
              alt="Touresm Logo" 
              className="h-10 w-10"
            />
            <h1 className="text-2xl font-bold text-primary-600">Touresm</h1>
          </Link>

          {/* Desktop Navigation - Categories as main menu */}
          <nav className="hidden md:flex items-center gap-6 flex-1 ml-8">
            {categories.length > 0 && (
              <div className="flex items-center gap-6">
                {categories.map((category) => (
                  <Link
                    key={category.id || category.term_id}
                    to={`/?category=${category.id || category.term_id}`}
                    className="text-gray-700 hover:text-primary-600 font-medium transition-colors"
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
            )}
          </nav>

          {/* User Profile */}
          <div className="hidden md:block relative">
              {isLoggedIn ? (
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 text-gray-700 hover:text-primary-600 transition-colors"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 text-primary-600 font-semibold text-sm">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium">{userName}</span>
                  <svg
                    className={`w-4 h-4 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={handleLogin}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                >
                  Login
                </button>
              )}

              {userMenuOpen && isLoggedIn && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900">{userName}</p>
                      <p className="text-xs text-gray-500">demo@touresm.cloud</p>
                    </div>
                    <Link
                      to="/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary-600 transition-colors"
                    >
                      My Profile
                    </Link>
                    <Link
                      to="/bookings"
                      onClick={() => setUserMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary-600 transition-colors"
                    >
                      My Bookings
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                </>
              )}
          </div>

        </div>
      </div>
    </header>
  );
};

export default Header;

