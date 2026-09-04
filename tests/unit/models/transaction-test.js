import { moduleForModel, test } from "ember-qunit";

moduleForModel("transaction", "Unit | Model | transaction", {
    // Specify the other units that are required for this test.
    needs: ["model:user", "model:event", "model:currency"],
});

test("it exists", function (assert) {
    const model = this.subject();
    // let store = this.store();
    assert.ok(!!model);
});

test("originalAmount sums originalAmounts when the transaction has its own currency", function (assert) {
    const model = this.subject({ originalAmounts: [20, 5.5] });

    assert.equal(model.get("originalAmount"), 25.5);
});

test("originalAmount sums originalContributions when there's no originalAmounts", function (assert) {
    const model = this.subject({
        originalAmounts: [],
        originalContributions: { alice: 100, bob: 50 },
    });

    assert.equal(model.get("originalAmount"), 150);
});

test("originalAmount ignores non-positive or non-numeric contribution values", function (assert) {
    const model = this.subject({
        originalAmounts: [],
        originalContributions: { alice: 100, bob: -10, carol: null, dave: "not a number" },
    });

    assert.equal(model.get("originalAmount"), 100);
});

test("originalAmount is 0 for a transaction that never had a foreign currency", function (assert) {
    const model = this.subject();

    assert.equal(model.get("originalAmount"), 0);
});
