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
      professional_coins: {
        Row: {
          balance: number | null
          created_at: string | null
          id: string
          professional_id: string
          total_earned: number
          total_spent: number
          updated_at: string | null
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          id?: string
          professional_id: string
          total_earned?: number
          total_spent?: number
          updated_at?: string | null
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          id?: string
          professional_id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      professionals: {
        Row: {
          id: string
          name: string
          email: string
          coins_balance: number
          // ... rest of the fields
        }
      }
    }
    Functions: {
      rpc_get_my_wallet_balance: {
        Args: never
        Returns: number
      }
      rpc_buy_lead: {
        Args: {
          p_price: number
          p_request_id: string
        }
        Returns: string
      }
    }
  }
}
