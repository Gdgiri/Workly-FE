import api from './api';

export interface ReconciliationAudit {
    id: string;
    authId: string;
    adminId: string;
    attemptTimestamp: string;
    attemptType: 'CALCULATE' | 'SAVE' | 'UPDATE' | 'DELETE';
    attemptStatus: 'SUCCESS' | 'FAILED' | 'PARTIAL';
    errorMessage?: string;
    errorCode?: string;
    inputData: any;
    calculatedResults: any;
    discrepancyAmount?: number;
    discrepancyType?: 'OVER' | 'SHORT' | 'BALANCED';
    reconciliationId?: string;
    reconciliation?: {
        id: string;
        date: string;
        status: string;
        difference: number;
    };
    userName?: string;
    userRole?: string;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    requestId?: string;
    duration?: number;
    createdAt: string;
    updatedAt: string;
}

export interface AuditLogsResponse {
    success: boolean;
    logs: ReconciliationAudit[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface AuditStatsResponse {
    success: boolean;
    stats: {
        totalAttempts: number;
        successfulAttempts: number;
        failedAttempts: number;
        partialAttempts: number;
        uniqueUsers: number;
        attemptsByUser: Array<{
            authId: string;
            userName: string;
            count: number;
        }>;
        attemptsByDay: Array<{
            date: string;
            total: number;
            successful: number;
            failed: number;
        }>;
    };
}

export interface AuditFilters {
    from?: string; // ISO date string
    to?: string; // ISO date string
    authId?: string;
    attemptType?: 'CALCULATE' | 'SAVE' | 'UPDATE' | 'DELETE';
    attemptStatus?: 'SUCCESS' | 'FAILED' | 'PARTIAL';
    page?: number;
    limit?: number;
}

class ReconciliationAuditService {
    /**
     * Get audit logs with optional filters
     */
    async getAuditLogs(filters?: AuditFilters): Promise<AuditLogsResponse> {
        const params = new URLSearchParams();

        if (filters?.from) params.append('from', filters.from);
        if (filters?.to) params.append('to', filters.to);
        if (filters?.authId) params.append('authId', filters.authId);
        if (filters?.attemptType) params.append('attemptType', filters.attemptType);
        if (filters?.attemptStatus) params.append('attemptStatus', filters.attemptStatus);
        if (filters?.page) params.append('page', filters.page.toString());
        if (filters?.limit) params.append('limit', filters.limit.toString());

        const response = await api.get(`/reconciliation-audits?${params.toString()}`);
        return response.data;
    }

    /**
     * Get audit statistics
     */
    async getAuditStats(dateRange?: { from: string; to: string }): Promise<AuditStatsResponse> {
        const params = new URLSearchParams();

        if (dateRange?.from) params.append('from', dateRange.from);
        if (dateRange?.to) params.append('to', dateRange.to);

        const response = await api.get(`/reconciliation-audits/stats?${params.toString()}`);
        return response.data;
    }

    /**
     * Get audit history for a specific reconciliation
     */
    async getReconciliationHistory(reconciliationId: string): Promise<{
        success: boolean;
        history: ReconciliationAudit[];
    }> {
        const response = await api.get(`/reconciliation-audits/reconciliation/${reconciliationId}`);
        return response.data;
    }
}

export default new ReconciliationAuditService();
