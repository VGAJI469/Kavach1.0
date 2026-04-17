import { create } from 'zustand';
import { getKavachScore, getPremiumPrediction, getCityConditions, simulateTrigger as simulateTriggerAPI } from '../services/api';

const mockWorker = {
  name: "Ravi Kumar",
  initial: "R",
  city: "Chennai",
  zone: "Adyar · Zone 4",
  platform: "Swiggy",
  kavachScore: 67,
  policy: {
    tier: "Standard Shield",
    premium: 65,
    coverage: 3000,
    renewsIn: 4,
    status: "Active",
  },
};

const mockPayouts = [
  { id: 1, trigger: "Heavy Rainfall", date: "Jul 14", amount: 320, status: "Approved", icon: "rain" },
  { id: 2, trigger: "Extreme Heat",   date: "Jun 28", amount: 195, status: "Approved", icon: "heat" },
  { id: 3, trigger: "Heavy Rainfall", date: "Jun 12", amount: 480, status: "Pending",  icon: "rain" },
  { id: 4, trigger: "Curfew",         date: "May 30", amount: 0,   status: "Rejected", icon: "curfew" },
];

const mockForecast = [
  { day: "Mon", risk: "clear",  label: "Clear" },
  { day: "Tue", risk: "clear",  label: "Clear" },
  { day: "Wed", risk: "watch",  label: "Watch" },
  { day: "Thu", risk: "alert",  label: "Alert" },
  { day: "Fri", risk: "alert",  label: "Alert" },
  { day: "Sat", risk: "watch",  label: "Watch" },
  { day: "Sun", risk: "clear",  label: "Clear" },
];

const mockEarnings = (() => {
  const days = [];
  for (let i = 1; i <= 31; i++) {
    let type = "none";
    if ([3, 5, 6, 8, 10, 11, 13, 15, 17, 18, 20, 22, 24, 25, 27, 29].includes(i)) type = "earned";
    if ([14, 21].includes(i)) type = "kavach_paid";
    if ([7, 28].includes(i)) type = "disrupted";
    days.push({
      day: i,
      type,
      amount: type === "kavach_paid" ? 320 : type === "earned" ? Math.floor(Math.random() * 300 + 200) : 0,
      event: type === "kavach_paid" ? "Heavy Rainfall" : type === "disrupted" ? "Extreme Heat" : null,
    });
  }
  return days;
})();

const mockAdminStats = {
  activePolicies: 1247,
  claimsThisWeek: 83,
  lossRatio: 54,
  avgPayoutMinutes: 18,
};

const mockClaims = [
  {
    id: "WRK-4521",
    city: "Chennai",
    trigger: "Heavy Rainfall",
    amount: 320,
    fraudScore: 12,
    status: "Approved",
    time: "14:32",
    signals: {
      gps: { pass: true, score: 0 },
      activity: { pass: true, score: 0 },
      duplicate: { pass: true, score: 0 },
      velocity: { pass: false, score: 20, note: "spike window" },
      accountAge: { pass: true, score: 0 },
    },
  },
  {
    id: "WRK-4518",
    city: "Mumbai",
    trigger: "Extreme Heat",
    amount: 195,
    fraudScore: 8,
    status: "Approved",
    time: "13:47",
    signals: {
      gps: { pass: true, score: 0 },
      activity: { pass: true, score: 0 },
      duplicate: { pass: true, score: 0 },
      velocity: { pass: true, score: 0 },
      accountAge: { pass: true, score: 0 },
    },
  },
  {
    id: "WRK-4515",
    city: "Chennai",
    trigger: "Heavy Rainfall",
    amount: 480,
    fraudScore: 45,
    status: "Pending",
    time: "12:15",
    signals: {
      gps: { pass: true, score: 0 },
      activity: { pass: false, score: 15, note: "low activity" },
      duplicate: { pass: true, score: 0 },
      velocity: { pass: false, score: 20, note: "spike window" },
      accountAge: { pass: false, score: 10, note: "< 30 days" },
    },
  },
  {
    id: "WRK-4510",
    city: "Delhi",
    trigger: "Curfew",
    amount: 0,
    fraudScore: 78,
    status: "Rejected",
    time: "11:03",
    signals: {
      gps: { pass: false, score: 25, note: "outside zone" },
      activity: { pass: false, score: 20, note: "no deliveries" },
      duplicate: { pass: false, score: 15, note: "similar claim" },
      velocity: { pass: false, score: 10, note: "spike window" },
      accountAge: { pass: false, score: 8, note: "< 14 days" },
    },
  },
  {
    id: "WRK-4507",
    city: "Bengaluru",
    trigger: "Heavy Rainfall",
    amount: 275,
    fraudScore: 5,
    status: "Approved",
    time: "09:21",
    signals: {
      gps: { pass: true, score: 0 },
      activity: { pass: true, score: 0 },
      duplicate: { pass: true, score: 0 },
      velocity: { pass: true, score: 0 },
      accountAge: { pass: true, score: 0 },
    },
  },
];

const mockVelocityData = (() => {
  const data = [];
  const now = new Date();
  for (let i = 24; i >= 0; i--) {
    const time = new Date(now - i * 15 * 60 * 1000);
    const label = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
    let claims = Math.floor(Math.random() * 15 + 5);
    if (i === 6) claims = 287;
    if (i === 7) claims = 142;
    data.push({ time: label, claims });
  }
  return data;
})();

const mockCities = [
  { name: "Chennai",   lat: 13.0827, lng: 80.2707, policies: 1247, claims: 83, status: "Red Alert Active", risk: "red" },
  { name: "Mumbai",    lat: 19.076,  lng: 72.8777, policies: 2340, claims: 45, status: "Watch Active",     risk: "amber" },
  { name: "Delhi",     lat: 28.6139, lng: 77.209,  policies: 1890, claims: 32, status: "Clear",            risk: "green" },
  { name: "Bengaluru", lat: 12.9716, lng: 77.5946, policies: 1560, claims: 28, status: "Clear",            risk: "green" },
  { name: "Hyderabad", lat: 17.385,  lng: 78.4867, policies: 980,  claims: 15, status: "Watch Active",     risk: "amber" },
];

// Earnings bracket → approximate weekly earnings for ML model
const BRACKET_EARNINGS = {
  basic: 2500,
  standard: 4000,
  pro: 6000,
};

// Platform name → numeric code for ML backend
const PLATFORM_CODE = {
  zomato: 0,
  swiggy: 1,
  both: 0,
};

const useKavachStore = create((set, get) => ({
  // Worker data
  worker: mockWorker,
  payouts: mockPayouts,
  forecast: mockForecast,
  earnings: mockEarnings,

  // Admin data
  adminStats: mockAdminStats,
  claims: mockClaims,
  velocityData: mockVelocityData,
  cities: mockCities,
  poolHealth: {
    collected: 118500,
    paidOut: 64200,
    lossRatio: 54,
  },

  // Live conditions from ML backend
  liveConditions: null,
  conditionsLoading: false,

  // Onboarding state
  onboarding: {
    step: 1,
    platform: null,
    city: "",
    pinCode: "",
    zone: null,
    earningsBracket: null,
    phone: "",
    otp: ["", "", "", "", "", ""],
    kavachScore: null,
    recommendedPolicy: null,
    mlLoading: false,
    mlError: null,
    weatherSummary: null,
    aqiCategory: null,
    modelVersion: null,
  },

  setOnboardingField: (field, value) =>
    set((state) => ({
      onboarding: { ...state.onboarding, [field]: value },
    })),

  nextStep: () =>
    set((state) => ({
      onboarding: { ...state.onboarding, step: state.onboarding.step + 1 },
    })),

  prevStep: () =>
    set((state) => ({
      onboarding: { ...state.onboarding, step: Math.max(1, state.onboarding.step - 1) },
    })),

  setOtpDigit: (index, digit) =>
    set((state) => {
      const otp = [...state.onboarding.otp];
      otp[index] = digit;
      return { onboarding: { ...state.onboarding, otp } };
    }),

  /**
   * Complete onboarding — calls ML backend for REAL score + premium.
   * No longer hardcoded!
   */
  completeOnboarding: async () => {
    const state = get();
    const { city, platform, earningsBracket } = state.onboarding;
    const month = new Date().getMonth() + 1;
    const weeklyEarnings = BRACKET_EARNINGS[earningsBracket] || 4000;
    const platformCode = PLATFORM_CODE[platform] ?? 0;
    const cityName = city || 'chennai';

    // Set loading state
    set((s) => ({
      onboarding: { ...s.onboarding, mlLoading: true, mlError: null },
    }));

    try {
      // Call both ML endpoints in parallel
      const [scoreResult, premiumResult] = await Promise.all([
        getKavachScore(cityName, platform || 'zomato', earningsBracket || 'standard', month),
        getPremiumPrediction(cityName, month, 1, weeklyEarnings, 0, platformCode),
      ]);

      const kavachScore = scoreResult.kavach_score;
      const premium = premiumResult.premium;
      const tier = premiumResult.recommended_tier;
      const coverage = premiumResult.coverage_cap;

      // Map tier names for display
      const tierNames = {
        basic: 'Basic Shield',
        standard: 'Standard Shield',
        pro: 'Pro Shield',
      };

      set((s) => ({
        onboarding: {
          ...s.onboarding,
          kavachScore,
          recommendedPolicy: {
            tier: tierNames[tier] || 'Standard Shield',
            premium,
            coverage,
          },
          weatherSummary: scoreResult.weather_summary,
          aqiCategory: scoreResult.aqi_category,
          modelVersion: premiumResult.breakdown?.model_version || 'ml',
          mlLoading: false,
          mlError: null,
        },
        // Also update the worker data for the dashboard
        worker: {
          ...s.worker,
          city: cityName,
          zone: s.onboarding.zone
            ? `${s.onboarding.zone.area} · ${s.onboarding.zone.zone}`
            : s.worker.zone,
          platform: platform || s.worker.platform,
          kavachScore,
          policy: {
            tier: tierNames[tier] || 'Standard Shield',
            premium,
            coverage,
            renewsIn: 4,
            status: 'Active',
          },
        },
      }));
    } catch (err) {
      console.error('[ML] Score/Premium API failed:', err);
      // Fallback — still complete onboarding but with a warning
      set((s) => ({
        onboarding: {
          ...s.onboarding,
          kavachScore: null,
          recommendedPolicy: null,
          mlLoading: false,
          mlError: 'Could not reach ML service — please try again',
        },
      }));
    }
  },

  /**
   * Fetch live weather/AQI conditions for the dashboard
   */
  fetchLiveConditions: async (city) => {
    set({ conditionsLoading: true });
    try {
      const conditions = await getCityConditions(city || 'chennai');
      set({
        liveConditions: conditions,
        conditionsLoading: false,
      });
    } catch (err) {
      console.error('[Live] Conditions fetch failed:', err);
      set({ conditionsLoading: false });
    }
  },

  /**
   * Phase 3: Simulate a disruption trigger (dev mode)
   */
  simulateTrigger: async (city, trigger, value) => {
    try {
      const result = await simulateTriggerAPI(city, trigger, value);
      return result;
    } catch (err) {
      console.error('[Simulate] Trigger simulation failed:', err);
      return { message: 'Simulation failed', decision: 'ERROR' };
    }
  },
}));

export default useKavachStore;
