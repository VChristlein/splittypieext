import EmberObject from "@ember/object";
import { moduleForComponent, test } from "ember-qunit";
import hbs from "htmlbars-inline-precompile";

moduleForComponent("transaction-list", "Integration | Component | transaction list", {
    integration: true,
});

test("it renders no transactions info", function (assert) {
    // Set any properties with this.set("myProperty", "value");
    // Handle any actions with this.on("myAction", function(val) { ... });" + EOL + EOL +

    this.render(hbs`{{transaction-list}}`);

    assert.equal(this.$().text().trim(), "There are no transactions yet.");
});

test("it renders transaction list items", function (assert) {
    const users = [
        { name: "Bob" },
        { name: "Yuri" },
    ];
    const transactions = [
        EmberObject.create(
            { payer: users[0], date: "", name: "Transaction 1", amount: "200", participants: users }
        ),
        EmberObject.create(
            { payer: users[1], date: "", name: "Transaction 2", amount: "300", participants: users }
        ),
    ];

    this.set("transactions", transactions);
    this.render(hbs`{{transaction-list transactions=transactions}}`);

    assert.equal(this.$(".transaction-list-item").length, 2, "renders 2 transactions");
});

test("it filters transactions by name as you type, case-insensitively", function (assert) {
    const users = [{ name: "Bob" }];
    const transactions = [
        EmberObject.create({ payer: users[0], date: "", name: "Groceries", amount: "20", participants: users }),
        EmberObject.create({ payer: users[0], date: "", name: "Movie tickets", amount: "30", participants: users }),
    ];

    this.set("transactions", transactions);
    this.render(hbs`{{transaction-list transactions=transactions}}`);

    this.$(".transaction-search").val("movie").trigger("input");

    assert.equal(this.$(".transaction-list-item").length, 1);
    assert.ok(this.$().text().indexOf("Movie tickets") > -1);
    assert.ok(this.$().text().indexOf("Groceries") === -1);
});

test("it shows a distinct message when the search has no matches, instead of the empty-list message", function (assert) {
    const users = [{ name: "Bob" }];
    const transactions = [
        EmberObject.create({ payer: users[0], date: "", name: "Groceries", amount: "20", participants: users }),
    ];

    this.set("transactions", transactions);
    this.render(hbs`{{transaction-list transactions=transactions}}`);

    this.$(".transaction-search").val("something else entirely").trigger("input");

    assert.equal(this.$(".transaction-list-item").length, 0);
    assert.equal(this.$().text().trim(), "No transactions match your search.");
});
