# Touresm Listing Rental Front-End App

A modern React application for displaying rental listings, built with React, Vite, and Tailwind CSS.

## Features

- **Listing Grid View**: Browse all available listings in a responsive grid layout
- **Listing Detail View**: View detailed information about each listing
- **Search & Filters**: Search by name, filter by category, location, and price range
- **Image Gallery**: Interactive image gallery with thumbnail navigation
- **Responsive Design**: Fully responsive design that works on all devices
- **WordPress REST API Integration**: Connects to your WordPress backend at touresm.cloud

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

## API Configuration

The app is configured to connect to your WordPress REST API at:
- Base URL: `https://touresm.cloud/wp-json/wp/v2`
- Listings Endpoint: `/touresm-listing`
- Taxonomies:
  - `/listing_category`
  - `/listing_location`
  - `/listing_aminities`

## Project Structure

```
src/
  ├── components/
  │   ├── Header.jsx          # Navigation header
  │   ├── ListingList.jsx     # Main listings page with filters
  │   ├── ListingCard.jsx     # Individual listing card component
  │   ├── ListingDetail.jsx   # Detailed listing view
  │   ├── SearchFilters.jsx   # Search and filter controls
  │   └── ImageGallery.jsx    # Image gallery with navigation
  ├── services/
  │   └── api.js              # WordPress REST API service
  ├── App.jsx                 # Main app component with routing
  ├── main.jsx                # Application entry point
  └── index.css               # Tailwind CSS imports
```

## Technologies Used

- React 18
- React Router DOM
- Vite
- Tailwind CSS
- Axios

