# My Breakout

一个使用原生 HTML、CSS、JavaScript 和 Canvas 制作的打砖块小游戏。

## 功能

- 键盘控制球拍，支持方向键和 A/D 键
- 多行、不同颜色和分值的砖块
- 分数、最高分、生命值与关卡显示
- 开始、暂停、继续和重新开始
- 砖块碰撞特效与 Web Audio 合成音效
- 多关卡与逐步加速
- 响应式布局，适配不同屏幕尺寸
- 使用 `localStorage` 保存最高分

## 操作方法

- 点击“开始游戏”开始
- `←` / `A`：向左移动球拍
- `→` / `D`：向右移动球拍
- 点击“暂停”或“继续”控制游戏状态

## 本地运行

进入本目录并启动一个静态服务器：

```bash
python -m http.server 8000
```

然后访问 <http://localhost:8000/>。

## 项目文件

- `index.html`：页面结构和游戏界面
- `style.css`：布局与视觉样式
- `game.js`：绘制、控制、碰撞、关卡、音效及游戏状态

## 致谢

本项目的学习与初始结构参考了 [end3r/Gamedev-Canvas-workshop](https://github.com/end3r/Gamedev-Canvas-workshop)。原教程中的 `lesson01.html` 到 `lesson10.html` 未被修改。

