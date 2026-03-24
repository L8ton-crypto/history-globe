const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Valid DB categories: roman, medieval, ancient, natural, cultural, industrial, religious
const categoryMap = {
  'medieval': 'medieval',
  'religious': 'religious',
  'roman': 'roman',
  'prehistoric': 'ancient',
  'military': 'cultural',
  'heritage': 'cultural',
  'maritime': 'industrial',
  'archaeological': 'ancient',
};
function mapCat(cat) { return categoryMap[cat] || 'cultural'; }

// Wikidata country codes
// Q29=Spain, Q38=Italy, Q183=Germany, Q55=Netherlands, Q31=Belgium,
// Q45=Portugal, Q36=Poland, Q35=Denmark, Q34=Sweden, Q20=Norway,
// Q40=Austria, Q39=Switzerland, Q41=Greece, Q213=Czech Republic,
// Q28=Hungary, Q218=Romania, Q224=Croatia, Q36=Poland

const countries = [
  {
    name: 'Spain', wd: 'Q29', lang: 'en,es',
    queries: [
      { qname: 'Castles', category: 'medieval', era: 'Medieval', sparql: tpl => `VALUES ?type { wd:Q23413 wd:Q751876 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 1000 },
      { qname: 'Cathedrals', category: 'religious', era: 'Medieval', sparql: tpl => `?item wdt:P31 wd:Q2977 . ?item wdt:P17 ${tpl} .`, limit: 300 },
      { qname: 'Abbeys & Monasteries', category: 'religious', era: 'Medieval', sparql: tpl => `VALUES ?type { wd:Q160742 wd:Q44613 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 500 },
      { qname: 'Churches', category: 'religious', era: 'Heritage', sparql: tpl => `VALUES ?type { wd:Q16970 wd:Q317557 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} . ?item wdt:P18 ?imgFilter .`, limit: 800 },
      { qname: 'Roman Sites', category: 'roman', era: 'Roman', sparql: tpl => `VALUES ?type { wd:Q24354 wd:Q34442 wd:Q41176 wd:Q12277 wd:Q373724 wd:Q474 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 500 },
      { qname: 'Palaces', category: 'cultural', era: 'Renaissance', sparql: tpl => `VALUES ?type { wd:Q16560 wd:Q1802963 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 300 },
      { qname: 'Fortifications', category: 'medieval', era: 'Medieval', sparql: tpl => `VALUES ?type { wd:Q57821 wd:Q3469910 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 300 },
      { qname: 'Lighthouses', category: 'industrial', era: 'Heritage', sparql: tpl => `?item wdt:P31 wd:Q39715 . ?item wdt:P17 ${tpl} .`, limit: 500 },
      { qname: 'Megalithic', category: 'ancient', era: 'Neolithic', sparql: tpl => `VALUES ?type { wd:Q1311670 wd:Q152810 wd:Q179700 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 300 },
      { qname: 'UNESCO', category: 'cultural', era: 'World Heritage', sparql: tpl => `?item wdt:P1435 wd:Q9259 . ?item wdt:P17 ${tpl} .`, limit: 200 },
    ]
  },
  {
    name: 'Italy', wd: 'Q38', lang: 'en,it',
    queries: [
      { qname: 'Castles', category: 'medieval', era: 'Medieval', sparql: tpl => `VALUES ?type { wd:Q23413 wd:Q751876 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 1000 },
      { qname: 'Cathedrals', category: 'religious', era: 'Medieval', sparql: tpl => `?item wdt:P31 wd:Q2977 . ?item wdt:P17 ${tpl} .`, limit: 500 },
      { qname: 'Abbeys & Monasteries', category: 'religious', era: 'Medieval', sparql: tpl => `VALUES ?type { wd:Q160742 wd:Q44613 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 500 },
      { qname: 'Churches', category: 'religious', era: 'Heritage', sparql: tpl => `VALUES ?type { wd:Q16970 wd:Q317557 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} . ?item wdt:P18 ?imgFilter .`, limit: 1000 },
      { qname: 'Roman Sites', category: 'roman', era: 'Roman', sparql: tpl => `VALUES ?type { wd:Q24354 wd:Q34442 wd:Q41176 wd:Q12277 wd:Q373724 wd:Q474 wd:Q839954 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 800 },
      { qname: 'Palaces & Villas', category: 'cultural', era: 'Renaissance', sparql: tpl => `VALUES ?type { wd:Q16560 wd:Q1802963 wd:Q3950 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 500 },
      { qname: 'Fortifications', category: 'medieval', era: 'Medieval', sparql: tpl => `VALUES ?type { wd:Q57821 wd:Q3469910 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 300 },
      { qname: 'Lighthouses', category: 'industrial', era: 'Heritage', sparql: tpl => `?item wdt:P31 wd:Q39715 . ?item wdt:P17 ${tpl} .`, limit: 500 },
      { qname: 'Bridges (historic)', category: 'cultural', era: 'Various', sparql: tpl => `?item wdt:P31 wd:Q12280 . ?item wdt:P17 ${tpl} . ?item wdt:P18 ?imgFilter .`, limit: 300 },
      { qname: 'UNESCO', category: 'cultural', era: 'World Heritage', sparql: tpl => `?item wdt:P1435 wd:Q9259 . ?item wdt:P17 ${tpl} .`, limit: 300 },
    ]
  },
  {
    name: 'Germany', wd: 'Q183', lang: 'en,de',
    queries: [
      { qname: 'Castles', category: 'medieval', era: 'Medieval', sparql: tpl => `VALUES ?type { wd:Q23413 wd:Q751876 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 1500 },
      { qname: 'Cathedrals', category: 'religious', era: 'Medieval', sparql: tpl => `?item wdt:P31 wd:Q2977 . ?item wdt:P17 ${tpl} .`, limit: 300 },
      { qname: 'Abbeys & Monasteries', category: 'religious', era: 'Medieval', sparql: tpl => `VALUES ?type { wd:Q160742 wd:Q44613 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 500 },
      { qname: 'Churches', category: 'religious', era: 'Heritage', sparql: tpl => `VALUES ?type { wd:Q16970 wd:Q317557 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} . ?item wdt:P18 ?imgFilter .`, limit: 800 },
      { qname: 'Palaces', category: 'cultural', era: 'Renaissance / Baroque', sparql: tpl => `VALUES ?type { wd:Q16560 wd:Q1802963 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 300 },
      { qname: 'Fortifications', category: 'medieval', era: 'Medieval', sparql: tpl => `VALUES ?type { wd:Q57821 wd:Q3469910 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 300 },
      { qname: 'Lighthouses', category: 'industrial', era: 'Heritage', sparql: tpl => `?item wdt:P31 wd:Q39715 . ?item wdt:P17 ${tpl} .`, limit: 300 },
      { qname: 'Roman Sites', category: 'roman', era: 'Roman', sparql: tpl => `VALUES ?type { wd:Q24354 wd:Q34442 wd:Q41176 wd:Q12277 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 300 },
      { qname: 'UNESCO', category: 'cultural', era: 'World Heritage', sparql: tpl => `?item wdt:P1435 wd:Q9259 . ?item wdt:P17 ${tpl} .`, limit: 200 },
    ]
  },
  {
    name: 'Portugal', wd: 'Q45', lang: 'en,pt',
    queries: [
      { qname: 'Castles', category: 'medieval', era: 'Medieval', sparql: tpl => `VALUES ?type { wd:Q23413 wd:Q751876 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 500 },
      { qname: 'Cathedrals & Churches', category: 'religious', era: 'Heritage', sparql: tpl => `VALUES ?type { wd:Q2977 wd:Q16970 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} . ?item wdt:P18 ?imgFilter .`, limit: 500 },
      { qname: 'Monasteries', category: 'religious', era: 'Medieval', sparql: tpl => `VALUES ?type { wd:Q160742 wd:Q44613 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 300 },
      { qname: 'Fortifications', category: 'medieval', era: 'Medieval', sparql: tpl => `VALUES ?type { wd:Q57821 wd:Q3469910 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 200 },
      { qname: 'Lighthouses', category: 'industrial', era: 'Heritage', sparql: tpl => `?item wdt:P31 wd:Q39715 . ?item wdt:P17 ${tpl} .`, limit: 300 },
      { qname: 'Palaces', category: 'cultural', era: 'Renaissance', sparql: tpl => `VALUES ?type { wd:Q16560 wd:Q1802963 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 200 },
      { qname: 'Megalithic', category: 'ancient', era: 'Neolithic', sparql: tpl => `VALUES ?type { wd:Q1311670 wd:Q152810 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 200 },
      { qname: 'UNESCO', category: 'cultural', era: 'World Heritage', sparql: tpl => `?item wdt:P1435 wd:Q9259 . ?item wdt:P17 ${tpl} .`, limit: 200 },
    ]
  },
  {
    name: 'Netherlands', wd: 'Q55', lang: 'en,nl',
    queries: [
      { qname: 'Castles', category: 'medieval', era: 'Medieval', sparql: tpl => `VALUES ?type { wd:Q23413 wd:Q751876 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 500 },
      { qname: 'Churches & Cathedrals', category: 'religious', era: 'Heritage', sparql: tpl => `VALUES ?type { wd:Q2977 wd:Q16970 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} . ?item wdt:P18 ?imgFilter .`, limit: 500 },
      { qname: 'Windmills', category: 'industrial', era: 'Heritage', sparql: tpl => `?item wdt:P31 wd:Q38720 . ?item wdt:P17 ${tpl} .`, limit: 500 },
      { qname: 'Lighthouses', category: 'industrial', era: 'Heritage', sparql: tpl => `?item wdt:P31 wd:Q39715 . ?item wdt:P17 ${tpl} .`, limit: 200 },
      { qname: 'Fortifications', category: 'medieval', era: 'Medieval', sparql: tpl => `VALUES ?type { wd:Q57821 wd:Q3469910 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 200 },
      { qname: 'UNESCO', category: 'cultural', era: 'World Heritage', sparql: tpl => `?item wdt:P1435 wd:Q9259 . ?item wdt:P17 ${tpl} .`, limit: 100 },
    ]
  },
  {
    name: 'Belgium', wd: 'Q31', lang: 'en,fr,nl',
    queries: [
      { qname: 'Castles', category: 'medieval', era: 'Medieval', sparql: tpl => `VALUES ?type { wd:Q23413 wd:Q751876 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 500 },
      { qname: 'Churches & Cathedrals', category: 'religious', era: 'Heritage', sparql: tpl => `VALUES ?type { wd:Q2977 wd:Q16970 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} . ?item wdt:P18 ?imgFilter .`, limit: 500 },
      { qname: 'Abbeys', category: 'religious', era: 'Medieval', sparql: tpl => `VALUES ?type { wd:Q160742 wd:Q44613 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 200 },
      { qname: 'War Memorials & Battlefields', category: 'cultural', era: 'Various', sparql: tpl => `VALUES ?type { wd:Q575759 wd:Q4895508 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 300 },
      { qname: 'UNESCO', category: 'cultural', era: 'World Heritage', sparql: tpl => `?item wdt:P1435 wd:Q9259 . ?item wdt:P17 ${tpl} .`, limit: 100 },
    ]
  },
  {
    name: 'Greece', wd: 'Q41', lang: 'en,el',
    queries: [
      { qname: 'Ancient Sites & Temples', category: 'ancient', era: 'Ancient Greek', sparql: tpl => `VALUES ?type { wd:Q44539 wd:Q839954 wd:Q24354 wd:Q41176 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 800 },
      { qname: 'Castles & Fortresses', category: 'medieval', era: 'Medieval / Byzantine', sparql: tpl => `VALUES ?type { wd:Q23413 wd:Q57821 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 500 },
      { qname: 'Churches & Monasteries', category: 'religious', era: 'Byzantine', sparql: tpl => `VALUES ?type { wd:Q16970 wd:Q44613 wd:Q2977 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} . ?item wdt:P18 ?imgFilter .`, limit: 500 },
      { qname: 'Lighthouses', category: 'industrial', era: 'Heritage', sparql: tpl => `?item wdt:P31 wd:Q39715 . ?item wdt:P17 ${tpl} .`, limit: 200 },
      { qname: 'UNESCO', category: 'cultural', era: 'World Heritage', sparql: tpl => `?item wdt:P1435 wd:Q9259 . ?item wdt:P17 ${tpl} .`, limit: 200 },
    ]
  },
  {
    name: 'Austria', wd: 'Q40', lang: 'en,de',
    queries: [
      { qname: 'Castles', category: 'medieval', era: 'Medieval', sparql: tpl => `VALUES ?type { wd:Q23413 wd:Q751876 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 500 },
      { qname: 'Churches & Cathedrals', category: 'religious', era: 'Heritage', sparql: tpl => `VALUES ?type { wd:Q2977 wd:Q16970 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} . ?item wdt:P18 ?imgFilter .`, limit: 500 },
      { qname: 'Abbeys & Monasteries', category: 'religious', era: 'Medieval', sparql: tpl => `VALUES ?type { wd:Q160742 wd:Q44613 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 300 },
      { qname: 'Palaces', category: 'cultural', era: 'Baroque', sparql: tpl => `VALUES ?type { wd:Q16560 wd:Q1802963 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 200 },
      { qname: 'UNESCO', category: 'cultural', era: 'World Heritage', sparql: tpl => `?item wdt:P1435 wd:Q9259 . ?item wdt:P17 ${tpl} .`, limit: 100 },
    ]
  },
  {
    name: 'Switzerland', wd: 'Q39', lang: 'en,de,fr',
    queries: [
      { qname: 'Castles', category: 'medieval', era: 'Medieval', sparql: tpl => `VALUES ?type { wd:Q23413 wd:Q751876 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 500 },
      { qname: 'Churches & Cathedrals', category: 'religious', era: 'Heritage', sparql: tpl => `VALUES ?type { wd:Q2977 wd:Q16970 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} . ?item wdt:P18 ?imgFilter .`, limit: 300 },
      { qname: 'Abbeys', category: 'religious', era: 'Medieval', sparql: tpl => `VALUES ?type { wd:Q160742 wd:Q44613 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 200 },
      { qname: 'UNESCO', category: 'cultural', era: 'World Heritage', sparql: tpl => `?item wdt:P1435 wd:Q9259 . ?item wdt:P17 ${tpl} .`, limit: 100 },
    ]
  },
  {
    name: 'Poland', wd: 'Q36', lang: 'en,pl',
    queries: [
      { qname: 'Castles', category: 'medieval', era: 'Medieval', sparql: tpl => `VALUES ?type { wd:Q23413 wd:Q751876 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 500 },
      { qname: 'Churches & Cathedrals', category: 'religious', era: 'Heritage', sparql: tpl => `VALUES ?type { wd:Q2977 wd:Q16970 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} . ?item wdt:P18 ?imgFilter .`, limit: 500 },
      { qname: 'Palaces', category: 'cultural', era: 'Baroque', sparql: tpl => `VALUES ?type { wd:Q16560 wd:Q1802963 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 200 },
      { qname: 'UNESCO', category: 'cultural', era: 'World Heritage', sparql: tpl => `?item wdt:P1435 wd:Q9259 . ?item wdt:P17 ${tpl} .`, limit: 200 },
    ]
  },
  {
    name: 'Czech Republic', wd: 'Q213', lang: 'en,cs',
    queries: [
      { qname: 'Castles', category: 'medieval', era: 'Medieval', sparql: tpl => `VALUES ?type { wd:Q23413 wd:Q751876 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 500 },
      { qname: 'Churches & Cathedrals', category: 'religious', era: 'Heritage', sparql: tpl => `VALUES ?type { wd:Q2977 wd:Q16970 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} . ?item wdt:P18 ?imgFilter .`, limit: 300 },
      { qname: 'UNESCO', category: 'cultural', era: 'World Heritage', sparql: tpl => `?item wdt:P1435 wd:Q9259 . ?item wdt:P17 ${tpl} .`, limit: 200 },
    ]
  },
  {
    name: 'Denmark', wd: 'Q35', lang: 'en,da',
    queries: [
      { qname: 'Castles', category: 'medieval', era: 'Medieval', sparql: tpl => `VALUES ?type { wd:Q23413 wd:Q751876 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 300 },
      { qname: 'Churches', category: 'religious', era: 'Heritage', sparql: tpl => `VALUES ?type { wd:Q2977 wd:Q16970 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} . ?item wdt:P18 ?imgFilter .`, limit: 300 },
      { qname: 'Megalithic (dolmens)', category: 'ancient', era: 'Neolithic', sparql: tpl => `VALUES ?type { wd:Q1311670 wd:Q152810 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 200 },
      { qname: 'UNESCO', category: 'cultural', era: 'World Heritage', sparql: tpl => `?item wdt:P1435 wd:Q9259 . ?item wdt:P17 ${tpl} .`, limit: 100 },
    ]
  },
  {
    name: 'Sweden', wd: 'Q34', lang: 'en,sv',
    queries: [
      { qname: 'Castles', category: 'medieval', era: 'Medieval', sparql: tpl => `VALUES ?type { wd:Q23413 wd:Q751876 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 300 },
      { qname: 'Churches', category: 'religious', era: 'Heritage', sparql: tpl => `VALUES ?type { wd:Q2977 wd:Q16970 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} . ?item wdt:P18 ?imgFilter .`, limit: 300 },
      { qname: 'Lighthouses', category: 'industrial', era: 'Heritage', sparql: tpl => `?item wdt:P31 wd:Q39715 . ?item wdt:P17 ${tpl} .`, limit: 200 },
      { qname: 'UNESCO', category: 'cultural', era: 'World Heritage', sparql: tpl => `?item wdt:P1435 wd:Q9259 . ?item wdt:P17 ${tpl} .`, limit: 100 },
    ]
  },
  {
    name: 'Norway', wd: 'Q20', lang: 'en,no',
    queries: [
      { qname: 'Castles & Fortresses', category: 'medieval', era: 'Medieval', sparql: tpl => `VALUES ?type { wd:Q23413 wd:Q57821 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 200 },
      { qname: 'Stave Churches', category: 'religious', era: 'Medieval', sparql: tpl => `?item wdt:P31 wd:Q1370598 . ?item wdt:P17 ${tpl} .`, limit: 100 },
      { qname: 'Churches', category: 'religious', era: 'Heritage', sparql: tpl => `VALUES ?type { wd:Q2977 wd:Q16970 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} . ?item wdt:P18 ?imgFilter .`, limit: 300 },
      { qname: 'Lighthouses', category: 'industrial', era: 'Heritage', sparql: tpl => `?item wdt:P31 wd:Q39715 . ?item wdt:P17 ${tpl} .`, limit: 300 },
      { qname: 'UNESCO', category: 'cultural', era: 'World Heritage', sparql: tpl => `?item wdt:P1435 wd:Q9259 . ?item wdt:P17 ${tpl} .`, limit: 100 },
    ]
  },
  {
    name: 'Hungary', wd: 'Q28', lang: 'en,hu',
    queries: [
      { qname: 'Castles', category: 'medieval', era: 'Medieval', sparql: tpl => `VALUES ?type { wd:Q23413 wd:Q751876 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 300 },
      { qname: 'Churches & Cathedrals', category: 'religious', era: 'Heritage', sparql: tpl => `VALUES ?type { wd:Q2977 wd:Q16970 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} . ?item wdt:P18 ?imgFilter .`, limit: 300 },
      { qname: 'UNESCO', category: 'cultural', era: 'World Heritage', sparql: tpl => `?item wdt:P1435 wd:Q9259 . ?item wdt:P17 ${tpl} .`, limit: 100 },
    ]
  },
  {
    name: 'Romania', wd: 'Q218', lang: 'en,ro',
    queries: [
      { qname: 'Castles & Fortresses', category: 'medieval', era: 'Medieval', sparql: tpl => `VALUES ?type { wd:Q23413 wd:Q57821 wd:Q751876 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 300 },
      { qname: 'Churches & Monasteries', category: 'religious', era: 'Heritage', sparql: tpl => `VALUES ?type { wd:Q2977 wd:Q16970 wd:Q44613 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} . ?item wdt:P18 ?imgFilter .`, limit: 300 },
      { qname: 'UNESCO', category: 'cultural', era: 'World Heritage', sparql: tpl => `?item wdt:P1435 wd:Q9259 . ?item wdt:P17 ${tpl} .`, limit: 100 },
    ]
  },
  {
    name: 'Croatia', wd: 'Q224', lang: 'en,hr',
    queries: [
      { qname: 'Castles & Fortresses', category: 'medieval', era: 'Medieval', sparql: tpl => `VALUES ?type { wd:Q23413 wd:Q57821 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 200 },
      { qname: 'Churches', category: 'religious', era: 'Heritage', sparql: tpl => `VALUES ?type { wd:Q2977 wd:Q16970 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} . ?item wdt:P18 ?imgFilter .`, limit: 200 },
      { qname: 'UNESCO', category: 'cultural', era: 'World Heritage', sparql: tpl => `?item wdt:P1435 wd:Q9259 . ?item wdt:P17 ${tpl} .`, limit: 100 },
    ]
  },
  {
    name: 'Turkey', wd: 'Q43', lang: 'en,tr',
    queries: [
      { qname: 'Ancient Sites', category: 'ancient', era: 'Ancient', sparql: tpl => `VALUES ?type { wd:Q839954 wd:Q24354 wd:Q41176 wd:Q44539 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 800 },
      { qname: 'Castles & Fortresses', category: 'medieval', era: 'Medieval / Ottoman', sparql: tpl => `VALUES ?type { wd:Q23413 wd:Q57821 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} .`, limit: 500 },
      { qname: 'Mosques & Churches', category: 'religious', era: 'Heritage', sparql: tpl => `VALUES ?type { wd:Q32815 wd:Q16970 wd:Q2977 } ?item wdt:P31 ?type . ?item wdt:P17 ${tpl} . ?item wdt:P18 ?imgFilter .`, limit: 500 },
      { qname: 'UNESCO', category: 'cultural', era: 'World Heritage', sparql: tpl => `?item wdt:P1435 wd:Q9259 . ?item wdt:P17 ${tpl} .`, limit: 200 },
    ]
  },
];

function buildSparql(q, country) {
  const tpl = `wd:${country.wd}`;
  const body = q.sparql(tpl);
  // If query has imgFilter reference, it requires image
  return `SELECT ?item ?itemLabel ?coord ?image ?article ?desc WHERE {
    ${body}
    ?item wdt:P625 ?coord .
    OPTIONAL { ?item wdt:P18 ?image }
    OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
    OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "en") }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "${country.lang}" }
  } LIMIT ${q.limit}`;
}

function parseCoord(coordStr) {
  const match = coordStr.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
  if (match) return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) };
  return null;
}

async function runQuery(sparql) {
  const url = 'https://query.wikidata.org/sparql';
  const params = new URLSearchParams({ query: sparql, format: 'json' });

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${url}?${params}`, {
        headers: { 'User-Agent': 'HistoryGlobe/1.0 (leightonrice@email.com)' }
      });
      if (res.status === 429) {
        console.error('  Rate limited - waiting 60s...');
        await sleep(60000);
        continue;
      }
      if (!res.ok) {
        console.error(`  Query failed: ${res.status}`);
        if (attempt < 2) { await sleep(10000); continue; }
        return [];
      }
      return await res.json();
    } catch (e) {
      console.error(`  Fetch error: ${e.message}`);
      if (attempt < 2) await sleep(10000);
    }
  }
  return [];
}

async function insertBatch(sites, sourceId, batchLabel) {
  let inserted = 0;
  let errors = 0;
  for (let i = 0; i < sites.length; i++) {
    const s = sites[i];
    try {
      await sql`INSERT INTO hg_sites (
        external_id, name, lat, lng, category, era, short_description,
        wiki_url, image_url, country, significance, source_id, source_ref, geog
      ) VALUES (
        ${'wd-' + s.wikidataId}, ${s.name}, ${s.lat}, ${s.lng},
        ${mapCat(s.category)}, ${s.era},
        ${s.description || 'Historical site in ' + s.country},
        ${s.wikiUrl}, ${s.imageUrl}, ${s.country}, ${3}, ${sourceId},
        ${'https://www.wikidata.org/wiki/' + s.wikidataId},
        ${`SRID=4326;POINT(${s.lng} ${s.lat})`}
      )`;
      inserted++;
    } catch (e) {
      if (!e.message?.includes('duplicate')) {
        errors++;
        if (errors <= 3) console.error(`    Err: ${s.name}: ${e.message?.substring(0, 60)}`);
      }
    }
    if ((i + 1) % 200 === 0) console.log(`    ${i + 1}/${sites.length} (${inserted} inserted)`);
  }
  return { inserted, errors };
}

async function run() {
  console.log('=== Europe Batch Import ===\n');

  const grandBefore = await sql`SELECT COUNT(*) as total FROM hg_sites`;
  console.log(`Starting total: ${grandBefore[0].total} sites\n`);

  for (const country of countries) {
    console.log(`\n🌍 ${country.name.toUpperCase()}`);
    console.log('─'.repeat(40));

    // Check existing
    const existing = await sql`SELECT LOWER(name) as name FROM hg_sites WHERE country = ${country.name}`;
    const existingNames = new Set(existing.map(r => r.name));
    console.log(`  Existing: ${existingNames.size}`);

    // Get or create source
    const srcName = `wikidata-${country.name.toLowerCase().replace(/ /g, '-')}`;
    let sourceRows = await sql`SELECT id FROM hg_sources WHERE name = ${srcName}`;
    if (sourceRows.length === 0) {
      sourceRows = await sql`INSERT INTO hg_sources (name, display_name, url) VALUES (${srcName}, ${'Wikidata (' + country.name + ')'}, 'https://www.wikidata.org') RETURNING id`;
    }
    const sourceId = sourceRows[0].id;

    let allSites = [];
    const globalSeen = new Set();

    for (const q of country.queries) {
      const sparql = buildSparql(q, country);
      console.log(`  ${q.qname}...`);

      const data = await runQuery(sparql);
      if (!data?.results) { console.log('    (no results)'); await sleep(5000); continue; }

      for (const binding of data.results.bindings) {
        const name = binding.itemLabel?.value;
        const coordStr = binding.coord?.value;
        if (!name || !coordStr) continue;

        const coord = parseCoord(coordStr);
        if (!coord) continue;

        const wikidataId = binding.item?.value?.split('/').pop();
        if (globalSeen.has(wikidataId)) continue;
        globalSeen.add(wikidataId);

        if (/^Q\d+$/.test(name)) continue;

        const imageUrl = binding.image?.value || '';
        const wikiArticle = binding.article?.value || '';
        const desc = binding.desc?.value || '';

        allSites.push({
          wikidataId, name, lat: coord.lat, lng: coord.lng,
          category: q.category, era: q.era,
          imageUrl: imageUrl ? imageUrl.replace(/\/\d+px-/, '/500px-') : '',
          wikiUrl: wikiArticle || `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`,
          description: desc, country: country.name
        });
      }

      console.log(`    → ${data.results.bindings.length} raw, ${allSites.length} total unique`);
      await sleep(5000);
    }

    // Dedup
    const toInsert = allSites.filter(s => !existingNames.has(s.name.toLowerCase()));
    console.log(`  Unique: ${allSites.length} | New: ${toInsert.length}`);

    if (toInsert.length > 0) {
      const { inserted, errors } = await insertBatch(toInsert, sourceId, country.name);
      console.log(`  ✅ Inserted: ${inserted} (${errors} errors)`);
    } else {
      console.log('  ✅ Nothing new to insert');
    }

    // Country stats
    const countryTotal = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE country = ${country.name}`;
    const countryImg = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE country = ${country.name} AND image_url IS NOT NULL AND image_url != ''`;
    console.log(`  Total: ${countryTotal[0].total} (${countryImg[0].total} with images)`);

    await sleep(3000);
  }

  // Final stats
  const grandTotal = await sql`SELECT COUNT(*) as total FROM hg_sites`;
  const grandImg = await sql`SELECT COUNT(*) as total FROM hg_sites WHERE image_url IS NOT NULL AND image_url != ''`;
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🏛️ GRAND TOTAL: ${grandTotal[0].total} sites (${grandImg[0].total} with images)`);

  // Per-country breakdown
  const breakdown = await sql`SELECT country, COUNT(*) as total FROM hg_sites GROUP BY country ORDER BY total DESC`;
  console.log('\nCountry breakdown:');
  for (const r of breakdown) {
    console.log(`  ${r.country}: ${r.total}`);
  }
}

run().catch(e => console.error('FATAL:', e));
