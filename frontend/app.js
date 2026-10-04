// =========================================================================
// MonsoonSaathi / Foresight — Farmer-First Monsoon Decision-Support Platform
// SIH26086 · Ministry of Earth Sciences (NCMRWF)
// =========================================================================

// Clean API configuration:
// - Local development (localhost / 127.0.0.1 / file): Target local FastAPI backend on port 8000
// - Production (Render / custom domain): Target live deployed Render backend
const LOCAL_API = 'http://127.0.0.1:8000/api';
const RENDER_API = 'https://foresight-monsoon.onrender.com/api';
const isLocal = (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '');
const API_BASE = isLocal ? LOCAL_API : RENDER_API;

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function showApiError(msg) {
  const banner = $('#apiErrorBanner');
  if (banner) {
    banner.classList.remove('hidden');
    if (msg) $('#apiErrorMessage').textContent = msg;
  }
}

function hideApiError() {
  const banner = $('#apiErrorBanner');
  if (banner) banner.classList.add('hidden');
}

async function api(path) {
  try {
    const res = await fetch(API_BASE + path);
    if (!res.ok) throw new Error(`${path} -> ${res.status}`);
    hideApiError();
    return await res.json();
  } catch (err) {
    console.error(`API Error on ${API_BASE}${path}:`, err);
    if (isLocal) {
      showApiError(`Cannot connect to local backend at ${LOCAL_API}. Please ensure Uvicorn is running: uvicorn app.main:app --port 8000`);
    } else {
      showApiError(`Server at ${RENDER_API} is warming up or temporarily unreachable. Please retry in a few moments.`);
    }
    throw err;
  }
}

// -------------------------------------------------------------------------
// Global State
// -------------------------------------------------------------------------
let DISTRICTS = [];
let SNAPSHOT = [];
let FI = null;
let selectedDistrictId = 'MH-PUN'; // Pune default
let selectedCrop = 'Sugarcane';
let selectedStage = 'sowing';
let horizonDays = 14;
let activeMapLayer = 'farming_risk';
let activeFiTarget = 'onset';
let currentForecast = null;
let currentAdvisory = null;
let currentFarmers = null;
let currentDecision = null;
let currentLang = 'en';
let currentPage = 'home';
let mainMapInstance = null;
let mainMapMarkers = {};
let detailedChartInstance = null;
let lastAlertFeed = [];

// -------------------------------------------------------------------------
// Crop Constants & Emojis
// -------------------------------------------------------------------------
const CROPS_LIST = [
  'Paddy', 'Cotton', 'Soybean', 'Bajra', 'Groundnut', 'Sugarcane',
  'Maize', 'Wheat/Paddy', 'Jowar', 'Tur Dal', 'Grapes', 'Tea', 'Coffee', 'Jute', 'Tapioca'
];

const CROP_EMOJI = {
  Paddy: '🌾', Rice: '🌾', Cotton: '🌿', Soybean: '🌱', Bajra: '🌾',
  Groundnut: '🥜', Sugarcane: '🎋', Maize: '🌽', 'Wheat/Paddy': '🌾',
  Jowar: '🌾', 'Tur Dal': '🍲', Grapes: '🍇', Tea: '🍃', Coffee: '☕',
  Jute: '🌿', Tapioca: '🥔'
};

const STAGES = ['planning', 'nursery', 'sowing', 'vegetative', 'flowering', 'harvest'];

// -------------------------------------------------------------------------
// Comprehensive Bilingual Translations (EN & HI)
// -------------------------------------------------------------------------
const I18N = {
  en: {
    nav_home: 'Home',
    nav_forecast: 'Local Forecast',
    nav_mycrop: 'My Crop',
    nav_alerts: 'Alerts',
    nav_expert: 'Expert View',
    expert_mode_btn: 'Expert Mode',
    return_to_farmer_btn: 'Return to Farmer View',
    use_location: 'My Location',
    ctx_location: '📍 Location',
    ctx_crop: '🌾 Crop',
    ctx_stage: '🌱 Growth Stage',
    ctx_today_weather: "🌦️ Today's Weather",
    decision_today_label: "TODAY'S FARMING DECISION",
    why_label: 'Why:',
    prob_onset: 'Onset Probability',
    prob_sub_onset: 'Stable rain arrival',
    prob_break: 'Dry-Spell / Break Risk',
    prob_sub_break: '7–10 day dry window',
    prob_heavy: 'Heavy-Rain Risk',
    prob_sub_heavy: 'Downpour / waterlogging',
    reliability_7day: '7-Day Reliability',
    prob_sub_conf: 'Ensemble certainty',
    recommended_action_title: 'Recommended Action for Today',
    what_if_sow_btn: 'What if I sow today?',
    what_if_already_sown_btn: 'What if I already sowed?',
    view_7day_btn: 'View 7–14 Day Forecast →',
    shield_tag: 'FALSE ONSET SHIELD ACTIVATED',
    shield_title: 'Caution: Possible False Monsoon Onset Detected',
    onset_prob_short: 'Initial Onset:',
    break_prob_short: 'Follow-up Dry Spell:',
    affected_window: 'Affected Period:',
    shield_advice_label: 'Suggested Protective Action:',
    shield_recheck_text: 'Recommended recheck window: 3–5 days before committing seeds to field.',
    seven_day_window_title: '📅 Next 7 Days Outlook',
    seven_day_window_sub: 'Daily rainfall outlook and moisture suitability',
    quick_weather_title: 'Local Weather Conditions',
    quick_weather_sub: 'Open-Meteo live feed',
    humidity: 'Humidity:',
    wind: 'Wind:',
    precip: 'Rainfall:',
    whatsapp_card_title: 'WhatsApp Daily Advisory',
    whatsapp_card_sub: 'Direct to your phone in your language',
    whatsapp_card_desc: 'Receive this personalized advisory every morning on WhatsApp. Powered by Twilio & LLM tone personalization.',
    forecast_page_title: 'Local Monsoon Forecast & Timeline',
    days_7: '7 Days',
    days_14: '14 Days',
    days_30: '30 Days',
    conf_banner_title: 'Understanding Forecast Uncertainty by Horizon',
    conf_banner_text: 'Forecast uncertainty naturally increases with longer lead times. 7-day forecasts guide operational sowing and spraying, while 14–30 day outlooks reflect broader climatological trends.',
    monsoon_timeline_title: 'Monsoon Phase Progression',
    monsoon_timeline_sub: 'Weekly aggregated windows derived from model ensemble',
    daily_probabilities_title: 'Day-by-Day Probability Breakdown',
    daily_probabilities_sub: 'Daily calibrated probabilities of onset, dry-spell, and heavy rainfall',
    toggle_chart_btn: 'Show Trend Chart',
    th_date: 'Date',
    th_day: 'Lead',
    tab_onset: 'Onset Probability',
    th_break: 'Dry-Spell Risk',
    th_heavy: 'Heavy-Rain Risk',
    th_status: 'Farming Window',
    mycrop_title: 'Crop Stage Intelligence & Agronomic Guidance',
    mycrop_sub: "Tailored recommendations matching your crop's exact growth stage and monsoon forecast",
    select_crop_label: 'Choose Your Crop:',
    select_stage_label: 'Current Growth Stage:',
    stage_planning: 'Planning',
    stage_nursery: 'Nursery',
    stage_sowing: 'Sowing/Transplanting',
    stage_vegetative: 'Vegetative',
    stage_flowering: 'Flowering',
    stage_harvest: 'Harvest',
    action_to_take: 'Action to take:',
    scenario_sow_title: 'Scenario: What if I sow today?',
    scenario_sow_sub: 'Simulation based on current 7–10 day monsoon risk',
    scenario_already_title: 'Scenario: What if I already sowed?',
    scenario_already_sub: 'Contingency & protection measures',
    alerts_page_title: 'Action-Oriented Weather Alerts',
    alerts_page_sub: 'Prioritized advisories requiring timely farm intervention',
    filter_all: 'All Alerts',
    filter_critical: 'High Risk',
    filter_warning: 'Warnings',
    filter_local: 'My District',
    expert_heading: 'Advanced Meteorological Diagnostics & System Analytics',
    expert_desc: 'Comprehensive national risk map across 423 curated agricultural districts, global teleconnections (ENSO/IOD/MJO), ML holdout metrics, and WhatsApp farmer management.',
    decision_sow: 'SOW',
    decision_wait: 'WAIT',
    decision_protect: 'PROTECT',
    favorable_window: 'Favorable',
    break_risk_window: 'Dry Spell Risk',
    heavy_rain_window: 'Heavy Rain Risk',
    routine_window: 'Routine',
    map_section_title: '🗺️ National & District Monsoon Risk Map',
    map_section_sub: 'Calibrated district-scale forecasts across 423 agricultural zones. Click any pin to load.',
    selected_district_tag: '📍 SELECTED DISTRICT',
    api_error_title: 'Unable to connect to backend API',
    btn_retry: '🔄 Retry Connection'
  },
  hi: {
    nav_home: 'होम',
    nav_forecast: 'स्थानीय पूर्वानुमान',
    nav_mycrop: 'मेरी फसल',
    nav_alerts: 'अलर्ट',
    nav_expert: 'विशेषज्ञ मोड',
    expert_mode_btn: 'विशेषज्ञ मोड',
    return_to_farmer_btn: '← किसान मोड पर लौटें',
    use_location: 'मेरा स्थान',
    ctx_location: '📍 स्थान',
    ctx_crop: '🌾 फसल',
    ctx_stage: '🌱 विकास चरण',
    ctx_today_weather: '🌦️ आज का मौसम',
    decision_today_label: 'आज का कृषि निर्णय',
    why_label: 'कारण:',
    prob_onset: 'मानसून आगमन संभावना',
    prob_sub_onset: 'स्थिर वर्षा का आगमन',
    prob_break: 'सूखा दौर / ब्रेक जोखिम',
    prob_sub_break: '7-10 दिन सूखा दौर',
    prob_heavy: 'भारी बारिश का खतरा',
    prob_sub_heavy: 'जलभराव व तेज बारिश',
    reliability_7day: '7-दिन की विश्वसनीयता',
    prob_sub_conf: 'मॉडल निश्चितता',
    recommended_action_title: 'आज के लिए अनुशंसित कार्रवाई',
    what_if_sow_btn: 'अगर मैं आज बुवाई करूं तो क्या होगा?',
    what_if_already_sown_btn: 'अगर मैं पहले ही बुवाई कर चुका हूं?',
    view_7day_btn: '7–14 दिन का पूर्वानुमान देखें →',
    shield_tag: 'फाल्स ऑनसेट शील्ड सक्रिय',
    shield_title: 'सावधानी: संभावित झूठा मानसून (False Onset) पाया गया',
    onset_prob_short: 'प्रारंभिक आगमन:',
    break_prob_short: 'आगामी सूखा दौर:',
    affected_window: 'प्रभावित अवधि:',
    shield_advice_label: 'सुझाया गया सुरक्षा उपाय:',
    shield_recheck_text: 'अनुशंसित पुनर्जांच समय: बुवाई करने से 3–5 दिन पहले दोबारा स्थिति जांचें।',
    seven_day_window_title: '📅 अगले 7 दिनों का दृष्टिकोण',
    seven_day_window_sub: 'दैनिक वर्षा व नमी की उपयुक्तता',
    quick_weather_title: 'स्थानीय मौसम की स्थिति',
    quick_weather_sub: 'ओपन-मेटियो लाइव अपडेट',
    humidity: 'नमी:',
    wind: 'हवा की गति:',
    precip: 'वर्षा:',
    whatsapp_card_title: 'व्हाट्सएप दैनिक सलाह',
    whatsapp_card_sub: 'सीधे आपके फोन पर अपनी भाषा में',
    whatsapp_card_desc: 'रोज सुबह व्हाट्सएप पर यह व्यक्तिगत सलाह प्राप्त करें।',
    forecast_page_title: 'स्थानीय मानसून पूर्वानुमान व समयरेखा',
    days_7: '7 दिन',
    days_14: '14 दिन',
    days_30: '30 दिन',
    conf_banner_title: 'पूर्वानुमान अनिश्चितता को समझें',
    conf_banner_text: 'पूर्वानुमान की अनिश्चितता लंबी अवधि के साथ बढ़ती है। 7-दिन का पूर्वानुमान बुवाई और छिड़काव के लिए सटीक है, जबकि 14–30 दिन का दृष्टिकोण सामान्य मौसम संकेत देता है।',
    monsoon_timeline_title: 'मानसून चरण प्रगति',
    monsoon_timeline_sub: 'मॉडल समूह से साप्ताहिक रुझान',
    daily_probabilities_title: 'दिन-प्रतिदिन संभावना विवरण',
    daily_probabilities_sub: 'आगमन, सूखा और भारी बारिश की दैनिक संभावना',
    toggle_chart_btn: 'रुझान ग्राफ देखें',
    th_date: 'दिनांक',
    th_day: 'दिन',
    tab_onset: 'आगमन संभावना',
    th_break: 'सूखा दौर जोखिम',
    th_heavy: 'भारी वर्षा जोखिम',
    th_status: 'कृषि समय',
    mycrop_title: 'फसल चरण सलाह और मार्गदर्शन',
    mycrop_sub: 'आपकी फसल के विकास चरण और मानसून के अनुसार सटीक कृषि सलाह',
    select_crop_label: 'अपनी फसल चुनें:',
    select_stage_label: 'वर्तमान विकास चरण:',
    stage_planning: 'योजना / तैयारी',
    stage_nursery: 'नर्सरी',
    stage_sowing: 'बुवाई / रोपाई',
    stage_vegetative: 'वानस्पतिक वृद्धि',
    stage_flowering: 'फूल आना',
    stage_harvest: 'कटाई',
    action_to_take: 'क्या करें:',
    scenario_sow_title: 'परिदृश्य: अगर मैं आज बुवाई करूं तो क्या होगा?',
    scenario_sow_sub: 'आगामी 7-10 दिनों के मानसून जोखिम पर आधारित सिमुलेशन',
    scenario_already_title: 'परिदृश्य: अगर मैं पहले ही बुवाई कर चुका हूं?',
    scenario_already_sub: 'आपातकालीन व फसल सुरक्षा उपाय',
    alerts_page_title: 'कृषि-आधारित मौसम अलर्ट',
    alerts_page_sub: 'समय पर कार्रवाई के लिए महत्वपूर्ण सूचनाएं',
    filter_all: 'सभी अलर्ट',
    filter_critical: 'उच्च जोखिम',
    filter_warning: 'सावधानी',
    filter_local: 'मेरा जिला',
    expert_heading: 'उन्नत मौसम विज्ञान विश्लेषण और सिस्टम स्थिति',
    expert_desc: '423 जिलों का राष्ट्रीय जोखिम मानचित्र, वैश्विक जलवायु संकेत (ENSO/IOD/MJO), और मॉडल विश्लेषण।',
    decision_sow: 'बुवाई करें',
    decision_wait: 'रुकें',
    decision_protect: 'सुरक्षा करें',
    favorable_window: 'अनुकूल',
    break_risk_window: 'सूखा दौर जोखिम',
    heavy_rain_window: 'भारी बारिश खतरा',
    routine_window: 'सामान्य',
    map_section_title: '🗺️ राष्ट्रीय एवं जिला मानसून जोखिम मानचित्र',
    map_section_sub: '423 कृषि जिलों का सटीक पूर्वानुमान। किसी भी जिले पर क्लिक करें।',
    selected_district_tag: '📍 चयनित जिला',
    api_error_title: 'बैकएंड एपीआई से कनेक्ट नहीं हो सका',
    btn_retry: '🔄 दोबारा प्रयास करें'
  }
};

function t(key) {
  return I18N[currentLang]?.[key] ?? I18N.en[key] ?? key;
}

function applyStaticI18n() {
  document.documentElement.lang = currentLang;
  $$('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
}

function pct(n) {
  return Math.round((n || 0) * 100) + '%';
}

function cropEmoji(crop) {
  return CROP_EMOJI[crop] || '🌱';
}

// -------------------------------------------------------------------------
// Navigation & Routing
// -------------------------------------------------------------------------
function showPage(pageId) {
  currentPage = pageId;
  $$('.page-view').forEach((el) => el.classList.toggle('active', el.id === 'page-' + pageId));
  $$('.nav-item').forEach((btn) => btn.classList.toggle('active', btn.dataset.page === pageId));

  const btnExpert = $('#btnToggleExpert');
  if (pageId === 'expert') {
    btnExpert.classList.add('active');
    btnExpert.dataset.mode = 'expert';
  } else {
    btnExpert.classList.remove('active');
    btnExpert.dataset.mode = 'farmer';
  }

  if (pageId === 'home') {
    setTimeout(() => mainMapInstance?.invalidateSize(), 150);
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

$$('.nav-item').forEach((btn) => {
  btn.onclick = () => showPage(btn.dataset.page);
});

$('#brandHomeLink').onclick = (e) => {
  e.preventDefault();
  showPage('home');
};

$('#btnToggleExpert').onclick = () => {
  if (currentPage === 'expert') {
    showPage('home');
  } else {
    showPage('expert');
  }
};

$('#btnReturnToFarmer').onclick = () => showPage('home');
$('#btnGoToForecast').onclick = () => showPage('forecast');

// -------------------------------------------------------------------------
// DECISION ENGINE: The Transparent Decision Layer
// Inputs: forecast, crop, crop stage, location
// Output: SOW, WAIT, or PROTECT + Transparent Reasons & Actions
// -------------------------------------------------------------------------
function decisionEngine(forecast, crop, stage, location) {
  if (!forecast || !forecast.current) {
    return {
      decision: 'WAIT',
      headline: 'Awaiting forecast data…',
      headline_hi: 'पूर्वानुमान लोड हो रहा है…',
      reason: 'Gathering calibrated ensemble probabilities.',
      reason_hi: 'मॉडल डेटा प्राप्त किया जा रहा है।',
      recommendedActions: ['Please wait while data loads.'],
      recommendedActions_hi: ['कृपया प्रतीक्षा करें।'],
      isFalseOnset: false,
      probabilities: { onset: 0, break: 0, heavy: 0 },
      confidence: { rating: 'MODERATE', score: 0.78 }
    };
  }

  const cur = forecast.current;
  const onset = cur.onset_probability;
  const brk = cur.break_probability;
  const heavy = cur.heavy_rain_probability;
  const confScore = cur.confidence || 0.85;

  const currentStage = (stage || 'sowing').toLowerCase();

  // False Onset Shield condition: elevated onset immediately accompanied by elevated dry-spell risk
  const isFalseOnset = (onset >= 0.50 && brk >= 0.50) &&
    ['planning', 'nursery', 'sowing'].includes(currentStage);

  const confRating = confScore >= 0.8 ? 'HIGH' : confScore >= 0.6 ? 'MODERATE' : 'LOW';

  // 1. False Onset Shield Trigger
  if (isFalseOnset) {
    return {
      decision: 'WAIT',
      headline: 'Wait — Possible False Monsoon Onset Detected',
      headline_hi: 'रुकें — संभावित झूठा मानसून (False Onset) पाया गया',
      reason: `Rainfall may initially improve (${pct(onset)} onset probability), but the model detects an elevated dry-spell risk (${pct(brk)}) immediately following during ${currentStage}. Early rainfed sowing risks seedling mortality.`,
      reason_hi: `प्रारंभिक बारिश में सुधार हो सकता है (${pct(onset)} आगमन), लेकिन इसके तुरंत बाद ${pct(brk)} सूखा पड़ने की संभावना है। बिना पक्की सिंचाई के बुवाई करने पर बीज सूख सकते हैं।`,
      recommendedActions: [
        'Hold off rainfed sowing for 5–7 days until rainfall stabilizes.',
        'If preparing nursery beds, ensure backup irrigation storage or tanker availability.',
        'Re-check decision in 3–5 days before committing costly seed to the field.'
      ],
      recommendedActions_hi: [
        'बारिश स्थिर होने तक 5-7 दिनों के लिए बुवाई टालें।',
        'यदि नर्सरी तैयार कर रहे हैं, तो बैकअप सिंचाई की व्यवस्था सुनिश्चित करें।',
        'खेत में बीज डालने से पहले 3-5 दिनों में दोबारा स्थिति जांचें।'
      ],
      isFalseOnset: true,
      falseOnsetDetails: {
        onsetProb: onset,
        breakProb: brk,
        period: 'Days 4–10 (Day 4 onwards)',
        period_hi: 'दिन 4 से 10 के बीच',
        action: 'Hold off rainfed sowing for 5–7 days until rainfall stabilizes.',
        action_hi: 'बारिश स्थिर होने तक 5-7 दिन बुवाई रोकें।'
      },
      probabilities: { onset, break: brk, heavy },
      confidence: { rating: confRating, score: confScore }
    };
  }

  // 2. Heavy Rain / Waterlogging Trigger (PROTECT)
  if (heavy >= 0.55) {
    if (currentStage === 'harvest') {
      return {
        decision: 'PROTECT',
        headline: 'Critical: Expedite Harvest — Heavy Rain Threat',
        headline_hi: 'अति आवश्यक: तुरंत फसल काटें — भारी बारिश का खतरा',
        reason: `${pct(heavy)} heavy downpour probability threatens mature ${crop}. Risk of grain sprouting and field fungal rotting.`,
        reason_hi: `${crop} की पकी फसल पर ${pct(heavy)} भारी बारिश का खतरा है। अनाज सड़ने और अंकुरित होने का डर है।`,
        recommendedActions: [
          'Expedite harvesting of mature crop immediately.',
          'Shift harvested produce to covered, elevated storage immediately.',
          'Clear all drainage outlets in the field.'
        ],
        recommendedActions_hi: [
          'तुरंत पकी फसल की कटाई पूरी करें।',
          'कटे हुए अनाज को सूखे और ढके हुए स्थान पर रखें।',
          'खेत से अतिरिक्त पानी की निकासी सुनिश्चित करें।'
        ],
        isFalseOnset: false,
        probabilities: { onset, break: brk, heavy },
        confidence: { rating: confRating, score: confScore }
      };
    }

    return {
      decision: 'PROTECT',
      headline: `Protect Fields — Heavy Rain Risk for ${crop} (${currentStage})`,
      headline_hi: `सुरक्षा करें — ${crop} के लिए भारी बारिश का खतरा`,
      reason: `${pct(heavy)} heavy downpour probability detected over the next 7 days. Risk of soil waterlogging and nutrient runoff.`,
      reason_hi: `अगले 7 दिनों में भारी बारिश की ${pct(heavy)} संभावना है। जलभराव और पोषक तत्वों के बहने का खतरा है।`,
      recommendedActions: [
        'Ensure field drainage channels and trenches are completely clear.',
        'Postpone chemical fertilizer and pesticide spraying until after downpours.',
        'Protect sensitive seedling or nursery beds with drainage gutters.'
      ],
      recommendedActions_hi: [
        'खेत की जलनिकासी नालियों को साफ रखें।',
        'बारिश रुकने तक रासायनिक खाद और कीटनाशक का छिड़काव टालें।',
        'नर्सरी क्यारियों के चारों तरफ पानी न ठहरने दें।'
      ],
      isFalseOnset: false,
      probabilities: { onset, break: brk, heavy },
      confidence: { rating: confRating, score: confScore }
    };
  }

  // 3. Dry Spell / Break Monsoon Trigger
  if (brk >= 0.55) {
    if (['planning', 'sowing', 'nursery'].includes(currentStage)) {
      return {
        decision: 'WAIT',
        headline: `Do Not Sow Today — High Dry-Spell Risk for ${crop}`,
        headline_hi: `आज बुवाई न करें — ${crop} के लिए सूखा दौर का खतरा`,
        reason: `High probability (${pct(brk)}) of an extended dry spell in the next 7–10 days. Sowing now risks seedling emergence failure due to moisture stress.`,
        reason_hi: `अगले 7-10 दिनों में लंबे सूखे दौर की ${pct(brk)} संभावना है। अभी बुवाई करने से नमी की कमी के कारण बीज खराब हो सकते हैं।`,
        recommendedActions: [
          'Delay sowing by 5–7 days and wait for a more stable rainfall window.',
          'Do not broadcast seeds into dry soil without guaranteed borehole irrigation.',
          'If already prepared, maintain seed treatment with bio-fungicides.'
        ],
        recommendedActions_hi: [
          'बुवाई को 5-7 दिन के लिए टालें और स्थिर वर्षा का इंतजार करें।',
          'बिना पक्की सिंचाई के सूखे खेत में बीज न डालें।',
          'बीज को फफूंदनाशक से उपचारित करके सुरक्षित रखें।'
        ],
        isFalseOnset: false,
        probabilities: { onset, break: brk, heavy },
        confidence: { rating: confRating, score: confScore }
      };
    } else if (['transplanting', 'vegetative', 'flowering'].includes(currentStage)) {
      return {
        decision: 'PROTECT',
        headline: `Protect Standing Crop — Moisture Stress Risk for ${crop}`,
        headline_hi: `खड़ी फसल की रक्षा करें — ${crop} के लिए नमी की कमी का खतरा`,
        reason: `Elevated dry-spell probability (${pct(brk)}) during active ${currentStage}. Soil moisture stress can impair tillering or flowering.`,
        reason_hi: `${currentStage} अवस्था के दौरान ${pct(brk)} सूखे की संभावना है। नमी की कमी से पैदावार प्रभावित हो सकती है।`,
        recommendedActions: [
          'Arrange protective supplemental irrigation via drip or furrow.',
          'Apply organic straw/crop-residue mulch to conserve soil moisture.',
          'Withhold nitrogenous fertilizer top-dressing until moisture recovers.'
        ],
        recommendedActions_hi: [
          'ड्रिप या फरो विधि से हल्की सिंचाई का प्रबंध करें।',
          'नमी बचाने के लिए कतारों के बीच पुआल या घास-फूस की मल्चिंग करें।',
          'नमी वापस आने तक यूरिया/खाद का छिड़काव रोकें।'
        ],
        isFalseOnset: false,
        probabilities: { onset, break: brk, heavy },
        confidence: { rating: confRating, score: confScore }
      };
    } else if (currentStage === 'harvest') {
      return {
        decision: 'SOW',
        headline: `Harvest Window Open — Dry Spell Favorable for ${crop}`,
        headline_hi: `कटाई के लिए अनुकूल समय — सूखा मौसम उपयुक्त`,
        reason: `Dry weather outlook (${pct(brk)} dry probability) provides a safe window for harvesting, threshing, and sun-drying produce.`,
        reason_hi: `सूखा मौसम (${pct(brk)} संभावना) पकी फसल की कटाई और गहाई के लिए सबसे सुरक्षित समय है।`,
        recommendedActions: [
          'Proceed with harvesting mature crop without delay.',
          'Complete threshing and sun-drying in this dry window.'
        ],
        recommendedActions_hi: [
          'पकी फसल की कटाई तुरंत शुरू करें।',
          'धूप में सुखाने और गहाई का काम पूरा करें।'
        ],
        isFalseOnset: false,
        probabilities: { onset, break: brk, heavy },
        confidence: { rating: confRating, score: confScore }
      };
    }
  }

  // 4. Favorable Onset Window (SOW)
  if (onset >= 0.55 && brk < 0.45) {
    if (['planning', 'sowing'].includes(currentStage)) {
      return {
        decision: 'SOW',
        headline: `Sow Now — Favorable Monsoon Onset Window for ${crop}`,
        headline_hi: `बुवाई करें — ${crop} के लिए अनुकूल मानसून आगमन`,
        reason: `Stable monsoon onset detected (${pct(onset)} probability) with low dry-spell risk (${pct(brk)}). Soil moisture conditions favor healthy germination.`,
        reason_hi: `स्थिर मानसून आगमन की ${pct(onset)} संभावना है और सूखे का खतरा कम (${pct(brk)}) है। मिट्टी में नमी बुवाई के लिए उत्तम है।`,
        recommendedActions: [
          'Proceed with field preparation and sowing.',
          'Treat seeds with recommended bio-inoculants before sowing.',
          'Keep a light supplemental irrigation option ready as a buffer.'
        ],
        recommendedActions_hi: [
          'खेत की तैयारी और बुवाई शुरू करें।',
          'बुवाई से पहले बीजोपचार अवश्य करें।',
          'सावधानी के तौर पर हल्की सिंचाई का साधन तैयार रखें।'
        ],
        isFalseOnset: false,
        probabilities: { onset, break: brk, heavy },
        confidence: { rating: confRating, score: confScore }
      };
    }

    return {
      decision: 'SOW',
      headline: `Favorable Conditions for ${crop} (${currentStage})`,
      headline_hi: `${crop} के लिए अनुकूल मौसम स्थितियां`,
      reason: `Consistent rainfall anticipated (${pct(onset)}) supporting active ${currentStage} development.`,
      reason_hi: `नियमित वर्षा (${pct(onset)}) से फसल के विकास में मदद मिलेगी।`,
      recommendedActions: [
        'Proceed with planned agronomic operations and weed management.',
        'Monitor field drainage after regular showers.'
      ],
      recommendedActions_hi: [
        'नियमित कृषि कार्य और खरपतवार नियंत्रण जारी रखें।',
        'खेत में पानी का बहाव सामान्य रखें।'
      ],
      isFalseOnset: false,
      probabilities: { onset, break: brk, heavy },
      confidence: { rating: confRating, score: confScore }
    };
  }

  // 5. Default / Neutral Outlook
  return {
    decision: 'WAIT',
    headline: `Monitor Conditions — Routine Outlook for ${crop}`,
    headline_hi: `निगरानी रखें — ${crop} के लिए सामान्य पूर्वानुमान`,
    reason: 'No significant onset, dry-spell, or heavy-rain anomaly detected for your area this week. Signals remain near climatological averages.',
    reason_hi: 'इस सप्ताह आपके क्षेत्र में कोई बड़ा सूखा या भारी बारिश का संकेत नहीं है। मौसम सामान्य बना हुआ है।',
    recommendedActions: [
      'Continue routine field monitoring according to standard crop calendar.',
      'Check local weather updates daily before planning chemical sprays.'
    ],
    recommendedActions_hi: [
      'फसल कैलेंडर के अनुसार सामान्य निगरानी जारी रखें।',
      'छिड़काव या सिंचाई से पहले मौसम अपडेट जरूर देखें।'
    ],
    isFalseOnset: false,
    probabilities: { onset, break: brk, heavy },
    confidence: { rating: confRating, score: confScore }
  };
}

// -------------------------------------------------------------------------
// Render: Home Page (Decision Hero, Probabilities, False Onset Shield, 7 Days)
// -------------------------------------------------------------------------
function renderHomePage() {
  if (!currentForecast) return;

  const d = DISTRICTS.find((x) => x.district_id === selectedDistrictId) || DISTRICTS[0];
  $('#homeLocationDisplay').textContent = `${d.name}, ${d.state}`;
  $('#mobileLocName').textContent = `${d.name}`;
  $('#mobileCropBadge').textContent = `${cropEmoji(selectedCrop)} ${selectedCrop}`;

  currentDecision = decisionEngine(currentForecast, selectedCrop, selectedStage, d);

  // Decision Card Badge & Heading
  const card = $('#mainDecisionCard');
  card.className = `decision-card ${currentDecision.decision.toLowerCase()}`;

  const iconMap = { SOW: '🟢', WAIT: '🟡', PROTECT: '🔴' };
  $('#decisionIcon').textContent = iconMap[currentDecision.decision];
  $('#decisionText').textContent = currentLang === 'hi' ? t('decision_' + currentDecision.decision.toLowerCase()) : currentDecision.decision;
  $('#decisionHeadline').textContent = currentLang === 'hi' ? currentDecision.headline_hi : currentDecision.headline;
  $('#decisionReason').textContent = currentLang === 'hi' ? currentDecision.reason_hi : currentDecision.reason;

  // Probabilities
  const c = currentForecast.current;
  $('#homeOnsetProb').textContent = pct(c.onset_probability);
  $('#homeBreakProb').textContent = pct(c.break_probability);
  $('#homeHeavyProb').textContent = pct(c.heavy_rain_probability);
  $('#homeReliability').textContent = currentDecision.confidence.rating;

  // Action Bullets
  const actions = currentLang === 'hi' ? currentDecision.recommendedActions_hi : currentDecision.recommendedActions;
  $('#decisionActionsList').innerHTML = actions.map((act) => `<li>${act}</li>`).join('');

  // False Onset Shield Render
  const shieldEl = $('#falseOnsetShield');
  if (currentDecision.isFalseOnset && currentDecision.falseOnsetDetails) {
    shieldEl.classList.remove('hidden');
    $('#shieldOnsetVal').textContent = pct(currentDecision.falseOnsetDetails.onsetProb);
    $('#shieldBreakVal').textContent = pct(currentDecision.falseOnsetDetails.breakProb);
    $('#shieldPeriodVal').textContent = currentLang === 'hi' ? currentDecision.falseOnsetDetails.period_hi : currentDecision.falseOnsetDetails.period;
    $('#shieldActionText').textContent = currentLang === 'hi' ? currentDecision.falseOnsetDetails.action_hi : currentDecision.falseOnsetDetails.action;
  } else {
    shieldEl.classList.add('hidden');
  }

  // Render 7-day strip
  render7DayStrip();
}

function render7DayStrip() {
  const tl = currentForecast.timeline || [];
  const days = tl.slice(0, 7);
  const container = $('#homeDayStrip');

  container.innerHTML = days.map((day, idx) => {
    const dObj = new Date(day.date);
    const dayName = idx === 0 ? (currentLang === 'hi' ? 'आज' : 'Today') : dObj.toLocaleDateString(currentLang === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'short' });
    const dateStr = dObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

    let icon = '⛅';
    let statusClass = 'normal';
    let statusText = t('routine_window');

    if (day.heavy_rain_probability >= 0.5) {
      icon = '⛈️';
      statusClass = 'heavy-risk';
      statusText = t('heavy_rain_window');
    } else if (day.break_probability >= 0.55) {
      icon = '☀️';
      statusClass = 'break-risk';
      statusText = t('break_risk_window');
    } else if (day.onset_probability >= 0.55) {
      icon = '🌧️';
      statusClass = 'favorable';
      statusText = t('favorable_window');
    }

    return `
      <div class="day-card ${idx === 0 ? 'today' : ''}">
        <span class="day-name">${dayName}</span>
        <span class="day-date">${dateStr}</span>
        <span class="day-icon">${icon}</span>
        <span class="day-prob">${pct(day.onset_probability)}</span>
        <span class="day-status-pill ${statusClass}">${statusText}</span>
      </div>
    `;
  }).join('');
}

// -------------------------------------------------------------------------
// Render: Forecast Page (Timeline, Uncertainty, Table, Chart)
// -------------------------------------------------------------------------
function renderForecastPage() {
  if (!currentForecast) return;

  const d = DISTRICTS.find((x) => x.district_id === selectedDistrictId) || DISTRICTS[0];
  $('#forecastPageLocation').textContent = `${d.name}, ${d.state} — ${horizonDays} Days Horizon`;

  // Weekly Phases
  renderWeeklyPhases();

  // Daily Table
  renderForecastDailyTable();

  // Chart
  renderForecastChart();
}

function renderWeeklyPhases() {
  const tl = currentForecast.timeline || [];
  const weeks = [];
  const totalWeeks = Math.ceil(horizonDays / 7);

  for (let w = 0; w < totalWeeks; w++) {
    const chunk = tl.filter((t) => t.day_offset >= w * 7 && t.day_offset < (w + 1) * 7);
    if (!chunk.length) continue;
    const avg = (k) => chunk.reduce((s, t) => s + t[k], 0) / chunk.length;
    weeks.push({
      weekNum: w + 1,
      range: `${chunk[0].date.slice(5)} to ${chunk[chunk.length - 1].date.slice(5)}`,
      onset: avg('onset_probability'),
      brk: avg('break_probability'),
      heavy: avg('heavy_rain_probability')
    });
  }

  const container = $('#timelinePhasesContainer');
  container.innerHTML = weeks.map((wk) => {
    let title = 'Favorable Monsoon Phase';
    let desc = 'Rainfall expected to support routine field operations.';

    if (wk.brk >= 0.55) {
      title = 'Elevated Dry Spell Phase';
      desc = 'Elevated risk of moisture deficit. Supplemental irrigation recommended.';
    } else if (wk.heavy >= 0.55) {
      title = 'Heavy Rainfall Window';
      desc = 'Downpour risks waterlogging; ensure proper field drainage channels.';
    }

    return `
      <div class="phase-card">
        <div class="phase-card-week">
          <span>Week ${wk.weekNum}</span>
          <small>${wk.range}</small>
        </div>
        <div class="phase-card-title">${title}</div>
        <div class="phase-card-desc">${desc}</div>
        <div class="phase-card-probs">
          <span>Onset: <b>${pct(wk.onset)}</b></span>
          <span>Dry Spell: <b>${pct(wk.brk)}</b></span>
          <span>Heavy: <b>${pct(wk.heavy)}</b></span>
        </div>
      </div>
    `;
  }).join('');
}

function renderForecastDailyTable() {
  const tl = currentForecast.timeline.slice(0, horizonDays);
  const tbody = $('#forecastTableBody');

  tbody.innerHTML = tl.map((day) => {
    let windowTag = '<span class="day-status-pill normal">Routine</span>';
    if (day.heavy_rain_probability >= 0.5) {
      windowTag = '<span class="day-status-pill heavy-risk">Heavy Rain</span>';
    } else if (day.break_probability >= 0.55) {
      windowTag = '<span class="day-status-pill break-risk">Dry Spell</span>';
    } else if (day.onset_probability >= 0.55) {
      windowTag = '<span class="day-status-pill favorable">Favorable</span>';
    }

    return `
      <tr>
        <td><strong>${day.date}</strong></td>
        <td>+${day.day_offset}d</td>
        <td><strong style="color:var(--accent-sky)">${pct(day.onset_probability)}</strong></td>
        <td><strong style="color:var(--wait-solid)">${pct(day.break_probability)}</strong></td>
        <td><strong style="color:var(--protect-solid)">${pct(day.heavy_rain_probability)}</strong></td>
        <td>${windowTag}</td>
      </tr>
    `;
  }).join('');
}

function renderForecastChart() {
  const tl = currentForecast.timeline.slice(0, horizonDays);
  const labels = tl.map((t) => t.date.slice(5));

  const dataOnset = tl.map((t) => Math.round(t.onset_probability * 100));
  const dataBreak = tl.map((t) => Math.round(t.break_probability * 100));
  const dataHeavy = tl.map((t) => Math.round(t.heavy_rain_probability * 100));

  const canvas = $('#detailedForecastChart');
  if (!canvas) return;

  detailedChartInstance?.destroy();
  detailedChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Onset', data: dataOnset, borderColor: '#0284c7', backgroundColor: '#0284c715', tension: 0.35, pointRadius: 2, fill: true },
        { label: 'Dry Spell', data: dataBreak, borderColor: '#d97706', backgroundColor: '#d9770615', tension: 0.35, pointRadius: 2, fill: true },
        { label: 'Heavy Rain', data: dataHeavy, borderColor: '#dc2626', backgroundColor: '#dc262615', tension: 0.35, pointRadius: 2, fill: true },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#e2e8f0' }, ticks: { color: '#64748b', font: { size: 10 } } },
        y: { min: 0, max: 100, grid: { color: '#e2e8f0' }, ticks: { color: '#64748b', font: { size: 10 }, callback: (v) => v + '%' } }
      }
    }
  });
}

$('#btnToggleChart').onclick = () => {
  const wrapper = $('#forecastChartWrapper');
  wrapper.classList.toggle('hidden');
  const isHidden = wrapper.classList.contains('hidden');
  $('#btnToggleChart').textContent = isHidden ? t('toggle_chart_btn') : (currentLang === 'hi' ? 'ग्राफ छिपाएं' : 'Hide Trend Chart');
  if (!isHidden) {
    setTimeout(() => detailedChartInstance?.resize(), 100);
  }
};

// -------------------------------------------------------------------------
// Render: My Crop View & Scenarios
// -------------------------------------------------------------------------
function renderMyCropPage() {
  if (!currentForecast) return;

  $('#cropAvatar').textContent = cropEmoji(selectedCrop);
  $('#currentStageBadge').textContent = `${selectedCrop.toUpperCase()} — ${selectedStage.toUpperCase()} STAGE`;

  // Fetch updated advisory from engine
  const dec = decisionEngine(currentForecast, selectedCrop, selectedStage, district(selectedDistrictId));
  $('#stageAdvisoryTitle').textContent = currentLang === 'hi' ? dec.headline_hi : dec.headline;
  $('#stageAdvisoryMessage').textContent = currentLang === 'hi' ? dec.reason_hi : dec.reason;
  const actions = currentLang === 'hi' ? dec.recommendedActions_hi : dec.recommendedActions;
  $('#stageAdvisoryAction').textContent = actions.join(' ');

  renderScenarios();
}

function renderScenarios() {
  const cur = currentForecast.current;
  const onset = cur.onset_probability;
  const brk = cur.break_probability;
  const heavy = cur.heavy_rain_probability;

  // Scenario 1: What if I sow today?
  const initialOutlook = onset >= 0.55 ? 'Favorable (initial rains likely)' : (brk >= 0.55 ? 'Dry / Low moisture' : 'Moderate rainfall');
  const drySpellStatus = brk >= 0.55 ? `Elevated (${pct(brk)})` : `Low (${pct(brk)})`;
  const heavyStatus = heavy >= 0.55 ? `Elevated (${pct(heavy)})` : `Low (${pct(heavy)})`;

  let mainConcern = 'Moisture stress after germination causing patchy seedling emergence.';
  let suggestedAction = 'Wait 5–7 days for rainfall stabilization before broadcasting seeds.';

  if (onset >= 0.6 && brk < 0.45) {
    mainConcern = 'Minimal risk detected. Favorable moisture window.';
    suggestedAction = 'Safe to proceed with certified seed sowing and seed treatment.';
  } else if (heavy >= 0.55) {
    mainConcern = 'Seed washout and soil surface compaction due to torrential rain.';
    suggestedAction = 'Wait for heavy spell to pass and prepare raised drainage beds.';
  }

  $('#scenarioSowBody').innerHTML = `
    <div class="scenario-row"><span>Initial Outlook (Days 1–3):</span><strong>${initialOutlook}</strong></div>
    <div class="scenario-row"><span>Dry-Spell Risk (Days 4–10):</span><strong class="${brk >= 0.55 ? 'text-warn' : ''}">${drySpellStatus}</strong></div>
    <div class="scenario-row"><span>Heavy-Rain Risk:</span><strong>${heavyStatus}</strong></div>
    <div class="scenario-concern">
      <b>⚠️ Main Agronomic Concern:</b>
      <span>${mainConcern}</span>
    </div>
    <div class="scenario-action-box">
      <b>✓ Suggested Decision:</b>
      <span>${suggestedAction}</span>
    </div>
  `;

  // Scenario 2: What if I already sowed?
  let contingency1 = 'Arrange supplemental light irrigation via drip or sprinkler to keep soil moist.';
  let contingency2 = 'Apply organic straw mulch over rows to minimize root-zone evaporation.';
  let contingency3 = 'Defer nitrogen fertilizer top-dressing until regular rains arrive.';

  if (heavy >= 0.55) {
    contingency1 = 'Dig trenches around field perimeter to avoid standing water.';
    contingency2 = 'Clear blockages from drainage channels immediately.';
    contingency3 = 'Inspect for seedling root-rot diseases and spray bio-fungicide once clear.';
  }

  $('#scenarioAlreadyBody').innerHTML = `
    <div class="scenario-row"><span>Standing Crop Stage:</span><strong>${selectedCrop} (${selectedStage})</strong></div>
    <div class="scenario-row"><span>Field Moisture Stress:</span><strong>${brk >= 0.55 ? 'High (Dry Spell)' : (heavy >= 0.55 ? 'Excess Water' : 'Normal')}</strong></div>
    <div class="scenario-action-box">
      <b>🛡️ Immediate Mitigation Steps:</b>
      <ul style="margin:4px 0 0 16px;list-style:disc">
        <li>${contingency1}</li>
        <li>${contingency2}</li>
        <li>${contingency3}</li>
      </ul>
    </div>
  `;
}

// Scenario Modals triggered from Home screen
function openScenarioModal(type) {
  const modal = $('#scenarioModal');
  const title = $('#scenarioModalTitle');
  const body = $('#scenarioModalBody');

  if (type === 'sow') {
    title.textContent = t('what_if_sow_btn');
    body.innerHTML = $('#scenarioSowBody').innerHTML;
  } else {
    title.textContent = t('what_if_already_sown_btn');
    body.innerHTML = $('#scenarioAlreadyBody').innerHTML;
  }

  modal.showModal();
}

$('#btnWhatIfSow').onclick = () => openScenarioModal('sow');
$('#btnWhatIfAlreadySown').onclick = () => openScenarioModal('already');
$('#btnCloseModal').onclick = () => $('#scenarioModal').close();
$('#btnModalAcknowledge').onclick = () => $('#scenarioModal').close();

// -------------------------------------------------------------------------
// Render: Alerts View
// -------------------------------------------------------------------------
function renderAlertsPage(filter = 'all') {
  const container = $('#alertsFeedList');
  if (!lastAlertFeed.length) {
    container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">No active severe alerts detected at this time.</div>';
    return;
  }

  let items = [...lastAlertFeed];

  if (filter === 'critical') {
    items = items.filter((x) => x.advisory.severity === 'critical');
  } else if (filter === 'warning') {
    items = items.filter((x) => x.advisory.severity === 'warning');
  } else if (filter === 'local') {
    items = items.filter((x) => x.district_id === selectedDistrictId);
  }

  $('#navAlertBadge').textContent = lastAlertFeed.filter((x) => x.advisory.severity === 'critical' || x.advisory.severity === 'warning').length;

  if (!items.length) {
    container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">No matching alerts found for this filter.</div>';
    return;
  }

  container.innerHTML = items.map((item) => {
    const sev = item.advisory.severity;
    let icon = '🌾';
    let typeName = 'Advisory';

    if (sev === 'critical') {
      icon = '⛈️';
      typeName = 'High Risk';
    } else if (sev === 'warning') {
      icon = '☀️';
      typeName = 'Dry Spell Warning';
    } else if (item.advisory.title_en?.toLowerCase().includes('false onset')) {
      icon = '⚠️';
      typeName = 'False Onset Alert';
    }

    const title = currentLang === 'hi' ? item.advisory.title_hi : item.advisory.title_en;
    const msg = currentLang === 'hi' ? item.advisory.message_hi : item.advisory.message_en;
    const act = currentLang === 'hi' ? item.advisory.action_hi : item.advisory.action_en;

    return `
      <article class="action-alert-card ${sev}">
        <span class="alert-type-icon">${icon}</span>
        <div class="alert-card-content">
          <div class="alert-card-meta">
            <span class="alert-type-badge ${sev}">${typeName}</span>
            <span class="alert-loc">📍 ${item.district_name}, ${item.state} • ${item.primary_crop}</span>
          </div>
          <h4 class="alert-title">${title}</h4>
          <p class="alert-desc">${msg}</p>
          <div class="alert-action-line">
            <strong>What to do:</strong> ${act}
          </div>
        </div>
      </article>
    `;
  }).join('');
}

$$('#alertFilterTabs button').forEach((btn) => {
  btn.onclick = () => {
    $$('#alertFilterTabs button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    renderAlertsPage(btn.dataset.filter);
  };
});

// -------------------------------------------------------------------------
// National & District Risk Map (Home Page Interactive Explorer)
// -------------------------------------------------------------------------
function initMainMap() {
  if (mainMapInstance) return;

  const mapEl = $('#mainLeafletMap');
  if (!mapEl) return;

  mainMapInstance = L.map('mainLeafletMap', {
    attributionControl: false,
    scrollWheelZoom: true
  }).setView([22.5, 79.0], 4.4);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18
  }).addTo(mainMapInstance);

  plotMainMarkers();
}

function plotMainMarkers() {
  if (!mainMapInstance || !SNAPSHOT.length) return;

  Object.values(mainMapMarkers).forEach((m) => mainMapInstance.removeLayer(m));
  mainMapMarkers = {};

  SNAPSHOT.forEach((d) => {
    let color = '#15803d'; // green
    let val = Math.round(d[activeMapLayer] * 100);

    if (activeMapLayer === 'farming_risk') {
      if (d.break_probability >= 0.55) color = '#d97706'; // amber
      else if (d.heavy_rain_probability >= 0.55) color = '#dc2626'; // red
      else color = '#15803d'; // green
    } else {
      color = val >= 70 ? '#dc2626' : val >= 40 ? '#d97706' : '#15803d';
    }

    const isSelected = d.district_id === selectedDistrictId;

    const marker = L.circleMarker([d.lat, d.lon], {
      radius: isSelected ? 9 : 6,
      color: isSelected ? '#0f172a' : '#ffffff',
      weight: isSelected ? 3 : 1,
      fillColor: color,
      fillOpacity: isSelected ? 1.0 : 0.85
    }).addTo(mainMapInstance);

    const tooltipContent = `<b>${d.district_name}</b> (${d.state})<br>` +
      `Onset: ${pct(d.onset_probability)} · Dry Spell: ${pct(d.break_probability)}<br>` +
      `<small style="color:#0284c7">Click to select</small>`;
    marker.bindTooltip(tooltipContent);

    marker.on('click', () => {
      selectDistrict(d.district_id, false);
    });

    mainMapMarkers[d.district_id] = marker;
  });
}

function highlightDistrictOnMap(districtId, panTo = false) {
  if (!mainMapInstance) return;
  const d = SNAPSHOT.find((x) => x.district_id === districtId);
  if (!d) return;

  Object.entries(mainMapMarkers).forEach(([id, marker]) => {
    const isSel = id === districtId;
    marker.setStyle({
      radius: isSel ? 9 : 6,
      color: isSel ? '#0f172a' : '#ffffff',
      weight: isSel ? 3 : 1,
      fillOpacity: isSel ? 1.0 : 0.85
    });
    if (isSel) marker.bringToFront();
  });

  if (panTo) {
    mainMapInstance.setView([d.lat, d.lon], 7, { animate: true });
  }
}

function updateSelectedDistrictPanel(districtId) {
  const snap = SNAPSHOT.find((x) => x.district_id === districtId);
  if (!snap) return;

  const d = district(districtId);
  const crop = selectedCrop || snap.primary_crop || d.primary_crop;

  $('#drawerDistrictName').textContent = `${snap.district_name}, ${snap.state}`;
  $('#drawerDistrictCrop').textContent = `Primary Crop: ${crop}`;
  $('#drawerOnset').textContent = pct(snap.onset_probability);
  $('#drawerBreak').textContent = pct(snap.break_probability);
  $('#drawerHeavy').textContent = pct(snap.heavy_rain_probability);

  let decText = 'SOW / FAVORABLE';
  let decBg = 'var(--sow-badge-bg)';
  let decColor = 'var(--sow-text)';

  if (snap.break_probability >= 0.55) {
    decText = 'WAIT / DRY SPELL RISK';
    decBg = 'var(--wait-badge-bg)';
    decColor = 'var(--wait-text)';
  } else if (snap.heavy_rain_probability >= 0.55) {
    decText = 'PROTECT / HEAVY RAIN';
    decBg = 'var(--protect-badge-bg)';
    decColor = 'var(--protect-text)';
  }

  const chip = $('#drawerDecisionChip');
  if (chip) {
    chip.textContent = decText;
    chip.style.backgroundColor = decBg;
    chip.style.color = decColor;
  }

  const adv = $('#drawerAdvisory');
  if (adv) {
    let expl = `District risk level: ${snap.risk_level}. Calibrated against IMD historical gridded rainfall.`;
    if (snap.break_probability >= 0.55) {
      expl = `Elevated dry-spell risk (${pct(snap.break_probability)}) detected. Moisture stress likely; defer rainfed sowing.`;
    } else if (snap.heavy_rain_probability >= 0.55) {
      expl = `Heavy downpour alert (${pct(snap.heavy_rain_probability)}). Waterlogging risk; ensure drainage outlets are clear.`;
    } else if (snap.onset_probability >= 0.55) {
      expl = `Favorable monsoon onset conditions (${pct(snap.onset_probability)}) with low break risk. Favorable sowing window.`;
    }
    adv.textContent = expl;
  }
}

$$('#homeMapLayers button').forEach((btn) => {
  btn.onclick = () => {
    $$('#homeMapLayers button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    activeMapLayer = btn.dataset.layer;
    plotMainMarkers();
  };
});

$$('.expert-tab').forEach((tab) => {
  tab.onclick = () => {
    $$('.expert-tab').forEach((b) => b.classList.remove('active'));
    tab.classList.add('active');
    $$('.expert-panel').forEach((p) => p.classList.toggle('active', p.id === 'expert-panel-' + tab.dataset.sub));
  };
});

function renderExpertClimate() {
  if (!currentForecast || !currentForecast.climate_context) return;
  const c = currentForecast.climate_context;
  $('#climateAsOf').textContent = `Data valid as of: ${c.as_of}`;

  const container = $('#expertTeleconnectionsGrid');
  container.innerHTML = `
    <div class="teleconnection-card">
      <b>ENSO: Nino 3.4 (ONI)</b>
      <div class="tele-val">${c.enso.value > 0 ? '+' : ''}${c.enso.value}</div>
      <p>Phase: <strong>${c.enso.phase}</strong> (${c.enso.trend})</p>
      <small>Live NOAA Climate Prediction Center feed</small>
    </div>
    <div class="teleconnection-card">
      <b>IOD: Dipole Mode Index (DMI)</b>
      <div class="tele-val">${c.iod.value > 0 ? '+' : ''}${c.iod.value}</div>
      <p>Phase: <strong>${c.iod.phase}</strong> (${c.iod.trend})</p>
      <small>Live NOAA Physical Sciences Laboratory feed</small>
    </div>
    <div class="teleconnection-card">
      <b>MJO: Wheeler-Hendon RMM</b>
      <div class="tele-val">Phase ${c.mjo.phase}</div>
      <p>Amplitude: <strong>${c.mjo.amplitude}</strong> (${c.mjo.phase_label})</p>
      <small>Australian Bureau of Meteorology (BoM)</small>
    </div>
  `;
}

function renderExpertAnalytics() {
  const r2Scores = {
    onset: { label: 'Monsoon Onset Model', r2: 0.41, mae: '0.180' },
    break: { label: 'Dry Spell / Break Model', r2: 0.41, mae: '0.178' },
    heavy: { label: 'Heavy Rainfall Model', r2: 0.09, mae: '0.016' }
  };

  $('#expertR2List').innerHTML = Object.values(r2Scores).map((s) => `
    <div class="r2-score-row">
      <div>
        <strong>${s.label}</strong>
        <small style="display:block;color:var(--text-muted)">MAE: ${s.mae}</small>
      </div>
      <b>R² = ${s.r2.toFixed(2)}</b>
    </div>
  `).join('');

  renderExpertFi();
}

function renderExpertFi() {
  if (!FI || !FI[activeFiTarget]) return;
  const list = FI[activeFiTarget];
  const labels = {
    lat: 'Latitude', lon: 'Longitude', coastal: 'Coastal Proximity',
    dry_belt: 'Dry-Belt Zone', oni: 'ENSO (ONI)', dmi: 'IOD (DMI)',
    mjo_amplitude: 'MJO Amplitude', mjo_phase: 'MJO Phase', month: 'Month / Season'
  };

  $('#expertFiList').innerHTML = list.map((f) => {
    const p = Math.round(f.importance * 100);
    return `
      <div class="fi-bar-row">
        <span>${labels[f.feature] || f.feature}</span>
        <div class="fi-bar-track">
          <div class="fi-bar-fill" style="width:${p * 2}%"></div>
        </div>
        <strong>${p}%</strong>
      </div>
    `;
  }).join('');
}

$$('#fiToggleButtons button').forEach((btn) => {
  btn.onclick = () => {
    $$('#fiToggleButtons button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    activeFiTarget = btn.dataset.target;
    renderExpertFi();
  };
});

function renderExpertFarmers() {
  const farmers = currentFarmers?.farmers || [];
  $('#expertFarmerCountBadge').textContent = `${farmers.length} Farmers within 60km`;

  const tbody = $('#expertFarmersTableBody');
  if (!farmers.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:16px">No WhatsApp farmers registered near this district yet.</td></tr>';
    return;
  }

  tbody.innerHTML = farmers.map((f) => `
    <tr>
      <td><strong>${f.name}</strong></td>
      <td>${f.district_name}</td>
      <td>${f.distance_km} km</td>
      <td>${f.crops.join(', ') || '—'}</td>
      <td>${f.land_size_acres ? f.land_size_acres + ' ac' : '—'}</td>
      <td>${f.irrigation_access ? 'Yes' : 'Rainfed'}</td>
      <td><code>${f.phone_masked}</code></td>
    </tr>
  `).join('');
}

// -------------------------------------------------------------------------
// Live Weather Feed (Open-Meteo)
// -------------------------------------------------------------------------
async function fetchAndRenderWeather(d) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${d.lat}&longitude=${d.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation&timezone=auto`;
    const res = await fetch(url);
    const data = await res.json();
    const cur = data.current;

    const cond = cur.precipitation > 0.2 ? 'Rain' : 'Clear / Cloudy';
    const tempStr = Math.round(cur.temperature_2m) + '°C';

    $('#homeMiniWeather').textContent = `${tempStr}, ${cond}`;
    $('#quickTemp').textContent = tempStr;
    $('#quickCond').textContent = cond;
    $('#quickHumidity').textContent = cur.relative_humidity_2m + '%';
    $('#quickWind').textContent = Math.round(cur.wind_speed_10m) + ' km/h';
    $('#quickPrecip').textContent = cur.precipitation + ' mm';
  } catch (err) {
    console.error('Weather fetch error:', err);
    $('#homeMiniWeather').textContent = 'Weather sync pending';
  }
}

// -------------------------------------------------------------------------
// District Selection & Location Management
// -------------------------------------------------------------------------
function district(id) {
  return DISTRICTS.find((d) => d.district_id === id) || DISTRICTS[0];
}

async function selectDistrict(id, panTo = true) {
  selectedDistrictId = id;
  const d = district(id);

  $('#stateSelect').value = d.state;
  populateDistrictOptions(d.state);
  $('#districtSelect').value = id;

  // Use district primary crop if user hasn't explicitly changed it
  if (!selectedCrop || !CROPS_LIST.includes(selectedCrop)) {
    selectedCrop = d.primary_crop;
  }
  $('#homeCropSelect').value = selectedCrop;
  $('#cropHubSelect').value = selectedCrop;

  updateSelectedDistrictPanel(id);
  highlightDistrictOnMap(id, panTo);

  await refreshAll();
}

function populateFilters() {
  const states = [...new Set(DISTRICTS.map((d) => d.state))].sort();
  $('#stateSelect').innerHTML = states.map((s) => `<option value="${s}">${s}</option>`).join('');
  $('#stateSelect').value = DISTRICTS[0].state;

  populateDistrictOptions(DISTRICTS[0].state);

  $('#stateSelect').onchange = () => {
    populateDistrictOptions($('#stateSelect').value);
    selectDistrict($('#districtSelect').value);
  };

  $('#districtSelect').onchange = () => {
    selectDistrict($('#districtSelect').value);
  };

  // Populate Crop Selectors
  const cropOptions = CROPS_LIST.map((c) => `<option value="${c}">${cropEmoji(c)} ${c}</option>`).join('');
  $('#homeCropSelect').innerHTML = cropOptions;
  $('#cropHubSelect').innerHTML = cropOptions;

  $('#homeCropSelect').value = selectedCrop;
  $('#cropHubSelect').value = selectedCrop;

  $('#homeCropSelect').onchange = (e) => {
    selectedCrop = e.target.value;
    $('#cropHubSelect').value = selectedCrop;
    refreshAll();
  };

  $('#cropHubSelect').onchange = (e) => {
    selectedCrop = e.target.value;
    $('#homeCropSelect').value = selectedCrop;
    refreshAll();
  };

  // Populate Stages
  const stageLabels = {
    planning: 'Planning', nursery: 'Nursery', sowing: 'Sowing/Transplanting',
    vegetative: 'Vegetative Growth', flowering: 'Flowering', harvest: 'Harvest'
  };

  $('#homeStageSelect').innerHTML = STAGES.map((st) => `<option value="${st}">${stageLabels[st]}</option>`).join('');
  $('#homeStageSelect').value = selectedStage;

  $('#homeStageSelect').onchange = (e) => {
    selectedStage = e.target.value;
    updateGrowthStageStepper(selectedStage);
    renderHomePage();
    renderMyCropPage();
  };
}

function populateDistrictOptions(state) {
  const list = DISTRICTS.filter((d) => d.state === state);
  $('#districtSelect').innerHTML = list.map((d) => `<option value="${d.district_id}">${d.name}</option>`).join('');
}

function updateGrowthStageStepper(st) {
  $$('#growthStageStepper button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.stage === st);
  });
}

$$('#growthStageStepper button').forEach((btn) => {
  btn.onclick = () => {
    selectedStage = btn.dataset.stage;
    $('#homeStageSelect').value = selectedStage;
    updateGrowthStageStepper(selectedStage);
    renderHomePage();
    renderMyCropPage();
  };
});

$$('.btn-horizon').forEach((btn) => {
  btn.onclick = () => {
    $$('.btn-horizon').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    horizonDays = parseInt(btn.dataset.days);
    refreshAll();
  };
});

// Geolocation: Find closest curated district
function useDeviceGpsLocation() {
  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser.');
    return;
  }

  $('#btnGpsLocation').textContent = 'Searching…';

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      let closest = DISTRICTS[0];
      let minDist = Infinity;

      DISTRICTS.forEach((d) => {
        const dist = Math.hypot(d.lat - latitude, d.lon - longitude);
        if (dist < minDist) {
          minDist = dist;
          closest = d;
        }
      });

      $('#btnGpsLocation').innerHTML = `<span class="gps-icon">⌖</span> <span class="gps-text">${t('use_location')}</span>`;
      selectDistrict(closest.district_id);
    },
    (err) => {
      console.warn('Geolocation error:', err);
      $('#btnGpsLocation').innerHTML = `<span class="gps-icon">⌖</span> <span class="gps-text">${t('use_location')}</span>`;
      alert('Unable to retrieve location. Please choose your district from the dropdown.');
    },
    { timeout: 8000 }
  );
}

$('#btnGpsLocation').onclick = useDeviceGpsLocation;
$('#btnMobileGps').onclick = useDeviceGpsLocation;
$('#btnMobileLocChange').onclick = () => {
  $('#districtSelect').focus();
  $('#districtSelect').click();
};

// Language Toggle
$$('.lang-toggle button').forEach((btn) => {
  btn.onclick = () => {
    $$('.lang-toggle button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentLang = btn.dataset.lang;
    applyStaticI18n();
    renderHomePage();
    renderForecastPage();
    renderMyCropPage();
    renderAlertsPage();
  };
});

// -------------------------------------------------------------------------
// Data Refresh Core
// -------------------------------------------------------------------------
async function refreshAll() {
  try {
    const [forecast, advisory, farmers] = await Promise.all([
      api(`/forecast/${selectedDistrictId}?horizon_days=${horizonDays}&crop=${encodeURIComponent(selectedCrop)}`),
      api(`/advisory/${selectedDistrictId}?stage=${selectedStage}`).catch(() => null),
      api(`/districts/${selectedDistrictId}/farmers`).catch(() => ({ farmers: [], radius_km: 60 })),
    ]);

    currentForecast = forecast;
    currentAdvisory = advisory;
    currentFarmers = farmers;

    const d = district(selectedDistrictId);
    fetchAndRenderWeather(d);

    renderHomePage();
    renderForecastPage();
    renderMyCropPage();
    renderAlertsPage();
    renderExpertClimate();
    renderExpertAnalytics();
    renderExpertFarmers();

    updateSelectedDistrictPanel(selectedDistrictId);
    if (mainMapInstance) {
      highlightDistrictOnMap(selectedDistrictId);
    }
  } catch (err) {
    console.error('Data refresh error:', err);
  }
}

// -------------------------------------------------------------------------
// Application Boot Sequence
// -------------------------------------------------------------------------
async function boot() {
  try {
    $('#bootStatus').textContent = 'Connecting to calibrated prediction ensemble…';
    [DISTRICTS, SNAPSHOT] = await Promise.all([
      api('/districts'),
      api('/districts/map')
    ]);

    try {
      const fiData = await api('/model/feature-importance');
      FI = fiData.targets;
    } catch (e) {
      console.warn('Feature importance API not wired; using model defaults.');
    }

    try {
      lastAlertFeed = await api('/advisory?limit=25');
    } catch (e) {
      lastAlertFeed = [];
    }

    populateFilters();
    selectedDistrictId = DISTRICTS[0].district_id;
    selectedCrop = DISTRICTS[0].primary_crop || 'Sugarcane';
    $('#homeCropSelect').value = selectedCrop;
    $('#cropHubSelect').value = selectedCrop;

    // Immediately render selected district quick summary panel (no blank fields)
    updateSelectedDistrictPanel(selectedDistrictId);

    // Initialize Home National/District Risk Map
    initMainMap();

    await refreshAll();

    $('#bootOverlay').classList.add('hidden');
    setTimeout(() => mainMapInstance?.invalidateSize(), 200);
  } catch (err) {
    console.error('Boot error:', err);
    $('#bootStatus').textContent = isLocal
      ? 'Cannot connect to local backend at port 8000. Start backend with: uvicorn app.main:app --port 8000'
      : 'Network error. Reconnecting…';
    setTimeout(boot, 6000);
  }
}

// Window resize & retry handlers
window.addEventListener('resize', () => mainMapInstance?.invalidateSize());

const btnRetry = $('#btnRetryApi');
if (btnRetry) {
  btnRetry.onclick = () => {
    hideApiError();
    $('#bootOverlay').classList.remove('hidden');
    boot();
  };
}

// Start Application
applyStaticI18n();
boot();
