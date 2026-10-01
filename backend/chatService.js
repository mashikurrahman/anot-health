// ==========================================================
// Claude-powered website chat, streamed to js/chatbot-v2.js as Server-Sent Events.
//
// Wire contract expected by the widget (askAi in js/chatbot-v2.js):
//   POST /api/chat  {messages:[{role,content}], region:'us'|'ca', page:'pricing.html'}
//   200 text/event-stream, one "data: <json>" line per \n\n-separated frame:
//       {"type":"delta","text":"..."}    incremental answer text
//       {"type":"done","blocked":false}  terminal frame
//   Anything else (a non-200, or a content type that is not text/event-stream)
//   makes the widget fall back to its built-in knowledge-base bot and pause AI
//   for two minutes, so every failure path here answers a plain JSON error
//   rather than half an event stream.
//
// Answers are grounded in data/chatbot-knowledge.json - the same file the widget
// loads - so the built-in bot and the model quote one set of facts.
// ==========================================================

const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');

const API_KEY = String(process.env.ANTHROPIC_API_KEY || '').trim();
const MODEL = String(process.env.CHAT_MODEL || 'claude-opus-5-5').trim();
const MAX_TOKENS = 1024;          // answers are chat-bubble length by design
const MAX_MESSAGES = 8;           // mirrors AI_MAX_MESSAGES in the widget
const MAX_QUESTION_CHARS = 1000;  // mirrors AI_QUESTION_CHARS
const MAX_HISTORY_CHARS = 600;    // mirrors AI_HISTORY_CHARS

// Per-IP budget. The widget already paces itself; this is what stops a scripted
// client from spending the API key.
const CHAT_RATE_LIMIT = 20;
const CHAT_WINDOW_MS = 5 * 60 * 1000;
const chatRateMap = new Map();

function isChatRateLimited(ip) {
    const now = Date.now();
    const entry = chatRateMap.get(ip);
    if (!entry || now - entry[1] > CHAT_WINDOW_MS) {
        chatRateMap.set(ip, [1, now]);
        return false;
    }
    entry[0] += 1;
    return entry[0] > CHAT_RATE_LIMIT;
}

// Keeps the map from growing without bound on a long-lived process.
setInterval(() => {
    const cutoff = Date.now() - CHAT_WINDOW_MS;
    for (const [ip, entry] of chatRateMap) {
        if (entry[1] < cutoff) chatRateMap.delete(ip);
    }
}, CHAT_WINDOW_MS).unref();

// ----------------------------------------------------
// Sensitive data: never forwarded to the model, never echoed
// ----------------------------------------------------
// Same rules as looksSensitive() in js/chatbot-v2.js. The widget screens first;
// this is the check that actually counts, because the widget is editable by
// anyone with a browser console.
function luhnValid(digits) {
    let sum = 0;
    let double = false;
    for (let i = digits.length - 1; i >= 0; i -= 1) {
        let digit = Number(digits[i]);
        if (double) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        double = !double;
    }
    return sum % 10 === 0;
}

function detectSensitive(text) {
    const value = String(text || '');
    // US Social Security and Canadian Social Insurance numbers.
    if (/\b\d{3}[- ]\d{2}[- ]\d{4}\b/.test(value) || /\b\d{3}[- ]\d{3}[- ]\d{3}\b/.test(value)) {
        return true;
    }
    return (value.match(/\b(?:\d[ -]?){13,19}\b/g) || []).some((run) => {
        const digits = run.replace(/\D/g, '');
        return digits.length >= 13 && digits.length <= 19 && luhnValid(digits);
    });
}

const SENSITIVE_REPLY = 'For your security I can’t work with Social Security, Social Insurance or payment card numbers here, so I have not stored or forwarded that. Ask me anything about our services, pricing or security and I will help — for account-specific matters, please contact the team directly.';

// ----------------------------------------------------
// Grounding corpus
// ----------------------------------------------------
// data/chatbot-knowledge.json lives in the public site folder, so it is read from
// siteRoot rather than from backend/.
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

function regionalPage(page, region) {
    return region === 'ca' ? (CA_PAGE_EQUIVALENTS[page] || page) : page;
}

// data/chatbot-knowledge.json quotes prices as {{price.ai}}, {{price.verified}} and
// {{price.billing}}. The widget fills these in applyPricingTokens(); without the same
// step here the model reads the braces aloud to the visitor. data/pricing.json is the
// documented source of truth for the numbers, so they are read from it rather than
// copied - backend/test/pricing.test.js is what keeps the widget's copy honest.
// USD and CAD are set independently in pricing.json - Canadian prices are NOT a
// conversion of the US ones, and the billing notes below must never imply they are.
const US_BILLING = 'Plans are billed in US dollars, with the same price for US and international practices.';
const CA_BILLING = 'Plans are billed in Canadian dollars. Canadian pricing is set for Canadian practices, so there are no currency conversion or international card fees.';

const FALLBACK_PRICING = {
    us: { ai: '$199', verified: '$899', billing: US_BILLING },
    ca: { ai: '$139 CAD', verified: '$839 CAD', billing: CA_BILLING }
};

function loadPricing(siteRoot) {
    try {
        const raw = JSON.parse(fs.readFileSync(path.join(siteRoot, 'data', 'pricing.json'), 'utf8'));
        const usd = raw.usd;
        const cad = raw.cad;
        if (!usd || !cad) return FALLBACK_PRICING;
        return {
            us: { ai: `$${usd.aiScribe}`, verified: `$${usd.verified}`, billing: US_BILLING },
            ca: { ai: `$${cad.aiScribe} CAD`, verified: `$${cad.verified} CAD`, billing: CA_BILLING }
        };
    } catch (err) {
        console.warn('Chat: data/pricing.json unreadable, using built-in prices:', err.message);
        return FALLBACK_PRICING;
    }
}

function applyPricingTokens(text, prices) {
    return String(text || '').replace(/\{\{price\.(ai|verified|billing)\}\}/g, (match, key) => prices[key]);
}

function loadKnowledge(siteRoot) {
    const file = path.join(siteRoot, 'data', 'chatbot-knowledge.json');
    try {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (!parsed || !Array.isArray(parsed.intents) || !parsed.intents.length) {
            return { intents: [], error: 'chatbot-knowledge.json has no intents' };
        }
        return { intents: parsed.intents, error: null };
    } catch (err) {
        return { intents: [], error: `${err.code === 'ENOENT' ? 'not found' : err.message} at ${file}` };
    }
}

// Rendered once per region and reused, so the cached prefix stays byte-identical
// across requests (watch usage.cache_read_input_tokens to confirm it is hitting).
function renderKnowledge(intents, region, prices) {
    const text = intents.map((intent) => {
        const lines = [`## ${intent.title} [${intent.id}] (topic: ${intent.topic})`, intent.summary];
        (intent.highlights || []).forEach((point) => lines.push(`- ${point}`));
        if (intent.bestFit) lines.push(`Best fit: ${intent.bestFit}`);
        if (intent.nextStep) lines.push(`Suggested next step: ${intent.nextStep}`);
        const pages = (intent.sourcePages || []).map((page) => regionalPage(page, region));
        if (pages.length) lines.push(`Pages: ${pages.join(', ')}`);
        return lines.join('\n');
    }).join('\n\n');
    return applyPricingTokens(text, prices[region]);
}

function buildSystemPrompt(knowledgeText, region, prices) {
    const regionName = region === 'ca' ? 'Canada' : 'the United States';
    const privacyLaw = region === 'ca' ? 'PIPEDA' : 'HIPAA';
    const privacyPage = region === 'ca' ? 'pipeda.html' : 'hipaa.html';
    const contactPage = regionalPage('contact.html', region);
    const pricingPage = regionalPage('pricing.html', region);
    const usAi = prices?.us?.ai || '$199';
    const usVerified = prices?.us?.verified || '$899';
    const caAi = prices?.ca?.ai || '$139 CAD';
    const caVerified = prices?.ca?.verified || '$839 CAD';

    return [
        'You are Ask Anot, the assistant on the Anot Health website. Anot Health provides healthcare operations support: clinical documentation and scribing, revenue cycle and billing, coding and compliance, and payroll administration.',
        '',
        `This visitor is browsing the ${regionName} version of the site. Refer to ${privacyLaw} (${privacyPage}) rather than the other region's framework, and link to ${regionName} pages (e.g. [our pricing](${pricingPage}) or [contact us](${contactPage})), unless the visitor specifically asks about the other region or international pricing.`,
        '',
        'PRICING BY REGION & INTERNATIONAL MARKET',
        `- United States and International Market: Practices in the US and all international practices outside Canada are billed in US dollars (USD). Current pricing: AI Scribe is ${usAi}/month per provider, Verified Scribe is ${usVerified}/month per provider, and Custom pricing for groups. Paying yearly saves 15%. Link to [pricing](pricing.html).`,
        `- Canada: Canadian practices are billed in Canadian dollars (CAD). Current pricing: AI Scribe is ${caAi}/month per provider, Verified Scribe is ${caVerified}/month per provider, and Custom pricing for groups. Paying yearly saves 15%. Link to [Canadian pricing](pricing-ca.html).`,
        `- International Inquiries: If asked about international pricing, international market rates, or pricing outside Canada/US, always quote the US Dollar international rates (${usAi}/month for AI Scribe, ${usVerified}/month for Verified Scribe) and link to [our pricing](pricing.html). Never quote outdated prices ($99 or $599).`,
        '',
        'HOW TO ANSWER',
        '- Ground every factual claim in the reference below. It is the whole of what you know about Anot Health.',
        '- If the reference does not cover something, say so plainly and point the visitor to the contact page. Never invent pricing, client names, statistics, integrations, certifications or guarantees.',
        '- Be brief: two or three short paragraphs at most, or a short list. This renders in a small chat bubble.',
        // formatMessage() in js/chatbot-v2.js renders exactly this subset: blank-line
        // separated paragraphs, "- " bullets, **bold** and [label](href). Anything
        // else - headings, *italics*, numbered lists, tables, code fences - reaches
        // the visitor as literal characters.
        '- Formatting: separate paragraphs with a blank line, start list items with "- ", and use **bold** for a plan or service name. Never use headings, italics, numbered lists, tables or code blocks.',
        `- Link pages as [label](page.html), for example [our pricing](${pricingPage}) or [contact us](${contactPage}). Use only page names from the reference, and do not link to other websites.`,
        '- Speak as "we" about Anot Health. Be warm and direct, never pushy.',
        '',
        'LIMITS',
        '- You cannot look up, change or discuss any specific account, invoice, patient or claim.',
        '- Never request or repeat Social Security or Social Insurance numbers, payment card numbers, or patient health information. If a visitor offers any, tell them not to and carry on without it.',
        '- You do not give medical, legal, tax or billing-compliance advice. Refer those to the team.',
        `- For anything account-specific, a pricing quote or a demo, send the visitor to ${contactPage}.`,
        '',
        'REFERENCE',
        knowledgeText
    ].join('\n');
}

// ----------------------------------------------------
// Request validation
// ----------------------------------------------------
function normaliseMessages(raw) {
    if (!Array.isArray(raw)) return null;
    const trimmed = raw.slice(-MAX_MESSAGES);
    const messages = [];
    for (let i = 0; i < trimmed.length; i += 1) {
        const entry = trimmed[i];
        if (!entry || (entry.role !== 'user' && entry.role !== 'assistant')) return null;
        const limit = i === trimmed.length - 1 ? MAX_QUESTION_CHARS : MAX_HISTORY_CHARS;
        const content = String(entry.content == null ? '' : entry.content).trim().slice(0, limit);
        if (!content) continue;
        // Consecutive same-role turns are merged: the widget can drop a turn when
        // a visitor stops a reply mid-stream, and a history that starts with an
        // assistant turn is not a valid request.
        if (messages.length && messages[messages.length - 1].role === entry.role) {
            messages[messages.length - 1].content += `\n\n${content}`;
            continue;
        }
        messages.push({ role: entry.role, content });
    }
    while (messages.length && messages[0].role !== 'user') messages.shift();
    if (!messages.length || messages[messages.length - 1].role !== 'user') return null;
    return messages;
}

// ----------------------------------------------------
// Handler
// ----------------------------------------------------
function createChatHandler({ siteRoot, getClientIp }) {
    const knowledge = loadKnowledge(siteRoot);
    const prices = loadPricing(siteRoot);
    const enabled = Boolean(API_KEY) && knowledge.intents.length > 0;

    const client = enabled ? new Anthropic({ apiKey: API_KEY, maxRetries: 1 }) : null;
    const systemByRegion = {
        us: enabled ? buildSystemPrompt(renderKnowledge(knowledge.intents, 'us', prices), 'us', prices) : '',
        ca: enabled ? buildSystemPrompt(renderKnowledge(knowledge.intents, 'ca', prices), 'ca', prices) : ''
    };

    function openStream(res) {
        res.status(200);
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();
    }

    function sse(res, payload) {
        // One data line per frame: the widget reads only the first "data: " line
        // it finds in a frame, and JSON.stringify escapes every newline it holds.
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }

    const handler = async (req, res) => {
        if (!enabled) {
            return res.status(503).json({ success: false, error: 'AI chat is not configured.' });
        }

        const ip = getClientIp(req);
        if (isChatRateLimited(ip)) {
            return res.status(429).json({ success: false, error: 'Too many questions. Please wait a few minutes.' });
        }

        const body = req.body || {};
        const messages = normaliseMessages(body.messages);
        if (!messages) {
            return res.status(400).json({ success: false, error: 'A question is required.' });
        }
        const region = body.region === 'ca' ? 'ca' : 'us';
        const page = regionalPage(String(body.page || 'index.html').slice(0, 60), region);

        // Screened before the API call, so a card or SSN never leaves this process.
        if (messages.some((message) => detectSensitive(message.content))) {
            openStream(res);
            sse(res, { type: 'delta', text: SENSITIVE_REPLY });
            sse(res, { type: 'done', blocked: true });
            return res.end();
        }

        let stream;
        try {
            stream = client.messages.stream({
                model: MODEL,
                max_tokens: MAX_TOKENS,
                system: [
                    {
                        type: 'text',
                        text: systemByRegion[region],
                        // Byte-identical on every request in a region, so it is the
                        // right cache prefix, and the volatile page hint below is
                        // deliberately kept after this breakpoint.
                        //
                        // Measured: it does NOT cache on claude-haiku-4-5, which needs
                        // a 4096-token prefix; this one is ~3.2K, so the marker is a
                        // silent no-op (cache_creation_input_tokens stays 0 - there is
                        // no error). At ~3.2K input tokens a question that is a
                        // fraction of a cent, so it is left in place rather than tuned:
                        // it starts paying off by itself if the knowledge base grows
                        // past 4K tokens, or immediately on a CHAT_MODEL whose minimum
                        // is lower (512 on claude-opus-5-5 / claude-sonnet-5-5).
                        cache_control: { type: 'ephemeral' }
                    },
                    { type: 'text', text: `The visitor is currently reading ${page}.` }
                ],
                messages
            });
        } catch (err) {
            console.error('Chat: could not start the stream:', err && err.message);
            return res.status(503).json({ success: false, error: 'AI chat is temporarily unavailable.' });
        }

        // From here the response is an event stream. The widget treats an early
        // end as "interrupted" and keeps the text it already has, so failures
        // after this point close the stream rather than change the status.
        openStream(res);

        // The visitor pressing Stop aborts the fetch; stop paying for the rest.
        let clientGone = false;
        const onClose = () => {
            clientGone = true;
            try { stream.abort(); } catch (err) { /* already settled */ }
        };
        res.on('close', onClose);

        try {
            for await (const event of stream) {
                if (clientGone) break;
                if (event.type === 'content_block_delta' && event.delta.type === 'text_delta' && event.delta.text) {
                    sse(res, { type: 'delta', text: event.delta.text });
                }
            }
            if (clientGone) return;

            const final = await stream.finalMessage();
            if (final.stop_reason === 'refusal') {
                // A safety decline: the widget renders a blocked answer as a plain
                // message, with no AI tag, no feedback control and no follow-ups.
                sse(res, { type: 'delta', text: '\n\nI can’t help with that one. Ask me about our services, pricing or security instead.' });
                sse(res, { type: 'done', blocked: true });
            } else {
                sse(res, { type: 'done', blocked: false });
            }
        } catch (err) {
            if (!clientGone) {
                console.error('Chat: stream failed:', err && err.message);
            }
        } finally {
            res.removeListener('close', onClose);
            if (!clientGone) res.end();
        }
    };

    handler.describe = () => {
        if (!API_KEY) {
            return 'Chat endpoint: DISABLED (set ANTHROPIC_API_KEY in backend/.env) - the widget uses its built-in bot';
        }
        if (knowledge.error) {
            return `Chat endpoint: DISABLED (knowledge base ${knowledge.error}) - the widget uses its built-in bot`;
        }
        return `Chat endpoint: ready at /api/chat (model ${MODEL}, ${knowledge.intents.length} knowledge intents)`;
    };

    return handler;
}

module.exports = { createChatHandler };
