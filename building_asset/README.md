# 旧网驿站建筑替换

根据用户给出的目标建筑参考，替换原网页几何体尖顶木屋。模型使用 Blender 实际生成、导出并接入 `public/assets/Outpost_01.glb`；原树、石、草、道路资产及其摆放保持原值。

## 设计与尺寸

- 主体 5.6×5.0 米，墙体高 4.3 米。保留原地块，浅色平顶加小型屋顶构件，最高 5.18 米。
- 前沿圆弧蓝檐使用 10 段截面，长度 6.06 米，深度半径 0.23 米，高度半径 0.18 米。
- 正面三排七列 0.49 米方窗，暖黄、蓝灰和少量深色混排；四个立面均完整。
- 中央浅色框蓝灰双门，少量信封装饰；小门头牌继续用网页 Canvas 绘制中文。
- 左侧梯状结构简化为白色梯架。楼体不能进入，梯子不可攀爬。
- 总计 526 三角面、10 个可编辑网格对象，统一米制。模型原点是楼体底部中心，而非偏出的梯子包围盒中心。

整体包围范围（Blender X/Y/Z）：`(-3.075,-2.77,0)` 到 `(3.03,2.68,5.18)`。正面朝 Blender -Y，GLB 自动转换为 +Z。网页位置 `(0,0,-7.5)`，不旋转；双门与原石板路对齐。

## 保存文件

- `Outpost_01.blend`：可编辑建筑集合，以及独立 `_Preview_only` 灯光、相机、地面与预览招牌。
- `Outpost_01.glb`：最终模型，图片内嵌；同一文件复制到游戏 `public/assets/Outpost_01.glb`。
- `textures/`：7 张 128×128 PNG，含墙面、屋顶、蓝檐、底座、窗户图集、双门和信封。
- `scripts/generate_building.py`：实际运行过的完整生成脚本，PARAMS 记录尺寸、分段数与种子 63112026。
- `scripts/validate_building.py`：源文件及真实 GLB 重导入校验。
- `previews/front.png`、`side.png`、`rear.png`、`oblique.png`：实际 Blender 四视角渲染。
- `previews/reimport.png`：导出 GLB 再导入 Blender 后的渲染。
- `references/`：用户原场景及目标建筑参考。
- `asset-report.json`、`validation-report.json`：生成参数与验证报告。

材质为简单 Principled，粗糙度 0.94、金属度 0、低高光。窗户主要是纹理平面及明暗边框；暖窗自发光强度 0.15，不使用投光灯或泛光。所有材质有 UV，贴图最近邻采样，无外部程序材质。源文件打包图片；网页字体继续复用浏览器中文字体。Blender 预览中的招牌使用本机 Microsoft YaHei，未导出到 GLB。

## 复现

在项目根目录执行：

```powershell
& 'E:\BLEND\blender.exe' --background --factory-startup --python-exit-code 1 --python '.\building_asset\scripts\generate_building.py'
& 'E:\BLEND\blender.exe' --background --factory-startup --python-exit-code 1 --python '.\building_asset\scripts\validate_building.py'
```

实际 Blender 版本 5.2.3 LTS。生成脚本会覆盖本建筑生成结果并更新游戏 GLB；手工修改后请另存。运行时中文招牌在 `src/world.ts`，位于 `(0,1.82,-4.88)`，宽 1.3 米、高 0.20 米。

## 接入与验收

外墙碰撞范围 X±2.85、Z[-10.05,-4.95]，增加左梯碰撞 X[-3.19,-2.75]、Z[-8.6,-6.4]。屋檐悬挑位于头顶上方，不占地面行走空间。地图、道路、邮箱、长椅与其他环境资产不变，存档 key 与数据结构不变。

网页验收记录见 `../qa/building-browser-report.json` 和 `../qa/browser-report.json`，实际截图见 `../qa/building-game-front-close.png`、`building-game-left.png`、`building-game-back.png`、`building-game-right.png`。原场景截图备份为 `../qa/before-building-overview.png`。

最终结果：44项模型/导出重导入检查、8项建筑绕行专项和13项原流程回归全部通过。新GLB在网页正常加载，原四件环境资产的实例数不变。构建通过，预览地址仍为 http://127.0.0.1:5180/ 。
