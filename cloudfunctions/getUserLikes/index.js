const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloudbase-0gx2xhccf8b7742d' })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { OPENID } = cloud.getWXContext()
    const { type } = event

    const likesRes = await db.collection('likes')
      .where({ openid: OPENID, target_type: type })
      .orderBy('created_at', 'desc')
      .get()

    const journalIds = likesRes.data.map(l => l.target_id)
    if (journalIds.length === 0) return { code: 0, journals: [] }

    const journalsRes = await db.collection('journals')
      .where({ _id: db.command.in(journalIds), status: 'published' })
      .get()

    return { code: 0, journals: journalsRes.data }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}
