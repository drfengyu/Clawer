# 配置详细说明

本文档说明 `.env` 中所有配置项的含义、默认值与配置步骤。复制 `.env.example` 为 `.env` 后按需修改：

```bash
cp .env.example .env
```

> `.env` 已被 `.gitignore` 忽略，不会进入版本库，可放心填写凭据。修改后需**重启服务**（`npm start`）生效。

---

## 一、基础配置

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | HTTP 服务监听端口 |
| `DOWNLOAD_PATH` | `./downloads` | 下载文件保存目录（图片/视频/音频分子目录） |
| `DB_PATH` | `./database.db` | SQLite 数据库文件路径 |

---

## 二、站点对外基址

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PUBLIC_BASE_URL` | 按请求自动推断 | RSS item 链接、推送消息、邮件正文里的链接基址 |

- 本地自用：留空或 `http://localhost:3000` 即可。
- 公网订阅/推送（手机点链接要能打开）：填你的**公网域名**，如 `https://anime.example.com`，**不带结尾斜杠**。

---

## 三、推送总开关

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PUSH_ENABLED` | `false` | `true` 时调度器**每日爬完后**自动推送"今日新增"动漫到已配置渠道 |

- 只推送本次**新入库**的动漫（已存在的不重复推）。
- 各渠道独立：填了哪个就推哪个，没填的静默跳过；任一渠道失败不影响其它。
- 不想等每天 8 点自动触发？用 [手动测试端点](#六验证配置) 立即验证。

---

## 四、推送渠道配置

### 渠道 1 · Bark（iOS 推送）

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `BARK_KEY` | 空 | Bark 设备 key，**填了即启用** |
| `BARK_SERVER` | `https://api.day.app` | Bark 服务器地址，自建服务器才需改 |

**取 key 步骤：**
1. App Store 搜索安装 **Bark**（图标是个铃铛）。
2. 打开 App，首页会显示一条形如 `https://api.day.app/XXXXXXXXXXXX/` 的地址。
3. 中间那串 `XXXXXXXXXXXX` 就是 `BARK_KEY`，复制填入。

```ini
BARK_KEY=XXXXXXXXXXXX
PUSH_ENABLED=true
```

---

### 渠道 2 · Server酱（微信推送）

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `SERVERCHAN_KEY` | 空 | Server酱 SendKey，**填了即启用** |

**取 key 步骤：**
1. 浏览器打开 **https://sct.ftqq.com**，用**微信扫码登录**。
2. 进入「**SendKey**」页面，复制 `SCT` 开头的那串 key。
3. 首次使用需按页面提示**关注「方糖」微信公众号并绑定**，否则收不到消息。
4. 填入 `.env`：

```ini
SERVERCHAN_KEY=SCTxxxxxxxxxxxxxxxx
PUSH_ENABLED=true
```

> 系统自动识别：`SCT` 开头走新版 `sctapi.ftqq.com`，老版 key 走 `sc.ftqq.com`。
> 推送内容为今日新增动漫的 Markdown 列表（含详情页链接）。

---

### 渠道 3 · 邮件（SMTP，默认网易 163）

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `SMTP_HOST` | `smtp.163.com` | SMTP 服务器（网易 163 默认；126 改 `smtp.126.com`） |
| `SMTP_PORT` | `465` | SMTP 端口（SSL 用 465） |
| `SMTP_SECURE` | `true` | 是否走 SSL/TLS（465 端口为 `true`） |
| `SMTP_USER` | 空 | 发件邮箱完整地址，**需填** |
| `SMTP_PASS` | 空 | **授权码**（非登录密码！），**需填** |
| `MAIL_FROM` | 同 `SMTP_USER` | 发件人地址，一般留空即可 |
| `MAIL_TO` | 空 | 收件邮箱，**需填** |

**网易邮箱（163）配置步骤：**
1. 登录 **163 邮箱网页版** → 顶部「**设置**」→「**POP3/SMTP/IMAP**」。
2. 开启 **SMTP 服务**（按提示发短信验证）。
3. 系统生成一串**客户端授权密码** —— 这串才是 `SMTP_PASS`，**不是你的邮箱登录密码**。
4. 填入 `.env`：

```ini
SMTP_HOST=smtp.163.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=你的账号@163.com
SMTP_PASS=刚生成的授权码
MAIL_TO=接收通知的邮箱@example.com
PUSH_ENABLED=true
```

**其它邮箱参考（把 HOST 换掉，其余多数相同）：**

| 邮箱 | `SMTP_HOST` | 端口 | 备注 |
| --- | --- | --- | --- |
| 网易 163 | `smtp.163.com` | 465 | 授权码 |
| 网易 126 | `smtp.126.com` | 465 | 授权码 |
| QQ 邮箱 | `smtp.qq.com` | 465 | 授权码 |
| Gmail | `smtp.gmail.com` | 465 | 应用专用密码 |
| Outlook | `smtp.office365.com` | 587 | `SMTP_SECURE=false` |

---

## 五、最小配置示例

只用微信（Server酱）+ 邮件，本地运行：

```ini
PORT=3000
DOWNLOAD_PATH=./downloads
DB_PATH=./database.db

PUBLIC_BASE_URL=http://localhost:3000
PUSH_ENABLED=true

SERVERCHAN_KEY=SCTxxxxxxxxxxxx

SMTP_HOST=smtp.163.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=me@163.com
SMTP_PASS=授权码
MAIL_TO=me@163.com
```

---

## 六、验证配置

无需等到每天 8 点自动推送，可手动触发把今日更新（或最近 5 部）推到已配置渠道：

```bash
npm start
curl -X POST http://localhost:3000/api/push/test \
  -H "Content-Type: application/json" -d "{\"limit\":3}"
```

返回示例：

```json
{"success":true,"count":3,"results":[
  {"channel":"bark","skipped":true},
  {"channel":"serverchan","ok":true},
  {"channel":"email","ok":true}
]}
```

- `skipped: true` —— 该渠道未配置（正常，没填就跳过）。
- `ok: true` —— 推送成功，对应手机/微信/邮箱应收到摘要。
- `ok: false` —— 推送失败，`error` 字段是原因（常见：授权码错误、SendKey 未绑定公众号）。

---

## 七、常见问题

- **改了 `.env` 没生效**：需重启服务（`npm start`），`.env` 仅启动时读取一次。
- **`PUSH_ENABLED=true` 但没收到推送**：自动推送只在调度器**每日爬取后**触发，且只推当次**新增**的动漫；想立即验证用上面的测试端点。
- **邮件报认证失败**：99% 是把登录密码当成了 `SMTP_PASS`，请改用**授权码**。
- **Server酱收不到**：确认已关注并绑定「方糖」公众号，且 key 为最新 `SCT` 开头。
- **公网点链接打不开**：`PUBLIC_BASE_URL` 要设成能从外网访问的域名，且服务已对外暴露。

更多 RSS 订阅与推送的功能说明见 [RSS_PUSH.md](./RSS_PUSH.md)。
