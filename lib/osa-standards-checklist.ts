export type OsaWalkthroughType = "pre_open" | "handover";

export type OsaChecklistSection = {
  title: string;
  items: string[];
};

/**
 * OSA Standards Walkthrough (tick-only).
 * Order + wording mirror the "Standards Walkthrough 2025" PDF.
 */
export const OSA_STANDARDS_CHECKLIST: OsaChecklistSection[] = [
  {
    "title": "Front of Store",
    "items": [
      "Signage is clean and damage free",
      "No weeds or litter outside store",
      "Correct opening times displayed (if applicable)",
      "Correct campaign material displayed",
      "Door and window glass is clean",
      "Shop front clean and paint in good repair"
    ]
  },
  {
    "title": "Customer Area",
    "items": [
      "Counter is clean and organised",
      "Customer screen is on and kiosk screen displayed",
      "Sneeze guard is clean and fingerprint free",
      "Lights are working and fixtures clean",
      "Current allergen poster displayed and leaflet available",
      "Current menu is available",
      "Napkins available",
      "Doors, windows and windowsills clean",
      "All visible bins clean and lidded",
      "All sight lines clean and clutter-free",
      "All visible TMs meet uniform standard",
      "No staff food or drink in customer view",
      "No chemicals in customer view",
      "Entry door from customer area to kitchen locked",
      "Customer toilet check poster is displayed"
    ]
  },
  {
    "title": "Counter Area",
    "items": [
      "CSR terminals are clean",
      "Keyboards are clean and free of any buildup",
      "Tills locked and contain less than £100/€200 (if applicable)",
      "Drivers carrying less than £15/€50 (if applicable)",
      "Safe is secure",
      "Thermal labels available",
      "Caller ID working and in use",
      "Boxes stocked and containing correct dips",
      "Fly killer on with a clean board"
    ]
  },
  {
    "title": "Stretch Table",
    "items": [
      "All dough sizes available and proofed",
      "Any mixed trays are dated with today's date",
      "Clean cover trays on each dough stack",
      "Dough tray dates not customer-facing",
      "Pizza screens are clean and free of buildup",
      "Garlic bread and dessert pans clean and free of residue",
      "All sauces ambient and dated appropriately",
      "Correct volume of wraps and TCs at ambient and dated"
    ]
  },
  {
    "title": "Makeline",
    "items": [
      "All product in makeline within shelf life",
      "Makeline bin temperature between 0 and 5 degrees",
      "Makeline tubs not filled past the fill line",
      "GF kit available, with GF sauce prepped",
      "Sanitation timer running on a 2-hour system",
      "Herbs shaker and any squeezy bottles clean",
      "All gluten-containing product in black tubs",
      "Makeline cabinet temperature between 0 and 4 degrees",
      "All tubs in makeline cabinet have lids",
      "Enough stock in makeline cabinet for daypart",
      "Makeline doors, seals and cabinets are clean and free of rust",
      "Makeline fan guards are clean and free of rust",
      "Catch trays emptied regularly and in good repair",
      "Keyboard cover and holder clean",
      "All sides put in oven on screens/in pans",
      "Wedges pans clean and free of carbon buildup",
      "Hand sink stocked with soap and paper towels",
      "Step by step handwash poster present",
      "No chemicals stored within 30cm of food surfaces",
      "Probe wipes available"
    ]
  },
  {
    "title": "Oven",
    "items": [
      "Oven catch trays inserted and clean",
      "Oven belts clean",
      "Oven fan guards clean and free of buildup",
      "Oven hood clean",
      "Oven filters clean and free of buildup",
      "Ceiling tiles surrounding oven clean"
    ]
  },
  {
    "title": "Cut Table",
    "items": [
      "Red, green and yellow cutters available",
      "Pizza peel clean",
      "Shelves, surfaces and sides of cut table clean",
      "All squeezy bottles dated, clean and free of residue",
      "All postbake sauces and toppings dated and clean",
      "Bubble popper clean and sanitised",
      "PB and GF stickers available and in use",
      "Boxes fully stocked, with correct dips",
      "All dips in date"
    ]
  },
  {
    "title": "Routing Station",
    "items": [
      "Hot bags clean and tear-free",
      "Cool bags clean and tear-free",
      "All dips available and in date",
      "At least 1.5 usable bags for drivers on busiest shift",
      "Hot rack working and in use with correct bulbs",
      "Boxes stacked max 3 high in hotbags",
      "All drinks and ice cream available and within shelf life",
      "Coke fridge seals and fan guards clean",
      "Coke fridge temperature between 0 and 8 degrees",
      "Ice cream freezer clean with no ice buildup",
      "Ice cream freezer temperature below -16 degrees"
    ]
  },
  {
    "title": "FSMS Board",
    "items": [
      "Today's temperature sheet completed",
      "2 DPG approved working temperature probes available",
      "Current shelf life chart and allergen leaflet displayed",
      "Current gluten containing product list displayed",
      "Weekly cleaning list displayed"
    ]
  },
  {
    "title": "Walk-in Chiller",
    "items": [
      "Walk-in temperature between 0 and 3 degrees",
      "Walk-in door closed with overlapping strip curtains in use",
      "All product in walk-in within shelf life",
      "All food dated correctly as per shelf life chart",
      "All product stored on racks, 6-inch from ground",
      "Dough safely stacked, max 25 trays of dough high",
      "All dough stacks have a clean cover tray",
      "Walk-in door, floor, racks and walls clean and free of rust",
      "Walk-in fans working and fan guards clean and free of rust",
      "Staff food in a labelled box with contents in date"
    ]
  },
  {
    "title": "Storage Areas",
    "items": [
      "All items stored minimum 6-inch from ground",
      "Boxes must not touch ceiling or ground",
      "Coloured side of boxes facing outwards",
      "Drinks safely stacked, 6-inch from ground",
      "No unapproved chemicals in the store",
      "Mopeds, bikes and ebikes not kept in store",
      "Main sink clean, sanitiser correct strength",
      "Under sink clean, all washing up clean",
      "Any cloths and scourers stored in sanitiser",
      "Can opener assembled and clean",
      "All handwash sinks clean and stocked, with handwash poster",
      "Clean aprons available",
      "Aprons not stored with uniform"
    ]
  },
  {
    "title": "Toilet",
    "items": [
      "Toilet, sink, toilet brush and area is clean",
      "Bin is regularly changed, clean and has a lid",
      "Handwash sink clean and stocked, with handwash poster",
      "Fans clean"
    ]
  },
  {
    "title": "Office",
    "items": [
      "28 days of correct and complete FSMS sheets",
      "Last OER and OSA report available with action plan",
      "Pest control report available from within last 6 weeks"
    ]
  },
  {
    "title": "Outside Area",
    "items": [
      "Back door working and locked",
      "Bins and store surroundings clean and litter free",
      "All bin lids are closed",
      "Empty trays neatly stacked, with top tray inverted",
      "Empty trays separated by colour",
      "All trays free of excess cornmeal and food debris",
      "Any outside storage areas clean",
      "No branded rubbish in sight",
      "All signage clean and damage free"
    ]
  },
  {
    "title": "Great or Remake",
    "items": [
      "Pizzas checked (Pizza 1–4): Rim, Size, Portion, Placement, Bake, Overall",
      "Side orders checked (Side 1–3)"
    ]
  },
  {
    "title": "Cut Test",
    "items": [
      "From the top checked: Rim, Size, Portion, Placement, Bake, Overall",
      "From the middle checked: Defined Edge, Anchor, CCV, Overall"
    ]
  }
];
