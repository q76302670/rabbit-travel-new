const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloudbase-0gx2xhccf8b7742d' })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { OPENID } = cloud.getWXContext()
    const { markRead } = event

    const result = await db.collection('notifications')
      .where({ receiver_id: OPENID })
      .orderBy('created_at', 'desc')
      .limit(50)
      .get()

    if (markRead) {
      await Promise.all(
        result.data.filter(n => !n.is_read).map(n =>
          db.collection('notifications').doc(n._id).update({ data: { is_read: true } })
        )
      )
      result.data.forEach(n => { n.is_read = true })
    }

    const unreadCount = result.data.filter(n => !n.is_read).length
    return { code: 0, notifications: result.data, unreadCount }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}
