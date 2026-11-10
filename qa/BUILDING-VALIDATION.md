# 驿站建筑替换验收

在本机 Chrome 中实际运行网页 `http://127.0.0.1:5180/`；全部测试使用独立浏览器上下文，没有修改用户日常浏览器的存档。

## 结果

- `browser-report.json`：13 项原功能回归通过，正常流程 `errors=[]`。
- `building-browser-report.json`：8 项建筑专项通过，`errors=[]`。
- 四个原环境 GLB 和新 `Outpost_01.glb` 均实际返回 HTTP 200，有贴图和实例。原环境实例数保持树14、岩石6、草89、路面8。
- 从出生点用真实 WASD 与拖拽转头，走到建筑左侧，经过背面与右侧，绕过保留的长椅，返回邮箱。该绕行主流程没有注入坐标或传送。
- 前墙、背墙、左右侧墙与左梯凸出部分分别用真实前进输入测试，都能阻止穿墙。这些定点碰撞测试使用独立初始测试存档。
- 绕楼后仍能看向原位置邮箱，按E阅读、领取唯一线索、背包查看，并在刷新后恢复。
- 窗口暂停、鼠标锁定释放与恢复、重复领取保护、只读未领取、重置隔离均通过。
- 拦截新建筑 GLB 请求时显示 `Outpost_01.glb` 加载失败原因和重试按钮。

## 实际画面

- `building-game-front-close.png`：1000×900，与用户图1接近的正面近景，包含道路、门、邮箱与场景界面。
- `building-after-front.png`：1440×1000，较完整的正面和周围环境。
- `building-after-overview.png`：出生点视角。
- `building-game-left.png`、`building-game-back.png`、`building-game-right.png`：实际绕行过程中的侧/背面近距离检查。
- `building-game-mailbox-clue.png`：绕楼后收集到的线索。
- `before-building-overview.png`、`before-building-backpack.png`：保留的替换前真实画面。

已目视正面、背面和线索截图：新建筑三排窗口完整，浅墙低分辨率纹理、深蓝檐口、中央双门、小门头牌与现有道路/邮箱关系正常，侧背面非空壳。无需新增 gameplay 修复。

旧建筑同机位截图尝试发生于本地服务尚未启动时，因此没有生成可用的 `building-before-front.png`；替换前比较使用保留的旧 overview 与用户图1。`building-before-report.json` 仅记录该前置尝试，不是最终新版验收结果。

## 重跑

```powershell
node .\qa\browser-test.mjs <playwright/index.mjs的绝对路径>
node .\qa\building-browser-test.mjs <playwright/index.mjs的绝对路径>
node .\qa\building-browser-test.mjs <playwright/index.mjs的绝对路径> http://127.0.0.1:5180/ --photos-only
```

第三条只更新更接近参考图比例的近景截图，不覆盖建筑专项测试报告。建筑仍是室外可环绕外观，门不打开，未新增室内区域。
