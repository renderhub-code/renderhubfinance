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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      account_groups: {
        Row: {
          active: boolean
          code: string
          company_id: string
          created_at: string
          dre_section: Database["public"]["Enums"]["dre_section"]
          id: string
          name: string
          sort_order: number
          type: Database["public"]["Enums"]["account_type"]
        }
        Insert: {
          active?: boolean
          code: string
          company_id: string
          created_at?: string
          dre_section: Database["public"]["Enums"]["dre_section"]
          id?: string
          name: string
          sort_order?: number
          type: Database["public"]["Enums"]["account_type"]
        }
        Update: {
          active?: boolean
          code?: string
          company_id?: string
          created_at?: string
          dre_section?: Database["public"]["Enums"]["dre_section"]
          id?: string
          name?: string
          sort_order?: number
          type?: Database["public"]["Enums"]["account_type"]
        }
        Relationships: [
          {
            foreignKeyName: "account_groups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      account_mappings: {
        Row: {
          account_id: string | null
          company_id: string
          created_at: string
          id: string
          notes: string | null
          source_code: string
          source_name: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          source_code: string
          source_name?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          source_code?: string
          source_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_mappings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_mappings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      account_subgroups: {
        Row: {
          active: boolean
          code: string
          company_id: string
          created_at: string
          group_id: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          code: string
          company_id: string
          created_at?: string
          group_id: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          code?: string
          company_id?: string
          created_at?: string
          group_id?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "account_subgroups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_subgroups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "account_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          active: boolean
          code: string
          company_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
          subgroup_id: string
          type: Database["public"]["Enums"]["account_type"]
        }
        Insert: {
          active?: boolean
          code: string
          company_id: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          subgroup_id: string
          type: Database["public"]["Enums"]["account_type"]
        }
        Update: {
          active?: boolean
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          subgroup_id?: string
          type?: Database["public"]["Enums"]["account_type"]
        }
        Relationships: [
          {
            foreignKeyName: "accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_subgroup_id_fkey"
            columns: ["subgroup_id"]
            isOneToOne: false
            referencedRelation: "account_subgroups"
            referencedColumns: ["id"]
          },
        ]
      }
      bling_oauth_states: {
        Row: {
          created_at: string
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string
          state: string
          user_id: string
        }
        Update: {
          created_at?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      bling_tokens: {
        Row: {
          access_token: string
          company_id: string | null
          connected_by: string | null
          created_at: string
          expires_at: string
          id: string
          refresh_token: string
          updated_at: string
        }
        Insert: {
          access_token: string
          company_id?: string | null
          connected_by?: string | null
          created_at?: string
          expires_at: string
          id?: string
          refresh_token: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          company_id?: string | null
          connected_by?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bling_tokens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      business_units: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_units_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cashflow_movements: {
        Row: {
          account_id: string | null
          amount: number
          category_id: string | null
          category_name: string | null
          company_id: string
          description: string | null
          external_id: string
          financial_account: string | null
          id: string
          kind: string
          movement_date: string
          source_origin: string | null
          sync_id: string
          type: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category_id?: string | null
          category_name?: string | null
          company_id: string
          description?: string | null
          external_id: string
          financial_account?: string | null
          id?: string
          kind: string
          movement_date: string
          source_origin?: string | null
          sync_id: string
          type: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category_id?: string | null
          category_name?: string | null
          company_id?: string
          description?: string | null
          external_id?: string
          financial_account?: string | null
          id?: string
          kind?: string
          movement_date?: string
          source_origin?: string | null
          sync_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cashflow_movements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashflow_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashflow_movements_sync_id_fkey"
            columns: ["sync_id"]
            isOneToOne: false
            referencedRelation: "cashflow_syncs"
            referencedColumns: ["id"]
          },
        ]
      }
      cashflow_opening_balances: {
        Row: {
          amount: number
          company_id: string
          updated_at: string
          year: number
        }
        Insert: {
          amount: number
          company_id: string
          updated_at?: string
          year: number
        }
        Update: {
          amount?: number
          company_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "cashflow_opening_balances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cashflow_syncs: {
        Row: {
          company_id: string
          completed_at: string | null
          created_by: string | null
          error: string | null
          forecasts: Json | null
          id: string
          movement_count: number
          next_page: number
          phase: string
          started_at: string
          status: string
          year: number
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          created_by?: string | null
          error?: string | null
          forecasts?: Json | null
          id?: string
          movement_count?: number
          next_page?: number
          phase?: string
          started_at?: string
          status?: string
          year: number
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          created_by?: string | null
          error?: string | null
          forecasts?: Json | null
          id?: string
          movement_count?: number
          next_page?: number
          phase?: string
          started_at?: string
          status?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "cashflow_syncs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      contabil_agenda_horarios: {
        Row: {
          agenda_id: string
          criado_em: string
          fim: string
          id: string
          inicio: string
        }
        Insert: {
          agenda_id: string
          criado_em?: string
          fim: string
          id?: string
          inicio: string
        }
        Update: {
          agenda_id?: string
          criado_em?: string
          fim?: string
          id?: string
          inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "contabil_agenda_horarios_agenda_id_fkey"
            columns: ["agenda_id"]
            isOneToOne: false
            referencedRelation: "contabil_agendas"
            referencedColumns: ["id"]
          },
        ]
      }
      contabil_agenda_reservas: {
        Row: {
          assunto: string | null
          cancelado_em: string | null
          criado_em: string
          email: string
          empresa: string | null
          horario_id: string
          id: string
          modalidade: string
          nome: string
          situacao: string
          telefone: string | null
        }
        Insert: {
          assunto?: string | null
          cancelado_em?: string | null
          criado_em?: string
          email: string
          empresa?: string | null
          horario_id: string
          id?: string
          modalidade: string
          nome: string
          situacao?: string
          telefone?: string | null
        }
        Update: {
          assunto?: string | null
          cancelado_em?: string | null
          criado_em?: string
          email?: string
          empresa?: string | null
          horario_id?: string
          id?: string
          modalidade?: string
          nome?: string
          situacao?: string
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contabil_agenda_reservas_horario_id_fkey"
            columns: ["horario_id"]
            isOneToOne: false
            referencedRelation: "contabil_agenda_horarios"
            referencedColumns: ["id"]
          },
        ]
      }
      contabil_agendas: {
        Row: {
          ativa: boolean
          atualizado_em: string
          codigo: string
          criado_em: string
          dono_id: string
          endereco: string | null
          id: string
          link_video: string | null
        }
        Insert: {
          ativa?: boolean
          atualizado_em?: string
          codigo: string
          criado_em?: string
          dono_id: string
          endereco?: string | null
          id?: string
          link_video?: string | null
        }
        Update: {
          ativa?: boolean
          atualizado_em?: string
          codigo?: string
          criado_em?: string
          dono_id?: string
          endereco?: string | null
          id?: string
          link_video?: string | null
        }
        Relationships: []
      }
      contabil_atividades: {
        Row: {
          atividade: string
          atualizado_por: string | null
          categoria_id: string | null
          cliente_id: string | null
          criado_em: string
          criado_por: string | null
          follow_up: string | null
          id: string
          prazo: string | null
          prioridade: number
          responsavel_id: string
          setor_id: string
          status: Database["public"]["Enums"]["contabil_status"]
          ultima_atualizacao: string | null
        }
        Insert: {
          atividade: string
          atualizado_por?: string | null
          categoria_id?: string | null
          cliente_id?: string | null
          criado_em?: string
          criado_por?: string | null
          follow_up?: string | null
          id?: string
          prazo?: string | null
          prioridade?: number
          responsavel_id: string
          setor_id: string
          status?: Database["public"]["Enums"]["contabil_status"]
          ultima_atualizacao?: string | null
        }
        Update: {
          atividade?: string
          atualizado_por?: string | null
          categoria_id?: string | null
          cliente_id?: string | null
          criado_em?: string
          criado_por?: string | null
          follow_up?: string | null
          id?: string
          prazo?: string | null
          prioridade?: number
          responsavel_id?: string
          setor_id?: string
          status?: Database["public"]["Enums"]["contabil_status"]
          ultima_atualizacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contabil_atividades_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "contabil_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contabil_atividades_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "contabil_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contabil_atividades_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "contabil_setores"
            referencedColumns: ["id"]
          },
        ]
      }
      contabil_bases_union: {
        Row: {
          base: string
          busca: string | null
          dados: Json
          destino_id: string | null
          importado_em: string
          registro_id: string
        }
        Insert: {
          base: string
          busca?: string | null
          dados: Json
          destino_id?: string | null
          importado_em?: string
          registro_id: string
        }
        Update: {
          base?: string
          busca?: string | null
          dados?: Json
          destino_id?: string | null
          importado_em?: string
          registro_id?: string
        }
        Relationships: []
      }
      contabil_categorias: {
        Row: {
          ativo: boolean
          criado_em: string
          criado_por: string | null
          id: string
          nome: string
          ordem: number
          setor_id: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          criado_por?: string | null
          id?: string
          nome: string
          ordem?: number
          setor_id: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          criado_por?: string | null
          id?: string
          nome?: string
          ordem?: number
          setor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contabil_categorias_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "contabil_setores"
            referencedColumns: ["id"]
          },
        ]
      }
      contabil_ciencias: {
        Row: {
          atividade_id: string
          ciente_em: string
          user_id: string
        }
        Insert: {
          atividade_id: string
          ciente_em?: string
          user_id: string
        }
        Update: {
          atividade_id?: string
          ciente_em?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contabil_ciencias_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "contabil_atividades"
            referencedColumns: ["id"]
          },
        ]
      }
      contabil_clientes: {
        Row: {
          apelido: string | null
          ativo: boolean
          atualizado_em: string
          cidade: string | null
          cnpj: string | null
          cnpj_digits: string | null
          codigo_dominio: string | null
          criado_em: string
          grupo_economico: string | null
          id: string
          nome_fantasia: string | null
          razao_social: string
          regime: string | null
          segmento: string | null
          uf: string | null
        }
        Insert: {
          apelido?: string | null
          ativo?: boolean
          atualizado_em?: string
          cidade?: string | null
          cnpj?: string | null
          cnpj_digits?: string | null
          codigo_dominio?: string | null
          criado_em?: string
          grupo_economico?: string | null
          id?: string
          nome_fantasia?: string | null
          razao_social: string
          regime?: string | null
          segmento?: string | null
          uf?: string | null
        }
        Update: {
          apelido?: string | null
          ativo?: boolean
          atualizado_em?: string
          cidade?: string | null
          cnpj?: string | null
          cnpj_digits?: string | null
          codigo_dominio?: string | null
          criado_em?: string
          grupo_economico?: string | null
          id?: string
          nome_fantasia?: string | null
          razao_social?: string
          regime?: string | null
          segmento?: string | null
          uf?: string | null
        }
        Relationships: []
      }
      contabil_identidades_union: {
        Row: {
          auth_user_id: string
          criado_em: string
          email: string
          original_id: string
        }
        Insert: {
          auth_user_id: string
          criado_em?: string
          email: string
          original_id: string
        }
        Update: {
          auth_user_id?: string
          criado_em?: string
          email?: string
          original_id?: string
        }
        Relationships: []
      }
      contabil_membros: {
        Row: {
          ativo: boolean
          atribuicao_global: boolean
          criado_em: string
          email: string | null
          nome: string
          papel: Database["public"]["Enums"]["contabil_papel"]
          setor_id: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean
          atribuicao_global?: boolean
          criado_em?: string
          email?: string | null
          nome?: string
          papel?: Database["public"]["Enums"]["contabil_papel"]
          setor_id?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean
          atribuicao_global?: boolean
          criado_em?: string
          email?: string | null
          nome?: string
          papel?: Database["public"]["Enums"]["contabil_papel"]
          setor_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contabil_membros_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "contabil_setores"
            referencedColumns: ["id"]
          },
        ]
      }
      contabil_setores: {
        Row: {
          criado_em: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          criado_em?: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          criado_em?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      cost_centers: {
        Row: {
          active: boolean
          code: string
          company_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          code: string
          company_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_atualizacoes: {
        Row: {
          autor: string | null
          autor_id: string | null
          cliente_id: string
          criado_em: string
          id: string
          mensagem: string
          processo_id: string
        }
        Insert: {
          autor?: string | null
          autor_id?: string | null
          cliente_id: string
          criado_em?: string
          id?: string
          mensagem: string
          processo_id: string
        }
        Update: {
          autor?: string | null
          autor_id?: string | null
          cliente_id?: string
          criado_em?: string
          id?: string
          mensagem?: string
          processo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cs_atualizacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "cs_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_atualizacoes_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "cs_processos"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_clientes: {
        Row: {
          comercial_responsavel: string | null
          criado_em: string
          cs_responsavel: string | null
          emails: string[]
          empresa: string
          id: string
          nome: string
        }
        Insert: {
          comercial_responsavel?: string | null
          criado_em?: string
          cs_responsavel?: string | null
          emails?: string[]
          empresa?: string
          id?: string
          nome: string
        }
        Update: {
          comercial_responsavel?: string | null
          criado_em?: string
          cs_responsavel?: string | null
          emails?: string[]
          empresa?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      cs_equipe: {
        Row: {
          criado_em: string
          email: string | null
          nome: string
          papel: Database["public"]["Enums"]["cs_papel"]
          user_id: string
        }
        Insert: {
          criado_em?: string
          email?: string | null
          nome?: string
          papel?: Database["public"]["Enums"]["cs_papel"]
          user_id: string
        }
        Update: {
          criado_em?: string
          email?: string | null
          nome?: string
          papel?: Database["public"]["Enums"]["cs_papel"]
          user_id?: string
        }
        Relationships: []
      }
      cs_processos: {
        Row: {
          atualizado_em: string
          chegada_prevista: string | null
          cliente_id: string
          container: string | null
          criado_em: string
          data_embarque: string | null
          etapa: Database["public"]["Enums"]["cs_etapa"]
          id: string
          invoice: string | null
          mercadoria: string
          pendencia: string | null
          po: string
          status_texto: string | null
        }
        Insert: {
          atualizado_em?: string
          chegada_prevista?: string | null
          cliente_id: string
          container?: string | null
          criado_em?: string
          data_embarque?: string | null
          etapa?: Database["public"]["Enums"]["cs_etapa"]
          id?: string
          invoice?: string | null
          mercadoria: string
          pendencia?: string | null
          po: string
          status_texto?: string | null
        }
        Update: {
          atualizado_em?: string
          chegada_prevista?: string | null
          cliente_id?: string
          container?: string | null
          criado_em?: string
          data_embarque?: string | null
          etapa?: Database["public"]["Enums"]["cs_etapa"]
          id?: string
          invoice?: string | null
          mercadoria?: string
          pendencia?: string | null
          po?: string
          status_texto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_processos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "cs_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_acesso: {
        Row: {
          criado_em: string
          email: string | null
          nome: string
          papel: Database["public"]["Enums"]["ia_papel"]
          user_id: string
        }
        Insert: {
          criado_em?: string
          email?: string | null
          nome?: string
          papel?: Database["public"]["Enums"]["ia_papel"]
          user_id: string
        }
        Update: {
          criado_em?: string
          email?: string | null
          nome?: string
          papel?: Database["public"]["Enums"]["ia_papel"]
          user_id?: string
        }
        Relationships: []
      }
      ia_atualizacoes: {
        Row: {
          autor_id: string | null
          autor_nome: string | null
          criado_em: string
          id: string
          solucao_id: string
          texto: string
        }
        Insert: {
          autor_id?: string | null
          autor_nome?: string | null
          criado_em?: string
          id?: string
          solucao_id: string
          texto: string
        }
        Update: {
          autor_id?: string | null
          autor_nome?: string | null
          criado_em?: string
          id?: string
          solucao_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "ia_atualizacoes_solucao_id_fkey"
            columns: ["solucao_id"]
            isOneToOne: false
            referencedRelation: "ia_solucoes"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_modulos: {
        Row: {
          criado_em: string
          id: string
          ordem: number
          titulo: string
        }
        Insert: {
          criado_em?: string
          id?: string
          ordem?: number
          titulo: string
        }
        Update: {
          criado_em?: string
          id?: string
          ordem?: number
          titulo?: string
        }
        Relationships: []
      }
      ia_pessoas: {
        Row: {
          cargo: string | null
          criado_em: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          cargo?: string | null
          criado_em?: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          cargo?: string | null
          criado_em?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      ia_progresso: {
        Row: {
          modulo_id: string
          pessoa_id: string
          status: number
        }
        Insert: {
          modulo_id: string
          pessoa_id: string
          status?: number
        }
        Update: {
          modulo_id?: string
          pessoa_id?: string
          status?: number
        }
        Relationships: [
          {
            foreignKeyName: "ia_progresso_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "ia_modulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ia_progresso_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "ia_pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_solucoes: {
        Row: {
          atualizado_em: string
          criado_em: string
          custo: number
          descricao: string | null
          empresas: string[]
          ganho: number
          horas: number
          id: string
          link: string | null
          previsao: string | null
          responsavel: string | null
          status: string
          tipo: string
          titulo: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          custo?: number
          descricao?: string | null
          empresas?: string[]
          ganho?: number
          horas?: number
          id?: string
          link?: string | null
          previsao?: string | null
          responsavel?: string | null
          status?: string
          tipo?: string
          titulo: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          custo?: number
          descricao?: string | null
          empresas?: string[]
          ganho?: number
          horas?: number
          id?: string
          link?: string | null
          previsao?: string | null
          responsavel?: string | null
          status?: string
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      os_acessos: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          empresa: string
          nivel: number
          recurso: string
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          empresa: string
          nivel: number
          recurso: string
          user_id: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          empresa?: string
          nivel?: number
          recurso?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          default_company_id: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_company_id?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_company_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_company_id_fkey"
            columns: ["default_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_asos: {
        Row: {
          colaborador_id: string
          criado_em: string
          data: string
          id: string
          obs: string | null
          proxima: string | null
          resultado: string
          tipo: string
        }
        Insert: {
          colaborador_id: string
          criado_em?: string
          data: string
          id?: string
          obs?: string | null
          proxima?: string | null
          resultado?: string
          tipo: string
        }
        Update: {
          colaborador_id?: string
          criado_em?: string
          data?: string
          id?: string
          obs?: string | null
          proxima?: string | null
          resultado?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_asos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "rh_colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_avaliacoes: {
        Row: {
          autor_id: string | null
          ciclo: string
          colaborador_id: string
          criado_em: string
          desempenho: number | null
          fortes: string | null
          gestor: string | null
          id: string
          media: number | null
          melhorias: string | null
          notas: number[] | null
          plano: string | null
          potencial: number | null
          resultados: string | null
          tipo: string
        }
        Insert: {
          autor_id?: string | null
          ciclo: string
          colaborador_id: string
          criado_em?: string
          desempenho?: number | null
          fortes?: string | null
          gestor?: string | null
          id?: string
          media?: number | null
          melhorias?: string | null
          notas?: number[] | null
          plano?: string | null
          potencial?: number | null
          resultados?: string | null
          tipo: string
        }
        Update: {
          autor_id?: string | null
          ciclo?: string
          colaborador_id?: string
          criado_em?: string
          desempenho?: number | null
          fortes?: string | null
          gestor?: string | null
          id?: string
          media?: number | null
          melhorias?: string | null
          notas?: number[] | null
          plano?: string | null
          potencial?: number | null
          resultados?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_avaliacoes_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "rh_colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_calendario: {
        Row: {
          atividade: string
          ativo: boolean
          criado_em: string
          dia: number
          empresa: string
          id: string
          recorrencia: string
          responsavel: string | null
        }
        Insert: {
          atividade: string
          ativo?: boolean
          criado_em?: string
          dia: number
          empresa: string
          id?: string
          recorrencia?: string
          responsavel?: string | null
        }
        Update: {
          atividade?: string
          ativo?: boolean
          criado_em?: string
          dia?: number
          empresa?: string
          id?: string
          recorrencia?: string
          responsavel?: string | null
        }
        Relationships: []
      }
      rh_colaboradores: {
        Row: {
          admissao: string | null
          atualizado_em: string
          cargo: string | null
          criado_em: string
          desligamento: string | null
          email: string | null
          empresa: string
          gestor: string | null
          id: string
          jornada: string | null
          matricula: string | null
          motivo_desligamento: string | null
          nome: string
          obs: string | null
          setor: string | null
          status: string
          vinculo: string
        }
        Insert: {
          admissao?: string | null
          atualizado_em?: string
          cargo?: string | null
          criado_em?: string
          desligamento?: string | null
          email?: string | null
          empresa: string
          gestor?: string | null
          id?: string
          jornada?: string | null
          matricula?: string | null
          motivo_desligamento?: string | null
          nome: string
          obs?: string | null
          setor?: string | null
          status?: string
          vinculo?: string
        }
        Update: {
          admissao?: string | null
          atualizado_em?: string
          cargo?: string | null
          criado_em?: string
          desligamento?: string | null
          email?: string | null
          empresa?: string
          gestor?: string | null
          id?: string
          jornada?: string | null
          matricula?: string | null
          motivo_desligamento?: string | null
          nome?: string
          obs?: string | null
          setor?: string | null
          status?: string
          vinculo?: string
        }
        Relationships: []
      }
      rh_contratos_pj: {
        Row: {
          aviso_dias: number | null
          cnpj: string | null
          criado_em: string
          empresa: string
          fim: string | null
          gestor: string | null
          id: string
          inicio: string | null
          obs: string | null
          prestador: string
          reajuste: string | null
          servico: string | null
          status: string
          valor_mensal: number
        }
        Insert: {
          aviso_dias?: number | null
          cnpj?: string | null
          criado_em?: string
          empresa: string
          fim?: string | null
          gestor?: string | null
          id?: string
          inicio?: string | null
          obs?: string | null
          prestador: string
          reajuste?: string | null
          servico?: string | null
          status?: string
          valor_mensal?: number
        }
        Update: {
          aviso_dias?: number | null
          cnpj?: string | null
          criado_em?: string
          empresa?: string
          fim?: string | null
          gestor?: string | null
          id?: string
          inicio?: string | null
          obs?: string | null
          prestador?: string
          reajuste?: string | null
          servico?: string | null
          status?: string
          valor_mensal?: number
        }
        Relationships: []
      }
      rh_custos: {
        Row: {
          autor_id: string | null
          categoria: string
          competencia: string
          criado_em: string
          descricao: string | null
          empresa: string
          id: string
          valor: number
        }
        Insert: {
          autor_id?: string | null
          categoria: string
          competencia: string
          criado_em?: string
          descricao?: string | null
          empresa: string
          id?: string
          valor: number
        }
        Update: {
          autor_id?: string | null
          categoria?: string
          competencia?: string
          criado_em?: string
          descricao?: string | null
          empresa?: string
          id?: string
          valor?: number
        }
        Relationships: []
      }
      rh_documentos: {
        Row: {
          colaborador_id: string | null
          criado_em: string
          descricao: string | null
          empresa: string
          id: string
          obs: string | null
          responsavel: string | null
          status: string
          tipo: string
          vencimento: string | null
        }
        Insert: {
          colaborador_id?: string | null
          criado_em?: string
          descricao?: string | null
          empresa: string
          id?: string
          obs?: string | null
          responsavel?: string | null
          status?: string
          tipo: string
          vencimento?: string | null
        }
        Update: {
          colaborador_id?: string | null
          criado_em?: string
          descricao?: string | null
          empresa?: string
          id?: string
          obs?: string | null
          responsavel?: string | null
          status?: string
          tipo?: string
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rh_documentos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "rh_colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_folha: {
        Row: {
          beneficios: number
          bruto: number
          colaborador_id: string
          competencia: string
          criado_em: string
          encargos_pct: number
          gratificacao: number
          id: string
          inss_pct: number
          irrf: number
          outros_descontos: number
          va: number
          vt: number
        }
        Insert: {
          beneficios?: number
          bruto?: number
          colaborador_id: string
          competencia: string
          criado_em?: string
          encargos_pct?: number
          gratificacao?: number
          id?: string
          inss_pct?: number
          irrf?: number
          outros_descontos?: number
          va?: number
          vt?: number
        }
        Update: {
          beneficios?: number
          bruto?: number
          colaborador_id?: string
          competencia?: string
          criado_em?: string
          encargos_pct?: number
          gratificacao?: number
          id?: string
          inss_pct?: number
          irrf?: number
          outros_descontos?: number
          va?: number
          vt?: number
        }
        Relationships: [
          {
            foreignKeyName: "rh_folha_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "rh_colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_orcamentos: {
        Row: {
          ano: number
          empresa: string
          valor: number
        }
        Insert: {
          ano: number
          empresa: string
          valor?: number
        }
        Update: {
          ano?: number
          empresa?: string
          valor?: number
        }
        Relationships: []
      }
      rh_parametros: {
        Row: {
          atualizado_em: string
          empresa: string
          encargos_pct: number
          meta_turnover: number
          provisoes_pct: number
        }
        Insert: {
          atualizado_em?: string
          empresa: string
          encargos_pct?: number
          meta_turnover?: number
          provisoes_pct?: number
        }
        Update: {
          atualizado_em?: string
          empresa?: string
          encargos_pct?: number
          meta_turnover?: number
          provisoes_pct?: number
        }
        Relationships: []
      }
      rh_remuneracao: {
        Row: {
          autor_id: string | null
          colaborador_id: string
          competencia: string
          criado_em: string
          descricao: string | null
          fim: string | null
          id: string
          tipo: string
          valor: number
        }
        Insert: {
          autor_id?: string | null
          colaborador_id: string
          competencia: string
          criado_em?: string
          descricao?: string | null
          fim?: string | null
          id?: string
          tipo: string
          valor: number
        }
        Update: {
          autor_id?: string | null
          colaborador_id?: string
          competencia?: string
          criado_em?: string
          descricao?: string | null
          fim?: string | null
          id?: string
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "rh_remuneracao_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "rh_colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_lines: {
        Row: {
          account_id: string
          amount: number
          business_unit_id: string | null
          client_name: string | null
          created_at: string
          description: string | null
          group_key: string
          id: string
          margin_pct: number
          month: number
          qty_expected: number
          qty_realized: number
          simulation_id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          account_id: string
          amount?: number
          business_unit_id?: string | null
          client_name?: string | null
          created_at?: string
          description?: string | null
          group_key?: string
          id?: string
          margin_pct?: number
          month: number
          qty_expected?: number
          qty_realized?: number
          simulation_id: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          business_unit_id?: string | null
          client_name?: string | null
          created_at?: string
          description?: string | null
          group_key?: string
          id?: string
          margin_pct?: number
          month?: number
          qty_expected?: number
          qty_realized?: number
          simulation_id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_lines_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_lines_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      simulations: {
        Row: {
          applied_at: string | null
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          name: string
          notes: string | null
          status: string
          updated_at: string
          year: number
        }
        Insert: {
          applied_at?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
          year: number
        }
        Update: {
          applied_at?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "simulations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount_expected: number
          amount_realized: number
          attachment_path: string | null
          bank: string | null
          bank_account: string | null
          business_unit_id: string | null
          company_id: string
          cost_center_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          document_number: string | null
          due_date: string | null
          entry_date: string
          external_id: string | null
          external_source: string | null
          id: string
          notes: string | null
          payment_method: string | null
          settled_date: string | null
          source_simulation_id: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
        }
        Insert: {
          account_id: string
          amount_expected?: number
          amount_realized?: number
          attachment_path?: string | null
          bank?: string | null
          bank_account?: string | null
          business_unit_id?: string | null
          company_id: string
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_number?: string | null
          due_date?: string | null
          entry_date?: string
          external_id?: string | null
          external_source?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          settled_date?: string | null
          source_simulation_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount_expected?: number
          amount_realized?: number
          attachment_path?: string | null
          bank?: string | null
          bank_account?: string | null
          business_unit_id?: string | null
          company_id?: string
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_number?: string | null
          due_date?: string | null
          entry_date?: string
          external_id?: string | null
          external_source?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          settled_date?: string | null
          source_simulation_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_source_simulation_id_fkey"
            columns: ["source_simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_companies: {
        Row: {
          company_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acessos_usuarios: {
        Args: never
        Returns: {
          acessos: Json
          admin: boolean
          cliente: boolean
          criado_em: string
          email: string
          id: string
          nome: string
          ultimo_acesso: string
        }[]
      }
      bootstrap_first_controller: { Args: never; Returns: boolean }
      contabil_agenda_pode_editar: {
        Args: { _agenda: string }
        Returns: boolean
      }
      contabil_agenda_publica: { Args: { _codigo: string }; Returns: Json }
      contabil_agenda_reservar: {
        Args: {
          _assunto: string
          _codigo: string
          _email: string
          _empresa: string
          _horario: string
          _modalidade: string
          _nome: string
          _telefone: string
        }
        Returns: Json
      }
      contabil_bootstrap_admin: { Args: never; Returns: boolean }
      contabil_global: { Args: { _uid: string }; Returns: boolean }
      contabil_is_admin: { Args: { _uid: string }; Returns: boolean }
      contabil_is_membro: { Args: { _uid: string }; Returns: boolean }
      contabil_papel_de: {
        Args: { _uid: string }
        Returns: Database["public"]["Enums"]["contabil_papel"]
      }
      contabil_resumo_bases_union: {
        Args: never
        Returns: {
          base: string
          quantidade: number
        }[]
      }
      contabil_setor_de: { Args: { _uid: string }; Returns: string }
      contabil_tem_acesso: { Args: { _uid: string }; Returns: boolean }
      contabil_usuarios_disponiveis: {
        Args: never
        Returns: {
          email: string
          id: string
          nome: string
        }[]
      }
      cs_bootstrap_admin: { Args: never; Returns: boolean }
      cs_is_admin: { Args: { _uid: string }; Returns: boolean }
      cs_is_cliente: {
        Args: { _cliente_id: string; _uid: string }
        Returns: boolean
      }
      cs_is_equipe: { Args: { _uid: string }; Returns: boolean }
      cs_usuarios_disponiveis: {
        Args: never
        Returns: {
          email: string
          id: string
          nome: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      ia_bootstrap_admin: { Args: never; Returns: boolean }
      ia_is_admin: { Args: { _uid: string }; Returns: boolean }
      ia_pode_editar: { Args: { _uid: string }; Returns: boolean }
      ia_pode_ver: { Args: { _uid: string }; Returns: boolean }
      ia_usuarios_disponiveis: {
        Args: never
        Returns: {
          email: string
          id: string
          nome: string
        }[]
      }
      is_controller: { Args: { _user_id: string }; Returns: boolean }
      os_empresa_de: { Args: { _company: string }; Returns: string }
      os_nivel: {
        Args: { _empresa: string; _recurso: string; _uid: string }
        Returns: number
      }
      os_nivel_company: {
        Args: { _company: string; _recurso: string; _uid: string }
        Returns: number
      }
      os_nivel_modulo: {
        Args: { _empresa: string; _prefixo: string; _uid: string }
        Returns: number
      }
      os_pode: {
        Args: { _empresa: string; _min?: number; _recurso: string }
        Returns: boolean
      }
      os_pode_company: {
        Args: { _company: string; _min?: number; _recurso: string }
        Returns: boolean
      }
      render_os_perfil: { Args: never; Returns: Json }
      rh_alertas: { Args: { _empresas: string[] }; Returns: Json }
      rh_empresa_do_colaborador: { Args: { _id: string }; Returns: string }
      rh_nivel: {
        Args: { _empresa: string; _recursos: string[] }
        Returns: number
      }
      user_has_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      user_is_ceo_only: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      account_type: "entrada" | "saida"
      app_role: "controller" | "financial_manager" | "ceo_viewer"
      contabil_papel: "admin" | "coordenador" | "analista"
      contabil_status:
        | "nao_iniciado"
        | "em_andamento"
        | "concluido"
        | "atrasado"
      cs_etapa:
        | "pedido"
        | "producao"
        | "embarque"
        | "transito"
        | "porto"
        | "desembaraco"
        | "entregue"
      cs_papel: "admin" | "equipe"
      dre_section:
        | "receita_bruta"
        | "deducoes"
        | "custos"
        | "despesas_operacionais"
        | "despesas_administrativas"
        | "despesas_comerciais"
        | "receitas_financeiras"
        | "despesas_financeiras"
        | "investimentos"
        | "nao_operacional"
      ia_papel: "admin" | "colaborador" | "leitor"
      transaction_status: "previsto" | "realizado" | "cancelado" | "atrasado"
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
    Enums: {
      account_type: ["entrada", "saida"],
      app_role: ["controller", "financial_manager", "ceo_viewer"],
      contabil_papel: ["admin", "coordenador", "analista"],
      contabil_status: [
        "nao_iniciado",
        "em_andamento",
        "concluido",
        "atrasado",
      ],
      cs_etapa: [
        "pedido",
        "producao",
        "embarque",
        "transito",
        "porto",
        "desembaraco",
        "entregue",
      ],
      cs_papel: ["admin", "equipe"],
      dre_section: [
        "receita_bruta",
        "deducoes",
        "custos",
        "despesas_operacionais",
        "despesas_administrativas",
        "despesas_comerciais",
        "receitas_financeiras",
        "despesas_financeiras",
        "investimentos",
        "nao_operacional",
      ],
      ia_papel: ["admin", "colaborador", "leitor"],
      transaction_status: ["previsto", "realizado", "cancelado", "atrasado"],
    },
  },
} as const
