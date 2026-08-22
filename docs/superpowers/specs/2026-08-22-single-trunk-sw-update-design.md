# 单 trunk + SW 提示式更新设计

- Date: 2026-08-22
- Status: Approved (brainstorm → 待实现)
- References: CalorieCounter 的 `vite-plugin-pwa` + `registerType:'prompt'` 机制(`UpdateBanner.tsx` + 生成式 `sw.js`)

## 1. 目标

让"添加到主屏幕"后的 PWA 能**主动发现新版本并点击 Update**(对齐 CalorieCounter 行为),且不引入 npm / 构建步骤 / 依赖(遵守本仓库 zero-build 约束)。

## 2. 背景:为何现状做不到

CalorieCounter 是**单 trunk**:根目录一个 SW,每次发布重建 `sw.js`(Workbox 哈希化 precache manifest)→ 浏览器对 SW 脚本做字节差分 → 新 SW 进入 waiting → `UpdateBanner` 提示 → 点击 → `SKIP_WAITING` + reload。

本仓库现状:
- 根 `index.html` 是**重定向门页**,真实 app 在 `v7/` 快照目录里;`manifest` 的 `start_url:"./"` 在 `v7/index.html` 下解析为 `/CalculatorSPA/v7/`,故主屏图标被钉死在 `v7/`。
- `sw.js` 是**硬编码 cache-first**,install 时 `skipWaiting()` + activate `clients.claim()`——新 SW 静默接管,**无提示**。
- 页面侧 `v7/index.html` 注册 SW 后即忘,无 `updatefound`/`controllerchange` 监听,无更新提示 UI。
- **Patch**(v7→v7f)改 `v7/sw.js` 的 `CACHE` 字符串,字节确实变化,理论上可被字节差分捕获——**但页面不监听**,所以也不会提示。
- **Full release**(v7→v8)新建 `v8/`、`v7/` 冻结——已安装的 v7 PWA 的 SW 永不变化,**永远发现不了 v8**;且主屏 `start_url` 钉在 `/v7/`,即使手动跳到 v8 一次,下次启动仍回 v7。

结论:快照目录布局从架构上阻断了 full-release 的就地更新。要达到 CalorieCounter 同等体验,必须改为**根目录单 trunk**。

## 3. 已确认的决策(brainstorm 锁定)

| # | 决策 | 备注 |
|---|------|------|
| ① | **根 `index.html` 变为真实 app 外壳**(不再是重定向门页);根 `sw.js` 是唯一 SW,scope `/CalculatorSPA/` | `manifest` 已有 `start_url:"./"` `scope:"./"`,在根解析即根路径,主屏图标跨版本稳定 |
| ② | **SW 改提示式**:install 去掉 auto `skipWaiting()`;新增 `message` 通道 `{type:'SKIP_WAITING'}`→`skipWaiting()` | 新 SW 进入 waiting 态(已有 active SW 时),供页面提示 |
| ③ | **新增 `js/update.js`**:注册 SW + 监听 `updatefound`/`controllerchange` + 渲染 banner;复用 `i18n.js` 的 `t()` | 单文件,镜像 CalorieCounter 的 `UpdateBanner`+`useRegisterSW` |
| ④ | **iOS 保活**:`visibilitychange`(前台)+ 1h `setInterval` 调 `registration.update()` | iOS 挂起已装 PWA,不会主动触发 SW 检查 |
| ⑤ | **现有 v7 主屏安装迁移**:patch `v7/index.html`(对"冻结快照"规则的一次性例外)→ `location.replace('/CalculatorSPA/')` | 现有 v7 安装下次启动跳到根→接管根 SW→永久加入新更新流;`v7/sw.js` 与 app 资产保持冻结,只改 HTML 转发 |
| ⑥ | **`CACHE` 字符串是唯一版本真相**(`calc-v7f`→`calc-v8`...),无 `version.json`,无单独版本文件 | 字节差分即更新信号,与 CalorieCounter 哈希 manifest 等价 |
| ⑦ | **`dev.html` 仍不注册 SW**:`<body data-dev>` 属性作开关,`update.js` 见此属性即跳过注册 | 保持 trunk 预览每次拉新 |
| ⑧ | **`v5/v6/v7/` 保留为冻结回滚备份**,非启动目标 | 回滚=临时让根 `index.html` 重定向到 `vN/`(恢复旧门页行为做一次性恢复) |

## 4. 架构

### 4.1 文件结构变化

现状(快照门页):
```
/index.html        重定向门页 → v7/
/sw.js             cache-first,auto skipWaiting
/dev.html          trunk 预览(无 SW)
/v5/ /v6/ /v7/     各自自包含快照(可启动)
```

改后(单 trunk):
``
/index.html        真实 app 外壳(含 #update-banner,#version 仍是静态字面量)
/sw.js             cache-first + 提示式更新(SKIP_WAITING 消息)
/js/update.js      新增:SW 注册 + waiting 检测 + banner + iOS 保活
/dev.html          trunk 预览(<body data-dev> 跳过 SW)
/v5/ /v6/ /v7/     冻结回滚备份(仅 v7/index.html 做一次性 root 转发例外)
```

### 4.2 `sw.js` 改动(三处)

```js
const CACHE = "calc-v8";          // 版本真相;每次发布 bump
const ASSETS = [ /* 不变 */ ];

self.addEventListener('install', (e) => {
  // 去掉 .then(() => self.skipWaiting()) —— 改为提示式
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  // 不变:删非当前 cache + clients.claim
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// 新增:页面点击 Update 时发来的接管信号
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
```

**首次安装语义**:无 active SW 时,新 SW install 后直接 activate(无需 waiting),与今天一致;冷安装不受影响。`skipWaiting()` 只在"已有 active SW + 页面主动发 `SKIP_WAITING`"时才有意义(让 waiting 提前接管)。

### 4.3 `js/update.js`(新增)

职责单一:SW 注册 + waiting 检测 + banner 渲染 + iOS 保活。不碰任何 app 逻辑。

导出 `initUpdater()`,在 `app.js` init 末尾调用一次。核心逻辑:

```js
import { t } from './i18n.js';

export function initUpdater() {
  if (!('serviceWorker' in navigator)) return;
  if (document.body.hasAttribute('data-dev')) return;   // dev.html 跳过
  const banner = document.getElementById('update-banner');
  if (!banner) return;

  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => {
        // installed 态 + 已有 controller(非首次安装) → 有更新
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          banner.hidden = false;
        }
      });
    });

    // iOS 保活:前台 + 每小时强制检查
    const check = () => { if (document.visibilityState === 'visible') reg.update(); };
    document.addEventListener('visibilitychange', check);
    setInterval(check, 60 * 60 * 1000);
  });

  // 点击 Update → 通知 waiting SW 接管 → controllerchange → reload
  banner.querySelector('[data-update-action]').addEventListener('click', () => {
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg && reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    });
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}
```

**状态机**(对应 CalorieCounter 的 `needRefresh`):
- banner 初始 `hidden`(HTML 默认)。
- `updatefound` → `installing` worker `statechange` → `installed` **且** `navigator.serviceWorker.controller` 存在 → 显示 banner。
- 首次安装无 controller → 不显示(不提示"首次安装")。
- 点击 Update → `postMessage(SKIP_WAITING)` → waiting SW activate → `controllerchange` → reload → 新 cache 提供新资产 → `#version` 显示新版本。

### 4.4 根 `index.html`(变为真实 app)

以今日 `v7/index.html` 的 body 为基础,三处改动:
1. `#version` 文本改为新版本(如 `v8`)。
2. `<header id="statusbar">` 后或 `#calc` 内加 banner 元素:
   ```html
   <div id="update-banner" hidden>
     <span data-update-text></span>
     <button type="button" data-update-action>Update</button>
   </div>
   ```
3. **删除**底部内联 SW 注册 `<script>`(注册逻辑移入 `update.js`)。

### 4.5 `dev.html` 改动

`<body>` 加 `data-dev` 属性(让 `update.js` 跳过注册);版本标签照常 bump(`v7f · dev` → `v8 · dev`)。其余不变(本就不注册 SW)。

### 4.6 `v7/index.html` 迁移(一次性例外)

把 `v7/index.html` 整体替换为最小转发页(结构对齐根门页旧样式):

```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8">
  <meta http-equiv="refresh" content="0; url=../">
  <title>Scientific Calculator</title>
  <style>html,body{height:100%;margin:0;background:#000;color:#fff;
    font-family:-apple-system,system-ui,sans-serif;}
    #g{min-height:100%;display:flex;flex-direction:column;align-items:center;
       justify-content:center;gap:14px;}
    .n{font-size:20px;letter-spacing:1px;opacity:.9;}
    .v{font-size:13px;color:#8a8a8e;letter-spacing:2px;}</style>
</head><body><div id="g">
  <div class="n">Scientific Calculator</div>
  <div class="v">v7 → redirecting…</div>
</div>
<!-- replace-redirect: back button not trapped -->
<script>location.replace('../');</script>
</body></html>
```

- `../` 相对 `v7/` 解析为 `/CalculatorSPA/`(根)。
- `v7/sw.js`、`v7/js/`、`v7/styles.css`、`v7/icons/` **保持冻结不动**(已安装 v7 的 cache-first 资产不受影响;只有 HTML 转发)。
- `v5/`、`v6/` 不动(无现役安装,无需迁移)。

### 4.7 i18n 新增键

`js/i18n.js` 的 `STRINGS` 加:
```js
'update.available': { en: 'New version available', zh: '新版本可用' },
'update.reload':    { en: 'Update',                zh: '更新' },
```
`update.js` 用 `t('update.available')` / `t('update.reload')` 填充 banner 文案,复用现有 `applyLocale` 流(切语言时 banner 文案随变)。

## 5. 端到端更新流

1. **发布**:编辑 `sw.js` `CACHE`(`calc-v7f`→`calc-v8`)+ 根 `index.html` `#version`(`v7f`→`v8`)+ `dev.html` 版本标签。commit + push。Pages 自动部署。**无快照目录,无门页翻转,无逐目录拷贝。**
2. **已装 PWA 启动**:`update.js` 注册根 `sw.js`。浏览器重新拉取 `sw.js`(对 SW 脚本绕过 HTTP 缓存,按导航与约 24h 周期)→ 字节不同 → 安装新 SW 到 **waiting** 态。
3. **检测**:`updatefound` → `installing` → `statechange` → `installed` + 有 controller → banner 显示。
4. **iOS**:`visibilitychange`(前台)+ 1h `setInterval` 调 `registration.update()` 强制检查(iOS 不自行触发)。
5. **用户点 Update**:`postMessage({type:'SKIP_WAITING'})` → waiting SW activate → `controllerchange` → `location.reload()` → 新 cache 提供新资产 → `#version` 显示 `v8`。

## 6. 发布流程重写(CLAUDE.md §"Version-gate release flow")

整节从"快照/门页"流程改为:

- **发布 = bump `sw.js` `CACHE` + 根 `#version` + `dev.html` 标签;push。** 一个目录,一个 SW,唯一真相(cache 名)。
- **Patch 字母约定保留**(`v8`→`v8a`→`v8b`),仍纯为 cache 名 + 徽标 bump——现已是**唯一**发布类型(无快照目录区分 full/patch)。字母只是更细粒度的版本标签。
- `v5/v6/v7/` 重定义为**冻结回滚备份**,非启动目标。回滚=临时让根 `index.html` 重定向到 `vN/`(恢复旧门页行为做一次性恢复),修好后再前移。
- 唯一版本真相:`sw.js` 的 `CACHE` 字符串(不再是门页里两个 HTML 注释 marker)。

### 6.1 CLAUDE.md 需同步重写的章节

- §"Version-gate release flow (critical, non-obvious)" 整节。
- §"Patch releases" 子节(合并为"唯一发布类型",保留字母约定语义)。
- §"`vN/index.html` vs `dev.html` — service worker registration":`vN/index.html` 不再是启动入口;`dev.html` 改为靠 `data-dev` 跳过注册。
- §"Architecture" 里提到 `vN/` 为启动入口的描述需更新为"冻结备份"。

## 7. 测试

- **Headless**:`node --check --input-type=module js/update.js`(仅语法;`update.js` 触碰 `navigator`/`document`,同 `app.js` 不能 import 跑)。
- **浏览器套件** `tests/test.html`:为 `update.js` 的 banner 状态机加单元用例——注入假 `registration`/`navigator.serviceWorker`,断言:
  1. 初始 banner hidden;
  2. `updatefound`→`installed` + 有 controller → banner shown;
  3. 首次安装(无 controller)→ 不显示;
  4. 点击 Update + `controllerchange` → 触发 reload(用 spy 拦 `location.reload`,不真刷)。
  纯逻辑,不跑真 SW。
- **手动**:push 一个 cache 名 bump,在已装 PWA 上验证 banner 出现(前台触发)且 Update 后 reload 到新版本。纳入发布 checklist。

## 8. 非目标(YAGNI)

- 不引入 npm / Vite / Workbox / vite-plugin-pwa(违反 zero-build 约束)。
- 不做 `version.json` 轮询——SW 字节差分 + iOS 保活已足够,与 CalorieCounter 一致(CalorieCounter 也不轮询版本文件)。
- 不做数据 schema 迁移(CalorieCounter 的 `cc.schemaVersion` 是其数据层,本计算器 localStorage 仅存历史与 vars,无 schema 版本问题)。
- 不在 banner 显示版本号(CalorieCounter 也不显示,SW 字节差分只表示"有变",非"变成 v8")。
- 不改 `app.js` 的 dispatch/tape/render 任何业务逻辑——仅末尾加一行 `initUpdater()`。
