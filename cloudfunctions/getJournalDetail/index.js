// 云函数 getJournalDetail — 获取单篇游记详情
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { journalId } = event
    if (!journalId) return { code: -1, message: 'journalId 为空' }

    const result = await db.collection('journals').doc(journalId).get()
    return { code: 0, journal: result.data }
  } catch (e) {
    console.error('[getJournalDetail]', e)
    return { code: -1, message: e.message }
  }
}
