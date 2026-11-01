const SessionModel = require('../models/SessionModel');
const { executeHardwareSync } = require('./studentController');

exports.getAllSessions = async (req, res) => {
  try {
    const { classId, date } = req.query;
    const sessions = await SessionModel.getAll({ classId, date });
    res.json({ success: true, data: sessions });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách buổi học:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách buổi học.' });
  }
};

exports.getTodaySessions = async (req, res) => {
  try {
    const sessions = await SessionModel.getToday();
    res.json({ success: true, data: sessions });
  } catch (error) {
    console.error('Lỗi khi lấy buổi học hôm nay:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy buổi học trong ngày.' });
  }
};

exports.getActiveSession = async (req, res) => {
  try {
    const session = await SessionModel.getActiveSession();
    res.json({ success: true, data: session });
  } catch (error) {
    console.error('Lỗi khi lấy ca học đang diễn ra:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy ca học hiện tại.' });
  }
};

exports.getSessionById = async (req, res) => {
  try {
    const { id } = req.params;
    const session = await SessionModel.getById(id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy buổi học này.' });
    }
    res.json({ success: true, data: session });
  } catch (error) {
    console.error('Lỗi khi lấy thông tin buổi học:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tìm buổi học.' });
  }
};

exports.createSession = async (req, res) => {
  try {
    const { class_id, session_date, start_time, end_time, late_threshold } = req.body;

    if (!class_id || !session_date || !start_time || !end_time) {
      return res.status(400).json({ 
        success: false, 
        message: 'Lớp học, ngày học, giờ bắt đầu và kết thúc là bắt buộc.' 
      });
    }

    const result = await SessionModel.create({
      class_id,
      session_date,
      start_time,
      end_time,
      late_threshold: late_threshold || start_time
    });

    // Tự động đẩy lịch mới xuống ESP32 qua MQTT ngay lập tức
    executeHardwareSync().catch(err => console.error('[Auto-Sync] Lỗi:', err));

    res.status(201).json({
      success: true,
      message: 'Thêm buổi học thành công và đã tự động đồng bộ xuống phần cứng.',
      data: result
    });
  } catch (error) {
    console.error('Lỗi khi tạo buổi học:', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi khi tạo buổi học.' });
  }
};

exports.updateSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { class_id, session_date, start_time, end_time, late_threshold } = req.body;

    if (!class_id || !session_date || !start_time || !end_time) {
      return res.status(400).json({ 
        success: false, 
        message: 'Lớp học, ngày học, giờ bắt đầu và kết thúc là bắt buộc.' 
      });
    }

    const updated = await SessionModel.update(id, {
      class_id,
      session_date,
      start_time,
      end_time,
      late_threshold: late_threshold || start_time
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy buổi học để cập nhật.' });
    }

    // Tự động đẩy lịch mới xuống ESP32 qua MQTT ngay lập tức
    executeHardwareSync().catch(err => console.error('[Auto-Sync] Lỗi:', err));

    res.json({
      success: true,
      message: 'Cập nhật buổi học thành công và đã tự động đồng bộ xuống phần cứng.'
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật buổi học:', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi khi cập nhật buổi học.' });
  }
};

exports.deleteSession = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await SessionModel.delete(id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy buổi học để xóa.' });
    }

    // Tự động đẩy lịch cập nhật xuống ESP32 qua MQTT
    executeHardwareSync().catch(err => console.error('[Auto-Sync] Lỗi:', err));

    res.json({
      success: true,
      message: 'Xóa buổi học thành công.'
    });
  } catch (error) {
    console.error('Lỗi khi xóa buổi học:', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi khi xóa buổi học.' });
  }
};
