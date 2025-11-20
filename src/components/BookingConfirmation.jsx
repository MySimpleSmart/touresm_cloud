import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import { getListing } from '../services/api';

const formatCurrency = (value) => {
  if (!value && value !== 0) return '—';
  return `₮${Number(value).toLocaleString()}`;
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date)) return '—';
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const getHeroImage = (gallery) => {
  if (!gallery) return null;
  if (Array.isArray(gallery)) {
    return gallery[0]?.url || gallery[0]?.source_url || gallery[0] || null;
  }
  if (typeof gallery === 'object') {
    return gallery.url || gallery.source_url || gallery.guid || null;
  }
  return gallery;
};

const BookingConfirmation = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};

  const [listing, setListing] = useState(state.listing || null);
  const [loadingListing, setLoadingListing] = useState(!state.listing);
  const [loadError, setLoadError] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState('');

  const [formError, setFormError] = useState('');

  const startDate = state.startDate ? new Date(state.startDate) : null;
  const endDate = state.endDate ? new Date(state.endDate) : null;
  const guestCount = state.guestCount || 1;
  const totalAmount = state.totalPrice?.total || 0;

  const nights = useMemo(() => {
    if (state.totalPrice?.nights) return state.totalPrice.nights;
    if (startDate && endDate) {
      const diff = Math.ceil(
        (endDate.setHours(0, 0, 0, 0) - startDate.setHours(0, 0, 0, 0)) /
          (1000 * 60 * 60 * 24)
      );
      return Math.max(1, diff);
    }
    return 0;
  }, [state.totalPrice, startDate, endDate]);

  const depositAmount = totalAmount ? Number((totalAmount * 0.3).toFixed(2)) : 0;

  useEffect(() => {
    if (listing || !id) return;
    setLoadingListing(true);
    getListing(id)
      .then((data) => setListing(data))
      .catch(() => setLoadError('Unable to load listing details.'))
      .finally(() => setLoadingListing(false));
  }, [id, listing]);

  const handleFileChange = (event) => {
    setFormError('');
    const file = event.target.files?.[0];
    if (!file) {
      setReceiptFile(null);
      setReceiptPreview('');
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setFormError('Receipt must be a JPG or PNG image.');
      event.target.value = '';
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setFormError('Receipt must be smaller than 10MB.');
      event.target.value = '';
      return;
    }

    setReceiptFile(file);
    setReceiptPreview(URL.createObjectURL(file));
  };

  const resetReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview('');
  };

  const missingBookingDetails = !startDate || !endDate || !totalAmount;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');

    if (missingBookingDetails) {
      setFormError('Please go back and select your stay dates before confirming.');
      return;
    }

    if (!customerName.trim()) {
      setFormError('Customer name is required.');
      return;
    }

    if (!customerMobile.trim()) {
      setFormError('Mobile number is required.');
      return;
    }

    if (!receiptFile) {
      setFormError('Please upload your payment receipt.');
      return;
    }

    if (!listing) {
      setFormError('Listing information is missing.');
      return;
    }
    const numericListingId = Number(id || listing?.id || listing?.ID);
    if (!Number.isFinite(numericListingId) || numericListingId <= 0) {
      setFormError('Invalid listing reference. Please return to the listing page and try again.');
      return;
    }

    setFormError(
      'Online booking submissions are temporarily unavailable. Please contact our team directly to confirm your reservation.'
    );
  };

  if (loadingListing) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <p className="text-lg text-red-600 mb-4">{loadError}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
          >
            ← Back to Listings
          </Link>
        </div>
      </div>
    );
  }

  if (missingBookingDetails) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-2xl mx-auto rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
          <h2 className="text-2xl font-semibold text-amber-900 mb-3">Almost there!</h2>
          <p className="text-amber-800 mb-6">
            Please choose your check-in and check-out dates on the listing page before confirming
            your booking.
          </p>
          <button
            type="button"
            onClick={() => navigate(`/listing/${id}`)}
            className="inline-flex items-center justify-center rounded-full bg-primary-600 text-white px-6 py-3 font-semibold hover:bg-primary-700 transition-colors"
          >
            Back to Listing
          </button>
        </div>
      </div>
    );
  }

  const heroImage =
    getHeroImage(listing?.listing_gallery) ||
    listing?.featured_media?.source_url ||
    'https://via.placeholder.com/800x600?text=Listing';

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 inline-flex items-center text-primary-600 hover:text-primary-700 font-medium"
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-8">
        <section className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <img
              src={heroImage}
              alt={listing?.listing_name || 'Listing'}
              className="w-full h-64 object-cover"
            />
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm uppercase tracking-wide text-gray-500 font-semibold">
                  Booking summary
                </p>
                <h1 className="text-3xl font-bold text-gray-900">
                  {listing?.listing_name || listing?.title?.rendered || 'Listing'}
                </h1>
                <p className="text-gray-600 mt-1">
                  {formatDate(startDate)} → {formatDate(endDate)} · {nights}{' '}
                  {nights === 1 ? 'night' : 'nights'} · Up to {guestCount}{' '}
                  {guestCount === 1 ? 'guest' : 'guests'}
                </p>
              </div>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
                  <p className="text-gray-500 font-medium">Total</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(totalAmount)}</p>
                  <p className="text-xs text-gray-500">Pay now: 30% deposit</p>
                </div>
                <div className="rounded-xl border border-primary-200 p-4 bg-primary-50">
                  <p className="text-primary-700 font-medium">Deposit (30%)</p>
                  <p className="text-xl font-bold text-primary-700">{formatCurrency(depositAmount)}</p>
                  <p className="text-xs text-primary-700">Due now</p>
                </div>
                <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
                  <p className="text-gray-500 font-medium">Balance</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(totalAmount - depositAmount)}
                  </p>
                  <p className="text-xs text-gray-500">Pay at check-in</p>
                </div>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5"
          >
            <h2 className="text-2xl font-semibold text-gray-900">Your details</h2>
            {formError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                  placeholder="Your full name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                <input
                  type="tel"
                  value={customerMobile}
                  onChange={(e) => setCustomerMobile(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                  placeholder="e.g. +976 99999999"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Upload Receipt (JPG or PNG, max 10MB)
              </label>
              <div className="flex flex-col gap-3">
                <label className="flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-primary-500">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <span className="text-sm font-medium text-gray-600">
                    {receiptFile ? receiptFile.name : 'Choose file'}
                  </span>
                </label>
                {receiptPreview && (
                  <div className="relative w-full max-w-sm">
                    <img src={receiptPreview} alt="Receipt preview" className="rounded-xl border" />
                    <button
                      type="button"
                      onClick={resetReceipt}
                      className="absolute -top-2 -right-2 bg-white border border-gray-200 rounded-full p-1 shadow"
                      aria-label="Remove receipt"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional Notes (optional)
              </label>
              <textarea
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                placeholder="Add any special requests or questions for the host."
              />
            </div>

            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-primary-600 text-white px-6 py-3 font-semibold hover:bg-primary-700 transition-colors"
            >
              Send booking request
            </button>
          </form>
        </section>

        <aside className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Stay details</h3>
            <dl className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <dt>Check-in</dt>
                <dd className="font-medium text-gray-900">{formatDate(startDate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Check-out</dt>
                <dd className="font-medium text-gray-900">{formatDate(endDate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Guests</dt>
                <dd className="font-medium text-gray-900">
                  {guestCount} {guestCount === 1 ? 'guest' : 'guests'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Nights</dt>
                <dd className="font-medium text-gray-900">{nights}</dd>
              </div>
            </dl>
            <div className="pt-4 border-t border-gray-100 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Total</span>
                <span className="font-semibold text-gray-900">{formatCurrency(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-primary-700">
                <span>Deposit (30%)</span>
                <span className="font-semibold">{formatCurrency(depositAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Balance due at check-in</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(totalAmount - depositAmount)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-primary-50 rounded-2xl border border-primary-100 p-6 text-sm text-primary-900 space-y-3">
            <h3 className="text-lg font-semibold text-primary-900">How it works</h3>
            <ul className="space-y-2 list-disc list-inside">
              <li>Pay 30% now to secure your stay.</li>
              <li>Upload the bank transfer or payment receipt.</li>
              <li>We’ll review and send a confirmation shortly.</li>
              <li>Pay the remaining balance when you arrive.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default BookingConfirmation;


