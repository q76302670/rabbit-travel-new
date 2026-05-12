const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloudbase-0gx2xhccf8b7742d' })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    const { OPENID } = cloud.getWXContext()
    const { journalId } = event

    console.log('[toggleCollect] openid:', OPENID, 'journalId:', journalId)

    const col = db.collection('likes')
    const existing = await col
      .where({ openid: OPENID, target_id: journalId, target_type: 'collect' })
      .limit(1).get()

    console.log('[toggleCollect] 已有记录:', existing.data.length)

    if (existing.data.length > 0) {
      await col.doc(existing.data[0]._id).remove()
      try {
        await db.collection('journals').doc(journalId)
          .update({ data: { collect_count: _.inc(-1) } })
      } catch (e) {
        console.warn('[toggleCollect] 更新失败:', e.message)
      }
      return { code: 0, isCollected: false }
    } else {
      await col.add({
        data: {
          openid: OPENID,
          target_id: journalId,
          target_type: 'collect',
          created_at: new Date().toISOString()
        }
      })
      try {
        await db.collection('journals').doc(journalId)
          .update({ data: { collect_count: _.inc(1) } })
      } catch (e) {
        console.warn('[toggleCollect] 更新失败:', e.message)
      }
      return { code: 0, isCollected: true }
    }
  } catch (e) {
    console.error('[toggleCollect]', e)
    return { code: -1, message: e.message }
  }
}
