// js/i18n.js
// Internationalization: 6 official UN languages (en/zh/fr/es/ru/ar).
// Defaults to en. Locale choice persists in localStorage('calc.lang') and is restored on next load.
// Exports: LOCALES / getLocale / setLocale / cycleLocale / getLocaleMeta / t(key, params?)

const K_LANG = 'calc.lang';
const DEFAULT = 'en';

// 6 official UN languages. dir sets <html dir>; label is the short tag shown on the switch button.
export const LOCALES = [
  { code: 'en', dir: 'ltr', label: 'EN' },
  { code: 'zh', dir: 'ltr', label: '中文' },
  { code: 'fr', dir: 'ltr', label: 'FR' },
  { code: 'es', dir: 'ltr', label: 'ES' },
  { code: 'ru', dir: 'ltr', label: 'RU' },
  { code: 'ar', dir: 'rtl', label: 'عربي' },
];

// Dictionary: key -> { locale: text }. Placeholders like {name} are replaced by t().
const STRINGS = {
  // Panel titles
  historyTitle: {
    en: 'History', zh: '历史记录', fr: 'Historique', es: 'Historial',
    ru: 'История', ar: 'السجل',
  },
  mathTitle: {
    en: 'MATH', zh: '数学', fr: 'MATH', es: 'MATH', ru: 'МАТЕМ', ar: 'رياضيات',
  },

  // Toasts
  noHistory: {
    en: 'No history', zh: '无历史记录', fr: 'Pas d’historique', es: 'Sin historial',
    ru: 'Нет истории', ar: 'لا يوجد سجل',
  },
  noMoreHistory: {
    en: 'No older record', zh: '已是更早记录', fr: 'Pas d’enregistrement plus ancien',
    es: 'Sin registro anterior', ru: 'Нет более ранних записей', ar: 'لا يوجد سجل أقدم',
  },
  noValueToStore: {
    en: 'No value to store', zh: '无有效值可存储', fr: 'Aucune valeur à stocker',
    es: 'Sin valor para guardar', ru: 'Нет значения для сохранения', ar: 'لا توجد قيمة للتخزين',
  },
  invalidVarName: {
    en: 'Variable name must be A-Z', zh: '变量名需为 A-Z',
    fr: 'Le nom de variable doit être A-Z', es: 'El nombre de variable debe ser A-Z',
    ru: 'Имя переменной должно быть A-Z', ar: 'يجب أن يكون اسم المتغير A-Z',
  },
  unavailable: {
    en: 'Not available', zh: '该功能暂未开放', fr: 'Indisponible', es: 'No disponible',
    ru: 'Недоступно', ar: 'غير متاح',
  },
  stoPrompt: {
    en: 'Store to variable (A-Z):', zh: '存入变量名 (A-Z)：',
    fr: 'Stocker dans la variable (A-Z) :', es: 'Guardar en variable (A-Z):',
    ru: 'Сохранить в переменную (A-Z):', ar: 'تخزين في المتغير (A-Z):',
  },
  storedIn: {
    en: 'Stored to {name}', zh: '已存入 {name}', fr: 'Enregistré dans {name}',
    es: 'Guardado en {name}', ru: 'Сохранено в {name}', ar: 'تم التخزين في {name}',
  },
  copied: {
    en: 'Copied', zh: '已复制', fr: 'Copié', es: 'Copiado',
    ru: 'Скопировано', ar: 'تم النسخ',
  },
  pasteFail: {
    en: 'Paste failed', zh: '粘贴失败', fr: 'Échec du collage', es: 'Error al pegar',
    ru: 'Не удалось вставить', ar: 'فشل اللصق',
  },
  noAns: {
    en: 'No Ans to continue', zh: '无 Ans 可续算', fr: 'Pas d’Ans pour continuer', es: 'Sin Ans para continuar',
    ru: 'Нет Ans для продолжения', ar: 'لا يوجد Ans للمتابعة',
  },

  // MATH panel group titles (stable keys; text changes with language)
  'math.trig': {
    en: 'Trigonometry', zh: '三角函数', fr: 'Trigonométrie', es: 'Trigonometría',
    ru: 'Тригонометрия', ar: 'حساب المثلثات',
  },
  'math.logexp': {
    en: 'Log & Exp', zh: '对数指数', fr: 'Log & Expo', es: 'Log y Exp',
    ru: 'Лог и Эксп', ar: 'لوغاريتم وأُس',
  },
  'math.powroot': {
    en: 'Power & Root', zh: '幂与根', fr: 'Puiss. & Racine', es: 'Potencia y Raíz',
    ru: 'Степень и Корень', ar: 'قوة وجذر',
  },
  'math.comb': {
    en: 'Combinatorics', zh: '组合数', fr: 'Combinatoire', es: 'Combinatoria',
    ru: 'Комбинаторика', ar: 'التوافيق',
  },
  'math.const': {
    en: 'Constants', zh: '常数/其他', fr: 'Constantes', es: 'Constantes',
    ru: 'Константы', ar: 'ثوابت',
  },
};

function safeStorage() {
  try {
    if (typeof localStorage === 'undefined') return null;
    // Only accept a real storage with getItem/setItem (the node global localStorage
    // has no such methods without --localstorage-file; headless import must skip it)
    if (typeof localStorage.getItem !== 'function' ||
        typeof localStorage.setItem !== 'function') return null;
    return localStorage;
  } catch { /* ignore */ }
  return null;
}

let _locale = DEFAULT;
{
  const s = safeStorage();
  if (s) {
    const saved = s.getItem(K_LANG);
    if (saved && LOCALES.some((l) => l.code === saved)) _locale = saved;
  }
}

export function getLocale() { return _locale; }

export function setLocale(code) {
  if (!LOCALES.some((l) => l.code === code)) return false;
  _locale = code;
  const s = safeStorage();
  if (s) s.setItem(K_LANG, code);
  return true;
}

// Cycle to the next language; returns the new locale's metadata. Used by the switch button.
export function cycleLocale() {
  const idx = LOCALES.findIndex((l) => l.code === _locale);
  const next = LOCALES[(idx + 1) % LOCALES.length];
  setLocale(next.code);
  return next;
}

export function getLocaleMeta() {
  return LOCALES.find((l) => l.code === _locale) || LOCALES[0];
}

// t(key, params?): returns the current-locale text; falls back to en, then to the key itself.
// Placeholders like {name} in params are replaced with the matching values.
export function t(key, params) {
  const entry = STRINGS[key];
  let s;
  if (entry) s = entry[_locale] ?? entry[DEFAULT] ?? key;
  else s = key;
  if (params) for (const k of Object.keys(params)) s = s.replace(`{${k}}`, params[k]);
  return s;
}
