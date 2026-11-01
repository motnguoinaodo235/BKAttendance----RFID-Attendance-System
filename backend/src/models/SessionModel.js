const db = require('../config/db');

class SessionModel {
  // Lấy tất cả buổi học (hỗ trợ lọc theo classId, date)
  static async getAll(filters = {}) {
    let query = `
      SELECT 
        s.session_id,
        s.class_id,
        c.class_name,
        u.name as lecturer_name,
        DATE_FORMAT(s.session_date, '%Y-%m-%d') as session_date,
        s.start_time,
        s.end_time,
        s.late_threshold,
        (SELECT COUNT(*) FROM class_students cs WHERE cs.class_id = s.class_id) as total_students,
        (SELECT COUNT(*) FROM attendance_logs al WHERE al.session_id = s.session_id AND al.status IN ('Present', 'Late')) as attended_students
      FROM sessions s
      JOIN classes c ON s.class_id = c.class_id
      JOIN lecturers l ON c.lecturer_id = l.lecturer_id
      JOIN users u ON l.user_id = u.user_id
      WHERE 1=1
    `;
    const params = [];

    if (filters.classId) {
      query += ` AND s.class_id = ?`;
      params.push(filters.classId);
    }
    if (filters.date) {
      query += ` AND s.session_date = ?`;
      params.push(filters.date);
    }

    query += ` ORDER BY s.session_date DESC, s.start_time ASC`;
    const [rows] = await db.execute(query, params);
    return rows;
  }

  // Lấy danh sách các buổi học diễn ra trong ngày hôm nay
  static async getToday() {
    const query = `
      SELECT 
        s.session_id,
        s.class_id,
        c.class_name,
        u.name as lecturer_name,
        DATE_FORMAT(s.session_date, '%Y-%m-%d') as session_date,
        s.start_time,
        s.end_time,
        s.late_threshold,
        (SELECT COUNT(*) FROM class_students cs WHERE cs.class_id = s.class_id) as total_students,
        (SELECT COUNT(*) FROM attendance_logs al WHERE al.session_id = s.session_id AND al.status IN ('Present', 'Late')) as attended_students,
        CASE 
          WHEN CURTIME() < s.start_time THEN 'UPCOMING'
          WHEN CURTIME() BETWEEN s.start_time AND s.end_time THEN 'ONGOING'
          ELSE 'FINISHED'
        END as status
      FROM sessions s
      JOIN classes c ON s.class_id = c.class_id
      JOIN lecturers l ON c.lecturer_id = l.lecturer_id
      JOIN users u ON l.user_id = u.user_id
      WHERE s.session_date = CURDATE()
      ORDER BY s.start_time ASC
    `;
    const [rows] = await db.execute(query);
    return rows;
  }

  // Lấy buổi học đang diễn ra trong thời điểm hiện tại
  static async getActiveSession() {
    const query = `
      SELECT 
        s.session_id,
        s.class_id,
        c.class_name,
        u.name as lecturer_name,
        DATE_FORMAT(s.session_date, '%Y-%m-%d') as session_date,
        s.start_time,
        s.end_time,
        s.late_threshold,
        (SELECT COUNT(*) FROM class_students cs WHERE cs.class_id = s.class_id) as total_students
      FROM sessions s
      JOIN classes c ON s.class_id = c.class_id
      JOIN lecturers l ON c.lecturer_id = l.lecturer_id
      JOIN users u ON l.user_id = u.user_id
      WHERE s.session_date = CURDATE() 
        AND CURTIME() BETWEEN s.start_time AND s.end_time
      ORDER BY s.start_time ASC
      LIMIT 1
    `;
    const [rows] = await db.execute(query);
    return rows.length > 0 ? rows[0] : null;
  }

  // Lấy chi tiết 1 buổi học theo ID
  static async getById(sessionId) {
    const query = `
      SELECT 
        s.session_id,
        s.class_id,
        c.class_name,
        u.name as lecturer_name,
        DATE_FORMAT(s.session_date, '%Y-%m-%d') as session_date,
        s.start_time,
        s.end_time,
        s.late_threshold
      FROM sessions s
      JOIN classes c ON s.class_id = c.class_id
      JOIN lecturers l ON c.lecturer_id = l.lecturer_id
      JOIN users u ON l.user_id = u.user_id
      WHERE s.session_id = ?
    `;
    const [rows] = await db.execute(query, [sessionId]);
    return rows.length > 0 ? rows[0] : null;
  }

  // Thêm buổi học mới
  static async create({ class_id, session_date, start_time, end_time, late_threshold }) {
    // Nếu late_threshold không truyền, mặc định sau 15 phút từ giờ bắt đầu
    const late = late_threshold || start_time;
    const query = `
      INSERT INTO sessions (class_id, session_date, start_time, end_time, late_threshold)
      VALUES (?, ?, ?, ?, ?)
    `;
    const [result] = await db.execute(query, [class_id, session_date, start_time, end_time, late]);
    return { session_id: result.insertId };
  }

  // Cập nhật buổi học
  static async update(sessionId, { class_id, session_date, start_time, end_time, late_threshold }) {
    const query = `
      UPDATE sessions 
      SET class_id = ?, session_date = ?, start_time = ?, end_time = ?, late_threshold = ?
      WHERE session_id = ?
    `;
    const [result] = await db.execute(query, [class_id, session_date, start_time, end_time, late_threshold, sessionId]);
    return result.affectedRows > 0;
  }

  // Xóa buổi học
  static async delete(sessionId) {
    const query = `DELETE FROM sessions WHERE session_id = ?`;
    const [result] = await db.execute(query, [sessionId]);
    return result.affectedRows > 0;
  }
}

module.exports = SessionModel;
