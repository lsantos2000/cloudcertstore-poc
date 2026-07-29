# Cloud Certification Store POC

A Cloudflare Pages storefront for **CloudCertificationStore.com**, generated from the paid catalog in `CloudCertificationStore.com_eBooks_v4.3_2026-07-13.docx`.

## Included

- 54 paid eBooks and bundles from the source catalog
- Provider and keyword filtering
- Responsive, SEO-oriented storefront
- Live product-link and book-cover resolution
- Cloudflare Pages Function that crawls the original catalog/product pages, extracts each cover, and caches the result
- Official certification links and retirement badges
- Cloudflare Pages deployment workflow

## How cover resolution works

The browser calls `/api/resolve` only when a card approaches the viewport. The Cloudflare Pages Function:

1. Uses the direct eBook URL when the source catalog contains one.
2. Otherwise crawls the original catalog pages and identifies the closest matching title/code.
3. Opens the matched eBook page.
4. Extracts the Open Graph or Payhip cover image.
5. Returns the exact product URL and cover URL.
6. Caches the response for 24 hours.

This avoids hard-coding stale cover URLs while ensuring the cover comes from the actual live eBook page.

## Local development

```bash
npm run dev
```

Open the local URL printed by Wrangler.

## Deploy from your workstation

```bash
npx wrangler@latest login
npx wrangler@latest pages project create cloudcertstore-poc --production-branch main
npm run deploy
```

## GitHub Actions deployment

Add these repository secrets:

- `CLOUDFLARE_API_TOKEN` — token with Cloudflare Pages edit permission
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID

Every push to `main` then deploys to Cloudflare Pages.

## Push to GitHub

```bash
git init
git add .
git commit -m "Create Cloud Certification Store storefront POC"
git branch -M main
git remote add origin https://github.com/lsantos2000/cloudcertstore-poc.git
git push -u origin main
```

## Important

The target GitHub repository must exist before the first push. Product availability, pricing, certification status, and provider exam objectives are time-sensitive and should be revalidated periodically.

## One-command Windows PowerShell deployment

The local `deploy-cloudflare.ps1` script reads Cloudflare credentials from `cloudflare-creds.txt`, creates or reuses the `cloudcertstore-poc` Pages project, and deploys the `public` directory from the `main` branch.

Create `cloudflare-creds.txt` beside the script:

```text
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ACCOUNT_ID=your_account_id
```

`CLOUDFLARE_ACCOUNT_ID` is optional when Wrangler can infer a single account from the token, but keeping it is recommended for reliable Pages automation and multi-account access.

Run it from PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\deploy-cloudflare.ps1
```

Both `deploy-cloudflare.ps1` and `cloudflare-creds.txt` are excluded by `.gitignore`. Commit only `deploy-cloudflare.example.ps1` and `cloudflare-creds.example.txt`.


## Static content pages

The Cloudflare Pages build includes clean, indexable individual pages:

- `/about/`
- `/contact/`
- `/our-brand/`
- `/testimonials/`
- `/faq/`
- `/affiliate-program/`
- `/terms-of-purchase/`
- `/refund-policy/`
- `/privacy-policy/`
- `/cookie-policy/`

All pages share the storefront header, expanded footer directory, trademark disclaimer, cookie notice, canonical metadata, Open Graph metadata, and sitemap entries.
