const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloudbase-0gx2xhccf8b7742d' })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { OPENID } = cloud.getWXContext()
    const { userId, type = 'published' } = event

    const targetId = userId || OPENID
    const isSelf = targetId === OPENID

    let query = db.collection('journals').where({ author_id: targetId })

    if (type === 'published') {
      query = query.where({ status: 'published' })
    } else if (type === 'draft') {
      if (!isSelf) return { code: -1, message: '无权限' }
      query = query.where({ status: 'draft' })
    }

    const result = await query
      .orderBy('updated_at', 'desc')
      .limit(50)
      .get()

    return { code: 0, journals: result.data }
  } catch (e) {
    console.error('[getUserJournals]', e)
    return { code: -1, message: e.message }
  }
}
