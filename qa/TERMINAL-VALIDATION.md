# CRT 旧终端替换验收

2026-11-10，实际预览：`http://127.0.0.1:5180/`。最终浏览器验收 **9 项通过，页面脚本错误 0**。原始记录：`terminal-browser-report.json`。

## 实测环境和方法

本机 Chrome，1440×1000 视口，使用硬件 WebGL：`ANGLE (NVIDIA, NVIDIA GeForce RTX 5070 Ti Laptop GPU (0x00002F58) Direct3D11 vs_5_0 ps_5_0, D3D11)`。

仅在独立临时浏览器上下文建立既有 v1 测试存档（四张线索、档案馆已完成，站在旧终端前方）。进入场景后通过真实 WASD、鼠标拖拽和 E 调查；未修改用户的日常浏览器存档。此次专注旧终端替换，没有重复执行整张地图主线。

## 九项检查

1. `OldTerminal_CRT_01.glb` 实际请求 HTTP 200，作为第六个资产加载，场景实例1个，网格和贴图有效。
2. 原五类资产实例数不变：树86、石20、草349、道路模块67、驿站1；五个调查点 ID 均保留。
3. 检查网页加载后的实际材质参数：塑料 roughness≈0.7、玻璃0.25，没有被统一覆盖为1；屏幕 map 和 emissiveMap 均为256×192。
4. 旧 v1 四卡及档案馆完成状态正常加载，答案仍为 `emotion`／`shared-self-mockery`。
5. CRT 实例挂接在原 `old-terminal` 对象内，原桌面与四条桌腿仍保留。
6. 实际靠近并瞄准屏幕按 E，打开原来的“读音便笺”资料；已领取状态没有领取按钮，不会重复发卡。
7. 窗口期间行走暂停；关闭窗口仍暂停，明确点击后恢复。
8. 实际从左侧绕到后方，观察机壳深度及散热缝，没有新增卡点。
9. 刷新后位置、四张线索、两项答案及完成状态完整恢复。

## 资产和实际视觉检查

网页报告：61个网格、3048个三角面，尺寸约 **0.800×0.760×0.701m**，4个使用图片贴图的材质。电脑底部按原桌面高度放置。

已逐张查看实际游戏正面、斜视关系和侧后截图：浅灰米色塑料没有明显过曝，玻璃上的旧桌面画面可辨认，键盘完整；没有看到底座或键盘穿入桌面、明显悬空或缺失贴图。厚背壳与通风纹理可从后侧看到。旧终端牌、原桌子、右侧聊天站和档案馆建筑仍在原位。

屏幕是本地图片贴图组成的静态界面，实际调查继续通过 E 和原复古资料窗口完成。

## 截图

| 文件 | 内容 |
| --- | --- |
| `terminal-game-reference.png` | 旧终端、右侧聊天站与档案馆建筑的关系视角 |
| `terminal-game-front.png` | 正面近景，包含 CRT、键盘、桌子和 E 提示 |
| `terminal-game-side.png` | 实际绕行后的侧后景，显示机壳深度和散热缝 |
| `terminal-game-investigation.png` | 新 CRT 对应的原读音资料窗口 |

## 启动记录及复现

首次尝试时原5180服务未运行，Chrome 返回 `ERR_CONNECTION_REFUSED`，没有进入场景。随后通过项目 `launch.ps1 -NoBrowser` 恢复隐藏后台服务，重新运行上述验收全部通过。这不是 GLB 或脚本加载失败。

服务启动后可执行：

```powershell
$playwrightEntry = Join-Path (Split-Path (Split-Path (Get-Command node).Source)) 'node_modules\playwright\index.mjs'
node '.\qa\terminal-browser-test.mjs' $playwrightEntry 'http://127.0.0.1:5180/'
```

测试结束已关闭浏览器上下文和测试脚本，保留5180预览服务。
