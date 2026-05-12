// 云函数 parseExif
const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()

exports.main = async (event, context) => {
  const { action } = event
  try {
    // TODO: 实现业务逻辑
    return { success: true, message: 'parseExif 云函数骨架' }
  } catch (err) {
    return { success: false, error: err.message }
  }
}
