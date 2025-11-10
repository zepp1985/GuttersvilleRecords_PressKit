# Guttersville Records Press Kit

A static, one-page press kit generator with live preview, client-side PDF export, and optional email delivery.

## Features

- Monochrome Guttersville Records brand with responsive layout (max width 760px)
- Live preview that paginates content to match the generated PDF
- Client-side PDF builder with embedded images and working hyperlinks
- Download, email, and copy share-blurb actions
- Query-string deep links for prefilling the form (e.g. `?artistName=...&streamingUrl=...`)
- Works offline after first load (email send requires connectivity)

## Project structure

```
index.html        # Entry point with markup and script/style includes
styles.css        # Monochrome layout styling
app.js            # Form logic, preview rendering, PDF generation, email flow
assets/logo.svg   # Default Guttersville Records logo
netlify/functions/sendEmail.js   # Netlify-compatible email sender
api/send-email.js                # Vercel-compatible email sender
serverless/send-email-core.js    # Shared mailer implementation
test-assets/      # Sample logo + two press photos for testing
```

## Local development

This site uses vanilla HTML/CSS/JS. You can open `index.html` directly in your browser or run a simple static server:

```bash
python -m http.server 4173
```

Then visit [http://localhost:4173/index.html](http://localhost:4173/index.html).

## PDF export

PDFs are generated in-browser without external services:

- The on-screen preview is rasterised into high-resolution JPEGs
- A minimal PDF writer stitches those images into US Letter or A4 pages
- Link buttons create clickable annotations inside the PDF
- Images are embedded as data URLs (local uploads stay in-browser)

The resulting file name follows `guttersville-press-kit-<artist-slug>.pdf`.

## Email delivery

A single serverless function sends email with the generated PDF attached. It targets the [Resend](https://resend.com/) API but can be adapted easily.

### Environment variables

| Name | Description |
| ---- | ----------- |
| `RESEND_API_KEY` | Resend API key with email send permission |
| `RESEND_FROM_ADDRESS` | Verified sender email (e.g. `press@guttersville.com`) |

### Netlify setup

1. Deploy the repository to Netlify (drag-and-drop or Git integration).
2. Set the build command to `npm run build` (not required) and the publish directory to the repo root.
3. Add the environment variables above under **Site settings → Environment variables**.
4. The email endpoint is available at `/.netlify/functions/sendEmail`.

### Vercel setup

1. Import the project in Vercel and choose **Other** as the framework.
2. Leave the build command empty and set the output directory to `.` (root).
3. Add the environment variables in **Settings → Environment Variables**.
4. The email endpoint is exposed at `/api/send-email`.

### Local testing of the email function

Netlify:

```bash
netlify dev
```

Vercel:

```bash
vercel dev
```

In both cases, ensure the environment variables are configured locally (Netlify `.env`, Vercel `.env.local`).

## Deep link format

To prefill form values, append query parameters to the page URL. Examples:

```
?artistName=Skyline+Echoes&genre=Dreamwave&streamingUrl=https://open.spotify.com/...&socialLinks=https://instagram.com/skyline
```

`socialLinks` accepts multiple entries by repeating the parameter. Remote image URLs can be provided via `pressPhotoUrl`, `secondaryImageUrl`, and `logoUrl`.

## Accessibility and keyboard support

- Semantic form labels, focus outlines, and high contrast buttons
- Modal traps focus while open and can be closed with Escape
- Toasts announce status changes through `aria-live`

## Troubleshooting

- **Image unavailable**: When a remote image blocks CORS or returns 404, upload a local alternative. The preview shows a placeholder message.
- **Email send failure**: Errors returned from Resend are surfaced in the toast. Double-check API key, sender address, and recipient domain policies.
- **PDF generation issues**: Try simplifying the bio or images. If the browser console reports an error, refresh and retry. The layout is locked to match the preview.
