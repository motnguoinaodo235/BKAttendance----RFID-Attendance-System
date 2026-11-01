const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');

// GET /api/sessions/today - Lấy buổi học hôm nay (đặt trước /:id để tránh bắt nhầm param)
router.get('/today', sessionController.getTodaySessions);

// GET /api/sessions/active - Lấy ca học đang diễn ra
router.get('/active', sessionController.getActiveSession);

// GET /api/sessions - Lấy danh sách tất cả buổi học (?classId=...&date=...)
router.get('/', sessionController.getAllSessions);

// GET /api/sessions/:id - Xem chi tiết 1 buổi học
router.get('/:id', sessionController.getSessionById);

// POST /api/sessions - Thêm buổi học mới
router.post('/', sessionController.createSession);

// PUT /api/sessions/:id - Sửa buổi học
router.put('/:id', sessionController.updateSession);

// DELETE /api/sessions/:id - Xóa buổi học
router.delete('/:id', sessionController.deleteSession);

module.exports = router;

