const db = require('../config/db');

class ClassModel {
  // Lấy tất cả lớp học
  static async getAllClasses() {
    const query = `
      SELECT 
        c.class_id as id,
        c.class_name as name,
        u.name as lecturer,
        l.lecturer_id,
        (SELECT COUNT(*) FROM class_students cs WHERE cs.class_id = c.class_id) as students,
        (SELECT COUNT(*) FROM sessions s WHERE s.class_id = c.class_id) as total_sessions
      FROM classes c
      JOIN lecturers l ON c.lecturer_id = l.lecturer_id
      JOIN users u ON l.user_id = u.user_id
      ORDER BY c.class_id ASC
    `;
    const [rows] = await db.execute(query);
    return rows.map(r => ({
      ...r,
      time: 'Theo lịch học',
      status: 'active'
    }));
  }

  // Lấy chi tiết 1 lớp học
  static async getClassById(classId) {
    const query = `
      SELECT 
        c.class_id as id,
        c.class_name as name,
        u.name as lecturer,
        l.lecturer_id,
        (SELECT COUNT(*) FROM class_students cs WHERE cs.class_id = c.class_id) as students
      FROM classes c
      JOIN lecturers l ON c.lecturer_id = l.lecturer_id
      JOIN users u ON l.user_id = u.user_id
      WHERE c.class_id = ?
    `;
    const [rows] = await db.execute(query, [classId]);
    return rows.length > 0 ? rows[0] : null;
  }

  // Lấy danh sách sinh viên thuộc lớp học kèm số liệu chuyên cần
  static async getStudentsByClassId(classId) {
    const query = `
      SELECT 
        s.student_id,
        s.student_code,
        s.name,
        r.rfid_uid,
        (SELECT COUNT(*) FROM attendance_logs al 
         JOIN sessions sess ON al.session_id = sess.session_id 
         WHERE sess.class_id = ? AND al.student_id = s.student_id AND al.status = 'Present') as present_count,
        (SELECT COUNT(*) FROM attendance_logs al 
         JOIN sessions sess ON al.session_id = sess.session_id 
         WHERE sess.class_id = ? AND al.student_id = s.student_id AND al.status = 'Late') as late_count,
        (SELECT COUNT(*) FROM attendance_logs al 
         JOIN sessions sess ON al.session_id = sess.session_id 
         WHERE sess.class_id = ? AND al.student_id = s.student_id AND al.status = 'Absent') as absent_count
      FROM class_students cs
      JOIN students s ON cs.student_id = s.student_id
      LEFT JOIN rfid_cards r ON s.student_id = r.student_id
      WHERE cs.class_id = ?
      ORDER BY s.student_code ASC
    `;
    const [rows] = await db.execute(query, [classId, classId, classId, classId]);
    return rows;
  }

  // Thêm 1 sinh viên vào lớp
  static async addStudentToClass(classId, studentId) {
    const query = `INSERT IGNORE INTO class_students (class_id, student_id) VALUES (?, ?)`;
    const [result] = await db.execute(query, [classId, studentId]);
    return result.affectedRows > 0;
  }

  // Thêm nhiều sinh viên vào lớp (bulk add)
  static async addMultipleStudentsToClass(classId, studentIds) {
    if (!studentIds || studentIds.length === 0) return 0;
    const values = studentIds.map(id => `(${db.escape(classId)}, ${db.escape(id)})`).join(', ');
    const query = `INSERT IGNORE INTO class_students (class_id, student_id) VALUES ${values}`;
    const [result] = await db.query(query);
    return result.affectedRows;
  }

  // Xóa sinh viên khỏi lớp
  static async removeStudentFromClass(classId, studentId) {
    const query = `DELETE FROM class_students WHERE class_id = ? AND student_id = ?`;
    const [result] = await db.execute(query, [classId, studentId]);
    return result.affectedRows > 0;
  }

  // Lấy danh sách các sinh viên chưa được thêm vào lớp này (để chọn thêm vào lớp)
  static async getAvailableStudents(classId) {
    const query = `
      SELECT 
        s.student_id,
        s.student_code,
        s.name,
        r.rfid_uid
      FROM students s
      LEFT JOIN rfid_cards r ON s.student_id = r.student_id
      WHERE s.student_id NOT IN (
        SELECT student_id FROM class_students WHERE class_id = ?
      )
      ORDER BY s.student_code ASC
    `;
    const [rows] = await db.execute(query, [classId]);
    return rows;
  }
}

module.exports = ClassModel;
