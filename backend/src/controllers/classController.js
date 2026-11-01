const ClassModel = require('../models/ClassModel');

// Lấy tất cả lớp học
exports.getAllClasses = async (req, res) => {
  try {
    const classes = await ClassModel.getAllClasses();
    res.json({ success: true, data: classes });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách lớp học:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách lớp học.' });
  }
};

// Lấy chi tiết 1 lớp học
exports.getClassById = async (req, res) => {
  try {
    const { id } = req.params;
    const classData = await ClassModel.getClassById(id);
    if (!classData) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lớp học này.' });
    }
    res.json({ success: true, data: classData });
  } catch (error) {
    console.error('Lỗi khi lấy thông tin lớp học:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tìm lớp học.' });
  }
};

// Lấy danh sách sinh viên của 1 lớp
exports.getClassStudents = async (req, res) => {
  try {
    const { id } = req.params;
    const students = await ClassModel.getStudentsByClassId(id);
    res.json({ success: true, data: students });
  } catch (error) {
    console.error('Lỗi khi lấy sinh viên trong lớp:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy sinh viên trong lớp.' });
  }
};

// Thêm sinh viên vào lớp
exports.addStudentToClass = async (req, res) => {
  try {
    const { id } = req.params; // classId
    const { studentId, studentIds } = req.body;

    if (Array.isArray(studentIds) && studentIds.length > 0) {
      const count = await ClassModel.addMultipleStudentsToClass(id, studentIds);
      return res.status(201).json({
        success: true,
        message: `Đã thêm ${count} sinh viên vào lớp học.`
      });
    }

    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp studentId.' });
    }

    const added = await ClassModel.addStudentToClass(id, studentId);
    if (!added) {
      return res.status(400).json({ success: false, message: 'Sinh viên đã có trong lớp này từ trước.' });
    }

    res.status(201).json({
      success: true,
      message: 'Thêm sinh viên vào lớp học thành công.'
    });
  } catch (error) {
    console.error('Lỗi khi thêm sinh viên vào lớp:', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi khi thêm sinh viên vào lớp.' });
  }
};

// Xóa sinh viên khỏi lớp
exports.removeStudentFromClass = async (req, res) => {
  try {
    const { id, studentId } = req.params;
    const removed = await ClassModel.removeStudentFromClass(id, studentId);

    if (!removed) {
      return res.status(404).json({ success: false, message: 'Sinh viên không thuộc lớp này.' });
    }

    res.json({
      success: true,
      message: 'Đã xóa sinh viên khỏi lớp học thành công.'
    });
  } catch (error) {
    console.error('Lỗi khi xóa sinh viên khỏi lớp:', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi khi xóa sinh viên khỏi lớp.' });
  }
};

// Lấy danh sách sinh viên chưa có trong lớp (để chọn thêm)
exports.getAvailableStudents = async (req, res) => {
  try {
    const { id } = req.params;
    const students = await ClassModel.getAvailableStudents(id);
    res.json({ success: true, data: students });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách sinh viên khả dụng:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ.' });
  }
};
