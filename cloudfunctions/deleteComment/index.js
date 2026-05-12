const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloudbase-0gx2xhccf8b7742d' })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    const { OPENID } = cloud.getWXContext()
    const { commentId, journalId } = event

    const comment = await db.collection('comments').doc(commentId).get()
    if (!comment.data || comment.data.openid !== OPENID) {
      return { code: -1, message: '无权限' }
    }

    await db.collection('comments').doc(commentId).remove()
    await db.collection('journals').doc(journalId).update({ data: { comment_count: _.inc(-1) } })

    return { code: 0 }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}
