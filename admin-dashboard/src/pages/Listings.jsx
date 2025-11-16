import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getListings, deleteListing, getMediaByParent } from '../services/api';
import ConfirmModal from '../components/ConfirmModal';

const Listings = () => {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [galleryIndexById, setGalleryIndexById] = useState({});
  const [galleryUrlsById, setGalleryUrlsById] = useState({});
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => {
    loadListings();
  }, []);

  const loadListings = async () => {
    try {
      setLoading(true);
      const data = await getListings({ per_page: 100 });
      setListings(data);
      setError('');

      // Fetch attachments for each listing to power on-card gallery
      try {
        const extractId = (img) => {
          if (!img) return null;
          if (typeof img === 'number') return img;
          if (typeof img === 'string') {
            const n = parseInt(img, 10);
            return Number.isNaN(n) ? null : n;
          }
          if (typeof img === 'object') {
            return (
              img.id ||
              img.ID ||
              img.media_id ||
              img.image_id ||
              img.attachment_id ||
              (img.meta && (img.meta.id || img.meta.image_id)) ||
              null
            );
          }
          return null;
        };

        const pairs = await Promise.allSettled(
          (data || []).map(async (item) => {
            if (!item?.id) return null;
            const attachments = await getMediaByParent(item.id);
            const sorted = (attachments || []).slice().sort((a, b) => {
              const ao = typeof a.menu_order === 'number' ? a.menu_order : parseInt(a.menu_order || 0, 10) || 0;
              const bo = typeof b.menu_order === 'number' ? b.menu_order : parseInt(b.menu_order || 0, 10) || 0;
              if (ao !== bo) return ao - bo;
              return (parseInt(a.id || a.ID || 0, 10) || 0) - (parseInt(b.id || b.ID || 0, 10) || 0);
            });
            const idToUrl = new Map(
              sorted.map((att) => {
                const url =
                  att?.source_url ||
                  att?.media_details?.sizes?.large?.source_url ||
                  att?.guid?.rendered ||
                  null;
                return [Number(att?.id || att?.ID), url];
              })
            );
            // Prefer explicit order from Pods/meta if present
            let urls = [];
            try {
              const rawMeta = item.listing_gallery || item.meta?.listing_gallery || item.acf?.listing_gallery || [];
              const rawArr = Array.isArray(rawMeta) ? rawMeta : [rawMeta];
              const orderedIds = rawArr
                .map((img) => extractId(img))
                .filter((v) => v != null)
                .map((v) => Number(v));
              if (orderedIds.length > 0) {
                const seen = new Set();
                urls = orderedIds
                  .map((id) => {
                    seen.add(id);
                    return idToUrl.get(id);
                  })
                  .filter(Boolean);
                // Append any remaining attachments not in meta, in menu_order
                sorted.forEach((att) => {
                  const aid = Number(att?.id || att?.ID);
                  if (!seen.has(aid)) {
                    const url =
                      att?.source_url ||
                      att?.media_details?.sizes?.large?.source_url ||
                      att?.guid?.rendered ||
                      null;
                    if (url) urls.push(url);
                  }
                });
              } else {
                urls = sorted
                  .map(
                    (att) =>
                      att?.source_url ||
                      att?.media_details?.sizes?.large?.source_url ||
                      att?.guid?.rendered ||
                      null
                  )
                  .filter(Boolean);
              }
            } catch (_) {
              urls = sorted
                .map(
                  (att) =>
                    att?.source_url ||
                    att?.media_details?.sizes?.large?.source_url ||
                    att?.guid?.rendered ||
                    null
                )
                .filter(Boolean);
            }
            return { id: item.id, urls };
          })
        );
        const map = {};
        pairs.forEach((res) => {
          if (res.status === 'fulfilled' && res.value && res.value.id) {
            map[res.value.id] = res.value.urls || [];
          }
        });
        setGalleryUrlsById(map);
      } catch (_e) {
        // silent
      }
    } catch (err) {
      setError('Failed to load listings. Please try again.');
      console.error('Error loading listings:', err);
    } finally {
      setLoading(false);
    }
  };

  const askDelete = (id, title) => {
    setPendingDelete({ id, title });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteListing(pendingDelete.id);
      setListings((prev) => prev.filter((l) => l.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch (err) {
      alert('Failed to delete listing. Please try again.');
      console.error('Error deleting listing:', err);
      setPendingDelete(null);
    }
  };

  const getImageUrl = (listing) => {
    if (listing.listing_gallery && listing.listing_gallery.length > 0) {
      const firstImage = listing.listing_gallery[0];
      if (typeof firstImage === 'string') return firstImage;
      if (typeof firstImage === 'object') {
        return firstImage.url || firstImage.source_url || firstImage.guid || null;
      }
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Listings</h1>
          <p className="mt-2 text-gray-600">Manage your property listings</p>
        </div>
        <Link
          to="/listings/new"
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          + Add New Listing
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {listings.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-600 mb-4">No listings found.</p>
          <Link
            to="/listings/new"
            className="inline-block px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Create Your First Listing
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-6">
          {listings.map((listing) => {
            const imageUrl = getImageUrl(listing);
            const galleryUrls = galleryUrlsById[listing.id] || [];
            const currentIndex = galleryIndexById[listing.id] || 0;
            const currentImage = galleryUrls[currentIndex] || imageUrl;
            const hasMultiple = galleryUrls.length > 1;
            const goTo = (idx) => {
              setGalleryIndexById((prev) => ({
                ...prev,
                [listing.id]: Math.max(0, Math.min(galleryUrls.length - 1, idx)),
              }));
            };
            const prev = (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!hasMultiple) return;
              const nextIdx = (currentIndex - 1 + galleryUrls.length) % galleryUrls.length;
              goTo(nextIdx);
            };
            const next = (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!hasMultiple) return;
              const nextIdx = (currentIndex + 1) % galleryUrls.length;
              goTo(nextIdx);
            };
            return (
              <div key={listing.id} className="bg-white rounded-lg shadow overflow-hidden">
                {(galleryUrls.length > 0 || imageUrl) && (
                  <div className="h-48 bg-gray-200 overflow-hidden relative group">
                    <img
                      key={`${listing.id}-${currentIndex}`}
                      src={currentImage}
                      alt={listing.listing_name || 'Listing'}
                      className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105"
                      onError={(e) => {
                        e.currentTarget.style.opacity = '0.5';
                      }}
                    />
                    {hasMultiple && (
                      <>
                        {/* Arrows (show on hover) */}
                        <button
                          onClick={prev}
                          className="hidden group-hover:flex absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full w-7 h-7 items-center justify-center"
                          aria-label="Previous image"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={next}
                          className="hidden group-hover:flex absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full w-7 h-7 items-center justify-center"
                          aria-label="Next image"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        {/* Minimal dots */}
                        <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1.5">
                          {galleryUrls.map((_, idx) => (
                            <button
                              key={idx}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                goTo(idx);
                              }}
                              className={`rounded-full transition-all ${idx === currentIndex ? 'bg-white w-3 h-1.5' : 'bg-white/60 w-1.5 h-1.5'}`}
                              aria-label={`Go to image ${idx + 1}`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {listing.listing_name || 'Unnamed Listing'}
                  </h3>
                  {listing.listing_price && (
                    <p className="text-primary-600 font-bold mb-2">
                      ${parseFloat(listing.listing_price).toLocaleString()}/night
                    </p>
                  )}
                  <div className="mt-4 flex items-center justify-between">
                    <Link
                      to={`/listings/edit/${listing.id}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors text-sm"
                      title="Edit"
                      aria-label="Edit listing"
                    >
                      {/* Heroicons Outline: Pencil Square */}
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.862 3.487a2.25 2.25 0 013.182 3.182l-9.193 9.193a4.5 4.5 0 01-1.897 1.13l-2.882.864a.75.75 0 01-.927-.927l.864-2.882a4.5 4.5 0 011.13-1.897l9.193-9.193z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 7.5L16.5 4.5" />
                      </svg>
                      <span>Edit</span>
                    </Link>
                    <div className="flex items-center gap-2">
                      {/* View button (opens public listing in new tab) */}
                      <a
                        href={listing.link || `/listing/${listing.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                        title="View"
                        aria-label="View listing"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12s3-7 9-7 9 7 9 7-3 7-9 7-9-7-9-7z" />
                          <circle cx="12" cy="12" r="3" strokeWidth={2} />
                        </svg>
                      </a>
                      {/* Delete icon button */}
                      <button
                        onClick={() => askDelete(listing.id, listing.listing_name)}
                        className="p-2 rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                        title="Delete"
                        aria-label="Delete listing"
                      >
                        {/* Heroicons Outline: Trash */}
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-1 12a2 2 0 01-2 2H8a2 2 0 01-2-2L5 7m14 0H5m3-4h8m-5 4v10m4-10v10" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Delete confirm modal */}
      <ConfirmModal
        open={Boolean(pendingDelete)}
        title="Delete listing?"
        message={
          pendingDelete
            ? `Are you sure you want to delete "${pendingDelete.title || 'this listing'}"? This action cannot be undone.`
            : ''
        }
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};

export default Listings;

