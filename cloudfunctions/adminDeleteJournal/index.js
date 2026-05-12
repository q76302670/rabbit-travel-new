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

    const { journalId } = event
    await db.collection('journals').doc(journalId).remove()
    return { code: 0 }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}
