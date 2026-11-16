export type WorkItemType = 'User Story' | 'Task' | 'Bug' | 'Test Case';

export type WorkItemState = 'New' | 'Active' | 'Resolved' | 'Closed' | 'Passed' | 'Failed';

export type WorkItemPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export type ValueArea = 'Business' | 'Architectural' | 'QA';

export type UserRole = 'Admin' | 'Manager';

export type DocumentType = 'excel' | 'word' | 'pdf';

export interface QAUser {
  id: string;
  username: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  initials: string;
  avatarColor: string;
  createdAt: string;
}

export interface WorkItem {
  id: number;
  order: number;
  parentId: number | null;
  type: WorkItemType;
  title: string;
  description: string;
  state: WorkItemState;
  priority: WorkItemPriority;
  storyPoints: number | null;
  valueArea: ValueArea;
  iterationPath: string;
  areaPath: string;
  assignedToId: string | null;
  assignedToName: string;
  tags: string[];
  testSteps?: string;
  expectedResult?: string;
  reproSteps?: string;
  severity?: 'Low' | 'Medium' | 'High' | 'Critical';
  isDeleted: boolean;
  deletedAt: string | null;
  deletedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Sprint {
  id: string;
  name: string;
  iterationPath: string;
  startDate: string;
  endDate: string;
  status: 'Active' | 'Planned' | 'Completed';
  goal: string;
}

export interface ExcelSheetData {
  name: string;
  rows: string[][];
}

export interface PdfAnnotation {
  id: string;
  page: number;
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
  author: string;
  createdAt: string;
}

export interface QADocument {
  id: string;
  name: string;
  docType: DocumentType;
  mimeType: string;
  size: number;
  contentBase64?: string;
  sheets?: ExcelSheetData[];
  htmlContent?: string;
  pdfAnnotations?: PdfAnnotation[];
  pdfMetadata?: {
    title: string;
    author: string;
    subject: string;
  };
  uploadedBy: string;
  isDeleted: boolean;
  deletedAt: string | null;
  deletedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  actor: string;
  action: string;
  targetType: WorkItemType | 'Document' | 'Sprint' | 'User' | 'Note' | 'Recycle Bin';
  targetTitle: string;
  timestamp: string;
}

export interface QANote {
  id: string;
  title: string;
  content: string;
  author: string;
  isDeleted: boolean;
  deletedAt: string | null;
  deletedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QAVaultDatabaseState {
  users: QAUser[];
  sprints: Sprint[];
  workItems: WorkItem[];
  documents: QADocument[];
  activities: ActivityLog[];
  notes: QANote[];
  nextWorkItemId: number;
}

export type NavSection =
  | 'dashboard'
  | 'backlogs'
  | 'sprint'
  | 'activities'
  | 'documents'
  | 'recycle-bin'
  | 'settings';
