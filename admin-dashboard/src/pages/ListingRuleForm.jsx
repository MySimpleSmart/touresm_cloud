import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getListings, getListingRule, updateListingRule, createListingRule, updatePodsItemFields } from '../services/api';

const ListingRuleForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [allListings, setAllListings] = useState([]);
  const [formData, setFormData] = useState({
    listing_rule_title: '',
    listing_rules: '',
    rule_assigned: [],
  });

  useEffect(() => {
    loadListings();
    if (isEdit) {
      loadRule();
    }
  }, [id]);

  const loadListings = async () => {
    try {
      const data = await getListings({ per_page: 100 });
      setAllListings(data);
    } catch (err) {
      console.error('Error loading listings:', err);
      setError('Failed to load listings. Please try again.');
    }
  };

  const loadRule = async () => {
    try {
      setLoading(true);
      const rule = await getListingRule(id);
      
      // Parse rule_assigned - handle both array and string formats (including "Listing #..." format)
      let assigned = rule.rule_assigned || rule.meta?.rule_assigned || '';
      let assignedArray = [];
      
      if (Array.isArray(assigned)) {
        assignedArray = assigned.map(id => String(id));
      } else if (typeof assigned === 'string' && assigned.trim()) {
        // Parse string like "Listing #2715,2710,2705,2384" or "2715,2710,2705,2384"
        // Extract numeric IDs from the string
        const idMatches = assigned.match(/\d+/g) || [];
        assignedArray = idMatches.map(id => String(id));
      } else if (assigned) {
        // Single value - extract numeric ID
        const idMatch = String(assigned).match(/\d+/);
        if (idMatch) {
          assignedArray = [idMatch[0]];
        }
      }
      
      setFormData({
        listing_rule_title: rule.title?.rendered || rule.listing_rule_title || rule.meta?.listing_rule_title || '',
        listing_rules: rule.listing_rules || rule.meta?.listing_rules || rule.content?.rendered || '',
        rule_assigned: assignedArray,
      });
      setError('');
    } catch (err) {
      console.error('Error loading listing rule:', err);
      setError('Failed to load listing rule. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleListingToggle = (listingId) => {
    setFormData(prev => {
      const assigned = prev.rule_assigned || [];
      const listingIdStr = String(listingId);
      const isSelected = assigned.includes(listingIdStr);
      
      return {
        ...prev,
        rule_assigned: isSelected
          ? assigned.filter(id => id !== listingIdStr)
          : [...assigned, listingIdStr],
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.listing_rule_title.trim() || !formData.listing_rules.trim()) {
      setError('Please enter a title and listing rule content.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const ruleAssignedIds = formData.rule_assigned.map(id => parseInt(id)).filter(id => !isNaN(id));
      
      // Step 1: Save core fields first (title, status, listing_rules)
      const coreData = {
        title: formData.listing_rule_title.trim(),
        status: 'publish',
        listing_rules: formData.listing_rules.trim(),
      };

      let savedRule;
      if (isEdit) {
        savedRule = await updateListingRule(id, coreData);
      } else {
        savedRule = await createListingRule(coreData);
      }

      const ruleId = savedRule?.id || id;
      if (!ruleId) {
        throw new Error('Failed to get listing rule ID after save');
      }

      // Step 2: Save listing_rule_title and rule_assigned via PODS REST API (like listings do)
      // Since rule_assigned is "Plain text" type, convert array to comma-separated string
      // Ensure we're sending just numeric IDs, not "Listing #" formatted text
      const ruleAssignedValue = ruleAssignedIds.length > 0 
        ? ruleAssignedIds.join(',')  // Just comma-separated numeric IDs: "2715,2710,2705"
        : '';
      
      // Try PODS REST API first (may return 404 if not enabled - that's OK, we'll fallback)
      let podsSuccess = false;
      try {
        await updatePodsItemFields('listing_rules', Number(ruleId), {
          listing_rule_title: formData.listing_rule_title.trim(),
          rule_assigned: ruleAssignedValue || ruleAssignedIds,
        });
        podsSuccess = true;
      } catch (podsErr) {
        // PODS REST API returns 404 if not enabled - silently fallback
      }
      
      // If PODS API failed or returned 404, use fallback method
      if (!podsSuccess) {
        try {
          // Try saving listing_rule_title at top level
          if (formData.listing_rule_title.trim()) {
            try {
              await updateListingRule(ruleId, {
                listing_rule_title: formData.listing_rule_title.trim(),
              });
            } catch (titleErr) {
              console.error('Failed to save listing_rule_title:', titleErr);
            }
          }
          
          // Try saving rule_assigned at top level
          try {
            await updateListingRule(ruleId, {
              rule_assigned: ruleAssignedValue,
            });
          } catch (stringErr) {
            // Try as array if string fails
            try {
              await updateListingRule(ruleId, {
                rule_assigned: ruleAssignedIds,
              });
            } catch (arrayErr) {
              console.error('Failed to save rule_assigned:', arrayErr);
            }
          }
        } catch (fallbackErr) {
          console.error('Failed to save PODS fields:', fallbackErr);
        }
      }

      navigate('/listings/rules');
    } catch (err) {
      console.error('Error saving listing rule:', err);
      console.error('Error response:', err.response);
      console.error('Error data:', err.response?.data);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to save listing rule. Please try again.';
      setError(errorMessage);
    } finally {
      setSaving(false);
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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {isEdit ? 'Edit Listing Rule' : 'Add New Listing Rule'}
        </h1>
        <p className="mt-2 text-gray-600">
          {isEdit ? 'Update the listing rule and policies' : 'Create a new listing rule and policies'}
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              name="listing_rule_title"
              value={formData.listing_rule_title}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              placeholder="Enter rule title..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Listing Rule *
            </label>
            <textarea
              name="listing_rules"
              value={formData.listing_rules}
              onChange={handleChange}
              rows={15}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              placeholder="Enter listing rules and policies..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rule Assigned
            </label>
            <div className="border border-gray-300 rounded-lg p-4 max-h-64 overflow-y-auto">
              {allListings.length === 0 ? (
                <p className="text-gray-500 text-sm">No listings available.</p>
              ) : (
                <div className="space-y-2">
                  {allListings.map((listing) => {
                    const listingId = listing.id || listing.ID;
                    const listingName = listing.title?.rendered || listing.listing_name || 'Unnamed Listing';
                    const isSelected = formData.rule_assigned.includes(String(listingId));
                    
                    return (
                      <label
                        key={listingId}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleListingToggle(listingId)}
                          className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-900">{listingName}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            {formData.rule_assigned.length > 0 && (
              <p className="mt-2 text-sm text-gray-500">
                {formData.rule_assigned.length} listing(s) selected
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/listings/rules')}
            disabled={saving}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !formData.listing_rule_title.trim() || !formData.listing_rules.trim()}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : isEdit ? 'Update Rule' : 'Save Rule'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ListingRuleForm;
