# AUREUS · 私人资产簿

Mobile-only personal ledger built with React + Vite. Cormorant Garamond and Inter are bundled locally. The app starts with an empty ledger; no sample amounts are loaded.

## Personal records

- Add, edit, or delete accounts. New accounts take a starting balance; editing an account sets its current balance while retaining existing transactions.
- Add income or expenses to an account on any date. Edits and deletions recalculate balances, daily heatmaps, and monthly reports. Account deletion asks for confirmation and removes its associated transactions.
- Estimates use **current balance + future income plans − future expense plans**. Already recorded income and expenses are included in the balance and never counted twice. Plans do not alter actual account balances.
- Set a personal goal; all displayed amounts and charts come from the ledger. No bank connection, automatic bank import, login, or cross-device synchronization is implemented.

## Storage and privacy

Records are saved under `aureus.ledger.v1` in the browser's localStorage. Personal records are never submitted to GitHub or any server. The published source code and website are public; each visitor's local records are independent. This is local storage, not encrypted storage or a cloud backup. Use a trusted device and the same browser/site origin.

Export a JSON backup before clearing website data, changing browsers/devices, or using private browsing. Import validates the backup before asking permission to replace the ledger. Invalid/corrupt backups leave current data unchanged. If saved data cannot be read, the app preserves its original bytes and displays a warning. If writing fails, a visible warning recommends exporting before leaving. A normal website update keeps the stable storage key and does not reset the ledger.

## Development

Node.js 24 and npm 11 were used for validation. Use the existing checkout.

```sh
npm ci
npm run dev -- --port 5173
```

```sh
npm test
npm run build
# Run while the dev server is active; Chromium must be available.
npm run test:smoke
```

`smoke.mjs` uses Chromium at `/usr/bin/chromium` (override with `CHROMIUM_PATH`). It exercises real forms, persistence across reload, arithmetic, cross-year calendar navigation, deletion confirmations and cascades, planned amounts, goals, JSON export/import, corrupt and unavailable storage, independent visitors, no off-origin requests, themes, and layouts from 320–430px. It saves screenshots under `/workspace/artifacts`. Unit tests cover money parsing, cent-accurate arithmetic, estimates, dates, and storage/backup validation.

## Deployment

`.github/workflows/pages.yml` tests, builds and deploys on pushes to `main`, or by manual dispatch. Set **Settings → Pages → Source → GitHub Actions** once. `vite.config.js` uses relative assets for project Pages. Subsequent changes must be committed and pushed to publish; local edits are never uploaded automatically. Build artifacts contain no personal records. Deployment completion must be checked in GitHub Actions; a successful push alone does not prove the website is updated.
