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
