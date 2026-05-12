const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloudbase-0gx2xhccf8b7742d' })
const db = cloud.database()

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext()
    const { targetUserId } = event

    const result = await db.collection('follows')
      .where({ follower_id: OPENID, following_id: targetUserId })
      .limit(1).get()

    return { code: 0, isFollowing: result.data.length > 0 }
  } catch (e) {
    return { code: -1, isFollowing: false, message: e.message }
  }
}
