/**
 * 手动全量同步源站各分区目录到本地数据库（CLI 薄壳，核心见 src/sync/categorySync.js）。
 *
 * 用法：
 *   node scripts/syncCategories.js            # 抓全部分区全部页
 *   node scripts/syncCategories.js 5          # 每个分区最多抓 5 页（调试/限量）
 *
 * 注意：sql.js 为整库内存镜像，本脚本独立进程运行期间必须独占数据库——
 *       请先停掉正在运行的服务，跑完再重启，避免两个进程互相覆盖。
 *      （服务进程内的“每日增量同步”复用同一实例，无需停服务，见 src/server.js。）
 */
const path = require('path');
const Db = require('../src/database/db');
const { syncCategories } = require('../src/sync/categorySync');

const maxPages = parseInt(process.argv[2] || '0') || Infinity; // 0/缺省 = 全部

async function main() {
  const db = new Db(path.join(__dirname, '..', 'database.db'));
  await db.ready;

  const { perCat, totalNew, total } = await syncCategories(db, {
    maxPages,
    log: (msg) => console.log(msg)
  });

  console.log('\n========== 同步汇总 ==========');
  for (const [name, s] of Object.entries(perCat)) {
    console.log(`${name}: ${s.pages} 页，新增 ${s.added}，归类 ${s.linked}`);
  }
  console.log(`本次新增 ${totalNew} 部；当前库内动漫总数：${total} 部`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
