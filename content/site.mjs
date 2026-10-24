// ─────────────────────────────────────────────────────────────────────────────
//  SITE CONTENT — edit this file to change your bio, role, links and timeline.
//
//  Rules this file follows:
//   • Only facts you have confirmed. Anything unconfirmed is `null` or has
//     `confirmed: false`, and is marked "TODO".
//   • Preview builds show TODO items as dashed boxes so you can see what's
//     missing. Production builds hide them completely.
//   • Run `npm run build` (preview) or `npm run build:prod` (public site).
// ─────────────────────────────────────────────────────────────────────────────

export default {
  // Public address of the site (no trailing slash). GitHub Pages for now;
  // change to your own domain later, e.g. "https://ajlan.in".
  siteUrl: 'https://ajlan-me.github.io/website',

  // Full name: used in titles, headings and structured data so Google
  // connects searches for "Muhammed Ajlan" with this site.
  name: 'Muhammed Ajlan',
  // Other names people search for. Structured data (alternateName) only,
  // plus one mention in the home page description.
  fullName: ['Ajlan', 'Muhammad Ajlan'],

  // Change to 'Founder & CEO of Navora' once confirmed. Used everywhere.
  role: 'Founder of Navora',

  location: {
    locality: 'Malappuram',
    region: 'Kerala',
    country: 'India',
    countryCode: 'IN',
  },

  headline: 'Building Navora. Sharing the journey.',

  // Home page introduction (2–3 sentences).
  intro:
    "I'm Muhammed Ajlan, a founder from Kerala. I'm building Navora, an app that connects people with the local shops around them. This site is where I share my work, my photos and what I learn along the way.",

  // Small handwritten notes. Keep them short.
  notes: {
    heroHello: "hi, i'm",
    heroSide: 'from Kerala',
    portrait: 'that’s me',
  },

  // ── About page ───────────────────────────────────────────────────────────
  about: {
    // Each string is one paragraph. Written from details you shared earlier.
    // Please read and adjust anything that doesn't sound like you.
    story: [
      "I'm Muhammed Ajlan (most people call me Ajlan), and I'm building Navora from Kerala.",
      'I started out in design. Since 2024 I have worked as a freelance graphic designer and web designer: logos and brand identities, posters and social media creatives, and responsive websites for businesses and startups. That work turned out to be a good base for starting a company, because at the beginning you are the designer, the developer and the person explaining what you are building.',
      "Navora is a marketplace app that connects local stores and brands with the customers around them. I'm building it on my own for now: designing the customer, store and rider apps and writing the code behind them.",
    ],
    kerala:
      'Navora starts in Manjeri. The plan is to grow town by town across Malabar, and then further into Kerala, by working with shops people already know and trust.',
    // TODO: in your own words — why you decided to build Navora.
    motivation: null,
    interests: ['Design', 'Writing', 'Content creation', 'Building apps'],
    tools: ['Figma', 'Photoshop', 'Illustrator', 'Canva', 'HTML', 'CSS', 'JavaScript', 'React', 'Next.js', 'Tailwind CSS', 'Git', 'Flutter', 'NestJS'],
  },

  // ── Design work (from the previous portfolio) ────────────────────────────
  // image = file in content/projects/. url = live link, or null.
  projects: [
    {
      title: 'Enfraa',
      type: 'SaaS platform · UI/UX · Brand identity',
      text: 'A SaaS platform that brings invoicing, inventory and payment tracking into one dashboard. I defined the user experience and the visual design.',
      image: 'enfraa-saas-platform-ui.webp',
      alt: 'Enfraa website homepage with the headline "Simplifying business" next to a dashboard and phone app mockup',
      url: 'https://enfraaofficial.github.io/enfraa-web/',
    },
    {
      title: 'Woodova',
      type: 'Branding · Landing page',
      text: 'Visual identity and a "coming soon" landing page for a handcrafted wooden furniture brand, with an early sign-up flow.',
      image: 'woodova-furniture-brand-landing-page.webp',
      alt: 'Woodova coming-soon page in soft peach tones with the line "Something beautiful is being crafted"',
      url: 'https://enfraaofficial.github.io/Woodova-coming-page/',
    },
    {
      title: 'Nihal Portfolio',
      type: 'Client work · Portfolio website',
      text: 'A one-page portfolio website designed and built for a client, focused on their work and fully responsive.',
      image: 'nihal-portfolio-website.webp',
      alt: 'Homepage of the Nihal portfolio website with a large name title and a photo of Nihal',
      url: 'https://enfraaofficial.github.io/nihal/',
    },
    {
      title: 'Restaurant landing page',
      type: 'UI/UX · Template',
      text: 'A fast single-page template for restaurants, with menu cards and simple reservations.',
      image: 'restaurant-landing-page-template.webp',
      alt: 'Two dark mobile app screens of a restaurant menu showing food dishes and an order button',
      url: null,
    },
    {
      title: 'Logo collection',
      type: 'Brand identity · Logo design',
      text: 'A catalogue of minimalist logos, monogram badges and identity marks.',
      image: 'logo-collection-minimalist-branding.webp',
      alt: 'Grid of minimalist logo designs on a light background titled "Design showcase: minimalist branding"',
      url: null,
    },
  ],

  // ── Founder timeline ─────────────────────────────────────────────────────
  // Only entries with `confirmed: true` appear on the public site.
  // status: 'done' | 'planned'
  timeline: [
    {
      date: '2024',
      title: 'Started freelancing',
      text: 'Began working as a freelance graphic designer and web designer for businesses and startups.',
      status: 'done',
      confirmed: true,
    },
    {
      date: '2026-11-05',
      title: 'Navora public launch',
      text: 'Planned date for opening Navora to the public in Manjeri.',
      status: 'planned',
      confirmed: true,
    },
    {
      // TODO: confirm this date actually happened as planned.
      date: '2026-08-21',
      title: 'Started building the Navora apps',
      text: 'Began the development sprint for the customer, store and rider apps.',
      status: 'done',
      confirmed: false,
    },
    {
      // TODO: confirm Play Store closed testing started on this date.
      date: '2026-10-20',
      title: 'Play Store closed testing',
      text: 'Closed testing of the Android app began.',
      status: 'done',
      confirmed: false,
    },
  ],

  // ── Building Navora page ─────────────────────────────────────────────────
  navora: {
    url: 'https://navoranow.com',
    summary:
      'Navora is a marketplace app that connects local stores and brands with customers. It starts in Manjeri, Kerala, with groceries.',
    howItWorks: [
      'Customers order from nearby shops through the app.',
      'In the first phase, Navora works with local shops that already run their own delivery. Navora connects the order; the shop prepares and delivers it.',
      'The aim is to make everyday ordering reliable in one town first, then grow to the next.',
    ],
    role:
      "I'm the founder and, for now, the whole team. I designed the UI/UX for the customer, store and rider apps, and I'm writing the code for the apps, the backend and the admin panel myself.",
    statusUpdated: '2026-10-24',
    // status: 'done' | 'in-progress' | 'planned'
    milestones: [
      { title: 'UI/UX designs for the customer, store and rider apps', status: 'done' },
      { title: 'Manual test orders with grocery shops in Manjeri', status: 'done' },
      { title: 'Customer, store and rider apps, backend and admin panel', status: 'in-progress' },
      { title: 'Onboarding partner shops in Manjeri', status: 'in-progress' },
      { title: 'Public launch in Manjeri (planned for 5 November 2026)', status: 'planned' },
      { title: 'More towns across Malabar', status: 'planned' },
    ],
    // Approved product screenshots. Add files to content/photos and list them
    // in content/gallery.mjs with category 'Building Navora'.
    // They then appear on this page automatically.
  },

  // ── Links ────────────────────────────────────────────────────────────────
  // Only filled links are shown. Personal profiles listed here go into
  // the Person structured data (sameAs), so add only accounts that are yours.
  links: {
    email: 'ajlancontactme@gmail.com', // from your résumé — change if you prefer another
    linkedin: 'https://www.linkedin.com/in/ajlan-me/',
    instagram: 'https://www.instagram.com/ajlan.co/',
    x: null,
    github: 'https://github.com/ajlan-me',
    portfolio: 'https://ajlan-me.github.io/portfolio/',
  },
  navoraLinks: {
    website: 'https://navoranow.com',
    instagram: 'https://www.instagram.com/navoranow/',
  },

  // The photo used for the hero, social previews and structured data.
  portraitSlug: 'muhammed-ajlan-portrait-light-blue-shirt-grey-backdrop',
};
