export const categories = ["Electronics", "Furniture", "Textbooks", "School Supplies", "Clothing", "Shoes", "Accessories", "Dorm Essentials", "Kitchen & Appliances", "Bikes & Scooters", "Sports & Fitness", "Gaming", "Musical Instruments", "Art & Craft Supplies", "Other"];
export const pickupSpots = ["Gerber Center / Main entrance", "Thomas Tredway Library / 2nd Floor Entrance", "Brew by the Slough / Lounge", "Olin Center / Main entrance", "The Quad / Viking Plaza", "Hanson Hall of Science / Main entrance", "Centennial Hall / Main entrance", "Bergendoff Hall / Main entrance", "Brunner Theatre Center / Main entrance", "Carver P.E. Center / Main entrance", "Denkmann Memorial Building / Main entrance", "Evald Hall / Main entrance", "Andreen Hall / Outside main entrance", "Erickson Residence Hall / Outside main entrance", "Westerlin Residence Hall / Outside main entrance"];
export const emptyFilters = { category: "", dateFrom: "", dateTo: "", minPrice: "", maxPrice: "", condition: "", pickupLocation: "", listingType: "" };

const examples = [
  ["sony-headphones.png", "Sony WH-1000XM4 Headphones", "Electronics", "Used for MATH-220. Access code not included. Pick up in lobby.", 120, "For sale", "Good"],
  ["custom-rug.png", "Cozy 5x7 Area Rug with motifs", "Dorm Essentials", "Free to any freshman wanting to warm up their floor. Pick up anytime.", 0, "Free / Donate", "Good"],
  ["jbl-speaker.png", "JBL Flip 5 Speaker", "Electronics", "Speaker for sale in great condition. Basically fresh out the box.", 50, "For sale", "Like new"],
  ["standing-desk.png", "IKEA Standing Desk Riser", "Furniture", "Saves your back during long coding sessions. Sturdy pneumatic lift.", 80, "For sale", "Good"],
  ["mini-fridge.png", "Compact Energy Star Mini Fridge", "Kitchen & Appliances", "Keeps drinks ice cold. Moving off campus, needs gone by Friday.", 65, "For sale", "Fair"],
  ["bike.png", "Campus Cruiser Bike", "Bikes & Scooters", "Ready for campus rides. Looking to trade for a scooter.", 100, "Trade", "Good"],
  ["bean-bag.png", "Multicolor Bean Bag", "Furniture", "Extra large, colorful bean bag for a cozy dorm corner.", 40, "For sale", "Good"],
  ["game-console.png", "Sony Game Console", "Gaming", "In great condition. Includes one controller.", 250, "For sale", "Like new"],
  ["stair-rug.png", "Tom & Jerry Stair Rug", "Furniture", "Adds a little chaos to your place and makes your stairs less boring.", 30, "For sale", "New"],
  ["textbooks.png", "Calculus Textbook", "Textbooks", "Lightly used textbook. A few helpful notes in the margins.", 25, "For sale", "Good"],
  ["desk-lamp.png", "Adjustable Desk Lamp", "Dorm Essentials", "Free desk lamp. Works perfectly and fits small desks.", 0, "Free / Donate", "Fair"],
  ["coffee-maker.png", "Compact Coffee Maker", "Kitchen & Appliances", "Great for early classes. Clean and ready to use.", 20, "For sale", "Good"],
];

// Demo data until the listings API is available. Dates stay relative for filter demos.
export const sampleProducts = examples.map(([image, title, category, description, price, listingType, condition], index) => {
  const date = new Date();
  date.setDate(date.getDate() - index * 2);
  const listedOn = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { id: `demo-${index + 1}`, image: `/images/products/${image}`, title, category, description, price, listingType, condition, listedOn, pickupLocation: pickupSpots[index % pickupSpots.length] };
});

export function filterProducts(products, filters, search) {
  const query = search.trim().toLowerCase();
  return products.filter((product) =>
    (!query || `${product.title} ${product.description} ${product.category}`.toLowerCase().includes(query)) &&
    (!filters.category || product.category === filters.category) &&
    (!filters.dateFrom || product.listedOn >= filters.dateFrom) &&
    (!filters.dateTo || product.listedOn <= filters.dateTo) &&
    (filters.minPrice === "" || product.price >= Number(filters.minPrice)) &&
    (filters.maxPrice === "" || product.price <= Number(filters.maxPrice)) &&
    (!filters.condition || product.condition === filters.condition) &&
    (!filters.pickupLocation || product.pickupLocation === filters.pickupLocation) &&
    (!filters.listingType || product.listingType === filters.listingType)
  );
}
