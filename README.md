# Scientific Calculator PWA

离线可用的科学计算器单页应用。纯静态、零依赖、零构建（HTML + CSS + 原生 ES modules），部署到 GitHub Pages，可安装为手机端 PWA。

## 本地运行

```bash
python3 -m http.server 8000
```

- **线上预览（版本快照，含 service worker）**：`http://localhost:8000/` → 自动跳转到当前版本目录 `/vN/`
- **开发预览（工作副本，无 service worker，改了即时生效）**：`http://localhost:8000/dev.html`

> 必须经 HTTP 服务访问，`file://` 下 ES modules 与 service worker 不生效。

## 运行测试

浏览器打开 `tests/test.html`（或 `http://localhost:8000/tests/test.html`），查看 PASS/FAIL 汇总。覆盖格式化、词法、语法、求值、引擎、编辑器、历史、状态、键位映射等约 70 个用例。

## 部署到 GitHub Pages

1. 推送到 GitHub 仓库 `master` 分支（Actions 自动部署整仓库到 Pages）。
2. Settings → Pages → Source 选目标分支、目录 `/ (root)`。
3. 访问 `https://<用户名>.github.io/<仓库名>/`。

因所有路径为相对路径，子路径部署无需改配置。

## 安装为手机 PWA

用手机浏览器打开线上地址 → 菜单「添加到主屏幕」，以独立窗口离线运行。

## 功能

- **基础运算**：四则运算、括号、`π` / `e`、百分比 `%`、`EE`（×10ⁿ）、`Ans` 复用上次结果
- **科学函数**：`Sin` / `Cos` / `Tan`（DEG/RAD 点击顶部徽标切换，默认 DEG）、`Ln` / `Log`、`√` / `³√`、反三角 `sin⁻¹` / `cos⁻¹` / `tan⁻¹`、`abs`
- **幂与组合**：`x²` / `x³` / `x⁻¹` / `xⁿ`、排列 `nPr` / 组合 `nCr`
- **Shift 第二功能**：长按 Shift 唤出按键上方黄色标记的第二功能（`log`、反三角、`x³`、`³√`、`x⁻¹`、`nCr`/`nPr`、`%`、`eˣ` 等）
- **MATH 面板**：MATH 键展开分组函数目录，点选即插入
- **历史回溯**：MATH 上下两键 `∧` / `∨`（或物理键盘 `↑` / `↓`）按 Casio REPLAY 方式回溯历史算式——`∧` 取更旧、`∨` 取更新，越过最新即清空退出；编辑/求值后自动重置回溯光标
- **存储**：`STO` 把当前算式结果存入 A–Z 变量，可参与后续运算
- **历史记录**：`↺` 打开历史面板，条目可点击复用回填到编辑区；历史与变量经 localStorage 持久化，关闭后保留
- **编辑体验**：完整行内编辑（`‹` `›` 移动光标、`⌫` 删除、AC 清空）、撤销 / 重做、物理键盘支持

## 版本与回滚

根路径是版本入口页，自动跳转到「当前版本」的快照目录（如 `/v6/`）。旧版本目录（`/v5/` 等）保留，仍可通过对应地址访问、回滚。发布新版本时新建 `/vN/` 快照并翻转入口页指向。详见 `CLAUDE.md`。
