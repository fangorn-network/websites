# SOND3R — Landing Site

A minimal, component-based product landing page built with Vite + React.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL Vite prints (default http://localhost:5173).

## Build for production

```bash
npm run build      # outputs to dist/
npm run preview    # serve the built site locally
```

## Structure

```
index.html                  # entry HTML, mounts #root
src/
  main.jsx                  # React entry point
  App.jsx                   # composes the page sections
  styles.css                # ALL styling lives here (intentionally minimal)
  components/
    Hero.jsx
    DownloadButtons.jsx     # edit hrefs to point at real installers
    ProblemStatement.jsx
    ProductDescription.jsx
    Vision.jsx
    FAQ.jsx
    Footer.jsx
```

## Adding a component

1. Create `src/components/YourThing.jsx` with a default export.
2. Import it in `src/App.jsx` and place it in the layout.
3. Wrap content in `<section className="section">` to inherit spacing and the divider.

## Where to edit things

- **Copy / text** — directly in each component file.
- **Download links** — the `downloads` array in `src/components/DownloadButtons.jsx`.
- **FAQ entries** — the `faqs` array in `src/components/FAQ.jsx`.
- **Footer links** — `src/components/Footer.jsx`.

All copy is placeholder; swap it for your own.
