const API_URL = 'http://localhost:3000/api';

export const login = async (email, password) => {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  return res.json();
};

export const getHistory = async () => {
  const res = await fetch(`${API_URL}/attendance/history`);
  const data = await res.json();
  return data.data || [];
};

export const getClassAttendance = async (classId) => {
  const res = await fetch(`${API_URL}/attendance/class/${classId}`);
  const data = await res.json();
  return data.data || [];
};

export const getOverallStats = async () => {
  const res = await fetch(`${API_URL}/attendance/stats`);
  const data = await res.json();
  return data.data || [];
};

export const getStudents = async () => {
  const res = await fetch(`${API_URL}/students`);
  const data = await res.json();
  return data.data || [];
};

export const getLecturers = async () => {
  const res = await fetch(`${API_URL}/lecturers`);
  const data = await res.json();
  return data.data || [];
};

export const getClasses = async () => {
  const res = await fetch(`${API_URL}/classes`);
  const data = await res.json();
  return data.data || [];
};

export const assignRfid = async (studentId, rfidUid) => {
  const res = await fetch(`${API_URL}/students/${studentId}/rfid`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ rfidUid })
  });
  return res.json();
};

export const createStudent = async (studentData) => {
  const res = await fetch(`${API_URL}/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(studentData)
  });
  return res.json();
};

export const updateStudent = async (studentId, studentData) => {
  const res = await fetch(`${API_URL}/students/${studentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(studentData)
  });
  return res.json();
};

export const deleteStudent = async (studentId) => {
  const res = await fetch(`${API_URL}/students/${studentId}`, {
    method: 'DELETE'
  });
  return res.json();
};

export const createLecturer = async (lecturerData) => {
  const res = await fetch(`${API_URL}/lecturers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lecturerData)
  });
  return res.json();
};

export const updateLecturer = async (userId, lecturerData) => {
  const res = await fetch(`${API_URL}/lecturers/user/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lecturerData)
  });
  return res.json();
};

export const deleteLecturer = async (lecturerId) => {
  const res = await fetch(`${API_URL}/lecturers/${lecturerId}`, {
    method: 'DELETE'
  });
  return res.json();
};

export const formatDateTime = (isoString) => {
  const date = new Date(isoString);
  return date.toLocaleString('vi-VN');
};

export const getStatusClass = (status) => {
  switch (status) {
    case 'Present': return 'valid';
    case 'Late': return 'warning';
    case 'Absent': return 'invalid';
    default: return '';
  }
};

export const getStudentAttendanceHistory = async (studentId, classId = '') => {
  const url = classId 
    ? `${API_URL}/attendance/student/${studentId}?classId=${classId}` 
    : `${API_URL}/attendance/student/${studentId}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.data || [];
};

export const getLecturerProfile = async (userId) => {
  const res = await fetch(`${API_URL}/lecturers/profile/${userId}`);
  const data = await res.json();
  return data.data || null;
};

export const updateLecturerProfile = async (userId, profileData) => {
  const res = await fetch(`${API_URL}/lecturers/profile/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(profileData)
  });
  return res.json();
};

export const getLecturerHistory = async (userId) => {
  const res = await fetch(`${API_URL}/lecturers/history/${userId}`);
  const data = await res.json();
  return data.data || [];
};


// ==================== QUẢN LÝ BUỔI HỌC (SESSIONS) ====================

// Lấy danh sách buổi học (hỗ trợ filter ?classId=...&date=...)
export const getSessions = async (filters = {}) => {
  const query = new URLSearchParams(filters).toString();
  const url = query ? `${API_URL}/sessions?${query}` : `${API_URL}/sessions`;
  const res = await fetch(url);
  const data = await res.json();
  return data.data || [];
};

// Lấy các buổi học trong ngày hôm nay
export const getTodaySessions = async () => {
  const res = await fetch(`${API_URL}/sessions/today`);
  const data = await res.json();
  return data.data || [];
};

// Lấy ca học đang diễn ra
export const getActiveSession = async () => {
  const res = await fetch(`${API_URL}/sessions/active`);
  const data = await res.json();
  return data.data || null;
};

// Lấy chi tiết 1 buổi học
export const getSessionById = async (sessionId) => {
  const res = await fetch(`${API_URL}/sessions/${sessionId}`);
  const data = await res.json();
  return data.data || null;
};

// Thêm buổi học mới
export const createSession = async (sessionData) => {
  const res = await fetch(`${API_URL}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sessionData)
  });
  return res.json();
};

// Cập nhật buổi học
export const updateSession = async (sessionId, sessionData) => {
  const res = await fetch(`${API_URL}/sessions/${sessionId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sessionData)
  });
  return res.json();
};

// Xóa buổi học
export const deleteSession = async (sessionId) => {
  const res = await fetch(`${API_URL}/sessions/${sessionId}`, {
    method: 'DELETE'
  });
  return res.json();
};

// ==================== QUẢN LÝ SINH VIÊN TRONG LỚP (CLASS STUDENTS) ====================

// Lấy thông tin chi tiết 1 lớp học
export const getClassById = async (classId) => {
  const res = await fetch(`${API_URL}/classes/${classId}`);
  const data = await res.json();
  return data.data || null;
};

// Lấy danh sách sinh viên thuộc lớp
export const getClassStudents = async (classId) => {
  const res = await fetch(`${API_URL}/classes/${classId}/students`);
  const data = await res.json();
  return data.data || [];
};

// Thêm 1 sinh viên vào lớp
export const addStudentToClass = async (classId, studentId) => {
  const res = await fetch(`${API_URL}/classes/${classId}/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId })
  });
  return res.json();
};

// Thêm nhiều sinh viên vào lớp
export const addMultipleStudentsToClass = async (classId, studentIds) => {
  const res = await fetch(`${API_URL}/classes/${classId}/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentIds })
  });
  return res.json();
};

// Xóa sinh viên khỏi lớp
export const removeStudentFromClass = async (classId, studentId) => {
  const res = await fetch(`${API_URL}/classes/${classId}/students/${studentId}`, {
    method: 'DELETE'
  });
  return res.json();
};

// Lấy danh sách sinh viên chưa thuộc lớp (để chọn thêm vào lớp)
export const getAvailableStudents = async (classId) => {
  const res = await fetch(`${API_URL}/classes/${classId}/available-students`);
  const data = await res.json();
  return data.data || [];
};
