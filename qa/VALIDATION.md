# 旧网驿站浏览器验收

验收地址：`http://127.0.0.1:5180/`。在本机 Chrome 中使用 Playwright 执行；最终 `browser-report.json` 的 `passed` 为 `true`，脚本退出码为 0。

## 实际操作通过

- 新浏览器上下文从出生点进入拖拽模式，真实 WASD 行走至邮箱；实际拖拽鼠标转头并对准邮箱，出现调查提示。
- 按 E 阅读明确标记为原型测试的虚构留言，点击领取，背包得到唯一的“缺少配文的图片”。
- 对话框、背包打开时按 W 不移动；关闭后仍暂停，明确点击后才恢复。
- 再次调查没有重复领取按钮，线索数仍为 1；按 B 可回看名称和说明。
- 刷新恢复位置、调查状态和线索；不会自动重新捕获鼠标。
- 真实鼠标锁定成功，移动鼠标可转头；开背包释放锁定，重新点击可恢复，Esc 再次释放。
- 模拟浏览器拒绝 Pointer Lock 时，自动切换拖拽模式，仍能行走和转头。
- 使用独立新上下文提供碰撞测试的起始存档，实际按 W 验证树干、主要石块、驿站墙体、场景边界均阻挡移动。主线测试没有传送或状态注入。
- 只阅读留言而不领取时，刷新仍没有线索；随后可以正常领取。
- 确认重置后清空本原型调查与线索，回到出生点；旧游戏存档哨兵值保持不变。
- 拦截 Tree_01.glb 请求模拟资源损坏，页面显示明确加载失败原因与重试按钮。

## 资源与画面

四个 GLB 均实际返回 HTTP 200，并产生场景实例：树 14、岩石 6、草丛 89、路面 8。每个资产都有贴图材质，树和草均含透明裁切材质。目视 `outpost-overview.png` 与 `outpost-backpack.png`：模型完整，树草没有不透明矩形底板，低分辨率纹理可辨认，UI 中文清楚。正常主线没有浏览器运行时错误。

## 可重跑

```powershell
node .\qa\browser-test.mjs <playwright/index.mjs 的绝对路径> http://127.0.0.1:5180/
```

预览服务须先启动；测试会建立临时浏览器上下文，不修改日常浏览器存档。本机测试使用安装在 `C:/Program Files/Google/Chrome/Application/chrome.exe` 的 Chrome。

截图：`outpost-overview.png`、`outpost-mailbox.png`、`outpost-backpack.png`、`outpost-restored.png`、`outpost-loading-failure.png`。`outpost-failure.png` 如存在，是首次测试中等待调查提示的脚本同步失败截图，最终结果以 `browser-report.json` 为准。

范围：本版验证桌面键鼠操作；未实现移动端触屏摇杆、跳跃、建筑内部或多人功能。
