# 旧终端 CRT 电脑替换

仅替换回声档案馆左侧桌面上的显示器与键盘。原桌子、四条桌腿、“旧终端”名称牌、右侧聊天记录查看器、档案馆建筑及调查流程保留。

## 实际制作

使用本机 `E:\BLEND\blender.exe`，实际版本 **Blender 5.2.3 LTS**。生成、保存、GLB 导出和重新导入检查均已执行；参数、尺寸与检查结果在 `terminal_report.json`，运行日志为 `generation.log`。

参考图转化为：米白略灰黄的旧塑料、两段圆角前壳、上薄下厚边框、内凹暗沿、4:3 略凸屏幕、明显后伸并收窄的 CRT 后壳、短支架与双层扁底座、简化电源键/绿灯，以及47个凸起键帽。后部与侧面散热槽使用128像素纹理。没有复制参考图中的品牌标志、广告或拼贴内容。

| 参数 | 实际值 |
|---|---|
| 资产名称 | OldTerminal_CRT_01 |
| 三角面 | 3048，GLB重新导入后相同 |
| 整体尺寸（宽×高×深） | 0.800 × 0.760 × 0.7008 米 |
| 屏幕可见区域 | 0.56 × 0.42 米，4:3 |
| 玻璃凸度 | 0.016 米；最高点仍在外边框之后 |
| 键盘尺寸 | 0.59 × 0.20 米，中心沿用桌面前方 Z=0.25 |
| 原点 | 桌面中心底面；模型底座和键盘底面Y=0 |
| 朝向 | Blender -Y，GLB自动转为+Z |
| 随机种子 | 63112028 |
| 塑料/玻璃粗糙度 | 0.70 / 0.25 |
| 屏幕发光强度 | 0.22，保留正常光照与轻微高光 |

## 文件

- `OldTerminal_CRT_01.blend`：可编辑资产集合与独立预览场景。
- `OldTerminal_CRT_01.glb`：图片内嵌的游戏模型；完全相同的文件已复制到 `../public/assets/OldTerminal_CRT_01.glb`。
- `scripts/generate_terminal.py`：Blender实际运行的建模、纹理、UV、导出、渲染与重新导入验证脚本。
- `scripts/generate_screen.ps1`：Windows原生绘制屏幕贴图，不依赖下载的壁纸、商标或生成式图片服务。
- `textures/screen_desktop_256.png`：256×192桌面贴图，包含蓝天草地、档案/缓存图标与三个复古窗口；主窗口保留 `ARCHIVE_LOCAL`、`OPEN LOG`、`READ TEXT`，另有中文读音提示与 E 查阅提示。
- `textures/`：128×128塑料、键帽字符图集与散热槽纹理；屏幕参数另存为 `screen-parameters.json`。
- `previews/terminal_front.png`、`terminal_side.png`、`terminal_oblique.png`：真实Blender渲染；`terminal_glb_reimport.png` 为GLB重新导入后渲染。
- `references/target-crt.png`、`before-game.png`：用户本轮提供的两张参考图，供后续比较。

## 复现

在项目根目录运行：

```powershell
& '.\terminal_asset\scripts\generate_screen.ps1'
& 'E:\BLEND\blender.exe' --background --factory-startup --python-exit-code 1 --python '.\terminal_asset\scripts\generate_terminal.py'
Copy-Item -LiteralPath '.\terminal_asset\OldTerminal_CRT_01.glb' -Destination '.\public\assets\OldTerminal_CRT_01.glb'
```

生成脚本按参数重建自己的资产输出。手动编辑的版本可另存，避免下一次重建覆盖。

## 网页接入

`src/world.ts` 将其作为第六个 GLB 真实加载，并仅对CRT保留导出时的粗糙度与平滑法线；旧五件环境资产的处理不变。屏幕和其他贴图都采用最近邻采样。

`src/archive-scene.ts` 只移除旧终端分支中的占位显示器与键盘，将新GLB放在旧调查组内，局部Y=0.805，正好对应原桌面上表面。资产宽深均落在1.0×0.78米桌面内，四周保留余量；后壳不会碰到墙。

世界调查组仍是 `old-terminal`，中心 `(16.6,0,-35.5)`；瞄准点为 `(16.6,1.285,-35.378)`，站位 `(16.6,-33.7)`。原碰撞不变，线索ID `echo-meaning-note`、调查内容、领取去重与v1存档逻辑都未改动。桌面画面是静态纹理，真正的资料阅读仍通过 E 打开原复古调查窗口。

网页实际截图保存在 `../qa/terminal-game-reference.png`、`terminal-game-front.png`、`terminal-game-side.png` 和 `terminal-game-investigation.png`。专项验收见 [TERMINAL-VALIDATION.md](../qa/TERMINAL-VALIDATION.md) 与 `terminal-browser-report.json`：9项通过、页面错误0；实际验证六个GLB、原五类模型实例数、屏幕纹理、塑料/玻璃粗糙度、E调查、去重、暂停恢复、绕行和刷新续存。TypeScript及Vite生产构建通过。

GLB验证确认贴图内嵌、三角面和尺寸一致、原点正确、屏幕不透明，源GLB和网页GLB的SHA256相同。首次斜视预览的键盘接近画面底边，已只调整预览摄影范围并重新输出，最终预览完整。
