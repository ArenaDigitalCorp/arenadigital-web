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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
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
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          id: string
          plan_id: string | null
          plan_key: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          arena_id: string
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id?: string | null
          plan_key: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          arena_id?: string
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id?: string | null
          plan_key?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string | null
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
            foreignKeyName: "arena_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_users_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      arenas: {
        Row: {
          address: Json | null
          banner_url: string | null
          complement: string | null
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
          owner_id: string
          phone: string | null
          show_presence: boolean | null
          sports: string[] | null
          status: string | null
          tiktok: string | null
          zip_code: string | null
        }
        Insert: {
          address?: Json | null
          banner_url?: string | null
          complement?: string | null
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
          owner_id: string
          phone?: string | null
          show_presence?: boolean | null
          sports?: string[] | null
          status?: string | null
          tiktok?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: Json | null
          banner_url?: string | null
          complement?: string | null
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
          owner_id?: string
          phone?: string | null
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
          id_nivel_habilidade_esporte: string
        }
        Insert: {
          data_criacao?: string
          id?: string
          id_atleta: string
          id_nivel_habilidade_esporte: string
        }
        Update: {
          data_criacao?: string
          id?: string
          id_atleta?: string
          id_nivel_habilidade_esporte?: string
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
            foreignKeyName: "atleta_esporte_historico_id_nivel_fkey"
            columns: ["id_nivel_habilidade_esporte"]
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
          status: string
        }
        Insert: {
          atleta_id: string
          booking_id: string
          created_at?: string | null
          funcao?: string
          id?: string
          id_time?: string | null
          status?: string
        }
        Update: {
          atleta_id?: string
          booking_id?: string
          created_at?: string | null
          funcao?: string
          id?: string
          id_time?: string | null
          status?: string
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
      bookings: {
        Row: {
          arena_id: string
          athlete_id: string | null
          athlete_name: string | null
          booking_type: string | null
          court_id: string
          created_at: string
          end_time: string
          id: string
          plano_mensalista_id: string | null
          price: number | null
          recurrence_id: string | null
          sport_id: string | null
          start_time: string
          status: string | null
        }
        Insert: {
          arena_id: string
          athlete_id?: string | null
          athlete_name?: string | null
          booking_type?: string | null
          court_id: string
          created_at?: string
          end_time: string
          id?: string
          plano_mensalista_id?: string | null
          price?: number | null
          recurrence_id?: string | null
          sport_id?: string | null
          start_time: string
          status?: string | null
        }
        Update: {
          arena_id?: string
          athlete_id?: string | null
          athlete_name?: string | null
          booking_type?: string | null
          court_id?: string
          created_at?: string
          end_time?: string
          id?: string
          plano_mensalista_id?: string | null
          price?: number | null
          recurrence_id?: string | null
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
            foreignKeyName: "bookings_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
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
          created_at: string
          created_by: string | null
          id: string
          item_type: string
          name: string
          price: number
          station_type_id: string
          status: string | null
          stock_quantity: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          arena_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          item_type: string
          name: string
          price: number
          station_type_id: string
          status?: string | null
          stock_quantity?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          arena_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          item_type?: string
          name?: string
          price?: number
          station_type_id?: string
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
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
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
          tipo: string
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
          tipo: string
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
          tipo?: string
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
      planos_mensalista: {
        Row: {
          arena_id: string
          athlete_id: string
          athlete_name: string
          court_id: string
          created_at: string
          data_inicio: string
          dia_semana: number
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
          created_at?: string
          data_inicio: string
          dia_semana: number
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
          created_at?: string
          data_inicio?: string
          dia_semana?: number
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
      rotativo_inscricoes: {
        Row: {
          data_inscricao: string
          id: string
          id_atleta: string
          id_rotativo: string
          status_pagamento: string | null
          valor_pago: number
        }
        Insert: {
          data_inscricao?: string
          id?: string
          id_atleta: string
          id_rotativo: string
          status_pagamento?: string | null
          valor_pago?: number
        }
        Update: {
          data_inscricao?: string
          id?: string
          id_atleta?: string
          id_rotativo?: string
          status_pagamento?: string | null
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
          observation: string | null
          order_id: string
          paid_by_name: string | null
          payment_method: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          observation?: string | null
          order_id: string
          paid_by_name?: string | null
          payment_method: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          observation?: string | null
          order_id?: string
          paid_by_name?: string | null
          payment_method?: string
        }
        Relationships: [
          {
            foreignKeyName: "station_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "station_orders"
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
      subscription_plans: {
        Row: {
          created_at: string
          features: Json | null
          id: string
          is_active: boolean
          key: string
          label: string
          max_spaces: number
          price_cents: number
          sort_order: number
          stripe_price_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          features?: Json | null
          id?: string
          is_active?: boolean
          key: string
          label: string
          max_spaces: number
          price_cents: number
          sort_order?: number
          stripe_price_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          features?: Json | null
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          max_spaces?: number
          price_cents?: number
          sort_order?: number
          stripe_price_id?: string
          updated_at?: string
        }
        Relationships: []
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
          clerk_user_id: string
          cpf: string | null
          created_at: string
          email: string
          id: string
          name: string | null
          role: string | null
        }
        Insert: {
          clerk_user_id: string
          cpf?: string | null
          created_at?: string
          email: string
          id?: string
          name?: string | null
          role?: string | null
        }
        Update: {
          clerk_user_id?: string
          cpf?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          role?: string | null
        }
        Relationships: []
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
    }
    Functions: {
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
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
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
      gettransactionid: { Args: never; Returns: unknown }
      longtransactionsenabled: { Args: never; Returns: boolean }
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
          comodidades: string[]
          complement: string
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
          sports: string[]
          status: string
          tiktok: string
          zip_code: string
        }[]
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
      unlockrows: { Args: { "": string }; Returns: number }
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
