# Scientific Calculator PWA

离线可用的科学计算器单页应用。纯静态、零依赖、零构建。

## 本地运行
```bash
python3 -m http.server 8000
# 访问 http://localhost:8000/
```
（必须经 HTTP 服务，`file://` 下 ES modules 与 service worker 不生效。）

## 运行测试
浏览器打开 `tests/test.html`，查看 PASS/FAIL 汇总。

## 部署到 GitHub Pages
1. 推送到 GitHub 仓库。
2. Settings → Pages → Source 选目标分支、目录 `/ (root)`。
3. 访问 `https://<用户名>.github.io/<仓库名>/`。

因所有路径为相对路径，子路径部署无需改配置。

## 安装为手机 PWA
用手机浏览器打开线上地址 → 菜单「添加到主屏幕」。

## 功能
四则运算、括号、π/e、Ln、Sin/Cos/Tan（DEG/RAD 可切换）、√、x²、xⁿ、EE、百分比、Ans、STO 变量、历史记录（持久化、可点击复用）、撤销/重做、行内光标编辑、物理键盘支持。
