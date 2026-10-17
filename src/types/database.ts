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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      appointment_requests: {
        Row: {
          appointment_id: string
          counter_ends_at: string | null
          counter_starts_at: string | null
          created_at: string
          id: string
          job_id: string
          owner_user_id: string
          request_note: string | null
          requested_ends_at: string
          requested_starts_at: string
          resolved_at: string | null
          resulting_appointment_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          counter_ends_at?: string | null
          counter_starts_at?: string | null
          created_at?: string
          id?: string
          job_id: string
          owner_user_id: string
          request_note?: string | null
          requested_ends_at: string
          requested_starts_at: string
          resolved_at?: string | null
          resulting_appointment_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          counter_ends_at?: string | null
          counter_starts_at?: string | null
          created_at?: string
          id?: string
          job_id?: string
          owner_user_id?: string
          request_note?: string | null
          requested_ends_at?: string
          requested_starts_at?: string
          resolved_at?: string | null
          resulting_appointment_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_requests_owner_user_id_job_id_appointment_id_fkey"
            columns: ["owner_user_id", "job_id", "appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["owner_user_id", "job_id", "id"]
          },
          {
            foreignKeyName: "appointment_requests_owner_user_id_job_id_resulting_appoin_fkey"
            columns: ["owner_user_id", "job_id", "resulting_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["owner_user_id", "job_id", "id"]
          },
        ]
      }
      appointments: {
        Row: {
          closed_at: string | null
          created_at: string
          ends_at: string
          id: string
          job_id: string
          owner_user_id: string
          private_note: string | null
          replaced_by_id: string | null
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          ends_at: string
          id?: string
          job_id: string
          owner_user_id: string
          private_note?: string | null
          replaced_by_id?: string | null
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          job_id?: string
          owner_user_id?: string
          private_note?: string | null
          replaced_by_id?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_owner_user_id_job_id_fkey"
            columns: ["owner_user_id", "job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["owner_user_id", "id"]
          },
          {
            foreignKeyName: "appointments_owner_user_id_job_id_replaced_by_id_fkey"
            columns: ["owner_user_id", "job_id", "replaced_by_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["owner_user_id", "job_id", "id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          address_text: string
          created_at: string
          customer_id: string
          id: string
          label: string | null
          owner_user_id: string
          updated_at: string
        }
        Insert: {
          address_text: string
          created_at?: string
          customer_id: string
          id?: string
          label?: string | null
          owner_user_id?: string
          updated_at?: string
        }
        Update: {
          address_text?: string
          created_at?: string
          customer_id?: string
          id?: string
          label?: string | null
          owner_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_owner_user_id_customer_id_fkey"
            columns: ["owner_user_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["owner_user_id", "id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_user_id: string
          phone: string | null
          private_note: string | null
          search_key: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_user_id?: string
          phone?: string | null
          private_note?: string | null
          search_key?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
          phone?: string | null
          private_note?: string | null
          search_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_events: {
        Row: {
          actor_type: string
          created_at: string
          event_type: string
          id: string
          job_id: string
          owner_user_id: string
          payload: Json
        }
        Insert: {
          actor_type: string
          created_at?: string
          event_type: string
          id?: string
          job_id: string
          owner_user_id: string
          payload?: Json
        }
        Update: {
          actor_type?: string
          created_at?: string
          event_type?: string
          id?: string
          job_id?: string
          owner_user_id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "job_events_owner_user_id_job_id_fkey"
            columns: ["owner_user_id", "job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["owner_user_id", "id"]
          },
        ]
      }
      job_media: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          duration_seconds: number | null
          id: string
          job_id: string
          kind: string
          mime_type: string
          origin: string
          owner_user_id: string
          size_bytes: number
          storage_bucket: string
          storage_path: string
          visibility: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          duration_seconds?: number | null
          id?: string
          job_id: string
          kind: string
          mime_type: string
          origin: string
          owner_user_id?: string
          size_bytes: number
          storage_bucket: string
          storage_path: string
          visibility?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          duration_seconds?: number | null
          id?: string
          job_id?: string
          kind?: string
          mime_type?: string
          origin?: string
          owner_user_id?: string
          size_bytes?: number
          storage_bucket?: string
          storage_path?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_media_owner_user_id_job_id_fkey"
            columns: ["owner_user_id", "job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["owner_user_id", "id"]
          },
        ]
      }
      jobs: {
        Row: {
          address_id: string | null
          agreed_price: number | null
          cancelled_at: string | null
          cancelled_by: string | null
          cancelled_note: string | null
          cancelled_reason: string | null
          completed_at: string | null
          created_at: string
          currency: string
          customer_id: string
          estimated_price: number | null
          id: string
          owner_user_id: string
          private_note: string | null
          search_key: string | null
          share_enabled: boolean
          share_version: number
          show_price_to_customer: boolean
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          address_id?: string | null
          agreed_price?: number | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_note?: string | null
          cancelled_reason?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          customer_id: string
          estimated_price?: number | null
          id?: string
          owner_user_id: string
          private_note?: string | null
          search_key?: string | null
          share_enabled?: boolean
          share_version?: number
          show_price_to_customer?: boolean
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          address_id?: string | null
          agreed_price?: number | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_note?: string | null
          cancelled_reason?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          customer_id?: string
          estimated_price?: number | null
          id?: string
          owner_user_id?: string
          private_note?: string | null
          search_key?: string | null
          share_enabled?: boolean
          share_version?: number
          show_price_to_customer?: boolean
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_owner_user_id_customer_id_address_id_fkey"
            columns: ["owner_user_id", "customer_id", "address_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["owner_user_id", "customer_id", "id"]
          },
          {
            foreignKeyName: "jobs_owner_user_id_customer_id_fkey"
            columns: ["owner_user_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["owner_user_id", "id"]
          },
          {
            foreignKeyName: "jobs_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          appointment_id: string | null
          category: string
          created_at: string
          dedupe_key: string
          id: string
          in_inbox: boolean
          job_id: string | null
          owner_user_id: string
          payload: Json
          push_attempts: number
          push_next_attempt_at: string | null
          push_status: string
          pushed_at: string | null
          read_at: string | null
          request_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          category: string
          created_at?: string
          dedupe_key: string
          id?: string
          in_inbox?: boolean
          job_id?: string | null
          owner_user_id: string
          payload?: Json
          push_attempts?: number
          push_next_attempt_at?: string | null
          push_status?: string
          pushed_at?: string | null
          read_at?: string | null
          request_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          category?: string
          created_at?: string
          dedupe_key?: string
          id?: string
          in_inbox?: boolean
          job_id?: string | null
          owner_user_id?: string
          payload?: Json
          push_attempts?: number
          push_next_attempt_at?: string | null
          push_status?: string
          pushed_at?: string | null
          read_at?: string | null
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_owner_user_id_job_id_fkey"
            columns: ["owner_user_id", "job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["owner_user_id", "id"]
          },
        ]
      }
      profiles: {
        Row: {
          business_name: string | null
          contact_phone: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          business_name?: string | null
          contact_phone?: string | null
          created_at?: string
          display_name: string
          id: string
          updated_at?: string
        }
        Update: {
          business_name?: string | null
          contact_phone?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          device_label: string | null
          endpoint: string
          failure_count: number
          id: string
          last_success_at: string | null
          owner_user_id: string
          p256dh: string
        }
        Insert: {
          auth: string
          created_at?: string
          device_label?: string | null
          endpoint: string
          failure_count?: number
          id?: string
          last_success_at?: string | null
          owner_user_id?: string
          p256dh: string
        }
        Update: {
          auth?: string
          created_at?: string
          device_label?: string | null
          endpoint?: string
          failure_count?: number
          id?: string
          last_success_at?: string | null
          owner_user_id?: string
          p256dh?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      fold_tr: { Args: { input: string }; Returns: string }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
