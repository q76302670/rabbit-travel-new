const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloudbase-0gx2xhccf8b7742d' })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { OPENID } = cloud.getWXContext()
    const adminUser = await db.collection('users').where({ openid: OPENID }).get()
    if (!adminUser.data.length || !adminUser.data[0].is_admin) {
      return { code: -1, message: '无权限' }
    }

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayStr = todayStart.toISOString()

    const [totalUsers, totalJournals, todayUsers, todayJournals] = await Promise.all([
      db.collection('users').count(),
      db.collection('journals').where({ status: 'published' }).count(),
      db.collection('users').where({ created_at: db.command.gte(todayStr) }).count(),
      db.collection('journals').where({ published_at: db.command.gte(todayStr) }).count()
    ])

    return { code: 0, stats: { totalUsers: totalUsers.total, totalJournals: totalJournals.total, todayUsers: todayUsers.total, todayJournals: todayJournals.total } }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}
