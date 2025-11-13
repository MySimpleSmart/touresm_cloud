import { useState, useMemo, useEffect } from 'react';

const ImageGallery = ({ images }) => {
  const [selectedImage, setSelectedImage] = useState(0);
  const [isFading, setIsFading] = useState(true);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Helper to extract URL from image object or string
  const getImageUrl = (image) => {
    if (!image) return null;
    if (typeof image === 'string') return image;
    if (typeof image === 'object') {
      // WordPress media object structure
      return image.url || image.source_url || image.guid || image.src || null;
    }
    return null;
  };

  // Process images array to extract URLs
  const imageArray = useMemo(() => {
    if (!images) return [];
    const arr = Array.isArray(images) ? images : [images];
    return arr.map(img => {
      if (!img) return null;
      if (typeof img === 'string') return img;
      if (typeof img === 'object') {
        return img.url || img.source_url || img.guid || img.src || null;
      }
      return null;
    }).filter(url => url !== null);
  }, [images]);

  const placeholderImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgZmlsbD0iI2U1ZTdlYiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBOb3QgQXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==';

  const handleImageError = (e) => {
    e.target.src = placeholderImage;
    e.target.onerror = null; // Prevent infinite loop
  };

  useEffect(() => {
    setIsFading(false);
    const timeout = setTimeout(() => setIsFading(true), 20);
    return () => clearTimeout(timeout);
  }, [selectedImage]);

  useEffect(() => {
    if (!isLightboxOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsLightboxOpen(false);
      } else if (event.key === 'ArrowRight') {
        setLightboxIndex((prev) =>
          prev === imageArray.length - 1 ? 0 : prev + 1
        );
      } else if (event.key === 'ArrowLeft') {
        setLightboxIndex((prev) => (prev === 0 ? imageArray.length - 1 : prev - 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen, imageArray.length]);

  const openLightbox = (index) => {
    setLightboxIndex(index);
    setIsLightboxOpen(true);
  };

  const closeLightbox = () => {
    setIsLightboxOpen(false);
  };

  const showPrevious = () => {
    setSelectedImage((prev) =>
      prev === 0 ? imageArray.length - 1 : prev - 1
    );
    setLightboxIndex((prev) =>
      prev === 0 ? imageArray.length - 1 : prev - 1
    );
  };

  const showNext = () => {
    setSelectedImage((prev) =>
      prev === imageArray.length - 1 ? 0 : prev + 1
    );
    setLightboxIndex((prev) =>
      prev === imageArray.length - 1 ? 0 : prev + 1
    );
  };

  if (imageArray.length === 0) {
    return (
      <div className="h-96 bg-gray-200 flex items-center justify-center">
        <p className="text-gray-500">No images available</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Main Image */}
      <div className="relative h-96 md:h-[500px] bg-gray-200 overflow-hidden">
        <img
          key={imageArray[selectedImage]}
          src={imageArray[selectedImage] || placeholderImage}
          alt={`Gallery image ${selectedImage + 1}`}
          className={`w-full h-full object-cover transition-opacity duration-500 ease-in-out ${
            isFading ? 'opacity-100' : 'opacity-0'
          } cursor-zoom-in`}
          onError={handleImageError}
          onClick={() => openLightbox(selectedImage)}
        />
        
        {/* Navigation Arrows */}
        {imageArray.length > 1 && (
          <>
            <button
              onClick={showPrevious}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 transition-all backdrop-blur-sm"
              aria-label="Previous image"
            >
              <svg
                className="w-6 h-6 text-gray-800"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <button
              onClick={showNext}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 transition-all backdrop-blur-sm"
              aria-label="Next image"
            >
              <svg
                className="w-6 h-6 text-gray-800"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </>
        )}

        {/* Image Counter */}
        {imageArray.length > 1 && (
          <div className="absolute bottom-4 right-4 bg-black bg-opacity-60 text-white px-3 py-1 rounded-full text-sm">
            {selectedImage + 1} / {imageArray.length}
          </div>
        )}
      </div>

      {/* Thumbnail Gallery */}
      {imageArray.length > 1 && (
        <div className="p-4 bg-gray-100">
          <div className="flex space-x-2 overflow-x-auto">
            {imageArray.map((image, index) => (
              <button
                key={index}
                onClick={() => {
                  setSelectedImage(index);
                  setLightboxIndex(index);
                }}
                className={`flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border-2 transition-all ${
                  selectedImage === index
                    ? 'border-primary-600 ring-2 ring-primary-300'
                    : 'border-transparent hover:border-gray-300'
                }`}
              >
                <img
                  src={image || placeholderImage}
                  alt={`Thumbnail ${index + 1}`}
                  className="w-full h-full object-cover"
                  onError={handleImageError}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          onClick={closeLightbox}
        >
          <div
            className="relative max-w-6xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 bg-white bg-opacity-90 hover:bg-opacity-100 text-gray-800 rounded-full p-2 transition-colors"
              aria-label="Close lightbox"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <img
              key={imageArray[lightboxIndex]}
              src={imageArray[lightboxIndex] || placeholderImage}
              alt={`Gallery image ${lightboxIndex + 1}`}
              className="w-full max-h-[80vh] object-contain rounded-lg shadow-2xl transition-opacity duration-500 ease-in-out"
              onError={handleImageError}
            />

            {imageArray.length > 1 && (
              <>
                <button
                  onClick={showPrevious}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 text-gray-800 rounded-full p-3 transition-all"
                  aria-label="Previous image"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <button
                  onClick={showNext}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 text-gray-800 rounded-full p-3 transition-all"
                  aria-label="Next image"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </>
            )}

            {imageArray.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-60 text-white px-4 py-2 rounded-full text-sm">
                {lightboxIndex + 1} / {imageArray.length}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageGallery;

