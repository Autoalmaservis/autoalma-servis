const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

// Bezpečné volanie gtag — funguje len v browseri, keď je GA načítaná
const gtag = (...args) => {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag(...args);
  }
};

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

// ─── NÁVOD ────────────────────────────────────────────────────
export const trackGuideStepOpen = (stepNum, stepTitle) =>
  trackEvent('guide_step_open', { step: stepNum, step_title: stepTitle });
