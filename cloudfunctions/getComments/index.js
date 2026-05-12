const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { journalId } = event
    const result = await db.collection('comments')
      .where({ journal_id: journalId })
      .orderBy('created_at', 'asc')
      .limit(50)
      .get()
    return { code: 0, comments: result.data }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}
