// 云函数 notification — 通知管理
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloudbase-0gx2xhccf8b7742d' })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { action } = event
  try {
    const { OPENID } = cloud.getWXContext()

    if (action === 'getNotifications') {
      // 同时兼容新版驼峰字段（targetUserId）和旧版下划线字段（receiver_id）
      var result = []
      try {
        var q1 = await db.collection('notifications')
          .where(_.or([
            { targetUserId: OPENID, status: _.neq('deleted') },
            { receiver_id: OPENID, status: _.neq('deleted') },
            { targetUserId: OPENID, status: _.exists(false) },
            { receiver_id: OPENID, status: _.exists(false) }
          ]))
          .orderBy('createdAt', 'desc')
          .limit(50)
          .get()
        result = q1.data
      } catch (e) {
        console.warn('[getNotifications] 联合查询失败，回退单查:', e)
        try {
          var r2 = await db.collection('notifications')
            .where({ targetUserId: OPENID })
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get()
          result = r2.data
        } catch (e2) {}
        try {
          var r3 = await db.collection('notifications')
            .where({ receiver_id: OPENID })
            .orderBy('created_at', 'desc')
            .limit(50)
            .get()
          result = result.concat(r3.data)
        } catch (e3) {}
      }

      // 字段标准化：前端只看驼峰字段
      var normalized = result
        .filter(function(item) { return item.status !== 'deleted' })
        .map(function(item) {
          return {
            _id: item._id,
            type: item.type || '',
            actorUserId: item.actorUserId || item.sender_id || '',
            actorName: item.actorName || '某用户',
            actorAvatar: item.actorAvatar || '',
            postId: item.postId || item.target_id || '',
            imageId: item.imageId || '',
            commentId: item.commentId || '',
            contentPreview: item.contentPreview || '',
            isRead: item.isRead !== undefined ? item.isRead : (item.is_read || false),
            createdAt: item.createdAt || item.created_at || new Date(0)
          }
        })

      // 去重（同 _id 只保留一条）
      var seen = {}
      var dedup = []
      for (var i = 0; i < normalized.length; i++) {
        var id = normalized[i]._id
        if (seen[id]) continue
        seen[id] = true
        dedup.push(normalized[i])
      }

      console.log('[getNotifications] 查到', dedup.length, '条')

      var unreadCount = 0
      for (var j = 0; j < dedup.length; j++) {
        if (!dedup[j].isRead) unreadCount++
      }

      return { code: 0, notifications: dedup, unreadCount: unreadCount }
    }

    if (action === 'markAsRead') {
      const { notificationId } = event
      if (!notificationId) return { code: -1, message: 'missing notificationId' }

      await db.collection('notifications').doc(notificationId).update({
        data: { isRead: true, is_read: true, updatedAt: db.serverDate() }
      })
      return { code: 0, message: 'ok' }
    }

    if (action === 'markAllAsRead') {
      // 联合查询所有我接收的非 deleted 通知
      var r = await db.collection('notifications')
        .where(_.or([
          { targetUserId: OPENID, status: _.neq('deleted') },
          { targetUserId: OPENID, status: _.exists(false) },
          { receiver_id: OPENID, status: _.neq('deleted') },
          { receiver_id: OPENID, status: _.exists(false) }
        ]))
        .limit(200)
        .get()

      // 去重并过滤未读
      var seen = {}
      var unreadIds = []
      r.data.forEach(function(item) {
        if (seen[item._id]) return
        seen[item._id] = true
        if (item.isRead !== true && item.is_read !== true) {
          unreadIds.push(item._id)
        }
      })

      console.log('[markAllAsRead] 待更新:', unreadIds.length)

      // 逐条更新双字段
      var updated = 0
      for (var i = 0; i < unreadIds.length; i++) {
        try {
          await db.collection('notifications').doc(unreadIds[i]).update({
            data: { isRead: true, is_read: true, updatedAt: db.serverDate() }
          })
          updated++
        } catch (e) {
          console.warn('[markAllAsRead] 跳过', unreadIds[i], e.message)
        }
      }

      console.log('[markAllAsRead] 实际更新:', updated)
      return { code: 0, updated: updated }
    }

    if (action === 'deleteNotification') {
      const { notificationId } = event
      if (!notificationId) return { code: -1, message: 'missing notificationId' }

      // 软删除
      await db.collection('notifications').doc(notificationId).update({
        data: { status: 'deleted' }
      })
      return { code: 0, message: 'ok' }
    }

    if (action === 'getUnreadCount') {
      // 查所有我接收的非 deleted 通知
      var r = await db.collection('notifications')
        .where(_.or([
          { targetUserId: OPENID, status: _.neq('deleted') },
          { targetUserId: OPENID, status: _.exists(false) },
          { receiver_id: OPENID, status: _.neq('deleted') },
          { receiver_id: OPENID, status: _.exists(false) }
        ]))
        .limit(200)
        .get()

      // 去重 _id
      var seen = {}
      var unique = r.data.filter(function(item) {
        if (seen[item._id]) return false
        seen[item._id] = true
        return true
      })

      // 未读判定：两个字段都不为 true 才算未读
      var unreadList = unique.filter(function(item) {
        var newRead = item.isRead === true
        var oldRead = item.is_read === true
        return !newRead && !oldRead
      })

      console.log('[getUnreadCount] 总:', unique.length, '未读:', unreadList.length, 'OPENID:', OPENID)
      return { code: 0, unreadCount: unreadList.length }
    }

    if (action === 'addNotification') {
      var { receiverId, type, postId, contentPreview, actorName, actorAvatar } = event
      if (!receiverId) return { code: -1, message: 'missing receiverId' }
      if (receiverId === OPENID) return { code: 0, message: '自己的操作不通知' }

      await db.collection('notifications').add({
        data: {
          actorUserId: OPENID,
          targetUserId: receiverId,
          actorName: actorName || '',
          actorAvatar: actorAvatar || '',
          type: type || '',
          postId: postId || '',
          contentPreview: contentPreview || '',
          isRead: false,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
      return { code: 0, message: 'ok' }
    }

    return { code: -1, message: 'unknown action: ' + action }
  } catch (err) {
    console.error('[notification]', err)
    return { code: -1, message: err.message }
  }
}
