export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'journalist' | 'admin';
  is_active: boolean;
  created_at: string;
}

export interface FieldConfig {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'url' | 'images' | 'stars';
  required: boolean;
  min?: number; // For images, minimum required
  max?: number; // For stars, max rating (default 5)
  alternateKey?: string; // If set, this field OR the alternate field must be filled (not both required)
}

export interface PaperType {
  id: string;
  name: string;
  sign_limit: number;
  drive_folder_name: string;
  fields_config: FieldConfig[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface HebdoConfig {
  id: string;
  numero: number;
  label: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  created_at: string;
}

export interface Delivery {
  id: string;
  author_id: string;
  hebdo_id: string;
  paper_type_id: string;
  title: string;
  subject: string | null;
  body_original: string;
  body_corrected: string;
  digital_link: string | null;
  image_filename: string;
  metadata: Record<string, any>;
  drive_folder_url: string | null;
  status: 'draft' | 'corrected' | 'delivered';
  sign_count: number;
  wp_post_id: number | null;
  wp_post_url: string | null;
  wp_status: 'pending' | 'sent' | 'error' | null;
  wp_payload: Record<string, any> | null;
  created_at: string;
  delivered_at: string | null;
  // Joined
  author?: { full_name: string; email: string };
  paper_type?: { name: string; sign_limit: number };
  hebdo?: { numero: number; label: string };
}

export interface CorrectionResult {
  correctedText: string;
  corrections: CorrectionItem[];
  signCount: number;
}

export interface CorrectionItem {
  original: string;
  corrected: string;
  type: string;
  explanation: string;
}

export interface CorrectionPrompt {
  id: string;
  prompt_text: string;
  updated_at: string;
  updated_by: string | null;
}

export interface AppSetting {
  id: string;
  key: string;
  value: string;
  updated_at: string;
  updated_by: string | null;
}

export interface DeliveryLog {
  id: string;
  level: 'info' | 'warn' | 'error';
  step: string;
  message: string;
  detail: string | null;
  journalist_id: string | null;
  journalist_name: string | null;
  hebdo_label: string | null;
  paper_type_name: string | null;
  title: string | null;
  created_at: string;
}
