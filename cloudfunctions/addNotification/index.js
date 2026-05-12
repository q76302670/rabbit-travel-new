const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloudbase-0gx2xhccf8b7742d' })
const db = cloud.database()

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext()
    const {
      // 新版参数名
      receiverId,
      // 兼容旧版参数名
      receiver_id,
      targetId,
      target_id,
      targetType,
      target_type,
      type,
      journalId,
      journal_id,
      contentPreview = '',
      commentId = '',
      parentCommentId = '',
      imageId = ''
    } = event

    const finalReceiverId = receiverId || receiver_id
    const finalTargetId = targetId || target_id
    const finalTargetType = targetType || target_type

    if (!finalReceiverId) return { code: -1, message: '缺少接收人' }
    if (finalReceiverId === OPENID) return { code: 0, skip: true } // 自己给自己不通知

    // 查触发者信息
    var actorName = ''
    var actorAvatar = ''
    try {
      var actorRes = await db.collection('users')
        .where({ openid: OPENID })
        .limit(1)
        .get()
      if (actorRes.data.length > 0) {
        actorName = actorRes.data[0].nickname || ''
        actorAvatar = actorRes.data[0].avatar || ''
      }
    } catch (e) {
      console.warn('[addNotification] 查询触发者失败:', e)
    }

    // postId：如果 targetType 是 journal，直接用 targetId；其他类型暂用 targetId
    var postId = journalId || journal_id || finalTargetId || ''

    var notificationData = {
      // 新版驼峰字段
      targetUserId: finalReceiverId,
      actorUserId: OPENID,
      actorName: actorName,
      actorAvatar: actorAvatar,
      type: type,
      postId: postId,
      imageId: imageId,
      commentId: commentId,
      parentCommentId: parentCommentId,
      contentPreview: contentPreview,
      isRead: false,
      status: 'active',
      createdAt: db.serverDate(),
      updatedAt: db.serverDate(),
      // 老版下划线字段保留（向后兼容，旧调用方读老字段也能拿到值）
      receiver_id: finalReceiverId,
      sender_id: OPENID,
      target_id: finalTargetId,
      target_type: finalTargetType,
      journal_id: journalId || '',
      is_read: false,
      created_at: new Date().toISOString()
    }

    await db.collection('notifications').add({ data: notificationData })

    return { code: 0 }
  } catch (e) {
    console.error('[addNotification]', e)
    return { code: -1, message: e.message }
  }
}
