# 🚀 TonicWater.io Deployment Guide

## Current Status: NOT DEPLOYED ❌

Your project is ready to deploy but requires authentication and configuration.

---

## Option 1: Deploy to Cloudflare Pages (Recommended)

### Prerequisites:
- Cloudflare account (free tier available)
- GitHub repository (already set up ✅)

### Steps:

#### 1. **Authenticate with Cloudflare**
```bash
npx wrangler login
```
This will open a browser window to authenticate.

#### 2. **Create Cloudflare Pages Project**
```bash
npx wrangler pages project create tonicwater-io
```

#### 3. **Deploy to Production**
```bash
npm run deploy:production
```

Or manually:
```bash
npx wrangler pages deploy public --project-name=tonicwater-io --branch=main
```

#### 4. **Set Up Continuous Deployment**
- Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
- Navigate to **Workers & Pages** → **Create Application** → **Pages**
- Connect your GitHub repository: `ScaleLeanChris/Tonicwater_io`
- Configure build settings:
  - **Build command**: `npm run build` (or leave empty if using pre-built files)
  - **Build output directory**: `public`
  - **Root directory**: `/`
- Click **Save and Deploy**

#### 5. **Configure Environment Variables** (if needed)
In Cloudflare Dashboard → Your Project → Settings → Environment Variables:
- `OPENROUTER_API_KEY` - For SEO agent (if using)
- Any other API keys

---

## Option 2: Deploy to Vercel

### Steps:

#### 1. **Install Vercel CLI**
```bash
npm install -g vercel
```

#### 2. **Login to Vercel**
```bash
vercel login
```

#### 3. **Deploy**
```bash
vercel --prod
```

#### 4. **Configure Project**
- Framework Preset: **Other**
- Build Command: `npm run build` (or leave empty)
- Output Directory: `public`
- Install Command: `npm install`

---

## Option 3: Deploy to Netlify

### Steps:

#### 1. **Install Netlify CLI**
```bash
npm install -g netlify-cli
```

#### 2. **Login to Netlify**
```bash
netlify login
```

#### 3. **Deploy**
```bash
netlify deploy --prod --dir=public
```

---

## Quick Deploy Commands

### One-Time Manual Deploy (Cloudflare):
```bash
# 1. Login
npx wrangler login

# 2. Deploy
npx wrangler pages deploy public --project-name=tonicwater-io --branch=main
```

### Continuous Deployment (GitHub Actions):
The project already has CI/CD configured in `.github/workflows/ci.yml`.

**To enable automatic deployments:**
1. Add `CLOUDFLARE_API_TOKEN` to GitHub Secrets:
   - Go to GitHub repo → Settings → Secrets and variables → Actions
   - Click **New repository secret**
   - Name: `CLOUDFLARE_API_TOKEN`
   - Value: Get from [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
   
2. Add `CLOUDFLARE_ACCOUNT_ID` to GitHub Secrets:
   - Get from Cloudflare Dashboard → Workers & Pages → Overview (right sidebar)

3. Push to `main` branch - automatic deployment will trigger!

---

## Post-Deployment Checklist

After deploying, verify:

- [ ] Site is accessible at your Cloudflare Pages URL (e.g., `tonicwater-io.pages.dev`)
- [ ] All pages load correctly (home, articles, shop, cocktails)
- [ ] API endpoints work (`/api/gins`, `/api/cocktails`)
- [ ] Service worker registers (check DevTools → Application → Service Workers)
- [ ] PWA is installable (check for install prompt)
- [ ] Sitemap is accessible (`/sitemap.xml`)
- [ ] Robots.txt is accessible (`/robots.txt`)

---

## Custom Domain Setup (Optional)

### Add Custom Domain to Cloudflare Pages:
1. Go to Cloudflare Dashboard → Your Project → Custom domains
2. Click **Set up a custom domain**
3. Enter your domain (e.g., `tonicwater.io`)
4. Follow DNS configuration instructions
5. Wait for SSL certificate provisioning (automatic)

---

## Troubleshooting

### Issue: "You are not authenticated"
**Solution**: Run `npx wrangler login` and authenticate in browser

### Issue: "Project not found"
**Solution**: Create project first with `npx wrangler pages project create tonicwater-io`

### Issue: Build fails
**Solution**: Ensure all dependencies are installed with `npm install`

### Issue: API endpoints don't work
**Solution**: Cloudflare Pages Functions require files in `/functions` directory (already configured ✅)

---

## Monitoring Your Deployment

### Cloudflare Analytics:
- Go to Cloudflare Dashboard → Your Project → Analytics
- View real-time traffic, performance metrics, and errors

### GitHub Actions:
- Go to GitHub repo → Actions tab
- View build and deployment logs

---

## Need Help?

- **Cloudflare Pages Docs**: https://developers.cloudflare.com/pages/
- **Wrangler CLI Docs**: https://developers.cloudflare.com/workers/wrangler/
- **Project Issues**: https://github.com/ScaleLeanChris/Tonicwater_io/issues

---

## Quick Start (TL;DR)

```bash
# 1. Login to Cloudflare
npx wrangler login

# 2. Deploy
npm run deploy:production

# 3. Done! 🎉
```

Your site will be live at: `https://tonicwater-io.pages.dev`
