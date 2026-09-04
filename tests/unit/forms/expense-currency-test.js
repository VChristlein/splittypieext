import { run } from "@ember/runloop";
import { get, set } from "@ember/object";
import { moduleFor, test } from "ember-qunit";
import ExpenseForm from "splittypie/forms/expense";

moduleFor("service:form-factory", "Unit | Form | expense currency conversion", {
    needs: [
        "model:transaction",
        "model:event",
        "model:user",
        "model:currency",
        "service:locale",
        "service:local-storage",
        "validator:presence",
        "validator:number",
        "validator:length",
        "validator:messages",
    ],
    beforeEach() {
        this.register("forms:expense", ExpenseForm, { instantiate: false });
    },
});

function createEventWithUsers(store) {
    const usd = store.createRecord("currency", { id: "USD", name: "United States dollar" });
    const eur = store.createRecord("currency", { id: "EUR", name: "Euro" });
    const event = store.createRecord("event", { name: "Trip", currency: eur });
    const bob = store.createRecord("user", { id: "bob", name: "Bob", event });
    const alice = store.createRecord("user", { id: "alice", name: "Alice", event });

    return {
        usd, eur, event, bob, alice,
    };
}

test("saving in a foreign currency converts amounts using the exchange rate, and keeps the originals", function (assert) {
    const store = this.container.lookup("service:store");
    const formFactory = this.subject();
    let transaction;

    run(() => {
        const { usd, event, bob, alice } = createEventWithUsers(store);

        transaction = store.createRecord("transaction", {
            event,
            payer: bob,
            participants: [bob, alice],
            type: "expense",
        });

        const form = formFactory.createForm("expense", transaction);

        set(form, "name", "Souvenir");
        set(form, "date", "2024-01-01");
        get(form, "_amounts").objectAt(0).value = 20;

        // bypass the async rate-fetch triggered by the transactionCurrency
        // setter - that wiring is covered separately, this only checks the
        // conversion math once a currency+rate are in place
        set(form, "_currency", usd);
        set(form, "exchangeRate", 0.5);

        form.updateModelAttributes();
    });

    assert.equal(get(transaction, "amount"), 10, "amount is converted (20 USD * 0.5 = 10 EUR)");
    assert.deepEqual(get(transaction, "amounts"), [10]);
    assert.deepEqual(get(transaction, "originalAmounts"), [20], "the originally typed-in amount is preserved");
    assert.equal(get(transaction, "currency.id"), "USD");
    assert.equal(get(transaction, "exchangeRate"), 0.5);
});

test("saving a deposit in a foreign currency converts each person's contribution", function (assert) {
    const store = this.container.lookup("service:store");
    const formFactory = this.subject();
    let transaction;
    let bob;
    let alice;

    run(() => {
        const created = createEventWithUsers(store);
        bob = created.bob;
        alice = created.alice;

        transaction = store.createRecord("transaction", {
            event: created.event,
            type: "deposit",
        });

        const form = formFactory.createForm("expense", transaction);

        set(form, "name", "Flat prepayment");
        set(form, "date", "2024-01-01");
        get(form, "contributionEntries").findBy("user", bob).set("amount", 100);
        get(form, "contributionEntries").findBy("user", alice).set("amount", 50);

        set(form, "_currency", created.usd);
        set(form, "exchangeRate", 0.5);

        form.updateModelAttributes();
    });

    const contributions = get(transaction, "contributions");
    const originalContributions = get(transaction, "originalContributions");

    assert.equal(contributions[get(bob, "id")], 50, "bob's contribution is converted (100 USD * 0.5)");
    assert.equal(contributions[get(alice, "id")], 25, "alice's contribution is converted (50 USD * 0.5)");
    assert.equal(originalContributions[get(bob, "id")], 100, "bob's original contribution is preserved");
    assert.equal(originalContributions[get(alice, "id")], 50, "alice's original contribution is preserved");
    assert.equal(get(transaction, "amount"), 75, "total amount is also converted (150 USD * 0.5)");
});

test("saving in the event's own currency doesn't convert anything", function (assert) {
    const store = this.container.lookup("service:store");
    const formFactory = this.subject();
    let transaction;

    run(() => {
        const { event, bob, alice } = createEventWithUsers(store);

        transaction = store.createRecord("transaction", {
            event,
            payer: bob,
            participants: [bob, alice],
            type: "expense",
        });

        const form = formFactory.createForm("expense", transaction);

        set(form, "name", "Dinner");
        set(form, "date", "2024-01-01");
        get(form, "_amounts").objectAt(0).value = 40;

        assert.equal(get(form, "transactionCurrency.id"), "EUR", "defaults to the event's own currency");
        assert.notOk(get(form, "isForeignCurrency"));

        form.updateModelAttributes();
    });

    assert.equal(get(transaction, "amount"), 40);
    assert.deepEqual(get(transaction, "amounts"), [40]);
    assert.deepEqual(get(transaction, "originalAmounts"), []);
    assert.equal(get(transaction, "currency.id"), null);
    assert.equal(get(transaction, "exchangeRate"), 1);
});

test("editing an existing foreign-currency transaction shows the original amount, not the converted one", function (assert) {
    const store = this.container.lookup("service:store");
    const formFactory = this.subject();

    run(() => {
        const { usd, event, bob, alice } = createEventWithUsers(store);

        const transaction = store.createRecord("transaction", {
            event,
            payer: bob,
            participants: [bob, alice],
            type: "expense",
            currency: usd,
            exchangeRate: 0.5,
            amount: 10,
            amounts: [10],
            originalAmounts: [20],
        });

        const form = formFactory.createForm("expense", transaction);

        assert.equal(get(form, "amountEntries.firstObject.value"), 20, "shows the original 20 USD, not the converted 10 EUR");
        assert.equal(get(form, "exchangeRate"), 0.5);
        assert.equal(get(form, "transactionCurrency.id"), "USD");
        assert.ok(get(form, "isForeignCurrency"));
    });
});
