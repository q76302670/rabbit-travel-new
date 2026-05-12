// 云函数 comment — 评论管理（支持一级评论 + 二级回复）
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloudbase-0gx2xhccf8b7742d' })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { action } = event
  try {
    const { OPENID } = cloud.getWXContext()

    if (action === 'addComment') {
      console.log('[addComment] 收到参数:', JSON.stringify(event))
      var OPENID2 = cloud.getWXContext().OPENID
      console.log('[addComment] OPENID:', OPENID2)

      var journalId = event.journalId
      var imageId = event.imageId || ''
      var content = event.content
      var parentCommentId = event.parentCommentId || ''
      var replyToUserId = event.replyToUserId || ''
      var replyToUserName = event.replyToUserName || ''

      if (!content || !content.trim()) {
        return { code: -1, message: '评论内容不能为空' }
      }

      // 查评论者信息
      const userRes = await db.collection('users')
        .where({ openid: OPENID }).limit(1).get()
      const user = userRes.data[0] || {}

      const newComment = {
        journal_id: journalId,
        image_id: imageId,
        author_id: OPENID,
        author_name: user.nickname || '匿名',
        author_avatar: user.avatar || '',
        content: content.trim(),
        parentCommentId,
        replyToUserId,
        replyToUserName,
        created_at: new Date().toISOString(),
        status: 'active'
      }

      const addRes = await db.collection('comments').add({ data: newComment })

      // 同步更新游记 comment_count
      try {
        await db.collection('journals').doc(journalId).update({
          data: { comment_count: _.inc(1) }
        })
      } catch(e) { console.warn('[comment] 更新 comment_count 失败:', e.message) }

      return {
        code: 0,
        comment: { _id: addRes._id, ...newComment }
      }
    }

    if (action === 'getComments') {
      var journalId2 = event.journalId
      console.log('[getComments] journalId:', journalId2)

      // 查该游记下所有评论
      const allRes = await db.collection('comments')
        .where({
          journal_id: journalId2,
          status: 'active'
        })
        .orderBy('created_at', 'asc')
        .get()

      // 拆分一级和二级
      const allTopLevel = []
      const childrenMap = {}

      allRes.data.forEach(c => {
        if (!c.parentCommentId) {
          allTopLevel.push({ ...c, replies: [] })
        } else {
          if (!childrenMap[c.parentCommentId]) {
            childrenMap[c.parentCommentId] = []
          }
          childrenMap[c.parentCommentId].push(c)
        }
      })

      // 挂载子评论
      allTopLevel.forEach(top => {
        top.replies = childrenMap[top._id] || []
        top.repliesCount = top.replies.length
      })

      // 按 image_id 分类：游记级 vs 节点级
      const journalComments = []
      const nodeCommentsMap = {}

      allTopLevel.forEach(c => {
        var imageId = c.image_id || ''
        if (!imageId) {
          journalComments.push(c)
        } else {
          if (!nodeCommentsMap[imageId]) nodeCommentsMap[imageId] = []
          nodeCommentsMap[imageId].push(c)
        }
      })

      console.log('[getComments] journalId:', journalId2, '游记级:', journalComments.length, '节点级:', Object.keys(nodeCommentsMap).length)

      return { code: 0, journalComments: journalComments, nodeCommentsMap: nodeCommentsMap }
    }

    if (action === 'likeNode') {
      if (!event) return { code: -1, message: 'invalid event' }
      var nodeId = event.nodeId
      var journalId = event.journalId
      if (!nodeId) return { code: -1, message: 'missing nodeId' }

      // 查是否已点赞
      const existing = await db.collection('node_likes')
        .where({ node_id: nodeId, user_id: OPENID })
        .limit(1)
        .get()

      if (existing.data.length > 0) {
        // 已点赞 → 取消
        await db.collection('node_likes').doc(existing.data[0]._id).remove()
        const countRes = await db.collection('node_likes')
          .where({ node_id: nodeId }).count()
        return { code: 0, isLiked: false, likeCount: countRes.total }
      } else {
        // 未点赞 → 添加
        await db.collection('node_likes').add({
          data: { node_id: nodeId, journal_id: journalId, user_id: OPENID, created_at: new Date().toISOString() }
        })
        const countRes = await db.collection('node_likes')
          .where({ node_id: nodeId }).count()
        return { code: 0, isLiked: true, likeCount: countRes.total }
      }
    }

    if (action === 'getNodeLikeStatus') {
      if (!event || !event.nodeIds) return { code: 0, statusMap: {} }
      var nodeIds = event.nodeIds
      var journalId = event.journalId || ''
      if (!Array.isArray(nodeIds)) return { code: -1, message: 'invalid nodeIds' }

      // 批量查当前用户对所有节点的点赞状态
      const myLikesResult = await db.collection('node_likes')
        .where({ node_id: _.in(nodeIds), user_id: OPENID })
        .get()

      const myLikedIds = {}
      myLikesResult.data.forEach(function(l) { myLikedIds[l.node_id] = true })

      // 批量查每个节点的点赞总数
      const statusMap = {}
      for (var i = 0; i < nodeIds.length; i++) {
        var id = nodeIds[i]
        var cntRes = await db.collection('node_likes')
          .where({ node_id: id }).count()
        statusMap[id] = {
          isLiked: !!myLikedIds[id],
          likeCount: cntRes.total
        }
      }

      return { code: 0, statusMap: statusMap }
    }

    return { code: -1, message: 'unknown action: ' + action }
  } catch (err) {
    console.error('[comment]', err)
    return { code: -1, message: err.message }
  }
}
