const StudentModel = require('../models/StudentModel');

exports.createStudent = async (req, res) => {
  const { code, name, rfidUid, classId } = req.body;

  if (!code || !name) {
    return res.status(400).json({ success: false, message: 'Mã sinh viên và tên là bắt buộc' });
  }

  try {
    const result = await StudentModel.createStudent(code, name, rfidUid || null, classId || null);
    res.status(201).json({
      success: true,
      message: 'Thêm sinh viên thành công',
      data: { student_id: result.student_id }
    });
  } catch (error) {
    console.error('Database error in createStudent:', error);
    const message = error.sqlMessage || 'Lỗi máy chủ khi thêm sinh viên';
    res.status(400).json({ success: false, message });
  }
};

exports.getAllStudents = async (req, res) => {
  const students = await StudentModel.getAllWithDetails();
  res.json({ success: true, data: students });
};

// Hàm dùng chung để đẩy dữ liệu lịch học & thẻ xuống ESP32
// Gửi 1 bản ghi cho mỗi (sinh viên, buổi học hôm nay) để ESP32
// có thể chọn đúng ca đang active tại thời điểm quét thẻ.
const executeHardwareSync = async () => {
  const db = require('../config/db');
  const { mqttClient } = require('../../server');

  // Ưu tiên buổi học HÔM NAY; nếu không có thì lấy buổi gần nhất.
  // Mỗi (sinh viên × buổi học hôm nay) cho một hàng riêng biệt để
  // ESP32 tự phát hiện ca đang active khi quét thẻ.
  const [rows] = await db.execute(`
    SELECT
      r.rfid_uid,
      s.student_id,
      s.name,
      c.class_name,
      sess.start_time,
      sess.end_time,
      sess.late_threshold
    FROM rfid_cards r
    JOIN students s ON r.student_id = s.student_id
    JOIN class_students cs ON s.student_id = cs.student_id
    JOIN classes c ON cs.class_id = c.class_id
    JOIN sessions sess ON c.class_id = sess.class_id
    WHERE r.rfid_uid IS NOT NULL
      AND sess.session_date = CURDATE()
    ORDER BY sess.start_time ASC, s.student_id ASC
  `);

  const removeAccents = (str) => {
    if (!str) return str;
    return str.normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/đ/g, 'd').replace(/Đ/g, 'D');
  };

  const payloadArray = rows.map(row => ({
    u: row.rfid_uid,
    i: row.student_id,
    n: removeAccents(row.name),
    c: removeAccents(row.class_name) || "Chua co lop",
    st: typeof row.start_time === 'string' ? row.start_time : (row.start_time ? String(row.start_time) : "00:00:00"),
    et: typeof row.end_time === 'string' ? row.end_time : (row.end_time ? String(row.end_time) : "00:00:00"),
    lt: typeof row.late_threshold === 'string' ? row.late_threshold : (row.late_threshold ? String(row.late_threshold) : "00:00:00")
  }));

  const jsonStr = 'SYNC_DB:' + JSON.stringify(payloadArray);

  // Log chi tiết để debug
  console.log(`[HardwareSync] Chuẩn bị gửi ${payloadArray.length} bản ghi (${new Date().toLocaleTimeString('vi-VN')}):`);
  payloadArray.forEach((p, idx) => {
    console.log(`  [${idx}] UID=${p.u}, ID=${p.i}, Name=${p.n}, Class=${p.c}, St=${p.st}, Et=${p.et}, Lt=${p.lt}`);
  });

  if (mqttClient && mqttClient.connected) {
    mqttClient.publish('test/vinh/mqtt/recv', jsonStr);
    console.log(`[HardwareSync] Đã publish SYNC_DB (${jsonStr.length} bytes) qua MQTT.`);
    return { success: true, count: payloadArray.length };
  }
  return { success: false, message: 'MQTT Broker chưa kết nối.' };
};

exports.executeHardwareSync = executeHardwareSync;

exports.syncHardware = async (req, res) => {
  try {
    const result = await executeHardwareSync();
    if (result.success) {
      res.json({ success: true, message: `Đã đồng bộ ${result.count} thẻ xuống phần cứng.` });
    } else {
      res.status(500).json({ success: false, message: result.message });
    }
  } catch (error) {
    console.error('Lỗi khi đồng bộ phần cứng:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi đồng bộ.' });
  }
};

exports.assignRfid = async (req, res) => {
  const { id } = req.params;
  const { rfidUid } = req.body;

  if (!rfidUid) {
    return res.status(400).json({ success: false, message: 'Thiếu mã RFID' });
  }

  try {
    const isNew = await StudentModel.assignRfid(id, rfidUid);
    res.json({
      success: true,
      message: isNew ? 'Gán thẻ mới thành công' : 'Cập nhật thẻ thành công'
    });
  } catch (error) {
    console.error('Database error in assignRfid:', error);
    res.status(400).json({ success: false, message: error.message || 'Lỗi khi gán thẻ RFID' });
  }
};

exports.updateStudent = async (req, res) => {
  const { id } = req.params;
  const { code, name, rfidUid, classId } = req.body;

  if (!code || !name) {
    return res.status(400).json({ success: false, message: 'Mã sinh viên và tên là bắt buộc' });
  }

  try {
    await StudentModel.updateStudent(id, code, name, rfidUid ?? null, classId ?? null);
    res.json({ success: true, message: 'Cập nhật thông tin sinh viên thành công' });
  } catch (error) {
    console.error('Database error in updateStudent:', error);
    res.status(400).json({ success: false, message: error.message || 'Lỗi khi cập nhật sinh viên' });
  }
};

exports.deleteStudent = async (req, res) => {
  const { id } = req.params;

  try {
    await StudentModel.deleteStudent(id);
    res.json({ success: true, message: 'Xóa sinh viên thành công' });
  } catch (error) {
    console.error('Database error in deleteStudent:', error);
    res.status(400).json({ success: false, message: error.message || 'Lỗi khi xóa sinh viên' });
  }
};
