export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      builds: {
        Row: {
          bobo_neck: boolean;
          created_at: string;
          guitar_type: string | null;
          id: string;
          name: string;
          owner_id: string;
          sequence_state: NonNullable<Json>;
          share_enabled: boolean;
          share_token: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          bobo_neck: boolean;
          created_at?: string;
          guitar_type?: string | null;
          id?: string;
          name: string;
          owner_id?: string;
          sequence_state?: NonNullable<Json>;
          share_enabled?: boolean;
          share_token?: string | null;
          updated_at?: string;
        };
        Update: {
          bobo_neck?: boolean;
          created_at?: string;
          guitar_type?: string | null;
          id?: string;
          name?: string;
          owner_id?: string;
          sequence_state?: NonNullable<Json>;
          share_enabled?: boolean;
          share_token?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      default_wood_panels: {
        Row: {
          created_at: string;
          e_cross_gpa: number | null;
          e_long_gpa: number | null;
          estimated_mass_g: number | null;
          freq_cross_grain_hz: number;
          freq_diagonal_hz: number;
          freq_longitudinal_hz: number;
          g_lc_gpa: number | null;
          id: string;
          name: string;
          plate_length_mm: number;
          plate_width_mm: number;
          sample_length_mm: number;
          sample_mass_g: number;
          sample_thickness_mm: number;
          sample_width_mm: number;
          stiffness_parameter: number;
          target_thickness_mm: number | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          e_cross_gpa?: number | null;
          e_long_gpa?: number | null;
          estimated_mass_g?: number | null;
          freq_cross_grain_hz: number;
          freq_diagonal_hz: number;
          freq_longitudinal_hz: number;
          g_lc_gpa?: number | null;
          id?: string;
          name: string;
          plate_length_mm: number;
          plate_width_mm: number;
          sample_length_mm: number;
          sample_mass_g: number;
          sample_thickness_mm: number;
          sample_width_mm: number;
          stiffness_parameter?: number;
          target_thickness_mm?: number | null;
        };
        Update: {
          created_at?: string;
          e_cross_gpa?: number | null;
          e_long_gpa?: number | null;
          estimated_mass_g?: number | null;
          freq_cross_grain_hz?: number;
          freq_diagonal_hz?: number;
          freq_longitudinal_hz?: number;
          g_lc_gpa?: number | null;
          id?: string;
          name?: string;
          plate_length_mm?: number;
          plate_width_mm?: number;
          sample_length_mm?: number;
          sample_mass_g?: number;
          sample_thickness_mm?: number;
          sample_width_mm?: number;
          stiffness_parameter?: number;
          target_thickness_mm?: number | null;
        };
        Relationships: [];
      };
      wood_panels: {
        Row: {
          created_at: string;
          e_cross_gpa: number | null;
          e_long_gpa: number | null;
          estimated_mass_g: number | null;
          freq_cross_grain_hz: number;
          freq_diagonal_hz: number;
          freq_longitudinal_hz: number;
          g_lc_gpa: number | null;
          id: string;
          name: string;
          owner_id: string;
          plate_length_mm: number;
          plate_width_mm: number;
          sample_length_mm: number;
          sample_mass_g: number;
          sample_thickness_mm: number;
          sample_width_mm: number;
          spectra: NonNullable<Json>;
          stiffness_parameter: number;
          target_thickness_mm: number | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          e_cross_gpa?: number | null;
          e_long_gpa?: number | null;
          estimated_mass_g?: number | null;
          freq_cross_grain_hz: number;
          freq_diagonal_hz: number;
          freq_longitudinal_hz: number;
          g_lc_gpa?: number | null;
          id?: string;
          name: string;
          owner_id?: string;
          plate_length_mm: number;
          plate_width_mm: number;
          sample_length_mm: number;
          sample_mass_g: number;
          sample_thickness_mm: number;
          sample_width_mm: number;
          spectra?: Json;
          stiffness_parameter?: number;
          target_thickness_mm?: number | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          e_cross_gpa?: number | null;
          e_long_gpa?: number | null;
          estimated_mass_g?: number | null;
          freq_cross_grain_hz?: number;
          freq_diagonal_hz?: number;
          freq_longitudinal_hz?: number;
          g_lc_gpa?: number | null;
          id?: string;
          name?: string;
          owner_id?: string;
          plate_length_mm?: number;
          plate_width_mm?: number;
          sample_length_mm?: number;
          sample_mass_g?: number;
          sample_thickness_mm?: number;
          sample_width_mm?: number;
          spectra?: Json;
          stiffness_parameter?: number;
          target_thickness_mm?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string | null;
          id: string;
          role: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email?: string | null;
          id: string;
          role?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          id?: string;
          role?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_list_users: {
        Args: Record<PropertyKey, never>;
        Returns: {
          created_at: string;
          email: string | null;
          id: string;
          role: string;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "profiles";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      admin_set_role: {
        Args: { new_role: string; target_user_id: string };
        Returns: {
          created_at: string;
          email: string | null;
          id: string;
          role: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "profiles";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      build_photo_paths: { Args: { p_build_id: string }; Returns: string[] };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_own_step_photo_path: { Args: { p_name: string }; Returns: boolean };
      load_default_wood_panels: { Args: Record<PropertyKey, never>; Returns: number | null };
      measurement_roles_are_valid: { Args: { p_roles: Json }; Returns: boolean };
      spectrum_record_is_valid: { Args: { p_record: Json }; Returns: boolean };
      update_build_step: {
        Args: { p_build_id: string; p_change: Json; p_step_key: string };
        Returns: Json;
      };
      wood_density_kg_m3: {
        Args: { h: number; l: number; m: number; w: number };
        Returns: number;
      };
      wood_e_cross_gpa: {
        Args: { fc: number; h: number; l: number; m: number; w: number };
        Returns: number;
      };
      wood_e_long_gpa: {
        Args: { fl: number; h: number; l: number; m: number; w: number };
        Returns: number;
      };
      wood_estimated_mass_g: {
        Args: {
          a: number;
          b: number;
          f: number;
          fc: number;
          fd: number;
          fl: number;
          h: number;
          l: number;
          m: number;
          w: number;
        };
        Returns: number;
      };
      wood_g_lc_gpa: {
        Args: { fd: number; h: number; l: number; m: number; w: number };
        Returns: number;
      };
      wood_panel_spectra_is_valid: { Args: { p_spectra: Json }; Returns: boolean };
      wood_target_thickness_mm: {
        Args: {
          a: number;
          b: number;
          f: number;
          fc: number;
          fd: number;
          fl: number;
          h: number;
          l: number;
          m: number;
          w: number;
        };
        Returns: number;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
