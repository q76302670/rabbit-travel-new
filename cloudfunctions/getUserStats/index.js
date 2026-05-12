const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloudbase-0gx2xhccf8b7742d' })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { OPENID } = cloud.getWXContext()

    const [publishedRes, draftRes] = await Promise.all([
      db.collection('journals')
        .where({ author_id: OPENID, status: 'published' })
        .count(),
      db.collection('journals')
        .where({ author_id: OPENID, status: 'draft' })
        .count()
    ])

    // 读取已发布游记的 like_count 总和
    const journalsRes = await db.collection('journals')
      .where({ author_id: OPENID, status: 'published' })
      .field({ like_count: true })
      .get()

    const totalLikes = journalsRes.data.reduce(function(sum, j) {
      return sum + (j.like_count || 0)
    }, 0)

    return {
      code: 0,
      journalCount: publishedRes.total,
      draftCount: draftRes.total,
      likeCount: totalLikes
    }
  } catch (e) {
    console.error('[getUserStats]', e)
    return { code: -1, message: e.message }
  }
}
