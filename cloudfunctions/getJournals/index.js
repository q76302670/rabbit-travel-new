// 云函数 getJournals — 获取已发布游记列表
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { page = 1, pageSize = 10 } = event
    const skip = (page - 1) * pageSize

    const result = await db.collection('journals')
      .where({ status: 'published' })
      .orderBy('published_at', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()

    return { code: 0, journals: result.data, total: result.data.length }
  } catch (e) {
    console.error('[getJournals]', e)
    return { code: -1, message: e.message }
  }
}
