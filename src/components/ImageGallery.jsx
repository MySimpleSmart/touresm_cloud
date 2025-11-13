import { useState, useMemo } from 'react';

const ImageGallery = ({ images }) => {
  const [selectedImage, setSelectedImage] = useState(0);

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
      <div className="relative h-96 md:h-[500px] bg-gray-200">
        <img
          src={imageArray[selectedImage] || placeholderImage}
          alt={`Gallery image ${selectedImage + 1}`}
          className="w-full h-full object-cover"
          onError={handleImageError}
        />
        
        {/* Navigation Arrows */}
        {imageArray.length > 1 && (
          <>
            <button
              onClick={() =>
                setSelectedImage(
                  selectedImage === 0 ? imageArray.length - 1 : selectedImage - 1
                )
              }
              className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 transition-all"
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
              onClick={() =>
                setSelectedImage(
                  selectedImage === imageArray.length - 1 ? 0 : selectedImage + 1
                )
              }
              className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 transition-all"
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
                onClick={() => setSelectedImage(index)}
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
    </div>
  );
};

export default ImageGallery;

