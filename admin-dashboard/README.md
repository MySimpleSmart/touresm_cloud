# Touresm Admin Dashboard

A React-based admin dashboard for managing Touresm listings and bookings.

## Features

- **Authentication**: WordPress REST API authentication
- **Listing Management**: Create, edit, and delete property listings
- **Booking Calendar**: View and manage house availability and bookings
- **Dashboard**: Overview statistics and quick actions

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The admin dashboard will be available at `http://localhost:3001`

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Configuration

The admin dashboard connects to the WordPress REST API at `https://touresm.cloud/wp-json/wp/v2`.

Make sure your WordPress site has:
- REST API enabled
- Proper authentication configured
- Custom post types registered (`touresm-listing`, `house`, `house_booking`)

## Deployment

To deploy to `admin.touresm.cloud`:

1. Build the project: `npm run build`
2. Upload the `dist` folder to your web server
3. Configure your web server to serve the admin dashboard at `admin.touresm.cloud`
4. Ensure proper routing is configured (all routes should serve `index.html` for client-side routing)

## Project Structure

```
admin-dashboard/
├── src/
│   ├── components/     # Reusable components
│   ├── pages/          # Page components
│   ├── services/       # API services
│   ├── utils/          # Utility functions
│   ├── App.jsx         # Main app component
│   └── main.jsx        # Entry point
├── public/             # Static assets
└── package.json
```

## Features in Detail

### Listing Management
- View all listings in a grid layout
- Create new listings with full form
- Edit existing listings
- Delete listings
- Manage listing details: name, description, price, categories, amenities, etc.

### Booking Calendar
- View calendar for each house
- See available, unavailable, and booked dates
- Filter by date range, house size, and search
- View recent bookings for each house

### Dashboard
- Statistics overview
- Quick action buttons
- Links to main sections

## Authentication

The dashboard uses WordPress REST API authentication. Users need valid WordPress credentials to access the admin panel.

## API Endpoints Used

- `GET /wp/v2/touresm-listing` - Get listings
- `POST /wp/v2/touresm-listing` - Create listing
- `POST /wp/v2/touresm-listing/{id}` - Update listing
- `DELETE /wp/v2/touresm-listing/{id}` - Delete listing
- `GET /wp/v2/house` - Get houses
- `GET /wp/v2/house_booking` - Get bookings

## Notes

- The admin dashboard is a separate React app from the main listing frontend
- It uses the same Tailwind CSS configuration for consistency
- All API calls are made to the WordPress REST API

