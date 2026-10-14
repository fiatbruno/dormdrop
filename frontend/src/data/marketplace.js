
export const categories = [
  "Electronics",
  "Furniture",
  "Textbooks",
  "School Supplies",
  "Clothing",
  "Shoes",
  "Accessories",
  "Dorm Essentials",
  "Kitchen & Appliances",
  "Bikes & Scooters",
  "Sports & Fitness",
  "Gaming",
  "Musical Instruments",
  "Art & Craft Supplies",
  "Other"
];

export const pickupSpots = [
  "Gerber Center / Main entrance",
  "Thomas Tredway Library / 2nd Floor Entrance",
  "Brew by the Slough / Lounge",
  "Olin Center / Main entrance",
  "The Quad / Viking Plaza",
  "Hanson Hall of Science / Main entrance",
  "Centennial Hall / Main entrance",
  "Bergendoff Hall / Main entrance",
  "Brunner Theatre Center / Main entrance",
  "Carver P.E. Center / Main entrance",
  "Denkmann Memorial Building / Main entrance",
  "Evald Hall / Main entrance",
  "Andreen Hall / Outside main entrance",
  "Erickson Residence Hall / Outside main entrance",
  "Westerlin Residence Hall / Outside main entrance"
];

export const emptyFilters = {
  category: "",
  dateFrom: "",
  dateTo: "",
  minPrice: "",
  maxPrice: "",
  condition: "",
  pickupLocation: "",
  listingType: ""
};

export function filterProducts(products, filters, search) {
  const query = search.trim().toLowerCase();

  return products.filter(product => {
    const text = [
      product.title,
      product.description,
      product.category
    ].filter(Boolean).join(" ").toLowerCase();

    return (
      (!query || text.includes(query)) &&
      (!filters.category ||
        product.category === filters.category) &&
      (!filters.dateFrom ||
        product.listedOn >= filters.dateFrom) &&
      (!filters.dateTo ||
        product.listedOn <= filters.dateTo) &&
      (filters.minPrice === "" ||
        product.price >= Number(filters.minPrice)) &&
      (filters.maxPrice === "" ||
        product.price <= Number(filters.maxPrice)) &&
      (!filters.condition ||
        product.condition === filters.condition) &&
      (!filters.pickupLocation ||
        product.pickupLocation === filters.pickupLocation) &&
      (!filters.listingType ||
        product.listingType === filters.listingType)
    );
  });
}
