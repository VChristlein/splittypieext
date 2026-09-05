import EmberObject from "@ember/object";
import { moduleForComponent, test } from "ember-qunit";
import hbs from "htmlbars-inline-precompile";

moduleForComponent("settlement-transfer-list", "Integration | Component | settlement transfer list", {
    integration: true,
});

function userWithBalance(name, balance) {
    return EmberObject.create({
        name,
        balance,
        event: EmberObject.create({ currency: EmberObject.create({ code: "USD" }) }),
    });
}

function transferredTotal(context) {
    return context.$(".settlement-item .text-nowrap").toArray().reduce(
        (sum, el) => sum + parseFloat(context.$(el).text()),
        0
    );
}

test("it doesn't leave a stray cent unsettled when a split doesn't divide evenly into cents", function (assert) {
    // $10 split 3 ways: the payer is owed back 10 - 10/3 = 6.666...67,
    // each of the other two owes 10/3 = 3.333...33 - none of which are
    // exact in cents. Rounding each suggested transfer independently used
    // to collect only 6.66 of the 6.67 actually owed.
    const payer = userWithBalance("Payer", 10 - (10 / 3));
    const alice = userWithBalance("Alice", -(10 / 3));
    const bob = userWithBalance("Bob", -(10 / 3));

    this.set("users", [payer, alice, bob]);
    this.set("settleUp", () => {});

    this.render(hbs`{{settlement-transfer-list users=users settleUp=settleUp}}`);

    assert.equal(transferredTotal(this).toFixed(2), "6.67");
});

test("it favors the fewest possible transactions over first-come-first-served order", function (assert) {
    // listed in an order where naively matching front-of-list against
    // front-of-list takes 4 transfers (1 with dave, then 3 more with
    // eve/carol crossing over), but matching the largest debtor against the
    // largest creditor each time only needs 3: carol's -27 exactly cancels
    // dave's +27 in a single transfer.
    const alice = userWithBalance("Alice", -1);
    const bob = userWithBalance("Bob", -2);
    const carol = userWithBalance("Carol", -27);
    const dave = userWithBalance("Dave", 27);
    const eve = userWithBalance("Eve", 3);

    this.set("users", [alice, bob, carol, dave, eve]);
    this.set("settleUp", () => {});

    this.render(hbs`{{settlement-transfer-list users=users settleUp=settleUp}}`);

    assert.equal(this.$(".settlement-item").length, 3);
});

test("it settles nothing when everyone's already even", function (assert) {
    this.set("users", [userWithBalance("Alice", 0), userWithBalance("Bob", 0)]);

    this.render(hbs`{{settlement-transfer-list users=users}}`);

    assert.equal(this.$(".settlement-item").length, 0);
    assert.equal(this.$(".alert-info").length, 1, "shows the 'nothing to settle' message");
});
