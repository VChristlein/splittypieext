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
    assert.equal(this.$(".transaction-amount").val(), "");
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

test("it offers expense, donation and deposit as transaction types", function (assert) {
    assert.expect(4);

    const transaction = EmberObject.create({
        payer: { id: 1, name: "Bob" },
        type: "donation",
        selectedTransactionType: { value: "donation", label: "Donation (e.g. birthday gift)" },
    });

    this.set("transaction", transaction);
    this.render(hbs`{{transaction-form transaction=transaction users=transaction.participants}}`);

    assert.equal(this.$(".transaction-type option").length, 3);
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
