export type Database = {
  public: {
    Tables: {
      surveys: {
        Row: {
          id: string;
          title: string;
          intro: string | null;
          guide: string | null;
          status: 'draft'|'active'|'inactive'|'archived';
          created_by: string;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          title: string;
          intro?: string | null;
          guide?: string | null;
          status?: 'draft'|'active'|'inactive'|'archived';
          created_by: string;
        };
        Update: {
          title?: string;
          intro?: string | null;
          guide?: string | null;
          status?: 'draft'|'active'|'inactive'|'archived';
          created_by?: string;
          updated_at?: string | null;
        };
      };
      // thêm các bảng khác khi cần
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
};
