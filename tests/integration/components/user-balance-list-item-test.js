import { moduleForComponent, test } from "ember-qunit";
import hbs from "htmlbars-inline-precompile";
import extraTrim from "../../helpers/extra-trim";

moduleForComponent("user-balance-list-item", "Integration | Component | user balance list item", {
    integration: true,
});

test("it renders", function (assert) {
    const user = {
        id: 1,
        name: "Tomasz",
        balance: 123,
        event: {
            currency: { code: "PLN" },
        },
    };

    this.set("user", user);
    this.render(hbs`{{user-balance-list-item user=user}}`);

    assert.equal(extraTrim(this.$().text()), "Tomasz 123.00 PLN", "proper text content");
    assert.ok(this.$("tr span").hasClass("label-success"), "success class for positive balance");
});

test("it renders a negative balance with the danger class", function (assert) {
    const user = {
        id: 1,
        name: "Tomasz",
        balance: -50,
        event: {
            currency: { code: "PLN" },
        },
    };

    this.set("user", user);
    this.render(hbs`{{user-balance-list-item user=user}}`);

    assert.equal(extraTrim(this.$().text()), "Tomasz -50.00 PLN", "proper text content");
    assert.ok(this.$("tr span").hasClass("label-danger"), "danger class for negative balance");
});

// regression test - a settled-up person's balance can be a tiny non-zero
// residual instead of exact 0 (see models/user.js#balance), which used to
// display as "-0.00" and, being < 0, get the same red styling as someone
// who genuinely still owes money
test("it renders a settled (zero) balance as neutral, not negative or positive", function (assert) {
    const user = {
        id: 1,
        name: "Tomasz",
        balance: 0,
        event: {
            currency: { code: "PLN" },
        },
    };

    this.set("user", user);
    this.render(hbs`{{user-balance-list-item user=user}}`);

    assert.equal(extraTrim(this.$().text()), "Tomasz 0.00 PLN", "shows 0.00, not -0.00");
    assert.ok(this.$("tr span").hasClass("label-info"), "neutral class for a settled balance");
    assert.notOk(this.$("tr span").hasClass("label-success"), "not counted as positive");
    assert.notOk(this.$("tr span").hasClass("label-danger"), "not counted as negative");
});
