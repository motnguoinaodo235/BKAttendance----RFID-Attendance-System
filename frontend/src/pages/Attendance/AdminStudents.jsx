import React, { useState, useEffect } from 'react';
import { Search, User, Pencil, Trash2, ChevronLeft, ScanLine, CalendarDays } from 'lucide-react';
import { getStudents, getClasses, getSessions, createStudent, updateStudent, deleteStudent } from '../../services/api';
import { socket } from '../../services/socket';

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('edit');
  const [editingStudent, setEditingStudent] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [rfidValue, setRfidValue] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [sessions, setSessions] = useState([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [classError, setClassError] = useState('');
  const [sessionsError, setSessionsError] = useState('');

  const loadStudents = async () => {
    try {
      const data = await getStudents();
      setStudents(data);
      return data;
    } catch (err) {
      console.error('Lỗi tải danh sách sinh viên:', err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  useEffect(() => {
    let active = true;
    getClasses()
      .then(data => {
        if (active) setClasses(data);
      })
      .catch(err => {
        console.error('Lỗi tải danh sách lớp:', err);
        if (active) setClassError('Không thể tải danh sách lớp học.');
      })
      .finally(() => {
        if (active) setClassesLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedClassId) {
      setSessions([]);
      setSessionsError('');
      return undefined;
    }

    let active = true;
    setSessionsLoading(true);
    setSessionsError('');
    getSessions({ classId: selectedClassId })
      .then(data => {
        if (active) setSessions(data);
      })
      .catch(err => {
        console.error('Lỗi tải buổi học của lớp:', err);
        if (active) setSessionsError('Không thể tải buổi học của lớp này.');
      })
      .finally(() => {
        if (active) setSessionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedClassId]);

  useEffect(() => {
    if (!isScanning) return undefined;

    const handleNewData = (data) => {
      if (!data?.uid) return;
      setRfidValue(data.uid);
      setScanMessage(`Đã nhận mã thẻ: ${data.uid}`);
      setIsScanning(false);
    };

    socket.on('new_data', handleNewData);
    const timeoutId = setTimeout(() => {
      setScanMessage('Hết thời gian chờ. Vui lòng thử quét lại.');
      setIsScanning(false);
    }, 30000);

    return () => {
      socket.off('new_data', handleNewData);
      clearTimeout(timeoutId);
    };
  }, [isScanning]);

  const openAddModal = () => {
    setModalMode('add');
    setEditingStudent(null);
    setEditName('');
    setEditCode('');
    setRfidValue('');
    setScanMessage('');
    setSelectedClassId('');
    setShowModal(true);
  };

  const openEditModal = (student, e) => {
    if (e) e.stopPropagation();
    setModalMode('edit');
    setEditingStudent(student);
    setEditName(student.name || '');
    setEditCode(student.code || '');
    setRfidValue(student.rfid_uid || '');
    setScanMessage('');
    setSelectedClassId(student.class_id ? String(student.class_id) : '');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingStudent(null);
    setIsScanning(false);
  };

  const handleSave = async () => {
    if (!editName.trim() || !editCode.trim()) {
      alert('Vui lòng nhập đầy đủ họ tên và MSSV');
      return;
    }

    try {
      const payload = {
        name: editName.trim(),
        code: editCode.trim(),
        rfidUid: rfidValue.trim() || null,
        classId: selectedClassId ? Number(selectedClassId) : null
      };

      const result = modalMode === 'add'
        ? await createStudent(payload)
        : await updateStudent(editingStudent.id, payload);

      if (!result.success) {
        alert(result.message || 'Thao tác thất bại');
        return;
      }

      const refreshedStudents = await loadStudents();

      if (selectedStudent && editingStudent && selectedStudent.id === editingStudent.id) {
        const refreshedStudent = refreshedStudents.find(student => student.id === selectedStudent.id);
        if (refreshedStudent) setSelectedStudent(refreshedStudent);
      }

      alert(result.message || (modalMode === 'add' ? 'Thêm sinh viên thành công' : 'Cập nhật thành công'));
      closeModal();
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối server');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa sinh viên này?')) return;

    try {
      const result = await deleteStudent(id);
      if (!result.success) {
        alert(result.message || 'Không thể xóa sinh viên');
        return;
      }

      await loadStudents();
      if (selectedStudent && selectedStudent.id === id) {
        setSelectedStudent(null);
      }
      alert(result.message || 'Xóa sinh viên thành công');
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối server');
    }
  };

  const handleScanRfid = () => {
    if (!socket.connected) {
      setScanMessage('Chưa kết nối server. Vui lòng kiểm tra backend.');
      return;
    }

    setScanMessage('');
    setIsScanning(true);
  };

  const filteredStudents = students?.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (student.code && student.code.toString().toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSyncHardware = async () => {
    if (window.confirm('Bạn có chắc muốn đẩy dữ liệu xuống phần cứng?')) {
      try {
        const res = await fetch('http://localhost:3000/api/students/sync-hardware', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          alert(data.message);
        } else {
          alert('Lỗi: ' + data.message);
        }
      } catch (err) {
        alert('Lỗi mạng khi đồng bộ phần cứng');
      }
    }
  };

  return (
    <div className="container-fluid mt-3 flex-grow-1 d-flex flex-column">

      {!selectedStudent ? (
        <>
          <div className="d-flex justify-content-between mb-3 gap-2 align-items-center">
            <div className="input-group" style={{ width: '300px' }}>
              <span className="input-group-text bg-white"><Search size={18} /></span>
              <input
                type="text"
                className="form-control"
                placeholder="Tìm kiếm sinh viên..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-primary fw-medium d-flex align-items-center gap-2" onClick={handleSyncHardware}>
                Đồng bộ phần cứng
              </button>
              <button className="btn btn-primary fw-medium d-flex align-items-center gap-2 text-white" onClick={openAddModal}>
                <User size={18} /> Thêm sinh viên
              </button>
            </div>
          </div>

          <div className="card border-0 shadow-sm flex-grow-1 mb-3">
            <div className="list-group list-group-flush rounded-3" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              {loading ? (
                <div className="text-center p-5 text-secondary">Đang tải dữ liệu từ server...</div>
              ) : !filteredStudents || filteredStudents.length === 0 ? (
                <div className="text-center p-5 text-secondary">Không có dữ liệu.</div>
              ) : (
                filteredStudents.map(student => (
                  <div
                    key={student.id}
                    className="list-group-item list-group-item-action d-flex align-items-center justify-content-between p-3"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedStudent(student)}
                  >
                    <div className="d-flex align-items-center gap-3">
                      <div className="rounded-circle d-flex align-items-center justify-content-center bg-success bg-opacity-10 text-success" style={{ width: '48px', height: '48px' }}>
                        <User size={24} />
                      </div>
                      <div>
                        <h6 className="mb-1 text-dark fw-bold">{student.name}</h6>
                        <span className="text-secondary small d-block">
                          MSSV: {student.code} {student.rfid_uid ? `| Thẻ: ${student.rfid_uid}` : '| Chưa gán thẻ'}
                        </span>
                      </div>
                    </div>
                    <div className="d-flex gap-2">
                      <button className="btn btn-outline-primary btn-sm rounded" onClick={(e) => openEditModal(student, e)} title="Chỉnh sửa">
                        <Pencil size={18} />
                      </button>
                      <button className="btn btn-outline-danger btn-sm rounded" onClick={(e) => { e.stopPropagation(); handleDelete(student.id); }} title="Xóa">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="h-100 d-flex flex-column">
          <button className="btn btn-secondary d-flex align-items-center gap-2 mb-3 text-white fw-medium align-self-start" onClick={() => setSelectedStudent(null)}>
            <ChevronLeft size={20} /> Quay lại
          </button>

          <div className="row flex-grow-1">
            <div className="col-md-3">
              <div className="card border-0 shadow-sm p-4 text-center h-100">
                <div className="rounded-circle d-flex align-items-center justify-content-center bg-success bg-opacity-10 text-success mx-auto mb-3" style={{ width: '80px', height: '80px' }}>
                  <User size={40} />
                </div>
                <h5 className="fw-bold mb-2">{selectedStudent.name}</h5>
                <p className="text-secondary mb-1">MSSV: {selectedStudent.code}</p>
                <p className="text-secondary small">Mã thẻ: {selectedStudent.rfid_uid || 'Chưa có'}</p>
              </div>
            </div>

            <div className="col-md-9 d-flex flex-column">
              <div className="card border-0 shadow-sm p-4 flex-grow-1">
                <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom">
                  <h4 className="fw-bold m-0 text-dark">Thông tin sinh viên</h4>
                  <div className="d-flex gap-2">
                    <button className="btn btn-primary d-flex align-items-center gap-2 text-white" onClick={() => openEditModal(selectedStudent)}>
                      <Pencil size={18} /> Chỉnh sửa
                    </button>
                    <button className="btn btn-danger d-flex align-items-center gap-2" onClick={() => handleDelete(selectedStudent.id)}>
                      <Trash2 size={18} /> Xóa
                    </button>
                  </div>
                </div>

                <div className="list-group list-group-flush">
                  <div className="list-group-item d-flex justify-content-between align-items-center py-3">
                    <div>
                      <span className="fw-semibold d-block text-dark">{selectedStudent.class || 'Chưa phân lớp'}</span>
                      <span className="small text-secondary">Lớp học hiện tại</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px' }}>
              <div className="modal-header border-bottom-0 pb-0">
                <h5 className="modal-title fw-bold">
                  {modalMode === 'add' ? 'Thêm sinh viên mới' : 'Cập nhật sinh viên'}
                </h5>
                <button type="button" className="btn-close" onClick={closeModal}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label fw-medium">Họ và tên *</label>
                  <input type="text" className="form-control" value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-medium">Mã số sinh viên (MSSV) *</label>
                  <input type="text" className="form-control" value={editCode} onChange={(e) => setEditCode(e.target.value)} />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-medium">Lớp học</label>
                  <select
                    className="form-select"
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    disabled={classesLoading || Boolean(classError)}
                  >
                    <option value="">
                      {classesLoading
                        ? 'Đang tải lớp học...'
                        : classError
                          ? 'Không tải được lớp học'
                          : modalMode === 'edit'
                            ? 'Không thêm lớp mới'
                            : 'Chưa xếp lớp'}
                    </option>
                    {classes.map(classItem => (
                      <option key={classItem.id} value={classItem.id}>{classItem.name}</option>
                    ))}
                  </select>
                  {classError && <div className="form-text text-danger">{classError}</div>}
                </div>
                {selectedClassId && (
                  <div className="mb-4">
                    <label className="form-label fw-medium d-flex align-items-center gap-2">
                      <CalendarDays size={16} /> Buổi học của lớp
                    </label>
                    {sessionsLoading ? (
                      <div className="form-text">Đang tải buổi học...</div>
                    ) : sessionsError ? (
                      <div className="form-text text-danger">{sessionsError}</div>
                    ) : sessions.length === 0 ? (
                      <div className="form-text">Lớp này chưa có buổi học. Các buổi học tạo sau sẽ tự áp dụng cho sinh viên trong lớp.</div>
                    ) : (
                      <ul className="list-group">
                        {sessions.map(session => (
                          <li key={session.session_id} className="list-group-item py-2">
                            <span className="fw-medium">
                              {new Date(`${session.session_date}T00:00:00`).toLocaleDateString('vi-VN')}
                            </span>
                            <span className="text-secondary ms-2">
                              {String(session.start_time).slice(0, 5)} - {String(session.end_time).slice(0, 5)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="form-text">
                      Buổi học của lớp đã chọn sẽ áp dụng cho sinh viên. Các lớp đã gắn trước đó vẫn được giữ.
                    </div>
                  </div>
                )}
                <div className="mb-4">
                  <label className="form-label fw-medium text-primary">Mã thẻ RFID</label>
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Mã hex của thẻ (VD: A3B4...)"
                      value={rfidValue}
                      onChange={(e) => setRfidValue(e.target.value)}
                    />
                    <button
                      className={`btn ${isScanning ? 'btn-warning' : 'btn-outline-primary'} d-flex align-items-center gap-2`}
                      type="button"
                      onClick={handleScanRfid}
                      disabled={isScanning}
                    >
                      <ScanLine size={18} /> {isScanning ? 'Đang chờ thẻ...' : 'Quét thẻ'}
                    </button>
                  </div>
                  {scanMessage && <div className="form-text">{scanMessage}</div>}
                </div>
              </div>
              <div className="modal-footer border-top-0 pt-0">
                <button type="button" className="btn btn-light" onClick={closeModal}>Hủy bỏ</button>
                <button
                  type="button"
                  className="btn btn-primary px-4"
                  onClick={handleSave}
                  disabled={classesLoading || Boolean(classError)}
                >
                  {modalMode === 'add' ? 'Thêm sinh viên' : 'Lưu thông tin'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
