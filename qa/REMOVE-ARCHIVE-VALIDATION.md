# 三处调查点移除验收

2026-11-12，在本机 `http://127.0.0.1:5181/` 的原关卡中完成。最终 `remove-archive-browser-report.json` 为 **passed=true，7组检查通过，0页面/控制台错误**，运行约17.8秒。

## 移除与保留

- 移除 `chat-viewer`（聊天记录查看器，20,-36.1）、`image-cache`（图片缓存终端，22.8,-35.8）、`archive-desk`（整理线索，25,-32.5）。真实渲染场景中三个物件组和三块名称牌均不存在；对应三个碰撞体与交互目标已删除。
- 当前可调查目标仅剩 `mailbox` 和 `old-terminal`。旧终端配置、CRT、桌腿和名称牌保留；邮箱/旧终端的交互快照与删除前一致。
- 碰撞列表与旧快照精确比较，仅少上述3项，当前129项。10种GLB资产报告、天空、相机、五个文件夹的ID和基础位置保持不变。地图数据仅改变档案馆说明和关闭原调查任务接入点。
- `save.ts`、`pickup-data.ts`、`pickups.ts`、`player.ts`、`world.ts`、`map-environment.ts`、`mountain-faults.ts`、天空两模块和样式，共10个源码SHA256未变。旧任务卡、问题及顺序保留以兼容存档；仅蓝瘦香菇卡中的过时引导改指保留的旧终端。

## 实际操作

1. 分别从三个原物件附近的合法独立存档点进入原关卡，用真实鼠标拖拽看向原物件位置并按E：没有交互提示或旧窗口。
2. 使用真实WASD走入原物件中心、横向穿过原占地后走出，三处均可通行，没有残留碰撞。总计3段绕行，不声称从出生点走完整张地图。
3. 在原旧终端前实际按E，正常打开读音便笺并记录资料；没有整理线索按钮或旧关联判断入口。随后实走到档案馆前方截图。
4. 旧已完成调查存档与五项已拥有收藏同时加载、刷新后，旧 `archive`、`clues`、`pickupInventory` 保持，五个场景文件夹仍隐藏。统一收藏背包显示5件，HUD显示探索收藏5/5，不再引导玩家寻找已删除调查点。
5. 单独调用旧三个站点ID不会打开UI，公开界面不再暴露 `showAssociation`。

浏览器使用隔离存储与上下文，不改用户正在游玩的存档。QA仅在该测试页面中观察原 `renderer.render` 的场景参数，没有增加产品调试接口或修改场景/玩家位置。行走检查沿用50ms轮询的真实输入助手，终点允许0.22m的采样与松键延迟误差。

## 截图与复现

已查看两张最终截图：

- `removed-archive-front.png`：档案馆前方已清空三处物件，左侧保留旧终端。
- `removed-archive-collections.png`：旧存档的五项统一探索收藏和5/5 HUD。

```powershell
$qaNode = (Get-Command node).Source
$qaPlaywright = Join-Path (Split-Path (Split-Path $qaNode -Parent) -Parent) 'node_modules\playwright\index.mjs'
& $qaNode qa/remove-archive-browser-test.mjs $qaPlaywright http://127.0.0.1:5181/
```

基准为 `remove-archive-baseline/` 中的源码哈希、源文件副本及此前运行快照；最终检查详情和实际路线位于 `remove-archive-browser-report.json`。源码比较结果另见 `remove-archive-baseline/source-comparison.json`。
