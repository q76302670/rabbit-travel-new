const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloudbase-0gx2xhccf8b7742d' })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext()
    const { targetUserId } = event

    if (!targetUserId) return { code: -1, message: '缺少目标用户' }
    if (targetUserId === OPENID) return { code: -1, message: '不能关注自己' }

    const followsCol = db.collection('follows')

    // 查是否已关注
    const existing = await followsCol
      .where({ follower_id: OPENID, following_id: targetUserId })
      .limit(1).get()

    if (existing.data.length > 0) {
      // 已关注 → 取消
      await followsCol.doc(existing.data[0]._id).remove()
      try {
        await db.collection('users').where({ openid: OPENID }).update({
          data: { following_count: _.inc(-1) }
        })
        await db.collection('users').where({ openid: targetUserId }).update({
          data: { follower_count: _.inc(-1) }
        })
      } catch(e) { console.warn(e) }
      return { code: 0, isFollowing: false }
    } else {
      // 未关注 → 添加
      await followsCol.add({
        data: {
          follower_id: OPENID,
          following_id: targetUserId,
          created_at: new Date().toISOString()
        }
      })
      try {
        await db.collection('users').where({ openid: OPENID }).update({
          data: { following_count: _.inc(1) }
        })
        await db.collection('users').where({ openid: targetUserId }).update({
          data: { follower_count: _.inc(1) }
        })
      } catch(e) { console.warn(e) }
      return { code: 0, isFollowing: true }
    }
  } catch (e) {
    console.error('[toggleFollow]', e)
    return { code: -1, message: e.message }
  }
}
