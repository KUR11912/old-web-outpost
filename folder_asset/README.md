# MemeFolder_01

根据提供的黄色文件夹参考图重新建模的低分辨率 Y2K 道具。阶梯形顶部标签、灰色边框、右侧和底部的黑色像素阴影均为真实几何；具有完整正面、背面和厚度。没有使用截图平面、白底、棋盘格或透明裁切材质。

## 文件

- `MemeFolder_01.blend`：可编辑 Blender 源模型，内嵌贴图。
- `MemeFolder_01.glb`：游戏资产，内嵌贴图；相同文件已复制到 `../public/assets/MemeFolder_01.glb`。
- `textures/MemeFolder_128.png`：手工程序绘制的 128 × 128 像素 RGB 色彩图集。
- `scripts/generate_folder.py`：可重复生成源模型、纹理、GLB 和实际渲染预览的脚本。
- `previews/front.png`、`oblique.png`、`back.png`：导出 GLB 重新导入 Blender 后的正面、斜侧面和背面渲染；预览背景不属于模型。
- `folder_report.json`：实际运行和验证数据。
- `generation.log`：本次 Blender 执行日志。

## 游戏约定

| 属性 | 值 |
| --- | --- |
| Blender 实测版本 | 5.2.3 LTS |
| glTF 尺寸，宽 X / 高 Y / 厚 Z | 1.00 / 0.78 / 0.14 m |
| 原点 | 底部中心，坐标 (0, 0, 0) |
| glTF 正面 | +Z |
| Blender 正面 | -Y，Z 向上 |
| 游戏统一缩放 | 0.8，得到宽 0.8 / 高 0.624 / 厚 0.112 m |
| 网格 / 材质 / 纹理 | 1 / 1 / 1 |
| 三角面 | 428 |
| 源网格顶点 | 224 |
| GLB 大小 | 24,588 bytes |
| 透明度模式 | OPAQUE |
| 纹理 | 128 × 128 PNG；Blender Closest；glTF NEAREST / NEAREST_MIPMAP_NEAREST |

使用一个普通非金属 Principled 材质，粗糙度 1；无灯光、相机、舞台、字体、外部贴图依赖。所有可见网格均使用平面法线。正背面黄色色块、亮边和少量像素磨损均来自图集，灰边和黑色阴影保持清楚的阶梯轮廓。

## 重新生成

在 PowerShell 中运行：

```powershell
& 'E:\BLEND\blender.exe' --background --factory-startup --python 'E:\6311 final\old-web-outpost\folder_asset\scripts\generate_folder.py'
```

脚本会更新本目录内的生成文件和 `public/assets/MemeFolder_01.glb`，不会修改游戏源代码。脚本实际执行 GLB 导出、重导入并校验尺寸、三角面数、最近邻采样、不透明材质与嵌入纹理，再使用重导入的 GLB 渲染三张预览。
