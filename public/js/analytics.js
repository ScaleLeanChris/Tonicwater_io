// TonicWater.io - Privacy-First Analytics
// Tracks page views locally without external services

(function() {
  'use strict';

  const ANALYTICS_KEY = 'tonicwater_analytics';
  const SESSION_KEY = 'tonicwater_session';
  const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes

  // Generate a simple session ID
  function generateSessionId() {
    return 'sess_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  // Get or create session
  function getSession() {
    const now = Date.now();
    let session = null;

    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        session = JSON.parse(stored);
        // Check if session expired
        if (now - session.lastActivity > SESSION_DURATION) {
          session = null;
        }
      }
    } catch (e) {
      console.warn('Analytics: Could not read session', e);
    }

    if (!session) {
      session = {
        id: generateSessionId(),
        startedAt: now,
        lastActivity: now,
        pageViews: 0
      };
    }

    session.lastActivity = now;
    session.pageViews++;

    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (e) {
      console.warn('Analytics: Could not save session', e);
    }

    return session;
  }

  // Get analytics data from localStorage
  function getAnalytics() {
    try {
      const stored = localStorage.getItem(ANALYTICS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Analytics: Could not read analytics', e);
    }

    return {
      totalPageViews: 0,
      uniqueSessions: 0,
      pages: {},
      referrers: {},
      dailyViews: {},
      firstVisit: Date.now(),
      lastVisit: Date.now()
    };
  }

  // Save analytics data
  function saveAnalytics(data) {
    try {
      localStorage.setItem(ANALYTICS_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Analytics: Could not save analytics', e);
    }
  }

  // Track page view
  function trackPageView() {
    const session = getSession();
    const analytics = getAnalytics();
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const page = window.location.pathname;
    const referrer = document.referrer || 'direct';

    // Update total page views
    analytics.totalPageViews++;

    // Track unique sessions (only count once per session)
    if (session.pageViews === 1) {
      analytics.uniqueSessions++;
    }

    // Track page views by path
    analytics.pages[page] = (analytics.pages[page] || 0) + 1;

    // Track referrers (only on first page of session)
    if (session.pageViews === 1 && referrer !== 'direct') {
      try {
        const referrerHost = new URL(referrer).hostname;
        analytics.referrers[referrerHost] = (analytics.referrers[referrerHost] || 0) + 1;
      } catch (e) {
        // Invalid URL, ignore
      }
    }

    // Track daily views (keep last 30 days)
    analytics.dailyViews[today] = (analytics.dailyViews[today] || 0) + 1;

    // Clean up old daily data (keep last 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    Object.keys(analytics.dailyViews).forEach(date => {
      if (new Date(date) < thirtyDaysAgo) {
        delete analytics.dailyViews[date];
      }
    });

    // Update timestamps
    analytics.lastVisit = Date.now();

    saveAnalytics(analytics);

    // Log for debugging (can be removed in production)
    console.log('Analytics tracked:', {
      page,
      sessionId: session.id,
      pageViewsInSession: session.pageViews,
      totalPageViews: analytics.totalPageViews
    });
  }

  // Get analytics summary (for admin dashboard)
  window.getAnalyticsSummary = function() {
    const analytics = getAnalytics();
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Calculate last 7 days views
    let last7DaysViews = 0;
    Object.entries(analytics.dailyViews).forEach(([date, views]) => {
      if (new Date(date) >= lastWeek) {
        last7DaysViews += views;
      }
    });

    // Get top pages
    const topPages = Object.entries(analytics.pages)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, views]) => ({ path, views }));

    // Get top referrers
    const topReferrers = Object.entries(analytics.referrers)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([host, sessions]) => ({ host, sessions }));

    return {
      totalPageViews: analytics.totalPageViews,
      uniqueSessions: analytics.uniqueSessions,
      todayViews: analytics.dailyViews[today] || 0,
      yesterdayViews: analytics.dailyViews[yesterday] || 0,
      last7DaysViews,
      topPages,
      topReferrers,
      dailyViews: analytics.dailyViews,
      firstVisit: analytics.firstVisit,
      lastVisit: analytics.lastVisit
    };
  };

  // Reset analytics (for testing)
  window.resetAnalytics = function() {
    localStorage.removeItem(ANALYTICS_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    console.log('Analytics reset');
  };

  // Track on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trackPageView);
  } else {
    trackPageView();
  }
})();
