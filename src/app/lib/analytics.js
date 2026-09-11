// Zapisujeme priamo do dataLayer, nie cez window.gtag.
//
// Prečo: gtag.js sa načítava až po tom, čo je stránka interaktívna. Udalosti,
// ktoré komponent pošle hneď pri zobrazení (napr. prvý krok objednávky), by pri
// kontrole `typeof window.gtag === 'function'` zmizli bez stopy — knižnica vtedy
// ešte neexistuje. Zápis do dataLayer funguje aj predtým: gtag.js si frontu
// po načítaní prevezme a spracuje.
//
// Musí to byť klasická funkcia, nie šípková — potrebujeme objekt `arguments`,
// lebo presne v tomto tvare ho gtag.js očakáva.
function gtag() {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(arguments);
}

export const trackEvent = (eventName, params = {}) => {
  gtag('event', eventName, params);
};

// ─── GOOGLE ADS KONVERZIE ─────────────────────────────────────
// Účet Google Ads: AutoAlma.sk (100-312-8662), značka AW-556717584.
//
// Značka Ads je pripojená k tej istej značke Google ako GA4
// (G-250VH3NKCB), takže na web netreba pridávať druhý skript —
// gtag.js si destináciu AW natiahne sám. V layout.js je aj tak
// explicitný `config` na AW, aby meranie fungovalo aj vtedy, keby
// sa prepojenie značiek v Ads raz rozpadlo.
//
// Hodnoty konverzií sú nastavené v Ads, nie tu (objednávka 40 USD,
// telefonát 25 USD, formulár 15 USD). Bez hodnôt Ads optimalizuje
// na počet a klik na telefón by mu vyšiel rovnako hodnotný ako
// dokončená objednávka termínu.
export const ADS_ID = 'AW-556717584';

const ADS_LABELS = {
  objednavka: 'ObUTCNK5lvMcEJCsu4kC', // Objednavka terminu (web)
  telefonat: 'GSVJCNW5lvMcEJCsu4kC',  // Kontakt — klik na telefónne číslo
  formular: 'HO-fCI3mnvMcEJCsu4kC',   // Kontaktny formular (web)
};

// ROZŠÍRENÉ KONVERZIE
// Ak zákazník nechal e-mail alebo telefón, pošleme ich Googlu ešte
// pred samotnou konverziou. gtag ich zahashuje (SHA-256) priamo
// v prehliadači — Googlu odchádza odtlačok, nie samotný kontakt.
// Slúži to na spárovanie konverzie s klikom vtedy, keď zlyhajú
// cookies; podľa Googlu to doháňa rádovo desiatky percent konverzií.
//
// Značka si vie údaje z formulára odčítať aj sama, ale len keď polia
// rozpozná. Takto máme istotu, že dostane presne tie správne.
const normalizePhone = (phone) => {
  const digits = String(phone).replace(/[^\d+]/g, '');
  if (!digits) return null;
  // Google vyžaduje medzinárodný formát. Slovenské čísla sa píšu ako
  // 0940 449 449 — úvodná nula sa nahrádza predvoľbou +421.
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.startsWith('0')) return `+421${digits.slice(1)}`;
  return `+421${digits}`;
};

const setAdsUserData = ({ email, phone } = {}) => {
  const data = {};
  if (email && email.includes('@')) data.email = email.trim().toLowerCase();
  if (phone) {
    const normalized = normalizePhone(phone);
    if (normalized) data.phone_number = normalized;
  }
  if (!Object.keys(data).length) return;
  gtag('set', 'user_data', data);
};

// Posiela sa popri udalosti GA4 — sú to dva rôzne systémy. GA4 slúži
// na prehľady, táto udalosť priamo kŕmi optimalizáciu kampaní v Ads.
// userData je nepovinné; ak chýba, konverzia sa pošle aj tak.
const trackAdsConversion = (key, userData) => {
  const label = ADS_LABELS[key];
  if (!label) return;
  if (userData) setAdsUserData(userData);
  trackEvent('conversion', { send_to: `${ADS_ID}/${label}` });
};

// ─── NAVIGÁCIA ────────────────────────────────────────────────
export const trackMojaGarazClick = (source = 'nav') =>
  trackEvent('moja_garaz_click', { source });

// ─── TELEFÓN ──────────────────────────────────────────────────
export const trackPhoneClick = (source = 'nav') => {
  trackEvent('phone_click', { source, phone: '0940449449' });
  trackAdsConversion('telefonat');
};

// ─── KONTAKTNÝ FORMULÁR ───────────────────────────────────────
// userData = { email, phone } zo samotného formulára — pre rozšírené konverzie.
export const trackContactSubmit = (userData) => {
  trackEvent('contact_form_submit');
  trackAdsConversion('formular', userData);
};

// ─── BANNERY ──────────────────────────────────────────────────
export const trackBannerView = (title) =>
  trackEvent('banner_view', { banner_title: title });

export const trackBannerCta = (title, url) =>
  trackEvent('banner_cta_click', { banner_title: title, destination: url });

export const trackBannerPhone = (title, phone) =>
  trackEvent('banner_phone_click', { banner_title: title, phone });

export const trackBannerClose = (title, index) =>
  trackEvent('banner_close', { banner_title: title, banner_index: index });

export const trackBannerNavigate = (direction) =>
  trackEvent('banner_navigate', { direction });

// ─── REGISTRÁCIA ──────────────────────────────────────────────
export const trackRegistrationStart = () =>
  trackEvent('registration_start');

export const trackRegistrationSuccess = (clientType) =>
  trackEvent('sign_up', { method: 'email', client_type: clientType });

// ─── GARÁŽ / VOZIDLÁ ──────────────────────────────────────────
export const trackAddVehicle = () =>
  trackEvent('add_vehicle');

export const trackBookingOpen = (plate) =>
  trackEvent('booking_open', { license_plate: plate });

export const trackBookingSubmit = (plate, worksCount) =>
  trackEvent('booking_submit', { license_plate: plate, works_count: worksCount });

// ─── VEREJNÁ OBJEDNÁVKA ───────────────────────────────────────
// Klik na "Objednať termín" — meria záujem ešte pred vyplnením formulára
export const trackBookingCta = (source = 'hero') =>
  trackEvent('booking_cta_click', { source });

export const trackObjednavkaSubmit = (userData) => {
  trackEvent('public_booking_submit');
  trackAdsConversion('objednavka', userData);
};

// ─── LIEVIK OBJEDNÁVKY ────────────────────────────────────────
// Každý krok objednávkového formulára. Z týchto troch udalostí sa v GA4
// postaví lievik a vidno, na ktorom kroku ľudia odpadávajú.
export const trackBookingStep = (stepNumber, stepName) =>
  trackEvent('booking_step', { step_number: stepNumber, step_name: stepName });

// Odchod z objednávky bez odoslania. seconds = koľko na tom kroku strávil.
export const trackBookingAbandon = (stepNumber, stepName, seconds) =>
  trackEvent('booking_abandon', {
    step_number: stepNumber,
    step_name: stepName,
    seconds_on_step: seconds,
  });

// ─── SPRÁVANIE NA WEBE ────────────────────────────────────────
// Otvorenie otázky vo FAQ — hovorí, čo ľudí pred objednaním trápi
export const trackFaqOpen = (question) =>
  trackEvent('faq_open', { question });

// Klik na konkrétnu službu v zozname — podklad pre výber kľúčových slov
export const trackServiceClick = (service, category) =>
  trackEvent('service_click', { service, category });

// Klik na recenzie / adresu / mapu — signály, že si zákazník overuje dôveryhodnosť
export const trackReviewsClick = () => trackEvent('reviews_click');
export const trackMapClick = (source = 'kontakt') =>
  trackEvent('map_click', { source });

// Dopozeranie k cenníku — najsilnejší signál nákupného zámeru pred konverziou
export const trackPriceListView = () => trackEvent('price_list_view');

// ─── NÁVOD ────────────────────────────────────────────────────
export const trackGuideStepOpen = (stepNum, stepTitle) =>
  trackEvent('guide_step_open', { step: stepNum, step_title: stepTitle });

// ─── SÚHLAS S COOKIES ─────────────────────────────────────────
// Google Consent Mode v2 — bez udeleného súhlasu sa neukladajú cookies,
// GA4 posiela len anonymné signály bez identifikátorov.
// isNewChoice = false pri obnove skôr udeleného súhlasu — vtedy sa
// stav nastaví, ale udalosť sa neposiela, aby sa neduplikovala pri
// každom načítaní stránky.
export const setConsent = (granted, isNewChoice = true) => {
  const value = granted ? 'granted' : 'denied';
  gtag('consent', 'update', {
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
    analytics_storage: value,
  });
  if (isNewChoice) {
    trackEvent(granted ? 'cookie_consent_accept' : 'cookie_consent_reject');
  }
};
