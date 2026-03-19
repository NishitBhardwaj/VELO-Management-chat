import { Injectable } from '@nestjs/common';

export interface ClassificationResult {
    category: string;      // work | promotion | task | urgent | social | finance
    confidence: number;    // 0-1
    rules_matched: string[];
}

// ─── Classification Rules ────────────────────────────────

const DOMAIN_RULES: Record<string, string> = {
    // Work domains
    'google.com': 'work',
    'microsoft.com': 'work',
    'slack.com': 'work',
    'github.com': 'work',
    'atlassian.com': 'work',
    'jira.atlassian.com': 'work',
    // Social
    'facebook.com': 'social',
    'linkedin.com': 'social',
    'twitter.com': 'social',
};

const KEYWORD_RULES: { keywords: string[]; category: string; weight: number }[] = [
    // Urgent
    { keywords: ['urgent', 'asap', 'immediately', 'critical', 'emergency'], category: 'urgent', weight: 0.9 },
    // Finance
    { keywords: ['invoice', 'payment', 'receipt', 'billing', 'subscription'], category: 'finance', weight: 0.8 },
    // Task / Calendar
    { keywords: ['meeting', 'calendar', 'agenda', 'deadline', 'due date', 'reminder'], category: 'task', weight: 0.7 },
    // Promotion
    { keywords: ['unsubscribe', 'opt out', 'special offer', 'discount', 'sale', 'promo'], category: 'promotion', weight: 0.85 },
    // Social
    { keywords: ['invitation', 'connect', 'follow', 'friend request'], category: 'social', weight: 0.6 },
];

@Injectable()
export class EmailClassifier {
    /**
     * Classify an email based on sender domain + subject/snippet keywords.
     * Rule-based Phase 1 — will upgrade to NLP/LLM in Phase 3.
     */
    classify(
        senderAddress: string,
        subject: string,
        snippet: string,
    ): ClassificationResult {
        const rulesMatched: string[] = [];
        let bestCategory = 'work'; // default
        let bestConfidence = 0.3;

        // ─── Domain-based classification ─────────────────
        const domain = senderAddress.split('@')[1]?.toLowerCase() || '';
        if (DOMAIN_RULES[domain]) {
            bestCategory = DOMAIN_RULES[domain];
            bestConfidence = 0.7;
            rulesMatched.push(`domain:${domain}→${bestCategory}`);
        }

        // ─── Keyword-based classification ────────────────
        const text = `${subject} ${snippet}`.toLowerCase();

        for (const rule of KEYWORD_RULES) {
            const matchCount = rule.keywords.filter((kw) => text.includes(kw)).length;
            if (matchCount > 0) {
                const score = rule.weight * (matchCount / rule.keywords.length) + 0.1 * matchCount;
                rulesMatched.push(`keywords:${rule.keywords.filter((kw) => text.includes(kw)).join(',')}→${rule.category}`);

                if (score > bestConfidence) {
                    bestCategory = rule.category;
                    bestConfidence = Math.min(score, 1.0);
                }
            }
        }

        return {
            category: bestCategory,
            confidence: Math.round(bestConfidence * 100) / 100,
            rules_matched: rulesMatched,
        };
    }

    /**
     * Test endpoint — classify arbitrary text.
     */
    classifyTest(sender: string, subject: string): ClassificationResult {
        return this.classify(sender, subject, '');
    }
}
