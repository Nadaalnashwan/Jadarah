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
      ai_analysis_records: {
        Row: {
          company_id: string | null
          created_at: string
          error: string | null
          id: string
          is_demo: boolean
          kind: string
          model: string | null
          output: Json | null
          provider: string
          status: string
          subject_id: string | null
          subject_type: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          is_demo?: boolean
          kind: string
          model?: string | null
          output?: Json | null
          provider: string
          status?: string
          subject_id?: string | null
          subject_type: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          is_demo?: boolean
          kind?: string
          model?: string | null
          output?: Json | null
          provider?: string
          status?: string
          subject_id?: string | null
          subject_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_analysis_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analysis_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generation_records: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          input_summary: string | null
          is_demo: boolean
          kind: string
          model: string | null
          output: Json | null
          provider: string
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          input_summary?: string | null
          is_demo?: boolean
          kind: string
          model?: string | null
          output?: Json | null
          provider: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          input_summary?: string | null
          is_demo?: boolean
          kind?: string
          model?: string | null
          output?: Json | null
          provider?: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_generation_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generation_records_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generation_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_embeddings: {
        Row: {
          content_hash: string
          dims: number
          embedding: string
          model: string
          updated_at: string
          candidate_id: string
        }
        Insert: {
          content_hash: string
          dims: number
          embedding: string
          model: string
          updated_at?: string
          candidate_id: string
        }
        Update: {
          content_hash?: string
          dims?: number
          embedding?: string
          model?: string
          updated_at?: string
          candidate_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_embeddings_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_embeddings: {
        Row: {
          content_hash: string
          dims: number
          embedding: string
          model: string
          updated_at: string
          job_id: string
        }
        Insert: {
          content_hash: string
          dims: number
          embedding: string
          model: string
          updated_at?: string
          job_id: string
        }
        Update: {
          content_hash?: string
          dims?: number
          embedding?: string
          model?: string
          updated_at?: string
          job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_embeddings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_embeddings: {
        Row: {
          content_hash: string
          dims: number
          embedding: string
          model: string
          updated_at: string
          skill_id: string
        }
        Insert: {
          content_hash: string
          dims: number
          embedding: string
          model: string
          updated_at?: string
          skill_id: string
        }
        Update: {
          content_hash?: string
          dims?: number
          embedding?: string
          model?: string
          updated_at?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_embeddings_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_provider_logs: {
        Row: {
          created_at: string
          error_code: string | null
          id: string
          input_tokens: number | null
          latency_ms: number | null
          model: string | null
          operation: string
          output_tokens: number | null
          provider: string
          success: boolean
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          model?: string | null
          operation: string
          output_tokens?: number | null
          provider: string
          success: boolean
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_code?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          model?: string | null
          operation?: string
          output_tokens?: number | null
          provider?: string
          success?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_provider_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      application_answers: {
        Row: {
          answer: string
          application_id: string
          id: string
          question_id: string
        }
        Insert: {
          answer: string
          application_id: string
          id?: string
          question_id: string
        }
        Update: {
          answer?: string
          application_id?: string
          id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_answers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "job_application_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      application_documents: {
        Row: {
          application_id: string
          created_at: string
          document_id: string
          id: string
          kind: string
        }
        Insert: {
          application_id: string
          created_at?: string
          document_id: string
          id?: string
          kind?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          document_id?: string
          id?: string
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "candidate_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      application_notes: {
        Row: {
          application_id: string
          author_id: string | null
          body: string
          created_at: string
          id: string
        }
        Insert: {
          application_id: string
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
        }
        Update: {
          application_id?: string
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      application_status_history: {
        Row: {
          application_id: string
          candidate_message: string | null
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["application_status"] | null
          id: string
          reason: string | null
          to_status: Database["public"]["Enums"]["application_status"]
        }
        Insert: {
          application_id: string
          candidate_message?: string | null
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["application_status"] | null
          id?: string
          reason?: string | null
          to_status: Database["public"]["Enums"]["application_status"]
        }
        Update: {
          application_id?: string
          candidate_message?: string | null
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["application_status"] | null
          id?: string
          reason?: string | null
          to_status?: Database["public"]["Enums"]["application_status"]
        }
        Relationships: [
          {
            foreignKeyName: "application_status_history_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          candidate_id: string
          company_id: string
          cover_letter: string | null
          cv_document_id: string | null
          decided_at: string | null
          id: string
          job_id: string
          match_breakdown: Json | null
          match_score: number | null
          status: Database["public"]["Enums"]["application_status"]
          submitted_at: string
          updated_at: string
          was_shortlisted: boolean
        }
        Insert: {
          candidate_id: string
          company_id: string
          cover_letter?: string | null
          cv_document_id?: string | null
          decided_at?: string | null
          id?: string
          job_id: string
          match_breakdown?: Json | null
          match_score?: number | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string
          updated_at?: string
          was_shortlisted?: boolean
        }
        Update: {
          candidate_id?: string
          company_id?: string
          cover_letter?: string | null
          cv_document_id?: string | null
          decided_at?: string | null
          id?: string
          job_id?: string
          match_breakdown?: Json | null
          match_score?: number | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string
          updated_at?: string
          was_shortlisted?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_cv_document_id_fkey"
            columns: ["cv_document_id"]
            isOneToOne: false
            referencedRelation: "candidate_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_answers: {
        Row: {
          file_path: string | null
          id: string
          is_correct: boolean | null
          points_awarded: number | null
          question_id: string
          selected_option_ids: string[]
          submission_id: string
          text_answer: string | null
          updated_at: string
        }
        Insert: {
          file_path?: string | null
          id?: string
          is_correct?: boolean | null
          points_awarded?: number | null
          question_id: string
          selected_option_ids?: string[]
          submission_id: string
          text_answer?: string | null
          updated_at?: string
        }
        Update: {
          file_path?: string | null
          id?: string
          is_correct?: boolean | null
          points_awarded?: number | null
          question_id?: string
          selected_option_ids?: string[]
          submission_id?: string
          text_answer?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "assessment_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_answers_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "assessment_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_assignments: {
        Row: {
          application_id: string | null
          assessment_id: string
          assigned_by: string | null
          candidate_id: string
          company_id: string | null
          created_at: string
          due_at: string | null
          id: string
          started_at: string | null
          status: Database["public"]["Enums"]["assignment_status"]
          submitted_at: string | null
        }
        Insert: {
          application_id?: string | null
          assessment_id: string
          assigned_by?: string | null
          candidate_id: string
          company_id?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          submitted_at?: string | null
        }
        Update: {
          application_id?: string | null
          assessment_id?: string
          assigned_by?: string | null
          candidate_id?: string
          company_id?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_assignments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_assignments_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_assignments_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_evaluations: {
        Row: {
          comments: string | null
          created_at: string
          evaluator_id: string | null
          id: string
          points: number
          question_id: string | null
          rubric_scores: Json
          submission_id: string
        }
        Insert: {
          comments?: string | null
          created_at?: string
          evaluator_id?: string | null
          id?: string
          points?: number
          question_id?: string | null
          rubric_scores?: Json
          submission_id: string
        }
        Update: {
          comments?: string | null
          created_at?: string
          evaluator_id?: string | null
          id?: string
          points?: number
          question_id?: string | null
          rubric_scores?: Json
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_evaluations_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_evaluations_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "assessment_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_evaluations_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "assessment_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_options: {
        Row: {
          id: string
          is_correct: boolean
          label_ar: string
          label_en: string
          position: number
          question_id: string
        }
        Insert: {
          id?: string
          is_correct?: boolean
          label_ar: string
          label_en: string
          position?: number
          question_id: string
        }
        Update: {
          id?: string
          is_correct?: boolean
          label_ar?: string
          label_en?: string
          position?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "assessment_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_questions: {
        Row: {
          assessment_id: string
          config: Json
          created_at: string
          explanation_ar: string | null
          explanation_en: string | null
          id: string
          points: number
          position: number
          prompt_ar: string
          prompt_en: string
          rubric_id: string | null
          section_id: string | null
          type: Database["public"]["Enums"]["question_type"]
        }
        Insert: {
          assessment_id: string
          config?: Json
          created_at?: string
          explanation_ar?: string | null
          explanation_en?: string | null
          id?: string
          points?: number
          position?: number
          prompt_ar: string
          prompt_en: string
          rubric_id?: string | null
          section_id?: string | null
          type: Database["public"]["Enums"]["question_type"]
        }
        Update: {
          assessment_id?: string
          config?: Json
          created_at?: string
          explanation_ar?: string | null
          explanation_en?: string | null
          id?: string
          points?: number
          position?: number
          prompt_ar?: string
          prompt_en?: string
          rubric_id?: string | null
          section_id?: string | null
          type?: Database["public"]["Enums"]["question_type"]
        }
        Relationships: [
          {
            foreignKeyName: "assessment_questions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_questions_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "assessment_rubrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_questions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "assessment_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_rubrics: {
        Row: {
          assessment_id: string
          created_at: string
          criteria: Json
          id: string
          title_ar: string
          title_en: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          criteria?: Json
          id?: string
          title_ar: string
          title_en: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          criteria?: Json
          id?: string
          title_ar?: string
          title_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_rubrics_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_sections: {
        Row: {
          assessment_id: string
          id: string
          position: number
          title_ar: string
          title_en: string
        }
        Insert: {
          assessment_id: string
          id?: string
          position?: number
          title_ar: string
          title_en: string
        }
        Update: {
          assessment_id?: string
          id?: string
          position?: number
          title_ar?: string
          title_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_sections_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_submissions: {
        Row: {
          assignment_id: string
          auto_score: number
          candidate_feedback: string | null
          candidate_id: string
          evaluated_at: string | null
          feedback_shared: boolean
          id: string
          manual_score: number
          max_score: number
          needs_review: boolean
          percentage: number | null
          started_at: string
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          assignment_id: string
          auto_score?: number
          candidate_feedback?: string | null
          candidate_id: string
          evaluated_at?: string | null
          feedback_shared?: boolean
          id?: string
          manual_score?: number
          max_score?: number
          needs_review?: boolean
          percentage?: number | null
          started_at?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          auto_score?: number
          candidate_feedback?: string | null
          candidate_id?: string
          evaluated_at?: string | null
          feedback_shared?: boolean
          id?: string
          manual_score?: number
          max_score?: number
          needs_review?: boolean
          percentage?: number | null
          started_at?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "assessment_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_submissions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_templates: {
        Row: {
          assessment_id: string
          created_at: string
          id: string
          is_featured: boolean
          tags: string[]
        }
        Insert: {
          assessment_id: string
          created_at?: string
          id?: string
          is_featured?: boolean
          tags?: string[]
        }
        Update: {
          assessment_id?: string
          created_at?: string
          id?: string
          is_featured?: boolean
          tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "assessment_templates_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: true
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          ai_generated: boolean
          category: string
          company_id: string | null
          created_at: string
          created_by: string | null
          description_ar: string | null
          description_en: string | null
          difficulty: string
          duration_minutes: number
          id: string
          learning_outcomes_ar: string[]
          learning_outcomes_en: string[]
          passing_score: number
          reviewed_by: string | null
          slug: string | null
          status: string
          title_ar: string
          title_en: string
          updated_at: string
        }
        Insert: {
          ai_generated?: boolean
          category?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description_ar?: string | null
          description_en?: string | null
          difficulty?: string
          duration_minutes?: number
          id?: string
          learning_outcomes_ar?: string[]
          learning_outcomes_en?: string[]
          passing_score?: number
          reviewed_by?: string | null
          slug?: string | null
          status?: string
          title_ar: string
          title_en: string
          updated_at?: string
        }
        Update: {
          ai_generated?: boolean
          category?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description_ar?: string | null
          description_en?: string | null
          difficulty?: string
          duration_minutes?: number
          id?: string
          learning_outcomes_ar?: string[]
          learning_outcomes_en?: string[]
          passing_score?: number
          reviewed_by?: string | null
          slug?: string | null
          status?: string
          title_ar?: string
          title_en?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          company_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_certifications: {
        Row: {
          candidate_id: string
          created_at: string
          credential_url: string | null
          document_path: string | null
          expiry_date: string | null
          id: string
          issue_date: string | null
          issuer: string | null
          name: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          credential_url?: string | null
          document_path?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuer?: string | null
          name: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          credential_url?: string | null
          document_path?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuer?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_certifications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      candidate_documents: {
        Row: {
          bucket: string
          candidate_id: string
          created_at: string
          deleted_at: string | null
          file_name: string
          id: string
          is_primary: boolean
          kind: string
          label: string | null
          mime_type: string
          parse_status: string
          parsed_at: string | null
          parsed_data: Json | null
          size_bytes: number
          storage_path: string
          version: number
        }
        Insert: {
          bucket?: string
          candidate_id: string
          created_at?: string
          deleted_at?: string | null
          file_name: string
          id?: string
          is_primary?: boolean
          kind?: string
          label?: string | null
          mime_type: string
          parse_status?: string
          parsed_at?: string | null
          parsed_data?: Json | null
          size_bytes: number
          storage_path: string
          version?: number
        }
        Update: {
          bucket?: string
          candidate_id?: string
          created_at?: string
          deleted_at?: string | null
          file_name?: string
          id?: string
          is_primary?: boolean
          kind?: string
          label?: string | null
          mime_type?: string
          parse_status?: string
          parsed_at?: string | null
          parsed_data?: Json | null
          size_bytes?: number
          storage_path?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "candidate_documents_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      candidate_education: {
        Row: {
          candidate_id: string
          created_at: string
          degree: string
          description: string | null
          end_date: string | null
          field: string | null
          grade: string | null
          id: string
          institution: string
          start_date: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          degree: string
          description?: string | null
          end_date?: string | null
          field?: string | null
          grade?: string | null
          id?: string
          institution: string
          start_date?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          degree?: string
          description?: string | null
          end_date?: string | null
          field?: string | null
          grade?: string | null
          id?: string
          institution?: string
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_education_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      candidate_experience: {
        Row: {
          candidate_id: string
          company: string
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          is_current: boolean
          location: string | null
          start_date: string
          title: string
        }
        Insert: {
          candidate_id: string
          company: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean
          location?: string | null
          start_date: string
          title: string
        }
        Update: {
          candidate_id?: string
          company?: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean
          location?: string | null
          start_date?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_experience_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      candidate_preferences: {
        Row: {
          candidate_id: string
          desired_locations: string[]
          desired_roles: string[]
          employment_types: Database["public"]["Enums"]["employment_type"][]
          min_salary: number | null
          updated_at: string
          work_modes: Database["public"]["Enums"]["work_mode"][]
        }
        Insert: {
          candidate_id: string
          desired_locations?: string[]
          desired_roles?: string[]
          employment_types?: Database["public"]["Enums"]["employment_type"][]
          min_salary?: number | null
          updated_at?: string
          work_modes?: Database["public"]["Enums"]["work_mode"][]
        }
        Update: {
          candidate_id?: string
          desired_locations?: string[]
          desired_roles?: string[]
          employment_types?: Database["public"]["Enums"]["employment_type"][]
          min_salary?: number | null
          updated_at?: string
          work_modes?: Database["public"]["Enums"]["work_mode"][]
        }
        Relationships: [
          {
            foreignKeyName: "candidate_preferences_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: true
            referencedRelation: "candidate_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      candidate_profiles: {
        Row: {
          achievements: string[]
          career_interests: string[]
          city: string | null
          country: string | null
          created_at: string
          experience_level:
            | Database["public"]["Enums"]["experience_level"]
            | null
          headline: string | null
          languages: Json
          linkedin_url: string | null
          open_to_work: boolean
          portfolio_url: string | null
          summary: string | null
          updated_at: string
          user_id: string
          visibility: string
          years_experience: number | null
        }
        Insert: {
          achievements?: string[]
          career_interests?: string[]
          city?: string | null
          country?: string | null
          created_at?: string
          experience_level?:
            | Database["public"]["Enums"]["experience_level"]
            | null
          headline?: string | null
          languages?: Json
          linkedin_url?: string | null
          open_to_work?: boolean
          portfolio_url?: string | null
          summary?: string | null
          updated_at?: string
          user_id: string
          visibility?: string
          years_experience?: number | null
        }
        Update: {
          achievements?: string[]
          career_interests?: string[]
          city?: string | null
          country?: string | null
          created_at?: string
          experience_level?:
            | Database["public"]["Enums"]["experience_level"]
            | null
          headline?: string | null
          languages?: Json
          linkedin_url?: string | null
          open_to_work?: boolean
          portfolio_url?: string | null
          summary?: string | null
          updated_at?: string
          user_id?: string
          visibility?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_projects: {
        Row: {
          candidate_id: string
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          skills: string[]
          start_date: string | null
          title: string
          url: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          skills?: string[]
          start_date?: string | null
          title: string
          url?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          skills?: string[]
          start_date?: string | null
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_projects_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      candidate_skills: {
        Row: {
          candidate_id: string
          created_at: string
          evidence: string | null
          id: string
          level: number
          skill_id: string
          source: string
          years: number | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          evidence?: string | null
          id?: string
          level?: number
          skill_id: string
          source?: string
          years?: number | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          evidence?: string | null
          id?: string
          level?: number
          skill_id?: string
          source?: string
          years?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_skills_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "candidate_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      career_goals: {
        Row: {
          candidate_id: string
          created_at: string
          id: string
          status: string
          target_date: string | null
          target_level: Database["public"]["Enums"]["experience_level"]
          target_role_ar: string
          target_role_en: string
          target_role_slug: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          id?: string
          status?: string
          target_date?: string | null
          target_level?: Database["public"]["Enums"]["experience_level"]
          target_role_ar: string
          target_role_en: string
          target_role_slug: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          id?: string
          status?: string
          target_date?: string | null
          target_level?: Database["public"]["Enums"]["experience_level"]
          target_role_ar?: string
          target_role_en?: string
          target_role_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "career_goals_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      career_profiles: {
        Row: {
          candidate_id: string
          current_level: Database["public"]["Enums"]["experience_level"] | null
          current_title: string | null
          summary: string | null
          updated_at: string
        }
        Insert: {
          candidate_id: string
          current_level?: Database["public"]["Enums"]["experience_level"] | null
          current_title?: string | null
          summary?: string | null
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          current_level?: Database["public"]["Enums"]["experience_level"] | null
          current_title?: string | null
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "career_profiles_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_invitations: {
        Row: {
          accepted_at: string | null
          company_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["membership_role"]
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          company_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["membership_role"]
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["membership_role"]
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_memberships: {
        Row: {
          company_id: string
          created_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["membership_role"]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["membership_role"]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["membership_role"]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_memberships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_memberships_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          city: string | null
          contact_email: string | null
          contact_phone: string | null
          country: string
          created_at: string
          created_by: string | null
          description_ar: string | null
          description_en: string | null
          id: string
          industry: string
          is_demo: boolean
          logo_path: string | null
          name_ar: string
          name_en: string
          size_range: string | null
          slug: string
          status: Database["public"]["Enums"]["company_status"]
          status_reason: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          industry: string
          is_demo?: boolean
          logo_path?: string | null
          name_ar: string
          name_en: string
          size_range?: string | null
          slug: string
          status?: Database["public"]["Enums"]["company_status"]
          status_reason?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          industry?: string
          is_demo?: boolean
          logo_path?: string | null
          name_ar?: string
          name_en?: string
          size_range?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["company_status"]
          status_reason?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_profiles_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_verification_requests: {
        Row: {
          commercial_registration: string | null
          company_id: string
          created_at: string
          document_paths: string[]
          id: string
          notes: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_notes: string | null
          status: string
          submitted_by: string | null
        }
        Insert: {
          commercial_registration?: string | null
          company_id: string
          created_at?: string
          document_paths?: string[]
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: string
          submitted_by?: string | null
        }
        Update: {
          commercial_registration?: string | null
          company_id?: string
          created_at?: string
          document_paths?: string[]
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: string
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_verification_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_verification_requests_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_verification_requests_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      development_plan_items: {
        Row: {
          completed_at: string | null
          description_ar: string | null
          description_en: string | null
          estimated_hours: number | null
          id: string
          kind: string
          plan_id: string
          position: number
          resource_id: string | null
          skill_slug: string | null
          status: Database["public"]["Enums"]["progress_status"]
          title_ar: string
          title_en: string
        }
        Insert: {
          completed_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          estimated_hours?: number | null
          id?: string
          kind?: string
          plan_id: string
          position?: number
          resource_id?: string | null
          skill_slug?: string | null
          status?: Database["public"]["Enums"]["progress_status"]
          title_ar: string
          title_en: string
        }
        Update: {
          completed_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          estimated_hours?: number | null
          id?: string
          kind?: string
          plan_id?: string
          position?: number
          resource_id?: string | null
          skill_slug?: string | null
          status?: Database["public"]["Enums"]["progress_status"]
          title_ar?: string
          title_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_plan_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "development_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_plan_items_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "learning_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      development_plans: {
        Row: {
          candidate_id: string | null
          created_at: string
          current_level: Database["public"]["Enums"]["experience_level"] | null
          description_ar: string | null
          description_en: string | null
          estimated_weeks: number
          goal_id: string | null
          id: string
          is_template: boolean
          required_skill_slugs: string[]
          role_slug: string
          status: string
          target_level: Database["public"]["Enums"]["experience_level"]
          title_ar: string
          title_en: string
          updated_at: string
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string
          current_level?: Database["public"]["Enums"]["experience_level"] | null
          description_ar?: string | null
          description_en?: string | null
          estimated_weeks?: number
          goal_id?: string | null
          id?: string
          is_template?: boolean
          required_skill_slugs?: string[]
          role_slug: string
          status?: string
          target_level?: Database["public"]["Enums"]["experience_level"]
          title_ar: string
          title_en: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string | null
          created_at?: string
          current_level?: Database["public"]["Enums"]["experience_level"] | null
          description_ar?: string | null
          description_en?: string | null
          estimated_weeks?: number
          goal_id?: string | null
          id?: string
          is_template?: boolean
          required_skill_slugs?: string[]
          role_slug?: string
          status?: string
          target_level?: Database["public"]["Enums"]["experience_level"]
          title_ar?: string
          title_en?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_plans_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_plans_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "career_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_evaluations: {
        Row: {
          comments: string | null
          concerns: string | null
          id: string
          interview_id: string
          interviewer_id: string
          ratings: Json
          recommendation: Database["public"]["Enums"]["recommendation"]
          strengths: string | null
          submitted_at: string
        }
        Insert: {
          comments?: string | null
          concerns?: string | null
          id?: string
          interview_id: string
          interviewer_id: string
          ratings?: Json
          recommendation: Database["public"]["Enums"]["recommendation"]
          strengths?: string | null
          submitted_at?: string
        }
        Update: {
          comments?: string | null
          concerns?: string | null
          id?: string
          interview_id?: string
          interviewer_id?: string
          ratings?: Json
          recommendation?: Database["public"]["Enums"]["recommendation"]
          strengths?: string | null
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_evaluations_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_evaluations_interviewer_id_fkey"
            columns: ["interviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_feedback: {
        Row: {
          application_id: string
          author_id: string | null
          body: string
          created_at: string
          id: string
          interview_id: string
          shared_at: string | null
          shared_with_candidate: boolean
        }
        Insert: {
          application_id: string
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          interview_id: string
          shared_at?: string | null
          shared_with_candidate?: boolean
        }
        Update: {
          application_id?: string
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          interview_id?: string
          shared_at?: string | null
          shared_with_candidate?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "interview_feedback_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_feedback_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_feedback_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_participants: {
        Row: {
          id: string
          interview_id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          interview_id: string
          role?: string
          user_id: string
        }
        Update: {
          id?: string
          interview_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_participants_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_questions: {
        Row: {
          ai_generated: boolean
          id: string
          interview_id: string
          kind: string
          position: number
          question: string
        }
        Insert: {
          ai_generated?: boolean
          id?: string
          interview_id: string
          kind?: string
          position?: number
          question: string
        }
        Update: {
          ai_generated?: boolean
          id?: string
          interview_id?: string
          kind?: string
          position?: number
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_questions_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          application_id: string
          company_id: string
          created_at: string
          created_by: string | null
          duration_minutes: number
          id: string
          instructions: string | null
          location: string | null
          meeting_url: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["interview_status"]
          timezone: string
          title: string
          type: Database["public"]["Enums"]["interview_type"]
          updated_at: string
        }
        Insert: {
          application_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          id?: string
          instructions?: string | null
          location?: string | null
          meeting_url?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["interview_status"]
          timezone?: string
          title?: string
          type?: Database["public"]["Enums"]["interview_type"]
          updated_at?: string
        }
        Update: {
          application_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          id?: string
          instructions?: string | null
          location?: string | null
          meeting_url?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["interview_status"]
          timezone?: string
          title?: string
          type?: Database["public"]["Enums"]["interview_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_application_questions: {
        Row: {
          id: string
          is_required: boolean
          job_id: string
          position: number
          question_ar: string
          question_en: string
        }
        Insert: {
          id?: string
          is_required?: boolean
          job_id: string
          position?: number
          question_ar: string
          question_en: string
        }
        Update: {
          id?: string
          is_required?: boolean
          job_id?: string
          position?: number
          question_ar?: string
          question_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_application_questions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_categories: {
        Row: {
          id: string
          name_ar: string
          name_en: string
          slug: string
        }
        Insert: {
          id?: string
          name_ar: string
          name_en: string
          slug: string
        }
        Update: {
          id?: string
          name_ar?: string
          name_en?: string
          slug?: string
        }
        Relationships: []
      }
      job_requirements: {
        Row: {
          id: string
          is_mandatory: boolean
          job_id: string
          kind: string
          position: number
          text_ar: string
          text_en: string
        }
        Insert: {
          id?: string
          is_mandatory?: boolean
          job_id: string
          kind?: string
          position?: number
          text_ar: string
          text_en: string
        }
        Update: {
          id?: string
          is_mandatory?: boolean
          job_id?: string
          kind?: string
          position?: number
          text_ar?: string
          text_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_requirements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_skills: {
        Row: {
          id: string
          importance: string
          job_id: string
          min_level: number
          skill_id: string
        }
        Insert: {
          id?: string
          importance?: string
          job_id: string
          min_level?: number
          skill_id: string
        }
        Update: {
          id?: string
          importance?: string
          job_id?: string
          min_level?: number
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_skills_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          ai_assisted: boolean
          assessment_id: string | null
          category_id: string | null
          city: string
          company_id: string
          created_at: string
          created_by: string | null
          deadline: string | null
          description_ar: string
          description_en: string
          education_level: string | null
          employment_type: Database["public"]["Enums"]["employment_type"]
          experience_level: Database["public"]["Enums"]["experience_level"]
          id: string
          min_years: number
          openings: number
          published_at: string | null
          qualifications_ar: string[]
          qualifications_en: string[]
          responsibilities_ar: string[]
          responsibilities_en: string[]
          salary_currency: string
          salary_max: number | null
          salary_min: number | null
          salary_visible: boolean
          status: Database["public"]["Enums"]["job_status"]
          title_ar: string
          title_en: string
          updated_at: string
          work_mode: Database["public"]["Enums"]["work_mode"]
        }
        Insert: {
          ai_assisted?: boolean
          assessment_id?: string | null
          category_id?: string | null
          city: string
          company_id: string
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description_ar?: string
          description_en?: string
          education_level?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          experience_level?: Database["public"]["Enums"]["experience_level"]
          id?: string
          min_years?: number
          openings?: number
          published_at?: string | null
          qualifications_ar?: string[]
          qualifications_en?: string[]
          responsibilities_ar?: string[]
          responsibilities_en?: string[]
          salary_currency?: string
          salary_max?: number | null
          salary_min?: number | null
          salary_visible?: boolean
          status?: Database["public"]["Enums"]["job_status"]
          title_ar: string
          title_en: string
          updated_at?: string
          work_mode?: Database["public"]["Enums"]["work_mode"]
        }
        Update: {
          ai_assisted?: boolean
          assessment_id?: string | null
          category_id?: string | null
          city?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description_ar?: string
          description_en?: string
          education_level?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          experience_level?: Database["public"]["Enums"]["experience_level"]
          id?: string
          min_years?: number
          openings?: number
          published_at?: string | null
          qualifications_ar?: string[]
          qualifications_en?: string[]
          responsibilities_ar?: string[]
          responsibilities_en?: string[]
          salary_currency?: string
          salary_max?: number | null
          salary_min?: number | null
          salary_visible?: boolean
          status?: Database["public"]["Enums"]["job_status"]
          title_ar?: string
          title_en?: string
          updated_at?: string
          work_mode?: Database["public"]["Enums"]["work_mode"]
        }
        Relationships: [
          {
            foreignKeyName: "jobs_assessment_fk"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "job_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_progress: {
        Row: {
          candidate_id: string
          id: string
          progress_percent: number
          resource_id: string
          status: Database["public"]["Enums"]["progress_status"]
          updated_at: string
        }
        Insert: {
          candidate_id: string
          id?: string
          progress_percent?: number
          resource_id: string
          status?: Database["public"]["Enums"]["progress_status"]
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          id?: string
          progress_percent?: number
          resource_id?: string
          status?: Database["public"]["Enums"]["progress_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_progress_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_progress_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "learning_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_resources: {
        Row: {
          created_at: string
          duration_hours: number | null
          id: string
          is_active: boolean
          is_free: boolean
          kind: string
          language: string
          level: string
          link_verified_at: string | null
          provider: string
          skill_slugs: string[]
          slug: string
          title_ar: string
          title_en: string
          topic: string
          url: string
        }
        Insert: {
          created_at?: string
          duration_hours?: number | null
          id?: string
          is_active?: boolean
          is_free?: boolean
          kind?: string
          language?: string
          level?: string
          link_verified_at?: string | null
          provider: string
          skill_slugs?: string[]
          slug: string
          title_ar: string
          title_en: string
          topic: string
          url: string
        }
        Update: {
          created_at?: string
          duration_hours?: number | null
          id?: string
          is_active?: boolean
          is_free?: boolean
          kind?: string
          language?: string
          level?: string
          link_verified_at?: string | null
          provider?: string
          skill_slugs?: string[]
          slug?: string
          title_ar?: string
          title_en?: string
          topic?: string
          url?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          email_enabled: boolean
          in_app_enabled: boolean
          muted_kinds: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          email_enabled?: boolean
          in_app_enabled?: boolean
          muted_kinds?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          email_enabled?: boolean
          in_app_enabled?: boolean
          muted_kinds?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body_ar: string | null
          body_en: string | null
          created_at: string
          email_status: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title_ar: string
          title_en: string
          user_id: string
        }
        Insert: {
          body_ar?: string | null
          body_en?: string | null
          created_at?: string
          email_status?: string
          id?: string
          kind: string
          link?: string | null
          read_at?: string | null
          title_ar: string
          title_en: string
          user_id: string
        }
        Update: {
          body_ar?: string | null
          body_en?: string | null
          created_at?: string
          email_status?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title_ar?: string
          title_en?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string
          avatar_path: string | null
          consent_accepted_at: string | null
          created_at: string
          deactivation_requested_at: string | null
          email: string
          full_name: string
          id: string
          is_demo: boolean
          locale: string
          onboarding_completed: boolean
          phone: string | null
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
        Insert: {
          account_type?: string
          avatar_path?: string | null
          consent_accepted_at?: string | null
          created_at?: string
          deactivation_requested_at?: string | null
          email: string
          full_name?: string
          id: string
          is_demo?: boolean
          locale?: string
          onboarding_completed?: boolean
          phone?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Update: {
          account_type?: string
          avatar_path?: string | null
          consent_accepted_at?: string | null
          created_at?: string
          deactivation_requested_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_demo?: boolean
          locale?: string
          onboarding_completed?: boolean
          phone?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          data: Json
          generated_by: string | null
          id: string
          kind: string
          params: Json
          title: string
        }
        Insert: {
          created_at?: string
          data?: Json
          generated_by?: string | null
          id?: string
          kind: string
          params?: Json
          title: string
        }
        Update: {
          created_at?: string
          data?: Json
          generated_by?: string | null
          id?: string
          kind?: string
          params?: Json
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_jobs: {
        Row: {
          candidate_id: string
          created_at: string
          job_id: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          job_id: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_jobs_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_categories: {
        Row: {
          created_at: string
          id: string
          name_ar: string
          name_en: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name_ar: string
          name_en: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name_ar?: string
          name_en?: string
          slug?: string
        }
        Relationships: []
      }
      skill_gap_analyses: {
        Row: {
          analysis: Json
          candidate_id: string
          created_at: string
          goal_id: string | null
          id: string
          method: string
          provider: string | null
        }
        Insert: {
          analysis: Json
          candidate_id: string
          created_at?: string
          goal_id?: string | null
          id?: string
          method?: string
          provider?: string | null
        }
        Update: {
          analysis?: Json
          candidate_id?: string
          created_at?: string
          goal_id?: string | null
          id?: string
          method?: string
          provider?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "skill_gap_analyses_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_gap_analyses_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "career_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          aliases: string[]
          category_id: string | null
          created_at: string
          id: string
          kind: string
          name_ar: string
          name_en: string
          slug: string
        }
        Insert: {
          aliases?: string[]
          category_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          name_ar: string
          name_en: string
          slug: string
        }
        Update: {
          aliases?: string[]
          category_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          name_ar?: string
          name_en?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "skills_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "skill_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
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
      related_skills: {
        Args: { p_have: string[]; p_min?: number; p_model: string; p_required: string[] }
        Returns: { related_skill_id: string; required_skill_id: string; similarity: number }[]
      }
      semantic_fit: {
        Args: { p_candidate: string; p_job: string; p_model: string }
        Returns: number
      }
      semantic_job_ranking: {
        Args: { p_limit?: number; p_model: string }
        Returns: { job_id: string; similarity: number }[]
      }
      _transition_application: {
        Args: {
          p_app: string
          p_candidate_message: string
          p_reason: string
          p_to: Database["public"]["Enums"]["application_status"]
        }
        Returns: undefined
      }
      accept_company_invitation: {
        Args: { p_invitation: string }
        Returns: string
      }
      admin_grant_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"]
          p_user: string
        }
        Returns: undefined
      }
      admin_platform_stats: { Args: never; Returns: Json }
      admin_revoke_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"]
          p_user: string
        }
        Returns: undefined
      }
      admin_set_membership: {
        Args: {
          p_active: boolean
          p_company: string
          p_role: Database["public"]["Enums"]["membership_role"]
          p_user: string
        }
        Returns: undefined
      }
      admin_set_user_status: {
        Args: {
          p_reason?: string
          p_status: Database["public"]["Enums"]["account_status"]
          p_user: string
        }
        Returns: undefined
      }
      application_transition_allowed: {
        Args: {
          p_from: Database["public"]["Enums"]["application_status"]
          p_to: Database["public"]["Enums"]["application_status"]
        }
        Returns: boolean
      }
      apply_to_job: {
        Args: {
          p_answers?: Json
          p_cover_letter?: string
          p_cv_document: string
          p_job: string
        }
        Returns: string
      }
      assign_assessment: {
        Args: { p_application: string; p_assessment: string; p_due_at?: string }
        Returns: string
      }
      can_manage_assessment: {
        Args: { p_assessment: string }
        Returns: boolean
      }
      can_manage_job: { Args: { p_job: string }; Returns: boolean }
      can_read_storage_object: {
        Args: { p_bucket: string; p_name: string }
        Returns: boolean
      }
      can_recruit: { Args: { p_company: string }; Returns: boolean }
      can_recruit_application: { Args: { p_app: string }; Returns: boolean }
      can_view_application: { Args: { p_app: string }; Returns: boolean }
      can_view_assessment: { Args: { p_assessment: string }; Returns: boolean }
      can_view_assessment_content: {
        Args: { p_assessment: string }
        Returns: boolean
      }
      can_view_candidate: { Args: { p_candidate: string }; Returns: boolean }
      can_view_document: { Args: { p_doc: string }; Returns: boolean }
      can_view_job: { Args: { p_job: string }; Returns: boolean }
      can_write_storage_object: {
        Args: { p_bucket: string; p_name: string }
        Returns: boolean
      }
      change_application_status: {
        Args: {
          p_app: string
          p_candidate_message?: string
          p_reason?: string
          p_to: Database["public"]["Enums"]["application_status"]
        }
        Returns: undefined
      }
      company_dashboard_stats: { Args: { p_company: string }; Returns: Json }
      create_company: {
        Args: {
          p_city: string
          p_contact_email: string
          p_contact_phone: string
          p_description_ar: string
          p_description_en: string
          p_industry: string
          p_name_ar: string
          p_name_en: string
          p_size: string
          p_website: string
        }
        Returns: string
      }
      create_interview: {
        Args: {
          p_application: string
          p_duration: number
          p_instructions: string
          p_interviewers: string[]
          p_location: string
          p_meeting_url: string
          p_scheduled_at: string
          p_timezone: string
          p_title: string
          p_type: Database["public"]["Enums"]["interview_type"]
        }
        Returns: string
      }
      evaluate_assessment_answer: {
        Args: {
          p_comments?: string
          p_points: number
          p_question: string
          p_rubric_scores?: Json
          p_submission: string
        }
        Returns: undefined
      }
      get_application_timeline: {
        Args: { p_app: string }
        Returns: {
          candidate_message: string
          created_at: string
          to_status: Database["public"]["Enums"]["application_status"]
        }[]
      }
      get_assessment_result: { Args: { p_assignment: string }; Returns: Json }
      has_company_role: {
        Args: {
          p_company: string
          p_roles?: Database["public"]["Enums"]["membership_role"][]
        }
        Returns: boolean
      }
      invite_company_member: {
        Args: {
          p_company: string
          p_email: string
          p_role: Database["public"]["Enums"]["membership_role"]
        }
        Returns: string
      }
      is_active_user: { Args: never; Returns: boolean }
      is_company_approved: { Args: { p_company: string }; Returns: boolean }
      is_interview_participant: {
        Args: { p_interview: string }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      notify: {
        Args: {
          p_body_ar?: string
          p_body_en?: string
          p_kind: string
          p_link?: string
          p_title_ar: string
          p_title_en: string
          p_user: string
        }
        Returns: undefined
      }
      notify_company_recruiters: {
        Args: {
          p_body_ar: string
          p_body_en: string
          p_company: string
          p_kind: string
          p_link: string
          p_title_ar: string
          p_title_en: string
        }
        Returns: undefined
      }
      review_company: {
        Args: { p_company: string; p_decision: string; p_notes?: string }
        Returns: undefined
      }
      save_assessment_answer: {
        Args: {
          p_assignment: string
          p_file_path?: string
          p_question: string
          p_selected?: string[]
          p_text?: string
        }
        Returns: string
      }
      set_interview_status: {
        Args: {
          p_interview: string
          p_new_time?: string
          p_status: Database["public"]["Enums"]["interview_status"]
        }
        Returns: undefined
      }
      share_assessment_feedback: {
        Args: { p_feedback: string; p_submission: string }
        Returns: undefined
      }
      share_interview_feedback: {
        Args: { p_feedback: string; p_share: boolean }
        Returns: undefined
      }
      shares_company_with: { Args: { p_user: string }; Returns: boolean }
      start_assessment: { Args: { p_assignment: string }; Returns: Json }
      status_label: {
        Args: {
          p_lang: string
          p_status: Database["public"]["Enums"]["application_status"]
        }
        Returns: string
      }
      submit_assessment: { Args: { p_assignment: string }; Returns: Json }
      submit_company_verification: {
        Args: {
          p_commercial_registration: string
          p_company: string
          p_document_paths: string[]
          p_notes: string
        }
        Returns: string
      }
      update_company_member: {
        Args: {
          p_active: boolean
          p_membership: string
          p_role: Database["public"]["Enums"]["membership_role"]
        }
        Returns: undefined
      }
      withdraw_application: {
        Args: { p_app: string; p_reason?: string }
        Returns: undefined
      }
      write_audit: {
        Args: {
          p_action: string
          p_company?: string
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
        }
        Returns: undefined
      }
    }
    Enums: {
      account_status: "active" | "suspended" | "deactivated"
      app_role:
        | "super_admin"
        | "company_admin"
        | "recruiter"
        | "interviewer"
        | "candidate"
      application_status:
        | "submitted"
        | "under_review"
        | "assessment_pending"
        | "assessment_completed"
        | "shortlisted"
        | "interview_scheduled"
        | "interview_completed"
        | "hired"
        | "rejected"
        | "withdrawn"
      assignment_status:
        | "assigned"
        | "in_progress"
        | "submitted"
        | "evaluated"
        | "expired"
        | "cancelled"
      company_status:
        | "pending"
        | "info_requested"
        | "approved"
        | "rejected"
        | "suspended"
      employment_type:
        | "full_time"
        | "part_time"
        | "contract"
        | "internship"
        | "temporary"
      experience_level: "entry" | "junior" | "mid" | "senior" | "lead"
      interview_status: "scheduled" | "completed" | "cancelled"
      interview_type:
        | "phone"
        | "video"
        | "onsite"
        | "technical"
        | "behavioral"
        | "panel"
      job_status: "draft" | "published" | "paused" | "closed" | "archived"
      membership_role: "company_admin" | "recruiter" | "interviewer"
      progress_status: "not_started" | "in_progress" | "completed"
      question_type:
        | "multiple_choice"
        | "multiple_select"
        | "true_false"
        | "short_answer"
        | "long_answer"
        | "coding"
        | "sql"
        | "case_study"
        | "file_upload"
      recommendation: "strong_yes" | "yes" | "neutral" | "no" | "strong_no"
      work_mode: "onsite" | "remote" | "hybrid"
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
      account_status: ["active", "suspended", "deactivated"],
      app_role: [
        "super_admin",
        "company_admin",
        "recruiter",
        "interviewer",
        "candidate",
      ],
      application_status: [
        "submitted",
        "under_review",
        "assessment_pending",
        "assessment_completed",
        "shortlisted",
        "interview_scheduled",
        "interview_completed",
        "hired",
        "rejected",
        "withdrawn",
      ],
      assignment_status: [
        "assigned",
        "in_progress",
        "submitted",
        "evaluated",
        "expired",
        "cancelled",
      ],
      company_status: [
        "pending",
        "info_requested",
        "approved",
        "rejected",
        "suspended",
      ],
      employment_type: [
        "full_time",
        "part_time",
        "contract",
        "internship",
        "temporary",
      ],
      experience_level: ["entry", "junior", "mid", "senior", "lead"],
      interview_status: ["scheduled", "completed", "cancelled"],
      interview_type: [
        "phone",
        "video",
        "onsite",
        "technical",
        "behavioral",
        "panel",
      ],
      job_status: ["draft", "published", "paused", "closed", "archived"],
      membership_role: ["company_admin", "recruiter", "interviewer"],
      progress_status: ["not_started", "in_progress", "completed"],
      question_type: [
        "multiple_choice",
        "multiple_select",
        "true_false",
        "short_answer",
        "long_answer",
        "coding",
        "sql",
        "case_study",
        "file_upload",
      ],
      recommendation: ["strong_yes", "yes", "neutral", "no", "strong_no"],
      work_mode: ["onsite", "remote", "hybrid"],
    },
  },
} as const
