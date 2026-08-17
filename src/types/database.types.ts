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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      areas: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          completed_count: number
          created_at: string
          display_name: string
          email: string
          id: string
          is_admin: boolean
          is_authorized: boolean
          phone_number: string | null
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          completed_count?: number
          created_at?: string
          display_name?: string
          email: string
          id: string
          is_admin?: boolean
          is_authorized?: boolean
          phone_number?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          completed_count?: number
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          is_admin?: boolean
          is_authorized?: boolean
          phone_number?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rounds: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          label: string
          started_at: string
          started_by: string | null
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          label?: string
          started_at?: string
          started_by?: string | null
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          label?: string
          started_at?: string
          started_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rounds_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "user_stats"
            referencedColumns: ["user_id"]
          },
        ]
      }
      station_completions: {
        Row: {
          action: Database["public"]["Enums"]["completion_action"]
          created_at: string
          id: string
          queued: boolean
          round_id: string | null
          station_id: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["completion_action"]
          created_at?: string
          id?: string
          queued?: boolean
          round_id?: string | null
          station_id: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["completion_action"]
          created_at?: string
          id?: string
          queued?: boolean
          round_id?: string | null
          station_id?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "station_completions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "round_stats"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "station_completions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "station_completions_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "station_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "station_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_stats"
            referencedColumns: ["user_id"]
          },
        ]
      }
      stations: {
        Row: {
          area_id: string
          completed_at: string | null
          completed_by: string | null
          completed_by_name: string | null
          created_at: string
          flyers: number
          fuel_type: Database["public"]["Enums"]["fuel_type"]
          has_envelope: boolean
          has_flyers_note: boolean
          id: string
          is_done: boolean
          latitude: number | null
          longitude: number | null
          name: string
          sort_number: number
          total: number
          updated_at: string
          waze_link: string | null
        }
        Insert: {
          area_id: string
          completed_at?: string | null
          completed_by?: string | null
          completed_by_name?: string | null
          created_at?: string
          flyers?: number
          fuel_type: Database["public"]["Enums"]["fuel_type"]
          has_envelope?: boolean
          has_flyers_note?: boolean
          id?: string
          is_done?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          sort_number?: number
          total?: number
          updated_at?: string
          waze_link?: string | null
        }
        Update: {
          area_id?: string
          completed_at?: string | null
          completed_by?: string | null
          completed_by_name?: string | null
          created_at?: string
          flyers?: number
          fuel_type?: Database["public"]["Enums"]["fuel_type"]
          has_envelope?: boolean
          has_flyers_note?: boolean
          id?: string
          is_done?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          sort_number?: number
          total?: number
          updated_at?: string
          waze_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stations_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "area_stats"
            referencedColumns: ["area_id"]
          },
          {
            foreignKeyName: "stations_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stations_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "my_areas"
            referencedColumns: ["area_id"]
          },
          {
            foreignKeyName: "stations_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stations_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "user_stats"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_areas: {
        Row: {
          area_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          area_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          area_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_areas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "area_stats"
            referencedColumns: ["area_id"]
          },
          {
            foreignKeyName: "user_areas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_areas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "my_areas"
            referencedColumns: ["area_id"]
          },
          {
            foreignKeyName: "user_areas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_areas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_stats"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      area_stats: {
        Row: {
          area_id: string | null
          area_name: string | null
          done_count: number | null
          remaining_count: number | null
          sort_order: number | null
          station_count: number | null
          total_flyers: number | null
          total_regular: number | null
          total_super: number | null
        }
        Relationships: []
      }
      completion_gaps: {
        Row: {
          completed_at: string | null
          from_station_id: string | null
          from_station_name: string | null
          gap_seconds: number | null
          is_anomaly: boolean | null
          median_gap_seconds: number | null
          round_id: string | null
          to_station_id: string | null
          to_station_name: string | null
          user_id: string | null
          user_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "station_completions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "round_stats"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "station_completions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "station_completions_station_id_fkey"
            columns: ["to_station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "station_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "station_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_stats"
            referencedColumns: ["user_id"]
          },
        ]
      }
      global_stats: {
        Row: {
          done_count: number | null
          remaining_count: number | null
          station_count: number | null
          total_flyers: number | null
          total_regular: number | null
          total_super: number | null
        }
        Relationships: []
      }
      my_areas: {
        Row: {
          area_id: string | null
          area_name: string | null
          done_count: number | null
          remaining_count: number | null
          sort_order: number | null
          station_count: number | null
        }
        Relationships: []
      }
      round_daily_stats: {
        Row: {
          completed_count: number | null
          day: string | null
          round_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "station_completions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "round_stats"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "station_completions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      round_stats: {
        Row: {
          completed_count: number | null
          ended_at: string | null
          first_completed_at: string | null
          label: string | null
          last_completed_at: string | null
          round_id: string | null
          started_at: string | null
          uncompleted_count: number | null
          worker_count: number | null
        }
        Relationships: []
      }
      round_user_stats: {
        Row: {
          completed_count: number | null
          round_id: string | null
          uncompleted_count: number | null
          user_id: string | null
          user_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "station_completions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "round_stats"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "station_completions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "station_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "station_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_stats"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_stats: {
        Row: {
          completed_count: number | null
          display_name: string | null
          is_admin: boolean | null
          is_authorized: boolean | null
          stations_completed_now: number | null
          user_id: string | null
        }
        Relationships: []
      }
      worker_pace_stats: {
        Row: {
          anomaly_count: number | null
          leg_count: number | null
          max_gap_seconds: number | null
          median_gap_seconds: number | null
          round_id: string | null
          user_id: string | null
          user_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "station_completions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "round_stats"
            referencedColumns: ["round_id"]
          },
          {
            foreignKeyName: "station_completions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "station_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "station_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_stats"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Functions: {
      admin_set_user_areas: {
        Args: { p_area_ids: string[]; p_user_id: string }
        Returns: {
          area_id: string
          created_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "user_areas"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_set_user_flags: {
        Args: {
          p_is_admin?: boolean
          p_is_authorized?: boolean
          p_user_id: string
        }
        Returns: {
          completed_count: number
          created_at: string
          display_name: string
          email: string
          id: string
          is_admin: boolean
          is_authorized: boolean
          phone_number: string | null
          photo_url: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_access_area: { Args: { p_area_id: string }; Returns: boolean }
      complete_station: {
        Args: { p_queued?: boolean; p_station_id: string }
        Returns: {
          area_id: string
          completed_at: string | null
          completed_by: string | null
          completed_by_name: string | null
          created_at: string
          flyers: number
          fuel_type: Database["public"]["Enums"]["fuel_type"]
          has_envelope: boolean
          has_flyers_note: boolean
          id: string
          is_done: boolean
          latitude: number | null
          longitude: number | null
          name: string
          sort_number: number
          total: number
          updated_at: string
          waze_link: string | null
        }
        SetofOptions: {
          from: "*"
          to: "stations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_round_id: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_authorized: { Args: never; Returns: boolean }
      reset_round: { Args: { p_label?: string }; Returns: string }
      set_station_markers: {
        Args: {
          p_has_envelope?: boolean
          p_has_flyers_note?: boolean
          p_station_id: string
        }
        Returns: {
          area_id: string
          completed_at: string | null
          completed_by: string | null
          completed_by_name: string | null
          created_at: string
          flyers: number
          fuel_type: Database["public"]["Enums"]["fuel_type"]
          has_envelope: boolean
          has_flyers_note: boolean
          id: string
          is_done: boolean
          latitude: number | null
          longitude: number | null
          name: string
          sort_number: number
          total: number
          updated_at: string
          waze_link: string | null
        }
        SetofOptions: {
          from: "*"
          to: "stations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      uncomplete_station: {
        Args: { p_queued?: boolean; p_station_id: string }
        Returns: {
          area_id: string
          completed_at: string | null
          completed_by: string | null
          completed_by_name: string | null
          created_at: string
          flyers: number
          fuel_type: Database["public"]["Enums"]["fuel_type"]
          has_envelope: boolean
          has_flyers_note: boolean
          id: string
          is_done: boolean
          latitude: number | null
          longitude: number | null
          name: string
          sort_number: number
          total: number
          updated_at: string
          waze_link: string | null
        }
        SetofOptions: {
          from: "*"
          to: "stations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      completion_action: "completed" | "uncompleted"
      fuel_type: "regular" | "super"
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
    Enums: {
      completion_action: ["completed", "uncompleted"],
      fuel_type: ["regular", "super"],
    },
  },
} as const
