# 回声档案馆：旧店屋外观

根据用户提供的老店屋参考，在 Blender 中实际生成并导出，替换原档案馆占位体块。保持窄高两层、直线高女儿墙、后部低坡屋顶、二层大窗与小雨檐、玻璃店面、豆沙粉弧形雨棚、暗红砖墙脚和左侧竖牌。省略防盗栏、理发灯柱、空调、管线及杂物；调查仍在建筑外完成。

## 源文件和复现

- `Archive_01.blend`：可编辑模型、独立部件、已打包贴图，以及预览相机和灯光。
- `Archive_01.glb`：只导出资产集合，贴图内嵌；网页副本为 `../public/assets/Archive_01.glb`。
- `scripts/generate_archive.py`：几何、UV、材质、渲染、GLB 导出及重新导入检查。
- `scripts/generate_signs.ps1`：使用本机中文字体绘制竖牌和雨棚文字，不依赖外部图片服务。
- `textures/`：全部图片贴图；`references/storefront-reference.png`：用户参考原图。
- `previews/archive_front.png`、`archive_oblique.png`、`archive_rear.png`：实际 Blender 渲染。
- `previews/archive_glb_reimport.png`：导出 GLB 重新导入后的实际渲染。
- `archive_report.json`：模型尺寸、网格、图片、重导入及离地高度检查。

已实际调用 `E:\BLEND\blender.exe`，版本 **5.2.3 LTS**。在项目根目录运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\archive_building_asset\scripts\generate_signs.ps1
& 'E:\BLEND\blender.exe' --background --factory-startup --python .\archive_building_asset\scripts\generate_archive.py
Copy-Item -LiteralPath .\archive_building_asset\Archive_01.glb -Destination .\public\assets\Archive_01.glb -Force
```

两个脚本的固定种子均为 **63112029**，模型比例、雨棚分段、贴图尺寸等集中在生成脚本的 `PARAMS`。生成会更新本文件夹内对应的源文件、导出文件与预览；不会更改其他资产。

## 尺度与材质

| 项目 | 实际设置 |
|---|---|
| 单位与原点 | 米；资产根节点在主体底部中心 |
| 正面 | Blender -Y，导入网页后 +Z |
| 主体占地 | 5.0 × 6.0 米 |
| 总高 | 7.28 米，含女儿墙顶盖 |
| 三角面 | 700；导出与重新导入一致 |
| 网格 | 65 个可独立编辑部件 |
| 雨棚 | 8 段，宽 4.88 米、厚 0.06 米；最低 2.68 米 |
| 常规贴图 | 128×128：抹灰、砖、玻璃、窗内百叶、屋顶、底座和棚侧 |
| 字牌贴图 | 竖牌 128×256；棚面 256×128 |
| 采样 | 最近邻；低分辨率质感来自贴图 |
| 材质 | 图片颜色＋简单粗糙表面，金属度 0；Blender 粗糙度 0.92，网页 0.94 |

包含招牌、屋檐与把手的完整 GLB 包围盒：`min(-3.07, 0, -3.128)` 至 `max(2.5925, 7.28, 4.0)`；不等同于主体碰撞范围。玻璃用不透明深色反射纹理表现，没有新增室内场景。

竖牌字形已按实际板面比例补偿，图片直接贴到 0.52×2.70 米板面，不要再次压缩字形。雨棚字位于朝前的下沿，参考图中的商业文字改成自制“旧网资料室”和信封图案。

## 游戏接入

世界位置保持 `(20, 0, -40)`，前墙仍为 Z=-37，原道路方向不变。`MAP.locations.archive.size` 为 5×6×7.3 米；资源在 `src/world.ts` 加载，建筑在 `src/map-environment.ts` 摆放。

地面矩形碰撞半宽 **2.60 米**、半深 **3.13 米**，覆盖基座、墙体与门把手。高处雨棚及竖牌不设置地面阻挡。三块设备标牌最高约 2.045 米，距雨棚下沿仍有约 0.635 米。

旧终端 `(16.6,-35.5)`、聊天记录查看器 `(20,-36.1)`、图片缓存终端 `(22.8,-35.8)` 与整理桌 `(25,-32.5)` 坐标和外观均保持。交互 ID、四张线索、领取状态、关联判断、背包及 v1 存档保持不变。

## 验证入口

`../qa/archive-building-browser-test.mjs` 在隔离浏览器存档中检查真实资源、绕楼步行、四面墙碰撞、三处调查、背包和刷新。`../qa/archive-browser-test.mjs` 检查从驿站领取线索到档案馆完成关联的原有完整流程。实际报告和截图保存在 `../qa/`，不修改用户浏览器的存档。

2026-11-10 实际运行：建筑13项、完整流程12项均通过，页面错误0；TypeScript与Vite生产构建通过。GLB重导入保持700三角面、9张图片贴图完整、根节点原点与底面高度正确。首次预览发现的共面黑缝和砖纹尺度差异已修正并重新渲染。游戏截图以 `../qa/archive-building-game-front.png`、`archive-building-game-oblique.png`、`archive-building-game-stations.png` 为主；背面与右侧另有截图。
