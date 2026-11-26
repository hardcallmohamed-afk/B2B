// Catalogue complet des 12 Régions officielles du Maroc & ensemble des villes commerciales Orange Pro B2B.
// Permet :
// 1. La détection automatique de la Ville, de la Grande Ville la plus proche et de la Région à partir des coordonnées GPS (lat, lng).
// 2. La visibilité aux yeux des autres collaborateurs et rôles ("Ville · Région — Disponible Services Orange Pro").
// 3. Le filtrage par Région à part + choix de l'ensemble des villes du Maroc dans toutes les sections de la plateforme.

export interface MoroccanRegionMeta {
  id: string;
  label: string;
  shortLabel: string;
  majorCity: string;
}

export interface MoroccanCityEntry {
  name: string;
  regionId: string;
  regionLabel: string;
  regionShortLabel: string;
  lat: number;
  lng: number;
  isMajorCity: boolean;
}

export const MOROCCO_REGIONS: MoroccanRegionMeta[] = [
  {
    id: 'casablanca_settat',
    label: 'Casablanca-Settat',
    shortLabel: 'Casa-Settat',
    majorCity: 'Casablanca',
  },
  {
    id: 'rabat_sale_kenitra',
    label: 'Rabat-Salé-Kénitra',
    shortLabel: 'Rabat-Salé-Kénitra',
    majorCity: 'Rabat',
  },
  {
    id: 'fes_meknes',
    label: 'Fès-Meknès',
    shortLabel: 'Fès-Meknès',
    majorCity: 'Meknès',
  },
  {
    id: 'tanger_tetouan_al_hoceima',
    label: 'Tanger-Tétouan-Al Hoceïma',
    shortLabel: 'Tanger-Tétouan',
    majorCity: 'Tanger',
  },
  {
    id: 'marrakech_safi',
    label: 'Marrakech-Safi',
    shortLabel: 'Marrakech-Safi',
    majorCity: 'Marrakech',
  },
  {
    id: 'souss_massa',
    label: 'Souss-Massa',
    shortLabel: 'Souss-Massa',
    majorCity: 'Agadir',
  },
  {
    id: 'oriental',
    label: 'L’Oriental',
    shortLabel: 'L’Oriental',
    majorCity: 'Oujda',
  },
  {
    id: 'beni_mellal_khenifra',
    label: 'Béni Mellal-Khénifra',
    shortLabel: 'Béni Mellal-Khénifra',
    majorCity: 'Béni Mellal',
  },
  {
    id: 'draa_tafilalet',
    label: 'Drâa-Tafilalet',
    shortLabel: 'Drâa-Tafilalet',
    majorCity: 'Errachidia',
  },
  {
    id: 'guelmim_oued_noun',
    label: 'Guelmim-Oued Noun',
    shortLabel: 'Guelmim-Oued Noun',
    majorCity: 'Guelmim',
  },
  {
    id: 'laayoune_sakia_el_hamra',
    label: 'Laâyoune-Sakia El Hamra',
    shortLabel: 'Laâyoune',
    majorCity: 'Laâyoune',
  },
  {
    id: 'dakhla_oued_ed_dahab',
    label: 'Dakhla-Oued Ed-Dahab',
    shortLabel: 'Dakhla',
    majorCity: 'Dakhla',
  },
];

const REGION_BY_ID = new Map<string, MoroccanRegionMeta>(
  MOROCCO_REGIONS.map((r) => [r.id, r])
);

interface RawCitySeed {
  name: string;
  regionId: string;
  lat: number;
  lng: number;
  isMajorCity?: boolean;
}

const RAW_MOROCCO_CITIES: RawCitySeed[] = [
  // 1. Fès-Meknès
  { name: 'Meknès', regionId: 'fes_meknes', lat: 33.8935, lng: -5.5473, isMajorCity: true },
  { name: 'Fès', regionId: 'fes_meknes', lat: 34.0331, lng: -5.0003, isMajorCity: true },
  { name: 'El Hajeb', regionId: 'fes_meknes', lat: 33.6878, lng: -5.371 },
  { name: 'Ifrane', regionId: 'fes_meknes', lat: 33.5228, lng: -5.1109 },
  { name: 'Azrou', regionId: 'fes_meknes', lat: 33.4344, lng: -5.2213 },
  { name: 'Sefrou', regionId: 'fes_meknes', lat: 33.8305, lng: -4.8353 },
  { name: 'Taza', regionId: 'fes_meknes', lat: 34.21, lng: -4.01 },
  { name: 'Taounate', regionId: 'fes_meknes', lat: 34.5369, lng: -4.64 },
  { name: 'Boulemane', regionId: 'fes_meknes', lat: 33.3625, lng: -4.73 },
  { name: 'Missour', regionId: 'fes_meknes', lat: 33.0489, lng: -3.9919 },
  { name: 'Moulay Idriss Zerhoun', regionId: 'fes_meknes', lat: 34.0553, lng: -5.5228 },
  { name: 'Boufekrane', regionId: 'fes_meknes', lat: 33.7675, lng: -5.4892 },
  { name: 'Agouraï', regionId: 'fes_meknes', lat: 33.6358, lng: -5.5789 },
  { name: 'Sebaa Ayoune', regionId: 'fes_meknes', lat: 33.8969, lng: -5.3672 },
  { name: 'Imouzzer Kandar', regionId: 'fes_meknes', lat: 33.7322, lng: -5.0156 },

  // 2. Casablanca-Settat
  { name: 'Casablanca', regionId: 'casablanca_settat', lat: 33.5731, lng: -7.5898, isMajorCity: true },
  { name: 'Mohammedia', regionId: 'casablanca_settat', lat: 33.6861, lng: -7.3828, isMajorCity: true },
  { name: 'El Jadida', regionId: 'casablanca_settat', lat: 33.2316, lng: -8.5007, isMajorCity: true },
  { name: 'Settat', regionId: 'casablanca_settat', lat: 33.001, lng: -7.6166, isMajorCity: true },
  { name: 'Berrechid', regionId: 'casablanca_settat', lat: 33.2655, lng: -7.5875 },
  { name: 'Bouskoura', regionId: 'casablanca_settat', lat: 33.4489, lng: -7.6486 },
  { name: 'Nouaceur', regionId: 'casablanca_settat', lat: 33.3667, lng: -7.6167 },
  { name: 'Dar Bouazza', regionId: 'casablanca_settat', lat: 33.5247, lng: -7.8189 },
  { name: 'Médiouna', regionId: 'casablanca_settat', lat: 33.4525, lng: -7.515 },
  { name: 'Benslimane', regionId: 'casablanca_settat', lat: 33.615, lng: -7.1211 },
  { name: 'Bouznika', regionId: 'casablanca_settat', lat: 33.7894, lng: -7.1597 },
  { name: 'Sidi Bennour', regionId: 'casablanca_settat', lat: 32.6522, lng: -8.4275 },
  { name: 'Azemmour', regionId: 'casablanca_settat', lat: 33.2878, lng: -8.3422 },

  // 3. Rabat-Salé-Kénitra
  { name: 'Rabat', regionId: 'rabat_sale_kenitra', lat: 34.0209, lng: -6.8416, isMajorCity: true },
  { name: 'Salé', regionId: 'rabat_sale_kenitra', lat: 34.0531, lng: -6.7985, isMajorCity: true },
  { name: 'Kénitra', regionId: 'rabat_sale_kenitra', lat: 34.261, lng: -6.5802, isMajorCity: true },
  { name: 'Témara', regionId: 'rabat_sale_kenitra', lat: 33.9267, lng: -6.9122, isMajorCity: true },
  { name: 'Skhirat', regionId: 'rabat_sale_kenitra', lat: 33.8544, lng: -7.0317 },
  { name: 'Khémisset', regionId: 'rabat_sale_kenitra', lat: 33.824, lng: -6.0663 },
  { name: 'Tiflet', regionId: 'rabat_sale_kenitra', lat: 33.8947, lng: -6.3064 },
  { name: 'Sidi Kacem', regionId: 'rabat_sale_kenitra', lat: 34.2215, lng: -5.7078 },
  { name: 'Sidi Slimane', regionId: 'rabat_sale_kenitra', lat: 34.2648, lng: -5.926 },
  { name: 'Souk El Arbaa', regionId: 'rabat_sale_kenitra', lat: 34.6858, lng: -5.9989 },
  { name: 'Sidi Yahya El Gharb', regionId: 'rabat_sale_kenitra', lat: 34.3058, lng: -6.3058 },

  // 4. Tanger-Tétouan-Al Hoceïma
  { name: 'Tanger', regionId: 'tanger_tetouan_al_hoceima', lat: 35.7595, lng: -5.834, isMajorCity: true },
  { name: 'Tétouan', regionId: 'tanger_tetouan_al_hoceima', lat: 35.5785, lng: -5.3684, isMajorCity: true },
  { name: 'Al Hoceïma', regionId: 'tanger_tetouan_al_hoceima', lat: 35.2517, lng: -3.9372, isMajorCity: true },
  { name: 'Larache', regionId: 'tanger_tetouan_al_hoceima', lat: 35.1932, lng: -6.1557 },
  { name: 'Ksar El Kébir', regionId: 'tanger_tetouan_al_hoceima', lat: 35.0017, lng: -5.9053 },
  { name: 'Chefchaouen', regionId: 'tanger_tetouan_al_hoceima', lat: 35.1688, lng: -5.2636 },
  { name: 'Fnideq', regionId: 'tanger_tetouan_al_hoceima', lat: 35.8492, lng: -5.3583 },
  { name: 'M’diq', regionId: 'tanger_tetouan_al_hoceima', lat: 35.6858, lng: -5.3253 },
  { name: 'Martil', regionId: 'tanger_tetouan_al_hoceima', lat: 35.6167, lng: -5.2667 },
  { name: 'Asilah', regionId: 'tanger_tetouan_al_hoceima', lat: 35.465, lng: -6.0342 },
  { name: 'Ouezzane', regionId: 'tanger_tetouan_al_hoceima', lat: 34.7972, lng: -5.5822 },

  // 5. Marrakech-Safi
  { name: 'Marrakech', regionId: 'marrakech_safi', lat: 31.6295, lng: -7.9811, isMajorCity: true },
  { name: 'Safi', regionId: 'marrakech_safi', lat: 32.2994, lng: -9.2372, isMajorCity: true },
  { name: 'Essaouira', regionId: 'marrakech_safi', lat: 31.5085, lng: -9.7595, isMajorCity: true },
  { name: 'El Kelâa des Sraghna', regionId: 'marrakech_safi', lat: 32.0481, lng: -7.4083 },
  { name: 'Ben Guerir', regionId: 'marrakech_safi', lat: 32.2358, lng: -7.9533 },
  { name: 'Youssoufia', regionId: 'marrakech_safi', lat: 32.2464, lng: -8.5294 },
  { name: 'Chichaoua', regionId: 'marrakech_safi', lat: 31.5439, lng: -8.7639 },
  { name: 'Tahannaout', regionId: 'marrakech_safi', lat: 31.3519, lng: -7.9511 },

  // 6. Souss-Massa
  { name: 'Agadir', regionId: 'souss_massa', lat: 30.4278, lng: -9.5981, isMajorCity: true },
  { name: 'Inezgane', regionId: 'souss_massa', lat: 30.3558, lng: -9.5364 },
  { name: 'Aït Melloul', regionId: 'souss_massa', lat: 30.3342, lng: -9.4972 },
  { name: 'Taroudant', regionId: 'souss_massa', lat: 30.4703, lng: -8.877 },
  { name: 'Tiznit', regionId: 'souss_massa', lat: 29.6974, lng: -9.7316 },
  { name: 'Oulad Teïma', regionId: 'souss_massa', lat: 30.3947, lng: -9.2089 },
  { name: 'Biougra', regionId: 'souss_massa', lat: 30.2144, lng: -9.3708 },
  { name: 'Tata', regionId: 'souss_massa', lat: 29.7431, lng: -7.9725 },

  // 7. L'Oriental
  { name: 'Oujda', regionId: 'oriental', lat: 34.6814, lng: -1.9086, isMajorCity: true },
  { name: 'Nador', regionId: 'oriental', lat: 35.1681, lng: -2.9335, isMajorCity: true },
  { name: 'Berkane', regionId: 'oriental', lat: 34.92, lng: -2.32 },
  { name: 'Taourirt', regionId: 'oriental', lat: 34.4072, lng: -2.8972 },
  { name: 'Guercif', regionId: 'oriental', lat: 34.2258, lng: -3.3536 },
  { name: 'Jerada', regionId: 'oriental', lat: 34.3117, lng: -2.1619 },
  { name: 'Driouch', regionId: 'oriental', lat: 34.9786, lng: -3.3886 },
  { name: 'Saïdia', regionId: 'oriental', lat: 35.0856, lng: -2.2314 },

  // 8. Béni Mellal-Khénifra
  { name: 'Béni Mellal', regionId: 'beni_mellal_khenifra', lat: 32.3373, lng: -6.3498, isMajorCity: true },
  { name: 'Khouribga', regionId: 'beni_mellal_khenifra', lat: 32.8811, lng: -6.9063, isMajorCity: true },
  { name: 'Khénifra', regionId: 'beni_mellal_khenifra', lat: 32.9391, lng: -5.6686 },
  { name: 'Fquih Ben Salah', regionId: 'beni_mellal_khenifra', lat: 32.5008, lng: -6.6878 },
  { name: 'Azilal', regionId: 'beni_mellal_khenifra', lat: 31.9614, lng: -6.5711 },
  { name: 'Oued Zem', regionId: 'beni_mellal_khenifra', lat: 32.8628, lng: -6.5736 },
  { name: 'Kasba Tadla', regionId: 'beni_mellal_khenifra', lat: 32.5978, lng: -6.2683 },
  { name: 'Souk Sebt Oulad Nemma', regionId: 'beni_mellal_khenifra', lat: 32.2947, lng: -6.7028 },

  // 9. Drâa-Tafilalet
  { name: 'Errachidia', regionId: 'draa_tafilalet', lat: 31.9314, lng: -4.4266, isMajorCity: true },
  { name: 'Ouarzazate', regionId: 'draa_tafilalet', lat: 30.9189, lng: -6.8934, isMajorCity: true },
  { name: 'Midelt', regionId: 'draa_tafilalet', lat: 32.6852, lng: -4.7451 },
  { name: 'Tinghir', regionId: 'draa_tafilalet', lat: 31.5147, lng: -5.5328 },
  { name: 'Zagora', regionId: 'draa_tafilalet', lat: 30.3324, lng: -5.8384 },
  { name: 'Erfoud', regionId: 'draa_tafilalet', lat: 31.4361, lng: -4.2328 },
  { name: 'Rissani', regionId: 'draa_tafilalet', lat: 31.2844, lng: -4.2689 },

  // 10. Guelmim-Oued Noun
  { name: 'Guelmim', regionId: 'guelmim_oued_noun', lat: 28.987, lng: -10.0574, isMajorCity: true },
  { name: 'Tan-Tan', regionId: 'guelmim_oued_noun', lat: 28.438, lng: -11.1032 },
  { name: 'Sidi Ifni', regionId: 'guelmim_oued_noun', lat: 29.3798, lng: -10.173 },
  { name: 'Assa', regionId: 'guelmim_oued_noun', lat: 28.6056, lng: -9.4297 },

  // 11. Laâyoune-Sakia El Hamra
  { name: 'Laâyoune', regionId: 'laayoune_sakia_el_hamra', lat: 27.1536, lng: -13.2033, isMajorCity: true },
  { name: 'Boujdour', regionId: 'laayoune_sakia_el_hamra', lat: 26.1258, lng: -14.4842 },
  { name: 'Tarfaya', regionId: 'laayoune_sakia_el_hamra', lat: 27.9392, lng: -12.9261 },
  { name: 'Es-Semara', regionId: 'laayoune_sakia_el_hamra', lat: 26.7384, lng: -11.6719 },

  // 12. Dakhla-Oued Ed-Dahab
  { name: 'Dakhla', regionId: 'dakhla_oued_ed_dahab', lat: 23.6848, lng: -15.957, isMajorCity: true },
];

export const MOROCCO_CITIES_CATALOG: MoroccanCityEntry[] = RAW_MOROCCO_CITIES.map((c) => {
  const reg = REGION_BY_ID.get(c.regionId) || MOROCCO_REGIONS[2];
  return {
    name: c.name,
    regionId: reg.id,
    regionLabel: reg.label,
    regionShortLabel: reg.shortLabel,
    lat: c.lat,
    lng: c.lng,
    isMajorCity: Boolean(c.isMajorCity),
  };
});

export const ALL_MOROCCO_CITY_NAMES: string[] = MOROCCO_CITIES_CATALOG.map((c) => c.name);

export function normalizeCityKey(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const CITY_BY_NORMALIZED_NAME = new Map<string, MoroccanCityEntry>(
  MOROCCO_CITIES_CATALOG.map((c) => [normalizeCityKey(c.name), c])
);

function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface DetectedLocationGeography {
  nearestCity: string;
  detectedCity: string;
  nearestMajorCity: string;
  regionId: string;
  regionLabel: string;
  regionShortLabel: string;
  regionalCities: string[];
  distanceToCityKm: number;
  distanceToMajorCityKm: number;
  collaboratorPublicZoneLabel: string;
  availabilityBadgeLabel: string;
}

/**
 * Détecte automatiquement la ville, la grande ville la plus proche ("Ville par défaut"),
 * la région administrative et la liste des villes de cette région à partir des coordonnées GPS (lat, lng).
 */
export function detectMoroccoGeographyFromCoordinates(
  lat: number,
  lng: number
): DetectedLocationGeography {
  const safeLat = Number.isFinite(lat) ? lat : 33.8935;
  const safeLng = Number.isFinite(lng) ? lng : -5.5473;

  let nearestCityEntry = MOROCCO_CITIES_CATALOG[0];
  let bestCityDist = Number.POSITIVE_INFINITY;

  let nearestMajorEntry = MOROCCO_CITIES_CATALOG[0];
  let bestMajorDist = Number.POSITIVE_INFINITY;

  for (const entry of MOROCCO_CITIES_CATALOG) {
    const dist = haversineDistanceKm(safeLat, safeLng, entry.lat, entry.lng);
    if (dist < bestCityDist) {
      bestCityDist = dist;
      nearestCityEntry = entry;
    }
    if (entry.isMajorCity && dist < bestMajorDist) {
      bestMajorDist = dist;
      nearestMajorEntry = entry;
    }
  }

  // Also check if there is a major city inside the detected region that is closer or canonical
  const majorInSameRegion = MOROCCO_CITIES_CATALOG.filter(
    (c) => c.regionId === nearestCityEntry.regionId && c.isMajorCity
  );
  if (majorInSameRegion.length > 0) {
    let bestInReg = majorInSameRegion[0];
    let bestInRegDist = Number.POSITIVE_INFINITY;
    for (const m of majorInSameRegion) {
      const d = haversineDistanceKm(safeLat, safeLng, m.lat, m.lng);
      if (d < bestInRegDist) {
        bestInRegDist = d;
        bestInReg = m;
      }
    }
    nearestMajorEntry = bestInReg;
    bestMajorDist = bestInRegDist;
  }

  const regionalCities = MOROCCO_CITIES_CATALOG.filter(
    (c) => c.regionId === nearestCityEntry.regionId
  ).map((c) => c.name);

  return {
    nearestCity: nearestCityEntry.name,
    detectedCity: nearestCityEntry.name,
    nearestMajorCity: nearestMajorEntry.name,
    regionId: nearestCityEntry.regionId,
    regionLabel: nearestCityEntry.regionLabel,
    regionShortLabel: nearestCityEntry.regionShortLabel,
    regionalCities,
    distanceToCityKm: Number(bestCityDist.toFixed(1)),
    distanceToMajorCityKm: Number(bestMajorDist.toFixed(1)),
    collaboratorPublicZoneLabel: `${nearestCityEntry.name} · ${nearestCityEntry.regionLabel}`.slice(0, 100),
    availabilityBadgeLabel: `${nearestCityEntry.name} (${nearestCityEntry.regionShortLabel}) — Disponible Services Orange Pro`,
  };
}

/**
 * Résout la ville, la grande ville et la région à partir d'un texte de zone/ville
 * (ex: "Meknès", "Meknès · Fès-Meknès", "Casablanca").
 */
export function resolveCityAndRegionFromZoneString(rawZoneOrCity?: string): {
  city: string;
  majorCity: string;
  regionId: string;
  regionLabel: string;
  regionShortLabel: string;
  regionalCities: string[];
  formattedZone: string;
  availabilityBadgeLabel: string;
  matched: boolean;
} {
  const raw = (rawZoneOrCity || '').trim();
  const firstSegment = raw.split('·')[0]?.trim() || raw;
  const norm = normalizeCityKey(firstSegment);
  const fullNorm = normalizeCityKey(raw);

  let matched = CITY_BY_NORMALIZED_NAME.get(norm);
  if (!matched) {
    for (const entry of MOROCCO_CITIES_CATALOG) {
      const k = normalizeCityKey(entry.name);
      if (norm.includes(k) || fullNorm.includes(k)) {
        matched = entry;
        break;
      }
    }
  }

  if (!matched) {
    // Check if raw matches a region name
    for (const reg of MOROCCO_REGIONS) {
      const rk = normalizeCityKey(reg.label);
      if (fullNorm.includes(rk)) {
        matched = MOROCCO_CITIES_CATALOG.find(
          (c) => c.regionId === reg.id && c.name === reg.majorCity
        );
        break;
      }
    }
  }

  const fallback = matched || MOROCCO_CITIES_CATALOG[0];
  const regMeta = REGION_BY_ID.get(fallback.regionId) || MOROCCO_REGIONS[2];
  const regionalCities = MOROCCO_CITIES_CATALOG.filter(
    (c) => c.regionId === fallback.regionId
  ).map((c) => c.name);

  // Closest major city in the same region
  const majorInRegion =
    MOROCCO_CITIES_CATALOG.find(
      (c) => c.regionId === fallback.regionId && c.name === fallback.name && c.isMajorCity
    )?.name || regMeta.majorCity;

  const cityLabel = matched ? matched.name : firstSegment || 'Meknès';

  return {
    city: cityLabel,
    majorCity: majorInRegion,
    regionId: fallback.regionId,
    regionLabel: fallback.regionLabel,
    regionShortLabel: fallback.regionShortLabel,
    regionalCities,
    formattedZone: `${cityLabel} · ${fallback.regionLabel}`.slice(0, 100),
    availabilityBadgeLabel: `${cityLabel} (${fallback.regionShortLabel}) — Disponible Services Orange Pro`,
    matched: Boolean(matched),
  };
}

/**
 * Retourne la liste des villes correspondant à un filtre de région ('all' ou un regionId),
 * tout en préservant les éventuelles villes ou zones industrielles personnalisées ajoutées par l'utilisateur.
 */
export function filterCitiesByRegion(
  regionId: string,
  customOrExtraCities: string[] = []
): string[] {
  const baseCities =
    !regionId || regionId === 'all'
      ? ALL_MOROCCO_CITY_NAMES
      : MOROCCO_CITIES_CATALOG.filter((c) => c.regionId === regionId).map((c) => c.name);

  if (!regionId || regionId === 'all') {
    const seen = new Set(baseCities.map((c) => normalizeCityKey(c)));
    const extras: string[] = [];
    for (const extra of customOrExtraCities) {
      const trimmed = (extra || '').trim();
      if (!trimmed) continue;
      const k = normalizeCityKey(trimmed);
      if (!seen.has(k)) {
        seen.add(k);
        extras.push(trimmed);
      }
    }
    return [...baseCities, ...extras];
  }

  // If filtering by a specific region, also include custom cities whose region resolves to that regionId
  const seen = new Set(baseCities.map((c) => normalizeCityKey(c)));
  const extras: string[] = [];
  for (const extra of customOrExtraCities) {
    const trimmed = (extra || '').trim();
    if (!trimmed) continue;
    const k = normalizeCityKey(trimmed);
    if (seen.has(k)) continue;
    const resolved = resolveCityAndRegionFromZoneString(trimmed);
    if (resolved.matched && resolved.regionId === regionId) {
      seen.add(k);
      extras.push(trimmed);
    }
  }
  return [...baseCities, ...extras];
}

/**
 * Vérifie si une ville appartient à une région donnée.
 */
export function doesCityBelongToRegion(cityName: string, regionId: string): boolean {
  if (!regionId || regionId === 'all') return true;
  const trimmed = (cityName || '').trim();
  if (!trimmed) return false;
  const resolved = resolveCityAndRegionFromZoneString(trimmed);
  return resolved.matched && resolved.regionId === regionId;
}

/**
 * Fusionne la liste existante de villes du workspace avec l'ensemble du catalogue national
 * pour que toutes les villes du Maroc soient toujours disponibles.
 */
export function mergeWithAllMoroccanCities(existingCities: string[] = []): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const city of [...ALL_MOROCCO_CITY_NAMES, ...existingCities]) {
    const clean = (city || '').trim();
    if (!clean) continue;
    const key = normalizeCityKey(clean);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}
