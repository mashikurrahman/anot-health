// ==========================================================
// data/pricing.json is the source of truth for plan prices, but the pricing pages
// and the chatbot's built-in bot each keep their own copy of the numbers. This is
// the test those copies are checked against - referenced from data/pricing.json
// and from js/chatbot-v2.js, and missing from the deploy bundle until now.
//
// A price that drifts here is a price the chatbot quotes wrongly to a prospect,
// so these are exact-match assertions rather than "looks about right".
//
//   node --test "test/**/*.test.js"      (or: npm test)
// ==========================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// In the deployed layout backend/ sits inside the site root. In the development
// layout the two halves are unpacked side by side, so fall back to that.
function resolveSiteRoot() {
    const candidates = [
        path.resolve(__dirname, '..', '..'),
        path.resolve(__dirname, '..', '..', 'anot-frontend-ready')
    ];
    const found = candidates.find((dir) => fs.existsSync(path.join(dir, 'data', 'pricing.json')));
    if (!found) {
        throw new Error(`Could not find data/pricing.json. Looked in:\n  ${candidates.join('\n  ')}`);
    }
    return found;
}

const SITE_ROOT = resolveSiteRoot();
const read = (...parts) => fs.readFileSync(path.join(SITE_ROOT, ...parts), 'utf8');
const pricing = JSON.parse(read('data', 'pricing.json'));

// Pulls `const NAME = { ... };` out of the widget and evaluates just that object,
// so the test reads the same literal the browser does.
function widgetPricing(name) {
    const source = read('js', 'chatbot-v2.js');
    const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*(\\{[\\s\\S]*?\\});`));
    assert.ok(match, `${name} is no longer declared in js/chatbot-v2.js - update this test alongside it.`);
    return Function(`"use strict"; return (${match[1]});`)();
}

test('pricing.json has the shape the site depends on', () => {
    for (const region of ['usd', 'cad']) {
        assert.ok(pricing[region], `pricing.json is missing the "${region}" block`);
        for (const key of ['aiScribe', 'verified', 'aiScribeYearly', 'verifiedYearly', 'yearlyDiscountPercent']) {
            assert.equal(typeof pricing[region][key], 'number', `${region}.${key} must be a number`);
        }
    }
});

// USD and CAD used to be linked by an exchange rate. They are now set independently,
// so nothing should reintroduce a conversion - a stale rate left in the file is what
// would tempt someone to "correct" one currency to match the other.
test('the two currencies are priced independently, with no exchange rate left behind', () => {
    for (const stale of ['perUsd', 'asOf', 'source']) {
        assert.equal(pricing.cad[stale], undefined,
            `pricing.json still carries cad.${stale}; Canadian prices are no longer derived from USD`);
    }
});

test('yearly prices match each currency\'s advertised discount', () => {
    for (const region of ['usd', 'cad']) {
        const keep = 1 - (pricing[region].yearlyDiscountPercent / 100);
        assert.equal(Math.round(pricing[region].aiScribe * keep), pricing[region].aiScribeYearly,
            `${region}.aiScribeYearly is not ${pricing[region].yearlyDiscountPercent}% off ${region}.aiScribe`);
        assert.equal(Math.round(pricing[region].verified * keep), pricing[region].verifiedYearly,
            `${region}.verifiedYearly is not ${pricing[region].yearlyDiscountPercent}% off ${region}.verified`);
    }
});

test("the chatbot's built-in bot quotes the US prices from pricing.json", () => {
    const quoted = widgetPricing('PRICING_US');
    assert.equal(quoted.ai, `$${pricing.usd.aiScribe}`);
    assert.equal(quoted.verified, `$${pricing.usd.verified}`);
});

test("the chatbot's built-in bot quotes the Canadian prices from pricing.json", () => {
    const quoted = widgetPricing('PRICING_CA');
    assert.equal(quoted.ai, `$${pricing.cad.aiScribe} CAD`);
    assert.equal(quoted.verified, `$${pricing.cad.verified} CAD`);
    // It must not claim the Canadian price is a conversion of the US one - that was
    // true once and is now false, which is worse than saying nothing.
    assert.ok(!/converted from/i.test(quoted.billing),
        'PRICING_CA.billing still describes Canadian prices as converted from USD');
    for (const usdPrice of [pricing.usd.aiScribe, pricing.usd.verified]) {
        assert.ok(!quoted.billing.includes(`$${usdPrice}`),
            `PRICING_CA.billing quotes the US price $${usdPrice} to Canadian visitors`);
    }
});

// Prices appear in the page title, the meta description, the Open Graph and Twitter
// cards, and the schema.org offers Google reads. A price updated on the page but not
// in the markup is the version that shows up in search results.
test('pricing.html metadata and structured data carry the current US prices', () => {
    const html = read('pricing.html');
    const { aiScribe, verified } = pricing.usd;

    assert.ok(html.includes(`From $${aiScribe} per provider`),
        `pricing.html title/og/twitter still advertises a price other than $${aiScribe}`);
    assert.equal(html.match(/From \$\d+ per provider/g).length, 3,
        'expected the "From $N per provider" headline in the title, og:title and twitter:title');

    assert.ok(html.includes(`"price": "${aiScribe}.00"`), `pricing.html JSON-LD is missing the $${aiScribe} offer`);
    assert.ok(html.includes(`"price": "${verified}.00"`), `pricing.html JSON-LD is missing the $${verified} offer`);

    // Nothing anywhere in the page should still show a superseded amount.
    for (const stale of ['$99', '$599', '"99.00"', '"599.00"']) {
        assert.ok(!html.includes(stale), `pricing.html still contains the old price ${stale}`);
    }
});

test('the Canadian page shows CAD prices and claims no conversion', () => {
    const html = read('pricing-ca.html');
    assert.ok(html.includes(`$${pricing.cad.aiScribe}`), `pricing-ca.html does not show $${pricing.cad.aiScribe}`);
    assert.ok(html.includes(`$${pricing.cad.verified}`), `pricing-ca.html does not show $${pricing.cad.verified}`);
    assert.ok(!/Bank of Canada rate/i.test(html),
        'pricing-ca.html still explains Canadian prices as a Bank of Canada conversion');
    for (const usdPrice of [pricing.usd.aiScribe, pricing.usd.verified]) {
        assert.ok(!html.includes(`$${usdPrice} USD`),
            `pricing-ca.html quotes the US price $${usdPrice} USD to Canadian visitors`);
    }
});

test('the knowledge base quotes prices by token, never as literal numbers', () => {
    // backend/chatService.js and the widget both substitute {{price.*}}. A price typed
    // straight into the knowledge base would bypass both and never get updated.
    const knowledge = read('data', 'chatbot-knowledge.json');
    for (const token of ['{{price.ai}}', '{{price.verified}}', '{{price.billing}}']) {
        assert.ok(knowledge.includes(token), `chatbot-knowledge.json no longer uses ${token}`);
    }
    for (const literal of [`$${pricing.usd.aiScribe}`, `$${pricing.usd.verified}`, `$${pricing.cad.aiScribe}`, `$${pricing.cad.verified}`]) {
        assert.ok(!knowledge.includes(literal),
            `chatbot-knowledge.json hardcodes ${literal} - use a {{price.*}} token so both regions stay correct`);
    }
});

test('the pricing pages show the prices from pricing.json', () => {
    const us = read('pricing.html');
    assert.ok(us.includes(`$${pricing.usd.aiScribe}`), `pricing.html does not show $${pricing.usd.aiScribe}`);
    assert.ok(us.includes(`$${pricing.usd.verified}`), `pricing.html does not show $${pricing.usd.verified}`);
    assert.ok(us.includes(`$${pricing.usd.aiScribeYearly}`), `pricing.html does not show the yearly price $${pricing.usd.aiScribeYearly}`);

    const ca = read('pricing-ca.html');
    assert.ok(ca.includes(`$${pricing.cad.aiScribe}`), `pricing-ca.html does not show $${pricing.cad.aiScribe}`);
    assert.ok(ca.includes(`$${pricing.cad.verified}`), `pricing-ca.html does not show $${pricing.cad.verified}`);
    assert.ok(ca.includes(`$${pricing.cad.verifiedYearly}`), `pricing-ca.html does not show the yearly price $${pricing.cad.verifiedYearly}`);
});
