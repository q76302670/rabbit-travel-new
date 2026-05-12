const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloudbase-0gx2xhccf8b7742d' })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { OPENID } = cloud.getWXContext()
    const journal = event.journal || {}
    console.log('[saveJournal] 接收到 photos[0]:', JSON.stringify(journal.photos && journal.photos[0]))

    // 草稿允许标题或照片为空
    if (journal.status !== 'draft') {
      if (!journal.title || !journal.photos || journal.photos.length === 0) {
        return { code: -1, message: '标题和照片不能为空' }
      }
    }

    journal.author_id = OPENID
    journal.updated_at = new Date().toISOString()

    if (journal._id) {
      const id = journal._id
      delete journal._id

      // 校验 ownership：只允许作者更新自己的文档
      const doc = await db.collection('journals').doc(id).get()
      if (!doc.data || doc.data.author_id !== OPENID) {
        return { code: -1, message: '无权限' }
      }

      await db.collection('journals').doc(id).update({ data: journal })
      return { code: 0, _id: id }
    } else {
      journal.created_at = new Date().toISOString()
      const result = await db.collection('journals').add({ data: journal })
      return { code: 0, _id: result._id }
    }
  } catch (e) {
    console.error('[saveJournal]', e)
    return { code: -1, message: e.message }
  }
}
