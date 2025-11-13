import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ListingList from './components/ListingList';
import ListingDetail from './components/ListingDetail';
import Header from './components/Header';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<ListingList />} />
            <Route path="/listing/:id" element={<ListingDetail />} />
            <Route path="*" element={
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="text-center py-12">
                  <h1 className="text-3xl font-bold text-gray-900 mb-4">Page Not Found</h1>
                  <p className="text-gray-500 text-lg mb-4">The page you're looking for doesn't exist.</p>
                  <a
                    href="/"
                    className="text-primary-600 hover:text-primary-700 font-medium"
                  >
                    ← Back to Home
                  </a>
                </div>
              </div>
            } />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

