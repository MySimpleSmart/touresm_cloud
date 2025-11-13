import { Link } from 'react-router-dom';

const Header = () => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-3">
            <img 
              src="/1_touresm_logo.svg" 
              alt="Touresm Logo" 
              className="h-10 w-10"
            />
            <h1 className="text-2xl font-bold text-primary-600">Touresm</h1>
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Header;

