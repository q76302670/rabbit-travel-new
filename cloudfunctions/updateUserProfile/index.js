const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloudbase-0gx2xhccf8b7742d' })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { OPENID } = cloud.getWXContext()
    const { nickname, bio, avatar, tags } = event

    const updateData = { updated_at: new Date().toISOString() }
    if (nickname !== undefined) updateData.nickname = nickname
    if (bio !== undefined) updateData.bio = bio
    if (avatar !== undefined) updateData.avatar = avatar
    if (tags !== undefined) updateData.tags = tags

    await db.collection('users').where({ openid: OPENID }).update({ data: updateData })
    return { code: 0 }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}
