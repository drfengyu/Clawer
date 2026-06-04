# RSS 订阅 & 每日推送

系统在已有「每日更新」抓取之上，提供两种获取更新的方式：

1. **RSS 订阅** — 对外输出标准 RSS 2.0 feed，用任意阅读器/服务订阅。
2. **主动推送** — 每天爬完后把"今日新增"动漫推送到 Bark / Server酱 / 邮件。

两者均为**纯增量**：不改数据库结构与抓取链路，所有推送渠道默认关闭，按 `.env` 开关启用。

> 📌 **每一项配置的详细含义与逐平台配置步骤见 [CONFIG.md](./CONFIG.md)**，本文聚焦功能与端点说明。

---

## 一、RSS 订阅

| 端点 | 说明 |
| --- | --- |
| `GET /rss` | 每日更新订阅源（无当日数据时回退最近入库 50 部） |
| `GET /rss/category/:name` | 分区订阅源，如 `/rss/category/日漫` |

- 输出 `Content-Type: application/rss+xml`，item 含标题/封面/评分/简介，`<link>` 指向详情页 `/anime/:id`。
- `<guid>` 形如 `anime-<id>-<update_date>`，更新当天会生成新条目，阅读器据此提示"有更新"。
- 画廊顶栏「📡 RSS」即指向 `/rss`。

**对外可达**：若用阅读器/RSSHub/Follow 从公网订阅，需把服务暴露到公网，并在 `.env` 设 `PUBLIC_BASE_URL=https://你的域名`（影响 item link 与邮件正文里的链接）。

---

## 二、主动推送

### 开关

```ini
PUSH_ENABLED=true          # 总开关，true 时调度器每日爬完后推送新片
PUBLIC_BASE_URL=https://你的域名   # 推送/邮件里的链接基址（缺省按请求推断）
```

仅推送**本次新入库**的动漫（已存在的不重复推）。各渠道未配置则静默跳过。

### 渠道 1：Bark（iOS）

```ini
BARK_KEY=你的BarkKey
BARK_SERVER=https://api.day.app   # 自建服务器则改这里
```

取 key：App Store 安装 **Bark** → 打开 App，复制形如 `https://api.day.app/XXXXXXXX/` 里的 `XXXXXXXX` 即 `BARK_KEY`。

### 渠道 2：Server酱（微信）

```ini
SERVERCHAN_KEY=SCTxxxxxxxx
```

取 key：访问 [sct.ftqq.com](https://sct.ftqq.com) 微信登录 → 复制 **SendKey**（`SCT` 开头）。系统自动走 `sctapi.ftqq.com`，老版非 `SCT` key 走 `sc.ftqq.com`。

### 渠道 3：邮件（SMTP）

默认即网易 163 邮箱配置，只需填用户名/授权码/收件人：

```ini
SMTP_HOST=smtp.163.com     # 默认值；126 邮箱改 smtp.126.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=you@163.com
SMTP_PASS=授权码           # 网易用"客户端授权密码"，非登录密码
MAIL_FROM=you@163.com      # 缺省用 SMTP_USER
MAIL_TO=target@example.com
```

`SMTP_HOST/USER/PASS/MAIL_TO` 填齐才启用。网易邮箱需登录网页版 →「设置 → POP3/SMTP/IMAP」开启 **SMTP 服务**并生成**授权码**，把授权码填入 `SMTP_PASS`（不是邮箱登录密码）。

---

## 三、验证

不用等到每天 8 点，直接调测试端点把今日更新（或最近 5 部）推到已配置渠道：

```bash
curl -X POST http://localhost:3000/api/push/test \
  -H 'Content-Type: application/json' -d '{"limit":3}'
```

返回示例（未配置任何渠道时全部 `skipped`）：

```json
{"success":true,"count":3,"results":[
  {"channel":"bark","skipped":true},
  {"channel":"serverchan","skipped":true},
  {"channel":"email","skipped":true}
]}
```

配置某渠道并重启后，对应 `skipped` 变为 `{"channel":"bark","ok":true}`，手机/微信/邮箱应收到摘要。

---

## 四、注意

- 推送在调度器**每日爬取之后**触发，依赖服务持续运行（与 8 点每日更新同一钩子）。
- 凭据只存 `.env`（已被 `.gitignore` 忽略），不入库、不写日志（日志仅记渠道名与成功/失败）。
- 同一天若服务重启并重爬，理论上可能重复推送一次（受内存级当日守卫限制，正常常驻不会发生）。
