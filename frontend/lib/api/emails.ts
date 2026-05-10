import { client } from "./client";
import type {
  AdminEmailQueueItem,
  EmailPreviewResponse,
  EmailRule,
  EmailRuleWritePayload,
  EmailTemplate,
  EmailTemplateWritePayload,
  EmailThreadItem,
  EmailStatus,
  ScheduledEmail,
  UserEmailCredential,
} from "./types";

export const emails = {
  // ── Templates ──────────────────────────────────────────────
  async listTemplates(params?: { active_only?: boolean }) {
    const { data } = await client.get<EmailTemplate[]>("/api/email-templates/", { params });
    return data;
  },

  async createTemplate(payload: EmailTemplateWritePayload) {
    const { data } = await client.post<EmailTemplate>("/api/email-templates/", payload);
    return data;
  },

  async updateTemplate(id: number, payload: Partial<EmailTemplateWritePayload>) {
    const { data } = await client.patch<EmailTemplate>(`/api/email-templates/${id}/`, payload);
    return data;
  },

  async deleteTemplate(id: number) {
    await client.delete(`/api/email-templates/${id}/`);
  },

  async previewTemplate(id: number, leadId: string): Promise<EmailPreviewResponse> {
    const { data } = await client.post<EmailPreviewResponse>(
      `/api/email-templates/${id}/preview/`,
      { lead_id: leadId },
    );
    return data;
  },

  // ── Rules ──────────────────────────────────────────────────
  async listRules(params?: { trigger_status?: string; active_only?: boolean }) {
    const { data } = await client.get<EmailRule[]>("/api/email-rules/", { params });
    return data;
  },

  async createRule(payload: EmailRuleWritePayload) {
    const { data } = await client.post<EmailRule>("/api/email-rules/", payload);
    return data;
  },

  async updateRule(id: number, payload: Partial<EmailRuleWritePayload>) {
    const { data } = await client.patch<EmailRule>(`/api/email-rules/${id}/`, payload);
    return data;
  },

  async deleteRule(id: number) {
    await client.delete(`/api/email-rules/${id}/`);
  },

  // ── Per-lead email queue ───────────────────────────────────
  async listLeadEmails(leadId: string) {
    const { data } = await client.get<ScheduledEmail[]>(`/api/leads/${leadId}/emails/`);
    return data;
  },

  async sendToLead(leadId: string, payload: { template_id: number; delay_hours?: number }) {
    const { data } = await client.post<ScheduledEmail>(
      `/api/leads/${leadId}/emails/`,
      payload,
    );
    return data;
  },

  async cancelEmail(leadId: string, emailId: string) {
    const { data } = await client.post<ScheduledEmail>(
      `/api/leads/${leadId}/emails/${emailId}/cancel/`,
    );
    return data;
  },

  async getThread(leadId: string) {
    const { data } = await client.get<EmailThreadItem[]>(
      `/api/leads/${leadId}/emails/thread/`,
    );
    return data;
  },

  // ── Credentials ────────────────────────────────────────────
  async listCredentials() {
    const { data } = await client.get<UserEmailCredential[]>("/api/email-credentials/");
    return data;
  },

  async createCredential(payload: { user: number; zoho_email: string; app_password: string; is_active?: boolean }) {
    const { data } = await client.post<UserEmailCredential>("/api/email-credentials/", payload);
    return data;
  },

  async updateCredential(id: number, payload: { zoho_email?: string; app_password?: string; is_active?: boolean }) {
    const { data } = await client.patch<UserEmailCredential>(`/api/email-credentials/${id}/`, payload);
    return data;
  },

  async deleteCredential(id: number) {
    await client.delete(`/api/email-credentials/${id}/`);
  },

  async getMyCredential() {
    const { data } = await client.get<UserEmailCredential>("/api/email-credentials/me/");
    return data;
  },

  async updateMyCredential(payload: { zoho_email?: string; app_password?: string }) {
    const { data } = await client.patch<UserEmailCredential>("/api/email-credentials/me/", payload);
    return data;
  },

  // ── Admin email queue ──────────────────────────────────────
  async getEmailQueue(params?: { status?: EmailStatus[]; assigned_to?: number }) {
    const { data } = await client.get<AdminEmailQueueItem[]>("/api/admin/email-queue/", {
      params: {
        ...(params?.status?.length ? { status: params.status } : {}),
        ...(params?.assigned_to !== undefined ? { assigned_to: params.assigned_to } : {}),
      },
      // axios serialises repeated keys as status[]=... by default; backend expects status=PENDING&status=SENT
      paramsSerializer: (p) => {
        const parts: string[] = [];
        for (const [k, v] of Object.entries(p)) {
          if (Array.isArray(v)) v.forEach((s) => parts.push(`${k}=${encodeURIComponent(s)}`));
          else parts.push(`${k}=${encodeURIComponent(String(v))}`);
        }
        return parts.join("&");
      },
    });
    return data;
  },
};
