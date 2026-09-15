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
    const isCanadianChat = localStorage.getItem('anot_selected_region') === 'ca' || CURRENT_PAGE.includes('-ca.html') || CURRENT_PAGE.includes('pipeda.html');
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
            keywords: ['hipaa', 'trust', 'privacy', 'secure', 'security', 'safe', 'compliance']
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
                /\bhow much\b/,
                /\bwhat does it cost\b/,
                /\bwhat is the price\b/,
                /\bpricing\b/
            ],
            title: 'Pricing',
            shortAnswer: 'Anot pricing now starts at $1,000 per month with Foundation, moves to $1,500 per month with Professional, and uses custom pricing for Enterprise.',
            keyPoints: [
                '**Foundation** starts at **$1,000/month** for clear, consistent dictation and AI-first note generation with light human QA.',
                '**Professional** starts at **$1,500/month** when the documentation profile needs a stronger review layer.',
                '**Enterprise** uses custom pricing for higher-complexity documentation or broader operational scope.',
                'The pricing page explains how plan fit depends on documentation complexity and workflow needs.'
            ]
        },
        {
            patterns: [
                /\b(hipaa|pipeda|phipa|hia|pipa)\b/,
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

        const title = String(intent.title || '').trim();
        const summary = String(intent.summary || '').trim();
        if (!title || !summary) {
            return null;
        }

        return {
            id: String(intent.id || title).trim(),
            topic: String(intent.topic || '').trim(),
            title: title,
            summary: summary,
            highlights: Array.isArray(intent.highlights) ? intent.highlights.map(String).map(function (value) { return value.trim(); }).filter(Boolean) : [],
            bestFit: String(intent.bestFit || '').trim(),
            nextStep: String(intent.nextStep || '').trim(),
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
        return memory.filter(function (entry) {
            return entry &&
                typeof entry.question === 'string' &&
                typeof entry.answer === 'string' &&
                Number(entry.savedAt || 0) >= cutoff;
        });
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

        if (explicitTopic && explicitTopic === session.activeTopic) {
            return {
                effectiveQuestion: question,
                usedSessionContext: false,
                needsClarification: false
            };
        }

        const contextParts = [session.activeTopicLabel || getTopicLabel(session.activeTopic)];
        if (explicitTopic && explicitTopic !== session.activeTopic) {
            contextParts.push(getTopicLabel(explicitTopic));
        }

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
                    'You can mention whether you are comparing **Foundation**, **Professional**, or **Enterprise**.'
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
            SITE_PAGES.map(async function (page) {
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
        const leadMap = {
            pricing: 'The short version is that Anot organizes pricing around documentation complexity and review depth, not one flat rate for every workflow.',
            documentation: 'The practical takeaway is that Anot is designed to reduce charting burden without asking your team to rely on unreviewed output.',
            revenue: 'The practical takeaway is that revenue support matters most when documentation quality is already creating rework downstream.',
            coding: 'The short version is that coding support becomes valuable when specificity and reimbursement logic need stronger review before submission.',
            payroll: 'The short version is that payroll support is most useful when provider compensation inputs still require manual reconciliation.',
            trust: 'The short version is that the trust story is framed around operational safeguards and review discipline, not only policy language.',
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

        const memoryMatches = searchMemory(
            contextualQuestion.effectiveQuestion,
            recentBotMessages,
            lastUserMessage
        );
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

    function renderInlineMarkdown(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, label, href) {
                return `<a href="${href}" class="chatbot-link">${label}</a>`;
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

    const style = document.createElement('style');
    style.textContent = `
    .chatbot-fab{position:fixed;bottom:24px;left:24px;width:60px;height:60px;border-radius:50%;background:var(--cyan,#2563EB);color:#fff;border:none;box-shadow:0 10px 40px rgba(37,99,235,.2);cursor:pointer;z-index:10000;display:flex;align-items:center;justify-content:center;transition:.3s ease}
    .chatbot-fab:hover{transform:scale(1.05);box-shadow:0 10px 25px rgba(37,99,235,.3)}
    .chatbot-fab.is-hidden{opacity:0;pointer-events:none;transform:scale(.8)}
    .chatbot-container{position:fixed;bottom:24px;left:24px;width:390px;max-width:calc(100vw - 48px);height:540px;max-height:calc(100vh - 100px);background:rgba(255,255,255,.97);backdrop-filter:blur(24px);border:1px solid rgba(226,232,240,.9);border-radius:20px;box-shadow:0 24px 45px rgba(15,23,42,.14);display:flex;flex-direction:column;z-index:10001;transition:.4s ease;opacity:0;pointer-events:none;transform:translateY(20px) scale(.95);overflow:hidden;font-family:'Inter',sans-serif}
    .chatbot-container.is-open{opacity:1;pointer-events:auto;transform:translateY(0) scale(1)}
    .chatbot-header{background:linear-gradient(135deg,#0F172A,#2563EB);color:#fff;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;border-radius:20px 20px 0 0}
    .chatbot-title-wrap{display:flex;flex-direction:column;gap:2px}
    .chatbot-title{display:flex;align-items:center;gap:8px;font-weight:600;font-size:1rem}
    .chatbot-subtitle{font-size:.72rem;opacity:.8}
    .chatbot-toggle{background:0 0;border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.3s ease;padding:4px}
    .chatbot-toggle:hover{transform:scale(1.1)}
    .chatbot-body{flex:1;display:flex;flex-direction:column;overflow:hidden}
    .chatbot-messages{flex:1;padding:20px;overflow-y:auto;display:flex;flex-direction:column;gap:12px}
    .chat-message{display:flex;max-width:88%}
    .chat-message.bot{align-self:flex-start}
    .chat-message.user{align-self:flex-end}
    .chat-bubble{padding:12px 16px;border-radius:16px;font-size:.88rem;line-height:1.6}
    .chat-meta{display:flex;align-items:center;gap:8px;margin-top:6px;padding-left:4px}
    .chat-bubble p{margin:0}
    .chat-bubble p + p{margin-top:10px}
    .chat-bubble ul{margin:10px 0 0 18px;padding:0}
    .chat-bubble li + li{margin-top:6px}
    .chat-bubble strong{font-weight:700}
    .chatbot-link{color:#1D4ED8;text-decoration:underline;text-underline-offset:2px}
    .chat-answer-badge{display:inline-flex;align-items:center;justify-content:center;padding:5px 10px;border-radius:999px;font-size:.7rem;font-weight:700;letter-spacing:.02em;background:rgba(148,163,184,.14);color:#334155;border:1px solid rgba(148,163,184,.22)}
    .chat-answer-badge-direct{background:rgba(15,23,42,.06);border-color:rgba(15,23,42,.12);color:#0F172A}
    .chat-answer-badge-brain{background:rgba(37,99,235,.08);border-color:rgba(37,99,235,.18);color:#1D4ED8}
    .chat-answer-badge-website{background:rgba(8,145,178,.08);border-color:rgba(8,145,178,.18);color:#0F766E}
    .chat-answer-badge-memory{background:rgba(180,83,9,.08);border-color:rgba(180,83,9,.18);color:#9A3412}
    .chat-message.bot .chat-bubble{background:#F1F5F9;color:#0F172A;border-bottom-left-radius:4px;border:1px solid #E2E8F0}
    .chat-message.user .chat-bubble{background:#2563EB;color:#fff;border-bottom-right-radius:4px}
    .chat-message.user .chatbot-link{color:#DBEAFE}
    .chat-feedback{display:flex;align-items:center;gap:8px;margin-top:6px;padding-left:4px;flex-wrap:wrap}
    .chat-feedback-label{font-size:.72rem;color:#64748B}
    .chat-feedback-btn{border:1px solid rgba(148,163,184,.28);background:#fff;color:#334155;border-radius:999px;padding:5px 10px;font-size:.72rem;cursor:pointer;transition:.2s ease}
    .chat-feedback-btn:hover{border-color:rgba(37,99,235,.28);color:#1D4ED8;background:rgba(37,99,235,.05)}
    .chat-feedback-btn.is-active{border-color:#2563EB;background:rgba(37,99,235,.1);color:#1D4ED8}
    .chat-feedback-note{font-size:.72rem;color:#64748B}
    .chatbot-suggestions{display:flex;flex-wrap:wrap;gap:8px;padding:0 20px 16px}
    .chatbot-suggestion{border:1px solid rgba(37,99,235,.18);background:rgba(37,99,235,.06);color:#1D4ED8;border-radius:999px;padding:8px 12px;font-size:.78rem;cursor:pointer;transition:.2s ease}
    .chatbot-suggestion:hover{background:rgba(37,99,235,.12)}
    .chatbot-input-area{padding:14px 16px;border-top:1px solid #E2E8F0;display:flex;gap:8px;background:#fff;border-radius:0 0 20px 20px}
    .chatbot-input-area input{flex:1;border:1px solid #E2E8F0;border-radius:24px;padding:10px 16px;font-family:inherit;font-size:.88rem;outline:0;transition:.3s}
    .chatbot-input-area input:focus{border-color:#2563EB;box-shadow:0 0 0 2px rgba(37,99,235,.1)}
    .chatbot-input-area input:disabled{background:#F8FAFC;color:#64748B}
    .chatbot-input-area button{background:#2563EB;color:#fff;border:none;width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:.3s;flex-shrink:0}
    .chatbot-input-area button:hover{transform:scale(1.05);background:#0F172A}
    .chatbot-input-area button:disabled{opacity:.55;cursor:not-allowed;transform:none}
    .chat-typing{align-self:flex-start;display:flex;gap:4px;padding:8px 16px}
    .chat-typing span{width:8px;height:8px;background:#94A3B8;border-radius:50%;animation:chatDot 1.4s infinite}
    .chat-typing span:nth-child(2){animation-delay:.2s}
    .chat-typing span:nth-child(3){animation-delay:.4s}
    @keyframes chatDot{0%,80%,100%{transform:scale(.4);opacity:.4}40%{transform:scale(1);opacity:1}}
    `;
    document.head.appendChild(style);

    if (document.getElementById('chatbotContainer')) {
        return;
    }

    const wrap = document.createElement('div');
    wrap.innerHTML = `
    <div class="chatbot-container" id="chatbotContainer">
        <div class="chatbot-header">
            <div class="chatbot-title-wrap">
                <div class="chatbot-title"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg><span>Anot AI Assistant</span></div>
                <div class="chatbot-subtitle">Uses website knowledge, local brain, and past chats</div>
            </div>
            <button class="chatbot-toggle" id="chatbotToggle" aria-label="Close chat"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>
        </div>
        <div class="chatbot-body">
            <div class="chatbot-messages" id="chatbotMessages"></div>
            <div class="chatbot-suggestions" id="chatbotSuggestions">
                <button type="button" class="chatbot-suggestion" data-suggestion="What services do you provide?">Services</button>
                <button type="button" class="chatbot-suggestion" data-suggestion="How does Anot work?">How it works</button>
                <button type="button" class="chatbot-suggestion" data-suggestion="${isCanadianChat ? 'Is Anot PIPEDA and PHIPA compliant?' : 'Is Anot HIPAA compliant?'}">${isCanadianChat ? 'PIPEDA' : 'HIPAA'}</button>
                <button type="button" class="chatbot-suggestion" data-suggestion="Who is Anot for?">Who it helps</button>
            </div>
            <div class="chatbot-input-area">
                <input type="text" id="chatbotInput" placeholder="Ask a question..." autocomplete="off">
                <button id="chatbotSend" aria-label="Send"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg></button>
            </div>
        </div>
    </div>
    <button class="chatbot-fab" id="chatbotFab" aria-label="Open chat"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg></button>`;

    while (wrap.firstChild) {
        document.body.appendChild(wrap.firstChild);
    }

    const fab = document.getElementById('chatbotFab');
    const container = document.getElementById('chatbotContainer');
    const toggle = document.getElementById('chatbotToggle');
    const input = document.getElementById('chatbotInput');
    const sendBtn = document.getElementById('chatbotSend');
    const msgs = document.getElementById('chatbotMessages');
    const suggestions = document.getElementById('chatbotSuggestions');

    function applyFeedbackState(row, feedback) {
        if (!row) {
            return;
        }

        const helpfulBtn = row.querySelector('[data-feedback="helpful"]');
        const notHelpfulBtn = row.querySelector('[data-feedback="not_helpful"]');
        const note = row.querySelector('.chat-feedback-note');
        const status = feedback?.userStatus || '';

        helpfulBtn?.classList.toggle('is-active', status === 'helpful');
        notHelpfulBtn?.classList.toggle('is-active', status === 'not_helpful');

        if (note) {
            if (status === 'helpful') {
                note.textContent = 'Thanks. I will trust answers like this more.';
            } else if (status === 'not_helpful') {
                note.textContent = 'Thanks. I will treat answers like this more cautiously.';
            } else {
                note.textContent = '';
            }
        }
    }

    function buildFeedbackRow(answerKey, meta) {
        const row = document.createElement('div');
        row.className = 'chat-feedback';
        row.dataset.answerKey = answerKey;
        row.dataset.question = String(meta?.question || '').trim();
        row.dataset.topic = String(meta?.topic || '').trim();

        row.innerHTML = `
            <span class="chat-feedback-label">Was this helpful?</span>
            <button type="button" class="chat-feedback-btn" data-feedback="helpful">Helpful</button>
            <button type="button" class="chat-feedback-btn" data-feedback="not_helpful">Not helpful</button>
            <span class="chat-feedback-note"></span>
        `;

        applyFeedbackState(row, getFeedbackStore()[answerKey]);
        return row;
    }

    function getAnswerTypeLabel(answerType) {
        const labels = {
            direct: 'Direct answer',
            brain: 'Knowledge brain',
            website: 'Website answer',
            memory: 'Past memory'
        };

        return labels[String(answerType || '').trim()] || 'Chatbot answer';
    }

    function buildAnswerMetaRow(meta) {
        if (!meta?.answerType) {
            return null;
        }

        const row = document.createElement('div');
        row.className = 'chat-meta';
        row.innerHTML = `<span class="chat-answer-badge chat-answer-badge-${String(meta.answerType).trim()}">${getAnswerTypeLabel(meta.answerType)}</span>`;
        return row;
    }

    function addMsg(html, sender, shouldPersist, plainText, meta) {
        const item = document.createElement('div');
        item.className = `chat-message ${sender}`;

        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble';
        bubble.innerHTML = html;

        item.appendChild(bubble);

        if (sender === 'bot') {
            const metaRow = buildAnswerMetaRow(meta || {});
            if (metaRow) {
                item.appendChild(metaRow);
            }
        }

        const messageText = String(plainText || stripHtml(html)).trim();
        const answerKey = sender === 'bot'
            ? String(meta?.answerKey || createAnswerKey(messageText)).trim()
            : '';

        if (sender === 'bot' && meta?.enableFeedback !== false && messageText) {
            item.appendChild(buildFeedbackRow(answerKey, meta || {}));
        }

        msgs.appendChild(item);
        msgs.scrollTop = msgs.scrollHeight;

        if (shouldPersist) {
            const history = getHistory();
            history.push({
                sender,
                html,
                text: messageText,
                meta: meta ? {
                    answerKey: answerKey,
                    question: String(meta.question || '').trim(),
                    topic: String(meta.topic || '').trim(),
                    answerType: String(meta.answerType || '').trim(),
                    enableFeedback: meta.enableFeedback !== false
                } : null
            });
            saveHistory(history);
        }
    }

    function showTyping() {
        const typing = document.createElement('div');
        typing.className = 'chat-typing';
        typing.id = 'chatTyping';
        typing.innerHTML = '<span></span><span></span><span></span>';
        msgs.appendChild(typing);
        msgs.scrollTop = msgs.scrollHeight;
    }

    function hideTyping() {
        const typing = document.getElementById('chatTyping');
        if (typing) {
            typing.remove();
        }
    }

    function resetConversationView() {
        hideTyping();
        msgs.innerHTML = '';
        runtimeHistory = [];
        clearSession();
        saveHistory([]);
        input.value = '';
        addMsg(formatMessage(GREETING_RESPONSE), 'bot', false, GREETING_RESPONSE, { enableFeedback: false });
    }

    function openChat() {
        container.classList.add('is-open');
        fab.classList.add('is-hidden');
        window.setTimeout(function () {
            input.focus();
        }, 250);
    }

    function closeChat() {
        container.classList.remove('is-open');
        fab.classList.remove('is-hidden');
        resetConversationView();
    }

    function hydrateHistory() {
        resetConversationView();
    }

    async function handleSend(prefilledText) {
        const text = String(prefilledText || input.value || '').trim();
        if (!text) {
            return;
        }

        addMsg(formatMessage(text), 'user', true, text, { enableFeedback: false });
        input.value = '';
        input.disabled = true;
        sendBtn.disabled = true;
        showTyping();

        try {
            await ensureKnowledgeReady();
            const result = await getBotAnswer(text);
            const answer = result.answer || FALLBACK_RESPONSE;
            hideTyping();
            addMsg(formatMessage(answer), 'bot', true, answer, {
                answerKey: createAnswerKey(answer),
                question: text,
                topic: result.topic || '',
                answerType: result.answerType || '',
                enableFeedback: true
            });

            if (answer !== FALLBACK_RESPONSE && result.shouldRemember !== false) {
                rememberExchange(text, answer, result.sources || []);
            }

            updateSessionFromResult(text, result || {});
        } catch (error) {
            hideTyping();
            addMsg(formatMessage(FALLBACK_RESPONSE), 'bot', true, FALLBACK_RESPONSE, {
                answerKey: createAnswerKey(FALLBACK_RESPONSE),
                question: text,
                topic: '',
                enableFeedback: true
            });
        } finally {
            input.disabled = false;
            sendBtn.disabled = false;
            input.focus();
        }
    }

    fab.addEventListener('click', openChat);
    toggle.addEventListener('click', closeChat);
    sendBtn.addEventListener('click', function () {
        handleSend();
    });
    input.addEventListener('keypress', function (event) {
        if (event.key === 'Enter') {
            handleSend();
        }
    });

    suggestions.addEventListener('click', function (event) {
        const button = event.target.closest('[data-suggestion]');
        if (!button) {
            return;
        }

        openChat();
        handleSend(button.getAttribute('data-suggestion'));
    });

    msgs.addEventListener('click', function (event) {
        const button = event.target.closest('[data-feedback]');
        if (!button) {
            return;
        }

        const row = button.closest('.chat-feedback');
        if (!row) {
            return;
        }

        const answerKey = row.dataset.answerKey || '';
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

    hydrateHistory();
    ensureKnowledgeReady();
})();
