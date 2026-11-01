const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const attendanceController = require('../controllers/attendanceController');

// GET /api/classes/lecturer?lecturerId=...
router.get('/lecturer', attendanceController.getClasses);

// GET /api/classes - Lấy tất cả lớp
router.get('/', classController.getAllClasses);

// GET /api/classes/:id - Chi tiết lớp học
router.get('/:id', classController.getClassById);

// GET /api/classes/:id/students - Danh sách sinh viên thuộc lớp
router.get('/:id/students', classController.getClassStudents);

// POST /api/classes/:id/students - Thêm sinh viên vào lớp
router.post('/:id/students', classController.addStudentToClass);

// DELETE /api/classes/:id/students/:studentId - Xóa sinh viên khỏi lớp
router.delete('/:id/students/:studentId', classController.removeStudentFromClass);

// GET /api/classes/:id/available-students - Danh sách sinh viên chưa thuộc lớp (để chọn thêm vào lớp)
router.get('/:id/available-students', classController.getAvailableStudents);

module.exports = router;
