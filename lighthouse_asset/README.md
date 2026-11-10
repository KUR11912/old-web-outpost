# 记忆灯塔：开放式螺旋外观

依据用户上传的螺旋灯塔参考，用 Blender 制作的独立米制资产。三圈米白色宽带墙采用真实有厚度的三维网格；圈间开口不依赖透明贴图。顶部保留简化八边灯室、蓝灰玻璃、独立灯芯和深灰尖顶，底部保留小门房。省略栏杆、复杂扶手、密集支撑和杂物。

## 文件与复现

- `Lighthouse_01.blend`：可编辑的模型部件和预览场景。
- `Lighthouse_01.glb`：游戏资产，贴图内嵌；网页副本位于 `../public/assets/`。
- `scripts/generate_lighthouse.py`：模型、UV、贴图、实际渲染、导出和重新导入检查。
- `textures/`：低分辨率图片贴图。
- `previews/`：实际 Blender 多角度预览和 GLB 重导入预览。
- `references/`：用户上传的造型参考。

已实际使用 Blender **5.2.3 LTS**，路径为 `E:\BLEND\blender.exe`。在项目根目录运行：

```powershell
& 'E:\BLEND\blender.exe' --background --factory-startup --python .\lighthouse_asset\scripts\generate_lighthouse.py
Copy-Item -LiteralPath .\lighthouse_asset\Lighthouse_01.glb -Destination .\public\assets\Lighthouse_01.glb -Force
```

总高度 `total_height`、螺旋圈数 `turns`、外半径 `outer_radius`、墙厚 `wall_thickness` 是生成脚本的四个主控参数，固定随机种子为 **63112030**。带高、螺距、开口、平台与灯室高度随主控参数推导，小屋保持原有人体尺度。修改参数后重新运行，即可生成同一风格的新模型和预览。

也可使用 JSON 文件覆盖这四个参数。只验证实际构建的网格、不导出或渲染变体：

```powershell
& 'E:\BLEND\blender.exe' --background --factory-startup --python .\lighthouse_asset\scripts\generate_lighthouse.py -- --parameters-file .\lighthouse_asset\parameter_variant_config.json --validate-parameters --report-name parameter_variant_validation.json
```

已实际构建并测量两组模型：默认14.3米 / 3圈 / 外半径1.7米 / 墙厚0.2米；变体16米 / 4圈 / 外半径2米 / 墙厚0.27米。两组均通过开口与封闭厚墙检查，小屋包围盒保持一致。记录为 `parameter_default_validation.json` 和 `parameter_variant_validation.json`，不是仅核对参数数值。

## 默认尺寸与材料

| 项目 | 数值 |
|---|---|
| 总高 | 14.30米 |
| 螺旋 | 3圈，每圈24段；外半径1.70米、墙厚0.20米 |
| 带高 / 圈距 / 净开口 | 1.35 / 3.15 / 1.80米 |
| 基座 | 半径1.90米、高0.14米 |
| 顶部平台 | 半径1.92米 |
| 门房 | 宽3.4米、深2.4米；墙高2.2米、屋脊高3.0米 |
| 完整包围盒 | 3.84×14.30×5.41米，含屋檐及灯室 |
| 三角面 / 部件 | 1616 / 74个可编辑网格 |
| 图片 | 7张128×128 PNG，均内嵌GLB；最近邻采样 |
| 墙面 | 不透明米白抹灰、少量褪色，粗糙度0.92 |
| 灯室玻璃 | 蓝灰色、alpha 0.24、粗糙度0.45；独立大块窗面 |
| 灯芯 | 独立暖色对象，自发光强度1.8 |

改变建筑占地后，应同时按新报告调整 `MAP.lighthouse` 的基座与门房碰撞尺寸；不要将包含悬空构件的完整包围盒直接作为地面碰撞。

## 接入约定

资产根节点采用底部中心原点；Blender -Y 为正面，导入 glTF 后正面为 +Z。网页场景放置于 `(57,0,-41)`，原道路终点和预留调查位置 `(57,-35)` 保持不变。

灯芯的独立对象名为 `Lighthouse_Lamp_Core`，可供后续任务控制点亮状态。目前保持简单暖色灯芯，不增加新任务或登塔操作。内部简化踏步仅作外观结构；玩家继续沿地面道路探索。

`src/world.ts` 加载 GLB 并保留玻璃透明度及灯芯自发光；`src/map-environment.ts` 摆放模型和小屋门头名称牌；`src/map-config.ts` 集中配置尺寸、基座及小屋碰撞。地面只使用基座圆形和小屋矩形碰撞，高处螺旋和平台不会投影成一整块落地障碍。

现有七类资产、地图线路、调查点、线索 ID、背包及 `old-web-outpost:save:v1` 存档沿用。`lighthouse_task` 继续作为未启用的后续任务接入点。门房与灯室没有新增可进入的室内。

## 验证与预览

模型生成流程检查螺旋网格的完整内外表面、厚度边缘、贴图及独立灯芯，并实际重新导入 GLB。浏览器检查由 `../qa/lighthouse-browser-test.mjs` 执行；采用隔离存档，实际从桥上沿原道路走向灯塔并绕行，不修改用户日常浏览器存档。最终结果记录在本文件夹模型报告及 `../qa/` 验收报告中。

默认模型的 `lighthouse_report.json` 已确认：导出/重导入均为1616三角面；螺旋厚墙非流形边0、边界边0，法线朝向检查通过；三圈的墙面射线均命中，开口射线均可通过，7张贴图完整，底面高度0，独立灯芯节点存在。玻璃采用 alpha blending，螺旋墙本身完全不透明。

实际模型渲染为 `previews/lighthouse_front.png`、`lighthouse_oblique.png`、`lighthouse_rear.png` 和 `lighthouse_openings.png`，GLB重导入渲染为 `lighthouse_glb_reimport.png`。游戏截图及浏览器检查记录见 [灯塔验收](../qa/LIGHTHOUSE-VALIDATION.md)。

2026-11-10：15项实际浏览器检查全部通过，页面脚本错误0，TypeScript与Vite生产构建通过。已验证桥上远眺、沿路接近、四周绕行、基座/门房碰撞、背包暂停恢复与存档刷新。旧存档站位落入新门房时可自动移出，四张线索与已完成状态保留。默认参数重跑后的GLB与验收时文件完全一致，源目录、public和dist副本SHA256一致。
