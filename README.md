# TSHK Web App

## Files
- index.html
- style.css
- script.js
- Code.gs

## Setup

1. Create a GitHub repository.
2. Upload `index.html`, `style.css`, `script.js`, and the `assets` folder.
3. Put logos here:
   - assets/trsh.png
   - assets/msri.png

## Google Sheet

Create a Google Sheet with these sheet tabs:

- Writers
- Marksheet
- Sessions
- AuditLog

Each sheet must have the header columns from `columns_to_create.txt`.

## Apps Script

1. Open the Google Sheet.
2. Extensions → Apps Script.
3. Paste `Code.gs`.
4. Change:
   - `ADMIN_PASSWORD`
   - `MARKER_PASSWORD`
5. Deploy → New deployment → Web app.
6. Execute as: Me
7. Who has access: Anyone
8. Copy the Web App URL.
9. Paste it into `script.js` here:

```js
const API_URL = "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE";
```

## GitHub Pages

Settings → Pages → Deploy from branch → main → root.
