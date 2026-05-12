const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloudbase-0gx2xhccf8b7742d' })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    const { OPENID } = cloud.getWXContext()
    const { targetId, targetType } = event

    const likesCol = db.collection('likes')
    const existing = await likesCol
      .where({ openid: OPENID, target_id: targetId, target_type: targetType })
      .limit(1).get()

    if (existing.data.length > 0) {
      await likesCol.doc(existing.data[0]._id).remove()
      if (targetType === 'journal') {
        try {
          await db.collection('journals').doc(targetId)
            .update({ data: { like_count: _.inc(-1) } })
        } catch (e) {
          console.warn('[toggleLike] 更新失败:', e.message)
        }
      }
      return { code: 0, isLiked: false }
    } else {
      await likesCol.add({
        data: {
          openid: OPENID,
          target_id: targetId,
          target_type: targetType,
          created_at: new Date().toISOString()
        }
      })
      if (targetType === 'journal') {
        try {
          await db.collection('journals').doc(targetId)
            .update({ data: { like_count: _.inc(1) } })
        } catch (e) {
          console.warn('[toggleLike] 更新失败:', e.message)
        }
      }
      return { code: 0, isLiked: true }
    }
  } catch (e) {
    console.error('[toggleLike]', e)
    return { code: -1, message: e.message }
  }
}
