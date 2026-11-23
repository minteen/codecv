# 本地 PDF 导出服务

使用 Node.js 和 Chromium 将编辑器当前的简历导出为 PDF，也兼容菜单中的 PNG 导出。不调用付费 API，不保存上传的简历或生成的文件。

## 启动

需要 Node.js 22+ 和已安装的 Google Chrome、Microsoft Edge 或 Chromium。

在项目根目录执行：

```sh
npm run pdf:install
npm run pdf:start
```

另开终端启动前端：

```sh
npm run dev
```

修改 Vite 配置后需重启已有的前端服务。默认通过 `/api/export` 代理到 `127.0.0.1:3001`，无需设置 `VITE_EXPORT_URL`；如果之前设置过外部地址，请移除该变量并重启前端。

在编辑器点击「导出PDF」，选择 A4、A4 横向、Letter，或填写页宽、页高（毫米）。默认 210 × 297 mm，允许范围 50～2000 mm。按宽度重新排版，按高度分页；编辑器预览和「备用导出」仍使用原来的 A4 行为。

勾选「自动延长纸张，完整呈现在一页」后，页宽和字号不变；服务在字体、图片加载后测量内容，自动将页高延长到足以容纳全部内容，最长 2000 mm。短内容仍保留设定页高。此选项适合电子简历，打印到标准 A4 时需要缩放；关闭选项则按固定页高正常分页。

直接导出与备用导出共用同一份内容、CSS 和打印布局快照。前端展开 CSS 导入、保留样式顺序，将已加载的字体及头像嵌入快照；服务等待资源加载完成，不再静默使用后备字体。浏览器打印时请选择 A4、无页边距、100% 缩放、启用背景图形并关闭页眉页脚，以便与直接导出的设置一致。

## 配置

在 `pdf-service/` 中启动时可设置：

```sh
CHROME_PATH=/usr/bin/chromium PORT=3001 npm start
```

- `CHROME_PATH`：浏览器可执行文件，默认自动寻找 macOS Chrome/Edge 及 Linux 常见 Chromium 路径。
- `PORT`：默认 3001；更改后也要同步修改根目录 `vite.config.ts` 的代理目标。
- `ASSET_ORIGINS`：允许加载的额外图片/字体来源，以逗号分隔。例如 `https://your-images.example.com`。默认仅允许简历来源站点、Google Fonts 和项目图标字体 CDN；远程头像来源不在其中时需显式添加。

前端自动把头像（包括 blob URL）转成 data URL；跨域头像需由图片服务允许 CORS 读取。若字体或图片无法读取，会提示错误，避免生成缺少资源的简历。使用接口的其他客户端可传入同源静态资源和 data URL；原始 blob URL 只能在创建它的浏览器中访问。

服务仅监听 `127.0.0.1`，拒绝携带 Origin 的跨站浏览器请求。单次内容上限 20 MB，一次处理一个任务，多余任务返回 429；每次渲染最多约 45 秒，并关闭浏览器。面向受信任的本机使用；对外开放前需增加身份认证、严格的资源来源白名单和资源隔离。

## 生产部署

当前根目录 Dockerfile 只运行静态站点，不包含本服务。生产环境需单独运行此 Node 服务，并通过反向代理把同源 `/api/export` 转发到 `http://127.0.0.1:3001/api/export`（转发时移除 Origin 头）。Vite 的开发代理不会进入构建产物。服务所在机器必须能访问前端资源地址，并安装中文字体，例如 Linux 上的 Noto CJK。

## 接口

`GET /health`：健康检查。

`POST /api/export`，`Content-Type: application/json`：

```json
{
  "content": "<main class=\"jufe\"><h1>我的简历</h1></main>",
  "style": ".jufe { padding: 10mm; font-family: sans-serif; }",
  "assetOrigin": "http://localhost:5174",
  "width": 210,
  "height": 297,
  "autoHeight": false,
  "type": 0
}
```

`type: 0` 返回 `application/pdf` 二进制文件；`type: 1` 返回 `image/png`。错误返回非 2xx 和 `{ "error": "原因" }`。

## 验证

```sh
npm run pdf:test
```

测试尺寸校验、HTTP 错误、跨域限制、中文 PDF 和 PNG 生成、自动延长后的单页尺寸、短内容保留原始页高和缺失头像的错误处理；生成的检查文件位于 `tmp/pdfs/`。
