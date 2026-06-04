# 全自动足球推荐聚合 Agent

一个本地可运行的足球推荐聚合系统。页面只展示每日自动运行时间线和最终推荐结果，后台默认使用 ClubElo、FreeSuperTips 和 Football-Data 的公开信息生成真实推荐，不再使用演示数据。

## 快速开始

```bash
npm start
```

打开：

```text
http://127.0.0.1:3001
```

## 发布上线

### Vercel

项目已经包含 Vercel Serverless API：

- `api/run.js`
- `api/recommendations.js`
- `api/health.js`
- `vercel.json`

如果本机已登录 Vercel CLI：

```bash
vercel --prod
```

如果通过网页部署：

1. 把项目上传到 GitHub。
2. 在 Vercel 选择 Add New Project。
3. 导入仓库。
4. Framework Preset 选择 Other。
5. Build Command 留空。
6. Output Directory 留空。
7. 部署完成后打开 Vercel 分配的网址。

### Render

1. 把项目上传到 GitHub。
2. 打开 Render，选择 New Web Service。
3. 连接这个仓库。
4. Render 会读取 `render.yaml`，启动命令为：

```bash
node server/index.js
```

### Railway

1. 把项目上传到 GitHub。
2. 在 Railway 选择 Deploy from GitHub。
3. Railway 会读取 `railway.json` 并启动服务。

### Docker / VPS

```bash
docker build -t football-agent .
docker run -p 3001:3001 football-agent
```

生产环境会自动监听 `0.0.0.0`，本地开发默认监听 `127.0.0.1`。

## 功能

- 展示每日运行时间线
- 点击立即运行生成今日推荐
- 输出 2-3 场比赛、推荐方向、概率、理由和分数
- 最终推荐必须包含可解析的具体开球时间，并展示北京时间与来源当地时间
- 后台保留自动抓取、分析、定时与 webhook 推送能力
- 无真实可评分数据时，页面会显示暂无推荐，不会生成虚假结果

## 配置文件

- `config/default-sources.json`：默认信息源模板
- `data/sources.json`：运行后生成的信息源配置
- `data/state.json`：运行状态、日志和最新推荐结果

## API

- `GET /api/health`
- `GET /api/sources`
- `POST /api/sources`
- `DELETE /api/sources/:id`
- `GET /api/recommendations`
- `GET /api/logs`
- `GET /api/config`
- `POST /api/config`
- `POST /api/run`

## 推荐接入

后续可以继续加入：

- OpenAI 模型抽取，用于替换当前规则提取器
- Telegram Bot、企业微信、邮件等专用推送通道
- 数据库持久化和历史命中率回测
- 更细的联赛、玩法和关键词过滤
