# 四个探索文件夹验收

2026-11-12，本地 `http://127.0.0.1:5180/`，Chrome headless 实际 WebGL 场景。`four-pickups-browser-report.json` 最终结果：**passed=true，10 组检查，17 段连续实际行走，0 个页面错误**。测试总时长约 160 秒。

主流程从全新隔离浏览器 context 的原出生点开始，复用 `pickup-browser-test.mjs` 的鼠标拖拽和 WASD 输入方法。不传送玩家，不改游戏状态；快照仅用于读取。原蓝瘦文件夹先绕过，以便独立验证四个新增物件均不改变蓝瘦任务。

| 标记 | pickupId | 地面坐标 X / Z | 位置 |
| --- | --- | --- | --- |
| 01 | field-folder-01 | 20.4 / -46 | 回声档案馆北侧草地 |
| 02 | field-folder-02 | 24.5 / -20 | 回声档案馆东南侧、河流西岸林隙 |
| 03 | field-folder-03 | 26.6 / 9 | 地图南部、河流西侧草地 |
| 04 | field-folder-04 | 60 / 3 | 桥梁东南侧、河流东岸林隙 |

## 实测通过

- 原 9 个 GLB 均成功加载，没有新增 GLB；`MemeFolder_01` 实例数为 5，含原有蓝瘦文件夹。四新增项 `memeId=null`、基准高度 0.6 米，文件夹没有实体碰撞体。
- 从现有道路走向四个位置；范围外仍可见，靠近后自动领取，每个仅增加自己的稳定 ID 并立即消失。每次均实际来回穿过原位置，背包及拾取数组无重复，`pickupInventory` 和 `collectedPickups` 写入本地存档。
- 四项领取期间，`clues=[]`、`memes=[]`、蓝瘦任务始终 `0 / 4`，完成状态和答案未变。
- 背包含四个独立的“待定老梗01–04”条目，均有 `assets/folder-icon.svg` 通用图标和“老梗内容待补充”。逐个打开详情验证图标加载、说明和返回背包；窗口打开期间 WASD 不移动。
- 页面刷新后四项仍在背包，场景中不再出现；导出隔离 context 的 storageState、关闭并重开 context 后再次验证相同结果。
- 随后真实沿桥梁和道路返回旧网驿站，原蓝瘦文件夹仍可单独领取；只增加原图和蓝瘦 meme，原任务由 `0 / 4` 变为 `1 / 4`，四个占位项保持不变。
- 另用隔离的已完成旧存档夹具验证：原四张蓝瘦任务卡、正确答案和 `completed=true` 与四占位项共存，刷新后仍显示“已完成”。此夹具只用于兼容性检查，不计入真实行走证明。

## 截图

- `four-pickups-map-clean.png`：真实游戏俯视地图，无任何 QA 标注。
- `four-pickups-overview.png`：同一实际地图，用游戏只读快照中的地图边界、实际物件坐标及正交相机投影公式添加四点标注；注释只存在于截图前临时 QA DOM，截取后立即移除，产品中没有红框或新增标注。
- `four-pickups-backpack.png`：四个独立占位条目及原蓝瘦 `0 / 4` 状态同时可见。为完整展示四项，仅将浏览器窗口高度临时改为 1400 像素。
- `four-pickups-1-near.png` 至 `four-pickups-4-near.png`：各点实际走近后的拾取前近景；01 恰逢模型自转侧面。
- `four-pickups-1-collected.png` 至 `four-pickups-4-collected.png`：对应拾取后消失状态。

## 复现

```powershell
node qa/four-pickups-browser-test.mjs <playwright/index.mjs绝对路径> http://127.0.0.1:5180/
```

执行脚本：`four-pickups-browser-test.mjs`；输入辅助方法：`four-pickups-input-helpers.mjs`；详细时间、路线起终点、各项断言、素材报告及图标读取结果见 JSON 报告。全部测试使用隔离浏览器存档，未使用或修改用户浏览器的真实进度。

旧 `pickup-browser-test.mjs` 的模型实例数断言已由 1 更新为 5；本轮未重复执行旧蓝瘦全任务长流程，新任务隔离性和旧完成存档兼容性由上述实测覆盖。
