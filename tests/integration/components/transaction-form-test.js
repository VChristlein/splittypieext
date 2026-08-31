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
