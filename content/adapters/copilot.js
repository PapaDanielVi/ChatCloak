(() => {
  'use strict';

  const BaseAdapter = window.ChatCloakBaseAdapter;

  class CopilotAdapter extends BaseAdapter {
    constructor() {
      super({
        id: 'copilot',
        displayName: 'Microsoft Copilot',
        hostPatterns: ['copilot.microsoft.com', 'copilot.cloud.microsoft'],
        supportsShadowDom: true
      });
    }

    getSidebarSelectors() {
      return [
        ...super.getSidebarSelectors(),
        '[data-testid="sidebar"] [role="listitem"]',
        '[data-testid*="chat-history"]',
        '[data-testid*="conversation-item"]',
        'aside a[href*="/chats/"]',
        'cib-side-panel [role="listitem"]',
        '[aria-label*="Conversations" i] [role="listitem"]'
      ];
    }

    getProfileSelectors() {
      return [
        ...super.getProfileSelectors(),
        '#mectrl_main_trigger',
        '#mectrl_headerPicture',
        '[id^="mectrl_"]',
        '[data-testid="account-badge"]',
        '[data-testid*="tenant" i]',
        '[data-testid*="organization" i]',
        'button[aria-label*="Account manager" i]',
        'button[aria-label*="Work or school" i]',
        '[aria-label*="Microsoft account" i]'
      ];
    }

    getMediaSelectors() {
      return [
        ...super.getMediaSelectors(),
        '[data-testid*="file-chip"]',
        'a[href*="sharepoint.com"]',
        'a[href*="-my.sharepoint.com"]',
        'a[href*="onedrive.live.com"]',
        '[aria-label*="OneDrive" i]',
        '[aria-label*="SharePoint" i]'
      ];
    }

    getMessageContainerSelectors() {
      return [
        ...super.getMessageContainerSelectors(),
        '[data-testid="chat-message"]',
        '[data-content="ai-message"]',
        '[data-content="user-message"]',
        'cib-message-group',
        'cib-message',
        '[role="article"]'
      ];
    }
  }

  window.ChatCloakAdapters.push(new CopilotAdapter());
})();
