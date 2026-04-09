# 你把字体调大一点

一个面向论文写作的 VS Code 插件原型。

它解决的是一个很具体的问题：当论文里的 matplotlib 图片放进 LaTeX 排版后显得太小、太挤、太难看时，你可以一边看 PDF，一边改图表样式参数，保存后自动重绘图片并重新编译论文。

当前仓库已经包含一个可运行的 `V0.1` 原型：

- VS Code 扩展骨架
- 样式文件保存监听
- 自动执行 Python 绘图脚本
- 自动执行 `latexmk` 重新编译
- 最小论文示例工程
- 默认更大的 matplotlib 字体参数

## 当前效果

推荐工作流：

- 左侧打开 `main.tex`
- 右上用 LaTeX Workshop 预览 PDF
- 右下打开 `.fontbigger/figure_style.json`

保存样式文件后，扩展会自动：

1. 运行 Python 脚本重绘图片
2. 运行 `latexmk` 重新编译论文
3. 在 VS Code 里看到更新后的 PDF

## 仓库结构

```text
.
├── .vscode/
│   └── launch.json
├── examples/
│   └── minimal-paper/
│       ├── .fontbigger/
│       │   └── figure_style.json
│       ├── figures/
│       ├── scripts/
│       │   └── plot_demo.py
│       └── main.tex
├── resources/
│   └── default-figure-style.json
├── src/
│   └── extension.js
└── package.json
```

## 已实现功能

- `Font Bigger: Open Style File`
  自动打开样式文件；如果不存在，会自动创建默认模板。
- `Font Bigger: Run Figure + LaTeX Pipeline`
  手动执行一次重绘和编译。
- 保存样式文件时自动触发流水线
- 输出日志到 `Font Bigger` output channel
- 支持通过 VS Code 设置修改：
  - 样式文件路径
  - Python 绘图脚本路径
  - 主 TeX 文件路径
  - Python 命令
  - LaTeX 编译命令

## 默认字体已经调大

示例样式文件位于：

[`examples/minimal-paper/.fontbigger/figure_style.json`](examples/minimal-paper/.fontbigger/figure_style.json)

默认值刻意偏大，目的是让双栏论文里的图先“看得清”：

- `font_size`: `16`
- `axis_label_size`: `18`
- `title_size`: `20`
- `tick_label_size`: `14`
- `legend_font_size`: `14`
- `line_width`: `2.6`

## 快速开始

### 1. 准备环境

建议本机具备：

- VS Code
- Python 3
- `matplotlib`
- `latexmk`
- VS Code 插件 `LaTeX Workshop`

### 2. 启动扩展开发宿主

在本仓库中按 `F5`，会启动一个 Extension Development Host，并自动打开：

[`examples/minimal-paper`](examples/minimal-paper)

### 3. 打开示例论文

在开发宿主里：

1. 打开 [`examples/minimal-paper/main.tex`](examples/minimal-paper/main.tex)
2. 用 LaTeX Workshop 打开 PDF 预览
3. 运行命令 `Font Bigger: Open Style File`
4. 修改样式参数并保存

### 4. 观察自动刷新

保存 [`examples/minimal-paper/.fontbigger/figure_style.json`](examples/minimal-paper/.fontbigger/figure_style.json) 后，扩展会：

- 运行 [`examples/minimal-paper/scripts/plot_demo.py`](examples/minimal-paper/scripts/plot_demo.py)
- 重写 `figures/output.pdf` 与 `figures/output.png`
- 重新编译 [`examples/minimal-paper/main.tex`](examples/minimal-paper/main.tex)

## 配置项

扩展配置命名空间是 `fontBigger`。

- `fontBigger.styleFile`
  样式文件路径，默认 `.fontbigger/figure_style.json`
- `fontBigger.plotScript`
  Python 绘图脚本路径，默认 `scripts/plot_demo.py`
- `fontBigger.mainTexFile`
  主 TeX 文件路径，默认 `main.tex`
- `fontBigger.pythonCommand`
  Python 可执行命令，默认 `python3`
- `fontBigger.latexCommand`
  自定义 LaTeX 编译命令；留空时自动使用 `latexmk -pdf -interaction=nonstopmode -synctex=1 <main.tex>`
- `fontBigger.runOnSave`
  是否在保存样式文件时自动运行，默认 `true`

## 原型边界

`V0.1` 明确只做一个稳定闭环，不做这些事：

- 不在 PDF 里点图调参
- 不自动识别任意图片和任意 Python 源码的映射关系
- 不改写用户自己的 matplotlib 代码
- 不提供复杂 GUI 面板
- 不支持多后端绘图库

## 下一步

比较自然的后续演进方向：

- 多个 preset
- 用表单替代直接写 JSON
- 多图管理
- 更好的错误提示
- Overleaf / Overleaf Workshop 兼容
