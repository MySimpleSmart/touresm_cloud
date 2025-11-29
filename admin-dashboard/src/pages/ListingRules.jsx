import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getListingRules, deleteListingRule, getListings } from '../services/api';
import ConfirmModal from '../components/ConfirmModal';

const ListingRules = () => {
  const [rules, setRules] = useState([]);
  const [allListings, setAllListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => {
    loadRules();
    loadListings();
  }, []);

  const loadListings = async () => {
    try {
      const data = await getListings({ per_page: 100 });
      setAllListings(data);
    } catch (err) {
      console.error('Error loading listings:', err);
    }
  };

  const loadRules = async () => {
    try {
      setLoading(true);
      const data = await getListingRules({ per_page: 100 });
      setRules(data);
      setError('');
    } catch (err) {
      console.error('Error loading listing rules:', err);
      setError('Failed to load listing rules. Please try again.');
      setRules([]);
    } finally {
      setLoading(false);
    }
  };

  const getRuleTitle = (rule) => {
    return rule.title?.rendered || rule.listing_rule_title || rule.meta?.listing_rule_title || 'Untitled Rule';
  };

  const getRuleContent = (rule) => {
    return rule.listing_rules || rule.meta?.listing_rules || rule.content?.rendered || '';
  };

  const getAssignedListings = (rule) => {
    const assigned = rule.rule_assigned || rule.meta?.rule_assigned || '';
    let assignedIds = [];
    
    if (Array.isArray(assigned)) {
      assignedIds = assigned.map(id => String(id));
    } else if (typeof assigned === 'string' && assigned.trim()) {
      // Parse string like "Listing #2715,2710,2705,2384,2376" or "2715,2710,2705,2384,2376"
      // Extract numeric IDs from the string
      const idMatches = assigned.match(/\d+/g) || [];
      assignedIds = idMatches.map(id => String(id));
    } else if (assigned) {
      // Single value - extract numeric ID
      const idMatch = String(assigned).match(/\d+/);
      if (idMatch) {
        assignedIds = [idMatch[0]];
      }
    }
    
    // Map IDs to listing names
    return assignedIds.map(id => {
      const listing = allListings.find(l => String(l.id || l.ID) === String(id));
      return listing ? (listing.title?.rendered || listing.listing_name || 'Unknown') : null;
    }).filter(name => name !== null); // Remove any nulls (listings not found)
  };

  const filteredRules = rules.filter(rule => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    const title = getRuleTitle(rule);
    const content = getRuleContent(rule);
    return title.toLowerCase().includes(searchLower) || 
           content.toLowerCase().includes(searchLower);
  });

  const handleDelete = async () => {
    if (!pendingDelete) return;
    
    try {
      await deleteListingRule(pendingDelete.id);
      await loadRules();
      setPendingDelete(null);
    } catch (err) {
      console.error('Error deleting rule:', err);
      alert('Failed to delete rule. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Listing Rules</h1>
          <p className="mt-2 text-gray-600">Manage rules and policies for your listings</p>
        </div>
        <Link
          to="/listings/rules/new"
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          Add New Listing Rule
        </Link>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search by rule title or content..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Rules List */}
      {filteredRules.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No listing rules found</h3>
          <p className="mt-2 text-sm text-gray-500">
            {searchTerm
              ? 'Try adjusting your search terms.'
              : 'Create a new listing rule to see it here.'}
          </p>
          {!searchTerm && (
            <Link
              to="/listings/rules/new"
              className="mt-4 inline-block px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Add New Listing Rule
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rules
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned Listings
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRules.map((rule) => {
                  const ruleId = rule.id || rule.ID;
                  const title = getRuleTitle(rule);
                  const content = getRuleContent(rule);
                  const assignedListings = getAssignedListings(rule);

                  return (
                    <tr key={ruleId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{title}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-2xl">
                          {content.length > 200 ? (
                            <>
                              <span>{content.substring(0, 200)}...</span>
                              <Link
                                to={`/listings/rules/edit/${ruleId}`}
                                className="text-primary-600 hover:text-primary-700 ml-1"
                              >
                                Read more
                              </Link>
                            </>
                          ) : (
                            content || <span className="text-gray-400">No content</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {assignedListings.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {assignedListings.map((listingName, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-2 py-1 rounded-md bg-primary-50 text-primary-700 text-xs"
                                >
                                  {listingName}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400">Not assigned</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/listings/rules/edit/${ruleId}`}
                            className="text-primary-600 hover:text-primary-700"
                            title="Edit Rule"
                          >
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
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </Link>
                          <button
                            onClick={() => setPendingDelete({ id: ruleId, name: title })}
                            className="text-red-600 hover:text-red-700"
                            title="Delete Rule"
                          >
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
                                d="M19 7l-1 12a2 2 0 01-2 2H8a2 2 0 01-2-2L5 7m14 0H5m3-4h8m-5 4v10m4-10v10"
                              />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={!!pendingDelete}
        title="Delete Listing Rule?"
        message={pendingDelete ? `Are you sure you want to delete the rule "${pendingDelete.name}"? This action cannot be undone.` : ''}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};

export default ListingRules;
