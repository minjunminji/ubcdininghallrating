// backend/test_scraper.js
import fetch from "node-fetch";

// Nutrislice base
const NS_BASE = "https://ubc.api.nutrislice.com/menu/api/weeks/school";

// Verified endpoints
const ENDPOINTS = {
  feast: {
    breakfast: {
      school: "ubc-feast-totem-park-residence",
      menuType: "feast-at-totem-park",
    },
    lunch: {
      school: "ubc-feast-totem-park-residence",
      menuType: "feast-totem-park-residence-lunch",
    },
    dinner: {
      school: "ubc-feast-totem-park-residence",
      menuType: "feast-totem-park-residence-lunch",
    },
  },
  gather: {
    breakfast: {
      school: "ubc-gather-place-vanier-residence",
      menuType: "gather-place-vanier-residence-breakfast",
    },
    lunch: {
      school: "ubc-gather-place-vanier-residence",
      menuType: "gather-place-vanier-residence-lunch",
    },
    dinner: {
      school: "ubc-gather-place-vanier-residence",
      menuType: "gather-place-vanier-residence-lunch",
    },
  },
  "open-kitchen": {
    breakfast: {
      school: "ubc-open-kitchen",
      menuType: "open-kitchen-orchard-commons-residence-breakfast",
    },
    lunch: {
      school: "ubc-open-kitchen",
      menuType: "open-kitchen-at-orchard-commons",
    },
    dinner: {
      school: "ubc-open-kitchen",
      menuType: "open-kitchen-at-orchard-commons",
    },
  },
};

const toPathDate = (iso) => {
  const [y, m, d] = iso.split("-");
  return `${y}/${m}/${d}`;
};

async function fetchMeal(hall, meal, date) {
  const { school, menuType } = ENDPOINTS[hall][meal];
  const url = `${NS_BASE}/${school}/menu-type/${menuType}/${toPathDate(date)}/`;
  console.log(`\n=== ${hall} ${meal} (${date}) ===`);
  console.log("URL:", url);

  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    console.error("Failed:", res.status, res.statusText);
    return;
  }
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2).slice(0, 2000) + "\n..."); // print first ~2KB
}

// run tests
const date = new Date().toISOString().slice(0, 10); // today
const halls = Object.keys(ENDPOINTS);
const meals = ["breakfast", "lunch", "dinner"];

for (const h of halls) {
  for (const m of meals) {
    await fetchMeal(h, m, date);
  }
}