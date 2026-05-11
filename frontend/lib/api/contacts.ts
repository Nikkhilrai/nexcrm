import { client, cursorPath } from "./client";
import type {
  BulkUploadResponse,
  Contact,
  ContactListParams,
  ContactWritePayload,
  PaginatedResponse,
} from "./types";

/**
 * /api/contacts/ — list/retrieve open to any auth (LeadForm picker uses search);
 * write actions and the Excel admin tools (`bulkUpload`, `downloadTemplate`)
 * are admin-only and will 403 for non-admin callers.
 */
export const contacts = {
  async list(params?: ContactListParams) {
    const { data } = await client.get<PaginatedResponse<Contact>>("/api/contacts/", {
      params,
    });
    return data;
  },

  /** Follow the cursor `next` URL returned by `list()`. */
  async listNext(url: string) {
    const { data } = await client.get<PaginatedResponse<Contact>>(cursorPath(url));
    return data;
  },

  async get(id: number) {
    const { data } = await client.get<Contact>(`/api/contacts/${id}/`);
    return data;
  },

  async create(payload: ContactWritePayload) {
    const { data } = await client.post<Contact>("/api/contacts/", payload);
    return data;
  },

  async update(id: number, payload: Partial<ContactWritePayload>) {
    const { data } = await client.patch<Contact>(`/api/contacts/${id}/`, payload);
    return data;
  },

  async remove(id: number) {
    await client.delete(`/api/contacts/${id}/`);
  },

  async bulkUpload(file: File, opts?: { dryRun?: boolean }) {
    const form = new FormData();
    form.append("file", file);
    // The shared axios client has a default `Content-Type: application/json`
    // that would otherwise override the browser's automatic multipart
    // boundary. Setting it to undefined lets axios + the browser write
    // the correct `multipart/form-data; boundary=...` header for us.
    const { data } = await client.post<BulkUploadResponse>(
      "/api/contacts/bulk-upload/",
      form,
      {
        headers: { "Content-Type": undefined },
        params: opts?.dryRun ? { dry_run: 1 } : undefined,
      },
    );
    return data;
  },

  /** Triggers a browser download of the canonical .xlsx template. */
  async downloadTemplate() {
    const response = await client.get("/api/contacts/template/", {
      responseType: "blob",
    });
    const blob = response.data as Blob;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contacts_template.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
