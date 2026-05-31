/** Verified business data — sourced from @chhaonstays Instagram scrape & Google listings */

export const SITE = {
  name: 'Chhaon Stays & Cafe',
  shortName: 'Chhaon Stays',
  tagline: 'A shade & shelter for travellers to recharge and refresh.',
  hindiName: 'छाँव',
  url: 'https://chhaonstays.com',
  location: 'Shoja, Tirthan Valley · Himachal Pradesh',
  address: {
    street: 'NH-305, near Achru, Mahadev Devtasthaan',
    locality: 'Shoja',
    region: 'Himachal Pradesh',
    postalCode: '175123',
    country: 'IN',
    full: 'NH-305, near Achru, Mahadev Devtasthaan, Shoja, Banjar Tehsil, Himachal Pradesh 175123',
  },
  geo: { latitude: 31.5672, longitude: 77.3646 },
  phone: '+919625005516',
  phoneDisplay: '+91 96250 05516',
  phoneAlt: '+919953064180',
  phoneAltDisplay: '+91 99530 64180',
  whatsapp: 'https://wa.me/919625005516',
  whatsappBook:
    "https://wa.me/919625005516?text=" +
    encodeURIComponent("Hi Chhaon Stays, I'd like to book a stay. Could you share availability?"),
  instagram: 'https://www.instagram.com/chhaonstays',
  instagramHandle: '@chhaonstays',
  host: { name: 'Amrit', handle: '@pahaad_premi' },
  /** Instagram bio: 3 private rooms, 2 dorms, attic, cafe */
  accommodation: {
    privateRooms: 3,
    dorms: 2,
    features: ['Attic space', 'Mountain-view balconies', 'Cozy cafe'],
  },
  distanceFromJibhi: '3 km',
  ratings: {
    google: { score: '5.0', count: 117 },
    booking: { score: '9.3', count: 31 },
  },
  bookingLinks: [
    { name: 'Booking.com', url: 'https://www.booking.com/hotel/in/chhaon-stays-shoja1.html' },
    { name: 'MakeMyTrip', url: 'https://www.makemytrip.com/hotels/chhaon_stays_shoja-details-jibhi.html' },
    { name: 'Hostelworld', url: 'https://www.hostelworld.com/hostels/p/332673/chhaon-stays/' },
  ],
  cafeHours: { opens: '13:00', closes: '22:00' },
  stayflexi: {
    bookingEngineUrl:
      import.meta.env.VITE_STAYFLEXI_BOOKING_URL ||
      'https://bookingengine.stayflexi.com/?hotel_id=35774',
  },
};

export const IMAGES = {
  hero: '/images/chhaon/Hero.jpg',
  story: ['/images/chhaon/p1.jpg', '/images/chhaon/p2.jpg', '/images/chhaon/p4.jpg'],
  stay: {
    private: '/images/chhaon/p5.jpg',
    dorms: '/images/chhaon/p7.jpg',
    common: '/images/chhaon/p6.jpg',
  },
  cafe: '/images/chhaon/p8.jpg',
  explore: [
    { src: '/images/chhaon/p9.jpg', alt: 'Jalori Pass near Shoja' },
    { src: '/images/chhaon/p2.jpg', alt: 'Raghupur Fort trail' },
    { src: '/images/chhaon/p1.jpg', alt: 'Serolsar Lake trek' },
    { src: '/images/chhaon/p4.jpg', alt: 'Jibhi waterfall' },
    { src: '/images/chhaon/hidden-waterfall.jpg', alt: 'Hidden waterfalls near Shoja' },
  ],
  og: '/images/chhaon/Hero.jpg',
};

export const STAY_OPTIONS = [
  {
    key: 'private',
    title: 'Private Rooms',
    image: IMAGES.stay.private,
    notes: [
      'Mountain-facing rooms with balconies',
      'Heated, clean and spacious',
      'Perfect for couples, solo travellers & families',
    ],
  },
  {
    key: 'dorms',
    title: 'Dorms',
    image: IMAGES.stay.dorms,
    notes: [
      'Clean, comfortable, never congested',
      'Budget-friendly without losing warmth',
      'The best way to meet fellow travellers',
    ],
  },
  {
    key: 'common',
    title: 'Common Spaces',
    image: IMAGES.stay.common,
    notes: [
      'A coworking nook for remote workers',
      'Board games, books, mountain views',
      'A garden for slow mornings',
    ],
  },
];

export const AMENITY_LABELS = [
  'Free Wi-Fi',
  'Hot Showers',
  'Heating',
  'Free Parking',
  'Pet Friendly',
  'Coworking Space',
  'Laundry',
  'Garden',
];

export const MENU_ITEMS = [
  { name: 'Spring Rolls', note: 'legendary, ask anyone' },
  { name: 'Egg Paratha', note: 'morning ritual' },
  { name: 'Caramelised Onion Egg Sandwich', note: 'guest favourite' },
  { name: 'Hot Chocolate', note: 'for cold valleys' },
];

export const EXPLORE_SPOTS = [
  {
    slug: 'jalori-pass',
    title: 'Jalori Pass',
    distance: '3.3 km',
    note: 'A 3,223 m mountain pass with panoramic Himalayan views. Drive or trek.',
    image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=900&q=80',
    span: 'hero',
  },
  {
    slug: 'raghupur-fort',
    title: 'Raghupur Fort',
    distance: 'trail from Jalori',
    note: 'Ancient ruins with 360-degree mountain views.',
    image: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=900&q=80',
    span: 'tall',
  },
  {
    slug: 'serolsar-lake',
    title: 'Serolsar Lake',
    distance: '5 km trek',
    note: 'A serene, mythical lake surrounded by dense forest.',
    image: 'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?auto=format&fit=crop&w=900&q=80',
    span: 'tall',
  },
  {
    slug: 'jibhi-waterfall',
    title: 'Jibhi Waterfall',
    distance: '10 min drive',
    note: 'A refreshing cascade hidden in the forest.',
    image: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=900&q=80',
    span: 'wide',
  },
  {
    slug: 'hidden-waterfalls-shoja',
    title: 'Hidden Waterfalls',
    distance: 'ask Amrit',
    note: 'The ones that are not on Google Maps.',
    image: '/images/chhaon/hidden-waterfall.jpg',
    span: 'wide',
  },
  {
    slug: 'slow-trails-shoja',
    title: 'Sketch Hikes',
    distance: 'anywhere you wander',
    note: 'Bring a sketchbook. Walk into the valley. Draw what you see.',
    image: 'https://images.unsplash.com/photo-1500964757637-c85e8a162699?auto=format&fit=crop&w=900&q=80',
    span: 'wide',
  },
];

export const REVIEWS = [
  {
    text: "Chhaon: Feels like the most warm & cozy corner of your home. This place is made with love and you can feel it in its air. The rooms are spacious, dorms are always clean and don't feel congested. The best part of the stay is its CAFE.",
    name: 'Mouli Jain',
    source: 'Google',
  },
  {
    text: 'As a solo traveller, I felt completely safe. The staff & the host (Amrit) was warm and attentive without being intrusive. Chhaon Stays truly lives up to its name — peaceful, slow, and comforting.',
    name: 'Rishabh Raghuwanshi',
    source: 'Google',
  },
  {
    text: 'Had the most wonderful stay at Chhaon. The hosts were extremely welcoming, warm, and incredibly cooperative. And the food — without a doubt, the best in town.',
    name: 'Ananya Sharma',
    source: 'Booking.com',
  },
  {
    text: 'What truly stood out was the host — warm, helpful, and incredibly thoughtful. Must try their spring rolls, egg paratha and caramelised onion egg sandwich.',
    name: 'be_EXPLORER',
    source: 'Google',
  },
  {
    text: 'A real mountain home. Slow mornings, honest food, and conversations that linger long after you leave. We will come back.',
    name: 'Priya & Karthik',
    source: 'Hostelworld',
  },
];

export const ROUTES = [
  { from: 'Delhi', distance: '~500 km', time: '12–14 hours by road' },
  { from: 'Chandigarh', distance: '~320 km', time: '8–10 hours by road' },
  { from: 'Kullu-Manali Airport (Bhuntar)', distance: '~57 km', time: '~1 hour by taxi' },
  { from: 'Aut (bus stop on NH-21)', distance: '~45 km', time: '~1.5 hours' },
];
