# 脚步素材

采用 [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds) 的 CC0 脚步素材。官方网页已核对 CC0；官方旧下载 URL 返回网页、当前签名下载端点拒绝脚本客户端，因此从 [InstrictLogic 的 Kenney CC0 原素材分发页](https://instrictlogic.com/AssetLibrary/sounds/banks/material-impacts-footsteps-kenney-2362a2f7/) 下载原包。只保留本项目使用的 10 个原始 OGG 于 `source/`，不随网页发布该源目录。许可说明同时放入发布目录 `public/audio/footsteps/LICENSE.txt`。

## 输出

- `grass-01.wav` 至 `grass-05.wav`：原 `footstep_grass_000` 至 `004`，五个独立草地单步。
- `stone-01.wav` 至 `stone-05.wav`：原 `footstep_concrete_000` 至 `004`，五个独立硬表面单步；用于石板路与石桥。
- 单声道、44,100 Hz、16-bit PCM。裁除多余静音后草地约 0.114–0.164 秒，石面约 0.103–0.111 秒。
- 去直流偏移，头部 2 ms、尾部 12 ms 淡化；峰值统一为 -6 dBFS。各片段 RMS 约 -24.5 至 -27.0 dBFS。运行时仍应以较低的主增益播放。
- 所有输出共约 107.4 KiB；无需运行时网络服务。

## 复现

已有 Node.js、Playwright 和 Chrome 时：

```powershell
$audioRuntime = Split-Path (Split-Path (Get-Command node).Source -Parent) -Parent
$audioPlaywright = Join-Path $audioRuntime 'node_modules\playwright\index.mjs'
node audio_asset/prepare-footsteps.mjs $audioPlaywright
```

脚本仅在本地 Chromium 的 OfflineAudioContext 中解码，不访问远程资源；处理后写入 `public/audio/footsteps/`。完整长度、电平、源与输出 SHA-256 记录在 `footsteps-report.json`。源文件来自公开 CC0 资产包；试听质量需按最终游戏播放音量判断，未加入循环背景声或混响。
