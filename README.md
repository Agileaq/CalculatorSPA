# Scientific Calculator PWA

Offline-capable scientific calculator single-page app. Pure static, zero dependencies, zero build step — deployed to GitHub Pages, installable as a mobile PWA.

**Language:** [العربية](#العربية) · [中文](#中文) · [English](#english) · [Français](#français) · [Русский](#русский) · [Español](#español)

---

## English

A scientific calculator single-page app that works offline. Pure static, zero dependencies, zero build step (HTML + CSS + native ES modules). Deployed to GitHub Pages, installable as a mobile PWA.

**Live:** https://agileaq.github.io/CalculatorSPA/

### Run locally

```bash
python3 -m http.server 8000
```

- **Production view** (cached, served by the service worker): `http://localhost:8000/`
- **Dev preview** (no service worker, live edits): `http://localhost:8000/dev.html`

> Must be served over HTTP — ES modules and the service worker do not work over `file://`.

### Tests

Open `tests/test.html` in a browser (or `http://localhost:8000/tests/test.html`) for the PASS/FAIL summary — about 70 cases covering formatting, lexing, parsing, evaluation, engine, editor, history, state and key mapping.

### Features

- **Basic arithmetic**: four operations, parentheses, `π` / `e`, percent `%`, `EE` (×10ⁿ), `Ans` reuse
- **Scientific functions**: `Sin` / `Cos` / `Tan` (DEG/RAD toggle), `Ln` / `Log`, `√` / `³√`, inverse trig `sin⁻¹` / `cos⁻¹` / `tan⁻¹`, `abs`
- **Powers & combinatorics**: `x²` / `x³` / `x⁻¹` / `xⁿ`, permutations `nPr` / combinations `nCr`
- **Shift second functions** (long-press): log, inverse trig, x³, ³√, x⁻¹, nCr/nPr, %, eˣ …
- **MATH panel**: grouped function catalog, tap to insert
- **History recall**: `∧` / `∨` (or `↑` / `↓`) Casio REPLAY-style traversal
- **Storage**: `STO` stores results into A–Z variables
- **History panel**: tap an entry to reuse it; history and variables persist in localStorage
- **Editing**: inline cursor, backspace, AC, undo/redo, physical keyboard support

### Deploy to GitHub Pages

Push to `master` — GitHub Actions auto-deploys the whole repo to Pages. All paths are relative, so subpath deployment needs no configuration.

Installed PWAs update automatically: every push stamps the commit SHA into the service-worker cache name (`calc-vN-<sha>`), the browser detects the byte diff and shows an in-app update banner. Real releases bump the human-readable version (`CACHE` in `sw.js` + the `#version` badge). The `v5/`–`v7/` directories are frozen rollback snapshots only, never boot targets.

### Install on your phone

Open the live URL in your mobile browser → menu → **Add to Home Screen**, to run it standalone and offline.

---

## 中文

离线可用的科学计算器单页应用。纯静态、零依赖、零构建（HTML + CSS + 原生 ES modules），部署到 GitHub Pages，可安装为手机端 PWA。

**在线访问：** https://agileaq.github.io/CalculatorSPA/

### 本地运行

```bash
python3 -m http.server 8000
```

- **线上视图**（经 service worker 缓存）：`http://localhost:8000/`
- **开发预览**（无 service worker，改了即时生效）：`http://localhost:8000/dev.html`

> 必须经 HTTP 服务访问，`file://` 下 ES modules 与 service worker 不生效。

### 运行测试

浏览器打开 `tests/test.html`（或 `http://localhost:8000/tests/test.html`），查看 PASS/FAIL 汇总。覆盖格式化、词法、语法、求值、引擎、编辑器、历史、状态、键位映射等约 70 个用例。

### 功能

- **基础运算**：四则运算、括号、`π` / `e`、百分比 `%`、`EE`（×10ⁿ）、`Ans` 复用上次结果
- **科学函数**：`Sin` / `Cos` / `Tan`（DEG/RAD 切换）、`Ln` / `Log`、`√` / `³√`、反三角 `sin⁻¹` / `cos⁻¹` / `tan⁻¹`、`abs`
- **幂与组合**：`x²` / `x³` / `x⁻¹` / `xⁿ`、排列 `nPr` / 组合 `nCr`
- **Shift 第二功能**（长按）：`log`、反三角、`x³`、`³√`、`x⁻¹`、`nCr`/`nPr`、`%`、`eˣ` 等
- **MATH 面板**：分组函数目录，点选即插入
- **历史回溯**：`∧` / `∨`（或 `↑` / `↓`）按 Casio REPLAY 方式回溯历史算式
- **存储**：`STO` 把结果存入 A–Z 变量
- **历史记录**：条目可点击复用；历史与变量经 localStorage 持久化
- **编辑体验**：行内光标、`⌫`、AC、撤销 / 重做、物理键盘支持

### 部署到 GitHub Pages

推送到 `master` 即自动部署（Actions 发布整仓库到 Pages），访问 `https://<用户名>.github.io/CalculatorSPA/`。所有路径均为相对路径，子路径部署无需改配置。

已安装的 PWA 会自动收到更新：每次推送都会把提交 SHA 盖进 service worker 缓存名（`calc-vN-<sha>`），浏览器检测到字节差异后弹出应用内「更新」横幅。正式发布时手动更新可读版本号（`sw.js` 的 `CACHE` 与 `#version` 徽标）。`v5/`–`v7/` 目录是冻结的回滚快照，仅作备份，不是启动入口。

### 安装为手机 PWA

用手机浏览器打开线上地址 → 菜单「添加到主屏幕」，以独立窗口离线运行。

---

## العربية

<div dir="rtl">

تطبيق صفحة واحدة لآلة حاسبة علمية تعمل دون اتصال بالإنترنت. ملفات ثابتة بحتة، بلا تبعيات وبلا خطوة بناء (HTML + CSS + وحدات ES الأصلية)، منشور على GitHub Pages، ويمكن تثبيته كتطبيق PWA على الهاتف.

**الرابط المباشر:** https://agileaq.github.io/CalculatorSPA/

### التشغيل محلياً

```bash
python3 -m http.server 8000
```

- **عرض الإنتاج** (مع تخزين service worker المؤقت): `http://localhost:8000/`
- **عرض التطوير** (بدون service worker، التعديلات فورية): `http://localhost:8000/dev.html`

> يجب فتحه عبر خادم HTTP — فوحدات ES والـ service worker لا يعملان عبر `file://`.

### الاختبارات

افتح `tests/test.html` في المتصفح (أو `http://localhost:8000/tests/test.html`) لعرض ملخص PASS/FAIL: نحو 70 حالة تغطي التنسيق والتحليل المعجمي والنحوي والتقييم والمحرك والمحرر والسجل والحالة وخرائط المفاتيح.

### المزايا

- **العمليات الأساسية**: الحساب والأقواس و`π` / `e` والنسبة `%` و`EE` (×10ⁿ) وإعادة استخدام `Ans`
- **الدوال العلمية**: `Sin` / `Cos` / `Tan` (تبديل DEG/RAD)، `Ln` / `Log`، `√` / `³√`، الدوال المثلثية العكسية، `abs`
- **القوى والتوافيق**: `x²` / `x³` / `x⁻¹` / `xⁿ`، التباديل `nPr` / التوافيق `nCr`
- **وظائف Shift الثانية** (ضغط مطوّل): log، الدوال العكسية، x³، ³√، x⁻¹، nCr/nPr، %، eˣ…
- **لوحة MATH**: دليل دوال مجمّعة، انقر للإدراج
- **استعراض السجل**: `∧` / `∨` (أو `↑` / `↓`) بأسلوب REPLAY في حاسبات Casio
- **الذاكرة**: `STO` يخزن النتيجة في متغيرات A–Z
- **سجل العمليات**: إعادة استخدام أي إدخال بالنقر عليه، مع تخزين دائم في localStorage
- **التحرير**: مؤشر داخل السطر، مسح، AC، تراجع/إعادة، ودعم لوحة المفاتيح الفعلية

### النشر على GitHub Pages

ادفع التغييرات إلى `master`، وستنشر GitHub Actions المستودع كاملاً تلقائياً. جميع المسارات نسبية، لذا لا يتطلب النشر ضمن مسار فرعي أي إعداد.

تتحدث تطبيقات PWA المثبتة تلقائياً: كل عملية دفع تُلحق بصمة الالتزام (SHA) باسم ذاكرة service worker المؤقتة (`calc-vN-<sha>`)، وعند رصد المتصفح لاختلاف البايتات يظهر شعار تحديث داخل التطبيق. أما الإصدارات الرسمية فتُحدَّث صيغتها المقروءة (`CACHE` في `sw.js` وشارة `#version`). مجلدات `v5/`–`v7/` لقطات مجمّدة للتراجع فقط، وليست مداخل تشغيل.

### التثبيت على الهاتف

افتح الرابط المباشر في متصفح الهاتف ← القائمة ← **إضافة إلى الشاشة الرئيسية**، ليعمل بوضع مستقل ودون اتصال.

</div>

---

## Français

Une calculatrice scientifique en application mono-page, utilisable hors ligne. Statique pur, zéro dépendance, zéro build (HTML + CSS + modules ES natifs). Déployée sur GitHub Pages, installable comme PWA mobile.

**En ligne :** https://agileaq.github.io/CalculatorSPA/

### Exécution locale

```bash
python3 -m http.server 8000
```

- **Vue production** (mise en cache par le service worker) : `http://localhost:8000/`
- **Aperçu dev** (sans service worker, modifications en direct) : `http://localhost:8000/dev.html`

> Doit être servi via HTTP — les modules ES et le service worker ne fonctionnent pas avec `file://`.

### Tests

Ouvrez `tests/test.html` dans un navigateur (ou `http://localhost:8000/tests/test.html`) pour le résumé PASS/FAIL : environ 70 cas couvrant formatage, analyse lexicale, syntaxe, évaluation, moteur, éditeur, historique, état et correspondance des touches.

### Fonctionnalités

- **Calculs de base** : opérations, parenthèses, `π` / `e`, pourcentage `%`, `EE` (×10ⁿ), réutilisation d'`Ans`
- **Fonctions scientifiques** : `Sin` / `Cos` / `Tan` (bascule DEG/RAD), `Ln` / `Log`, `√` / `³√`, trigonométrie inverse, `abs`
- **Puissances et combinatoire** : `x²` / `x³` / `x⁻¹` / `xⁿ`, permutations `nPr` / combinaisons `nCr`
- **Secondes fonctions Shift** (appui long) : log, trig. inverse, x³, ³√, x⁻¹, nCr/nPr, %, eˣ…
- **Panneau MATH** : catalogue de fonctions groupées, un clic pour insérer
- **Rappel d'historique** : `∧` / `∨` (ou `↑` / `↓`) à la manière du REPLAY Casio
- **Mémoire** : `STO` range le résultat dans une variable A–Z
- **Historique** : entrées réutilisables d'un clic ; persistance localStorage
- **Édition** : curseur en ligne, retour arrière, AC, annuler/rétablir, clavier physique

### Déploiement sur GitHub Pages

Poussez sur `master` — GitHub Actions déploie tout le dépôt automatiquement. Tous les chemins sont relatifs : aucun réglage n'est requis pour un déploiement en sous-chemin.

Les PWA installées se mettent à jour automatiquement : chaque poussée inscrit le SHA du commit dans le nom de cache du service worker (`calc-vN-<sha>`), le navigateur détecte la différence d'octets et affiche un bandeau de mise à jour dans l'app. Les vraies versions augmentent l'étiquette lisible (`CACHE` dans `sw.js` et le badge `#version`). Les répertoires `v5/`–`v7/` sont des instantanés figés, réservés au retour arrière.

### Installation sur mobile

Ouvrez l'URL en ligne dans le navigateur du mobile → menu → **Ajouter à l'écran d'accueil**, pour l'utiliser hors ligne en mode autonome.

---

## Русский

Одностраничное приложение — научный калькулятор, работающий офлайн. Чистая статика, без зависимостей и сборки (HTML + CSS + нативные ES-модули). Размещено на GitHub Pages, устанавливается как мобильная PWA.

**Онлайн:** https://agileaq.github.io/CalculatorSPA/

### Локальный запуск

```bash
python3 -m http.server 8000
```

- **Продакшен-просмотр** (кэш service worker): `http://localhost:8000/`
- **Режим разработки** (без service worker, правки сразу видны): `http://localhost:8000/dev.html`

> Приложение нужно открывать по HTTP — ES-модули и service worker не работают с `file://`.

### Тесты

Откройте `tests/test.html` в браузере (или `http://localhost:8000/tests/test.html`) — сводка PASS/FAIL: около 70 кейсов — форматирование, лексер, парсер, вычисления, движок, редактор, история, состояние, раскладка клавиш.

### Возможности

- **Базовые вычисления**: арифметика, скобки, `π` / `e`, проценты `%`, `EE` (×10ⁿ), повторное использование `Ans`
- **Научные функции**: `Sin` / `Cos` / `Tan` (переключение DEG/RAD), `Ln` / `Log`, `√` / `³√`, обратные тригонометрические, `abs`
- **Степени и комбинаторика**: `x²` / `x³` / `x⁻¹` / `xⁿ`, перестановки `nPr` / сочетания `nCr`
- **Вторые функции Shift** (долгое нажатие): log, обратная тригонометрия, x³, ³√, x⁻¹, nCr/nPr, %, eˣ…
- **Панель MATH**: каталог функций по группам, вставка по тапу
- **История**: `∧` / `∨` (или `↑` / `↓`) — режим REPLAY как у Casio
- **Память**: `STO` сохраняет результат в переменные A–Z
- **Журнал**: записи переиспользуются по тапу; история и переменные хранятся в localStorage
- **Редактирование**: курсор в строке, backspace, AC, отмена/повтор, физическая клавиатура

### Развёртывание на GitHub Pages

Пуш в `master` — GitHub Actions автоматически публикует весь репозиторий. Все пути относительные, поэтому размещение в подпути не требует настройки.

Установленные PWA обновляются сами: каждый пуш вписывает SHA коммита в имя кэша service worker (`calc-vN-<sha>`), браузер видит разницу байтов и показывает баннер обновления внутри приложения. Для настоящих релизов обновляется читаемая версия (`CACHE` в `sw.js` и бейдж `#version`). Каталоги `v5/`–`v7/` — замороженные снимки только для отката.

### Установка на телефон

Откройте онлайн-адрес в мобильном браузере → меню → **На главный экран**, чтобы пользоваться офлайн в отдельном окне.

---

## Español

Una aplicación de página única: calculadora científica que funciona sin conexión. Estática pura, sin dependencias y sin build (HTML + CSS + módulos ES nativos). Desplegada en GitHub Pages, instalable como PWA móvil.

**En línea:** https://agileaq.github.io/CalculatorSPA/

### Ejecución local

```bash
python3 -m http.server 8000
```

- **Vista de producción** (con caché del service worker): `http://localhost:8000/`
- **Vista de desarrollo** (sin service worker, cambios al instante): `http://localhost:8000/dev.html`

> Debe servirse por HTTP: los módulos ES y el service worker no funcionan con `file://`.

### Pruebas

Abre `tests/test.html` en el navegador (o `http://localhost:8000/tests/test.html`) para ver el resumen PASS/FAIL: unos 70 casos de formato, análisis léxico, sintaxis, evaluación, motor, editor, historial, estado y mapa de teclas.

### Funciones

- **Aritmética básica**: operaciones, paréntesis, `π` / `e`, porcentaje `%`, `EE` (×10ⁿ), reutilización de `Ans`
- **Funciones científicas**: `Sin` / `Cos` / `Tan` (conmutación DEG/RAD), `Ln` / `Log`, `√` / `³√`, trigonometría inversa, `abs`
- **Potencias y combinatoria**: `x²` / `x³` / `x⁻¹` / `xⁿ`, permutaciones `nPr` / combinaciones `nCr`
- **Segundas funciones Shift** (pulsación larga): log, trig. inversa, x³, ³√, x⁻¹, nCr/nPr, %, eˣ…
- **Panel MATH**: catálogo de funciones agrupadas; toca para insertar
- **Recuperación del historial**: `∧` / `∨` (o `↑` / `↓`) al estilo REPLAY de Casio
- **Memoria**: `STO` guarda el resultado en variables A–Z
- **Historial**: entradas reutilizables con un toque; persistencia en localStorage
- **Edición**: cursor en línea, retroceso, AC, deshacer/rehacer, teclado físico

### Despliegue en GitHub Pages

Sube a `master`: GitHub Actions despliega todo el repositorio automáticamente. Todas las rutas son relativas, así que el despliegue en subruta no requiere configuración.

Las PWA instaladas se actualizan solas: cada subida incrusta el SHA del commit en el nombre de la caché del service worker (`calc-vN-<sha>`), el navegador detecta el cambio de bytes y muestra un banner de actualización dentro de la app. En cada versión real se actualiza la etiqueta legible (`CACHE` en `sw.js` y la insignia `#version`). Los directorios `v5/`–`v7/` son instantáneas congeladas solo para revertir.

### Instalación en el móvil

Abre la URL en el navegador del móvil → menú → **Añadir a la pantalla de inicio**, y úsala sin conexión en modo independiente.
