/* eslint-disable newline-per-chained-call */

import EmberObject from "@ember/object";
import { moduleForComponent, test } from "ember-qunit";
import hbs from "htmlbars-inline-precompile";

moduleForComponent("transaction-form", "Integration | Component | transaction form", {
    integration: true,
});

test("it renders", function (assert) {
    assert.expect(5);

    this.render(hbs`{{transaction-form}}`);

    assert.equal(this.$(".transaction-payer").find(":selected").val(), "");
    assert.equal(this.$(".transaction-name").val(), "");
    assert.equal(this.$(".transaction-name").attr("placeholder"), "Example: Tickets to museum");
    // no transaction bound at all, so there's nothing to seed a row from
    assert.equal(this.$(".transaction-amount").length, 0);
    assert.equal(this.$(".transaction-obey-factors").is(":checked"), false);
});

test("it renders with transaction model", function (assert) {
    assert.expect(5);

    const users = [
        { id: 1, name: "Bob" },
        { id: 2, name: "John" },
        { id: 3, name: "Billy" },
    ];

    const transaction = EmberObject.create({
        payer: users[1],
        name: "Gift for Alice",
        amount: "200",
        participants: users.slice(1),
        obeyFactors: false,
        amountEntries: [EmberObject.create({ value: "200" })],
    });

    this.set("users", users);
    this.set("transaction", transaction);
    this.render(hbs`{{transaction-form transaction=transaction users=users}}`);

    assert.equal(this.$(".transaction-payer").find(":selected").text().trim(), "John");
    assert.equal(this.$(".transaction-name").val(), "Gift for Alice");
    assert.equal(this.$(".transaction-amount").val(), "200");
    assert.equal(this.$(".transaction-participants").find(":checked").length, 2);
    assert.equal(this.$(".transaction-obey-factors").is(":checked"), false);
});

// regression test - the delete button had no explicit type, so it defaulted
// to type="submit" and, being first in the form, pressing Enter in any text
// field (e.g. while editing the name) submitted the form via delete instead
// of save
test("the delete button can't be triggered by pressing Enter in a text field", function (assert) {
    const transaction = EmberObject.create({ name: "Existing transaction" });

    this.set("transaction", transaction);
    this.render(hbs`{{transaction-form transaction=transaction}}`);

    assert.equal(this.$(".delete-transaction").attr("type"), "button");
});

test("it offers expense, donation and deposit as transaction types", function (assert) {
    assert.expect(4);

    const transaction = EmberObject.create({
        payer: { id: 1, name: "Bob" },
        type: "donation",
        selectedTransactionType: { value: "donation", label: "Donation (e.g. birthday gift)" },
    });

    this.set("transaction", transaction);
    this.render(hbs`{{transaction-form transaction=transaction users=transaction.participants}}`);

    assert.equal(this.$(".transaction-type option").length, 4);
    assert.equal(this.$(".transaction-type option").eq(0).text().trim(), "Expense");
    assert.equal(this.$(".transaction-type select").val(), "donation");
    assert.equal(this.$(".transaction-type").find(":selected").text().trim(), "Donation (e.g. birthday gift)");
});

test("it still shows a participants section for donations, with a contextual label", function (assert) {
    assert.expect(2);

    const alice = { id: 2, name: "Alice" };
    const carol = { id: 3, name: "Carol" };

    const transaction = EmberObject.create({
        payer: { id: 1, name: "Bob" },
        name: "Alice's birthday gift",
        amount: "20",
        type: "donation",
        participants: [alice, carol],
        participantsLabel: "Credit this donation to (split according to their weight):",
    });

    this.set("transaction", transaction);
    this.render(hbs`{{transaction-form transaction=transaction users=transaction.participants}}`);

    assert.equal(
        this.$(".transaction-participants").closest(".form-group").find(".control-label").text().trim(),
        "Credit this donation to (split according to their weight):"
    );
    assert.equal(this.$(".transaction-participants").find(":checked").length, 2);
});

test("it shows an amount per person instead of a split for deposits", function (assert) {
    assert.expect(6);

    const bob = { id: 1, name: "Bob" };
    const alice = { id: 2, name: "Alice" };

    const transaction = EmberObject.create({
        name: "Flat prepayment",
        type: "deposit",
        isDeposit: true,
        usesContributionEntries: true,
        totalContributions: 250,
        transactionCurrency: { code: "USD" },
        contributionEntries: [
            EmberObject.create({ user: bob, amount: 150 }),
            EmberObject.create({ user: alice, amount: 100 }),
        ],
        event: {
            currency: { code: "USD" },
        },
    });

    this.set("transaction", transaction);
    this.render(hbs`{{transaction-form transaction=transaction users=transaction.participants}}`);

    // the payer field is still shown for a deposit, just optional - it's
    // who the money is directed to, if anyone in particular
    assert.equal(this.$(".transaction-payer").length, 1);
    assert.equal(this.$(".transaction-amount").length, 0);
    assert.equal(this.$(".transaction-participants").length, 0);
    assert.equal(this.$(".transaction-contributions li").length, 2);
    assert.equal(this.$(".transaction-contributions .contribution-amount").eq(0).val(), "150");
    assert.equal(this.$(".transaction-contributions-total").text().trim(), "Total: 250.00 USD");
});

test("it lets a deposit optionally be directed to one person", function (assert) {
    assert.expect(2);

    const dave = { id: 1, name: "Dave" };

    const transaction = EmberObject.create({
        name: "Flat prepayment",
        type: "deposit",
        isDeposit: true,
        usesContributionEntries: true,
        payer: dave,
        payerLabel: "Who is this going to? (optional)",
        totalContributions: 250,
        contributionEntries: [],
        event: {
            currency: { code: "USD" },
        },
    });

    this.set("transaction", transaction);
    this.set("users", [dave]);
    this.render(hbs`{{transaction-form transaction=transaction users=users}}`);

    assert.equal(
        this.$(".transaction-payer").closest(".form-group").find(".control-label").text().trim(),
        "Who is this going to? (optional)"
    );
    assert.equal(this.$(".transaction-payer").find(":selected").text().trim(), "Dave");
});

test("it keeps the payer but swaps the split for exact amounts on an itemized expense", function (assert) {
    assert.expect(6);

    const alice = { id: 1, name: "Alice" };
    const bob = { id: 2, name: "Bob" };

    const transaction = EmberObject.create({
        payer: alice,
        name: "Groceries",
        type: "itemized",
        usesContributionEntries: true,
        contributionsLabel: "How much does each person owe?",
        totalContributions: 45,
        transactionCurrency: { code: "USD" },
        contributionEntries: [
            EmberObject.create({ user: alice, amount: 15 }),
            EmberObject.create({ user: bob, amount: 30 }),
        ],
        event: {
            currency: { code: "USD" },
        },
    });

    this.set("transaction", transaction);
    this.render(hbs`{{transaction-form transaction=transaction users=transaction.participants}}`);

    assert.equal(this.$(".transaction-payer").length, 1);
    assert.equal(this.$(".transaction-amount").length, 0);
    assert.equal(this.$(".transaction-participants").length, 0);
    assert.equal(this.$(".transaction-contributions li").length, 2);
    assert.equal(
        this.$(".transaction-contributions").closest(".form-group").find(".control-label").text().trim(),
        "How much does each person owe?"
    );
    assert.equal(this.$(".transaction-contributions-total").text().trim(), "Total: 45.00 USD");
});

test("it shows one amount row by default, with no remove button or total", function (assert) {
    assert.expect(3);

    const transaction = EmberObject.create({
        name: "Coffee",
        hasMultipleAmounts: false,
        amountEntries: [EmberObject.create({ value: 5 })],
    });

    this.set("transaction", transaction);
    this.render(hbs`{{transaction-form transaction=transaction users=transaction.participants}}`);

    assert.equal(this.$(".transaction-amounts li").length, 1);
    assert.equal(this.$(".remove-amount").length, 0);
    assert.equal(this.$(".transaction-amount-total").length, 0);
});

test("it lets several amounts be entered for one transaction, summed into a total", function (assert) {
    assert.expect(5);

    const transaction = EmberObject.create({
        name: "Groceries (several trips)",
        hasMultipleAmounts: true,
        amount: 75,
        transactionCurrency: { code: "USD" },
        amountEntries: [
            EmberObject.create({ value: 20 }),
            EmberObject.create({ value: 30 }),
            EmberObject.create({ value: 25 }),
        ],
        event: {
            currency: { code: "USD" },
        },
    });

    this.set("transaction", transaction);
    this.render(hbs`{{transaction-form transaction=transaction users=transaction.participants}}`);

    assert.equal(this.$(".transaction-amounts li").length, 3);
    assert.equal(this.$(".transaction-amount").eq(0).val(), "20");
    assert.equal(this.$(".transaction-amount").eq(1).val(), "30");
    assert.equal(this.$(".remove-amount").length, 3);
    assert.equal(this.$(".transaction-amount-total").text().trim(), "Total: 75.00 USD");
});

test("it doesn't show a currency selector when no currencies list is provided", function (assert) {
    assert.expect(1);

    const transaction = EmberObject.create({
        name: "Coffee",
        amountEntries: [EmberObject.create({ value: 5 })],
    });

    this.set("transaction", transaction);
    this.render(hbs`{{transaction-form transaction=transaction users=transaction.participants}}`);

    assert.equal(this.$(".transaction-currency").length, 0);
});

test("it shows a currency selector, with no exchange rate field, when using the event's own currency", function (assert) {
    assert.expect(3);

    const transaction = EmberObject.create({
        name: "Coffee",
        amountEntries: [EmberObject.create({ value: 5 })],
        transactionCurrency: { code: "USD", nameWithCode: "United States dollar (USD)" },
        isForeignCurrency: false,
        event: {
            currency: { code: "USD" },
        },
    });

    this.set("transaction", transaction);
    this.set("currencies", [{ code: "USD", nameWithCode: "United States dollar (USD)" }]);
    this.render(hbs`{{transaction-form transaction=transaction users=transaction.participants currencies=currencies}}`);

    assert.equal(this.$(".transaction-currency").length, 1);
    assert.equal(this.$(".transaction-exchange-rate").length, 0);
    assert.equal(this.$(".transaction-amount").closest("li").find(".input-group-addon").text().trim(), "USD");
});

test("it shows an editable exchange rate field when a foreign currency is selected", function (assert) {
    assert.expect(5);

    const transaction = EmberObject.create({
        name: "Souvenir",
        amount: 20,
        amountEntries: [EmberObject.create({ value: 20 })],
        transactionCurrency: { code: "USD", nameWithCode: "United States dollar (USD)" },
        isForeignCurrency: true,
        exchangeRate: 0.86,
        convertedAmount: 17.2,
        event: {
            currency: { code: "EUR" },
        },
    });

    this.set("transaction", transaction);
    this.set("currencies", [
        { code: "EUR", nameWithCode: "Euro (EUR)" },
        { code: "USD", nameWithCode: "United States dollar (USD)" },
    ]);
    this.render(hbs`{{transaction-form transaction=transaction users=transaction.participants currencies=currencies}}`);

    assert.equal(this.$(".transaction-exchange-rate").length, 1);
    assert.equal(this.$(".exchange-rate").val(), "0.86");
    assert.equal(this.$(".transaction-amount").closest("li").find(".input-group-addon").text().trim(), "USD");
    assert.ok(this.$(".transaction-amount-converted").text().trim().indexOf("17.20") > -1);
    assert.equal(this.$(".rate-fetch-error").length, 0);
});

test("it shows an error message when the exchange rate couldn't be fetched", function (assert) {
    assert.expect(1);

    const transaction = EmberObject.create({
        name: "Souvenir",
        amount: 20,
        amountEntries: [EmberObject.create({ value: 20 })],
        transactionCurrency: { code: "USD", nameWithCode: "United States dollar (USD)" },
        isForeignCurrency: true,
        exchangeRate: 1,
        rateFetchFailed: true,
        event: {
            currency: { code: "EUR" },
        },
    });

    this.set("transaction", transaction);
    this.set("currencies", [
        { code: "EUR", nameWithCode: "Euro (EUR)" },
        { code: "USD", nameWithCode: "United States dollar (USD)" },
    ]);
    this.render(hbs`{{transaction-form transaction=transaction users=transaction.participants currencies=currencies}}`);

    assert.equal(this.$(".rate-fetch-error").length, 1);
});

test("clicking refresh delegates to the form object", function (assert) {
    assert.expect(1);

    const transaction = EmberObject.create({
        name: "Souvenir",
        amount: 20,
        amountEntries: [EmberObject.create({ value: 20 })],
        transactionCurrency: { code: "USD", nameWithCode: "United States dollar (USD)" },
        isForeignCurrency: true,
        exchangeRate: 0.86,
        event: {
            currency: { code: "EUR" },
        },
        refreshExchangeRate() {
            assert.ok(true, "refreshExchangeRate was called on the form object");
        },
    });

    this.set("transaction", transaction);
    this.set("currencies", [
        { code: "EUR", nameWithCode: "Euro (EUR)" },
        { code: "USD", nameWithCode: "United States dollar (USD)" },
    ]);
    this.render(hbs`{{transaction-form transaction=transaction users=transaction.participants currencies=currencies}}`);

    this.$(".refresh-exchange-rate").click();
});

test("it shows an editable factor per participant when obeying factors", function (assert) {
    assert.expect(3);

    const john = { id: 2, name: "John" };
    const billy = { id: 3, name: "Billy" };

    const transaction = EmberObject.create({
        payer: john,
        name: "Gift for Alice",
        amount: "200",
        participants: [john, billy],
        obeyFactors: true,
        participantFactorEntries: [
            EmberObject.create({ participant: john, factor: 1 }),
            EmberObject.create({ participant: billy, factor: 0.5 }),
        ],
    });

    this.set("transaction", transaction);
    this.render(hbs`{{transaction-form transaction=transaction users=transaction.participants}}`);

    assert.equal(this.$(".transaction-participant-factors li").length, 2);
    assert.equal(this.$(".transaction-participant-factors .participant-factor").eq(0).val(), "1");
    assert.equal(this.$(".transaction-participant-factors .participant-factor").eq(1).val(), "0.5");
});
