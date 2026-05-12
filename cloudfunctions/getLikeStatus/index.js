const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { OPENID } = cloud.getWXContext()
    const { journalId } = event

    const [likeRes, collectRes] = await Promise.all([
      db.collection('likes')
        .where({ openid: OPENID, target_id: journalId, target_type: 'journal' })
        .limit(1).get(),
      db.collection('likes')
        .where({ openid: OPENID, target_id: journalId, target_type: 'collect' })
        .limit(1).get()
    ])

    return {
      code: 0,
      isLiked: likeRes.data.length > 0,
      isCollected: collectRes.data.length > 0
    }
  } catch (e) {
    return { code: -1, isLiked: false, isCollected: false }
  }
}
