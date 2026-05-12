const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloudbase-0gx2xhccf8b7742d' })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { OPENID } = cloud.getWXContext()
    const { journalId } = event

    const journal = await db.collection('journals').doc(journalId).get()
    if (!journal.data || journal.data.author_id !== OPENID) {
      return { code: -1, message: '无权限' }
    }

    await db.collection('journals').doc(journalId).remove()
    return { code: 0 }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}
