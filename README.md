# Indie Trail

独立游戏原型合集。

## Pinball

像素风弹珠台与背包构筑 Roguelite Demo，位于 [`pinball/`](./pinball/)。

## Endless Rails

原创竖屏荒原列车防守试玩，通过浮动虚拟摇杆控制无人机：按住战场任意位置生成摇杆，滑动控制移动方向和速度，松手停止。无人机可以在整个战场内移动，不再限制在列车周围；基础移速为每秒 180 个游戏像素（control.js 的 DRONE_MOVE_SPEED），位移按速度 × 时间计算，轻推慢移、推满全速，斜向不会更快。支持触摸、鼠标以及方向键 / WASD，点按不会瞬移。列车、铁轨与荒原地面持续形成向后掠过的速度感。每局包含远征契约、路线事件、经验构筑、武器核心与补给站列车改装，位于 [`endless-rails/`](./endless-rails/)。v0.2 是已手动提交的基线版本；v0.3 加入双进度，v0.4 加入相对操控、护航火力预算和路线复玩。

本地运行：

```powershell
python -m http.server 4173
```

然后打开 <http://127.0.0.1:4173/endless-rails/>。

### v0.9 回归

- 主页底部为“商店 / 列车 / 出战 / 研究 / 设置”：出战页选择区域，列车页配置编组，研究页强化无人机。长期资源在车站锁定，可继续深入或撤离。
- 逻辑回归：`for f in endless-rails/*.test.js; do node "$f" || exit 1; done`。
- 可重复数值采样：`node scripts/pacing-check.cjs`，无渲染、无 GM，输出 12 个种子的完整远征结果。
- 浏览器回归：同一静态服务器打开 `endless-rails/qa.html`。它提供四种视口、隔离测试存档和高压场景；生产游戏入口仍是 `endless-rails/`。工作耗时不含浏览器 GPU 合成开销，云端 Chrome 的 FPS 不代表手机真机表现。

### 开发期用户存档（JSON 文件）

运行 `node services/player-data/server.cjs`，打开 <http://127.0.0.1:4173/endless-rails/>，设置页「测试存档」可按测试 ID 切换各自的服务器 JSON 存档。无需数据库、注册或安装依赖。支持旧游客进度导入、冲突选择和断网重试。

[运行说明、文件位置和容量边界](services/player-data/README.md)。GitHub Pages 的测试存档入口默认关闭，仍保留原本本地存档。
