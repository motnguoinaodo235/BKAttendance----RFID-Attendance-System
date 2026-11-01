import React, { useState, useEffect, useContext } from 'react';
import { 
  Calendar, Clock, Plus, Edit2, Trash2, Search, Filter, 
  CheckCircle, AlertCircle, XCircle, Users, BookOpen 
} from 'lucide-react';
import { 
  getSessions, getTodaySessions, createSession, 
  updateSession, deleteSession, getClasses 
} from '../../services/api';
import { FlashContext } from '../../App';
import './Attendance.css';

export default function Sessions({ role = 'admin' }) {
  const addFlash = useContext(FlashContext);

  const [activeTab, setActiveTab] = useState('today'); // 'today' | 'all'
  const [todaySessions, setTodaySessions] = useState([]);
  const [allSessions, setAllSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedClassId, setSelectedClassId] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [formData, setFormData] = useState({
    class_id: '',
    session_date: new Date().toISOString().split('T')[0],
    start_time: '07:00:00',
    end_time: '09:30:00',
    late_threshold: '07:15:00'
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [todayData, classesData] = await Promise.all([
        getTodaySessions(),
        getClasses()
      ]);
      setTodaySessions(todayData);
      setClasses(classesData);

      if (activeTab === 'all') {
        const allData = await getSessions({ classId: selectedClassId, date: filterDate });
        setAllSessions(allData);
      }
    } catch (err) {
      console.error('Lỗi khi tải buổi học:', err);
      addFlash?.('Lỗi khi tải dữ liệu buổi học từ máy chủ', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, selectedClassId, filterDate]);

  const handleOpenAddModal = () => {
    setEditingSession(null);
    setFormData({
      class_id: classes.length > 0 ? classes[0].id : '',
      session_date: new Date().toISOString().split('T')[0],
      start_time: '07:00:00',
      end_time: '09:30:00',
      late_threshold: '07:15:00'
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (session) => {
    setEditingSession(session);
    setFormData({
      class_id: session.class_id,
      session_date: session.session_date,
      start_time: session.start_time,
      end_time: session.end_time,
      late_threshold: session.late_threshold
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.class_id) {
      addFlash?.('Vui lòng chọn lớp học!', 'error');
      return;
    }

    try {
      if (editingSession) {
        const res = await updateSession(editingSession.session_id, formData);
        if (res.success) {
          addFlash?.('Cập nhật buổi học thành công!', 'success');
        } else {
          addFlash?.(res.message || 'Lỗi cập nhật', 'error');
        }
      } else {
        const res = await createSession(formData);
        if (res.success) {
          addFlash?.('Thêm buổi học mới thành công!', 'success');
        } else {
          addFlash?.(res.message || 'Lỗi thêm buổi học', 'error');
        }
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      console.error(err);
      addFlash?.('Lỗi hệ thống khi lưu buổi học', 'error');
    }
  };

  const handleDelete = async (sessionId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa buổi học này không? Tất cả dữ liệu điểm danh của buổi học cũng sẽ bị xóa.')) {
      return;
    }
    try {
      const res = await deleteSession(sessionId);
      if (res.success) {
        addFlash?.('Đã xóa buổi học thành công!', 'success');
        loadData();
      } else {
        addFlash?.(res.message || 'Lỗi khi xóa', 'error');
      }
    } catch (err) {
      addFlash?.('Lỗi khi xóa buổi học', 'error');
    }
  };

  const displayList = (activeTab === 'today' ? todaySessions : allSessions).filter(item => {
    const term = (searchTerm || '').toLowerCase();
    return (item.class_name || '').toLowerCase().includes(term) ||
           (item.lecturer_name || '').toLowerCase().includes(term);
  });

  return (
    <div className="content-container w-full h-full flex flex-col flex-1 p-4">
      {/* Top Header Card */}
      <div className="list-card flex-1 flex flex-col w-full h-full">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
              📅 Quản lý Buổi học & Lịch trình
            </h2>
            <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
              Theo dõi ca học hôm nay, tạo lịch điểm danh và cấu hình giờ trễ
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              className="board-btn primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#096395', color: 'white', padding: '10px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              onClick={handleOpenAddModal}
            >
              <Plus size={18} /> Thêm buổi học mới
            </button>
          </div>
        </div>

        {/* Tab switcher: Hôm nay vs Tất cả */}
        <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: '20px' }}>
          <button 
            style={{ 
              padding: '10px 24px', 
              border: 'none', 
              background: 'none', 
              fontWeight: 600, 
              cursor: 'pointer',
              color: activeTab === 'today' ? '#096395' : '#64748b',
              borderBottom: activeTab === 'today' ? '3px solid #096395' : 'none',
              marginBottom: '-2px'
            }}
            onClick={() => setActiveTab('today')}
          >
            ☀️ Buổi học trong ngày hôm nay ({todaySessions.length})
          </button>
          <button 
            style={{ 
              padding: '10px 24px', 
              border: 'none', 
              background: 'none', 
              fontWeight: 600, 
              cursor: 'pointer',
              color: activeTab === 'all' ? '#096395' : '#64748b',
              borderBottom: activeTab === 'all' ? '3px solid #096395' : 'none',
              marginBottom: '-2px'
            }}
            onClick={() => setActiveTab('all')}
          >
            📋 Tất cả các buổi học
          </button>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 10px', background: 'white', flex: 1, minWidth: '260px' }}>
            <Search size={18} color="#94a3b8" />
            <input 
              type="text" 
              placeholder="Tìm theo tên lớp, giảng viên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ border: 'none', outline: 'none', padding: '10px', width: '100%' }}
            />
          </div>

          {activeTab === 'all' && (
            <>
              <select 
                style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white' }}
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
              >
                <option value="">-- Tất cả lớp học --</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <input 
                type="date"
                style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white' }}
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </>
          )}
        </div>

        {/* Sessions Table */}
        <div className="table-container flex-1 w-full" style={{ overflowX: 'auto' }}>
          <table className="attendance-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>STT</th>
                <th>Lớp học</th>
                <th>Giảng viên</th>
                <th>Ngày học</th>
                <th>Giờ bắt đầu - Giờ kết thúc</th>
                <th>Ngưỡng đi trễ</th>
                <th>Điểm danh</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '30px' }}>Đang tải dữ liệu...</td></tr>
              ) : displayList.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                    {activeTab === 'today' ? 'Hôm nay không có ca học nào được xếp lịch.' : 'Không tìm thấy buổi học phù hợp.'}
                  </td>
                </tr>
              ) : (
                displayList.map((s, idx) => (
                  <tr key={s.session_id}>
                    <td>{idx + 1}</td>
                    <td style={{ fontWeight: 600, color: '#096395' }}>{s.class_name}</td>
                    <td>{s.lecturer_name}</td>
                    <td>{s.session_date}</td>
                    <td>
                      <span style={{ fontWeight: 500 }}>{s.start_time.substring(0, 5)} - {s.end_time.substring(0, 5)}</span>
                    </td>
                    <td>
                      <span style={{ color: '#d97706', fontSize: '0.9rem' }}>
                        Trễ sau {s.late_threshold.substring(0, 5)}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{s.attended_students || 0}</span> / {s.total_students || 0} SV
                    </td>
                    <td>
                      {s.status === 'ONGOING' ? (
                        <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}>
                          ● Đang diễn ra
                        </span>
                      ) : s.status === 'UPCOMING' ? (
                        <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}>
                          Chưa tới giờ
                        </span>
                      ) : (
                        <span style={{ background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem' }}>
                          Đã kết thúc
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          style={{ border: 'none', background: '#f1f5f9', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', color: '#0f172a' }}
                          title="Sửa buổi học"
                          onClick={() => handleOpenEditModal(s)}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          style={{ border: 'none', background: '#fee2e2', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', color: '#b91c1c' }}
                          title="Xóa buổi học"
                          onClick={() => handleDelete(s.session_id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Thêm / Sửa Buổi học */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ background: 'white', padding: '28px', borderRadius: '12px', width: '480px', maxWidth: '90%', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '1.25rem', fontWeight: 'bold', color: '#0f172a' }}>
              {editingSession ? '✏️ Cập nhật buổi học' : '➕ Thêm buổi học mới'}
            </h3>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', color: '#334155' }}>Lớp học *</label>
                <select 
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  value={formData.class_id}
                  onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                  required
                >
                  <option value="">-- Chọn lớp học --</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.lecturer})</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', color: '#334155' }}>Ngày diễn ra *</label>
                <input 
                  type="date"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  value={formData.session_date}
                  onChange={(e) => setFormData({ ...formData, session_date: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', color: '#334155' }}>Giờ bắt đầu *</label>
                  <input 
                    type="time" 
                    step="1"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', color: '#334155' }}>Giờ kết thúc *</label>
                  <input 
                    type="time" 
                    step="1"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', color: '#334155' }}>
                  Ngưỡng tính đi muộn (Late Threshold)
                </label>
                <input 
                  type="time" 
                  step="1"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  value={formData.late_threshold}
                  onChange={(e) => setFormData({ ...formData, late_threshold: e.target.value })}
                  required
                />
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  * Sinh viên quét thẻ sau giờ này nhưng trước giờ kết thúc sẽ bị tính là "Đi muộn".
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button 
                  type="button"
                  style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: 600 }}
                  onClick={() => setShowModal(false)}
                >
                  Hủy
                </button>
                <button 
                  type="submit"
                  style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', background: '#096395', color: 'white', cursor: 'pointer', fontWeight: 600 }}
                >
                  {editingSession ? 'Lưu thay đổi' : 'Thêm buổi học'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

