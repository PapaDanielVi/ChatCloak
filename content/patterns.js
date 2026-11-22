(() => {
  'use strict';

  const BUILTIN_PATTERNS = [
    {
      category: 'secret',
      // OpenAI, Anthropic, Google, GitHub, AWS, Slack, Stripe, Bearer tokens, JWTs
      regex:
        /\b(?:sk-ant-(?:api\d{2}-|admin\d{2}-)?[A-Za-z0-9_-]{20,}|sk-(?:proj-|svcacct-|admin-|live-|test-)?[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{30,45}|(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{22,}|(?:AKIA|ASIA|AROA|AIDA)[0-9A-Z]{16}|xox[baprs]-[0-9A-Za-z-]{10,}|(?:pk|sk|rk)_(?:live|test)_[0-9A-Za-z]{16,}|Bearer\s+[A-Za-z0-9\-._~+/]{12,}=*|eyJ[A-Za-z0-9_-]{6,}\.eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,})\b/g
    },
    {
      category: 'email',
      regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,24}\b/g
    },
    {
      category: 'credit_card',
      regex: /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g,
      validate(match, fullText, start) {
        if (start > 0 && fullText[start - 1] === '+') {
          return false;
        }
        const digits = match.replace(/\D/g, '');
        if (digits.length < 13 || digits.length > 19) {
          return false;
        }
        // Accept strictly grouped 4x4 card sequences even for dummy test cards (e.g., 1234-5678-9012-3456)
        if (/^\d{4}([ -])\d{4}\1\d{4}\1\d{4}$/.test(match)) {
          return true;
        }
        return passesLuhn(digits);
      }
    },
    {
      category: 'ipv4',
      regex:
        /\b(?:(?:25[0-5]|2[0-4]\d|1?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|1?\d\d?)(?::\d{1,5})?\b/g,
      validate(match, fullText, start) {
        // Skip version-like strings preceded by 'v' (e.g., v1.2.3.4)
        if (start > 0 && /[vV]/.test(fullText[start - 1])) {
          return false;
        }
        const portIdx = match.indexOf(':');
        if (portIdx !== -1) {
          const port = Number(match.slice(portIdx + 1));
          if (port < 1 || port > 65535) return false;
        }
        return true;
      }
    },
    {
      category: 'ipv6',
      regex:
        /(?<![\w$:])(?:(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}|:(?:(?::[0-9a-fA-F]{1,4}){1,7}|:))(?![\w$:])/g,
      validate(match) {
        return match.length >= 4 && match !== '::' && (match.match(/:/g) || []).length >= 2;
      }
    },
    {
      category: 'phone',
      regex:
        /(?<![\w.])(?:\+\d{1,3}[\s.-]?(?:\(\d{1,4}\)[\s.-]?)?(?:\d[\s.-]?){6,12}\d|\(\d{3}\)[\s.-]?\d{3}[\s.-]?\d{4}|\b\d{3}[\s.-]\d{3}[\s.-]\d{4})\b/g,
      validate(match) {
        const digits = match.replace(/\D/g, '');
        if (digits.length < 7 || digits.length > 15) return false;
        // Avoid matching ISO dates such as 2026-11-22
        if (/^\d{4}-\d{2}-\d{2}$/.test(match)) return false;
        return true;
      }
    }
  ];

  function passesLuhn(digits) {
    let sum = 0;
    let shouldDouble = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let d = digits.charCodeAt(i) - 48;
      if (shouldDouble) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
      shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
  }

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function buildCustomKeywordRegex(keywords, caseInsensitive) {
    const cleaned = (keywords || [])
      .map((k) => (typeof k === 'string' ? k.trim() : ''))
      .filter(Boolean);
    if (cleaned.length === 0) return null;

    // Sort longest first so multi-word phrases match completely before sub-words
    const uniqueSorted = Array.from(new Set(cleaned)).sort((a, b) => b.length - a.length);
    const parts = uniqueSorted.map((kw) => {
      const escaped = escapeRegExp(kw);
      const prefix = /^\w/.test(kw) ? '\\b' : '';
      const suffix = /\w$/.test(kw) ? '\\b' : '';
      return `${prefix}${escaped}${suffix}`;
    });

    const flags = caseInsensitive ? 'gi' : 'g';
    return new RegExp(parts.join('|'), flags);
  }

  function collectRegexMatches(text, regex, category, priority, validator, out) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const value = match[0];
      if (!value) {
        regex.lastIndex += 1;
        continue;
      }
      const start = match.index;
      const end = start + value.length;
      if (validator && !validator(value, text, start)) {
        continue;
      }
      out.push({ start, end, category, priority, text: value });
    }
  }

  const EMAIL_PATTERN = {
    category: 'email',
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,24}\b/g
  };

  const GREETING_COMMON_NON_NAMES = new Set([
    'there',
    'everyone',
    'everybody',
    'world',
    'all',
    'team',
    'folks',
    'friend',
    'friends',
    'today',
    'again',
    'here',
    'you'
  ]);

  const PROFILE_GREETING_PATTERNS = [
    {
      category: 'profile',
      // Matches comma-separated personalized greetings, e.g. "Good to see you, SABA."
      regex:
        /\b(?:Good\s+(?:morning|afternoon|evening|night)|Good\s+to\s+see\s+you|Nice\s+to\s+see\s+you|Great\s+to\s+see\s+you|Welcome\s+back|Back\s+at\s+it|Happy\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)|How\s+can\s+I\s+help(?:\s+you)?(?:\s+today)?|What['’]?s\s+on\s+your\s+mind|Ready\s+when\s+you\s+are|Hello|Hey(?:\s+there)?|Hi(?:\s+there)?)\s*,\s*([^\n,.!?;:]{1,60})/gi,
      captureGroup: 1
    },
    {
      category: 'profile',
      // Matches space-separated greetings and account labels, e.g. "Hello SABA", "Signed in as SABA"
      regex:
        /\b(?:Good\s+(?:morning|afternoon|evening|night)|Good\s+to\s+see\s+you|Nice\s+to\s+see\s+you|Great\s+to\s+see\s+you|Welcome\s+back|Back\s+at\s+it|Signed\s+in\s+as|Logged\s+in\s+as|Hello)\s+([^\n,.!?;:()]{1,50})/gi,
      captureGroup: 1,
      validate(name) {
        const lower = name.trim().toLowerCase();
        if (!lower || GREETING_COMMON_NON_NAMES.has(lower)) return false;
        // Require at least one letter so numbers/symbols alone do not match
        return /[A-Za-z\u00C0-\u024F]/.test(name);
      }
    }
  ];

  function collectGreetingMatches(text, basePriority, out) {
    PROFILE_GREETING_PATTERNS.forEach((pattern, idx) => {
      pattern.regex.lastIndex = 0;
      let match;
      while ((match = pattern.regex.exec(text)) !== null) {
        const rawGroup = match[pattern.captureGroup];
        if (!rawGroup) continue;
        const trimmed = rawGroup.trim();
        if (!trimmed) continue;
        if (pattern.validate && !pattern.validate(trimmed)) continue;

        const groupOffset = match[0].lastIndexOf(rawGroup);
        const leadingSpaces = rawGroup.length - rawGroup.trimStart().length;
        const start = match.index + groupOffset + leadingSpaces;
        const end = start + trimmed.length;
        out.push({
          start,
          end,
          category: pattern.category,
          priority: basePriority + idx,
          text: trimmed
        });
      }
    });
  }

  /**
   * Returns sorted, non-overlapping sensitive ranges inside `text`.
   */
  function findSensitiveMatches(text, options) {
    if (!text || text.length < 2) return [];
    const opts = options || {};
    const candidates = [];

    if (opts.enablePii) {
      BUILTIN_PATTERNS.forEach((pattern, idx) => {
        collectRegexMatches(
          text,
          pattern.regex,
          pattern.category,
          idx,
          pattern.validate || null,
          candidates
        );
      });
    } else if (opts.enableEmail) {
      collectRegexMatches(
        text,
        EMAIL_PATTERN.regex,
        EMAIL_PATTERN.category,
        0,
        null,
        candidates
      );
    }

    if (opts.enableProfileIdentity) {
      collectGreetingMatches(text, BUILTIN_PATTERNS.length, candidates);
    }

    if (Array.isArray(opts.extraPatterns) && opts.extraPatterns.length > 0) {
      opts.extraPatterns.forEach((pattern, idx) => {
        if (!pattern || !pattern.regex) return;
        collectRegexMatches(
          text,
          pattern.regex,
          pattern.category || 'profile',
          BUILTIN_PATTERNS.length + PROFILE_GREETING_PATTERNS.length + idx,
          pattern.validate || null,
          candidates
        );
      });
    }

    const customRegex =
      opts.customRegex ||
      buildCustomKeywordRegex(opts.customKeywords, opts.caseInsensitive !== false);
    if (customRegex) {
      collectRegexMatches(
        text,
        customRegex,
        'keyword',
        BUILTIN_PATTERNS.length + PROFILE_GREETING_PATTERNS.length + 10,
        null,
        candidates
      );
    }

    if (candidates.length === 0) return [];

    // Sort by start asc, then longer span first, then pattern priority asc
    candidates.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      const lenDiff = b.end - b.start - (a.end - a.start);
      if (lenDiff !== 0) return lenDiff;
      return a.priority - b.priority;
    });

    const merged = [];
    let lastEnd = -1;
    for (const item of candidates) {
      if (item.start >= lastEnd) {
        merged.push(item);
        lastEnd = item.end;
      }
    }

    return merged;
  }

  window.ChatCloakPatterns = {
    buildCustomKeywordRegex,
    findSensitiveMatches
  };
})();
