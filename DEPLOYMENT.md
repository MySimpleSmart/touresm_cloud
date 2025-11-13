# Deployment Guide

## Build Output

The production build is located in the `dist/` folder. This folder contains all the files needed for deployment.

## Deployment Steps

1. **Build the project** (if not already built):
   ```bash
   npm run build
   ```

2. **Upload the `dist/` folder contents** to your web server at `https://app.touresm.cloud/`

3. **Configure your web server** to serve the `index.html` file for all routes (required for React Router).

### Apache Configuration

If using Apache, the `.htaccess` file in the `public/` folder will be copied to `dist/` during build. Make sure your Apache server has `mod_rewrite` enabled.

### Nginx Configuration

If using Nginx, add this to your server configuration:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

### Netlify/Vercel

For platforms like Netlify or Vercel, create a `_redirects` file (Netlify) or `vercel.json` (Vercel) in the `public/` folder:

**Netlify `_redirects`:**
```
/*    /index.html   200
```

**Vercel `vercel.json`:**
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

## File Structure

```
dist/
  ├── index.html          # Main HTML file
  ├── assets/
  │   ├── index-*.css    # Compiled CSS
  │   └── index-*.js     # Compiled JavaScript
  └── vite.svg           # Favicon
```

## Environment Variables

The app is configured to connect to:
- API Base URL: `https://touresm.cloud/wp-json/wp/v2`

If you need to change this, update `src/services/api.js` and rebuild.

