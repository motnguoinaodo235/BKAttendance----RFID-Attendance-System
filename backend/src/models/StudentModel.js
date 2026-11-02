const db = require('../config/db');

class StudentModel {
  static async findByRfid(rfidUid) {
    const [rows] = await db.execute(`
      SELECT s.student_id, s.student_code, s.name as student_name
      FROM rfid_cards rc
      JOIN students s ON rc.student_id = s.student_id
      WHERE rc.rfid_uid = ?
    `, [rfidUid]);
    return rows.length > 0 ? rows[0] : null;
  }

  static async getAllWithDetails() {
    const query = `
      SELECT 
        s.student_id as id,
        s.student_code as code,
        s.name,
        GROUP_CONCAT(DISTINCT c.class_name SEPARATOR ', ') as class,
        MIN(cs.class_id) as class_id,
        rc.rfid_uid
      FROM students s
      LEFT JOIN class_students cs ON s.student_id = cs.student_id
      LEFT JOIN classes c ON cs.class_id = c.class_id
      LEFT JOIN rfid_cards rc ON s.student_id = rc.student_id
      GROUP BY s.student_id, s.student_code, s.name, rc.rfid_uid
      ORDER BY s.student_id
    `;
    const [rows] = await db.execute(query);
    return rows;
  }

  static async createStudent(studentCode, name, rfidUid = null, classId = null) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute(
        'INSERT INTO students (student_code, name) VALUES (?, ?)',
        [studentCode.trim(), name.trim()]
      );

      if (rfidUid && rfidUid.trim()) {
        await connection.execute(
          'INSERT INTO rfid_cards (rfid_uid, student_id) VALUES (?, ?)',
          [rfidUid.trim().toUpperCase(), result.insertId]
        );
      }

      if (classId) {
        await connection.execute(
          'INSERT INTO class_students (class_id, student_id) VALUES (?, ?)',
          [classId, result.insertId]
        );
      }

      await connection.commit();
      return { student_id: result.insertId };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async assignRfid(studentId, rfidUid) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [students] = await connection.execute(
        'SELECT student_id FROM students WHERE student_id = ?',
        [studentId]
      );
      if (students.length === 0) {
        throw new Error('Không tìm thấy sinh viên');
      }

      const [cards] = await connection.execute(
        'SELECT card_id FROM rfid_cards WHERE student_id = ?',
        [studentId]
      );
      await connection.execute(
        'DELETE FROM rfid_cards WHERE student_id = ?',
        [studentId]
      );
      await connection.execute(
        'INSERT INTO rfid_cards (rfid_uid, student_id) VALUES (?, ?)',
        [rfidUid.trim().toUpperCase(), studentId]
      );
      await connection.commit();
      return cards.length === 0;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async updateStudent(studentId, studentCode, name, rfidUid = null, classId = undefined) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [students] = await connection.execute(
        'SELECT student_id FROM students WHERE student_id = ?',
        [studentId]
      );
      if (students.length === 0) {
        throw new Error('Không tìm thấy sinh viên');
      }

      await connection.execute(
        'UPDATE students SET student_code = ?, name = ? WHERE student_id = ?',
        [studentCode.trim(), name.trim(), studentId]
      );

      if (classId !== undefined && classId !== null) {
        await connection.execute(
          'INSERT IGNORE INTO class_students (class_id, student_id) VALUES (?, ?)',
          [classId, studentId]
        );
      }

      if (rfidUid !== null) {
        await connection.execute(
          'DELETE FROM rfid_cards WHERE student_id = ?',
          [studentId]
        );
        if (rfidUid.trim()) {
          await connection.execute(
            'INSERT INTO rfid_cards (rfid_uid, student_id) VALUES (?, ?)',
            [rfidUid.trim().toUpperCase(), studentId]
          );
        }
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async deleteStudent(studentId) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        'DELETE FROM rfid_cards WHERE student_id = ?',
        [studentId]
      );
      const [result] = await connection.execute(
        'DELETE FROM students WHERE student_id = ?',
        [studentId]
      );
      if (result.affectedRows === 0) {
        throw new Error('Không tìm thấy sinh viên');
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = StudentModel;
