export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          phone: string | null
          city: string | null
          role: 'client' | 'professional' | 'admin'
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          phone?: string | null
          city?: string | null
          role?: 'client' | 'professional' | 'admin'
          avatar_url?: string | null
        }
        Update: {
          full_name?: string | null
          phone?: string | null
          city?: string | null
          role?: 'client' | 'professional' | 'admin'
          avatar_url?: string | null
        }
      }
      leads: {
        Row: {
          id: string
          client_id: string
          title: string
          description: string | null
          category: string | null
          location: string | null
          city: string | null
          state: string | null
          budget_min: number | null
          budget_max: number | null
          status: string
          price_coins: number
          images: string[] | null
          metadata: Json
          expires_at: string | null
          created_at: string
          updated_at: string
          visualizacoes: number
          purchases_count: number
          max_purchases: number
        }
        Insert: {
          client_id: string
          title: string
          description?: string | null
          category?: string | null
          location?: string | null
          budget_min?: number | null
          budget_max?: number | null
          status?: string
          images?: string[] | null
          metadata?: Json
        }
        Update: {
          title?: string
          description?: string | null
          category?: string | null
          location?: string | null
          budget_min?: number | null
          budget_max?: number | null
          status?: string
          images?: string[] | null
          metadata?: Json
        }
      }
      lead_purchases: {
        Row: {
          id: string
          lead_id: string
          professional_id: string
          user_id: string | null
          client_id: string
          price_coins: number
          price: number | null
          duration: string | null
          description: string | null
          status: string | null
          created_at: string
        }
        Insert: {
          lead_id: string
          professional_id: string
          client_id: string
          price_coins: number
          status?: string | null
        }
        Update: {
          price?: number | null
          duration?: string | null
          description?: string | null
          status?: string | null
        }
      }
      professional_coins: {
        Row: {
          id: string
          professional_id: string
          balance: number | null
          total_earned: number
          total_spent: number
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          professional_id: string
          balance?: number | null
        }
        Update: {
          balance?: number | null
          total_earned?: number
          total_spent?: number
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          body: string
          data: Json
          is_read: boolean
          created_at: string
        }
        Insert: {
          user_id: string
          title: string
          body: string
          data?: Json
          is_read?: boolean
        }
        Update: {
          is_read?: boolean
        }
      }
      user_subscriptions: {
        Row: {
          id: string
          user_id: string
          package_id: string | null
          stripe_subscription_id: string | null
          status: string
          started_at: string | null
          updated_at: string | null
        }
        Insert: {
          user_id: string
          package_id?: string | null
          stripe_subscription_id?: string | null
          status?: string
        }
        Update: {
          status?: string
          updated_at?: string | null
        }
      }
      wallet_transactions: {
        Row: {
          id: string
          user_id: string | null
          amount: number
          kind: string | null
          reference: string | null
          stripe_session_id: string | null
          stripe_event_id: string | null
          created_at: string
        }
        Insert: {
          user_id?: string | null
          amount: number
          kind?: string | null
          reference?: string | null
          stripe_session_id?: string | null
          stripe_event_id?: string | null
        }
        Update: Record<string, never>
      }
      support_tickets: {
        Row: {
          id: string
          user_id: string | null
          email: string | null
          conversation: Json
          status: string
          internal_note: string | null
          created_at: string
        }
        Insert: {
          user_id?: string | null
          email?: string | null
          conversation: Json
          status?: string
        }
        Update: {
          status?: string
          internal_note?: string | null
        }
      }
      coin_packages: {
        Row: {
          id: string
          name: string
          coins: number
          price: number
          is_active: boolean
          display_order: number
        }
        Insert: {
          id: string
          name: string
          coins: number
          price: number
          is_active?: boolean
          display_order?: number
        }
        Update: {
          name?: string
          coins?: number
          price?: number
          is_active?: boolean
        }
      }
    }
    Views: {
      v_available_leads: { Row: Record<string, unknown> }
      v_client_leads: { Row: Record<string, unknown> }
      v_my_purchases: { Row: Record<string, unknown> }
      v_wallet_balance: { Row: { user_id: string; balance_coins: number } }
    }
    Functions: {
      purchase_lead: {
        Args: { p_lead_id: string; p_idempotency_key: string }
        Returns: { success: boolean; lead_purchase_id: string }
      }
      credit_wallet: {
        Args: { p_user_id: string; p_amount: number; p_stripe_session_id: string; p_stripe_event_id: string }
        Returns: void
      }
      save_full_profile: {
        Args: { p_user_id: string; p_full_name: string; p_phone: string; p_bio: string; p_category: string; p_service_radius: number }
        Returns: void
      }
      ensure_professional_exists: {
        Args: { p_user_id: string }
        Returns: string
      }
    }
  }
}
