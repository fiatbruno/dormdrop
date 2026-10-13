
import { useEffect, useRef, useState } from "react";
import { Upload, ShieldCheck, ChevronDown } from "lucide-react";
import { createListing, uploadListingImage } from "../../services/marketplaceApi";
import Footer from "../../components/Footer/Footer";
import "./ListItem.css";
import Navbar from "../../components/Navbar/Navbar";

const emptyForm = {
  title: "",
  category: "",
  customCategory: "",
  condition: "",
  description: "",
  listingType: "For sale",
  price: "",
  pickupLocation: "",
};

const categories = [
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
  "Other",
];

const pickupSpots = [
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
  "Westerlin Residence Hall / Outside main entrance",
];

function Dropdown({
  id,
  label,
  placeholder,
  options,
  value,
  onChange,
  disabled,
}) {
  const [open, setOpen] = useState(false);
  const container = useRef(null);
  const trigger = useRef(null);
  const menu = useRef(null);

  useEffect(() => {
    if (!open) return;

    function closeOutside(event) {
      if (!container.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const buttons = menu.current?.querySelectorAll("button");
    const selected = options.indexOf(value);
    buttons?.[selected >= 0 ? selected : 0]?.focus();
  }, [open, options, value]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  function selectOption(option) {
    onChange(option);
    setOpen(false);

