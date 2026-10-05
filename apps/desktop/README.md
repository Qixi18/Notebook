# NoteBuddy Desktop

这是 NoteBuddy 的 Electron 安全包装层。它不保存 API Key，也不直接把 Node.js 能力暴露给网页：

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- 通过 `preload.ts` 只暴露最小的只读运行环境信息

当前包装层支持两种加载方式：

```powershell
# 开发：先启动 apps/backend 和 apps/web，再加载 Vite 页面
$env:NOTEBOOK_DESKTOP_DEV_URL = 'http://127.0.0.1:5173'
npm install
npm run dev

# 生产预览：先在 apps/web 执行 npm run build，再启动 Electron
npm run start
```

当前版本还没有自动托管 FastAPI 子进程和制作安装包；这属于下一阶段的桌面发布联调。生产环境仍应通过本机环境变量提供后端地址和 DeepSeek 配置，不能把密钥打进前端或 Electron 包。
