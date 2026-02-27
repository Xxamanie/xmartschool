import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Library as LibraryType, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { Upload, FileText, Image, File, Download, Trash2 } from 'lucide-react';

export const Library: React.FC = () => {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<LibraryType[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', file: null as File | null });

  const canUpload = user?.role === UserRole.ADMIN || user?.role === UserRole.TEACHER;

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    setLoading(true);
    const res = await api.getLibraryMaterials(user?.schoolId);
    if (res.ok) {
      setMaterials(res.data);
    }
    setLoading(false);
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image size={20} className="text-green-600" />;
    if (fileType === 'application/pdf') return <FileText size={20} className="text-red-600" />;
    return <File size={20} className="text-blue-600" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.file || !user?.schoolId) return;

    setUploading(true);
    try {
      // In a real app, you'd upload to Firebase/S3 and get the URL
      // For now, we'll create a mock URL
      const fileUrl = URL.createObjectURL(form.file);
      
      const res = await api.createLibraryMaterial({
        title: form.title,
        description: form.description,
        fileUrl,
        fileType: form.file.type,
        fileName: form.file.name,
        fileSize: form.file.size,
        schoolId: user.schoolId,
        uploadedBy: user.name || user.id,
      });

      if (res.ok) {
        setMaterials((prev) => [res.data, ...prev]);
        setForm({ title: '', description: '', file: null });
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this material?')) return;
    
    const res = await api.deleteLibraryMaterial(id);
    if (res.ok) {
      setMaterials((prev) => prev.filter((m) => m.id !== id));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setForm((prev) => ({ ...prev, file, title: prev.title || file.name }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Library</h1>
          <p className="text-gray-500">Access and upload literacy materials (PDFs, documents, images)</p>
        </div>
      </div>

      {canUpload && (
        <form onSubmit={handleUpload} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded-lg p-2"
                placeholder="Material title"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded-lg p-2"
                placeholder="Brief description (optional)"
              />
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium text-gray-700">File *</label>
            <input
              type="file"
              onChange={handleFileChange}
              className="mt-1 w-full border border-gray-300 rounded-lg p-2"
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
              required
            />
            {form.file && (
              <p className="mt-1 text-sm text-gray-500">
                Selected: {form.file.name} ({formatFileSize(form.file.size)})
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={uploading || !form.file}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-60"
          >
            <Upload size={16} /> {uploading ? 'Uploading...' : 'Upload Material'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading materials...</div>
      ) : materials.length === 0 ? (
        <div className="text-center py-8 text-gray-500 bg-white rounded-xl border border-gray-200">
          <FileText size={48} className="mx-auto mb-4 text-gray-300" />
          <p>No materials uploaded yet.</p>
          {canUpload && <p className="text-sm mt-1">Upload your first material using the form above.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {materials.map((material) => (
            <div key={material.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-gray-50 rounded-lg">
                  {getFileIcon(material.fileType)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{material.title}</h3>
                  {material.description && (
                    <p className="text-sm text-gray-500 truncate">{material.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>{formatFileSize(material.fileSize)}</span>
                <span>{material.fileType.split('/')[1] || material.fileType}</span>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                <span>By: {material.uploadedBy}</span>
                <span>{new Date(material.createdAt).toLocaleDateString()}</span>
              </div>

              <div className="flex gap-2 mt-auto pt-2">
                <a
                  href={material.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-primary-600 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-primary-700"
                >
                  <Download size={16} />
                  Download
                </a>
                {canUpload && (
                  <button
                    onClick={() => handleDelete(material.id)}
                    className="inline-flex items-center justify-center gap-2 bg-red-50 text-red-600 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-red-100"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
