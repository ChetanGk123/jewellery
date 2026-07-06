// Generated from the live Supabase schema (project naolegptozpaiojozzcy).
// Regenerate after migrations via the Supabase `generate_typescript_types` tool / CLI.
// Do not hand-edit.

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
      category: {
        Row: {
          created_at: string
          description: string | null
          hero_bg: string | null
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          hero_bg?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          hero_bg?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      contact_message: {
        Row: {
          body: string
          created_at: string
          email: string
          id: string
          name: string
          phone: string
          status: string
          subject: string | null
          ticket_no: string
        }
        Insert: {
          body: string
          created_at?: string
          email: string
          id?: string
          name: string
          phone: string
          status?: string
          subject?: string | null
          ticket_no: string
        }
        Update: {
          body?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string
          status?: string
          subject?: string | null
          ticket_no?: string
        }
        Relationships: []
      }
      coupon: {
        Row: {
          code: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          kind: string
          max_discount_paise: number | null
          min_subtotal_paise: number | null
          usage_count: number
          usage_limit: number | null
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          kind: string
          max_discount_paise?: number | null
          min_subtotal_paise?: number | null
          usage_count?: number
          usage_limit?: number | null
          value?: number
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          max_discount_paise?: number | null
          min_subtotal_paise?: number | null
          usage_count?: number
          usage_limit?: number | null
          value?: number
        }
        Relationships: []
      }
      customer_profile: {
        Row: {
          address_line: string
          city: string
          created_at: string
          full_name: string
          id: string
          phone: string
          pincode: string
          state: string
          updated_at: string
        }
        Insert: {
          address_line?: string
          city?: string
          created_at?: string
          full_name?: string
          id: string
          phone?: string
          pincode?: string
          state?: string
          updated_at?: string
        }
        Update: {
          address_line?: string
          city?: string
          created_at?: string
          full_name?: string
          id?: string
          phone?: string
          pincode?: string
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      order: {
        Row: {
          address_line: string
          awb: string | null
          city: string
          coupon_code: string | null
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string
          discount_paise: number
          id: string
          order_no: string
          payment_method: string
          payment_status: string
          pincode: string
          shipping_paise: number
          shiprocket_shipment_id: string | null
          state: string
          status: string
          subtotal_paise: number
          total_paise: number
          user_id: string | null
        }
        Insert: {
          address_line: string
          awb?: string | null
          city: string
          coupon_code?: string | null
          created_at?: string
          customer_email: string
          customer_name: string
          customer_phone: string
          discount_paise?: number
          id?: string
          order_no: string
          payment_method?: string
          payment_status?: string
          pincode: string
          shipping_paise?: number
          shiprocket_shipment_id?: string | null
          state: string
          status?: string
          subtotal_paise: number
          total_paise: number
          user_id?: string | null
        }
        Update: {
          address_line?: string
          awb?: string | null
          city?: string
          coupon_code?: string | null
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          discount_paise?: number
          id?: string
          order_no?: string
          payment_method?: string
          payment_status?: string
          pincode?: string
          shipping_paise?: number
          shiprocket_shipment_id?: string | null
          state?: string
          status?: string
          subtotal_paise?: number
          total_paise?: number
          user_id?: string | null
        }
        Relationships: []
      }
      order_item: {
        Row: {
          id: string
          line_total_paise: number
          name: string
          order_id: string
          product_id: string
          qty: number
          tone: string | null
          unit_price_paise: number
        }
        Insert: {
          id?: string
          line_total_paise: number
          name: string
          order_id: string
          product_id: string
          qty: number
          tone?: string | null
          unit_price_paise: number
        }
        Update: {
          id?: string
          line_total_paise?: number
          name?: string
          order_id?: string
          product_id?: string
          qty?: number
          tone?: string | null
          unit_price_paise?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_item_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
        ]
      }
      product: {
        Row: {
          badge: string
          blurb: string | null
          category_id: string
          created_at: string
          desc_long: string | null
          details_care: string | null
          details_plating: string | null
          details_stones: string | null
          gallery: Json
          id: string
          is_featured: boolean
          is_fresh: boolean
          material: string | null
          mrp_paise: number | null
          name: string
          plating_options: string[]
          price_paise: number
          primary_image_url: string | null
          rating: number
          review_count: number
          search: unknown
          shipping_note: string | null
          sku: string
          slug: string
          status: string
          stock: number
          updated_at: string
        }
        Insert: {
          badge?: string
          blurb?: string | null
          category_id: string
          created_at?: string
          desc_long?: string | null
          details_care?: string | null
          details_plating?: string | null
          details_stones?: string | null
          gallery?: Json
          id?: string
          is_featured?: boolean
          is_fresh?: boolean
          material?: string | null
          mrp_paise?: number | null
          name: string
          plating_options?: string[]
          price_paise: number
          primary_image_url?: string | null
          rating?: number
          review_count?: number
          search?: unknown
          shipping_note?: string | null
          sku: string
          slug: string
          status?: string
          stock?: number
          updated_at?: string
        }
        Update: {
          badge?: string
          blurb?: string | null
          category_id?: string
          created_at?: string
          desc_long?: string | null
          details_care?: string | null
          details_plating?: string | null
          details_stones?: string | null
          gallery?: Json
          id?: string
          is_featured?: boolean
          is_fresh?: boolean
          material?: string | null
          mrp_paise?: number | null
          name?: string
          plating_options?: string[]
          price_paise?: number
          primary_image_url?: string | null
          rating?: number
          review_count?: number
          search?: unknown
          shipping_note?: string | null
          sku?: string
          slug?: string
          status?: string
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category"
            referencedColumns: ["id"]
          },
        ]
      }
      product_image: {
        Row: {
          bg: string | null
          design_name: string | null
          id: string
          is_primary: boolean
          product_id: string
          sort_order: number
          updated_at: string
          url: string | null
        }
        Insert: {
          bg?: string | null
          design_name?: string | null
          id?: string
          is_primary?: boolean
          product_id: string
          sort_order?: number
          updated_at?: string
          url?: string | null
        }
        Update: {
          bg?: string | null
          design_name?: string | null
          id?: string
          is_primary?: boolean
          product_id?: string
          sort_order?: number
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_image_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
        ]
      }
      product_option: {
        Row: {
          id: string
          label: string
          product_id: string
          sort_order: number
          value: string
        }
        Insert: {
          id?: string
          label: string
          product_id: string
          sort_order?: number
          value: string
        }
        Update: {
          id?: string
          label?: string
          product_id?: string
          sort_order?: number
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_option_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
        ]
      }
      review: {
        Row: {
          body: string | null
          created_at: string
          id: string
          name: string
          product_id: string
          rating: number
          status: string
          title: string | null
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          name: string
          product_id: string
          rating: number
          status?: string
          title?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          name?: string
          product_id?: string
          rating?: number
          status?: string
          title?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
        ]
      }
      setting: {
        Row: {
          banner: Json
          cod_enabled: boolean
          flat_rate_paise: number
          free_ship_threshold_paise: number
          gstin: string | null
          homepage_promo: Json
          id: boolean
          phone: string | null
          razorpay_live: boolean
          store_name: string
          support_email: string | null
          updated_at: string
        }
        Insert: {
          banner?: Json
          cod_enabled?: boolean
          flat_rate_paise?: number
          free_ship_threshold_paise?: number
          gstin?: string | null
          homepage_promo?: Json
          id?: boolean
          phone?: string | null
          razorpay_live?: boolean
          store_name?: string
          support_email?: string | null
          updated_at?: string
        }
        Update: {
          banner?: Json
          cod_enabled?: boolean
          flat_rate_paise?: number
          free_ship_threshold_paise?: number
          gstin?: string | null
          homepage_promo?: Json
          id?: boolean
          phone?: string | null
          razorpay_live?: boolean
          store_name?: string
          support_email?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriber: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_delete_category: {
        Args: { p_id: string }
        Returns: undefined
      }
      admin_set_order_status: {
        Args: { p_order_id: string; p_status: string }
        Returns: string
      }
      admin_remove_subscriber: {
        Args: { p_id: string }
        Returns: string
      }
      admin_update_settings: {
        Args: { p_payload: Json }
        Returns: Json
      }
      admin_set_message_status: {
        Args: { p_id: string; p_status: string }
        Returns: string
      }
      admin_set_review_status: {
        Args: { p_id: string; p_status: string }
        Returns: string
      }
      admin_toggle_coupon: {
        Args: { p_active: boolean; p_id: string }
        Returns: undefined
      }
      customer_cancel_order: {
        Args: { p_order_no: string }
        Returns: string
      }
      submit_review: {
        Args: {
          p_body: string
          p_name: string
          p_product_id: string
          p_rating: number
          p_title: string | null
        }
        Returns: Json
      }
      admin_upsert_coupon: {
        Args: { p_id: string | null; p_payload: Json }
        Returns: string
      }
      admin_upsert_category: {
        Args: { p_id: string | null; p_payload: Json }
        Returns: string
      }
      admin_upsert_product: {
        Args: { p_id: string | null; p_payload: Json }
        Returns: string
      }
      get_order_confirmation: { Args: { p_order_no: string }; Returns: Json }
      place_order: {
        Args: { p_coupon?: string; p_customer: Json; p_items: Json }
        Returns: Json
      }
      submit_contact_message: {
        Args: { p_payload: Json }
        Returns: Json
      }
      subscribe_email: {
        Args: { p_email: string; p_source?: string }
        Returns: Json
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
