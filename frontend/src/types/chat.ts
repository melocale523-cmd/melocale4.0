export interface MessageAttachments {
  type: 'image' | 'file' | 'audio';
  fileName?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_type: string;
  body: string;
  created_at: string;
  read_at: string | null;
  attachments: MessageAttachments | null;
}

export interface ProfileData {
  full_name: string | null;
  avatar_url: string | null;
}

export interface ConversationWithProfiles {
  id: string;
  professional_id: string;
  client_id: string;
  lead_id: string | null;
  last_message_at: string | null;
  last_message: string | null;
  unread_for_prof: number | null;
  unread_client: number;
  created_at: string;
  prof_user_id: string | null;
  prof_profile: ProfileData | null;
  client_profile: ProfileData | null;
  leadTitle?: string | null;
  // Nunca preenchidos por chatService.getChats hoje (a v_conversations não expõe
  // essas colunas) — o badge categoria · cidade do ChatLayout só renderiza se
  // esses campos passarem a ser buscados.
  prof_category?: string | null;
  prof_city?: string | null;
}

export interface ProfessionalProfile {
  id: string;
  bio: string | null;
  category: string | null;
  city: string | null;
  is_active: boolean;
}

export interface ClientProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
  total_leads: number;
  recent_leads: { id: string; title: string; status: string; created_at: string; price_coins: number | null; budget_min: number | null; budget_max: number | null; purchased: boolean }[];
}

export interface ProfessionalReview {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  client_name?: string | null;
}
