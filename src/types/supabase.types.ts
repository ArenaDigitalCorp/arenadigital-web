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
      app_home_content: {
        Row: {
          active: boolean
          city_id: number | null
          created_at: string
          created_by: string | null
          cta_kind: string
          cta_label: string | null
          cta_url: string | null
          description: string | null
          ends_at: string | null
          id: string
          image_url: string | null
          kind: string
          priority: number
          sport_id: string | null
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          city_id?: number | null
          created_at?: string
          created_by?: string | null
          cta_kind?: string
          cta_label?: string | null
          cta_url?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          kind?: string
          priority?: number
          sport_id?: string | null
          starts_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          city_id?: number | null
          created_at?: string
          created_by?: string | null
          cta_kind?: string
          cta_label?: string | null
          cta_url?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          kind?: string
          priority?: number
          sport_id?: string | null
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_home_content_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "municipios"
            referencedColumns: ["codigo_ibge"]
          },
          {
            foreignKeyName: "app_home_content_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_home_content_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_ai_agents: {
        Row: {
          arena_id: string
          created_at: string
          created_by: string | null
          enabled: boolean
          fallback_message: string | null
          id: string
          max_output_tokens: number
          model: string
          monthly_token_cap: number | null
          persona_prompt: string | null
          status: string
          temperature: number
          updated_at: string
        }
        Insert: {
          arena_id: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          fallback_message?: string | null
          id?: string
          max_output_tokens?: number
          model?: string
          monthly_token_cap?: number | null
          persona_prompt?: string | null
          status?: string
          temperature?: number
          updated_at?: string
        }
        Update: {
          arena_id?: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          fallback_message?: string | null
          id?: string
          max_output_tokens?: number
          model?: string
          monthly_token_cap?: number | null
          persona_prompt?: string | null
          status?: string
          temperature?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_ai_agents_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: true
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_ai_agents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_comodidades: {
        Row: {
          arena_id: string
          comodidade_id: string
        }
        Insert: {
          arena_id: string
          comodidade_id: string
        }
        Update: {
          arena_id?: string
          comodidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_comodidades_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_comodidades_comodidade_id_fkey"
            columns: ["comodidade_id"]
            isOneToOne: false
            referencedRelation: "comodidades"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_highlights: {
        Row: {
          active: boolean
          arena_id: string
          city_id: number | null
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          image_url: string | null
          priority: number
          sport_id: string | null
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          arena_id: string
          city_id?: number | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          priority?: number
          sport_id?: string | null
          starts_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          arena_id?: string
          city_id?: number | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          priority?: number
          sport_id?: string | null
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_highlights_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_highlights_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "municipios"
            referencedColumns: ["codigo_ibge"]
          },
          {
            foreignKeyName: "arena_highlights_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_notifications: {
        Row: {
          arena_id: string
          atleta_id: string | null
          body: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          payload: Json
          read_at: string | null
          title: string
          type: string
        }
        Insert: {
          arena_id: string
          atleta_id?: string | null
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          payload?: Json
          read_at?: string | null
          title: string
          type: string
        }
        Update: {
          arena_id?: string
          atleta_id?: string | null
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          payload?: Json
          read_at?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_notifications_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_notifications_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_payment_accounts: {
        Row: {
          activated_at: string | null
          arena_id: string
          asaas_account_id: string | null
          asaas_api_key_secret_id: string | null
          asaas_wallet_id: string | null
          bank_account_info_status: string
          commercial_info_status: string
          created_at: string
          credential_recovery_pending: boolean
          documentation_status: string
          holder_document: string | null
          holder_name: string | null
          id: string
          last_status_checked_at: string | null
          metadata: Json
          onboarding_status: string
          onboarding_url: string | null
          payment_flow: string
          pix_key: string | null
          platform_fee_basis_points: number
          provider: string
          status: string
          updated_at: string
          webhook_token_hash: string | null
        }
        Insert: {
          activated_at?: string | null
          arena_id: string
          asaas_account_id?: string | null
          asaas_api_key_secret_id?: string | null
          asaas_wallet_id?: string | null
          bank_account_info_status?: string
          commercial_info_status?: string
          created_at?: string
          credential_recovery_pending?: boolean
          documentation_status?: string
          holder_document?: string | null
          holder_name?: string | null
          id?: string
          last_status_checked_at?: string | null
          metadata?: Json
          onboarding_status?: string
          onboarding_url?: string | null
          payment_flow?: string
          pix_key?: string | null
          platform_fee_basis_points?: number
          provider?: string
          status?: string
          updated_at?: string
          webhook_token_hash?: string | null
        }
        Update: {
          activated_at?: string | null
          arena_id?: string
          asaas_account_id?: string | null
          asaas_api_key_secret_id?: string | null
          asaas_wallet_id?: string | null
          bank_account_info_status?: string
          commercial_info_status?: string
          created_at?: string
          credential_recovery_pending?: boolean
          documentation_status?: string
          holder_document?: string | null
          holder_name?: string | null
          id?: string
          last_status_checked_at?: string | null
          metadata?: Json
          onboarding_status?: string
          onboarding_url?: string | null
          payment_flow?: string
          pix_key?: string | null
          platform_fee_basis_points?: number
          provider?: string
          status?: string
          updated_at?: string
          webhook_token_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arena_payment_accounts_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_promotions: {
        Row: {
          active: boolean
          arena_id: string
          court_id: string | null
          created_at: string
          description: string | null
          end_time: string | null
          ends_at: string | null
          id: string
          image_url: string | null
          original_price: number | null
          price: number | null
          priority: number
          sport_id: string | null
          start_time: string | null
          starts_at: string
          title: string
          updated_at: string
          weekday: number | null
        }
        Insert: {
          active?: boolean
          arena_id: string
          court_id?: string | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          original_price?: number | null
          price?: number | null
          priority?: number
          sport_id?: string | null
          start_time?: string | null
          starts_at?: string
          title: string
          updated_at?: string
          weekday?: number | null
        }
        Update: {
          active?: boolean
          arena_id?: string
          court_id?: string | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          original_price?: number | null
          price?: number | null
          priority?: number
          sport_id?: string | null
          start_time?: string | null
          starts_at?: string
          title?: string
          updated_at?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "arena_promotions_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_promotions_court_arena_consistency_fkey"
            columns: ["court_id", "arena_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id", "arena_id"]
          },
          {
            foreignKeyName: "arena_promotions_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_promotions_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_sports: {
        Row: {
          arena_id: string
          sport_id: string
        }
        Insert: {
          arena_id: string
          sport_id: string
        }
        Update: {
          arena_id?: string
          sport_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_sports_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_sports_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_subscriptions: {
        Row: {
          arena_id: string
          billing_snapshot: Json | null
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          experimental_started_at: string | null
          gateway_checkout_id: string | null
          gateway_customer_id: string | null
          gateway_subscription_id: string | null
          id: string
          plan_id: string | null
          plan_key: string
          status: string
          updated_at: string
        }
        Insert: {
          arena_id: string
          billing_snapshot?: Json | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          experimental_started_at?: string | null
          gateway_checkout_id?: string | null
          gateway_customer_id?: string | null
          gateway_subscription_id?: string | null
          id?: string
          plan_id?: string | null
          plan_key: string
          status?: string
          updated_at?: string
        }
        Update: {
          arena_id?: string
          billing_snapshot?: Json | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          experimental_started_at?: string | null
          gateway_checkout_id?: string | null
          gateway_customer_id?: string | null
          gateway_subscription_id?: string | null
          id?: string
          plan_id?: string | null
          plan_key?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_subscriptions_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: true
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_users: {
        Row: {
          arena_id: string
          created_at: string
          id: string
          role: string
          station_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          arena_id: string
          created_at?: string
          id?: string
          role?: string
          station_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          arena_id?: string
          created_at?: string
          id?: string
          role?: string
          station_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_users_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_users_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      arenas: {
        Row: {
          address: Json | null
          app_discoverable: boolean
          banner_url: string | null
          complement: string | null
          cpf_cnpj: string | null
          created_at: string
          description: string | null
          email: string | null
          facebook: string | null
          id: string
          id_municipio: number | null
          instagram: string | null
          location: unknown
          name: string
          neighborhood: string | null
          nome_moeda_virtual: string | null
          number: string | null
          opening_hours: Json | null
          owner_id: string | null
          phone: string | null
          platform_kind: string
          show_presence: boolean | null
          sports: string[] | null
          status: string | null
          tiktok: string | null
          zip_code: string | null
        }
        Insert: {
          address?: Json | null
          app_discoverable?: boolean
          banner_url?: string | null
          complement?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          facebook?: string | null
          id?: string
          id_municipio?: number | null
          instagram?: string | null
          location?: unknown
          name: string
          neighborhood?: string | null
          nome_moeda_virtual?: string | null
          number?: string | null
          opening_hours?: Json | null
          owner_id?: string | null
          phone?: string | null
          platform_kind?: string
          show_presence?: boolean | null
          sports?: string[] | null
          status?: string | null
          tiktok?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: Json | null
          app_discoverable?: boolean
          banner_url?: string | null
          complement?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          facebook?: string | null
          id?: string
          id_municipio?: number | null
          instagram?: string | null
          location?: unknown
          name?: string
          neighborhood?: string | null
          nome_moeda_virtual?: string | null
          number?: string | null
          opening_hours?: Json | null
          owner_id?: string | null
          phone?: string | null
          platform_kind?: string
          show_presence?: boolean | null
          sports?: string[] | null
          status?: string | null
          tiktok?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arenas_municipio_id_fkey"
            columns: ["id_municipio"]
            isOneToOne: false
            referencedRelation: "municipios"
            referencedColumns: ["codigo_ibge"]
          },
          {
            foreignKeyName: "arenas_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      arenas_atleta: {
        Row: {
          data_criacao: string
          id: string
          id_arena: string
          id_atleta: string
          origem: Database["public"]["Enums"]["origem_vinculo_arena"] | null
        }
        Insert: {
          data_criacao?: string
          id?: string
          id_arena: string
          id_atleta: string
          origem?: Database["public"]["Enums"]["origem_vinculo_arena"] | null
        }
        Update: {
          data_criacao?: string
          id?: string
          id_arena?: string
          id_atleta?: string
          origem?: Database["public"]["Enums"]["origem_vinculo_arena"] | null
        }
        Relationships: [
          {
            foreignKeyName: "arenas_atleta_id_arena_fkey"
            columns: ["id_arena"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arenas_atleta_id_atleta_fkey"
            columns: ["id_atleta"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_app_entitlements: {
        Row: {
          atleta_id: string
          created_at: string
          current_period_end: string | null
          expires_at: string | null
          id: string
          metadata: Json
          plan: string
          status: string
          updated_at: string
        }
        Insert: {
          atleta_id: string
          created_at?: string
          current_period_end?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json
          plan?: string
          status?: string
          updated_at?: string
        }
        Update: {
          atleta_id?: string
          created_at?: string
          current_period_end?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json
          plan?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_app_entitlements_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: true
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_app_plan_catalog: {
        Row: {
          billing_period: string
          created_at: string
          currency: string
          features: Json
          is_active: boolean
          key: string
          label: string
          price_cents: number
          store_product_id: string
          updated_at: string
        }
        Insert: {
          billing_period?: string
          created_at?: string
          currency?: string
          features?: Json
          is_active?: boolean
          key: string
          label: string
          price_cents: number
          store_product_id: string
          updated_at?: string
        }
        Update: {
          billing_period?: string
          created_at?: string
          currency?: string
          features?: Json
          is_active?: boolean
          key?: string
          label?: string
          price_cents?: number
          store_product_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      athlete_billing_customers: {
        Row: {
          atleta_id: string
          claim_expires_at: string | null
          created_at: string
          external_reference: string
          gateway_customer_id: string | null
          id: string
          idempotency_key: string
          last_error: Json | null
          provider: string
          provider_account_id: string
          raw_response: Json
          reconciliation_required: boolean
          status: string
          updated_at: string
        }
        Insert: {
          atleta_id: string
          claim_expires_at?: string | null
          created_at?: string
          external_reference: string
          gateway_customer_id?: string | null
          id?: string
          idempotency_key: string
          last_error?: Json | null
          provider?: string
          provider_account_id: string
          raw_response?: Json
          reconciliation_required?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          atleta_id?: string
          claim_expires_at?: string | null
          created_at?: string
          external_reference?: string
          gateway_customer_id?: string | null
          id?: string
          idempotency_key?: string
          last_error?: Json | null
          provider?: string
          provider_account_id?: string
          raw_response?: Json
          reconciliation_required?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_billing_customers_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_store_purchase_audit: {
        Row: {
          atleta_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json
          platform: string
          provider_status: string | null
          receipt_fingerprint: string
          subscription_id: string | null
        }
        Insert: {
          atleta_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          platform: string
          provider_status?: string | null
          receipt_fingerprint: string
          subscription_id?: string | null
        }
        Update: {
          atleta_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          platform?: string
          provider_status?: string | null
          receipt_fingerprint?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_store_purchase_audit_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_store_purchase_audit_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "athlete_store_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_store_subscriptions: {
        Row: {
          atleta_id: string
          created_at: string
          current_period_end: string | null
          expires_at: string | null
          id: string
          last_verified_at: string | null
          original_transaction_id: string | null
          platform: string
          product_id: string
          purchase_token: string | null
          raw_response: Json
          status: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          atleta_id: string
          created_at?: string
          current_period_end?: string | null
          expires_at?: string | null
          id?: string
          last_verified_at?: string | null
          original_transaction_id?: string | null
          platform: string
          product_id: string
          purchase_token?: string | null
          raw_response?: Json
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          atleta_id?: string
          created_at?: string
          current_period_end?: string | null
          expires_at?: string | null
          id?: string
          last_verified_at?: string | null
          original_transaction_id?: string | null
          platform?: string
          product_id?: string
          purchase_token?: string | null
          raw_response?: Json
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_store_subscriptions_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
        ]
      }
      atleta: {
        Row: {
          bairro: string | null
          cep: string | null
          compartilha_info: boolean | null
          complemento: string | null
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          descricao_perfil: string | null
          endereco: string | null
          endereco_numero: string | null
          facebook: string | null
          foto_url: string | null
          id: string
          id_arena_cadastro: string | null
          id_municipio: number | null
          id_users: string
          instagram: string | null
          nome_perfil: string
          origem_cadastro: string | null
          push_last_sent_at: string | null
          push_notifications_enabled: boolean
          push_token: string | null
          telefone: string | null
          tiktok: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          compartilha_info?: boolean | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          descricao_perfil?: string | null
          endereco?: string | null
          endereco_numero?: string | null
          facebook?: string | null
          foto_url?: string | null
          id?: string
          id_arena_cadastro?: string | null
          id_municipio?: number | null
          id_users: string
          instagram?: string | null
          nome_perfil: string
          origem_cadastro?: string | null
          push_last_sent_at?: string | null
          push_notifications_enabled?: boolean
          push_token?: string | null
          telefone?: string | null
          tiktok?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          compartilha_info?: boolean | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          descricao_perfil?: string | null
          endereco?: string | null
          endereco_numero?: string | null
          facebook?: string | null
          foto_url?: string | null
          id?: string
          id_arena_cadastro?: string | null
          id_municipio?: number | null
          id_users?: string
          instagram?: string | null
          nome_perfil?: string
          origem_cadastro?: string | null
          push_last_sent_at?: string | null
          push_notifications_enabled?: boolean
          push_token?: string | null
          telefone?: string | null
          tiktok?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "atleta_id_arena_cadastro_fkey"
            columns: ["id_arena_cadastro"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atleta_id_users_fkey"
            columns: ["id_users"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_atleta_municipio"
            columns: ["id_municipio"]
            isOneToOne: false
            referencedRelation: "municipios"
            referencedColumns: ["codigo_ibge"]
          },
        ]
      }
      atleta_arena_favoritos: {
        Row: {
          created_at: string
          id: string
          id_arena: string
          id_atleta: string
        }
        Insert: {
          created_at?: string
          id?: string
          id_arena: string
          id_atleta: string
        }
        Update: {
          created_at?: string
          id?: string
          id_arena?: string
          id_atleta?: string
        }
        Relationships: [
          {
            foreignKeyName: "atleta_arena_favoritos_id_arena_fkey"
            columns: ["id_arena"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atleta_arena_favoritos_id_atleta_fkey"
            columns: ["id_atleta"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
        ]
      }
      atleta_conexoes: {
        Row: {
          data_criacao: string
          data_resposta: string | null
          id: string
          id_atleta_solicitado: string
          id_atleta_solicitante: string
          status: string
        }
        Insert: {
          data_criacao?: string
          data_resposta?: string | null
          id?: string
          id_atleta_solicitado: string
          id_atleta_solicitante: string
          status?: string
        }
        Update: {
          data_criacao?: string
          data_resposta?: string | null
          id?: string
          id_atleta_solicitado?: string
          id_atleta_solicitante?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "atleta_conexoes_solicitado_fkey"
            columns: ["id_atleta_solicitado"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atleta_conexoes_solicitante_fkey"
            columns: ["id_atleta_solicitante"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
        ]
      }
      atleta_esporte_historico: {
        Row: {
          data_criacao: string
          id: string
          id_atleta: string
          id_esporte: string | null
          id_nivel_anterior: string | null
          id_nivel_habilidade_esporte: string
          id_nivel_novo: string | null
          is_public: boolean
          metadata: Json
          origem: string
        }
        Insert: {
          data_criacao?: string
          id?: string
          id_atleta: string
          id_esporte?: string | null
          id_nivel_anterior?: string | null
          id_nivel_habilidade_esporte: string
          id_nivel_novo?: string | null
          is_public?: boolean
          metadata?: Json
          origem?: string
        }
        Update: {
          data_criacao?: string
          id?: string
          id_atleta?: string
          id_esporte?: string | null
          id_nivel_anterior?: string | null
          id_nivel_habilidade_esporte?: string
          id_nivel_novo?: string | null
          is_public?: boolean
          metadata?: Json
          origem?: string
        }
        Relationships: [
          {
            foreignKeyName: "atleta_esporte_historico_id_atleta_fkey"
            columns: ["id_atleta"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atleta_esporte_historico_id_esporte_fkey"
            columns: ["id_esporte"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atleta_esporte_historico_id_nivel_anterior_fkey"
            columns: ["id_nivel_anterior"]
            isOneToOne: false
            referencedRelation: "nivel_habilidade_esporte"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atleta_esporte_historico_id_nivel_fkey"
            columns: ["id_nivel_habilidade_esporte"]
            isOneToOne: false
            referencedRelation: "nivel_habilidade_esporte"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atleta_esporte_historico_id_nivel_novo_fkey"
            columns: ["id_nivel_novo"]
            isOneToOne: false
            referencedRelation: "nivel_habilidade_esporte"
            referencedColumns: ["id"]
          },
        ]
      }
      atleta_esportes: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          id_atleta: string
          id_esporte: string
          id_nivel_habilidade_esporte: string | null
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          id_atleta: string
          id_esporte: string
          id_nivel_habilidade_esporte?: string | null
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          id_atleta?: string
          id_esporte?: string
          id_nivel_habilidade_esporte?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "atleta_esportes_id_atleta_fkey"
            columns: ["id_atleta"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atleta_esportes_id_esporte_fkey"
            columns: ["id_esporte"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atleta_esportes_id_nivel_habilidade_esporte_fkey"
            columns: ["id_nivel_habilidade_esporte"]
            isOneToOne: false
            referencedRelation: "nivel_habilidade_esporte"
            referencedColumns: ["id"]
          },
        ]
      }
      atleta_locations: {
        Row: {
          id_atleta: string
          location: unknown
          updated_at: string | null
        }
        Insert: {
          id_atleta: string
          location: unknown
          updated_at?: string | null
        }
        Update: {
          id_atleta?: string
          location?: unknown
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "atleta_locations_id_atleta_fkey"
            columns: ["id_atleta"]
            isOneToOne: true
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          new_value: Json | null
          old_value: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
        }
        Relationships: []
      }
      booking_participants: {
        Row: {
          atleta_id: string
          booking_id: string
          created_at: string | null
          funcao: string
          id: string
          id_time: string | null
          pago_em: string | null
          status: string
          valor: number | null
        }
        Insert: {
          atleta_id: string
          booking_id: string
          created_at?: string | null
          funcao?: string
          id?: string
          id_time?: string | null
          pago_em?: string | null
          status?: string
          valor?: number | null
        }
        Update: {
          atleta_id?: string
          booking_id?: string
          created_at?: string | null
          funcao?: string
          id?: string
          id_time?: string | null
          pago_em?: string | null
          status?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_participants_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_participants_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_participants_id_time_fkey"
            columns: ["id_time"]
            isOneToOne: false
            referencedRelation: "times"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_payment_transition_events: {
        Row: {
          booking_id: string
          booking_payment_id: string
          created_at: string
          from_status: string
          id: string
          payload: Json
          source: string
          to_status: string
        }
        Insert: {
          booking_id: string
          booking_payment_id: string
          created_at?: string
          from_status: string
          id?: string
          payload?: Json
          source?: string
          to_status: string
        }
        Update: {
          booking_id?: string
          booking_payment_id?: string
          created_at?: string
          from_status?: string
          id?: string
          payload?: Json
          source?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_payment_transition_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payment_transition_events_booking_payment_id_fkey"
            columns: ["booking_payment_id"]
            isOneToOne: false
            referencedRelation: "booking_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_payment_webhook_events: {
        Row: {
          booking_id: string | null
          booking_payment_id: string | null
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          payload: Json | null
          processed_at: string | null
          provider: string
          provider_event_id: string
          received_at: string
          status: string
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          booking_payment_id?: string | null
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          provider?: string
          provider_event_id: string
          received_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          booking_payment_id?: string | null
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          provider?: string
          provider_event_id?: string
          received_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_payment_webhook_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payment_webhook_events_booking_payment_id_fkey"
            columns: ["booking_payment_id"]
            isOneToOne: false
            referencedRelation: "booking_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_payments: {
        Row: {
          amount_cents: number
          arena_id: string
          arena_split_basis_points: number
          atleta_id: string
          attempt_count: number
          booking_id: string
          created_at: string
          expired_at: string | null
          external_reference: string
          failed_at: string | null
          gateway_customer_id: string | null
          gateway_payment_id: string | null
          id: string
          idempotency_key: string
          last_attempt_at: string | null
          last_error: Json | null
          merchant_model: string
          paid_at: string | null
          pix_expires_at: string | null
          pix_payload: string | null
          pix_qr_code_base64: string | null
          platform_fee_amount_cents: number | null
          platform_fee_basis_points: number
          platform_split_checked_at: string | null
          platform_split_reconciliation_required: boolean
          platform_split_refusal_reason: string | null
          platform_split_status: string
          provider: string
          provider_account_id: string
          raw_response: Json
          reconciliation_required: boolean
          retry_after: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          arena_id: string
          arena_split_basis_points?: number
          atleta_id: string
          attempt_count?: number
          booking_id: string
          created_at?: string
          expired_at?: string | null
          external_reference: string
          failed_at?: string | null
          gateway_customer_id?: string | null
          gateway_payment_id?: string | null
          id?: string
          idempotency_key: string
          last_attempt_at?: string | null
          last_error?: Json | null
          merchant_model?: string
          paid_at?: string | null
          pix_expires_at?: string | null
          pix_payload?: string | null
          pix_qr_code_base64?: string | null
          platform_fee_amount_cents?: number | null
          platform_fee_basis_points?: number
          platform_split_checked_at?: string | null
          platform_split_reconciliation_required?: boolean
          platform_split_refusal_reason?: string | null
          platform_split_status?: string
          provider?: string
          provider_account_id: string
          raw_response?: Json
          reconciliation_required?: boolean
          retry_after?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          arena_id?: string
          arena_split_basis_points?: number
          atleta_id?: string
          attempt_count?: number
          booking_id?: string
          created_at?: string
          expired_at?: string | null
          external_reference?: string
          failed_at?: string | null
          gateway_customer_id?: string | null
          gateway_payment_id?: string | null
          id?: string
          idempotency_key?: string
          last_attempt_at?: string | null
          last_error?: Json | null
          merchant_model?: string
          paid_at?: string | null
          pix_expires_at?: string | null
          pix_payload?: string | null
          pix_qr_code_base64?: string | null
          platform_fee_amount_cents?: number | null
          platform_fee_basis_points?: number
          platform_split_checked_at?: string | null
          platform_split_reconciliation_required?: boolean
          platform_split_refusal_reason?: string | null
          platform_split_status?: string
          provider?: string
          provider_account_id?: string
          raw_response?: Json
          reconciliation_required?: boolean
          retry_after?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_payments_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payments_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_result_confirmations: {
        Row: {
          atleta_id: string
          booking_result_id: string
          created_at: string
          id: string
          note: string | null
          status: string
          updated_at: string
        }
        Insert: {
          atleta_id: string
          booking_result_id: string
          created_at?: string
          id?: string
          note?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          atleta_id?: string
          booking_result_id?: string
          created_at?: string
          id?: string
          note?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_result_confirmations_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_result_confirmations_booking_result_id_fkey"
            columns: ["booking_result_id"]
            isOneToOne: false
            referencedRelation: "booking_results"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_result_players: {
        Row: {
          atleta_id: string
          created_at: string
          id: string
          side_id: string
        }
        Insert: {
          atleta_id: string
          created_at?: string
          id?: string
          side_id: string
        }
        Update: {
          atleta_id?: string
          created_at?: string
          id?: string
          side_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_result_players_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_result_players_side_id_fkey"
            columns: ["side_id"]
            isOneToOne: false
            referencedRelation: "booking_result_sides"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_result_sides: {
        Row: {
          booking_result_id: string
          created_at: string
          id: string
          id_time: string | null
          label: string
          score: number
        }
        Insert: {
          booking_result_id: string
          created_at?: string
          id?: string
          id_time?: string | null
          label: string
          score?: number
        }
        Update: {
          booking_result_id?: string
          created_at?: string
          id?: string
          id_time?: string | null
          label?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_result_sides_booking_result_id_fkey"
            columns: ["booking_result_id"]
            isOneToOne: false
            referencedRelation: "booking_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_result_sides_id_time_fkey"
            columns: ["id_time"]
            isOneToOne: false
            referencedRelation: "times"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_results: {
        Row: {
          booking_id: string
          confirmed_at: string | null
          created_at: string
          id: string
          metadata: Json
          reported_by: string
          status: string
          updated_at: string
        }
        Insert: {
          booking_id: string
          confirmed_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          reported_by: string
          status?: string
          updated_at?: string
        }
        Update: {
          booking_id?: string
          confirmed_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          reported_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_results_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_results_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_services: {
        Row: {
          booking_id: string
          created_at: string
          id: string
          product_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          booking_id: string
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          unit_price: number
        }
        Update: {
          booking_id?: string
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_services_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_services_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          arena_id: string
          athlete_id: string | null
          athlete_name: string | null
          booking_type: string | null
          cobranca_por_participante: boolean
          court_id: string
          created_at: string
          end_time: string
          id: string
          payment_confirmed_at: string | null
          payment_expires_at: string | null
          plano_mensalista_id: string | null
          price: number | null
          recurrence_id: string | null
          rental_price: number
          sport_id: string | null
          start_time: string
          status: string | null
        }
        Insert: {
          arena_id: string
          athlete_id?: string | null
          athlete_name?: string | null
          booking_type?: string | null
          cobranca_por_participante?: boolean
          court_id: string
          created_at?: string
          end_time: string
          id?: string
          payment_confirmed_at?: string | null
          payment_expires_at?: string | null
          plano_mensalista_id?: string | null
          price?: number | null
          recurrence_id?: string | null
          rental_price?: number
          sport_id?: string | null
          start_time: string
          status?: string | null
        }
        Update: {
          arena_id?: string
          athlete_id?: string | null
          athlete_name?: string | null
          booking_type?: string | null
          cobranca_por_participante?: boolean
          court_id?: string
          created_at?: string
          end_time?: string
          id?: string
          payment_confirmed_at?: string | null
          payment_expires_at?: string | null
          plano_mensalista_id?: string | null
          price?: number | null
          recurrence_id?: string | null
          rental_price?: number
          sport_id?: string | null
          start_time?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_court_arena_consistency_fkey"
            columns: ["court_id", "arena_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id", "arena_id"]
          },
          {
            foreignKeyName: "bookings_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_plano_mensalista_id_fkey"
            columns: ["plano_mensalista_id"]
            isOneToOne: false
            referencedRelation: "planos_mensalista"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      comentario_escopo: {
        Row: {
          escopo: string
          id: string
        }
        Insert: {
          escopo: string
          id?: string
        }
        Update: {
          escopo?: string
          id?: string
        }
        Relationships: []
      }
      comentario_sentimento: {
        Row: {
          id: string
          sentimento: string
        }
        Insert: {
          id?: string
          sentimento: string
        }
        Update: {
          id?: string
          sentimento?: string
        }
        Relationships: []
      }
      comentario_time_last_read: {
        Row: {
          atleta_id: string
          id: string
          last_read_at: string
          time_id: string
        }
        Insert: {
          atleta_id: string
          id?: string
          last_read_at?: string
          time_id: string
        }
        Update: {
          atleta_id?: string
          id?: string
          last_read_at?: string
          time_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comentario_time_last_read_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentario_time_last_read_time_id_fkey"
            columns: ["time_id"]
            isOneToOne: false
            referencedRelation: "times"
            referencedColumns: ["id"]
          },
        ]
      }
      comentarios_atleta_para_time: {
        Row: {
          atleta_id: string
          comentario_pai_id: string | null
          comentario_template_id: string | null
          data_criacao: string
          id: string
          lido: boolean
          texto: string | null
          time_id: string
        }
        Insert: {
          atleta_id: string
          comentario_pai_id?: string | null
          comentario_template_id?: string | null
          data_criacao?: string
          id?: string
          lido?: boolean
          texto?: string | null
          time_id: string
        }
        Update: {
          atleta_id?: string
          comentario_pai_id?: string | null
          comentario_template_id?: string | null
          data_criacao?: string
          id?: string
          lido?: boolean
          texto?: string | null
          time_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comentarios_atleta_para_time_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentarios_atleta_para_time_comentario_pai_id_fkey"
            columns: ["comentario_pai_id"]
            isOneToOne: false
            referencedRelation: "comentarios_atleta_para_time"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentarios_atleta_para_time_comentario_template_id_fkey"
            columns: ["comentario_template_id"]
            isOneToOne: false
            referencedRelation: "comentarios_template"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentarios_atleta_para_time_time_id_fkey"
            columns: ["time_id"]
            isOneToOne: false
            referencedRelation: "times"
            referencedColumns: ["id"]
          },
        ]
      }
      comentarios_template: {
        Row: {
          comentario_escopo_id: string
          comentario_sentimento_id: string
          id: string
          texto: string
        }
        Insert: {
          comentario_escopo_id: string
          comentario_sentimento_id: string
          id?: string
          texto: string
        }
        Update: {
          comentario_escopo_id?: string
          comentario_sentimento_id?: string
          id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "comentarios_template_comentario_escopo_id_fkey"
            columns: ["comentario_escopo_id"]
            isOneToOne: false
            referencedRelation: "comentario_escopo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentarios_template_comentario_sentimento_id_fkey"
            columns: ["comentario_sentimento_id"]
            isOneToOne: false
            referencedRelation: "comentario_sentimento"
            referencedColumns: ["id"]
          },
        ]
      }
      comodidades: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      court_sports: {
        Row: {
          court_id: string
          sport_id: string
        }
        Insert: {
          court_id: string
          sport_id: string
        }
        Update: {
          court_id?: string
          sport_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "court_sports_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "court_sports_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      courts: {
        Row: {
          arena_id: string
          attributes: Json | null
          available_days: string[] | null
          booking_type: string | null
          capacity: number | null
          created_at: string
          day_config: Json | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_covered: boolean | null
          name: string
          observations: string | null
          price: number | null
          status: string | null
          type: string
        }
        Insert: {
          arena_id: string
          attributes?: Json | null
          available_days?: string[] | null
          booking_type?: string | null
          capacity?: number | null
          created_at?: string
          day_config?: Json | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_covered?: boolean | null
          name: string
          observations?: string | null
          price?: number | null
          status?: string | null
          type: string
        }
        Update: {
          arena_id?: string
          attributes?: Json | null
          available_days?: string[] | null
          booking_type?: string | null
          capacity?: number | null
          created_at?: string
          day_config?: Json | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_covered?: boolean | null
          name?: string
          observations?: string | null
          price?: number | null
          status?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "courts_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
        ]
      }
      estados: {
        Row: {
          codigo_uf: number
          latitude: number
          longitude: number
          nome: string
          regiao: string
          uf: string
        }
        Insert: {
          codigo_uf: number
          latitude: number
          longitude: number
          nome: string
          regiao: string
          uf: string
        }
        Update: {
          codigo_uf?: number
          latitude?: number
          longitude?: number
          nome?: string
          regiao?: string
          uf?: string
        }
        Relationships: []
      }
      mensalista_cobrancas: {
        Row: {
          arena_id: string
          ativo: boolean
          atleta_id: string | null
          created_at: string
          credito_aplicado: number
          id: string
          mensalidade_id: string
          modo_pagamento_id: string | null
          nome: string
          observacao: string | null
          pago_em: string | null
          updated_at: string
          valor_devido: number
          valor_pago: number
        }
        Insert: {
          arena_id: string
          ativo?: boolean
          atleta_id?: string | null
          created_at?: string
          credito_aplicado?: number
          id?: string
          mensalidade_id: string
          modo_pagamento_id?: string | null
          nome: string
          observacao?: string | null
          pago_em?: string | null
          updated_at?: string
          valor_devido: number
          valor_pago?: number
        }
        Update: {
          arena_id?: string
          ativo?: boolean
          atleta_id?: string | null
          created_at?: string
          credito_aplicado?: number
          id?: string
          mensalidade_id?: string
          modo_pagamento_id?: string | null
          nome?: string
          observacao?: string | null
          pago_em?: string | null
          updated_at?: string
          valor_devido?: number
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "mensalista_cobrancas_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensalista_cobrancas_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensalista_cobrancas_mensalidade_id_fkey"
            columns: ["mensalidade_id"]
            isOneToOne: false
            referencedRelation: "mensalista_mensalidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensalista_cobrancas_modo_pagamento_id_fkey"
            columns: ["modo_pagamento_id"]
            isOneToOne: false
            referencedRelation: "modo_pagamento"
            referencedColumns: ["id"]
          },
        ]
      }
      mensalista_creditos: {
        Row: {
          arena_id: string
          atleta_id: string
          cobranca_id: string | null
          created_at: string
          descricao: string | null
          id: string
          registered_by: string | null
          tipo: string
          valor: number
        }
        Insert: {
          arena_id: string
          atleta_id: string
          cobranca_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          registered_by?: string | null
          tipo: string
          valor: number
        }
        Update: {
          arena_id?: string
          atleta_id?: string
          cobranca_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          registered_by?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "mensalista_creditos_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensalista_creditos_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensalista_creditos_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "mensalista_cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensalista_creditos_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      mensalista_mensalidades: {
        Row: {
          arena_id: string
          athlete_id: string
          competencia: string
          created_at: string
          id: string
          plano_id: string
          rateio: boolean
          status: string
          updated_at: string
          valor_total: number
          vencimento: string | null
        }
        Insert: {
          arena_id: string
          athlete_id: string
          competencia: string
          created_at?: string
          id?: string
          plano_id: string
          rateio?: boolean
          status?: string
          updated_at?: string
          valor_total: number
          vencimento?: string | null
        }
        Update: {
          arena_id?: string
          athlete_id?: string
          competencia?: string
          created_at?: string
          id?: string
          plano_id?: string
          rateio?: boolean
          status?: string
          updated_at?: string
          valor_total?: number
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mensalista_mensalidades_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensalista_mensalidades_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensalista_mensalidades_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos_mensalista"
            referencedColumns: ["id"]
          },
        ]
      }
      mensalista_pagamentos: {
        Row: {
          arena_id: string
          cobranca_id: string
          created_at: string
          credito_aplicado: number
          data_pagamento: string
          id: string
          modo_pagamento_id: string | null
          observacao: string | null
          registered_by: string | null
          transaction_id: string | null
          valor: number
        }
        Insert: {
          arena_id: string
          cobranca_id: string
          created_at?: string
          credito_aplicado?: number
          data_pagamento: string
          id?: string
          modo_pagamento_id?: string | null
          observacao?: string | null
          registered_by?: string | null
          transaction_id?: string | null
          valor?: number
        }
        Update: {
          arena_id?: string
          cobranca_id?: string
          created_at?: string
          credito_aplicado?: number
          data_pagamento?: string
          id?: string
          modo_pagamento_id?: string | null
          observacao?: string | null
          registered_by?: string | null
          transaction_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "mensalista_pagamentos_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensalista_pagamentos_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "mensalista_cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensalista_pagamentos_modo_pagamento_id_fkey"
            columns: ["modo_pagamento_id"]
            isOneToOne: false
            referencedRelation: "modo_pagamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensalista_pagamentos_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensalista_pagamentos_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      modo_pagamento: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      municipios: {
        Row: {
          capital: boolean
          codigo_ibge: number
          codigo_uf: number
          ddd: number
          fuso_horario: string
          latitude: number
          longitude: number
          nome: string
          siafi_id: string
        }
        Insert: {
          capital: boolean
          codigo_ibge: number
          codigo_uf: number
          ddd: number
          fuso_horario: string
          latitude: number
          longitude: number
          nome: string
          siafi_id: string
        }
        Update: {
          capital?: boolean
          codigo_ibge?: number
          codigo_uf?: number
          ddd?: number
          fuso_horario?: string
          latitude?: number
          longitude?: number
          nome?: string
          siafi_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "municipios_codigo_uf_fkey"
            columns: ["codigo_uf"]
            isOneToOne: false
            referencedRelation: "estados"
            referencedColumns: ["codigo_uf"]
          },
        ]
      }
      nivel_habilidade_esporte: {
        Row: {
          id: string
          id_esporte: string
          nivel: string
        }
        Insert: {
          id?: string
          id_esporte: string
          nivel: string
        }
        Update: {
          id?: string
          id_esporte?: string
          nivel?: string
        }
        Relationships: [
          {
            foreignKeyName: "nivel_habilidade_esporte_id_esporte_fkey"
            columns: ["id_esporte"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_events: {
        Row: {
          atleta_id: string
          body: string | null
          created_at: string
          id: string
          payload: Json
          read_at: string | null
          title: string
          type: string
        }
        Insert: {
          atleta_id: string
          body?: string | null
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          title: string
          type: string
        }
        Update: {
          atleta_id?: string
          body?: string | null
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_events_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
        ]
      }
      open_game_requests: {
        Row: {
          atleta_id: string
          created_at: string
          id: string
          message: string | null
          open_game_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          atleta_id: string
          created_at?: string
          id?: string
          message?: string | null
          open_game_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          atleta_id?: string
          created_at?: string
          id?: string
          message?: string | null
          open_game_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "open_game_requests_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_game_requests_open_game_id_fkey"
            columns: ["open_game_id"]
            isOneToOne: false
            referencedRelation: "open_games"
            referencedColumns: ["id"]
          },
        ]
      }
      open_games: {
        Row: {
          arena_id: string
          booking_id: string | null
          created_at: string
          current_players: number
          date: string
          end_time: string
          expires_at: string | null
          id: string
          level_max_id: string | null
          level_min_id: string | null
          needed_players: number
          notes: string | null
          owner_atleta_id: string
          sport_id: string
          start_time: string
          status: string
          updated_at: string
          visibility: string
        }
        Insert: {
          arena_id: string
          booking_id?: string | null
          created_at?: string
          current_players?: number
          date: string
          end_time: string
          expires_at?: string | null
          id?: string
          level_max_id?: string | null
          level_min_id?: string | null
          needed_players?: number
          notes?: string | null
          owner_atleta_id: string
          sport_id: string
          start_time: string
          status?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          arena_id?: string
          booking_id?: string | null
          created_at?: string
          current_players?: number
          date?: string
          end_time?: string
          expires_at?: string | null
          id?: string
          level_max_id?: string | null
          level_min_id?: string | null
          needed_players?: number
          notes?: string | null
          owner_atleta_id?: string
          sport_id?: string
          start_time?: string
          status?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "open_games_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_games_booking_arena_consistency_fkey"
            columns: ["booking_id", "arena_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id", "arena_id"]
          },
          {
            foreignKeyName: "open_games_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_games_level_max_id_fkey"
            columns: ["level_max_id"]
            isOneToOne: false
            referencedRelation: "nivel_habilidade_esporte"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_games_level_min_id_fkey"
            columns: ["level_min_id"]
            isOneToOne: false
            referencedRelation: "nivel_habilidade_esporte"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_games_owner_arena_membership_fkey"
            columns: ["arena_id", "owner_atleta_id"]
            isOneToOne: false
            referencedRelation: "arenas_atleta"
            referencedColumns: ["id_arena", "id_atleta"]
          },
          {
            foreignKeyName: "open_games_owner_atleta_id_fkey"
            columns: ["owner_atleta_id"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_games_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_checkout_attempts: {
        Row: {
          arena_id: string
          checkout_id: string
          created_at: string
          created_by_user_id: string | null
          gateway_customer_id: string | null
          id: string
          metadata: Json | null
          paid_at: string | null
          plan_id: string | null
          plan_key: string
          provider: string
          replaces_gateway_subscription_id: string | null
          result_gateway_subscription_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          arena_id: string
          checkout_id: string
          created_at?: string
          created_by_user_id?: string | null
          gateway_customer_id?: string | null
          id?: string
          metadata?: Json | null
          paid_at?: string | null
          plan_id?: string | null
          plan_key: string
          provider: string
          replaces_gateway_subscription_id?: string | null
          result_gateway_subscription_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          arena_id?: string
          checkout_id?: string
          created_at?: string
          created_by_user_id?: string | null
          gateway_customer_id?: string | null
          id?: string
          metadata?: Json | null
          paid_at?: string | null
          plan_id?: string | null
          plan_key?: string
          provider?: string
          replaces_gateway_subscription_id?: string | null
          result_gateway_subscription_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_checkout_attempts_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_checkout_attempts_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_checkout_attempts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          arena_id: string | null
          attempts: number
          created_at: string
          error_message: string | null
          event_type: string
          gateway_checkout_id: string | null
          gateway_subscription_id: string | null
          id: string
          payload: Json | null
          processed_at: string | null
          processing_started_at: string | null
          provider: string
          provider_event_id: string
          received_at: string
          status: string
          updated_at: string
        }
        Insert: {
          arena_id?: string | null
          attempts?: number
          created_at?: string
          error_message?: string | null
          event_type: string
          gateway_checkout_id?: string | null
          gateway_subscription_id?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string | null
          processing_started_at?: string | null
          provider: string
          provider_event_id: string
          received_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          arena_id?: string | null
          attempts?: number
          created_at?: string
          error_message?: string | null
          event_type?: string
          gateway_checkout_id?: string | null
          gateway_subscription_id?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string | null
          processing_started_at?: string | null
          provider?: string
          provider_event_id?: string
          received_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_webhook_events_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_web_arena_signups: {
        Row: {
          address_data: Json
          arena_document: string | null
          arena_name: string
          completed_at: string | null
          confirmed_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          phone: string | null
          status: string
          user_id: string
        }
        Insert: {
          address_data?: Json
          arena_document?: string | null
          arena_name: string
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          phone?: string | null
          status?: string
          user_id: string
        }
        Update: {
          address_data?: Json
          arena_document?: string | null
          arena_name?: string
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          phone?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_web_arena_signups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      planos_mensalista: {
        Row: {
          arena_id: string
          athlete_id: string
          athlete_name: string
          court_id: string
          created_at: string | null
          creation_fingerprint: string | null
          data_encerramento_efetiva: string | null
          data_encerramento_prevista: string | null
          data_inicio: string
          dia_semana: number
          dia_vencimento: number | null
          encerramento_observacao: string | null
          horario_fim: string
          horario_inicio: string
          id: string
          sessoes_por_mes: number
          sport_id: string | null
          status: string
          valor_mensal: number
        }
        Insert: {
          arena_id: string
          athlete_id: string
          athlete_name: string
          court_id: string
          created_at?: string | null
          creation_fingerprint?: string | null
          data_encerramento_efetiva?: string | null
          data_encerramento_prevista?: string | null
          data_inicio: string
          dia_semana: number
          dia_vencimento?: number | null
          encerramento_observacao?: string | null
          horario_fim: string
          horario_inicio: string
          id?: string
          sessoes_por_mes?: number
          sport_id?: string | null
          status?: string
          valor_mensal: number
        }
        Update: {
          arena_id?: string
          athlete_id?: string
          athlete_name?: string
          court_id?: string
          created_at?: string | null
          creation_fingerprint?: string | null
          data_encerramento_efetiva?: string | null
          data_encerramento_prevista?: string | null
          data_inicio?: string
          dia_semana?: number
          dia_vencimento?: number | null
          encerramento_observacao?: string | null
          horario_fim?: string
          horario_inicio?: string
          id?: string
          sessoes_por_mes?: number
          sport_id?: string | null
          status?: string
          valor_mensal?: number
        }
        Relationships: [
          {
            foreignKeyName: "planos_mensalista_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planos_mensalista_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planos_mensalista_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planos_mensalista_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          active: boolean
          arena_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          arena_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          arena_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_adjustment_batches: {
        Row: {
          adjusted_count: number | null
          arena_id: string
          batch_id: string
          category_id: string
          completed_at: string | null
          created_at: string
          created_by: string
          request_fingerprint: string
          request_payload: Json
        }
        Insert: {
          adjusted_count?: number | null
          arena_id: string
          batch_id: string
          category_id: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          request_fingerprint: string
          request_payload: Json
        }
        Update: {
          adjusted_count?: number | null
          arena_id?: string
          batch_id?: string
          category_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          request_fingerprint?: string
          request_payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "product_price_adjustment_batches_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_adjustment_batches_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_adjustment_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_history: {
        Row: {
          adjustment_percent: number | null
          arena_id: string
          batch_id: string | null
          change_type: string
          changed_by: string | null
          created_at: string
          id: string
          new_price: number
          old_price: number
          product_id: string
          reason: string | null
        }
        Insert: {
          adjustment_percent?: number | null
          arena_id: string
          batch_id?: string | null
          change_type?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_price: number
          old_price: number
          product_id: string
          reason?: string | null
        }
        Update: {
          adjustment_percent?: number | null
          arena_id?: string
          batch_id?: string | null
          change_type?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_price?: number
          old_price?: number
          product_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_price_history_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_history_product_arena_consistency_fkey"
            columns: ["product_id", "arena_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "arena_id"]
          },
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_stock_entries: {
        Row: {
          arena_id: string
          created_at: string
          description: string | null
          entry_date: string
          id: string
          invoice_number: string | null
          product_id: string
          quantity: number
          registered_by: string
          supplier: string
        }
        Insert: {
          arena_id: string
          created_at?: string
          description?: string | null
          entry_date: string
          id?: string
          invoice_number?: string | null
          product_id: string
          quantity: number
          registered_by: string
          supplier: string
        }
        Update: {
          arena_id?: string
          created_at?: string
          description?: string | null
          entry_date?: string
          id?: string
          invoice_number?: string | null
          product_id?: string
          quantity?: number
          registered_by?: string
          supplier?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_stock_entries_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stock_entries_product_arena_consistency_fkey"
            columns: ["product_id", "arena_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "arena_id"]
          },
          {
            foreignKeyName: "product_stock_entries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stock_entries_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      product_stock_movements: {
        Row: {
          arena_id: string
          balance_after: number
          created_at: string
          id: string
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          registered_by: string
          type: string
        }
        Insert: {
          arena_id: string
          balance_after: number
          created_at?: string
          id?: string
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          registered_by: string
          type: string
        }
        Update: {
          arena_id?: string
          balance_after?: number
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          registered_by?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_stock_movements_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stock_movements_product_arena_consistency_fkey"
            columns: ["product_id", "arena_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "arena_id"]
          },
          {
            foreignKeyName: "product_stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stock_movements_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          arena_id: string
          catalog_kind: string
          category_id: string | null
          created_at: string
          created_by: string | null
          id: string
          item_type: string
          name: string
          price: number
          station_id: string | null
          station_type_id: string | null
          status: string | null
          stock_quantity: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          arena_id: string
          catalog_kind?: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          item_type: string
          name: string
          price: number
          station_id?: string | null
          station_type_id?: string | null
          status?: string | null
          stock_quantity?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          arena_id?: string
          catalog_kind?: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          item_type?: string
          name?: string
          price?: number
          station_id?: string | null
          station_type_id?: string | null
          status?: string | null
          stock_quantity?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_station_arena_consistency_fkey"
            columns: ["station_id", "arena_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id", "arena_id"]
          },
          {
            foreignKeyName: "products_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_station_type_id_fkey"
            columns: ["station_type_id"]
            isOneToOne: false
            referencedRelation: "station_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      programa_fidelidade_extrato: {
        Row: {
          created_at: string
          created_by: string | null
          data_registro: string
          data_vencimento: string | null
          descricao: string | null
          id: string
          id_arena: string
          id_atleta: string
          operation_id: string | null
          tipo: string
          validity_code: string | null
          valor: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_registro?: string
          data_vencimento?: string | null
          descricao?: string | null
          id?: string
          id_arena: string
          id_atleta: string
          operation_id?: string | null
          tipo: string
          validity_code?: string | null
          valor: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_registro?: string
          data_vencimento?: string | null
          descricao?: string | null
          id?: string
          id_arena?: string
          id_atleta?: string
          operation_id?: string | null
          tipo?: string
          validity_code?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "programa_fidelidade_extrato_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programa_fidelidade_extrato_id_arena_fkey"
            columns: ["id_arena"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programa_fidelidade_extrato_id_atleta_fkey"
            columns: ["id_atleta"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
        ]
      }
      rotativo_courts: {
        Row: {
          court_id: string
          id: string
          rotativo_id: string
        }
        Insert: {
          court_id: string
          id?: string
          rotativo_id: string
        }
        Update: {
          court_id?: string
          id?: string
          rotativo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rotativo_courts_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotativo_courts_rotativo_id_fkey"
            columns: ["rotativo_id"]
            isOneToOne: false
            referencedRelation: "rotativos"
            referencedColumns: ["id"]
          },
        ]
      }
      rotativo_credito_lotes: {
        Row: {
          arena_id: string
          atleta_id: string
          created_at: string
          created_by: string | null
          data_vencimento: string
          id: string
          quantidade_inicial: number
          quantidade_restante: number
        }
        Insert: {
          arena_id: string
          atleta_id: string
          created_at?: string
          created_by?: string | null
          data_vencimento: string
          id?: string
          quantidade_inicial: number
          quantidade_restante: number
        }
        Update: {
          arena_id?: string
          atleta_id?: string
          created_at?: string
          created_by?: string | null
          data_vencimento?: string
          id?: string
          quantidade_inicial?: number
          quantidade_restante?: number
        }
        Relationships: [
          {
            foreignKeyName: "rotativo_credito_lotes_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotativo_credito_lotes_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotativo_credito_lotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rotativo_credito_movimentos: {
        Row: {
          arena_id: string
          atleta_id: string
          created_at: string
          created_by: string | null
          id: string
          inscricao_id: string | null
          lote_id: string | null
          modo_pagamento_id: string | null
          quantidade: number
          tipo: string
          valor_pago: number | null
        }
        Insert: {
          arena_id: string
          atleta_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          inscricao_id?: string | null
          lote_id?: string | null
          modo_pagamento_id?: string | null
          quantidade: number
          tipo: string
          valor_pago?: number | null
        }
        Update: {
          arena_id?: string
          atleta_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          inscricao_id?: string | null
          lote_id?: string | null
          modo_pagamento_id?: string | null
          quantidade?: number
          tipo?: string
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rotativo_credito_movimentos_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotativo_credito_movimentos_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotativo_credito_movimentos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotativo_credito_movimentos_inscricao_id_fkey"
            columns: ["inscricao_id"]
            isOneToOne: false
            referencedRelation: "rotativo_inscricoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotativo_credito_movimentos_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "rotativo_credito_lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotativo_credito_movimentos_modo_pagamento_id_fkey"
            columns: ["modo_pagamento_id"]
            isOneToOne: false
            referencedRelation: "modo_pagamento"
            referencedColumns: ["id"]
          },
        ]
      }
      rotativo_inscricoes: {
        Row: {
          data_inscricao: string
          id: string
          id_atleta: string
          id_rotativo: string
          modo_pagamento_id: string | null
          observacao: string | null
          status_pagamento: string | null
          tipo_pagamento: string | null
          valor_pago: number
        }
        Insert: {
          data_inscricao?: string
          id?: string
          id_atleta: string
          id_rotativo: string
          modo_pagamento_id?: string | null
          observacao?: string | null
          status_pagamento?: string | null
          tipo_pagamento?: string | null
          valor_pago?: number
        }
        Update: {
          data_inscricao?: string
          id?: string
          id_atleta?: string
          id_rotativo?: string
          modo_pagamento_id?: string | null
          observacao?: string | null
          status_pagamento?: string | null
          tipo_pagamento?: string | null
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "rotativo_inscricoes_id_atleta_fkey"
            columns: ["id_atleta"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotativo_inscricoes_id_rotativo_fkey"
            columns: ["id_rotativo"]
            isOneToOne: false
            referencedRelation: "rotativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotativo_inscricoes_modo_pagamento_id_fkey"
            columns: ["modo_pagamento_id"]
            isOneToOne: false
            referencedRelation: "modo_pagamento"
            referencedColumns: ["id"]
          },
        ]
      }
      rotativo_pacotes: {
        Row: {
          arena_id: string
          created_at: string
          id: string
          ordem: number
          quantidade: number
          updated_at: string
          valor_reais: number
        }
        Insert: {
          arena_id: string
          created_at?: string
          id?: string
          ordem?: number
          quantidade: number
          updated_at?: string
          valor_reais: number
        }
        Update: {
          arena_id?: string
          created_at?: string
          id?: string
          ordem?: number
          quantidade?: number
          updated_at?: string
          valor_reais?: number
        }
        Relationships: [
          {
            foreignKeyName: "rotativo_pacotes_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
        ]
      }
      rotativos: {
        Row: {
          created_at: string
          data: string
          hora_fim: string
          hora_inicio: string
          id: string
          id_arena: string
          id_esporte: string
          limitado: boolean
          limite_participantes: number | null
          status: string
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          data: string
          hora_fim: string
          hora_inicio: string
          id?: string
          id_arena: string
          id_esporte: string
          limitado?: boolean
          limite_participantes?: number | null
          status?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          created_at?: string
          data?: string
          hora_fim?: string
          hora_inicio?: string
          id?: string
          id_arena?: string
          id_esporte?: string
          limitado?: boolean
          limite_participantes?: number | null
          status?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "rotativos_id_arena_fkey"
            columns: ["id_arena"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotativos_id_esporte_fkey"
            columns: ["id_esporte"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      sports: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      station_customers: {
        Row: {
          arena_id: string
          cpf: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          arena_id: string
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          arena_id?: string
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "station_customers_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
        ]
      }
      station_order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          quantity?: number
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "station_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "station_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "station_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      station_order_status_history: {
        Row: {
          arena_id: string
          changed_by: string
          created_at: string
          id: string
          new_status: string
          order_id: string
          previous_status: string
        }
        Insert: {
          arena_id: string
          changed_by: string
          created_at?: string
          id?: string
          new_status: string
          order_id: string
          previous_status: string
        }
        Update: {
          arena_id?: string
          changed_by?: string
          created_at?: string
          id?: string
          new_status?: string
          order_id?: string
          previous_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "station_order_status_history_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "station_order_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "station_order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "station_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      station_orders: {
        Row: {
          arena_id: string
          atleta_id: string | null
          closed_at: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          id: string
          order_number: number
          pending_marked_at: string | null
          station_id: string
          status: string | null
          total_value: number
          updated_at: string
        }
        Insert: {
          arena_id: string
          atleta_id?: string | null
          closed_at?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          order_number?: number
          pending_marked_at?: string | null
          station_id: string
          status?: string | null
          total_value?: number
          updated_at?: string
        }
        Update: {
          arena_id?: string
          atleta_id?: string | null
          closed_at?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          order_number?: number
          pending_marked_at?: string | null
          station_id?: string
          status?: string | null
          total_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "station_orders_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "station_orders_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "station_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "station_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "station_orders_station_arena_consistency_fkey"
            columns: ["station_id", "arena_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id", "arena_id"]
          },
          {
            foreignKeyName: "station_orders_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      station_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          idempotency_key: string | null
          observation: string | null
          order_id: string
          paid_by_name: string | null
          payment_method: string
          registered_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          idempotency_key?: string | null
          observation?: string | null
          order_id: string
          paid_by_name?: string | null
          payment_method: string
          registered_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          idempotency_key?: string | null
          observation?: string | null
          order_id?: string
          paid_by_name?: string | null
          payment_method?: string
          registered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "station_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "station_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "station_payments_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      station_types: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      stations: {
        Row: {
          arena_id: string
          created_at: string
          id: string
          name: string
          station_type_id: string | null
          status: string | null
        }
        Insert: {
          arena_id: string
          created_at?: string
          id?: string
          name: string
          station_type_id?: string | null
          status?: string | null
        }
        Update: {
          arena_id?: string
          created_at?: string
          id?: string
          name?: string
          station_type_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stations_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stations_station_type_id_fkey"
            columns: ["station_type_id"]
            isOneToOne: false
            referencedRelation: "station_types"
            referencedColumns: ["id"]
          },
        ]
      }
      store_subscription_notification_events: {
        Row: {
          atleta_id: string | null
          error_code: string | null
          event_type: string | null
          id: string
          processed_at: string | null
          provider: string
          provider_event_id: string
          received_at: string
          status: string
          updated_at: string
        }
        Insert: {
          atleta_id?: string | null
          error_code?: string | null
          event_type?: string | null
          id?: string
          processed_at?: string | null
          provider: string
          provider_event_id: string
          received_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          atleta_id?: string | null
          error_code?: string | null
          event_type?: string | null
          id?: string
          processed_at?: string | null
          provider?: string
          provider_event_id?: string
          received_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_subscription_notification_events_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          features: Json | null
          gateway_price_id: string
          id: string
          is_active: boolean
          is_internal: boolean
          key: string
          label: string
          max_spaces: number
          price_cents: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          features?: Json | null
          gateway_price_id?: string
          id?: string
          is_active?: boolean
          is_internal?: boolean
          key: string
          label: string
          max_spaces: number
          price_cents: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          features?: Json | null
          gateway_price_id?: string
          id?: string
          is_active?: boolean
          is_internal?: boolean
          key?: string
          label?: string
          max_spaces?: number
          price_cents?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      time_financeiro_itens_custo: {
        Row: {
          criado_em: string
          criado_por: string | null
          descricao: string
          id: string
          id_time: string
          mes_referencia: string
          valor: number
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          descricao: string
          id?: string
          id_time: string
          mes_referencia: string
          valor: number
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          descricao?: string
          id?: string
          id_time?: string
          mes_referencia?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "time_financeiro_itens_custo_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_financeiro_itens_custo_id_time_fkey"
            columns: ["id_time"]
            isOneToOne: false
            referencedRelation: "times"
            referencedColumns: ["id"]
          },
        ]
      }
      time_financeiro_lancamentos: {
        Row: {
          criado_por: string | null
          data_lancamento: string
          descricao: string | null
          id: string
          id_atleta: string | null
          id_time: string
          mes_referencia: string
          tipo: string
          valor: number
        }
        Insert: {
          criado_por?: string | null
          data_lancamento?: string
          descricao?: string | null
          id?: string
          id_atleta?: string | null
          id_time: string
          mes_referencia: string
          tipo: string
          valor: number
        }
        Update: {
          criado_por?: string | null
          data_lancamento?: string
          descricao?: string | null
          id?: string
          id_atleta?: string | null
          id_time?: string
          mes_referencia?: string
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "time_financeiro_lancamentos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_financeiro_lancamentos_id_atleta_fkey"
            columns: ["id_atleta"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_financeiro_lancamentos_id_time_fkey"
            columns: ["id_time"]
            isOneToOne: false
            referencedRelation: "times"
            referencedColumns: ["id"]
          },
        ]
      }
      time_financeiro_mensalista_historico: {
        Row: {
          criado_por: string | null
          data_evento: string
          id: string
          id_atleta: string
          id_time: string
          mensalista: boolean
        }
        Insert: {
          criado_por?: string | null
          data_evento?: string
          id?: string
          id_atleta: string
          id_time: string
          mensalista: boolean
        }
        Update: {
          criado_por?: string | null
          data_evento?: string
          id?: string
          id_atleta?: string
          id_time?: string
          mensalista?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "time_financeiro_mensalista_historico_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_financeiro_mensalista_historico_id_atleta_fkey"
            columns: ["id_atleta"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_financeiro_mensalista_historico_id_time_fkey"
            columns: ["id_time"]
            isOneToOne: false
            referencedRelation: "times"
            referencedColumns: ["id"]
          },
        ]
      }
      time_financeiro_mensalista_mes: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          id: string
          id_atleta: string
          id_time: string
          mes_referencia: string
          quite: boolean
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          id?: string
          id_atleta: string
          id_time: string
          mes_referencia: string
          quite?: boolean
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          id?: string
          id_atleta?: string
          id_time?: string
          mes_referencia?: string
          quite?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "time_financeiro_mensalista_mes_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_financeiro_mensalista_mes_id_atleta_fkey"
            columns: ["id_atleta"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_financeiro_mensalista_mes_id_time_fkey"
            columns: ["id_time"]
            isOneToOne: false
            referencedRelation: "times"
            referencedColumns: ["id"]
          },
        ]
      }
      time_financeiro_mensalistas: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          id: string
          id_atleta: string
          id_time: string
          mensalista: boolean
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          id?: string
          id_atleta: string
          id_time: string
          mensalista?: boolean
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          id?: string
          id_atleta?: string
          id_time?: string
          mensalista?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "time_financeiro_mensalistas_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_financeiro_mensalistas_id_atleta_fkey"
            columns: ["id_atleta"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_financeiro_mensalistas_id_time_fkey"
            columns: ["id_time"]
            isOneToOne: false
            referencedRelation: "times"
            referencedColumns: ["id"]
          },
        ]
      }
      times: {
        Row: {
          aceita_pedido_entrada: boolean
          data_criacao: string
          descricao_privada: string | null
          descricao_publica: string | null
          foto_url: string | null
          id: string
          id_atleta_dono: string
          id_esporte: string | null
          id_municipio: number | null
          is_publico: boolean
          nome: string
          status: string
        }
        Insert: {
          aceita_pedido_entrada?: boolean
          data_criacao?: string
          descricao_privada?: string | null
          descricao_publica?: string | null
          foto_url?: string | null
          id?: string
          id_atleta_dono: string
          id_esporte?: string | null
          id_municipio?: number | null
          is_publico?: boolean
          nome: string
          status?: string
        }
        Update: {
          aceita_pedido_entrada?: boolean
          data_criacao?: string
          descricao_privada?: string | null
          descricao_publica?: string | null
          foto_url?: string | null
          id?: string
          id_atleta_dono?: string
          id_esporte?: string | null
          id_municipio?: number | null
          is_publico?: boolean
          nome?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "times_id_atleta_dono_fkey"
            columns: ["id_atleta_dono"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "times_id_esporte_fkey"
            columns: ["id_esporte"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "times_id_municipio_fkey"
            columns: ["id_municipio"]
            isOneToOne: false
            referencedRelation: "municipios"
            referencedColumns: ["codigo_ibge"]
          },
        ]
      }
      times_atletas: {
        Row: {
          convidado_por: string | null
          data_aceite: string | null
          data_convite: string
          funcao: string
          id: string
          id_atleta: string
          id_time: string
          status: string
        }
        Insert: {
          convidado_por?: string | null
          data_aceite?: string | null
          data_convite?: string
          funcao?: string
          id?: string
          id_atleta: string
          id_time: string
          status?: string
        }
        Update: {
          convidado_por?: string | null
          data_aceite?: string | null
          data_convite?: string
          funcao?: string
          id?: string
          id_atleta?: string
          id_time?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "times_atletas_convidado_por_fkey"
            columns: ["convidado_por"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "times_atletas_id_atleta_fkey"
            columns: ["id_atleta"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "times_atletas_id_time_fkey"
            columns: ["id_time"]
            isOneToOne: false
            referencedRelation: "times"
            referencedColumns: ["id"]
          },
        ]
      }
      times_resenha_mensagens: {
        Row: {
          created_at: string | null
          id: string
          id_atleta: string
          id_time: string
          mensagem: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          id_atleta: string
          id_time: string
          mensagem: string
        }
        Update: {
          created_at?: string | null
          id?: string
          id_atleta?: string
          id_time?: string
          mensagem?: string
        }
        Relationships: [
          {
            foreignKeyName: "times_resenha_mensagens_id_atleta_fkey"
            columns: ["id_atleta"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "times_resenha_mensagens_id_time_fkey"
            columns: ["id_time"]
            isOneToOne: false
            referencedRelation: "times"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          arena_id: string
          atleta_id: string | null
          category: string
          created_at: string
          description: string | null
          discount: number
          id: string
          launch_date: string
          modo_pagamento_id: string | null
          quantity: number
          registered_by: string | null
          registration_date: string
          source_id: string | null
          source_type: string | null
          total_value: number
          type: string
          unit_value: number
        }
        Insert: {
          arena_id: string
          atleta_id?: string | null
          category: string
          created_at?: string
          description?: string | null
          discount?: number
          id?: string
          launch_date?: string
          modo_pagamento_id?: string | null
          quantity?: number
          registered_by?: string | null
          registration_date?: string
          source_id?: string | null
          source_type?: string | null
          total_value?: number
          type: string
          unit_value?: number
        }
        Update: {
          arena_id?: string
          atleta_id?: string | null
          category?: string
          created_at?: string
          description?: string | null
          discount?: number
          id?: string
          launch_date?: string
          modo_pagamento_id?: string | null
          quantity?: number
          registered_by?: string | null
          registration_date?: string
          source_id?: string | null
          source_type?: string | null
          total_value?: number
          type?: string
          unit_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "transactions_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_modo_pagamento_id_fkey"
            columns: ["modo_pagamento_id"]
            isOneToOne: false
            referencedRelation: "modo_pagamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_user_id: string | null
          cpf: string | null
          created_at: string
          email: string
          id: string
          name: string | null
          onboarding_completed_at: string | null
          onboarding_version: number
          role: string | null
        }
        Insert: {
          auth_user_id?: string | null
          cpf?: string | null
          created_at?: string
          email: string
          id?: string
          name?: string | null
          onboarding_completed_at?: string | null
          onboarding_version?: number
          role?: string | null
        }
        Update: {
          auth_user_id?: string | null
          cpf?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          onboarding_completed_at?: string | null
          onboarding_version?: number
          role?: string | null
        }
        Relationships: []
      }
      whatsapp_channels: {
        Row: {
          access_token_encrypted: string
          arena_id: string
          connected_at: string | null
          created_at: string
          display_phone_number: string | null
          id: string
          last_inbound_at: string | null
          phone_number_id: string
          provider: string
          status: string
          token_expires_at: string | null
          updated_at: string
          verified_name: string | null
          waba_id: string
        }
        Insert: {
          access_token_encrypted: string
          arena_id: string
          connected_at?: string | null
          created_at?: string
          display_phone_number?: string | null
          id?: string
          last_inbound_at?: string | null
          phone_number_id: string
          provider?: string
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          verified_name?: string | null
          waba_id: string
        }
        Update: {
          access_token_encrypted?: string
          arena_id?: string
          connected_at?: string | null
          created_at?: string
          display_phone_number?: string | null
          id?: string
          last_inbound_at?: string | null
          phone_number_id?: string
          provider?: string
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          verified_name?: string | null
          waba_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_channels_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: true
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          arena_id: string
          channel_id: string | null
          contact_name: string | null
          contact_wa_id: string
          created_at: string
          id: string
          last_message_at: string | null
          message_count: number
          status: string
          updated_at: string
        }
        Insert: {
          arena_id: string
          channel_id?: string | null
          contact_name?: string | null
          contact_wa_id: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          message_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          arena_id?: string
          channel_id?: string | null
          contact_name?: string | null
          contact_wa_id?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          message_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          arena_id: string
          audio_seconds: number | null
          completion_tokens: number | null
          content: string | null
          content_type: string
          conversation_id: string
          created_at: string
          direction: string
          error_message: string | null
          id: string
          llm_model: string | null
          media_id: string | null
          prompt_tokens: number | null
          status: string
          tool_calls: Json | null
          transcribed_from_audio: boolean
          transcription_model: string | null
          wa_message_id: string | null
        }
        Insert: {
          arena_id: string
          audio_seconds?: number | null
          completion_tokens?: number | null
          content?: string | null
          content_type?: string
          conversation_id: string
          created_at?: string
          direction: string
          error_message?: string | null
          id?: string
          llm_model?: string | null
          media_id?: string | null
          prompt_tokens?: number | null
          status?: string
          tool_calls?: Json | null
          transcribed_from_audio?: boolean
          transcription_model?: string | null
          wa_message_id?: string | null
        }
        Update: {
          arena_id?: string
          audio_seconds?: number | null
          completion_tokens?: number | null
          content?: string | null
          content_type?: string
          conversation_id?: string
          created_at?: string
          direction?: string
          error_message?: string | null
          id?: string
          llm_model?: string | null
          media_id?: string | null
          prompt_tokens?: number | null
          status?: string
          tool_calls?: Json | null
          transcribed_from_audio?: boolean
          transcription_model?: string | null
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_webhook_events: {
        Row: {
          arena_id: string | null
          attempts: number
          created_at: string
          error_message: string | null
          event_type: string | null
          id: string
          payload: Json | null
          phone_number_id: string | null
          processed_at: string | null
          processing_started_at: string | null
          provider: string
          provider_event_id: string | null
          status: string
          updated_at: string
          wa_message_id: string | null
        }
        Insert: {
          arena_id?: string | null
          attempts?: number
          created_at?: string
          error_message?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          phone_number_id?: string | null
          processed_at?: string | null
          processing_started_at?: string | null
          provider?: string
          provider_event_id?: string | null
          status?: string
          updated_at?: string
          wa_message_id?: string | null
        }
        Update: {
          arena_id?: string | null
          attempts?: number
          created_at?: string
          error_message?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          phone_number_id?: string | null
          processed_at?: string | null
          processing_started_at?: string | null
          provider?: string
          provider_event_id?: string | null
          status?: string
          updated_at?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_webhook_events_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      athlete_loyalty_balance: {
        Row: {
          balance: number | null
          id_arena: string | null
          id_atleta: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programa_fidelidade_extrato_id_arena_fkey"
            columns: ["id_arena"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programa_fidelidade_extrato_id_atleta_fkey"
            columns: ["id_atleta"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
        ]
      }
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      mensalista_credito_saldo: {
        Row: {
          arena_id: string | null
          atleta_id: string | null
          saldo: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mensalista_creditos_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensalista_creditos_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
        ]
      }
      rotativo_credito_saldo: {
        Row: {
          arena_id: string | null
          atleta_id: string | null
          saldo: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rotativo_credito_lotes_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotativo_credito_lotes_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleta"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _insert_monthly_plan_month_bookings: {
        Args: {
          p_additional_athlete_ids?: string[]
          p_month: string
          p_plan_id: string
          p_session_price: number
          p_skip_past?: boolean
          p_status: string
        }
        Returns: number
      }
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      add_station_order_payment: {
        Args: {
          p_amount: number
          p_arena_id: string
          p_idempotency_key?: string
          p_observation: string
          p_order_id: string
          p_paid_by_name: string
          p_payment_method: string
          p_registered_by: string
        }
        Returns: {
          amount: number
          created_at: string
          id: string
          idempotency_key: string | null
          observation: string | null
          order_id: string
          paid_by_name: string | null
          payment_method: string
          registered_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "station_payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      app_limit_day_start: { Args: { p_reference?: string }; Returns: string }
      app_limit_month_start: { Args: { p_reference?: string }; Returns: string }
      append_station_order_items: {
        Args: {
          p_arena_id: string
          p_items: Json
          p_order_id: string
          p_registered_by: string
        }
        Returns: {
          created_at: string
          id: string
          order_id: string
          product_id: string
          quantity: number
          total_price: number
          unit_price: number
        }[]
        SetofOptions: {
          from: "*"
          to: "station_order_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      apply_public_arena_import_batch: {
        Args: {
          p_actor_user_id: string
          p_batch_id: string
          p_item_ids: string[]
          p_reason: string
        }
        Returns: Json
      }
      assert_athlete_connection_peer_acceptance_slot: {
        Args: { p_atleta_id: string }
        Returns: undefined
      }
      assert_athlete_connection_slot: {
        Args: { p_accepting?: boolean; p_atleta_id: string }
        Returns: undefined
      }
      assert_athlete_team_creation_slot: {
        Args: { p_atleta_id: string }
        Returns: undefined
      }
      assert_my_athlete_signup_identity_allowed: {
        Args: never
        Returns: string
      }
      assert_open_game_creation_slot: {
        Args: { p_atleta_id: string }
        Returns: undefined
      }
      assert_team_resenha_message_slot: {
        Args: { p_atleta_id: string; p_reference?: string; p_time_id: string }
        Returns: undefined
      }
      athlete_accepted_connection_count: {
        Args: { p_atleta_id: string }
        Returns: number
      }
      athlete_connection_usage_count: {
        Args: { p_atleta_id: string }
        Returns: number
      }
      begin_booking_payment_refund: {
        Args: {
          p_atleta_id: string
          p_booking_payment_id: string
          p_payload?: Json
        }
        Returns: Json
      }
      bulk_adjust_product_prices: {
        Args: {
          p_adjustment_type: string
          p_amount: number
          p_arena_id: string
          p_batch_id: string
          p_category_id: string
          p_changed_by: string
          p_include_inactive: boolean
          p_reason: string
          p_rounding: string
        }
        Returns: Json
      }
      can_access_arena: { Args: { p_arena_id: string }; Returns: boolean }
      can_access_arena_backoffice: {
        Args: { p_arena_id: string }
        Returns: boolean
      }
      can_access_booking: { Args: { p_booking_id: string }; Returns: boolean }
      can_access_booking_result: {
        Args: { p_booking_result_id: string }
        Returns: boolean
      }
      can_access_station_order: {
        Args: { p_order_id: string }
        Returns: boolean
      }
      can_manage_arena: { Args: { p_arena_id: string }; Returns: boolean }
      can_manage_team: { Args: { p_team_id: string }; Returns: boolean }
      can_view_court_sport: { Args: { p_court_id: string }; Returns: boolean }
      can_view_open_game: { Args: { p_open_game_id: string }; Returns: boolean }
      can_view_team: { Args: { p_team_id: string }; Returns: boolean }
      cancel_monthly_plan_atomic: {
        Args: { p_arena_id: string; p_plan_id: string }
        Returns: Json
      }
      cancel_my_booking: { Args: { p_booking_id: string }; Returns: string }
      cancel_open_game_request: {
        Args: { p_request_id: string }
        Returns: string
      }
      cancel_rotativo_inscricao: {
        Args: { p_atleta_id: string; p_rotativo_id: string }
        Returns: boolean
      }
      cancel_station_order: {
        Args: {
          p_arena_id: string
          p_order_id: string
          p_registered_by: string
        }
        Returns: {
          arena_id: string
          atleta_id: string | null
          closed_at: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          id: string
          order_number: number
          pending_marked_at: string | null
          station_id: string
          status: string | null
          total_value: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "station_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_arena_asaas_subaccount_provisioning: {
        Args: { p_arena_id: string; p_request_id: string }
        Returns: boolean
      }
      claim_athlete_billing_customer: {
        Args: { p_atleta_id: string; p_provider_account_id: string }
        Returns: Json
      }
      claim_booking_payment_attempt:
        | {
            Args: {
              p_amount_cents: number
              p_arena_id: string
              p_arena_split_basis_points: number
              p_atleta_id: string
              p_booking_id: string
              p_external_reference: string
              p_gateway_customer_id: string
              p_idempotency_key: string
              p_payment_id: string
              p_pix_expires_at: string
              p_platform_fee_basis_points: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_amount_cents: number
              p_arena_id: string
              p_arena_split_basis_points: number
              p_atleta_id: string
              p_booking_id: string
              p_external_reference: string
              p_gateway_customer_id: string
              p_idempotency_key: string
              p_merchant_model: string
              p_payment_id: string
              p_pix_expires_at: string
              p_platform_fee_basis_points: number
              p_provider_account_id: string
            }
            Returns: Json
          }
      claim_my_legacy_athlete_profile: { Args: never; Returns: string }
      claim_public_arena_as_customer: {
        Args: {
          p_actor_user_id: string
          p_arena_id: string
          p_keep_discoverable?: boolean
          p_owner_user_id: string
          p_reason: string
        }
        Returns: Json
      }
      claim_public_arena_import_jobs: {
        Args: { p_limit?: number }
        Returns: Json
      }
      claim_store_subscription_notification: {
        Args: {
          p_event_type?: string
          p_provider: string
          p_provider_event_id: string
        }
        Returns: Json
      }
      close_station_order: {
        Args: {
          p_arena_id: string
          p_order_id: string
          p_registered_by: string
        }
        Returns: {
          arena_id: string
          atleta_id: string | null
          closed_at: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          id: string
          order_number: number
          pending_marked_at: string | null
          station_id: string
          status: string | null
          total_value: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "station_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_athlete_billing_customer: {
        Args: {
          p_customer_id: string
          p_gateway_customer_id: string
          p_payload?: Json
        }
        Returns: Json
      }
      complete_booking_payment_creation: {
        Args: {
          p_booking_payment_id: string
          p_gateway_payment_id: string
          p_payload?: Json
          p_pix_expires_at?: string
          p_pix_payload?: string
          p_pix_qr_code_base64?: string
        }
        Returns: Json
      }
      complete_my_athlete_signup: {
        Args: {
          p_city_id: number
          p_cpf: string
          p_first_name: string
          p_last_name: string
          p_level_id: string
          p_sport_id: string
        }
        Returns: string
      }
      complete_my_athlete_signup_internal: {
        Args: {
          p_city_id: number
          p_cpf: string
          p_first_name: string
          p_last_name: string
          p_level_id: string
          p_sport_id: string
        }
        Returns: string
      }
      complete_public_arena_import_job: {
        Args: { p_batch_id?: string; p_job_id: string; p_outcome: string }
        Returns: Json
      }
      configure_mensalista_rateio_atomic: {
        Args: {
          p_arena_id: string
          p_mensalidade_id: string
          p_participantes: Json
          p_rateio: boolean
          p_registered_by: string
        }
        Returns: Json
      }
      confirm_backoffice_booking_payment: {
        Args: {
          p_amount?: number
          p_arena_id: string
          p_booking_id: string
          p_modo_pagamento_id?: string
          p_registered_by: string
        }
        Returns: {
          arena_id: string
          athlete_id: string | null
          athlete_name: string | null
          booking_type: string | null
          cobranca_por_participante: boolean
          court_id: string
          created_at: string
          end_time: string
          id: string
          payment_confirmed_at: string | null
          payment_expires_at: string | null
          plano_mensalista_id: string | null
          price: number | null
          recurrence_id: string | null
          rental_price: number
          sport_id: string | null
          start_time: string
          status: string | null
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_backoffice_participant_payment: {
        Args: {
          p_amount?: number
          p_arena_id: string
          p_booking_id: string
          p_modo_pagamento_id?: string
          p_participant_id: string
          p_registered_by: string
        }
        Returns: string
      }
      confirm_booking_payment: {
        Args: {
          p_booking_payment_id: string
          p_gateway_payment_id: string
          p_paid_at?: string
          p_payload?: Json
        }
        Returns: string
      }
      confirm_booking_result: {
        Args: {
          p_atleta_id: string
          p_booking_result_id: string
          p_confirmed: boolean
          p_note?: string
        }
        Returns: string
      }
      confirm_monthly_plan_month_atomic: {
        Args: {
          p_arena_id: string
          p_expected_booking_start: string
          p_plan_id: string
          p_registered_by: string
        }
        Returns: Json
      }
      consume_mobile_auth_rate_limit: {
        Args: {
          p_action: string
          p_key_hash: string
          p_limit?: number
          p_window_seconds?: number
        }
        Returns: {
          allowed: boolean
          remaining: number
          retry_after_seconds: number
        }[]
      }
      create_backoffice_booking: {
        Args: {
          p_arena_id: string
          p_athlete_id?: string
          p_athlete_name: string
          p_booking_type?: string
          p_cobranca_por_participante?: boolean
          p_court_id: string
          p_end_time: string
          p_modo_pagamento_id?: string
          p_plano_mensalista_id?: string
          p_price?: number
          p_recurrence_id?: string
          p_registered_by?: string
          p_sport_id?: string
          p_start_time: string
          p_status?: string
        }
        Returns: {
          arena_id: string
          athlete_id: string | null
          athlete_name: string | null
          booking_type: string | null
          cobranca_por_participante: boolean
          court_id: string
          created_at: string
          end_time: string
          id: string
          payment_confirmed_at: string | null
          payment_expires_at: string | null
          plano_mensalista_id: string | null
          price: number | null
          recurrence_id: string | null
          rental_price: number
          sport_id: string | null
          start_time: string
          status: string | null
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_backoffice_bookings: {
        Args: {
          p_bookings: Json
          p_modo_pagamento_id?: string
          p_registered_by?: string
        }
        Returns: {
          arena_id: string
          athlete_id: string | null
          athlete_name: string | null
          booking_type: string | null
          cobranca_por_participante: boolean
          court_id: string
          created_at: string
          end_time: string
          id: string
          payment_confirmed_at: string | null
          payment_expires_at: string | null
          plano_mensalista_id: string | null
          price: number | null
          recurrence_id: string | null
          rental_price: number
          sport_id: string | null
          start_time: string
          status: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      create_monthly_plan_atomic: {
        Args: {
          p_additional_athlete_ids: string[]
          p_arena_id: string
          p_athlete_id: string
          p_court_id: string
          p_dia_semana: number
          p_effective_date?: string
          p_horario_fim: string
          p_horario_inicio: string
          p_registered_by: string
          p_sessoes_por_mes: number
          p_sport_id: string
          p_valor_mensal: number
        }
        Returns: Json
      }
      create_open_game: {
        Args: {
          p_arena_id: string
          p_booking_id?: string
          p_date: string
          p_end_time: string
          p_level_max_id?: string
          p_level_min_id?: string
          p_needed_players: number
          p_notes?: string
          p_sport_id: string
          p_start_time: string
          p_visibility?: string
        }
        Returns: string
      }
      create_public_arena_import_campaign: {
        Args: {
          p_actor_user_id: string
          p_max_attempts: number
          p_max_results_per_municipality: number
          p_municipality_ids: number[]
          p_name: string
          p_operation_id: string
          p_reason: string
          p_sport_ids: string[]
          p_start_immediately: boolean
        }
        Returns: Json
      }
      create_public_arena_listing: {
        Args: {
          p_actor_user_id: string
          p_address: string
          p_cnpj?: string
          p_complement?: string
          p_description?: string
          p_email?: string
          p_external_id?: string
          p_id_municipio: number
          p_location_wkt?: string
          p_name: string
          p_neighborhood?: string
          p_number?: string
          p_phone?: string
          p_platform_notes?: string
          p_reason?: string
          p_source?: string
          p_sport_ids?: string[]
          p_zip_code?: string
        }
        Returns: string
      }
      create_station_order_with_items: {
        Args: {
          p_arena_id: string
          p_atleta_id: string
          p_customer_id: string
          p_customer_name: string
          p_items: Json
          p_registered_by: string
          p_station_id: string
        }
        Returns: {
          arena_id: string
          atleta_id: string | null
          closed_at: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          id: string
          order_number: number
          pending_marked_at: string | null
          station_id: string
          status: string | null
          total_value: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "station_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_team: {
        Args: {
          p_accepts_join_requests: boolean
          p_city_id: number
          p_is_public: boolean
          p_name: string
          p_private_description: string
          p_public_description: string
          p_sport_id: string
        }
        Returns: string
      }
      criar_reserva_com_participantes: {
        Args: {
          p_arena_id: string
          p_atleta_id: string
          p_atleta_nome: string
          p_court_id: string
          p_end_time: string
          p_id_time: string
          p_participantes: string[]
          p_price: number
          p_sport_id: string
          p_start_time: string
        }
        Returns: string
      }
      criar_reserva_com_participantes_confirmed_legacy: {
        Args: {
          p_arena_id: string
          p_atleta_id: string
          p_atleta_nome: string
          p_court_id: string
          p_end_time: string
          p_id_time: string
          p_participantes: string[]
          p_price: number
          p_sport_id: string
          p_start_time: string
        }
        Returns: string
      }
      current_app_atleta: {
        Args: never
        Returns: {
          id: string
          nome_perfil: string
        }[]
      }
      current_auth_athlete_app_plan: { Args: never; Returns: string }
      current_auth_athlete_id: { Args: never; Returns: string }
      current_auth_public_user_id: { Args: never; Returns: string }
      delete_arena_asaas_credential_recovery: {
        Args: { p_arena_id: string }
        Returns: undefined
      }
      delete_my_account: { Args: never; Returns: boolean }
      delete_my_athlete_account_internal: { Args: never; Returns: boolean }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      enroll_backoffice_rotativo_athlete: {
        Args: {
          p_arena_id: string
          p_athlete_id: string
          p_observation: string
          p_payment_method_id: string
          p_payment_type: string
          p_registered_by: string
          p_rotativo_id: string
        }
        Returns: Json
      }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      expire_backoffice_rotativo_credits: {
        Args: { p_arena_id: string }
        Returns: number
      }
      expire_stale_booking_payments: { Args: never; Returns: number }
      fail_booking_payment: {
        Args: {
          p_booking_payment_id: string
          p_payload?: Json
          p_status: string
        }
        Returns: string
      }
      fail_booking_payment_refund: {
        Args: {
          p_booking_payment_id: string
          p_payload?: Json
          p_release_claim?: boolean
        }
        Returns: Json
      }
      fail_public_arena_import_job: {
        Args: { p_error_code: string; p_job_id: string }
        Returns: Json
      }
      finalize_booking_cancellation: {
        Args: {
          p_atleta_id?: string
          p_booking_id: string
          p_booking_payment_id?: string
          p_payload?: Json
          p_payment_status?: string
        }
        Returns: string
      }
      financeiro_assert_admin: {
        Args: { p_atleta_id: string; p_time_id: string }
        Returns: undefined
      }
      financeiro_can_manage_time: {
        Args: { p_time_id: string }
        Returns: boolean
      }
      financeiro_criar_item_custo: {
        Args: {
          p_descricao: string
          p_mes_referencia: string
          p_time_id: string
          p_valor: number
        }
        Returns: string
      }
      financeiro_current_atleta_id: { Args: never; Returns: string }
      financeiro_excluir_item_custo: {
        Args: { p_item_id: string }
        Returns: undefined
      }
      financeiro_normalize_mes: { Args: { p_mes: string }; Returns: string }
      financeiro_registrar_lancamento: {
        Args: {
          p_atleta_id: string
          p_descricao: string
          p_mes_referencia: string
          p_time_id: string
          p_tipo: string
          p_valor: number
        }
        Returns: string
      }
      financeiro_set_mensalista_quite: {
        Args: {
          p_atleta_id: string
          p_mes_referencia: string
          p_quite: boolean
          p_time_id: string
        }
        Returns: undefined
      }
      financeiro_toggle_mensalista: {
        Args: { p_atleta_id: string; p_mensalista: boolean; p_time_id: string }
        Returns: undefined
      }
      finish_store_subscription_notification: {
        Args: {
          p_atleta_id?: string
          p_error_code?: string
          p_event_id: string
          p_status: string
        }
        Returns: undefined
      }
      generate_mensalista_mensalidades_atomic: {
        Args: {
          p_arena_id: string
          p_competencia: string
          p_registered_by: string
        }
        Returns: Json
      }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_arena_asaas_credential_recovery: {
        Args: { p_arena_id: string }
        Returns: Json
      }
      get_arena_asaas_runtime_credentials: {
        Args: { p_arena_id: string }
        Returns: Json
      }
      get_arena_booking_blocks: {
        Args: { p_arena_id: string; p_end_time: string; p_start_time: string }
        Returns: {
          court_id: string
          end_time: string
          start_time: string
        }[]
      }
      get_arena_finance_daily_totals: {
        Args: { p_arena_id: string; p_end_date: string; p_start_date: string }
        Returns: {
          bucket_date: string
          entradas: number
          saidas: number
        }[]
      }
      get_arena_finance_summary: {
        Args: { p_arena_id: string }
        Returns: {
          current_month_entradas: number
          current_month_saidas: number
          lifetime_entradas: number
          lifetime_saidas: number
          prev_month_entradas: number
          prev_month_saidas: number
        }[]
      }
      get_arena_presence: { Args: { p_arena_id: string }; Returns: number }
      get_current_athlete: {
        Args: never
        Returns: {
          athlete_id: string
          auth_user_id: string
          email: string
          name: string
          nome_perfil: string
          role: string
          user_id: string
        }[]
      }
      get_home_feed: { Args: { p_atleta_id?: string }; Returns: Json }
      get_operational_metric_snapshot: {
        Args: never
        Returns: {
          metric_key: string
          metric_value: number
          oldest_age_seconds: number
          sampled_at: string
        }[]
      }
      get_platform_access_level: {
        Args: { p_user_id: string }
        Returns: string
      }
      get_public_arena_import_batch: {
        Args: { p_actor_user_id: string; p_batch_id: string }
        Returns: Json
      }
      get_public_arena_import_campaign: {
        Args: { p_actor_user_id: string; p_campaign_id: string }
        Returns: Json
      }
      get_rotativo_availability: {
        Args: { p_rotativo_ids: string[] }
        Returns: {
          is_full: boolean
          registration_count: number
          remaining_spots: number
          rotativo_id: string
        }[]
      }
      get_self_service_arena_signup_status: {
        Args: { p_requester_user_id: string }
        Returns: Json
      }
      get_team_roster: {
        Args: { p_team_id: string }
        Returns: {
          athlete_id: string
          display_name: string
          photo_url: string
          team_role: string
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      invite_athlete_to_team: {
        Args: { p_athlete_id: string; p_team_id: string }
        Returns: string
      }
      is_arena_backoffice_member: {
        Args: { p_arena_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: never; Returns: boolean }
      is_platform_super_admin: { Args: never; Returns: boolean }
      is_public_active_arena: { Args: { p_arena_id: string }; Returns: boolean }
      is_valid_cpf: { Args: { p_value: string }; Returns: boolean }
      launch_mensalista_credit_atomic: {
        Args: {
          p_arena_id: string
          p_atleta_id: string
          p_descricao: string
          p_operation_id: string
          p_registered_by: string
          p_valor: number
        }
        Returns: Json
      }
      leave_team: { Args: { p_team_id: string }; Returns: string }
      list_arena_claim_requests: {
        Args: { p_actor_user_id: string; p_limit?: number; p_status?: string }
        Returns: {
          arena_id: string
          arena_name: string
          created_at: string
          id: string
          municipality_name: string
          request_kind: string
          requester_email: string
          requester_name: string
          requester_user_id: string
          review_reason: string
          reviewed_at: string
          status: string
          submitted_arena_name: string
        }[]
      }
      list_internal_employee_plan_assignments: {
        Args: { p_actor_user_id: string }
        Returns: {
          arena_id: string
          employee_user_id: string
          granted_at: string
          granted_by_user_id: string
          reason: string
          updated_at: string
        }[]
      }
      list_platform_arena_metadata: {
        Args: { p_actor_user_id: string }
        Returns: {
          arena_id: string
          platform_notes: string
          updated_at: string
        }[]
      }
      list_platform_principals: {
        Args: { p_actor_user_id: string }
        Returns: {
          access_level: string
          created_at: string
          email: string
          expires_at: string
          name: string
          status: string
          updated_at: string
          user_id: string
        }[]
      }
      list_platform_security_audit: {
        Args: { p_actor_user_id: string; p_limit?: number }
        Returns: {
          actor_user_id: string
          arena_id: string
          created_at: string
          event_type: string
          id: number
          metadata: Json
          reason: string
          target_user_id: string
        }[]
      }
      list_public_arena_import_batches: {
        Args: { p_actor_user_id: string; p_limit?: number }
        Returns: Json
      }
      list_public_arena_import_campaigns: {
        Args: { p_actor_user_id: string; p_limit?: number }
        Returns: Json
      }
      lock_athlete_app_limit: {
        Args: { p_atleta_id: string; p_scope: string }
        Returns: undefined
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      manage_internal_employee_plan: {
        Args: {
          p_actor_user_id: string
          p_arena_id: string
          p_employee_user_id: string
          p_enabled: boolean
          p_reason: string
        }
        Returns: string
      }
      manage_platform_arena_profile: {
        Args: {
          p_actor_user_id: string
          p_app_discoverable: boolean
          p_arena_id: string
          p_platform_kind: string
          p_platform_notes: string
          p_reason: string
        }
        Returns: undefined
      }
      manage_platform_principal: {
        Args: {
          p_access_level: string
          p_actor_user_id: string
          p_enabled: boolean
          p_expires_at?: string
          p_reason: string
          p_target_user_id: string
        }
        Returns: string
      }
      mark_athlete_billing_customer_retryable: {
        Args: { p_customer_id: string; p_payload?: Json }
        Returns: Json
      }
      mark_booking_payment_retryable: {
        Args: {
          p_booking_payment_id: string
          p_payload?: Json
          p_retry_after?: string
        }
        Returns: Json
      }
      persist_athlete_store_verification: {
        Args: {
          p_atleta_id: string
          p_expires_at: string
          p_linked_purchase_token: string
          p_original_transaction_id: string
          p_platform: string
          p_product_id: string
          p_purchase_token: string
          p_raw_response?: Json
          p_status: string
          p_transaction_id: string
        }
        Returns: Json
      }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      provision_arena_athlete_profile: {
        Args: {
          p_address: string
          p_address_number: string
          p_arena_id: string
          p_birth_date: string
          p_cep: string
          p_city_id: number
          p_cpf: string
          p_level_id: string
          p_name: string
          p_neighborhood: string
          p_phone: string
          p_sport_id: string
          p_user_id: string
        }
        Returns: string
      }
      purchase_backoffice_rotativo_credits: {
        Args: {
          p_arena_id: string
          p_athlete_id: string
          p_operation_id: string
          p_payment_method_id: string
          p_quantity: number
          p_registered_by: string
          p_validity_days: number
        }
        Returns: Json
      }
      quote_backoffice_rotativo_credits: {
        Args: { p_arena_id: string; p_quantity: number }
        Returns: number
      }
      reconcile_athlete_store_entitlement: {
        Args: { p_atleta_id: string; p_source?: string }
        Returns: Json
      }
      record_backoffice_loyalty_transaction: {
        Args: {
          p_arena_id: string
          p_athlete_id: string
          p_created_by: string
          p_description: string
          p_kind: string
          p_operation_id: string
          p_validity_code: string
          p_value: number
        }
        Returns: Json
      }
      record_booking_payment_split_state: {
        Args: {
          p_booking_payment_id: string
          p_payload?: Json
          p_refusal_reason?: string
          p_status: string
        }
        Returns: undefined
      }
      record_edge_function_failure: {
        Args: {
          p_correlation_id?: string
          p_error_code?: string
          p_function_name: string
        }
        Returns: undefined
      }
      register_mensalista_payment_atomic: {
        Args: {
          p_arena_id: string
          p_cobranca_id: string
          p_credito_aplicado: number
          p_data: string
          p_modo_pagamento_id: string
          p_observacao: string
          p_operation_id: string
          p_registered_by: string
          p_valor: number
        }
        Returns: Json
      }
      register_product_stock_entry: {
        Args: {
          p_arena_id: string
          p_description: string
          p_entry_date: string
          p_invoice_number: string
          p_operation_id: string
          p_product_id: string
          p_quantity: number
          p_registered_by: string
          p_supplier: string
        }
        Returns: {
          arena_id: string
          created_at: string
          description: string | null
          entry_date: string
          id: string
          invoice_number: string | null
          product_id: string
          quantity: number
          registered_by: string
          supplier: string
        }
        SetofOptions: {
          from: "*"
          to: "product_stock_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_product_stock_outflow: {
        Args: {
          p_arena_id: string
          p_product_id: string
          p_quantity: number
          p_reference_id: string
          p_reference_type: string
          p_registered_by: string
        }
        Returns: {
          arena_id: string
          balance_after: number
          created_at: string
          id: string
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          registered_by: string
          type: string
        }
        SetofOptions: {
          from: "*"
          to: "product_stock_movements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_rotativo_inscricao: {
        Args: {
          p_atleta_id: string
          p_modo_pagamento_id?: string
          p_observacao?: string
          p_rotativo_id: string
          p_tipo_pagamento?: string
        }
        Returns: string
      }
      release_arena_asaas_subaccount_provisioning: {
        Args: { p_arena_id: string; p_reason: string; p_request_id: string }
        Returns: boolean
      }
      remove_arena_user_membership_atomic: {
        Args: { p_arena_id: string; p_arena_user_id: string; p_user_id: string }
        Returns: boolean
      }
      remove_team_member: {
        Args: { p_member_athlete_id: string; p_team_id: string }
        Returns: string
      }
      replace_backoffice_rotativo_packages: {
        Args: { p_arena_id: string; p_packages: Json }
        Returns: Json
      }
      replace_booking_services_atomic: {
        Args: { p_arena_id: string; p_booking_id: string; p_lines?: Json }
        Returns: number
      }
      request_athlete_connection: {
        Args: { p_target_athlete_id: string }
        Returns: string
      }
      request_open_game_spot: {
        Args: {
          p_atleta_id: string
          p_message?: string
          p_open_game_id: string
        }
        Returns: string
      }
      request_to_join_team: { Args: { p_team_id: string }; Returns: string }
      resolve_athlete_app_plan: {
        Args: { p_atleta_id: string }
        Returns: string
      }
      resolve_self_service_arena_signup: {
        Args: {
          p_address_data: Json
          p_arena_name: string
          p_document: string
          p_operation_id: string
          p_phone: string
          p_requester_user_id: string
        }
        Returns: Json
      }
      resolve_signup_identity: {
        Args: { p_cpf: string; p_email: string }
        Returns: {
          athlete_by_cpf_cpf: string
          athlete_by_cpf_email: string
          athlete_by_cpf_id: string
          athlete_by_cpf_user_id: string
          user_by_cpf_auth_user_id: string
          user_by_cpf_cpf: string
          user_by_cpf_email: string
          user_by_cpf_id: string
          user_by_email_auth_user_id: string
          user_by_email_cpf: string
          user_by_email_email: string
          user_by_email_id: string
        }[]
      }
      respond_athlete_connection: {
        Args: { p_accept: boolean; p_connection_id: string }
        Returns: string
      }
      respond_my_booking_invite: {
        Args: { p_accept: boolean; p_participant_id: string }
        Returns: string
      }
      respond_open_game_request: {
        Args: {
          p_accept: boolean
          p_owner_atleta_id: string
          p_request_id: string
        }
        Returns: string
      }
      respond_team_membership: {
        Args: { p_accept: boolean; p_membership_id: string }
        Returns: string
      }
      retry_public_arena_import_campaign_failures: {
        Args: {
          p_actor_user_id: string
          p_campaign_id: string
          p_reason: string
        }
        Returns: Json
      }
      revert_station_order_to_open: {
        Args: {
          p_arena_id: string
          p_order_id: string
          p_registered_by: string
        }
        Returns: {
          arena_id: string
          atleta_id: string | null
          closed_at: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          id: string
          order_number: number
          pending_marked_at: string | null
          station_id: string
          status: string | null
          total_value: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "station_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_arena_claim_request: {
        Args: {
          p_actor_user_id: string
          p_decision: string
          p_keep_discoverable?: boolean
          p_reason: string
          p_request_id: string
        }
        Returns: Json
      }
      save_backoffice_booking_bundle_atomic: {
        Args: {
          p_additional_athlete_ids: string[]
          p_arena_id: string
          p_athlete_id: string
          p_athlete_name: string
          p_cobranca_por_participante: boolean
          p_court_id: string
          p_operation_id: string
          p_participant_value: number
          p_recurrence_id: string
          p_registered_by: string
          p_rental_price: number
          p_responsible_athlete_id: string
          p_services: Json
          p_slots: Json
          p_sport_id: string
          p_update_booking_id: string
        }
        Returns: Json
      }
      search_arenas_by_proximity: {
        Args: {
          comodidades_filter?: string[]
          max_distance_meters: number
          user_lat: number
          user_lng: number
        }
        Returns: {
          address: Json
          banner_url: string
          can_book_in_app: boolean
          comodidades: string[]
          complement: string
          data_source: string
          description: string
          dist_meters: number
          email: string
          estado_uf: string
          facebook: string
          id: string
          id_municipio: number
          instagram: string
          lat: number
          lng: number
          location: unknown
          municipio_nome: string
          name: string
          neighborhood: string
          nome_moeda_virtual: string
          number: string
          opening_hours: Json
          phone: string
          platform_kind: string
          sports: string[]
          status: string
          tiktok: string
          zip_code: string
        }[]
      }
      search_public_athletes: {
        Args: {
          p_limit?: number
          p_nearby?: boolean
          p_offset?: number
          p_query?: string
          p_user_lat?: number
          p_user_lng?: number
        }
        Returns: {
          accepted_connection_count: number
          athlete_id: string
          bio: string
          city_id: number
          city_name: string
          display_name: string
          distance_meters: number
          facebook: string
          instagram: string
          is_connected: boolean
          is_pending: boolean
          lat: number
          lng: number
          photo_url: string
          sport_ids: string[]
          sports: Json
          state_name: string
          tiktok: string
        }[]
      }
      search_public_teams: {
        Args: { p_limit?: number; p_offset?: number; p_query?: string }
        Returns: {
          accepts_join_requests: boolean
          city_id: number
          created_at: string
          name: string
          owner_athlete_id: string
          photo_url: string
          public_description: string
          sport_id: string
          team_id: string
        }[]
      }
      set_internal_test_plan_for_arena: {
        Args: { enabled?: boolean; target_arena_id: string }
        Returns: undefined
      }
      set_mensalista_termination_atomic: {
        Args: {
          p_arena_id: string
          p_data_prevista: string
          p_observacao: string
          p_plan_id: string
          p_registered_by: string
        }
        Returns: Json
      }
      set_public_arena_import_campaign_status: {
        Args: {
          p_actor_user_id: string
          p_campaign_id: string
          p_reason: string
          p_status: string
        }
        Returns: Json
      }
      set_station_order_pending: {
        Args: {
          p_arena_id: string
          p_order_id: string
          p_registered_by: string
        }
        Returns: {
          arena_id: string
          atleta_id: string | null
          closed_at: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          id: string
          order_number: number
          pending_marked_at: string | null
          station_id: string
          status: string | null
          total_value: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "station_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      stage_public_arena_import_batch: {
        Args: {
          p_actor_user_id: string
          p_filename: string
          p_items: Json
          p_operation_id: string
          p_reason: string
          p_source: string
        }
        Returns: Json
      }
      store_arena_asaas_credential_recovery: {
        Args: {
          p_account_id: string
          p_arena_id: string
          p_encrypted_payload: string
          p_expires_at: string
          p_wallet_id: string
        }
        Returns: undefined
      }
      store_arena_asaas_subaccount_credentials: {
        Args: {
          p_api_key: string
          p_arena_id: string
          p_asaas_account_id: string
          p_asaas_wallet_id: string
        }
        Returns: Json
      }
      store_arena_asaas_webhook_token_hash: {
        Args: { p_arena_id: string; p_webhook_token_hash: string }
        Returns: Json
      }
      submit_booking_result: {
        Args: { p_booking_id: string; p_reported_by: string; p_sides: Json }
        Returns: string
      }
      try_parse_jsonb: { Args: { p_value: string }; Returns: Json }
      try_parse_timestamptz: { Args: { p_value: string }; Returns: string }
      unlockrows: { Args: { "": string }; Returns: number }
      update_backoffice_booking: {
        Args: {
          p_arena_id: string
          p_athlete_id: string
          p_athlete_name: string
          p_booking_id: string
          p_cobranca_por_participante: boolean
          p_end_time: string
          p_price: number
          p_sport_id: string
          p_start_time: string
        }
        Returns: {
          arena_id: string
          athlete_id: string | null
          athlete_name: string | null
          booking_type: string | null
          cobranca_por_participante: boolean
          court_id: string
          created_at: string
          end_time: string
          id: string
          payment_confirmed_at: string | null
          payment_expires_at: string | null
          plano_mensalista_id: string | null
          price: number | null
          recurrence_id: string | null
          rental_price: number
          sport_id: string | null
          start_time: string
          status: string | null
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_my_team: {
        Args: {
          p_accepts_join_requests: boolean
          p_city_id: number
          p_is_public: boolean
          p_name: string
          p_private_description: string
          p_public_description: string
          p_sport_id: string
          p_status?: string
          p_team_id: string
        }
        Returns: string
      }
      update_open_game_status: {
        Args: { p_open_game_id: string; p_status: string }
        Returns: string
      }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
      withdraw_mensalista_credit_atomic: {
        Args: {
          p_arena_id: string
          p_atleta_id: string
          p_descricao: string
          p_operation_id: string
          p_registered_by: string
          p_valor: number
        }
        Returns: Json
      }
    }
    Enums: {
      origem_vinculo_arena: "arena" | "aplicativo"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
      origem_vinculo_arena: ["arena", "aplicativo"],
    },
  },
} as const
