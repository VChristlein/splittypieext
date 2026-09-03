import EmberObject from "@ember/object";
import { moduleForComponent, test } from "ember-qunit";
import hbs from "htmlbars-inline-precompile";
import extraTrim from "../../helpers/extra-trim";

moduleForComponent("transaction-list-item", "Integration | Component | transaction list item", {
    integration: true,
});

test("it renders", function (assert) {
    assert.expect(1);

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
        event: {
            currency: { code: "USD" },
        },
    });

    this.set("transaction", transaction);
    this.render(hbs`{{transaction-list-item transaction=transaction}}`);

    assert.equal(
        extraTrim(this.$().text()),
        "John paid for Gift for Alice John, Billy 200.00 USD"
    );
});

test("it renders a donation", function (assert) {
    assert.expect(1);

    const transaction = EmberObject.create({
        payer: { id: 1, name: "Bob" },
        name: "Alice's birthday gift",
        amount: "20",
        participants: [{ id: 2, name: "Alice" }, { id: 3, name: "Carol" }],
        isDonation: true,
        event: {
            currency: { code: "USD" },
        },
    });

    this.set("transaction", transaction);
    this.render(hbs`{{transaction-list-item transaction=transaction}}`);

    assert.equal(
        extraTrim(this.$().text()),
        "Bob donated for Alice's birthday gift Alice, Carol 20.00 USD"
    );
});

test("it renders a deposit", function (assert) {
    assert.expect(1);

    const transaction = EmberObject.create({
        payer: { id: 1, name: "Bob" },
        name: "Flat prepayment",
        amount: "500",
        participants: [{ id: 1, name: "Bob" }, { id: 2, name: "Alice" }],
        isDeposit: true,
        event: {
            currency: { code: "USD" },
        },
    });

    this.set("transaction", transaction);
    this.render(hbs`{{transaction-list-item transaction=transaction}}`);

    assert.equal(
        extraTrim(this.$().text()),
        "Bob deposited for Flat prepayment Bob, Alice 500.00 USD"
    );
});
