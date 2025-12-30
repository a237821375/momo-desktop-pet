# Live2D SDK 集成说明

## 下载 Live2D Cubism SDK

1. 访问 Live2D 官网: https://www.live2d.com/download/cubism-sdk/
2. 下载 "Cubism SDK for Web"
3. 解压后，将以下文件复制到项目中:

```
apps/desktop/src/renderer/live2d/cubism-sdk/
  ├── CubismSdkForWeb-4-r.x/
  │   ├── Core/
  │   │   └── live2dcubismcore.min.js
  │   └── Framework/
  │       └── dist/
  │           └── live2dcubismframework.min.js
```

## 集成步骤

### 1. 复制 SDK 文件
将 SDK 的 Core 和 Framework 文件放置到 `cubism-sdk` 目录

### 2. 在 index.html 中引入 SDK
```html
<script src="./live2d/cubism-sdk/live2dcubismcore.min.js"></script>
<script src="./live2d/cubism-sdk/live2dcubismframework.min.js"></script>
```

### 3. 实现模型加载
在 `runtime.ts` 中实现实际的模型加载逻辑

## 许可证

使用 Live2D Cubism SDK 需要遵守其许可协议。
请访问 https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html 查看详细条款。

## 替代方案（推荐用于快速开发）

使用第三方库 `pixi-live2d-display`:
```bash
npm install pixi-live2d-display
```

这个库已经封装好了 Live2D SDK，使用更简单。

## 当前状态

目前 Live2D 模块的框架已经搭建完成，但需要集成实际的 SDK 才能运行。
所有标记为 `TODO` 的部分需要在 SDK 集成后实现。
