import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { Document as DocxDocument, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  Bold,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  FileType,
  Heading1,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Plus,
  RotateCw,
  Save,
  Trash2,
  Underline,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useQAVault } from '../store/QAVaultContext';
import type { DocumentType, ExcelSheetData, PdfAnnotation, QADocument } from '../types/qa';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function DocTypeIcon({ type, className = 'w-4 h-4' }: { type: DocumentType; className?: string }) {
  if (type === 'excel') return <FileSpreadsheet className={`${className} text-emerald-600 shrink-0`} />;
  if (type === 'word') return <FileText className={`${className} text-sky-600 shrink-0`} />;
  return <FileType className={`${className} text-rose-600 shrink-0`} />;
}

export const DocumentsView: React.FC = () => {
  const { state, searchQuery, uploadDocument, updateDocument, softDeleteDocument, currentUser } =
    useQAVault();

  const activeDocs = useMemo(() => {
    return state.documents.filter((d) => {
      if (d.isDeleted) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return d.name.toLowerCase().includes(q) || d.docType.toLowerCase().includes(q);
      }
      return true;
    });
  }, [state.documents, searchQuery]);

  const [selectedDocId, setSelectedDocId] = useState<string | null>(
    () => activeDocs[0]?.id || null
  );
  const [filterType, setFilterType] = useState<'all' | DocumentType>('all');
  const [isDragging, setIsDragging] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedDoc = useMemo(
    () => activeDocs.find((d) => d.id === selectedDocId) || activeDocs[0] || null,
    [activeDocs, selectedDocId]
  );

  // Excel editor state
  const [sheets, setSheets] = useState<ExcelSheetData[]>([]);
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);

  // Word editor state
  const wordEditorRef = useRef<HTMLDivElement>(null);
  const [wordHtml, setWordHtml] = useState('');

  // PDF viewer & editor state
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfPageCount, setPdfPageCount] = useState(1);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfZoom, setPdfZoom] = useState(1.1);
  const [pdfNoteText, setPdfNoteText] = useState('QA Verified');
  const [pdfNoteColor, setPdfNoteColor] = useState('#0D9488');
  const [pdfMetadata, setPdfMetadata] = useState({ title: '', author: '', subject: '' });
  const [pdfAnnotations, setPdfAnnotations] = useState<PdfAnnotation[]>([]);
  const [pdfRenderError, setPdfRenderError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  // Sync local editor state when selectedDoc changes
  useEffect(() => {
    if (!selectedDoc) return;
    if (selectedDoc.docType === 'excel') {
      setSheets(
        selectedDoc.sheets && selectedDoc.sheets.length > 0
          ? JSON.parse(JSON.stringify(selectedDoc.sheets))
          : [{ name: 'Sheet1', rows: [['Column A', 'Column B'], ['', '']] }]
      );
      setActiveSheetIdx(0);
    } else if (selectedDoc.docType === 'word') {
      const html = selectedDoc.htmlContent || '<p></p>';
      setWordHtml(html);
      if (wordEditorRef.current) {
        wordEditorRef.current.innerHTML = html;
      }
    } else if (selectedDoc.docType === 'pdf') {
      setPdfPage(1);
      setPdfAnnotations(selectedDoc.pdfAnnotations || []);
      setPdfMetadata(
        selectedDoc.pdfMetadata || {
          title: selectedDoc.name,
          author: currentUser?.name || 'Admin',
          subject: 'QA Vault Document',
        }
      );
    }
  }, [selectedDoc?.id, selectedDoc?.updatedAt]);

  // Render PDF page via pdfjs-dist
  const renderPdfPage = useCallback(async () => {
    if (!selectedDoc || selectedDoc.docType !== 'pdf' || !selectedDoc.contentBase64) return;
    const canvas = pdfCanvasRef.current;
    if (!canvas) return;
    setPdfRenderError(null);

    try {
      const bytes = base64ToUint8Array(selectedDoc.contentBase64);
      const loadingTask = pdfjsLib.getDocument({ data: bytes });
      const pdf = await loadingTask.promise;
      setPdfPageCount(pdf.numPages);
      const clampedPage = Math.min(Math.max(1, pdfPage), pdf.numPages);
      const page = await pdf.getPage(clampedPage);
      const viewport = page.getViewport({ scale: pdfZoom });
      const context = canvas.getContext('2d');
      if (!context) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      await page.render({ canvasContext: context, viewport, canvas }).promise;
    } catch (err) {
      console.error('PDF render error:', err);
      setPdfRenderError('Unable to render PDF preview. Verify the file is a valid PDF.');
    }
  }, [selectedDoc, pdfPage, pdfZoom]);

  useEffect(() => {
    renderPdfPage();
  }, [renderPdfPage]);

  const showToast = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3200);
  };

  // File Upload Handler (Excel, Word, PDF)
  const processUploadedFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const arrayBuffer = await file.arrayBuffer();

    if (['xlsx', 'xls', 'csv'].includes(ext)) {
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const parsedSheets: ExcelSheetData[] = workbook.SheetNames.map((sheetName) => {
        const ws = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
        const rows = rawRows.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '')) : []));
        if (rows.length === 0) rows.push(['', '']);
        return { name: sheetName, rows };
      });
      const created = await uploadDocument({
        name: file.name,
        docType: 'excel',
        mimeType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: file.size,
        sheets: parsedSheets,
      });
      if (created) {
        setSelectedDocId(created.id);
        showToast(`Uploaded Excel workbook "${file.name}".`);
      }
      return;
    }

    if (['docx', 'doc', 'txt', 'md'].includes(ext)) {
      let html = '';
      if (ext === 'docx') {
        const result = await mammoth.convertToHtml({ arrayBuffer });
        html = result.value || '<p>Empty document</p>';
      } else {
        const text = new TextDecoder().decode(arrayBuffer);
        html = text
          .split('\n')
          .map((line) => `<p>${line.replace(/</g, '&lt;').replace(/>/g, '&gt;') || '&nbsp;'}</p>`)
          .join('');
      }
      const created = await uploadDocument({
        name: file.name,
        docType: 'word',
        mimeType: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: file.size,
        htmlContent: html,
      });
      if (created) {
        setSelectedDocId(created.id);
        showToast(`Uploaded Word document "${file.name}".`);
      }
      return;
    }

    if (ext === 'pdf') {
      const bytes = new Uint8Array(arrayBuffer);
      const base64 = uint8ArrayToBase64(bytes);
      let meta = { title: file.name, author: currentUser?.name || 'Admin', subject: 'QA Document' };
      try {
        const pdfDoc = await PDFDocument.load(bytes);
        meta = {
          title: pdfDoc.getTitle() || file.name,
          author: pdfDoc.getAuthor() || currentUser?.name || 'Admin',
          subject: pdfDoc.getSubject() || 'QA Document',
        };
      } catch {
        // fallback metadata
      }
      const created = await uploadDocument({
        name: file.name,
        docType: 'pdf',
        mimeType: 'application/pdf',
        size: file.size,
        contentBase64: base64,
        pdfAnnotations: [],
        pdfMetadata: meta,
      });
      if (created) {
        setSelectedDocId(created.id);
        showToast(`Uploaded PDF "${file.name}".`);
      }
      return;
    }

    showToast('Unsupported format. Upload Excel (.xlsx, .xls, .csv), Word (.docx, .txt), or PDF (.pdf).');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      await processUploadedFile(file);
    }
    e.target.value = '';
  };

  // Create blank Excel or Word doc
  const handleCreateBlank = async (docType: 'excel' | 'word') => {
    const stamp = new Date().toISOString().slice(0, 10);
    if (docType === 'excel') {
      const created = await uploadDocument({
        name: `QA_Sheet_${stamp}.xlsx`,
        docType: 'excel',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 2048,
        sheets: [
          {
            name: 'Test Cases',
            rows: [
              ['Case ID', 'Scenario', 'Expected Result', 'Status'],
              ['TC-01', 'Verify login validation', 'Redirects to Dashboard', 'Pending'],
            ],
          },
        ],
      });
      if (created) setSelectedDocId(created.id);
    } else {
      const created = await uploadDocument({
        name: `QA_Notes_${stamp}.docx`,
        docType: 'word',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 1024,
        htmlContent: `<h1>QA Test Plan - ${stamp}</h1><p>Enter test scope, assumptions, and release sign-off notes here.</p>`,
      });
      if (created) setSelectedDocId(created.id);
    }
  };

  // Excel cell editing
  const updateCell = (rowIdx: number, colIdx: number, value: string) => {
    setSheets((prev) =>
      prev.map((sheet, idx) => {
        if (idx !== activeSheetIdx) return sheet;
        const nextRows = sheet.rows.map((r, rI) =>
          rI === rowIdx ? r.map((c, cI) => (cI === colIdx ? value : c)) : r
        );
        return { ...sheet, rows: nextRows };
      })
    );
  };

  const addExcelRow = () => {
    setSheets((prev) =>
      prev.map((sheet, idx) => {
        if (idx !== activeSheetIdx) return sheet;
        const colCount = Math.max(sheet.rows[0]?.length || 3, 1);
        return { ...sheet, rows: [...sheet.rows, Array(colCount).fill('')] };
      })
    );
  };

  const addExcelColumn = () => {
    setSheets((prev) =>
      prev.map((sheet, idx) => {
        if (idx !== activeSheetIdx) return sheet;
        return {
          ...sheet,
          rows: sheet.rows.map((r, rI) => [...r, rI === 0 ? `Col ${r.length + 1}` : '']),
        };
      })
    );
  };

  const saveExcel = async () => {
    if (!selectedDoc) return;
    setSaving(true);
    try {
      await updateDocument(selectedDoc.id, { sheets });
      showToast('Excel workbook saved.');
    } finally {
      setSaving(false);
    }
  };

  const downloadExcel = () => {
    if (!selectedDoc) return;
    const wb = XLSX.utils.book_new();
    sheets.forEach((s) => {
      const ws = XLSX.utils.aoa_to_sheet(s.rows);
      XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31) || 'Sheet');
    });
    const outName = selectedDoc.name.endsWith('.xlsx') ? selectedDoc.name : `${selectedDoc.name}.xlsx`;
    XLSX.writeFile(wb, outName);
  };

  // Word rich-text editing
  const execWordCmd = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    if (wordEditorRef.current) {
      setWordHtml(wordEditorRef.current.innerHTML);
    }
  };

  const saveWord = async () => {
    if (!selectedDoc) return;
    setSaving(true);
    const html = wordEditorRef.current?.innerHTML || wordHtml;
    try {
      await updateDocument(selectedDoc.id, { htmlContent: html });
      showToast('Word document saved.');
    } finally {
      setSaving(false);
    }
  };

  const downloadWord = async () => {
    if (!selectedDoc) return;
    const html = wordEditorRef.current?.innerHTML || wordHtml;
    const parser = new DOMParser();
    const parsed = parser.parseFromString(html, 'text/html');
    const paragraphs: Paragraph[] = [];

    parsed.body.childNodes.forEach((node) => {
      const text = (node.textContent || '').trim();
      if (!text) return;
      const tag = (node as Element).tagName?.toUpperCase();
      if (tag === 'H1') {
        paragraphs.push(new Paragraph({ text, heading: HeadingLevel.HEADING_1 }));
      } else if (tag === 'H2') {
        paragraphs.push(new Paragraph({ text, heading: HeadingLevel.HEADING_2 }));
      } else if (tag === 'UL' || tag === 'OL') {
        (node as Element).querySelectorAll('li').forEach((li) => {
          paragraphs.push(
            new Paragraph({
              children: [new TextRun(`• ${(li.textContent || '').trim()}`)],
            })
          );
        });
      } else {
        paragraphs.push(new Paragraph({ children: [new TextRun(text)] }));
      }
    });

    if (paragraphs.length === 0) {
      paragraphs.push(new Paragraph({ children: [new TextRun('')] }));
    }

    const doc = new DocxDocument({
      sections: [{ children: paragraphs }],
    });
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedDoc.name.endsWith('.docx') ? selectedDoc.name : `${selectedDoc.name}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // PDF editing (place text stamp on canvas + rotate + metadata + save with pdf-lib)
  const handlePdfCanvasClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedDoc || !selectedDoc.contentBase64 || !pdfNoteText.trim()) return;
    const canvas = pdfCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert CSS pixels to PDF points
    const pdfDoc = await PDFDocument.load(base64ToUint8Array(selectedDoc.contentBase64));
    const page = pdfDoc.getPage(pdfPage - 1);
    const { width, height } = page.getSize();
    const pdfX = (clickX / rect.width) * width;
    const pdfY = height - (clickY / rect.height) * height;

    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const hex = pdfNoteColor.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;

    page.drawText(pdfNoteText.trim(), {
      x: Math.max(12, Math.min(width - 100, pdfX)),
      y: Math.max(12, Math.min(height - 20, pdfY)),
      size: 12,
      font,
      color: rgb(r, g, b),
    });

    const newBytes = await pdfDoc.save();
    const newBase64 = uint8ArrayToBase64(newBytes);
    const newAnn: PdfAnnotation = {
      id: `ann-${Date.now()}`,
      page: pdfPage,
      x: Math.round(pdfX),
      y: Math.round(pdfY),
      text: pdfNoteText.trim(),
      color: pdfNoteColor,
      fontSize: 12,
      author: currentUser?.name || 'Admin',
      createdAt: new Date().toISOString(),
    };
    const nextAnnotations = [...pdfAnnotations, newAnn];
    setPdfAnnotations(nextAnnotations);
    await updateDocument(selectedDoc.id, {
      contentBase64: newBase64,
      size: newBytes.length,
      pdfAnnotations: nextAnnotations,
    });
    showToast(`Stamped "${pdfNoteText.trim()}" onto page ${pdfPage}.`);
  };

  const rotateCurrentPdfPage = async () => {
    if (!selectedDoc || !selectedDoc.contentBase64) return;
    setSaving(true);
    try {
      const pdfDoc = await PDFDocument.load(base64ToUint8Array(selectedDoc.contentBase64));
      const page = pdfDoc.getPage(pdfPage - 1);
      const currentRot = page.getRotation().angle;
      page.setRotation(degrees((currentRot + 90) % 360));
      const newBytes = await pdfDoc.save();
      await updateDocument(selectedDoc.id, {
        contentBase64: uint8ArrayToBase64(newBytes),
        size: newBytes.length,
      });
      showToast(`Rotated page ${pdfPage} by 90°.`);
    } finally {
      setSaving(false);
    }
  };

  const savePdfMetadata = async () => {
    if (!selectedDoc || !selectedDoc.contentBase64) return;
    setSaving(true);
    try {
      const pdfDoc = await PDFDocument.load(base64ToUint8Array(selectedDoc.contentBase64));
      pdfDoc.setTitle(pdfMetadata.title || selectedDoc.name);
      pdfDoc.setAuthor(pdfMetadata.author || 'Admin');
      pdfDoc.setSubject(pdfMetadata.subject || 'QA Vault');
      const newBytes = await pdfDoc.save();
      await updateDocument(selectedDoc.id, {
        contentBase64: uint8ArrayToBase64(newBytes),
        pdfMetadata,
        size: newBytes.length,
      });
      showToast('PDF metadata saved.');
    } finally {
      setSaving(false);
    }
  };

  const downloadPdf = () => {
    if (!selectedDoc || !selectedDoc.contentBase64) return;
    const bytes = base64ToUint8Array(selectedDoc.contentBase64);
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedDoc.name.endsWith('.pdf') ? selectedDoc.name : `${selectedDoc.name}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredDocs = activeDocs.filter((d) => filterType === 'all' || d.docType === filterType);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Documents</h1>
          <p className="mt-1 text-sm text-slate-500">
            Upload, inspect, edit, and export Excel spreadsheets, Word documents, and PDFs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleCreateBlank('excel')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-600" />
            New Excel
          </button>
          <button
            type="button"
            onClick={() => handleCreateBlank('word')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Plus className="w-3.5 h-3.5 text-sky-600" />
            New Word Doc
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Document
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".xlsx,.xls,.csv,.docx,.doc,.txt,.md,.pdf"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      {statusMessage && (
        <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-2.5 text-xs font-medium text-teal-800">
          {statusMessage}
        </div>
      )}

      {/* Upload Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setIsDragging(false);
          const files = Array.from(e.dataTransfer.files);
          for (const f of files) {
            await processUploadedFile(f);
          }
        }}
        className={`flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-dashed px-5 py-3.5 transition-colors ${
          isDragging ? 'border-teal-600 bg-teal-50/70' : 'border-slate-300 bg-white'
        }`}
      >
        <div className="flex items-center gap-3">
          <Upload className="w-4 h-4 text-teal-600 shrink-0" />
          <p className="text-xs text-slate-600">
            Drag and drop <span className="font-semibold text-slate-900">Excel (.xlsx, .csv)</span>,{' '}
            <span className="font-semibold text-slate-900">Word (.docx, .txt)</span>, or{' '}
            <span className="font-semibold text-slate-900">PDF (.pdf)</span> files here to view and edit.
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-xs font-semibold text-teal-700 hover:underline whitespace-nowrap"
        >
          Browse files
        </button>
      </div>

      {/* Main Split: Document Library (Left) + Viewer/Editor (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left List (4 cols) */}
        <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <span className="text-xs font-semibold text-slate-800">
              Library ({filteredDocs.length})
            </span>
            <div className="flex items-center gap-1 rounded-md bg-slate-100 p-0.5">
              {(['all', 'excel', 'word', 'pdf'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilterType(t)}
                  className={`rounded px-2 py-1 text-[11px] font-medium capitalize ${
                    filterType === t
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {filteredDocs.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-slate-500">
              No documents match this filter. Upload an Excel, Word, or PDF file above.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {filteredDocs.map((doc) => {
                const isSelected = selectedDoc?.id === doc.id;
                return (
                  <div
                    key={doc.id}
                    className={`flex items-center justify-between gap-2 px-4 py-3 transition-colors ${
                      isSelected ? 'bg-teal-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedDocId(doc.id)}
                      className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
                    >
                      <DocTypeIcon type={doc.docType} className="w-4 h-4 mt-0.5" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-900">{doc.name}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
                          {doc.docType.toUpperCase()} · {formatBytes(doc.size)} · {doc.uploadedBy}
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => softDeleteDocument(doc.id)}
                      className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 shrink-0"
                      title="Move to Recycle Bin"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Viewer & Editor (8 cols) */}
        <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-white overflow-hidden">
          {!selectedDoc ? (
            <div className="px-6 py-20 text-center text-sm text-slate-500">
              Select a document from the library or upload a new file to start viewing and editing.
            </div>
          ) : selectedDoc.docType === 'excel' ? (
            /* EXCEL VIEWER & EDITOR */
            <div className="flex flex-col">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <DocTypeIcon type="excel" className="w-4 h-4" />
                  <h2 className="text-sm font-semibold text-slate-900">{selectedDoc.name}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={addExcelRow}
                    className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    + Row
                  </button>
                  <button
                    type="button"
                    onClick={addExcelColumn}
                    className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    + Column
                  </button>
                  <button
                    type="button"
                    onClick={saveExcel}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={downloadExcel}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export .xlsx
                  </button>
                </div>
              </div>

              {/* Sheet Tabs */}
              <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-4 py-2 overflow-x-auto">
                {sheets.map((s, idx) => (
                  <button
                    key={`${s.name}-${idx}`}
                    type="button"
                    onClick={() => setActiveSheetIdx(idx)}
                    className={`rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap ${
                      idx === activeSheetIdx
                        ? 'bg-white text-slate-900 border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>

              {/* Editable Grid */}
              <div className="overflow-auto max-h-[540px]">
                <table className="w-full border-collapse text-xs">
                  <tbody>
                    {(sheets[activeSheetIdx]?.rows || []).map((row, rIdx) => (
                      <tr key={rIdx} className={rIdx === 0 ? 'bg-slate-50 font-semibold' : 'bg-white'}>
                        <td className="w-10 border-b border-r border-slate-200 bg-slate-50 px-2 py-1.5 text-center font-mono text-[11px] text-slate-400 tabular-nums">
                          {rIdx + 1}
                        </td>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="border-b border-r border-slate-200 p-0 min-w-[130px]">
                            <input
                              type="text"
                              value={cell}
                              onChange={(e) => updateCell(rIdx, cIdx, e.target.value)}
                              className={`w-full px-2.5 py-2 text-xs focus:bg-teal-50/40 focus:outline-none ${
                                rIdx === 0 ? 'font-semibold text-slate-900' : 'text-slate-700'
                              }`}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : selectedDoc.docType === 'word' ? (
            /* WORD DOCUMENT VIEWER & EDITOR */
            <div className="flex flex-col">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <DocTypeIcon type="word" className="w-4 h-4" />
                  <h2 className="text-sm font-semibold text-slate-900">{selectedDoc.name}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={saveWord}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={downloadWord}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export .docx
                  </button>
                </div>
              </div>

              {/* Formatting Toolbar */}
              <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-4 py-2">
                <button
                  type="button"
                  onClick={() => execWordCmd('bold')}
                  className="rounded p-1.5 text-slate-600 hover:bg-white hover:text-slate-900"
                  title="Bold"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execWordCmd('italic')}
                  className="rounded p-1.5 text-slate-600 hover:bg-white hover:text-slate-900"
                  title="Italic"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execWordCmd('underline')}
                  className="rounded p-1.5 text-slate-600 hover:bg-white hover:text-slate-900"
                  title="Underline"
                >
                  <Underline className="w-3.5 h-3.5" />
                </button>
                <span className="mx-1 h-4 w-px bg-slate-200" />
                <button
                  type="button"
                  onClick={() => execWordCmd('formatBlock', '<h1>')}
                  className="rounded p-1.5 text-slate-600 hover:bg-white hover:text-slate-900"
                  title="Heading 1"
                >
                  <Heading1 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execWordCmd('formatBlock', '<h2>')}
                  className="rounded p-1.5 text-slate-600 hover:bg-white hover:text-slate-900"
                  title="Heading 2"
                >
                  <Heading2 className="w-3.5 h-3.5" />
                </button>
                <span className="mx-1 h-4 w-px bg-slate-200" />
                <button
                  type="button"
                  onClick={() => execWordCmd('insertUnorderedList')}
                  className="rounded p-1.5 text-slate-600 hover:bg-white hover:text-slate-900"
                  title="Bullet List"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execWordCmd('insertOrderedList')}
                  className="rounded p-1.5 text-slate-600 hover:bg-white hover:text-slate-900"
                  title="Numbered List"
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Editable Document Page */}
              <div className="bg-slate-100/70 p-6 max-h-[560px] overflow-y-auto">
                <div
                  ref={wordEditorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) => setWordHtml((e.target as HTMLDivElement).innerHTML)}
                  className="mx-auto min-h-[420px] max-w-2xl rounded-lg border border-slate-200 bg-white p-8 text-sm leading-relaxed text-slate-800 shadow-xs focus:outline-none [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2"
                />
              </div>
            </div>
          ) : (
            /* PDF VIEWER & EDITOR */
            <div className="flex flex-col">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <DocTypeIcon type="pdf" className="w-4 h-4" />
                  <h2 className="text-sm font-semibold text-slate-900">{selectedDoc.name}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 rounded-md border border-slate-200 px-1.5 py-1 text-xs">
                    <button
                      type="button"
                      disabled={pdfPage <= 1}
                      onClick={() => setPdfPage((p) => Math.max(1, p - 1))}
                      className="p-0.5 text-slate-600 disabled:opacity-40"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-1.5 font-mono text-[11px] tabular-nums">
                      {pdfPage} / {pdfPageCount}
                    </span>
                    <button
                      type="button"
                      disabled={pdfPage >= pdfPageCount}
                      onClick={() => setPdfPage((p) => Math.min(pdfPageCount, p + 1))}
                      className="p-0.5 text-slate-600 disabled:opacity-40"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setPdfZoom((z) => Math.max(0.6, Number((z - 0.15).toFixed(2))))}
                    className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPdfZoom((z) => Math.min(2.0, Number((z + 0.15).toFixed(2))))}
                    className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={rotateCurrentPdfPage}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    title="Rotate current page 90°"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Rotate
                  </button>
                  <button
                    type="button"
                    onClick={downloadPdf}
                    className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download PDF
                  </button>
                </div>
              </div>

              {/* PDF Annotation & Metadata Toolbar */}
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700">Click PDF page to stamp text:</span>
                  <input
                    type="text"
                    value={pdfNoteText}
                    onChange={(e) => setPdfNoteText(e.target.value)}
                    placeholder="Annotation or stamp text..."
                    className="flex-1 min-w-[180px] rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                  <select
                    value={pdfNoteColor}
                    onChange={(e) => setPdfNoteColor(e.target.value)}
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                  >
                    <option value="#0D9488">Teal (Approved)</option>
                    <option value="#DC2626">Crimson (Defect)</option>
                    <option value="#0284C7">Blue (Note)</option>
                    <option value="#0F172A">Slate (Ink)</option>
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/70">
                  <input
                    type="text"
                    value={pdfMetadata.title}
                    onChange={(e) => setPdfMetadata((m) => ({ ...m, title: e.target.value }))}
                    placeholder="PDF Title"
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 flex-1 min-w-[140px]"
                  />
                  <input
                    type="text"
                    value={pdfMetadata.author}
                    onChange={(e) => setPdfMetadata((m) => ({ ...m, author: e.target.value }))}
                    placeholder="Author"
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 w-36"
                  />
                  <button
                    type="button"
                    onClick={savePdfMetadata}
                    disabled={saving}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    <Save className="w-3 h-3" />
                    Save Metadata
                  </button>
                </div>
              </div>

              {/* PDF Canvas Viewport */}
              <div className="bg-slate-100 p-6 flex justify-center overflow-auto max-h-[540px]">
                {pdfRenderError ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
                    {pdfRenderError}
                  </div>
                ) : (
                  <canvas
                    ref={pdfCanvasRef}
                    onClick={handlePdfCanvasClick}
                    title="Click anywhere on the PDF to place your annotation text"
                    className="cursor-crosshair rounded border border-slate-300 bg-white shadow-sm"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
