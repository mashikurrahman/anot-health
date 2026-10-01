/**
 * Anot Health chatbot v3
 * Local knowledge engine trained from website content and past chats.
 */
(function () {
    'use strict';

    const HISTORY_KEY = 'anot-chatbot-history-v3';
    const MEMORY_KEY = 'anot-chatbot-memory-v3';
    const SESSION_KEY = 'anot-chatbot-session-v1';
    const FEEDBACK_KEY = 'anot-chatbot-feedback-v1';
    const WEAK_QUESTIONS_KEY = 'anot-chatbot-weak-questions-v1';
    const OVERRIDE_INTENTS_KEY = 'anot-chatbot-override-intents-v1';
    const KNOWLEDGE_BRAIN_URL = 'data/chatbot-knowledge.json';
    const MAX_HISTORY_ITEMS = 20;
    const MAX_MEMORY_ITEMS = 40;
    const MAX_MEMORY_AGE_DAYS = 30;
    const MAX_SESSION_AGE_HOURS = 12;
    const MAX_WEAK_QUESTION_ITEMS = 40;
    // Claude-powered answers come from the backend (backend/chatService.js). When it is
    // switched off or fails, the built-in bot below answers instead.
    const AI_ENDPOINT = 'api/chat';
    const AI_MAX_MESSAGES = 8;
    const AI_QUESTION_CHARS = 1000;
    const AI_HISTORY_CHARS = 600;
    const AI_TIMEOUT_MS = 60000;
    const AI_PAUSE_AFTER_FAILURE_MS = 2 * 60 * 1000;
    const SITE_PAGES = [
        'index.html',
        'about.html',
        'pricing.html',
        'scribing.html',
        'billing.html',
        'coding.html',
        'payroll.html',
        'specialties.html',
        'hipaa.html',
        'privacy.html',
        'terms.html',
        'contact.html'
    ];
    const CURRENT_PAGE = window.location.pathname.split('/').pop() || 'index.html';
    let storedRegion = null;
    try {
        storedRegion = localStorage.getItem('anot_selected_region');
    } catch (error) {
        // Storage blocked: fall back to the page itself.
    }
    const isCanadianChat = storedRegion === 'ca' || CURRENT_PAGE.includes('-ca.html') || CURRENT_PAGE.includes('pipeda.html');
    // What the built-in bot quotes for the plans. data/pricing.json is the source of truth and a test
    // (backend/test/pricing.test.js) fails if these drift from it.
    const PRICING_US = { ai: '$199', verified: '$899', billing: 'Plans are billed in US dollars, with the same price for US and international practices.' };
    const PRICING_CA = { ai: '$139 CAD', verified: '$839 CAD', billing: 'Plans are billed in Canadian dollars. Canadian pricing is set for Canadian practices, so there are no currency conversion or international card fees.' };
    const PRICING = isCanadianChat ? PRICING_CA : PRICING_US;

    // Purge any stale client-side cache from previous versions that quoted superseded pricing ($99 or $599)
    try {
        const rawMem = localStorage.getItem(MEMORY_KEY);
        if (rawMem && (rawMem.includes('$99') || rawMem.includes('$599') || rawMem.includes('99.00') || rawMem.includes('599.00'))) {
            const parsed = JSON.parse(rawMem);
            if (Array.isArray(parsed)) {
                const clean = parsed.filter(function (e) {
                    return e && typeof e.answer === 'string' && !/\$(99|599)\b/.test(e.answer) && !/\b(99|599)\s*(usd|\/month)/i.test(e.answer);
                });
                localStorage.setItem(MEMORY_KEY, JSON.stringify(clean));
            }
        }
    } catch (e) {}
    function applyPricingTokens(text) {
        return String(text || '').replace(/\{\{price\.(ai|verified|billing)\}\}/g, function (match, key) {
            return PRICING[key];
        });
    }
    // Canadian visitors learn from the Canadian pages (CAD pricing, PIPEDA, provincial billing).
    const CA_PAGE_EQUIVALENTS = {
        'index.html': 'homepage-ca.html',
        'about.html': 'about-ca.html',
        'pricing.html': 'pricing-ca.html',
        'scribing.html': 'scribing-ca.html',
        'billing.html': 'billing-ca.html',
        'coding.html': 'coding-ca.html',
        'hipaa.html': 'pipeda.html',
        'contact.html': 'contact-ca.html'
    };
    const KNOWLEDGE_PAGES = isCanadianChat
        ? SITE_PAGES.map((page) => CA_PAGE_EQUIVALENTS[page] || page)
        : SITE_PAGES;
    const PAGE_CONTEXTS = {
        'index.html': {
            label: 'homepage',
            nextStep: "If you want, I can point you to the best starting service based on your workflow needs."
        },
        'contact.html': {
            label: 'demo',
            nextStep: "Best next step: use the demo form or email **admin@anot.health** so the team can tailor the conversation to your workflow."
        },
        'pricing.html': {
            label: 'pricing',
            nextStep: "If you share your provider count or main workflow bottleneck, I can point you to the plan that looks closest."
        },
        'scribing.html': {
            label: 'service',
            nextStep: "Since you're on the Clinical Documentation page, the next useful question is usually about note turnaround, provider relief, or implementation."
        },
        'billing.html': {
            label: 'service',
            nextStep: "Since you're on the Revenue Cycle page, the next useful question is usually about denials, claim quality, or cash flow improvement."
        },
        'coding.html': {
            label: 'service',
            nextStep: "Since you're on the Coding & Compliance page, the next useful question is usually about specificity, audit confidence, or reimbursement logic."
        },
        'payroll.html': {
            label: 'service',
            nextStep: "Since you're on the Payroll page, the next useful question is usually about reconciliation, provider compensation inputs, or finance workflows."
        },
        'hipaa.html': {
            label: 'trust',
            nextStep: "Since you're on the Trust Center page, I can also summarize HIPAA, privacy, or implementation-risk topics."
        },
        'privacy.html': {
            label: 'trust',
            nextStep: "Since you're on a privacy page, I can also point you to trust, HIPAA, or contact details if that's more useful."
        },
        'terms.html': {
            label: 'trust',
            nextStep: "Since you're on a terms page, I can also help summarize services, trust topics, or the best next contact step."
        }
    };

    const STOP_WORDS = new Set([
        'a', 'about', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at', 'be', 'been', 'by',
        'can', 'could', 'did', 'do', 'does', 'for', 'from', 'guys', 'had', 'has', 'have', 'hello',
        'help', 'hey', 'hi', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'me', 'more', 'my',
        'of', 'on', 'or', 'our', 'please', 'tell', 'than', 'that', 'the', 'their', 'them', 'there',
        'they', 'this', 'to', 'u', 'us', 'was', 'we', 'what', 'when', 'where', 'which', 'who',
        'why', 'will', 'with', 'would', 'you', 'your'
    ]);

    const TOPIC_DEFINITIONS = {
        pricing: {
            label: 'pricing and plans',
            keywords: ['pricing', 'price', 'cost', 'plan', 'plans', 'foundation', 'professional', 'enterprise', 'quote']
        },
        documentation: {
            label: 'clinical documentation',
            keywords: ['documentation', 'scribe', 'scribing', 'note', 'notes', 'chart', 'dictation', 'dictation', 'provider']
        },
        revenue: {
            label: 'revenue cycle',
            keywords: ['billing', 'claim', 'claims', 'revenue', 'denial', 'cash flow', 'payer', 'submission']
        },
        coding: {
            label: 'coding and compliance',
            keywords: ['coding', 'code', 'compliance', 'audit', 'specificity', 'reimbursement']
        },
        payroll: {
            label: 'payroll administration',
            keywords: ['payroll', 'compensation', 'hours', 'shift', 'finance', 'reconciliation']
        },
        trust: {
            label: 'HIPAA and trust',
            keywords: ['hipaa', 'pipeda', 'phipa', 'trust', 'privacy', 'secure', 'security', 'safe', 'compliance', 'compliant', 'data stored', 'my data', 'data residency', 'encryption', 'encrypted', 'baa']
        },
        workflows: {
            label: 'implementation and workflow',
            keywords: ['workflow', 'workflows', 'implementation', 'onboarding', 'rollout', 'process', 'how it works', 'turnaround']
        },
        services: {
            label: 'services',
            keywords: ['services', 'service', 'offer', 'provide', 'supports', 'help with']
        },
        specialties: {
            label: 'specialties',
            keywords: ['specialty', 'specialties', 'cardiology', 'dermatology', 'family medicine', 'multi specialty']
        },
        contact: {
            label: 'demo and contact',
            keywords: ['contact', 'demo', 'book', 'email', 'reach', 'talk to sales']
        }
    };

    const GREETING_RESPONSE = "Hi there! I'm the Anot AI Assistant.\n\nI use Anot's website, a curated local knowledge brain, and past chats, so I can help with:\n- Services\n- Pricing\n- HIPAA and trust questions\n- Workflows and implementation\n- Specialties and demos\n\nWhat would you like to know?";
    const FALLBACK_RESPONSE = "I'm not fully confident on that yet.\n\nI can still help with:\n- Services\n- Pricing\n- Workflows\n- HIPAA and specialties\n- Demos and contact details\n\nYou can also reach the team at **admin@anot.health** for anything more specific.";
    const RESTRICTED_RESPONSE = "I can help with Anot Health's services and workflows, but I can't provide medical, diagnosis, treatment, or legal advice.\n\nIf you'd like, I can explain:\n- Documentation\n- Billing\n- Coding\n- Payroll\n- HIPAA\n- The demo process";

    const DIRECT_RESPONSES = [
        {
            patterns: [
                /\bwhat (services|service)\b/,
                /\bservices? do you provide\b/,
                /\bwhat do you (do|offer|provide)\b/,
                /\bwhat can you do\b/,
                /\bservice(s)? you guys provide\b/
            ],
            title: 'Services Overview',
            shortAnswer: 'Anot Health is positioned as an expert-led healthcare operations partner with four core service lines.',
            keyPoints: [
                '**Clinical Documentation** for note readiness and reduced after-hours charting.',
                '**Revenue Cycle Management** for cleaner claim preparation and steadier collections.',
                '**Coding & Compliance** for stronger specificity, reimbursement logic, and audit confidence.',
                '**Payroll Administration** for cleaner provider compensation and finance handoffs.'
            ]
        },
        {
            patterns: [
                /\bhow (does|do) (it|this|anot) work\b/,
                /\bwhat is your process\b/,
                /\bhow your workflow works\b/
            ],
            title: 'How Anot Works',
            shortAnswer: "Anot's model is built around AI speed with human validation before your team relies on the output.",
            keyPoints: [
                'AI supports drafting, structure, and first-pass speed.',
                'Experienced healthcare professionals review, refine, and validate each workflow.',
                'The goal is dependable documentation and operations support, not unreviewed automation.'
            ]
        },
        {
            patterns: [
                /\binternational (pricing|price|cost|market|rates?)\b/,
                /\b(pricing|price|cost|rates?) (for |in )?(the )?international\b/,
                /\b(pricing|price|cost) (outside|globally|worldwide)\b/,
                /\boutside (the )?(us|canada|united states)\b/
            ],
            title: 'International Pricing',
            shortAnswer: `Anot's international pricing is billed in US dollars, with the same rates for US and international practices: AI Scribe at ${PRICING_US.ai} per provider per month, Verified Scribe at ${PRICING_US.verified} per provider per month, and Custom pricing for groups. ${PRICING_US.billing}`,
            keyPoints: [
                '**AI Scribe (' + PRICING_US.ai + '/month USD)**: ambient AI drafts the SOAP note in your EHR with suggested codes; you review and sign.',
                '**Verified Scribe (' + PRICING_US.verified + '/month USD)**: a certified scribe and a QPS clinical auditor check every note, so it arrives sign-ready.',
                '**Custom**: scoped pricing for multi-site groups and international clinics bundling documentation with billing, coding and payroll.',
                'No contracts and no surprise fees; paying yearly saves 15%. Full details on the [pricing page](pricing.html).'
            ]
        },
        {
            patterns: [
                /\bhow much\b/,
                /\bwhat does it cost\b/,
                /\bwhat is the price\b/,
                /\bpricing\b/
            ],
            title: 'Pricing',
            shortAnswer: `Anot has three plans: AI Scribe at ${PRICING.ai} per provider per month, Verified Scribe at ${PRICING.verified} per provider per month, and Custom pricing for groups. ${PRICING.billing}`,
            keyPoints: [
                '**AI Scribe (' + PRICING.ai + '/month)**: ambient AI drafts the SOAP note in your EHR with suggested codes; you review and sign.',
                '**Verified Scribe (' + PRICING.verified + '/month)**: a certified scribe and a QPS clinical auditor check every note, so it arrives sign-ready.',
                '**Custom**: scoped pricing for multi-site groups adding billing, coding and payroll.',
                'No contracts and no surprise fees; paying yearly saves 15%. Full comparison on the [pricing page](' + (isCanadianChat ? 'pricing-ca.html' : 'pricing.html') + ').'
            ]
        },
        {
            patterns: [
                /\b(hipaa|pipeda|phipa|hia|pipa)\b/,
                /\bwhere is (my|our|the|patient) data\b/,
                /\bdata (stored|hosted|residency|kept)\b/,
                /\bis (it|this|anot) secure\b/,
                /\bis (it|this|anot) safe\b/,
                /\bprivacy\b/
            ],
            title: isCanadianChat ? 'PIPEDA, PHIPA & Canadian Compliance' : 'HIPAA And Trust',
            shortAnswer: isCanadianChat
                ? 'Anot Health Canada strictly complies with PIPEDA (Federal), PHIPA (Ontario), HIA (Alberta), and PIPA (BC) with 100% in-country data residency in AWS Canada Central.'
                : 'The website presents Anot as privacy-focused, HIPAA-conscious, and built around operational safeguards.',
            keyPoints: isCanadianChat ? [
                'All patient audio and clinical notes stay inside AWS Canada Central (Montreal/Calgary).',
                'We execute formal Information Manager Agreements (IMAs) with Canadian clinics.',
                'Certified human scribes and QPS auditors validate notes before Canadian EMR injection.'
            ] : [
                'Protected workflows and expert oversight are recurring themes across the site.',
                'Human review is part of the operating model rather than an afterthought.',
                'The trust-related pages reinforce privacy, compliance, and implementation discipline.'
            ]
        },
        {
            patterns: [
                /\bcontact\b/,
                /\bdemo\b/,
                /\bbook\b/,
                /\bemail\b/
            ],
            title: 'Contact And Demo',
            shortAnswer: 'You can reach the team directly or book a tailored walkthrough.',
            keyPoints: [
                'Email: **admin@anot.health**',
                'Use the **Get a Demo** button for a workflow-specific conversation.',
                'The contact flow is designed to center the service line that needs relief first.'
            ]
        }
    ];

    let knowledgeChunks = [];
    let knowledgeReady = false;
    let knowledgePromise = null;
    let knowledgeBrain = createEmptyKnowledgeBrain();
    let semanticAliasMap = {};
    let runtimeHistory = [];

    function normalize(text) {
        return String(text || '')
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function tokenize(text) {
        return normalize(text).split(' ').filter(Boolean);
    }

    function stemWord(word) {
        return word.replace(/(ing|tion|sion|ment|ness|able|ible|ful|less|ous|ive|ize|ise|ity|ers|er|ed|es|s)$/i, '');
    }

    function unique(array) {
        return Array.from(new Set(array));
    }

    function createEmptyKnowledgeBrain() {
        return {
            version: 1,
            synonymGroups: [],
            intents: []
        };
    }

    function truncate(text, maxLength) {
        const value = String(text || '').trim();
        if (value.length <= maxLength) {
            return value;
        }

        return `${value.slice(0, maxLength).trim()}...`;
    }

    function stripHtml(html) {
        const temp = document.createElement('div');
        temp.innerHTML = String(html || '');
        return (temp.textContent || temp.innerText || '').trim();
    }

    function normalizePhraseArray(values) {
        return unique(
            (Array.isArray(values) ? values : [])
                .flatMap(function (value) {
                    return tokenize(value);
                })
                .filter(function (token) {
                    return token && !STOP_WORDS.has(token);
                })
        );
    }

    function buildSemanticAliasMap(brain) {
        const map = {};
        const groups = Array.isArray(brain?.synonymGroups) ? brain.synonymGroups.slice() : [];

        Object.keys(TOPIC_DEFINITIONS).forEach(function (topic) {
            groups.push(TOPIC_DEFINITIONS[topic].keywords);
        });

        groups.forEach(function (group) {
            const terms = normalizePhraseArray(group);
            if (!terms.length) {
                return;
            }

            terms.forEach(function (term) {
                if (!map[term]) {
                    map[term] = new Set();
                }

                terms.forEach(function (related) {
                    if (related !== term) {
                        map[term].add(related);
                    }
                });
            });
        });

        return Object.keys(map).reduce(function (accumulator, key) {
            accumulator[key] = Array.from(map[key]);
            return accumulator;
        }, {});
    }

    function buildTokenPhrases(tokens) {
        const phrases = [];
        const safeTokens = Array.isArray(tokens) ? tokens.filter(Boolean) : [];

        for (let index = 0; index < safeTokens.length; index += 1) {
            if (safeTokens[index + 1]) {
                phrases.push(`${safeTokens[index]} ${safeTokens[index + 1]}`);
            }

            if (safeTokens[index + 2]) {
                phrases.push(`${safeTokens[index]} ${safeTokens[index + 1]} ${safeTokens[index + 2]}`);
            }
        }

        return unique(phrases);
    }

    function expandSemanticTokens(tokens, topic) {
        const queue = Array.isArray(tokens) ? tokens.slice() : [];
        const expanded = new Set(queue);
        const topicKeywords = topic && TOPIC_DEFINITIONS[topic]
            ? normalizePhraseArray(TOPIC_DEFINITIONS[topic].keywords)
            : [];

        topicKeywords.forEach(function (token) {
            expanded.add(token);
        });

        queue.concat(topicKeywords).forEach(function (token) {
            const related = semanticAliasMap[token] || semanticAliasMap[stemWord(token)] || [];
            related.forEach(function (term) {
                expanded.add(term);
            });
        });

        return Array.from(expanded).filter(function (token) {
            return token && !STOP_WORDS.has(token);
        });
    }

    function buildSemanticQuery(question, forcedTopic) {
        const normalizedQuestion = normalize(question);
        const baseTokens = tokenize(question).filter(function (token) {
            return !STOP_WORDS.has(token);
        });
        const topic = forcedTopic || detectTopicFromQuestion(question);
        const expandedTokens = expandSemanticTokens(baseTokens, topic);

        return {
            normalized: normalizedQuestion,
            topic: topic,
            baseTokens: baseTokens,
            tokens: expandedTokens,
            stems: expandedTokens.map(stemWord),
            phrases: buildTokenPhrases(expandedTokens)
        };
    }

    function sanitizeKnowledgeIntent(intent) {
        if (!intent || typeof intent !== 'object') {
            return null;
        }

        const title = applyPricingTokens(String(intent.title || '').trim());
        const summary = applyPricingTokens(String(intent.summary || '').trim());
        if (!title || !summary) {
            return null;
        }

        return {
            id: String(intent.id || title).trim(),
            topic: String(intent.topic || '').trim(),
            title: title,
            summary: summary,
            highlights: Array.isArray(intent.highlights) ? intent.highlights.map(String).map(function (value) { return applyPricingTokens(value.trim()); }).filter(Boolean) : [],
            bestFit: applyPricingTokens(String(intent.bestFit || '').trim()),
            nextStep: applyPricingTokens(String(intent.nextStep || '').trim()),
            sourcePages: Array.isArray(intent.sourcePages) ? intent.sourcePages.map(String).map(function (value) { return value.trim(); }).filter(Boolean) : [],
            triggers: Array.isArray(intent.triggers) ? intent.triggers.map(String).map(function (value) { return value.trim(); }).filter(Boolean) : []
        };
    }

    function getOverrideIntents() {
        const entries = readJson(OVERRIDE_INTENTS_KEY, []);
        if (!Array.isArray(entries)) {
            return [];
        }

        return entries
            .map(sanitizeKnowledgeIntent)
            .filter(Boolean)
            .map(function (intent) {
                return Object.assign({}, intent, { isOverride: true });
            });
    }

    async function loadKnowledgeBrain() {
        try {
            const response = await fetch(KNOWLEDGE_BRAIN_URL, { credentials: 'same-origin' });
            if (!response.ok) {
                throw new Error('Failed to load knowledge brain');
            }

            const payload = await response.json();
            const fileIntents = Array.isArray(payload?.intents)
                ? payload.intents.map(sanitizeKnowledgeIntent).filter(Boolean)
                : [];
            const overrideIntents = getOverrideIntents();
            const overrideIds = new Set(overrideIntents.map(function (intent) {
                return intent.id;
            }));
            const intents = fileIntents
                .filter(function (intent) {
                    return !overrideIds.has(intent.id);
                })
                .concat(overrideIntents);
            const synonymGroups = Array.isArray(payload?.synonymGroups)
                ? payload.synonymGroups.filter(Array.isArray)
                : [];

            knowledgeBrain = {
                version: Number(payload?.version || 1),
                synonymGroups: synonymGroups,
                intents: intents
            };
        } catch (error) {
            knowledgeBrain = createEmptyKnowledgeBrain();
        }

        semanticAliasMap = buildSemanticAliasMap(knowledgeBrain);
        return knowledgeBrain;
    }

    function createAnswerKey(text) {
        return truncate(normalize(text), 180);
    }

    function readJson(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function writeJson(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            // Ignore storage errors.
        }
    }

    function getHistory() {
        return Array.isArray(runtimeHistory) ? runtimeHistory.slice() : [];
    }

    function saveHistory(history) {
        runtimeHistory = Array.isArray(history) ? history.slice(-MAX_HISTORY_ITEMS) : [];

        try {
            localStorage.removeItem(HISTORY_KEY);
        } catch (error) {
            // Ignore storage errors.
        }
    }

    function getRecentBotMessages(limit) {
        return getHistory()
            .filter(function (entry) {
                return entry?.sender === 'bot' && typeof entry.text === 'string' && entry.text.trim();
            })
            .slice(-(limit || 3));
    }

    function getLastUserMessage() {
        const history = getHistory();

        for (let index = history.length - 1; index >= 0; index -= 1) {
            const entry = history[index];
            if (entry?.sender === 'user' && typeof entry.text === 'string' && entry.text.trim()) {
                return entry.text.trim();
            }
        }

        return '';
    }

    function getFeedbackStore() {
        const feedback = readJson(FEEDBACK_KEY, {});
        return feedback && typeof feedback === 'object' ? feedback : {};
    }

    function saveFeedbackStore(feedback) {
        writeJson(FEEDBACK_KEY, feedback || {});
    }

    function saveWeakQuestionLog(entries) {
        writeJson(WEAK_QUESTIONS_KEY, Array.isArray(entries) ? entries.slice(-MAX_WEAK_QUESTION_ITEMS) : []);
    }

    function addWeakQuestion(meta) {
        if (!meta?.question) {
            return;
        }

        const entries = readJson(WEAK_QUESTIONS_KEY, []);
        const nextEntries = Array.isArray(entries) ? entries : [];
        const record = {
            question: String(meta.question || '').trim(),
            answerKey: String(meta.answerKey || '').trim(),
            topic: String(meta.topic || '').trim(),
            savedAt: Date.now()
        };

        const duplicate = nextEntries.some(function (entry) {
            return normalize(entry.question) === normalize(record.question) &&
                entry.answerKey === record.answerKey;
        });

        if (!duplicate) {
            nextEntries.push(record);
            saveWeakQuestionLog(nextEntries);
        }
    }

    function getSession() {
        const session = readJson(SESSION_KEY, null);
        if (!session || typeof session !== 'object') {
            return null;
        }

        const cutoff = Date.now() - (MAX_SESSION_AGE_HOURS * 60 * 60 * 1000);
        if (Number(session.updatedAt || 0) < cutoff) {
            return null;
        }

        return session;
    }

    function saveSession(session) {
        if (!session || typeof session !== 'object') {
            return;
        }

        writeJson(SESSION_KEY, {
            activeTopic: session.activeTopic || '',
            activeTopicLabel: session.activeTopicLabel || '',
            lastSources: Array.isArray(session.lastSources) ? session.lastSources.slice(0, 3) : [],
            lastQuestion: String(session.lastQuestion || '').trim(),
            updatedAt: Date.now()
        });
    }

    function clearSession() {
        try {
            localStorage.removeItem(SESSION_KEY);
        } catch (error) {
            // Ignore storage errors.
        }
    }

    function getMemory() {
        const memory = readJson(MEMORY_KEY, []);
        if (!Array.isArray(memory)) {
            return [];
        }

        const cutoff = Date.now() - (MAX_MEMORY_AGE_DAYS * 24 * 60 * 60 * 1000);
        let cleaned = false;
        const valid = memory.filter(function (entry) {
            if (!entry || typeof entry.question !== 'string' || typeof entry.answer !== 'string') {
                cleaned = true;
                return false;
            }
            if (Number(entry.savedAt || 0) < cutoff) {
                cleaned = true;
                return false;
            }
            // Purge any stale memory quoting older pricing ($99 or $599)
            if (/\$(99|599)\b/.test(entry.answer) || /\b(99|599)\s*(usd|\/month)/i.test(entry.answer)) {
                cleaned = true;
                return false;
            }
            return true;
        });
        if (cleaned && valid.length !== memory.length) {
            writeJson(MEMORY_KEY, valid);
        }
        return valid;
    }

    function saveMemory(memory) {
        writeJson(MEMORY_KEY, memory.slice(-MAX_MEMORY_ITEMS));
    }

    function rememberExchange(question, answer, sources) {
        const memory = getMemory();
        const normalizedQuestion = normalize(question);
        const answerKey = createAnswerKey(answer);
        const existing = memory.find(function (entry) {
            return normalize(entry.question) === normalizedQuestion &&
                createAnswerKey(entry.answer) === answerKey;
        });

        if (existing) {
            existing.savedAt = Date.now();
            existing.sources = Array.isArray(sources) ? sources.slice(0, 3) : existing.sources;
        } else {
            memory.push({
                question: String(question || '').trim(),
                answer: String(answer || '').trim(),
                sources: Array.isArray(sources) ? sources.slice(0, 3) : [],
                savedAt: Date.now()
            });
        }

        saveMemory(memory);
    }

    function getFeedbackWeight(feedback) {
        if (!feedback || typeof feedback !== 'object') {
            return 0;
        }

        const helpfulCount = Number(feedback.helpfulCount || 0);
        const notHelpfulCount = Number(feedback.notHelpfulCount || 0);
        let score = (helpfulCount * 4) - (notHelpfulCount * 5);

        if (feedback.userStatus === 'helpful') {
            score += 2;
        }

        if (feedback.userStatus === 'not_helpful') {
            score -= 3;
        }

        return score;
    }

    function setAnswerFeedback(answerKey, status, meta) {
        const feedbackStore = getFeedbackStore();
        const current = feedbackStore[answerKey] || {
            helpfulCount: 0,
            notHelpfulCount: 0,
            userStatus: ''
        };

        if (current.userStatus === status) {
            return current;
        }

        if (current.userStatus === 'helpful' && current.helpfulCount > 0) {
            current.helpfulCount -= 1;
        }

        if (current.userStatus === 'not_helpful' && current.notHelpfulCount > 0) {
            current.notHelpfulCount -= 1;
        }

        if (status === 'helpful') {
            current.helpfulCount += 1;
        }

        if (status === 'not_helpful') {
            current.notHelpfulCount += 1;
            addWeakQuestion(meta);
        }

        current.userStatus = status;
        current.updatedAt = Date.now();
        feedbackStore[answerKey] = current;
        saveFeedbackStore(feedbackStore);
        return current;
    }

    function getTopicLabel(topic) {
        return TOPIC_DEFINITIONS[topic]?.label || '';
    }

    function inferTopicFromSources(sources) {
        const source = Array.isArray(sources) ? String(sources[0] || '').trim().toLowerCase() : '';
        const sourceMap = {
            'pricing.html': 'pricing',
            'scribing.html': 'documentation',
            'billing.html': 'revenue',
            'coding.html': 'coding',
            'payroll.html': 'payroll',
            'hipaa.html': 'trust',
            'privacy.html': 'trust',
            'terms.html': 'trust',
            'contact.html': 'contact',
            'specialties.html': 'specialties'
        };

        return sourceMap[source] || '';
    }

    function inferTopicFromPage(page) {
        return inferTopicFromSources([page]);
    }

    function detectTopicFromQuestion(text) {
        const normalizedText = normalize(text);
        if (!normalizedText) {
            return '';
        }

        let bestTopic = '';
        let bestScore = 0;

        Object.keys(TOPIC_DEFINITIONS).forEach(function (topic) {
            const definition = TOPIC_DEFINITIONS[topic];
            let score = 0;

            definition.keywords.forEach(function (keyword) {
                const normalizedKeyword = normalize(keyword);
                if (!normalizedKeyword) {
                    return;
                }

                if (normalizedText.includes(normalizedKeyword)) {
                    score += normalizedKeyword.split(' ').length > 1 ? 3 : 2;
                }
            });

            if (score > bestScore) {
                bestScore = score;
                bestTopic = topic;
            }
        });

        if (bestScore === 0 && Array.isArray(knowledgeBrain.intents) && knowledgeBrain.intents.length) {
            knowledgeBrain.intents.forEach(function (intent) {
                if (!intent.topic) {
                    return;
                }

                const phrases = [intent.title, intent.summary].concat(intent.triggers || []);
                let score = 0;

                phrases.forEach(function (phrase) {
                    const normalizedPhrase = normalize(phrase);
                    if (!normalizedPhrase) {
                        return;
                    }

                    if (normalizedText.includes(normalizedPhrase)) {
                        score += normalizedPhrase.split(' ').length >= 3 ? 4 : 2;
                    }
                });

                if (score > bestScore) {
                    bestScore = score;
                    bestTopic = intent.topic;
                }
            });
        }

        return bestScore > 0 ? bestTopic : '';
    }

    function isFollowUpQuestion(question) {
        const normalizedQuestion = normalize(question);
        const wordCount = normalizedQuestion.split(' ').filter(Boolean).length;

        if (!normalizedQuestion) {
            return false;
        }

        if (/^(what about|how about|and|also|for that|for this|about that|about this|does that|is that|what if|how much for that|how much for this)\b/.test(normalizedQuestion)) {
            return true;
        }

        if (/\b(that|this|it|those|these|there|same)\b/.test(normalizedQuestion) && wordCount <= 10) {
            return true;
        }

        return wordCount <= 6 && !detectTopicFromQuestion(normalizedQuestion);
    }

    function buildContextualQuestion(question, session, explicitTopic) {
        const followUp = isFollowUpQuestion(question);

        if (!followUp) {
            return {
                effectiveQuestion: question,
                usedSessionContext: false,
                needsClarification: false
            };
        }

        if (!session?.activeTopic) {
            return {
                effectiveQuestion: question,
                usedSessionContext: false,
                needsClarification: !explicitTopic
            };
        }

        // A question that names its own topic stands alone: "are you PIPEDA
        // compliant?" after a pricing answer is about privacy, not pricing.
        if (explicitTopic) {
            return {
                effectiveQuestion: question,
                usedSessionContext: false,
                needsClarification: false
            };
        }

        const contextParts = [session.activeTopicLabel || getTopicLabel(session.activeTopic)];

        const sourceTopic = inferTopicFromSources(session.lastSources);
        if (sourceTopic && sourceTopic !== session.activeTopic) {
            contextParts.push(getTopicLabel(sourceTopic));
        }

        return {
            effectiveQuestion: `${question} about ${contextParts.filter(Boolean).join(' ')}`.trim(),
            usedSessionContext: true,
            needsClarification: false
        };
    }

    function buildClarificationResponse(session) {
        const activeTopic = session?.activeTopic || '';
        const activeLabel = session?.activeTopicLabel || getTopicLabel(activeTopic);

        if (activeTopic && activeLabel) {
            return buildStructuredResponse({
                title: 'Quick Clarification',
                shortAnswer: `I can help with that in the context of ${activeLabel}, but I need one more detail to answer well.`,
                keyPoints: [
                    `Are you asking about **fit**, **pricing**, **implementation**, or **quality** for ${activeLabel}?`,
                    'You can also mention the specialty, team type, or workflow you have in mind.'
                ],
                nextStep: "Reply with a little more context and I'll keep the answer focused."
            });
        }

        return buildStructuredResponse({
            title: 'Quick Clarification',
            shortAnswer: 'I can help, but I need a bit more context before I guess.',
            keyPoints: [
                'You can ask about **pricing and plans**.',
                'You can ask about **clinical documentation** or another service line.',
                'You can ask about **HIPAA and trust**.',
                'You can ask about **implementation and workflow**.'
            ],
            nextStep: 'Tell me which area you mean, and I will answer more precisely.'
        });
    }

    function buildTopicClarification(topic) {
        const topicMap = {
            pricing: {
                title: 'Pricing Clarification',
                shortAnswer: 'I can answer pricing more precisely if you tell me a little more about the documentation profile.',
                keyPoints: [
                    'You can mention the **specialty** or visit type.',
                    'You can mention whether the notes are **straightforward** or **more complex**.',
                    'You can mention whether you are comparing **AI Scribe**, **Verified Scribe**, or **Custom**.'
                ]
            },
            documentation: {
                title: 'Documentation Clarification',
                shortAnswer: 'I can give a much better answer if you tell me what kind of documentation workflow you mean.',
                keyPoints: [
                    'You can mention the **specialty**.',
                    'You can mention the **visit pattern** or note complexity.',
                    'You can mention whether the pain point is **provider time**, **turnaround**, or **quality**.'
                ]
            },
            revenue: {
                title: 'Revenue Clarification',
                shortAnswer: 'I can narrow that down if you tell me where the revenue workflow is under pressure.',
                keyPoints: [
                    'You can mention **claims**, **denials**, or **coding follow-up**.',
                    'You can mention whether the issue is **speed**, **accuracy**, or **rework**.'
                ]
            },
            trust: {
                title: 'Trust Clarification',
                shortAnswer: 'I can be more precise if you tell me which trust topic you mean.',
                keyPoints: [
                    'You can ask about **HIPAA**.',
                    'You can ask about **privacy or security safeguards**.',
                    'You can ask about **implementation or operational controls**.'
                ]
            },
            workflows: {
                title: 'Workflow Clarification',
                shortAnswer: 'I can answer better if you tell me which part of the rollout or workflow you want to understand.',
                keyPoints: [
                    'You can ask about **implementation**.',
                    'You can ask about **turnaround**.',
                    'You can ask about which team is carrying the most **manual cleanup** today.'
                ]
            }
        };

        const entry = topicMap[topic];
        if (!entry) {
            return '';
        }

        return buildStructuredResponse({
            title: entry.title,
            shortAnswer: entry.shortAnswer,
            keyPoints: entry.keyPoints,
            nextStep: 'Reply with one more detail and I will keep the answer focused.'
        });
    }

    function buildCalibratedNextStep(topic, pageContext) {
        const topicMap = {
            pricing: 'The fastest next step is usually to compare your documentation profile against the Pricing page or ask which plan fits your workflow.',
            documentation: 'The fastest next step is usually to name the specialty or describe the note burden your providers are dealing with.',
            revenue: 'The best next step is usually to name whether the pressure is in claims, denials, coding follow-up, or cash flow timing.',
            coding: 'The best next step is usually to say whether you care most about specificity, compliance confidence, or reimbursement logic.',
            payroll: 'The best next step is usually to say whether the issue is reconciliation, compensation inputs, or finance handoffs.',
            trust: 'The best next step is usually to say whether you are evaluating HIPAA, privacy controls, or implementation safeguards.',
            contact: 'The best next step is usually to use the demo flow and frame the conversation around the workflow that needs relief first.'
        };

        return topicMap[topic] || pageContext.nextStep;
    }

    function getConfidenceBand(score, kind) {
        const normalizedKind = String(kind || '').trim();

        if (normalizedKind === 'direct') {
            return 'high';
        }

        if (normalizedKind === 'memory') {
            if (score >= 15) {
                return 'high';
            }

            if (score >= 10) {
                return 'medium';
            }

            return 'low';
        }

        if (normalizedKind === 'brain') {
            if (score >= 18) {
                return 'high';
            }

            if (score >= 12) {
                return 'medium';
            }

            return 'low';
        }

        if (normalizedKind === 'knowledge') {
            if (score >= 14) {
                return 'high';
            }

            if (score >= 8) {
                return 'medium';
            }

            return 'low';
        }

        return 'low';
    }

    function getAnswerRepetitionPenalty(answer, question, recentBotMessages, lastUserMessage) {
        const answerKey = createAnswerKey(answer);
        const normalizedQuestion = normalize(question);
        const normalizedLastUser = normalize(lastUserMessage);
        const recentKeys = (Array.isArray(recentBotMessages) ? recentBotMessages : []).map(function (entry) {
            return createAnswerKey(entry?.text || '');
        });

        if (!recentKeys.length) {
            return 0;
        }

        if (recentKeys[recentKeys.length - 1] === answerKey && normalizedQuestion && normalizedQuestion !== normalizedLastUser) {
            return 8;
        }

        if (recentKeys.includes(answerKey) && normalizedQuestion && normalizedQuestion !== normalizedLastUser) {
            return 4;
        }

        return 0;
    }

    function updateSessionFromResult(question, result) {
        const existingSession = getSession() || {};
        const topic = result?.topic || detectTopicFromQuestion(question) || existingSession.activeTopic || '';

        saveSession({
            activeTopic: topic,
            activeTopicLabel: getTopicLabel(topic),
            lastSources: Array.isArray(result?.sources) ? result.sources : (existingSession.lastSources || []),
            lastQuestion: question
        });
    }

    function scoreQueryAgainstText(queryTokens, queryStems, queryNormalized, text, boost) {
        if (!text) {
            return 0;
        }

        const normalizedText = normalize(text);
        if (!normalizedText) {
            return 0;
        }

        const candidateTokens = tokenize(normalizedText);
        const candidateStems = candidateTokens.map(stemWord);
        const queryPhrases = buildTokenPhrases(queryTokens).slice(0, 8);
        let score = boost || 0;

        if (normalizedText.includes(queryNormalized)) {
            score += 10;
        }

        queryPhrases.forEach(function (phrase) {
            if (normalizedText.includes(phrase)) {
                score += phrase.split(' ').length >= 3 ? 4 : 2.5;
            }
        });

        queryTokens.forEach(function (token, index) {
            if (candidateTokens.includes(token)) {
                score += 3;
            } else if (queryStems[index] && candidateStems.includes(queryStems[index])) {
                score += 2;
            } else if (token.length >= 5 && candidateTokens.some(function (candidate) {
                return candidate.includes(token) || token.includes(candidate);
            })) {
                score += 1;
            }
        });

        const overlap = queryTokens.filter(function (token) {
            return candidateTokens.includes(token);
        }).length;

        score += overlap * 0.75;
        return score;
    }

    function buildChunk(url, pageTitle, heading, text, type) {
        const rawText = truncate(String(text || '').replace(/\s+/g, ' ').trim(), 700);

        return {
            url,
            pageTitle,
            heading: heading || pageTitle,
            text: rawText,
            type,
            topic: inferTopicFromPage(url)
        };
    }

    function getNodeText(nodes, maxLength) {
        return truncate(
            Array.from(nodes || [])
                .map(function (node) {
                    return String(node?.textContent || '').replace(/\s+/g, ' ').trim();
                })
                .filter(Boolean)
                .join(' '),
            maxLength || 700
        );
    }

    function dedupeChunks(chunks) {
        const seen = new Set();

        return chunks.filter(function (chunk) {
            const key = `${chunk.url}::${normalize(chunk.heading)}::${normalize(chunk.text)}`;
            if (seen.has(key)) {
                return false;
            }

            seen.add(key);
            return true;
        });
    }

    function addStructuredChildChunks(section, sectionHeading, pageTitle, url, chunks) {
        const structuredNodes = Array.from(section.querySelectorAll(
            'article, details, .premium-card, .detail-card, .surface-panel, .proof-card, .comparison-card, .conversion-card, .implementation-step, .brand-note-card, .icon-detail-card, .pricing-card, .pricing-summary-card, .pricing-addon-card, .faq-item'
        ));

        structuredNodes.forEach(function (node) {
            const headingNode = node.querySelector('h3, h4, summary, strong');
            const headingText = headingNode ? headingNode.textContent.replace(/\+/g, '').trim() : '';
            const heading = headingText ? `${sectionHeading}: ${headingText}` : sectionHeading;
            const text = getNodeText(node.querySelectorAll('p, li, span, strong'), 520);

            if (text && text !== sectionHeading) {
                chunks.push(buildChunk(url, pageTitle, heading, text, 'detail'));
            }
        });
    }

    function extractChunksFromDocument(doc, url) {
        const title = doc.title || url;
        const description = doc.querySelector('meta[name="description"]')?.getAttribute('content') || '';
        const chunks = [];

        if (description) {
            chunks.push(buildChunk(url, title, 'Page summary', description, 'summary'));
        }

        const main = doc.querySelector('main') || doc.body;
        if (!main) {
            return chunks;
        }

        const sections = Array.from(main.querySelectorAll('section'));
        if (!sections.length) {
            const text = truncate(main.textContent, 900);
            if (text) {
                chunks.push(buildChunk(url, title, title, text, 'page'));
            }
            return chunks;
        }

        sections.forEach(function (section) {
            const headingNode = section.querySelector('h1, h2, h3');
            const heading = headingNode ? headingNode.textContent.trim() : title;
            const introText = getNodeText(section.querySelectorAll(':scope > p, :scope > .section-header p, :scope > .hero-grid p, :scope > .hero-content p'), 420);
            const text = getNodeText(section.querySelectorAll('p, li'), 900);

            if (text) {
                chunks.push(buildChunk(url, title, heading, text, 'section'));
            }

            if (introText && introText !== text) {
                chunks.push(buildChunk(url, title, `${heading}: overview`, introText, 'overview'));
            }

            addStructuredChildChunks(section, heading, title, url, chunks);
        });

        return dedupeChunks(chunks);
    }

    async function fetchPageDocument(page) {
        const isCurrentPage = (window.location.pathname.split('/').pop() || 'index.html') === page;
        if (isCurrentPage) {
            return document.cloneNode(true);
        }

        const response = await fetch(page, { credentials: 'same-origin' });
        if (!response.ok) {
            throw new Error(`Failed to load ${page}`);
        }

        const html = await response.text();
        return new DOMParser().parseFromString(html, 'text/html');
    }

    async function trainFromWebsite() {
        if (knowledgeReady) {
            return knowledgeChunks;
        }

        await loadKnowledgeBrain();

        const pageDocuments = await Promise.all(
            KNOWLEDGE_PAGES.map(async function (page) {
                try {
                    const doc = await fetchPageDocument(page);
                    return { page, doc };
                } catch (error) {
                    return null;
                }
            })
        );

        knowledgeChunks = pageDocuments
            .filter(Boolean)
            .flatMap(function (entry) {
                return extractChunksFromDocument(entry.doc, entry.page);
            });

        if (!knowledgeChunks.length) {
            knowledgeChunks = extractChunksFromDocument(
                document,
                window.location.pathname.split('/').pop() || 'index.html'
            );
        }

        knowledgeReady = true;
        return knowledgeChunks;
    }

    function ensureKnowledgeReady() {
        if (!knowledgePromise) {
            knowledgePromise = trainFromWebsite().catch(function () {
                semanticAliasMap = buildSemanticAliasMap(knowledgeBrain);
                knowledgeChunks = extractChunksFromDocument(
                    document,
                    window.location.pathname.split('/').pop() || 'index.html'
                );
                knowledgeReady = true;
                return knowledgeChunks;
            });
        }

        return knowledgePromise;
    }

    function searchMemory(question, recentBotMessages, lastUserMessage) {
        const semanticQuery = buildSemanticQuery(question);
        const feedbackStore = getFeedbackStore();

        return getMemory()
            .map(function (entry) {
                const answerKey = createAnswerKey(entry.answer);
                const feedback = feedbackStore[answerKey] || {};
                const baseScore = scoreQueryAgainstText(
                    semanticQuery.tokens,
                    semanticQuery.stems,
                    semanticQuery.normalized,
                    `${entry.question} ${entry.answer}`,
                    0
                ) + getFeedbackWeight(feedback);
                const repetitionPenalty = getAnswerRepetitionPenalty(
                    entry.answer,
                    question,
                    recentBotMessages,
                    lastUserMessage
                );
                const score = baseScore - repetitionPenalty;

                return { score, baseScore, repetitionPenalty, entry, feedback };
            })
            .filter(function (match) {
                const notHelpfulCount = Number(match.feedback?.notHelpfulCount || 0);
                const helpfulCount = Number(match.feedback?.helpfulCount || 0);
                const heavilyRejected = notHelpfulCount >= 2 && helpfulCount === 0;
                return match.score >= 8 && !heavilyRejected;
            })
            .sort(function (a, b) {
                return b.score - a.score;
            });
    }

    function scoreBrainIntent(intent, semanticQuery) {
        const haystack = [
            intent.title,
            intent.summary,
            intent.bestFit,
            intent.nextStep,
            intent.highlights.join(' '),
            intent.triggers.join(' ')
        ].join(' ');
        const normalizedHaystack = normalize(haystack);
        const baseTokens = semanticQuery.baseTokens || [];
        const matchedBaseTokens = baseTokens.filter(function (token) {
            return normalizedHaystack.includes(token);
        });
        const missingBaseTokens = baseTokens.filter(function (token) {
            return !normalizedHaystack.includes(token);
        });
        let boost = 0;

        if (semanticQuery.topic && intent.topic === semanticQuery.topic) {
            boost += 6;
        }

        if (Array.isArray(intent.sourcePages) && intent.sourcePages.includes(CURRENT_PAGE)) {
            boost += 2;
        }

        intent.triggers.forEach(function (trigger) {
            const normalizedTrigger = normalize(trigger);
            if (!normalizedTrigger) {
                return;
            }

            if (semanticQuery.normalized === normalizedTrigger) {
                boost += 8;
                return;
            }

            if (semanticQuery.normalized.includes(normalizedTrigger) || normalizedTrigger.includes(semanticQuery.normalized)) {
                boost += normalizedTrigger.split(' ').length >= 3 ? 6 : 4;
            }
        });

        boost += matchedBaseTokens.length * 1.5;
        boost -= missingBaseTokens.filter(function (token) {
            return token.length >= 4;
        }).length * 0.75;

        if (/overview/i.test(intent.id || '') && baseTokens.length >= 2 && matchedBaseTokens.length < baseTokens.length) {
            boost -= 2;
        }

        if (/foundation|professional|enterprise|implementation|hipaa|dashboard|specialt/i.test(semanticQuery.normalized) &&
            /overview/i.test(intent.id || '')) {
            boost -= 1.5;
        }

        return scoreQueryAgainstText(
            semanticQuery.tokens,
            semanticQuery.stems,
            semanticQuery.normalized,
            haystack,
            boost
        );
    }

    function searchKnowledgeBrain(question) {
        const semanticQuery = buildSemanticQuery(question);

        return knowledgeBrain.intents
            .map(function (intent) {
                return {
                    intent: intent,
                    score: scoreBrainIntent(intent, semanticQuery)
                };
            })
            .filter(function (match) {
                return match.score >= 9;
            })
            .sort(function (a, b) {
                return b.score - a.score;
            })
            .slice(0, 5);
    }

    function searchKnowledge(question) {
        const semanticQuery = buildSemanticQuery(question);
        const detectedTopic = semanticQuery.topic;

        return knowledgeChunks
            .map(function (chunk) {
                let boost = 0;

                if (chunk.type === 'summary') {
                    boost += 2;
                }

                if (chunk.type === 'overview') {
                    boost += 1.5;
                }

                if (chunk.type === 'detail') {
                    boost += 1;
                }

                if (detectedTopic && chunk.topic === detectedTopic) {
                    boost += 5;
                }

                if (chunk.url === CURRENT_PAGE) {
                    boost += 1.25;
                }

                if (semanticQuery.normalized && normalize(chunk.heading).includes(semanticQuery.normalized)) {
                    boost += 4;
                }

                const score = scoreQueryAgainstText(
                    semanticQuery.tokens,
                    semanticQuery.stems,
                    semanticQuery.normalized,
                    `${chunk.pageTitle} ${chunk.heading} ${chunk.text}`,
                    boost
                );

                return { score, chunk };
            })
            .filter(function (match) {
                return match.score >= 5;
            })
            .sort(function (a, b) {
                return b.score - a.score;
            })
            .slice(0, 7);
    }

    function splitIntoSentences(text) {
        return String(text || '')
            .split(/(?<=[.!?])\s+/)
            .map(function (sentence) {
                return sentence.trim();
            })
            .filter(Boolean);
    }

    function toTitleCase(text) {
        return String(text || '')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/\b\w/g, function (char) {
                return char.toUpperCase();
            });
    }

    function getPageContext() {
        return PAGE_CONTEXTS[CURRENT_PAGE] || {
            label: 'general',
            nextStep: "If you'd like, I can also point you to the most relevant page or next conversation step."
        };
    }

    function formatSourceLabel(source) {
        const raw = String(source || '').trim().toLowerCase();
        const labels = {
            'index.html': 'Homepage',
            'about.html': 'About',
            'pricing.html': 'Pricing',
            'scribing.html': 'Clinical Documentation',
            'billing.html': 'Revenue Cycle',
            'coding.html': 'Coding & Compliance',
            'payroll.html': 'Payroll Administration',
            'specialties.html': 'Specialties',
            'hipaa.html': 'Trust Center',
            'privacy.html': 'Privacy',
            'terms.html': 'Terms',
            'contact.html': 'Contact'
        };

        if (labels[raw]) {
            return labels[raw];
        }

        return toTitleCase(raw.replace(/\.html$/i, '').replace(/[-_]/g, ' '));
    }

    function buildSourceLinks(sources) {
        const safeSources = Array.isArray(sources) ? unique(sources).slice(0, 3) : [];
        if (!safeSources.length) {
            return [];
        }

        return safeSources.map(function (source) {
            return `- [${formatSourceLabel(source)}](${source})`;
        });
    }

    function buildFitGuidance(topic, shortAnswer, keyPoints, sources) {
        const sourceTopic = inferTopicFromSources(sources);
        const resolvedTopic = topic || sourceTopic || '';
        const guidanceMap = {
            pricing: 'If your team is comparing plans, the fastest way to narrow fit is to look at documentation complexity first, then decide how much review support the workflow needs.',
            documentation: 'This is usually the best fit when providers need note relief quickly and the practice wants cleaner documentation before downstream teams touch it.',
            revenue: 'This becomes more valuable when chart quality is already affecting coding confidence, claim readiness, or denial follow-up.',
            coding: 'This is usually the right fit when specificity, compliance confidence, or reimbursement logic need stronger review before submission.',
            payroll: 'This is most useful when compensation inputs, schedules, and finance handoffs are still being reconciled manually.',
            trust: 'This matters most when your team is evaluating whether the workflow can be trusted operationally, not just whether a policy exists on paper.',
            workflows: 'The strongest next conversation is usually about where the current workflow is slowing down and which team is absorbing the cleanup today.',
            services: 'The right starting point usually depends on which handoff is creating the most pressure today: provider charting, coding, billing, or finance operations.',
            specialties: 'Specialty fit usually comes down to note structure, vocabulary, documentation density, and how much variation exists between providers.',
            contact: 'The best next step is usually a short walkthrough framed around the workflow that needs relief first, rather than a general product tour.'
        };

        if (guidanceMap[resolvedTopic]) {
            return guidanceMap[resolvedTopic];
        }

        const normalizedShortAnswer = normalize(shortAnswer);
        if (normalizedShortAnswer.includes('price') || normalizedShortAnswer.includes('pricing')) {
            return guidanceMap.pricing;
        }

        if (keyPoints.some(function (point) { return /hipaa|privacy|trust/i.test(point); })) {
            return guidanceMap.trust;
        }

        return 'The most useful next step is usually to match this answer to the workflow, team, or service area you are evaluating right now.';
    }

    function buildConsultativeLead(topic, shortAnswer) {
        const resolvedTopic = topic || '';
        // Pricing and trust have no generic lead: their real answers (plan prices,
        // named privacy laws) are more useful than any summary line.
        const leadMap = {
            documentation: 'The practical takeaway is that Anot is designed to reduce charting burden without asking your team to rely on unreviewed output.',
            revenue: 'The practical takeaway is that revenue support matters most when documentation quality is already creating rework downstream.',
            coding: 'The short version is that coding support becomes valuable when specificity and reimbursement logic need stronger review before submission.',
            payroll: 'The short version is that payroll support is most useful when provider compensation inputs still require manual reconciliation.',
            workflows: 'The short version is that implementation is meant to stabilize the highest-pressure workflow first, then expand deliberately.'
        };

        return leadMap[resolvedTopic] || shortAnswer;
    }

    function buildStructuredResponse(options) {
        const response = [];
        const title = String(options?.title || '').trim();
        const shortAnswer = String(options?.shortAnswer || '').trim();
        const keyPoints = Array.isArray(options?.keyPoints) ? options.keyPoints.filter(Boolean) : [];
        const nextStep = String(options?.nextStep || '').trim();
        const sources = Array.isArray(options?.sources) ? options.sources.filter(Boolean) : [];
        const fitGuidance = String(options?.fitGuidance || '').trim();

        if (title) {
            response.push(`**${title}**`);
        }

        if (shortAnswer) {
            response.push(`**Overview**\n${shortAnswer}`);
        }

        if (keyPoints.length) {
            response.push(`**Highlights**\n${keyPoints.map(function (point) {
                return `- ${point}`;
            }).join('\n')}`);
        }

        if (fitGuidance) {
            response.push(`**Best Fit**\n${fitGuidance}`);
        }

        if (nextStep) {
            response.push(`**Recommended Next Step**\n${nextStep}`);
        }

        if (sources.length) {
            response.push(`**Source Pages**\n${buildSourceLinks(sources).join('\n')}`);
        }

        return response.join('\n\n');
    }

    function structureExtractedAnswer(heading, sentences, sources, topic) {
        const cleanHeading = heading && !/page summary/i.test(heading)
            ? toTitleCase(heading)
            : 'Relevant Website Answer';
        const pageContext = getPageContext();
        const resolvedTopic = topic || inferTopicFromSources(sources);
        const shortAnswer = sentences[0] || '';

        return buildStructuredResponse({
            title: cleanHeading,
            shortAnswer: buildConsultativeLead(resolvedTopic, shortAnswer),
            keyPoints: sentences.slice(1, 4),
            fitGuidance: buildFitGuidance(resolvedTopic, shortAnswer, sentences.slice(1, 4), sources),
            nextStep: pageContext.nextStep,
            sources: sources
        });
    }

    function structureDirectAnswer(entry, topic) {
        const pageContext = getPageContext();
        const resolvedTopic = topic || detectTopicFromQuestion(entry.title) || '';

        return buildStructuredResponse({
            title: entry.title,
            shortAnswer: buildConsultativeLead(resolvedTopic, entry.shortAnswer),
            keyPoints: entry.keyPoints,
            fitGuidance: buildFitGuidance(resolvedTopic, entry.shortAnswer, entry.keyPoints, []),
            nextStep: pageContext.nextStep
        });
    }

    function structureBrainAnswer(intent) {
        const pageContext = getPageContext();
        const fallbackNextStep = intent.nextStep || pageContext.nextStep;

        return buildStructuredResponse({
            title: intent.title,
            shortAnswer: buildConsultativeLead(intent.topic, intent.summary),
            keyPoints: intent.highlights,
            fitGuidance: intent.bestFit || buildFitGuidance(intent.topic, intent.summary, intent.highlights, intent.sourcePages),
            nextStep: fallbackNextStep,
            sources: intent.sourcePages
        });
    }

    function buildBrainAnswer(match) {
        if (!match?.intent) {
            return {
                answer: '',
                sources: [],
                topic: '',
                score: 0,
                confidence: 'low'
            };
        }

        return {
            answer: structureBrainAnswer(match.intent),
            sources: match.intent.sourcePages || [],
            topic: match.intent.topic || '',
            score: match.score || 0,
            confidence: getConfidenceBand(match.score || 0, 'brain'),
            answerType: 'brain'
        };
    }

    function selectBestBrainAnswer(matches, question, recentBotMessages, lastUserMessage) {
        if (!Array.isArray(matches) || !matches.length) {
            return null;
        }

        const candidates = matches.map(function (match) {
            const built = buildBrainAnswer(match);
            const repetitionPenalty = getAnswerRepetitionPenalty(
                built.answer,
                question,
                recentBotMessages,
                lastUserMessage
            );

            return {
                candidate: built,
                adjustedScore: (built.score || 0) - repetitionPenalty,
                repetitionPenalty: repetitionPenalty
            };
        }).sort(function (a, b) {
            return b.adjustedScore - a.adjustedScore;
        });

        return candidates[0]?.candidate || null;
    }

    function buildAnswerFromChunks(question, matches) {
        const semanticQuery = buildSemanticQuery(question);
        const candidateSentences = [];

        matches.forEach(function (match) {
            splitIntoSentences(match.chunk.text).forEach(function (sentence) {
                const score = scoreQueryAgainstText(
                    semanticQuery.tokens,
                    semanticQuery.stems,
                    semanticQuery.normalized,
                    sentence,
                    match.score * 0.1
                );

                candidateSentences.push({
                    sentence,
                    score,
                    url: match.chunk.url,
                    heading: match.chunk.heading
                });
            });
        });

        const bestSentences = candidateSentences
            .filter(function (item) {
                return item.score >= 3;
            })
            .sort(function (a, b) {
                return b.score - a.score;
            })
            .reduce(function (accumulator, item) {
                if (!accumulator.some(function (existing) {
                    return existing.sentence === item.sentence;
                })) {
                    accumulator.push(item);
                }
                return accumulator;
            }, [])
            .slice(0, 4);

        if (!bestSentences.length) {
            return {
                answer: '',
                sources: []
            };
        }

        const sources = unique(bestSentences.map(function (item) {
            return item.url;
        })).slice(0, 3);
        const topic = inferTopicFromSources(sources);

        return {
            answer: structureExtractedAnswer(matches[0].chunk.heading, bestSentences.map(function (item) {
                return item.sentence;
            }), sources, topic),
            sources: sources,
            topic: topic,
            score: matches[0]?.score || 0,
            confidence: getConfidenceBand(matches[0]?.score || 0, 'knowledge'),
            answerType: 'website'
        };
    }

    function getDirectResponse(question) {
        const normalizedQuestion = normalize(question);
        const match = DIRECT_RESPONSES.find(function (entry) {
            return entry.patterns.some(function (pattern) {
                return pattern.test(normalizedQuestion);
            });
        });

        return match ? {
            answer: structureDirectAnswer(match, detectTopicFromQuestion(question)),
            topic: detectTopicFromQuestion(question) || inferTopicFromSources(match.sources || []) || '',
            sources: [],
            score: 999,
            confidence: 'high',
            answerType: 'direct'
        } : null;
    }

    async function getBotAnswer(question) {
        const normalizedQuestion = normalize(question);
        const pageContext = getPageContext();
        const session = getSession();
        const explicitTopic = detectTopicFromQuestion(question);
        const contextualQuestion = buildContextualQuestion(question, session, explicitTopic);
        const recentBotMessages = getRecentBotMessages(3);
        const lastUserMessage = getLastUserMessage();

        if (/^(hi|hello|hey|good morning|good afternoon|good evening|yo|howdy)\b/.test(normalizedQuestion)) {
            return {
                answer: buildStructuredResponse({
                    title: 'Welcome',
                    shortAnswer: "I'm the Anot AI Assistant, and I use Anot's website, a curated knowledge brain, and past chats to answer questions more precisely.",
                    keyPoints: [
                        'I learn from the Anot Health website.',
                        'I use a curated local knowledge brain for higher-confidence answers.',
                        'I also use past chats to improve matching.',
                        'I can help with services, pricing, HIPAA, workflows, specialties, and demos.'
                    ],
                    fitGuidance: 'The best way to use me is to ask about the workflow, plan, or service area you are actually comparing right now.',
                    nextStep: pageContext.nextStep
                }),
                sources: [],
                topic: ''
            };
        }

        if (/\b(diagnosis|diagnose|treatment|treat|prescription|symptom|symptoms|medicine|medication|legal advice|lawyer|lawsuit)\b/.test(normalizedQuestion)) {
            return {
                answer: buildStructuredResponse({
                    title: 'What I Can Help With',
                    shortAnswer: "I can't provide medical, diagnosis, treatment, or legal advice.",
                    keyPoints: [
                        "I can explain Anot Health's services and workflows.",
                        'I can summarize documentation, billing, coding, payroll, HIPAA, and demo topics.'
                    ],
                    fitGuidance: 'If your question is really about how Anot supports a workflow or team, I can still answer that clearly.',
                    nextStep: pageContext.nextStep
                }),
                sources: [],
                topic: ''
            };
        }

        if (contextualQuestion.needsClarification) {
            return {
                answer: buildClarificationResponse(session),
                sources: [],
                topic: session?.activeTopic || '',
                confidence: 'low',
                shouldRemember: false
            };
        }

        await ensureKnowledgeReady();

        // Memory scoring is lexical and loose, so only reuse a remembered answer
        // when it was given for the same topic the visitor is asking about now.
        const memoryMatches = searchMemory(
            contextualQuestion.effectiveQuestion,
            recentBotMessages,
            lastUserMessage
        ).filter(function (match) {
            return !explicitTopic || detectTopicFromQuestion(match.entry.question) === explicitTopic;
        });
        if (memoryMatches.length && memoryMatches[0].score >= 11) {
            const memoryConfidence = getConfidenceBand(memoryMatches[0].score, 'memory');
            return {
                answer: memoryMatches[0].entry.answer,
                sources: memoryMatches[0].entry.sources || [],
                topic: explicitTopic || inferTopicFromSources(memoryMatches[0].entry.sources || []) || session?.activeTopic || '',
                confidence: memoryConfidence,
                score: memoryMatches[0].score,
                answerType: 'memory'
            };
        }

        const directResponse = getDirectResponse(contextualQuestion.effectiveQuestion);
        if (directResponse && !getAnswerRepetitionPenalty(directResponse.answer, contextualQuestion.effectiveQuestion, recentBotMessages, lastUserMessage)) {
            return directResponse;
        }

        const brainMatches = searchKnowledgeBrain(contextualQuestion.effectiveQuestion);
        const brainAnswer = selectBestBrainAnswer(
            brainMatches,
            contextualQuestion.effectiveQuestion,
            recentBotMessages,
            lastUserMessage
        );
        const knowledgeMatches = searchKnowledge(contextualQuestion.effectiveQuestion);
        const extracted = buildAnswerFromChunks(contextualQuestion.effectiveQuestion, knowledgeMatches);
        const useBrainAnswer = brainAnswer?.answer && (
            !extracted.answer ||
            (brainAnswer.score >= extracted.score + 2) ||
            (brainAnswer.confidence === 'high' && extracted.confidence !== 'high')
        );
        const selectedAnswer = useBrainAnswer ? brainAnswer : extracted;

        if (selectedAnswer?.answer) {
            const resolvedTopic = explicitTopic || selectedAnswer.topic || inferTopicFromSources(selectedAnswer.sources) || session?.activeTopic || '';
            if (selectedAnswer.confidence === 'low' && resolvedTopic) {
                const targetedClarification = buildTopicClarification(resolvedTopic);
                if (targetedClarification) {
                    return {
                        answer: targetedClarification,
                        sources: selectedAnswer.sources,
                        topic: resolvedTopic,
                        confidence: 'low',
                        shouldRemember: false
                    };
                }
            }

            return {
                answer: selectedAnswer.answer,
                sources: selectedAnswer.sources,
                topic: resolvedTopic,
                confidence: selectedAnswer.confidence,
                score: selectedAnswer.score,
                answerType: selectedAnswer.answerType || (useBrainAnswer ? 'brain' : 'website')
            };
        }

        if (contextualQuestion.usedSessionContext && session?.activeTopic) {
            return {
                answer: buildClarificationResponse(session),
                sources: [],
                topic: session.activeTopic,
                confidence: 'low',
                shouldRemember: false
            };
        }

        if (explicitTopic) {
            const targetedClarification = buildTopicClarification(explicitTopic);
            if (targetedClarification) {
                return {
                    answer: targetedClarification,
                    sources: [],
                    topic: explicitTopic,
                    confidence: 'low',
                    shouldRemember: false
                };
            }
        }

        return {
            answer: buildStructuredResponse({
                title: 'Best Direction',
                shortAnswer: "I don't have a strong enough match to answer that confidently yet.",
                keyPoints: [
                    'I can still help with services, pricing, workflows, HIPAA, specialties, and demos.',
                    'A more specific question usually produces a much sharper answer.'
                ],
                fitGuidance: 'The easiest way to improve the answer is to mention the service line, specialty, team type, or workflow you mean.',
                nextStep: buildCalibratedNextStep(explicitTopic || session?.activeTopic || '', pageContext)
            }),
            sources: [],
            topic: explicitTopic || '',
            confidence: 'low',
            shouldRemember: false
        };
    }

    // Links may only point at web, mail or same-site addresses; anything else
    // (javascript:, data:, ...) is rendered as plain text.
    const SAFE_LINK_RE = /^(https?:\/\/|mailto:|\/|#|[\w-]+\.html)/i;

    function renderInlineMarkdown(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (match, label, href) {
                return SAFE_LINK_RE.test(href) ? `<a href="${href}" class="chatbot-link">${label}</a>` : label;
            });
    }

    function formatMessage(text) {
        const blocks = String(text || '')
            .trim()
            .split(/\n\s*\n/)
            .map(function (block) {
                return block.trim();
            })
            .filter(Boolean);

        if (!blocks.length) {
            return '';
        }

        return blocks.map(function (block) {
            const lines = block.split('\n').map(function (line) {
                return line.trim();
            }).filter(Boolean);

            if (!lines.length) {
                return '';
            }

            const allBulletLines = lines.every(function (line) {
                return /^-\s+/.test(line);
            });

            if (allBulletLines) {
                return `<ul>${lines.map(function (line) {
                    return `<li>${renderInlineMarkdown(line.replace(/^-\s+/, ''))}</li>`;
                }).join('')}</ul>`;
            }

            if (lines.length > 1 && /^-\s+/.test(lines[1])) {
                const intro = `<p>${renderInlineMarkdown(lines[0])}</p>`;
                const bullets = `<ul>${lines.slice(1).map(function (line) {
                    return `<li>${renderInlineMarkdown(line.replace(/^-\s+/, ''))}</li>`;
                }).join('')}</ul>`;
                return `${intro}${bullets}`;
            }

            return `<p>${renderInlineMarkdown(lines.join(' '))}</p>`;
        }).join('');
    }

    // =====================================================================================
    // Chat interface ("Ask Anot"). What the design is built around:
    //  - It says what it can answer and offers starter buttons that change with the page and
    //    region; every answer is followed by topic buttons, so most questions need no typing.
    //  - While a reply streams there is a live caret and a real Stop button. The view never
    //    chases the reply: the question is pinned near the top so the answer is read from its
    //    start.
    //  - The conversation survives page changes (sessionStorage, this tab only) so a visitor
    //    can follow a link and come back. "New chat" clears it.
    //  - A person is always one click away, and the small print says what it is and is not.
    //  - Keyboard and screen readers: non-modal dialog, Esc closes, focus returns to the
    //    launcher, each reply is announced once when complete (not token by token), and
    //    motion is switched off for people who ask for that.
    // =====================================================================================

    const ICON_PATHS = {
        sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15.5l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z"/>',
        send: '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
        stop: '<rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/>',
        close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
        compose: '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.4 2.6a2.1 2.1 0 1 1 3 3L12 15l-4 1 1-4Z"/>',
        expand: '<path d="M15 3h6v6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/><path d="M9 21H3v-6"/>',
        shrink: '<path d="m14 10 7-7"/><path d="M20 10h-6V4"/><path d="m3 21 7-7"/><path d="M4 14h6v6"/>',
        up: '<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>',
        arrowDown: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
        down: '<path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/>',
        copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
        check: '<path d="M20 6 9 17l-5-5"/>',
        go: '<path d="m9 18 6-6-6-6"/>',
        calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
        mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
        tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".6" fill="currentColor"/>',
        shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
        flow: '<rect width="8" height="8" x="3" y="3" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><rect width="8" height="8" x="13" y="13" rx="2"/>',
        users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
        plug: '<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>',
        clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
        file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m9 15 2 2 4-4"/>',
        wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>'
    };

    function icon(name, size) {
        const px = size || 18;
        return '<svg xmlns="http://www.w3.org/2000/svg" width="' + px + '" height="' + px + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + ICON_PATHS[name] + '</svg>';
    }

    const REGION_KEY = isCanadianChat ? 'ca' : 'us';
    const REGION_LABEL = isCanadianChat ? 'Canada · CAD' : 'US · USD';
    const CONTACT_URL = isCanadianChat ? 'contact-ca.html' : 'contact.html';
    const DEMO_URL = CONTACT_URL + '?focus=demo#demo-form';
    const TEAM_EMAIL = 'admin@anot.health';
    const UI_SESSION_KEY = 'anot-chat-session-v4';
    const UI_TEASER_KEY = 'anot-chat-teaser-v1';
    const UI_WIDE_KEY = 'anot-chat-wide-v1';
    const UI_MAX_ENTRIES = 24;
    const UI_MAX_AGE_MS = 6 * 60 * 60 * 1000;

    function uiStorageGet(key) {
        try {
            return window.sessionStorage.getItem(key);
        } catch (error) {
            return null;
        }
    }

    function uiStorageSet(key, value) {
        try {
            window.sessionStorage.setItem(key, value);
        } catch (error) {
            // Storage blocked: the chat still works, it just will not survive a page change.
        }
    }

    function uiStorageRemove(key) {
        try {
            window.sessionStorage.removeItem(key);
        } catch (error) {
            // Ignore.
        }
    }

    // Which kind of page the visitor is on, so the starters and the nudge fit what they are reading.
    const PAGE_TOPIC = (function () {
        const file = CURRENT_PAGE.replace(/\.html$/, '');
        if (!file || /^(index|homepage-ca)$/.test(file)) { return 'home'; }
        if (/^pricing/.test(file)) { return 'pricing'; }
        if (/^scribing/.test(file)) { return 'scribing'; }
        if (/^billing/.test(file)) { return 'billing'; }
        if (/^coding/.test(file)) { return 'coding'; }
        if (/^payroll/.test(file)) { return 'payroll'; }
        if (/^specialties/.test(file)) { return 'specialties'; }
        if (/^(hipaa|pipeda)/.test(file)) { return 'trust'; }
        if (/^about/.test(file)) { return 'about'; }
        if (/^contact/.test(file)) { return 'contact'; }
        return 'home';
    })();

    // Questions the buttons send. Each one is answerable from the site's own pages.
    const ASK = {
        cost: { icon: 'tag', label: 'What does it cost?', ask: "How much does Anot cost, and what's the difference between the plans?" },
        plans: { icon: 'tag', label: 'Which plan fits my practice?', ask: "Which plan fits a small practice, and what's the difference between AI Scribe and Verified Scribe?" },
        verified: { icon: 'shield', label: "What's in Verified Scribe?", ask: 'What do I get with Verified Scribe?' },
        yearly: { icon: 'tag', label: 'Is there a yearly discount?', ask: 'Is there a discount if I pay yearly, and do I have to sign a contract?' },
        how: { icon: 'flow', label: 'How does it work?', ask: "How does Anot work, and where do people check the AI's work?" },
        review: { icon: 'flow', label: 'How does human review work?', ask: 'Is it only AI, or does a person check the notes?' },
        who: { icon: 'users', label: 'Who is it for?', ask: 'Who is Anot for, and which specialties do you support?' },
        specialties: { icon: 'users', label: 'Which specialties do you support?', ask: 'Which medical specialties do you support?' },
        ehr: isCanadianChat
            ? { icon: 'plug', label: 'Which EMRs do you work with?', ask: 'Which EMRs do you work with?' }
            : { icon: 'plug', label: 'Do you work with my EHR?', ask: 'Do you work with Epic or athenahealth?' },
        trust: isCanadianChat
            ? { icon: 'shield', label: 'Is my data kept in Canada?', ask: 'Where is our patient data stored, and are you PIPEDA and PHIPA compliant?' }
            : { icon: 'shield', label: 'Is it HIPAA compliant?', ask: 'Is Anot HIPAA compliant, and do you sign a BAA?' },
        security: isCanadianChat
            ? { icon: 'shield', label: 'Do you sign an IMA?', ask: 'Do you sign an information manager agreement with clinics?' }
            : { icon: 'shield', label: 'How is data encrypted?', ask: 'How is our patient data encrypted?' },
        claims: isCanadianChat
            ? { icon: 'clock', label: 'Do you handle OHIP billing?', ask: 'Do you handle provincial billing such as OHIP?' }
            : { icon: 'clock', label: 'How fast do claims get paid?', ask: 'How quickly do claims get paid?' },
        denials: { icon: 'clock', label: 'Can you reduce denials?', ask: 'How do you help reduce claim denials?' },
        coders: { icon: 'file', label: 'Who reviews the codes?', ask: 'Who reviews the codes, and are they certified?' },
        accuracy: { icon: 'file', label: 'How accurate is the coding?', ask: 'How does Anot improve coding accuracy and audit confidence?' },
        payroll: isCanadianChat
            ? { icon: 'wallet', label: 'Can you handle FHO bonuses?', ask: 'Can you handle FHO roster bonuses in payroll?' }
            : { icon: 'wallet', label: 'How do you handle RVU bonuses?', ask: 'What does your payroll service do about RVU bonuses?' },
        payrollScope: { icon: 'wallet', label: 'What does payroll cover?', ask: 'What does your payroll service cover?' },
        demo: { icon: 'calendar', label: 'How do I book a demo?', ask: 'How do I book a demo?' }
    };

    const STARTERS = {
        home: ['cost', 'trust', 'how', 'who'],
        about: ['how', 'who', 'trust', 'cost'],
        pricing: ['plans', 'verified', 'yearly', 'trust'],
        scribing: ['review', 'ehr', 'cost', 'trust'],
        billing: ['claims', 'denials', 'cost', 'demo'],
        coding: ['coders', 'accuracy', 'cost', 'demo'],
        payroll: ['payroll', 'payrollScope', 'cost', 'demo'],
        specialties: ['specialties', 'ehr', 'cost', 'demo'],
        trust: ['trust', 'security', 'ehr', 'cost'],
        contact: ['cost', 'trust', 'how', 'who']
    };

    // Follow-up buttons after an answer, by the topic the local engine detects in the question.
    const FOLLOW_UPS = {
        pricing: ['verified', 'yearly', 'ehr'],
        documentation: ['review', 'ehr', 'cost'],
        revenue: ['claims', 'denials', 'cost'],
        coding: ['coders', 'accuracy', 'cost'],
        payroll: ['payroll', 'payrollScope', 'cost'],
        trust: ['trust', 'security', 'ehr'],
        workflows: ['review', 'ehr', 'cost'],
        services: ['cost', 'how', 'trust'],
        specialties: ['specialties', 'ehr', 'cost'],
        contact: ['cost', 'trust', 'how']
    };
    const FOLLOW_UP_FILL = ['cost', 'trust', 'how', 'who'];

    const TEASERS = {
        home: 'Questions about pricing or security? Ask me.',
        about: 'Want to know how Anot works? Ask me.',
        pricing: 'Not sure which plan fits? I can compare them for you.',
        scribing: 'Curious how human review works? Ask me.',
        billing: 'Wondering how quickly claims get paid?',
        coding: 'Want to know who reviews the codes?',
        payroll: 'Questions about payroll workflows? Ask me.',
        specialties: 'Wondering if we support your specialty?',
        trust: isCanadianChat ? 'Have a PIPEDA question? I can answer it.' : 'Have a HIPAA question? I can answer it.'
    };

    const style = document.createElement('style');
    style.textContent = `
    .chatbot-container,.chatbot-fab,.chatbot-teaser{--ac-blue:#1D4ED8;--ac-blue-deep:#1E40AF;--ac-navy:#0F172A;--ac-ink:#0F172A;--ac-muted:#475569;--ac-line:#E2E8F0;--ac-soft:#F1F5F9;--ac-tint:#EFF6FF;--ac-ease:cubic-bezier(.2,.8,.2,1);font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif}
    .chatbot-container *,.chatbot-fab *,.chatbot-teaser *{box-sizing:border-box}
    .chatbot-container button,.chatbot-fab,.chatbot-teaser button{font-family:inherit;margin:0;-webkit-tap-highlight-color:transparent}
    .chatbot-container :focus-visible,.chatbot-fab:focus-visible,.chatbot-teaser :focus-visible{outline:2px solid var(--ac-blue-deep);outline-offset:2px}
    .chatbot-header :focus-visible{outline-color:#fff!important}

    .chatbot-fab{position:fixed;left:24px;bottom:24px;z-index:10000;display:flex;align-items:center;gap:10px;height:56px;padding:0 22px 0 8px;border:0;border-radius:999px;background:var(--ac-blue);color:#fff;font-size:.95rem;font-weight:600;letter-spacing:-.005em;cursor:pointer;box-shadow:0 16px 36px -12px rgba(29,78,216,.55);transition:transform .2s var(--ac-ease),box-shadow .2s,opacity .2s,visibility 0s}
    .chatbot-fab:hover{transform:translateY(-2px);background:var(--ac-blue-deep);box-shadow:0 20px 40px -12px rgba(29,78,216,.6)}
    .chatbot-fab-mark{position:relative;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.18)}
    .chatbot-fab-mark::after{content:'';position:absolute;inset:-4px;border-radius:50%;border:2px solid rgba(255,255,255,.75);opacity:0;animation:chatPulse 2.4s var(--ac-ease) 1.2s 2}
    .chatbot-fab.is-hidden,.chatbot-fab.is-parked{opacity:0;visibility:hidden;pointer-events:none;transform:scale(.9)}

    .chatbot-teaser{position:fixed;left:24px;bottom:96px;z-index:10000;display:flex;align-items:stretch;max-width:288px;background:#fff;border-radius:16px;box-shadow:0 18px 40px -14px rgba(15,23,42,.4),0 0 0 1px rgba(15,23,42,.06);animation:chatIn .28s var(--ac-ease) both}
    .chatbot-teaser[hidden]{display:none}
    .chatbot-teaser-main{display:flex;align-items:center;gap:10px;padding:12px 4px 12px 12px;border:0;background:transparent;text-align:left;cursor:pointer;color:var(--ac-ink);font-size:.86rem;line-height:1.4;font-weight:550;border-radius:16px 0 0 16px}
    .chatbot-teaser-mark{flex:none;width:28px;height:28px;border-radius:9px;display:grid;place-items:center;color:#fff;background:var(--ac-blue)}
    .chatbot-teaser-close{flex:none;width:40px;border:0;background:transparent;color:#64748B;cursor:pointer;border-radius:0 16px 16px 0;display:grid;place-items:center}
    .chatbot-teaser-close:hover{color:var(--ac-ink)}

    .chatbot-container{position:fixed;left:24px;bottom:24px;z-index:10001;display:flex;flex-direction:column;width:400px;height:680px;max-width:calc(100vw - 32px);max-height:calc(100vh - 48px);max-height:calc(100dvh - 48px);overflow:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;background:#fff;color:var(--ac-ink);border-radius:22px;box-shadow:0 36px 70px -18px rgba(15,23,42,.42),0 0 0 1px rgba(15,23,42,.07);opacity:0;visibility:hidden;transform:translateY(14px) scale(.97);transform-origin:bottom left;transition:opacity .2s var(--ac-ease),transform .26s var(--ac-ease),visibility 0s .26s,width .25s var(--ac-ease),height .25s var(--ac-ease)}
    .chatbot-container.is-open{opacity:1;visibility:visible;transform:none;transition:opacity .2s var(--ac-ease),transform .26s var(--ac-ease),visibility 0s,width .25s var(--ac-ease),height .25s var(--ac-ease)}
    .chatbot-container.is-wide{width:580px;height:780px}

    .chatbot-header{position:relative;flex:none;display:flex;align-items:center;gap:12px;padding:14px 10px 14px 16px;color:#fff;background:var(--ac-navy)}
    .chatbot-mark{flex:none;width:40px;height:40px;border-radius:13px;display:grid;place-items:center;background:var(--ac-blue);box-shadow:inset 0 0 0 1px rgba(255,255,255,.22)}
    .chatbot-title-wrap{min-width:0}
    .chatbot-container .chatbot-title{margin:0;font-size:1.05rem;line-height:1.2;font-weight:650;letter-spacing:-.015em;color:#fff}
    .chatbot-title-row{display:flex;align-items:center;gap:8px}
    .chatbot-container .chatbot-subtitle{margin:3px 0 0;font-size:.75rem;line-height:1.2;color:#CBD5E1}
    .chatbot-region{flex:none;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.16);color:#fff;font-size:.68rem;font-weight:650;letter-spacing:.02em}
    .chatbot-actions{margin-left:auto;display:flex;gap:2px}
    .chatbot-icon-btn{width:36px;height:36px;border:0;border-radius:11px;background:transparent;color:#E2E8F0;display:grid;place-items:center;cursor:pointer;transition:background .15s,color .15s}
    .chatbot-icon-btn:hover{background:rgba(255,255,255,.16);color:#fff}

    .chatbot-body{position:relative;flex:1;min-height:0;display:flex;flex-direction:column}
    .chatbot-messages{position:relative;flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:20px 16px 8px;display:flex;flex-direction:column;gap:20px;background:#fff}
    .chatbot-messages:focus-visible{outline-offset:-3px}
    .chatbot-more{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);display:inline-flex;align-items:center;gap:6px;padding:8px 14px 8px 12px;border:0;border-radius:999px;background:var(--ac-navy);color:#fff;font-size:.8rem;font-weight:600;cursor:pointer;box-shadow:0 12px 24px -10px rgba(15,23,42,.6);animation:chatIn .2s var(--ac-ease) both}
    .chatbot-more[hidden]{display:none}
    .chatbot-status{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

    .chatbot-welcome{display:flex;flex-direction:column;gap:14px}
    .chatbot-container .chatbot-welcome h3{margin:0;font-size:1.3rem;line-height:1.2;font-weight:700;letter-spacing:-.02em;color:var(--ac-ink)}
    .chatbot-container .chatbot-welcome p{margin:6px 0 0;font-size:.9rem;line-height:1.55;color:var(--ac-muted)}
    .chatbot-starters{display:flex;flex-direction:column;gap:7px}
    .chatbot-starter{display:flex;align-items:center;gap:12px;width:100%;min-height:50px;padding:8px 12px 8px 10px;border:1px solid var(--ac-line);border-radius:14px;background:#fff;color:var(--ac-ink);text-align:left;font-size:.9rem;font-weight:550;cursor:pointer;transition:border-color .15s,box-shadow .15s,transform .15s,background .15s}
    .chatbot-starter:hover{border-color:#93C5FD;background:#FAFCFF;box-shadow:0 8px 20px -12px rgba(37,99,235,.55);transform:translateY(-1px)}
    .chatbot-starter-icon{flex:none;width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:var(--ac-tint);color:var(--ac-blue-deep)}
    .chatbot-starter-text{flex:1;line-height:1.3}
    .chatbot-starter-go{flex:none;color:#64748B}
    .chatbot-container .chatbot-human{margin:2px 0 0;display:flex;align-items:flex-start;gap:10px;padding:12px;border-radius:14px;background:var(--ac-soft);font-size:.82rem;line-height:1.5;color:var(--ac-muted)}
    .chatbot-human svg{flex:none;margin-top:2px;color:#334155}
    .chatbot-human a{color:var(--ac-blue-deep);font-weight:600}

    .chat-message{display:flex;gap:10px;max-width:100%;animation:chatIn .22s var(--ac-ease) both}
    .chat-message.is-restored{animation:none}
    .chat-message.user{justify-content:flex-end}
    .chat-message.user .chat-bubble{max-width:86%;padding:10px 14px;border-radius:18px 18px 5px 18px;background:var(--ac-blue);color:#fff;font-size:.92rem;line-height:1.5;overflow-wrap:anywhere}
    .chat-message.user .chat-bubble p{margin:0}
    .chat-avatar{position:relative;flex:none;width:30px;height:30px;margin-top:1px;border-radius:10px;display:grid;place-items:center;color:#fff;background:var(--ac-blue)}
    .chat-avatar.is-working::after{content:'';position:absolute;inset:-4px;border-radius:13px;background:conic-gradient(from 0deg,var(--ac-blue) 0 28%,rgba(29,78,216,.14) 28% 100%);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 2.5px),#000 calc(100% - 2px));mask:radial-gradient(farthest-side,transparent calc(100% - 2.5px),#000 calc(100% - 2px));animation:chatSpin 1.1s linear infinite}
    .chat-content{min-width:0;flex:1}
    .chat-byline{display:flex;align-items:center;gap:6px;margin:0 0 4px;font-size:.78rem;line-height:1.2;font-weight:650;color:var(--ac-ink)}
    .chat-tag{padding:2px 6px;border-radius:6px;background:var(--ac-tint);color:#1E40AF;font-size:.62rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
    .chat-tag.is-quiet{background:var(--ac-soft);color:#334155}
    .chat-message.bot .chat-bubble{font-size:.92rem;line-height:1.62;color:var(--ac-ink);overflow-wrap:anywhere}
    .chat-bubble p{margin:0}
    .chat-bubble p+p{margin-top:10px}
    .chat-bubble ul{margin:9px 0 0;padding:0;list-style:none}
    .chat-bubble li{position:relative;padding-left:17px}
    .chat-bubble li+li{margin-top:6px}
    .chat-bubble li::before{content:'';position:absolute;left:4px;top:.66em;width:6px;height:6px;border-radius:50%;background:var(--ac-blue)}
    .chat-bubble strong{font-weight:650}
    .chatbot-link{color:var(--ac-blue-deep);text-decoration:underline;text-decoration-thickness:1.5px;text-underline-offset:2px}
    .chatbot-link:hover{color:#1E40AF}
    .chat-caret > p:last-child::after,.chat-caret > ul:last-child > li:last-child::after,.chat-caret:empty::after{content:'';display:inline-block;width:2px;height:1.05em;margin-left:2px;vertical-align:-.16em;background:var(--ac-blue);animation:chatCaret 1s steps(1) infinite}

    .chat-thinking{display:flex;flex-direction:column;gap:8px;padding-top:2px}
    .chat-skeleton{height:10px;border-radius:6px;background:linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%);background-size:200% 100%;animation:chatShimmer 1.4s linear infinite}
    .chat-thinking-label{margin-top:2px;font-size:.8rem;color:var(--ac-muted)}

    .chat-notice{margin-top:10px;padding:9px 12px;border-radius:12px;background:#FEF3C7;color:#78350F;font-size:.82rem;line-height:1.45}
    .chat-notice a,.chat-notice button{color:#78350F;font-weight:650;text-decoration:underline;text-underline-offset:2px;background:none;border:0;padding:0;cursor:pointer;font-size:inherit}

    .chat-actions{display:flex;align-items:center;flex-wrap:wrap;gap:2px;margin:8px 0 0 -6px;opacity:0;transition:opacity .15s}
    .chat-message:hover .chat-actions,.chat-message:focus-within .chat-actions,.chat-message.is-latest .chat-actions{opacity:1}
    .chat-act{width:32px;height:32px;border:0;border-radius:9px;background:transparent;color:#475569;display:grid;place-items:center;cursor:pointer;transition:background .15s,color .15s}
    .chat-act:hover{background:var(--ac-soft);color:var(--ac-ink)}
    .chat-act.is-active{background:var(--ac-tint);color:var(--ac-blue-deep)}
    .chat-feedback-note{margin-left:6px;font-size:.78rem;line-height:1.35;color:var(--ac-muted)}
    .chat-feedback-note a{color:var(--ac-blue-deep);font-weight:600}

    .chat-followups{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
    .chat-chip{display:inline-flex;align-items:center;gap:7px;min-height:38px;padding:8px 13px;border:1px solid #BFDBFE;border-radius:13px;background:var(--ac-tint);color:#1E3A8A;font-size:.84rem;line-height:1.3;font-weight:560;text-align:left;text-decoration:none;cursor:pointer;transition:background .15s,border-color .15s,transform .15s}
    .chat-chip:hover{background:#DBEAFE;border-color:#93C5FD;transform:translateY(-1px)}
    .chat-chip.is-cta{border-color:var(--ac-navy);background:var(--ac-navy);color:#fff}
    .chat-chip.is-cta:hover{background:#1E293B}

    .chatbot-composer{flex:none;margin:0;padding:10px 12px calc(10px + env(safe-area-inset-bottom));border-top:1px solid var(--ac-line);background:#fff}
    .chatbot-field{display:flex;align-items:flex-end;gap:8px;padding:5px 5px 5px 14px;border:1.5px solid #CBD5E1;border-radius:20px;background:#fff;transition:border-color .15s,box-shadow .15s}
    .chatbot-field:focus-within{border-color:var(--ac-blue);box-shadow:0 0 0 4px rgba(37,99,235,.14)}
    .chatbot-field textarea{flex:1;min-width:0;max-height:120px;margin:0;padding:8px 0;border:0;outline:0;resize:none;background:transparent;color:var(--ac-ink);font:inherit;font-size:.95rem;line-height:1.45}
    .chatbot-field textarea::placeholder{color:#64748B}
    .chatbot-container .chatbot-field textarea:focus,.chatbot-container .chatbot-field textarea:focus-visible{outline:0!important}
    .chatbot-send{flex:none;width:40px;height:40px;border:0;border-radius:15px;display:grid;place-items:center;background:var(--ac-blue);color:#fff;cursor:pointer;transition:background .15s,transform .15s}
    .chatbot-send:hover:not(:disabled){background:var(--ac-blue-deep);transform:translateY(-1px)}
    .chatbot-send:disabled{background:#CBD5E1;cursor:not-allowed}
    .chatbot-send.is-stop{background:var(--ac-navy)}
    .chatbot-fineprint{display:flex;flex-wrap:wrap;justify-content:space-between;gap:2px 12px;margin:8px 4px 0;font-size:.72rem;line-height:1.45;color:var(--ac-muted)}
    .chatbot-fineprint a{color:var(--ac-blue-deep);font-weight:600}
    .chatbot-count{color:#B45309;font-weight:600}

    body.anot-chat-open .scroll-top{opacity:0!important;visibility:hidden!important;pointer-events:none!important}

    @keyframes chatIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
    @keyframes chatCaret{0%,50%{opacity:1}50.01%,100%{opacity:0}}
    @keyframes chatShimmer{to{background-position:-200% 0}}
    @keyframes chatSpin{to{transform:rotate(360deg)}}
    @keyframes chatPulse{0%{opacity:.9;transform:scale(.92)}100%{opacity:0;transform:scale(1.35)}}

    @media (hover:none){.chat-actions{opacity:1}}
    @media (pointer:coarse){.chatbot-icon-btn,.chat-act{width:44px;height:44px}.chat-chip{min-height:44px}.chatbot-send{width:44px;height:44px}}
    @media (max-width:768px){
      .chatbot-fab{left:16px;bottom:16px;width:56px;height:56px;padding:0;justify-content:center}
      .chatbot-fab-label{display:none}
      .chatbot-fab-mark{width:100%;height:100%}
      .chatbot-teaser{left:16px;bottom:84px}
    }
    @media (max-width:480px){
      .chatbot-container,.chatbot-container.is-wide{left:0;right:0;top:0;bottom:0;width:100%;max-width:100%;height:100vh;height:100dvh;max-height:none;border-radius:0;transform:translateY(24px)}
      .chatbot-container.is-open{transform:none}
      .chatbot-header{padding-top:calc(14px + env(safe-area-inset-top))}
      .chatbot-expand{display:none}
      .chatbot-field textarea{font-size:16px}
      body.anot-chat-open{overflow:hidden}
    }
    @media (prefers-reduced-motion:reduce){
      .chatbot-container,.chatbot-container *,.chatbot-container *::before,.chatbot-container *::after,.chatbot-fab,.chatbot-fab *,.chatbot-fab *::before,.chatbot-fab *::after,.chatbot-teaser,.chatbot-teaser *{animation:none!important;transition:none!important}
      .chatbot-fab-mark::after{display:none}
    }
    `;
    document.head.appendChild(style);

    if (document.getElementById('chatbotContainer')) {
        return;
    }

    const wrap = document.createElement('div');
    wrap.innerHTML = `
    <div class="chatbot-teaser" id="chatbotTeaser" hidden>
        <button type="button" class="chatbot-teaser-main" id="chatbotTeaserOpen"><span class="chatbot-teaser-mark">${icon('sparkle', 16)}</span><span id="chatbotTeaserText"></span></button>
        <button type="button" class="chatbot-teaser-close" id="chatbotTeaserClose" aria-label="Dismiss this suggestion">${icon('close', 16)}</button>
    </div>
    <section class="chatbot-container" id="chatbotContainer" data-lenis-prevent role="dialog" aria-modal="false" aria-labelledby="chatbotTitle" aria-describedby="chatbotSubtitle">
        <div class="chatbot-header">
            <div class="chatbot-mark" aria-hidden="true">${icon('sparkle', 22)}</div>
            <div class="chatbot-title-wrap">
                <div class="chatbot-title-row"><h2 class="chatbot-title" id="chatbotTitle">Ask Anot</h2><span class="chatbot-region">${REGION_LABEL}</span></div>
                <p class="chatbot-subtitle" id="chatbotSubtitle">Answers from anot.health</p>
            </div>
            <div class="chatbot-actions">
                <button type="button" class="chatbot-icon-btn" id="chatbotNew" aria-label="Start a new chat" title="New chat">${icon('compose', 18)}</button>
                <button type="button" class="chatbot-icon-btn chatbot-expand" id="chatbotExpand" aria-label="Make the chat window larger" aria-pressed="false" title="Larger window">${icon('expand', 18)}</button>
                <button type="button" class="chatbot-icon-btn" id="chatbotToggle" aria-label="Close chat" title="Close">${icon('close', 20)}</button>
            </div>
        </div>
        <div class="chatbot-body" data-lenis-prevent>
            <div class="chatbot-messages" id="chatbotMessages" data-lenis-prevent role="log" aria-live="off" aria-label="Conversation with Ask Anot" tabindex="0"></div>
            <button type="button" class="chatbot-more" id="chatbotMore" hidden aria-label="Scroll down to read the rest">${icon('arrowDown', 15)}<span>More below</span></button>
        </div>
        <div class="chatbot-status" id="chatbotStatus" role="status" aria-live="polite"></div>
        <form class="chatbot-composer" id="chatbotForm" novalidate>
            <div class="chatbot-field">
                <textarea id="chatbotInput" rows="1" maxlength="${AI_QUESTION_CHARS}" placeholder="Ask about pricing, security…" aria-label="Your question" enterkeyhint="send" autocomplete="off"></textarea>
                <button type="submit" class="chatbot-send" id="chatbotSend" aria-label="Send question">${icon('send', 20)}</button>
            </div>
            <div class="chatbot-fineprint"><span id="chatbotFineprint">AI-generated from anot.health. Please don't share patient information.</span><a href="${CONTACT_URL}">Talk to a person</a></div>
        </form>
    </section>
    <button type="button" class="chatbot-fab" id="chatbotFab" aria-haspopup="dialog" aria-expanded="false" aria-controls="chatbotContainer" aria-label="Ask Anot: open chat"><span class="chatbot-fab-mark">${icon('sparkle', 20)}</span><span class="chatbot-fab-label" id="chatbotFabLabel">Ask Anot</span></button>`;

    while (wrap.firstChild) {
        document.body.appendChild(wrap.firstChild);
    }

    const fab = document.getElementById('chatbotFab');
    const fabLabel = document.getElementById('chatbotFabLabel');
    const container = document.getElementById('chatbotContainer');
    const toggle = document.getElementById('chatbotToggle');
    const newChatBtn = document.getElementById('chatbotNew');
    const expandBtn = document.getElementById('chatbotExpand');
    const form = document.getElementById('chatbotForm');
    const input = document.getElementById('chatbotInput');
    const sendBtn = document.getElementById('chatbotSend');
    const msgs = document.getElementById('chatbotMessages');
    const statusEl = document.getElementById('chatbotStatus');
    const moreBtn = document.getElementById('chatbotMore');
    const teaser = document.getElementById('chatbotTeaser');
    const coarsePointer = window.matchMedia('(pointer: coarse)');

    // Isolate scrolling inside the chatbot so background page never moves
    const stopChatScroll = (e) => {
        e.stopPropagation();
    };
    container.addEventListener('wheel', stopChatScroll, { passive: true });
    container.addEventListener('touchmove', stopChatScroll, { passive: true });

    // ---- conversation state --------------------------------------------------------------
    let aiConversation = [];
    let aiPausedUntil = 0;
    let transcript = [];
    const state = { busy: false, abort: null, userStopped: false, lastQuestion: '', asked: [], answered: 0, pinnedUser: null };

    const SENSITIVE_REPLY = "For your privacy, please don't share Social Security, Social Insurance or card numbers, or other patient or personal health details, in this chat. You're welcome to ask your question in general terms, or email **admin@anot.health** and the team will help.";
    const SENSITIVE_USER_NOTE = '[Message hidden: it looked like a sensitive number.]';

    function luhnValid(digits) {
        let sum = 0;
        let double = false;
        for (let index = digits.length - 1; index >= 0; index -= 1) {
            let digit = digits.charCodeAt(index) - 48;
            if (double) {
                digit *= 2;
                if (digit > 9) {
                    digit -= 9;
                }
            }
            sum += digit;
            double = !double;
        }
        return sum % 10 === 0;
    }

    // Same rules as the backend (backend/chatService.js detectSensitive): a Social Security /
    // Social Insurance number or a payment card number is neither sent, stored nor echoed.
    function looksSensitive(text) {
        const value = String(text || '');
        if (/\b\d{3}[- ]\d{2}[- ]\d{4}\b/.test(value) || /\b\d{3}[- ]\d{3}[- ]\d{3}\b/.test(value)) {
            return true;
        }
        return (value.match(/\b(?:\d[ -]?){13,19}\b/g) || []).some(function (run) {
            const digits = run.replace(/\D/g, '');
            return digits.length >= 13 && digits.length <= 19 && luhnValid(digits);
        });
    }

    // What the model's links may point at, enforced here whatever the model writes: this
    // visitor's own region (a Canadian never gets a US page, or the reverse), the pages both
    // regions share, the team's mailbox, the customer sign-in, and anchors on the current page.
    // Anything else, including other websites, is shown as plain text.
    const US_PAGE_EQUIVALENTS = Object.keys(CA_PAGE_EQUIVALENTS).reduce(function (map, usPage) {
        map[CA_PAGE_EQUIVALENTS[usPage]] = usPage;
        return map;
    }, {});
    const SHARED_PAGES = ['payroll.html', 'specialties.html', 'privacy.html', 'terms.html'];
    const LINKABLE_PAGES = (isCanadianChat ? Object.values(CA_PAGE_EQUIVALENTS) : Object.keys(CA_PAGE_EQUIVALENTS))
        .concat(SHARED_PAGES);

    function restrictAiLinks(text) {
        return String(text || '').replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (match, label, href) {
            if (/^mailto:admin@anot\.health$/i.test(href) || /^#[\w-]+$/.test(href) || /^https:\/\/app\.anot\.health(\/\S*)?$/i.test(href)) {
                return match;
            }

            const page = /^([\w-]+\.html)([?#]\S*)?$/i.exec(href);
            if (!page) {
                return label;
            }

            // A page from the other region becomes its equivalent in this one.
            const file = page[1].toLowerCase();
            const local = (isCanadianChat ? CA_PAGE_EQUIVALENTS[file] : US_PAGE_EQUIVALENTS[file]) || file;
            return LINKABLE_PAGES.indexOf(local) === -1 ? label : '[' + label + '](' + local + (page[2] || '') + ')';
        });
    }

    function plainCopy(text) {
        return String(text || '')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1 ($2)')
            .trim();
    }

    // ---- small helpers ---------------------------------------------------------------------
    function announce(text) {
        statusEl.textContent = '';
        window.setTimeout(function () {
            statusEl.textContent = String(text || '').slice(0, 1200);
        }, 60);
    }

    function el(tag, className, html) {
        const node = document.createElement(tag);
        if (className) {
            node.className = className;
        }
        if (html !== undefined) {
            node.innerHTML = html;
        }
        return node;
    }

    function autosize() {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    }

    function getAnswerTypeLabel(answerType) {
        const labels = {
            direct: 'Quick answer',
            brain: 'Quick answer',
            website: 'From our website',
            memory: 'From earlier chats'
        };

        return labels[String(answerType || '').trim()] || 'Quick answer';
    }

    function applyFeedbackState(row, feedback) {
        if (!row) {
            return;
        }

        const status = feedback?.userStatus || '';
        const up = row.querySelector('[data-feedback="helpful"]');
        const down = row.querySelector('[data-feedback="not_helpful"]');
        const note = row.querySelector('.chat-feedback-note');

        if (up) {
            up.classList.toggle('is-active', status === 'helpful');
            up.setAttribute('aria-pressed', status === 'helpful' ? 'true' : 'false');
        }
        if (down) {
            down.classList.toggle('is-active', status === 'not_helpful');
            down.setAttribute('aria-pressed', status === 'not_helpful' ? 'true' : 'false');
        }
        if (note) {
            if (status === 'helpful') {
                note.textContent = 'Thanks for the feedback.';
            } else if (status === 'not_helpful') {
                note.innerHTML = 'Sorry about that. The team can answer precisely: <a href="mailto:' + TEAM_EMAIL + '">' + TEAM_EMAIL + '</a>';
            } else {
                note.textContent = '';
            }
        }
    }

    function buildActions(entry) {
        const row = el('div', 'chat-actions');
        row.dataset.answerKey = entry.answerKey || '';
        row.dataset.question = String(entry.question || '').trim();
        row.dataset.topic = String(entry.topic || '').trim();
        row.innerHTML =
            '<button type="button" class="chat-act" data-act="copy" aria-label="Copy this answer" title="Copy">' + icon('copy', 16) + '</button>'
            + (entry.feedback
                ? '<button type="button" class="chat-act" data-feedback="helpful" aria-pressed="false" aria-label="This answer was helpful" title="Helpful">' + icon('up', 16) + '</button>'
                + '<button type="button" class="chat-act" data-feedback="not_helpful" aria-pressed="false" aria-label="This answer was not helpful" title="Not helpful">' + icon('down', 16) + '</button>'
                : '')
            + '<span class="chat-feedback-note"></span>';
        if (entry.feedback && entry.answerKey) {
            applyFeedbackState(row, getFeedbackStore()[entry.answerKey]);
        }
        return row;
    }

    // Up to three topic follow-ups (never a question already asked), plus "Book a demo" once the
    // visitor has had a couple of answers: a next step for people who are ready, never a pushy one.
    function buildFollowUps(question, topicHint) {
        const key = topicHint || detectTopicFromQuestion(question);
        const asked = state.asked.concat([question]);
        const picks = [];
        (FOLLOW_UPS[key] || []).concat(FOLLOW_UP_FILL).forEach(function (name) {
            const item = ASK[name];
            if (item && picks.length < 3 && picks.indexOf(item) === -1 && asked.indexOf(item.ask) === -1) {
                picks.push(item);
            }
        });

        const row = el('div', 'chat-followups');
        row.setAttribute('role', 'group');
        row.setAttribute('aria-label', 'Suggested follow-up questions');
        picks.forEach(function (item) {
            const chip = el('button', 'chat-chip', '<span>' + item.label + '</span>');
            chip.type = 'button';
            chip.dataset.ask = item.ask;
            row.appendChild(chip);
        });
        if (state.answered + 1 >= 2) {
            const cta = el('a', 'chat-chip is-cta', icon('calendar', 15) + '<span>Book a demo</span>');
            cta.href = DEMO_URL;
            row.appendChild(cta);
        }
        return row;
    }

    function persistLegacyHistory(sender, html, messageText, meta) {
        // Kept exactly as before: the built-in bot reads this to avoid repeating itself.
        const history = getHistory();
        history.push({
            sender: sender,
            html: html,
            text: messageText,
            meta: meta || null
        });
        saveHistory(history);
    }

    function saveSession() {
        uiStorageSet(UI_SESSION_KEY, JSON.stringify({
            region: REGION_KEY,
            at: Date.now(),
            entries: transcript.slice(-UI_MAX_ENTRIES),
            ai: aiConversation.slice(-AI_MAX_MESSAGES),
            asked: state.asked.slice(-12),
            answered: state.answered
        }));
    }

    function loadSession() {
        try {
            const saved = JSON.parse(uiStorageGet(UI_SESSION_KEY) || 'null');
            if (!saved || saved.region !== REGION_KEY || !Array.isArray(saved.entries) || !saved.entries.length) {
                return null;
            }
            if (Date.now() - Number(saved.at || 0) > UI_MAX_AGE_MS) {
                return null;
            }
            // If the restored session contains stale superseded pricing ($99 or $599), discard and reset
            const hasStalePricing = saved.entries.some(function (entry) {
                return typeof entry.text === 'string' && (/\$(99|599)\b/.test(entry.text) || /\b(99|599)\s*(usd|\/month)/i.test(entry.text));
            });
            if (hasStalePricing) {
                uiStorageRemove(UI_SESSION_KEY);
                return null;
            }
            return saved;
        } catch (error) {
            return null;
        }
    }

    // ---- messages ----------------------------------------------------------------------------
    function leaveWelcome() {
        const welcome = document.getElementById('chatbotWelcome');
        if (welcome) {
            welcome.remove();
        }
    }

    function clearFollowUps() {
        msgs.querySelectorAll('.chat-followups').forEach(function (node) {
            node.remove();
        });
    }

    function addUserMessage(text, options) {
        const opts = options || {};
        const item = el('div', 'chat-message user' + (opts.restore ? ' is-restored' : ''));
        const bubble = el('div', 'chat-bubble', formatMessage(text));
        item.appendChild(bubble);
        msgs.appendChild(item);

        if (!opts.restore && opts.persist !== false) {
            persistLegacyHistory('user', bubble.innerHTML, text, null);
            transcript.push({ sender: 'user', text: text });
        }
        return item;
    }

    // The reply's home in the conversation: first a "looking through the pages" state, then the
    // streaming text with a caret, then the finished answer with its actions and follow-ups.
    function startAssistantMessage(options) {
        const opts = options || {};
        const item = el('div', 'chat-message bot' + (opts.restore ? ' is-restored' : ''));
        item.innerHTML =
            '<div class="chat-avatar' + (opts.restore ? '' : ' is-working') + '" aria-hidden="true">' + icon('sparkle', 16) + '</div>'
            + '<div class="chat-content">'
            + '<div class="chat-byline"><span>Ask Anot</span></div>'
            + (opts.restore ? '' : '<div class="chat-thinking" aria-hidden="true"><div class="chat-skeleton" style="width:90%"></div><div class="chat-skeleton" style="width:66%"></div><div class="chat-thinking-label">Looking through Anot’s pages…</div></div>')
            + '</div>';
        msgs.appendChild(item);

        const content = item.querySelector('.chat-content');
        const byline = item.querySelector('.chat-byline');
        const avatar = item.querySelector('.chat-avatar');
        let bubble = null;

        function ensureBubble() {
            const thinking = content.querySelector('.chat-thinking');
            if (thinking) {
                thinking.remove();
            }
            if (!bubble) {
                bubble = el('div', 'chat-bubble chat-caret');
                content.appendChild(bubble);
            }
            return bubble;
        }

        function setTag(text, quiet) {
            let tag = byline.querySelector('.chat-tag');
            if (!text) {
                if (tag) {
                    tag.remove();
                }
                return;
            }
            if (!tag) {
                tag = el('span', 'chat-tag');
                byline.appendChild(tag);
            }
            tag.textContent = text;
            tag.classList.toggle('is-quiet', Boolean(quiet));
        }

        return {
            item: item,
            hasText: function () {
                return Boolean(bubble);
            },
            stream: function (text) {
                setTag('AI', false);
                ensureBubble().innerHTML = formatMessage(restrictAiLinks(text));
                trimTail();
            },
            finalize: function (entry) {
                avatar.classList.remove('is-working');
                const node = ensureBubble();
                node.classList.remove('chat-caret');
                node.innerHTML = entry.text ? formatMessage(entry.text) : '';
                if (!entry.text) {
                    node.remove();
                    bubble = null;
                }
                setTag(entry.tag || '', entry.tagQuiet);

                if (entry.notice) {
                    content.appendChild(el('div', 'chat-notice', entry.notice));
                }
                if (entry.actions !== false && entry.text) {
                    content.appendChild(buildActions(entry));
                }
                if (entry.followups) {
                    content.appendChild(buildFollowUps(entry.question, entry.topic));
                }

                msgs.querySelectorAll('.chat-message.is-latest').forEach(function (node) {
                    node.classList.remove('is-latest');
                });
                item.classList.add('is-latest');
                trimTail();

                if (entry.text && !opts.restore) {
                    announce('Ask Anot replied: ' + plainCopy(entry.text));
                }
                if (entry.persist !== false && entry.text && !opts.restore) {
                    persistLegacyHistory('bot', node.innerHTML, entry.text, {
                        answerKey: entry.answerKey || '',
                        question: String(entry.question || '').trim(),
                        topic: String(entry.topic || '').trim(),
                        answerType: String(entry.type || '').trim(),
                        enableFeedback: Boolean(entry.feedback)
                    });
                }
            },
            remove: function () {
                item.remove();
            }
        };
    }

    // Keep the visitor's question near the top of the view and leave room below it for the
    // reply, so the answer is read from its start and the view never chases streaming text.
    function pinToQuestion(userItem) {
        state.pinnedUser = userItem;
        msgs.style.paddingBottom = msgs.clientHeight + 'px';
        msgs.scrollTop = Math.max(0, userItem.offsetTop - 16);
        updateMore();
    }

    function trimTail() {
        const user = state.pinnedUser;
        const last = msgs.lastElementChild;
        if (user && last && user.isConnected) {
            const used = last.offsetTop + last.offsetHeight - user.offsetTop;
            msgs.style.paddingBottom = (8 + Math.max(0, msgs.clientHeight - used - 32)) + 'px';
        }
        updateMore();
    }

    // The view never chases a reply, so when a long one runs below the fold say so.
    function updateMore() {
        const last = msgs.lastElementChild;
        const hidden = last ? last.offsetTop + last.offsetHeight - (msgs.scrollTop + msgs.clientHeight) : 0;
        moreBtn.hidden = !(hidden > 24 && container.classList.contains('is-open'));
    }

    function setBusy(busy) {
        state.busy = busy;
        container.setAttribute('aria-busy', busy ? 'true' : 'false');
        sendBtn.classList.toggle('is-stop', busy);
        sendBtn.innerHTML = icon(busy ? 'stop' : 'send', 20);
        sendBtn.setAttribute('aria-label', busy ? 'Stop the reply' : 'Send question');
        sendBtn.title = busy ? 'Stop' : '';
        if (busy) {
            announce('Ask Anot is replying.');
        }
    }

    // ---- Claude-powered answers -----------------------------------------------------------
    function buildAiMessages(question) {
        return aiConversation
            .concat([{ role: 'user', content: question }])
            .slice(-AI_MAX_MESSAGES)
            .map(function (message, index, all) {
                const limit = index === all.length - 1 ? AI_QUESTION_CHARS : AI_HISTORY_CHARS;
                return { role: message.role, content: String(message.content).slice(0, limit) };
            });
    }

    // Asks the backend for a Claude answer and streams it into `view`. Resolves to
    // { status: 'ok' | 'stopped' | 'interrupted' | 'unavailable', text, blocked }.
    async function askAi(question, view) {
        if (Date.now() < aiPausedUntil || typeof fetch !== 'function' || !window.TextDecoder) {
            return { status: 'unavailable', text: '', blocked: false };
        }

        const controller = new AbortController();
        state.abort = controller;
        state.userStopped = false;
        const timer = window.setTimeout(function () {
            controller.abort();
        }, AI_TIMEOUT_MS);
        let text = '';
        let renderQueued = false;
        let finished = false;
        let blocked = false;

        function render() {
            renderQueued = false;
            if (text) {
                view.stream(text);
            }
        }

        try {
            const response = await fetch(AI_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
                body: JSON.stringify({
                    messages: buildAiMessages(question),
                    region: REGION_KEY,
                    page: CURRENT_PAGE
                }),
                signal: controller.signal
            });
            const contentType = response.headers.get('content-type') || '';
            if (!response.ok || !response.body || contentType.indexOf('text/event-stream') === -1) {
                throw new Error('AI answers are unavailable (HTTP ' + response.status + ')');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const chunk = await reader.read();
                if (chunk.done) {
                    break;
                }
                buffer += decoder.decode(chunk.value, { stream: true });

                let end = buffer.indexOf('\n\n');
                while (end !== -1) {
                    const line = buffer.slice(0, end).split('\n').filter(function (part) {
                        return part.indexOf('data: ') === 0;
                    })[0];
                    buffer = buffer.slice(end + 2);
                    end = buffer.indexOf('\n\n');
                    if (!line) {
                        continue;
                    }

                    let event = null;
                    try {
                        event = JSON.parse(line.slice(6));
                    } catch (parseError) {
                        continue;
                    }

                    if (event.type === 'delta' && event.text) {
                        text += event.text;
                        if (!renderQueued) {
                            renderQueued = true;
                            window.requestAnimationFrame(render);
                        }
                    } else if (event.type === 'done') {
                        finished = true;
                        blocked = Boolean(event.blocked);
                    }
                }
            }
        } catch (error) {
            if (!state.userStopped) {
                aiPausedUntil = Date.now() + AI_PAUSE_AFTER_FAILURE_MS;
            }
        } finally {
            window.clearTimeout(timer);
            state.abort = null;
        }

        if (state.userStopped) {
            return { status: 'stopped', text: text, blocked: false };
        }
        if (!text.trim()) {
            return { status: 'unavailable', text: '', blocked: false };
        }
        return { status: finished ? 'ok' : 'interrupted', text: text, blocked: blocked };
    }

    function stopReply() {
        if (state.abort) {
            state.userStopped = true;
            state.abort.abort();
        }
    }

    async function handleSend(prefilled, options) {
        const opts = options || {};
        if (state.busy) {
            return;
        }

        const raw = prefilled !== undefined && prefilled !== null ? prefilled : input.value;
        const text = String(raw || '').trim().slice(0, AI_QUESTION_CHARS);
        if (!text) {
            return;
        }

        if (looksSensitive(text)) {
            leaveWelcome();
            clearFollowUps();
            addUserMessage(SENSITIVE_USER_NOTE, { persist: false });
            const note = startAssistantMessage();
            note.finalize({ text: SENSITIVE_REPLY, type: 'direct', actions: false, persist: false });
            input.value = '';
            autosize();
            return;
        }

        let userItem;
        if (opts.retry) {
            const questions = msgs.querySelectorAll('.chat-message.user');
            userItem = questions[questions.length - 1];
        } else {
            leaveWelcome();
            clearFollowUps();
            userItem = addUserMessage(text);
            input.value = '';
            autosize();
        }
        state.lastQuestion = text;

        setBusy(true);
        const view = startAssistantMessage();
        pinToQuestion(userItem);

        try {
            const ai = await askAi(text, view);

            if (ai.status === 'ok' && ai.text.trim()) {
                const safeText = restrictAiLinks(ai.text);
                view.finalize({
                    text: safeText,
                    tag: ai.blocked ? '' : 'AI',
                    type: ai.blocked ? 'direct' : 'ai',
                    answerKey: createAnswerKey(safeText),
                    question: text,
                    feedback: !ai.blocked,
                    followups: !ai.blocked
                });
                if (!ai.blocked) {
                    aiConversation.push({ role: 'user', content: text }, { role: 'assistant', content: safeText });
                    transcript.push({ sender: 'bot', text: safeText, type: 'ai', question: text });
                    state.asked.push(text);
                    state.answered += 1;
                }
            } else if (ai.status === 'stopped') {
                view.finalize({
                    text: restrictAiLinks(ai.text),
                    tag: ai.text ? 'AI' : '',
                    actions: true,
                    feedback: false,
                    persist: false,
                    question: text,
                    notice: 'You stopped this reply. <button type="button" data-retry>Regenerate</button>'
                });
            } else if (ai.status === 'interrupted') {
                view.finalize({
                    text: restrictAiLinks(ai.text),
                    tag: 'AI',
                    feedback: false,
                    persist: false,
                    question: text,
                    notice: 'The connection was interrupted. <button type="button" data-retry>Try again</button> or <a href="mailto:' + TEAM_EMAIL + '">email the team</a>.'
                });
            } else {
                // Claude is unavailable: the built-in bot answers from the site's own knowledge.
                await ensureKnowledgeReady();
                const result = await getBotAnswer(text);
                const answer = result.answer || FALLBACK_RESPONSE;
                view.finalize({
                    text: answer,
                    tag: getAnswerTypeLabel(result.answerType),
                    tagQuiet: true,
                    type: result.answerType || 'direct',
                    answerKey: createAnswerKey(answer),
                    question: text,
                    topic: result.topic || '',
                    feedback: true,
                    followups: true
                });
                if (answer !== FALLBACK_RESPONSE && result.shouldRemember !== false) {
                    rememberExchange(text, answer, result.sources || []);
                }
                if (answer !== FALLBACK_RESPONSE) {
                    // Keep the conversation whole for when Claude answers the next question.
                    aiConversation.push({ role: 'user', content: text }, { role: 'assistant', content: answer });
                }
                transcript.push({ sender: 'bot', text: answer, type: result.answerType || 'direct', question: text, topic: result.topic || '' });
                state.asked.push(text);
                state.answered += 1;
                updateSessionFromResult(text, result || {});
            }
        } catch (error) {
            view.finalize({
                text: FALLBACK_RESPONSE,
                tag: 'Quick answer',
                tagQuiet: true,
                type: 'direct',
                answerKey: createAnswerKey(FALLBACK_RESPONSE),
                question: text,
                feedback: true
            });
        } finally {
            setBusy(false);
            saveSession();
            if (!coarsePointer.matches) {
                input.focus({ preventScroll: true });
            }
        }
    }

    // ---- opening, closing, restoring -----------------------------------------------------------
    // The empty state: what Ask Anot can answer, buttons for the likeliest questions on this
    // page, and a way to reach a person.
    function showWelcome() {
        const welcome = el('div', 'chatbot-welcome');
        welcome.id = 'chatbotWelcome';
        welcome.innerHTML =
            '<div><h3>Hi, I’m Ask Anot.</h3><p>I answer questions about Anot Health’s pricing, security, and how our services work.</p></div>'
            + '<div class="chatbot-starters" id="chatbotStarters" role="group" aria-label="Suggested questions"></div>'
            + '<p class="chatbot-human">' + icon('mail', 16) + '<span>Prefer a person? <a href="' + DEMO_URL + '">Book a demo</a> or email <a href="mailto:' + TEAM_EMAIL + '">' + TEAM_EMAIL + '</a>.</span></p>';
        msgs.appendChild(welcome);
        renderStarters();
    }

    function renderStarters() {
        const host = document.getElementById('chatbotStarters');
        if (!host) {
            return;
        }
        host.innerHTML = '';
        (STARTERS[PAGE_TOPIC] || STARTERS.home).forEach(function (name) {
            const item = ASK[name];
            const button = el('button', 'chatbot-starter',
                '<span class="chatbot-starter-icon">' + icon(item.icon, 17) + '</span>'
                + '<span class="chatbot-starter-text">' + item.label + '</span>'
                + '<span class="chatbot-starter-go">' + icon('go', 16) + '</span>');
            button.type = 'button';
            button.dataset.ask = item.ask;
            host.appendChild(button);
        });
    }

    function restoreSession() {
        const saved = loadSession();
        if (!saved) {
            return false;
        }

        leaveWelcome();
        saved.entries.forEach(function (entry) {
            if (entry.sender === 'user') {
                addUserMessage(entry.text, { restore: true });
                return;
            }
            const view = startAssistantMessage({ restore: true });
            const isAi = entry.type === 'ai';
            view.finalize({
                text: entry.text,
                tag: isAi ? 'AI' : getAnswerTypeLabel(entry.type),
                tagQuiet: !isAi,
                type: entry.type,
                answerKey: createAnswerKey(entry.text),
                question: entry.question || '',
                topic: entry.topic || '',
                feedback: true
            });
        });
        transcript = saved.entries.slice();
        aiConversation = Array.isArray(saved.ai) ? saved.ai : [];
        state.asked = Array.isArray(saved.asked) ? saved.asked : [];
        state.answered = Number(saved.answered || 0);
        msgs.querySelectorAll('.chat-message.is-latest').forEach(function (node) {
            node.classList.remove('is-latest');
        });
        msgs.scrollTop = msgs.scrollHeight;
        fabLabel.textContent = 'Continue chat';
        fab.setAttribute('aria-label', 'Ask Anot: continue your chat');
        return true;
    }

    function resetChat() {
        stopReply();
        msgs.innerHTML = '';
        msgs.style.paddingBottom = '';
        runtimeHistory = [];
        aiConversation = [];
        transcript = [];
        state.asked = [];
        state.answered = 0;
        state.pinnedUser = null;
        clearSession();
        uiStorageRemove(UI_SESSION_KEY);
        input.value = '';
        autosize();

        showWelcome();
        fabLabel.textContent = 'Ask Anot';
        fab.setAttribute('aria-label', 'Ask Anot: open chat');
        announce('Started a new chat.');
    }

    function hideTeaser(remember) {
        teaser.hidden = true;
        if (remember) {
            uiStorageSet(UI_TEASER_KEY, '1');
        }
    }

    function openChat() {
        // Knowledge for the built-in bot is built on first open, so visitors who never chat
        // don't download every page of the site in the background.
        ensureKnowledgeReady();
        hideTeaser(true);
        // The site's scroll-to-top button sits where the send button is on phones and is
        // layered above the panel; hide it while the chat is open.
        document.body.classList.add('anot-chat-open');
        container.classList.add('is-open');
        fab.classList.add('is-hidden');
        fab.setAttribute('aria-expanded', 'true');
        syncViewport();
        window.setTimeout(function () {
            input.focus({ preventScroll: true });
            updateMore();
        }, 80);
    }

    function closeChat(returnFocus) {
        const hadFocus = container.contains(document.activeElement);
        document.body.classList.remove('anot-chat-open');
        container.classList.remove('is-open');
        fab.classList.remove('is-hidden');
        fab.setAttribute('aria-expanded', 'false');
        container.style.top = '';
        container.style.height = '';
        if (returnFocus || hadFocus) {
            fab.focus({ preventScroll: true });
        }
    }

    function setWide(wide) {
        container.classList.toggle('is-wide', wide);
        expandBtn.setAttribute('aria-pressed', wide ? 'true' : 'false');
        expandBtn.setAttribute('aria-label', wide ? 'Make the chat window smaller' : 'Make the chat window larger');
        expandBtn.innerHTML = icon(wide ? 'shrink' : 'expand', 18);
        uiStorageSet(UI_WIDE_KEY, wide ? '1' : '0');
        window.setTimeout(trimTail, 300);
    }

    // On phones the panel is full screen: follow the visual viewport so the composer stays above
    // the on-screen keyboard instead of hiding behind it.
    function syncViewport() {
        const viewport = window.visualViewport;
        if (!viewport || !container.classList.contains('is-open') || window.innerWidth > 480) {
            return;
        }
        container.style.top = viewport.offsetTop + 'px';
        container.style.height = viewport.height + 'px';
    }

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', syncViewport);
        window.visualViewport.addEventListener('scroll', syncViewport);
    }

    // On phones the launcher would sit on top of the hero's call-to-action buttons, so it stays
    // out of the way until the visitor scrolls past the first screen.
    const phoneQuery = window.matchMedia('(max-width: 768px)');
    function syncFabParking() {
        const parked = phoneQuery.matches && window.scrollY < window.innerHeight * 0.6;
        fab.classList.toggle('is-parked', parked);
    }
    window.addEventListener('scroll', syncFabParking, { passive: true });
    window.addEventListener('resize', syncFabParking);
    syncFabParking();

    // One quiet, page-specific nudge per visit: never on the contact page, never once the visitor
    // has opened or dismissed the chat, and never while a conversation is already in progress.
    function scheduleTeaser(hasConversation) {
        const line = TEASERS[PAGE_TOPIC];
        if (!line || hasConversation || uiStorageGet(UI_TEASER_KEY)) {
            return;
        }

        let tries = 0;
        function attempt() {
            tries += 1;
            if (container.classList.contains('is-open') || uiStorageGet(UI_TEASER_KEY)) {
                return;
            }
            if (fab.classList.contains('is-parked')) {
                if (tries < 4) {
                    window.setTimeout(attempt, 6000);
                }
                return;
            }
            document.getElementById('chatbotTeaserText').textContent = line;
            teaser.hidden = false;
            uiStorageSet(UI_TEASER_KEY, '1');
            window.setTimeout(function () {
                teaser.hidden = true;
            }, 16000);
        }
        window.setTimeout(attempt, 9000);
    }

    // ---- events --------------------------------------------------------------------------------
    msgs.addEventListener('scroll', updateMore, { passive: true });
    window.addEventListener('resize', updateMore);
    moreBtn.addEventListener('click', function () {
        const last = msgs.lastElementChild;
        if (last) {
            const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            msgs.scrollTo({ top: last.offsetTop + last.offsetHeight - msgs.clientHeight + 24, behavior: reduce ? 'auto' : 'smooth' });
        }
        input.focus({ preventScroll: true });
    });
    fab.addEventListener('click', openChat);
    toggle.addEventListener('click', function () {
        closeChat(true);
    });
    newChatBtn.addEventListener('click', function () {
        resetChat();
        input.focus({ preventScroll: true });
    });
    expandBtn.addEventListener('click', function () {
        setWide(!container.classList.contains('is-wide'));
    });
    document.getElementById('chatbotTeaserOpen').addEventListener('click', openChat);
    document.getElementById('chatbotTeaserClose').addEventListener('click', function () {
        hideTeaser(true);
    });

    container.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            event.stopPropagation();
            closeChat(true);
        }
    });

    form.addEventListener('submit', function (event) {
        event.preventDefault();
        handleSend();
    });
    sendBtn.addEventListener('click', function (event) {
        if (state.busy) {
            event.preventDefault();
            stopReply();
        }
    });
    input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
            event.preventDefault();
            handleSend();
        }
    });
    input.addEventListener('input', function () {
        autosize();
        const left = AI_QUESTION_CHARS - input.value.length;
        const fine = document.getElementById('chatbotFineprint');
        if (left <= 150) {
            fine.innerHTML = '<span class="chatbot-count">' + left + ' characters left</span>';
        } else if (fine.querySelector('.chatbot-count')) {
            fine.textContent = "AI-generated from anot.health. Please don't share patient information.";
        }
    });

    container.addEventListener('click', function (event) {
        const starter = event.target.closest('[data-ask]');
        if (starter) {
            handleSend(starter.getAttribute('data-ask'));
            return;
        }

        const retry = event.target.closest('[data-retry]');
        if (retry) {
            const item = retry.closest('.chat-message');
            if (item) {
                item.remove();
            }
            handleSend(state.lastQuestion, { retry: true });
            return;
        }

        const copy = event.target.closest('[data-act="copy"]');
        if (copy) {
            const bubble = copy.closest('.chat-content').querySelector('.chat-bubble');
            const text = bubble ? bubble.innerText : '';
            const done = function () {
                copy.innerHTML = icon('check', 16);
                copy.classList.add('is-active');
                announce('Copied to clipboard.');
                window.setTimeout(function () {
                    copy.innerHTML = icon('copy', 16);
                    copy.classList.remove('is-active');
                }, 1600);
            };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(done, function () { /* clipboard blocked */ });
            }
            return;
        }

        const button = event.target.closest('[data-feedback]');
        if (!button) {
            return;
        }
        const row = button.closest('.chat-actions');
        const answerKey = row ? row.dataset.answerKey : '';
        const status = button.getAttribute('data-feedback') || '';
        if (!answerKey || !status) {
            return;
        }
        const feedback = setAnswerFeedback(answerKey, status, {
            answerKey: answerKey,
            question: row.dataset.question || '',
            topic: row.dataset.topic || ''
        });
        applyFeedbackState(row, feedback);
    });

    // ---- start ---------------------------------------------------------------------------------
    setWide(uiStorageGet(UI_WIDE_KEY) === '1');
    const resumed = restoreSession();
    if (!resumed) {
        showWelcome();
        runtimeHistory = [];
        clearSession();
    }
    setBusy(false);
    scheduleTeaser(resumed);
})();
