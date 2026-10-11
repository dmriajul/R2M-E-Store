/**
 * Bangladesh's eight divisions and their districts, with a central-post-office
 * postcode to use as an editable suggestion in checkout. Postcodes can vary by
 * neighbourhood/post office, so the checkout never locks the suggested value.
 */
export const BANGLADESH_DIVISIONS = [
  {
    name: "Dhaka Division",
    districts: [
      { name: "Dhaka", postalCode: "1000", postalArea: "Dhaka GPO" },
      { name: "Faridpur", postalCode: "7800", postalArea: "Faridpur Sadar" },
      { name: "Gazipur", postalCode: "1700", postalArea: "Gazipur Sadar" },
      { name: "Gopalganj", postalCode: "8100", postalArea: "Gopalganj Sadar" },
      { name: "Kishoreganj", postalCode: "2300", postalArea: "Kishoreganj Sadar" },
      { name: "Madaripur", postalCode: "7900", postalArea: "Madaripur Sadar" },
      { name: "Manikganj", postalCode: "1800", postalArea: "Manikganj Sadar" },
      { name: "Munshiganj", postalCode: "1500", postalArea: "Munshiganj Sadar" },
      { name: "Narayanganj", postalCode: "1400", postalArea: "Narayanganj Sadar" },
      { name: "Narsingdi", postalCode: "1600", postalArea: "Narsingdi Sadar" },
      { name: "Rajbari", postalCode: "7700", postalArea: "Rajbari Sadar" },
      { name: "Shariatpur", postalCode: "8000", postalArea: "Shariatpur Sadar" },
      { name: "Tangail", postalCode: "1900", postalArea: "Tangail Sadar" },
    ],
  },
  {
    name: "Chittagong Division",
    districts: [
      { name: "Bandarban", postalCode: "4600", postalArea: "Bandarban Sadar" },
      { name: "Brahmanbaria", postalCode: "3400", postalArea: "Brahmanbaria Sadar" },
      { name: "Chandpur", postalCode: "3600", postalArea: "Chandpur Sadar" },
      { name: "Chittagong", postalCode: "4000", postalArea: "Chittagong GPO" },
      { name: "Comilla", postalCode: "3500", postalArea: "Comilla Sadar" },
      { name: "Cox's Bazar", postalCode: "4700", postalArea: "Cox's Bazar Sadar" },
      { name: "Feni", postalCode: "3900", postalArea: "Feni Sadar" },
      { name: "Khagrachhari", postalCode: "4400", postalArea: "Khagrachhari Sadar" },
      { name: "Lakshmipur", postalCode: "3700", postalArea: "Lakshmipur Sadar" },
      { name: "Noakhali", postalCode: "3800", postalArea: "Noakhali Sadar" },
      { name: "Rangamati", postalCode: "4500", postalArea: "Rangamati Sadar" },
    ],
  },
  {
    name: "Khulna Division",
    districts: [
      { name: "Bagerhat", postalCode: "9300", postalArea: "Bagerhat Sadar" },
      { name: "Chuadanga", postalCode: "7200", postalArea: "Chuadanga Sadar" },
      { name: "Jashore", postalCode: "7400", postalArea: "Jashore Sadar" },
      { name: "Jhenaidah", postalCode: "7300", postalArea: "Jhenaidah Sadar" },
      { name: "Khulna", postalCode: "9000", postalArea: "Khulna GPO" },
      { name: "Kushtia", postalCode: "7000", postalArea: "Kushtia Sadar" },
      { name: "Magura", postalCode: "7600", postalArea: "Magura Sadar" },
      { name: "Meherpur", postalCode: "7100", postalArea: "Meherpur Sadar" },
      { name: "Narail", postalCode: "7500", postalArea: "Narail Sadar" },
      { name: "Satkhira", postalCode: "9400", postalArea: "Satkhira Sadar" },
    ],
  },
  {
    name: "Rajshahi Division",
    districts: [
      { name: "Bogura", postalCode: "5800", postalArea: "Bogura Sadar" },
      { name: "Joypurhat", postalCode: "5900", postalArea: "Joypurhat Sadar" },
      { name: "Naogaon", postalCode: "6500", postalArea: "Naogaon Sadar" },
      { name: "Natore", postalCode: "6400", postalArea: "Natore Sadar" },
      { name: "Chapainawabganj", postalCode: "6300", postalArea: "Chapainawabganj Sadar" },
      { name: "Pabna", postalCode: "6600", postalArea: "Pabna Sadar" },
      { name: "Rajshahi", postalCode: "6000", postalArea: "Rajshahi GPO" },
      { name: "Sirajganj", postalCode: "6700", postalArea: "Sirajganj Sadar" },
    ],
  },
  {
    name: "Barisal Division",
    districts: [
      { name: "Barguna", postalCode: "8700", postalArea: "Barguna Sadar" },
      { name: "Barisal", postalCode: "8200", postalArea: "Barisal Sadar" },
      { name: "Bhola", postalCode: "8300", postalArea: "Bhola Sadar" },
      { name: "Jhalokati", postalCode: "8400", postalArea: "Jhalokati Sadar" },
      { name: "Patuakhali", postalCode: "8600", postalArea: "Patuakhali Sadar" },
      { name: "Pirojpur", postalCode: "8500", postalArea: "Pirojpur Sadar" },
    ],
  },
  {
    name: "Sylhet Division",
    districts: [
      { name: "Habiganj", postalCode: "3300", postalArea: "Habiganj Sadar" },
      { name: "Moulvibazar", postalCode: "3200", postalArea: "Moulvibazar Sadar" },
      { name: "Sunamganj", postalCode: "3000", postalArea: "Sunamganj Sadar" },
      { name: "Sylhet", postalCode: "3100", postalArea: "Sylhet GPO" },
    ],
  },
  {
    name: "Rangpur Division",
    districts: [
      { name: "Dinajpur", postalCode: "5200", postalArea: "Dinajpur Sadar" },
      { name: "Gaibandha", postalCode: "5700", postalArea: "Gaibandha Sadar" },
      { name: "Kurigram", postalCode: "5600", postalArea: "Kurigram Sadar" },
      { name: "Lalmonirhat", postalCode: "5500", postalArea: "Lalmonirhat Sadar" },
      { name: "Nilphamari", postalCode: "5300", postalArea: "Nilphamari Sadar" },
      { name: "Panchagarh", postalCode: "5000", postalArea: "Panchagarh Sadar" },
      { name: "Rangpur", postalCode: "5400", postalArea: "Rangpur GPO" },
      { name: "Thakurgaon", postalCode: "5100", postalArea: "Thakurgaon Sadar" },
    ],
  },
  {
    name: "Mymensingh Division",
    districts: [
      { name: "Jamalpur", postalCode: "2000", postalArea: "Jamalpur Sadar" },
      { name: "Mymensingh", postalCode: "2200", postalArea: "Mymensingh GPO" },
      { name: "Netrokona", postalCode: "2400", postalArea: "Netrokona Sadar" },
      { name: "Sherpur", postalCode: "2100", postalArea: "Sherpur Sadar" },
    ],
  },
] as const;

export type BangladeshDivisionName = (typeof BANGLADESH_DIVISIONS)[number]["name"];

export function getBangladeshDivision(name: string) {
  return BANGLADESH_DIVISIONS.find((division) => division.name === name);
}

export function getBangladeshDistrict(divisionName: string, districtName: string) {
  return getBangladeshDivision(divisionName)?.districts.find(
    (district) => district.name === districtName,
  );
}

export function isBangladeshDivision(name: string): name is BangladeshDivisionName {
  return BANGLADESH_DIVISIONS.some((division) => division.name === name);
}

export function isBangladeshDistrict(divisionName: string, districtName: string): boolean {
  return getBangladeshDistrict(divisionName, districtName) !== undefined;
}
