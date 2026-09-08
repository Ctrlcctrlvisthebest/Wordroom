# GitHub 前端 + Cloudflare 云端词表

前端仍为 [GitHub Pages](https://ctrlcctrlvisthebest.github.io/Wordroom/)。独立的 Cloudflare Worker `wordroom-cloud` 提供 API，独立 D1 数据库 `wordroom-cloud` 保存结构化词表；不会连接或修改 BeforeTheRainStop 的房间数据。未使用 ChatGPT Sites 登录或部署，也不需要开通 R2。

## 使用

1. 导入 CSV，选择内容列，照常练习和加星标。
2. 展开左侧“云端词表”，创建同步码，并立即复制到安全的地方。
3. 点击“保存当前词表”。可以保存多份；从云端打开后再保存会更新该份，重新导入 CSV 后保存会新建一份。
4. 另一台设备打开同一网站，粘贴同步码并连接，选择已保存词表后点击“打开词表”。

云端保留原始表头、所有原始列和值、字段映射、星标。造句草稿不上传，打开另一份词表会提示并清空本页草稿。不是自动同步：修改星标后需再次保存。

每个同步码最多 20 份词表、合计 40 MiB；每份结构化快照最多 10 MiB，词表仍限制 20,000 行、100 列。本地 CSV 导入限制保持 5 MiB。JSON 表示可能比 CSV 更大，云端保存超限不会清空本地练习。

## 同步码与隐私

- 浏览器用 Web Crypto 生成 32 字节随机码，通过 HTTPS 的 Authorization 请求头发送，不放在 URL、前端源码或日志中。
- 数据库只存同步码的 SHA-256 摘要作为所属空间标识，不存原始同步码。所有读写都带服务端所属空间条件。
- 同步码就是访问凭证，不是普通分享码。持有者可读写该空间全部词表；没有账号、邮箱或密码找回服务。
- 本设备仅在浏览器存储中记住同步码；词表的持久副本实际存于 D1。公共电脑用完请退出同步。
- 云端内容没有做端到端加密；后端账号管理员有数据库管理权限。不要上传敏感信息。
- “删除云端副本”会从应用数据库删除该份词表及分片；不会清空当前页面。Cloudflare 管理的备份可能按平台保留策略存在，不能把应用删除解释为立即抹除所有备份。

## 安全与一致性

- 只允许配置的前端 origin 进行浏览器跨域访问；CORS 不代替同步码鉴权。接口响应 `Cache-Control: no-store`。
- 按 IP 限制读写请求频率；每个码的列表和容量配额也在服务端强制执行。限流并非实名验证或无限抗滥用保证，实际费用/额度取决于 Cloudflare 账号方案。
- 服务端在流式读取过程中限制请求大小，再校验结构、字段索引、星标索引和词数；使用绑定参数查询。
- 大快照拆为有序文本分片，分片边界避开 UTF-16 代理对。元数据和所有分片使用 D1 原子批处理一起更新，失败不会留下半份词表。
- 更新和删除带版本条件。另一个设备已更新时返回冲突，客户端不会静默覆盖；刷新列表也不会偷偷把本地编辑的版本号升级。
- 读取期间如果本地导入、映射、星标或草稿发生变化，取消替换以保留本地工作。

## 开发与部署

前端新增模块由浏览器直接加载，使用相对路径，保持 GitHub 仓库子路径兼容；没有新增运行时依赖。`cloud-config.js` 只包含公开后端地址。

后端配置：`server/wrangler.jsonc`；迁移：`server/migrations/`；凭证由本机 Wrangler 管理，不提交仓库。类型由 `npm run types:cloud` 生成，复用现有 Workers 类型包。

验证：`npm test`、`npm run lint`、`npx tsc --noEmit`、`npm run build`。

后端迁移与发布：

```sh
npx wrangler d1 migrations apply wordroom-cloud --config server/wrangler.jsonc --remote
npm run deploy:cloud
```

随后提交并推送前端源文件，GitHub Pages 继续按仓库当前发布来源发布。旧 `.openai/hosting.json` 与 React 站点保持不变。

`node scripts/smoke-cloud.mjs` 会对已部署 API 执行真实 20,000 词保存、跨设备读取、隔离、冲突和删除验证。它只生成合成词表，使用每次新建的随机同步码，不输出凭证，并清理自己创建的精确词表 ID。不要用私人同步码替换测试生成器。

测试范围：Node 单元测试和最小 DOM 模拟覆盖页面逻辑；Miniflare/workerd 的真实 D1 绑定覆盖后端事务，不声称做过浏览器布局测试。

本次发布验证：65 项测试通过，完整 lint、TypeScript 检查及构建通过。已部署服务通过 20,000 词、4,009,089 字节快照的真实往返、另一设备读取、不同同步码隔离、版本冲突及删除检查；测试词表已清理。

存储与事务设计依据 [D1 数据库 API](https://developers.cloudflare.com/d1/worker-api/d1-database/) 和 [D1 限制](https://developers.cloudflare.com/d1/platform/limits/)。
