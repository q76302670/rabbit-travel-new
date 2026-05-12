const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloudbase-0gx2xhccf8b7742d' })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    // 获取所有评论
    const result = await db.collection('comments').get()
    const comments = result.data
    
    // 按内容分组，保留第一条，删除重复的
    const seen = {}
    let deleted = 0
    
    for (const c of comments) {
      const key = c.journal_id + '|' + c.content + '|' + c.openid
      if (seen[key]) {
        await db.collection('comments').doc(c._id).remove()
        deleted++
      } else {
        seen[key] = true
      }
    }
    
    return { code: 0, total: comments.length, deleted: deleted }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}
