# Elowen · 创作小镇作品集

React、Three.js 与 React Three Fiber 制作的滚动叙事作品集。已包含完整网页代码、三维模型、图片、高清/流畅两档视频，以及 GitHub Pages 自动构建配置。

## 已收录内容

- 个人介绍：中文简历、教育背景、三段实习、荣誉、技能和联系方式。
- 6 个完整课程项目：咕咕岛、GOODBOY、灵馥、牙芽奇兵局、昆曲韵动、她视界。
- 6 个实习期间落地网页设计项目。
- 7 组动效作品，TD 系列包含 4 段视频和 4 张海报。
- 其他设计：缄默的存档，2 段视频。
- 最新个人资料：UXDA 目前入围全国总决赛，作品集链接为 https://elowen.uno/ 。

## 在 GitHub 上分批上传

1. 创建或打开自己的仓库，默认分支使用 main。
2. 按交付文件夹里的批次顺序上传；每批进入 Add file → Upload files。
3. 打开某一批的文件夹，把**里面的文件和文件夹**拖进上传区。保留 src、public 等路径，不要把 batch-XX 外层文件夹上传进去。
4. 每批提交完成，再进行下一批。所有素材都传完后，再上传最后一批 .github 配置。
5. ZIP 只是方便携带。先解压，再上传解压后的内容。GitHub 不会自动解压 ZIP。

## 用 GitHub Pages 上线

1. 仓库 → Settings → Pages。
2. Build and deployment 的 Source 选择 GitHub Actions。
3. 上传最后一批 .github/workflows/pages.yml；它会自动构建并部署。
4. 在 Actions 中等 Build and deploy Elowen portfolio 变为绿色，打开 Pages 给出的地址。
5. 以后修改代码并提交到 main，会自动更新网站。

自动配置同时适配用户名主页和普通仓库子路径，例如 https://用户名.github.io/仓库名/ 。图片、视频、模型和深链接都采用同一个路径前缀。域名的绑定可在 Pages 中单独设置。

## 本地开发

安装 Node.js 22.12 或更新的 22.x 版本，然后在本目录运行：

```sh
npm ci
npm run verify:uploads
npm run dev
```

生产构建：

```sh
npm run build
npm run preview
```

输出为 dist/。直接双击 index.html 不能运行 React/WebGL 项目，请使用上面的本地服务或 GitHub Pages。

## 内容维护

- src/data/about.js：个人介绍与简历。
- src/data/portfolio.js：作品分类和项目标题。
- src/data/case-studies.json：长图切片与章节顺序。
- src/data/motion.json、media-additions.json：视频、封面和海报。
- src/data/journey.js：镜头、骑行路线和走廊门位。
- public/：网站实际使用的模型、WebP 图片和 MP4。
- scripts/：素材导入、模型生成与上传完整性检查。

网站保留按需加载、暂停后台场景、完整海报展示和响应式视频；所有上传用的图片与视频均为本站已使用的优化版本。

## 上传限制与官方说明

GitHub 网页上传的单文件上限为 25 MiB，每次最多 100 个文件。本交付包按每批低于 23 MiB、最多 80 个文件整理。

- [GitHub 文件上传说明](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)
- [GitHub Pages 工作流说明](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
