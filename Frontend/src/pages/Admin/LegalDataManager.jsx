import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AdminSidebar from '../../components/AdminSidebar';
import {
    Plus, Edit2, Trash2, Eye, Search, Filter,
    AlertTriangle, CheckCircle2, XCircle, Loader2,
    ChevronLeft, ChevronRight, MoreVertical
} from 'lucide-react';

const API_BASE = 'http://localhost:8000/api/admin/legal-documents';

export default function LegalDataManager() {
    const [lawData, setLawData] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [activeMenuId, setActiveMenuId] = useState(null); // Quản lý ID của hàng đang mở Menu

    // Modal states
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showChunksModal, setShowChunksModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [chunksData, setChunksData] = useState([]);
    const [modalLoading, setModalLoading] = useState(false);
    const [chunksLoading, setChunksLoading] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        title: '',
        documentNumber: '',
        issueYear: '',
        category: '',
        content: '',
        status: 'Còn hiệu lực',
        sourceUrl: ''
    });
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const token = localStorage.getItem('accessToken');
                const res = await axios.get(`${API_BASE}/categories`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data.success) setCategories(res.data.data);
            } catch (error) {
                console.error("Không lấy được danh sách phân loại:", error);
            }
        };
        fetchCategories();
    }, []);


    const fetchLawData = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('accessToken');
            const params = {
                page: currentPage,
                limit: 10,
                search: searchQuery,
                category: filterCategory,
                status: filterStatus
            };

            const response = await axios.get(API_BASE, {
                headers: { Authorization: `Bearer ${token}` },
                params
            });

            if (response.data.success) {
                setLawData(response.data.data || []);
                setCurrentPage(response.data.currentPage || 1);
                setTotalPages(response.data.totalPages || 1);
                setTotalItems(response.data.totalItems || 0);
            }
        } catch (error) {
            console.error('Lỗi khi tải dữ liệu:', error);
            if (error.response?.status === 401) {
                console.error('Phiên đăng nhập hết hạn!');
            }
        } finally {
            setLoading(false);
        }
    };
    // về trang nhất mỗi khi đổi bộ lọc
    useEffect(() => {
        if (currentPage !== 1) {
            setCurrentPage(1);
        }
    }, [searchQuery, filterCategory, filterStatus]);
    useEffect(() => {
        fetchLawData();
    }, [currentPage, searchQuery, filterCategory, filterStatus]);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!formData.title.trim() || !formData.content.trim()) {
            alert('Vui lòng điền đầy đủ tiêu đề và nội dung!');
            return;
        }

        setModalLoading(true);
        try {
            const token = localStorage.getItem('accessToken');
            const response = await axios.post(API_BASE, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                alert('Thêm văn bản thành công!');
                setShowAddModal(false);
                resetForm();
                fetchLawData();
            } else {
                alert(response.data.message || 'Thêm thất bại');
            }
        } catch (error) {
            console.error('Lỗi khi thêm:', error);
            alert(error.response?.data?.message || 'Lỗi server');
        } finally {
            setModalLoading(false);
        }
    };

    const handleEdit = (doc) => {
        setSelectedDoc(doc);
        setFormData({
            title: doc.Title || '',
            documentNumber: doc.DocumentNumber || '',
            issueYear: doc.IssueYear || '',
            category: doc.Category || '',
            content: doc.Content || '',
            status: doc.Status || 'Còn hiệu lực',
            sourceUrl: doc.SourceUrl || ''
        });
        setShowEditModal(true);
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        if (!formData.title.trim() || !formData.content.trim()) {
            alert('Vui lòng điền đầy đủ tiêu đề và nội dung!');
            return;
        }

        setModalLoading(true);
        try {
            const token = localStorage.getItem('accessToken');
            const response = await axios.put(`${API_BASE}/${selectedDoc.Id}`, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                alert('Cập nhật thành công!');
                setShowEditModal(false);
                resetForm();
                fetchLawData();
            } else {
                alert(response.data.message || 'Cập nhật thất bại');
            }
        } catch (error) {
            console.error('Lỗi khi cập nhật:', error);
            alert(error.response?.data?.message || 'Lỗi server');
        } finally {
            setModalLoading(false);
        }
    };

    const handleDelete = (doc) => {
        setSelectedDoc(doc);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!selectedDoc) return;

        setModalLoading(true);
        try {
            const token = localStorage.getItem('accessToken');
            const response = await axios.delete(`${API_BASE}/${selectedDoc.Id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                alert('Xóa thành công!');
                setShowDeleteModal(false);
                fetchLawData();
            } else {
                alert(response.data.message || 'Xóa thất bại');
            }
        } catch (error) {
            console.error('Lỗi khi xóa:', error);
            alert(error.response?.data?.message || 'Lỗi server');
        } finally {
            setModalLoading(false);
        }
    };

    const handleViewChunks = async (doc) => {
        setSelectedDoc(doc);
        setChunksLoading(true);
        setShowChunksModal(true);

        try {
            const token = localStorage.getItem('accessToken');
            const response = await axios.get(`${API_BASE}/${doc.Id}/chunks`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                setChunksData(response.data.data || []);
            } else {
                setChunksData([]);
            }
        } catch (error) {
            console.error('Lỗi khi tải chunks:', error);
            setChunksData([]);
        } finally {
            setChunksLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            documentNumber: '',
            issueYear: '',
            category: '',
            content: '',
            status: 'Còn hiệu lực',
            sourceUrl: ''
        });
        setSelectedDoc(null);
    };

    const openAddModal = () => {
        resetForm();
        setShowAddModal(true);
    };

    const glassClass = 'bg-black/60 backdrop-blur-2xl border border-white/10 shadow-2xl';

    return (
        <div className="min-h-screen bg-[#050505] text-gray-300 font-sans selection:bg-cyan-500/30 flex">
            <AdminSidebar />

            <main className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                <header className="flex justify-between items-center mb-10">
                    <div>
                        <h1 className="text-3xl font-black text-white uppercase tracking-tighter">
                            Quản lý <span className="text-cyan-400">Data Luật</span>
                        </h1>
                        <p className="text-xs text-gray-500 mt-1 uppercase tracking-[0.2em]">
                            Cơ sở dữ liệu pháp lý với Dual-Sync SSMS & Pinecone
                        </p>
                    </div>
                    <button
                        onClick={openAddModal}
                        className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-xl hover:bg-cyan-500/20 transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                    >
                        <Plus size={16} />
                        <span className="text-xs font-bold uppercase tracking-widest">Thêm Văn Bản</span>
                    </button>
                </header>

                {/* Search & Filter */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-cyan-400 transition-colors" size={16} />
                        <input
                            type="text"
                            placeholder="TÌM KIẾM THEO TIÊU ĐỀ..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-xs font-bold uppercase tracking-widest text-white focus:outline-none focus:border-cyan-500/50 transition-all"
                        />
                    </div>
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="bg-[#0d0d0d] border border-white/10 text-white px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:border-cyan-500 cursor-pointer"
                    >
                        <option value="">Tất cả phân loại</option>
                        {categories.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-[#0d0d0d] border border-white/10 text-white px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:border-cyan-500 cursor-pointer"
                    >
                        <option value="" className="bg-[#0d0d0d] text-white font-bold py-2">
                            Tất cả trạng thái
                        </option>
                        <option value="Còn hiệu lực" className="bg-[#0d0d0d] text-white font-bold py-2">
                            Còn hiệu lực
                        </option>
                        <option value="Hết hiệu lực" className="bg-[#0d0d0d] text-white font-bold py-2">
                            Hết hiệu lực
                        </option>
                        <option value="Chưa có hiệu lực" className="bg-[#0d0d0d] text-white font-bold py-2">
                            Chưa có hiệu lực
                        </option>
                    </select>
                </div>

                {/* Table Section */}
                <section className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-6 shadow-2xl overflow-visible">
                    <div className="overflow-x-visible">
                        <table className="w-full text-left border-collapse table-fixed">
                            <thead>
                                <tr className="text-[11px] uppercase tracking-[0.2em] text-white font-black border-b border-white/10">
                                    <th className="px-6 py-4 w-[30%]">Điều Luật </th>
                                    <th className="px-6 py-4 w-[30%]">Phân loại</th>
                                    <th className="px-6 py-4 w-[20%]">Hiệu Lực</th>
                                    <th className="px-6 py-4 w-[25%]">Trạng thái DATA</th>
                                    <th className="px-6 py-4 w-[10%] text-right"></th>
                                </tr>
                            </thead>
                            <tbody className="text-sm text-gray-300">
                                {loading ? (
                                    <tr>
                                        <td colSpan="5" className="py-20 text-center">
                                            <Loader2 className="animate-spin mx-auto mb-2 text-cyan-400" size={32} />
                                            <span className="text-[10px] uppercase tracking-widest text-gray-500">Đang đồng bộ dữ liệu...</span>
                                        </td>
                                    </tr>
                                ) : lawData.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="py-20 text-center text-gray-500 uppercase text-[10px] tracking-widest">
                                            Không tìm thấy dữ liệu phù hợp
                                        </td>
                                    </tr>
                                ) : (
                                    lawData.map((item) => (
                                        <tr key={item.Id} className="border-b border-white/5 hover:bg-white/5 transition-all group">
                                            <td className="px-6 py-4 overflow-hidden">
                                                <div className="font-bold text-white truncate w-full group-hover:text-cyan-400 transition-colors" title={item.Title}>
                                                    {item.Title}
                                                </div>
                                                <div className="text-[11px] text-gray-500 truncate w-full italic mt-0.5 opacity-60">
                                                    {item.ContentPreview || 'Bản xem trước không khả dụng'}
                                                </div>
                                            </td>

                                            <td className="px-6 py-4">
                                                <span className="inline-flex px-2 py-0.5 rounded-md text-[9px] font-black bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase truncate max-w-full">
                                                    {item.Category || 'Chưa phân loại'}
                                                </span>
                                            </td>

                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${item.Status === 'Còn hiệu lực' ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
                                                    <span className="text-[11px] font-bold whitespace-nowrap">{item.Status}</span>
                                                </div>
                                            </td>

                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center gap-1.5" title="SQL Server Storage">
                                                        <div className={`w-1 h-1 rounded-full ${item.SyncStatusSsms === 'success' ? 'bg-cyan-400' : 'bg-red-500'}`}></div>
                                                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">DB</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5" title="Pinecone Vectorized">
                                                        <div className={`w-1 h-1 rounded-full ${item.SyncStatusPinecone === 'success' ? 'bg-purple-400' : 'bg-red-500'}`}></div>
                                                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter font-mono">PINE</span>
                                                    </div>
                                                    {item.SyncStatusPinecone === 'success' && (
                                                        <span className="text-[8px] font-black bg-cyan-400/10 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-400/20">VECTORED</span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 text-right relative">
                                                <button
                                                    onClick={() => setActiveMenuId(activeMenuId === item.Id ? null : item.Id)}
                                                    className={`p-2 rounded-xl transition-all ${activeMenuId === item.Id ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' : 'hover:bg-white/10 text-gray-400'}`}
                                                >
                                                    <MoreVertical size={16} />
                                                </button>

                                                {/* Dropdown */}
                                                {activeMenuId === item.Id && (
                                                    <>
                                                        <div className="fixed inset-0 z-10" onClick={() => setActiveMenuId(null)}></div>
                                                        <div className="absolute right-6 top-14 w-44 bg-[#0d0d0d] border border-white/10 rounded-2xl shadow-2xl z-20 overflow-hidden backdrop-blur-2xl py-1 animate-in fade-in zoom-in duration-150">
                                                            <button
                                                                onClick={() => { handleViewChunks(item); setActiveMenuId(null); }}
                                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-blue-400 hover:bg-blue-400/10 transition-colors"
                                                            >
                                                                <Eye size={14} /> Xem Chunks
                                                            </button>
                                                            <button
                                                                onClick={() => { handleEdit(item); setActiveMenuId(null); }}
                                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-cyan-400 hover:bg-cyan-400/10 transition-colors border-t border-white/5"
                                                            >
                                                                <Edit2 size={14} /> Chỉnh sửa
                                                            </button>
                                                            <button
                                                                onClick={() => { openDeleteModal(item); setActiveMenuId(null); }}
                                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/10 transition-colors border-t border-white/5"
                                                            >
                                                                <Trash2 size={14} /> Gỡ bỏ
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Section - Nằm gọn trong khối Section */}
                    {totalPages > 1 && (
                        <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">
                                Hiển thị <span className="text-white">{lawData.length}</span> / <span className="text-white">{totalItems}</span> tri thức pháp luật
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronLeft size={16} />
                                </button>

                                <div className="flex items-center gap-1">
                                    <span className="text-[11px] font-black px-4 py-2 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
                                        TRANG {currentPage}
                                    </span>
                                    <span className="text-[10px] font-bold text-gray-600 px-2">/</span>
                                    <span className="text-[11px] font-black text-gray-400 px-3">
                                        {totalPages}
                                    </span>
                                </div>

                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </section>

                {/* Add Modal */}
                {showAddModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className={`${glassClass} w-full max-w-4xl mx-4 rounded-3xl p-6 max-h-[90vh] overflow-y-auto`}>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-black text-white uppercase tracking-tighter">Thêm Văn Bản Mới</h2>
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    ✕
                                </button>
                            </div>

                            <form onSubmit={handleAdd} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Tiêu đề *</label>
                                        <input
                                            type="text"
                                            name="title"
                                            value={formData.title}
                                            onChange={handleFormChange}
                                            className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 rounded-xl outline-none focus:border-cyan-500"
                                            placeholder="Ví dụ: Điều 117. Điều kiện có hiệu lực của giao dịch dân sự"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Số văn bản</label>
                                        <input
                                            type="text"
                                            name="documentNumber"
                                            value={formData.documentNumber}
                                            onChange={handleFormChange}
                                            className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 rounded-xl outline-none focus:border-cyan-500"
                                            placeholder="Ví dụ: 103/NQ-CP"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Năm ban hành</label>
                                        <input
                                            type="number"
                                            name="issueYear"
                                            value={formData.issueYear}
                                            onChange={handleFormChange}
                                            className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 rounded-xl outline-none focus:border-cyan-500"
                                            placeholder="Ví dụ: 2015"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Phân loại</label>
                                        <select
                                            name="category"
                                            value={formData.category}
                                            onChange={handleFormChange}
                                            className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 rounded-xl outline-none focus:border-cyan-500"
                                        >
                                            <option value="">Chọn phân loại</option>
                                            <option value="Luật Dân sự">Luật Dân sự</option>
                                            <option value="Luật Thương mại">Luật Thương mại</option>
                                            <option value="Luật Doanh nghiệp">Luật Doanh nghiệp</option>
                                            <option value="Luật Lao động">Luật Lao động</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Trạng thái hiệu lực</label>
                                        <select
                                            name="status"
                                            value={formData.status}
                                            onChange={handleFormChange}
                                            className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 rounded-xl outline-none focus:border-cyan-500"
                                        >
                                            <option value="Còn hiệu lực">Còn hiệu lực</option>
                                            <option value="Hết hiệu lực">Hết hiệu lực</option>
                                            <option value="Chưa có hiệu lực">Chưa có hiệu lực</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">URL nguồn</label>
                                    <input
                                        type="url"
                                        name="sourceUrl"
                                        value={formData.sourceUrl}
                                        onChange={handleFormChange}
                                        className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 rounded-xl outline-none focus:border-cyan-500"
                                        placeholder="https://thuvienphapluat.vn/..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Nội dung đầy đủ *</label>
                                    <textarea
                                        name="content"
                                        value={formData.content}
                                        onChange={handleFormChange}
                                        rows={8}
                                        className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 rounded-xl outline-none focus:border-cyan-500"
                                        placeholder="Nhập toàn bộ nội dung điều luật..."
                                        required
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(false)}
                                        className="flex-1 px-4 py-2 bg-white/5 text-gray-400 border border-white/10 rounded-xl hover:bg-white/10 transition-all"
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={modalLoading}
                                        className="flex-1 px-4 py-2 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-xl hover:bg-cyan-500/20 transition-all disabled:opacity-50"
                                    >
                                        {modalLoading ? 'Đang thêm...' : 'Thêm mới'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Edit Modal */}
                {showEditModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className={`${glassClass} w-full max-w-4xl mx-4 rounded-3xl p-6 max-h-[90vh] overflow-y-auto`}>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-black text-white uppercase tracking-tighter">Sửa Văn Bản</h2>
                                <button
                                    onClick={() => setShowEditModal(false)}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    ✕
                                </button>
                            </div>

                            <form onSubmit={handleUpdate} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Tiêu đề *</label>
                                        <input
                                            type="text"
                                            name="title"
                                            value={formData.title}
                                            onChange={handleFormChange}
                                            className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 rounded-xl outline-none focus:border-cyan-500"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Số văn bản</label>
                                        <input
                                            type="text"
                                            name="documentNumber"
                                            value={formData.documentNumber}
                                            onChange={handleFormChange}
                                            className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 rounded-xl outline-none focus:border-cyan-500"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Năm ban hành</label>
                                        <input
                                            type="number"
                                            name="issueYear"
                                            value={formData.issueYear}
                                            onChange={handleFormChange}
                                            className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 rounded-xl outline-none focus:border-cyan-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Phân loại</label>
                                        <select
                                            name="category"
                                            value={formData.category}
                                            onChange={handleFormChange}
                                            className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 rounded-xl outline-none focus:border-cyan-500"
                                        >
                                            <option value="">Chọn phân loại</option>
                                            <option value="Luật Dân sự">Luật Dân sự</option>
                                            <option value="Luật Thương mại">Luật Thương mại</option>
                                            <option value="Luật Doanh nghiệp">Luật Doanh nghiệp</option>
                                            <option value="Luật Lao động">Luật Lao động</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Trạng thái hiệu lực</label>
                                        <select
                                            name="status"
                                            value={formData.status}
                                            onChange={handleFormChange}
                                            className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 rounded-xl outline-none focus:border-cyan-500"
                                        >
                                            <option value="Còn hiệu lực">Còn hiệu lực</option>
                                            <option value="Hết hiệu lực">Hết hiệu lực</option>
                                            <option value="Chưa có hiệu lực">Chưa có hiệu lực</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">URL nguồn</label>
                                    <input
                                        type="url"
                                        name="sourceUrl"
                                        value={formData.sourceUrl}
                                        onChange={handleFormChange}
                                        className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 rounded-xl outline-none focus:border-cyan-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Nội dung đầy đủ *</label>
                                    <textarea
                                        name="content"
                                        value={formData.content}
                                        onChange={handleFormChange}
                                        rows={8}
                                        className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 rounded-xl outline-none focus:border-cyan-500"
                                        required
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowEditModal(false)}
                                        className="flex-1 px-4 py-2 bg-white/5 text-gray-400 border border-white/10 rounded-xl hover:bg-white/10 transition-all"
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={modalLoading}
                                        className="flex-1 px-4 py-2 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-xl hover:bg-cyan-500/20 transition-all disabled:opacity-50"
                                    >
                                        {modalLoading ? 'Đang cập nhật...' : 'Cập nhật'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Chunks Modal */}
                {showChunksModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className={`${glassClass} w-full max-w-4xl mx-4 rounded-3xl p-6 max-h-[90vh] overflow-y-auto`}>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-black text-white uppercase tracking-tighter">Preview Chunks</h2>
                                <button
                                    onClick={() => setShowChunksModal(false)}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    ✕
                                </button>
                            </div>

                            {chunksLoading ? (
                                <div className="text-center py-10 text-gray-500">
                                    <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                                    Đang tải chunks...
                                </div>
                            ) : chunksData.length === 0 ? (
                                <div className="text-center py-10 text-gray-500">Không có chunks nào.</div>
                            ) : (
                                <div className="space-y-4">
                                    {chunksData.map((chunk, index) => (
                                        <div key={index} className="bg-white/5 rounded-3xl border border-white/10 p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">Chunk {index + 1}</span>
                                                <span className="text-xs text-gray-500">{chunk.length} ký tự</span>
                                            </div>
                                            <p className="text-sm text-gray-300 leading-relaxed">{chunk}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Delete Modal */}
                {showDeleteModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className={`${glassClass} w-full max-w-md mx-4 rounded-3xl p-6`}>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-black text-white uppercase tracking-tighter">Xác nhận xóa</h2>
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="text-center mb-6">
                                <AlertTriangle size={48} className="text-red-400 mx-auto mb-4" />
                                <p className="text-sm text-gray-300">
                                    Bạn có chắc muốn xóa "<span className="text-white font-bold">{selectedDoc?.Title}</span>"?
                                </p>
                                <p className="text-xs text-gray-500 mt-2">Hành động này không thể hoàn tác.</p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    className="flex-1 px-4 py-2 bg-white/5 text-gray-400 border border-white/10 rounded-xl hover:bg-white/10 transition-all"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    disabled={modalLoading}
                                    className="flex-1 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-all disabled:opacity-50"
                                >
                                    {modalLoading ? 'Đang xóa...' : 'Xóa'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(34, 211, 238, 0.1); border-radius: 10px; }
            `}</style>
        </div>
    );
}