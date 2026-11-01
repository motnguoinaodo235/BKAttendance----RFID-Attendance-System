import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { 
  Users, CheckCircle, XCircle, Download, BarChart2, 
  ChevronDown, Plus, Trash2, Search 
} from 'lucide-react';
import { io } from 'socket.io-client';
import { 
  getClassStudents, addStudentToClass, removeStudentFromClass, 
  getAvailableStudents, getClassById 
} from '../../services/api';
import { FlashContext } from '../../App';
import './Attendance.css';

export default function AttendanceDetail() {
  const navigate = useNavigate();
  const { classId } = useParams();
  const location = useLocation();
  const basePath = location.pathname.match(/^\/[^/]+/)?.[0] || '';
  const addFlash = useContext(FlashContext);

  const [activeTab, setActiveTab] = useState('attendance'); // 'attendance' | 'students'
  const [classInfo, setClassInfo] = useState(null);

  // Tab 1: Attendance State
  const [historyData, setHistoryData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({ total: 0, present: 0, absent: 0, late: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // Tab 2: Class Students State
  const [classStudents, setClassStudents] = useState([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [availableSearch, setAvailableSearch] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [classRes, statsRes, historyRes] = await Promise.all([
        getClassById(classId),
        fetch(`http://localhost:3000/api/stats/class/${classId}`).then(r => r.json()),
        fetch(`http://localhost:3000/api/attendance/history?classId=${classId}`).then(r => r.json())
      ]);

      if (classRes) setClassInfo(classRes);
      if (statsRes.success) {
        setStats({
          total: statsRes.data.total_students,
          present: statsRes.data.present,
          late: statsRes.data.late,
          absent: statsRes.data.absent
        });
      }
      if (historyRes.success) {
        setHistoryData(historyRes.data);
      }
    } catch (error) {
      console.error("Error fetching detail data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadClassStudents = async () => {
    setLoadingStudents(true);
    try {
      const data = await getClassStudents(classId);
      setClassStudents(data);
    } catch (error) {
      console.error("Lỗi khi tải sinh viên trong lớp:", error);
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Kết nối Socket.IO
    const socket = io('http://localhost:3000');
    
    socket.on('new_attendance', (data) => {
      setHistoryData(prev => [
        {
          student_code: data.student_code,
          student_name: data.name,
          status: data.status,
          checkin_time: new Date().toISOString()
        },
        ...prev
      ]);
      
      setStats(prev => {
        let newPresent = prev.present;
        let newLate = prev.late;
        let newAbsent = prev.absent;

        if (data.status === 'Present') {
          newPresent += 1;
          newAbsent = Math.max(0, newAbsent - 1);
        } else if (data.status === 'Late') {
          newLate += 1;
          newAbsent = Math.max(0, newAbsent - 1);
        }

        return { ...prev, present: newPresent, late: newLate, absent: newAbsent };
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [classId]);

  useEffect(() => {
    if (activeTab === 'students') {
      loadClassStudents();
    }
  }, [activeTab, classId]);

  const handleExportAttendance = () => {
    if (!historyData || historyData.length === 0) {
      alert('Không có dữ liệu để xuất');
      return;
    }

    const headers = ['MSSV', 'Họ và tên', 'Thời gian điểm danh', 'Trạng thái'];
    const rows = historyData.map(s => {
      let statusText = s.status === 'Present' ? 'Có mặt' : (s.status === 'Absent' ? 'Vắng' : 'Đi trễ');
      let timeText = s.checkin_time ? new Date(s.checkin_time).toLocaleString('vi-VN') : '-';
      return `"${s.student_code}","${s.student_name}","${timeText}","${statusText}"`;
    });

    const csvContent = headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-');
    link.download = `DiemDanh_Lop_${classId}_Ngay_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Open Add Student Modal
  const handleOpenAddModal = async () => {
    setShowAddModal(true);
    setLoadingAvailable(true);
    setSelectedStudentIds([]);
    try {
      const data = await getAvailableStudents(classId);
      setAvailableStudents(data);
    } catch (err) {
      console.error(err);
      addFlash?.('Lỗi tải danh sách sinh viên', 'error');
    } finally {
      setLoadingAvailable(false);
    }
  };

  // Add students to class
  const handleAddStudentsSubmit = async () => {
    if (selectedStudentIds.length === 0) {
      addFlash?.('Vui lòng chọn ít nhất một sinh viên!', 'error');
      return;
    }

    try {
      for (const sId of selectedStudentIds) {
        await addStudentToClass(classId, sId);
      }
      addFlash?.(`Đã thêm thành công ${selectedStudentIds.length} sinh viên vào lớp!`, 'success');
      setShowAddModal(false);
      loadClassStudents();
      fetchData();
    } catch (err) {
      addFlash?.('Lỗi khi thêm sinh viên vào lớp', 'error');
    }
  };

  // Remove student from class
  const handleRemoveStudent = async (studentId, studentName) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa sinh viên ${studentName} khỏi lớp này?`)) {
      return;
    }

    try {
      const res = await removeStudentFromClass(classId, studentId);
      if (res.success) {
        addFlash?.('Đã xóa sinh viên khỏi lớp!', 'success');
        loadClassStudents();
        fetchData();
      } else {
        addFlash?.(res.message || 'Lỗi khi xóa', 'error');
      }
    } catch (err) {
      addFlash?.('Lỗi hệ thống khi xóa sinh viên khỏi lớp', 'error');
    }
  };

  const filteredHistoryData = historyData.filter(s => {
    const term = (searchTerm || '').toLowerCase();
    return (s?.student_code || '').toLowerCase().includes(term) || (s?.student_name || '').toLowerCase().includes(term);
  });

  const filteredClassStudents = classStudents.filter(s => {
    const term = (studentSearchTerm || '').toLowerCase();
    return (s?.student_code || '').toLowerCase().includes(term) || (s?.name || '').toLowerCase().includes(term);
  });

  return (
    <div className="content-container p-4">
      {/* Header & Tab switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
            Lớp học: {classInfo ? classInfo.name : `Lớp ID: ${classId}`}
          </h2>
          <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            Giảng viên: <span style={{ fontWeight: 600, color: '#096395' }}>{classInfo?.lecturer || 'Tôi'}</span>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            style={{ 
              padding: '8px 18px', 
              borderRadius: '8px', 
              border: 'none', 
              cursor: 'pointer',
              fontWeight: 600,
              background: activeTab === 'attendance' ? '#096395' : '#e2e8f0',
              color: activeTab === 'attendance' ? 'white' : '#475569'
            }}
            onClick={() => setActiveTab('attendance')}
          >
            📋 Điểm danh buổi học
          </button>
          <button 
            style={{ 
              padding: '8px 18px', 
              borderRadius: '8px', 
              border: 'none', 
              cursor: 'pointer',
              fontWeight: 600,
              background: activeTab === 'students' ? '#096395' : '#e2e8f0',
              color: activeTab === 'students' ? 'white' : '#475569'
            }}
            onClick={() => setActiveTab('students')}
          >
            👥 Sinh viên trong lớp ({classStudents.length || stats.total || 0})
          </button>
        </div>
      </div>

      {activeTab === 'attendance' ? (
        /* TAB 1: ATTENDANCE REAL-TIME */
        <div className="detail-grid">
          {/* Cột trái: Summary Cards */}
          <div className="summary-col">
            <div className="summary-card">
              <div className="summary-icon total"><Users size={26} /></div>
              <div className="summary-info">
                <span>{stats.total}</span>
                <span>Tổng SV</span>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-icon present"><CheckCircle size={26} /></div>
              <div className="summary-info">
                <span>{stats.present + stats.late}</span>
                <span>Có mặt / Trễ</span>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-icon absent"><XCircle size={26} /></div>
              <div className="summary-info">
                <span>{stats.absent}</span>
                <span>Vắng mặt</span>
              </div>
            </div>
          </div>

          {/* Cột phải: Main Board */}
          <div className="main-board">
            <div className="board-top">
              <span className="board-title">Chi tiết điểm danh - Lớp ID: {classId}</span>
              <div className="board-controls">
                <input 
                  type="text" 
                  placeholder="Tìm kiếm MSSV, Họ tên..." 
                  className="board-search" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button className="board-btn" onClick={handleExportAttendance}>
                  <Download size={18} /> Xuất <ChevronDown size={14}/>
                </button>
                <button className="board-btn primary" onClick={() => navigate(`${basePath}/attendance/${classId}/stats`)}>
                  <BarChart2 size={18} /> Thống kê
                </button>
              </div>
            </div>

            <div className="table-container">
              {isLoading ? (
                <div className="d-flex justify-content-center p-5">
                  <div className="spinner-border text-primary" role="status"></div>
                </div>
              ) : (
                <table className="attendance-table">
                  <thead>
                    <tr>
                      <th>MSSV</th>
                      <th>Họ và tên</th>
                      <th>Trạng thái</th>
                      <th>Thời gian điểm danh</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistoryData.length > 0 ? filteredHistoryData.map((s, idx) => {
                      let badgeClass = s.status === 'Present' ? 'present' : (s.status === 'Absent' ? 'absent' : 'late');
                      let statusText = s.status === 'Present' ? 'Có mặt' : (s.status === 'Absent' ? 'Vắng' : 'Đi trễ');
                      let timeText = s.checkin_time ? new Date(s.checkin_time).toLocaleString('vi-VN') : '-';
                      return (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600 }}>{s.student_code}</td>
                          <td>{s.student_name}</td>
                          <td>
                            <span className={`status-badge ${badgeClass}`}>
                              {statusText}
                            </span>
                          </td>
                          <td>{timeText}</td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan="4" className="text-center p-4">Chưa có dữ liệu điểm danh</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* TAB 2: CLASS STUDENTS MANAGEMENT */
        <div className="main-board flex flex-col h-full w-full">
          <div className="board-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="board-title">Danh sách sinh viên chính thức của lớp</span>
            <div className="board-controls">
              <input 
                type="text" 
                placeholder="Tìm MSSV, tên sinh viên..." 
                className="board-search"
                value={studentSearchTerm}
                onChange={(e) => setStudentSearchTerm(e.target.value)}
              />
              <button 
                className="board-btn primary" 
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#096395', color: 'white' }}
                onClick={handleOpenAddModal}
              >
                <Plus size={18} /> Thêm sinh viên vào lớp
              </button>
            </div>
          </div>

          <div className="table-container flex-1 w-full">
            <table className="attendance-table">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>MSSV</th>
                  <th>Họ và tên</th>
                  <th>Mã thẻ RFID</th>
                  <th>Số buổi có mặt</th>
                  <th>Số buổi đi muộn</th>
                  <th>Số buổi vắng</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loadingStudents ? (
                  <tr><td colSpan="8" className="text-center">Đang tải danh sách sinh viên...</td></tr>
                ) : filteredClassStudents.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center" style={{ padding: '30px', color: '#64748b' }}>
                      Lớp này hiện chưa có sinh viên nào. Hãy bấm "Thêm sinh viên vào lớp" để ghi danh!
                    </td>
                  </tr>
                ) : filteredClassStudents.map((s, idx) => (
                  <tr key={s.student_id}>
                    <td>{idx + 1}</td>
                    <td style={{ fontWeight: 600, color: '#096395' }}>{s.student_code}</td>
                    <td style={{ fontWeight: 500 }}>{s.name}</td>
                    <td>
                      {s.rfid_uid ? (
                        <span style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '3px 8px', borderRadius: '4px' }}>
                          {s.rfid_uid}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Chưa cấp thẻ</span>
                      )}
                    </td>
                    <td style={{ color: '#16a34a', fontWeight: 600 }}>{s.present_count || 0}</td>
                    <td style={{ color: '#d97706', fontWeight: 600 }}>{s.late_count || 0}</td>
                    <td style={{ color: '#dc2626', fontWeight: 600 }}>{s.absent_count || 0}</td>
                    <td>
                      <button 
                        style={{ border: 'none', background: '#fee2e2', color: '#dc2626', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        title="Xóa khỏi lớp học"
                        onClick={() => handleRemoveStudent(s.student_id, s.name)}
                      >
                        <Trash2 size={16} /> Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL THÊM SINH VIÊN VÀO LỚP */}
      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', width: '560px', maxWidth: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1.2rem', fontWeight: 'bold', color: '#0f172a' }}>
              ➕ Thêm sinh viên vào lớp {classInfo?.name}
            </h3>
            <p style={{ margin: '0 0 16px 0', color: '#64748b', fontSize: '0.85rem' }}>
              Chọn các sinh viên chưa có trong lớp để thêm vào danh sách lớp học:
            </p>

            <div style={{ marginBottom: '14px' }}>
              <input 
                type="text" 
                placeholder="Tìm kiếm MSSV hoặc Tên sinh viên..." 
                value={availableSearch}
                onChange={(e) => setAvailableSearch(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', marginBottom: '16px' }}>
              {loadingAvailable ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>Đang tải danh sách sinh viên...</div>
              ) : availableStudents.filter(s => 
                  (s.student_code || '').toLowerCase().includes(availableSearch.toLowerCase()) || 
                  (s.name || '').toLowerCase().includes(availableSearch.toLowerCase())
                ).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                  Không còn sinh viên nào khả dụng để thêm.
                </div>
              ) : (
                availableStudents
                  .filter(s => 
                    (s.student_code || '').toLowerCase().includes(availableSearch.toLowerCase()) || 
                    (s.name || '').toLowerCase().includes(availableSearch.toLowerCase())
                  )
                  .map(s => {
                    const isChecked = selectedStudentIds.includes(s.student_id);
                    return (
                      <div 
                        key={s.student_id} 
                        style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: isChecked ? '#eff6ff' : 'transparent' }}
                        onClick={() => {
                          if (isChecked) {
                            setSelectedStudentIds(selectedStudentIds.filter(id => id !== s.student_id));
                          } else {
                            setSelectedStudentIds([...selectedStudentIds, s.student_id]);
                          }
                        }}
                      >
                        <input 
                          type="checkbox" 
                          checked={isChecked} 
                          onChange={() => {}} 
                          style={{ marginRight: '12px', cursor: 'pointer' }}
                        />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 600, color: '#096395', marginRight: '10px' }}>{s.student_code}</span>
                          <span style={{ fontWeight: 500 }}>{s.name}</span>
                        </div>
                        {s.rfid_uid && (
                          <span style={{ fontSize: '0.75rem', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>
                            RFID: {s.rfid_uid}
                          </span>
                        )}
                      </div>
                    );
                  })
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: '#475569' }}>
                Đã chọn: <strong>{selectedStudentIds.length}</strong> sinh viên
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  type="button" 
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}
                  onClick={() => setShowAddModal(false)}
                >
                  Hủy
                </button>
                <button 
                  type="button" 
                  style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#096395', color: 'white', cursor: 'pointer', fontWeight: 600 }}
                  onClick={handleAddStudentsSubmit}
                >
                  Xác nhận thêm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
