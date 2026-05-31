# Chhaon Stays

Marketing site for Chhaon Stays — a React single-page app built with [Vite](https://vite.dev/).

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer (20+ recommended)
- npm (comes with Node) or pnpm

## Getting started

1. **Clone and enter the project** (if you have not already):

   ```bash
   cd chhaon-stays
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Start the development server**:

   ```bash
   npm run dev
   ```

   Or use the `start` alias:

   ```bash
   npm start
   ```

4. **Open the app** in your browser at the URL shown in the terminal (usually [http://localhost:5173](http://localhost:5173)).

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` / `npm start` | Start Vite dev server with hot reload |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |

## Troubleshooting

If `npm run dev` fails with a missing Vite module error, reinstall dependencies:

```bash
rm -rf node_modules
npm install
npm run dev
```

## Tech stack

- React 19
- Vite 8
- [Lucide React](https://lucide.dev/) icons
