# Guttersville Records Press Kit

Single-page press kit builder for Guttersville Records. Everything runs in the browser; the only backend is an optional serverless email sender that stays disabled until credentials are added.

## What's included

- `index.html` – markup entry point with inline script/style references
- `styles.css` – monochrome layout, buttons, preview panels, and responsive rules
- `app.js` – form state, validation, preview rendering, PDF export, clipboard helper, and the email feature flag
- Inline logo data URL – embedded directly in the HTML/JS so no binary assets are required
- `netlify/functions/sendEmail.js` – Netlify-compatible handler that shells to the shared mailer
- `api/send-email.js` – Vercel-compatible wrapper around the same mailer logic
- `serverless/send-email-core.js` – Resend API helper used by both platforms

## Run it locally

Open `index.html` directly in a browser or serve the folder with any static server. One option:

```bash
python -m http.server 4173
```

Visit [http://localhost:4173/index.html](http://localhost:4173/index.html) and edit the form. Autosave keeps progress in `localStorage` so a refresh restores your data.

## Push to GitHub

```bash
git status            # review changes
git add <paths>       # stage files (use . to stage everything)
git commit -m "..."   # describe the update
git remote add origin https://github.com/<user>/<repo>.git  # first push only
git push -u origin main
```

Replace `<user>/<repo>` with your GitHub path and adjust the branch name if you use something other than `main`.

## Deploy on Netlify

1. Log in to [Netlify](https://netlify.com) → **Add new site → Import an existing project**.
2. Pick the GitHub repository/branch you just pushed.
3. Leave **Build command** empty and set **Publish directory** to `.`.
4. Deploy. Netlify will serve the HTML/CSS/JS as-is and redeploy automatically on every push.

### Optional: prepare email sending

The UI currently shows “Email coming soon.” When you're ready to enable it:

1. In Netlify, add environment variables `RESEND_API_KEY` and `RESEND_FROM_ADDRESS` under **Site settings → Environment variables**.
2. Flip `EMAIL_FEATURE_ENABLED` to `true` near the top of `app.js`.
3. Redeploy. The button will then call `/.netlify/functions/sendEmail` with the generated PDF attached.

The same mailer works on Vercel via `api/send-email.js` if you prefer that platform.
