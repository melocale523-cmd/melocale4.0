export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          cancelled_reason: string | null
          client_id: string
          confirmed_at: string | null
          conversation_id: string | null
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          lead_purchase_id: string | null
          location: string | null
          metadata: Json
          price_brl: number | null
          professional_id: string
          proposed_at: string | null
          proposed_by: string | null
          reminder_sent_at: string | null
          scheduled_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          cancelled_reason?: string | null
          client_id: string
          confirmed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          lead_purchase_id?: string | null
          location?: string | null
          metadata?: Json
          price_brl?: number | null
          professional_id: string
          proposed_at?: string | null
          proposed_by?: string | null
          reminder_sent_at?: string | null
          scheduled_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          cancelled_reason?: string | null
          client_id?: string
          confirmed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          lead_purchase_id?: string | null
          location?: string | null
          metadata?: Json
          price_brl?: number | null
          professional_id?: string
          proposed_at?: string | null
          proposed_by?: string | null
          reminder_sent_at?: string | null
          scheduled_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_my_purchases"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "appointments_lead_purchase_id_fkey"
            columns: ["lead_purchase_id"]
            isOneToOne: false
            referencedRelation: "lead_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_lead_purchase_id_fkey"
            columns: ["lead_purchase_id"]
            isOneToOne: false
            referencedRelation: "v_my_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals_with_rating"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "v_payment_history"
            referencedColumns: ["professional_id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "v_professional_stats"
            referencedColumns: ["professional_id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      client_coin_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          id: string
          kind: string
          metadata: Json | null
          reference: string | null
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          id?: string
          kind: string
          metadata?: Json | null
          reference?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json | null
          reference?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_coin_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_coins: {
        Row: {
          balance: number
          created_at: string
          id: string
          total_earned: number
          total_withdrawn: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_coins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address_block: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_street: string | null
          address_zipcode: string | null
          city: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          metadata: Json
          phone: string | null
          state: string | null
        }
        Insert: {
          address_block?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_street?: string | null
          address_zipcode?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          metadata?: Json
          phone?: string | null
          state?: string | null
        }
        Update: {
          address_block?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_street?: string | null
          address_zipcode?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          metadata?: Json
          phone?: string | null
          state?: string | null
        }
        Relationships: []
      }
      coin_packages: {
        Row: {
          bonus_coins: number | null
          coins: number
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          price: number
        }
        Insert: {
          bonus_coins?: number | null
          coins: number
          created_at?: string | null
          display_order?: number | null
          id: string
          is_active?: boolean | null
          name: string
          price: number
        }
        Update: {
          bonus_coins?: number | null
          coins?: number
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
        }
        Relationships: []
      }
      conversations: {
        Row: {
          client_id: string
          created_at: string
          id: string
          last_message_at: string | null
          lead_id: string | null
          professional_id: string
          professional_user_id: string | null
          unread_for_prof: number
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          lead_id?: string | null
          professional_id: string
          professional_user_id?: string | null
          unread_for_prof?: number
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          lead_id?: string | null
          professional_id?: string
          professional_user_id?: string | null
          unread_for_prof?: number
        }
        Relationships: [
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_my_purchases"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_available_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_client_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals_with_rating"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "v_payment_history"
            referencedColumns: ["professional_id"]
          },
          {
            foreignKeyName: "conversations_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "v_professional_stats"
            referencedColumns: ["professional_id"]
          },
        ]
      }
      disputes: {
        Row: {
          admin_notes: string | null
          client_id: string | null
          created_at: string | null
          id: string
          lead_id: string | null
          professional_id: string | null
          reason: string
          status: string
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string | null
          professional_id?: string | null
          reason: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string | null
          professional_id?: string | null
          reason?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disputes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_available_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_client_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals_with_rating"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "v_payment_history"
            referencedColumns: ["professional_id"]
          },
          {
            foreignKeyName: "disputes_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "v_professional_stats"
            referencedColumns: ["professional_id"]
          },
        ]
      }
      lead_purchases: {
        Row: {
          chat_id: string | null
          client_id: string
          coin_transaction_id: string | null
          contacted_at: string | null
          created_at: string
          description: string | null
          duration: string | null
          id: string
          idempotency_key: string | null
          lead_id: string
          notes: string | null
          price: number | null
          price_coins: number
          professional_id: string
          status: string | null
          user_id: string | null
        }
        Insert: {
          chat_id?: string | null
          client_id: string
          coin_transaction_id?: string | null
          contacted_at?: string | null
          created_at?: string
          description?: string | null
          duration?: string | null
          id?: string
          idempotency_key?: string | null
          lead_id: string
          notes?: string | null
          price?: number | null
          price_coins: number
          professional_id: string
          status?: string | null
          user_id?: string | null
        }
        Update: {
          chat_id?: string | null
          client_id?: string
          coin_transaction_id?: string | null
          contacted_at?: string | null
          created_at?: string
          description?: string | null
          duration?: string | null
          id?: string
          idempotency_key?: string | null
          lead_id?: string
          notes?: string | null
          price?: number | null
          price_coins?: number
          professional_id?: string
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_purchases_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_purchases_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "v_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_purchases_coin_transaction_id_fkey"
            columns: ["coin_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_wallet_transactions_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_purchases_coin_transaction_id_fkey"
            columns: ["coin_transaction_id"]
            isOneToOne: false
            referencedRelation: "wallet_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_purchases_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_purchases_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_available_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_purchases_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_client_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_purchases_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_purchases_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals_with_rating"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_purchases_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "v_payment_history"
            referencedColumns: ["professional_id"]
          },
          {
            foreignKeyName: "lead_purchases_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "v_professional_stats"
            referencedColumns: ["professional_id"]
          },
        ]
      }
      leads: {
        Row: {
          budget_max: number | null
          budget_min: number | null
          category: string | null
          category_id: string | null
          city: string | null
          client_id: string
          created_at: string
          description: string | null
          event_date: string | null
          expires_at: string | null
          id: string
          images: string[] | null
          location: string | null
          max_purchases: number
          metadata: Json
          price_coins: number
          purchases_count: number
          state: string | null
          status: string
          title: string
          updated_at: string
          visualizacoes: number
        }
        Insert: {
          budget_max?: number | null
          budget_min?: number | null
          category?: string | null
          category_id?: string | null
          city?: string | null
          client_id: string
          created_at?: string
          description?: string | null
          event_date?: string | null
          expires_at?: string | null
          id?: string
          images?: string[] | null
          location?: string | null
          max_purchases?: number
          metadata?: Json
          price_coins?: number
          purchases_count?: number
          state?: string | null
          status?: string
          title: string
          updated_at?: string
          visualizacoes?: number
        }
        Update: {
          budget_max?: number | null
          budget_min?: number | null
          category?: string | null
          category_id?: string | null
          city?: string | null
          client_id?: string
          created_at?: string
          description?: string | null
          event_date?: string | null
          expires_at?: string | null
          id?: string
          images?: string[] | null
          location?: string | null
          max_purchases?: number
          metadata?: Json
          price_coins?: number
          purchases_count?: number
          state?: string | null
          status?: string
          title?: string
          updated_at?: string
          visualizacoes?: number
        }
        Relationships: [
          {
            foreignKeyName: "leads_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_my_purchases"
            referencedColumns: ["client_id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json
          body: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_type: string
        }
        Insert: {
          attachments?: Json
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_type: string
        }
        Update: {
          attachments?: Json
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "v_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string | null
          data: Json | null
          id: string
          is_read: boolean | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_audit_logs: {
        Row: {
          category: string
          details: Json
          event_id: string | null
          id: string
          message: string
          occurred_at: string
          payment_id: string | null
          req_id: string | null
          session_id: string | null
          severity: string
          source: string
          user_id: string | null
        }
        Insert: {
          category: string
          details?: Json
          event_id?: string | null
          id?: string
          message: string
          occurred_at?: string
          payment_id?: string | null
          req_id?: string | null
          session_id?: string | null
          severity: string
          source: string
          user_id?: string | null
        }
        Update: {
          category?: string
          details?: Json
          event_id?: string | null
          id?: string
          message?: string
          occurred_at?: string
          payment_id?: string | null
          req_id?: string | null
          session_id?: string | null
          severity?: string
          source?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_audit_logs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          amount_brl: number | null
          amount_coins: number
          created_at: string
          error_message: string | null
          id: string
          processed_at: string | null
          processing_started_at: string | null
          retry_count: number
          status: string
          stripe_event_id: string | null
          stripe_session_id: string
          user_id: string
        }
        Insert: {
          amount_brl?: number | null
          amount_coins: number
          created_at?: string
          error_message?: string | null
          id?: string
          processed_at?: string | null
          processing_started_at?: string | null
          retry_count?: number
          status?: string
          stripe_event_id?: string | null
          stripe_session_id: string
          user_id: string
        }
        Update: {
          amount_brl?: number | null
          amount_coins?: number
          created_at?: string
          error_message?: string | null
          id?: string
          processed_at?: string | null
          processing_started_at?: string | null
          retry_count?: number
          status?: string
          stripe_event_id?: string | null
          stripe_session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          coins: number
          created_at: string
          currency: string
          id: string
          last_error: string | null
          metadata: Json
          package_id: string | null
          paid_at: string | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          coins: number
          created_at?: string
          currency: string
          id?: string
          last_error?: string | null
          metadata?: Json
          package_id?: string | null
          paid_at?: string | null
          status: string
          stripe_payment_intent_id?: string | null
          stripe_session_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          coins?: number
          created_at?: string
          currency?: string
          id?: string
          last_error?: string | null
          metadata?: Json
          package_id?: string | null
          paid_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      professional_coins: {
        Row: {
          balance: number
          created_at: string | null
          id: string
          professional_id: string
          total_earned: number
          total_spent: number
          updated_at: string | null
        }
        Insert: {
          balance?: number
          created_at?: string | null
          id?: string
          professional_id: string
          total_earned?: number
          total_spent?: number
          updated_at?: string | null
        }
        Update: {
          balance?: number
          created_at?: string | null
          id?: string
          professional_id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_coins_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          approved_at: string | null
          bio: string | null
          category: string | null
          city: string | null
          created_at: string
          experience_years: number | null
          featured_until: string | null
          id: string
          is_active: boolean
          lat: number | null
          lng: number | null
          onboarding_completed: boolean
          service_radius: number | null
          stripe_account_id: string | null
          stripe_connect_status: string | null
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          bio?: string | null
          category?: string | null
          city?: string | null
          created_at?: string
          experience_years?: number | null
          featured_until?: string | null
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          onboarding_completed?: boolean
          service_radius?: number | null
          stripe_account_id?: string | null
          stripe_connect_status?: string | null
          user_id: string
        }
        Update: {
          approved_at?: string | null
          bio?: string | null
          category?: string | null
          city?: string | null
          created_at?: string
          experience_years?: number | null
          featured_until?: string | null
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          onboarding_completed?: boolean
          service_radius?: number | null
          stripe_account_id?: string | null
          stripe_connect_status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professionals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string | null
          address_block: string | null
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zipcode: string | null
          avatar_url: string | null
          cep: string | null
          city: string | null
          created_at: string
          full_name: string
          id: string
          origin: string | null
          phone: string | null
          referral_code: string | null
          referred_by_code: string | null
          role: string
          updated_at: string
        }
        Insert: {
          account_type?: string | null
          address_block?: string | null
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zipcode?: string | null
          avatar_url?: string | null
          cep?: string | null
          city?: string | null
          created_at?: string
          full_name: string
          id: string
          origin?: string | null
          phone?: string | null
          referral_code?: string | null
          referred_by_code?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          account_type?: string | null
          address_block?: string | null
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zipcode?: string | null
          avatar_url?: string | null
          cep?: string | null
          city?: string | null
          created_at?: string
          full_name?: string
          id?: string
          origin?: string | null
          phone?: string | null
          referral_code?: string | null
          referred_by_code?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_config: {
        Row: {
          expires_at: string | null
          id: number
          label: string | null
          multiplier: number
          updated_at: string
        }
        Insert: {
          expires_at?: string | null
          id?: number
          label?: string | null
          multiplier?: number
          updated_at?: string
        }
        Update: {
          expires_at?: string | null
          id?: number
          label?: string | null
          multiplier?: number
          updated_at?: string
        }
        Relationships: []
      }
      referral_monthly_bonuses: {
        Row: {
          credited_at: string
          id: string
          month: string
          referrer_id: string
        }
        Insert: {
          credited_at?: string
          id?: string
          month: string
          referrer_id: string
        }
        Update: {
          credited_at?: string
          id?: string
          month?: string
          referrer_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          code: string
          created_at: string
          credited_at: string | null
          id: string
          referred_id: string | null
          referrer_id: string
          referrer_role: string
          reward_amount: number
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          credited_at?: string | null
          id?: string
          referred_id?: string | null
          referrer_id: string
          referrer_role: string
          reward_amount?: number
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          credited_at?: string | null
          id?: string
          referred_id?: string | null
          referrer_id?: string
          referrer_role?: string
          reward_amount?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          appointment_id: string | null
          client_id: string | null
          comment: string | null
          created_at: string | null
          id: string
          professional_id: string | null
          rating: number
        }
        Insert: {
          appointment_id?: string | null
          client_id?: string | null
          comment?: string | null
          created_at?: string | null
          id?: string
          professional_id?: string | null
          rating: number
        }
        Update: {
          appointment_id?: string | null
          client_id?: string | null
          comment?: string | null
          created_at?: string | null
          id?: string
          professional_id?: string | null
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "reviews_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals_with_rating"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "v_payment_history"
            referencedColumns: ["professional_id"]
          },
          {
            foreignKeyName: "reviews_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "v_professional_stats"
            referencedColumns: ["professional_id"]
          },
        ]
      }
      service_requests: {
        Row: {
          category: string
          city: string
          client_id: string
          created_at: string
          description: string | null
          id: string
          lead_price: number
          max_purchases: number
          purchase_count: number
          status: string
          title: string
        }
        Insert: {
          category: string
          city: string
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          lead_price?: number
          max_purchases?: number
          purchase_count?: number
          status?: string
          title: string
        }
        Update: {
          category?: string
          city?: string
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          lead_price?: number
          max_purchases?: number
          purchase_count?: number
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_audit_runs: {
        Row: {
          id: number
          orphans_found: number
          payments_checked: number
          ran_at: string
        }
        Insert: {
          id?: never
          orphans_found: number
          payments_checked: number
          ran_at?: string
        }
        Update: {
          id?: never
          orphans_found?: number
          payments_checked?: number
          ran_at?: string
        }
        Relationships: []
      }
      stripe_events: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          payload: Json | null
          processed_at: string | null
          processing_at: string | null
          received_at: string | null
          type: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id: string
          last_error?: string | null
          payload?: Json | null
          processed_at?: string | null
          processing_at?: string | null
          received_at?: string | null
          type: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          payload?: Json | null
          processed_at?: string | null
          processing_at?: string | null
          received_at?: string | null
          type?: string
        }
        Relationships: []
      }
      stripe_processed_events: {
        Row: {
          event_id: string
          event_type: string
          processed_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          processed_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          processed_at?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          admin_note: string | null
          conversation: Json
          created_at: string
          email: string | null
          id: string
          internal_note: string | null
          status: string
          status_history: Json | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_note?: string | null
          conversation?: Json
          created_at?: string
          email?: string | null
          id?: string
          internal_note?: string | null
          status?: string
          status_history?: Json | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_note?: string | null
          conversation?: Json
          created_at?: string
          email?: string | null
          id?: string
          internal_note?: string | null
          status?: string
          status_history?: Json | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      system_health_checks: {
        Row: {
          backend_status: string
          checked_at: string
          db_latency_ms: number | null
          db_size_mb: number | null
          db_status: string
          event_loop_lag_ms: number | null
          id: number
          stripe_latency_ms: number | null
          stripe_status: string
        }
        Insert: {
          backend_status: string
          checked_at?: string
          db_latency_ms?: number | null
          db_size_mb?: number | null
          db_status: string
          event_loop_lag_ms?: number | null
          id?: never
          stripe_latency_ms?: number | null
          stripe_status: string
        }
        Update: {
          backend_status?: string
          checked_at?: string
          db_latency_ms?: number | null
          db_size_mb?: number | null
          db_status?: string
          event_loop_lag_ms?: number | null
          id?: never
          stripe_latency_ms?: number | null
          stripe_status?: string
        }
        Relationships: []
      }
      user_notification_preferences: {
        Row: {
          appointment_cancelled: boolean
          appointment_confirmed: boolean
          email_messages: boolean | null
          email_new_lead: boolean | null
          push_enabled: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          appointment_cancelled?: boolean
          appointment_confirmed?: boolean
          email_messages?: boolean | null
          email_new_lead?: boolean | null
          push_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          appointment_cancelled?: boolean
          appointment_confirmed?: boolean
          email_messages?: boolean | null
          email_new_lead?: boolean | null
          push_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          id: string
          package_id: string | null
          started_at: string | null
          status: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          package_id?: string | null
          started_at?: string | null
          status?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          package_id?: string | null
          started_at?: string | null
          status?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      wallet_audit_logs: {
        Row: {
          created_at: string | null
          error: string | null
          id: string
          payment_id: string | null
          stripe_session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          id?: string
          payment_id?: string | null
          stripe_session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error?: string | null
          id?: string
          payment_id?: string | null
          stripe_session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          id: string
          kind: string
          metadata: Json | null
          payment_id: string | null
          professional_id: string | null
          reference: string
          stripe_event_id: string | null
          stripe_session_id: string | null
          user_id: string | null
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          id?: string
          kind: string
          metadata?: Json | null
          payment_id?: string | null
          professional_id?: string | null
          reference: string
          stripe_event_id?: string | null
          stripe_session_id?: string | null
          user_id?: string | null
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json | null
          payment_id?: string | null
          professional_id?: string | null
          reference?: string
          stripe_event_id?: string | null
          stripe_session_id?: string | null
          user_id?: string | null
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_wallet_tx_payment"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_wallet_tx_wallet"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          balance_coins: number | null
          id: string
          professional_id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          balance_coins?: number | null
          id?: string
          professional_id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          balance_coins?: number | null
          id?: string
          professional_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallets_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals_with_rating"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallets_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "v_payment_history"
            referencedColumns: ["professional_id"]
          },
          {
            foreignKeyName: "wallets_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "v_professional_stats"
            referencedColumns: ["professional_id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          created_at: string
          duration_ms: number | null
          event_type: string
          id: string
          message: string | null
          new_balance: number | null
          payload: Json | null
          status: string
          stripe_event_id: string | null
          stripe_session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          event_type: string
          id?: string
          message?: string | null
          new_balance?: number | null
          payload?: Json | null
          status: string
          stripe_event_id?: string | null
          stripe_session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          event_type?: string
          id?: string
          message?: string | null
          new_balance?: number | null
          payload?: Json | null
          status?: string
          stripe_event_id?: string | null
          stripe_session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          admin_note: string | null
          brl_amount: number
          coins_amount: number
          id: string
          pix_key: string
          pix_key_type: string
          processed_at: string | null
          processed_by: string | null
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          brl_amount?: number
          coins_amount: number
          id?: string
          pix_key: string
          pix_key_type: string
          processed_at?: string | null
          processed_by?: string | null
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          brl_amount?: number
          coins_amount?: number
          id?: string
          pix_key?: string
          pix_key_type?: string
          processed_at?: string | null
          processed_by?: string | null
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wizard_funnel_events: {
        Row: {
          category: string | null
          client_id: string
          created_at: string | null
          id: string
          step: number
        }
        Insert: {
          category?: string | null
          client_id: string
          created_at?: string | null
          id?: string
          step: number
        }
        Update: {
          category?: string | null
          client_id?: string
          created_at?: string | null
          id?: string
          step?: number
        }
        Relationships: [
          {
            foreignKeyName: "wizard_funnel_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      client_coins_ranking: {
        Row: {
          avatar_url: string | null
          balance: number | null
          full_name: string | null
          position: number | null
          total_earned: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_coins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals_with_rating: {
        Row: {
          bio: string | null
          category: string | null
          city: string | null
          created_at: string | null
          featured_until: string | null
          id: string | null
          is_active: boolean | null
          onboarding_completed: boolean | null
          rating_avg: number | null
          review_count: number | null
          service_radius: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professionals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_monthly_stats: {
        Row: {
          month: string | null
          referrer_id: string | null
          total_this_month: number | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_available_leads: {
        Row: {
          budget_max: number | null
          budget_min: number | null
          category: string | null
          category_id: string | null
          city: string | null
          client_id: string | null
          created_at: string | null
          description: string | null
          event_date: string | null
          expires_at: string | null
          id: string | null
          images: string[] | null
          location: string | null
          max_purchases: number | null
          metadata: Json | null
          price_coins: number | null
          purchases_count: number | null
          state: string | null
          status: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          budget_max?: number | null
          budget_min?: number | null
          category?: string | null
          category_id?: string | null
          city?: string | null
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          event_date?: string | null
          expires_at?: string | null
          id?: string | null
          images?: string[] | null
          location?: string | null
          max_purchases?: number | null
          metadata?: Json | null
          price_coins?: number | null
          purchases_count?: number | null
          state?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          budget_max?: number | null
          budget_min?: number | null
          category?: string | null
          category_id?: string | null
          city?: string | null
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          event_date?: string | null
          expires_at?: string | null
          id?: string | null
          images?: string[] | null
          location?: string | null
          max_purchases?: number | null
          metadata?: Json | null
          price_coins?: number | null
          purchases_count?: number | null
          state?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_my_purchases"
            referencedColumns: ["client_id"]
          },
        ]
      }
      v_client_leads: {
        Row: {
          budget_max: number | null
          budget_min: number | null
          category: string | null
          city: string | null
          client_id: string | null
          created_at: string | null
          description: string | null
          expires_at: string | null
          id: string | null
          images: string[] | null
          interested_count: number | null
          location: string | null
          price_coins: number | null
          state: string | null
          status: string | null
          title: string | null
        }
        Insert: {
          budget_max?: number | null
          budget_min?: number | null
          category?: string | null
          city?: string | null
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string | null
          images?: string[] | null
          interested_count?: never
          location?: string | null
          price_coins?: number | null
          state?: string | null
          status?: string | null
          title?: string | null
        }
        Update: {
          budget_max?: number | null
          budget_min?: number | null
          category?: string | null
          city?: string | null
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string | null
          images?: string[] | null
          interested_count?: never
          location?: string | null
          price_coins?: number | null
          state?: string | null
          status?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_my_purchases"
            referencedColumns: ["client_id"]
          },
        ]
      }
      v_conversations: {
        Row: {
          client_avatar_url: string | null
          client_full_name: string | null
          client_id: string | null
          created_at: string | null
          id: string | null
          last_message: string | null
          last_message_at: string | null
          lead_id: string | null
          prof_avatar_url: string | null
          prof_full_name: string | null
          professional_id: string | null
          professional_user_id: string | null
          unread_for_client: number | null
          unread_for_prof: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_my_purchases"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_available_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_client_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals_with_rating"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "v_payment_history"
            referencedColumns: ["professional_id"]
          },
          {
            foreignKeyName: "conversations_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "v_professional_stats"
            referencedColumns: ["professional_id"]
          },
        ]
      }
      v_my_purchases: {
        Row: {
          budget_max: number | null
          budget_min: number | null
          category: string | null
          city: string | null
          client_city: string | null
          client_email: string | null
          client_id: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string | null
          description: string | null
          event_date: string | null
          expires_at: string | null
          id: string | null
          idempotency_key: string | null
          images: string[] | null
          lead_id: string | null
          lead_status: string | null
          location: string | null
          max_purchases: number | null
          notes: string | null
          price_coins: number | null
          professional_id: string | null
          purchases_count: number | null
          state: string | null
          status: string | null
          title: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_purchases_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_purchases_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_available_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_purchases_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_client_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_purchases_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_purchases_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals_with_rating"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_purchases_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "v_payment_history"
            referencedColumns: ["professional_id"]
          },
          {
            foreignKeyName: "lead_purchases_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "v_professional_stats"
            referencedColumns: ["professional_id"]
          },
        ]
      }
      v_payment_history: {
        Row: {
          amount_brl: number | null
          amount_coins: number | null
          created_at: string | null
          current_balance: number | null
          error_message: string | null
          id: string | null
          processed_at: string | null
          processing_started_at: string | null
          professional_id: string | null
          retry_count: number | null
          status: string | null
          stripe_event_id: string | null
          stripe_session_id: string | null
          user_id: string | null
        }
        Relationships: []
      }
      v_payments_inconsistent: {
        Row: {
          coins: number | null
          has_transaction: boolean | null
          paid_at: string | null
          payment_id: string | null
          status: string | null
          stripe_session_id: string | null
          user_id: string | null
        }
        Relationships: []
      }
      v_professional_stats: {
        Row: {
          completed_appointments: number | null
          professional_id: string | null
          total_appointments: number | null
          total_coins_spent: number | null
          total_conversations: number | null
          total_leads_purchased: number | null
          total_revenue_cents: number | null
          total_unread_messages: number | null
          user_id: string | null
        }
        Insert: {
          completed_appointments?: never
          professional_id?: string | null
          total_appointments?: never
          total_coins_spent?: never
          total_conversations?: never
          total_leads_purchased?: never
          total_revenue_cents?: never
          total_unread_messages?: never
          user_id?: string | null
        }
        Update: {
          completed_appointments?: never
          professional_id?: string | null
          total_appointments?: never
          total_coins_spent?: never
          total_conversations?: never
          total_leads_purchased?: never
          total_revenue_cents?: never
          total_unread_messages?: never
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professionals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_wallet_balance: {
        Row: {
          balance_coins: number | null
          user_id: string | null
        }
        Insert: {
          balance_coins?: number | null
          user_id?: string | null
        }
        Update: {
          balance_coins?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_coins_professional_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_wallet_balance_safe: {
        Row: {
          balance: number | null
          wallet_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_wallet_tx_wallet"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      v_wallet_transactions_safe: {
        Row: {
          amount: number | null
          balance_after: number | null
          created_at: string | null
          id: string | null
          kind: string | null
          professional_id: string | null
          wallet_id: string | null
        }
        Insert: {
          amount?: number | null
          balance_after?: number | null
          created_at?: string | null
          id?: string | null
          kind?: string | null
          professional_id?: never
          wallet_id?: string | null
        }
        Update: {
          amount?: number | null
          balance_after?: number | null
          created_at?: string | null
          id?: string | null
          kind?: string | null
          professional_id?: never
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_wallet_tx_wallet"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      v_wallets_inconsistent: {
        Row: {
          balance: number | null
          delta: number | null
          is_consistent: boolean | null
          ledger_sum: number | null
          wallet_id: string | null
        }
        Relationships: []
      }
      v_withdrawal_requests: {
        Row: {
          admin_note: string | null
          brl_amount: number | null
          coins_amount: number | null
          current_balance: number | null
          full_name: string | null
          id: string | null
          phone: string | null
          pix_key: string | null
          pix_key_type: string | null
          processed_at: string | null
          processed_by: string | null
          requested_at: string | null
          status: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_credits: {
        Args: {
          p_amount_brl?: number
          p_amount_coins: number
          p_stripe_event_id?: string
          p_stripe_session_id: string
          p_user_id: string
        }
        Returns: Json
      }
      admin_get_approved_users: {
        Args: never
        Returns: {
          agendamentos: number
          approved_at: string
          avatar_url: string
          category: string
          city: string
          client_coins_balance: number
          coins_balance: number
          completeness: number
          created_at: string
          full_name: string
          is_active: boolean
          leads_purchased: number
          pedidos_criados: number
          phone: string
          plan_id: string
          role: string
          sub_status: string
          user_id: string
        }[]
      }
      admin_get_pending_professionals: {
        Args: never
        Returns: {
          avatar_url: string
          bio: string
          category: string
          city: string
          completeness: number
          created_at: string
          experience_years: number
          full_name: string
          hours_in_queue: number
          phone: string
          user_id: string
        }[]
      }
      admin_process_withdrawal: {
        Args: { p_action: string; p_note?: string; p_request_id: string }
        Returns: Json
      }
      apply_monthly_referral_bonus: { Args: never; Returns: number }
      assert_event_not_replayed: {
        Args: { p_event_id: string; p_max_attempts?: number }
        Returns: string
      }
      check_payment_consistency: {
        Args: never
        Returns: {
          coins: number
          has_transaction: boolean
          paid_at: string
          payment_id: string
          status: string
          stripe_session_id: string
          user_id: string
        }[]
      }
      check_wallet_consistency: {
        Args: { p_wallet_id?: string }
        Returns: {
          balance: number
          delta: number
          is_consistent: boolean
          ledger_sum: number
          wallet_id: string
        }[]
      }
      complete_stripe_event: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      credit_cascade_referral: {
        Args: { p_level1_user_id: string }
        Returns: undefined
      }
      credit_client_coins: {
        Args: {
          p_amount: number
          p_kind: string
          p_metadata?: Json
          p_reference?: string
          p_user_id: string
        }
        Returns: Json
      }
      credit_professional_coins: {
        Args: {
          p_amount: number
          p_stripe_event_id: string
          p_stripe_session_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      credit_referral_reward: {
        Args: { p_referral_id: string; p_reward_coins: number }
        Returns: Json
      }
      credit_wallet: {
        Args: {
          p_amount: number
          p_payment_id: string
          p_stripe_session_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      current_professional_id: { Args: never; Returns: string }
      debit_client_coins: {
        Args: {
          p_amount: number
          p_kind: string
          p_metadata?: Json
          p_reference?: string
          p_user_id: string
        }
        Returns: Json
      }
      ensure_professional_exists: {
        Args: { p_category?: string; p_user_id: string }
        Returns: string
      }
      fail_stripe_event: {
        Args: { p_error: string; p_event_id: string }
        Returns: undefined
      }
      finalize_lead: { Args: { p_appointment_id: string }; Returns: Json }
      get_available_leads: {
        Args: {
          p_category?: string
          p_city?: string
          p_limit?: number
          p_offset?: number
          p_professional_id: string
        }
        Returns: {
          category: string
          city: string
          created_at: string
          description: string
          id: string
          lead_price: number
          spots_left: number
          title: string
        }[]
      }
      get_avg_response_time_hours: {
        Args: { p_professional_id: string }
        Returns: number
      }
      get_avg_response_time_hours_global: { Args: never; Returns: number }
      get_database_size_mb: { Args: never; Returns: number }
      get_my_leads: {
        Args: never
        Returns: {
          category: string
          city: string
          client_id: string
          created_at: string
          description: string
          expires_at: string
          id: string
          interested_count: number
          price_coins: number
          proposals_count: Json
          state: string
          status: string
          title: string
        }[]
      }
      get_my_purchases: { Args: never; Returns: Json }
      get_professional_balance: {
        Args: { p_professional_id: string }
        Returns: number
      }
      get_professional_completeness: {
        Args: { prof_user_id: string }
        Returns: number
      }
      get_professional_review_stats: {
        Args: { p_professional_id: string }
        Returns: {
          avg_rating: number
          total_reviews: number
        }[]
      }
      get_seo_professionals: {
        Args: { p_category: string; p_city: string }
        Returns: {
          bio: string
          category: string
          city: string
          id: string
          name: string
          rating_avg: number
          review_count: number
        }[]
      }
      get_wallet: {
        Args: { p_professional_id: string; p_tx_limit?: number }
        Returns: Json
      }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      log_audit_event: {
        Args: {
          p_category: string
          p_details?: Json
          p_event_id?: string
          p_message: string
          p_payment_id?: string
          p_req_id?: string
          p_session_id?: string
          p_severity: string
          p_source: string
          p_user_id?: string
        }
        Returns: string
      }
      mark_conversation_read: {
        Args: { p_conversation_id: string }
        Returns: Json
      }
      mark_messages_read: {
        Args: { p_conversation_id: string; p_sender_type: string }
        Returns: undefined
      }
      mark_stripe_event: {
        Args: { p_event_id: string; p_payload: Json; p_type: string }
        Returns: string
      }
      purchase_lead: {
        Args: { p_idempotency_key: string; p_lead_id: string }
        Returns: Json
      }
      recompute_unread_counters: { Args: never; Returns: number }
      reconcile_payment: {
        Args: {
          p_amount: number
          p_coins: number
          p_currency: string
          p_metadata: Json
          p_package_id: string
          p_stripe_payment_intent_id: string
          p_stripe_session_id: string
          p_user_id: string
        }
        Returns: Json
      }
      reprocess_payment: {
        Args: { p_stripe_session_id: string }
        Returns: Json
      }
      request_withdrawal: {
        Args: {
          p_coins_amount: number
          p_pix_key: string
          p_pix_key_type: string
        }
        Returns: Json
      }
      respond_proposal: {
        Args: { p_action: string; p_purchase_id: string }
        Returns: Json
      }
      save_full_profile: {
        Args: {
          p_bio: string
          p_category: string
          p_full_name: string
          p_phone: string
          p_service_radius: number
          p_user_id: string
        }
        Returns: undefined
      }
      unaccent: { Args: { "": string }; Returns: string }
      upsert_payment: {
        Args: {
          p_amount: number
          p_coins: number
          p_currency: string
          p_metadata: Json
          p_package_id: string
          p_status: string
          p_stripe_payment_intent_id: string
          p_stripe_session_id: string
          p_user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
