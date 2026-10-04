/**
 * Legal & help content — English + বাংলা.
 *
 * Every document is written for parents, not lawyers: short sentences, no
 * jargon, and the same friendly tone the rest of the storefront uses. Both
 * languages are exported from this one file so the pages, the footer and any
 * future footer/email templates stay in sync.
 *
 * Prices in the shipping policy follow the client's taka policy (free over
 * ৳500, otherwise ৳60) — see the README for how that relates to the demo
 * storefront's USD formatting.
 */

export type LegalLang = "en" | "bn";

export interface LegalSection {
  /** Stable id — used for the accordion's aria wiring. */
  id: string;
  /** Section heading (shown next to the icon). */
  title: string;
  /** Emoji shown in the round chip. */
  icon: string;
  paragraphs: string[];
}

export interface LegalDoc {
  /** Page heading. */
  title: string;
  /** One-line warm intro under the heading. */
  subtitle: string;
  sections: LegalSection[];
  /** Closing line shown next to the "last updated" stamp. */
  footerNote: string;
}

export interface LegalContent {
  en: LegalDoc;
  bn: LegalDoc;
}

export interface LegalMeta {
  slug: string;
  /** English label used in the footer and page titles. */
  label: string;
  /** Bengali label. */
  labelBn: string;
}

export const LEGAL_DOCS = {
  terms: { slug: "terms", label: "Terms & Conditions", labelBn: "শর্তাবলী" },
  returns: { slug: "returns", label: "Return Policy", labelBn: "রিটার্ন পলিসি" },
  privacy: { slug: "privacy", label: "Privacy Policy", labelBn: "গোপনীয়তা নীতি" },
  shipping: { slug: "shipping", label: "Shipping Info", labelBn: "শিপিং তথ্য" },
  faq: { slug: "faq", label: "FAQ", labelBn: "সাধারণ প্রশ্ন" },
} as const satisfies Readonly<Record<string, LegalMeta>>;

/** Both languages must agree on the date; kept next to the copy on purpose. */
export const LEGAL_UPDATED: Readonly<Record<LegalLang, string>> = {
  en: "Last updated: 4 October 2026",
  bn: "সর্বশেষ হালনাগাদ: ৪ অক্টোবর ২০২৬",
};

export const LEGAL_CONTACT = {
  email: "hello@littleluxe.com",
  phone: "+880 1707 302038",
} as const;

/* -------------------------------------------------------------------------- */
/*  Terms & Conditions                                                         */
/* -------------------------------------------------------------------------- */

const terms: LegalContent = {
  en: {
    title: "Terms & Conditions",
    subtitle: "The short version: we keep it simple, you shop with confidence. 💛",
    sections: [
      {
        id: "welcome",
        title: "Welcome to Little Luxe!",
        icon: "👋",
        paragraphs: [
          "Thank you for shopping with us. Little Luxe is a small family business that picks comfy, safe and long-lasting clothes for kids — and we treat every order like it is for our own children.",
          "By placing an order you agree to the handful of simple points on this page. Nothing here is meant to catch you out; if anything is unclear, just message us and a real person will explain it.",
        ],
      },
      {
        id: "shopping",
        title: "Shopping With Us",
        icon: "🛍️",
        paragraphs: [
          "Once you place an order we send a confirmation email or SMS with your order number, then a second message when the parcel leaves our hands.",
          "Photos and colours can look slightly different from screen to screen. If a colour is not what you expected, you can send it back within 30 days — that is covered by our Return Policy.",
          "Sometimes a size sells out before your order is packed. If that happens we call you first and offer a swap, a voucher, or a full refund. We never quietly send a substitute.",
        ],
      },
      {
        id: "payments",
        title: "Payments",
        icon: "💳",
        paragraphs: [
          "Cash on Delivery: pay the delivery partner in cash when your parcel arrives. No extra fee, and please keep exact change ready if you can.",
          "bKash, Nagad and Rocket: send the exact amount to the number shown at checkout, add your order number as the reference, then upload a screenshot. Our team checks it within 1–2 hours and confirms your order.",
          "Card payments through SSLCommerz are coming soon. Until then the mobile wallets and cash cover everything.",
          "We never ask for your PIN, OTP or full card number — not by phone, not by email, not by message. Please do not share those with anyone who claims to be us.",
        ],
      },
      {
        id: "delivery",
        title: "Delivery",
        icon: "🚚",
        paragraphs: [
          "Orders placed before 2pm on a working day usually leave our warehouse the same day.",
          "Inside Dhaka your parcel normally arrives in 1–2 working days; everywhere else in Bangladesh it takes 3–5 working days, and 5–7 days for the most remote districts.",
          "Someone should be available to receive the parcel. Delivery partners may call the phone number on your order, so please keep it switched on.",
        ],
      },
      {
        id: "your-info",
        title: "Your Info",
        icon: "🔒",
        paragraphs: [
          "We collect only what we need to deliver your order: your name, phone number, email and address. Nothing more.",
          "We never sell your information, and we share it only with the courier and the payment provider that make your delivery and payment possible.",
          "You can ask us to correct or delete your details at any time — the full picture is in our Privacy Policy.",
        ],
      },
      {
        id: "changes",
        title: "Changes to Terms",
        icon: "📝",
        paragraphs: [
          "When something changes we update this page and change the date at the bottom. If the change is important, we will email our registered customers.",
          "The version on this page is always the one that applies to your order.",
        ],
      },
    ],
    footerNote: "Questions about these terms? Email us — we answer within one working day.",
  },
  bn: {
    title: "শর্তাবলী",
    subtitle: "ছোট করে বললে: আমরা সবকিছু সহজ রাখি, আপনি নিশ্চিন্তে কেনাকাটা করুন। 💛",
    sections: [
      {
        id: "welcome",
        title: "লিটল লাক্সে স্বাগতম!",
        icon: "👋",
        paragraphs: [
          "আমাদের সাথে কেনাকাটার জন্য অনেক ধন্যবাদ। লিটল লাক্স একটি ছোট পারিবারিক ব্যবসা — আমরা বাচ্চাদের জন্য আরামদায়ক, নিরাপদ আর টেকসই পোশাক বাছাই করি, আর প্রতিটি অর্ডারকে নিজের সন্তানের মতো করেই যত্ন করি।",
          "অর্ডার করলেই এই পেজের কয়েকটি সহজ কথা আপনার জন্য প্রযোজ্য হবে। এখানে লুকানো কোনো শর্ত নেই — কিছু বুঝতে অসুবিধা হলে সরাসরি আমাদের মেসেজ দিন, একজন সত্যিকারের মানুষ উত্তর দেবেন।",
        ],
      },
      {
        id: "shopping",
        title: "আমাদের সাথে কেনাকাটা",
        icon: "🛍️",
        paragraphs: [
          "অর্ডার করার পর আমরা ইমেইল বা SMS-এ অর্ডার নম্বর পাঠাই, আর পার্সেল রওনা হওয়ার সময় আরেকটি বার্তা পাঠাই।",
          "স্ক্রিন অনুযায়ী ছবি বা রঙ একটু আলাদা লাগতে পারে। রঙ আপনার প্রত্যাশার মতো না হলে ৩০ দিনের মধ্যে ফেরত পাঠাতে পারবেন — রিটার্ন পলিসিতেই সব বলা আছে।",
          "মাঝে মাঝে পার্সেল প্যাক করার আগেই কোনো সাইজ শেষ হয়ে যায়। তখন আমরা আগে ফোন দিই — চাইলে অন্য সাইজ, ভাউচার কিংবা পুরো টাকা ফেরত। কোনো দিন চুপচাপ অন্য পণ্য পাঠাই না।",
        ],
      },
      {
        id: "payments",
        title: "পেমেন্ট পদ্ধতি",
        icon: "💳",
        paragraphs: [
          "ক্যাশ অন ডেলিভারি: পার্সেল হাতে পেয়ে নগদ টাকা দেবেন। বাড়তি কোনো ফি নেই — সম্ভব হলে খুচরা টাকা প্রস্তুত রাখুন।",
          "বিকাশ, নগদ ও রকেট: checkout-এ দেখানো নম্বরে ঠিক পরিমাণ টাকা পাঠান, রেফারেন্সে অর্ডার নম্বর দিন, তারপর স্ক্রিনশট আপলোড করুন। ১–২ ঘণ্টার মধ্যে আমাদের টিম যাচাই করে অর্ডার কনফার্ম করে।",
          "SSLCommerz-এর মাধ্যমে কার্ড পেমেন্ট শিগগিরই আসছে। ততদিন মোবাইল ওয়ালেট আর নগদ — দুটোই আছে।",
          "আমরা কখনোই আপনার PIN, OTP বা কার্ডের নম্বর চাই না — না ফোনে, না ইমেইলে, না মেসেজে। নিজেকে আমাদের পরিচয় দিয়ে কেউ এসব চাইলে তাকে কিছু দেবেন না।",
        ],
      },
      {
        id: "delivery",
        title: "ডেলিভারি",
        icon: "🚚",
        paragraphs: [
          "কাজের দিনে দুপুর ২টার আগে অর্ডার সাধারণত ওই দিনই আমাদের গুদাম থেকে বেরিয়ে যায়।",
          "ঢাকার ভিতরে পার্সেল পৌঁছাতে সাধারণত ১–২ কর্মদিবস লাগে; ঢাকার বাইরে সারা বাংলাদেশে ৩–৫ কর্মদিবস, আর দূরের জেলায় ৫–৭ দিন।",
          "পার্সেল নেওয়ার জন্য কেউ বাড়িতে থাকা ভালো। অর্ডারে দেওয়া ফোন নম্বরে ডেলিভারি পার্টনার কল করতে পারেন, তাই নম্বরটি চালু রাখুন।",
        ],
      },
      {
        id: "your-info",
        title: "আপনার তথ্য",
        icon: "🔒",
        paragraphs: [
          "অর্ডার পৌঁছে দিতে যতটুকু দরকার ঠিক ততটুকুই নিই — নাম, ফোন নম্বর, ইমেইল আর ঠিকানা। এর বেশি কিছু নয়।",
          "আমরা কখনোই আপনার তথ্য বিক্রি করি না। শুধু কুরিয়ার আর পেমেন্ট সার্ভিসের সাথে শেয়ার করি, যাতে ডেলিভারি আর পেমেন্ট সম্ভব হয়।",
          "যেকোনো সময় আমাদের বলতে পারেন তথ্য ঠিক করতে বা মুছে ফেলতে — বিস্তারিত গোপনীয়তা নীতিতে।",
        ],
      },
      {
        id: "changes",
        title: "শর্তাবলী পরিবর্তন",
        icon: "📝",
        paragraphs: [
          "কোনো কিছু বদলালে আমরা এই পেজ হালনাগাদ করি আর নিচের তারিখটি বদলে দিই। গুরুত্বপূর্ণ পরিবর্তন হলে ইমেইল করে জানাই।",
          "আপনার অর্ডারের ক্ষেত্রে এই পেজে থাকা সর্বশেষ সংস্করণটিই প্রযোজ্য।",
        ],
      },
    ],
    footerNote: "শর্ত নিয়ে কিছু জানতে চান? ইমেইল করুন — এক কর্মদিবসের মধ্যে উত্তর পাবেন।",
  },
};

/* -------------------------------------------------------------------------- */
/*  Return & refund policy                                                     */
/* -------------------------------------------------------------------------- */

const returns: LegalContent = {
  en: {
    title: "Return & Refund Policy",
    subtitle: "30 days to change your mind — returns are meant to be easy. 🔄",
    sections: [
      {
        id: "easy-returns",
        title: "Returns Made Easy",
        icon: "🔄",
        paragraphs: [
          "You have 30 days from the day your parcel arrives to start a return. That is longer than most shops, because kids grow overnight and sizes can surprise us all.",
          "Items should be unworn, unwashed and still have their tags on. If something does not fit, do not worry — just get in touch before the last day.",
        ],
      },
      {
        id: "can-return",
        title: "What Can Be Returned",
        icon: "✅",
        paragraphs: [
          "Clothing, shoes, bags and accessories that are unused, unwashed and still have their original tags and packaging.",
          "Items that arrived damaged, stained or different from what you ordered — send us a photo and we fix it straight away.",
          "A size or colour that simply did not work out, as long as it is within the 30-day window.",
        ],
      },
      {
        id: "cannot-return",
        title: "What Can't Be Returned",
        icon: "🚫",
        paragraphs: [
          "Innerwear, underwear, swimwear and earrings — for hygiene reasons these cannot be returned once the packaging is opened.",
          "Customised or personalised items, such as a name printed on a shirt or a made-to-measure outfit.",
          "Gift cards, and items marked “final sale” in a clearance offer.",
          "Anything that has been worn, washed, altered, or has had the tags removed.",
        ],
      },
      {
        id: "how-to-return",
        title: "How to Return",
        icon: "📦",
        paragraphs: [
          "1. Message us on email, WhatsApp or Instagram with your order number and a photo of the item.",
          "2. We reply within one working day with a return confirmation and the pickup address.",
          "3. Pack the item in its original packaging with the tags on.",
          "4. Hand it to our courier or drop it at the address we send you.",
          "5. Once it reaches us we inspect it and start your refund or exchange — you will get an SMS either way.",
        ],
      },
      {
        id: "refund-timeline",
        title: "Refund Timeline",
        icon: "💸",
        paragraphs: [
          "We check returned items within 2 working days of receiving them.",
          "After approval, refunds reach your bKash, Nagad or Rocket wallet within 5–7 working days. Card refunds (once card payments launch) can take up to 10 working days, depending on your bank.",
          "For Cash on Delivery orders we refund through a mobile wallet — just tell us which number to send it to.",
          "Deliveries paid by voucher are refunded as a voucher code with a fresh 12-month validity.",
        ],
      },
      {
        id: "exchanges",
        title: "Exchanges",
        icon: "🔁",
        paragraphs: [
          "Need a different size or colour? The first exchange on an order is free, as long as the item you want is in stock.",
          "If the new size costs more, you pay only the difference. If it costs less, we refund the difference the same way you paid.",
          "To swap again after that, a small ৳60 delivery charge applies — but we will always tell you the cost before doing anything.",
        ],
      },
      {
        id: "damaged-items",
        title: "Damaged Items",
        icon: "📸",
        paragraphs: [
          "Please open your parcel as soon as it arrives. If anything is damaged or wrong, send us a photo within 48 hours and keep the packaging.",
          "We arrange a free pickup and send a replacement immediately, or refund you in full if you prefer. You should not have to pay a taka for our mistake.",
        ],
      },
    ],
    footerNote: "Started a return and heard nothing? Message us with your order number — we will chase it.",
  },
  bn: {
    title: "রিটার্ন ও রিফান্ড পলিসি",
    subtitle: "৩০ দিন সময় আছে — মন বদলালে ফেরত দেওয়া যাবে, খুব সহজে। 🔄",
    sections: [
      {
        id: "easy-returns",
        title: "সহজ রিটার্ন পলিসি",
        icon: "🔄",
        paragraphs: [
          "পার্সেল হাতে পাওয়ার দিন থেকে ৩০ দিন সময় পাবেন রিটার্ন শুরু করার জন্য। বাচ্চারা এক রাতেই বড় হয়ে যায়, সাইজ নিয়ে চমকে যাওয়াটা স্বাভাবিক — তাই সময়টা একটু বেশি রাখা।",
          "পণ্যটি অব্যবহৃত, না ধোয়া এবং ট্যাগসহ থাকলে সবচেয়ে ভালো। সাইজ না মিললে শেষ দিনের আগেই আমাদের জানিয়ে দিন, চিন্তার কিছু নেই।",
        ],
      },
      {
        id: "can-return",
        title: "কী ফেরত দেওয়া যাবে",
        icon: "✅",
        paragraphs: [
          "যে পোশাক, জুতা, ব্যাগ বা অ্যাকসেসরিজ ব্যবহার করা হয়নি, ধোয়া হয়নি, আর ট্যাগ-প্যাকেজিং অটুট আছে।",
          "ক্ষতিগ্রস্ত, দাগযুক্ত বা অর্ডার থেকে আলাদা কিছু পেলে ছবি পাঠান — আমরা সঙ্গে সঙ্গে সমাধান করব।",
          "সাইজ বা রঙ পছন্দ না হলে, ৩০ দিনের মধ্যে যেকোনো সময়।",
        ],
      },
      {
        id: "cannot-return",
        title: "কী ফেরত যাবে না",
        icon: "🚫",
        paragraphs: [
          "ভেতরের পোশাক (ইনারওয়্যার, আন্ডারওয়্যার), সাঁতারের পোশাক এবং কানের দুল — স্বাস্থ্যগত কারণে প্যাকেজ খোলার পর এগুলো ফেরত নেওয়া যায় না।",
          "কাস্টমাইজ বা পার্সোনালাইজ করা পণ্য — যেমন নাম লেখানো শার্ট বা মাপ অনুযায়ী বানানো পোশাক।",
          "গিফট কার্ড এবং ক্লিয়ারেন্স অফারে “ফাইনাল সেল” লেখা পণ্য।",
          "ব্যবহার করা, ধোয়া, বদল করা বা ট্যাগ খুলে ফেলা পণ্য।",
        ],
      },
      {
        id: "how-to-return",
        title: "কীভাবে ফেরত দেবেন",
        icon: "📦",
        paragraphs: [
          "১. ইমেইল, হোয়াটসঅ্যাপ বা ইনস্টাগ্রামে অর্ডার নম্বর আর পণ্যের ছবি পাঠান।",
          "২. এক কর্মদিবসের মধ্যে আমরা রিটার্ন কনফার্মেশন আর পিকআপ ঠিকানা পাঠিয়ে দিই।",
          "৩. ট্যাগসহ পণ্যটি তার আগের প্যাকেজিংয়ে ভরে নিন।",
          "৪. আমাদের কুরিয়ারকে দিয়ে দিন, অথবা আমরা যে ঠিকানা পাঠাই সেখানে রেখে দিন।",
          "৫. পণ্য আমাদের হাতে পৌঁছালে যাচাই করে রিফান্ড বা এক্সচেঞ্জ শুরু করি — SMS-এ জানিয়ে দিই।",
        ],
      },
      {
        id: "refund-timeline",
        title: "টাকা ফেরতের সময়",
        icon: "💸",
        paragraphs: [
          "ফেরত আসা পণ্য পাওয়ার ২ কর্মদিবসের মধ্যে আমরা যাচাই করি।",
          "অনুমোদনের পর ৫–৭ কর্মদিবসের মধ্যে টাকা আপনার বিকাশ, নগদ বা রকেট ওয়ালেটে পৌঁছে যায়। কার্ড পেমেন্ট চালু হলে ব্যাংকের ওপর নির্ভর করে ১০ কর্মদিবস পর্যন্ত লাগতে পারে।",
          "ক্যাশ অন ডেলিভারিতে কেনা পণ্যের টাকা আমরা মোবাইল ওয়ালেটে ফেরত দিই — কোন নম্বরে পাঠাব, শুধু জানিয়ে দিন।",
          "ভাউচারে কেনা অর্ডার নতুন ১২ মাসের ভাউচার কোড হিসেবে ফেরত পাবেন।",
        ],
      },
      {
        id: "exchanges",
        title: "এক্সচেঞ্জ",
        icon: "🔁",
        paragraphs: [
          "অন্য সাইজ বা রঙ দরকার? স্টকে থাকলে একটি অর্ডারে প্রথম এক্সচেঞ্জ সম্পূর্ণ ফ্রি।",
          "নতুন সাইজের দাম বেশি হলে শুধু পার্থক্যটুকু দেবেন; দাম কম হলে যেভাবে পেমেন্ট করেছিলেন সেভাবেই ফেরত পাবেন।",
          "এরপর আবার বদলাতে চাইলে ৳৬০ ডেলিভারি চার্জ যুক্ত হবে — তবে কিছু করার আগেই আমরা খরচটা জানিয়ে দিই।",
        ],
      },
      {
        id: "damaged-items",
        title: "ক্ষতিগ্রস্ত পণ্য",
        icon: "📸",
        paragraphs: [
          "পার্সেল পেয়েই খুলে দেখুন। কিছু নষ্ট বা ভুল থাকলে ৪৮ ঘণ্টার মধ্যে ছবি পাঠান, প্যাকেজটা রেখে দিন।",
          "আমরা ফ্রি পিকআপের ব্যবস্থা করি আর সঙ্গে সঙ্গে রিপ্লেসমেন্ট পাঠাই — চাইলে পুরো টাকা ফেরতও দিই। আমাদের ভুলের জন্য আপনার এক টাকাও খরচ করা উচিত নয়।",
        ],
      },
    ],
    footerNote: "রিটার্ন শুরু করেছেন কিন্তু উত্তর পাচ্ছেন না? অর্ডার নম্বর দিয়ে মেসেজ দিন — আমরা দেখে নেব।",
  },
};

/* -------------------------------------------------------------------------- */
/*  Privacy policy                                                             */
/* -------------------------------------------------------------------------- */

const privacy: LegalContent = {
  en: {
    title: "Privacy Policy",
    subtitle: "Your information is yours. Here is exactly what we do with it. 🔒",
    sections: [
      {
        id: "privacy-matters",
        title: "Your Privacy Matters",
        icon: "🔒",
        paragraphs: [
          "We are parents too, and we do not like being tracked any more than you do. This page explains — in plain words — what we keep, why we keep it, and how you can have it removed.",
          "If anything here is unclear, ask us. We would rather answer a question than have you sent searching through a wall of legal text.",
        ],
      },
      {
        id: "what-we-collect",
        title: "What We Collect",
        icon: "📋",
        paragraphs: [
          "Order details: your name, phone number, email address and delivery address — everything a courier needs.",
          "Account details: your email and an encrypted password if you create an account. We never see your password in plain text.",
          "Payment proof: if you pay by mobile wallet, the screenshot you upload and the wallet number you sent from, so we can match your payment.",
          "How you browse: which pages and products are popular, in aggregate. This helps us stock the right sizes next season.",
        ],
      },
      {
        id: "how-we-use-it",
        title: "How We Use It",
        icon: "🎯",
        paragraphs: [
          "To pack and deliver your order, and to send you delivery updates on the phone number or email you gave us.",
          "To answer your questions and handle returns, exchanges or refunds.",
          "To improve the shop — for example, noticing that a size chart confuses people and fixing it.",
          "That is it. We do not sell your data, and we do not send marketing messages unless you asked for them (and you can unsubscribe with one tap).",
        ],
      },
      {
        id: "who-we-share-with",
        title: "Who We Share With",
        icon: "🤝",
        paragraphs: [
          "Our courier partner sees the name, phone number and address needed to hand over your parcel.",
          "Our payment providers see the payment reference and amount — never your PIN or OTP.",
          "Our email and hosting providers process messages and the website on our behalf, under strict confidentiality.",
          "Nobody else. We do not sell, rent or trade your information with advertisers.",
        ],
      },
      {
        id: "your-rights",
        title: "Your Rights",
        icon: "⚖️",
        paragraphs: [
          "You can ask to see everything we hold about you, ask us to correct a mistake, or ask us to delete your account and order history.",
          "You can also ask us to stop sending marketing emails — though we will still send order and delivery updates, because you need those.",
          "Send the request from the email address on your account and we will act on it within 7 working days.",
        ],
      },
      {
        id: "cookies",
        title: "Cookies",
        icon: "🍪",
        paragraphs: [
          "We use a few small cookies and local storage entries to remember your shopping bag, keep you signed in and understand which pages are useful.",
          "We do not use invasive advertising cookies, and we never follow you around other websites.",
          "You can clear cookies in your browser at any time. Your saved bag and sign-in will reset — everything else keeps working.",
        ],
      },
      {
        id: "contact",
        title: "Contact Us",
        icon: "📧",
        paragraphs: [
          `Email ${LEGAL_CONTACT.email} or call ${LEGAL_CONTACT.phone} (10am–10pm) and a real person will help.`,
          "For anything about your information, write “Privacy” in the subject line so it reaches the right desk quickly.",
        ],
      },
    ],
    footerNote: "We keep this policy short on purpose. If a sentence is hard to read, tell us and we will rewrite it.",
  },
  bn: {
    title: "গোপনীয়তা নীতি",
    subtitle: "আপনার তথ্য আপনারই। আমরা কী করি, তা একদম সোজা কথায়। 🔒",
    sections: [
      {
        id: "privacy-matters",
        title: "আপনার গোপনীয়তা গুরুত্বপূর্ণ",
        icon: "🔒",
        paragraphs: [
          "আমরাও বাবা-মা, তাই আমাদেরও পছন্দ নয় কেউ আমাদের পিছু নিয়ে ঘোরাঘুরি করুক। এই পেজে সহজ ভাষায় বলা আছে — কোন তথ্য রাখি, কেন রাখি, আর কীভাবে মুছে ফেলাতে পারবেন।",
          "কিছু বুঝতে অসুবিধা হলে জিজ্ঞেস করুন। লম্বা আইনি লেখার ভেতরে আপনাকে খুঁজতে পাঠানোর চেয়ে প্রশ্নের উত্তর দেওয়াই আমরা পছন্দ করি।",
        ],
      },
      {
        id: "what-we-collect",
        title: "আমরা কী তথ্য নিই",
        icon: "📋",
        paragraphs: [
          "অর্ডারের তথ্য: নাম, ফোন নম্বর, ইমেইল আর ডেলিভারির ঠিকানা — কুরিয়ারের যা যা দরকার।",
          "অ্যাকাউন্টের তথ্য: ইমেইল আর এনক্রিপ্ট করা পাসওয়ার্ড। আপনার পাসওয়ার্ড আমরা কখনো সোজা ভাষায় দেখতে পাই না।",
          "পেমেন্টের প্রমাণ: মোবাইল ওয়ালেটে পেমেন্ট করলে আপনার আপলোড করা স্ক্রিনশট আর যে নম্বর থেকে পাঠিয়েছেন, যাতে টাকা মিলিয়ে দেখতে পারি।",
          "কী দেখছেন: কোন পেজ ও পণ্য বেশি দেখা হচ্ছে — একসাথে মিলিয়ে, কারও নাম ছাড়াই। এতে পরের সিজনে সঠিক সাইজ মজুত করতে পারি।",
        ],
      },
      {
        id: "how-we-use-it",
        title: "তথ্য কীভাবে ব্যবহার করি",
        icon: "🎯",
        paragraphs: [
          "অর্ডার প্যাক করে পাঠাতে, আর আপনি যে নম্বর বা ইমেইল দিয়েছেন সেখানে ডেলিভারির খবর জানাতে।",
          "আপনার প্রশ্নের উত্তর দিতে এবং রিটার্ন, এক্সচেঞ্জ কিংবা রিফান্ড সামলাতে।",
          "দোকান আরও ভালো করতে — যেমন ধরুন, সাইজ চার্ট দেখে অনেকেই বিভ্রান্ত হচ্ছেন, সেটা ঠিক করা।",
          "ব্যস। আমরা আপনার তথ্য বিক্রি করি না, আর আপনি না চাইলে কোনো প্রচারমূলক বার্তা পাঠাই না (চাইলে এক ট্যাপেই বন্ধ করা যায়)।",
        ],
      },
      {
        id: "who-we-share-with",
        title: "কার সাথে শেয়ার করি",
        icon: "🤝",
        paragraphs: [
          "আমাদের কুরিয়ার শুধু নাম, ফোন নম্বর আর ঠিকানা দেখে — পার্সেল পৌঁছে দিতে যা দরকার।",
          "পেমেন্ট সার্ভিস দেখে রেফারেন্স আর টাকার পরিমাণ — আপনার PIN বা OTP কখনো নয়।",
          "ইমেইল ও হোস্টিং সার্ভিস আমাদের হয়ে বার্তা ও ওয়েবসাইট চালায়, কঠোর গোপনীয়তার চুক্তিতে।",
          "এর বাইরে আর কেউ নয়। বিজ্ঞাপনদাতাদের কাছে আমরা তথ্য বিক্রি, ভাড়া বা বদল করি না।",
        ],
      },
      {
        id: "your-rights",
        title: "আপনার অধিকার",
        icon: "⚖️",
        paragraphs: [
          "আপনার সম্পর্কে আমরা কী তথ্য রেখেছি জানতে চাইতে পারেন, ভুল থাকলে ঠিক করতে বলতে পারেন, আবার অ্যাকাউন্ট ও অর্ডারের ইতিহাস মুছতেও বলতে পারেন।",
          "প্রচারমূলক ইমেইল বন্ধ করতেও বলতে পারেন — তবে অর্ডার ও ডেলিভারির খবর তো দরকার, তাই সেগুলো পাঠাতেই হবে।",
          "অ্যাকাউন্টের ইমেইল থেকে অনুরোধ পাঠালে আমরা ৭ কর্মদিবসের মধ্যে ব্যবস্থা নিই।",
        ],
      },
      {
        id: "cookies",
        title: "কুকিজ",
        icon: "🍪",
        paragraphs: [
          "কয়েকটি ছোট কুকি আর ব্রাউজার স্টোরেজ ব্যবহার করি — আপনার কার্ট মনে রাখতে, লগইন ধরে রাখতে আর কোন পেজ কাজে আসছে বুঝতে।",
          "আমরা বিরক্তিকর বিজ্ঞাপনের কুকি ব্যবহার করি না, আর অন্য ওয়েবসাইটে গিয়ে আপনার পিছু নিই না।",
          "ব্রাউজার থেকে যখন চান কুকি মুছে ফেলতে পারেন। তখন সংরক্ষিত কার্ট আর লগইন রিসেট হবে — বাকি সব ঠিকঠাক চলবে।",
        ],
      },
      {
        id: "contact",
        title: "যোগাযোগ",
        icon: "📧",
        paragraphs: [
          `${LEGAL_CONTACT.email} ইমেইল করুন বা ${LEGAL_CONTACT.phone} নম্বরে কল দিন (সকাল ১০টা – রাত ১০টা) — একজন সত্যিকারের মানুষ সাহায্য করবেন।`,
          "তথ্য সংক্রান্ত কোনো বিষয়ে হলে সাবজেক্টে “Privacy” লিখুন, যাতে দ্রুত সঠিক ডেস্কে পৌঁছায়।",
        ],
      },
    ],
    footerNote: "ইচ্ছে করেই এই নীতিটি ছোট রেখেছি। কোনো লাইন পড়তে কষ্ট হলে জানান, আমরা নতুন করে লিখে দেব।",
  },
};

/* -------------------------------------------------------------------------- */
/*  Shipping policy                                                            */
/* -------------------------------------------------------------------------- */

const shipping: LegalContent = {
  en: {
    title: "Shipping Information",
    subtitle: "Packed with care, delivered fast — across all of Bangladesh. 🚚",
    sections: [
      {
        id: "fast-delivery",
        title: "Fast & Reliable Delivery",
        icon: "🚚",
        paragraphs: [
          "Every parcel is checked by hand, wrapped in recycled tissue and sealed before it leaves us. Fragile items travel with extra padding.",
          "Orders placed before 2pm on a working day are handed to the courier the same day. Weekend orders leave on Sunday morning.",
        ],
      },
      {
        id: "delivery-areas",
        title: "Delivery Areas",
        icon: "🗺️",
        paragraphs: [
          "We deliver to all 64 districts of Bangladesh — cities, towns and Union-level villages included.",
          "Some very remote areas can only be reached by a district-branch pickup. If that applies to your address, our team will call you and arrange it before shipping.",
        ],
      },
      {
        id: "delivery-times",
        title: "Delivery Times",
        icon: "⏱️",
        paragraphs: [
          "Inside Dhaka city: 1–2 working days.",
          "Outside Dhaka, anywhere in Bangladesh: 3–5 working days.",
          "Very remote or island districts: 5–7 working days.",
          "During Eid, Puja and the winter sale peak, add one or two days — we will always tell you if your order is affected.",
        ],
      },
      {
        id: "shipping-costs",
        title: "Shipping Costs",
        icon: "💰",
        paragraphs: [
          "Delivery is free on orders over ৳500.",
          "Below that, a flat ৳60 delivery charge applies anywhere in Bangladesh — city or village, same price.",
          "Cash on Delivery costs nothing extra. There is no handling fee and no hidden charge added later.",
        ],
      },
      {
        id: "tracking",
        title: "Tracking",
        icon: "📍",
        paragraphs: [
          "As soon as your parcel leaves us you get an SMS and an email with a tracking number and the courier's website.",
          "You can also see live status in your account: Dashboard → Orders → the order you want.",
          "If tracking has not moved for 48 hours, message us with your order number — we will chase the courier for you.",
        ],
      },
      {
        id: "international",
        title: "International Delivery",
        icon: "✈️",
        paragraphs: [
          "We do not ship outside Bangladesh yet, but it is next on our list — many of our customers order for family back home.",
          "Join the newsletter at the bottom of this page and you will be the first to know when international shipping opens.",
        ],
      },
    ],
    footerNote: "Delivery looking slow? Send us your order number and we will check with the courier the same day.",
  },
  bn: {
    title: "শিপিং তথ্য",
    subtitle: "যত্নে প্যাক করা, দ্রুত পৌঁছে দেওয়া — সারা বাংলাদেশে। 🚚",
    sections: [
      {
        id: "fast-delivery",
        title: "দ্রুত ও নির্ভরযোগ্য ডেলিভারি",
        icon: "🚚",
        paragraphs: [
          "প্রতিটি পার্সেল হাতে হাতে দেখে, রিসাইকেল করা টিস্যুতে মুড়ে, সিল করে পাঠানো হয়। ভাঙার ভয় থাকলে বাড়তি প্যাডিং দিই।",
          "কাজের দিনে দুপুর ২টার আগে অর্ডার করলে ওই দিনই কুরিয়ারে দেওয়া হয়। ছুটির দিনের অর্ডার রবিবার সকালে রওনা হয়।",
        ],
      },
      {
        id: "delivery-areas",
        title: "ডেলিভারি এলাকা",
        icon: "🗺️",
        paragraphs: [
          "বাংলাদেশের ৬৪ জেলাতেই ডেলিভারি করি — শহর, মফস্বল আর ইউনিয়ন পর্যায়ের গ্রামও এর মধ্যে।",
          "খুব দুর্গম কিছু এলাকায় শুধু জেলা শাখা থেকে গিয়ে নিতে হয়। আপনার ঠিকানা এমন হলে পার্সেল পাঠানোর আগেই আমাদের টিম ফোন করে ব্যবস্থা করে নেবে।",
        ],
      },
      {
        id: "delivery-times",
        title: "ডেলিভারির সময়",
        icon: "⏱️",
        paragraphs: [
          "ঢাকা সিটির ভিতরে: ১–২ কর্মদিবস।",
          "ঢাকার বাইরে সারা বাংলাদেশে: ৩–৫ কর্মদিবস।",
          "খুব দুর্গম বা দ্বীপ জেলায়: ৫–৭ কর্মদিবস।",
          "ঈদ, পূজা বা শীতকালীন সেলের ভিড়ে এক-দুই দিন বেশি লাগতে পারে — আপনার অর্ডারে প্রভাব পড়লে আমরা আগেই জানিয়ে দেব।",
        ],
      },
      {
        id: "shipping-costs",
        title: "শিপিং খরচ",
        icon: "💰",
        paragraphs: [
          "৳৫০০-এর বেশি অর্ডারে ডেলিভারি সম্পূর্ণ ফ্রি।",
          "এর কম হলে সারা বাংলাদেশে একই চার্জ — ৳৬০। শহর কিংবা গ্রাম, দাম একই।",
          "ক্যাশ অন ডেলিভারিতে বাড়তি কোনো খরচ নেই। কোনো হ্যান্ডলিং ফি নেই, পরে লুকানো চার্জও যোগ হয় না।",
        ],
      },
      {
        id: "tracking",
        title: "ট্র্যাকিং",
        icon: "📍",
        paragraphs: [
          "পার্সেল রওনা হওয়ার সঙ্গে সঙ্গে SMS আর ইমেইলে ট্র্যাকিং নম্বর আর কুরিয়ারের ওয়েবসাইট পাঠিয়ে দিই।",
          "অ্যাকাউন্ট থেকেও সরাসরি দেখতে পারবেন: ড্যাশবোর্ড → অর্ডার → নির্দিষ্ট অর্ডার।",
          "৪৮ ঘণ্টা ধরে ট্র্যাকিং না নড়লে অর্ডার নম্বর দিয়ে জানান — আমরা কুরিয়ারের পিছনে লাগব।",
        ],
      },
      {
        id: "international",
        title: "আন্তর্জাতিক ডেলিভারি",
        icon: "✈️",
        paragraphs: [
          "এখনো বাংলাদেশের বাইরে পাঠাই না, তবে পরের তালিকায় এটাই আছে — অনেক গ্রাহক পরিবারের জন্য দেশে অর্ডার করেন।",
          "পেজের নিচে নিউজলেটারে সাবস্ক্রাইব করুন, আন্তর্জাতিক শিপিং চালু হলে সবার আগে জানতে পারবেন।",
        ],
      },
    ],
    footerNote: "ডেলিভারি দেরি হচ্ছে মনে হচ্ছে? অর্ডার নম্বর পাঠান — একই দিনে কুরিয়ারের সাথে কথা বলব।",
  },
};

/* -------------------------------------------------------------------------- */
/*  FAQ                                                                        */
/* -------------------------------------------------------------------------- */

const faq: LegalContent = {
  en: {
    title: "Frequently Asked Questions",
    subtitle: "The twelve questions we get asked most, answered in a sentence or two. 💬",
    sections: [
      {
        id: "place-order",
        title: "How do I place an order?",
        icon: "🛒",
        paragraphs: [
          "Pick what you like, tap “Add to Cart”, then open the bag icon and choose Checkout. Add your name, phone number and address, pick a payment method, and you are done — it takes about a minute.",
          "You can also open Quick View on any product to add it without leaving the shop page.",
        ],
      },
      {
        id: "payment-methods",
        title: "What payment methods do you accept?",
        icon: "💳",
        paragraphs: [
          "Cash on Delivery, bKash, Nagad and Rocket. Card payments through SSLCommerz are coming soon.",
          "For the mobile wallets you send the money to the number shown at checkout, add your order number as the reference, and upload a screenshot so we can confirm quickly.",
        ],
      },
      {
        id: "delivery-time",
        title: "How long will delivery take?",
        icon: "⏱️",
        paragraphs: [
          "Inside Dhaka: 1–2 working days. Everywhere else in Bangladesh: 3–5 working days, and 5–7 days for the most remote districts.",
          "Order before 2pm on a working day and we hand it to the courier the same day.",
        ],
      },
      {
        id: "can-return",
        title: "Can I return something?",
        icon: "🔄",
        paragraphs: [
          "Yes — you have 30 days from delivery. Items should be unworn, unwashed and still have their tags on.",
          "Innerwear, personalised items and “final sale” pieces cannot be returned for hygiene and stock reasons.",
        ],
      },
      {
        id: "track-order",
        title: "How do I track my order?",
        icon: "📍",
        paragraphs: [
          "We text and email you a tracking number the moment the parcel leaves us.",
          "You can also see live status in your account: Dashboard → Orders → the order you want.",
        ],
      },
      {
        id: "outside-dhaka",
        title: "Do you deliver outside Dhaka?",
        icon: "🗺️",
        paragraphs: [
          "Yes — to all 64 districts, including towns and villages at Union level.",
          "A few very remote areas need a district-branch pickup; if that is your address, we call you before shipping to arrange it.",
        ],
      },
      {
        id: "kid-safe",
        title: "Are the clothes safe for kids?",
        icon: "🌿",
        paragraphs: [
          "Everything is made from soft, skin-friendly fabric — mostly organic cotton — with OEKO-TEX certified dyes and no harsh chemicals.",
          "Buttons are stitched extra tight and seams are flat, so there is nothing scratchy to complain about. For children under three, please keep the usual adult supervision.",
        ],
      },
      {
        id: "right-size",
        title: "How do I know the right size?",
        icon: "📏",
        paragraphs: [
          "Every product page has a size chart with age ranges in years and chest/length measurements in inches.",
          "When in doubt, size up — kids grow fast and a slightly loose dress or tee lasts a season longer. Still unsure? Message us with your child's age and height and we will suggest a size.",
        ],
      },
      {
        id: "exchange-size",
        title: "Can I exchange for a different size?",
        icon: "🔁",
        paragraphs: [
          "Yes — the first exchange on an order is free if the size you want is in stock.",
          "If the new size costs more you pay only the difference; if it costs less we refund the difference the same way you paid.",
        ],
      },
      {
        id: "cod",
        title: "Is Cash on Delivery available?",
        icon: "💵",
        paragraphs: [
          "Yes — anywhere in Bangladesh. You pay the delivery partner in cash when the parcel reaches you, with no extra fee.",
          "Keeping exact change ready helps the courier hand over your parcel faster.",
        ],
      },
      {
        id: "support",
        title: "How do I contact support?",
        icon: "📞",
        paragraphs: [
          `Email ${LEGAL_CONTACT.email} or call ${LEGAL_CONTACT.phone} between 10am and 10pm, any day.`,
          "You can also send us a direct message on Instagram or WhatsApp — we reply within one working day, usually much sooner.",
        ],
      },
      {
        id: "gift-wrap",
        title: "Do you offer gift wrapping?",
        icon: "🎁",
        paragraphs: [
          "Yes — tick “Gift wrap” at checkout for a small ৳60 charge... in the demo store it adds $3.99. Your order arrives in kraft paper with a ribbon and a hand-written note, and the price is hidden.",
          "Add the message you would like on the note in the order notes box. Birthdays, baby showers and Eid gifts are our favourite ones to pack.",
        ],
      },
    ],
    footerNote: "Not answered here? Email or call us — a real person replies within one working day.",
  },
  bn: {
    title: "সাধারণ জিজ্ঞাসা",
    subtitle: "সবচেয়ে বেশি যে বারোটি প্রশ্ন আসে, এক-দুই বাক্যে উত্তর। 💬",
    sections: [
      {
        id: "place-order",
        title: "কীভাবে অর্ডার করব?",
        icon: "🛒",
        paragraphs: [
          "পছন্দের পণ্য বেছে নিয়ে “Add to Cart” চাপুন, তারপর ব্যাগ আইকনে গিয়ে Checkout বেছে নিন। নাম, ফোন নম্বর আর ঠিকানা দিয়ে পেমেন্ট পদ্ধতি বাছলেই কাজ শেষ — এক মিনিটের ব্যাপার।",
          "শপ পেজ না ছেড়েই অর্ডার করতে চাইলে যেকোনো পণ্যে Quick View খুলে যোগ করতে পারেন।",
        ],
      },
      {
        id: "payment-methods",
        title: "কোন কোন উপায়ে পেমেন্ট করা যায়?",
        icon: "💳",
        paragraphs: [
          "ক্যাশ অন ডেলিভারি, বিকাশ, নগদ আর রকেট। SSLCommerz-এর কার্ড পেমেন্ট শিগগিরই আসছে।",
          "মোবাইল ওয়ালেটে checkout-এ দেখানো নম্বরে টাকা পাঠাবেন, রেফারেন্সে অর্ডার নম্বর দেবেন, আর দ্রুত কনফার্মেশনের জন্য স্ক্রিনশট আপলোড করবেন।",
        ],
      },
      {
        id: "delivery-time",
        title: "ডেলিভারিতে কত সময় লাগে?",
        icon: "⏱️",
        paragraphs: [
          "ঢাকার ভিতরে ১–২ কর্মদিবস। সারা বাংলাদেশে ৩–৫ কর্মদিবস, খুব দুর্গম জেলায় ৫–৭ দিন।",
          "কাজের দিনে দুপুর ২টার আগে অর্ডার করলে সেদিনই কুরিয়ারে দিয়ে দিই।",
        ],
      },
      {
        id: "can-return",
        title: "পণ্য ফেরত দেওয়া যাবে?",
        icon: "🔄",
        paragraphs: [
          "হ্যাঁ — ডেলিভারির দিন থেকে ৩০ দিন সময় পাবেন। পণ্য অব্যবহৃত, না ধোয়া আর ট্যাগসহ থাকা দরকার।",
          "স্বাস্থ্য ও স্টকের কারণে ভেতরের পোশাক, কাস্টমাইজ করা পণ্য এবং “ফাইনাল সেল” পণ্য ফেরত নেওয়া হয় না।",
        ],
      },
      {
        id: "track-order",
        title: "অর্ডার ট্র্যাক করব কীভাবে?",
        icon: "📍",
        paragraphs: [
          "পার্সেল রওনা হওয়ার সঙ্গে সঙ্গে SMS আর ইমেইলে ট্র্যাকিং নম্বর পাবেন।",
          "অ্যাকাউন্টের ড্যাশবোর্ড → অর্ডার থেকেও সরাসরি অবস্থা দেখতে পারবেন।",
        ],
      },
      {
        id: "outside-dhaka",
        title: "ঢাকার বাইরে ডেলিভারি দেন?",
        icon: "🗺️",
        paragraphs: [
          "হ্যাঁ — ৬৪ জেলাতেই, ইউনিয়ন পর্যায়ের গ্রাম-বাজারসহ।",
          "খুব দুর্গম কিছু এলাকায় জেলা শাখা থেকে সংগ্রহ করতে হয়; আপনার ঠিকানা এমন হলে পাঠানোর আগেই ফোন করে ব্যবস্থা নিই।",
        ],
      },
      {
        id: "kid-safe",
        title: "পোশাক কি বাচ্চাদের জন্য নিরাপদ?",
        icon: "🌿",
        paragraphs: [
          "সব পণ্যই নরম, ত্বকের জন্য আরামদায়ক কাপড়ে — বেশিরভাগ অর্গানিক কটন — OEKO-TEX সনদপ্রাপ্ত রঙ এবং কোনো ক্ষতিকর রাসায়নিক ছাড়া।",
          "বোতামগুলো খুব শক্ত করে সেলাই করা, সিমগুলো সমান — গায়ে খোঁচা লাগার মতো কিছু নেই। তবে তিন বছরের কম বয়সী বাচ্চার ক্ষেত্রে বড়দের নজর রাখা জরুরি।",
        ],
      },
      {
        id: "right-size",
        title: "সঠিক সাইজ কীভাবে বুঝব?",
        icon: "📏",
        paragraphs: [
          "প্রতিটি পণ্যের পেজে সাইজ চার্ট আছে — বয়স (বছরে) আর বুক/লম্বার মাপ (ইঞ্চিতে)।",
          "সন্দেহ হলে এক সাইজ বড় নিন — বাচ্চারা দ্রুত বড় হয়, একটু ঢিলেঢালা পোশাক এক সিজন বেশি চলে। তবুও নিশ্চিত না হলে বাচ্চার বয়স আর উচ্চতা জানিয়ে মেসেজ দিন, আমরা সাইজ বলে দেব।",
        ],
      },
      {
        id: "exchange-size",
        title: "সাইজ বদলানো যাবে?",
        icon: "🔁",
        paragraphs: [
          "হ্যাঁ — চাওয়া সাইজ স্টকে থাকলে একটি অর্ডারে প্রথম এক্সচেঞ্জ সম্পূর্ণ ফ্রি।",
          "নতুন সাইজের দাম বেশি হলে শুধু পার্থক্য দেবেন, কম হলে যেভাবে পেমেন্ট করেছিলেন সেভাবেই ফেরত পাবেন।",
        ],
      },
      {
        id: "cod",
        title: "ক্যাশ অন ডেলিভারি আছে?",
        icon: "💵",
        paragraphs: [
          "হ্যাঁ — সারা বাংলাদেশে। পার্সেল হাতে পেয়ে ডেলিভারি পার্টনারকে নগদ টাকা দেবেন, কোনো বাড়তি ফি নেই।",
          "খুচরা টাকা প্রস্তুত থাকলে পার্সেলটা আরও দ্রুত হাতে পাবেন।",
        ],
      },
      {
        id: "support",
        title: "সাপোর্টে যোগাযোগ করব কীভাবে?",
        icon: "📞",
        paragraphs: [
          `যেকোনো দিন সকাল ১০টা থেকে রাত ১০টার মধ্যে ${LEGAL_CONTACT.email} ইমেইল করুন বা ${LEGAL_CONTACT.phone} নম্বরে কল দিন।`,
          "ইনস্টাগ্রাম বা হোয়াটসঅ্যাপে সরাসরি মেসেজও দিতে পারেন — এক কর্মদিবসের মধ্যে, বেশিরভাগ সময় তারও আগে উত্তর পাবেন।",
        ],
      },
      {
        id: "gift-wrap",
        title: "গিফট র‍্যাপ করা যায়?",
        icon: "🎁",
        paragraphs: [
          "হ্যাঁ — checkout-এ “Gift wrap” টিক দিন, ছোট একটি চার্জ যোগ হবে (ডেমো স্টোরে ৩.৯৯ ডলার)। ক্রাফট কাগজে ফিতা আর হাতে লেখা নোটসহ প্যাক করা হয়, দামের কোনো লেখা থাকে না।",
          "নোটে কী লিখতে চান, অর্ডার নোটের ঘরে লিখে দিন। জন্মদিন, বেবি শাওয়ার আর ঈদের গিফট প্যাক করতে আমাদের সবচেয়ে ভালো লাগে।",
        ],
      },
    ],
    footerNote: "এখানে উত্তর পাননি? ইমেইল বা কল করুন — এক কর্মদিবসের মধ্যে একজন সত্যিকারের মানুষ উত্তর দেবেন।",
  },
};

export const LEGAL_CONTENT: Readonly<Record<LegalDocKey, LegalContent>> = {
  terms,
  returns,
  privacy,
  shipping,
  faq,
};

export type LegalDocKey = keyof typeof LEGAL_DOCS;

/** Convenience helper for pages: `getLegalDoc("terms")`. */
export function getLegalDoc(key: LegalDocKey): LegalContent {
  return LEGAL_CONTENT[key];
}
