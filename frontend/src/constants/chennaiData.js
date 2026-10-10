/**
 * Chennai Localization Constants and Indian Regional Formatters
 * BloodConnect — College Design Thinking Evaluation
 */

export const CHENNAI_LOCALITIES = [
  'Adyar',
  'Anna Nagar',
  'T. Nagar',
  'Velachery',
  'Tambaram',
  'Guindy',
  'Mylapore',
  'Porur',
  'Perambur',
  'Royapettah',
  'Vadapalani',
  'Sholinganallur',
  'Thoraipakkam',
  'Nungambakkam',
  'Ambattur',
];

export const CHENNAI_MAP_CENTER = [13.0600, 80.2400]; // Central Chennai coordinates
export const CHENNAI_MAP_DEFAULT_ZOOM = 12;

export const CHENNAI_HOSPITALS = [
  {
    name: 'Rajiv Gandhi Govt General Hospital',
    locality: 'Perambur',
    address: 'EVR Periyar Salai, Park Town, Chennai, Tamil Nadu 600003',
    lat: 13.0805,
    lng: 80.2785,
    phone: '+91 44 2530 5000'
  },
  {
    name: 'Government Stanley Hospital',
    locality: 'Perambur',
    address: 'Old Jail Road, Royapuram, Chennai, Tamil Nadu 600001',
    lat: 13.1052,
    lng: 80.2886,
    phone: '+91 44 2528 0900'
  },
  {
    name: 'Apollo Hospitals Greams Road',
    locality: 'Nungambakkam',
    address: '21 Greams Lane, Thousand Lights, Chennai, Tamil Nadu 600006',
    lat: 13.0604,
    lng: 80.2514,
    phone: '+91 44 2829 0200'
  },
  {
    name: 'Fortis Malar Hospital',
    locality: 'Adyar',
    address: '52, 1st Main Rd, Gandhi Nagar, Adyar, Chennai, Tamil Nadu 600020',
    lat: 13.0076,
    lng: 80.2575,
    phone: '+91 44 4289 2222'
  },
  {
    name: 'MIOT International',
    locality: 'Porur',
    address: '4/112, Mount Poonamallee Rd, Manapakkam, Chennai, Tamil Nadu 600089',
    lat: 13.0232,
    lng: 80.1873,
    phone: '+91 44 4200 2288'
  },
  {
    name: 'Sri Ramachandra Medical Centre',
    locality: 'Porur',
    address: 'No.1 Ramachandra Nagar, Porur, Chennai, Tamil Nadu 600116',
    lat: 13.0360,
    lng: 80.1444,
    phone: '+91 44 4592 8500'
  },
  {
    name: 'Rotary Central TTK Blood Bank',
    locality: 'Mylapore',
    address: '130/1, Royapettah High Road, Mylapore, Chennai, Tamil Nadu 600004',
    lat: 13.0425,
    lng: 80.2650,
    phone: '+91 44 2811 0500'
  },
  {
    name: 'SIMS Hospital Vadapalani',
    locality: 'Vadapalani',
    address: 'Metro No. 1, Jawaharlal Nehru Salai, Vadapalani, Chennai, Tamil Nadu 600026',
    lat: 13.0515,
    lng: 80.2105,
    phone: '+91 44 2000 2001'
  }
];

/**
 * Formats a date string into Indian standard date format: DD/MM/YYYY
 * In Asia/Kolkata timezone
 */
export function formatIndianDate(dateInput) {
  if (!dateInput) return '—';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(d);
  } catch (err) {
    return String(dateInput);
  }
}

/**
 * Formats a date string into Indian standard date + time format: DD/MM/YYYY, hh:mm A
 * In Asia/Kolkata timezone
 */
export function formatIndianDateTime(dateInput) {
  if (!dateInput) return '—';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(d);
  } catch (err) {
    return String(dateInput);
  }
}

/**
 * Formats phone number into standard Indian presentation (+91 XXXXX XXXXX)
 */
export function formatIndianPhone(phone) {
  if (!phone) return '+91 94440 12345';
  const clean = String(phone).replace(/\s+/g, '');
  if (clean.startsWith('+91') && clean.length === 13) {
    return `${clean.slice(0, 3)} ${clean.slice(3, 8)} ${clean.slice(8)}`;
  }
  return phone;
}
