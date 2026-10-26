# AUREUS · 私人资产簿

Mobile-only, single-column visual prototype (no desktop sidebar): overview, transaction calendar, and available-funds estimate. React + Vite, bundled Cormorant Garamond and Inter fonts. No external font requests or backend required. All financial records are illustrative; added accounts last for the current session only.

## Development

Node.js 24 and npm 11 were used for validation.

```sh
npm ci
npm run dev -- --port 5173
```

```sh
npm run build
node smoke.mjs
```

The smoke check expects the development server on port 5173 and Chromium at `/usr/bin/chromium`. It saves desktop/mobile screenshots under `/workspace/artifacts` and checks page navigation, date details, collapsible estimates, account creation, theme switching, mobile overflow, and browser errors.

Theme follows system preferences; the header control cycles light → dark → system. Reduced-motion preferences disable animations. Touch swipe reveals account deletion. Remaining pages and real data integration are intentionally pending visual approval.

## GitHub Pages deployment

The deployment workflow is prepared in `.github/workflows/pages.yml`. Nothing is uploaded by editing local files. After approval, commit and push this project to `AnthonyKhoo24/Testing-Apps`, and select **GitHub Actions** under the repository's **Settings → Pages → Build and deployment → Source**. Each subsequent push to `main` then rebuilds and publishes the demo. A manual workflow run is also supported. The site is public and uses illustrative data; it has no authentication, server database, or cross-device sync. A website address is usable only after GitHub reports successful deployment and its HTTP response has been verified.
