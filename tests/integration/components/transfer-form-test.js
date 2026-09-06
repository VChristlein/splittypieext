import EmberObject from "@ember/object";
import { moduleForComponent, test } from "ember-qunit";
import hbs from "htmlbars-inline-precompile";

moduleForComponent("transfer-form", "Integration | Component | transfer form", {
    integration: true,
});

test("it renders with transfer model", function (assert) {
    assert.expect(3);

    const sender = { id: 1, name: "Bob" };
    const recipient = { id: 2, name: "Alice" };

    const transfer = EmberObject.create({
        sender,
        recipient,
        amount: "200",
        type: "transfer",
    });

    this.set("transfer", transfer);
    this.render(hbs`{{transfer-form transfer=transfer}}`);

    assert.equal(this.$(".transfer-sender").text().trim(), "Bob", "sender");
    assert.equal(this.$(".transfer-recipient").text().trim(), "Alice", "recipient");
    assert.equal(this.$(".transfer-amount").text().trim(), "200", "amount");
});

// regression test - the delete button had no explicit type, so it defaulted
// to type="submit" and, being the only submit-capable button in the form,
// pressing Enter anywhere in it triggered delete
test("the delete button can't be triggered by pressing Enter in a text field", function (assert) {
    const transfer = EmberObject.create({
        sender: { id: 1, name: "Bob" },
        recipient: { id: 2, name: "Alice" },
        amount: "200",
        type: "transfer",
    });

    this.set("transfer", transfer);
    this.render(hbs`{{transfer-form transfer=transfer}}`);

    assert.equal(this.$(".delete-transfer").attr("type"), "button");
});
