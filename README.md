# TheFilmLab

TheFilmLab is a modern image editing application built with React, Vite, Tailwind CSS, and Electron.
It supports both a browser-hosted web app and a native Windows desktop app with a production-ready build pipeline.

## Features

- Film-style image processing with RAW support via `libraw-wasm`
- Grain, curves, color presets, framing, and overlays
- Drag-and-drop image import using `react-dropzone`
- Web version optimized for single-file deployment
- Windows desktop app packaged with Electron and `electron-builder`
- Separate web and Electron build workflows

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Available Scripts

- `npm run dev` - Start the Vite development server
- `npm run preview` - Preview the production web build locally
- `npm run build:web` - Build the web app to `dist/web/`
- `npm run build:electron` - Build the Electron app assets
- `npm run build:all` - Build both web and Electron outputs
- `npm run electron:dev` - Build and launch the Electron desktop app for testing
- `npm run electron:preview` - Launch the Electron app from the production build
- `npm run dist:win` - Build a Windows installer and portable executable
- `npm run dist:portable` - Build a portable Windows executable only

## Development

1. Install dependencies:

```bash
npm install
```

2. Run the web app:

```bash
npm run dev
```

3. Open your browser to:

```text
http://localhost:5173
```

## Production Build

### Web Build

```bash
npm run build:web
```

The web build is emitted to `dist/web/` and is ready for static hosting.

### Electron Desktop Build

```bash
npm run dist:win
```

This produces a Windows installer and a portable executable in `dist/`.

## Project Structure

- `electron/`
  - `main.ts` — Electron main process
  - `preload.ts` — secure renderer preload script
- `src/`
  - `App.tsx` — main application component
  - `App.layout.tsx` — layout and desktop download banner logic
  - `filmProcessor.ts` — film processing and filter logic
  - `grainEngine.ts` — film grain generation
  - `components/` — UI components such as `DesktopDownloadBanner`
  - `frames/`, `overlays/`, `utils/` — image resources and helpers
- `scripts/` — production setup utilities
- `.github/workflows/` — CI/CD workflows for web deployment and releases

## Release Workflow

1. Update `package.json` version.
2. Commit changes.
3. Create an annotated Git tag:

```bash
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin main --tags
```

4. GitHub Actions will build the Electron app and create release artifacts.

## Notes

- The app is configured for Windows desktop builds using `electron-builder`.
- Electron builds require a Windows environment for `dist:win`.
- The web app is designed for static hosting and can be deployed as a single-file bundle.

## License

MIT
