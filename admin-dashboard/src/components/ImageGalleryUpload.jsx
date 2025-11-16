import { useState, useRef } from 'react';
import { uploadMedia, deleteMedia } from '../services/api';

const extractImageId = (img) => {
  if (!img) return null;
  if (typeof img === 'number') return img;
  if (typeof img === 'string') return null;
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

const extractImageUrl = (img) => {
  if (!img) return null;
  if (typeof img === 'string') return img;
  if (typeof img === 'object') {
    return (
      img.url ||
      img.source_url ||
      img.image_url ||
      img.guid ||
      img.src ||
      (img.meta && (img.meta.url || img.meta.source_url)) ||
      null
    );
  }
  return null;
};

const ImageGalleryUpload = ({ images = [], onChange, maxImages = 20, listingId = null }) => {
  const [uploading, setUploading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const fileInputRef = useRef(null);

  // Normalize image data structure
  const normalizeImage = (img) => {
    if (!img) return null;
    const id = extractImageId(img);
    const url = extractImageUrl(img);
    return {
      id,
      url,
      source_url: url,
      uploading: typeof img === 'object' ? Boolean(img.uploading) : false,
      progress: typeof img === 'object' && typeof img.progress === 'number' ? img.progress : 0,
    };
  };

  const currentImages = (images || []).map(normalizeImage).filter(Boolean);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Check max images limit
    if (currentImages.length + files.length > maxImages) {
      alert(`Maximum ${maxImages} images allowed. Please remove some images first.`);
      return;
    }

    setUploading(true);
    const newImages = [...currentImages];
    const uploadPromises = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert(`${file.name} is not an image file.`);
        continue;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert(`${file.name} is too large. Maximum size is 10MB.`);
        continue;
      }

      // Create preview immediately
      const previewUrl = URL.createObjectURL(file);
      const tempId = `temp-${Date.now()}-${i}`;
      newImages.push({
        id: tempId,
        url: previewUrl,
        source_url: previewUrl,
        uploading: true,
        progress: 0,
      });
      onChange(newImages);

      const uploadPromise = uploadMedia(file, listingId, (evt) => {
        if (!evt || !evt.total) return;
        const percent = Math.min(100, Math.round((evt.loaded * 100) / evt.total));
        const idx = newImages.findIndex((img) => img.id === tempId);
        if (idx !== -1) {
          newImages[idx] = {
            ...newImages[idx],
            progress: percent,
          };
          onChange([...newImages]);
        }
      })
        .then((response) => {
          const index = newImages.findIndex((img) => img.id === tempId);
          if (index !== -1) {
            const imageId = response.id || response.ID;
            const imageUrl = response.source_url || response.guid?.rendered || response.url || response.link;
            newImages[index] = {
              id: imageId,
              url: imageUrl,
              source_url: imageUrl,
              uploading: false,
              progress: 100,
            };
            onChange([...newImages]);
          }
          // Clean up preview URL
          URL.revokeObjectURL(previewUrl);
        })
        .catch((error) => {
          console.error('Error uploading image:', error);
          // Remove failed upload
          const index = newImages.findIndex((img) => img.id === tempId);
          if (index !== -1) {
            newImages.splice(index, 1);
            onChange([...newImages]);
          }
          URL.revokeObjectURL(previewUrl);
          alert(`Failed to upload ${file.name}. Please try again.`);
        });

      uploadPromises.push(uploadPromise);
    }

    try {
      await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Error uploading images:', error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = async (index) => {
    const image = currentImages[index];
    if (!image) return;

    // If it's a temporary/preview image, just remove it
    if (image.id && image.id.toString().startsWith('temp-')) {
      const newImages = currentImages.filter((_, i) => i !== index);
      onChange(newImages);
      if (image.url && image.url.startsWith('blob:')) {
        URL.revokeObjectURL(image.url);
      }
      return;
    }

    // If it has an ID, try to delete from WordPress
    if (image.id && typeof image.id === 'number') {
      try {
        await deleteMedia(image.id);
      } catch (error) {
        console.error('Error deleting media:', error);
        // Continue to remove from local state even if delete fails
      }
    }

    // Remove from local state
    const newImages = currentImages.filter((_, i) => i !== index);
    onChange(newImages);
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const newImages = [...currentImages];
    const draggedImage = newImages[draggedIndex];
    newImages.splice(draggedIndex, 1);
    newImages.splice(dropIndex, 0, draggedImage);
    onChange(newImages);
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Gallery Images ({currentImages.length}/{maxImages})
        </label>
      </div>

      {/* Image Grid */}
      {currentImages.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {currentImages.map((image, index) => (
            <div
              key={image.id || index}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`relative group border-2 rounded-lg overflow-hidden cursor-move transition-all ${
                draggedIndex === index
                  ? 'opacity-50 border-primary-500'
                  : 'border-gray-200 hover:border-primary-300'
              } ${image.uploading ? 'opacity-60' : ''}`}
            >
              {/* Image */}
              <div className="aspect-square bg-gray-100 relative">
                {image.url ? (
                  <img
                    src={image.url}
                    alt={`Gallery ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2U1ZTdlYiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZTwvdGV4dD48L3N2Zz4=';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <svg
                      className="w-12 h-12"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                )}

                {/* Uploading Overlay */}
                {image.uploading && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="w-3/4">
                      <div className="text-white text-xs mb-1 text-center">
                        Uploading {Math.max(0, image.progress || 0)}%
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-primary-500 h-2 transition-all"
                          style={{ width: `${Math.max(0, image.progress || 0)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Remove Button */}
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  aria-label="Remove image"
                >
                  <svg
                    className="w-4 h-4"
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

                {/* Drag Handle */}
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg
                    className="w-4 h-4 inline-block mr-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 8h16M4 16h16"
                    />
                  </svg>
                  Drag to reorder
                </div>
              </div>

              {/* Image Index */}
              <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                {index + 1}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Button moved under grid */}
      <div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || currentImages.length >= maxImages}
          className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <svg
            className="w-6 h-6 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          <span className="text-gray-600">
            {uploading ? 'Uploading...' : 'Click to upload images'}
          </span>
        </button>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Help Text */}
      <p className="text-sm text-gray-500">
        You can upload up to {maxImages} images. Drag images to reorder them. The first image will be used as the featured image.
      </p>
    </div>
  );
};

export default ImageGalleryUpload;

