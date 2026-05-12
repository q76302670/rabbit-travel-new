// 云函数 getAdminJournals — 管理员获取全部游记列表
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { OPENID } = cloud.getWXContext()
    const adminUser = await db.collection('users').where({ openid: OPENID }).get()
    if (!adminUser.data.length || !adminUser.data[0].is_admin) {
      return { code: -1, message: '无权限' }
    }

    // 获取所有游记（不限状态，按更新时间倒序）
    const result = await db.collection('journals')
      .orderBy('updated_at', 'desc')
      .limit(50)
      .get()

    return { code: 0, journals: result.data }
  } catch (e) {
    console.error('[getAdminJournals]', e)
    return { code: -1, message: e.message }
  }
}
