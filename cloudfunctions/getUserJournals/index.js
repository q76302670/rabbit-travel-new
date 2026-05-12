const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloudbase-0gx2xhccf8b7742d' })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { OPENID } = cloud.getWXContext()
    const { type = 'published' } = event

    const query = { author_id: OPENID }
    if (type === 'published') {
      query.status = 'published'
    } else if (type === 'draft') {
      query.status = 'draft'
    }

    const result = await db.collection('journals')
      .where(query)
      .orderBy('updated_at', 'desc')
      .limit(50)
      .get()

    return { code: 0, journals: result.data }
  } catch (e) {
    console.error('[getUserJournals]', e)
    return { code: -1, message: e.message }
  }
}
