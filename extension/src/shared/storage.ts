// User type matching backend sanitizeUser() response
export interface StoredUser {
  id: string;
  email: string;
  subscriptionStatus: string;
  trialEndsAt?: string | null;
  emailVerified?: boolean;
  organizationId: string | null;
}

export interface StoredAuth {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  user: StoredUser;
  expiresAt: number;
}

export interface StoredPreferences {
  defaultNoteType: string;
  /** Whether to show the floating badge on EMR pages (default: true) */
  showFloatingBadge: boolean;
}

export const storage = {
  async getAuth(): Promise<StoredAuth | null> {
    const result = await chrome.storage.local.get('auth');
    return (result.auth as StoredAuth | undefined) ?? null;
  },

  async setAuth(auth: StoredAuth): Promise<void> {
    await chrome.storage.local.set({ auth });
  },

  async clearAuth(): Promise<void> {
    await chrome.storage.local.remove('auth');
  },

  async getPreferences(): Promise<StoredPreferences> {
    const result = await chrome.storage.local.get('preferences');
    return (result.preferences as StoredPreferences | undefined) ?? {
      defaultNoteType: 'daily_note',
      showFloatingBadge: true,
    };
  },

  async setPreferences(prefs: Partial<StoredPreferences>): Promise<void> {
    const current = await this.getPreferences();
    await chrome.storage.local.set({
      preferences: { ...current, ...prefs },
    });
  },
};
