# Dining Hall Rating

Dining Hall Rating surfaces UBC residence dining hall menus and crowd-sourced meal feedback. Students can browse what is being served today, compare halls at a glance, drill down to station-level dishes, and submit 1–5 star ratings that feed back into Supabase in real time.

## Features
- Meal-first navigation with hall drill-down and colour-coded rating states for quick scanning.
- Dish view groups menu variations, collapses boilerplate listings, and highlights the weighted average rating per recipe.
- Rating workflow with cached fetches, optimistic updates, and a reusable `StarRating` component for 1–5 star input.
- Express API (`backend/server.js`) that aggregates ratings, exposes dish-level data, and writes new feedback into Supabase.
- Supabase Edge Function (`supabase/functions/smooth-action`) and Node-based scraper utilities that import Nutrislice menu data into the `dishes` and `offers` tables.
- Lightweight client-side fetch cache (`src/lib/fetchCache.js`) that prefetches the next page to keep navigation snappy.

## Tech Stack
- React 19 + Vite 7 with React Router for the SPA shell.
- Styled Components for the interactive star widget.
- Express 5 with CORS + Supabase JS client for the backend API.
- Supabase (Postgres + Edge Functions) as the data store for menus and ratings.
- Nutrislice JSON feeds as the upstream menu source.

## Project Layout
```
diningHallRating/
├── src/                    # React app (pages, components, styling, helpers)
│   ├── pages/              # Home, Halls, Dishes, Rate views
│   ├── components/         # Layout shell, StarRating, etc.
│   └── lib/fetchCache.js   # Simple TTL cache for fetch calls
├── backend/                # Express API + Supabase + scraping utilities
│   ├── server.js           # REST API used by the front-end
│   ├── scraper/            # Nutrislice scraping helpers
│   └── debug_*.js          # Supabase debugging helpers
├── supabase/functions/     # Edge Function to sync Nutrislice → Supabase
│   └── smooth-action/      # Deployable function entry point
├── public/ & index.html    # Vite static assets
└── package.json            # Scripts and dependencies
```

## Prerequisites
- Node.js 20 LTS or later (ensures compatibility with Vite 7 & Express 5).
- A Supabase project with service role access.
- Tables named `dishes`, `offers`, and `ratings` (see below for required columns).
- (Optional) Supabase CLI if you plan to deploy/serve the Edge Function locally.

## Environment Variables
Create a `.env` file in the project root before starting either server:
```
SUPABASE_URL=<https://your-project.supabase.co>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
PORT=4000                 # optional, defaults to 4000
```
The service role key is required because the backend inserts ratings and the ingestion tools upsert menu data. Keep this key private and do not expose it to the browser.

## Database Expectations
The backend touches a minimal set of columns. Your Supabase tables should, at a minimum, look like the following (additional columns/constraints are fine):

- `dishes`: `id` (PK, matches Nutrislice dish id), `name_raw` (text, original dish name). The UI also reads `name`, `title`, or `display_name` if present.
- `offers`: `id` (PK), `dish_id` (FK → dishes.id), `hall` (text: `feast`, `gather`, `open-kitchen`), `station` (text), `meal` (text: `breakfast`, `lunch`, `dinner`), `offer_date` (date).
- `ratings`: `id` (PK), `dish_id` (FK → dishes.id), `meal` (text), `offer_date` (date), `rating` (numeric 1–5), `created_at` (timestamp default now()).

Adding indexes on `(hall, meal, offer_date)` for `offers` and `(dish_id, meal, offer_date)` for `ratings` keeps the API fast.

## Installing Dependencies
```bash
npm install
```

## Running the Stack Locally
1. Ensure the Supabase credentials in `.env` point to a project with the tables above.
2. Start the Express API (runs on `http://localhost:4000` by default):
   ```bash
   npm run start:backend
   ```
3. In another terminal, launch the Vite dev server (defaults to `http://localhost:5173`):
   ```bash
   npm run dev
   ```
4. Visit the Vite URL. The front-end calls the backend at `http://localhost:4000`, so keep the API running in the background.

### Useful Scripts
- `npm run build` – Type-check (via `tsc`) and build the production bundle.
- `npm run lint` – Run ESLint across the project.
- `npm run preview` – Preview the Vite production build after running `npm run build`.

## REST API
All routes are served by `backend/server.js`.

- `GET /api/halls?meal=lunch&date=YYYY-MM-DD`
  - Returns an array of `{ hall, avg, rating_count }` for the requested meal/date.
  - `date` defaults to today (local ISO).
- `GET /api/dishes?hall=feast&meal=dinner&date=YYYY-MM-DD`
  - Returns a list of stations, each with dishes and their aggregated `avg_rating` + `num_ratings`.
- `POST /api/rate`
  - Body: `{ dish_id: number, meal: 'lunch', offer_date: 'YYYY-MM-DD', rating: 1-5 }`.
  - Inserts a new row into `ratings` and echoes `{ success: true }` on success.

All endpoints rely on the Supabase credentials in `.env`. If those variables are missing, the API responds with HTTP 500.

## Menu Ingestion Workflows
There are two supported ways to populate the `dishes` and `offers` tables from Nutrislice:

1. **Supabase Edge Function (`smooth-action`)**  
   Deploy with the Supabase CLI:
   ```bash
   supabase functions deploy smooth-action
   ```
   Then call it with an authenticated request (Scheduler adds the header automatically):
   ```bash
   curl \
     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
     -d '{"hall":"feast","meal":"lunch","date":"2025-01-15"}' \
     https://<your-project>.functions.supabase.co/smooth-action
   ```
   The function scrapes the Nutrislice JSON feed, upserts dishes, and inserts any new offers for the requested hall/meal/date.

2. **Node scraper utilities (`backend/scraper/`)**  
   These scripts expose similar logic for local debugging or one-off imports. Example:
   ```bash
   node backend/test_scraper.js
   ```
   Edit `backend/scraper/scraper.js` to run custom ingestion flows or seed historical data.

## Front-End Notes
- API URLs are currently hard-coded to `http://localhost:4000`. If you deploy the backend elsewhere, update the fetch calls (e.g., via an environment-driven base URL).
- `src/lib/fetchCache.js` adds a small TTL cache to reduce flicker between pages; tweak the TTL or strategy if you integrate a real caching layer.
- The `.tsx` components are legacy stubs kept for reference—the production app renders from the `.jsx` counterparts referenced in `src/main.jsx`.

## Contributing
Feel free to open issues or PRs with improvements. Please run `npm run lint` and keep Supabase credentials out of version control before submitting.
