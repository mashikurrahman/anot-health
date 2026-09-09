/**
 * Local admin view for the Anot Health no-API chatbot.
 * Reads browser storage plus the curated knowledge file and local override intents.
 */
(function () {
    'use strict';

    const MEMORY_KEY = 'anot-chatbot-memory-v3';
    const FEEDBACK_KEY = 'anot-chatbot-feedback-v1';
    const WEAK_QUESTIONS_KEY = 'anot-chatbot-weak-questions-v1';
    const SESSION_KEY = 'anot-chatbot-session-v1';
    const OVERRIDE_INTENTS_KEY = 'anot-chatbot-override-intents-v1';
    const KNOWLEDGE_BRAIN_URL = 'data/chatbot-knowledge.json';

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

    function clearJson(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            // Ignore storage errors.
        }
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function slugify(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .trim();
    }

    function formatDate(timestamp) {
        const date = new Date(Number(timestamp || 0));
        if (Number.isNaN(date.getTime())) {
            return 'Unknown';
        }

        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        }).format(date);
    }

    function renderEmptyState(message) {
        return `<div class="chatbot-admin-empty">${escapeHtml(message)}</div>`;
    }

    function buildStatCard(label, value, caption) {
        return `
            <article class="premium-card chatbot-admin-stat">
                <span class="detail-eyebrow">${escapeHtml(label)}</span>
                <strong>${escapeHtml(value)}</strong>
                <p>${escapeHtml(caption)}</p>
            </article>
        `;
    }

    function downloadJson(filename, data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function parseListInput(value) {
        return String(value || '')
            .split(/\n|,/)
            .map(function (item) {
                return item.trim();
            })
            .filter(Boolean);
    }

    function summarizeFeedback(feedbackStore) {
        const records = Object.entries(feedbackStore || {}).map(function (entry) {
            return {
                answerKey: entry[0],
                helpfulCount: Number(entry[1]?.helpfulCount || 0),
                notHelpfulCount: Number(entry[1]?.notHelpfulCount || 0),
                userStatus: String(entry[1]?.userStatus || '').trim(),
                updatedAt: Number(entry[1]?.updatedAt || 0)
            };
        });

        const helpfulVotes = records.reduce(function (sum, record) {
            return sum + record.helpfulCount;
        }, 0);
        const notHelpfulVotes = records.reduce(function (sum, record) {
            return sum + record.notHelpfulCount;
        }, 0);

        return {
            records: records.sort(function (a, b) {
                return (b.notHelpfulCount + b.helpfulCount) - (a.notHelpfulCount + a.helpfulCount);
            }),
            helpfulVotes: helpfulVotes,
            notHelpfulVotes: notHelpfulVotes
        };
    }

    function getOverrideIntents() {
        const entries = readJson(OVERRIDE_INTENTS_KEY, []);
        return Array.isArray(entries) ? entries : [];
    }

    function saveOverrideIntents(intents) {
        writeJson(OVERRIDE_INTENTS_KEY, Array.isArray(intents) ? intents : []);
    }

    function renderKnowledge(intents) {
        if (!Array.isArray(intents) || !intents.length) {
            return renderEmptyState('No curated knowledge intents were found.');
        }

        return `
            <div class="chatbot-admin-list">
                ${intents.map(function (intent) {
                    return `
                        <article class="chatbot-admin-item">
                            <div class="chatbot-admin-item-top">
                                <h4>${escapeHtml(intent.title)}</h4>
                                <span class="chatbot-admin-chip">${escapeHtml(intent.topic || 'general')}</span>
                            </div>
                            <p>${escapeHtml(intent.summary)}</p>
                            <div class="chatbot-admin-meta">
                                <span>${escapeHtml((intent.triggers || []).length + ' triggers')}</span>
                                <span>${escapeHtml((intent.sourcePages || []).join(', ') || 'No sources')}</span>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
        `;
    }

    function renderOverrideIntents(intents) {
        if (!Array.isArray(intents) || !intents.length) {
            return renderEmptyState('No local override intents yet. Use the form above to train a browser-local answer.');
        }

        return `
            <div class="chatbot-admin-list">
                ${intents.map(function (intent) {
                    return `
                        <article class="chatbot-admin-item">
                            <div class="chatbot-admin-item-top">
                                <h4>${escapeHtml(intent.title)}</h4>
                                <span class="chatbot-admin-chip">${escapeHtml(intent.topic || 'general')}</span>
                            </div>
                            <p>${escapeHtml(intent.summary)}</p>
                            <div class="chatbot-admin-meta">
                                <span>${escapeHtml((intent.triggers || []).length + ' triggers')}</span>
                                <span>${escapeHtml((intent.sourcePages || []).join(', ') || 'No sources')}</span>
                            </div>
                            <div class="chatbot-admin-actions chatbot-admin-item-actions">
                                <button type="button" class="btn btn-outline btn-admin-inline" data-edit-override="${escapeHtml(intent.id)}">Edit</button>
                                <button type="button" class="btn btn-outline btn-admin-clear btn-admin-inline" data-delete-override="${escapeHtml(intent.id)}">Delete</button>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
        `;
    }

    function renderMemory(memory) {
        if (!Array.isArray(memory) || !memory.length) {
            return renderEmptyState('No reusable memory has been saved in this browser yet.');
        }

        return `
            <div class="chatbot-admin-list">
                ${memory.slice().sort(function (a, b) {
                    return Number(b.savedAt || 0) - Number(a.savedAt || 0);
                }).map(function (entry, index) {
                    return `
                        <article class="chatbot-admin-item">
                            <div class="chatbot-admin-item-top">
                                <h4>${escapeHtml(entry.question || 'Untitled question')}</h4>
                                <span class="chatbot-admin-chip">${escapeHtml(formatDate(entry.savedAt))}</span>
                            </div>
                            <p>${escapeHtml(entry.answer || '')}</p>
                            <div class="chatbot-admin-meta">
                                <span>${escapeHtml((entry.sources || []).join(', ') || 'No sources')}</span>
                            </div>
                            <div class="chatbot-admin-actions chatbot-admin-item-actions">
                                <button type="button" class="btn btn-outline btn-admin-inline" data-seed-memory="${String(index)}">Use in training console</button>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
        `;
    }

    function renderWeakQuestions(weakQuestions) {
        if (!Array.isArray(weakQuestions) || !weakQuestions.length) {
            return renderEmptyState('No weak questions have been logged yet.');
        }

        return `
            <div class="chatbot-admin-list">
                ${weakQuestions.slice().sort(function (a, b) {
                    return Number(b.savedAt || 0) - Number(a.savedAt || 0);
                }).map(function (entry, index) {
                    return `
                        <article class="chatbot-admin-item">
                            <div class="chatbot-admin-item-top">
                                <h4>${escapeHtml(entry.question || 'Unknown question')}</h4>
                                <span class="chatbot-admin-chip">${escapeHtml(entry.topic || 'general')}</span>
                            </div>
                            <div class="chatbot-admin-meta">
                                <span>${escapeHtml(formatDate(entry.savedAt))}</span>
                                <span>${escapeHtml(entry.answerKey || '')}</span>
                            </div>
                            <div class="chatbot-admin-actions chatbot-admin-item-actions">
                                <button type="button" class="btn btn-outline btn-admin-inline" data-seed-weak="${String(index)}">Use in training console</button>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
        `;
    }

    function renderFeedback(summary) {
        if (!summary.records.length) {
            return renderEmptyState('No feedback has been captured in this browser yet.');
        }

        return `
            <div class="chatbot-admin-table-wrap">
                <table class="chatbot-admin-table">
                    <thead>
                        <tr>
                            <th>Answer Signature</th>
                            <th>Helpful</th>
                            <th>Not Helpful</th>
                            <th>Latest Signal</th>
                            <th>Updated</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${summary.records.map(function (record) {
                            return `
                                <tr>
                                    <td>${escapeHtml(record.answerKey)}</td>
                                    <td>${escapeHtml(String(record.helpfulCount))}</td>
                                    <td>${escapeHtml(String(record.notHelpfulCount))}</td>
                                    <td>${escapeHtml(record.userStatus || 'none')}</td>
                                    <td>${escapeHtml(formatDate(record.updatedAt))}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    function fillTrainingForm(formElements, intent) {
        formElements.id.value = intent?.id || '';
        formElements.title.value = intent?.title || '';
        formElements.topic.value = intent?.topic || 'services';
        formElements.triggers.value = Array.isArray(intent?.triggers) ? intent.triggers.join('\n') : '';
        formElements.summary.value = intent?.summary || '';
        formElements.highlights.value = Array.isArray(intent?.highlights) ? intent.highlights.join('\n') : '';
        formElements.bestFit.value = intent?.bestFit || '';
        formElements.nextStep.value = intent?.nextStep || '';
        formElements.sources.value = Array.isArray(intent?.sourcePages) ? intent.sourcePages.join(', ') : '';
    }

    function buildIntentFromForm(formElements) {
        const title = String(formElements.title.value || '').trim();
        return {
            id: String(formElements.id.value || `override-${slugify(title) || Date.now()}`).trim(),
            topic: String(formElements.topic.value || 'services').trim(),
            title: title,
            triggers: parseListInput(formElements.triggers.value),
            summary: String(formElements.summary.value || '').trim(),
            highlights: parseListInput(formElements.highlights.value),
            bestFit: String(formElements.bestFit.value || '').trim(),
            nextStep: String(formElements.nextStep.value || '').trim(),
            sourcePages: parseListInput(formElements.sources.value)
        };
    }

    async function init() {
        const statsEl = document.getElementById('chatbotAdminStats');
        const overridesEl = document.getElementById('chatbotAdminOverrides');
        const knowledgeEl = document.getElementById('chatbotAdminKnowledge');
        const memoryEl = document.getElementById('chatbotAdminMemory');
        const weakEl = document.getElementById('chatbotAdminWeak');
        const feedbackEl = document.getElementById('chatbotAdminFeedback');
        const trainingForm = document.getElementById('chatbotTrainingForm');

        const formElements = {
            id: document.getElementById('trainingIntentId'),
            title: document.getElementById('trainingTitle'),
            topic: document.getElementById('trainingTopic'),
            triggers: document.getElementById('trainingTriggers'),
            summary: document.getElementById('trainingSummary'),
            highlights: document.getElementById('trainingHighlights'),
            bestFit: document.getElementById('trainingBestFit'),
            nextStep: document.getElementById('trainingNextStep'),
            sources: document.getElementById('trainingSources'),
            reset: document.getElementById('trainingReset')
        };

        const memory = readJson(MEMORY_KEY, []);
        const feedbackStore = readJson(FEEDBACK_KEY, {});
        const weakQuestions = readJson(WEAK_QUESTIONS_KEY, []);
        const session = readJson(SESSION_KEY, null);
        const overrideIntents = getOverrideIntents();

        let knowledge = { intents: [] };
        try {
            const response = await fetch(KNOWLEDGE_BRAIN_URL, { credentials: 'same-origin' });
            knowledge = response.ok ? await response.json() : { intents: [] };
        } catch (error) {
            knowledge = { intents: [] };
        }

        const feedbackSummary = summarizeFeedback(feedbackStore);
        const activeSessionTopic = session?.activeTopicLabel || session?.activeTopic || 'No active topic';

        statsEl.innerHTML = [
            buildStatCard('Curated intents', String((knowledge.intents || []).length), 'Manually controlled answers in the local knowledge brain'),
            buildStatCard('Local overrides', String(overrideIntents.length), 'Browser-local intents created from the training console'),
            buildStatCard('Saved memory', String(Array.isArray(memory) ? memory.length : 0), 'Reusable question and answer pairs learned in this browser'),
            buildStatCard('Helpful votes', String(feedbackSummary.helpfulVotes), 'Positive signals attached to chatbot answers'),
            buildStatCard('Weak questions', String(Array.isArray(weakQuestions) ? weakQuestions.length : 0), 'Questions that still need stronger handling'),
            buildStatCard('Active topic', activeSessionTopic, 'Latest remembered conversation context')
        ].join('');

        overridesEl.innerHTML = renderOverrideIntents(overrideIntents);
        knowledgeEl.innerHTML = renderKnowledge(knowledge.intents || []);
        memoryEl.innerHTML = renderMemory(memory);
        weakEl.innerHTML = renderWeakQuestions(weakQuestions);
        feedbackEl.innerHTML = renderFeedback(feedbackSummary);

        document.querySelectorAll('[data-export]').forEach(function (button) {
            button.addEventListener('click', function () {
                const kind = button.getAttribute('data-export');
                const filenameMap = {
                    knowledge: 'chatbot-knowledge.json',
                    overrides: 'chatbot-override-intents.json',
                    memory: 'chatbot-memory.json',
                    weak: 'chatbot-weak-questions.json',
                    feedback: 'chatbot-feedback.json'
                };
                const dataMap = {
                    knowledge: knowledge,
                    overrides: overrideIntents,
                    memory: memory,
                    weak: weakQuestions,
                    feedback: feedbackStore
                };

                downloadJson(filenameMap[kind] || 'chatbot-export.json', dataMap[kind] || {});
            });
        });

        document.querySelectorAll('[data-clear]').forEach(function (button) {
            button.addEventListener('click', function () {
                const kind = button.getAttribute('data-clear');
                const keyMap = {
                    memory: MEMORY_KEY,
                    weak: WEAK_QUESTIONS_KEY,
                    feedback: FEEDBACK_KEY
                };

                if (!keyMap[kind]) {
                    return;
                }

                clearJson(keyMap[kind]);

                if (kind === 'feedback') {
                    clearJson(SESSION_KEY);
                }

                window.location.reload();
            });
        });

        document.querySelectorAll('[data-edit-override]').forEach(function (button) {
            button.addEventListener('click', function () {
                const intentId = button.getAttribute('data-edit-override');
                const selected = overrideIntents.find(function (intent) {
                    return intent.id === intentId;
                });

                if (!selected) {
                    return;
                }

                fillTrainingForm(formElements, selected);
                trainingForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });

        document.querySelectorAll('[data-delete-override]').forEach(function (button) {
            button.addEventListener('click', function () {
                const intentId = button.getAttribute('data-delete-override');
                const remaining = overrideIntents.filter(function (intent) {
                    return intent.id !== intentId;
                });
                saveOverrideIntents(remaining);
                window.location.reload();
            });
        });

        document.querySelectorAll('[data-seed-memory]').forEach(function (button) {
            button.addEventListener('click', function () {
                const index = Number(button.getAttribute('data-seed-memory'));
                const entry = Array.isArray(memory) ? memory[index] : null;
                if (!entry) {
                    return;
                }

                fillTrainingForm(formElements, {
                    id: '',
                    title: entry.question,
                    topic: 'services',
                    triggers: [entry.question],
                    summary: entry.answer,
                    highlights: [],
                    bestFit: '',
                    nextStep: '',
                    sourcePages: entry.sources || []
                });
                trainingForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });

        document.querySelectorAll('[data-seed-weak]').forEach(function (button) {
            button.addEventListener('click', function () {
                const index = Number(button.getAttribute('data-seed-weak'));
                const entry = Array.isArray(weakQuestions) ? weakQuestions[index] : null;
                if (!entry) {
                    return;
                }

                fillTrainingForm(formElements, {
                    id: '',
                    title: entry.question,
                    topic: entry.topic || 'services',
                    triggers: [entry.question],
                    summary: '',
                    highlights: [],
                    bestFit: '',
                    nextStep: '',
                    sourcePages: []
                });
                trainingForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });

        trainingForm.addEventListener('submit', function (event) {
            event.preventDefault();
            const intent = buildIntentFromForm(formElements);

            if (!intent.title || !intent.summary) {
                return;
            }

            const current = getOverrideIntents();
            const existingIndex = current.findIndex(function (entry) {
                return entry.id === intent.id;
            });

            if (existingIndex >= 0) {
                current[existingIndex] = intent;
            } else {
                current.push(intent);
            }

            saveOverrideIntents(current);
            window.location.reload();
        });

        formElements.reset.addEventListener('click', function () {
            fillTrainingForm(formElements, {
                id: '',
                title: '',
                topic: 'services',
                triggers: [],
                summary: '',
                highlights: [],
                bestFit: '',
                nextStep: '',
                sourcePages: []
            });
        });

        fillTrainingForm(formElements, {
            id: '',
            title: '',
            topic: 'services',
            triggers: [],
            summary: '',
            highlights: [],
            bestFit: '',
            nextStep: '',
            sourcePages: []
        });
    }

    init();
})();
