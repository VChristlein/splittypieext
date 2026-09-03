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

    const bob = { id: 1, name: "Bob" };
    const alice = { id: 2, name: "Alice" };

    const transaction = EmberObject.create({
        name: "Flat prepayment",
        amount: "350",
        isDeposit: true,
        contributions: { 1: 250, 2: 100 },
        event: {
            users: [bob, alice],
            currency: { code: "USD" },
        },
    });

    this.set("transaction", transaction);
    this.render(hbs`{{transaction-list-item transaction=transaction}}`);

    assert.equal(
        extraTrim(this.$().text()),
        "Deposit for Flat prepayment Bob (250), Alice (100) 350.00 USD"
    );
});

test("it renders an itemized expense", function (assert) {
    assert.expect(1);

    const bob = { id: 1, name: "Bob" };
    const alice = { id: 2, name: "Alice" };

    const transaction = EmberObject.create({
        payer: bob,
        name: "Groceries",
        amount: "45",
        isItemized: true,
        contributions: { 1: 15, 2: 30 },
        event: {
            users: [bob, alice],
            currency: { code: "USD" },
        },
    });

    this.set("transaction", transaction);
    this.render(hbs`{{transaction-list-item transaction=transaction}}`);

    assert.equal(
        extraTrim(this.$().text()),
        "Bob paid for Groceries Bob (15), Alice (30) 45.00 USD"
    );
});
