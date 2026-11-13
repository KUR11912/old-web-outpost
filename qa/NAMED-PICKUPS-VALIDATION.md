# 四个原占位文件夹正式内容绑定验收

2026-11-12，在本机 `http://127.0.0.1:5181/` 的原关卡完成 Chrome/WebGL 浏览器验收。`named-pickups-browser-report.json`：**9组检查通过，页面/控制台错误0**，约24秒。主代理另已完成25项逻辑测试和生产构建。

## 原文件夹与正式内容

| 原 pickupId | 原位置 X,Z | 正式名称 | memeId | 内容卡 ID |
|---|---|---|---|---|
| `field-folder-01` | 20.4,-46 | 友谊的小船 | `friendship-boat` | `collection-friendship-boat` |
| `field-folder-02` | 24.5,-20 | 你是GG还是MM | `gg-or-mm` | `collection-gg-or-mm` |
| `field-folder-03` | 26.6,9 | 厉害了我的哥 | `awesome-my-bro` | `collection-awesome-my-bro` |
| `field-folder-04` | 60,3 | 你是魔鬼还是秀儿 | `devil-or-showoff` | `collection-devil-or-showoff` |

修改前四个 `memeId` 均为 null，名称为待定老梗01–04。修改前源码、SHA256和运行快照保存在 `named-pickups-baseline/`，未覆盖任何原有正式梗内容。地图仍为五个文件夹实例；上表四项的 ID、位置、模型、图标、标记和地点全部与基准一致，原蓝瘦香菇文件夹配置完整一致。

## 实际拾取与显示

- 每项均在独立浏览器存储中加载原文件夹附近的合法站位，再通过真实 WASD 靠近约1.15–1.28米触发。不是完整从出生点走到四处的路线，也未在运行中传送、修改调试状态或调用拾取函数。
- 每次靠近后立即显示准确的 `已获得老梗：正式名称`，对应文件夹隐藏，探索继续，没有弹出强制窗口。
- `pickupInventory` 与 `collectedPickups` 只新增对应原 ID；`memes` 与 `clues` 分别只新增该项绑定的唯一 ID。四项累积收集后无串项、重复项或漏项。
- 每项均真实往返穿过原位置，确认不重复领取，再刷新确认记录、隐藏状态和收藏名称保留。
- 四个收藏条目显示正式名称、原地点和“梗图、年份与出处待补充。”，保留通用文件夹图标。逐项打开详情，确认没有梗图、没有来源链接，并明确说明梗图、年份和出处待补充。
- 原未领取文件夹持续旋转，模型实例数与悬浮/自转参数和基准完全一致。

## 存档与任务隔离

- 已收集四个占位文件夹的旧 v1 存档仅含原 `pickupInventory`/`collectedPickups`，仍能恢复四个正式名称与新绑定；场景文件夹保持隐藏，刷新后仍不重新发放。
- 单独收集四个新梗期间，“蓝瘦香菇”始终为 **0 / 4**，邮箱调查标志、关联答案与完成状态不变。
- 旧存档中蓝瘦四卡及正确提交的完成状态，与四个正式收藏共存，刷新保持“已完成”。
- 单独靠近原蓝瘦香菇文件夹仍显示原提示，只新增原图片与 `blue-mushroom`，任务此时才升为 **1 / 4**。
- `CLUE_ORDER`、原四张蓝瘦任务卡与原 `blue-mushroom` 定义均与修改前完整一致；四个新卡不在任务顺序中。

## 保持原样的证据

实际运行的地图配置、全部碰撞体、10种模型资产报告、天空、相机与拾取动画参数和修改前快照一致。`save.ts`、`main.ts`、`pickups.ts`、`player.ts`、`map-config.ts`、`map-environment.ts`、`world.ts`、`mountain-faults.ts`、`sky-config.ts`、`sky-enclosure.ts`、`style.css` 的SHA256均未改变。

`investigation-ui.ts` 仅将背包说明“占位条目不计入下方”改成“探索收藏不计入下方”；逆向替换该文案后与修改前源码逐字相同。详细对比记录在浏览器报告的 `sourcePreservation`。

## 截图和复现

- `named-pickup-1-collected.png` 至 `named-pickup-4-collected.png`：四次实际拾取后的准确提示与0/4任务状态。
- `named-pickups-backpack.png`：四个正式收藏同屏显示，全部内容资料待补，下方蓝瘦任务仍为0/4。
- `named-pickups-legacy-backpack.png`：旧占位收藏存档恢复后的正式名称。

已查看背包同屏截图及实际拾取截图，确认正式名称与界面布局正常。

```powershell
$qaNode = (Get-Command node).Source
$qaPlaywright = Join-Path (Split-Path (Split-Path $qaNode -Parent) -Parent) 'node_modules\playwright\index.mjs'
& $qaNode qa/named-pickups-browser-test.mjs $qaPlaywright http://127.0.0.1:5181/
```

`--baseline` 仅用于修改前捕获，勿用改后数据覆盖已保存的原始基准。所有测试上下文与用户当前游戏存档隔离。
