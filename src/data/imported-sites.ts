// Auto-imported sites from Cadw and UNESCO APIs
// Loaded from JSON to avoid TypeScript complexity limits with 5000+ entries

import { HistoricalSite } from './sites';
import rawData from './imported-sites.json';

export const importedSites: HistoricalSite[] = rawData as HistoricalSite[];
