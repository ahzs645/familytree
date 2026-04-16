/**
 * Google Analytics wrapper.
 * Replaces webpack modules 786 (analytics), 318 (GA4 adapter), 171 (gtag wrapper).
 *
 * Can be replaced with: npm install react-ga4
 * import ReactGA from 'react-ga4';
 * ReactGA.initialize('G-F0QT8G189J');
 */

const TRACKING_ID = 'G-F0QT8G189J';

function gtag() {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(arguments);
}

let initialized = false;

export const Analytics = {
  initialize(trackingId) {
    if (initialized) return;
    gtag('js', new Date());
    gtag('config', trackingId || TRACKING_ID);
    initialized = true;
  },

  send(params) {
    if (params.hitType === 'pageview') {
      gtag('event', 'page_view', { page_path: params.page });
    }
  },

  ZP: {
    initialize(trackingId) {
      Analytics.initialize(trackingId);
    },
    send(params) {
      Analytics.send(params);
    },
  },
};

export default Analytics;
