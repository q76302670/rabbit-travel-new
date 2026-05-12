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

    const usersRes = await db.collection('users').orderBy('created_at', 'desc').limit(50).get()
    const journalsRes = await db.collection('journals').where({ status: 'published' }).get()

    // 统计每个用户的游记数
    const journalCounts = {}
    journalsRes.data.forEach(j => { journalCounts[j.author_id] = (journalCounts[j.author_id] || 0) + 1 })

    const users = usersRes.data.map(u => ({
      _id: u.openid || u._id,
      nickname: u.nickname || '未知',
      avatar: u.avatar || '',
      created_at: u.created_at || '',
      journalCount: journalCounts[u.openid] || 0
    }))

    return { code: 0, users }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}
