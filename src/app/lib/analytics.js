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

// ─── NAVIGÁCIA ────────────────────────────────────────────────
export const trackMojaGarazClick = (source = 'nav') =>
  trackEvent('moja_garaz_click', { source });

// ─── TELEFÓN ──────────────────────────────────────────────────
export const trackPhoneClick = (source = 'nav') =>
  trackEvent('phone_click', { source, phone: '0940449449' });

// ─── KONTAKTNÝ FORMULÁR ───────────────────────────────────────
export const trackContactSubmit = () =>
  trackEvent('contact_form_submit');

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

export const trackObjednavkaSubmit = () =>
  trackEvent('public_booking_submit');

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
export const setConsent = (granted) => {
  const value = granted ? 'granted' : 'denied';
  gtag('consent', 'update', {
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
    analytics_storage: value,
  });
  trackEvent(granted ? 'cookie_consent_accept' : 'cookie_consent_reject');
};
