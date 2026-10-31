import type { Category, Supplier, User } from "@/types";

/**
 * Static reference data for the demo shop. Prices are SAMPLE values for the
 * prototype only and are not current market prices.
 */

export const SEED_CATEGORIES: Category[] = [
  { id: "cat_rice", name: "Rice & Grains", icon: "🌾", color: "#d97706" },
  { id: "cat_pantry", name: "Pantry & Spices", icon: "🫙", color: "#b45309" },
  { id: "cat_veg", name: "Vegetables", icon: "🥬", color: "#16a34a" },
  { id: "cat_fruit", name: "Fruits", icon: "🍌", color: "#eab308" },
  { id: "cat_dairy", name: "Dairy & Eggs", icon: "🥛", color: "#0ea5e9" },
  { id: "cat_bev", name: "Beverages", icon: "🧃", color: "#f97316" },
  { id: "cat_bakery", name: "Bakery", icon: "🍞", color: "#a16207" },
  { id: "cat_snacks", name: "Snacks & Biscuits", icon: "🍪", color: "#db2777" },
  { id: "cat_meat", name: "Meat & Seafood", icon: "🐟", color: "#dc2626" },
  { id: "cat_frozen", name: "Frozen Foods", icon: "🧊", color: "#06b6d4" },
  { id: "cat_house", name: "Household Essentials", icon: "🧽", color: "#7c3aed" },
  { id: "cat_care", name: "Personal Care", icon: "🧴", color: "#0d9488" },
];

export const SEED_SUPPLIERS: Omit<Supplier, "createdAt">[] = [
  { id: "sup_01", name: "Lanka Rice Mills (Pvt) Ltd", contactPerson: "Sunil Rathnayake", phone: "+94 77 312 4455", email: "orders@lankaricemills.lk", address: "No. 12, Mill Road, Polonnaruwa", status: "active", leadTimeDays: 3 },
  { id: "sup_02", name: "Ceylon Spice & Staples", contactPerson: "Fathima Rizwan", phone: "+94 71 845 2210", email: "sales@ceylonspice.lk", address: "45 Main Street, Pettah, Colombo 11", status: "active", leadTimeDays: 2 },
  { id: "sup_03", name: "Hill Country Fresh Produce", contactPerson: "Ravi Kumar", phone: "+94 76 554 9087", email: "supply@hcfresh.lk", address: "Dambulla Economic Centre, Dambulla", status: "active", leadTimeDays: 1 },
  { id: "sup_04", name: "Kandy Dairy Distributors", contactPerson: "Chaminda Wickrama", phone: "+94 81 223 7781", email: "dispatch@kandydairy.lk", address: "88 Peradeniya Road, Kandy", status: "active", leadTimeDays: 1 },
  { id: "sup_05", name: "Island Beverages Co.", contactPerson: "Sharmila Perera", phone: "+94 11 269 4410", email: "trade@islandbev.lk", address: "Biyagama Export Zone, Biyagama", status: "active", leadTimeDays: 3 },
  { id: "sup_06", name: "Golden Crust Bakers", contactPerson: "Mohamed Nazeer", phone: "+94 77 908 1123", email: "orders@goldencrust.lk", address: "21 Katugastota Road, Kandy", status: "active", leadTimeDays: 1 },
  { id: "sup_07", name: "Sweet Treats Distributors", contactPerson: "Nadeesha Gunawardena", phone: "+94 70 221 6634", email: "sales@sweettreats.lk", address: "Ja-Ela Industrial Park, Ja-Ela", status: "active", leadTimeDays: 4 },
  { id: "sup_08", name: "Ocean Catch Seafoods", contactPerson: "Pradeep Fernando", phone: "+94 31 227 8890", email: "fresh@oceancatch.lk", address: "Fisheries Harbour, Negombo", status: "active", leadTimeDays: 1 },
  { id: "sup_09", name: "CleanHome Lanka", contactPerson: "Iresha Dissanayake", phone: "+94 11 258 3344", email: "orders@cleanhome.lk", address: "No. 5, Kelaniya Industrial Estate", status: "active", leadTimeDays: 5 },
  { id: "sup_10", name: "Wellness Care Traders", contactPerson: "Anura Jayasinghe", phone: "+94 77 663 0021", email: "info@wellnesscare.lk", address: "102 Galle Road, Wellawatte, Colombo 06", status: "active", leadTimeDays: 4 },
  { id: "sup_11", name: "FrostLine Frozen Foods", contactPerson: "Gayan Senanayake", phone: "+94 72 330 7765", email: "cold@frostline.lk", address: "Ekala Industrial Zone, Ja-Ela", status: "inactive", leadTimeDays: 3 },
];

export const SEED_USERS: Omit<User, "createdAt">[] = [
  { id: "usr_admin", name: "Nimal Perera", email: "admin@demo.pos", password: "demo123", role: "admin", phone: "+94 77 100 2000", active: true, avatarColor: "#059669" },
  { id: "usr_mgr", name: "Ayesha Fernando", email: "manager@demo.pos", password: "demo123", role: "manager", phone: "+94 77 100 2001", active: true, avatarColor: "#0284c7" },
  { id: "usr_cash1", name: "Kasun Silva", email: "cashier@demo.pos", password: "demo123", role: "cashier", phone: "+94 77 100 2002", active: true, avatarColor: "#d97706" },
  { id: "usr_cash2", name: "Dilini Jayawardena", email: "dilini@demo.pos", password: "demo123", role: "cashier", phone: "+94 77 100 2003", active: true, avatarColor: "#db2777" },
  { id: "usr_cash3", name: "Tharindu Bandara", email: "tharindu@demo.pos", password: "demo123", role: "cashier", phone: "+94 77 100 2004", active: true, avatarColor: "#7c3aed" },
  { id: "usr_mgr2", name: "Roshan Wijesinghe", email: "roshan@demo.pos", password: "demo123", role: "manager", phone: "+94 77 100 2005", active: false, avatarColor: "#475569" },
];

/**
 * Product rows:
 * [name, brand, categoryId, unit, costRs, priceRs, minStock, emoji, supplierId, taxable, trackExpiry, shelfLifeDays, popularity, stockLevel]
 * popularity: relative sales weight (0 = never sells → slow mover)
 * stockLevel: h = healthy, l = low, o = out of stock
 */
type Row = [string, string, string, string, number, number, number, string, string, boolean, boolean, number, number, "h" | "l" | "o"];

export const PRODUCT_ROWS: Row[] = [
  // Rice & Grains
  ["Nadu Rice (Loose)", "Lanka Mills", "cat_rice", "kg", 195, 230, 40, "🍚", "sup_01", false, false, 365, 10, "h"],
  ["Samba Rice (Loose)", "Lanka Mills", "cat_rice", "kg", 225, 265, 40, "🍚", "sup_01", false, false, 365, 9, "h"],
  ["Keeri Samba Rice (Loose)", "Lanka Mills", "cat_rice", "kg", 270, 320, 25, "🍚", "sup_01", false, false, 365, 6, "l"],
  ["Red Raw Rice (Loose)", "Lanka Mills", "cat_rice", "kg", 205, 245, 25, "🍚", "sup_01", false, false, 365, 4, "h"],
  ["Basmati Rice 1kg", "Royal Grain", "cat_rice", "pack", 940, 1150, 10, "🍚", "sup_01", false, false, 540, 2, "h"],
  ["Red Dhal (Mysore)", "Ceylon Staples", "cat_rice", "kg", 285, 340, 30, "🫘", "sup_02", false, false, 365, 8, "h"],
  ["Green Gram (Mung)", "Ceylon Staples", "cat_rice", "kg", 610, 720, 10, "🫛", "sup_02", false, false, 365, 2, "h"],
  ["Chickpeas (Kadala)", "Ceylon Staples", "cat_rice", "kg", 550, 650, 10, "🫘", "sup_02", false, false, 365, 2, "l"],
  ["White Sugar", "Ceylon Staples", "cat_rice", "kg", 235, 270, 40, "🧂", "sup_02", false, false, 730, 9, "h"],
  ["Brown Sugar 1kg", "Pelwatte", "cat_rice", "pack", 360, 420, 10, "🟫", "sup_02", false, false, 730, 2, "h"],
  ["Wheat Flour 1kg", "Prima", "cat_rice", "pack", 235, 280, 25, "🌾", "sup_02", false, false, 270, 6, "h"],
  ["Rice Flour (Red) 1kg", "Ceylon Staples", "cat_rice", "pack", 260, 310, 10, "🌾", "sup_02", false, false, 270, 2, "o"],
  ["Rolled Oats 500g", "Quaker", "cat_rice", "pack", 640, 780, 6, "🥣", "sup_02", true, false, 365, 0.4, "h"],

  // Pantry & Spices
  ["Coconut Oil 1L", "Marina", "cat_pantry", "bottle", 690, 790, 20, "🥥", "sup_02", false, false, 365, 6, "h"],
  ["Sunflower Oil 1L", "Fortune", "cat_pantry", "bottle", 820, 950, 10, "🌻", "sup_02", true, false, 365, 2, "h"],
  ["Iodized Salt 1kg", "Lak Lunu", "cat_pantry", "pack", 85, 120, 15, "🧂", "sup_02", false, false, 1000, 3, "h"],
  ["Chilli Powder 100g", "Motha", "cat_pantry", "pack", 175, 220, 15, "🌶️", "sup_02", false, false, 365, 3, "h"],
  ["Curry Powder (Roasted) 100g", "Motha", "cat_pantry", "pack", 185, 230, 15, "🍛", "sup_02", false, false, 365, 3, "l"],
  ["Turmeric Powder 50g", "Motha", "cat_pantry", "pack", 120, 150, 10, "🟡", "sup_02", false, false, 365, 2, "h"],
  ["Ceylon Black Tea 200g", "Dilmah", "cat_pantry", "pack", 640, 760, 12, "🍵", "sup_02", true, false, 730, 4, "h"],
  ["BOPF Tea 400g", "Lipton Ceylonta", "cat_pantry", "pack", 980, 1150, 8, "🍵", "sup_02", true, false, 730, 2, "h"],
  ["Instant Coffee 50g", "Nescafé", "cat_pantry", "pack", 720, 860, 8, "☕", "sup_02", true, false, 540, 1, "h"],
  ["Soya Meat 90g", "Delmege", "cat_pantry", "pack", 115, 150, 20, "🟤", "sup_02", false, false, 365, 4, "h"],
  ["Canned Mackerel 425g", "Ocean Pride", "cat_pantry", "pcs", 520, 620, 12, "🥫", "sup_08", false, false, 720, 4, "h"],
  ["Tomato Ketchup 400g", "MD", "cat_pantry", "bottle", 420, 510, 8, "🍅", "sup_02", true, false, 365, 1.5, "h"],
  ["Instant Noodles 4-Pack", "Maggi", "cat_pantry", "pack", 410, 495, 15, "🍜", "sup_07", true, false, 270, 4, "h"],
  ["Coconut Milk Powder 300g", "Maggi", "cat_pantry", "pack", 560, 670, 10, "🥥", "sup_02", true, false, 365, 3, "l"],
  ["Pasta Spaghetti 400g", "Barilla", "cat_pantry", "pack", 690, 850, 5, "🍝", "sup_02", true, false, 540, 0, "h"],

  // Vegetables
  ["Carrots", "Fresh Farm", "cat_veg", "kg", 290, 380, 10, "🥕", "sup_03", false, true, 10, 5, "h"],
  ["Big Onions", "Fresh Farm", "cat_veg", "kg", 260, 340, 20, "🧅", "sup_03", false, false, 30, 7, "h"],
  ["Red Onions", "Fresh Farm", "cat_veg", "kg", 480, 590, 10, "🧅", "sup_03", false, false, 30, 4, "l"],
  ["Potatoes", "Nuwara Eliya", "cat_veg", "kg", 280, 360, 20, "🥔", "sup_03", false, false, 30, 6, "h"],
  ["Tomatoes", "Fresh Farm", "cat_veg", "kg", 340, 450, 8, "🍅", "sup_03", false, true, 7, 4, "h"],
  ["Green Chillies", "Fresh Farm", "cat_veg", "kg", 620, 800, 3, "🌶️", "sup_03", false, true, 7, 3, "h"],
  ["Leeks", "Nuwara Eliya", "cat_veg", "kg", 300, 400, 5, "🥬", "sup_03", false, true, 7, 2, "h"],
  ["Cabbage", "Nuwara Eliya", "cat_veg", "kg", 180, 250, 8, "🥬", "sup_03", false, true, 10, 2, "h"],
  ["Beans", "Fresh Farm", "cat_veg", "kg", 420, 560, 5, "🫛", "sup_03", false, true, 5, 3, "o"],
  ["Garlic", "Imported", "cat_veg", "kg", 780, 950, 4, "🧄", "sup_03", false, false, 60, 2, "h"],
  ["Pumpkin", "Fresh Farm", "cat_veg", "kg", 140, 200, 5, "🎃", "sup_03", false, true, 21, 1, "h"],
  ["Brinjal", "Fresh Farm", "cat_veg", "kg", 320, 420, 4, "🍆", "sup_03", false, true, 6, 1.5, "l"],

  // Fruits
  ["Ambul Bananas", "Local", "cat_fruit", "kg", 210, 290, 8, "🍌", "sup_03", false, true, 5, 5, "h"],
  ["Papaya", "Local", "cat_fruit", "kg", 170, 240, 5, "🥭", "sup_03", false, true, 5, 2, "h"],
  ["Red Apples", "Imported", "cat_fruit", "kg", 1150, 1450, 5, "🍎", "sup_03", false, true, 21, 2, "h"],
  ["Oranges", "Imported", "cat_fruit", "kg", 950, 1200, 5, "🍊", "sup_03", false, true, 21, 1, "l"],
  ["Pineapple", "Local", "cat_fruit", "pcs", 280, 380, 6, "🍍", "sup_03", false, true, 7, 1.5, "h"],
  ["King Coconut", "Local", "cat_fruit", "pcs", 110, 150, 15, "🥥", "sup_03", false, true, 10, 3, "h"],
  ["Mangoes (TJC)", "Local", "cat_fruit", "kg", 520, 700, 4, "🥭", "sup_03", false, true, 6, 1, "o"],
  ["Avocado", "Local", "cat_fruit", "kg", 380, 520, 3, "🥑", "sup_03", false, true, 6, 0, "h"],

  // Dairy & Eggs
  ["Fresh Milk 1L", "Highland", "cat_dairy", "bottle", 420, 500, 24, "🥛", "sup_04", false, true, 7, 8, "l"],
  ["Full Cream Milk Powder 400g", "Anchor", "cat_dairy", "pack", 1050, 1220, 15, "🥛", "sup_04", false, false, 365, 6, "h"],
  ["Milk Powder 1kg", "Highland", "cat_dairy", "pack", 2480, 2850, 8, "🥛", "sup_04", false, false, 365, 3, "h"],
  ["Set Yoghurt 80g", "Kotmale", "cat_dairy", "pcs", 65, 85, 30, "🍶", "sup_04", false, true, 14, 6, "h"],
  ["Curd (Buffalo) Pot", "Kandy Farm", "cat_dairy", "pcs", 480, 600, 8, "🏺", "sup_04", false, true, 10, 3, "h"],
  ["Cheddar Cheese 200g", "Kotmale", "cat_dairy", "pack", 880, 1050, 6, "🧀", "sup_04", true, true, 60, 1, "h"],
  ["Salted Butter 200g", "Anchor", "cat_dairy", "pack", 960, 1150, 6, "🧈", "sup_04", true, true, 90, 1.5, "l"],
  ["Eggs (Farm)", "Kandy Farm", "cat_dairy", "pcs", 38, 48, 60, "🥚", "sup_04", false, true, 21, 9, "h"],
  ["Flavoured Milk 180ml", "Elephant House", "cat_dairy", "bottle", 120, 150, 24, "🍼", "sup_04", true, true, 21, 4, "h"],

  // Beverages
  ["Cola 1.5L", "Coca-Cola", "cat_bev", "bottle", 400, 480, 12, "🥤", "sup_05", true, false, 270, 4, "h"],
  ["Ginger Beer 1.5L", "Elephant House", "cat_bev", "bottle", 380, 460, 12, "🍺", "sup_05", true, false, 270, 4, "h"],
  ["Cream Soda 400ml", "Elephant House", "cat_bev", "bottle", 170, 210, 15, "🥤", "sup_05", true, false, 270, 3, "h"],
  ["Mineral Water 1.5L", "Aqua Lanka", "cat_bev", "bottle", 110, 150, 24, "💧", "sup_05", true, false, 365, 6, "h"],
  ["Orange Juice 1L", "Kist", "cat_bev", "bottle", 590, 720, 6, "🧃", "sup_05", true, true, 120, 1.5, "h"],
  ["Energy Drink 250ml", "Red Bull", "cat_bev", "bottle", 480, 590, 6, "⚡", "sup_05", true, false, 365, 1, "l"],
  ["Malted Drink 400g", "Milo", "cat_bev", "pack", 960, 1140, 8, "🍫", "sup_05", true, false, 365, 3, "h"],
  ["Cordial Syrup 750ml", "Kist", "cat_bev", "bottle", 520, 640, 5, "🧃", "sup_05", true, false, 365, 0, "h"],

  // Bakery
  ["Sandwich Bread 450g", "Golden Crust", "cat_bakery", "pcs", 160, 200, 20, "🍞", "sup_06", false, true, 3, 9, "h"],
  ["Roast Paan", "Golden Crust", "cat_bakery", "pcs", 55, 70, 20, "🥖", "sup_06", false, true, 2, 6, "l"],
  ["Fish Bun", "Golden Crust", "cat_bakery", "pcs", 75, 100, 15, "🥐", "sup_06", false, true, 2, 4, "h"],
  ["Butter Cake 500g", "Golden Crust", "cat_bakery", "pcs", 620, 780, 4, "🍰", "sup_06", false, true, 7, 1, "h"],
  ["Tea Bun", "Golden Crust", "cat_bakery", "pcs", 45, 60, 15, "🥯", "sup_06", false, true, 2, 4, "h"],
  ["Whole Wheat Bread 450g", "Golden Crust", "cat_bakery", "pcs", 210, 260, 8, "🍞", "sup_06", false, true, 4, 2, "h"],

  // Snacks & Biscuits
  ["Cream Crackers 490g", "Munchee", "cat_snacks", "pack", 510, 620, 15, "🍘", "sup_07", true, false, 270, 5, "h"],
  ["Chocolate Cream Biscuits 100g", "Maliban", "cat_snacks", "pack", 155, 190, 20, "🍪", "sup_07", true, false, 270, 4, "h"],
  ["Lemon Puff 200g", "Maliban", "cat_snacks", "pack", 260, 320, 15, "🍋", "sup_07", true, false, 270, 3, "h"],
  ["Marie Biscuits 400g", "Munchee", "cat_snacks", "pack", 390, 470, 12, "🍪", "sup_07", true, false, 270, 3, "l"],
  ["Potato Chips 100g", "Tiara", "cat_snacks", "pack", 290, 360, 10, "🥔", "sup_07", true, false, 180, 2, "h"],
  ["Chocolate Bar 100g", "Kandos", "cat_snacks", "pcs", 380, 470, 12, "🍫", "sup_07", true, true, 270, 2, "h"],
  ["Mixture (Spicy) 200g", "Rasa", "cat_snacks", "pack", 240, 300, 8, "🥜", "sup_07", true, false, 120, 1.5, "h"],
  ["Peanuts (Roasted) 100g", "Rasa", "cat_snacks", "pack", 150, 190, 8, "🥜", "sup_07", true, false, 120, 1, "o"],
  ["Ice Cream Wafers 300g", "Ritzbury", "cat_snacks", "pack", 480, 590, 6, "🧇", "sup_07", true, false, 270, 0.3, "h"],

  // Meat & Seafood
  ["Chicken (Whole)", "Crysbro", "cat_meat", "kg", 1050, 1290, 8, "🍗", "sup_08", false, true, 5, 5, "h"],
  ["Chicken Breast", "Crysbro", "cat_meat", "kg", 1650, 1950, 4, "🍗", "sup_08", false, true, 5, 2, "l"],
  ["Thalapath (Sailfish)", "Ocean Catch", "cat_meat", "kg", 2400, 2900, 3, "🐟", "sup_08", false, true, 3, 1.5, "h"],
  ["Prawns (Medium)", "Ocean Catch", "cat_meat", "kg", 2800, 3400, 2, "🦐", "sup_08", false, true, 3, 0.8, "h"],
  ["Dried Sprats (Haal Masso)", "Ocean Catch", "cat_meat", "kg", 1200, 1450, 3, "🐟", "sup_08", false, false, 120, 1.5, "h"],
  ["Sausages 500g", "Keells Krest", "cat_meat", "pack", 820, 990, 6, "🌭", "sup_08", true, true, 45, 2, "h"],

  // Frozen Foods
  ["Frozen Peas 500g", "FrostLine", "cat_frozen", "pack", 520, 640, 5, "🫛", "sup_11", true, true, 180, 0.5, "h"],
  ["Vanilla Ice Cream 1L", "Elephant House", "cat_frozen", "pcs", 690, 850, 6, "🍨", "sup_05", true, true, 180, 2, "h"],
  ["Chicken Nuggets 400g", "Keells Krest", "cat_frozen", "pack", 980, 1190, 4, "🍗", "sup_11", true, true, 120, 1, "l"],
  ["Frozen Paratha 5pcs", "FrostLine", "cat_frozen", "pack", 410, 520, 5, "🫓", "sup_11", true, true, 120, 0.2, "h"],

  // Household Essentials
  ["Dishwash Liquid 500ml", "Sunlight", "cat_house", "bottle", 380, 460, 10, "🧼", "sup_09", true, false, 730, 3, "h"],
  ["Laundry Detergent 1kg", "Surf Excel", "cat_house", "pack", 980, 1180, 8, "🧺", "sup_09", true, false, 730, 2.5, "h"],
  ["Laundry Bar Soap", "Sunlight", "cat_house", "pcs", 135, 165, 20, "🧼", "sup_09", true, false, 730, 4, "h"],
  ["Toilet Cleaner 500ml", "Harpic", "cat_house", "bottle", 510, 620, 6, "🚽", "sup_09", true, false, 730, 1.5, "h"],
  ["Floor Cleaner 1L", "Clean Home", "cat_house", "bottle", 560, 680, 5, "🧴", "sup_09", true, false, 730, 1, "h"],
  ["Toilet Tissue 4-Roll", "Fiesta", "cat_house", "pack", 450, 560, 10, "🧻", "sup_09", true, false, 1000, 2.5, "h"],
  ["Garbage Bags (Large) 10pc", "Clean Home", "cat_house", "pack", 260, 340, 8, "🗑️", "sup_09", true, false, 1000, 1, "l"],
  ["Mosquito Coils 10pc", "Baygon", "cat_house", "box", 210, 260, 10, "🌀", "sup_09", true, false, 730, 2, "h"],
  ["Matchbox (Pack of 10)", "Swan", "cat_house", "pack", 95, 130, 10, "🔥", "sup_09", true, false, 1000, 1.5, "h"],
  ["Aluminium Foil 10m", "Clean Home", "cat_house", "pcs", 590, 720, 4, "🪙", "sup_09", true, false, 1000, 0, "h"],

  // Personal Care
  ["Herbal Soap 100g", "Siddhalepa", "cat_care", "pcs", 155, 195, 15, "🧼", "sup_10", true, false, 730, 3, "h"],
  ["Toothpaste 120g", "Signal", "cat_care", "pcs", 290, 360, 12, "🪥", "sup_10", true, false, 730, 3, "h"],
  ["Toothbrush (Soft)", "Clogard", "cat_care", "pcs", 140, 190, 10, "🪥", "sup_10", true, false, 1000, 1.5, "h"],
  ["Shampoo 180ml", "Sunsilk", "cat_care", "bottle", 520, 640, 8, "🧴", "sup_10", true, false, 730, 1.5, "h"],
  ["Coconut Hair Oil 100ml", "Vatika", "cat_care", "bottle", 280, 350, 8, "🥥", "sup_10", true, false, 730, 1, "l"],
  ["Sanitary Napkins 10pc", "Fems", "cat_care", "pack", 330, 410, 10, "🌸", "sup_10", true, false, 1000, 1.5, "h"],
  ["Baby Diapers (M) 24pc", "Velona", "cat_care", "pack", 2350, 2790, 4, "👶", "sup_10", true, false, 1000, 0.8, "h"],
  ["Hand Wash 250ml", "Lifebuoy", "cat_care", "bottle", 390, 480, 6, "🫧", "sup_10", true, false, 730, 1, "h"],
  ["Body Lotion 200ml", "Nivea", "cat_care", "bottle", 980, 1190, 4, "🧴", "sup_10", true, false, 730, 0.2, "h"],
];

export const CUSTOMER_FIRST = [
  "Saman", "Chathura", "Nadeeka", "Ruwan", "Iresha", "Mahesh", "Sanduni", "Lahiru", "Thilini", "Asanka",
  "Fathima", "Mohamed", "Priya", "Kumaran", "Hasini", "Dinesh", "Rashmi", "Isuru", "Malsha", "Sajith",
  "Nuwan", "Kavindi", "Shehan", "Amaya", "Pradeep", "Gayani", "Janaka", "Roshini", "Ahamed", "Lakmali",
];
export const CUSTOMER_LAST = [
  "Perera", "Fernando", "Silva", "Jayasuriya", "Bandara", "Rathnayake", "Wickramasinghe", "Herath", "Gunasekara",
  "Rizvi", "Kumar", "Senanayake", "Dissanayake", "Ekanayake", "Weerasinghe", "Abeysekara", "Karunaratne", "Liyanage",
];
export const CITIES = ["Kandy", "Peradeniya", "Katugastota", "Gampola", "Kundasale", "Pilimathalawa", "Digana", "Akurana"];
