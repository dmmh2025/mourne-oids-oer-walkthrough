"use client";

import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type CheckItem = {
  label: string;
  weight: number;
  done: boolean;
  photos?: string[];
  tips?: string[];
};

type Section = {
  title: string;
  points: number;
  allOrNothing?: boolean;
  items: CheckItem[];
};

const SECTIONS_BASE: Section[] = [
  {
    title: "Food Safety",
    points: 18,
    items: [
      { label: "Temps entered on time and within range", weight: 3, done: false },
      {
        label: "Products within shelf life – including ambient products, dips & drinks",
        weight: 3,
        done: false,
      },
      { label: "Proper handwashing procedures – 20 seconds", weight: 3, done: false },
      {
        label: "Sanitation procedures followed",
        weight: 3,
        done: false,
        tips: [
          "Timer running",
          "Sanitiser sink correct concentration",
          "All bottle lids changed daily",
          "Can opener clean, rust free with no signs of food debris",
          "Sanitiser bottles filled and available",
          "All touch points clean – bubblepopper, sauce bottles, shakers, keyboards",
          "Sanitiser spray the only chemical in the kitchen area",
          "All dishes clean",
          "Mop bucket and sink clean",
          "Bins clean and free from sauce stains",
        ],
      },
      { label: "Proper cooking temp of food", weight: 3, done: false },
      { label: "4–6 week pest control service in place", weight: 3, done: false },
    ],
  },
  {
    title: "Product",
    points: 12,
    items: [
      {
        label: "Dough properly managed",
        weight: 5,
        done: false,
        tips: [
          "All sizes available at stretch table and in good condition",
          "Dough plan created and followed",
          "No blown dough",
          "No aired dough",
          "No dough past day 6",
        ],
      },
      {
        label: "Bread products properly prepared",
        weight: 2,
        done: false,
        tips: [
          "GPB with garlic spread, sauce and cheese to crust",
          "No dock in dippers",
          "Dough balls not opening",
        ],
      },
      {
        label: "Approved products and procedures (APP)",
        weight: 2,
        done: false,
        tips: [
          "Makeline bins filled for max 2 hours trade",
          "Allergen poster displayed, leaflets available",
          "Back doors securely closed at all times",
          "GF Kit complete – screens free of carbon",
          "Toppings in black tubs in bottom row of makeline bin",
          "PB procedures followed - PB cheese not over 1st tray",
          "All products available including sides and soft drinks",
          "Red and white dough scrapers available on makeline for doughballs",
        ],
      },
      {
        label: "All sides properly prepared",
        weight: 1,
        done: false,
        tips: [
          "Fries prepped",
          "2 pack and 4 pack cookies prepped and available",
          "Double Chocolate cookies prepped and available",
          "Flavoured wings prepped and available",
          "All sides available in makeline cabinet",
        ],
      },
      { label: "Adequate PRP to handle expected sales volume", weight: 2, done: false },
    ],
  },
  {
    title: "Image",
    points: 20,
    items: [
      {
        label: "Team members in proper uniform",
        weight: 3,
        done: false,
        tips: [
          "Jet black trousers/jeans. No leggings, joggers or combats",
          "Plain white/black undershirt with no branding or logos",
          "No visible piercings of any kind. Plasters can not be used to cover",
          "No jumpers/hoodies/jackets – Domino’s uniforms only",
        ],
      },
      {
        label: "Grooming standards maintained",
        weight: 1,
        done: false,
        tips: [
          "Clean shaven or neat beard",
          "No visible piercings of any kind. Plasters can not be used to cover",
        ],
      },
      {
        label: "Store interior clean and in good repair",
        weight: 3,
        done: false,
        tips: [
          "All toilets must have lined bin with lid",
          "All bins in customer view must have a lid and be clean",
          "No sauce stains on walls",
          "No build-up of cornmeal in corners of floor",
          "Store generally clean and presentable",
        ],
      },
      {
        label: "Customer Area and view",
        weight: 3,
        done: false,
        tips: [
          "Customer area clean and welcoming",
          "Tables and chairs clean",
          "Floors clean",
          "No cobwebs",
          "No buildup of leaves/cornmeal in corners",
          "Everything in customer view clean and tidy",
          "No staff food/drink in customer view",
        ],
      },
      {
        label: "Outside",
        weight: 2,
        done: false,
        tips: [
          "No branded rubbish front or rear",
          "Bins not overflowing",
          "No build up of leaves/dirt in corners beside doors",
          "No buildup of leaves/rubbish/weeds outside shop",
          "Signage clean and free from cobwebs/stains",
        ],
      },
      {
        label: "Baking Equipment",
        weight: 2,
        done: false,
        tips: [
          "All screens and pans clean and free from food or carbon buildup",
          "SC screens not bent or misshapen",
          "Oven hood and filters clean",
          "Oven chambers clean and not discolouring",
          "Oven windows clean",
          "Bubble popper clean",
          "Top of oven not dusty",
        ],
      },
      {
        label: "Walk-in clean and working",
        weight: 1,
        done: false,
        tips: [
          "Fan, floor, ceiling, walls & shelving clean (no mould/debris/rust)",
          "Door seal good and handle clean — no food debris",
          "No dating stickers lying on the floors; floors clean",
        ],
      },
      {
        label: "Makeline clean and working",
        weight: 1,
        done: false,
        tips: [
          "Cupboards, doors, handles, shelves, seals and lids clean & in good condition",
          "Catch trays, grills and seals in good condition — no splits/tears/missing rails",
        ],
      },
      {
        label: "Delivery bags",
        weight: 2,
        done: false,
        tips: [
          "Clean – inside and out with no build up of cornmeal",
          "No sticker residue on bags",
          "Patches not worn or logo damaged",
          "No rips or tears",
        ],
      },
      { label: "Signage & Menu current, displayed correctly, clean and in good repair", weight: 1, done: false },
      { label: "Delivery vehicles represent positive brand image", weight: 1, done: false },
    ],
  },
  {
    title: "Safety & Security",
    points: 5,
    items: [
      { label: "Drivers regularly making cash drops", weight: 1, done: false },
      { label: "Caller ID working – security call backs being made", weight: 1, done: false },
      { label: "Safe used and secure", weight: 1, done: false },
      { label: "No more than £100 in front till", weight: 1, done: false },
      { label: "Drivers wearing seatbelts and driving safely", weight: 1, done: false },
    ],
  },
  {
    title: "Product Quality",
    points: 20,
    allOrNothing: true,
    items: [
      { label: "RIM", weight: 1, done: false },
      { label: "RISE", weight: 1, done: false },
      { label: "SIZE", weight: 1, done: false },
      { label: "PORTION", weight: 1, done: false },
      { label: "PLACEMENT", weight: 1, done: false },
      { label: "BAKE", weight: 1, done: false },
      { label: "Have you checked the bacon in the middle", weight: 1, done: false },
      { label: "No sauce and cheese on crust", weight: 1, done: false },
    ],
  },
];

export default function WalkthroughPage() {
  const [sections, setSections] = useState(SECTIONS_BASE);

  const handlePhotoUpload = async (
    sectionIndex: number,
    itemIndex: number,
    files: FileList | null
  ) => {
    if (!files?.length) return;
    const file = files[0];
    const path = `walkthrough/${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage
      .from("walkthrough")
      .upload(path, file, { upsert: false });
    if (error) {
      alert("Photo upload failed");
      console.error(error);
      return;
    }
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/walkthrough/${path}`;
    setSections((prev) => {
      const updated = [...prev];
      const item = updated[sectionIndex].items[itemIndex];
      item.photos = item.photos ? [...item.photos, url] : [url];
      return updated;
    });
  };

  const toggleCheck = (sIdx: number, iIdx: number) => {
    setSections((prev) => {
      const newSections = [...prev];
      newSections[sIdx].items[iIdx].done = !newSections[sIdx].items[iIdx].done;
      return newSections;
    });
  };

  const totalScore = sections.reduce((acc, sec) => {
    if (sec.allOrNothing) {
      const allDone = sec.items.every((i) => i.done);
      return acc + (allDone ? sec.points : 0);
    } else {
      const sectionPoints =
        sec.items.reduce((s, i) => s + (i.done ? i.weight : 0), 0) /
        sec.items.reduce((s, i) => s + i.weight, 0);
      return acc + sec.points * sectionPoints;
    }
  }, 0);

  return (
    <main className="p-4 max-w-xl mx-auto space-y-6 text-sm">
      <h1 className="text-center text-2xl font-bold text-[#006491]">
        Mourne-oids OER Walkthrough
      </h1>
      {sections.map((sec, sIdx) => (
        <section key={sec.title} className="border p-3 rounded-xl bg-gray-50 shadow-sm">
          <h2 className="font-semibold text-lg text-[#DA291C] mb-2">{sec.title}</h2>
          {sec.items.map((item, iIdx) => (
            <div key={iIdx} className="mb-3 border-b pb-2">
              <label className="flex items-start space-x-2">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => toggleCheck(sIdx, iIdx)}
                  className="mt-1"
                />
                <span className="flex-1">{item.label}</span>
              </label>
              {item.tips && (
                <details className="ml-6 mt-1 text-gray-600">
                  <summary className="cursor-pointer text-xs text-blue-600">
                    View details
                  </summary>
                  <ul className="list-disc ml-4 mt-1 text-xs space-y-0.5">
                    {item.tips.map((tip, idx) => (
                      <li key={idx}>{tip}</li>
                    ))}
                  </ul>
                </details>
              )}
              <div className="ml-6 mt-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePhotoUpload(sIdx, iIdx, e.target.files)}
                />
                {item.photos?.length ? (
                  <div className="flex flex-wrap mt-1 gap-2">
                    {item.photos.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        className="w-16 h-16 object-cover rounded border"
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </section>
      ))}
      <div className="text-center font-semibold text-lg">
        Total Score: {totalScore.toFixed(1)} / 75
      </div>
    </main>
  );
}
