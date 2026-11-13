# 山体局部蓝屏材质验收

2026-11-12，在本机 `http://127.0.0.1:5181/` 使用 Chrome headless 的实际 WebGL 场景完成。最终材质细化后的 `mountain-browser-report.json`：**passed=true，6组检查，0页面错误，0着色器编译错误**，运行约14.8秒。六张截图均来自原第一人称关卡，未使用俯视相机或修改相机参数。

## 方法与修改前基准

- 整合材质前保存了原源码及 SHA256、原出生点截图和运行快照，位于 `mountain-baseline/`。`snapshot.json` 记录实际渲染场景的32座山体实例矩阵、原网格坐标/法线/UV/索引、地面/河流/围栏变换、完整碰撞配置及相机数据。
- 浏览器使用独立上下文与存储，不触碰用户正在游玩的存档。出生点使用新存档；四边近景使用合法独立存档夹具，然后进行真实 WASD 和鼠标拖拽。边缘短路线不是从出生点走完整张地图。
- QA 仅在该测试页面的模块响应中包装原 `renderer.render`，观察传入的真实 scene/camera；未增加产品 debug 接口，未改变玩家/山体/相机状态。只读射线和材质纹理采样用于验证。

## 实测结果

1. 与整合前快照精确比较：32山体实例的位置、缩放、旋转矩阵，以及原锥形网格坐标、法线、UV和索引全部一致。地面、河流、围栏的变换和实例数据一致。
2. 地图配置、全部碰撞体、10种GLB资产报告、天空配置、5个拾取物的稳定ID/基础位置/关联，以及初始任务状态一致。相机 FOV=67°、眼高1.65m和 near/far/aspect 一致。
3. 原 MeshLambertMaterial、绿色 `#80a78a`、flatShading、depthTest、depthWrite均保留，材质未开启透明混合。故障写入已有山面的颜色，不创建悬浮网格；由原几何深度自然遮挡。
4. 实际GPU编译包含故障UV顶点/片元代码，编译错误为0。采样使用独立 `mountainFaultUv` 属性和每实例贴图偏移，原UV完整保留；新属性仅将每个三角面的顶点U移至该面中央，以减小原锥面展开的偏斜。不使用屏幕坐标、相机位置或时间。4096×1024遮罩图集含32个512×256独立格，6个完全无损，保留了完整绿色山体。白字使用独立256×128纹理（实测2404个白色字形像素），按固定山面UV重复14×5次，并由蓝斑遮罩裁切。按锥面UV高度面积近似加权，图集故障覆盖约 **8.21%**；此为纹理分布估算，不是实际可见山面的精确面积或截图像素占比。
5. 原出生点实际向南行走约2.12m；西、南、东、北四边分别从合法加载点实际走近山体约1.50–1.53m，然后真实拖拽瞄准可见蓝斑。每边再实际后退约1.7m并转头重新看向同一蓝斑。射线重新命中原实例、原世界点、同一原UV与遮罩RGBA，并通过重心坐标插值实际的 `mountainFaultUv` 取样。还验证了字形坐标 `textUV = faultUV * repeat + instanceTile * offsetScale` 在移动前后差小于0.0001；实例矩阵始终不变，确认蓝块和白字都固定在原岩面，不随镜头滑动。
6. 原 `player.ts`、`main.ts`、`world.ts`、`map-config.ts`、天空两模块、拾取物两模块和 `style.css` 的SHA256均未变；`map-environment.ts` 去掉新增 import 与 `applyMountainFaults(peaks)` 一行后与原文件一致。证据为 `mountain-baseline/source-preservation.json`。

## 截图与视觉检查

已查看最终全部六张截图：蓝色仅出现在山体面上，保留绿色山峰轮廓、面片明暗、山体前后遮挡；草地、天空、围栏、树木和UI沿用原画面。近处白字为细小等宽报错碎片，远处自然更小；沿斜面和山脊会压缩、转折或截断。南侧相邻蓝斑已分开，中间保留绿色山面；极斜的视角下白字压缩为细线，西侧正向近景可辨认 `CONTEXT LOST` 等残缺字串。

- `mountain-spawn-south-far.png`：原出生点向南转头，多个大小不一的分散故障。
- `mountain-west-near.png`：西侧近景，树木、围栏与相邻山体自然遮挡。
- `mountain-west-moved-and-turned.png`：西侧实际后退并转头后，原故障仍贴在同一山面。
- `mountain-south-near.png`：南侧斜坡近景，文字随表面倾斜并在山脊处截断。
- `mountain-east-near.png`：东侧故障跨过明暗面转折，仍保持原山脊与面片阴影。
- `mountain-north-near.png`：北侧近景，在陡峭斜面上看到透视压缩。

## 复现

```powershell
$qaNode = (Get-Command node).Source
$qaPlaywright = Join-Path (Split-Path (Split-Path $qaNode -Parent) -Parent) 'node_modules\playwright\index.mjs'
& $qaNode qa/mountain-browser-test.mjs $qaPlaywright http://127.0.0.1:5181/
```

`--baseline` 仅用于修改前捕获，本次原基准已保存，不要用改后的场景覆盖。初次受限网络中的导航失败，后续使用获准的本地浏览器执行权限和5181开发服务完成检查。验收不包括线上发布。
