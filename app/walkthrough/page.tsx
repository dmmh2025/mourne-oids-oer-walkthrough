"use client";

import * as React from "react";
import { createClient } from "@supabase/supabase-js";

// ---- Supabase client ----
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnon);

// ---- Sections (TOTAL = 75) ----
type Item = { key: string; label: string };
type Section = { key: string; title: string; max: number; items: Item[] };

const SECTIONS: Section[] = [
  {
    key: "temperature_records",
    title: "Temperature Records",
    max: 6,
    items: [
      { key: "complete_pre_open", label: "Complete and upload PRE-OPEN" },
      { key: "cooking_temps", label: "Cooking temperatures recorded & in range" },
    ],
  },
  {
    key: "shelf_life",
    title: "Shelf Life",
    max: 3,
    items: [{ key: "dated_within_shelf", label: "All products (incl. staff food) dated and within shelf life" }],
  },
  {
    key: "hand_washing",
    title: "Hand Washing",
    max: 3,
    items: [{ key: "sinks_stocked_20s", label: "All sinks stocked with soap & hand towels; washing 20s" }],
  },
  {
    key: "sanitation",
    title: "Sanitation",
    max: 4,
    items: [
      { key: "surfaces_2h", label: "Food surfaces/utensils sanitised every 2h (clock running)" },
      { key: "can_opener", label: "Can opener clean, rust-free, no flaking paint; clean after use" },
      { key: "smallwares_clean", label: "Bubble popper/shakers/squeeze bottles/keyboards clean for open" },
      { key: "sink_concentration", label: "Sanitiser sink correct concentration, checked with strip" },
      { key: "bottles_filled", label: "Fresh sanitiser bottles filled each morning" },
      { key: "spray_only_prep", label: "Sanitiser spray is the only chemical allowed in food prep" },
      { key: "tubs_changed", label: "Dip tubs/silicon/foil/squeeze bottles/gluten kit changed daily" },
      { key: "nothing_on_floor", label: "Nothing stored on dough trays or directly on floor" },
    ],
  },
  {
    key: "great_remake",
    title: "Great/Remake Criteria (scored in Product Section)",
    max: 22,
    items: [
      { key: "no_day1_dough", label: "NO DAY 1 Dough in use — SWAP with other stores" },
      { key: "bubble_popper_use", label: "Use bubble popper when needed; clean after every use" },
      { key: "no_sauce_cheese_crust", label: "No sauce or cheese on the crust" },
      { key: "breaded_sides", label: "Breaded sides cooked correctly (time/temp/quality)" },
      { key: "five_star_follow", label: "5★ Pizzas — follow Sell/Remake criteria (RIM / SIZE / PORTION / PLACEMENT / BAKE)" },
    ],
  },
  {
    key: "dough",
    title: "Dough",
    max: 5,
    items: [
      { key: "mixed_trays_out", label: "Mixed trays dated; all sizes out at all times, incl. VEGAN" },
      { key: "covered_clean_tray", label: "All dough covered with a clean/sanitised tray" },
      { key: "discard_blown", label: "Discard blown dough immediately and replace" },
      { key: "plan_created", label: "Dough plan created for day and used" },
    ],
  },
  {
    key: "approved_product",
    title: "Approved Product & Procedures",
    max: 7,
    items: [
      { key: "bins_max_2h", label: "Makeline bins MAXIMUM 2 hours of product (1.5 full or less)" },
      { key: "gf_kit_black_bottom", label: "GF kit set up; toppings in black tubs on bottom row of makeline" },
      { key: "no_out_of_products", label: "No out-of-products anywhere — no stickers/bars allowed" },
      { key: "allergen_poster", label: "Allergen poster (QR version) displayed; leaflets available" },
      { key: "plant_based_order", label: "Plant-based procedures followed (PB cheese not over first catch tray)" },
      { key: "separate_scrapers", label: "Separate scrapers for veg/meat doughballs (red/white or green) used" },
      { key: "back_door_closed", label: "Back door securely closed at ALL TIMES" },
      { key: "pest_control", label: "Pest control: checks complete, traps in place, no activity" },
    ],
  },
  {
    key: "uniform_grooming",
    title: "Uniform & Brand Standards",
    max: 5,
    items: [
      { key: "black_trousers", label: "Jet black trousers/jeans — no leggings/joggers/combat" },
      { key: "plain_undershirt", label: "Plain white/black undershirts; no visible writing/logos" },
      { key: "no_jumpers", label: "No jumpers/hoodies/jackets under Domino’s jacket" },
      { key: "clean_shaven", label: "Clean shaven or beard with clean lines" },
      { key: "no_piercings", label: "No visible piercings of any kind (not covered with plasters)" },
      { key: "drivers_vehicle", label: "Drivers vehicle clean/road-legal (lights/plates/insurance)" },
    ],
  },
  {
    key: "store_interior",
    title: "Store Interior / Customer View",
    max: 6,
    items: [
      { key: "toilets_lined_bin", label: "ALL toilets MUST have a lined bin with lid" },
      { key: "customer_view_clean", label: "Everything in customer view clean and tidy" },
      { key: "no_staff_food_view", label: "No staff food/drink in customer view (cut table/hot rack/driver table)" },
      { key: "bins_lids_clean", label: "All bins in customer view have lids and are clean" },
    ],
  },
  {
    key: "outside_entry",
    title: "Outside Entry",
    max: 2,
    items: [{ key: "no_branded_rubbish", label: "No branded rubbish front/rear; refuse bins not overflowing" }],
  },
  {
    key: "baking_equipment",
    title: "Baking Equipment",
    max: 2,
    items: [
      { key: "oven_clean", label: "Oven clean (not yellowing) — hood/filters/belt/frame" },
      { key: "screens_pans_clean", label: "Screens & pans clean, good repair, no carbon build-up" },
      { key: "wedge_gpb_clean", label: "Wedge & GPB pans cleaned daily and dried through oven pre-open" },
    ],
  },
  {
    key: "hotbags",
    title: "Hotbags",
    max: 1,
    items: [{ key: "brushed_clean_no_rips", label: "Brushed out, clean patches, no rips (isolate if damaged)" }],
  },
  {
    key: "walk_in_cooler",
    title: "Walk-in Cooler",
    max: 1,
    items: [
      { key: "surfaces_clean", label: "Fan/floor/ceiling/walls & shelving clean (no mould/debris/rust)" },
      { key: "door_seal_handle", label: "Door seal good and handle clean — no food debris" },
    ],
  },
  {
    key: "makeline",
    title: "Makeline",
    max: 1,
    items: [
      { key: "fixtures_clean", label: "Cupboards/doors/handles/shelves/seals/lids clean & in good condition" },
      { key: "catch_trays_good", label: "Catch trays/grills/seals in good condition — no splits/tears/missing rails" },
    ],
  },
  {
    key: "safety_security",
    title: "Safety & Security",
    max: 6,
    items: [
      { key: "drivers_drop_cash", label: "Drivers dropping cash (if applicable)" },
      { key: "safe_utilised", label: "Safe utilised, secure & working — time-delay in use, not on day lock" },
      { key: "front_till_locked", label: "Front till locked; no key left at counter — ≤ £100 total" },
    ],
  },
  {
    key: "prp",
    title: "PRP",
    max: 1,
    items: [
      { key: "prep_sheet_printed", label: "Prep sheet printed and used for FULL DAY’S TRADE" },
      { key: "all_items_available", label: "ALL ITEMS AVAILABLE (source pre-open if NO)" },
    ],
  },
];

// ---- Service scoring ----
function scoreADT(n: number | null) {
  if (n == null || Number.isNaN(n)) return null;
  if (n > 30) return 0;
  if (n > 28) return 4;
  if (n > 27) return 6;
  if (n > 26) return 8;
  if (n > 25) return 10;
  return 15;
}
function scoreSBR(n: number | null) {
  if (n == null || Number.isNaN(n)) return null;
  if (n < 50) return 0;
  if (n < 70) return 3;
  if (n < 75) return 4;
  return 5;
}
function scoreExtremes(n: number | null) {
  if (n == null || Number.isNaN(n)) return null;
  if (n > 30) return 0;
  if (n > 25) return 2;
  if (n > 20) return 3;
  if (n > 15) return 4;
  return 5;
}

// ---- Stars from predicted % ----
function starsForPercent(p: number) {
  if (p >= 90) return 5;
  if (p >= 80) return 4;
  if (p >= 70) return 3;
  if (p >= 60) return 2;
  if (p >= 50) return 1;
  return 0;
}

export default function WalkthroughPage() {
  const [store, setStore] = React.useState("");
  const [userName, setUserName] = React.useState("");
  const stores = ["Downpatrick", "Kilkeel", "Newcastle"];
  const [adt, setAdt] = React.useState<string | number>("");
  const [extPerThousand, setExtPerThousand] = React.useState<string | number>("");
  const [sbr, setSbr] = React.useState<string | number>("");

  const [msg, setMsg] = React.useState<string | null>(null);

  const walkthroughScore = 0; // placeholder, logic continues later

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
      {/* Banner with Domino's blue border */}
      <div
        style={{
          borderBottom: "4px solid #006491",
          marginBottom: "16px",
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        <img
          src="/mourneoids_forms_header_1600x400.png"
          alt="Mourne-oids Header Banner"
          style={{
            width: "100%",
            maxHeight: "200px",
            objectFit: "cover",
            display: "block",
          }}
        />
      </div>

      {/* Page title */}
      <header style={{ marginBottom: 8 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Daily OER Walkthrough</h1>
        <p style={{ margin: "6px 0 0 0", color: "#475569" }}>
          Tick each checklist and add your ADT / SBR / Extremes to auto-calculate Service points.
        </p>
      </header>

      {/* -- remainder of your walkthrough form continues below this point -- */}
      {/* keep all logic, scoring, and Supabase submit sections exactly as in your previous version */}
    </main>
  );
}
